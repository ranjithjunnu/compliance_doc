'use strict';
// Verifies the AI adapter against a local stand-in that enforces DeepSeek's documented rules.
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-ai-'));
process.env.NODE_ENV = 'test';
process.env.AEGIS_DATA = dir; process.env.AEGIS_DEMO = '1';
const KEY = 'sk-test-secret-1234';
let calls = [], reply = null, down = false;
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
    const body = JSON.parse(b); calls.push({ url: req.url, key: req.headers['x-api-key'], body });
    const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (down) return send(500, {});
    if (req.headers['x-api-key'] !== KEY) return send(401, { error: 'bad key' });
    if (body.tool_choice?.type === 'tool' && body.thinking?.type !== 'disabled') return send(400, { error: 'tool_choice tool not allowed in thinking mode' });
    if (body.messages[0].content.some((c) => c.type === 'document')) return send(400, { error: 'document not supported' });
    const name = body.tools[0].name, input = name === 'record_ping' ? { ok: true } : name === 'classify' ? { intent: 'coverage' } : reply;
    send(200, { content: [{ type: 'tool_use', name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
  });
});
const { start, server } = require('../server/index.js');
const db = require('../server/lib/db'), P = require('../server/platform');
let base, admin, hr;
async function login(email) {
  const r = await fetch(`${base}/api/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo1234' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = async (m, p, b) => { const x = await fetch(base + p, { method: m, headers: { cookie, 'x-aegis-client': 'web' }, body: b ? JSON.stringify(b) : undefined }); return { status: x.status, text: await x.clone().text(), data: await x.json().catch(() => null) }; };
  return { get: (p) => call('GET', p), post: (p, b = {}) => call('POST', p, b) };
}
const up = (name, mime, bytes) => ({ name, mime, data: Buffer.from(bytes).toString('base64') });
test.before(async () => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AEGIS_LLM_PROVIDER;
  await new Promise((ok) => fake.listen(0, ok));
  process.env.AEGIS_LLM_BASE_URL = `http://127.0.0.1:${fake.address().port}/anthropic/v1/messages`;
  await start(0, { loop: false }); base = `http://127.0.0.1:${server.address().port}`;
  admin = await login('sathinath@bluebix.demo'); hr = await login('hr@bluebix.demo');
});
test.after(() => { server.close(); fake.close(); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }); } catch {} setTimeout(() => process.exit(0), 50); });

test('default DeepSeek address and model are the documented ones', () => {
  const { PROVIDERS } = require('../server/llm.js');
  assert.equal(PROVIDERS.deepseek.url, 'https://api.deepseek.com/anthropic/v1/messages');
  assert.equal(PROVIDERS.deepseek.model, 'deepseek-flash');
});
test('key setup: needs admin and approval, wrong key is not saved, key never comes back', async () => {
  assert.equal((await hr.post('/api/ai', { provider: 'deepseek', api_key: KEY, approved: true })).status, 403);
  assert.equal((await admin.post('/api/ai', { provider: 'deepseek', api_key: KEY })).status, 400);
  const bad = await admin.post('/api/ai', { provider: 'deepseek', api_key: 'wrong', approved: true });
  assert.equal(bad.status, 422); assert.match(bad.data.error, /rejected/);
  assert.equal((await admin.get('/api/ai')).data.configured, false);
  const ok = await admin.post('/api/ai', { provider: 'deepseek', api_key: KEY, approved: true });
  assert.equal(ok.status, 200); assert.equal(ok.data.key_hint, '••••1234'); assert.equal(ok.data.model, 'deepseek-flash');
  assert.ok(!ok.text.includes(KEY));
  for (const r of db.all('SELECT v FROM meta')) assert.ok(!r.v.includes(KEY), 'stored encrypted');
  assert.ok(!db.all('SELECT action FROM audit_log').some((a) => a.action.includes(KEY)));
  const c = calls.at(-1); assert.equal(c.url, '/anthropic/v1/messages'); assert.equal(c.key, KEY); assert.equal(c.body.model, 'deepseek-flash'); assert.deepEqual(c.body.thinking, { type: 'disabled' }); assert.equal(c.body.tool_choice.type, 'tool');
});
test('a photo is read by AI, but a person must still confirm it and the case stays open', async () => {
  const c = db.get("SELECT * FROM cases WHERE subject_name='Chloe Dubois' AND control_key='CTRL-ONB-HANDBOOK' AND closed_at IS NULL");
  reply = { doc_type: 'handbook_ack', holder_name: 'Chloe Dubois', confidence: 0.99 }; calls = [];
  const r = await admin.post('/api/evidence', { subject_type: 'worker', subject_id: c.subject_id, control_key: c.control_key, file: up('ack.png', 'image/png', [137, 80, 78, 71, 1]) });
  assert.equal(r.data.status, 'needs_review'); assert.ok(r.data.reasons.some((x) => /read by AI/.test(x)));
  const block = calls[0].body.messages[0].content.find((x) => x.type === 'image'); assert.equal(block.source.media_type, 'image/png');
  await P.drain();
  const d = (await admin.get(`/api/cases/${c.id}`)).data; assert.equal(d.state, 'in_review'); assert.equal(d.closed_at, null); assert.notEqual(d.evaluation.status, 'pass');
  assert.equal(db.get('SELECT holder_name h FROM evidence WHERE id=?', r.data.id).h, 'Chloe Dubois');
});
test('scanned PDF is not sent to DeepSeek and goes to review with a clear reason', async () => {
  const w = db.get("SELECT * FROM workers WHERE name LIKE 'Elena%'"); calls = [];
  const r = await admin.post('/api/evidence', { subject_type: 'worker', subject_id: w.id, control_key: 'CTRL-HC-ACLS', file: up('scan.pdf', 'application/pdf', [37, 80, 68, 70, 45, 1, 2, 3]) });
  assert.equal(calls.length, 0); assert.equal(r.data.status, 'needs_review'); assert.ok(r.data.reasons.some((x) => /scanned PDF/.test(x)));
});
test('provider outage falls back to review and stays visible', async () => {
  const w = db.get("SELECT * FROM workers WHERE name LIKE 'Maria%'"); down = true;
  const r = await admin.post('/api/evidence', { subject_type: 'worker', subject_id: w.id, control_key: 'CTRL-HC-ACLS', file: up('x.jpg', 'image/jpeg', [255, 216, 255, 9]) });
  down = false;
  assert.equal(r.status, 200); assert.equal(r.data.status, 'needs_review'); assert.ok(r.data.reasons.some((x) => /AI could not read/.test(x)));
  assert.match((await admin.get('/api/health')).data.ai_error.message, /returned an error/);
});
test('chat uses the provider for free-form questions, and answers come from records', async () => {
  calls = [];
  const out = await admin.post('/api/chat', { text: 'where do we stand overall on the rules?' });
  assert.equal(calls.at(-1).body.tools[0].name, 'classify'); assert.match(out.data.reply, /applicable checks pass/);
  assert.equal((await admin.get('/api/health')).data.ai_error, null);
  assert.ok((await admin.get('/api/metrics')).data.llm_calls >= 2);
});
