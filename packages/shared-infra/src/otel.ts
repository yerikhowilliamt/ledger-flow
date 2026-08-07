import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { propagation, context, trace } from '@opentelemetry/api';
import { PrismaInstrumentation } from '@prisma/instrumentation';

let sdk: NodeSDK | null = null;

export function initTracing(serviceName: string) {
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: otelEndpoint,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
      }),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();
}

export function injectTraceContext(headers: Record<string, any> = {}): Record<string, any> {
  propagation.inject(context.active(), headers);
  return headers;
}

export function runInExtractedContext<T>(headers: Record<string, any>, fn: () => T): T {
  const extractedContext = propagation.extract(context.active(), headers);
  return context.with(extractedContext, fn);
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}
