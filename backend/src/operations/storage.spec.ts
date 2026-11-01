import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalMediaStorage, decodeImage, mediaLimits } from './storage.js';
describe('private validated media storage', () => {
  it('requires actual raster signatures and strict encoding, rejecting SVG/script payloads', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    expect(decodeImage(png.toString('base64'), 'image/png')).toEqual(png);
    expect(() => decodeImage(png.toString('base64'), 'image/jpeg')).toThrow();
    expect(() =>
      decodeImage(
        Buffer.from('<svg><script/></svg>').toString('base64'),
        'image/png',
      ),
    ).toThrow();
    expect(() => decodeImage('invalid..', 'image/png')).toThrow();
    expect(mediaLimits().maxBytes).toBeLessThan(6291456);
  });
  it('decodes, strips metadata, auto-orients and creates bounded WebP derivatives privately', async () => {
    const old = process.env.MEDIA_LOCAL_ROOT,
      provider = process.env.MEDIA_STORAGE_PROVIDER,
      root = path.resolve('.local/operations', `unit-${randomUUID()}`),
      tenant = randomUUID(),
      asset = randomUUID();
    process.env.MEDIA_LOCAL_ROOT = root;
    process.env.MEDIA_STORAGE_PROVIDER = 'local-development';
    const storage = new LocalMediaStorage();
    if (path.dirname(root) !== path.resolve('.local/operations'))
      throw Error('Unsafe media unit cleanup');
    try {
      const input = await sharp({
        create: { width: 80, height: 120, channels: 3, background: 'navy' },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();
      const result = await storage.put(tenant, asset, input);
      expect(result.derivatives.map((d) => d.width)).toEqual([
        320, 640, 1280, 1920,
      ]);
      const bytes = await storage.read(tenant, asset, 320),
        metadata = await sharp(bytes).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.width).toBe(120);
      expect(metadata.height).toBe(80);
      expect(result.size).toBeGreaterThan(0);
      await expect(storage.read('../outside', asset, 320)).rejects.toThrow();
      await expect(storage.read(tenant, asset, 999)).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      if (old === undefined) delete process.env.MEDIA_LOCAL_ROOT;
      else process.env.MEDIA_LOCAL_ROOT = old;
      if (provider === undefined) delete process.env.MEDIA_STORAGE_PROVIDER;
      else process.env.MEDIA_STORAGE_PROVIDER = provider;
    }
  });
  it('keeps unconfigured remote providers inactive and rejects unsafe local-root overrides', async () => {
    const provider = process.env.MEDIA_STORAGE_PROVIDER,
      root = process.env.MEDIA_LOCAL_ROOT;
    try {
      process.env.MEDIA_STORAGE_PROVIDER = 'cloudinary';
      const storage = new LocalMediaStorage();
      expect(storage.active()).toBe(false);
      await expect(
        storage.read(randomUUID(), randomUUID(), 320),
      ).rejects.toThrow();
      process.env.MEDIA_STORAGE_PROVIDER = 'local-development';
      process.env.MEDIA_LOCAL_ROOT = path.resolve('outside-private-media');
      await expect(
        storage.read(randomUUID(), randomUUID(), 320),
      ).rejects.toThrow();
    } finally {
      if (provider === undefined) delete process.env.MEDIA_STORAGE_PROVIDER;
      else process.env.MEDIA_STORAGE_PROVIDER = provider;
      if (root === undefined) delete process.env.MEDIA_LOCAL_ROOT;
      else process.env.MEDIA_LOCAL_ROOT = root;
    }
  });
});
