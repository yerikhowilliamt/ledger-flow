// Fix undici webidl.util.markAsUncloneable in Jest node environment
try {
  const undiciWebidl = require('undici/lib/web/fetch/webidl.js');
  if (undiciWebidl && undiciWebidl.util && !undiciWebidl.util.markAsUncloneable) {
    undiciWebidl.util.markAsUncloneable = () => {};
  }
} catch (e) {}

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let pgContainer: StartedPostgreSqlContainer;
let rmqContainer: StartedRabbitMQContainer;
let redisContainer: StartedTestContainer;

export async function startContainers() {
  pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('ledger_flow')
    .withUsername('postgres')
    .withPassword('postgres')
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
    .start();

  rmqContainer = await new RabbitMQContainer('rabbitmq:3-management-alpine')
    .withEnvironment({ RABBITMQ_DEFAULT_USER: 'guest', RABBITMQ_DEFAULT_PASS: 'guest' })
    .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
    .start();

  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  const dbUrl = pgContainer.getConnectionUri();
  const rmqUrl = rmqContainer.getAmqpUrl();
  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);

  // Run migrations
  await execAsync(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);

  return {
    dbUrl,
    rmqUrl,
    redisHost,
    redisPort,
  };
}

export async function stopContainers() {
  if (pgContainer) {
    await pgContainer.stop();
  }
  if (rmqContainer) {
    await rmqContainer.stop();
  }
  if (redisContainer) {
    await redisContainer.stop();
  }
}
