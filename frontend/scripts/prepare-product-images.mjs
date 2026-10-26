import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { productImages } from '../src/data/product-images.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/images/products');
const records = {};
const cacheFlag = process.argv.indexOf('--source-dir');
const sourceDirectory = cacheFlag === -1 ? null : process.argv[cacheFlag + 1];
if (cacheFlag !== -1 && !sourceDirectory) throw new Error('--source-dir requires a directory containing previously downloaded <id>.source files');
await fs.mkdir(output, { recursive: true });

// Deliberately limited to the individually reviewed, licensed allowlist.
// Sequential requests respect the source host; no crawling, retries or access bypasses.
for (const [id, asset] of Object.entries(productImages)) {
  const hash = crypto.createHash('md5').update(asset.sourceFile).digest('hex');
  const downloadUrl = `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(asset.sourceFile)}`;
  let original;
  if (sourceDirectory) {
    original = await fs.readFile(path.join(sourceDirectory, `${id}.source`));
  } else {
    const response = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'VOGPK-ProductAssets/1.0 (licensed catalogue image preparation)' },
    });
    if (!response.ok) throw new Error(`${id}: download returned ${response.status}; stop and respect the host's rate limit`);
    original = Buffer.from(await response.arrayBuffer());
  }
  const metadata = await sharp(original).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${id}: invalid image`);
  // Preserve the complete frame and its aspect ratio; never upscale or crop hardware.
  const size = Math.min(1000, Math.max(metadata.width, metadata.height));
  const target = path.join(output, `${id}.webp`);
  await sharp(original).rotate().resize(size, size, {
    fit: 'contain', withoutEnlargement: true, background: { r: 248, g: 249, b: 251, alpha: 0 },
  }).webp({ quality: 88, effort: 6 }).toFile(target);
  const encoded = await fs.readFile(target);
  const verified = await sharp(encoded).metadata();
  if (verified.format !== 'webp') throw new Error(`${id}: invalid output encoding`);
  records[id] = {
    downloadUrl, sourceWidth: metadata.width, sourceHeight: metadata.height,
    width: verified.width, height: verified.height, format: verified.format, bytes: encoded.length,
    sourceSha256: crypto.createHash('sha256').update(original).digest('hex'),
    sha256: crypto.createHash('sha256').update(encoded).digest('hex'),
    changes: 'Resized without upscaling; full-frame contain composition on transparent square; encoded as WebP. No product cropping or generative editing.',
  };
  console.log(`${id}: ${verified.width}x${verified.height}, ${encoded.length} bytes`);
  await fs.writeFile(path.join(root, 'docs/product-image-files.json'), `${JSON.stringify(records, null, 2)}\n`);
  if (!sourceDirectory) await new Promise((resolve) => setTimeout(resolve, 2000));
}
