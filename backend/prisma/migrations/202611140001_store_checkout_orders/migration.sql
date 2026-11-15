-- Checkout MVP. All prices and order lines are server generated.
CREATE TYPE "CheckoutPaymentMethod" AS ENUM ('COD', 'CARD');
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "StoreOrderStatus" AS ENUM ('RECEIVED', 'CANCELLED');

-- Customer-originated stock changes have no admin actor. The immutable
-- inventory movement ledger still records the order as its reason/idempotency.
ALTER TABLE "InventoryMovement" ALTER COLUMN "actorId" DROP NOT NULL;

CREATE TABLE "StoreCheckoutSettings" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "codEnabled" BOOLEAN NOT NULL DEFAULT false,
  "cardEnabled" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" UUID NOT NULL,
  CONSTRAINT "StoreCheckoutSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCheckoutSettings_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "StoreCheckoutSettings_card_unavailable" CHECK (NOT "cardEnabled"),
  CONSTRAINT "StoreCheckoutSettings_storeId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreCheckoutSettings_storeId_key" ON "StoreCheckoutSettings"("storeId");
CREATE UNIQUE INDEX "StoreCheckoutSettings_id_storeId_tenantId_key" ON "StoreCheckoutSettings"("id", "storeId", "tenantId");
CREATE UNIQUE INDEX "StoreCheckoutSettings_storeId_tenantId_key" ON "StoreCheckoutSettings"("storeId", "tenantId");

CREATE TABLE "StoreOrder" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "orderNumber" VARCHAR(40) NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "receiptTokenHash" CHAR(64) NOT NULL,
  "customerName" VARCHAR(120) NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "city" VARCHAR(80) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "paymentMethod" "CheckoutPaymentMethod" NOT NULL,
  "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "status" "StoreOrderStatus" NOT NULL DEFAULT 'RECEIVED',
  "currency" VARCHAR(3) NOT NULL,
  "subtotal" DECIMAL(24,6) NOT NULL,
  "total" DECIMAL(24,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreOrder_totals_check" CHECK ("subtotal" >= 0 AND "total" = "subtotal"),
  CONSTRAINT "StoreOrder_customer_check" CHECK (length("customerName") > 0 AND length("phone") > 0 AND length("address") > 0),
  CONSTRAINT "StoreOrder_storeId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreOrder_id_storeId_tenantId_key" ON "StoreOrder"("id", "storeId", "tenantId");
CREATE UNIQUE INDEX "StoreOrder_storeId_orderNumber_key" ON "StoreOrder"("storeId", "orderNumber");
CREATE UNIQUE INDEX "StoreOrder_storeId_idempotencyKey_key" ON "StoreOrder"("storeId", "idempotencyKey");
CREATE INDEX "StoreOrder_tenantId_storeId_createdAt_idx" ON "StoreOrder"("tenantId", "storeId", "createdAt");

CREATE TABLE "StoreOrderItem" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "listingRevisionId" UUID NOT NULL,
  "skuRevisionId" UUID NOT NULL,
  "productName" VARCHAR(120) NOT NULL,
  "variantName" VARCHAR(200) NOT NULL,
  "skuCode" VARCHAR(80) NOT NULL,
  "selections" JSONB NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(24,6) NOT NULL,
  "lineTotal" DECIMAL(24,6) NOT NULL,
  CONSTRAINT "StoreOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreOrderItem_quantity_price_check" CHECK ("quantity" BETWEEN 1 AND 50 AND "unitPrice" >= 0 AND "lineTotal" = "unitPrice" * "quantity"),
  CONSTRAINT "StoreOrderItem_orderId_storeId_tenantId_fkey" FOREIGN KEY ("orderId", "storeId", "tenantId") REFERENCES "StoreOrder"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StoreOrderItem_orderId_storeId_tenantId_idx" ON "StoreOrderItem"("orderId", "storeId", "tenantId");
