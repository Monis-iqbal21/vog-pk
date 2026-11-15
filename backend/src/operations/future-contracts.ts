// Interfaces only. No cart reservation, stock deduction or checkout provider is
// registered or callable in Milestone 5.
export interface FutureReservationPort {
  reserve(request: {
    tenantId: string;
    storeId: string;
    skuId: string;
    locationId: string;
    quantity: number;
    expectedBalanceRevision: number;
    idempotencyKey: string;
    expiresAt: Date;
  }): Promise<{ reservationId: string; quantity: number; expiresAt: Date }>;
  release(request: {
    storeId: string;
    reservationId: string;
    idempotencyKey: string;
  }): Promise<void>;
  commit(request: {
    storeId: string;
    reservationId: string;
    orderId: string;
    idempotencyKey: string;
  }): Promise<void>;
}
export const CHECKOUT_ENABLED = false;
