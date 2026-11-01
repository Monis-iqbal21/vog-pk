import { Injectable } from '@nestjs/common';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
import { validateValues, inputValues } from '../catalog/facts.js';

export type UsageImpact = {
  mode: 'NO_PRODUCT_MODEL' | 'PRODUCT_REFERENCES';
  referencedProducts: number | null;
  blockingReasons: string[];
  affected?: unknown;
};
@Injectable()
export class SchemaUsageService {
  // Scoped real usage. Never treat truncated or unavailable analysis as zero.
  async inspect(
    tx: ScopeTransaction,
    tenantId: string,
    versionId: string,
  ): Promise<UsageImpact> {
    const candidate = await tx.productTypeVersion.findFirst({
      where: { id: versionId, tenantId },
      include: { attributes: { include: { attribute: true } } },
    });
    if (!candidate)
      return {
        mode: 'PRODUCT_REFERENCES',
        referencedProducts: null,
        blockingReasons: ['Schema usage cannot be resolved.'],
      };
    const revisions = await tx.productRevision.findMany({
      where: { tenantId, productTypeId: candidate.productTypeId },
      take: 501,
      include: {
        bindings: true,
        values: { include: { binding: true, choices: true } },
        skus: {
          include: { values: { include: { binding: true, choices: true } } },
        },
        _count: { select: { listingRevisions: true } },
      },
    });
    const blockingReasons: string[] = [],
      affected: { revisionId: string; productId: string; reasons: string[] }[] =
        [];
    if (revisions.length > 500)
      blockingReasons.push(
        'Usage exceeds safe analysis limit; explicit migration review required.',
      );
    for (const row of revisions.slice(0, 500)) {
      const reasons: string[] = [],
        bindings = candidate.attributes.map((b) => ({
          ...b,
          axis: row.bindings.some(
            (o) => o.attributeId === b.attributeId && o.axis,
          ),
        }));
      if (row.schemaVersionId !== candidate.id) {
        if (
          !row.skus.length &&
          !candidate.allowNoSku &&
          ['RFQ', 'INFORMATIONAL'].includes(row.sellingMode)
        )
          reasons.push('SKU-free selling policy is no longer permitted.');
        for (const old of row.bindings) {
          const next = candidate.attributes.find(
            (b) => b.attributeId === old.attributeId,
          );
          if (!next) reasons.push('A referenced attribute is removed.');
          else if (
            next.level !== old.level ||
            (old.axis && !next.variantAxis) ||
            (next.snapshot as { canonicalUnit: string | null })
              .canonicalUnit !==
              (old.snapshot as { canonicalUnit: string | null }).canonicalUnit
          )
            reasons.push(
              'Attribute scope, axis eligibility or canonical unit changes.',
            );
        }
        try {
          validateValues(bindings, inputValues(row.values), 'PRODUCT', true);
          for (const sku of row.skus)
            validateValues(bindings, inputValues(sku.values), 'SKU', true);
        } catch {
          reasons.push(
            'Required fields, validation or option vocabulary conflict with saved facts.',
          );
        }
      }
      if (candidate.attributes.some((b) => b.attribute.status === 'ARCHIVED'))
        reasons.push('An attribute is archived.');
      if (reasons.length) {
        affected.push({
          revisionId: row.id,
          productId: row.productId,
          reasons: [...new Set(reasons)],
        });
        if (row.approvedAt || row._count.listingRevisions)
          blockingReasons.push(
            'Approved products or listing pins require a reviewed schema migration.',
          );
      }
    }
    const filterDependencies = await tx.categoryFilterTypeVersion.count({
      where: {
        tenantId,
        version: { productTypeId: candidate.productTypeId },
        set: { status: { in: ['APPROVED', 'ACTIVE'] } },
      },
    });
    return {
      mode: 'PRODUCT_REFERENCES',
      referencedProducts: new Set(revisions.map((r) => r.productId)).size,
      blockingReasons: [...new Set(blockingReasons)],
      affected: {
        productRevisionCount: revisions.length,
        skuRevisionCount: revisions.reduce((n, r) => n + r.skus.length, 0),
        listingRevisionCount: revisions.reduce(
          (n, r) => n + r._count.listingRevisions,
          0,
        ),
        filterDependencies,
        conflicts: affected.slice(0, 25),
        truncated: affected.length > 25 || revisions.length > 500,
        pinsPreserved: true,
      },
    };
  }
}
