-- CreateEnum
CREATE TYPE "AuthorizationScope" AS ENUM ('PLATFORM', 'TENANT', 'STORE');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "scopeKind" "AuthorizationScope",
ADD COLUMN     "storeId" UUID,
ADD COLUMN     "tenantId" UUID;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyStoreBridge" (
    "key" VARCHAR(20) NOT NULL,
    "storeId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,

    CONSTRAINT "LegacyStoreBridge_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("tenantId","userId")
);

-- CreateTable
CREATE TABLE "StoreMembership" (
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StoreMembership_pkey" PRIMARY KEY ("tenantId","storeId","userId")
);

-- CreateTable
CREATE TABLE "ScopedRole" (
    "id" UUID NOT NULL,
    "scopeKind" "AuthorizationScope" NOT NULL,
    "tenantId" UUID,
    "storeId" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "owner" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScopedRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionScope" (
    "permissionId" UUID NOT NULL,
    "scopeKind" "AuthorizationScope" NOT NULL,

    CONSTRAINT "PermissionScope_pkey" PRIMARY KEY ("permissionId","scopeKind")
);

-- CreateTable
CREATE TABLE "ScopedRolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "scopeKind" "AuthorizationScope" NOT NULL,
    "canDelegate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScopedRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "PlatformRoleAssignment" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "scopeKind" "AuthorizationScope" NOT NULL DEFAULT 'PLATFORM',

    CONSTRAINT "PlatformRoleAssignment_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "TenantRoleAssignment" (
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "scopeKind" "AuthorizationScope" NOT NULL DEFAULT 'TENANT',

    CONSTRAINT "TenantRoleAssignment_pkey" PRIMARY KEY ("tenantId","userId","roleId")
);

