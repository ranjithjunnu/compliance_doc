'use strict';
const crypto = require('crypto');
const db = require('./lib/db'), { clock, id, sha256, token, j, hashPassword, checkPassword } = require('./lib/util');
const P = require('./platform'), R = require('./registry'), E = require('./engine'), Ev = require('./evidence'), C = require('./connectors'), V = require('./views'), Chat = require('./chat'), llm = require('./llm'), mock = require('./mock-hrms'), channels = require('./channels');
const { HttpError } = P;
const routes = [];
const add = (m, p, fn, o = {}) => { const keys = []; const re = new RegExp('^' + p.replace(/:([a-z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$'); routes.push({ m, re, keys, fn, o }); };
const demo = () => process.env.AEGIS_DEMO === '1';
const file = (b) => { if (!b.file?.data) throw new HttpError(400, 'A file is required.'); return { filename: String(b.file.name || 'upload').slice(0, 200), mime: String(b.file.mime || 'application/octet-stream'), data: Buffer.from(b.file.data, 'base64') }; };
const edit = (u) => { if (u.role === 'viewer') throw new HttpError(403, 'Read-only role.'); };
const getCase = (t, cid) => { const c = db.get('SELECT * FROM cases WHERE id=? AND tenant_id=?', cid, t); if (!c) throw new HttpError(404, 'Case not found.'); return c; };
const seen = (u, c) => { if (c.restricted && !P.canSeeRestricted(u)) throw new HttpError(403, 'This case is restricted.'); };

// ---- public
add('GET', '/api/public/info', () => ({ demo: demo(), accounts: demo() ? [['sathinath@bluebix.demo', 'Bluebix admin (populated pilot)'], ['admin@northstar.demo', 'Northstar admin (blank external test)'], ['health@bluebix.demo', 'Healthcare compliance'], ['hr@bluebix.demo', 'HR (cannot see immigration)'], ['immigration@bluebix.demo', 'Immigration owner'], ['finance@bluebix.demo', 'Finance'], ['viewer@bluebix.demo', 'Read only']] : [], demo_password: demo() ? 'demo1234' : null }), { public: true });
const attempts = new Map();
add('POST', '/api/login', ({ body, res }) => {
  const key = String(body.email || '').toLowerCase(), a = attempts.get(key) || { n: 0, at: Date.now() };
  if (Date.now() - a.at > 9e5) { a.n = 0; a.at = Date.now(); }
  if (++a.n > 10) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
  attempts.set(key, a);
  const u = db.get('SELECT * FROM users WHERE lower(email)=lower(?)', String(body.email || ''));
  if (!u || !checkPassword(String(body.password || ''), u.password_hash)) throw new HttpError(401, 'Incorrect email or password.');
  const raw = token();
  db.insert('sessions', { token_hash: sha256(raw), user_id: u.id, expires_at: new Date(Date.now() + 12 * 36e5).toISOString() });
  res.setHeader('set-cookie', `aegis_sid=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${/^https:/.test(process.env.AEGIS_BASE_URL || '') ? '; Secure' : ''}`);
  attempts.delete(key);
  return { ok: true };
}, { public: true });
add('POST', '/api/logout', ({ sid, res }) => { db.run('DELETE FROM sessions WHERE token_hash=?', sha256(sid || '')); res.setHeader('set-cookie', 'aegis_sid=; Path=/; Max-Age=0'); return { ok: true }; });
add('GET', '/api/me', ({ t, user }) => { const tn = db.get('SELECT name,slug,kind FROM tenants WHERE id=?', t); return { user: { id: user.id, name: user.name, email: user.email, role: user.role, role_label: P.ROLE_LABEL[user.role], can_restricted: P.canSeeRestricted(user), is_admin: P.isAdmin(user) }, tenant: tn, demo: demo(), today: clock.today() }; });
const tokenCase = (raw) => {
  const s = db.get('SELECT * FROM submission_tokens WHERE token_hash=?', sha256(raw));
  if (!s || s.expires_at < clock.iso()) throw new HttpError(410, 'This link has expired or is not valid.');
  const c = db.get('SELECT * FROM cases WHERE id=? AND tenant_id=?', s.case_id, s.tenant_id);
  if (!c || c.closed_at) throw new HttpError(410, 'This request is already complete.');
  return c;
};
add('GET', '/api/submit/:token', ({ p }) => { const c = tokenCase(p.token); return { first_name: c.subject_type === 'worker' ? c.subject_name.split(/[ ,]/)[0] : c.subject_name, document: c.control_name, due: c.due_date, state: c.state }; }, { public: true });
const limits = new Map();
add('POST', '/api/submit/:token', async ({ p, body }) => {
  const k = sha256(p.token), n = (limits.get(k) || 0) + 1; limits.set(k, n);
  if (n > 20) throw new HttpError(429, 'Too many uploads. Please contact your coordinator.');
  const c = tokenCase(p.token), f = file(body);
  const ev = await Ev.intake(c.tenant_id, { subject_type: c.subject_type, subject_id: c.subject_id, control_key: c.control_key, ...f, source: 'secure_link', case_id: c.id }, { name: c.subject_name });
  return { received: true, status: ev.status === 'accepted' ? 'Your document was accepted and the check is being rerun.' : 'Thanks. Your document was received and is waiting for review.' };
}, { public: true });

// ---- webhooks: authenticated by signature, not by session
add('POST', '/api/webhooks/hrms/:slug', ({ p, raw, req }) => {
  const tn = db.get('SELECT * FROM tenants WHERE slug=?', p.slug);
  if (!tn) throw new HttpError(404, 'Unknown tenant.');
  const want = 'sha256=' + crypto.createHmac('sha256', tn.webhook_secret).update(raw).digest('hex'), got = String(req.headers['x-aegis-signature'] || '');
  if (want.length !== got.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got))) throw new HttpError(401, 'Invalid signature.');
  const b = JSON.parse(raw), con = db.get("SELECT * FROM connectors WHERE tenant_id=? AND type='hrms'", tn.id);
  if (!con) throw new HttpError(409, 'No HRMS connector.');
  const evId = id('evt');
  const r = db.run("INSERT OR IGNORE INTO events(id,tenant_id,source,external_id,type,payload_json,status,received_at) VALUES(?,?,?,?,?,?,'received',?)", evId, tn.id, con.id, String(b.id), b.type, raw.toString(), clock.iso());
  if (!r.changes) return { accepted: true, duplicate: true };
  P.enqueue(tn.id, 'process_event', { event_id: evId });
  return { accepted: true };
}, { public: true });
add('POST', '/api/webhooks/slack', async ({ raw, req, body }) => {
  if (!channels.verifySlack(process.env.SLACK_SIGNING_SECRET, req.headers['x-slack-request-timestamp'], raw.toString(), req.headers['x-slack-signature'])) throw new HttpError(401, 'Invalid signature.');
  if (body.type === 'url_verification') return { challenge: body.challenge };
  const e = body.event;
  if (e?.type === 'message' && !e.bot_id && e.text) {
    const u = db.get('SELECT * FROM users WHERE slack_id=?', e.user);
    if (u) { const reply = await Chat.handle(u.tenant_id, { ...u, type: 'user' }, e.text); await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ channel: e.channel, text: reply }) }); }
  }
  return { ok: true };
}, { public: true });

