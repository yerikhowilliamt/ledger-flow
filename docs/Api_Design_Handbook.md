# API Design & Developer Experience Handbook
## LedgerFlow

**Maintainer:** Yerikho William Tasilima
**Last Updated:** July 2026

---

## 1. Developer Experience Principles

Karena project ini backend-only dan tidak memiliki UI visual, API adalah satu-satunya "wajah" yang dilihat consumer (service lain, atau developer yang integrasi). Prinsip berikut memastikan API ini terasa dapat diprediksi dan mudah digunakan.

1. **Predictable over clever** — Struktur endpoint dan response harus mudah ditebak, bukan mengandalkan hafalan dokumentasi.
2. **Self-documenting response** — Response (terutama error) harus cukup jelas untuk membantu debug tanpa harus buka dokumentasi setiap saat.
3. **Consistent contract** — Format request/response, status code, dan penamaan field harus seragam di semua endpoint dan semua service.
4. **Safe to retry** — Consumer harus bisa mengirim ulang request tanpa takut menyebabkan efek ganda (idempotency).
5. **Documentation is part of the API** — Endpoint tanpa dokumentasi yang jelas dianggap belum selesai dikerjakan.

---

## 2. URL & Endpoint Convention

**Prinsip:** Predictable over clever.

- Endpoint menggunakan **noun**, bukan verb — resource, bukan aksi. Contoh: `POST /transactions` (bukan `POST /createTransaction`)
- Nama resource menggunakan **plural**: `/accounts`, `/transactions`
- Nesting resource maksimal 1 level untuk menjaga URL tetap sederhana: `/accounts/{id}/transactions` (riwayat transaksi milik satu akun)
- Gunakan kebab-case untuk multi-word path, bukan camelCase: `/transaction-entries` (bukan `/transactionEntries`)

| Aksi | Endpoint |
|---|---|
| Buat akun baru | `POST /accounts` |
| Ambil detail akun | `GET /accounts/{id}` |
| Cek saldo akun | `GET /accounts/{id}/balance` |
| Buat transfer dana | `POST /transactions` |
| Ambil riwayat transaksi akun | `GET /accounts/{id}/transactions` |

---

## 3. Request & Response Format

**Prinsip:** Consistent contract.

- Seluruh field menggunakan **camelCase**, konsisten dengan konvensi TypeScript yang dipakai di codebase.
- Response sukses selalu dibungkus dalam struktur yang konsisten:

```json
{
  "data": {
    "id": "txn_123",
    "fromAccountId": "acc_123",
    "toAccountId": "acc_456",
    "amount": 100000,
    "status": "COMPLETED",
    "createdAt": "2026-07-23T10:00:00.000Z"
  },
  "meta": null
}
```

- Untuk response list, `meta` diisi informasi pagination (lihat section 7), bukan `null`.
- Field tanggal/waktu selalu dalam format **ISO 8601 UTC**.
- Nilai uang (`amount`) disimpan dan dikirim dalam satuan terkecil (misal sen/rupiah utuh sebagai integer), untuk menghindari masalah floating point pada perhitungan finansial.

---

## 4. HTTP Status Code Convention

**Prinsip:** Predictable over clever — status code harus mencerminkan hasil sebenarnya, bukan selalu `200`.

| Status Code | Kapan Dipakai |
|---|---|
| `200 OK` | Request GET berhasil |
| `201 Created` | Resource baru berhasil dibuat (misal transaksi baru) |
| `400 Bad Request` | Request tidak valid (gagal validasi schema) |
| `404 Not Found` | Resource tidak ditemukan (akun/transaksi tidak ada) |
| `409 Conflict` | Idempotency key sudah pernah dipakai dengan payload berbeda |
| `422 Unprocessable Entity` | Request valid secara format, tapi gagal secara bisnis (saldo tidak cukup) |
| `500 Internal Server Error` | Kegagalan tak terduga di server |

---

## 5. Error Response Standard

**Prinsip:** Self-documenting response. Format ini selaras dengan Engineering Playbook section 6.

```json
{
  "statusCode": 422,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Account acc_123 does not have sufficient balance for this transfer",
  "timestamp": "2026-07-23T10:00:00.000Z",
  "path": "/transactions"
}
```

