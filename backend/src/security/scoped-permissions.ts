import {PERMISSIONS} from './roles.js';
import type {AuthorizationScope} from '../generated/prisma/client.js';

// Registered capabilities are server-owned. A client cannot invent a permission.
const tenantModules = new Set(['products', 'variants', 'media']);
export const SCOPED_PERMISSIONS: Record<string, readonly AuthorizationScope[]> = {
  ...Object.fromEntries(PERMISSIONS.map(code => [code,
    tenantModules.has(code.split('.')[0]) ? ['TENANT'] :
    ['staff', 'roles', 'audit', 'dashboard', 'settings'].includes(code.split('.')[0]) ? ['TENANT', 'STORE'] : ['STORE'],
  ])),
  'product-types.view': ['TENANT'],
  'product-types.manage': ['TENANT'],
  'product-types.create': ['TENANT'],
  'product-types.update': ['TENANT'],
  'product-types.approve': ['TENANT'],
  'product-types.activate': ['TENANT'],
  'product-types.archive': ['TENANT'],
  'attributes.view': ['TENANT'],
  'attributes.create': ['TENANT'],
  'attributes.update': ['TENANT'],
  'attributes.archive': ['TENANT'],
  'option-sets.view': ['TENANT'],
  'option-sets.manage': ['TENANT'],
  'categories.create': ['STORE'],
  'categories.update': ['STORE'],
  'categories.archive': ['STORE'],
  'categories.reorder': ['STORE'],
  'categories.approve': ['STORE'],
  'categories.activate': ['STORE'],
  'category-filters.view': ['STORE'],
  'category-filters.manage': ['STORE'],
  'category-filters.approve': ['STORE'],
  'category-filters.activate': ['STORE'],
  'listings.view': ['STORE'],
  ...Object.fromEntries(['products.create','products.update','products.archive','products.submit','products.approve','products.publish','skus.create','skus.update','skus.archive','variants.manage'].map(p=>[p,['TENANT']])),
  ...Object.fromEntries(['listings.create','listings.update','listings.archive','listings.submit','listings.approve','listings.publish','listings.assign-categories'].map(p=>[p,['STORE']])),
  'listings.manage': ['STORE'],
  'pricing.view': ['STORE'],
  'pricing.manage': ['STORE'],
  ...Object.fromEntries(['pricing.propose','pricing.approve','pricing.publish','pricing.archive','pricing.configure','inventory.adjust','inventory.audit','inventory.configure','listing-media.view','listing-media.manage'].map(p=>[p,['STORE']])),
  'media.upload':['TENANT'],
  'media.approve':['TENANT'],
  'platform.tenants.view': ['PLATFORM'],
  'platform.roles.view': ['PLATFORM'],
  'platform.roles.manage': ['PLATFORM'],
  'platform.staff.manage': ['PLATFORM'],
};
export type ScopeContext =
  | {kind: 'PLATFORM'}
  | {kind: 'TENANT'; tenantId: string}
  | {kind: 'STORE'; tenantId: string; storeId: string};
export const manageRolePermission = (ctx: ScopeContext) => ctx.kind === 'PLATFORM' ? 'platform.roles.manage' : 'roles.manage';
export const manageStaffPermission = (ctx: ScopeContext) => ctx.kind === 'PLATFORM' ? 'platform.staff.manage' : 'staff.manage';
export const viewRolePermission = (ctx: ScopeContext) => ctx.kind === 'PLATFORM' ? 'platform.roles.view' : 'roles.view';
