# ADR-0009: API Rate Limiting and Endpoint Protection

## Status
Accepted

## Context
Public-facing or internal core ledger APIs (such as `POST /transactions`) are vulnerable to denial-of-service (DoS) attacks, brute-force idempotency key exhaustion, and excessive connection pool acquisition. In European financial architecture, rate limiting is a mandatory security boundary.

## Problem
How do we protect `transactions-service` and `accounts-service` against traffic spikes and malicious automated request loops without blocking legitimate retry traffic?

## Decision
We enforce **Redis-backed Token Bucket Rate Limiting** using `@nestjs/throttler` with Redis store.

1. Mutations (`POST /transactions`): Max 50 requests per minute per IP / API client key.
2. Read operations (`GET /accounts/{id}`): Max 200 requests per minute.
3. Exceeding limits returns HTTP `429 Too Many Requests` with `Retry-After` header.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **In-Memory Rate Limiting** | Simple, zero external infrastructure. Fails in multi-instance auto-scaling deployments (state is isolated per replica). |
| **Gateway/Reverse Proxy Limiting (Nginx/Cloudflare)** | Protects network edge, but lacks fine-grained application/user-level context. |
| **Distributed Redis Token Bucket** (Chosen) | Centralized state across all microservice replicas, precise windowing, low-latency (< 2ms per check). |

## Trade-offs
- Adds a Redis dependency to the infrastructure cluster.

## Consequences
- Protects PostgreSQL connection pool from exhaustion during traffic spikes.
- Standardized HTTP 429 responses across all services.
