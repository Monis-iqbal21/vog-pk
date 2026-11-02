import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildPreflightManifest } from './catalog-preflight-manifest.mjs';
import { root, digest, canonical } from './legacy-catalog-manifest.mjs';

const m = await buildPreflightManifest(),
  out = path.join(root, 'backend/docs/catalog-preflight');
await fs.mkdir(out, { recursive: true });
const write = (name, data) =>
  fs.writeFile(
    path.join(out, name + '.json'),
    JSON.stringify(data, null, 2) + '\n',
  );
const base = JSON.parse(
  await fs.readFile(
    path.join(root, 'backend/docs/catalog-migration/manifest.json'),
    'utf8',
  ),
);
const images = JSON.parse(
  await fs.readFile(
    path.join(root, 'frontend/docs/catalogue-image-manifest.json'),
    'utf8',
  ),
);
const gallery = JSON.parse(
  await fs.readFile(
    path.join(root, 'frontend/docs/product-detail-gallery-sources.json'),
    'utf8',
  ),
);
const classify = (f) =>
  f.field === 'manufacturerSku'
    ? {
        type: 'MISSING_MANUFACTURER_PART_NUMBER',
        severity: 'MEDIUM',
        affects: ['product correctness', 'procurement'],
        decision:
          'Confirm exact boxed/tray manufacturer part number from approved supplier evidence; retain null until confirmed. Not required to invent a browsing SKU.',
      }
    : f.reason.startsWith('NO_LOSSLESS')
      ? {
          type: 'CANONICAL_MEASUREMENT',
          severity: f.field === 'Buttons quantity' ? 'MEDIUM' : 'LOW',
          affects: ['specifications', 'filters'],
          decision:
            f.field === 'Buttons quantity'
              ? 'Retain the full six-programmable-buttons description. Decide whether a separate programmable-button count is appropriate; do not claim total controls=6.'
              : 'Use the exact canonical supplement and retain the original measurement text and source provenance.',
        }
      : {
          type: 'MISSING_FILTER_SOURCE',
          severity: 'LOW',
          affects: ['filters', 'search completeness'],
          decision:
            f.field === 'polling_rate'
              ? 'Review connection/receiver-dependent multi-valued polling rates; preserve source text and avoid asserting a single maximum or inventing SKU options.'
              : f.field === 'panel'
                ? 'Obtain explicit panel-technology evidence. HD type/resolution is not panel technology.'
                : f.field === 'radiator_size'
                  ? 'Confirm marketed radiator class from an explicit specification. Physical radiator length is not the marketed 240/360 class.'
                  : f.field === 'connectivity' &&
                      base.records.find((r) => r.sourceKey === f.product).source
                        .product.category === 'accessories'
                    ? 'Choose not-applicable or confirm actual accessory interface; do not label passive products wired/wireless by assumption.'
                    : 'Confirm this optional facet with exact-model structured evidence, or explicitly mark not applicable. Keep missing values omitted until reviewed.',
        };
