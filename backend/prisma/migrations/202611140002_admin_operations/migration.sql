ALTER TYPE "StoreOrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "StoreOrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "StoreOrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "StoreOrderStatus" ADD VALUE 'DELIVERED';
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');
ALTER TABLE "Store" ADD COLUMN "settingsRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "StoreOrder"
  ADD COLUMN "discount" DECIMAL(24,6) NOT NULL DEFAULT 0,
  ADD COLUMN "couponId" UUID,
  ADD COLUMN "couponCode" VARCHAR(40),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StoreOrder" DROP CONSTRAINT "StoreOrder_totals_check";
ALTER TABLE "StoreOrderItem" ADD COLUMN "inventoryReservation" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE "StoreHomepage" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" UUID NOT NULL,
  CONSTRAINT "StoreHomepage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreHomepage_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "StoreHomepage_storeId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreHomepage_storeId_key" ON "StoreHomepage"("storeId");
CREATE UNIQUE INDEX "StoreHomepage_id_storeId_tenantId_key" ON "StoreHomepage"("id", "storeId", "tenantId");
CREATE UNIQUE INDEX "StoreHomepage_storeId_tenantId_key" ON "StoreHomepage"("storeId", "tenantId");

CREATE TABLE "StoreHomepageRevision" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "homepageId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "status" "CatalogState" NOT NULL DEFAULT 'DRAFT',
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "publishedBy" UUID,
  CONSTRAINT "StoreHomepageRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreHomepageRevision_number_check" CHECK ("number" > 0),
  CONSTRAINT "StoreHomepageRevision_homepageId_fkey" FOREIGN KEY ("homepageId", "storeId", "tenantId") REFERENCES "StoreHomepage"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreHomepageRevision_id_storeId_tenantId_key" ON "StoreHomepageRevision"("id", "storeId", "tenantId");
CREATE UNIQUE INDEX "StoreHomepageRevision_homepageId_number_key" ON "StoreHomepageRevision"("homepageId", "number");
CREATE INDEX "StoreHomepageRevision_storeId_status_createdAt_idx" ON "StoreHomepageRevision"("storeId", "status", "createdAt");

CREATE TABLE "StoreCoupon" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "discountType" "CouponDiscountType" NOT NULL,
  "discountValue" DECIMAL(24,6) NOT NULL,
  "minimumOrder" DECIMAL(24,6) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL,
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" UUID NOT NULL,
  "updatedBy" UUID NOT NULL,
  CONSTRAINT "StoreCoupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCoupon_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "StoreCoupon_value_check" CHECK ("discountValue" > 0 AND "minimumOrder" >= 0),
  CONSTRAINT "StoreCoupon_usage_check" CHECK ("usageLimit" IS NULL OR "usageLimit" > 0),
  CONSTRAINT "StoreCoupon_period_check" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "StoreCoupon_count_check" CHECK ("usageCount" >= 0 AND ("usageLimit" IS NULL OR "usageCount" <= "usageLimit")),
  CONSTRAINT "StoreCoupon_storeId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreCoupon_id_storeId_tenantId_key" ON "StoreCoupon"("id", "storeId", "tenantId");
CREATE UNIQUE INDEX "StoreCoupon_storeId_code_key" ON "StoreCoupon"("storeId", "code");
CREATE INDEX "StoreCoupon_storeId_active_archived_startsAt_endsAt_idx" ON "StoreCoupon"("storeId", "active", "archived", "startsAt", "endsAt");
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_couponId_storeId_tenantId_fkey" FOREIGN KEY ("couponId", "storeId", "tenantId") REFERENCES "StoreCoupon"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_discount_check" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "discount" <= "subtotal" AND "total" = "subtotal" - "discount");

CREATE TABLE "CouponRedemption" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "couponId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemption_couponId_storeId_tenantId_fkey" FOREIGN KEY ("couponId", "storeId", "tenantId") REFERENCES "StoreCoupon"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CouponRedemption_orderId_storeId_tenantId_fkey" FOREIGN KEY ("orderId", "storeId", "tenantId") REFERENCES "StoreOrder"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE UNIQUE INDEX "CouponRedemption_id_storeId_tenantId_key" ON "CouponRedemption"("id", "storeId", "tenantId");
CREATE UNIQUE INDEX "CouponRedemption_orderId_storeId_tenantId_key" ON "CouponRedemption"("orderId", "storeId", "tenantId");
CREATE INDEX "CouponRedemption_couponId_storeId_tenantId_createdAt_idx" ON "CouponRedemption"("couponId", "storeId", "tenantId", "createdAt");
