-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "country" TEXT,
    "city" TEXT,
    "addressLine" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "label" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "city" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'AIR',
    "status" TEXT NOT NULL DEFAULT 'REQUEST_RECEIVED',
    "statusUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "contentDescription" TEXT,
    "natureOfGoods" TEXT,
    "pieces" INTEGER,
    "weightKg" REAL,
    "lengthCm" REAL,
    "widthCm" REAL,
    "heightCm" REAL,
    "volumetricWeightKg" REAL,
    "taxableWeightKg" REAL,
    "declaredValue" REAL,
    "declaredCurrency" TEXT,
    "senderAddressId" TEXT,
    "recipientAddressId" TEXT,
    "handlingInstructions" TEXT,
    "holdFlag" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Package_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Package_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_senderAddressId_fkey" FOREIGN KEY ("senderAddressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Package_recipientAddressId_fkey" FOREIGN KEY ("recipientAddressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "groupage" BOOLEAN NOT NULL DEFAULT false,
    "originCountry" TEXT,
    "originCity" TEXT,
    "originCode" TEXT,
    "destCountry" TEXT,
    "destCity" TEXT,
    "destCode" TEXT,
    "providerId" TEXT,
    "flightNumber" TEXT,
    "vesselName" TEXT,
    "voyageNumber" TEXT,
    "containerNumber" TEXT,
    "containerType" TEXT,
    "awbNumber" TEXT,
    "blNumber" TEXT,
    "bookingDate" DATETIME,
    "plannedDepartureAt" DATETIME,
    "actualDepartureAt" DATETIME,
    "etaAt" DATETIME,
    "actualArrivalAt" DATETIME,
    "loadedAt" DATETIME,
    "unloadedAt" DATETIME,
    "releasedAt" DATETIME,
    "piecesCount" INTEGER,
    "palletsCount" INTEGER,
    "totalWeightKg" REAL,
    "totalVolumeM3" REAL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "freightCost" REAL,
    "handlingCost" REAL,
    "portFees" REAL,
    "customsFees" REAL,
    "storageCost" REAL,
    "otherFees" REAL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "TransportProvider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT,
    "shipmentId" TEXT,
    "status" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "agentId" TEXT,
    "providerId" TEXT,
    "integrationId" TEXT,
    "externalRef" TEXT,
    "fingerprint" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visiblePublic" BOOLEAN NOT NULL DEFAULT true,
    "supersededById" TEXT,
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackingEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "services" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProviderIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderIntegration_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "TransportProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "imported" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "details" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "TrackingSyncLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ProviderIntegration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ProviderIntegration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RateTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "originCountry" TEXT,
    "destCountry" TEXT,
    "providerId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RateLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateTableId" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unitPrice" REAL,
    "fixedAmount" REAL,
    "minAmount" REAL,
    "notes" TEXT,
    CONSTRAINT "RateLine_rateTableId_fkey" FOREIGN KEY ("rateTableId") REFERENCES "RateTable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'AIR',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "originCountry" TEXT,
    "originCity" TEXT,
    "destCountry" TEXT,
    "destCity" TEXT,
    "weightKg" REAL,
    "lengthCm" REAL,
    "widthCm" REAL,
    "heightCm" REAL,
    "volumeM3" REAL,
    "cargoType" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lines" TEXT,
    "currency" TEXT,
    "subtotal" REAL,
    "total" REAL,
    "estimateOnly" BOOLEAN NOT NULL DEFAULT true,
    "validUntil" DATETIME,
    "internalNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PUBLIC',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quoteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "lines" TEXT NOT NULL DEFAULT '[]',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL,
    "taxAmount" REAL,
    "total" REAL NOT NULL DEFAULT 0,
    "issuedAt" DATETIME,
    "dueAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "providerRef" TEXT,
    "receivedAt" DATETIME,
    "confirmedById" TEXT,
    "confirmedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "packageId" TEXT,
    "shipmentId" TEXT,
    "invoiceId" TEXT,
    "quoteId" TEXT,
    "customerId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'STAFF',
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "agentId" TEXT,
    "scheduledFor" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "deliveredAt" DATETIME,
    "recipientName" TEXT,
    "note" TEXT,
    "photoDocId" TEXT,
    "signatureDocId" TEXT,
    "confirmedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "to" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "relatedPackageId" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_trackingNumber_key" ON "Package"("trackingNumber");

-- CreateIndex
CREATE INDEX "Package_customerId_idx" ON "Package"("customerId");

-- CreateIndex
CREATE INDEX "Package_shipmentId_idx" ON "Package"("shipmentId");

-- CreateIndex
CREATE INDEX "Package_status_idx" ON "Package"("status");

-- CreateIndex
CREATE INDEX "Package_mode_idx" ON "Package"("mode");

-- CreateIndex
CREATE INDEX "Package_createdAt_idx" ON "Package"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_reference_key" ON "Shipment"("reference");

-- CreateIndex
CREATE INDEX "Shipment_type_idx" ON "Shipment"("type");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_containerNumber_idx" ON "Shipment"("containerNumber");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_packageId_occurredAt_idx" ON "TrackingEvent"("packageId", "occurredAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_shipmentId_occurredAt_idx" ON "TrackingEvent"("shipmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_status_idx" ON "TrackingEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEvent_fingerprint_key" ON "TrackingEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "TransportProvider_type_idx" ON "TransportProvider"("type");

-- CreateIndex
CREATE INDEX "ProviderIntegration_providerId_idx" ON "ProviderIntegration"("providerId");

-- CreateIndex
CREATE INDEX "TrackingSyncLog_integrationId_startedAt_idx" ON "TrackingSyncLog"("integrationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_integrationId_externalId_key" ON "WebhookEvent"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "Destination_type_idx" ON "Destination"("type");

-- CreateIndex
CREATE INDEX "Destination_country_idx" ON "Destination"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_type_name_country_key" ON "Destination"("type", "name", "country");

-- CreateIndex
CREATE INDEX "RateTable_mode_active_idx" ON "RateTable"("mode", "active");

-- CreateIndex
CREATE INDEX "RateLine_rateTableId_idx" ON "RateLine"("rateTableId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Document_packageId_idx" ON "Document"("packageId");

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");

-- CreateIndex
CREATE INDEX "Document_kind_idx" ON "Document"("kind");

-- CreateIndex
CREATE INDEX "Delivery_agentId_status_idx" ON "Delivery"("agentId", "status");

-- CreateIndex
CREATE INDEX "Delivery_packageId_idx" ON "Delivery"("packageId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_eventKey_idx" ON "Notification"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_eventKey_channel_key" ON "NotificationTemplate"("eventKey", "channel");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
