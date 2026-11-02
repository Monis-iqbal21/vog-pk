ALTER TABLE "Store" ADD COLUMN "locale" VARCHAR(35) NOT NULL DEFAULT 'en-PK';
ALTER TABLE "ListingRevision" ADD COLUMN "catalogOrder" INTEGER;
ALTER TABLE "ListingRevision" ADD CONSTRAINT "listing_catalog_order" CHECK ("catalogOrder" BETWEEN 0 AND 100000);
CREATE TABLE "CatalogImportRecord" (
 id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "storeId" UUID NOT NULL,
 kind VARCHAR(16) NOT NULL CHECK (kind IN ('PRODUCT','CATEGORY')),
 "sourceKey" VARCHAR(160) NOT NULL, "sourceHash" CHAR(64) NOT NULL CHECK ("sourceHash" ~ '^[a-f0-9]{64}$'),
 "manifestHash" CHAR(64) NOT NULL CHECK ("manifestHash" ~ '^[a-f0-9]{64}$'),
 source JSONB NOT NULL, mapping JSONB NOT NULL DEFAULT '{}', complete BOOLEAN NOT NULL DEFAULT false,
 "listingId" UUID, "categoryId" UUID, "referenceAmount" DECIMAL(24,6),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
 CONSTRAINT import_store FOREIGN KEY ("storeId","tenantId") REFERENCES "Store"(id,"tenantId") ON DELETE RESTRICT,
 CONSTRAINT import_listing FOREIGN KEY ("listingId","storeId","tenantId") REFERENCES "StoreListing"(id,"storeId","tenantId") ON DELETE RESTRICT,
 CONSTRAINT import_category FOREIGN KEY ("categoryId","storeId","tenantId") REFERENCES "Category"(id,"storeId","tenantId") ON DELETE RESTRICT,
 CONSTRAINT import_kind CHECK ((kind='PRODUCT' AND "categoryId" IS NULL) OR (kind='CATEGORY' AND "listingId" IS NULL AND "referenceAmount" IS NULL)),
 CONSTRAINT import_complete CHECK (NOT complete OR (kind='PRODUCT' AND "listingId" IS NOT NULL) OR (kind='CATEGORY' AND "categoryId" IS NOT NULL)),
 CONSTRAINT import_reference CHECK ("referenceAmount" IS NULL OR "referenceAmount">=0)
);
CREATE UNIQUE INDEX "CatalogImportRecord_storeId_kind_sourceKey_key" ON "CatalogImportRecord"("storeId",kind,"sourceKey");
CREATE INDEX "CatalogImportRecord_listingId_storeId_tenantId_idx" ON "CatalogImportRecord"("listingId","storeId","tenantId");
CREATE FUNCTION guard_catalog_import_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Import evidence is retained'; END IF;
 IF to_jsonb(NEW)-ARRAY['mapping','complete','listingId','categoryId'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['mapping','complete','listingId','categoryId'] OR OLD.complete THEN RAISE EXCEPTION 'Source evidence and completed mapping are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER catalog_import_evidence_guard BEFORE UPDATE OR DELETE ON "CatalogImportRecord" FOR EACH ROW EXECUTE FUNCTION guard_catalog_import_evidence();
