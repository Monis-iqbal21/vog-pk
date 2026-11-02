import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../security/database.js';
import { ScopedAuthorizationService } from '../security/scoped-authorization.service.js';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import { json, stale } from '../categories/category.service.js';
import { fail } from '../product-types/validation.js';
import { LocalMediaStorage, decodeImage, mediaLimits } from './storage.js';
import * as v from './validation.js';
import type { z } from 'zod';
import { referencePreview } from './reference-preview.js';
@Injectable()
export class MediaService {
  constructor(
    @Inject(DatabaseService) readonly db: DatabaseService,
    @Inject(ScopedAuthorizationService)
    readonly auth: ScopedAuthorizationService,
    @Inject(LocalMediaStorage) readonly storage: LocalMediaStorage,
  ) {}
  require(
    actor: string,
    tenantId: string,
    permission: string,
    tx: ScopeTransaction = this.db,
  ) {
    return this.auth.require(
      actor,
      { kind: 'TENANT', tenantId },
      [permission],
      tx,
    );
  }
  async write<T>(
    actor: string,
    tenantId: string,
    permission: string,
    fn: (tx: ScopeTransaction) => Promise<T>,
  ) {
    try {
      return await this.auth.write(async (tx) => {
        await this.require(actor, tenantId, permission, tx);
        return fn(tx);
      });
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2034')
        throw new ConflictException(
          'Media changed concurrently. Reload before retrying.',
        );
      if (
        e instanceof ConflictException &&
        e.message === 'A role with that code already exists.'
      )
        throw new ConflictException(
          'Media identity or upload key already exists.',
        );
      throw e;
    }
  }
  audit(
    tx: ScopeTransaction,
    actor: string,
    tenantId: string,
    action: string,
    id: string,
  ) {
    return this.auth.audit(
      tx,
      actor,
      { kind: 'TENANT', tenantId },
      'media.' + action,
      id,
    );
  }
  async row(tx: ScopeTransaction, tenantId: string, id: string) {
    const row = await tx.mediaAsset.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Media asset not found.');
    return row;
  }
  async frozen(tx: ScopeTransaction, tenantId: string, id: string) {
    return (
      (await tx.productRevisionMedia.count({
        where: {
          tenantId,
          assetId: id,
          revision: { status: { not: 'DRAFT' } },
        },
      })) +
      (await tx.sKURevisionMedia.count({
        where: {
          tenantId,
          assetId: id,
          revision: { revision: { status: { not: 'DRAFT' } } },
        },
      }))
    );
  }
  async list(actor: string, tenantId: string, q: z.infer<typeof v.page>) {
    await this.require(actor, tenantId, 'media.view');
    const where = {
      tenantId,
      altText: { contains: q.search, mode: 'insensitive' as const },
    };
    return {
      items: await this.db.mediaAsset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      total: await this.db.mediaAsset.count({ where }),
      storage: this.storage.status(),
    };
  }
  async content(actor: string, tenantId: string, id: string, width: number) {
    await this.require(actor, tenantId, 'media.view');
    const asset = await this.row(this.db, tenantId, id);
    if (![320, 640, 1280, 1920].includes(width))
      fail('Unsupported preview width.');
    let bytes: Buffer;
    if (asset.storageProvider === 'REFERENCE') {
      const evidence = await this.db.catalogImportRecord.findFirst({
        where: {
          tenantId,
          complete: true,
          kind: 'PRODUCT',
          mapping: { path: ['media'], array_contains: [{ assetId: id }] },
        },
      });
      const refs = (
        evidence?.mapping as
          | {
              media?: {
                assetId: string;
                source: { src: string; sha256: string };
              }[];
            }
          | undefined
      )?.media;
      const ref = refs?.find((r) => r.assetId === id);
      if (
        !ref ||
        ref.source.src !== asset.storageReference ||
        ref.source.sha256 !== asset.contentDigest
      )
        throw new NotFoundException('Private reference preview unavailable.');
      bytes = await referencePreview(ref.source.src, ref.source.sha256, width);
    } else {
      if (asset.storageProvider !== this.storage.kind)
        fail('This reference has no active managed delivery provider.');
      bytes = await this.storage.read(tenantId, id, width);
    }
    return {
      assetId: id,
      width,
      mimeType: 'image/webp',
      dataUrl: `data:image/webp;base64,${bytes.toString('base64')}`,
      private: true,
    };
  }
  async upload(
    actor: string,
    tenantId: string,
    input: z.infer<typeof v.upload>,
  ) {
    await this.require(actor, tenantId, 'media.upload');
    const bytes = decodeImage(input.dataBase64, input.mimeType);
    const uploadHash = createHash('sha256')
      .update(bytes)
      .update(
        JSON.stringify({
          alt: input.altText,
          caption: input.caption,
          purpose: input.intendedPurpose,
          source: input.sourceUrl,
        }),
      )
      .digest('hex');
    const prior = await this.db.mediaAsset.findUnique({
      where: { tenantId_uploadKey: { tenantId, uploadKey: input.uploadKey } },
    });
    if (prior) {
      if (prior.uploadHash !== uploadHash)
        throw new ConflictException('Upload key belongs to another payload.');
      return prior;
    }
    if (
      (await this.db.mediaAsset.count({ where: { tenantId } })) >=
      mediaLimits().maxAssets
    )
      fail('Tenant media limit reached.');
    const id = randomUUID();
    let committed = false;
    try {
      const image = await this.storage.put(tenantId, id, bytes);
      const result = await this.write(
        actor,
        tenantId,
        'media.upload',
        async (tx) => {
          const duplicate = await tx.mediaAsset.findUnique({
            where: {
              tenantId_uploadKey: { tenantId, uploadKey: input.uploadKey },
            },
          });
          if (duplicate) {
            if (duplicate.uploadHash !== uploadHash)
              throw new ConflictException(
                'Upload key belongs to another payload.',
              );
            return duplicate;
          }
          if (
            ((
              await tx.mediaAsset.aggregate({
                where: { tenantId },
                _sum: { storedBytes: true },
              })
            )._sum.storedBytes ?? 0) +
              image.size >
            mediaLimits().maxStoredBytes
          )
            fail('Tenant optimized-media byte quota reached.');
          if (
            (await tx.mediaAsset.count({ where: { tenantId } })) >=
            mediaLimits().maxAssets
          )
            fail('Tenant media limit reached.');
          const row = await tx.mediaAsset.create({
            data: {
              id,
              tenantId,
              code: `asset_${id}`,
              storageProvider: this.storage.kind,
              storageReference: `${tenantId}/${id}`,
              byteSize: bytes.length,
              storedBytes: image.size,
              mimeType: 'image/webp',
              width: image.width,
              height: image.height,
              derivatives: json(image.derivatives),
              contentDigest: createHash('sha256').update(bytes).digest('hex'),
              altText: input.altText,
              caption: input.caption,
              intendedPurpose: input.intendedPurpose,
              sourceUrl: input.sourceUrl,
              uploadKey: input.uploadKey,
              uploadHash,
              createdBy: actor,
              rightsMetadata: { attribution: '', developmentOnly: true },
            },
          });
          await this.audit(tx, actor, tenantId, 'uploaded', id);
          return row;
        },
      );
      committed = result.id === id;
      return result;
    } finally {
      if (!committed && this.storage.active())
        await this.storage.discard(tenantId, id);
    }
  }
  metadata(
    actor: string,
    tenantId: string,
    id: string,
    input: z.infer<typeof v.metadata>,
  ) {
    return this.write(actor, tenantId, 'media.manage', async (tx) => {
      const row = await this.row(tx, tenantId, id);
      if (row.revision !== input.revision) stale();
      if (row.rights === 'APPROVED' || (await this.frozen(tx, tenantId, id)))
        throw new ConflictException(
          'Approved or referenced media is immutable; upload a replacement asset.',
        );
      const saved = await tx.mediaAsset.update({
        where: { id },
        data: {
          altText: input.altText,
          caption: input.caption,
          intendedPurpose: input.intendedPurpose,
          sourceUrl: input.sourceUrl,
          rightsMetadata: {
            attribution: input.attribution,
            developmentOnly: true,
          },
          revision: { increment: 1 },
        },
      });
      await this.audit(tx, actor, tenantId, 'metadata_updated', id);
      return saved;
    });
  }
  approve(
    actor: string,
    tenantId: string,
    id: string,
    input: z.infer<typeof v.approveMedia>,
  ) {
    return this.write(actor, tenantId, 'media.approve', async (tx) => {
      const row = await this.row(tx, tenantId, id);
      if (row.revision !== input.revision) stale();
      if (
        row.archived ||
        row.rights === 'APPROVED' ||
        (await this.frozen(tx, tenantId, id))
      )
        throw new ConflictException(
          'Asset approval is immutable; replace the asset for a different rights decision.',
        );
      const publicUse = input.scope === 'PUBLIC';
      if (
        publicUse &&
        (/^https?:\/\/\S+$/.test(input.license.trim()) ||
          (input.evidenceNote.trim() || input.license.trim()).length < 10)
      )
        fail('Record licensing evidence, not only a working source URL.');
      const saved = await tx.mediaAsset.update({
        where: { id },
        data: {
          rights: 'APPROVED',
          publicUse,
          developmentOnly: !publicUse,
          rightsMetadata: {
            previousSourceMetadata: row.rightsMetadata,
            license: input.license,
            attribution: input.attribution,
            scope: input.scope,
          },
          revision: { increment: 1 },
        },
      });
      await tx.mediaApproval.create({
        data: {
          tenantId,
          assetId: id,
          approvedRevision: saved.revision,
          actorId: actor,
          license: input.license,
          attribution: input.attribution,
          publicUse,
        },
      });
      await tx.mediaReview.create({
        data: {
          tenantId,
          assetId: id,
          assetRevision: row.revision,
          decision: publicUse ? 'APPROVE_PUBLIC' : 'APPROVE_DEVELOPMENT',
          reviewerId: actor,
          license: input.license,
          attribution: input.attribution,
          evidenceUrl: input.evidenceUrl,
          evidenceNote: input.evidenceNote || input.license,
          conditions: input.conditions,
          sourceSnapshot: json({
            sourceUrl: row.sourceUrl,
            contentDigest: row.contentDigest,
            purpose: row.intendedPurpose,
            rightsMetadata: row.rightsMetadata,
          }),
        },
      });
      await this.audit(tx, actor, tenantId, 'rights_approved', id);
      return saved;
    });
  }
  reject(
    actor: string,
    tenantId: string,
    id: string,
    input: z.infer<typeof v.rejectMedia>,
  ) {
    return this.write(actor, tenantId, 'media.approve', async (tx) => {
      const row = await this.row(tx, tenantId, id);
      if (row.revision !== input.revision) stale();
      if (
        row.archived ||
        row.rights === 'APPROVED' ||
        (await this.frozen(tx, tenantId, id))
      )
        throw new ConflictException(
          'Reviewed/public assets require replacement and republishing.',
        );
      const saved = await tx.mediaAsset.update({
        where: { id },
        data: {
          rights: 'RESTRICTED',
          publicUse: false,
          developmentOnly: true,
          revision: { increment: 1 },
        },
      });
      await tx.mediaReview.create({
        data: {
          tenantId,
          assetId: id,
          assetRevision: row.revision,
          decision: 'REJECT',
          reviewerId: actor,
          license: '',
          attribution: '',
          evidenceUrl: input.evidenceUrl,
          evidenceNote: input.reason,
          conditions: input.conditions,
          sourceSnapshot: json({
            sourceUrl: row.sourceUrl,
            contentDigest: row.contentDigest,
            purpose: row.intendedPurpose,
            rightsMetadata: row.rightsMetadata,
          }),
        },
      });
      await this.audit(tx, actor, tenantId, 'rights_rejected', id);
      return saved;
    });
  }
  async review(actor: string, tenantId: string, id: string) {
    await this.require(actor, tenantId, 'media.view');
    const asset = await this.row(this.db, tenantId, id);
    const reviews = await this.db.mediaReview.findMany({
      where: { tenantId, assetId: id },
      include: { reviewer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const imports = await this.db.catalogImportRecord.findMany({
      where: {
        tenantId,
        complete: true,
        kind: 'PRODUCT',
        mapping: { path: ['media'], array_contains: [{ assetId: id }] },
      },
      select: { listingId: true, sourceKey: true },
      take: 100,
    });
    const memberships = await this.db.storeMembership.findMany({
      where: { tenantId, userId: actor, active: true, store: { active: true } },
      select: { storeId: true },
      take: 100,
    });
    const allowed: string[] = [];
    for (const m of memberships) {
      const access = await this.auth.resolve(actor, {
        kind: 'STORE',
        tenantId,
        storeId: m.storeId,
      });
      if (access.permissions.includes('listings.view')) allowed.push(m.storeId);
    }
    const affected = allowed.length
      ? await this.db.listingRevision.findMany({
          where: {
            tenantId,
            storeId: { in: allowed },
            OR: [
              {
                listingId: {
                  in: imports.flatMap((r) =>
                    r.listingId ? [r.listingId] : [],
                  ),
                },
              },
              { productRevision: { media: { some: { assetId: id } } } },
              {
                productRevision: {
                  skus: { some: { media: { some: { assetId: id } } } },
                },
              },
            ],
          },
          select: {
            id: true,
            listingId: true,
            storeId: true,
            title: true,
            slug: true,
            status: true,
          },
          take: 100,
        })
      : [];
    return {
      asset,
      reviews,
      legacyApprovals: await this.db.mediaApproval.findMany({
        where: { tenantId, assetId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      affectedListings: affected,
      publicationBlocked:
        asset.archived ||
        asset.rights !== 'APPROVED' ||
        asset.developmentOnly ||
        !asset.publicUse ||
        !this.storage.active() ||
        asset.storageProvider !== 'LOCAL_DEVELOPMENT',
      previewMode:
        asset.storageProvider === 'REFERENCE'
          ? 'CONTROLLED_DEVELOPMENT_REFERENCE'
          : 'MANAGED_PRIVATE',
      replacement:
        'Upload a new authorized asset and assign it to a draft product/SKU revision; reviewed relationships remain immutable.',
    };
  }
  archive(actor: string, tenantId: string, id: string, revision: number) {
    return this.write(actor, tenantId, 'media.manage', async (tx) => {
      const row = await this.row(tx, tenantId, id);
      if (row.revision !== revision) stale();
      if (await this.frozen(tx, tenantId, id))
        throw new ConflictException(
          'Reviewed or published media references must be preserved. Replace and republish explicitly before archival.',
        );
      const saved = await tx.mediaAsset.update({
        where: { id },
        data: { archived: true, revision: { increment: 1 } },
      });
      await this.audit(tx, actor, tenantId, 'archived', id);
      return saved;
    });
  }
  async assignments(
    actor: string,
    tenantId: string,
    productId: string,
    revisionId: string,
    skuRevisionId?: string,
  ) {
    await this.require(actor, tenantId, 'media.view');
    const row = await this.db.productRevision.findFirst({
      where: { id: revisionId, tenantId, productId },
      include: {
        media: {
          include: { asset: true },
          orderBy: [{ purpose: 'asc' }, { sortOrder: 'asc' }],
        },
        skus: {
          include: {
            sku: true,
            media: {
              include: { asset: true },
              orderBy: [{ purpose: 'asc' }, { sortOrder: 'asc' }],
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Catalog media revision not found.');
    if (skuRevisionId && !row.skus.some((s) => s.id === skuRevisionId))
      fail('SKU revision does not belong to this product revision.');
    return {
      revision: row.revision,
      status: row.status,
      shared: row.media,
      skus: row.skus.map((s) => ({
        id: s.id,
        skuId: s.skuId,
        code: s.sku.code,
        media: s.media,
      })),
    };
  }
  assign(
    actor: string,
    tenantId: string,
    productId: string,
    revisionId: string,
    skuRevisionId: string | undefined,
    input: z.infer<typeof v.assignments>,
  ) {
    return this.write(actor, tenantId, 'media.manage', async (tx) => {
      await this.require(actor, tenantId, 'products.update', tx);
      if (skuRevisionId) await this.require(actor, tenantId, 'skus.update', tx);
      const row = await tx.productRevision.findFirst({
        where: {
          id: revisionId,
          tenantId,
          productId,
          product: { archived: false },
        },
        include: { skus: true },
      });
      if (!row) throw new NotFoundException('Product revision not found.');
      if (row.revision !== input.revision) stale();
      if (row.status !== 'DRAFT')
        throw new ConflictException(
          'Clone catalog facts before changing media assignments.',
        );
      if (skuRevisionId && !row.skus.some((s) => s.id === skuRevisionId))
        fail('SKU revision ownership mismatch.');
      for (const ref of input.references) {
        const asset = await this.row(tx, tenantId, ref.assetId);
        if (asset.archived) fail('Archived assets cannot be assigned.');
      }
      if (skuRevisionId)
        await tx.sKURevisionMedia.deleteMany({
          where: { tenantId, productRevisionId: revisionId, skuRevisionId },
        });
      else
        await tx.productRevisionMedia.deleteMany({
          where: { tenantId, productRevisionId: revisionId },
        });
      const orders = new Map<string, number>();
      for (const ref of input.references) {
        const sortOrder = orders.get(ref.purpose) ?? 0;
        orders.set(ref.purpose, sortOrder + 1);
        const data = {
          tenantId,
          productRevisionId: revisionId,
          assetId: ref.assetId,
          purpose: ref.purpose,
          sortOrder,
          altText: ref.altText,
          caption: ref.caption,
          visible: ref.visible,
          presentation: json(ref.presentation),
        };
        if (skuRevisionId)
          await tx.sKURevisionMedia.create({
            data: { ...data, productId, skuRevisionId },
          });
        else await tx.productRevisionMedia.create({ data });
      }
      await tx.productRevision.update({
        where: { id: revisionId },
        data: { revision: { increment: 1 }, updatedBy: actor },
      });
      await this.audit(tx, actor, tenantId, 'assignments_saved', revisionId);
      return { revision: row.revision + 1 };
    });
  }
}
