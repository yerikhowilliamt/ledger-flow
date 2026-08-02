# Product Requirements Document (PRD)
## LedgerFlow

**Author:** Yerikho William Tasilima
**Status:** Draft
**Last Updated:** July 2026

---

## 1. Overview & Problem Statement

### Overview
Sistem ini adalah **internal ledger service** yang mencatat pergerakan dana antar akun secara akurat, konsisten, dan dapat diaudit. Sistem menggunakan prinsip **double-entry bookkeeping** — setiap transaksi selalu menghasilkan sepasang catatan (debit & credit) — untuk memastikan saldo total di sistem selalu balance dan dapat ditelusuri.

### Problem Statement
Aplikasi fintech yang menangani transaksi finansial (transfer dana, pembayaran, pencairan pinjaman) menghadapi tantangan mendasar: **bagaimana memastikan setiap transaksi tercatat tepat satu kali, saldo akun selalu akurat meski terjadi request bersamaan (concurrent), dan sistem tetap dapat diaudit ketika terjadi kegagalan** (network timeout, service crash, duplicate request).

Kegagalan menangani hal ini dapat menyebabkan:
- **Double-spending** — saldo terpotong dua kali akibat retry request yang gagal di-handle dengan benar
- **Saldo tidak konsisten** — race condition ketika dua transaksi mengakses akun yang sama secara bersamaan
- **Kehilangan jejak audit** — sulit melacak kenapa saldo berubah, terutama saat investigasi masalah production

Sistem ini dibangun untuk menyelesaikan masalah tersebut dengan pendekatan **event-driven architecture**, di mana setiap perubahan state dicatat sebagai event yang dapat diaudit, dan diproses secara asinkron antar service tanpa mengorbankan konsistensi data.

---

## 2. Goals & Non-Goals

### Goals
- Menyediakan sistem pencatatan transaksi finansial yang **konsisten** (saldo tidak pernah salah/negatif tanpa alasan valid)
- Menjamin setiap transaksi **idempoten** — request yang sama yang dikirim berkali-kali (misal karena retry jaringan) tidak menghasilkan efek ganda
- Menyediakan **jejak audit** lengkap atas setiap perubahan saldo
- Mendukung pemrosesan transaksi secara **asinkron** antar service tanpa membuat sistem lambat atau terkunci
- Sistem dapat **pulih dari kegagalan** (service crash, koneksi terputus) tanpa kehilangan data transaksi

### Non-Goals
- Sistem ini **tidak** menangani pemrosesan pembayaran eksternal (integrasi payment gateway pihak ketiga seperti kartu kredit, e-wallet) — fokus hanya pada ledger internal
- Sistem ini **tidak** menyediakan fitur multi-currency di versi awal
- Sistem ini **tidak** mencakup fraud detection atau anti-money laundering (AML) checks
- Sistem ini **tidak** menyediakan antarmuka pengguna (UI) publik — fokus pada backend service dan API

---

## 3. Target User / Persona

| Persona | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Internal Finance Admin** | Staf internal yang memantau dan merekonsiliasi transaksi | Butuh riwayat transaksi yang akurat dan dapat diaudit, laporan saldo real-time |
| **Backend Client Service** | Service lain (misal aplikasi lending atau e-commerce) yang memanggil ledger API untuk memproses transfer dana | Butuh API yang cepat, konsisten, idempoten, dan punya kontrak yang jelas |
| **End Customer (tidak langsung)** | Pengguna akhir aplikasi yang transaksinya diproses lewat ledger ini | Butuh kepastian bahwa dana mereka tercatat dengan benar, tanpa duplikasi atau kehilangan |

---

## 4. User Stories / Use Cases

1. **Sebagai** Backend Client Service, **saya ingin** membuat akun baru di ledger, **supaya** saya bisa mulai mencatat saldo untuk entitas tersebut (customer/lender/borrower).

2. **Sebagai** Backend Client Service, **saya ingin** melakukan transfer dana antar dua akun, **supaya** transaksi finansial (misal pencairan pinjaman) dapat tercatat secara akurat.

3. **Sebagai** Backend Client Service, **saya ingin** mengirim ulang (retry) request transfer yang sama tanpa khawatir terjadi duplikasi, **supaya** saya bisa menangani kegagalan jaringan dengan aman.

4. **Sebagai** Internal Finance Admin, **saya ingin** melihat riwayat transaksi sebuah akun, **supaya** saya bisa merekonsiliasi dan mengaudit pergerakan dana.

