-- AlterTable: Add updated_at to transaction_entries
ALTER TABLE "transaction_entries" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: Composite index for efficient cursor-based pagination
CREATE INDEX "transaction_entries_account_id_created_at_idx" ON "transaction_entries"("account_id", "created_at");

-- CreateIndex: Composite index for outbox polling
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");
