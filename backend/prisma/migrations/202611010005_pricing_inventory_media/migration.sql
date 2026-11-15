-- CreateEnum
CREATE TYPE "InventoryPolicy" AS ENUM ('QUANTITY', 'SERIALIZED', 'NON_STOCK', 'UNTRACKED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "timeZone" VARCHAR(80) NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "altText" VARCHAR(500) NOT NULL DEFAULT '',
ADD COLUMN     "byteSize" INTEGER,
ADD COLUMN     "caption" VARCHAR(500),
ADD COLUMN     "derivatives" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "developmentOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "intendedPurpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY',
ADD COLUMN     "publicUse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "storageProvider" VARCHAR(32) NOT NULL DEFAULT 'REFERENCE',
ADD COLUMN     "uploadHash" CHAR(64),
ADD COLUMN     "uploadKey" UUID;

-- CreateTable
CREATE TABLE "StorePrice" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "publishedRevisionId" UUID,

    CONSTRAINT "StorePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRevision" (
    "id" UUID NOT NULL,
    "priceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "CatalogState" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL,
    "regularAmount" DECIMAL(24,6) NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" UUID,

    CONSTRAINT "PriceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricePromotion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "priceRevisionId" UUID NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" VARCHAR(120) NOT NULL,

    CONSTRAINT "PricePromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceApproval" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "priceRevisionId" UUID NOT NULL,
    "approvedRevision" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "policy" "InventoryPolicy" NOT NULL DEFAULT 'UNTRACKED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "lowStockThreshold" INTEGER,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "known" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "balanceId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "mode" VARCHAR(12) NOT NULL,
    "beforeQuantity" INTEGER NOT NULL,
    "afterQuantity" INTEGER NOT NULL,
    "beforeKnown" BOOLEAN NOT NULL,
    "afterKnown" BOOLEAN NOT NULL,
    "balanceRevision" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaApproval" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "approvedRevision" INTEGER NOT NULL,
    "actorId" UUID NOT NULL,
    "license" VARCHAR(500) NOT NULL,
    "attribution" VARCHAR(500) NOT NULL,
    "publicUse" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorePrice_id_storeId_tenantId_key" ON "StorePrice"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StorePrice_storeId_skuId_key" ON "StorePrice"("storeId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRevision_id_priceId_storeId_tenantId_key" ON "PriceRevision"("id", "priceId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRevision_id_storeId_tenantId_key" ON "PriceRevision"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceRevision_priceId_number_key" ON "PriceRevision"("priceId", "number");

-- CreateIndex
CREATE INDEX "PricePromotion_priceRevisionId_startsAt_idx" ON "PricePromotion"("priceRevisionId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceApproval_priceRevisionId_approvedRevision_key" ON "PriceApproval"("priceRevisionId", "approvedRevision");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_id_storeId_tenantId_key" ON "InventoryLocation"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_storeId_code_key" ON "InventoryLocation"("storeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_id_storeId_tenantId_key" ON "InventoryItem"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_storeId_skuId_key" ON "InventoryItem"("storeId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_id_storeId_tenantId_key" ON "StockBalance"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_id_inventoryItemId_storeId_tenantId_key" ON "StockBalance"("id", "inventoryItemId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_inventoryItemId_locationId_key" ON "StockBalance"("inventoryItemId", "locationId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_createdAt_idx" ON "InventoryMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_storeId_idempotencyKey_key" ON "InventoryMovement"("storeId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_balanceId_balanceRevision_key" ON "InventoryMovement"("balanceId", "balanceRevision");

-- CreateIndex
CREATE UNIQUE INDEX "MediaApproval_assetId_approvedRevision_key" ON "MediaApproval"("assetId", "approvedRevision");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_tenantId_uploadKey_key" ON "MediaAsset"("tenantId", "uploadKey");

-- AddForeignKey
ALTER TABLE "StorePrice" ADD CONSTRAINT "StorePrice_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePrice" ADD CONSTRAINT "StorePrice_skuId_productId_tenantId_fkey" FOREIGN KEY ("skuId", "productId", "tenantId") REFERENCES "SKU"("id", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePrice" ADD CONSTRAINT "StorePrice_publishedRevisionId_id_storeId_tenantId_fkey" FOREIGN KEY ("publishedRevisionId", "id", "storeId", "tenantId") REFERENCES "PriceRevision"("id", "priceId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRevision" ADD CONSTRAINT "PriceRevision_priceId_storeId_tenantId_fkey" FOREIGN KEY ("priceId", "storeId", "tenantId") REFERENCES "StorePrice"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricePromotion" ADD CONSTRAINT "PricePromotion_priceRevisionId_storeId_tenantId_fkey" FOREIGN KEY ("priceRevisionId", "storeId", "tenantId") REFERENCES "PriceRevision"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceApproval" ADD CONSTRAINT "PriceApproval_priceRevisionId_storeId_tenantId_fkey" FOREIGN KEY ("priceRevisionId", "storeId", "tenantId") REFERENCES "PriceRevision"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_skuId_productId_tenantId_fkey" FOREIGN KEY ("skuId", "productId", "tenantId") REFERENCES "SKU"("id", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_inventoryItemId_storeId_tenantId_fkey" FOREIGN KEY ("inventoryItemId", "storeId", "tenantId") REFERENCES "InventoryItem"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_storeId_tenantId_fkey" FOREIGN KEY ("locationId", "storeId", "tenantId") REFERENCES "InventoryLocation"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_storeId_tenantId_fkey" FOREIGN KEY ("inventoryItemId", "storeId", "tenantId") REFERENCES "InventoryItem"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_balanceId_inventoryItemId_storeId_tenant_fkey" FOREIGN KEY ("balanceId", "inventoryItemId", "storeId", "tenantId") REFERENCES "StockBalance"("id", "inventoryItemId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaApproval" ADD CONSTRAINT "MediaApproval_assetId_tenantId_fkey" FOREIGN KEY ("assetId", "tenantId") REFERENCES "MediaAsset"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Operational records are independent from catalog revisions.
CREATE UNIQUE INDEX price_one_draft ON "PriceRevision"("priceId") WHERE status='DRAFT';
CREATE UNIQUE INDEX price_one_published ON "PriceRevision"("priceId") WHERE status='PUBLISHED';
CREATE UNIQUE INDEX inventory_default_location ON "InventoryLocation"("storeId") WHERE "isDefault";
ALTER TABLE "PriceRevision" ADD CONSTRAINT price_money_window CHECK ("regularAmount">=0 AND currency~'^[A-Z]{3}$' AND ("validFrom" IS NULL OR "validUntil" IS NULL OR "validFrom"<"validUntil"));
ALTER TABLE "PricePromotion" ADD CONSTRAINT promotion_amount_window CHECK (amount>=0 AND "startsAt"<"endsAt");
ALTER TABLE "StockBalance" ADD CONSTRAINT nonnegative_stock CHECK ("onHand" BETWEEN 0 AND 1000000000 AND revision>=0 AND (revision>0 OR (NOT known AND "onHand"=0)));
ALTER TABLE "InventoryItem" ADD CONSTRAINT inventory_threshold CHECK ("lowStockThreshold" IS NULL OR "lowStockThreshold" BETWEEN 0 AND 1000000000);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT movement_shape CHECK (mode IN ('COUNT','DELTA','INVALIDATE') AND "beforeQuantity">=0 AND "afterQuantity" BETWEEN 0 AND 1000000000 AND ((mode='INVALIDATE' AND NOT "afterKnown" AND "beforeQuantity"="afterQuantity") OR (mode<>'INVALIDATE' AND "afterKnown")) AND "balanceRevision">0 AND length(reason)>=3);
ALTER TABLE "MediaAsset" ADD CONSTRAINT asset_state_shape CHECK (revision>0 AND ("byteSize" IS NULL OR "byteSize" BETWEEN 1 AND 6291456) AND NOT ("developmentOnly" AND "publicUse") AND (NOT "publicUse" OR rights='APPROVED'));

CREATE FUNCTION guard_price_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Operational price identity is retained' USING ERRCODE='23514';END IF;
 IF to_jsonb(NEW)-ARRAY['revision','publishedRevisionId'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['revision','publishedRevisionId'] THEN RAISE EXCEPTION 'Price ownership is immutable' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER price_identity BEFORE UPDATE OR DELETE ON "StorePrice" FOR EACH ROW EXECUTE FUNCTION guard_price_identity();
CREATE FUNCTION guard_price_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Price history is retained' USING ERRCODE='23514';END IF;
 IF NEW.id<>OLD.id OR NEW."priceId"<>OLD."priceId" OR NEW."storeId"<>OLD."storeId" OR NEW."tenantId"<>OLD."tenantId" OR NEW.number<>OLD.number OR NEW."createdBy"<>OLD."createdBy" OR NEW."createdAt"<>OLD."createdAt" THEN RAISE EXCEPTION 'Price revision ownership is immutable' USING ERRCODE='23514';END IF;
 IF OLD.status<>'DRAFT' AND to_jsonb(NEW)-ARRAY['status','revision','approvedAt','approvedBy','publishedAt','publishedBy'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','revision','approvedAt','approvedBy','publishedAt','publishedBy'] THEN RAISE EXCEPTION 'Reviewed prices are immutable' USING ERRCODE='23514';END IF;
 IF OLD."approvedAt" IS NOT NULL AND (NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt" OR NEW."approvedBy" IS DISTINCT FROM OLD."approvedBy") THEN RAISE EXCEPTION 'Price approval evidence is immutable' USING ERRCODE='23514';END IF;
 IF OLD."publishedAt" IS NOT NULL AND (NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" OR NEW."publishedBy" IS DISTINCT FROM OLD."publishedBy") THEN RAISE EXCEPTION 'Price publication evidence is immutable' USING ERRCODE='23514';END IF;
 IF NEW.status<>OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status IN ('IN_REVIEW','ARCHIVED')) OR (OLD.status='IN_REVIEW' AND NEW.status IN ('DRAFT','APPROVED','ARCHIVED')) OR (OLD.status='APPROVED' AND NEW.status IN ('PUBLISHED','ARCHIVED')) OR (OLD.status='PUBLISHED' AND NEW.status='ARCHIVED')) THEN RAISE EXCEPTION 'Invalid price transition' USING ERRCODE='23514';END IF;
 IF NEW.status IN ('APPROVED','PUBLISHED') AND (NEW."approvedAt" IS NULL OR NEW."approvedBy" IS NULL OR NOT EXISTS(SELECT 1 FROM "PriceApproval" a WHERE a."priceRevisionId"=NEW.id AND a."actorId"=NEW."approvedBy")) THEN RAISE EXCEPTION 'Price approval required' USING ERRCODE='23514';END IF;
 IF NEW.status='PUBLISHED' AND (NEW."publishedAt" IS NULL OR NEW."publishedBy" IS NULL) THEN RAISE EXCEPTION 'Price publication evidence required' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER price_revision BEFORE UPDATE OR DELETE ON "PriceRevision" FOR EACH ROW EXECUTE FUNCTION guard_price_revision();
CREATE FUNCTION guard_promotion() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE p "PriceRevision"; d jsonb;BEGIN
 FOR d IN SELECT value FROM jsonb_array_elements(CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END) LOOP
 SELECT * INTO p FROM "PriceRevision" WHERE id=(d->>'priceRevisionId')::uuid AND "storeId"=(d->>'storeId')::uuid AND "tenantId"=(d->>'tenantId')::uuid FOR UPDATE;
 IF p.status IS DISTINCT FROM 'DRAFT'::"CatalogState" THEN RAISE EXCEPTION 'Only draft price promotions may change' USING ERRCODE='23514';END IF;END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF NEW.amount>=p."regularAmount" OR (p."validFrom" IS NOT NULL AND NEW."startsAt"<p."validFrom") OR (p."validUntil" IS NOT NULL AND NEW."endsAt">p."validUntil") OR EXISTS(SELECT 1 FROM "PricePromotion" s WHERE s."priceRevisionId"=NEW."priceRevisionId" AND s.id<>NEW.id AND tsrange(s."startsAt",s."endsAt",'[)')&&tsrange(NEW."startsAt",NEW."endsAt",'[)')) THEN RAISE EXCEPTION 'Invalid or overlapping discount' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER price_promotion BEFORE INSERT OR UPDATE OR DELETE ON "PricePromotion" FOR EACH ROW EXECUTE FUNCTION guard_promotion();
CREATE FUNCTION check_price_pointer() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE root_id uuid;pointer uuid;current_id uuid;n bigint;BEGIN
 IF TG_TABLE_NAME='StorePrice' THEN root_id:=NEW.id; ELSE root_id:=NEW."priceId"; END IF;
 SELECT "publishedRevisionId" INTO pointer FROM "StorePrice" WHERE id=root_id;SELECT count(*) INTO n FROM "PriceRevision" WHERE "priceId"=root_id AND status='PUBLISHED';SELECT id INTO current_id FROM "PriceRevision" WHERE "priceId"=root_id AND status='PUBLISHED';
 IF (n=0 AND pointer IS NOT NULL) OR (n=1 AND pointer IS DISTINCT FROM current_id) THEN RAISE EXCEPTION 'Price publication pointer mismatch' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER price_pointer AFTER INSERT OR UPDATE ON "StorePrice" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_price_pointer();
CREATE CONSTRAINT TRIGGER price_revision_pointer AFTER INSERT OR UPDATE ON "PriceRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_price_pointer();

CREATE FUNCTION retain_operational_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Operational evidence is append-only' USING ERRCODE='23514';END $$;
CREATE TRIGGER price_approval_retained BEFORE UPDATE OR DELETE ON "PriceApproval" FOR EACH ROW EXECUTE FUNCTION retain_operational_evidence();
CREATE TRIGGER movement_retained BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION retain_operational_evidence();
CREATE TRIGGER media_approval_retained BEFORE UPDATE OR DELETE ON "MediaApproval" FOR EACH ROW EXECUTE FUNCTION retain_operational_evidence();
CREATE FUNCTION guard_stock_balance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Stock balances are retained' USING ERRCODE='23514';END IF;
 IF to_jsonb(NEW)-ARRAY['onHand','known','revision','updatedAt'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['onHand','known','revision','updatedAt'] THEN RAISE EXCEPTION 'Stock ownership is immutable' USING ERRCODE='23514';END IF;
 IF (NEW."onHand"<>OLD."onHand" OR NEW.known<>OLD.known OR NEW.revision<>OLD.revision) AND NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Stock revision must advance exactly once' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER stock_balance_guard BEFORE UPDATE OR DELETE ON "StockBalance" FOR EACH ROW EXECUTE FUNCTION guard_stock_balance();
CREATE FUNCTION check_stock_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.revision>0 AND NOT EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."balanceId"=NEW.id AND m."balanceRevision"=NEW.revision AND m."afterQuantity"=NEW."onHand" AND m."afterKnown"=NEW.known) THEN RAISE EXCEPTION 'Every stock revision requires its movement' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER stock_ledger AFTER INSERT OR UPDATE ON "StockBalance" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_stock_ledger();
CREATE FUNCTION guard_inventory_movement() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE b "StockBalance"; p "InventoryMovement";BEGIN
 SELECT * INTO b FROM "StockBalance" WHERE id=NEW."balanceId" FOR UPDATE;
 IF b.revision<>NEW."balanceRevision" OR b."onHand"<>NEW."afterQuantity" OR b.known<>NEW."afterKnown" THEN RAISE EXCEPTION 'Movement must describe the current balance revision' USING ERRCODE='23514';END IF;
 SELECT * INTO p FROM "InventoryMovement" WHERE "balanceId"=NEW."balanceId" ORDER BY "balanceRevision" DESC LIMIT 1;
 IF p.id IS NULL THEN IF NEW."balanceRevision"<>1 OR NEW."beforeQuantity"<>0 OR NEW."beforeKnown" THEN RAISE EXCEPTION 'Initial movement must start from unknown zero' USING ERRCODE='23514';END IF;
 ELSE IF p."balanceRevision"+1<>NEW."balanceRevision" OR p."afterQuantity"<>NEW."beforeQuantity" OR p."afterKnown"<>NEW."beforeKnown" THEN RAISE EXCEPTION 'Movement chain mismatch' USING ERRCODE='23514';END IF;END IF;RETURN NEW;END $$;
CREATE TRIGGER inventory_movement_guard BEFORE INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION guard_inventory_movement();
CREATE FUNCTION guard_inventory_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Inventory identities are retained' USING ERRCODE='23514';END IF;
 IF to_jsonb(NEW)-ARRAY['policy','revision','lowStockThreshold'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['policy','revision','lowStockThreshold'] OR (NEW.policy<>OLD.policy AND EXISTS(SELECT 1 FROM "InventoryMovement" m WHERE m."inventoryItemId"=OLD.id)) THEN RAISE EXCEPTION 'Inventory identity or used policy cannot be rewritten' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER inventory_identity BEFORE UPDATE OR DELETE ON "InventoryItem" FOR EACH ROW EXECUTE FUNCTION guard_inventory_identity();
CREATE FUNCTION guard_managed_asset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.archived AND NOT NEW.archived THEN RAISE EXCEPTION 'Asset archival is irreversible' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM "MediaApproval" a WHERE a."assetId"=OLD.id) AND to_jsonb(NEW)-ARRAY['archived','revision'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['archived','revision'] THEN RAISE EXCEPTION 'Approved media must be replaced, never overwritten' USING ERRCODE='23514';END IF;
 IF NEW.archived AND NOT OLD.archived AND (EXISTS(SELECT 1 FROM "ProductRevisionMedia" m JOIN "ProductRevision" r ON r.id=m."productRevisionId" WHERE m."assetId"=OLD.id AND r.status<>'DRAFT') OR EXISTS(SELECT 1 FROM "SKURevisionMedia" m JOIN "SKURevision" s ON s.id=m."skuRevisionId" JOIN "ProductRevision" r ON r.id=s."productRevisionId" WHERE m."assetId"=OLD.id AND r.status<>'DRAFT')) THEN RAISE EXCEPTION 'Reviewed media references must remain available' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER managed_asset_guard BEFORE UPDATE ON "MediaAsset" FOR EACH ROW EXECUTE FUNCTION guard_managed_asset();

ALTER TABLE "MediaAsset" ADD COLUMN "storedBytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MediaAsset" ADD CONSTRAINT media_stored_bytes CHECK ("storedBytes">=0);
