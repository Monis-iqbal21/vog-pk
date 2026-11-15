-- CreateEnum
CREATE TYPE "CatalogState" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SellingMode" AS ENUM ('REFERENCE', 'INFORMATIONAL', 'RFQ', 'RETAIL');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('GALLERY', 'DETAIL_POSTER', 'SIZE_CHART', 'DIMENSIONS', 'INSTALLATION_GUIDE', 'FEATURE_DIAGRAM', 'OTHER_CONTENT');

-- CreateEnum
CREATE TYPE "MediaRights" AS ENUM ('UNVERIFIED', 'APPROVED', 'RESTRICTED');

-- AlterEnum
ALTER TYPE "RouteOwner" ADD VALUE 'LISTING';

-- AlterTable
ALTER TABLE "ProductTypeVersion" ADD COLUMN     "allowNoSku" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CatalogRoute" ADD COLUMN     "listingId" UUID;

-- CreateTable
CREATE TABLE "CatalogBrand" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "CatalogBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productTypeId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "externalReference" VARCHAR(160),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "publishedRevisionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productTypeId" UUID NOT NULL,
    "schemaVersionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "CatalogState" NOT NULL DEFAULT 'DRAFT',
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "content" JSONB NOT NULL DEFAULT '[]',
    "brandId" UUID,
    "sellingMode" "SellingMode" NOT NULL DEFAULT 'REFERENCE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" UUID,

    CONSTRAINT "ProductRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeBinding" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "schemaBindingId" UUID NOT NULL,
    "attributeId" UUID NOT NULL,
    "level" "AttributeLevel" NOT NULL,
    "required" BOOLEAN NOT NULL,
    "axis" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ProductAttributeBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "bindingId" UUID NOT NULL,
    "dataType" "AttributeDataType" NOT NULL,
    "textValue" VARCHAR(10000),
    "numberValue" DECIMAL(24,6),
    "booleanValue" BOOLEAN,
    "unit" VARCHAR(24),

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeChoice" (
    "valueId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "optionId" UUID NOT NULL,

    CONSTRAINT "ProductAttributeChoice_pkey" PRIMARY KEY ("valueId","optionId")
);

-- CreateTable
CREATE TABLE "SKU" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "manufacturerPartNumber" VARCHAR(120),
    "identityKey" CHAR(64) NOT NULL,
    "identityFacts" JSONB NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "SKU_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKURevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "state" "DefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "combinationKey" CHAR(64) NOT NULL,

    CONSTRAINT "SKURevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKUAttributeValue" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "skuRevisionId" UUID NOT NULL,
    "bindingId" UUID NOT NULL,
    "dataType" "AttributeDataType" NOT NULL,
    "textValue" VARCHAR(10000),
    "numberValue" DECIMAL(24,6),
    "booleanValue" BOOLEAN,
    "unit" VARCHAR(24),

    CONSTRAINT "SKUAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKUAttributeChoice" (
    "valueId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "optionId" UUID NOT NULL,

    CONSTRAINT "SKUAttributeChoice_pkey" PRIMARY KEY ("valueId","optionId")
);

-- CreateTable
CREATE TABLE "StoreListing" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "externalReference" VARCHAR(160),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "publishedRevisionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "StoreListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingRevision" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "CatalogState" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sellingMode" "SellingMode" NOT NULL,
    "seo" JSONB NOT NULL DEFAULT '{}',
    "featuredOrder" INTEGER,
    "newArrivalOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" UUID,

    CONSTRAINT "ListingRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingCategory" (
    "listingRevisionId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "ListingCategory_pkey" PRIMARY KEY ("listingRevisionId","categoryId")
);

