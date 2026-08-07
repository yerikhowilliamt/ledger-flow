-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "reconciliation_reports" (
    "id" UUID NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_accounts_checked" INTEGER NOT NULL,
    "discrepancies_found" INTEGER NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "reconciliation_reports_pkey" PRIMARY KEY ("id")
);
