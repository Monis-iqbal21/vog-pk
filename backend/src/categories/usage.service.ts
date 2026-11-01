import { Injectable } from '@nestjs/common';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
@Injectable()
export class CategoryUsageService {
  // Count actual store-owned assignments and validate proposed compatibility.
  async inspect(tx: ScopeTransaction, storeId: string, categoryId: string) {
    const assignments = await tx.listingCategory.count({
      where: {
        storeId,
        categoryId,
        revision: { listing: { archived: false }, status: { not: 'ARCHIVED' } },
      },
    });
    const category = await tx.category.findFirst({
      where: { id: categoryId, storeId },
      include: { allowedTypes: true },
    });
    const incompatible =
      category?.compatibility === 'ALLOW_LIST'
        ? await tx.listingCategory.count({
            where: {
              storeId,
              categoryId,
              revision: {
                listing: { archived: false },
                status: { not: 'ARCHIVED' },
                productRevision: {
                  productTypeId: {
                    notIn: category.allowedTypes.map((t) => t.productTypeId),
                  },
                },
              },
            },
          })
        : 0;
    return {
      mode: 'LISTING_REFERENCES' as const,
      assignments: assignments as number | null,
      blockingReasons: incompatible
        ? [
            'Existing listing Product Types conflict with the proposed category compatibility.',
          ]
        : ([] as string[]),
    };
  }
}