-- CreateTable
CREATE TABLE "ListingSKU" (
    "listingRevisionId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "skuRevisionId" UUID NOT NULL,

    CONSTRAINT "ListingSKU_pkey" PRIMARY KEY ("listingRevisionId","skuRevisionId")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "contentDigest" CHAR(64),
    "storageReference" VARCHAR(240),
    "sourceUrl" VARCHAR(1000),
    "rights" "MediaRights" NOT NULL DEFAULT 'UNVERIFIED',
    "rightsMetadata" JSONB NOT NULL DEFAULT '{}',
    "mimeType" VARCHAR(80) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRevisionMedia" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(500),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "presentation" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ProductRevisionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SKURevisionMedia" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "skuRevisionId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(500),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "presentation" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SKURevisionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingRevisionMedia" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "listingRevisionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productRevisionId" UUID NOT NULL,
    "productMediaId" UUID,
    "skuMediaId" UUID,
    "purpose" "MediaPurpose" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" VARCHAR(500) NOT NULL,
    "caption" VARCHAR(500),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "presentation" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ListingRevisionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogBrand_id_tenantId_key" ON "CatalogBrand"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogBrand_tenantId_code_key" ON "CatalogBrand"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_tenantId_key" ON "Product"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_id_productTypeId_tenantId_key" ON "Product"("id", "productTypeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_code_key" ON "Product"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_externalReference_key" ON "Product"("tenantId", "externalReference");

-- CreateIndex
CREATE INDEX "ProductRevision_tenantId_status_name_idx" ON "ProductRevision"("tenantId", "status", "name");

-- CreateIndex
CREATE INDEX "ProductRevision_schemaVersionId_tenantId_idx" ON "ProductRevision"("schemaVersionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_id_productId_tenantId_key" ON "ProductRevision"("id", "productId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_id_tenantId_key" ON "ProductRevision"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_productId_number_key" ON "ProductRevision"("productId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeBinding_id_productRevisionId_tenantId_key" ON "ProductAttributeBinding"("id", "productRevisionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeBinding_productRevisionId_attributeId_key" ON "ProductAttributeBinding"("productRevisionId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_id_tenantId_key" ON "ProductAttributeValue"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAttributeValue_productRevisionId_bindingId_key" ON "ProductAttributeValue"("productRevisionId", "bindingId");

-- CreateIndex
CREATE INDEX "SKU_productId_identityKey_idx" ON "SKU"("productId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "SKU_id_productId_tenantId_key" ON "SKU"("id", "productId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SKU_tenantId_code_key" ON "SKU"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SKURevision_id_productRevisionId_productId_tenantId_key" ON "SKURevision"("id", "productRevisionId", "productId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SKURevision_id_tenantId_key" ON "SKURevision"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SKURevision_productRevisionId_skuId_key" ON "SKURevision"("productRevisionId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "SKURevision_productRevisionId_combinationKey_key" ON "SKURevision"("productRevisionId", "combinationKey");

-- CreateIndex
CREATE UNIQUE INDEX "SKUAttributeValue_id_tenantId_key" ON "SKUAttributeValue"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SKUAttributeValue_skuRevisionId_bindingId_key" ON "SKUAttributeValue"("skuRevisionId", "bindingId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_id_storeId_tenantId_key" ON "StoreListing"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_id_productId_storeId_tenantId_key" ON "StoreListing"("id", "productId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_storeId_code_key" ON "StoreListing"("storeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_storeId_externalReference_key" ON "StoreListing"("storeId", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_storeId_productId_key" ON "StoreListing"("storeId", "productId");

-- CreateIndex
CREATE INDEX "ListingRevision_storeId_status_title_idx" ON "ListingRevision"("storeId", "status", "title");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevision_id_listingId_storeId_tenantId_key" ON "ListingRevision"("id", "listingId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevision_id_storeId_tenantId_key" ON "ListingRevision"("id", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevision_id_productRevisionId_productId_tenantId_key" ON "ListingRevision"("id", "productRevisionId", "productId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevision_id_productRevisionId_productId_storeId_tena_key" ON "ListingRevision"("id", "productRevisionId", "productId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevision_listingId_number_key" ON "ListingRevision"("listingId", "number");

-- CreateIndex
CREATE INDEX "ListingCategory_categoryId_storeId_tenantId_idx" ON "ListingCategory"("categoryId", "storeId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_id_tenantId_key" ON "MediaAsset"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_tenantId_code_key" ON "MediaAsset"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevisionMedia_id_productRevisionId_tenantId_key" ON "ProductRevisionMedia"("id", "productRevisionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevisionMedia_productRevisionId_purpose_sortOrder_key" ON "ProductRevisionMedia"("productRevisionId", "purpose", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SKURevisionMedia_id_productRevisionId_tenantId_key" ON "SKURevisionMedia"("id", "productRevisionId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SKURevisionMedia_skuRevisionId_purpose_sortOrder_key" ON "SKURevisionMedia"("skuRevisionId", "purpose", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ListingRevisionMedia_listingRevisionId_purpose_sortOrder_key" ON "ListingRevisionMedia"("listingRevisionId", "purpose", "sortOrder");

-- AddForeignKey
ALTER TABLE "CatalogRoute" ADD CONSTRAINT "CatalogRoute_listingId_storeId_tenantId_fkey" FOREIGN KEY ("listingId", "storeId", "tenantId") REFERENCES "StoreListing"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogBrand" ADD CONSTRAINT "CatalogBrand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productTypeId_tenantId_fkey" FOREIGN KEY ("productTypeId", "tenantId") REFERENCES "ProductType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_publishedRevisionId_id_tenantId_fkey" FOREIGN KEY ("publishedRevisionId", "id", "tenantId") REFERENCES "ProductRevision"("id", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_productId_productTypeId_tenantId_fkey" FOREIGN KEY ("productId", "productTypeId", "tenantId") REFERENCES "Product"("id", "productTypeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_schemaVersionId_productTypeId_tenantId_fkey" FOREIGN KEY ("schemaVersionId", "productTypeId", "tenantId") REFERENCES "ProductTypeVersion"("id", "productTypeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevision" ADD CONSTRAINT "ProductRevision_brandId_tenantId_fkey" FOREIGN KEY ("brandId", "tenantId") REFERENCES "CatalogBrand"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeBinding" ADD CONSTRAINT "ProductAttributeBinding_productRevisionId_tenantId_fkey" FOREIGN KEY ("productRevisionId", "tenantId") REFERENCES "ProductRevision"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeBinding" ADD CONSTRAINT "ProductAttributeBinding_schemaBindingId_tenantId_fkey" FOREIGN KEY ("schemaBindingId", "tenantId") REFERENCES "ProductTypeAttribute"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeBinding" ADD CONSTRAINT "ProductAttributeBinding_attributeId_tenantId_fkey" FOREIGN KEY ("attributeId", "tenantId") REFERENCES "AttributeDefinition"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_bindingId_productRevisionId_tenantId_fkey" FOREIGN KEY ("bindingId", "productRevisionId", "tenantId") REFERENCES "ProductAttributeBinding"("id", "productRevisionId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productRevisionId_tenantId_fkey" FOREIGN KEY ("productRevisionId", "tenantId") REFERENCES "ProductRevision"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeChoice" ADD CONSTRAINT "ProductAttributeChoice_valueId_tenantId_fkey" FOREIGN KEY ("valueId", "tenantId") REFERENCES "ProductAttributeValue"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeChoice" ADD CONSTRAINT "ProductAttributeChoice_optionId_tenantId_fkey" FOREIGN KEY ("optionId", "tenantId") REFERENCES "OptionValue"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKU" ADD CONSTRAINT "SKU_productId_tenantId_fkey" FOREIGN KEY ("productId", "tenantId") REFERENCES "Product"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKURevision" ADD CONSTRAINT "SKURevision_productRevisionId_productId_tenantId_fkey" FOREIGN KEY ("productRevisionId", "productId", "tenantId") REFERENCES "ProductRevision"("id", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKURevision" ADD CONSTRAINT "SKURevision_skuId_productId_tenantId_fkey" FOREIGN KEY ("skuId", "productId", "tenantId") REFERENCES "SKU"("id", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKUAttributeValue" ADD CONSTRAINT "SKUAttributeValue_bindingId_productRevisionId_tenantId_fkey" FOREIGN KEY ("bindingId", "productRevisionId", "tenantId") REFERENCES "ProductAttributeBinding"("id", "productRevisionId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKUAttributeValue" ADD CONSTRAINT "SKUAttributeValue_skuRevisionId_productRevisionId_productI_fkey" FOREIGN KEY ("skuRevisionId", "productRevisionId", "productId", "tenantId") REFERENCES "SKURevision"("id", "productRevisionId", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKUAttributeChoice" ADD CONSTRAINT "SKUAttributeChoice_valueId_tenantId_fkey" FOREIGN KEY ("valueId", "tenantId") REFERENCES "SKUAttributeValue"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKUAttributeChoice" ADD CONSTRAINT "SKUAttributeChoice_optionId_tenantId_fkey" FOREIGN KEY ("optionId", "tenantId") REFERENCES "OptionValue"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_productId_tenantId_fkey" FOREIGN KEY ("productId", "tenantId") REFERENCES "Product"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_publishedRevisionId_id_storeId_tenantId_fkey" FOREIGN KEY ("publishedRevisionId", "id", "storeId", "tenantId") REFERENCES "ListingRevision"("id", "listingId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_listingId_productId_storeId_tenantId_fkey" FOREIGN KEY ("listingId", "productId", "storeId", "tenantId") REFERENCES "StoreListing"("id", "productId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevision" ADD CONSTRAINT "ListingRevision_productRevisionId_productId_tenantId_fkey" FOREIGN KEY ("productRevisionId", "productId", "tenantId") REFERENCES "ProductRevision"("id", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCategory" ADD CONSTRAINT "ListingCategory_listingRevisionId_storeId_tenantId_fkey" FOREIGN KEY ("listingRevisionId", "storeId", "tenantId") REFERENCES "ListingRevision"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCategory" ADD CONSTRAINT "ListingCategory_categoryId_storeId_tenantId_fkey" FOREIGN KEY ("categoryId", "storeId", "tenantId") REFERENCES "Category"("id", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSKU" ADD CONSTRAINT "ListingSKU_listingRevisionId_productRevisionId_productId_t_fkey" FOREIGN KEY ("listingRevisionId", "productRevisionId", "productId", "tenantId") REFERENCES "ListingRevision"("id", "productRevisionId", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSKU" ADD CONSTRAINT "ListingSKU_skuRevisionId_productRevisionId_productId_tenan_fkey" FOREIGN KEY ("skuRevisionId", "productRevisionId", "productId", "tenantId") REFERENCES "SKURevision"("id", "productRevisionId", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevisionMedia" ADD CONSTRAINT "ProductRevisionMedia_productRevisionId_tenantId_fkey" FOREIGN KEY ("productRevisionId", "tenantId") REFERENCES "ProductRevision"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRevisionMedia" ADD CONSTRAINT "ProductRevisionMedia_assetId_tenantId_fkey" FOREIGN KEY ("assetId", "tenantId") REFERENCES "MediaAsset"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKURevisionMedia" ADD CONSTRAINT "SKURevisionMedia_skuRevisionId_productRevisionId_productId_fkey" FOREIGN KEY ("skuRevisionId", "productRevisionId", "productId", "tenantId") REFERENCES "SKURevision"("id", "productRevisionId", "productId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SKURevisionMedia" ADD CONSTRAINT "SKURevisionMedia_assetId_tenantId_fkey" FOREIGN KEY ("assetId", "tenantId") REFERENCES "MediaAsset"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevisionMedia" ADD CONSTRAINT "ListingRevisionMedia_listingRevisionId_productRevisionId_p_fkey" FOREIGN KEY ("listingRevisionId", "productRevisionId", "productId", "storeId", "tenantId") REFERENCES "ListingRevision"("id", "productRevisionId", "productId", "storeId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevisionMedia" ADD CONSTRAINT "ListingRevisionMedia_productMediaId_productRevisionId_tena_fkey" FOREIGN KEY ("productMediaId", "productRevisionId", "tenantId") REFERENCES "ProductRevisionMedia"("id", "productRevisionId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingRevisionMedia" ADD CONSTRAINT "ListingRevisionMedia_skuMediaId_productRevisionId_tenantId_fkey" FOREIGN KEY ("skuMediaId", "productRevisionId", "tenantId") REFERENCES "SKURevisionMedia"("id", "productRevisionId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Defense in depth: scope FKs, frozen reviewed facts and retained identities.
CREATE UNIQUE INDEX product_one_draft ON "ProductRevision"("productId") WHERE status='DRAFT';
CREATE UNIQUE INDEX product_one_published ON "ProductRevision"("productId") WHERE status='PUBLISHED';
CREATE UNIQUE INDEX listing_one_draft ON "ListingRevision"("listingId") WHERE status='DRAFT';
CREATE UNIQUE INDEX listing_one_published ON "ListingRevision"("listingId") WHERE status='PUBLISHED';
ALTER TABLE "CatalogRoute" DROP CONSTRAINT catalog_route_owner;
ALTER TABLE "CatalogRoute" ADD CONSTRAINT catalog_route_owner CHECK (
 ("ownerKind"::text='CATEGORY' AND "categoryId" IS NOT NULL AND "listingId" IS NULL) OR
 ("ownerKind"::text='LISTING' AND "listingId" IS NOT NULL AND "categoryId" IS NULL) OR
 ("ownerKind"::text IN ('LEGACY_PRODUCT','LEGACY_CATEGORY','RESERVED') AND "categoryId" IS NULL AND "listingId" IS NULL));
CREATE FUNCTION guard_listing_route_owner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."listingId" IS DISTINCT FROM OLD."listingId" THEN RAISE EXCEPTION 'Listing route owner is immutable' USING ERRCODE='23514'; END IF; RETURN NEW;END $$;
CREATE TRIGGER listing_route_owner_guard BEFORE UPDATE ON "CatalogRoute" FOR EACH ROW EXECUTE FUNCTION guard_listing_route_owner();

CREATE FUNCTION guard_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ignored text[]:=ARRAY['status','revision','updatedAt','updatedBy','approvedAt','approvedBy','publishedAt','publishedBy'];
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Catalog history is retained' USING ERRCODE='23514'; END IF;
 IF NEW.id<>OLD.id OR NEW."tenantId"<>OLD."tenantId" OR NEW.number<>OLD.number OR NEW."createdBy"<>OLD."createdBy" OR NEW."createdAt"<>OLD."createdAt" OR NEW."productId"<>OLD."productId" THEN RAISE EXCEPTION 'Revision identity is immutable' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='ProductRevision' THEN IF NEW."productTypeId"<>OLD."productTypeId" THEN RAISE EXCEPTION 'Type ownership is immutable' USING ERRCODE='23514'; END IF;
 ELSE IF NEW."listingId"<>OLD."listingId" OR NEW."storeId"<>OLD."storeId" THEN RAISE EXCEPTION 'Listing ownership is immutable' USING ERRCODE='23514'; END IF;END IF;
 IF OLD.status<>'DRAFT' AND to_jsonb(NEW)-ignored IS DISTINCT FROM to_jsonb(OLD)-ignored THEN RAISE EXCEPTION 'Reviewed catalog facts are immutable' USING ERRCODE='23514'; END IF;
 IF OLD."approvedAt" IS NOT NULL AND (NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt" OR NEW."approvedBy" IS DISTINCT FROM OLD."approvedBy") THEN RAISE EXCEPTION 'Approval evidence is immutable' USING ERRCODE='23514'; END IF;
 IF OLD."publishedAt" IS NOT NULL AND (NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" OR NEW."publishedBy" IS DISTINCT FROM OLD."publishedBy") THEN RAISE EXCEPTION 'Publication evidence is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.status<>OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status IN ('IN_REVIEW','ARCHIVED')) OR (OLD.status='IN_REVIEW' AND NEW.status IN ('DRAFT','APPROVED','ARCHIVED')) OR (OLD.status='APPROVED' AND NEW.status IN ('PUBLISHED','ARCHIVED')) OR (OLD.status='PUBLISHED' AND NEW.status='ARCHIVED')) THEN RAISE EXCEPTION 'Invalid catalog lifecycle transition' USING ERRCODE='23514'; END IF;
 IF NEW.status IN ('APPROVED','PUBLISHED') AND (NEW."approvedAt" IS NULL OR NEW."approvedBy" IS NULL) THEN RAISE EXCEPTION 'Approval evidence required' USING ERRCODE='23514'; END IF;
 IF NEW.status='PUBLISHED' AND (NEW."publishedAt" IS NULL OR NEW."publishedBy" IS NULL) THEN RAISE EXCEPTION 'Publication evidence required' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER product_revision_guard BEFORE UPDATE OR DELETE ON "ProductRevision" FOR EACH ROW EXECUTE FUNCTION guard_catalog_revision();
CREATE TRIGGER listing_revision_guard BEFORE UPDATE OR DELETE ON "ListingRevision" FOR EACH ROW EXECUTE FUNCTION guard_catalog_revision();
CREATE FUNCTION guard_catalog_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Catalog identities are retained' USING ERRCODE='23514'; END IF;
 IF to_jsonb(NEW)-ARRAY['revision','archived','publishedRevisionId'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['revision','archived','publishedRevisionId'] OR (OLD.archived AND NOT NEW.archived) THEN RAISE EXCEPTION 'Physical identity and ownership are immutable' USING ERRCODE='23514'; END IF;RETURN NEW;END $$;
CREATE TRIGGER product_identity_guard BEFORE UPDATE OR DELETE ON "Product" FOR EACH ROW EXECUTE FUNCTION guard_catalog_identity();
CREATE TRIGGER sku_identity_guard BEFORE UPDATE OR DELETE ON "SKU" FOR EACH ROW EXECUTE FUNCTION guard_catalog_identity();
CREATE TRIGGER listing_identity_guard BEFORE UPDATE OR DELETE ON "StoreListing" FOR EACH ROW EXECUTE FUNCTION guard_catalog_identity();

CREATE FUNCTION guard_catalog_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d jsonb; rid uuid; tid uuid; state "CatalogState";
BEGIN
 FOR d IN SELECT value FROM jsonb_array_elements(CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END) LOOP
 tid:=(d->>'tenantId')::uuid;
 IF TG_TABLE_NAME IN ('ListingCategory','ListingSKU') THEN SELECT status INTO state FROM "ListingRevision" WHERE id=(d->>'listingRevisionId')::uuid AND "tenantId"=tid FOR UPDATE;
 ELSE
 rid:=(d->>'productRevisionId')::uuid;
 IF TG_TABLE_NAME='ProductAttributeChoice' THEN SELECT "productRevisionId" INTO rid FROM "ProductAttributeValue" WHERE id=(d->>'valueId')::uuid AND "tenantId"=tid;END IF;
 IF TG_TABLE_NAME='SKUAttributeChoice' THEN SELECT "productRevisionId" INTO rid FROM "SKUAttributeValue" WHERE id=(d->>'valueId')::uuid AND "tenantId"=tid;END IF;
 SELECT status INTO state FROM "ProductRevision" WHERE id=rid AND "tenantId"=tid FOR UPDATE;
 END IF;
 IF state IS DISTINCT FROM 'DRAFT'::"CatalogState" THEN RAISE EXCEPTION 'Only draft children may change' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;END $$;
DO $$ DECLARE tbl text;BEGIN FOREACH tbl IN ARRAY ARRAY['ProductAttributeBinding','ProductAttributeValue','ProductAttributeChoice','SKURevision','SKUAttributeValue','SKUAttributeChoice','ListingCategory','ListingSKU'] LOOP EXECUTE format('CREATE TRIGGER catalog_child_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_catalog_child()',tbl);END LOOP;END $$;

CREATE FUNCTION guard_catalog_binding() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE b "ProductTypeAttribute"; version_id uuid;BEGIN
 SELECT * INTO b FROM "ProductTypeAttribute" WHERE id=NEW."schemaBindingId" AND "tenantId"=NEW."tenantId";
 SELECT "schemaVersionId" INTO version_id FROM "ProductRevision" WHERE id=NEW."productRevisionId" AND "tenantId"=NEW."tenantId";
 IF b.id IS NULL OR b."versionId"<>version_id OR b."attributeId"<>NEW."attributeId" OR b.level<>NEW.level OR b.required<>NEW.required OR b.snapshot<>NEW.snapshot OR (NEW.axis AND NOT b."variantAxis") THEN RAISE EXCEPTION 'Binding must preserve exact schema snapshot' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER catalog_binding_snapshot BEFORE INSERT OR UPDATE ON "ProductAttributeBinding" FOR EACH ROW EXECUTE FUNCTION guard_catalog_binding();
CREATE FUNCTION guard_catalog_value() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE b "ProductAttributeBinding"; expected text;BEGIN
 SELECT * INTO b FROM "ProductAttributeBinding" WHERE id=NEW."bindingId" AND "productRevisionId"=NEW."productRevisionId" AND "tenantId"=NEW."tenantId";
 expected:=CASE WHEN TG_TABLE_NAME='ProductAttributeValue' THEN 'PRODUCT' ELSE 'SKU' END;
 IF b.id IS NULL OR b.level::text<>expected OR b.snapshot->>'dataType'<>NEW."dataType"::text OR NEW.unit IS DISTINCT FROM b.snapshot->>'canonicalUnit' THEN RAISE EXCEPTION 'Typed scope or unit mismatch' USING ERRCODE='23514';END IF;
 IF NOT ((NEW."dataType"='TEXT' AND NEW."textValue" IS NOT NULL AND NEW."numberValue" IS NULL AND NEW."booleanValue" IS NULL) OR (NEW."dataType"='NUMBER' AND NEW."numberValue" IS NOT NULL AND NEW."textValue" IS NULL AND NEW."booleanValue" IS NULL) OR (NEW."dataType"='BOOLEAN' AND NEW."booleanValue" IS NOT NULL AND NEW."numberValue" IS NULL AND NEW."textValue" IS NULL) OR (NEW."dataType" IN ('SINGLE_SELECT','MULTI_SELECT') AND NEW."booleanValue" IS NULL AND NEW."numberValue" IS NULL AND NEW."textValue" IS NULL)) THEN RAISE EXCEPTION 'One typed scalar or choice representation required' USING ERRCODE='23514'; END IF;RETURN NEW;END $$;
CREATE TRIGGER product_typed_value BEFORE INSERT OR UPDATE ON "ProductAttributeValue" FOR EACH ROW EXECUTE FUNCTION guard_catalog_value();
CREATE TRIGGER sku_typed_value BEFORE INSERT OR UPDATE ON "SKUAttributeValue" FOR EACH ROW EXECUTE FUNCTION guard_catalog_value();
CREATE FUNCTION guard_catalog_choice() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE binding_id uuid; data_type "AttributeDataType"; snap jsonb; n bigint;BEGIN
 IF TG_TABLE_NAME='ProductAttributeChoice' THEN SELECT "bindingId","dataType" INTO binding_id,data_type FROM "ProductAttributeValue" WHERE id=NEW."valueId" AND "tenantId"=NEW."tenantId" FOR UPDATE;SELECT count(*) INTO n FROM "ProductAttributeChoice" WHERE "valueId"=NEW."valueId" AND "optionId"<>NEW."optionId";
 ELSE SELECT "bindingId","dataType" INTO binding_id,data_type FROM "SKUAttributeValue" WHERE id=NEW."valueId" AND "tenantId"=NEW."tenantId" FOR UPDATE;SELECT count(*) INTO n FROM "SKUAttributeChoice" WHERE "valueId"=NEW."valueId" AND "optionId"<>NEW."optionId";END IF;
 SELECT snapshot INTO snap FROM "ProductAttributeBinding" WHERE id=binding_id;
 IF data_type NOT IN ('SINGLE_SELECT','MULTI_SELECT') OR (data_type='SINGLE_SELECT' AND n>0) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(snap->'options') o WHERE o->>'id'=NEW."optionId"::text) THEN RAISE EXCEPTION 'Choice not in pinned vocabulary' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER product_typed_choice BEFORE INSERT OR UPDATE ON "ProductAttributeChoice" FOR EACH ROW EXECUTE FUNCTION guard_catalog_choice();
CREATE TRIGGER sku_typed_choice BEFORE INSERT OR UPDATE ON "SKUAttributeChoice" FOR EACH ROW EXECUTE FUNCTION guard_catalog_choice();
CREATE FUNCTION guard_sku_revision_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "SKU" s WHERE s.id=NEW."skuId" AND s."productId"=NEW."productId" AND s."tenantId"=NEW."tenantId" AND s."identityKey"=NEW."combinationKey") THEN RAISE EXCEPTION 'SKU revision physical identity mismatch' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER sku_revision_identity BEFORE INSERT OR UPDATE ON "SKURevision" FOR EACH ROW EXECUTE FUNCTION guard_sku_revision_identity();
CREATE FUNCTION check_catalog_pointer() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE root_id uuid; pointer uuid; current_id uuid; n bigint; product boolean;BEGIN
 product:=TG_TABLE_NAME IN ('Product','ProductRevision');IF TG_TABLE_NAME IN ('Product','StoreListing') THEN root_id:=NEW.id;ELSIF product THEN root_id:=NEW."productId";ELSE root_id:=NEW."listingId";END IF;
 IF product THEN SELECT "publishedRevisionId" INTO pointer FROM "Product" WHERE id=root_id;SELECT count(*) INTO n FROM "ProductRevision" WHERE "productId"=root_id AND status='PUBLISHED';SELECT id INTO current_id FROM "ProductRevision" WHERE "productId"=root_id AND status='PUBLISHED';
 ELSE SELECT "publishedRevisionId" INTO pointer FROM "StoreListing" WHERE id=root_id;SELECT count(*) INTO n FROM "ListingRevision" WHERE "listingId"=root_id AND status='PUBLISHED';SELECT id INTO current_id FROM "ListingRevision" WHERE "listingId"=root_id AND status='PUBLISHED';END IF;
 IF (n=0 AND pointer IS NOT NULL) OR (n=1 AND pointer IS DISTINCT FROM current_id) THEN RAISE EXCEPTION 'Publication pointer inconsistent' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER product_pointer AFTER INSERT OR UPDATE ON "Product" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_catalog_pointer();
CREATE CONSTRAINT TRIGGER product_revision_pointer AFTER INSERT OR UPDATE ON "ProductRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_catalog_pointer();
CREATE CONSTRAINT TRIGGER listing_pointer AFTER INSERT OR UPDATE ON "StoreListing" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_catalog_pointer();
CREATE CONSTRAINT TRIGGER listing_revision_pointer AFTER INSERT OR UPDATE ON "ListingRevision" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_catalog_pointer();
CREATE FUNCTION guard_schema_sku_policy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status<>'DRAFT' AND NEW."allowNoSku"<>OLD."allowNoSku" THEN RAISE EXCEPTION 'Reviewed SKU policy is immutable' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
CREATE TRIGGER schema_sku_policy BEFORE UPDATE ON "ProductTypeVersion" FOR EACH ROW EXECUTE FUNCTION guard_schema_sku_policy();

-- Optional media relationship contracts. No API creates assets in this milestone.
ALTER TABLE "ListingRevisionMedia" ADD CONSTRAINT one_media_source CHECK (("productMediaId" IS NOT NULL)::int+("skuMediaId" IS NOT NULL)::int=1);
DO $$ DECLARE tbl text;BEGIN FOREACH tbl IN ARRAY ARRAY['ProductRevisionMedia','SKURevisionMedia','ListingRevisionMedia'] LOOP EXECUTE format('ALTER TABLE %I ADD CONSTRAINT media_presentation_bounds CHECK ("sortOrder">=0 AND length("altText")<=500)',tbl);EXECUTE format('CREATE TRIGGER catalog_child_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_catalog_child()',tbl);END LOOP;END $$;
-- A store-presentation reference is a listing child, not a product child.
CREATE FUNCTION guard_listing_media() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE state "CatalogState";d jsonb;BEGIN
 FOR d IN SELECT value FROM jsonb_array_elements(CASE WHEN TG_OP='INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN TG_OP='DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END) LOOP
 SELECT status INTO state FROM "ListingRevision" WHERE id=(d->>'listingRevisionId')::uuid AND "tenantId"=(d->>'tenantId')::uuid AND "storeId"=(d->>'storeId')::uuid FOR UPDATE;
 IF state IS DISTINCT FROM 'DRAFT'::"CatalogState" THEN RAISE EXCEPTION 'Only draft presentation references may change' USING ERRCODE='23514';END IF;END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;END $$;
DROP TRIGGER catalog_child_guard ON "ListingRevisionMedia";
CREATE TRIGGER listing_media_guard BEFORE INSERT OR UPDATE OR DELETE ON "ListingRevisionMedia" FOR EACH ROW EXECUTE FUNCTION guard_listing_media();
CREATE FUNCTION guard_media_asset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Media asset identity must be retained' USING ERRCODE='23514';END IF;
 IF NEW.id<>OLD.id OR NEW."tenantId"<>OLD."tenantId" OR NEW.code<>OLD.code THEN RAISE EXCEPTION 'Media ownership is immutable' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM "ProductRevisionMedia" m JOIN "ProductRevision" r ON r.id=m."productRevisionId" WHERE m."assetId"=OLD.id AND r.status<>'DRAFT') OR EXISTS(SELECT 1 FROM "SKURevisionMedia" m JOIN "ProductRevision" r ON r.id=m."productRevisionId" WHERE m."assetId"=OLD.id AND r.status<>'DRAFT') THEN
  IF to_jsonb(NEW)-'archived' IS DISTINCT FROM to_jsonb(OLD)-'archived' THEN RAISE EXCEPTION 'Referenced media bytes and rights evidence are immutable' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER media_asset_guard BEFORE UPDATE OR DELETE ON "MediaAsset" FOR EACH ROW EXECUTE FUNCTION guard_media_asset();
ALTER TABLE "MediaAsset" ADD CONSTRAINT media_asset_metadata_shape CHECK (jsonb_typeof("rightsMetadata")='object' AND (width IS NULL OR width BETWEEN 1 AND 100000) AND (height IS NULL OR height BETWEEN 1 AND 100000));
DO $$ DECLARE tbl text;BEGIN FOREACH tbl IN ARRAY ARRAY['ProductRevisionMedia','SKURevisionMedia','ListingRevisionMedia'] LOOP EXECUTE format('ALTER TABLE %I ADD CONSTRAINT media_responsive_shape CHECK (jsonb_typeof(presentation)=''object'' AND pg_column_size(presentation)<=8192)',tbl);END LOOP;END $$;
