# Project Handbook
## LedgerFlow

**Maintainer:** Yerikho William Tasilima
**Last Updated:** July 2026

---

## 1. Project Overview

Ledger service internal berbasis event-driven architecture untuk mencatat pergerakan dana antar akun secara konsisten, idempoten, dan dapat diaudit, menggunakan prinsip double-entry bookkeeping.

Detail requirement produk dan latar belakang masalah dapat dilihat di [`PRD LedgerFlow.md`](./PRD_LedgerFlow.md).

---

## 2. Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Backend Framework | NestJS + TypeScript | Modular, mendukung dependency injection, cocok untuk arsitektur multi-service |
| Database (relational) | PostgreSQL | Mendukung transaction & row-level locking, krusial untuk konsistensi saldo |
| ORM | Prisma | Type-safe query, migration workflow yang jelas, developer experience yang baik untuk PostgreSQL |
| Validation | Zod + `nestjs-zod` | Schema tunggal untuk validasi HTTP request & payload event, tipe TypeScript di-infer otomatis dari schema |
| Message Broker | RabbitMQ | Mendukung reliable async messaging antar service, dead-letter queue built-in |
| Containerization | Docker & Docker Compose | Mempermudah setup multi-service secara lokal dan konsisten antar environment |
| Monorepo Tooling | Turborepo | Mengelola banyak service dalam satu repo tanpa duplikasi konfigurasi |
| API Docs | Swagger | Dokumentasi API otomatis dari kode |
| Testing | Jest + Testcontainers | Unit test cepat, integration test dengan database & broker asli (bukan mock) |
| CI | GitHub Actions | Menjalankan test & build otomatis setiap push |

---

## 3. Project Structure

```
ledger-system/
├── apps/
│   ├── accounts-service/        # Mengelola data akun & saldo
│   ├── transactions-service/    # Memproses transfer & logic ledger inti
│   └── notification-service/    # Konsumsi event, mencatat log notifikasi
├── packages/
│   ├── shared-types/            # Tipe data & DTO yang dipakai lintas service
│   └── shared-config/           # Konfigurasi environment & konstanta bersama
├── docker-compose.yml
├── turbo.json
└── README.md
```

Setiap service di dalam `apps/` adalah aplikasi NestJS independen yang bisa dijalankan dan di-deploy secara terpisah, namun berbagi tipe data dari `packages/shared-types` agar kontrak antar service tetap konsisten.

---

## 4. Getting Started

### Prasyarat
- Node.js v20+
- Docker & Docker Compose
- npm (package manager)

### Langkah Setup

```bash
# 1. Clone repository
git clone https://github.com/yerikhowilliamt/ledger-system.git
cd ledger-system

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env

# 4. Jalankan semua service beserta dependency (PostgreSQL, RabbitMQ)
docker compose up -d

# 5. Jalankan migration database (Prisma)
npm run prisma:migrate

# 6. Jalankan seluruh service dalam mode development
npm run dev
```

Setelah berjalan, service dapat diakses di:
- `accounts-service` → `http://localhost:3001`
- `transactions-service` → `http://localhost:3002`
- `notification-service` → `http://localhost:3003`
- RabbitMQ Management UI → `http://localhost:15672`

---

## 5. Branching Strategy

Menggunakan pola **Git Flow sederhana** dengan dua branch utama:

- `main` — hanya berisi kode yang sudah stabil dan siap deploy ke production
- `dev` — branch integrasi tempat seluruh fitur digabungkan dan diuji sebelum masuk ke `main`
- `feature/<nama-fitur>` — untuk pengembangan fitur baru, misal `feature/transfer-idempotency`
- `fix/<nama-bug>` — untuk perbaikan bug, misal `fix/balance-race-condition`

Alur kerja:
1. Buat branch baru dari `dev`
2. Kerjakan perubahan, commit secara bertahap
3. Buka Pull Request ke `dev` (bukan langsung ke `main`)
4. Pastikan CI (test & build) lulus sebelum merge ke `dev`
5. Setelah `dev` dianggap stabil (semua fitur yang direncanakan sudah teruji), buka Pull Request dari `dev` ke `main`
6. Merge menggunakan **squash merge** agar histori tetap ringkas dan mudah dibaca

---

## 6. Commit Convention

Menggunakan format **Conventional Commits**:

```
<type>(<scope>): <deskripsi singkat>
```

Contoh:
- `feat(transactions): add idempotency key validation`
- `fix(accounts): fix race condition on balance update`
- `docs(readme): update setup instructions`
- `test(transactions): add integration test for transfer flow`

Tipe yang umum dipakai: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

---

## 7. Testing

```bash
# Menjalankan seluruh unit test
npm run test

# Menjalankan integration test (menggunakan Testcontainers)
npm run test:integration

# Menjalankan test dengan coverage report
npm run test:cov
```

Integration test menjalankan instance PostgreSQL & RabbitMQ asli melalui Testcontainers, bukan mock, untuk memastikan behavior transaksi dan locking teruji secara realistis.

---

## 8. API Documentation

Setiap service menyediakan dokumentasi Swagger yang dapat diakses setelah service berjalan:

- `accounts-service` → `http://localhost:3001/api/docs`
- `transactions-service` → `http://localhost:3002/api/docs`

Contoh request transfer dana:

```json
POST /transactions
{
  "fromAccountId": "acc_123",
  "toAccountId": "acc_456",
  "amount": 100000,
  "idempotencyKey": "unique-key-abc"
}
```

---

## 9. Deployment

Deployment dilakukan menggunakan Docker image yang dibangun otomatis melalui GitHub Actions setiap push ke `main`.

```bash
# Build image secara manual (opsional, untuk testing lokal)
docker build -t ledger-transactions-service ./apps/transactions-service

# Deploy ke Railway/Render menggunakan Docker image yang sama
```

Environment variables production dikelola melalui secret manager platform hosting (Railway/Render), tidak disimpan di repository.

---

## 10. Troubleshooting / FAQ

**Q: Service gagal connect ke RabbitMQ saat pertama kali dijalankan.**
A: Pastikan `docker compose up -d` sudah selesai sepenuhnya sebelum menjalankan `npm run dev` — RabbitMQ butuh beberapa detik untuk siap menerima koneksi.

**Q: Migration gagal karena database belum ada.**
A: Pastikan container PostgreSQL sudah running (`docker compose ps`), lalu jalankan ulang `npm run prisma:migrate`.

**Q: Bagaimana cara reset seluruh data lokal?**
A: Jalankan `docker compose down -v` untuk menghapus volume database, lalu ulangi langkah setup dari awal.

---

*Dokumen ini adalah bagian dari portfolio project untuk mendukung target karier sebagai Software Engineer di Eropa.*