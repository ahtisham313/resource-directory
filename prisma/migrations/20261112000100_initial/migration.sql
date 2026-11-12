-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ADMIN_JOINED', 'SUBMISSION_RECEIVED', 'GENERAL');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'URL', 'SINGLE_SELECT', 'RADIO', 'MULTI_SELECT', 'TIME', 'DAY_OF_WEEK', 'IMAGE_UPLOAD', 'SECTION_HEADING', 'DISPLAY_TEXT', 'TERMS_ACKNOWLEDGEMENT');

-- CreateEnum
CREATE TYPE "DisplayMapping" AS ENUM ('TITLE', 'PROVIDER_NAME', 'CATEGORY', 'SPECIALTY', 'DESCRIPTION', 'STREET_ADDRESS', 'CITY', 'STATE', 'ZIP_CODE', 'PHONE', 'WEBSITE', 'HOURS_START_DAY', 'HOURS_END_DAY', 'HOURS_START_TIME', 'HOURS_END_TIME', 'TIME_ZONE', 'AGE_RANGE', 'AVERAGE_WAIT', 'IMAGE');

-- CreateEnum
CREATE TYPE "OptionKind" AS ENUM ('STANDARD', 'OTHER', 'NA');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('CATEGORY_VIEW', 'CATEGORY_SEARCH', 'CATEGORY_SELECTION');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "invitedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "introText" TEXT NOT NULL,
    "closingMessage" TEXT NOT NULL,
    "termsText" TEXT NOT NULL,
    "deadlineText" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedVersionId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveySection" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SurveySection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyField" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL,
    "helperText" TEXT,
    "placeholder" TEXT,
    "content" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "validationRules" JSONB NOT NULL,
    "displayMapping" "DisplayMapping",
    "allowsOther" BOOLEAN NOT NULL DEFAULT false,
    "allowsNA" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SurveyField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyFieldOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "OptionKind" NOT NULL DEFAULT 'STANDARD',

    CONSTRAINT "SurveyFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyVersion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "surveyVersionId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedImageKey" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "sourceResponseId" TEXT NOT NULL,
    "surveyVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT,
    "description" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "officeHours" JSONB NOT NULL,
    "timeZone" TEXT NOT NULL,
    "ageRange" TEXT[],
    "averageWait" TEXT,
    "imageKey" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currentAnswers" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceCategory" (
    "resourceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ResourceCategory_pkey" PRIMARY KEY ("resourceId","categoryId")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "categoryId" TEXT,
    "resourceId" TEXT,
    "anonymousSessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_tokenHash_key" ON "AdminInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminInvitation_email_expiresAt_idx" ON "AdminInvitation"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminInvitation_invitedById_idx" ON "AdminInvitation"("invitedById");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_publishedVersionId_key" ON "Survey"("publishedVersionId");

-- CreateIndex
CREATE INDEX "Survey_status_deletedAt_idx" ON "Survey"("status", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SurveySection_id_surveyId_key" ON "SurveySection"("id", "surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveySection_surveyId_order_key" ON "SurveySection"("surveyId", "order");

-- CreateIndex
CREATE INDEX "SurveyField_surveyId_displayMapping_idx" ON "SurveyField"("surveyId", "displayMapping");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyField_surveyId_fieldKey_key" ON "SurveyField"("surveyId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyField_sectionId_order_key" ON "SurveyField"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyFieldOption_fieldId_value_key" ON "SurveyFieldOption"("fieldId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyFieldOption_fieldId_order_key" ON "SurveyFieldOption"("fieldId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyVersion_id_surveyId_key" ON "SurveyVersion"("id", "surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyVersion_surveyId_versionNumber_key" ON "SurveyVersion"("surveyId", "versionNumber");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_status_createdAt_id_idx" ON "SurveyResponse"("surveyId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SurveyResponse_status_createdAt_id_idx" ON "SurveyResponse"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyVersionId_surveyId_idx" ON "SurveyResponse"("surveyVersionId", "surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_reviewerId_idx" ON "SurveyResponse"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_id_surveyVersionId_key" ON "SurveyResponse"("id", "surveyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_sourceResponseId_key" ON "Resource"("sourceResponseId");

-- CreateIndex
CREATE INDEX "Resource_active_name_id_idx" ON "Resource"("active", "name", "id");

-- CreateIndex
CREATE INDEX "Resource_active_city_state_idx" ON "Resource"("active", "city", "state");

-- CreateIndex
CREATE INDEX "Resource_active_address_idx" ON "Resource"("active", "address");

-- CreateIndex
CREATE INDEX "Resource_surveyVersionId_idx" ON "Resource"("surveyVersionId");

-- CreateIndex
CREATE INDEX "Resource_latitude_longitude_idx" ON "Resource"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_sourceResponseId_surveyVersionId_key" ON "Resource"("sourceResponseId", "surveyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "ResourceCategory_categoryId_resourceId_idx" ON "ResourceCategory"("categoryId", "resourceId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_categoryId_createdAt_idx" ON "AnalyticsEvent"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_resourceId_idx" ON "AnalyticsEvent"("resourceId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_publishedVersionId_id_fkey" FOREIGN KEY ("publishedVersionId", "id") REFERENCES "SurveyVersion"("id", "surveyId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SurveySection" ADD CONSTRAINT "SurveySection_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyField" ADD CONSTRAINT "SurveyField_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyField" ADD CONSTRAINT "SurveyField_sectionId_surveyId_fkey" FOREIGN KEY ("sectionId", "surveyId") REFERENCES "SurveySection"("id", "surveyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyFieldOption" ADD CONSTRAINT "SurveyFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SurveyField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyVersion" ADD CONSTRAINT "SurveyVersion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyVersionId_surveyId_fkey" FOREIGN KEY ("surveyVersionId", "surveyId") REFERENCES "SurveyVersion"("id", "surveyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_sourceResponseId_surveyVersionId_fkey" FOREIGN KEY ("sourceResponseId", "surveyVersionId") REFERENCES "SurveyResponse"("id", "surveyVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCategory" ADD CONSTRAINT "ResourceCategory_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceCategory" ADD CONSTRAINT "ResourceCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
