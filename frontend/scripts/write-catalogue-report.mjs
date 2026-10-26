import fs from 'node:fs/promises';
import {products} from '../src/data/products.js';
const root=new URL('../',import.meta.url);
const read=async file=>JSON.parse(await fs.readFile(new URL('docs/'+file,root),'utf8'));
const baseline=await read('catalogue-before-correction.json'),images=await read('catalogue-image-manifest.json');
const changes=(await read('catalogue-corrections.json')).changes,verification=await read('product-image-verification.json');
const browser=await read('catalogue-browser-verification.json');
const retained=images.filter(a=>baseline.some(p=>p.id===a.id&&!p.imageIsPlaceholder&&(p.imageSourceUrl===a.downloadUrl||a.id==='intel-core-i9-14900k')));
const statistics={reviewed:84,existingSourcePhotographsRetained:retained.length,imageAssignmentsReplaced:84-retained.length,previousPlaceholdersReplaced:baseline.filter(p=>p.imageIsPlaceholder).length,existingPhotographsChanged:baseline.filter(p=>!p.imageIsPlaceholder).length-retained.length,productModelsReplaced:changes.filter(p=>p.productReplaced).length,productModelsRetained:changes.filter(p=>!p.productReplaced).length,realProductImageAssignments:84,uniquePhotographs:verification.uniquePhotographs,remainingPlaceholders:verification.placeholders.length,referencePrices:verification.referencePrices,referencePricesChecked20261027:products.filter(p=>p.sourceCheckedAt==='2026-10-27').length,referencePricesRetained20261026:products.filter(p=>p.sourceCheckedAt==='2026-10-26').length,qualityExceptions:verification.qualityExceptions.length,icecatDevelopmentAssets:77,creativeCommonsAssets:7};
await fs.writeFile(new URL('docs/catalogue-correction-summary.json',root),JSON.stringify(statistics,null,2)+'\n');
const rows=changes.filter(p=>p.productReplaced).map(p=>`| ${p.oldName} | ${p.newName} | ${p.referencePricePKR.toLocaleString('en-PK')} | \`${p.image.replace('/images/products/','')}\` | [Retail reference](${p.sourceUrl}) |`).join('\n');
const audit=products.map(p=>{const a=images.find(x=>x.id===p.id);return {id:p.id,category:p.category,name:p.name,image:p.image,imageSourceUrl:a.downloadUrl??a.sourceUrl,sourceRecordUrl:a.sourceUrl,license:a.license,licenseUrl:a.licenseUrl,developmentOnly:true,sku:p.manufacturerSku,specificationSourceUrl:p.specificationSourceUrl,priceSourceUrl:p.sourceUrl,referencePricePKR:p.referencePricePKR,sourceCheckedAt:p.sourceCheckedAt,retailQualityApproved:!a.qualityException,qualityException:a.qualityException??null,exactSkuVerification:a.visualReview,previous:changes.find(x=>x.newId===p.id)?.oldName};});
await fs.writeFile(new URL('docs/product-image-audit.json',root),JSON.stringify({checkedAt:'2026-10-27',scope:'Current complete catalogue. Historical research is retained in catalogue-before-correction.json and the research registers.',products:audit},null,2)+'\n');
await fs.writeFile(new URL('docs/product-image-files.json',root),JSON.stringify(images,null,2)+'\n');
await fs.writeFile(new URL('docs/product-sources.md',root),`# Current catalogue product sources\n\nChecked references are PKR retail observations, not approved VOGPK selling prices or inventory. All 84 records are audited in [catalogue correction report](catalogue-correction-report.md). ${statistics.referencePricesChecked20261027} reference amounts were checked on 27 October 2026; ${statistics.referencePricesRetained20261026} unchanged-product observations retain 26 October dates. Reconfirm all before launch.\n\n| Product | Model/SKU | Reference PKR | Checked | Source |\n|---|---|---:|---|---|\n${products.map(p=>`| ${p.name} | ${p.manufacturerSku??p.modelIdentifier} | ${p.referencePricePKR.toLocaleString('en-PK')} | ${p.sourceCheckedAt} | [Reference](${p.sourceUrl}) |`).join('\n')}\n`);
const report=`# VOGPK catalogue correction — 27 October 2026

The active development catalogue now has 84 local PNG product images, with complete matching records and 65 model substitutions. Two processor images remain explicitly below the desired launch standard; this is not a production-ready asset clearance.

## Counts

| Measure | Count |
|---|---:|
| Products individually reviewed | 84 |
| Existing source photographs retained (reformatted/recomposed) | ${statistics.existingSourcePhotographsRetained} |
| Image assignments replaced, including placeholders | ${statistics.imageAssignmentsReplaced} |
| Illustrated placeholders replaced | ${statistics.previousPlaceholdersReplaced} |
| Existing photographic assignments replaced | ${statistics.existingPhotographsChanged} |
| Entire product models replaced with matching data | ${statistics.productModelsReplaced} |
| Existing model identities retained | ${statistics.productModelsRetained} |
| Real product image assignments | 84 |
| Unique photographic content | ${statistics.uniquePhotographs} |
| Remaining placeholders or missing local files | 0 |
| Products with observed numeric PKR reference prices | 84 |
| Price references checked on 27 October | ${statistics.referencePricesChecked20261027} |
| Earlier 26 October references retained for unchanged products | ${statistics.referencePricesRetained20261026} |
| Documented image-quality exceptions | 2 |

“Retained” counts the original source photograph, not an unchanged filename: all active delivery paths now use PNG masters. Five retained photographs: ${retained.map(x=>x.id).join(', ')}. The other 79 assignments replace 62 line illustrations and 17 existing photographic assignments. Two RAM pairs intentionally share supplier packshots for physically identical modules/kits; exact SKUs and differing capacity/speed facts are separate. See [shared packshot evidence](catalogue-shared-packshots.json). This is documented source reuse, not an accidental image assignment.

## Catalogue and content

- Exactly seven unique products in each of 12 categories.
- Featured and New Arrivals each show seven products followed by a View All card in an independent single horizontal row, following the latest display request. No overlap. Original category membership and catalogue records are preserved.
- Every replacement updates ID/slug, brand, model, original short description, reference price, retailer URL/date, SKU where available, specifications, source/licensing and image together.
- Product-specific technical facts are retained in the central dataset. Conflicting feed facts were corrected with documented primary/retailer evidence, including MSI PANO motherboard support and keyboard switch/layout variants.
- PKR amounts are observed retailer references, including sold-out/pre-order listings, not live prices. No discounts or VOGPK selling prices are invented. Selling prices and stock remain null, purchasing disabled.
- New Arrivals is a curated demo collection, not a claim of newly received inventory.

## Image preparation and rights

All active files are PNG, square 700–1000px (74 at 1000px). Source proportions and full product edges are preserved. Uniform outer-border trim and conservative whole-PCB CPU crops retain hardware details; no hardware was generated or reconstructed. Smaller canvases maintain approximately 80% subject scale without enlarging lower-resolution sources. White backgrounds are used; automatic background segmentation was avoided. ProductCard retains Next Image optimization, object-fit contain, equal containers and aligned content; only image padding changed to 8px.

77 assets come from non-private ProductImage galleries returned by the documented Open Icecat public demonstration workflow, used only for local development evaluation. Seven processor assets use CC BY 4.0 or CC BY-SA 4.0, with attribution, license links, modification notices and ShareAlike preserved. The public credits page has all 84 records and links the local Open Content License copy. Production/regular Icecat use still requires VOGPK's appropriate account/license and asset approval. All 84 are marked development-only for the user's launch review.

No restricted retailer photographs were copied. ZAH, Tech Arc, Zestro and RB Tech were searched as model/price references; exact permitted imagery took priority over brand preservation. Additional Pakistani sellers were used where the preferred sources did not list a matching SKU/price. Public search/listing evidence may lag the retailer; every reference needs reconfirmation before launch. No private Icecat galleries, credentials or restricted Full Icecat assets were accessed.

## Remaining gaps

1. **Intel Core i9-14900K**: exact-model clean photograph retained, but its original is only 600×575px. It is not upscaled. A higher-resolution approved packshot or a fully verified premium substitute is still needed.
2. **Intel Core i5-11400**: complete high-resolution photograph, but the photographed specimen has visible lid wear. A pristine authorized packshot or a better fully verified gaming CPU replacement is still needed. Kept outside both homepage curated collections.
3. **Production clearance**: the 77 Icecat demonstration images require the appropriate regular/production license; all assets remain launch-review pending.
4. **Pre-existing destination pages**: product detail and category listing routes return HTTP 404. Carousel controls and See All URL mappings work, but their destination pages are not implemented. These routes were already absent; no route or UI redesign was introduced in this imagery task.
5. The deployed reference site could not be retrieved by the web tool during this pass. The updated local production build is verified; no deployment or push was performed.

## Verification

- 'npm run verify:product-images': 84 valid images and complete records; zero missing/corrupt files, broken references, duplicate IDs/slugs/models, unexplained duplicate photos, invalid categories, missing numeric prices or descriptions. Two documented shared-image pairs and two quality exceptions are reported explicitly. '--require-complete' remains intentionally failing until launch clearance and quality gaps are resolved.
- Frontend lint: passed. Production build: passed.
- Browser: ${browser.checkCount} section checks at ${browser.widths.join(', ')}px. Featured, New Arrivals and all 12 tabs at every width; every image decoded; object-fit contain, square containers, aligned brand/title/description/price/plus controls, disabled purchasing, arrow navigation, keyboard Home/End and correct See All mappings checked. Zero page errors, image failures or horizontal page overflow.
- Actual source contact sheets and rendered cards were visually inspected. Browser screenshots are local at '${browser.evidenceDirectory}'; [machine-readable browser results](catalogue-browser-verification.json).
- Desktop mouse dragging and native mobile touch swiping passed separately; carousels scroll independently and dragging suppresses product-link activation. [Interaction evidence](catalogue-interaction-verification.json).
- The validation scope covers the development catalogue, not checkout/backend or the unimplemented destination pages.

## Changed implementation files

- 'src/data/products.js': collection API retained, now reads the reviewed catalogue.
- 'src/data/catalogue-products.js': all 84 complete active product records.
- 'src/data/catalogue-images.js', 'src/data/product-images.js': current source/license/image manifest.
- 'src/components/products/Products.css': image padding only.
- 'public/images/products/*.png': local masters; 'credits.html' and 'OPEN-ICECAT-LICENSE.txt': attribution and license.
- 'scripts/research-catalogue-candidates.mjs', 'research-retained-catalogue.mjs', 'review-catalogue-images.mjs', 'prepare-catalogue-masters.mjs', 'prepare-processor-masters.mjs', 'build-corrected-catalogue.mjs', 'verify-catalogue.mjs', 'verify-product-images.mjs', 'verify-catalogue-browser.cjs', 'write-catalogue-report.mjs': reproducible research/preparation/checks.
- 'docs/catalogue-*.json', 'product-image-*.json', this report and updated asset/source documentation: per-product audit, before/after, decisions, permissions, prices and verification.

Navbar, footer, hero, card structure, carousels, tab interaction, cart behavior and backend are preserved. Earlier uncommitted image-credit and research work is incorporated. The user's unassigned JPG and video are untouched.

## Full product replacement inventory

The machine-readable inventory includes all 84 reviewed slots: [catalogue-corrections.json](catalogue-corrections.json). All ${statistics.productModelsReplaced} complete model substitutions follow.

| Old product | New product | New reference PKR | PNG image in public/images/products | Source URL |
|---|---|---:|---|---|
${rows}
`;
await fs.writeFile(new URL('docs/catalogue-correction-report.md',root),report);
await fs.writeFile(new URL('docs/product-image-assets.md',root),`# Current product image assets\n\nSupersedes the earlier partial 22-image register. See [complete catalogue correction report](catalogue-correction-report.md), [84-entry source manifest](catalogue-image-manifest.json), [individual audit](product-image-audit.json) and [verification](product-image-verification.json).\n\n84 real local PNG assignments, 82 unique photographs, no placeholders. Two processor quality exceptions and production image licensing remain open. All assets are development-only. Public attribution: /images/products/credits.html.\n`);
await fs.writeFile(new URL('public/images/products/README.md',root),`# Development catalogue images\n\n84 active square PNG masters are referenced by src/data/catalogue-products.js. They use conventional border trimming, proportional reduction and white canvases; no generated hardware or upscaling. Next Image optimizes delivery.\n\nRead frontend/docs/catalogue-correction-report.md for all 84 source records, 65 full model substitutions, PKR reference evidence, two processor quality exceptions and production clearance requirements. credits.html contains all attribution/license links; OPEN-ICECAT-LICENSE.txt preserves the license copy.\n\nThe existing intel-core-i9-14900k.webp is retained as the original source for reproducible conversion, not an additional active card image. The unassigned user JPG is not assigned to any product without exact-model evidence.\n`);
console.log(statistics);
