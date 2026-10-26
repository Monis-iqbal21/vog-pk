import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { retailProductImages } from '../src/data/retail-product-images.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const cacheIndex = process.argv.indexOf('--source-dir');
const cache = cacheIndex >= 0 ? process.argv[cacheIndex + 1] : null;
if (cacheIndex >= 0 && !cache) throw new Error('--source-dir requires a path');
const manifestPath = path.join(root, 'docs/product-image-files.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
for (const [id, asset] of Object.entries(retailProductImages)) {
  let bytes;
  if (cache) bytes = await fs.readFile(path.join(cache, `${id}.source`));
  else {
    const response = await fetch(asset.downloadUrl, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}; stop rather than bypass source restrictions`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const source = await sharp(bytes).metadata();
  await sharp(bytes).raw().toBuffer();
  const size = Math.min(1000, Math.max(source.width, source.height));
  const output = path.join(root, 'public/images/products', `${id}.webp`);
  await sharp(bytes).rotate().resize(size, size, {
    fit: 'contain', withoutEnlargement: true, background: '#ffffff',
  }).webp({ quality: 90, effort: 6 }).toFile(output);
  const encoded = await fs.readFile(output);
  const actual = await sharp(encoded).metadata();
  if (actual.format !== 'webp') throw new Error(`${id}: invalid encoding`);
  manifest[id] = {
    downloadUrl: asset.downloadUrl, sourceWidth: source.width, sourceHeight: source.height,
    width: actual.width, height: actual.height, format: actual.format, bytes: encoded.length,
    sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    sha256: crypto.createHash('sha256').update(encoded).digest('hex'),
    developmentOnly: true, icecatId: asset.icecatId, manufacturerSku: asset.manufacturerSku,
    changes: '2026-10-26: full image contained on white square, aspect ratio retained, resized without upscaling, encoded as WebP. No generative editing or hardware cropping.',
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${id}: ${actual.width}x${actual.height}, ${encoded.length} bytes`);
  if (!cache) await new Promise((resolve) => setTimeout(resolve, 1000));
}
