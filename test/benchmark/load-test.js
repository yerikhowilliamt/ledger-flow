const autocannon = require('autocannon');
const crypto = require('crypto');
const fs = require('fs');

const url = process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:3002/transactions';
const duration = 30;
const connections = 50;

// Generate valid accounts assuming some exist or they get properly mocked/created beforehand in DB.
// Using standard UUIDs to fit schema.
const sourceAccountId = crypto.randomUUID();
const destinationAccountId = crypto.randomUUID();

const instance = autocannon({
  url,
  connections,
  duration,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  setupClient: (client) => {
    client.setBody(JSON.stringify({
      fromAccountId: sourceAccountId,
      toAccountId: destinationAccountId,
      amount: Math.floor(Math.random() * 1000) + 1,
      idempotencyKey: crypto.randomUUID()
    }));
  }
}, (err, result) => {
  if (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }

  const resultStr = JSON.stringify(result, null, 2);
  fs.writeFileSync('load-test-results.json', resultStr);
  console.log('Results saved to load-test-results.json');
  console.log(autocannon.printResult(result));

    const p95 = result.latency.p95 || 0;
  if (p95 < 300) {
    console.log(`PASS: p95 latency is ${p95}ms (< 300ms)`);
    process.exit(0);
  } else {
    console.error(`FAIL: p95 latency is ${p95}ms (>= 300ms)`);
    process.exit(1);
  }
});

autocannon.track(instance, { renderProgressBar: true });
