// Development-only, resumable importer. Publication uses the real audited admin
// APIs; direct writes are restricted to source evidence and nonpublic references.
import { Client } from 'pg';
import { buildManifest, digest, code } from './legacy-catalog-manifest.mjs';
import { assertDevelopmentDatabase } from '../dist/security/development-foundation.js';
import { decimal } from '../dist/product-types/registry.js';

export async function assertRehearsalDestination(db, url, environment) {
  assertDevelopmentDatabase(url, environment);
  const actual = (
    await db.$queryRaw`SELECT current_database() AS name, host(inet_server_addr()) AS address`
  )[0];
  if (
    actual.name !== new URL(url).pathname.slice(1) ||
    !['127.0.0.1', '::1'].includes(actual.address)
  )
    throw Error('Actual rehearsal destination mismatch.');
}
export async function importLegacyCatalog({
  db,
  url,
  base,
  token,
  bffKey,
  actorId,
  tenantId,
  storeId,
  manifest,
  confirm,
  interruptAfter,
  interruptAfterProductCreation = false,
}) {
  if (confirm !== 'ISOLATED_DEVELOPMENT_REHEARSAL')
    throw Error('Explicit rehearsal confirmation required.');
  await assertRehearsalDestination(db, url, process.env.NODE_ENV);
  const origin = new URL(base);
  if (
    !['http:'].includes(origin.protocol) ||
    !['127.0.0.1', 'localhost'].includes(origin.hostname) ||
    origin.pathname !== '/' ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash
  )
    throw Error('Only a fixed loopback development API origin is accepted.');
  const current = await buildManifest();
  if (current.checksum !== manifest.checksum)
    throw Error('Manifest differs from reviewed local source.');
  const { checksum, ...body } = manifest;
  if (digest(body) !== checksum) throw Error('Manifest checksum mismatch.');
  const store = await db.store.findFirst({
    where: { id: storeId, tenantId, active: true, tenant: { active: true } },
  });
  if (
    !store ||
    !(await db.storeMembership.findUnique({
      where: {
        tenantId_storeId_userId: { tenantId, storeId, userId: actorId },
      },
    }))
  )
    throw Error('Approved fixture store membership required.');
  const lock = new Client({ connectionString: url });
  await lock.connect();
  if (
    !(await lock.query('SELECT pg_try_advisory_lock(78201907) AS locked'))
      .rows[0].locked
  ) {
    await lock.end();
    throw Error('Another catalog rehearsal is running.');
  }
  const api = async (route, body, method = body ? 'POST' : 'GET') => {
    const r = await fetch(base + '/api/admin/' + route, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
      headers: {
        'Content-Type': 'application/json',
        'x-admin-bff-key': bffKey,
        Authorization: 'Bearer ' + token,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok)
      throw Error(
        `Import admin operation failed: ${method} ${route.replace(/[a-f0-9-]{36}/g, ':id')} HTTP ${r.status}`,
      );
    return r.json();
  };
  const schema = `scopes/tenants/${tenantId}/schema`,
    catalog = `scopes/tenants/${tenantId}/catalog`,
    scope = `stores/${storeId}`;
  let writes = 0;
  const evidence = async (kind, r) => {
    const where = {
      storeId_kind_sourceKey: { storeId, kind, sourceKey: r.sourceKey },
    };
    let e = await db.catalogImportRecord.findUnique({ where });
    if (e && (e.sourceHash !== r.sourceHash || e.manifestHash !== checksum))
      throw Error(
        'Previously imported source changed; explicit reconciliation required.',
      );
    if (!e)
      e = await db.catalogImportRecord.create({
        data: {
          tenantId,
          storeId,
          kind,
          sourceKey: r.sourceKey,
          sourceHash: r.sourceHash,
          manifestHash: checksum,
          source: r.source,
          referenceAmount:
            kind === 'PRODUCT' ? r.source.product.referencePricePKR : null,
        },
      });
    return e;
  };
  const finish = async (e, mapping, links) => {
    await db.catalogImportRecord.update({
      where: { id: e.id },
      data: { mapping, complete: true, ...links },
    });
    writes++;
    if (interruptAfter === writes)
      throw Error('Intentional rehearsal interruption.');
  };
  const transition = async (row, path, steps) => {
    for (const [state, action] of steps)
      if (row.status === state)
        row = await api(path(row) + '/actions/' + action, {
          revision: row.revision,
          ...(row.rootRevision ? { rootRevision: row.rootRevision } : {}),
        });
    return row;
  };
  const attribute = async (input) => {
    const existing = await db.attributeDefinition.findUnique({
      where: { tenantId_code: { tenantId, code: input.code } },
    });
    if (existing) {
      if (
        existing.label !== input.label ||
        existing.dataType !== input.dataType ||
        existing.canonicalUnit !== input.canonicalUnit
      )
        throw Error('Attribute mapping conflict.');
      return existing;
    }
    return api(schema + '/attributes', {
      description: 'Legacy source mapping; original values retained',
      rules: {},
      axisEligible: false,
      visibility: { admin: true, storefront: true },
      allowedScopes: ['PRODUCT'],
      optionSetId: null,
      ...input,
    });
  };
  const attrs = new Map(),
    types = new Map(),
    categories = new Map();
  try {
    // No roles, passwords, memberships or inventory are changed by the importer.
    if (
      store.currency !== 'PKR' ||
      store.locale !== 'en-PK' ||
      store.timeZone !== 'Asia/Karachi'
    ) {
      if (await db.storeListing.count({ where: { storeId } }))
        throw Error('Existing populated store configuration differs.');
      await db.store.update({
        where: { id: storeId },
        data: { currency: 'PKR', locale: 'en-PK', timeZone: 'Asia/Karachi' },
      });
    }
    for (const c of manifest.categories) {
      const e = await evidence('CATEGORY', c),
        records = manifest.records.filter(
          (r) => r.source.product.category === c.sourceKey,
        );
      if (e.complete) {
        const saved = await db.category.findUniqueOrThrow({
          where: { id: e.categoryId },
        });
        if (digest(saved.activeSnapshot) !== e.mapping.snapshotHash)
          throw Error('Published category drift detected.');
        categories.set(c.sourceKey, saved);
        types.set(c.sourceKey, e.mapping.typeVersionId);
        continue;
      }
      const fields = new Map();
      for (const r of records) {
        for (const s of r.specs) {
          fields.set(s.attributeCode, {
            code: s.attributeCode,
            label: s.label,
            dataType: 'TEXT',
            canonicalUnit: null,
            widget: 'text',
            group: 'source_specifications',
          });
          if (s.numeric)
            fields.set(code('legacy_number', s.attributeCode), {
              code: code('legacy_number', s.attributeCode),
              label: s.label + ' (canonical)',
              dataType: 'NUMBER',
              canonicalUnit: s.numeric.unit,
              widget: 'number',
              group: 'canonical_measurements',
            });
        }
        for (const f of r.filters)
          if (f.values.length)
            fields.set(f.attributeCode, {
              code: f.attributeCode,
              label: f.label,
              dataType: 'MULTI_SELECT',
              canonicalUnit: null,
              widget: 'multiselect',
              group: 'filter_values',
              facet: f,
            });
      }
      for (const f of fields.values()) {
        let optionSetId = null;
        if (f.facet) {
          const values = [
            ...new Set(
              manifest.records.flatMap((r) =>
                r.filters
                  .filter((x) => x.attributeCode === f.code)
                  .flatMap((x) => x.values),
              ),
            ),
          ];
          if (values.length > 50) throw Error('Facet option budget exceeded.');
          let set = await db.optionSet.findUnique({
            where: { tenantId_code: { tenantId, code: f.code } },
            include: { values: true },
          });
          if (!set)
            set = await api(schema + '/option-sets', {
              code: f.code,
              label: f.label,
              values: values.map((v, i) => ({
                code: code('value', v),
                label: v,
                sortOrder: i,
              })),
            });
          optionSetId = set.id;
          f.options = set.values;
        }
        const { group, facet, options, ...input } = f;
        const a = await attribute({ ...input, optionSetId });
        attrs.set(f.code, { ...a, options });
      }
      let type = await db.productType.findUnique({
        where: { tenantId_code: { tenantId, code: c.typeCode } },
        include: { versions: { orderBy: { number: 'asc' } } },
      });
      if (!type)
        type = await api(schema + '/product-types', {
          code: c.typeCode,
          label: c.source.name,
        });
      let version = await api(
        `${schema}/product-types/${type.id}/versions/${type.versions[0].id}`,
      );
      const vp = `${schema}/product-types/${type.id}/versions/${version.id}`;
      if (version.status === 'DRAFT')
        version = await api(
          vp,
          {
            revision: version.revision,
            label: c.source.name,
            description: 'Reviewed lossless legacy source mapping',
            allowNoSku: false,
            groups: [
              ['source_specifications', 'Source specifications'],
              ['canonical_measurements', 'Canonical measurements'],
              ['filter_values', 'Catalog filter values'],
            ].map(([code, label], sortOrder) => ({ code, label, sortOrder })),
            fields: [...fields.values()].map((f, i) => ({
              attributeId: attrs.get(f.code).id,
              groupCode: f.group,
              level: 'PRODUCT',
              required: false,
              variantAxis: false,
              sortOrder: i,
              widget: f.widget,
              rules: {},
              visibility: { admin: true, storefront: true },
            })),
          },
          'PATCH',
        );
      for (const [state, a] of [
        ['DRAFT', 'review'],
        ['REVIEW', 'approve'],
      ])
        if (version.status === state)
          version = await api(vp + '/actions/' + a, {
            revision: version.revision,
          });
      if (!['APPROVED', 'ACTIVE'].includes(version.status))
        throw Error('Schema did not reach approved state.');
      types.set(c.sourceKey, version.id);
      let category = await db.category.findUnique({
        where: { storeId_code: { storeId, code: c.code } },
      });
      if (!category)
        category = await api(scope + '/categories', {
          code: c.code,
          name: c.source.name,
          slug: c.source.slug,
          description: c.source.description,
          seo: c.source.seo,
          sortOrder: c.source.sourceOrder,
          compatibility: 'ALLOW_LIST',
          productTypeIds: [type.id],
        });
      category = await transition(
        category,
        (r) => `${scope}/categories/${r.id}`,
        [
          ['DRAFT', 'review'],
          ['REVIEW', 'approve'],
          ['APPROVED', 'activate'],
        ],
      );
      if (category.status !== 'ACTIVE') throw Error('Category not active.');
      let filterSet = await db.categoryFilterSet.findFirst({
        where: { categoryId: category.id },
        orderBy: { number: 'desc' },
      });
      if (!filterSet)
        filterSet = await api(
          `${scope}/categories/${category.id}/filter-sets`,
          {},
        );
      const fp = `${scope}/categories/${category.id}/filter-sets/${filterSet.id}`;
      if (filterSet.status === 'DRAFT')
        filterSet = await api(
          fp,
          {
            revision: filterSet.revision,
            includeDescendants: false,
            typeVersionIds: [version.id],
            filters: [
              {
                code: 'brand',
                label: 'Brand',
                source: 'BRAND',
                level: 'PRODUCT',
                control: 'checkbox_group',
                operators: ['in'],
                allowedValues: [
                  ...new Set(
                    records.map((r) =>
                      code('legacy_brand', r.source.product.brand),
                    ),
                  ),
                ],
                sortOrder: 0,
              },
              ...records[0].filters
                .filter((f) => fields.has(f.attributeCode))
                .map((f, i) => ({
                  code: f.code,
                  label: f.label,
                  source: 'ATTRIBUTE',
                  attributeId: attrs.get(f.attributeCode).id,
                  level: 'PRODUCT',
                  control: 'checkbox_group',
                  operators: ['in'],
                  typeVersionIds: [version.id],
                  sortOrder: i + 1,
                })),
            ],
          },
          'PATCH',
        );
      for (const [state, a] of [
        ['DRAFT', 'review'],
        ['REVIEW', 'approve'],
        ['APPROVED', 'activate'],
      ])
        if (filterSet.status === state)
          filterSet = await api(fp + '/actions/' + a, {
            revision: filterSet.revision,
            categoryRevision: category.filterRevision,
          });
      const saved = await db.category.findUniqueOrThrow({
        where: { id: category.id },
      });
      categories.set(c.sourceKey, saved);
      await finish(
        e,
        {
          typeVersionId: version.id,
          snapshotHash: digest(saved.activeSnapshot),
          filterSetId: filterSet.id,
        },
        { categoryId: category.id },
      );
    }
    // Reload approved mappings on repeat/resume; never regenerate SKU options.
    const definitions = await db.attributeDefinition.findMany({
      where: { tenantId, code: { startsWith: 'legacy_' } },
      include: { optionSet: { include: { values: true } } },
    });
    for (const a of definitions)
      attrs.set(a.code, { ...a, options: a.optionSet?.values });
    for (const r of manifest.records) {
      const e = await evidence('PRODUCT', r),
        p = r.source.product;
      if (e.complete) {
        const l = await db.storeListing.findUniqueOrThrow({
          where: { id: e.listingId },
          include: { published: true },
        });
        if (
          l.publishedRevisionId !== e.mapping.listingRevisionId ||
          l.published.slug !== p.slug ||
          l.archived
        )
          throw Error('Published listing drift; no overwrite allowed.');
        continue;
      }
      let brand = await db.catalogBrand.findUnique({
        where: {
          tenantId_code: { tenantId, code: code('legacy_brand', p.brand) },
        },
      });
      if (!brand)
        brand = await api(catalog + '/brands', {
          code: code('legacy_brand', p.brand),
          name: p.brand,
        });
      const values = [];
      for (const s of r.specs) {
        values.push({
          attributeId: attrs.get(s.attributeCode).id,
          text: String(s.raw),
        });
        if (s.numeric)
          values.push({
            attributeId: attrs.get(code('legacy_number', s.attributeCode)).id,
            number: s.numeric.number,
          });
      }
      for (const f of r.filters)
        if (f.values.length) {
          const a = attrs.get(f.attributeCode);
          values.push({
            attributeId: a.id,
            options: f.values.map(
              (v) => a.options.find((o) => o.label === v).id,
            ),
          });
        }
      let product = await db.product.findUnique({
        where: { tenantId_code: { tenantId, code: r.code } },
        include: { revisions: { orderBy: { number: 'asc' } } },
      });
      let revision;
      if (product) {
        if (
          product.externalReference !== p.id ||
          product.revisions.length !== 1
        )
          throw Error('Existing product ownership/history conflict.');
        revision = await api(
          `${catalog}/products/${product.id}/revisions/${product.revisions[0].id}`,
        );
      } else
        revision = await api(catalog + '/products', {
          code: r.code,
          externalReference: p.id,
          schemaVersionId: types.get(p.category),
          name: p.name,
          slug: p.slug,
          description: p.shortDescription,
          brandId: brand.id,
          sellingMode: 'REFERENCE',
          values,
          skus: [
            {
              code: r.skuCode,
              manufacturerPartNumber: p.manufacturerSku ?? null,
              values: [],
            },
          ],
        });
      if (interruptAfterProductCreation && !product)
        throw Error('Intentional rehearsal product creation interruption.');
      const factsMatch =
        revision.values.length === values.length &&
        values.every((input) => {
          const saved = revision.values.find(
            (value) => value.binding.attributeId === input.attributeId,
          );
          if (!saved) return false;
          if (input.text !== undefined) return saved.textValue === input.text;
          if (input.number !== undefined)
            return (
              saved.numberValue !== null &&
              decimal(input.number).eq(saved.numberValue)
            );
          return (
            digest(saved.choices.map((c) => c.optionId).sort()) ===
            digest(input.options.slice().sort())
          );
        });
      if (
        revision.name !== p.name ||
        revision.slug !== p.slug ||
        revision.description !== p.shortDescription ||
        revision.schemaVersionId !== types.get(p.category) ||
        revision.sellingMode !== 'REFERENCE' ||
        revision.brandId !== brand.id ||
        !factsMatch ||
        revision.skus.length !== 1 ||
        revision.skus[0].sku.code !== r.skuCode ||
        revision.skus[0].sku.manufacturerPartNumber !==
          (p.manufacturerSku ?? null) ||
        revision.bindings.some((b) => b.axis)
      )
        throw Error('Product source conflict.');
      revision = await transition(
        revision,
        (row) => `${catalog}/products/${row.productId}/revisions/${row.id}`,
        [
          ['DRAFT', 'review'],
          ['IN_REVIEW', 'approve'],
          ['APPROVED', 'publish'],
        ],
      );
      const media = [];
      for (const m of r.media) {
        const assetCode = code('legacy_media', { id: p.id, order: m.order });
        const asset = await db.mediaAsset.upsert({
          where: { tenantId_code: { tenantId, code: assetCode } },
          update: {},
          create: {
            tenantId,
            code: assetCode,
            createdBy: actorId,
            sourceUrl: m.sourceUrl,
            storageReference: m.src,
            storageProvider: 'REFERENCE',
            mimeType: m.src.endsWith('.png')
              ? 'image/png'
              : m.src.endsWith('.webp')
                ? 'image/webp'
                : 'image/jpeg',
            width: m.width ?? null,
            height: m.height ?? null,
            contentDigest: m.sha256,
            byteSize: m.bytes,
            altText: m.alt,
            rights: 'UNVERIFIED',
            publicUse: false,
            developmentOnly: true,
            intendedPurpose: 'GALLERY',
            rightsMetadata: {
              sourceUsage: m.rights,
              creditUrl: m.creditUrl ?? null,
              sourceDevelopmentOnly: m.developmentOnly,
              reviewRequired: true,
            },
          },
        });
        media.push({
          assetId: asset.id,
          purpose: m.purpose,
          sortOrder: m.order,
          productRevisionId: revision.id,
          assignment: 'WITHHELD_PENDING_USAGE_APPROVAL',
          source: m,
        });
      }
      let listing = await db.storeListing.findUnique({
        where: {
          storeId_productId: { storeId, productId: revision.productId },
        },
        include: { revisions: { orderBy: { number: 'asc' } } },
      });
      let lr = listing
        ? await api(
            `${scope}/listings/${listing.id}/revisions/${listing.revisions[0].id}`,
          )
        : await api(scope + '/listings', {
            code: r.code,
            title: p.name,
            slug: p.slug,
            productRevisionId: revision.id,
            categoryIds: [categories.get(p.category).id],
            skuRevisionIds: revision.skus.map((s) => s.id),
            seo: r.source.seo,
            featuredOrder: r.featuredOrder,
            newArrivalOrder: r.newArrivalOrder,
            catalogOrder: r.source.sourceOrder,
          });
      if (
        lr.productRevisionId !== revision.id ||
        lr.title !== p.name ||
        lr.slug !== p.slug ||
        lr.catalogOrder !== r.source.sourceOrder ||
        lr.featuredOrder !== r.featuredOrder ||
        lr.newArrivalOrder !== r.newArrivalOrder ||
        digest(lr.seo) !== digest(r.source.seo) ||
        lr.categories.length !== 1 ||
        lr.categories[0].categoryId !== categories.get(p.category).id ||
        lr.skus.length !== 1 ||
        lr.skus[0].skuRevisionId !== revision.skus[0].id
      )
        throw Error('Listing source conflict.');
      lr = await transition(
        lr,
        (row) => `${scope}/listings/${row.listingId}/revisions/${row.id}`,
        [
          ['DRAFT', 'review'],
          ['IN_REVIEW', 'approve'],
          ['APPROVED', 'publish'],
        ],
      );
      if (lr.status !== 'PUBLISHED') throw Error('Listing did not publish.');
      await finish(
        e,
        {
          productId: revision.productId,
          productRevisionId: revision.id,
          listingRevisionId: lr.id,
          skuId: revision.skus[0].skuId,
          skuRevisionId: revision.skus[0].id,
          legacyId: p.id,
          categoryId: categories.get(p.category).id,
          media,
        },
        { listingId: lr.listingId },
      );
    }
    return {
      manifestHash: checksum,
      products: 84,
      categories: 12,
      completedWrites: writes,
      approvedPrices: 0,
      inventedInventory: 0,
    };
  } finally {
    await lock.query('SELECT pg_advisory_unlock(78201907)');
    await lock.end();
  }
}