5. **Sebagai** Internal Finance Admin, **saya ingin** mendapat notifikasi ketika sebuah transaksi gagal diproses, **supaya** saya bisa menindaklanjuti masalah tersebut secepatnya.

6. **Sebagai** Backend Client Service, **saya ingin** mengecek saldo akun secara real-time, **supaya** saya bisa memvalidasi kecukupan dana sebelum memproses transaksi lain.

---

## 5. Functional Requirements

| ID | Requirement | Prioritas |
|---|---|---|
| FR-1 | Sistem dapat membuat akun baru dengan saldo awal 0 | Must Have |
| FR-2 | Sistem dapat memproses transfer dana antar dua akun (debit dari akun A, credit ke akun B) | Must Have |
| FR-3 | Setiap transfer wajib menyertakan idempotency key unik | Must Have |
| FR-4 | Sistem menolak transfer jika saldo akun pengirim tidak cukup | Must Have |
| FR-5 | Sistem menyimpan riwayat transaksi (transaction entries) yang dapat di-query per akun | Must Have |
| FR-6 | Sistem mempublikasikan event (`transaction.created`, `transaction.completed`, `transaction.failed`) setiap ada perubahan status transaksi | Must Have |
| FR-7 | Notification service mencatat log setiap event transaksi yang diterima | Should Have |
| FR-8 | Sistem menyediakan endpoint untuk mengecek saldo akun secara real-time | Must Have |
| FR-9 | Sistem menyediakan dokumentasi API (Swagger) | Should Have |
| FR-10 | Event yang gagal diproses masuk ke dead-letter queue untuk ditinjau ulang | Should Have |

---

## 6. Non-Functional Requirements

| Kategori | Requirement |
|---|---|
| **Consistency** | Saldo akun harus selalu akurat meski terjadi request transfer secara bersamaan (concurrent) pada akun yang sama — tidak boleh ada race condition |
| **Idempotency** | Request transfer dengan idempotency key yang sama, dikirim berkali-kali, hanya diproses satu kali |
| **Reliability** | Event yang dipublikasikan ke message broker tidak boleh hilang meski service crash di tengah proses (menggunakan outbox pattern) |
| **Auditability** | Setiap perubahan saldo harus dapat ditelusuri ke transaksi dan waktu kejadian yang spesifik |
| **Performance** | Endpoint transfer dan cek saldo merespons dalam waktu < 300ms pada kondisi normal (non-batch) |
| **Observability** | Sistem menyediakan health check endpoint, structured logging, dan metrics dasar (jumlah transaksi, latency, error rate) |
| **Recoverability** | Jika salah satu service down dan kembali menyala, sistem dapat melanjutkan pemrosesan tanpa kehilangan event yang tertunda |

---

## 7. Success Metrics

- **0 kejadian** saldo akun menjadi negatif tanpa alasan valid
- **100% idempotency** — tidak ada transaksi terduplikasi dari retry request yang sama
- **0 event hilang** saat service mengalami restart/crash pada saat pengujian ketahanan (resilience testing)
- **Test coverage** minimal 80% pada logic ledger inti (transfer, validasi saldo)
- Endpoint transfer & cek saldo memenuhi target latency (< 300ms) pada pengujian beban (load test) skala kecil–menengah

---

## 8. Out of Scope / Future Work

- Dukungan multi-currency dan konversi mata uang
- Integrasi payment gateway eksternal (kartu kredit, e-wallet, bank transfer nyata)
- Fraud detection / anomaly detection pada transaksi
- Role-based access control (RBAC) yang granular untuk multi-tenant
- Dashboard UI untuk finance admin (versi awal hanya API + dokumentasi Swagger)
- Skalabilitas multi-region / multi-datacenter

---

## 9. Open Questions / Risks

| Pertanyaan/Risiko | Catatan |
|---|---|
| Bagaimana strategi locking terbaik untuk mencegah race condition — row-level locking (`SELECT ... FOR UPDATE`) atau optimistic locking? | Perlu dievaluasi lewat testing beban bersamaan (concurrent load test) sebelum menentukan pendekatan final |
| Berapa lama retensi data di dead-letter queue sebelum dianggap kadaluarsa? | Perlu ditentukan kebijakan retry & retensi yang wajar |
| Apakah outbox pattern akan menambah latency signifikan pada proses transfer? | Perlu diukur lewat benchmark setelah implementasi awal |
| Bagaimana menangani skenario di mana notification-service down dalam waktu lama — apakah event menumpuk di queue tanpa batas? | Perlu strategi backpressure atau queue limit |

---

*Dokumen ini adalah bagian dari portfolio project untuk mendukung target karier sebagai Software Engineer di Eropa.*