-- CreateTable
CREATE TABLE "StoreRoleAssignment" (
    "tenantId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "scopeKind" "AuthorizationScope" NOT NULL DEFAULT 'STORE',

    CONSTRAINT "StoreRoleAssignment_pkey" PRIMARY KEY ("tenantId","storeId","userId","roleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_id_tenantId_key" ON "Store"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_tenantId_slug_key" ON "Store"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyStoreBridge_storeId_key" ON "LegacyStoreBridge"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyStoreBridge_storeId_tenantId_key" ON "LegacyStoreBridge"("storeId", "tenantId");

-- CreateIndex
CREATE INDEX "TenantMembership_userId_active_idx" ON "TenantMembership"("userId", "active");

-- CreateIndex
CREATE INDEX "StoreMembership_userId_active_idx" ON "StoreMembership"("userId", "active");

-- CreateIndex
CREATE INDEX "ScopedRole_tenantId_storeId_idx" ON "ScopedRole"("tenantId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopedRole_id_scopeKind_key" ON "ScopedRole"("id", "scopeKind");

-- CreateIndex
CREATE UNIQUE INDEX "ScopedRole_id_tenantId_scopeKind_key" ON "ScopedRole"("id", "tenantId", "scopeKind");

-- CreateIndex
CREATE UNIQUE INDEX "ScopedRole_id_tenantId_storeId_scopeKind_key" ON "ScopedRole"("id", "tenantId", "storeId", "scopeKind");

-- CreateIndex
CREATE INDEX "ScopedRolePermission_permissionId_scopeKind_idx" ON "ScopedRolePermission"("permissionId", "scopeKind");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_storeId_createdAt_idx" ON "AuditLog"("tenantId", "storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyStoreBridge" ADD CONSTRAINT "LegacyStoreBridge_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMembership" ADD CONSTRAINT "StoreMembership_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "TenantMembership"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedRole" ADD CONSTRAINT "ScopedRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedRole" ADD CONSTRAINT "ScopedRole_storeId_tenantId_fkey" FOREIGN KEY ("storeId", "tenantId") REFERENCES "Store"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionScope" ADD CONSTRAINT "PermissionScope_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedRolePermission" ADD CONSTRAINT "ScopedRolePermission_roleId_scopeKind_fkey" FOREIGN KEY ("roleId", "scopeKind") REFERENCES "ScopedRole"("id", "scopeKind") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedRolePermission" ADD CONSTRAINT "ScopedRolePermission_permissionId_scopeKind_fkey" FOREIGN KEY ("permissionId", "scopeKind") REFERENCES "PermissionScope"("permissionId", "scopeKind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_roleId_scopeKind_fkey" FOREIGN KEY ("roleId", "scopeKind") REFERENCES "ScopedRole"("id", "scopeKind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRoleAssignment" ADD CONSTRAINT "TenantRoleAssignment_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "TenantMembership"("tenantId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRoleAssignment" ADD CONSTRAINT "TenantRoleAssignment_roleId_tenantId_scopeKind_fkey" FOREIGN KEY ("roleId", "tenantId", "scopeKind") REFERENCES "ScopedRole"("id", "tenantId", "scopeKind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRoleAssignment" ADD CONSTRAINT "StoreRoleAssignment_tenantId_storeId_userId_fkey" FOREIGN KEY ("tenantId", "storeId", "userId") REFERENCES "StoreMembership"("tenantId", "storeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRoleAssignment" ADD CONSTRAINT "StoreRoleAssignment_roleId_tenantId_storeId_scopeKind_fkey" FOREIGN KEY ("roleId", "tenantId", "storeId", "scopeKind") REFERENCES "ScopedRole"("id", "tenantId", "storeId", "scopeKind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express these CHECK/partial-index constraints. Keep them in SQL.
ALTER TABLE "LegacyStoreBridge" ADD CONSTRAINT "legacy_default_only" CHECK ("key" = 'default');
ALTER TABLE "ScopedRole" ADD CONSTRAINT "scoped_role_ownership" CHECK (
  ("scopeKind" = 'PLATFORM' AND "tenantId" IS NULL AND "storeId" IS NULL) OR
  ("scopeKind" = 'TENANT' AND "tenantId" IS NOT NULL AND "storeId" IS NULL) OR
  ("scopeKind" = 'STORE' AND "tenantId" IS NOT NULL AND "storeId" IS NOT NULL)
);
ALTER TABLE "ScopedRole" ADD CONSTRAINT "owner_is_protected_store_role" CHECK (NOT "owner" OR ("system" AND "scopeKind" = 'STORE'));
CREATE UNIQUE INDEX "scoped_platform_code" ON "ScopedRole" ("code") WHERE "scopeKind" = 'PLATFORM';
CREATE UNIQUE INDEX "scoped_tenant_code" ON "ScopedRole" ("tenantId", "code") WHERE "scopeKind" = 'TENANT';
CREATE UNIQUE INDEX "scoped_store_code" ON "ScopedRole" ("tenantId", "storeId", "code") WHERE "scopeKind" = 'STORE';
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "platform_assignment_scope" CHECK ("scopeKind" = 'PLATFORM');
ALTER TABLE "TenantRoleAssignment" ADD CONSTRAINT "tenant_assignment_scope" CHECK ("scopeKind" = 'TENANT');
ALTER TABLE "StoreRoleAssignment" ADD CONSTRAINT "store_assignment_scope" CHECK ("scopeKind" = 'STORE');
ALTER TABLE "AuditLog" ADD CONSTRAINT "audit_scope_ownership" CHECK (
  ("scopeKind" IS NULL AND "tenantId" IS NULL AND "storeId" IS NULL) OR
  ("scopeKind" IS NOT NULL AND (
    ("scopeKind" = 'PLATFORM' AND "tenantId" IS NULL AND "storeId" IS NULL) OR
    ("scopeKind" = 'TENANT' AND "tenantId" IS NOT NULL AND "storeId" IS NULL) OR
    ("scopeKind" = 'STORE' AND "tenantId" IS NOT NULL AND "storeId" IS NOT NULL)
  ))
);
