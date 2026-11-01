// Only these foundation APIs may cross the authenticated BFF. Never a generic proxy.
export function allowedScopedRoute(method, path) {
  if (
    method === "GET" &&
    [
      "contexts",
      "contexts/schema",
      "contexts/catalog",
      "contexts/products",
    ].includes(path)
  )
    return true;
  const id = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
  const scope = `scopes/(?:platform|tenants/${id}(?:/stores/${id})?)`;
  const catalog = `stores/${id}`;
  const products = `scopes/tenants/${id}/catalog`;
  if (
    method === "GET" &&
    new RegExp(`^${catalog}/listings/(?:catalog|categories)$`).test(path)
  )
    return true;
  const actions = "(?:review|draft|approve|publish|archive)";
  if (
    method === "GET" &&
    new RegExp(
      `^${products}/(?:schemas|brands|products(?:/${id}(?:/revisions(?:/${id}(?:/impact)?)?)?)?)$`,
    ).test(path)
  )
    return true;
  if (
    method === "POST" &&
    new RegExp(
      `^${products}/(?:brands|products(?:/${id}/(?:archive|skus/${id}/archive|revisions/${id}/(?:clone|resolve|actions/${actions})))?)$`,
    ).test(path)
  )
    return true;
  if (
    method === "PATCH" &&
    new RegExp(`^${products}/products/${id}/revisions/${id}$`).test(path)
  )
    return true;
  if (
    method === "GET" &&
    new RegExp(
      `^${catalog}/listings(?:/${id}(?:/revisions(?:/${id}(?:/impact)?)?)?)?$`,
    ).test(path)
  )
    return true;
  if (
    method === "POST" &&
    new RegExp(
      `^${catalog}/listings(?:/${id}/(?:archive|revisions/${id}/(?:clone|actions/${actions})))?$`,
    ).test(path)
  )
    return true;
  if (
    method === "PATCH" &&
    new RegExp(`^${catalog}/listings/${id}/revisions/${id}$`).test(path)
  )
    return true;
  if (
    method === "GET" &&
    new RegExp(
      `^${catalog}/(?:filter-registry|filter-schemas|categories(?:/tree|/${id}(?:/(?:impact|active-filters|filter-sets(?:/${id}(?:/impact)?)?))?)?)$`,
    ).test(path)
  )
    return true;
  if (
    method === "POST" &&
    new RegExp(
      `^${catalog}/categories(?:/${id}/(?:move|actions/(?:review|draft|approve|activate|archive)|filter-sets(?:/${id}/(?:clone|preview|actions/(?:review|draft|approve|activate|archive)))?))?$`,
    ).test(path)
  )
    return true;
  if (
    method === "PATCH" &&
    new RegExp(`^${catalog}/categories/${id}(?:/filter-sets/${id})?$`).test(
      path,
    )
  )
    return true;
  const schema = `scopes/tenants/${id}/schema`;
  if (
    method === "GET" &&
    new RegExp(
      `^${schema}/(?:registry|attributes|option-sets(?:/${id})?|product-types(?:/${id}/versions(?:/${id}(?:/impact)?)?)?)$`,
    ).test(path)
  )
    return true;
  if (
    method === "POST" &&
    new RegExp(
      `^${schema}/(?:attributes|option-sets|product-types(?:/${id}/versions/${id}/(?:clone|actions/(?:review|draft|approve|activate|archive)))?)$`,
    ).test(path)
  )
    return true;
  if (
    method === "PATCH" &&
    new RegExp(
      `^${schema}/(?:attributes/${id}|option-sets/${id}|product-types/${id}/versions/${id})$`,
    ).test(path)
  )
    return true;
  if (method === "GET")
    return new RegExp(`^${scope}/(?:access|roles|permissions)$`).test(path);
  if (method === "POST")
    return new RegExp(
      `^${scope}/(?:roles|members/${id}/(?:roles|revoke))$`,
    ).test(path);
  if (method === "PATCH")
    return new RegExp(`^${scope}/roles/${id}$`).test(path);
  return false;
}
