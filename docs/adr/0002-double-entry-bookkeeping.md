# ADR-0002: Double-Entry Bookkeeping Ledger Architecture

## Status
Accepted

## Context
A financial ledger must maintain mathematical integrity and transparent audit trails across account balance transfers. Single-entry systems (simply mutating balances directly without matched counter-entries) leave systems vulnerable to balance corruption, untraceable drift during failures, and difficulty in proving system-wide balance reconciliation.

## Problem
How do we ensure that every balance modification in LedgerFlow is mathematically balanced, immutable, and fully audit-traceable across all accounts?

## Decision
We enforce double-entry bookkeeping for all fund transfers. Every transfer must execute within a single atomic database transaction (`prisma.$transaction`), creating a matched pair of immutable records in the `transaction_entries` table:
- Exactly one `DEBIT` entry (reducing the source account balance or reflecting an outflow)
- Exactly one `CREDIT` entry (increasing the destination account balance or reflecting an inflow)
- The sum of debits must equal the sum of credits for any given transaction (`sum(debits) - sum(credits) = 0`).

Direct balance mutation without a corresponding `transaction_entries` pair is strictly forbidden.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Single-Entry Mutation** (Direct Balance Update) | Simple schema and fewer inserts. High risk: no immutable audit trail, zero mathematical safety check if a crash occurs mid-update. |
| **Double-Entry Ledger with Immutability** (Chosen) | Requires dual entry insertion per transfer and strict atomic transaction bounds. Guaranteed mathematical balance, complete historical auditability, standard financial accounting alignment. |
| **Event Sourcing Ledger** | Complete event stream rebuild capability. Extreme complexity overhead for 3 microservices; deferred under YAGNI principles. |

## Trade-offs
- Requires writing multi-row entries for every transfer (higher write volume per transaction).
- Requires strict transaction execution bounds to guarantee both debit and credit entries are committed together.

## Consequences
- Every transaction produces immutable history in `transaction_entries`.
- System balance consistency can be validated at any time by summing all historical debit and credit entries.
- Schema must support `transaction_entries` linked to parent transaction records and account IDs.
