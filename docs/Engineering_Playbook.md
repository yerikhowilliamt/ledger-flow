# Engineering Playbook
## LedgerFlow

**Maintainer:** Yerikho William Tasilima
**Last Updated:** July 2026

---

## 1. Core Engineering Principles

Prinsip-prinsip ini mendasari setiap keputusan teknis di project ini. Ketika terjadi trade-off, prinsip ini yang jadi acuan.

1. **Correctness over convenience** — Untuk sistem finansial, kebenaran data (saldo, jejak transaksi) selalu diprioritaskan di atas kemudahan implementasi atau kecepatan development.
2. **Explicit over implicit** — Setiap kontrak (API request/response, event payload) harus didefinisikan secara eksplisit lewat schema (Zod), bukan diasumsikan.
3. **Fail loud, not silent** — Kegagalan (error, event yang tidak terproses) harus terlihat jelas lewat logging/monitoring, bukan tertelan diam-diam.
4. **Idempotent by default** — Setiap operasi yang berpotensi diulang (retry) harus aman dijalankan berkali-kali tanpa efek samping ganda.
5. **Auditability is not optional** — Setiap perubahan state finansial harus dapat ditelusuri: siapa, kapan, dan kenapa terjadi.

---

## 2. Code Style & Naming Convention

**Prinsip:** Konsistensi penamaan mempercepat pembacaan kode oleh siapa pun, termasuk diri sendiri di masa depan.

| Elemen | Konvensi | Contoh |
|---|---|---|
| File | kebab-case | `transaction.service.ts` |
| Class | PascalCase | `TransactionService` |
| Interface/Type | PascalCase, prefix `I` tidak digunakan | `TransferRequest` |
| Function/Method | camelCase, verb pertama | `createTransfer()`, `validateBalance()` |
| Variable | camelCase | `accountBalance` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Database table | snake_case, plural | `transaction_entries` |
| Environment variable | UPPER_SNAKE_CASE | `DATABASE_URL` |

Linting & formatting menggunakan **ESLint + Prettier**, dijalankan otomatis lewat pre-commit hook (Husky) agar konsistensi terjaga tanpa perlu review manual soal style.

---

## 3. Project & Module Structure

**Prinsip:** Setiap module harus punya tanggung jawab yang jelas dan terpisah (separation of concerns), mengikuti pola layered architecture ala NestJS.

Setiap service (`accounts-service`, `transactions-service`, `notification-service`) mengikuti struktur internal yang sama:

```
src/
├── modules/
│   └── transaction/
│       ├── transaction.controller.ts   # Menerima HTTP request, tidak ada business logic
│       ├── transaction.service.ts      # Business logic inti (ledger, validasi)
│       ├── transaction.repository.ts   # Query ke database (Prisma)
│       ├── transaction.schema.ts       # Zod schema untuk request/response
│       └── transaction.module.ts
├── events/
│   ├── publishers/                     # Publish event ke RabbitMQ
│   └── consumers/                      # Consume event dari RabbitMQ
├── common/
│   ├── filters/                        # Exception filters
│   ├── interceptors/                   # Logging, transform response
│   └── decorators/
└── main.ts
```

**Aturan:**
- Controller **tidak boleh** memanggil Prisma langsung — harus lewat Service → Repository
- Business logic (validasi saldo, perhitungan) hanya boleh ada di Service layer
- Setiap module wajib punya schema Zod sendiri, tidak boleh reuse schema module lain secara langsung (gunakan `packages/shared-types` untuk yang benar-benar shared)

---

## 4. Database & Transaction Handling

**Prinsip:** Correctness over convenience — semua operasi yang mengubah saldo wajib atomic dan aman dari race condition.

### Aturan
- Setiap transfer dana **wajib** dibungkus dalam satu Prisma transaction (`prisma.$transaction`), mencakup: validasi saldo, insert transaction entries (debit & credit), update saldo akun.
- Gunakan **row-level locking** (`SELECT ... FOR UPDATE`, via `prisma.$queryRaw` bila diperlukan) saat membaca saldo akun sebelum melakukan update, untuk mencegah race condition saat dua transfer terjadi bersamaan pada akun yang sama.
- Migration database dikelola lewat Prisma Migrate, setiap perubahan schema wajib disertai file migration yang di-commit ke repository — tidak ada perubahan schema manual langsung ke database.
- Setiap tabel finansial (`accounts`, `transaction_entries`) wajib memiliki kolom `created_at` dan `updated_at` untuk keperluan audit.

### Contoh Pola Transaction

```typescript
async function transferFunds(fromId: string, toId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const fromAccount = await tx.account.findUnique({
      where: { id: fromId },
    });

    if (!fromAccount || fromAccount.balance < amount) {
      throw new InsufficientBalanceException(fromId);
    }

    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } },
    });

    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } },
    });

    await tx.transactionEntry.createMany({
      data: [
        { accountId: fromId, type: 'DEBIT', amount },
        { accountId: toId, type: 'CREDIT', amount },
      ],
    });
  });
}
```

---

## 5. Validation & Schema Standard

**Prinsip:** Explicit over implicit — schema adalah satu-satunya sumber kebenaran untuk bentuk data.

