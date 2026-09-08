-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "sourceListingId" TEXT NOT NULL,
    "model" TEXT,
    "year" INTEGER,
    "askingPrice" REAL,
    "availability" TEXT NOT NULL,
    "saleType" TEXT NOT NULL,
    "vehicleState" TEXT,
    "driveMinutes" REAL,
    "groupId" TEXT,
    "firstSeenAt" DATETIME NOT NULL,
    "lastObservedAt" DATETIME NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" REAL,
    "observedAt" DATETIME NOT NULL,
    "evidenceRef" TEXT,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT
);

-- CreateTable
CREATE TABLE "Lease" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'personal',
    "payload" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "defaultsVersion" INTEGER NOT NULL,
    "schedule" TEXT NOT NULL,
    "delivery" TEXT NOT NULL DEFAULT 'in-app',
    "baseline" TEXT,
    "evaluatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "GeoCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GroupReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingIds" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Listing_model_year_availability_idx" ON "Listing"("model", "year", "availability");

-- CreateIndex
CREATE INDEX "Listing_groupId_idx" ON "Listing"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_sourceId_sourceListingId_key" ON "Listing"("sourceId", "sourceListingId");

-- CreateIndex
CREATE INDEX "Observation_listingId_observedAt_idx" ON "Observation"("listingId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Observation_listingId_kind_observedAt_key" ON "Observation"("listingId", "kind", "observedAt");

