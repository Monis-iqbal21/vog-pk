import { Injectable } from '@nestjs/common';
import type { ScopeTransaction } from '../security/scoped-authorization.service.js';

export type UsageImpact = {
  mode: 'NO_PRODUCT_MODEL' | 'PRODUCT_REFERENCES';
  referencedProducts: number | null;
  blockingReasons: string[];
};
@Injectable()
export class SchemaUsageService {
  // Replace with tenant-scoped product revision queries in the product milestone.
  // Unknown usage must be blocking, never interpreted as zero by activation.
  inspect(
    _tx: ScopeTransaction,
    _tenantId: string,
    _versionId: string,
  ): Promise<UsageImpact> {
    return Promise.resolve({
      mode: 'NO_PRODUCT_MODEL',
      referencedProducts: 0,
      blockingReasons: [],
    });
  }
}
