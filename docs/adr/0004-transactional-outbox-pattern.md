# ADR-0004: Transactional Outbox Pattern for Reliable Event Publishing

## Status
Accepted

## Context
LedgerFlow publishes domain events (`transaction.created`, `transaction.completed`, `transaction.failed`) to RabbitMQ so async consumers (like `notification-service`) can process audit logs and alerts. Publishing directly to RabbitMQ inside the HTTP request flow risks dual-write inconsistency: DB commit succeeds but broker publish fails, or broker publish succeeds but DB transaction rolls back.

## Problem
How do we guarantee at-least-once domain event delivery to RabbitMQ without risking dual-write inconsistencies during database or network failures?

## Decision
We implement the **Transactional Outbox Pattern**.

During transfer processing, domain events are written to an `outbox_events` table inside the exact same database transaction (`prisma.$transaction`) as the business state change and transaction entries. An asynchronous background worker polls (or tail-reads) pending records from `outbox_events`, publishes them to RabbitMQ with publisher confirms enabled, and marks them as processed upon broker acknowledgment.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Direct Async Publishing in Service Layer** | Fast and simple. Dual-write risk: network failure to RabbitMQ leaves DB state committed without event being published. |
| **Two-Phase Commit (2PC / XA)** | Heavy protocol complexity, low performance, poorly supported across modern cloud services and lightweight brokers. |
| **Transactional Outbox Pattern** (Chosen) | Decouples DB commit from broker network availability. Guarantees events are persisted atomically with business data. Worker handles reliable background dispatch. |

## Trade-offs
- Slight addition to DB write size per transaction (one outbox entry).
- Requires a background outbox worker process or polling mechanism within `transactions-service`.

## Consequences
- Guaranteed zero lost events even if RabbitMQ or service instances crash mid-transaction.
- Event consumers must handle potential duplicate deliveries (idempotent consumers), enforcing at-least-once delivery semantics.
