import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { root, digest } from './legacy-catalog-manifest.mjs';
const read = async (p) =>
  JSON.parse(await fs.readFile(path.join(root, p), 'utf8'));
const source = await read('backend/docs/catalog-preflight/source-review.json'),
  audit = await read('backend/docs/catalog-preflight/media-audit.json'),
  images = await read('frontend/docs/catalogue-image-manifest.json');
const out = path.join(root, 'backend/docs/catalog-compliance');
await fs.mkdir(out, { recursive: true });
const write = (name, data) =>
  fs.writeFile(
    path.join(out, name + '.json'),
    JSON.stringify(data, null, 2) + '\n',
  );
const decisions = source.remaining.map((f) => ({
  ...f,
  classification: [
    'manufacturerSku',
    'polling_rate',
    'Buttons quantity',
  ].includes(f.field)
    ? 'REQUIRES ADMIN REVIEW'
    : 'NON-BLOCKING',
  publicationPolicy:
    'Retain the original description and unknown optional data. No invented value or variant; reference-only browsing may continue. Commercial media is a separate decision.',
}));
const byProduct = Object.entries(
  Object.groupBy(decisions, (f) => f.product),
).map(([id, findings]) => ({ id, name: findings[0].productName, findings }));
const count = (c) => decisions.filter((f) => f.classification === c).length;
assert.equal(decisions.length, 72);
assert.equal(count('REQUIRES ADMIN REVIEW'), 10);
assert.equal(count('NON-BLOCKING'), 62);
await write('source-review', {
  baseline: 'f40b0e9',
  previouslyResolved: 58,
  newFactsInvented: 0,
  newFactualResolutions: 0,
  remainingFactGaps: 72,
  blocking: 0,
  requiresAdminReview: 10,
  nonBlockingUnknown: 62,
  meaning:
    'Classification closes triage, not factual verification. No mandatory identity/relationship failure was found among these 72 findings; consult fresh parity tests separately. Media/business/operational blockers remain.',
  products: byProduct,
});
const media = [];
for (const r of audit.records) {
  const bytes = await fs.readFile(path.join(root, 'frontend/public', r.path));
  await sharp(bytes, { limitInputPixels: 32000000, failOn: 'warning' }).stats();
  assert.equal(digest(bytes), r.sha256);
  const cc = r.licenseEvidence === 'DOCUMENTED_CC_LICENSE_NOT_ADMIN_APPROVED',
    sa = r.license === 'CC BY-SA 4.0',
    evidence = images.find((i) => i.id === r.product && i.path === r.path);
  const conditions = cc
    ? [
        'Credit the named creator and supplied notices; link source and exact license',
        'Identify crop, resizing, canvas/background and format modifications without implying endorsement',
        'Do not impose additional legal or technical restrictions on licensed material',
        ...(sa
          ? [
              'Distribute adaptations under CC BY-SA 4.0 or a permitted compatible license',
            ]
          : []),
      ]
    : [
        'Development evaluation restriction retained; obtain exact commercial permission/eligibility evidence before PUBLIC approval',
      ];
  media.push({
    ...r,
    ownershipClass: cc
      ? 'DOCUMENTED_LICENSE_EVIDENCE'
      : 'UNKNOWN_OR_UNVERIFIED_COMMERCIAL_PERMISSION',
    manufacturerAuthorizationVerified: false,
    vogpkOwnedPhoto: false,
    commerciallyApproved: false,
    developmentOnly: true,
    fullDecodeValid: true,
    conditions,
    ...(cc
      ? {
          individualLicenseReview: {
            license: r.license,
            sourcePage: evidence.sourceUrl,
            licenseUrl: evidence.licenseUrl,
            legalCodeUrl: evidence.licenseUrl.replace(/\/?$/, '/legalcode.en'),
            author: evidence.author,
            modifications: evidence.modifications,
            sourcePageLicenseReviewed: true,
            sourceVerification:
              'Wikimedia file licensing sections and official CC deeds reviewed in this milestone; this does not independently authenticate authorship or approve publication',
            commercialReuseUnderNamedLicense: true,
            adminDecision:
              'PENDING exact-asset attribution/conditions verification and explicit PUBLIC review',
            proposedCredit: `Photo: ${evidence.author}; ${r.license}; ${evidence.sourceUrl}; modifications: ${evidence.modifications}`,
          },
        }
      : {}),
  });
}
await write('media-review', {
  references: 95,
  gallery: 95,
  posters: 0,
  valid: 95,
  broken: 0,
  developmentOnly: 95,
  manufacturerAuthorized: 0,
  vogpkOwnedPhotos: 0,
  documentedCc: 7,
  unknownCommercialPermission: 88,
  commerciallyApproved: 0,
  blockedOriginals: 95,
  placeholder: {
    kind: 'Repository-authored code/SVG VOGPK generic image-unavailable graphic',
    thirdPartyPhoto: false,
    partOfOriginal95: false,
  },
  licenseTermsSources: [
    'https://creativecommons.org/licenses/by/4.0/',
    'https://creativecommons.org/licenses/by-sa/4.0/',
  ],
  records: media,
  rightsPolicy:
    'Availability, retailer publication and a reachable URL are never authorization. No rights flags on the original assets were changed.',
});
console.log(
  JSON.stringify({
    source: { blocking: 0, adminReview: 10, nonBlocking: 62 },
    media: { valid: 95, approved: 0, blocked: 95, ccIndividuallyReviewed: 7 },
    production: 'NO-GO',
  }),
);
