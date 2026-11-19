'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
try { if (process.loadEnvFile && fs.existsSync(path.join(__dirname, '..', '.env'))) process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const DATA = process.env.AEGIS_DATA = process.env.AEGIS_DATA || path.join(__dirname, '..', 'data');
process.env.AEGIS_DEMO = process.env.AEGIS_DEMO ?? '1';
fs.mkdirSync(DATA, { recursive: true });
const U = require('./lib/util'), db = require('./lib/db');
const secretFile = path.join(DATA, '.secret');
if (!process.env.AEGIS_SECRET && !fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
U.setSecret(process.env.AEGIS_SECRET || fs.readFileSync(secretFile, 'utf8'));
db.open(path.join(DATA, 'aegis.db'));
const P = require('./platform'), R = require('./registry'), E = require('./engine'), C = require('./connectors'), V = require('./views'), channels = require('./channels'), mock = require('./mock-hrms'), { routes } = require('./routes'), { seed } = require('./seed');
const { j, clock } = U;

P.on('process_event', (t, p) => C.processHrmsEvent(t, p));
P.on('evaluate_subject', (t, p) => E.evaluateById(t, p.type, p.id, p.trigger));
P.on('evaluate_tenant', (t, p) => E.evaluateTenant(t, p.trigger));
P.on('send_action', (t, p) => E.sendAction(t, p));
P.on('run_reminders', (t) => E.runReminders(t));
P.on('digest', (t) => { const tn = db.get('SELECT * FROM tenants WHERE id=?', t); channels.post(tn, j(tn.channel_json, {}).channel || '#compliance-alerts', 'Compliance digest', V.digestText(t)); P.audit(t, 'DIGEST_SENT', 'Digest', 'Scheduled digest posted.'); });
P.on('sync_connector', (t, p) => C.syncConnector(t, p.id));

function tick() {
  const today = clock.today();
  for (const tn of db.all('SELECT id FROM tenants')) {
    // Daily jobs: `once` stops them from running again every minute after they finish.
    P.enqueue(tn.id, 'evaluate_tenant', { trigger: 'scheduled_check' }, { dedupe: `daily:${tn.id}:${today}`, once: true });
    // Reminders run every minute on purpose: each case has its own next_reminder_at time.
    P.enqueue(tn.id, 'run_reminders', {}, { dedupe: `rem:${tn.id}` });
    for (const c of db.all("SELECT id FROM connectors WHERE tenant_id=? AND type='hrms' AND status!='disabled'", tn.id)) P.enqueue(tn.id, 'sync_connector', { id: c.id }, { dedupe: `sync:${c.id}:${today}`, once: true });
    for (const s of db.all('SELECT * FROM schedules WHERE tenant_id=? AND enabled=1 AND next_run_at<=?', tn.id, clock.iso())) {
      P.enqueue(tn.id, s.kind, {}, { dedupe: `${s.id}:${s.next_run_at}` });
      db.update('schedules', s.id, { next_run_at: new Date(clock.now().getTime() + (s.cadence === 'weekly' ? 7 : 1) * 864e5).toISOString() });
    }
  }
}
const PUB = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const HEADERS = { 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
function serve(res, file) {
  const fp = path.normalize(path.join(PUB, file));
  if (!fp.startsWith(PUB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(fp).pipe(res);
}
const readBody = (req) => new Promise((ok, no) => { const c = []; let n = 0; req.on('data', (d) => { n += d.length; if (n > 16 * 1024 * 1024) { no(new P.HttpError(413, 'Request too large.')); req.destroy(); } else c.push(d); }); req.on('end', () => ok(Buffer.concat(c))); req.on('error', no); });
function send(res, status, obj) { if (res.headersSent) return; res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/mock-hrms/') && process.env.AEGIS_DEMO === '1') return mock.route(req, res, url);
    if (url.pathname.startsWith('/submit/')) return serve(res, 'submit.html');
    if (!url.pathname.startsWith('/api/')) return serve(res, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const route = routes.find((r) => r.m === req.method && r.re.test(url.pathname));
    if (!route) return send(res, 404, { error: 'Not found' });
    const m = route.re.exec(url.pathname), p = {};
    route.keys.forEach((k, i) => { p[k] = decodeURIComponent(m[i + 1]); });
    const raw = req.method === 'GET' ? Buffer.alloc(0) : await readBody(req);
    let body = {};
    if (raw.length) { try { body = JSON.parse(raw); } catch { throw new P.HttpError(400, 'Invalid JSON.'); } }
    const sid = /(?:^|;\s*)aegis_sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const ctx = { req, res, p, q: url.searchParams, body, raw, sid };
    if (!route.o.public) {
      const s = sid && db.get('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?', U.sha256(sid), new Date().toISOString());
      const u = s && db.get('SELECT * FROM users WHERE id=?', s.user_id);
      if (!u) throw new P.HttpError(401, 'Please sign in.');
      if (req.method !== 'GET' && req.headers['x-aegis-client'] !== 'web') throw new P.HttpError(403, 'Missing client header.');
      ctx.user = { ...u, type: 'user' }; ctx.t = u.tenant_id;
    }
    const out = await route.fn(ctx);
    if (out !== res) send(res, 200, out);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong on the server.' });
  }
});
async function start(port = +(process.env.PORT || 4100), { loop = true } = {}) {
  R.loadPacks(); P.recoverStale();
  await new Promise((ok) => server.listen(port, ok));
  process.env.ACTUAL_PORT = String(server.address().port);
  if (process.env.AEGIS_DEMO === '1') { mock.reset(); if (!db.get('SELECT 1 x FROM tenants')) await seed(); }
  if (loop) { setInterval(() => P.loop().catch(console.error), 1000); setInterval(() => { try { tick(); } catch (e) { console.error(e); } }, 60000); tick(); }
  return server;
}
if (require.main === module) start().then((s) => console.log(`Aegis running at http://localhost:${s.address().port}`));
module.exports = { start, server, tick };
