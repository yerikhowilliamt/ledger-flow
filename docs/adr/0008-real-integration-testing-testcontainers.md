# ADR-0008: Real Integration Testing via Testcontainers

## Status
Accepted

## Context
Core ledger logic (atomic transfers, row-level locking with `SELECT FOR UPDATE`, transactional outbox, and RabbitMQ dead-letter queues) relies heavily on native PostgreSQL and RabbitMQ engine behaviors. Mocking database drivers or message brokers in unit tests masks concurrency bugs, isolation leakage, and SQL syntax incompatibilities.

## Problem
How do we rigorously verify transaction isolation, locking semantics, and event delivery pipeline reliability during automated testing?

## Decision
We enforce **Integration Testing via Testcontainers**.

Core integration tests (`npm run test:integration`) spin up genuine PostgreSQL and RabbitMQ instances inside Docker containers via `Testcontainers`. Mocks for PostgreSQL and RabbitMQ are strictly forbidden in core ledger integration tests.

Unit tests (`npm run test`) remain fast and lightweight using isolated unit mocks for service-level business rules.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **In-Memory Mocks (e.g. SQLite / Mock Brokers)** | Fast test execution. High risk: SQLite does not support PostgreSQL `SELECT FOR UPDATE` syntax or transaction isolation levels; mock brokers fail to replicate RabbitMQ routing/DLQ mechanisms. |
| **Shared Persistent Test Database Server** | Risk of test data pollution across concurrent CI runs; state clean-up is brittle. |
| **Ephemeral Testcontainers** (Chosen) | Spins up exact production-matching PostgreSQL and RabbitMQ versions for test suites. Clean environment per run, true isolation verification, zero fake DB assumptions. |

## Trade-offs
- Integration test suites take longer to execute and require Docker host access.

## Consequences
- Guaranteed verification of row locking, double-entry atomic commits, and RabbitMQ DLQ mechanics before merging code.
- Confidence that production database behavior matches automated test results.
