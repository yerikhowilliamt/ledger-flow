# ADR-0010: Distributed Tracing with OpenTelemetry and Jaeger

## Status
Accepted

## Context
In an event-driven architecture, a single financial request spans HTTP calls (`transactions-service`), database transactions, outbox worker publishing, RabbitMQ message brokers, and async consumers (`notification-service`). Structured logging with `correlationId` helps, but lacks end-to-end performance visibility and flamegraph trace visualization.

## Problem
How do we visualize end-to-end request latency bottlenecks and track message propagation across async microservice boundaries?

## Decision
We adopt **OpenTelemetry (OTel) instrumentation with OTLP Exporter to Jaeger**.

1. HTTP requests, Prisma DB queries, and RabbitMQ message publishers/consumers are auto-instrumented using OpenTelemetry SDK.
2. W3C Trace Context headers (`traceparent`, `tracestate`) are injected into RabbitMQ message metadata for seamless cross-service propagation.
3. Traces are exported asynchronously to Jaeger / OpenTelemetry Collector via OTLP gRPC.

## Alternatives Considered

| Option | Trade-off |
|---|---|
| **Correlation ID Logging Only** | Zero infra overhead. Searching logs across multiple services to diagnose latency is slow and manual. |
| **Proprietary APM (Datadog / New Relic)** | Powerful, but vendor lock-in and high recurring cost. |
| **OpenTelemetry + Jaeger** (Chosen) | Vendor-neutral CNFC standard, open-source, full Flamegraph visualization, low runtime overhead. |

## Trade-offs
- Requires running an OpenTelemetry Collector / Jaeger instance.
- Small serialization overhead per HTTP and RabbitMQ trace context injection.

## Consequences
- End-to-end visual tracing of every fund transfer from HTTP controller -> DB -> Outbox -> RabbitMQ -> Consumer.
- Instant detection of performance bottlenecks across service boundaries.
