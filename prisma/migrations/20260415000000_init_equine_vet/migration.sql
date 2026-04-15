-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "PreferredChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "TriageStatus" AS ENUM ('NEW', 'PARSED', 'NEEDS_INFO', 'TRIAGED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('URGENT', 'SOON', 'ROUTINE');

-- CreateEnum
CREATE TYPE "PreferredTimeBand" AS ENUM ('AM', 'PM', 'ANY');

-- CreateEnum
CREATE TYPE "PlanningStatus" AS ENUM ('UNTRIAGED', 'READY_FOR_REVIEW', 'PLANNING_POOL', 'CLUSTERED', 'PROPOSED', 'BOOKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TriageTaskType" AS ENUM ('URGENT_REVIEW', 'ASK_FOR_POSTCODE', 'ASK_HORSE_COUNT', 'CLARIFY_SYMPTOMS', 'MANUAL_CLASSIFICATION');

-- CreateEnum
CREATE TYPE "TriageTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "RouteRunStatus" AS ENUM ('DRAFT', 'PROPOSED', 'APPROVED', 'BOOKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ConfirmationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_NEEDED', 'PENDING', 'SENT', 'PAID');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobilePhone" TEXT,
    "email" TEXT,
    "preferredChannel" "PreferredChannel" NOT NULL DEFAULT 'WHATSAPP',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Yard" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "yardName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "town" TEXT NOT NULL,
    "county" TEXT,
    "postcode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accessNotes" TEXT,
    "areaLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Yard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horse" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "primaryYardId" TEXT,
    "horseName" TEXT NOT NULL,
    "age" INTEGER,
    "notes" TEXT,
    "dentalDueDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalMessageId" TEXT,
    "customerId" TEXT,
    "yardId" TEXT,
    "sourceFrom" TEXT NOT NULL,
    "subject" TEXT,
    "rawText" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "threadKey" TEXT,
    "triageStatus" "TriageStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryMessage" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "Channel" NOT NULL,
    "messageText" TEXT NOT NULL,
    "sentOrReceivedAt" TIMESTAMP(3) NOT NULL,
    "externalMessageId" TEXT,

    CONSTRAINT "EnquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitRequest" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT,
    "customerId" TEXT NOT NULL,
    "yardId" TEXT,
    "requestType" "RequestType" NOT NULL,
    "urgencyLevel" "UrgencyLevel" NOT NULL DEFAULT 'ROUTINE',
    "clinicalFlags" TEXT[],
    "horseCount" INTEGER,
    "specificHorses" TEXT[],
    "preferredDays" TEXT[],
    "preferredTimeBand" "PreferredTimeBand" NOT NULL DEFAULT 'ANY',
    "earliestBookDate" TIMESTAMP(3),
    "latestBookDate" TIMESTAMP(3),
    "needsMoreInfo" BOOLEAN NOT NULL DEFAULT false,
    "planningStatus" "PlanningStatus" NOT NULL DEFAULT 'UNTRIAGED',
    "estimatedDurationMinutes" INTEGER,
    "revenueEstimate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageTask" (
    "id" TEXT NOT NULL,
    "visitRequestId" TEXT NOT NULL,
    "taskType" "TriageTaskType" NOT NULL,
    "assignedTo" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TriageTaskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteRun" (
    "id" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "homeBaseAddress" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" "RouteRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDistanceMeters" INTEGER,
    "totalTravelMinutes" INTEGER,
    "totalVisitMinutes" INTEGER,
    "totalJobs" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteRunStop" (
    "id" TEXT NOT NULL,
    "routeRunId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "visitRequestId" TEXT,
    "yardId" TEXT NOT NULL,
    "plannedArrival" TIMESTAMP(3),
    "plannedDeparture" TIMESTAMP(3),
    "serviceMinutes" INTEGER,
    "travelFromPrevMinutes" INTEGER,
    "travelFromPrevMeters" INTEGER,
    "stopStatus" "StopStatus" NOT NULL DEFAULT 'PLANNED',
    "optimizationScore" DOUBLE PRECISION,

    CONSTRAINT "RouteRunStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "visitRequestId" TEXT NOT NULL,
    "routeRunId" TEXT,
    "appointmentStart" TIMESTAMP(3) NOT NULL,
    "appointmentEnd" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "confirmationChannel" "ConfirmationChannel",
    "confirmationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitOutcome" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpDueDate" TIMESTAMP(3),
    "nextDentalDueDate" TIMESTAMP(3),
    "invoiceStatus" "InvoiceStatus" NOT NULL DEFAULT 'NOT_NEEDED',

    CONSTRAINT "VisitOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_mobilePhone_key" ON "Customer"("mobilePhone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "Yard_customerId_idx" ON "Yard"("customerId");

-- CreateIndex
CREATE INDEX "Yard_postcode_idx" ON "Yard"("postcode");

-- CreateIndex
CREATE INDEX "Yard_areaLabel_idx" ON "Yard"("areaLabel");

-- CreateIndex
CREATE INDEX "Horse_customerId_idx" ON "Horse"("customerId");

-- CreateIndex
CREATE INDEX "Horse_primaryYardId_idx" ON "Horse"("primaryYardId");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_externalMessageId_key" ON "Enquiry"("externalMessageId");

-- CreateIndex
CREATE INDEX "Enquiry_customerId_idx" ON "Enquiry"("customerId");

-- CreateIndex
CREATE INDEX "Enquiry_triageStatus_idx" ON "Enquiry"("triageStatus");

-- CreateIndex
CREATE INDEX "Enquiry_receivedAt_idx" ON "Enquiry"("receivedAt");

-- CreateIndex
CREATE INDEX "EnquiryMessage_enquiryId_idx" ON "EnquiryMessage"("enquiryId");

-- CreateIndex
CREATE INDEX "VisitRequest_customerId_idx" ON "VisitRequest"("customerId");

-- CreateIndex
CREATE INDEX "VisitRequest_planningStatus_idx" ON "VisitRequest"("planningStatus");

-- CreateIndex
CREATE INDEX "VisitRequest_urgencyLevel_idx" ON "VisitRequest"("urgencyLevel");

-- CreateIndex
CREATE INDEX "TriageTask_visitRequestId_idx" ON "TriageTask"("visitRequestId");

-- CreateIndex
CREATE INDEX "TriageTask_status_idx" ON "TriageTask"("status");

-- CreateIndex
CREATE INDEX "RouteRun_runDate_idx" ON "RouteRun"("runDate");

-- CreateIndex
CREATE INDEX "RouteRun_status_idx" ON "RouteRun"("status");

-- CreateIndex
CREATE INDEX "RouteRunStop_routeRunId_idx" ON "RouteRunStop"("routeRunId");

-- CreateIndex
CREATE INDEX "Appointment_visitRequestId_idx" ON "Appointment"("visitRequestId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_appointmentStart_idx" ON "Appointment"("appointmentStart");

-- CreateIndex
CREATE UNIQUE INDEX "VisitOutcome_appointmentId_key" ON "VisitOutcome"("appointmentId");

-- AddForeignKey
ALTER TABLE "Yard" ADD CONSTRAINT "Yard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_primaryYardId_fkey" FOREIGN KEY ("primaryYardId") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMessage" ADD CONSTRAINT "EnquiryMessage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitRequest" ADD CONSTRAINT "VisitRequest_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageTask" ADD CONSTRAINT "TriageTask_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteRunStop" ADD CONSTRAINT "RouteRunStop_routeRunId_fkey" FOREIGN KEY ("routeRunId") REFERENCES "RouteRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteRunStop" ADD CONSTRAINT "RouteRunStop_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteRunStop" ADD CONSTRAINT "RouteRunStop_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "Yard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_visitRequestId_fkey" FOREIGN KEY ("visitRequestId") REFERENCES "VisitRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_routeRunId_fkey" FOREIGN KEY ("routeRunId") REFERENCES "RouteRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitOutcome" ADD CONSTRAINT "VisitOutcome_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

