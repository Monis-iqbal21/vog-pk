# Milestone 7C — catalog and media compliance

Status: **NO-GO for production**. This milestone is local only on
`feature/commerce-catalog-migration`, based on `f40b0e9`. No production queries,
migrations, cloud resources, provider activation, restart, push or merge occurred.

## Catalog decisions

The original 130 findings remain traceable: 58 were resolved in 7B. All remaining
72 have now been classified; no additional facts were invented or silently approved.
There are **0 BLOCKING data findings, 10 REQUIRES ADMIN REVIEW and 62 NON-BLOCKING
optional unknowns**. This does not remove media or operational rollout blockers.
The ten decisions concern seven manufacturer part numbers, two compound polling
rates and one compound button description. Keep original descriptions and nullable
values until exact supplier/manufacturer evidence supports a new revision.

[Per-product decisions and original evidence](../backend/docs/catalog-compliance/source-review.json)
identify every affected product and recommended action. Optional gaps do not imply
invented specifications, variants, stock or commercial offers. The reviewed 7B
manifest and all original source evidence are unchanged.

## Media decisions

All **95 references decode and match their previously audited local files**;
0 are broken. All 95 are gallery references, 0 are promotional posters. All remain
development-only and blocked from dynamic public delivery. Commercially approved:
**0**; documented CC candidates: **7**; other uncertain commercial permissions:
**88**; verified manufacturer-authorized or VOGPK-owned photographs: **0**.
The code-authored generic VOGPK graphic is separate from those 95 photographs.

