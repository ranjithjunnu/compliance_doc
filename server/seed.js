'use strict';
// Demo data only (AEGIS_DEMO=1). Everything goes through the real services.
const crypto = require('crypto');
const db = require('./lib/db'), { clock, id, addDays, hashPassword } = require('./lib/util');
const P = require('./platform'), R = require('./registry'), E = require('./engine'), C = require('./connectors'), Ev = require('./evidence'), mock = require('./mock-hrms'), { latestDuePeriod } = require('./evaluator');
const DEMO_PASSWORD = 'demo1234';
function tenant(slug, name, kind) {
  const t = { id: id('ten'), slug, name, kind, webhook_secret: crypto.randomBytes(24).toString('hex'), created_at: clock.iso() };
  db.insert('tenants', t);
  return t;
}
function user(t, email, name, role) {
  const u = { id: id('usr'), tenant_id: t.id, email, name, role, password_hash: hashPassword(DEMO_PASSWORD), created_at: clock.iso() };
  db.insert('users', u);
  return u;
}
function schedules(tid) {
  db.insert('schedules', { id: id('sch'), tenant_id: tid, kind: 'digest', cadence: 'daily', next_run_at: new Date(clock.now().getTime() + 864e5).toISOString(), enabled: 1 });
}
async function seed() {
  mock.reset();
  const b = tenant('bluebix', 'Bluebix Healthcare', 'internal_pilot');
  const admin = user(b, 'sathinath@bluebix.demo', 'Sathinath', 'admin');
  const hr = user(b, 'hr@bluebix.demo', 'Hannah Reed', 'hr'), hc = user(b, 'health@bluebix.demo', 'Grace Okafor', 'healthcare_compliance'), im = user(b, 'immigration@bluebix.demo', 'Ivan Morales', 'immigration_owner'), fi = user(b, 'finance@bluebix.demo', 'Farah Ali', 'finance');
  user(b, 'viewer@bluebix.demo', 'Vikram Shah', 'viewer');
  const con = C.createConnector(b.id, { type: 'hrms', name: 'Bluebix HRMS (mock API)', config: { base_url: 'self', api_key: 'mock-hrms-key' }, capabilities: ['workers', 'assignments', 'webhooks', 'incremental_sync'] });
  await C.syncConnector(b.id, con.id);
  await P.drain();
  const reqs = { 'St. Jude Medical Center': ['acls', 'flu_vaccine'], 'Kaiser Permanente': [], 'UCSF Health': ['acls'], "Stanford Children's": ['acls'], 'HQ Tech Hub': [], 'HQ Operations': [], 'Remote HQ': [] };
  for (const [name, r] of Object.entries(reqs)) db.run('UPDATE facilities SET requirements_json=?,requirements_confirmed=1,requirement_source=? WHERE tenant_id=? AND name=?', JSON.stringify(r), 'Client contract (demo)', b.id, name);
  db.run('UPDATE entities SET confirmed=1 WHERE tenant_id=?', b.id);
  db.update('tenants', b.id, { setup_json: JSON.stringify({ context_confirmed: true, channel_confirmed: true }) });
  const owners = { healthcare: hc, onboarding: hr, immigration: im, payroll: fi };
  const d = (n) => addDays(clock.today(), n), W = {};
  for (const w of db.all('SELECT * FROM workers WHERE tenant_id=?', b.id)) W[w.name.split(/[ ,]/)[0]] = w;
  const give = (w, doc_type, f = {}) => Ev.seedAccepted(b.id, 'worker', w.id, { doc_type, holder_name: w.name, ...f });
  const std = { expires_on: d(500), issued_on: d(-200), state: 'CA' };
  for (const k of ['Sarah', 'David', 'Elena', 'Maria', 'Chloe']) {
    give(W[k], 'professional_license', k === 'Sarah' ? { ...std, expires_on: d(18), doc_number: 'RN-672910' } : { ...std, doc_number: `LIC-${k.toUpperCase()}` });
    give(W[k], 'bls_card', std); give(W[k], 'tb_screening', { issued_on: d(-120) });
  }
  give(W.Sarah, 'acls_card', std); give(W.Sarah, 'flu_vaccine', { issued_on: d(-40) });
  give(W.Elena, 'acls_card', { expires_on: d(-5), issued_on: d(-700) }); give(W.Maria, 'acls_card', std);
  for (const k of Object.keys(W)) {
    if (k !== 'Chloe') give(W[k], 'handbook_ack');
    give(W[k], 'security_training'); give(W[k], 'w4');
    if (k !== 'Chloe') give(W[k], 'i9_record');
  }
  give(W.Alex, 'work_authorization', { expires_on: d(45) });
  const { period } = latestDuePeriod(clock.today());
  const staffing = db.get('SELECT * FROM entities WHERE tenant_id=? AND name=?', b.id, 'Bluebix Staffing Inc');
  Ev.seedAccepted(b.id, 'entity', staffing.id, { doc_type: 'payroll_filing_receipt', entity_name: staffing.name, period });
  for (const k of Object.keys(owners)) R.activatePack(b.id, admin, k, { owner_user_id: owners[k].id, reviewed: true });
  await P.drain();
  for (const k of ['healthcare', 'onboarding']) {
    for (const c of db.all('SELECT * FROM cases WHERE tenant_id=? AND pack_key=? AND closed_at IS NULL', b.id, k)) E.recordVerdict(b.id, owners[k], c, 'confirmed', 'Demo seed');
    E.setMode(b.id, owners[k], k, 'auto');
  }
  await P.drain();
  schedules(b.id);
  db.run('INSERT INTO baselines(tenant_id,key,value,note,updated_at) VALUES(?,?,?,?,?)', b.id, 'minutes_per_chase', 12, 'Demo assumption. Replace with Bluebix measurement.', clock.iso());
  const n = tenant('northstar', 'Northstar Care (external test)', 'external');
  user(n, 'admin@northstar.demo', 'Nora Lane', 'admin');
  for (const [e, nm, r] of [['hr@northstar.demo', 'Owen Hart', 'hr'], ['health@northstar.demo', 'Lena Cole', 'healthcare_compliance'], ['immigration@northstar.demo', 'Sam Vega', 'immigration_owner'], ['finance@northstar.demo', 'Tara Bell', 'finance']]) user(n, e, nm, r);
  schedules(n.id);
  P.drain && await P.drain();
}
module.exports = { seed, DEMO_PASSWORD };