const originalFindings = base.exceptions.map((f, i) => {
  const resolution = m.resolutions.find(
    (r) =>
      canonical([r.product, r.field, r.reason]) ===
      canonical([f.product, f.field, f.reason]),
  );
  return {
    id: `7A-${String(i + 1).padStart(3, '0')}`,
    ...f,
    productName: base.records.find((r) => r.sourceKey === f.product).source
      .product.name,
    ...classify(f),
    status: resolution ? 'RESOLVED_OBJECTIVE_MAPPING' : 'PENDING_ADMIN_REVIEW',
    ...(resolution ? { resolution: resolution.resolution } : {}),
    originalPreserved: true,
    pricingChanged: false,
    commercialRightsGranted: false,
  };
});
assert.equal(originalFindings.length, 130);
assert.equal(m.resolutions.length, 58);
assert.equal(m.exceptions.length, 72);
for (const r of m.records) {
  const old = base.records.find((x) => x.sourceKey === r.sourceKey);
  assert.equal(canonical(r.source), canonical(old.source));
  assert.equal(r.sourceHash, old.sourceHash);
}
await write('manifest', m);
await write('source-review', {
  baselineCommit: '96915e1',
  baselineChecksum: base.checksum,
  reviewedChecksum: m.checksum,
  summary: {
    total: 130,
    resolved: 58,
    pending: 72,
    resolvedUnitConversions: 43,
    resolvedExistingCachedFields: 15,
    pendingBySeverity: { LOW: 64, MEDIUM: 8, HIGH: 0 },
  },
  findings: originalFindings,
  remaining: originalFindings.filter(
    (x) => x.status === 'PENDING_ADMIN_REVIEW',
  ),
  additionalFindings: [
    {
      type: 'GALLERY_SOURCE_URL_LINEAGE',
      severity: 'MEDIUM',
      count: m.mediaProvenanceCorrections.length,
      status: 'RESOLVED',
      records: m.mediaProvenanceCorrections,
    },
  ],
  otherDomains: {
    pricing:
      'No source-review finding changes prices. Existing PKR amounts remain unapproved dated retailer references; fresh launch verification remains necessary.',
    seo: 'Canonical URLs preserved; production noindex policy, legacy filter URL translation and breadcrumb wording require explicit rollout review.',
    publication:
      'Optional missing facets and null manufacturer numbers may remain absent in truthful REFERENCE browsing. Unapproved media and production configuration are launch blockers.',
  },
  productionAccess: false,
});
const media = [];
for (const r of m.records)
  for (const ref of r.media) {
    const primary = images.find(
        (i) => i.id === r.sourceKey && i.path === ref.src,
      ),
      extra = gallery.find(
        (i) => i.productId === r.sourceKey && i.src === ref.src,
      ),
      evidence = extra ?? primary;
    const entry = {
      product: r.sourceKey,
      path: ref.src,
      purpose: ref.purpose,
      order: ref.order,
      sourceUrl: ref.sourceUrl,
      evidenceFile: extra
        ? 'frontend/docs/product-detail-gallery-sources.json'
        : 'frontend/docs/catalogue-image-manifest.json',
      license: evidence?.license ?? null,
      licenseUrl: evidence?.licenseUrl ?? null,
      author: evidence?.author ?? null,
      modifications: evidence?.modifications ?? null,
      developmentOnly: ref.developmentOnly === true,
      commercialApproval: 'BLOCKED_PENDING_SCOPED_RIGHTS_REVIEW',
      licenseEvidence: evidence?.license?.startsWith('CC BY')
        ? 'DOCUMENTED_CC_LICENSE_NOT_ADMIN_APPROVED'
        : 'DEVELOPMENT_ONLY_OR_UNCERTAIN_COMMERCIAL_PERMISSION',
      attributionPresent: !!(evidence?.author && evidence?.licenseUrl),
      publicUse: false,
    };
    try {
      const file = await fs.readFile(
          path.join(root, 'frontend/public', ref.src),
        ),
        hash = digest(file),
        image = sharp(file, { limitInputPixels: 32000000, failOn: 'warning' }),
        meta = await image.metadata();
      await image.stats();
      const webp = await sharp(file)
        .rotate()
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 82, effort: 3 })
        .toBuffer();
      Object.assign(entry, {
        accessible: true,
        decodable: true,
        format: meta.format,
        width: meta.width,
        height: meta.height,
        bytes: file.length,
        sha256: hash,
        baselineHashMatches: hash === ref.sha256,
        documentedHashMatches: evidence?.sha256
          ? evidence.sha256 === hash
          : null,
        documentedDimensionsMatch:
          evidence?.width === meta.width && evidence?.height === meta.height,
        webp640Bytes: webp.length,
        altTextPresent: !!ref.alt,
      });
    } catch {
      Object.assign(entry, {
        accessible: false,
        decodable: false,
        error:
          'Local read/image validation failed; private diagnostics omitted',
      });
    }
    media.push(entry);
  }
const totals = {
  references: media.length,
  uniqueContentHashes: new Set(media.map((r) => r.sha256)).size,
  gallery: media.filter((r) => r.purpose === 'GALLERY').length,
  posters: 0,
  accessible: media.filter((r) => r.accessible).length,
  valid: media.filter((r) => r.decodable).length,
  broken: media.filter((r) => !r.decodable).length,
  developmentOnly: media.filter((r) => r.developmentOnly).length,
  commerciallyApproved: 0,
  blocked: media.length,
  documentedCcCandidates: media.filter(
    (r) => r.licenseEvidence === 'DOCUMENTED_CC_LICENSE_NOT_ADMIN_APPROVED',
  ).length,
  originalBytes: media.reduce((n, r) => n + (r.bytes ?? 0), 0),
  webp640Bytes: media.reduce((n, r) => n + (r.webp640Bytes ?? 0), 0),
};
await write('media-audit', {
  summary: totals,
  records: media,
  provenanceCorrections: m.mediaProvenanceCorrections,
  deliveryDecision:
    'No paid provider demonstrated necessary for 95 existing fixed images. After scoped rights approval, a reviewed immutable hash-addressed static derivative bundle on existing Vercel hosting can cover initial read-only media. A future STATIC_BUNDLE adapter/allowlist is required; current M5 public delivery supports development storage only. Dynamic uploads need separately designed durable storage. Nothing activated.',
  existingPublicFiles:
    'Legacy public copies remain unchanged and can still be requested directly. Dynamic API rights gates do not revoke those paths; launch must audit/remove/replace blocked copies.',
  optimization:
    '640px WebP measurements generated in memory only; no assets or providers written/activated',
  rights:
    'Local documentation is evidence for review, not verification of current license eligibility or permission. No rights automatically approved.',
  productionAccess: false,
});
assert.equal(totals.references, 95);
assert.equal(totals.valid, 95);
assert.ok(
  media.every(
    (r) => r.baselineHashMatches && r.documentedHashMatches !== false,
  ),
);
console.log(
  JSON.stringify({
    sourceFindings: { resolved: 58, pending: 72 },
    gallerySourceCorrections: m.mediaProvenanceCorrections.length,
    media: totals,
    manifest: m.checksum,
  }),
);
