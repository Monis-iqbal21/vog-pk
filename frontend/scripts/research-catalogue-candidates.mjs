import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = JSON.parse(await fs.readFile(path.join(root, 'docs/catalogue-replacement-candidates.json'), 'utf8'));
const outputPath = path.join(root, 'docs/catalogue-candidate-research.json');
const previous = process.argv.includes('--refresh-changed') ? JSON.parse(await fs.readFile(outputPath, 'utf8')).candidates : [];
const records = [];
for (const candidate of input.candidates) {
  const prior = previous.find((item) => item.oldId === candidate.oldId);
  if (prior && prior.productCode === candidate.productCode && prior.brand === candidate.brand) {
    records.push(prior);
    continue;
  }
  const api = new URL('https://live.icecat.biz/api');
  api.search = new URLSearchParams({ lang: 'EN', shopname: 'openicecat-live', Brand: candidate.brand, ProductCode: candidate.productCode });
  try {
    const response = await fetch(api, { signal: AbortSignal.timeout(15000) });
    const json = await response.json();
    const data = json.data;
    const info = data?.GeneralInfo;
    const specs = Object.fromEntries((data?.FeaturesGroups ?? []).flatMap((group) => group.Features ?? []).map((feature) => [feature.Feature?.Name?.Value, feature.PresentationValue ?? feature.Value]).filter(([name, value]) => name && value != null));
    records.push({ ...candidate, apiUrl: api.href, status: response.status, message: json.Message ?? json.msg,
      title: info?.Title, returnedCode: info?.BrandPartCode, icecatId: info?.IcecatId,
      manufacturerUrl: info?.Description?.URL, specs,
      gallery: (data?.Gallery ?? []).filter((image) => image.IsPrivate === '0' && image.Type === 'ProductImage').map((image) => ({ url: image.Pic, preview: image.Pic500x500, width: Number(image.PicWidth), height: Number(image.PicHeight), main: image.IsMain === 'Y', number: image.No })),
    });
    console.log(`${candidate.id}: ${response.status} ${info?.Title ?? json.Message ?? ''}`);
    if (response.status === 429) break;
  } catch (error) { records.push({ ...candidate, status: 'failed', message: error.message }); console.log(`${candidate.id}: ${error.message}`); }
  await fs.writeFile(outputPath, `${JSON.stringify({ checkedAt: input.checkedAt, access: 'Documented public Open Icecat demo requests; restricted responses are skipped, not bypassed. Product facts and image candidates require manual comparison.', candidates: records }, null, 2)}\n`);
  await new Promise((resolve) => setTimeout(resolve, 650));
}
await fs.writeFile(outputPath, `${JSON.stringify({ checkedAt: input.checkedAt, access: 'Documented public demo account. No restricted content access attempted.', candidates: records }, null, 2)}\n`);
