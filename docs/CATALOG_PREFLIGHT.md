# Milestone 7B — catalog preflight

Baseline: local `feature/commerce-catalog-migration`, commit `96915e1`.
This milestone uses existing source records and isolated fixtures only. No remote
account, production database, running service, Vercel setting or media provider was
accessed or changed. The 7A manifest and evidence remain historical and unchanged.

## Source review: 58 resolved, 72 pending

Every original finding has a stable review ID, exact product/field, severity,
affected domain, evidence and recommended administrator action in
`backend/docs/catalog-preflight/source-review.json`. Its remaining array is the
complete 72-item administrator queue; no items were removed without a disposition.

| Original category | Total | Resolved | Pending | Disposition |
|---|---:|---:|---:|---|
| Canonical measurements | 44 | 43 | 1 | Exact registered cm→mm and TB→GB conversions; full compound button description retained for review |
| Missing filter source | 79 | 15 | 64 | Seven GPU-vendor fields, five scalar polling rates and three accessory sizes recovered from existing exact-SKU records |
| Manufacturer part number | 7 | 0 | 7 | Retain null; confirm actual boxed/tray part numbers independently |
| Total | 130 | 58 | 72 | No new prices, stock, discounts or variant combinations |

Conversions use the existing shared exact-decimal unit registry and check round-trip
equality. They supplement original raw TEXT values; original source JSON types and
hashes remain unchanged. Filter supplements require matching product ID, successful
cached response, identical source API URL and exact returned manufacturer SKU.
Compound polling rates are not split into invented connection modes or SKU options.
Resolution means a supported mapping was fixed; it is not fresh manufacturer
verification or a commercial publication approval.

The 64 remaining filter gaps concern optional manufacturer/family/color/storage
type/polling/switch/panel/clearance/radiator/accessory fields. For each, an
administrator should confirm exact-model structured evidence or explicitly record
not-applicable. In particular, HD resolution is not panel technology, radiator
physical length is not marketed radiator class, and a passive accessory must not
be assigned wired/wireless by guesswork. The six-programmable-buttons statement
must not become a claim of six total controls. Missing optional facets are low
severity for truthful reference browsing; ambiguous button semantics and missing
manufacturer numbers are medium. None of these findings authorizes an approved
selling price or confirmed stock. Prices remain dated, unapproved retailer references
and need their own launch review.

The reviewed import profile `7B-reviewed-existing-sources` has a separate checksummed
manifest. The importer regenerates and validates that exact profile locally. It
cannot accept an arbitrary edited manifest. The original profile remains supported.
Per-product review resolutions and manifest identity are retained in immutable
destination mapping evidence. Rerunning a 7B manifest against completed 7A evidence
intentionally conflicts; it does not rewrite published revisions. Use a fresh
rehearsal or an explicitly reviewed revision reconciliation procedure.

## Media readiness

All 95 gallery references were read, fully decoded, hashed and checked against
existing asset metadata. All dimensions match, all files exist, and all historical
content hashes agree. There are 93 unique binary images because two documented
packshots are reused. No posters, variant photos or additional graphics are present.

| Media status | Count |
|---|---:|
| Accessible and valid gallery references | 95 |
| Missing/broken | 0 |
| Development-only flags retained | 95 |
| Commercially approved by this milestone | 0 |
| Blocked from new public dynamic delivery | 95 |
| Documented CC-license candidates for administrator review | 7 |
| Open Icecat development/demo references | 88 |

Five primary images record CC BY 4.0 and two record CC BY-SA 4.0, with authors,
license links, modification notes and matching hashes. This is review evidence,
not proof of current eligibility/ownership or an automatic rights grant. The 88
Icecat records retain development-only usage restrictions. A general license text
does not independently prove account eligibility or exact asset reuse permission.

An additional medium-severity provenance issue was found outside the original 130:
all eleven extra gallery views inherited the primary photograph URL in 7A's derived
media metadata. The reviewed profile now uses each view's own documented download
URL and retains its license/modification/source record. Original source snapshots
and photo bytes are unchanged. The report lists all eleven corrections explicitly.

The media audit contains per-file rights/source/credit evidence and decisions.
All imported assets remain UNVERIFIED, publicUse=false, developmentOnly=true and
REFERENCE-provider records. No media approval was performed, no images were
attached to published revisions, and no derivative assets were persisted.

### Initial delivery choice

