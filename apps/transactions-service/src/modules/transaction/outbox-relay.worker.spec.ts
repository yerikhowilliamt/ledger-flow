jest.mock('@ledgerflow/shared-infra', () => ({
  ...jest.requireActual('@ledgerflow/shared-infra'),
  injectTraceContext: jest.fn((headers) => ({ ...headers, traceparent: '00-fake-trace-id-00' })),
  getTracer: jest.fn(() => ({
    startSpan: jest.fn(() => ({
      setAttributes: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    })),
  })),
}));

import { OutboxRelayWorker } from './outbox-relay.worker';

describe('OutboxRelayWorker', () => {
  let worker: OutboxRelayWorker;
  let mockPrismaService: any;
  let mockRabbitMQService: any;

  beforeEach(() => {
    mockPrismaService = {
      $transaction: jest.fn(),
      outboxEvent: {
        update: jest.fn(),
      },
    };

    mockRabbitMQService = {
      publish: jest.fn().mockResolvedValue(true),
    };

    worker = new OutboxRelayWorker(mockPrismaService, mockRabbitMQService);
  });

  it('should process pending outbox events and publish them to RabbitMQ', async () => {
    const mockEvents = [
      {
        id: 'evt-1',
        aggregate_type: 'Transaction',
        aggregate_id: 'tx-1',
        event_type: 'transaction.completed',
        payload: { transactionId: 'tx-1', amount: 10000 },
        status: 'PENDING',
        created_at: new Date(),
      },
    ];

    mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
      return cb({
        $queryRaw: jest.fn().mockResolvedValue(mockEvents),
      });
    });

    await worker.handleOutboxEvents();

    expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
      'transaction.completed',
      expect.objectContaining({
        eventId: 'evt-1',
        eventType: 'transaction.completed',
        version: '1.0',
      }),
      expect.any(Object),
    );

    expect(mockPrismaService.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        status: 'PROCESSED',
      }),
    });
  });

  it('should mark event as FAILED if RabbitMQ publish fails', async () => {
    const mockEvents = [
      {
        id: 'evt-2',
        aggregate_type: 'Transaction',
        aggregate_id: 'tx-2',
        event_type: 'transaction.completed',
        payload: { transactionId: 'tx-2' },
        status: 'PENDING',
        created_at: new Date(),
      },
    ];

    mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
      return cb({
        $queryRaw: jest.fn().mockResolvedValue(mockEvents),
      });
    });

    mockRabbitMQService.publish.mockRejectedValue(new Error('Broker unreachable'));

    await worker.handleOutboxEvents();

    expect(mockPrismaService.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-2' },
      data: { status: 'FAILED' },
    });
  });
});
