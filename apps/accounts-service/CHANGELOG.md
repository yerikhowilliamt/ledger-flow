# Changelog - Accounts Service

All notable changes to `accounts-service` will be documented in this file.

The format is based on [Keep a Changelog](https.keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-06

### Added
- Initial release of `accounts-service`.
- CRUD endpoints for ledger accounts (`POST /accounts`, `GET /accounts/:id`, `GET /accounts/:id/balance`).
- OpenAPI / Swagger documentation under `/api/docs`.
- Prometheus metrics & OpenTelemetry tracing integration.
- Production multi-stage Dockerfile support.
