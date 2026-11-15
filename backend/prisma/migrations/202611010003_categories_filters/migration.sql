-- CreateEnum
CREATE TYPE "CategoryCompatibility" AS ENUM ('ANY', 'ALLOW_LIST');

-- CreateEnum
CREATE TYPE "FilterSource" AS ENUM ('ATTRIBUTE', 'PRICE', 'BRAND', 'AVAILABILITY');

-- CreateEnum
CREATE TYPE "RouteOwner" AS ENUM ('CATEGORY', 'LEGACY_PRODUCT', 'LEGACY_CATEGORY', 'RESERVED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'PKR';

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "parentId" UUID,
    "activeParentId" UUID,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "media" JSONB NOT NULL,
    "seo" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "inNavigation" BOOLEAN NOT NULL DEFAULT true,
    "compatibility" "CategoryCompatibility" NOT NULL DEFAULT 'ANY',
    "status" "SchemaStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "filterRevision" INTEGER NOT NULL DEFAULT 1,
    "activeSnapshot" JSONB,
    "activeFilterSetId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryAllowedType" (
    "categoryId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productTypeId" UUID NOT NULL,

    CONSTRAINT "CategoryAllowedType_pkey" PRIMARY KEY ("categoryId","productTypeId")
);

-- CreateTable
CREATE TABLE "CatalogRoute" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "ownerKind" "RouteOwner" NOT NULL,
    "categoryId" UUID,
    "legacyKey" VARCHAR(160),

    CONSTRAINT "CatalogRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryFilterSet" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "SchemaStatus" NOT NULL DEFAULT 'DRAFT',
    "includeDescendants" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CategoryFilterSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryFilterTypeVersion" (
    "setId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "versionId" UUID NOT NULL,

    CONSTRAINT "CategoryFilterTypeVersion_pkey" PRIMARY KEY ("setId","versionId")
);

-- CreateTable
CREATE TABLE "CategoryFilterKey" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "semanticHash" CHAR(64) NOT NULL,

    CONSTRAINT "CategoryFilterKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryFilterRoute" (
    "categoryId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "keyId" UUID NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CategoryFilterRoute_pkey" PRIMARY KEY ("categoryId","code")
);

