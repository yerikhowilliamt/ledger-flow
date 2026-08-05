# ADR-0001: Adopt Turborepo for Monorepo Task Orchestration

## Status
Accepted

## Context

LedgerFlow is structured as a monorepo with three services (`accounts-service`, `transactions-service`, `notification-service`) and two shared packages (`shared-types`, `shared-config`), managed with npm workspaces.

At the current scale — a small number of services, a single contributor, and short build times — a task orchestration layer like Turborepo is not strictly necessary. Plain npm workspace scripts (`npm run build --workspaces`) would work fine for local development and would be simpler to reason about, with less configuration surface.

This tension is worth stating explicitly: the project's own engineering principles favor YAGNI and minimal tooling (see `AGENTS.md` — Ponytail Mode). Adding Turborepo without a concrete reason would contradict that principle.

## Decision

We adopt Turborepo on top of npm workspaces, but only to solve two specific problems rather than as a default "monorepo starter" choice:

1. **Task dependency graph** — `transactions-service` and `accounts-service` both depend on `shared-types` (Zod schemas / inferred types). Turborepo's `dependsOn` ensures `shared-types` is always built before dependent services build or test, without manually ordering npm scripts.
2. **CI build/test caching** — In the CI pipeline (Phase 5), `turbo run build test lint` uses remote caching so that unchanged packages skip re-execution on subsequent CI runs. This is the part of Turborepo that has to be *actually configured and exercised* — cache hits verified in CI logs — for the tool to be justified; caching config that is present but never hit provides no value.

If neither of these were true — no cross-package build dependency, no CI cache being exercised — plain npm workspace scripts would be the correct choice, and this ADR would be revisited.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Plain npm workspaces** (no orchestration layer) | Simplest, zero extra config, fully aligned with YAGNI. Loses automatic task dependency ordering and CI caching; ordering would need to be hand-maintained in root `package.json` scripts. |
| **Turborepo, configured but unused features** | Same dependency setup, but without verifying CI cache hits. Rejected — this is cargo-culting the tool without extracting real value, and is harder to justify in review. |
| **Turborepo with dependency graph + verified CI remote caching** (chosen) | Slightly more setup and config surface (`turbo.json`, remote cache credentials in CI). In exchange, build ordering is declarative and CI cost/time is measurably reduced as the project grows. |
| **Nx** | Similar capabilities, steeper config/learning curve for a project this size; Turborepo's simpler task-pipeline model is a better fit for 3 services. |

## Consequences

- `turbo.json` defines the task pipeline (`build`, `test`, `test:integration`, `lint`) with `shared-types` and `shared-config` as upstream dependencies of the services.
- CI (Phase 5) is expected to show measurable cache hits on unchanged packages — this is treated as the acceptance signal that the tool is earning its place, not just decoration.
- If the project stays small and CI caching is never meaningfully exercised, this decision should be revisited and Turborepo dropped in favor of plain npm workspace scripts.