# ADR-0003: Pessimistic Row-Level Locking for Concurrency Control

## Status
Accepted

## Context
When multiple concurrent HTTP requests attempt to transfer funds from or to the same account simultaneously, race conditions can lead to negative balances, lost updates, or double-spending if reads and updates are not synchronized.

## Problem
How do we guarantee that concurrent transfer requests targeting the same account evaluate balance availability accurately and apply balance updates without race conditions?

## Decision
We adopt **pessimistic row-level locking** (`SELECT ... FOR UPDATE` via `prisma.$queryRaw`) within PostgreSQL during account balance read steps inside the transfer database transaction.

Before updating an account balance or validating sufficient funds, the service executes `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`. This locks the target account row until the enclosing `prisma.$transaction` completes or rolls back.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Optimistic Locking** (Version Column / CAS) | Works well for low-contention environments. High retry rate and potential request failures under high concurrent transfers to a single hotspot account (e.g. platform pool account). |
| **Application-Level Distributed Lock** (Redis / Redlock) | Avoids DB locks, but introduces network latency, Redis cluster dependency, and split-brain risk if lock TTL expires during slow DB transactions. |
| **Pessimistic Row-Level Locking** (`SELECT FOR UPDATE`) (Chosen) | Leverages native PostgreSQL ACID mechanics. Zero external dependency, strict isolation, guaranteed prevention of concurrent read-modify-write race conditions. |

## Trade-offs
- Requests contending for the same account row will block until the lock-holding transaction releases.
- Risk of deadlocks if lock ordering is inconsistent across services (mitigated by strict ordering of account ID acquisition: lower UUID/ID first).

## Consequences
- Account rows are protected from race conditions during transfer execution.
- Transfer logic must sort account IDs deterministically before acquiring locks to prevent deadlocks when locking multiple accounts (source & destination).