-- CreateTable
CREATE TABLE "CategoryFilter" (
    "id" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "keyId" UUID NOT NULL,
    "source" "FilterSource" NOT NULL,
    "attributeId" UUID,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "group" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "CategoryFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_storeId_parentId_sortOrder_idx" ON "Category"("storeId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Category_id_storeId_tenantId_key" ON "Category"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_id_tenantId_key" ON "Category"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_storeId_code_key" ON "Category"("storeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_storeId_slug_key" ON "Category"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRoute_storeId_slug_key" ON "CatalogRoute"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilterSet_id_storeId_tenantId_key" ON "CategoryFilterSet"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilterSet_id_categoryId_storeId_tenantId_key" ON "CategoryFilterSet"("id", "categoryId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilterSet_categoryId_number_key" ON "CategoryFilterSet"("categoryId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilterKey_id_categoryId_storeId_tenantId_key" ON "CategoryFilterKey"("id", "categoryId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilter_setId_code_key" ON "CategoryFilter"("setId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFilter_setId_keyId_key" ON "CategoryFilter"("setId", "keyId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_storeId_tenantId_fkey" FOREIGN KEY ("parentId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_activeParentId_storeId_tenantId_fkey" FOREIGN KEY ("activeParentId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_activeFilterSetId_id_storeId_tenantId_fkey" FOREIGN KEY ("activeFilterSetId", "id", "storeId", "tenantId") REFERENCES "CategoryFilterSet"("id", "categoryId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAllowedType" ADD CONSTRAINT "CategoryAllowedType_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("categoryId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAllowedType" ADD CONSTRAINT "CategoryAllowedType_productTypeId_tenantId_fkey" FOREIGN KEY ("productTypeId", "tenantId") REFERENCES "ProductType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRoute" ADD CONSTRAINT "CatalogRoute_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRoute" ADD CONSTRAINT "CatalogRoute_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("categoryId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilterSet" ADD CONSTRAINT "CategoryFilterSet_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("categoryId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilterTypeVersion" ADD CONSTRAINT "CategoryFilterTypeVersion_setId_storeId_tenantId_fkey" FOREIGN KEY ("setId", "storeId", "tenantId") REFERENCES "CategoryFilterSet"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilterTypeVersion" ADD CONSTRAINT "CategoryFilterTypeVersion_versionId_tenantId_fkey" FOREIGN KEY ("versionId", "tenantId") REFERENCES "ProductTypeVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilterKey" ADD CONSTRAINT "CategoryFilterKey_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("categoryId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilterRoute" ADD CONSTRAINT "CategoryFilterRoute_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("categoryId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilterRoute" ADD CONSTRAINT "CategoryFilterRoute_keyId_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("keyId", "categoryId", "storeId", "tenantId") REFERENCES "CategoryFilterKey"("id", "categoryId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilter" ADD CONSTRAINT "CategoryFilter_setId_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("setId", "categoryId", "storeId", "tenantId") REFERENCES "CategoryFilterSet"("id", "categoryId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilter" ADD CONSTRAINT "CategoryFilter_attributeId_tenantId_fkey" FOREIGN KEY ("attributeId", "tenantId") REFERENCES "AttributeDefinition"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryFilter" ADD CONSTRAINT "CategoryFilter_keyId_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("keyId", "categoryId", "storeId", "tenantId") REFERENCES "CategoryFilterKey"("id", "categoryId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Runtime application services also serialize mutations and validate graphs.
-- These SQL invariants remain necessary for nested writes and ordinary SQL.
CREATE UNIQUE INDEX "one_category_filter_draft" ON "CategoryFilterSet"("categoryId") WHERE "status"='DRAFT';
CREATE UNIQUE INDEX "one_category_filter_active" ON "CategoryFilterSet"("categoryId") WHERE "status"='ACTIVE';
ALTER TABLE "CatalogRoute" ADD CONSTRAINT "catalog_route_owner" CHECK (("ownerKind"='CATEGORY' AND "categoryId" IS NOT NULL) OR ("ownerKind"<>'CATEGORY' AND "categoryId" IS NULL AND "legacyKey" IS NOT NULL));
ALTER TABLE "CategoryFilter" ADD CONSTRAINT "filter_attribute_source" CHECK (("source"='ATTRIBUTE' AND "attributeId" IS NOT NULL) OR ("source"<>'ATTRIBUTE' AND "attributeId" IS NULL));
ALTER TABLE "Category" ADD CONSTRAINT "category_order_revision" CHECK ("sortOrder">=0 AND "revision">0 AND "filterRevision">0);

CREATE FUNCTION guard_category_tree() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE edge uuid; cursor_id uuid; next_id uuid; visited uuid[]; depth integer; subtree integer; kind text; parent_record record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."storeId"::text,731003));
  IF TG_OP='UPDATE' THEN
    IF NEW."id"<>OLD."id" OR NEW."storeId"<>OLD."storeId" OR NEW."tenantId"<>OLD."tenantId" OR NEW."code"<>OLD."code" OR NEW."createdBy"<>OLD."createdBy" THEN RAISE EXCEPTION 'Category ownership is immutable' USING ERRCODE='23514'; END IF;
    IF (NEW."activeSnapshot" IS DISTINCT FROM OLD."activeSnapshot" OR NEW."activeParentId" IS DISTINCT FROM OLD."activeParentId") AND NOT (OLD."status"='APPROVED' AND NEW."status"='ACTIVE') THEN RAISE EXCEPTION 'Only approved activation changes published content' USING ERRCODE='23514'; END IF;
    IF OLD."status"='ARCHIVED' AND NEW."status"<>'ARCHIVED' THEN RAISE EXCEPTION 'Archived categories cannot be implicitly restored' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW."status"='ARCHIVED' THEN
    IF EXISTS(SELECT 1 FROM "Category" c WHERE c."storeId"=NEW."storeId" AND c."status"<>'ARCHIVED' AND (c."parentId"=NEW."id" OR c."activeParentId"=NEW."id")) THEN RAISE EXCEPTION 'Category has live children' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  FOREACH kind IN ARRAY ARRAY['draft','active'] LOOP
    edge:=CASE WHEN kind='draft' THEN NEW."parentId" ELSE NEW."activeParentId" END;
    IF edge IS NOT NULL THEN
      SELECT * INTO parent_record FROM "Category" WHERE "id"=edge AND "storeId"=NEW."storeId" AND "tenantId"=NEW."tenantId";
      IF NOT FOUND OR parent_record."status"='ARCHIVED' THEN RAISE EXCEPTION 'Parent must belong to this store and remain active' USING ERRCODE='23514'; END IF;
      IF kind='active' AND parent_record."activeSnapshot" IS NULL THEN RAISE EXCEPTION 'Published parent is required' USING ERRCODE='23514'; END IF;
    END IF;
    cursor_id:=edge; visited:=ARRAY[NEW."id"]; depth:=1;
    WHILE cursor_id IS NOT NULL LOOP
      IF cursor_id=ANY(visited) THEN RAISE EXCEPTION 'Category cycle detected' USING ERRCODE='23514'; END IF;
      visited:=array_append(visited,cursor_id); depth:=depth+1;
      IF depth>32 THEN RAISE EXCEPTION 'Category depth exceeds limit' USING ERRCODE='23514'; END IF;
      SELECT CASE WHEN kind='draft' THEN "parentId" ELSE "activeParentId" END INTO next_id FROM "Category" WHERE "id"=cursor_id AND "storeId"=NEW."storeId" AND "tenantId"=NEW."tenantId";
      cursor_id:=next_id;
    END LOOP;
    WITH RECURSIVE descendants AS (
      SELECT NEW."id" AS id,1 AS n,ARRAY[NEW."id"] AS path
      UNION ALL SELECT c."id",d.n+1,array_append(d.path,c."id") FROM "Category" c JOIN descendants d ON (CASE WHEN kind='draft' THEN c."parentId" ELSE c."activeParentId" END)=d.id
      WHERE c."storeId"=NEW."storeId" AND c."status"<>'ARCHIVED' AND d.n<=32 AND NOT c."id"=ANY(d.path)
    ) SELECT max(n) INTO subtree FROM descendants;
    IF depth+subtree-1>32 THEN RAISE EXCEPTION 'Moving this subtree exceeds the depth limit' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER category_tree_guard BEFORE INSERT OR UPDATE ON "Category" FOR EACH ROW EXECUTE FUNCTION guard_category_tree();

CREATE FUNCTION guard_catalog_route() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Catalog route reservations must be retained' USING ERRCODE='23514'; END IF;
  IF NEW."id"<>OLD."id" OR NEW."storeId"<>OLD."storeId" OR NEW."tenantId"<>OLD."tenantId" OR NEW."slug"<>OLD."slug" THEN RAISE EXCEPTION 'Routing identity is immutable' USING ERRCODE='23514'; END IF;
  IF (NEW."ownerKind" IS DISTINCT FROM OLD."ownerKind" OR NEW."categoryId" IS DISTINCT FROM OLD."categoryId") AND NOT (OLD."ownerKind"='LEGACY_CATEGORY' AND NEW."ownerKind"='CATEGORY' AND NEW."legacyKey"=OLD."legacyKey") THEN RAISE EXCEPTION 'Route ownership cannot be reassigned' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER catalog_route_guard BEFORE UPDATE OR DELETE ON "CatalogRoute" FOR EACH ROW EXECUTE FUNCTION guard_catalog_route();

CREATE FUNCTION guard_category_filter_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Filter history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF NEW."id"<>OLD."id" OR NEW."categoryId"<>OLD."categoryId" OR NEW."storeId"<>OLD."storeId" OR NEW."tenantId"<>OLD."tenantId" OR NEW."number"<>OLD."number" THEN RAISE EXCEPTION 'Filter version identity is immutable' USING ERRCODE='23514'; END IF;
  IF OLD."status"<>'DRAFT' AND NEW."includeDescendants"<>OLD."includeDescendants" THEN RAISE EXCEPTION 'Reviewed filter content is immutable' USING ERRCODE='23514'; END IF;
  IF OLD."status" IN ('APPROVED','ACTIVE','ARCHIVED') AND (NEW."approvedBy" IS DISTINCT FROM OLD."approvedBy" OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt") THEN RAISE EXCEPTION 'Filter approval evidence is immutable' USING ERRCODE='23514'; END IF;
  IF NEW."status"<>OLD."status" AND NOT (
    (OLD."status"='DRAFT' AND NEW."status" IN ('REVIEW','ARCHIVED')) OR
    (OLD."status"='REVIEW' AND NEW."status" IN ('DRAFT','APPROVED','ARCHIVED')) OR
    (OLD."status"='APPROVED' AND NEW."status" IN ('ACTIVE','ARCHIVED')) OR
    (OLD."status"='ACTIVE' AND NEW."status"='ARCHIVED')
  ) THEN RAISE EXCEPTION 'Invalid filter transition' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER category_filter_version_guard BEFORE UPDATE OR DELETE ON "CategoryFilterSet" FOR EACH ROW EXECUTE FUNCTION guard_category_filter_version();

CREATE FUNCTION guard_category_filter_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data record; state "SchemaStatus";
BEGIN
  FOR row_data IN SELECT * FROM jsonb_to_recordset(CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END) AS r("setId" uuid,"storeId" uuid,"tenantId" uuid) LOOP
    SELECT "status" INTO state FROM "CategoryFilterSet" WHERE "id"=row_data."setId" AND "storeId"=row_data."storeId" AND "tenantId"=row_data."tenantId" FOR UPDATE;
    IF state IS DISTINCT FROM 'DRAFT'::"SchemaStatus" THEN RAISE EXCEPTION 'Only filter draft children may change' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER category_filter_field_guard BEFORE INSERT OR UPDATE OR DELETE ON "CategoryFilter" FOR EACH ROW EXECUTE FUNCTION guard_category_filter_child();
CREATE TRIGGER category_filter_dependency_guard BEFORE INSERT OR UPDATE OR DELETE ON "CategoryFilterTypeVersion" FOR EACH ROW EXECUTE FUNCTION guard_category_filter_child();

CREATE FUNCTION guard_filter_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Query identities must be retained' USING ERRCODE='23514'; END IF;
  IF to_jsonb(NEW)-'published' IS DISTINCT FROM to_jsonb(OLD)-'published' THEN RAISE EXCEPTION 'Query ownership and meaning are immutable' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='CategoryFilterRoute' THEN
    IF OLD."published" AND NOT NEW."published" THEN RAISE EXCEPTION 'Published aliases must remain reserved' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER category_filter_key_guard BEFORE UPDATE OR DELETE ON "CategoryFilterKey" FOR EACH ROW EXECUTE FUNCTION guard_filter_identity();
CREATE TRIGGER category_filter_alias_guard BEFORE UPDATE OR DELETE ON "CategoryFilterRoute" FOR EACH ROW EXECUTE FUNCTION guard_filter_identity();

CREATE FUNCTION check_category_filter_pointer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE category_id uuid; pointer uuid; active_id uuid; n bigint;
BEGIN
  IF TG_TABLE_NAME='Category' THEN category_id:=NEW."id"; ELSE category_id:=NEW."categoryId"; END IF;
  SELECT "activeFilterSetId" INTO pointer FROM "Category" WHERE id=category_id;
  SELECT count(*) INTO n FROM "CategoryFilterSet" WHERE "categoryId"=category_id AND status='ACTIVE';
  SELECT id INTO active_id FROM "CategoryFilterSet" WHERE "categoryId"=category_id AND status='ACTIVE';
  IF (n=0 AND pointer IS NOT NULL) OR (n=1 AND pointer IS DISTINCT FROM active_id) THEN RAISE EXCEPTION 'Filter active pointer is inconsistent' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER category_filter_pointer_check AFTER INSERT OR UPDATE ON "Category" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_category_filter_pointer();
CREATE CONSTRAINT TRIGGER category_filter_version_pointer_check AFTER INSERT OR UPDATE ON "CategoryFilterSet" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_category_filter_pointer();
