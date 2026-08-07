jest.mock('@ledgerflow/shared-infra', () => ({
  ...jest.requireActual('@ledgerflow/shared-infra'),
  runInExtractedContext: jest.fn((headers, fn) => fn()),
  getTracer: jest.fn(() => ({
    startSpan: jest.fn(() => ({
      setAttributes: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    })),
  })),
}));

import { NotificationConsumer } from './notification-consumer.service';

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;
  let mockRabbitMQService: any;
  let mockChannelWrapper: any;
  let consumeCallback: (...args: any[]) => any;

  beforeEach(() => {
    mockChannelWrapper = {
      addSetup: jest.fn().mockImplementation(async (cb: (...args: any[]) => any) => {
        const mockChannel = {
          consume: jest.fn().mockImplementation((queue: string, callback: (...args: any[]) => any) => {
            consumeCallback = callback;
          }),
          ack: jest.fn(),
          nack: jest.fn(),
          publish: jest.fn(),
        };
        await cb(mockChannel);
      }),
    };

    mockRabbitMQService = {
      getChannelWrapper: jest.fn().mockReturnValue(mockChannelWrapper),
    };

    consumer = new NotificationConsumer(mockRabbitMQService);
  });

  it('should consume valid domain event and acknowledge message', async () => {
    await consumer.onModuleInit();

    const mockMsg = {
      properties: { headers: { 'x-correlation-id': 'test-corr-id' } },
      content: Buffer.from(
        JSON.stringify({
          eventId: '11111111-1111-1111-1111-111111111111',
          eventType: 'transaction.completed',
          version: '1.0',
          occurredAt: new Date().toISOString(),
          payload: { amount: 5000 },
        }),
      ),
    };

    let ackCalled = false;
    mockChannelWrapper.addSetup.mockImplementation(async (cb: (...args: any[]) => any) => {
      const mockChannel = {
        consume: jest.fn().mockImplementation((queue: string, callback: (...args: any[]) => any) => {
          consumeCallback = callback;
        }),
        ack: jest.fn().mockImplementation(() => {
          ackCalled = true;
        }),
        nack: jest.fn(),
        publish: jest.fn(),
      };
      await cb(mockChannel);
    });

    await consumer.onModuleInit();
    await consumeCallback.call(null, mockMsg);

    expect(ackCalled).toBe(true);
  });

});
