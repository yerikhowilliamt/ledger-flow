# Operational Runbook & Disaster Recovery Playbook

## Overview
Panduan operasional dan prosedur penanganan insiden produksi untuk LedgerFlow microservices.

---

## Scenario A: Stalled Outbox Events
**Gejala**: Outbox events di tabel `outbox_events` tertahan dalam status `PENDING` akibat RabbitMQ outage / network drop.

### Procedures
1. Identifikasi jumlah event yang tertahan:
   ```sql
   SELECT COUNT(*), min(created_at) 
   FROM outbox_events 
   WHERE published = false;
   ```
2. Pastikan koneksi ke RabbitMQ server pulih.
3. OutboxRelayWorker di `transactions-service` secara otomatis melakukan polling (tiap 5 detik) untuk mempublikasikan ulang event yang `published = false`.
4. Verifikasi status publikasi event:
   ```sql
   SELECT published, count(*) 
   FROM outbox_events 
   GROUP BY published;
   ```

---

## Scenario B: Redriving Dead-Letter Queue (DLQ)
**Gejala**: Message gagal diproses oleh `notification-service` setelah retries dan masuk ke Dead-Letter Queue `notification.audit-log.dlq`.

### Procedures
1. Periksa pesan di Dead Letter Queue via RabbitMQ CLI / HTTP API:
   ```bash
   curl -u guest:guest -X GET http://localhost:15672/api/queues/%2F/notification.audit-log.dlq/get \
     -H "content-type: application/json" \
     -d '{"count": 10, "ackmode": "ack_requeue_false", "encoding": "auto"}'
   ```
2. Analisis root cause kegagalan dari stack trace log `notification-service`.
3. Setelah bug/issue diperbaiki, redrive messages dari DLQ kembali ke main exchange `ledger.events` dengan routing key `transaction.completed`:
   ```bash
   # CLI tool or management UI action to publish message back to exchange: ledger.events
   ```

---

## Scenario C: System-Wide Balance Reconciliation
**Gejala**: Ketidaksesuaian saldo akun atau audit trail mismatch.

### Reconciliation Query
Eksekusi query SQL berikut pada Database PostgreSQL untuk memastikan total debit sama dengan total kredit (Double-Entry Bookkeeping Check):

```sql
SELECT 
  SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) AS total_debits,
  SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) AS total_credits,
  SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) AS imbalance
FROM transaction_entries;
```

**Hasil Ekspektasi**:
`imbalance` harus bernilai `0`.

---

## Zero-Downtime Deployment & Database Migration
1. Jalankan migrasi database sebelum mendepoy aplikasi baru:
   ```bash
   npm run prisma:deploy
   ```
2. Container application entrypoint secara otomatis mengeksekusi `npx prisma migrate deploy` sebelum memulai HTTP listener.
