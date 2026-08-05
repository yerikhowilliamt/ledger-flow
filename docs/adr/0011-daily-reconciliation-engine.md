# ADR-0011: Automated Daily Financial Reconciliation Engine

## Status
Accepted

## Context
Even in mathematically balanced double-entry systems, unexpected partial failures, manual DB interventions, or edge-case bugs can cause silent balance drift between individual account balances and historical ledger entry sums over time.

## Problem
How do we continuously verify system-wide mathematical integrity and detect balance drift automatically in production?

## Decision
We build an **Automated Daily Reconciliation Engine**.

1. A scheduled job runs off-peak (e.g., 01:00 UTC daily).
2. **Zero-Sum Ledger Check:** Verifies `SUM(debits) == SUM(credits)` across all `transaction_entries`.
3. **Account Balance Integrity Check:** Compares cached `accounts.balance` against `SUM(entries)` for every account:
   `account.balance == SUM(CREDIT entries) - SUM(DEBIT entries)`.
4. Discrepancies generate a high-priority alert (PagerDuty/Slack) and log an immutable record to the `reconciliation_reports` table.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Manual SQL Audit Queries** | Reactive, prone to human oversight, errors discovered long after occurrence. |
| **Real-time Balance Re-calculation on Every Read** | Extremely slow (`O(n)` entries read per request). Unacceptable performance overhead. |
| **Scheduled Asynchronous Reconciliation Engine** (Chosen) | Zero impact on hot path API performance. Guarantees early detection of balance drift within 24 hours. |

## Trade-offs
- Requires running read-heavy aggregate queries off-peak.

## Consequences
- Guaranteed detection of any balance discrepancy or DB corruption.
- Meets European banking compliance standards (EBA / PSD2 auditability requirement).
