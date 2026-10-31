// Only these foundation APIs may cross the authenticated BFF. Never a generic proxy.
export function allowedScopedRoute(method, path) {
  if (method === 'GET' && path === 'contexts') return true;
  const id = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
  const scope = `scopes/(?:platform|tenants/${id}(?:/stores/${id})?)`;
  if (method === 'GET') return new RegExp(`^${scope}/(?:access|roles|permissions)$`).test(path);
  if (method === 'POST') return new RegExp(`^${scope}/(?:roles|members/${id}/(?:roles|revoke))$`).test(path);
  if (method === 'PATCH') return new RegExp(`^${scope}/roles/${id}$`).test(path);
  return false;
}