[Individual media evidence](../backend/docs/catalog-compliance/media-review.json)
records source, digest, dimensions, accessibility, purpose, license and conditions.
Each of the seven Commons file pages was reviewed individually. Five carry
CC BY 4.0; two carry CC BY-SA 4.0. Attribution, source/license links, alteration
notices and, for adapted BY-SA material, applicable share-alike obligations need
an explicit administrator acceptance and presentation plan. These licenses do not
prove all other rights or exact variant suitability. Evidence is a candidate for
approval, not an automatic grant. See the linked file pages in the report and the
[BY 4.0 deed](https://creativecommons.org/licenses/by/4.0/) and
[BY-SA 4.0 deed](https://creativecommons.org/licenses/by-sa/4.0/).

### Administrator procedure

1. Select the correct tenant and asset in Media. Inspect its purpose, fingerprint,
   original source metadata and listing impact. Only stores the reviewer can view
   are included. Lists show at most 100 recent decisions/listing revisions.
2. In isolated development, `MEDIA_REFERENCE_PREVIEW=1` permits an authenticated,
   digest-checked local preview of imported photographs. It never enables remote
   fetches or public URLs. Production rejects these previews even with that flag.
3. Record evidence URL, license, attribution, conditions and reviewer notes. PUBLIC
   approval requires meaningful evidence, not just a working URL. Approval/rejection
   requires `media.approve`; view/upload permissions alone cannot grant rights.
4. Approve development use, approve public use, or reject. The backend records the
   actor, timestamp, exact asset revision/source and append-only review evidence.
   Rejection remains private; later evidence can support another recorded decision.
5. Replace approved/frozen assets through a new upload and draft product/SKU revision,
   then normal review/publication. Never mutate approved relationships in place.
   Gallery and DETAIL_POSTER assignments stay distinct, including SKU-specific media.

The additive ninth migration, `202611020008_media_review`, retains existing
MediaApproval history and adds immutable MediaReview records. Earlier migrations
are unchanged. There is no fabricated backfill of reviewer decisions.

## Fallback and storage

The dynamic product card uses an authored SVG VOGPK “Image unavailable” graphic
when no eligible photo exists. Product identity, URL, default SKU, specifications
and reference price survive. Product detail pages continue without posters.
Unapproved REFERENCE photos are excluded by the existing public projection.
An approval alone does not turn a REFERENCE asset into a managed public asset.

Existing legacy static files are still independently reachable. This change does
not revoke those files or replace live imagery. Before cutover, the business must
approve either exact permitted photographs or clearly identified missing-image
fallbacks, and separately approve removal/replacement of blocked static files and
cache handling. Do not claim that dynamic exclusion removes old direct URLs.

Initial delivery need not require Cloudinary. A reviewed immutable static bundle
of approved derivatives could use existing frontend hosting, with asset hashes,
credits, responsive sizes and a provider adapter that accepts only exact approved
paths. That adapter is **not implemented/activated**. Current LOCAL_DEVELOPMENT
storage is intentionally unavailable in production. Static source volume is about
45 MB; the prior 640px derivative estimate is about 2.4 MB for the catalog, not a
hosting quota or cost guarantee. Recheck actual limits before rollout.

New uploads need durable private object storage, separately from static delivery.
Evaluate a separate OCI media bucket in existing infrastructure only after current
quota, eligibility, IAM and cost review. Do not reuse the encrypted database backup
bucket or its restrictive identity. Design versioning, approved-derivative delivery,
upload limits, recovery tests and retention before enabling an adapter. Oracle disk
alone and Vercel ephemeral filesystems are not a durable upload/recovery strategy.
No paid service, bucket, IAM change or upload provider is authorized here.

## Deployment controls and exact future order

The [existing rollout plan](CATALOG_ROLLOUT_PLAN.md) still applies, with **nine**
migrations and the additional production write gate below. Its original 7B evidence
remains historical. Current dry-run proves the following against a disposable DB:

- `NODE_ENV=production` with `CATALOG_ADMIN_WRITES_ENABLED` absent rejects catalog
  mutations with 503, after normal permission checks. Even Owner cannot accidentally
  write. Authentication, health, scoped reads and role administration are separate.
- Public dynamic catalog reads remain unavailable by their existing production gate;
  the storefront remains static by default. No flag has been enabled anywhere.
- Imported reference previews fail closed. Type/media write attempts leave record
  counts unchanged. This is a local production-mode rehearsal, not a hosted deploy.

Future sequence, each step separately approved where it touches production:

1. Recheck production drift, exact release, commercial hosting suitability, quota,
   ownership context and existing Owner access. Agree edit freeze and media decision.
2. Create a fresh encrypted off-server consistent PostgreSQL backup; verify key
   retention outside Oracle, download integrity and an isolated complete restore.
3. Rehearse all nine additive migrations and idempotent scoped RBAC bridge against
   an isolated restored copy, preserving existing Owner hashes, sessions and grants.
   Implement/review production-safe importer and fixed-store read controls first.
4. Extend/review migration-aware Oracle ARM64 preparation. Current deployment prepare
   correctly rejects schema deltas; never bypass that guard. Stage and test exact code
   without running it, preserve previous artifacts and exact systemd rollback state.
5. Approve additive DDL, verify constraints and migration history. No reset/down
   migration/seed. Apply the reviewed scope bridge without replacing Owner or grants.
6. Approve backend activation with localhost binding and readiness/auth fallback.
   Keep catalog writes and dynamic reads off. Deploy compatible admin/storefront
   only after backend/schema compatibility; account for automatic Vercel Git builds.
7. Approve a narrowly controlled import window and production importer. Enabling
   `CATALOG_ADMIN_WRITES_ENABLED=1` is a broad catalog-write unlock, not an import-only
   permission: keep staff edit freeze, audit it, and close it after verification.
   Verify 84/12/84 identities, 95 private refs, source hashes and zero-write rerun.
8. Approve rights/delivery or placeholder policy, static-file handling, fixed-store
   public API exposure and shadow checks. Keep storefront static until parity passes.
9. Separately approve read cutover, SEO policy and subsequent write handoff. Observe
   health, auth, scope isolation, canonical URLs, reference prices and unknown stock.

Stop for drift, source loss, unauthorized media, Owner lockout, cross-scope exposure,
failed readiness/binding or incompatible deployment. Before accepted database edits,
an approved read-gate reversal to unchanged static code is possible. After accepted
edits, freeze writes and preserve revision/audit deltas; do not hide edits with a
static rollback. Prefer a forward fix or compatible previous application. Never
rewind production Neon or remove additive schema as an application rollback.

## Readiness checklist

| Item | Result |
| --- | --- |
| 72 source findings classified with original values | PASS; 10 admin decisions remain |
| 95 files readable/decodable; no automatic public grants | PASS |
| Scoped review/rejection, history, listing impact and fallback | PASS in isolation |
| 84 products/12 categories/84 default SKUs, routes and parity | PASS in isolated rehearsal |
| Production defaults keep reads and catalog mutations disabled | PASS in local production-mode dry-run |
| Commercial rights or explicit placeholder business acceptance | PENDING APPROVAL |
| Durable production upload/static delivery adapters | BLOCKED: not implemented |
| Production read mode/importer/scoped RBAC backfill tooling | BLOCKED: not implemented |
| Migration-aware ARM64 staging and current backup/restore | PENDING separate preparation/approval |
| Commercial hosting plan/quota, SEO/filter compatibility decisions | PENDING review |
| Production migration/deployment/read cutover | NOT APPROVED; NO-GO |

Machine-readable rehearsal, browser parity, source/media and workflow evidence is
in `backend/docs/catalog-compliance/`. Final validation and staged-tree secret-scan
results are recorded there separately. Historical ignored test directories and
unrelated assets are preserved. No production readiness is inferred from local tests.