The originals total 45,090,535 bytes across the 95 references. A sequential in-memory
640px WebP/quality-82 sample totals 2,398,238 bytes, without enlargement or cropping.
These are measured payloads, not a Vercel quota/cost guarantee or a complete responsive
bundle. For a fixed initial catalog, approved hash-addressed derivative files on
the existing storefront hosting are a practical option. No paid third-party image
provider has a demonstrated necessity for this dataset.

That option still requires a reviewed STATIC_BUNDLE delivery adapter and build
allowlist binding asset digest, tenant/store, approved revision, public-use evidence
and responsive metadata. Current M5 delivery supports development storage only;
approving rights alone will not turn REFERENCE records into working public images.
Build only permitted derivatives, deduplicate by digest and preserve aspect ratio,
alt text, captions, credits and no-upscale dimensions. Do not mount the private
upload root or accept arbitrary remote source URLs. A signed-off bundle/allowlist
can then be tested in isolation before any production deployment.

Static URLs cannot promise immediate rights revocation after a browser/CDN has
cached them. Define removal/redeployment/cache-purge handling and acceptable revocation
latency before choosing this adapter. If immediate per-request authorization is
required, use a rights-checked private delivery path instead. Ongoing admin uploads
need separately reviewed durable storage and backup capacity; no provider or paid
resource is assumed here.

Existing `frontend/public/images/products` copies remain directly accessible under
the unchanged static application. The dynamic media API gate does not revoke those
old paths. Public launch must explicitly remove/replace/restrict blocked static
copies as well; this milestone does not modify unrelated assets or claim that old
public files have become private.

### Administrator rights workflow

1. A tenant-scoped media reviewer inspects the exact binary digest, product/model,
   source author, license version/URL, territory/channel restrictions, modifications,
   required attribution and written permission/account eligibility where relevant.
   Record an evidence case ID and durable permission document reference privately.
2. Keep the asset unverified if any condition is uncertain. For the seven documented
   CC candidates, verify attribution/modification/share-alike obligations and exact
   source eligibility before deciding; do not blanket-approve the category or source.
3. Use the existing `media.approve` capability with the current asset revision and
   an explicit DEVELOPMENT or PUBLIC scope. Upload/edit rights alone do not grant
   approval. Require a second reviewer by operating policy where appropriate; the
   application does not currently enforce a separate-person rule.
4. A PUBLIC decision requires explicit license/attribution input and creates an
   immutable MediaApproval plus scoped audit record. DEVELOPMENT approval continues
   to block public storefront delivery. Retain the source/import evidence alongside
   the approval rather than relying solely on free-text license input.
5. Only after delivery readiness, attach ordered gallery/poster references to a
   draft ProductRevision or SKURevision; preview and approve/publish the product
   and store listing through their existing scoped workflows. Keep shared and SKU
   presentation separate. No posters should be created merely to fill an empty section.
6. Published references and rights approvals are immutable. Replacement requires a
   new asset/revision and explicit republishing. Confirm old delivery/cache handling;
   never mutate a published asset's ownership or delete a referenced record.

## Integrated application review

The eight migrations retain their order/checksums; 7B adds no migration. Tenant/store
compound ownership, schema approval, revision pins, SKU identity, scoped offers,
unknown inventory, media rights, public DTOs, same-SKU predicates, BFF/CSRF and
runtime routing retain their existing boundaries. Tests use actual Nest/PostgreSQL
and clean built admin/static/dynamic Next.js applications. Refer to the generated
integration report for the final run results, including incomplete checks if any.

One safe integration correction was necessary: an older listing-edit payload could
omit catalogOrder and reset imported merchandising order to null. The save DTO now
preserves the existing order when omitted, while explicit null still clears it.
The admin form round-trips/edits that field. Real API regression checks cover set,
omitted-save and explicit-clear behavior; approval and revision immutability remain
enforced. This is separate from Featured/New Arrivals ordering.

## Execution and decision

```powershell
npm run catalog:preflight --prefix backend
npm run test:catalog-preflight --prefix backend
npm run test:storefront --prefix backend
npm run test:foundation --prefix backend
```

The audit and revised manifest are under `backend/docs/catalog-preflight`.
The test runner owns fresh random-port databases and apps; existing ignored test
directories and unrelated frontend assets are preserved. No production credentials
are supplied to isolated fixtures or retrieved from cloud accounts. No media
provider, schedule or automation is activated.

**GO for reviewing this local preflight. Production NO-GO.** The remaining catalog
decisions, rights/delivery work, production gates/import/RBAC preparation, current
recovery proof and schema-aware release staging require further review/implementation
and separate operational approvals. See `CATALOG_ROLLOUT_PLAN.md` for the exact order.