**Aturan:**
- `error` menggunakan format UPPER_SNAKE_CASE yang stabil — consumer dapat melakukan pengecekan program berdasarkan field ini, bukan parsing `message`.
- `message` ditulis dalam bahasa Inggris yang jelas dan actionable, menyebutkan konteks spesifik (misal ID akun terkait).
- `message` **tidak boleh** membocorkan detail internal (query SQL, stack trace).

---

## 6. Idempotency Convention

**Prinsip:** Safe to retry. Ini menerjemahkan requirement FR-3 di PRD menjadi konvensi API konkret.

- Idempotency key dikirim melalui **body request** pada field `idempotencyKey` (bukan header), agar eksplisit terlihat di schema Zod dan dokumentasi Swagger.
- Idempotency key wajib berupa string unik yang di-generate oleh consumer (disarankan UUID).
- Jika request dengan idempotency key yang sama dikirim ulang dengan payload identik → sistem mengembalikan response transaksi yang sudah ada (status `200`, bukan membuat baru).
- Jika idempotency key yang sama dikirim dengan payload **berbeda** → sistem menolak dengan `409 Conflict`, karena ini mengindikasikan kesalahan pada sisi consumer.
- Idempotency key disimpan selama minimal 24 jam untuk keperluan deduplikasi.

---

## 7. Pagination & Filtering

**Prinsip:** Consistent contract.

Endpoint list (misal riwayat transaksi) menggunakan **cursor-based pagination**, karena lebih aman untuk data finansial yang terus bertambah (menghindari data terlewat/duplikat saat page-based pagination pada data yang berubah cepat).

```
GET /accounts/{id}/transactions?limit=20&cursor=txn_abc123
```

Response list:

```json
{
  "data": [ ... ],
  "meta": {
    "limit": 20,
    "nextCursor": "txn_xyz789",
    "hasMore": true
  }
}
```

Filtering menggunakan query param langsung, contoh: `?status=COMPLETED&from=2026-07-01&to=2026-07-31`.

---

## 8. API Versioning

**Prinsip:** Predictable over clever — perubahan breaking tidak boleh mengejutkan consumer yang sudah terintegrasi.

- Versioning menggunakan **URL path**: `/v1/transactions`, bukan header — lebih eksplisit dan mudah di-debug lewat browser/Postman.
- Versi baru (`v2`) hanya dibuat jika ada **breaking change** (menghapus field, mengubah tipe data, mengubah makna status code).
- Penambahan field baru yang opsional **tidak** memerlukan bump versi.
- Versi lama tetap didukung minimal selama masa transisi yang diumumkan lewat changelog (lihat section 10).

---

## 9. Documentation Standard

**Prinsip:** Documentation is part of the API.

- Setiap endpoint wajib memiliki anotasi Swagger (`@ApiOperation`, `@ApiResponse`) yang mendeskripsikan tujuan endpoint, bukan hanya nama teknisnya.
- Setiap endpoint wajib menyertakan **minimal satu contoh request dan response** di Swagger, termasuk contoh error yang umum terjadi.
- Perubahan pada API (termasuk penambahan field) wajib disertai update dokumentasi Swagger di PR yang sama — tidak boleh terpisah/menyusul.

---

## 10. Changelog Convention

**Prinsip:** Documentation is part of the API.

Perubahan API dicatat di `CHANGELOG.md` pada masing-masing service, mengikuti format:

```markdown
## [1.2.0] - 2026-07-23
### Added
- Endpoint `GET /accounts/{id}/transactions` mendukung filter berdasarkan `status`

### Changed
- Response `POST /transactions` kini menyertakan field `completedAt`

### Deprecated
- Field `note` pada response transaksi akan dihapus di v2, gunakan `metadata` sebagai gantinya
```

Setiap breaking change wajib dicatat di bagian **Breaking Changes** secara terpisah agar mudah ditemukan oleh consumer yang melakukan upgrade.

---

*Dokumen ini adalah bagian dari portfolio project untuk mendukung target karier sebagai Software Engineer di Eropa.*
