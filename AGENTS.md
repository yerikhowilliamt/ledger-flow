# AGENTS.md — LedgerFlow

## Reference & Specs
- The repository currently contains architectural specifications and engineering handbooks in `docs/` (`PRD_LedgerFlow.md`, `Project_Handbook.md`, `Engineering_Playbook.md`, `API-DX-Handbook.md`). Always treat these documents as the specification of truth when implementing or modifying services.

## Agent Workflow Rules
- Be token-efficient without sacrificing quality; keep responses concise, no fluff.
- Do not scan files that aren't relevant to the task — read only the reference module(s) and files that actually need editing.
- Always produce an **Implementation Plan** first, with a minimum of **3 options**, each with trade-offs, plus a clearly stated **recommended best option**.
- After presenting the plan, **stop and wait for review/approval** before implementing.
- After implementation is done, list every file/folder **created** and **edited**, with a short explanation of what was done in each.
- **YAGNI & Minimal Diffs**: Do not add abstractions, boilerplate, or new dependencies unless explicitly requested and unavoidable. Check existing helpers, standard libraries, and native platform features first.
- **Root Cause Bug Fixing**: When fixing a bug in a shared helper or utility, grep all callers of the touched function and guard/fix the shared function once rather than patching symptom call sites individually.
- **Deliberate Simplifications**: If cutting a corner with a known ceiling (e.g., O(n²) scan, global lock), mark it with a comment: `// ponytail: <ceiling and upgrade path>`.

## Setup & Command Order
- **Prerequisites & Order**:
  1. `npm install`
  2. `cp .env.example .env`
  3. `docker compose up -d` *(Wait for PostgreSQL and RabbitMQ containers to be ready)*
  4. `npm run prisma:migrate` *(Required before dev servers or tests; runs Prisma migrations and generates the client. Never modify DB schema manually via DDL)*
  5. `npm run dev`
- **Testing & Verification**:
  - `npm run test` — Run all unit tests.
  - `npm run test:integration` — Run integration tests against real PostgreSQL and RabbitMQ instances via Testcontainers. **Never mock database or broker interactions in core ledger integration tests.**
  - `npm run test:cov` — Run test coverage. Minimum **80% coverage** is strictly required for `transaction` and `account` modules.

## Architecture & Monorepo Boundaries
- **Monorepo Structure (Turborepo + npm)**:
  - `apps/accounts-service/` (`:3001`): Account and balance queries/management.
  - `apps/transactions-service/` (`:3002`): Core ledger logic, transfer processing, and double-entry bookkeeping.
  - `apps/notification-service/` (`:3003`): RabbitMQ event consumption and audit log recording.
  - `packages/shared-types/`: Shared TypeScript DTOs and Zod schemas (e.g., `transferRequestSchema`). **Do not duplicate schemas across services; define shared event and request schemas here.**
  - `packages/shared-config/`: Shared environment configurations and constants.
- **Module Layering (`apps/*/src/modules/<domain>/`)**:
  - Controllers (`*.controller.ts`) **must never call Prisma directly**; always route through Service (`*.service.ts`) → Repository (`*.repository.ts`).
  - Do not write manual TypeScript interfaces for validated payloads; always infer types from Zod schemas (`z.infer<typeof schema>`).

## Ledger Mechanics & Data Invariants
- **Double-Entry Bookkeeping**: Fund transfers must execute within a single atomic Prisma transaction (`prisma.$transaction`), creating a matched pair of immutable `DEBIT` and `CREDIT` records in `transaction_entries` alongside account balance updates.
- **Concurrency & Row-Level Locking**: Account balance reads prior to updates must use explicit PostgreSQL row-level locking (`SELECT ... FOR UPDATE` via `prisma.$queryRaw`) to prevent race conditions during concurrent requests.
- **Integer Currency Saturation**: All monetary `amount` values must be stored, computed, and transmitted as integers in the smallest currency unit (e.g., cents/rupiah utuh). Never use floating-point numbers.
- **Outbox Pattern**: Domain events (`transaction.created`, `transaction.completed`, `transaction.failed`) must be written to an `outbox_events` table inside the same DB transaction as the business state change, to be published to RabbitMQ asynchronously.

## API & Error Conventions
- **Errors**: Domain exceptions must extend `HttpException` and return UPPER_SNAKE_CASE error codes in the JSON `error` field (e.g., `error: "INSUFFICIENT_BALANCE"`). Never expose SQL or stack traces to clients.
- **Idempotency**: Mutation endpoints (e.g., `POST /transactions`) require an `idempotencyKey` in the request body. Retrying identical payloads returns the existing transaction (`200 OK`); sending a different payload with an existing key must fail with `409 Conflict`.
- **Event Versioning**: Event names follow `<domain>.<action>` with mandatory `eventId`, `occurredAt`, `payload`, and `version`. Any breaking event payload change requires incrementing `version` (e.g., `transaction.created.v2`).
