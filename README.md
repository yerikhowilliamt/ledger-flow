# LedgerFlow

[![CI Pipeline](https://github.com/yerikhowilliamt/ledger-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/yerikhowilliamt/ledger-flow/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Internal event-driven financial ledger service built with NestJS, PostgreSQL, Prisma, RabbitMQ, and Turborepo. Designed around **double-entry bookkeeping** principles, **pessimistic row-level locking**, and **transactional outbox pattern** to guarantee data consistency, auditability, and idempotency for high-concurrency fund transfers.

---

## Architecture Overview

LedgerFlow uses a monorepo multi-service architecture with strict layering and single-source-of-truth contracts.

```
ledger-flow/
├── apps/
│   ├── accounts-service/        # Account creation & balance management (:3001)
│   ├── transactions-service/    # Core double-entry ledger & transfer engine (:3002)
│   └── notification-service/    # Async RabbitMQ audit log consumer (:3003)
├── packages/
│   ├── shared-types/            # Shared Zod schemas & TypeScript DTOs
│   └── shared-config/           # Centralized environment validation & constants
├── docs/
│   ├── PRD_LedgerFlow.md        # Product Requirements Document
│   ├── Engineering_Playbook.md  # Core Engineering & Architectural Principles
│   ├── Project_Handbook.md      # Tech Stack & Developer Setup
│   ├── API-DX-Handbook.md       # REST API Design & Idempotency Rules
│   └── adr/                     # Architectural Decision Records (0001-0011)
└── docker-compose.yml           # Infrastructure (PostgreSQL, RabbitMQ, Redis, Jaeger)
```

---

## Key Technical Features

1. **Double-Entry Bookkeeping**: Every transfer atomically writes a paired `DEBIT` and `CREDIT` record in `transaction_entries`. Sum of debits minus credits always equals 0 (`ADR-0002`).
2. **Pessimistic Concurrency Locking**: Prevents race conditions and negative balances using PostgreSQL `SELECT ... FOR UPDATE` row-level locks (`ADR-0003`).
3. **Transactional Outbox Pattern**: Guarantees at-least-once event delivery to RabbitMQ without dual-write inconsistencies (`ADR-0004`).
4. **Idempotency & Deduplication**: Enforces `idempotencyKey` on mutations (`POST /transactions`). Identical retries return cached responses (`200 OK`), payload mismatches fail with `409 Conflict` (`ADR-0005`).
5. **Integer Currency Saturation**: All monetary amounts are stored and computed as integer cents/rupiah utuh to eliminate floating-point rounding errors (`ADR-0007`).
6. **Real Integration Testing**: Ephemeral PostgreSQL & RabbitMQ Docker containers via `Testcontainers` (no fake DB mocks in core ledger tests) (`ADR-0008`).
7. **Distributed Tracing & Resilience**: OpenTelemetry + Jaeger tracing (`ADR-0010`) and RabbitMQ Dead-Letter Queue (DLQ) topology.
8. **Automated Reconciliation**: Scheduled daily engine verifying `O(1)` system-wide zero-sum integrity and detecting balance drift (`ADR-0011`).

---

## Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database & ORM**: PostgreSQL 16 + Prisma ORM
- **Messaging**: RabbitMQ (Topic Exchange + Dead-Letter Queue)
- **Validation**: Zod + `nestjs-zod`
- **Monorepo**: Turborepo + npm workspaces
- **Observability**: Pino (Structured Logging), OpenTelemetry, Jaeger, Prometheus (`/metrics`)
- **Testing**: Jest + Testcontainers

---

## Quick Start

### Prerequisites
- **Node.js**: v24.19.0
- **Docker & Docker Compose**
- **npm**: v11.17.0

### Setup

```bash
# 1. Clone repo
git clone https://github.com/yerikhowilliamt/ledger-flow.git
cd ledger-flow

# 2. Install dependencies
npm install

# 3. Environment setup
cp .env.example .env

# 4. Start infrastructure (PostgreSQL, RabbitMQ, Redis, Jaeger)
docker compose up -d

# 5. Run database migrations & generate Prisma client
npm run prisma:migrate

# 6. Start development servers
npm run dev
```

### Access Ports
- `accounts-service`: `http://localhost:3001` (Swagger: `http://localhost:3001/api/docs`)
- `transactions-service`: `http://localhost:3002` (Swagger: `http://localhost:3002/api/docs`)
- `notification-service`: `http://localhost:3003`
- RabbitMQ Management: `http://localhost:15672` (guest/guest)
- Jaeger UI: `http://localhost:16686`

---

## Testing

```bash
# Unit tests
npm run test

# Integration tests (runs PostgreSQL & RabbitMQ via Testcontainers)
npm run test:integration

# Test coverage (min 80% required for transaction/account modules)
npm run test:cov
```

---

## Architectural Decision Records (ADRs)

Key architectural choices are documented in `docs/adr/`:

- [ADR-0001: Adopt Turborepo for Monorepo Task Orchestration](docs/adr/0001-turborepo-adoption.md)
- [ADR-0002: Double-Entry Bookkeeping Ledger Architecture](docs/adr/0002-double-entry-bookkeeping.md)
- [ADR-0003: Pessimistic Row-Level Locking for Concurrency Control](docs/adr/0003-pessimistic-locking-for-balance.md)
- [ADR-0004: Transactional Outbox Pattern for Reliable Event Publishing](docs/adr/0004-transactional-outbox-pattern.md)
- [ADR-0005: Idempotency Key Handling and Deduplication Strategy](docs/adr/0005-idempotency-key-handling.md)
- [ADR-0006: Zod Schema and Contract Sharing Architecture](docs/adr/0006-zod-schema-contract-sharing.md)
- [ADR-0007: Integer Currency Saturation for Monetary Values](docs/adr/0007-integer-currency-saturation.md)
- [ADR-0008: Real Integration Testing via Testcontainers](docs/adr/0008-real-integration-testing-testcontainers.md)
- [ADR-0009: API Rate Limiting and Endpoint Protection](docs/adr/0009-api-rate-limiting.md)
- [ADR-0010: Distributed Tracing with OpenTelemetry and Jaeger](docs/adr/0010-distributed-tracing-opentelemetry.md)
- [ADR-0011: Automated Daily Financial Reconciliation Engine](docs/adr/0011-daily-reconciliation-engine.md)

---

## License

MIT © Yerikho William Tasilima
