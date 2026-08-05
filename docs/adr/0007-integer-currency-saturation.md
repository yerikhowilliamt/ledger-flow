# ADR-0007: Integer Currency Saturation for Monetary Values

## Status
Accepted

## Context
Floating-point arithmetic (e.g. IEEE 754 floating point numbers in JavaScript/TypeScript) is subject to rounding errors (e.g. `0.1 + 0.2 === 0.30000000000000004`). In financial ledger systems, floating-point inaccuracy can accumulate drift over millions of transactions, leading to unbalanced balance sheets.

## Problem
How do we represent monetary amounts across APIs, application logic, and PostgreSQL storage to completely eliminate floating-point rounding errors?

## Decision
We enforce **Integer Currency Saturation**.

All monetary `amount` parameters across APIs, database columns (`BigInt` / `Int`), calculation routines, and event messages must represent values in the smallest currency unit (e.g., cents, IDR rupiah utuh).
- Example: $10.50 is stored and transmitted as `1050`.
- Floating-point representations (`10.5`) are strictly forbidden in API payloads and database entities.
- Zod schemas validate `amount` as `z.number().int().positive()`.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Floating-Point Numbers (`number` / `FLOAT`)** | Simple to write, but introduces rounding errors and balance drift. Unacceptable for financial applications. |
| **Decimal / BigDecimal Libraries** | Precise, but adds runtime overhead, serialization complexity, and third-party library dependencies across all services. |
| **Integer Currency Units (`Int` / `BigInt`)** (Chosen) | Zero rounding error, native integer performance in PostgreSQL and JS runtime, straightforward schema validation with `z.number().int()`. |

## Trade-offs
- Application must convert display values (e.g., standard currency units) to integer cents at the edge if user interfaces are added in the future.

## Consequences
- 100% precision in balance checks, sum calculations, and audit log verifications.
- Standardized integer schema rules across all API contracts.