// ---- read models
add('GET', '/api/overview', ({ t, user }) => V.overview(t, user));
add('GET', '/api/checks', ({ t, user, q }) => ({ rows: V.checks(t, user, { status: q.get('status'), pack: q.get('pack'), subject: q.get('subject') }), coverage: V.coverage(t) }));
add('GET', '/api/cases', ({ t, user, q }) => V.listCases(t, user, { closed: q.get('closed') === '1', pack: q.get('pack') }));
add('GET', '/api/cases/:id', ({ t, user, p }) => V.caseDetail(t, user, p.id));
add('POST', '/api/cases/chase-all', ({ t, user }) => { edit(user); let sent = 0, skipped = 0; for (const c of V.listCases(t, user).filter((x) => P.canPack(user, x.pack_key))) { const r = E.followUp(t, user, c); if (r.sent) sent++; else skipped++; } return { sent, skipped }; });
add('POST', '/api/cases/:id/follow-up', ({ t, user, p }) => { edit(user); const c = getCase(t, p.id); seen(user, c); return E.followUp(t, user, c); });
add('POST', '/api/cases/:id/note', ({ t, user, p, body }) => { edit(user); const c = getCase(t, p.id); seen(user, c); if (!body.note) throw new HttpError(400, 'Note is required.'); db.insert('case_notes', { id: id('note'), tenant_id: t, case_id: c.id, note: String(body.note).slice(0, 2000), author: user.name, created_at: clock.iso() }); P.audit(t, 'CASE_NOTE', c.subject_name, `Note added. A note does not change the check result: ${String(body.note).slice(0, 200)}`, user, { case_id: c.id }); return { ok: true }; });
add('POST', '/api/cases/:id/verdict', ({ t, user, p, body }) => { edit(user); const c = getCase(t, p.id); seen(user, c); E.recordVerdict(t, user, c, body.verdict, body.note); return { ok: true }; });
add('POST', '/api/cases/:id/decision', ({ t, user, p, body }) => { edit(user); const c = getCase(t, p.id); seen(user, c); P.assertPack(user, c.pack_key); E.requestDecision(t, user, 'assignment_review', c, `${body.title || 'Decision'}: ${c.subject_name}`, `${c.gap} ${body.detail || ''}`.trim(), c.pack_key, c.id); return { ok: true }; });
add('GET', '/api/workers', ({ t, user }) => V.listWorkers(t, user));
add('GET', '/api/workers/:id', ({ t, user, p }) => V.workerDetail(t, user, p.id));
add('POST', '/api/workers', ({ t, user, body }) => {
  edit(user); if (!P.isAdmin(user) && user.role !== 'hr') throw new HttpError(403, 'HR or administrator role required.');
  if (!body.name) throw new HttpError(400, 'Name is required.');
  const r = C.upsertWorker(t, { name: body.name, email: body.email, role: body.role, license_type: body.license_type || null, category: body.category, dept: body.dept, facility: body.facility, facility_state: body.facility_state, entity: body.entity, hire_date: body.hire_date || clock.today(), work_auth_expires: body.work_auth_expires, attrs: {} }, 'manual', user);
  return r;
});
add('POST', '/api/workers/:id/assignment', ({ t, user, p, body }) => {
  edit(user); const w = db.get('SELECT * FROM workers WHERE id=? AND tenant_id=?', p.id, t); if (!w) throw new HttpError(404, 'Worker not found.');
  if (!body.facility) throw new HttpError(400, 'Facility is required.');
  C.upsertWorker(t, { external_id: w.external_id, email: w.email, name: w.name, role: w.role, category: w.category, dept: w.dept, license_type: w.license_type, entity: db.get('SELECT name FROM entities WHERE id=?', w.entity_id)?.name, hire_date: w.hire_date, status: w.status, work_auth_expires: w.work_auth_expires, attrs: j(w.attrs_json, {}), facility: body.facility, facility_state: body.facility_state }, w.source, user);
  return { ok: true };
});
add('POST', '/api/workers/:id/readiness-review', ({ t, user, p }) => { edit(user); const d = V.workerDetail(t, user, p.id); E.requestDecision(t, user, 'readiness_decision', null, `Assignment readiness: ${d.name}`, d.readiness_view.statement, 'onboarding', d.id); return { ok: true }; });
add('GET', '/api/evidence', ({ t, user }) => V.listEvidence(t, user));
add('POST', '/api/evidence', async ({ t, user, body }) => { edit(user); const ev = await Ev.intake(t, { subject_type: body.subject_type || 'worker', subject_id: body.subject_id, control_key: body.control_key || null, ...file(body), claimed: body.claimed || {}, source: body.bulk ? 'bulk_upload' : 'upload' }, user); return { id: ev.id, status: ev.status, duplicate: !!ev.duplicate, reasons: j(ev.review_reasons_json, []) }; });
const getEv = (t, u, eid) => { const e = db.get('SELECT * FROM evidence WHERE id=? AND tenant_id=?', eid, t); if (!e) throw new HttpError(404, 'Evidence not found.'); if (e.restricted && !P.canSeeRestricted(u)) throw new HttpError(403, 'This evidence is restricted.'); return e; };
add('POST', '/api/evidence/:id/review', ({ t, user, p, body }) => { edit(user); Ev.review(t, user, getEv(t, user, p.id), body); return { ok: true }; });
add('GET', '/api/evidence/:id/file', ({ t, user, p, res }) => { const e = getEv(t, user, p.id); if (!e.stored_path) throw new HttpError(404, 'Demo evidence has no file.'); P.audit(t, 'EVIDENCE_VIEWED', e.filename, 'Document opened.', user); res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${e.filename.replace(/[^\w.\-]/g, '_')}"` }); res.end(Ev.readFile(e)); return res; });

// ---- governance
add('GET', '/api/packs', ({ t }) => V.packRows(t));
add('POST', '/api/packs/:key/activate', ({ t, user, p, body }) => { R.activatePack(t, user, p.key, body); return { ok: true }; });
add('POST', '/api/packs/:key/mode', ({ t, user, p, body }) => { E.setMode(t, user, p.key, body.mode); return { ok: true }; });
add('GET', '/api/controls', ({ t }) => ({ controls: R.effectiveControls(t).map((c) => ({ key: c.key, name: c.name, pack: c.pack_key, requirement_type: c.requirement_type, type: c.type, version: c.version_label, overridden: !!c.overridden, custom: !!c.custom, remediation: c.remediation, params: c.params })), changes: db.all('SELECT * FROM control_changes WHERE tenant_id=? ORDER BY created_at DESC', t).map((c) => ({ ...c, preview: j(c.preview_json) })) }));
add('POST', '/api/controls/draft', ({ t, user, body }) => { edit(user); return R.draftControl(t, user, body, E.loadCtx); });
add('POST', '/api/controls/:id/submit', ({ t, user, p }) => { edit(user); R.submitDraft(t, user, p.id); return { ok: true }; });
add('GET', '/api/approvals', ({ t, user, q }) => V.listApprovals(t, user, q.get('status') || 'pending'));
add('POST', '/api/approvals/:id/decide', ({ t, user, p, body }) => { const a = db.get('SELECT * FROM approvals WHERE id=? AND tenant_id=?', p.id, t); if (!a) throw new HttpError(404, 'Approval not found.'); E.decide(t, user, a, body.decision, body.note); return { ok: true }; });

// ---- setup
add('GET', '/api/setup', ({ t }) => V.setupState(t));
const setS = (t, patch) => { const tn = db.get('SELECT setup_json s FROM tenants WHERE id=?', t); db.update('tenants', t, { setup_json: JSON.stringify({ ...j(tn.s, {}), ...patch }) }); };
add('POST', '/api/setup/facility/:id', ({ t, user, p, body }) => { P.assertAdmin(user); const f = db.get('SELECT * FROM facilities WHERE id=? AND tenant_id=?', p.id, t); if (!f) throw new HttpError(404, 'Facility not found.'); db.update('facilities', f.id, { requirements_json: JSON.stringify(body.requirements || []), requirements_confirmed: 1, requirement_source: body.source || 'Confirmed by administrator', state: body.state || f.state }); P.audit(t, 'CONTEXT_CONFIRMED', f.name, `Facility requirements confirmed: ${(body.requirements || []).join(', ') || 'none'}.`, user); P.enqueue(t, 'evaluate_tenant', { trigger: 'context_confirmed' }, { dedupe: `eval_tenant:${t}` }); return { ok: true }; });
add('POST', '/api/setup/context', ({ t, user }) => { P.assertAdmin(user); db.run('UPDATE entities SET confirmed=1 WHERE tenant_id=?', t); setS(t, { context_confirmed: true }); P.audit(t, 'CONTEXT_CONFIRMED', 'Company profile', 'Administrator confirmed employing entities and work locations.', user); return { ok: true }; });
add('POST', '/api/setup/channel', ({ t, user, body }) => { P.assertAdmin(user); db.update('tenants', t, { channel_json: JSON.stringify({ type: body.type === 'slack' ? 'slack' : 'outbox', channel: body.channel || '#compliance-alerts' }) }); setS(t, { channel_confirmed: true }); P.audit(t, 'CHANNEL_SET', 'Reporting channel', `Reporting channel set to ${body.type || 'outbox'}.`, user); return { ok: true }; });
add('POST', '/api/setup/assess', async ({ t, user }) => { P.assertAdmin(user); E.evaluateTenant(t, 'initial_assessment'); await P.drain(); return V.coverage(t); });

// ---- connectors
add('POST', '/api/connectors', ({ t, user, body }) => { P.assertAdmin(user); if (!body.base_url || !body.api_key) throw new HttpError(400, 'Base URL and API key are required.'); const c = C.createConnector(t, { type: 'hrms', name: body.name || 'HRMS', config: { base_url: body.base_url, api_key: body.api_key }, capabilities: ['workers', 'scheduled_import'] }); return { id: c.id }; });
add('POST', '/api/connectors/:id/sync', async ({ t, user, p }) => { edit(user); const r = await C.syncConnector(t, p.id, user); P.drain(); return r; });
add('POST', '/api/import/preview', ({ t, user, body }) => { edit(user); return C.previewImport(t, user, file(body)); });
add('POST', '/api/import/:id/commit', ({ t, user, p }) => { edit(user); const r = C.commitImport(t, user, p.id); return r; });
add('GET', '/api/health', ({ t }) => V.health(t));
add('GET', '/api/messages', ({ t, user }) => { P.assertAdmin(user); return db.all('SELECT * FROM messages WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100', t); });

// ---- reporting
add('GET', '/api/audit', ({ t, user }) => { P.assertAdmin(user); return db.all('SELECT * FROM audit_log WHERE tenant_id=? ORDER BY seq DESC LIMIT 300', t); });
add('GET', '/api/audit/verify', ({ t, user }) => { P.assertAdmin(user); return P.verifyAudit(t); });
add('GET', '/api/audit/export', ({ t, user, res }) => { P.assertAdmin(user); res.writeHead(200, { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="aegis-audit.json"' }); res.end(JSON.stringify({ verification: P.verifyAudit(t), entries: db.all('SELECT * FROM audit_log WHERE tenant_id=? ORDER BY seq', t) }, null, 1)); return res; });
add('GET', '/api/reports/:pack', ({ t, user, p, res }) => { res.writeHead(200, { 'content-type': 'text/csv', 'content-disposition': `attachment; filename="aegis-${p.pack.replace(/\W/g, '')}.csv"` }); res.end(V.reportCsv(t, user, p.pack)); return res; });
add('GET', '/api/dashboards', ({ t, user }) => V.dashboardsFor(t, user).map((d) => ({ ...d, definition: j(d.definition_json), roles: j(d.roles_json) })));
add('POST', '/api/dashboards', ({ t, user, body }) => { edit(user); const did = id('dash'); db.insert('dashboards', { id: did, tenant_id: t, name: String(body.name || 'Dashboard').slice(0, 120), definition_json: JSON.stringify({ pack: body.pack || null, metric: body.metric || 'open_gaps', group_by: body.group_by || 'facility' }), roles_json: JSON.stringify(body.roles?.length ? body.roles : [user.role]), created_by: user.name, created_at: clock.iso() }); return { id: did }; });
add('GET', '/api/dashboards/:id', ({ t, user, p }) => { const d = V.dashboardsFor(t, user).find((x) => x.id === p.id); if (!d) throw new HttpError(403, 'You do not have access to this dashboard.'); const def = j(d.definition_json); return { ...d, definition: def, data: V.dashboardData(t, user, def) }; });
add('GET', '/api/metrics', ({ t }) => V.metrics(t));
add('POST', '/api/metrics/baseline', ({ t, user, body }) => { P.assertAdmin(user); db.run('INSERT INTO baselines(tenant_id,key,value,note,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(tenant_id,key) DO UPDATE SET value=excluded.value,note=excluded.note,updated_at=excluded.updated_at', t, String(body.key), +body.value, body.note || null, clock.iso()); return { ok: true }; });
add('POST', '/api/metrics/manual-support', ({ t, user, body }) => { edit(user); db.insert('manual_support', { id: id('ms'), tenant_id: t, minutes: +body.minutes, note: body.note || null, created_by: user.name, created_at: clock.iso() }); return { ok: true }; });
add('GET', '/api/notices', ({ t, user }) => { P.assertPack(user, 'payroll'); return db.all('SELECT * FROM notices WHERE tenant_id=? ORDER BY created_at DESC', t); });
add('POST', '/api/notices', ({ t, user, body }) => {
  P.assertPack(user, 'payroll');
  const n = { id: id('ntc'), tenant_id: t, entity_id: body.entity_id || null, agency: body.agency, notice_type: body.notice_type, received_on: body.received_on || clock.today(), response_due: body.response_due, summary: body.summary, status: 'draft_awaiting_approval', created_by: user.name, created_at: clock.iso() };
  n.draft_response = `DRAFT for finance review. Not filed or sent.\n\nRe: ${n.notice_type} from ${n.agency}, received ${n.received_on}.\n\nWe acknowledge the notice and are reviewing the matter described: ${n.summary}\n\n[Finance to confirm facts, amounts and supporting documents before any response is sent.]`;
  db.insert('notices', n);
  E.requestDecision(t, user, 'notice_response', null, `Notice response: ${n.agency} ${n.notice_type}`, `Respond by ${n.response_due || 'date not given'}. ${n.summary}`, 'payroll', n.id);
  return n;
});
add('GET', '/api/chat', ({ t, user }) => db.all('SELECT * FROM chat_messages WHERE tenant_id=? AND user_id=? ORDER BY created_at, rowid LIMIT 200', t, user.id));
add('POST', '/api/chat', async ({ t, user, body }) => { if (!body.text) throw new HttpError(400, 'Message is required.'); const reply = await Chat.handle(t, user, String(body.text).slice(0, 1000)); await P.drain(); return { reply }; });
add('GET', '/api/users', ({ t, user }) => { P.assertAdmin(user); return db.all('SELECT id,name,email,role,slack_id FROM users WHERE tenant_id=? ORDER BY name', t); });
add('POST', '/api/users', ({ t, user, body }) => { P.assertAdmin(user); if (!P.ROLE_PACKS[body.role]) throw new HttpError(400, 'Invalid role.'); if (!body.email || String(body.password || '').length < 8) throw new HttpError(400, 'Email and an 8+ character password are required.'); const uid = id('usr'); try { db.insert('users', { id: uid, tenant_id: t, email: body.email, name: body.name || body.email, role: body.role, password_hash: hashPassword(body.password), slack_id: body.slack_id || null, created_at: clock.iso() }); } catch { throw new HttpError(409, 'That email is already in use.'); } P.audit(t, 'USER_ADDED', body.email, `Added with role ${body.role}.`, user); return { id: uid }; });
add('GET', '/api/owners', ({ t }) => db.all('SELECT id,name,role FROM users WHERE tenant_id=? ORDER BY name', t));
add('POST', '/api/digest/send', ({ t, user }) => { P.assertAdmin(user); const tn = db.get('SELECT * FROM tenants WHERE id=?', t), body = V.digestText(t); channels.post(tn, j(tn.channel_json, {}).channel || '#compliance-alerts', 'Compliance digest', body); P.audit(t, 'DIGEST_SENT', 'Digest', 'Digest posted to the reporting channel.', user); return { body }; });

// ---- AI engine: keys are write-only and stored encrypted
add('GET', '/api/ai', ({ t, user }) => { P.assertAdmin(user); return llm.status(t); });
add('POST', '/api/ai', async ({ t, user, body }) => {
  P.assertAdmin(user);
  const key = String(body.api_key || '').trim();
  if (!llm.PROVIDERS[body.provider]) throw new HttpError(400, 'Choose an AI provider.');
  if (!key) throw new HttpError(400, 'Paste an API key.');
  if (!body.approved) throw new HttpError(400, 'Confirm that sending documents to this provider is approved.');
  const cfg = { provider: body.provider, key, approved_by: user.name, approved_at: clock.iso() };
  try { await llm.test(t, cfg); } catch (e) { throw new HttpError(422, e.name === 'TimeoutError' ? 'The AI provider timed out.' : e.message); }
  llm.save(t, cfg);
  P.audit(t, 'AI_CONFIGURED', 'AI engine', `AI provider set to ${llm.PROVIDERS[body.provider].label}. Document sharing approved by ${user.name}.`, user);
  return llm.status(t);
});
add('POST', '/api/ai/test', async ({ t, user }) => { P.assertAdmin(user); const s = llm.status(t); if (!s.configured) throw new HttpError(400, 'No AI key is set.'); const r = await llm.callTool(t, 'Connection test. Call the tool with ok set to true.', [{ type: 'text', text: 'Connection test.' }], 'record_ping', { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }); if (!r) throw new HttpError(502, llm.lastError(t)?.message || 'The AI provider did not return a result.'); return { ok: true, provider: s.provider_label }; });
add('POST', '/api/ai/remove', ({ t, user }) => { P.assertAdmin(user); llm.remove(t); P.audit(t, 'AI_CONFIGURED', 'AI engine', 'AI key removed.', user); return llm.status(t); });

// ---- demo controls
add('POST', '/api/demo/hrms-event', async ({ t, user, body }) => { P.assertAdmin(user); if (!demo()) throw new HttpError(404, 'Not found.'); const tn = db.get('SELECT * FROM tenants WHERE id=?', t); if (tn.slug !== 'bluebix') throw new HttpError(400, 'The mock HRMS is connected to Bluebix only.'); const r = await mock.emit(tn.slug, tn.webhook_secret, body.kind); await P.drain(); return { type: r.type, worker: r.worker, status: r.status }; });
add('POST', '/api/demo/advance', async ({ t, user, body }) => { P.assertAdmin(user); if (!demo()) throw new HttpError(404, 'Not found.'); clock.advanceDays(Math.min(+body.days || 1, 60)); E.runReminders(t); E.evaluateTenant(t, 'scheduled_check'); await P.drain(); E.runReminders(t); await P.drain(); return { today: clock.today() }; });
add('POST', '/api/demo/reset', async ({ user }) => { P.assertAdmin(user); if (!demo()) throw new HttpError(404, 'Not found.'); clock.reset(); db.resetAll(); R.loadPacks(); await require('./seed').seed(); return { ok: true }; });
module.exports = { routes };
