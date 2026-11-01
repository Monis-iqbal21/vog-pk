import {
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fail } from '../product-types/validation.js';
export const IMAGE_WIDTHS = [320, 640, 1280, 1920] as const;
export function mediaLimits() {
  const integer = (
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) => {
    const v =
      process.env[name] === undefined ? fallback : Number(process.env[name]);
    if (!Number.isSafeInteger(v) || v < min || v > max)
      throw new Error('Invalid media limit configuration.');
    return v;
  };
  return {
    maxBytes: integer('MEDIA_MAX_BYTES', 5242880, 1024, 6000000),
    maxStoredBytes: integer(
      'MEDIA_MAX_STORED_BYTES',
      536870912,
      1048576,
      1073741824,
    ),
    maxPixels: integer('MEDIA_MAX_PIXELS', 32000000, 1024, 32000000),
    maxDimension: integer('MEDIA_MAX_DIMENSION', 16000, 32, 16000),
    maxAssets: integer('MEDIA_MAX_ASSETS', 500, 1, 5000),
    maxAssignments: 24,
    maxBatch: 8,
  };
}
export interface MediaStorage {
  readonly kind: string;
  active(): boolean;
  put(
    tenantId: string,
    assetId: string,
    bytes: Buffer,
  ): Promise<{
    width: number;
    height: number;
    size: number;
    derivatives: {
      width: number;
      actualWidth: number;
      height: number;
      bytes: number;
    }[];
  }>;
  read(tenantId: string, assetId: string, width: number): Promise<Buffer>;
  discard(tenantId: string, assetId: string): Promise<void>;
}
@Injectable()
export class LocalMediaStorage implements MediaStorage {
  readonly kind = 'LOCAL_DEVELOPMENT';
  private working = 0;
  active() {
    return (
      ['development', 'test'].includes(process.env.NODE_ENV ?? '') &&
      (process.env.MEDIA_STORAGE_PROVIDER ?? 'local-development') ===
        'local-development'
    );
  }
  status() {
    return {
      provider: this.kind,
      active: this.active(),
      remoteActive: false,
      limits: mediaLimits(),
      formats: ['image/png', 'image/jpeg', 'image/webp'],
      widths: IMAGE_WIDTHS,
    };
  }
  private directory(tenantId: string, assetId: string) {
    if (!this.active())
      throw new ServiceUnavailableException(
        'Media provider is inactive. Configure an approved provider separately.',
      );
    if (![tenantId, assetId].every((v) => /^[a-f0-9-]{36}$/.test(v)))
      fail('Invalid storage identity.');
    const base = path.resolve('.local'),
      root = path.resolve(
        process.env.MEDIA_LOCAL_ROOT ?? path.join(base, 'media-assets'),
      );
    if (!root.startsWith(base + path.sep))
      throw new Error(
        'Media storage must remain inside the private development directory.',
      );
    const destination = path.resolve(root, tenantId, assetId);
    if (!destination.startsWith(root + path.sep))
      throw new Error('Invalid private storage destination.');
    return destination;
  }
  async put(tenantId: string, assetId: string, bytes: Buffer) {
    if (this.working >= 2)
      throw new HttpException(
        'Image processing is busy. Retry with the same upload key.',
        429,
      );
    const directory = this.directory(tenantId, assetId);
    this.working++;
    try {
      const limits = mediaLimits();
      let metadata;
      try {
        metadata = await sharp(bytes, {
          limitInputPixels: limits.maxPixels,
          failOn: 'warning',
          animated: false,
        }).metadata();
      } catch {
        fail('Image decoding failed.');
      }
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width > limits.maxDimension ||
        metadata.height > limits.maxDimension ||
        (metadata.pages ?? 1) > 1 ||
        !['png', 'jpeg', 'webp'].includes(metadata.format ?? '')
      )
        fail('Image dimensions, format or animation are not supported.');
      await fs.mkdir(directory, { recursive: true });
      const derivatives = [];
      let width = 0,
        height = 0,
        size = 0;
      for (const requested of IMAGE_WIDTHS) {
        const output = await sharp(bytes, {
          limitInputPixels: limits.maxPixels,
          failOn: 'warning',
        })
          .rotate()
          .resize({ width: requested, withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        await fs.writeFile(
          path.join(directory, `${requested}.webp`),
          output.data,
          { flag: 'wx' },
        );
        derivatives.push({
          width: requested,
          actualWidth: output.info.width,
          height: output.info.height,
          bytes: output.info.size,
        });
        width = output.info.width;
        height = output.info.height;
        size += output.info.size;
      }
      return { width, height, size, derivatives };
    } finally {
      this.working--;
    }
  }
  async read(tenantId: string, assetId: string, width: number) {
    if (!IMAGE_WIDTHS.includes(width as (typeof IMAGE_WIDTHS)[number]))
      fail('Unsupported responsive width.');
    try {
      return await fs.readFile(
        path.join(this.directory(tenantId, assetId), `${width}.webp`),
      );
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException('Image derivative is unavailable.');
    }
  }
  async discard(tenantId: string, assetId: string) {
    const directory = this.directory(tenantId, assetId);
    await fs.rm(directory, { recursive: true, force: true });
  }
}
export function decodeImage(dataBase64: string, mimeType: string) {
  if (dataBase64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64))
    fail('Invalid image encoding.');
  const bytes = Buffer.from(dataBase64, 'base64');
  if (!bytes.length || bytes.length > mediaLimits().maxBytes)
    fail('Image exceeds the configured upload limit.');
  const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
    webp =
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP';
  if (
    !(
      { 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp } as Record<
        string,
        boolean
      >
    )[mimeType]
  )
    fail('Actual image signature does not match its declared type.');
  return bytes;
}
