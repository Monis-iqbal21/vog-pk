import type {AdminRequest} from './guards.js';
import type {ScopeContext} from './scoped-permissions.js';
import {validId} from './validation.js';

export function requestScope(request: Pick<AdminRequest, 'params'>): ScopeContext {
  if (request.params.storeId) return {kind: 'STORE', tenantId: validId(String(request.params.tenantId)), storeId: validId(String(request.params.storeId))};
  if (request.params.tenantId) return {kind: 'TENANT', tenantId: validId(String(request.params.tenantId))};
  return {kind: 'PLATFORM'};
}
