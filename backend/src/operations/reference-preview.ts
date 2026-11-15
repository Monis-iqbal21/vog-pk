import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { NotFoundException } from '@nestjs/common';
// Private development preview only. No remote fetch, arbitrary path or public URL.
export async function referencePreview(
  reference: string,
  digest: string | null,
  width: number,
) {
  if (
    !['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
    process.env.MEDIA_REFERENCE_PREVIEW !== '1' ||
    !/^\/images\/products\/[a-zA-Z0-9_/-]+\.(png|webp|jpg|jpeg)$/.test(
      reference,
    ) ||
    !digest
  )
    throw new NotFoundException('Private reference preview unavailable.');
  try {
    const root = await fs.realpath(
        fileURLToPath(new URL('../../../frontend/public/', import.meta.url)),
      ),
      target = await fs.realpath(path.join(root, reference));
    if (!target.startsWith(root + path.sep))
      throw Error('Outside reviewed root');
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > 6291456) throw Error('Invalid size');
    const bytes = await fs.readFile(target);
    if (createHash('sha256').update(bytes).digest('hex') !== digest)
      throw Error('Source hash changed');
    return await sharp(bytes, { limitInputPixels: 32000000, failOn: 'warning' })
      .resize({ width: Math.min(width, 640), withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new NotFoundException('Private reference preview unavailable.');
  }
}
