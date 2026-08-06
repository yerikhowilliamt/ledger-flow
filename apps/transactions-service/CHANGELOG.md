# Changelog - Transactions Service

All notable changes to `transactions-service` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-06

### Added
- Initial release of `transactions-service`.
- Double-entry bookkeeping engine with optimistic & row-level locking balance updates (`POST /transactions`).
- Transaction history query with cursor-based pagination (`GET /accounts/:id/transactions`).
- Idempotency key handling with `POST /transactions` (`200 OK` on identical retry, `409 Conflict` on payload mismatch).
- Outbox pattern event worker publishing to RabbitMQ (`ledger.events`).
- OpenAPI / Swagger documentation under `/api/docs`.
- Production multi-stage Dockerfile support.
