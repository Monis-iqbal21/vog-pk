import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  products,
  productCategories,
} from '../../frontend/src/data/products.js';
import { getProductDetailBySlug } from '../../frontend/src/lib/products.js';
import {
  categoryFilters,
  categoryDescriptions,
} from '../../frontend/src/config/categoryFilters.js';
import { getFacetValues } from '../../frontend/src/lib/product-listings.js';
import { site } from '../../frontend/src/config/site.js';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export const digest = (value) =>
  createHash('sha256')
    .update(
      typeof value === 'string' || Buffer.isBuffer(value)
        ? value
        : canonical(value),
    )
    .digest('hex');
export const code = (prefix, value) =>
  prefix + '_' + digest(value).slice(0, 24);
// Exact scalar/unit grammar only. Raw specification strings are always retained
// separately, even when a supplemental canonical numeric value is available.
const numericRules = {
  Cores: 'one',
  Threads: 'one',
  'Buttons quantity': 'one',
  'Number of memory slots': 'one',
  'HDMI ports quantity': 'one',
  'DisplayPorts quantity': 'one',
  'Base power': 'W',
  'Total power': 'W',
  Weight: 'g',
  Width: 'mm',
  Height: 'mm',
  Depth: 'mm',
  Thickness: 'mm',
  'Maximum graphics card length': 'mm',
  'Maximum CPU cooler height': 'mm',
  'Fan diameter': 'mm',
  'Radiator width': 'mm',
  'Radiator depth': 'mm',
  'Maximum refresh rate': 'Hz',
  'Response time': 'ms',
  'Maximum boost': 'GHz',
  'Discrete graphics card memory': 'GB',
  'Internal memory': 'GB',
  'SSD capacity': 'GB',
  'Memory data transfer rate': 'MT/s',
  'Memory clock speed': 'MHz',
};
export function numericValue(label, raw) {
  const unit = numericRules[label];
  if (
    unit === 'one' &&
    typeof raw === 'number' &&
    Number.isSafeInteger(raw) &&
    raw >= 0
  )
    return { number: String(raw), unit };
  if (!unit || typeof raw !== 'string') return null;
  const m = raw.match(/^(\d+(?:\.\d{1,6})?)(?: (.+))?$/);
  if (!m || (unit === 'one' ? !!m[2] : m[2] !== unit)) return null;
  return { number: m[1], unit };
}
export async function buildManifest() {
  if (products.length !== 84 || productCategories.length !== 12)
    throw Error('Source counts changed; review required.');
  const exceptions = [],
    routes = new Set(),
    sourceFiles = {};
  const addRoute = (slug) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || routes.has(slug))
      throw Error('Source route collision/invalid slug.');
    routes.add(slug);
  };
  for (const file of [
    'frontend/src/data/products.js',
    'frontend/src/data/catalogue-products.js',
    'frontend/src/data/productDetails.js',
    'frontend/src/data/product-detail-gallery.js',
    'frontend/src/data/product-images.js',
    'frontend/src/config/categoryFilters.js',
    'frontend/src/config/site.js',
    'frontend/src/lib/products.js',
    'frontend/src/lib/product-listings.js',
  ])
    sourceFiles[file] = digest(
      (await fs.readFile(path.join(root, file), 'utf8')).replaceAll(
        '\r\n',
        '\n',
      ),
    );
  const categories = productCategories.map((c, i) => {
    addRoute(c.slug);
    const source = {
      ...c,
      description: categoryDescriptions[c.slug],
      filters: categoryFilters[c.slug] ?? [],
      parent: null,
      path: '/products/' + c.slug,
      canonical: new URL('/products/' + c.slug, site.url).href,
      seo: {
        title: `${c.name} in Pakistan | VOGPK`,
        description: categoryDescriptions[c.slug],
      },
      sourceOrder: i,
    };
    return {
      sourceKey: c.slug,
      sourceHash: digest(source),
      source,
      code: code('legacy_category', c.slug),
      typeCode: code('legacy_type', c.slug),
    };
  });
  const records = [];
  for (const [i, p] of products.entries()) {
    addRoute(p.slug);
    if (
      records.some((r) => r.sourceKey === p.id) ||
      !categories.some((c) => c.sourceKey === p.category)
    )
      throw Error('Source identity or category invalid.');
    const detail = getProductDetailBySlug(p.slug),
      media = [];
    for (const [n, g] of detail.gallery.entries()) {
      if (
        !/^\/images\/products\/[a-zA-Z0-9_./-]+\.(png|webp|jpg|jpeg)$/.test(
          g.src,
        ) ||
        g.src.includes('..')
      )
        throw Error('Unsafe legacy media path.');
      let hash = null,
        bytes = null;
      try {
        const b = await fs.readFile(path.join(root, 'frontend/public', g.src));
        hash = digest(b);
        bytes = b.length;
      } catch {
        exceptions.push({
          product: p.id,
          field: g.src,
          reason: 'MISSING_LOCAL_IMAGE',
        });
      }
      media.push({
        ...g,
        purpose: 'GALLERY',
        order: n,
        sourceUrl: p.imageSourceUrl,
        rights: p.imageUsageStatus,
        developmentOnly: p.imageDevelopmentOnly,
        sha256: hash,
        bytes,
      });
    }
    const specs = Object.entries(detail.specifications).map(
      ([label, raw], order) => ({
        label,
        raw,
        order,
        attributeCode: code(
          'legacy_spec',
          ['Type', 'Form factor', 'Interface'].includes(label)
            ? { category: p.category, label }
            : label,
        ),
        numeric: numericValue(label, raw),
      }),
    );
    for (const s of specs)
      if (numericRules[s.label] && !s.numeric)
        exceptions.push({
          product: p.id,
          field: s.label,
          value: s.raw,
          reason:
            'NO_LOSSLESS_CANONICAL_UNIT_MAPPING; original retained as TEXT',
        });
    if (!p.manufacturerSku)
      exceptions.push({
        product: p.id,
        field: 'manufacturerSku',
        reason: 'NOT_RECORDED; no part number inferred',
      });
    const filters = (categoryFilters[p.category] ?? []).map((f) => ({
      ...f,
      code: f.code.replaceAll('-', '_'),
      values: getFacetValues(p, f),
      attributeCode: code('legacy_facet', {
        label: f.label,
        keys: f.keys,
        split: f.split,
      }),
    }));
    for (const f of filters)
      if (!f.values.length)
        exceptions.push({
          product: p.id,
          field: f.code,
          reason: 'SOURCE_FILTER_HAS_NO_VALUE; no inferred replacement',
        });
    if (
      detail.variants.length ||
      detail.options.length ||
      detail.contentBlocks.length
    )
      throw Error('New variants/content require explicit source mapping.');
    const source = {
      product: p,
      specifications: detail.specifications,
      gallery: detail.gallery,
      posters: [],
      additionalContent: [],
      path: '/products/' + p.slug,
      canonical: new URL('/products/' + p.slug, site.url).href,
      seo: {
        title: `${p.name} | ${site.name}`,
        description: p.shortDescription,
      },
      aliases: ['/products/' + p.category + '/' + p.slug],
      breadcrumbs: ['/', '/products/' + p.category, '/products/' + p.slug],
      sourceOrder: i,
    };
    records.push({
      sourceKey: p.id,
      sourceHash: digest(source),
      source,
      code: code('legacy_product', p.id),
      skuCode: 'LEGACY-' + digest(p.id).slice(0, 24).toUpperCase(),
      specs,
      filters,
      media,
      featuredOrder: p.featured
        ? products.slice(0, i).filter((p) => p.featured).length
        : null,
      newArrivalOrder: p.newArrival
        ? products.slice(0, i).filter((p) => p.newArrival).length
        : null,
    });
  }
  const body = {
    version: 1,
    scope: 'DEVELOPMENT_REHEARSAL_ONLY',
    currency: 'PKR',
    locale: 'en-PK',
    timeZone: 'Asia/Karachi',
    sourceFiles,
    categories,
    records,
    collections: {
      featured: products.filter((p) => p.active && p.featured).map((p) => p.id),
      'new-arrivals': products
        .filter((p) => p.active && p.newArrival)
        .map((p) => p.id),
    },
    homepageLimit: 7,
    exceptions,
  };
  return { ...body, checksum: digest(body) };
}
if (process.argv.includes('--write')) {
  const m = await buildManifest();
  await fs.mkdir(path.join(root, 'backend/docs/catalog-migration'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, 'backend/docs/catalog-migration/manifest.json'),
    JSON.stringify(m, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(root, 'backend/docs/catalog-migration/exceptions.json'),
    JSON.stringify(
      {
        checksum: m.checksum,
        exceptions: m.exceptions,
        media:
          'All legacy references retained; none automatically approved or delivered',
        posters: 'Absent for all 84 products',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Manifest: ${m.records.length} products, ${m.categories.length} categories; ${m.exceptions.length} review items; ${m.checksum}`,
  );
}
