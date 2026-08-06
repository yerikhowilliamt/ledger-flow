# Changelog - Notification Service

All notable changes to `notification-service` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-06

### Added
- Initial release of `notification-service`.
- RabbitMQ consumer listening to `ledger.events` exchange via `notification.audit-log` queue.
- Audit log recorder for transaction events (`transaction.created`, `transaction.completed`, `transaction.failed`).
- Dead-Letter Queue (DLQ) support for unprocessable events (`notification.audit-log.dlq`).
- OpenAPI / Swagger documentation under `/api/docs`.
- Production multi-stage Dockerfile support.
