import { Injectable } from '@nestjs/common';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';
@Injectable()
export class CategoryUsageService {
  // Milestone 3 has no Listing/Product tables. Future integration must replace
  // this boundary before public cutover; unknown impact blocks writes.
  inspect(_tx: ScopeTransaction, _storeId: string, _categoryId: string) {
    return Promise.resolve({
      mode: 'NO_LISTING_MODEL' as const,
      assignments: 0 as number | null,
      blockingReasons: [] as string[],
    });
  }
}
