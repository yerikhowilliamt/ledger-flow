import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { Wait } from 'testcontainers';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let pgContainer: StartedPostgreSqlContainer;
let rmqContainer: StartedRabbitMQContainer;

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

  const dbUrl = pgContainer.getConnectionUri();
  const rmqUrl = rmqContainer.getAmqpUrl();

  // Run migrations
  await execAsync(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);

  return {
    dbUrl,
    rmqUrl,
  };
}

export async function stopContainers() {
  if (pgContainer) {
    await pgContainer.stop();
  }
  if (rmqContainer) {
    await rmqContainer.stop();
  }
}
