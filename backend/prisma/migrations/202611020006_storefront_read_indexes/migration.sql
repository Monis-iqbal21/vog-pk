-- Additive route-publication provenance and read indexes; no imports or cutover.
ALTER TABLE "CatalogRoute" ADD COLUMN published BOOLEAN NOT NULL DEFAULT false;
UPDATE "CatalogRoute" r SET published=true WHERE
 (r."ownerKind"='CATEGORY' AND EXISTS(SELECT 1 FROM "Category" c WHERE c.id=r."categoryId" AND c."activeSnapshot"->>'slug'=r.slug)) OR
 (r."ownerKind"='LISTING' AND EXISTS(SELECT 1 FROM "ListingRevision" l WHERE l."listingId"=r."listingId" AND l.slug=r.slug AND l."publishedAt" IS NOT NULL AND l."approvedAt" IS NOT NULL));
CREATE FUNCTION guard_public_catalog_route() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND OLD.published AND NOT NEW.published THEN RAISE EXCEPTION 'Published route provenance is retained' USING ERRCODE='23514'; END IF;
 IF NEW.published AND (TG_OP='INSERT' OR NOT OLD.published) AND NOT (
  (NEW."ownerKind"='CATEGORY' AND EXISTS(SELECT 1 FROM "Category" c WHERE c.id=NEW."categoryId" AND c."activeSnapshot"->>'slug'=NEW.slug)) OR
  (NEW."ownerKind"='LISTING' AND EXISTS(SELECT 1 FROM "ListingRevision" l WHERE l."listingId"=NEW."listingId" AND l.slug=NEW.slug AND l."publishedAt" IS NOT NULL AND l."approvedAt" IS NOT NULL)))
 THEN RAISE EXCEPTION 'Public routes require publication evidence' USING ERRCODE='23514'; END IF;RETURN NEW; END $$;
CREATE TRIGGER public_catalog_route_guard BEFORE INSERT OR UPDATE ON "CatalogRoute" FOR EACH ROW EXECUTE FUNCTION guard_public_catalog_route();
CREATE INDEX "ListingRevision_storeId_status_slug_idx" ON "ListingRevision"("storeId", "status", "slug");
CREATE INDEX "SKURevision_tenantId_state_id_idx" ON "SKURevision"("tenantId", "state", "id");
