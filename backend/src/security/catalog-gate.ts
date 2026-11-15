import { ServiceUnavailableException } from '@nestjs/common';
const modules = new Set([
  'products',
  'skus',
  'variants',
  'product-types',
  'attributes',
  'option-sets',
  'categories',
  'category-filters',
  'listings',
  'pricing',
  'inventory',
  'media',
  'listing-media',
  'homepage',
]);
export function assertCatalogMutationEnabled(
  permissions: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const mutation = permissions.some((code) => {
    const [module, action] = code.split('.');
    return modules.has(module) && action !== 'view';
  });
  if (
    mutation &&
    env.NODE_ENV === 'production' &&
    env.CATALOG_ADMIN_WRITES_ENABLED !== '1'
  )
    throw new ServiceUnavailableException(
      'Catalog changes are disabled pending an approved rollout.',
    );
}