### Aturan
- Setiap endpoint API wajib memiliki Zod schema untuk request body, query param, dan response.
- Schema yang dipakai lintas service (misal payload event `transaction.created`) wajib didefinisikan di `packages/shared-types`, bukan diduplikasi di masing-masing service.
- Tipe TypeScript **tidak ditulis manual** untuk data yang sudah punya Zod schema — gunakan `z.infer<typeof schema>` agar tipe dan validasi selalu sinkron.
- Validasi dijalankan lewat `nestjs-zod` pipe di level controller, sebelum request masuk ke Service layer.

### Contoh Schema

```typescript
// packages/shared-types/src/transaction.schema.ts
import { z } from 'zod';

export const transferRequestSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().positive(),
  idempotencyKey: z.string().min(1),
});

export type TransferRequest = z.infer<typeof transferRequestSchema>;
```

---

## 6. Error Handling

**Prinsip:** Fail loud, not silent — error harus informatif dan terklasifikasi dengan jelas.

### Aturan
- Gunakan custom exception class yang extend `HttpException` untuk error domain-specific, misal `InsufficientBalanceException`, `DuplicateIdempotencyKeyException`.
- Setiap error response mengikuti format konsisten:

```json
{
  "statusCode": 400,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Account acc_123 does not have sufficient balance",
  "timestamp": "2026-07-23T10:00:00.000Z"
}
```

- Global exception filter menangani semua unhandled error dan mencatatnya ke log sebelum mengembalikan response generik ke client (tidak boleh expose stack trace ke client).
- Error yang terjadi saat memproses event (bukan HTTP request) tidak boleh membuat consumer crash — wajib ditangkap dan diarahkan ke dead-letter queue.

---

## 7. Event & Message Contract

**Prinsip:** Auditability is not optional — setiap event harus punya struktur yang jelas dan dapat ditelusuri.

### Aturan
- Penamaan event menggunakan format `<domain>.<action>`, contoh: `transaction.created`, `transaction.completed`, `transaction.failed`.
- Setiap event payload wajib menyertakan: `eventId`, `occurredAt`, `payload`, `version`.
- Perubahan struktur event yang breaking wajib menaikkan `version` (misal `transaction.created.v2`), bukan mengubah struktur event versi lama secara langsung.
- Event dipublikasikan lewat **outbox pattern**: disimpan ke tabel `outbox_events` dalam transaction yang sama dengan perubahan data, lalu worker terpisah yang membaca dan publish ke RabbitMQ.

### Contoh Struktur Event

```json
{
  "eventId": "evt_9f8e7d6c",
  "eventType": "transaction.created",
  "version": 1,
  "occurredAt": "2026-07-23T10:00:00.000Z",
  "payload": {
    "transactionId": "txn_123",
    "fromAccountId": "acc_123",
    "toAccountId": "acc_456",
    "amount": 100000
  }
}
```

---

## 8. Logging & Observability

**Prinsip:** Fail loud, not silent — kondisi sistem harus dapat diamati tanpa perlu debugging manual di server.

### Aturan
- Menggunakan structured logging (Pino), bukan `console.log`.
- Setiap log wajib menyertakan `requestId`/`correlationId` yang konsisten across service, untuk memudahkan tracing satu transaksi lintas service.
- Level log digunakan secara konsisten:
  - `error` — kegagalan yang butuh perhatian (transaksi gagal, event gagal diproses)
  - `warn` — kondisi tidak normal tapi masih tertangani (retry, saldo mendekati limit)
  - `info` — event bisnis penting (transaksi berhasil dibuat)
  - `debug` — detail teknis untuk keperluan development
- Setiap service wajib menyediakan endpoint `/health` dan endpoint metrics format Prometheus.

---

## 9. Testing Standard

**Prinsip:** Correctness over convenience — logic ledger inti tidak boleh dikirim tanpa test yang memadai.

### Aturan
- **Unit test wajib** untuk seluruh logic di Service layer, terutama perhitungan saldo dan validasi.
- **Integration test wajib** untuk alur transfer end-to-end, menggunakan Testcontainers (PostgreSQL & RabbitMQ asli, bukan mock).
- Target minimum coverage: **80%** untuk module `transaction` dan `account`.
- Setiap bug yang ditemukan di production wajib disertai regression test sebelum fix di-merge.
- Test race condition (concurrent request pada akun yang sama) wajib ada minimal satu skenario di integration test.

---

## 10. Code Review Guideline

**Prinsip:** Fail loud, not silent — masalah lebih baik ditemukan saat review daripada saat production.

### Checklist sebelum approve PR:
- [ ] Semua CI check (lint, test, build) lulus
- [ ] Perubahan pada logic ledger disertai unit/integration test baru
- [ ] Tidak ada `console.log` yang tertinggal
- [ ] Schema Zod diupdate jika ada perubahan bentuk request/response
- [ ] Error handling mengikuti format standar (section 6)
- [ ] Perubahan pada event payload sudah mempertimbangkan versioning (section 7)
- [ ] Tidak ada credential/secret yang ter-hardcode
- [ ] PR ditujukan ke branch `dev`, bukan langsung ke `main`

---

*Dokumen ini adalah bagian dari portfolio project untuk mendukung target karier sebagai Software Engineer di Eropa.*