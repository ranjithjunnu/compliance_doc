'use strict';
// Reusable connector layer: every source maps into one internal worker record.
const db = require('./lib/db'), { clock, id, j, encrypt, decrypt, parseCsv, parseXlsx, normDate } = require('./lib/util');
const P = require('./platform');
const { HttpError, SYSTEM } = P;
const inferCategory = (r) => /\b(nurse|rn|np|lpn|physician|therapist|md|pt|clinician|pediatrician)\b/i.test(`${r.role} ${r.license_type || ''}`) ? 'clinical' : 'corporate';

function ensureEntity(t, name) {
  if (!name) return null;
  let e = db.get('SELECT * FROM entities WHERE tenant_id=? AND name=?', t, name);
  if (!e) { e = { id: id('ent'), tenant_id: t, name }; db.insert('entities', e); }
  return e.id;
}
function ensureFacility(t, name, state) {
  let f = db.get('SELECT * FROM facilities WHERE tenant_id=? AND name=?', t, name);
  if (!f) { f = { id: id('fac'), tenant_id: t, name, state: state || null }; db.insert('facilities', f); }
  return f.id;
}
function upsertWorker(t, rec, source, actor = SYSTEM) {
  return db.tx(() => {
    let w = rec.external_id ? db.get('SELECT * FROM workers WHERE tenant_id=? AND source=? AND external_id=?', t, source, rec.external_id) : null;
    if (!w && rec.email) w = db.get('SELECT * FROM workers WHERE tenant_id=? AND lower(email)=lower(?)', t, rec.email);
    const entity_id = ensureEntity(t, rec.entity), now = clock.iso();
    const fields = { name: rec.name, email: rec.email || null, slack_id: rec.slack_id || null, role: rec.role || null, category: rec.category || inferCategory(rec), dept: rec.dept || null, license_type: rec.license_type || null, entity_id, status: rec.status || 'active', hire_date: normDate(rec.hire_date), work_auth_expires: normDate(rec.work_auth_expires), attrs_json: JSON.stringify(rec.attrs || {}), updated_at: now };
    let changed = true, created = false;
    if (w) {
      changed = Object.keys(fields).some((k) => k !== 'updated_at' && (w[k] ?? null) !== (fields[k] ?? null));
      if (changed) db.update('workers', w.id, fields);
    } else {
      w = { id: id('wkr'), tenant_id: t, external_id: rec.external_id || null, source, created_at: now, ...fields };
      db.insert('workers', w); created = true;
      P.audit(t, 'WORKER_ADDED', rec.name, `Added from ${source}.`, actor);
    }
    let moved = false;
    if (rec.facility) {
      const fid = ensureFacility(t, rec.facility, rec.facility_state);
      const cur = db.get("SELECT * FROM assignments WHERE tenant_id=? AND worker_id=? AND status='active'", t, w.id);
      if (!cur || cur.facility_id !== fid) {
        if (cur) db.update('assignments', cur.id, { status: 'ended', end_date: clock.today() });
        db.insert('assignments', { id: id('asn'), tenant_id: t, worker_id: w.id, facility_id: fid, role: rec.role, start_date: normDate(rec.assignment_start) || clock.today(), status: 'active' });
        moved = true;
        if (cur) P.audit(t, 'ASSIGNMENT_CHANGED', rec.name, `Assignment moved to ${rec.facility}.`, actor);
      }
    }
    if (created || changed || moved) P.enqueue(t, 'evaluate_subject', { type: 'worker', id: w.id, trigger: created ? 'worker_added' : moved ? 'assignment_changed' : 'worker_updated' }, { dedupe: `eval:worker:${w.id}` });
    return { id: w.id, created, changed: changed || moved };
  });
}
function createConnector(t, { type, name, config, capabilities }) {
  const c = { id: id('con'), tenant_id: t, type, name, config_enc: encrypt(Buffer.from(JSON.stringify(config))).toString('base64'), status: 'connected', capabilities_json: JSON.stringify(capabilities || []) };
  db.insert('connectors', c);
  return c;
}
const configOf = (c) => JSON.parse(decrypt(Buffer.from(c.config_enc, 'base64')).toString());
const baseUrl = (cfg) => cfg.base_url === 'self' ? `http://127.0.0.1:${process.env.ACTUAL_PORT}/mock-hrms` : cfg.base_url;
// Flexible HRMS mapping supporting standard REST APIs and common HR systems
const mapHrms = (r) => ({
  external_id: String(r.id || r.external_id || r.employee_id || r.worker_id || r.emp_id || ''),
  name: r.full_name || r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
  email: r.work_email || r.email || '',
  slack_id: r.slack_id || null,
  role: r.job_title || r.role || r.title || r.designation || null,
  category: r.worker_type || r.category || inferCategory(r),
  dept: r.department || r.dept || null,
  license_type: r.license_type || null,
  entity: r.employing_entity || r.entity || r.company || null,
  status: (r.employment_status || r.status || '').toLowerCase() === 'terminated' ? 'terminated' : 'active',
  hire_date: normDate(r.hire_date || r.start_date || r.joining_date),
  work_auth_expires: normDate(r.work_auth_expires || r.visa_expires),
  facility: r.assignment?.facility || r.facility || r.location || r.work_location || null,
  facility_state: r.assignment?.state || r.facility_state || r.state || null,
  assignment_start: normDate(r.assignment?.start_date || r.assignment_start || r.hire_date),
  attrs: r.attributes || r.attrs || {}
});
async function syncConnector(t, connId, actor = SYSTEM) {
  const c = db.get('SELECT * FROM connectors WHERE id=? AND tenant_id=?', connId, t);
  if (!c) throw new HttpError(404, 'Connector not found.');
  const cfg = configOf(c);
  try {
    const authHeader = cfg.api_key ? (cfg.auth_type === 'basic' ? `Basic ${cfg.api_key}` : `Bearer ${cfg.api_key}`) : undefined;
    const headers = { ...(authHeader ? { authorization: authHeader } : {}) };
    const fetchUrl = `${baseUrl(cfg)}${cfg.path || '/workers'}${c.cursor ? `?since=${encodeURIComponent(c.cursor)}` : ''}`;
    const res = await fetch(fetchUrl, { headers });
    if (!res.ok) throw new Error(`HRMS returned ${res.status}`);
    const body = await res.json(); let n = 0;
    const workerList = Array.isArray(body) ? body : (body.workers || body.data || body.employees || body.results || []);
    for (const r of workerList) { upsertWorker(t, mapHrms(r), c.id, actor); n++; }
    db.update('connectors', c.id, { cursor: body.next_cursor || c.cursor, status: 'connected', last_sync_at: clock.iso(), last_error: null, records: c.records + n });
    P.audit(t, 'HRMS_SYNC', c.name, `Synchronized ${n} changed record(s).`, actor);
    return { records: n };
  } catch (e) {
    db.update('connectors', c.id, { status: 'error', last_error: e.message });
    P.audit(t, 'CONNECTOR_ERROR', c.name, `Sync failed: ${e.message}`, actor);
    throw new HttpError(502, `HRMS sync failed: ${e.message}`);
  }
}
function processHrmsEvent(t, { event_id }) {
  const ev = db.get('SELECT * FROM events WHERE id=? AND tenant_id=?', event_id, t);
  if (!ev || ev.status === 'processed') return;
  const p = j(ev.payload_json), c = db.get("SELECT * FROM connectors WHERE tenant_id=? AND id=?", t, ev.source);
  upsertWorker(t, mapHrms(p.worker), c.id);
  db.update('events', ev.id, { status: 'processed', processed_at: clock.iso() });
  P.audit(t, 'HRMS_EVENT', p.worker.full_name, `Processed ${p.type}.`);
}
const HEADERS = { name: /^(full ?)?name|worker|employee$/i, email: /e-?mail/i, role: /role|title|position/i, dept: /dep(t|artment)/i, facility: /facility|location|site/i, facility_state: /^state|work state/i, entity: /entity|employer/i, license_type: /licen[sc]e ?type/i, hire_date: /hire|start/i, category: /category|worker type/i, external_id: /^(employee )?id$|employee ?(id|no)/i };
function previewImport(t, user, { filename, data }) {
  let rows;
  try { rows = /\.xlsx$/i.test(filename) ? parseXlsx(data) : parseCsv(data.toString('utf8')); }
  catch (e) { throw new HttpError(400, `Could not read file: ${e.message}`); }
  if (rows.length < 2) throw new HttpError(400, 'The file needs a header row and at least one worker.');
  const mapping = rows[0].map((h) => Object.keys(HEADERS).find((k) => HEADERS[k].test(String(h).trim())) || null);
  if (!mapping.includes('name')) throw new HttpError(400, 'No name column found.');
  const out = [], errors = [], unmapped = rows[0].filter((_, i) => !mapping[i]);
  rows.slice(1).forEach((r, i) => {
    const rec = {};
    mapping.forEach((k, c) => { if (k && r[c] !== undefined && String(r[c]).trim()) rec[k] = String(r[c]).trim(); });
    if (!rec.name) { errors.push({ row: i + 2, error: 'Missing name' }); return; }
    if (rec.category) rec.category = /clin/i.test(rec.category) ? 'clinical' : 'corporate';
    out.push(rec);
  });
  const imp = { id: id('imp'), tenant_id: t, filename, rows_json: JSON.stringify(out), status: 'preview', created_by: user.name, created_at: clock.iso() };
  db.insert('imports', imp);
  return { id: imp.id, filename, total: out.length, errors, unmapped, sample: out.slice(0, 10), missing: { facility: out.filter((r) => !r.facility).length, email: out.filter((r) => !r.email).length, hire_date: out.filter((r) => !r.hire_date).length } };
}
function commitImport(t, user, impId) {
  const imp = db.get("SELECT * FROM imports WHERE id=? AND tenant_id=? AND status='preview'", impId, t);
  if (!imp) throw new HttpError(404, 'Import not found or already committed.');
  let created = 0, updated = 0;
  for (const r of j(imp.rows_json)) { const x = upsertWorker(t, r, 'spreadsheet', user); if (x.created) created++; else if (x.changed) updated++; }
  db.update('imports', imp.id, { status: 'committed' });
  P.audit(t, 'ROSTER_IMPORT', imp.filename, `Imported roster: ${created} added, ${updated} updated.`, user);
  return { created, updated };
}
module.exports = { upsertWorker, createConnector, syncConnector, processHrmsEvent, previewImport, commitImport, ensureEntity, ensureFacility, configOf };
