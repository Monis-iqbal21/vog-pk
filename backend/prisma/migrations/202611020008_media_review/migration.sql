CREATE TYPE "MediaReviewDecision" AS ENUM ('APPROVE_PUBLIC','APPROVE_DEVELOPMENT','REJECT');
CREATE TABLE "MediaReview" (
 id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "assetId" UUID NOT NULL,
 "assetRevision" INTEGER NOT NULL CHECK ("assetRevision">0), decision "MediaReviewDecision" NOT NULL,
 "reviewerId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 license VARCHAR(500) NOT NULL, attribution VARCHAR(500) NOT NULL,
 "evidenceUrl" VARCHAR(1000), "evidenceNote" VARCHAR(1000) NOT NULL,
 conditions VARCHAR(1000) NOT NULL, "sourceSnapshot" JSONB NOT NULL,
 CONSTRAINT "MediaReview_assetId_tenantId_fkey" FOREIGN KEY ("assetId","tenantId") REFERENCES "MediaAsset"(id,"tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "MediaReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "AdminUser"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MediaReview_assetId_assetRevision_key" ON "MediaReview"("assetId","assetRevision");
CREATE INDEX "MediaReview_tenantId_assetId_createdAt_idx" ON "MediaReview"("tenantId","assetId","createdAt");
CREATE TRIGGER media_review_retained BEFORE UPDATE OR DELETE ON "MediaReview" FOR EACH ROW EXECUTE FUNCTION retain_operational_evidence();
