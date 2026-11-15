-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "DefinitionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttributeLevel" AS ENUM ('PRODUCT', 'SKU');

-- CreateEnum
CREATE TYPE "SchemaStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "OptionSet" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "DefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionValue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "optionSetId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "swatch" VARCHAR(7),
    "status" "DefinitionStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "OptionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "dataType" "AttributeDataType" NOT NULL,
    "canonicalUnit" VARCHAR(24),
    "optionSetId" UUID,
    "rules" JSONB NOT NULL,
    "widget" VARCHAR(24) NOT NULL,
    "allowedScopes" "AttributeLevel"[] NOT NULL,
    "axisEligible" BOOLEAN NOT NULL DEFAULT false,
    "visibility" JSONB NOT NULL,
    "status" "DefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "activeVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypeVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productTypeId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "SchemaStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,

    CONSTRAINT "ProductTypeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecificationGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpecificationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypeAttribute" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "level" "AttributeLevel" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "variantAxis" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ProductTypeAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypeAttributeOption" (
    "bindingId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "optionValueId" UUID NOT NULL,

    CONSTRAINT "ProductTypeAttributeOption_pkey" PRIMARY KEY ("bindingId","optionValueId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OptionSet_id_tenantId_key" ON "OptionSet"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionSet_tenantId_code_key" ON "OptionSet"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OptionValue_id_tenantId_key" ON "OptionValue"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionValue_optionSetId_code_key" ON "OptionValue"("optionSetId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_id_tenantId_key" ON "AttributeDefinition"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_tenantId_code_key" ON "AttributeDefinition"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_id_tenantId_key" ON "ProductType"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_tenantId_code_key" ON "ProductType"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ProductTypeVersion_tenantId_status_idx" ON "ProductTypeVersion"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeVersion_id_tenantId_key" ON "ProductTypeVersion"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeVersion_id_productTypeId_tenantId_key" ON "ProductTypeVersion"("id", "productTypeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeVersion_productTypeId_number_key" ON "ProductTypeVersion"("productTypeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SpecificationGroup_id_versionId_tenantId_key" ON "SpecificationGroup"("id", "versionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecificationGroup_versionId_code_key" ON "SpecificationGroup"("versionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeAttribute_id_tenantId_key" ON "ProductTypeAttribute"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeAttribute_versionId_attributeId_key" ON "ProductTypeAttribute"("versionId", "attributeId");

-- CreateIndex
CREATE INDEX "ProductTypeAttributeOption_optionValueId_tenantId_idx" ON "ProductTypeAttributeOption"("optionValueId", "tenantId");

-- AddForeignKey
ALTER TABLE "OptionSet" ADD CONSTRAINT "OptionSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionValue" ADD CONSTRAINT "OptionValue_optionSetId_tenantId_fkey" FOREIGN KEY ("optionSetId", "tenantId") REFERENCES "OptionSet"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_optionSetId_tenantId_fkey" FOREIGN KEY ("optionSetId", "tenantId") REFERENCES "OptionSet"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_activeVersionId_id_tenantId_fkey" FOREIGN KEY ("activeVersionId", "id", "tenantId") REFERENCES "ProductTypeVersion"("id", "productTypeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeVersion" ADD CONSTRAINT "ProductTypeVersion_productTypeId_tenantId_fkey" FOREIGN KEY ("productTypeId", "tenantId") REFERENCES "ProductType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecificationGroup" ADD CONSTRAINT "SpecificationGroup_versionId_tenantId_fkey" FOREIGN KEY ("versionId", "tenantId") REFERENCES "ProductTypeVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttribute" ADD CONSTRAINT "ProductTypeAttribute_versionId_tenantId_fkey" FOREIGN KEY ("versionId", "tenantId") REFERENCES "ProductTypeVersion"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttribute" ADD CONSTRAINT "ProductTypeAttribute_attributeId_tenantId_fkey" FOREIGN KEY ("attributeId", "tenantId") REFERENCES "AttributeDefinition"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttribute" ADD CONSTRAINT "ProductTypeAttribute_groupId_versionId_tenantId_fkey" FOREIGN KEY ("groupId", "versionId", "tenantId") REFERENCES "SpecificationGroup"("id", "versionId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttributeOption" ADD CONSTRAINT "ProductTypeAttributeOption_bindingId_tenantId_fkey" FOREIGN KEY ("bindingId", "tenantId") REFERENCES "ProductTypeAttribute"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTypeAttributeOption" ADD CONSTRAINT "ProductTypeAttributeOption_optionValueId_tenantId_fkey" FOREIGN KEY ("optionValueId", "tenantId") REFERENCES "OptionValue"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extra relational invariants not expressible in Prisma schema syntax.
CREATE UNIQUE INDEX "one_active_type_version" ON "ProductTypeVersion" ("productTypeId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "one_draft_type_version" ON "ProductTypeVersion" ("productTypeId") WHERE "status" = 'DRAFT';
ALTER TABLE "OptionValue" ADD CONSTRAINT "option_swatch" CHECK ("swatch" IS NULL OR "swatch" ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "attribute_shape" CHECK (
  (("dataType" = 'NUMBER' AND "canonicalUnit" IS NOT NULL) OR ("dataType" <> 'NUMBER' AND "canonicalUnit" IS NULL)) AND
  (("dataType" IN ('SINGLE_SELECT','MULTI_SELECT') AND "optionSetId" IS NOT NULL) OR ("dataType" NOT IN ('SINGLE_SELECT','MULTI_SELECT') AND "optionSetId" IS NULL)) AND
  cardinality("allowedScopes") BETWEEN 1 AND 2 AND
  (cardinality("allowedScopes") = 1 OR "allowedScopes" @> ARRAY['PRODUCT','SKU']::"AttributeLevel"[]) AND
  (NOT "axisEligible" OR ("dataType" = 'SINGLE_SELECT' AND 'SKU' = ANY("allowedScopes")))
);
ALTER TABLE "ProductTypeAttribute" ADD CONSTRAINT "axis_is_sku" CHECK (NOT "variantAxis" OR "level" = 'SKU');

CREATE FUNCTION protect_definition_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" <> OLD."id" OR NEW."tenantId" <> OLD."tenantId" OR NEW."code" <> OLD."code" THEN
    RAISE EXCEPTION 'Definition identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'AttributeDefinition' THEN
    IF NEW."dataType" <> OLD."dataType" OR NEW."optionSetId" IS DISTINCT FROM OLD."optionSetId" THEN
      RAISE EXCEPTION 'Attribute meaning is immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'OptionValue' THEN
    IF NEW."optionSetId" <> OLD."optionSetId" THEN RAISE EXCEPTION 'Option vocabulary is immutable' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attribute_identity BEFORE UPDATE ON "AttributeDefinition" FOR EACH ROW EXECUTE FUNCTION protect_definition_identity();
CREATE TRIGGER option_set_identity BEFORE UPDATE ON "OptionSet" FOR EACH ROW EXECUTE FUNCTION protect_definition_identity();
CREATE TRIGGER option_value_identity BEFORE UPDATE ON "OptionValue" FOR EACH ROW EXECUTE FUNCTION protect_definition_identity();
CREATE TRIGGER product_type_identity BEFORE UPDATE ON "ProductType" FOR EACH ROW EXECUTE FUNCTION protect_definition_identity();

CREATE FUNCTION protect_schema_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'Reviewed schema cannot be deleted' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF NEW."id" <> OLD."id" OR NEW."tenantId" <> OLD."tenantId" OR NEW."productTypeId" <> OLD."productTypeId" OR NEW."number" <> OLD."number" THEN
    RAISE EXCEPTION 'Schema identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" <> 'DRAFT' AND (NEW."label" <> OLD."label" OR NEW."description" <> OLD."description") THEN
    RAISE EXCEPTION 'Reviewed schema content is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" IN ('APPROVED','ACTIVE','ARCHIVED') AND (NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt" OR NEW."approvedBy" IS DISTINCT FROM OLD."approvedBy") THEN
    RAISE EXCEPTION 'Approval evidence is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status" = 'DRAFT' AND NEW."status" IN ('REVIEW','ARCHIVED')) OR
    (OLD."status" = 'REVIEW' AND NEW."status" IN ('DRAFT','APPROVED')) OR
    (OLD."status" = 'APPROVED' AND NEW."status" IN ('ACTIVE','ARCHIVED')) OR
    (OLD."status" = 'ACTIVE' AND NEW."status" = 'ARCHIVED')
  ) THEN RAISE EXCEPTION 'Invalid schema transition' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_schema BEFORE UPDATE OR DELETE ON "ProductTypeVersion" FOR EACH ROW EXECUTE FUNCTION protect_schema_version();

CREATE FUNCTION protect_schema_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; owner_tenant uuid; state "SchemaStatus"; record_row record;
BEGIN
  FOR record_row IN SELECT * FROM jsonb_to_recordset(
    CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END
  ) AS r("versionId" uuid, "tenantId" uuid, "bindingId" uuid) LOOP
    target := record_row."versionId"; owner_tenant := record_row."tenantId";
    IF TG_TABLE_NAME = 'ProductTypeAttributeOption' THEN
      SELECT "versionId" INTO target FROM "ProductTypeAttribute" WHERE "id" = record_row."bindingId" AND "tenantId" = owner_tenant;
    END IF;
    SELECT "status" INTO state FROM "ProductTypeVersion" WHERE "id"=target AND "tenantId"=owner_tenant FOR UPDATE;
    IF state IS DISTINCT FROM 'DRAFT'::"SchemaStatus" THEN RAISE EXCEPTION 'Only draft schema children may change' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER immutable_schema_groups BEFORE INSERT OR UPDATE OR DELETE ON "SpecificationGroup" FOR EACH ROW EXECUTE FUNCTION protect_schema_child();
CREATE TRIGGER immutable_schema_fields BEFORE INSERT OR UPDATE OR DELETE ON "ProductTypeAttribute" FOR EACH ROW EXECUTE FUNCTION protect_schema_child();
CREATE TRIGGER immutable_schema_options BEFORE INSERT OR UPDATE OR DELETE ON "ProductTypeAttributeOption" FOR EACH ROW EXECUTE FUNCTION protect_schema_child();

CREATE FUNCTION check_type_active_pointer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE type_id uuid; owner_tenant uuid; pointer uuid; active_id uuid; active_count bigint;
BEGIN
  IF TG_TABLE_NAME='ProductType' THEN type_id:=NEW."id"; owner_tenant:=NEW."tenantId";
  ELSIF TG_OP='DELETE' THEN type_id:=OLD."productTypeId"; owner_tenant:=OLD."tenantId";
  ELSE type_id:=NEW."productTypeId"; owner_tenant:=NEW."tenantId"; END IF;
  SELECT "activeVersionId" INTO pointer FROM "ProductType" WHERE "id"=type_id AND "tenantId"=owner_tenant;
  SELECT count(*) INTO active_count FROM "ProductTypeVersion" WHERE "productTypeId"=type_id AND "tenantId"=owner_tenant AND "status"='ACTIVE';
  SELECT "id" INTO active_id FROM "ProductTypeVersion" WHERE "productTypeId"=type_id AND "tenantId"=owner_tenant AND "status"='ACTIVE';
  IF (active_count=0 AND pointer IS NOT NULL) OR (active_count=1 AND pointer IS DISTINCT FROM active_id) THEN
    RAISE EXCEPTION 'Active schema pointer is inconsistent' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_type_pointer AFTER INSERT OR UPDATE ON "ProductType" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_type_active_pointer();
CREATE CONSTRAINT TRIGGER check_version_pointer AFTER INSERT OR UPDATE OR DELETE ON "ProductTypeVersion" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_type_active_pointer();
