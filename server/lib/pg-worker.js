'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const { Client } = require('pg');

const { sab, connectionString } = workerData;
const int32 = new Int32Array(sab, 0, 4); // [state, length, status, reserved]
const uint8 = new Uint8Array(sab, 16);

let client;

async function init() {
  try {
    client = new Client({ connectionString });
    await client.connect();
    int32[2] = 0; // ready
  } catch (err) {
    console.error('PostgreSQL worker connection error:', err.message);
    int32[2] = 1; // error
  }
  Atomics.store(int32, 0, 1);
  Atomics.notify(int32, 0, 1);
}

parentPort.on('message', async (cmd) => {
  if (cmd === 'close') {
    if (client) await client.end().catch(() => {});
    process.exit(0);
  }

  const len = int32[1];
  const reqBuf = Buffer.from(uint8.buffer, 16, len);
  const { type, sql, params } = JSON.parse(reqBuf.toString('utf8'));

  try {
    let result;
    if (type === 'exec') {
      await client.query(sql);
      result = { ok: true };
    } else {
      const res = await client.query(sql, params);
      // Ensure numeric counts like count(*) are returned consistently
      const rows = res.rows.map((row) => {
        const out = { ...row };
        for (const [k, v] of Object.entries(out)) {
          // If count(*) or sum, pg returns string for bigints
          if ((k === 'n' || k === 's' || k === 'm') && typeof v === 'string' && /^-?\d+$/.test(v)) {
            out[k] = Number(v);
          }
        }
        return out;
      });
      result = { rows, rowCount: res.rowCount };
    }

    const encoded = Buffer.from(JSON.stringify({ data: result }), 'utf8');
    int32[1] = encoded.length;
    int32[2] = 0; // success
    uint8.set(encoded);
  } catch (err) {
    const encoded = Buffer.from(JSON.stringify({ error: err.message }), 'utf8');
    int32[1] = encoded.length;
    int32[2] = 1; // error
    uint8.set(encoded);
  }

  Atomics.store(int32, 0, 2); // state 2 = response ready
  Atomics.notify(int32, 0, 1);
});

init();

