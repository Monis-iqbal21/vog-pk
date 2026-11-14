import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyCheckout({ db, ids, owner, base, test, call, products }) {
  const origin = process.env.STOREFRONT_ORIGIN;
  const request = async (path, body, { status = 200, headers = {} } = {}) => {
    const response = await fetch(`${base}/api/catalog/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, status, `${path} returned ${response.status}: ${data.message ?? ''}`);
    return data;
  };
  const configResponse = await fetch(`${base}/api/catalog/checkout/config`), initialConfig = await configResponse.json();
  await test('Checkout is disabled by default and rejects orders without active payment settings', async () => {
    assert.equal(initialConfig.enabled, false);
    assert.deepEqual(initialConfig.paymentMethods, []);
    assert.ok(initialConfig.cities.includes('Karachi'));
    const denied = await request('orders', { idempotencyKey: randomUUID(), items: [{ listingId: products.single.l.listingId, skuCode: 'SF-SINGLE', quantity: 1 }], customerName: 'Test Customer', phone: '+923001234567', city: 'Karachi', address: '10 Test Road, Karachi', paymentMethod: 'COD' }, { status: 409 });
    assert.match(denied.message, /payment method/i);
    assert.equal(await db.storeOrder.count({ where: { storeId: ids.storeId } }), 0);
  });

  const settings = await call(`stores/${ids.storeId}/operations/checkout-settings`, {
    method: 'PATCH', body: { expectedRevision: 0, codEnabled: true, cardEnabled: false },
  });
  assert.equal(settings.codEnabled, true);
  await test('Card cannot be enabled without a gateway and storefront only receives safe COD settings', async () => {
    const denied = await call(`stores/${ids.storeId}/operations/checkout-settings`, { method: 'PATCH', body: { expectedRevision: settings.revision, codEnabled: true, cardEnabled: true }, status: 409 });
    assert.match(denied.message, /gateway/i);
    const safe = await fetch(`${base}/api/catalog/checkout/config`, { headers: { 'x-store-id': '00000000-0000-4000-8000-000000000001' } }).then((response) => response.json());
    assert.deepEqual(safe.paymentMethods.map((method) => method.code), ['COD']);
    assert.equal(safe.cardEnabled, undefined);
  });

  const line = { listingId: products.single.l.listingId, skuCode: 'SF-SINGLE', quantity: 2 };
  const couponCode = `SAVE${randomUUID().slice(0, 8).replaceAll('-', '').toUpperCase()}`;
  const coupon = await call(`stores/${ids.storeId}/operations/coupons`, {
    method: 'POST', status: 201,
    body: { code: couponCode, discountType: 'PERCENT', discountValue: '10', minimumOrder: '1500', currency: 'PKR', usageLimit: 1, startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), active: true },
  });
  await test('Store coupon CRUD is scoped, audited and validates the server quote with bounded usage', async () => {
    assert.equal(coupon.code, couponCode);
    assert.ok(await db.auditLog.findFirst({ where: { resourceId: coupon.id, action: 'operations.coupon_created', actorId: owner.id } }));
    const quote = await request('checkout/quote', { items: [line], couponCode });
    assert.equal(quote.subtotal, '2800');
    assert.equal(quote.discount, '280');
    assert.equal(quote.total, '2520');
    await request('checkout/quote', { items: [{ ...line, quantity: 1 }], couponCode }, { status: 409 });
    await request('checkout/quote', { items: [line], couponCode: 'NO-SUCH-COUPON' }, { status: 409 });
    const other = await db.store.findFirstOrThrow({ where: { tenantId: ids.tenantId, id: { not: ids.storeId } } });
    const foreign = await call(`stores/${other.id}/operations/coupons?page=1&pageSize=25`, { status: 403 });
    assert.equal(foreign.message, 'Access denied.');
  });
  const fixtureStock = await db.stockBalance.aggregate({ where: { storeId: ids.storeId, item: { sku: { code: 'SF-SINGLE' } }, location: { active: true } }, _sum: { onHand: true } });
  const overStockQuantity = (fixtureStock._sum.onHand ?? 0) + 1;
  assert.ok(overStockQuantity <= 50, 'Checkout test fixture stock must remain below the public quantity limit.');
  await test('Checkout rejects forged store scope, client prices, invalid SKU variants and unavailable stock', async () => {
    await request('orders', { idempotencyKey: randomUUID(), storeId: ids.storeId, items: [line], customerName: 'Test Customer', phone: '+923001234567', city: 'Karachi', address: '10 Test Road, Karachi', paymentMethod: 'COD' }, { status: 400 });
    await request('orders', { idempotencyKey: randomUUID(), items: [{ ...line, unitPrice: '1' }], customerName: 'Test Customer', phone: '+923001234567', city: 'Karachi', address: '10 Test Road, Karachi', paymentMethod: 'COD' }, { status: 400 });
    await request('checkout/quote', { items: [{ ...line, skuCode: 'INVALID-SKU' }] }, { status: 400 });
    await request('checkout/quote', { items: [{ ...line, quantity: overStockQuantity }] }, { status: 409 });
  });

  const beforeStock = await db.stockBalance.findMany({ where: { storeId: ids.storeId, item: { sku: { code: 'SF-SINGLE' } } }, select: { id: true, onHand: true, revision: true } });
  const orderInput = { idempotencyKey: randomUUID(), items: [line], couponCode, customerName: 'Test Customer', phone: '+923001234567', city: 'Karachi', address: '10 Test Road, Karachi', paymentMethod: 'COD' };
  const placed = await request('orders', orderInput, { status: 201 });
  await test('Order creation recalculates price, snapshots lines, reserves stock and keeps COD unpaid', async () => {
    assert.match(placed.orderNumber, /^VOG-\d{6}-[A-F0-9]{20}$/);
    assert.equal(placed.receipt.paymentStatus, 'PENDING');
    assert.equal(placed.receipt.paymentMethod, 'COD');
    assert.equal(placed.receipt.items.length, 1);
    assert.equal(placed.receipt.items[0].skuCode, 'SF-SINGLE');
    assert.equal(placed.receipt.items[0].variantName, 'Default variant');
    assert.equal(placed.receipt.items[0].quantity, 2);
    assert.equal(placed.receipt.items[0].unitPrice, '1400');
    assert.equal(placed.receipt.couponCode, couponCode);
    assert.equal(placed.receipt.discount, '280');
    assert.equal(placed.receipt.total, '2520');
    const afterStock = await db.stockBalance.findMany({ where: { storeId: ids.storeId, item: { sku: { code: 'SF-SINGLE' } } }, select: { id: true, onHand: true, revision: true } });
    assert.equal(beforeStock.reduce((sum, item) => sum + item.onHand, 0) - afterStock.reduce((sum, item) => sum + item.onHand, 0), 2);
    assert.ok(afterStock.some((item) => item.revision > (beforeStock.find((before) => before.id === item.id)?.revision ?? -1)));
    assert.equal(await db.inventoryMovement.count({ where: { storeId: ids.storeId, reason: { contains: placed.orderNumber } } }), 1);
    assert.equal(await db.storeOrder.count({ where: { storeId: ids.storeId } }), 1);
  });

  await test('Repeated idempotency key returns the original order without a second stock deduction; mismatched reuse conflicts', async () => {
    const repeat = await request('orders', orderInput, { status: 201 });
    assert.equal(repeat.orderNumber, placed.orderNumber);
    assert.equal(repeat.replayed, true);
    assert.equal(await db.storeOrder.count({ where: { storeId: ids.storeId } }), 1);
    const mismatch = await request('orders', { ...orderInput, customerName: 'Changed Customer' }, { status: 409 });
    assert.match(mismatch.message, /different order/i);
  });

  await test('Receipt requires an opaque access token and returns only the matching store order', async () => {
    await request('orders/receipt', { orderNumber: placed.orderNumber, receiptToken: randomUUID() }, { status: 404 });
    const receipt = await request('orders/receipt', { orderNumber: placed.orderNumber, receiptToken: orderInput.idempotencyKey });
    assert.equal(receipt.orderNumber, placed.orderNumber);
    assert.equal(receipt.phone, '+923001234567');
  });

  await test('Cross-store checkout cannot be selected through body fields or caller-controlled scope headers', async () => {
    const response = await fetch(`${base}/api/catalog/checkout/config`, { headers: { 'x-store-id': '00000000-0000-4000-8000-000000000001', 'x-tenant-id': '00000000-0000-4000-8000-000000000002' } });
    const other = await response.json();
    assert.deepEqual(other.paymentMethods, ['COD'].map((code) => ({ code, label: 'Cash on Delivery' })));
    assert.equal(await db.storeOrder.count({ where: { tenantId: ids.tenantId, storeId: { not: ids.storeId } } }), 0);
  });
  await test('Coupon usage is consumed once, order management is store-scoped, audited and cancellation releases its reserved stock', async () => {
    assert.equal((await db.storeCoupon.findUniqueOrThrow({ where: { id: coupon.id } })).usageCount, 1);
    await request('checkout/quote', { items: [line], couponCode }, { status: 409 });
    const orderId = (await db.storeOrder.findFirstOrThrow({ where: { storeId: ids.storeId, orderNumber: placed.orderNumber } })).id;
    const listed = await call(`stores/${ids.storeId}/operations/orders?page=1&pageSize=20`);
    assert.equal(listed.rows.some((row) => row.id === orderId), true);
    assert.equal(listed.rows[0].phone, undefined);
    assert.equal(listed.rows[0].address, undefined);
    const details = await call(`stores/${ids.storeId}/operations/orders/${orderId}`);
    assert.equal(details.paymentStatus, 'PENDING');
    assert.equal(details.paymentMethod, 'COD');
    assert.equal((await call(`stores/${ids.storeId}/operations/orders/${orderId}/status`, { method: 'PATCH', status: 409, body: { expectedRevision: details.revision, status: 'DELIVERED' } })).message, 'This order status transition is not allowed.');
    const changed = await call(`stores/${ids.storeId}/operations/orders/${orderId}/status`, { method: 'PATCH', status: 200, body: { expectedRevision: details.revision, status: 'CANCELLED' } });
    assert.equal(changed.status, 'CANCELLED');
    assert.equal(changed.paymentStatus, 'PENDING');
    const restored = await db.stockBalance.findMany({ where: { storeId: ids.storeId, item: { sku: { code: 'SF-SINGLE' } } }, select: { onHand: true } });
    assert.equal(restored.reduce((sum, item) => sum + item.onHand, 0), beforeStock.reduce((sum, item) => sum + item.onHand, 0));
    assert.ok(await db.auditLog.findFirst({ where: { resourceId: orderId, action: 'operations.order_status_changed', actorId: owner.id } }));
    const other = await db.store.findFirstOrThrow({ where: { tenantId: ids.tenantId, id: { not: ids.storeId } } });
    const foreignList = await call(`stores/${other.id}/operations/orders?page=1&pageSize=20`, { status: 403 });
    assert.equal(foreignList.message, 'Access denied.');
    await call(`stores/${other.id}/operations/orders/${orderId}`, { status: 403 });
    const edited = await call(`stores/${ids.storeId}/operations/coupons/${coupon.id}`, { method: 'PATCH', body: { expectedRevision: coupon.revision, code: couponCode, discountType: 'PERCENT', discountValue: '12', minimumOrder: '1500', currency: 'PKR', usageLimit: 1, startsAt: coupon.startsAt, endsAt: coupon.endsAt, active: false } });
    assert.equal(edited.revision, coupon.revision + 1);
    const archived = await call(`stores/${ids.storeId}/operations/coupons/${coupon.id}/archive`, { method: 'POST', body: { revision: edited.revision } });
    assert.equal(archived.archived, true);
    assert.ok(await db.auditLog.findFirst({ where: { resourceId: coupon.id, action: 'operations.coupon_archived', actorId: owner.id } }));
  });
}
