# ADR-0005: Idempotency Key Handling and Deduplication Strategy

## Status
Accepted

## Context
Network retries from client applications (e.g. mobile apps, upstream services) can re-send identical transfer requests when HTTP responses are lost due to timeout or network drop. Without idempotency handling, retries result in duplicate fund transfers and balance corruption.

## Problem
How do we ensure that re-sent request payloads with identical idempotency keys do not produce duplicate transfers, while rejecting mismatched payloads using an existing key?

## Decision
We enforce mandatory idempotency keys on mutation endpoints (`POST /transactions`).

1. The client supplies `idempotencyKey` in the request body.
2. `transactions-service` checks for an existing record with the given key in the ledger database.
3. **Identical Payload Retry:** If key exists and request payload matches, return the stored original response (`200 OK`) without executing a new transfer.
4. **Mismatched Payload Retry:** If key exists but request payload differs (different amount, accounts, etc.), return HTTP `409 Conflict`.
5. **First Request:** If key does not exist, execute the transfer atomically, store the result along with the key, and return HTTP `201 Created`.

Keys are retained in the database for a minimum of 24 hours.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Header-based Idempotency (`X-Idempotency-Key`)** | Standard REST convention, but decoupled from body validation schemas. |
| **Body-based `idempotencyKey` with DB Persistence** (Chosen) | Explicitly typed and validated via Zod schema. Enforces strict schema contracts in OpenAPI/Swagger and guarantees atomic key persistence alongside transaction data. |
| **In-Memory / Redis Only Idempotency Cache** | Fast, but risks cache loss on Redis crash/eviction, potentially allowing duplicate execution during recovery. |

## Trade-offs
- Requires unique index constraint on `idempotencyKey` in database.
- Requires saving request payload hashes to detect payload divergence on retries.

## Consequences
- Upstream service retries are 100% safe.
- Prevents double-spending caused by network timeouts and automatic client retry loops.
