# ADR-0006: Zod Schema and Contract Sharing Architecture

## Status
Accepted

## Context
In a multi-service NestJS architecture (`accounts-service`, `transactions-service`, `notification-service`), data models crossing service boundaries (HTTP DTOs, RabbitMQ event payloads) must stay strictly synchronized to prevent runtime deserialization bugs.

## Problem
How do we maintain single-source-of-truth request validation, response DTOs, and event contracts across services without code duplication or manual TypeScript interface sync?

## Decision
We centralize all cross-service contracts and schemas in `packages/shared-types`.

1. Define request bodies, query params, and event payloads exclusively using **Zod schemas** in `packages/shared-types`.
2. Infer TypeScript types automatically via `z.infer<typeof schema>` rather than hand-writing interfaces.
3. Integrate NestJS request validation via `nestjs-zod` at the controller layer.
4. Services import schemas directly from `@ledger-flow/shared-types`.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Class-Validator + Class-Transformer** | Standard NestJS pattern, but requires duplicated interface files or manual synchronization between event publishers and subscribers across services. |
| **Duplicated Schema Files per Service** | Eliminates package dependencies, but leads to schema drift and silent runtime serialization errors when event schemas evolve. |
| **Zod Centralized Schema Repository (`packages/shared-types`)** (Chosen) | Single source of truth. Instant runtime schema validation + TypeScript static typing out of the box across all 3 microservices. |

## Trade-offs
- Services depend on `packages/shared-types` building first in the Turborepo pipeline.
- Requires building package distribution before service compilation.

## Consequences
- Guaranteed contract consistency between HTTP endpoints and RabbitMQ event producers/consumers.
- Zero manual interface duplication required across services.
