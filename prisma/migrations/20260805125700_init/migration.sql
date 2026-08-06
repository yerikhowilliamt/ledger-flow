-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transaction_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "id" DROP DEFAULT;
