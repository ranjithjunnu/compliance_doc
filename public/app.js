/* Aegis web workspace. All data comes from the API; nothing is calculated or stored in the browser. */
'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class Safe { constructor(s) { this.s = s; } }
const render = (v) => v instanceof Safe ? v.s : Array.isArray(v) ? v.map(render).join('') : v === null || v === undefined || v === false ? '' : esc(v);
const h = (st, ...v) => new Safe(st.reduce((a, s, i) => a + s + (i < v.length ? render(v[i]) : ''), ''));
const raw = (s) => new Safe(s);
const words = (s) => String(s ?? '').replace(/_/g, ' ');
const date = (s) => s ? String(s).slice(0, 10) : '—';
const dt = (s) => s ? String(s).slice(0, 16).replace('T', ' ') : '—';

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'x-aegis-client': 'web' }, body: JSON.stringify(body) });
  if (r.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Please sign in.'); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), 4200);
}
const fileData = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok({ name: f.name, mime: f.type || 'application/octet-stream', data: r.result.split(',')[1] }); r.onerror = no; r.readAsDataURL(f); });
function openModal(title, sub, body, foot, wide) {
  const c = $('#modalCard');
  c.className = `modal-card${wide ? ' wide' : ''}`;
  c.innerHTML = render(h`<div class="modal-header"><div class="modal-title-wrap"><h3 class="modal-title">${title}</h3><p class="modal-subtitle">${sub}</p></div><button class="modal-close-btn" data-act="closeModal" aria-label="Close">&times;</button></div><div class="modal-body">${body}</div>${foot ? h`<div class="modal-footer">${foot}</div>` : ''}`);
  $('#modal').classList.add('open');
}
const closeModal = () => $('#modal').classList.remove('open');

const PILL = { pass: ['pill-pass', 'Pass'], fail: ['pill-fail', 'Fail'], unknown: ['pill-unknown', 'Unknown'], not_applicable: ['pill-na', 'N/A'], restricted: ['pill-na', 'Restricted'], not_assessed: ['pill-na', 'Not assessed'] };
const statusPill = (s) => { const [c, l] = PILL[s] || ['pill-na', words(s)]; return h`<span class="pill ${c}">${l}</span>`; };
const STATE_PILL = { needs_review: 'pill-warn', accepted: 'pill-pass', rejected: 'pill-fail', superseded: 'pill-na', sent: 'pill-pass', queued: 'pill-blue', pending_approval: 'pill-warn' };
const statePill = (s) => h`<span class="pill ${STATE_PILL[s] || 'pill-blue'}">${words(s)}</span>`;
const prio = (p) => h`<span class="priority-pill ${p === 'high' ? 'pill-high' : p === 'medium' ? 'pill-med' : 'pill-low'}">${p}</span>`;
const hookSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v11a4 4 0 1 1-4-4"/></svg>';
const empty = (cols, t) => h`<tr><td colspan="${cols}"><div class="empty"><span class="hook">${raw(hookSvg)}</span><div><b>No items</b><span>${t}</span></div></div></td></tr>`;
const table = (heads, rows, none) => h`<div class="table-scroll-container"><table><thead><tr>${heads.map((x) => h`<th>${x}</th>`)}</tr></thead><tbody>${rows.length ? rows : empty(heads.length, none)}</tbody></table></div>`;
const card = (title, sub, body, tools) => h`<div class="panel"><div class="ph2"><div><h2>${title}</h2><p>${sub}</p></div>${tools ? h`<div>${tools}</div>` : ''}</div>${body}</div>`;

const I = { overview: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', setup: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', cases: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>', approvals: '<path d="M20 6 9 17l-5-5"/>', checks: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', workers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>', evidence: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M12 18v-6m-3 3 3-3 3 3"/>', packs: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>', controls: '<path d="M4 21h16M4 14h16M4 7h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="14" r="2"/>', integrations: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>', dashboards: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>', audit: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', reports: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>', metrics: '<path d="M12 20V10M18 20V4M6 20v-4"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' };
const NAV = [
  { id: 'overview', label: 'Overview', direct: true },
  { id: 'setup', label: 'Company setup', direct: true },
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'cases', label: 'Remediation inbox', sub: 'Open gaps moving toward verified closure' },
      { id: 'approvals', label: 'Approvals', sub: 'Decisions waiting on an authorized person' },
      { id: 'evidence', label: 'Evidence & AI intake', sub: 'Uncertain documents and extracted fields' }
    ]
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      { id: 'checks', label: 'Checks', sub: 'Every evaluation result, reason and evidence reference' },
      { id: 'workers', label: 'Worker register', sub: 'Unified roster with per-pack status' }
    ]
  },
  {
    id: 'governance',
    label: 'Governance',
    items: [
      { id: 'packs', label: 'Compliance packs', sub: 'Versioned packs and customer overrides' },
      { id: 'controls', label: 'Custom controls', sub: 'Natural language rules with preview before approval' },
      { id: 'integrations', label: 'Connections & health', sub: 'Connectors, outbox, schedules and visible failures' }
    ]
  },
  {
    id: 'reporting',
    label: 'Reporting',
    items: [
      { id: 'dashboards', label: 'Dashboards', sub: 'Saved views with role-based access' },
      { id: 'reports', label: 'Reports & notices', sub: 'Evidence-backed exports and tax notice intake' },
      { id: 'metrics', label: 'Pilot metrics', sub: 'Hours saved, closure speed and false findings' },
      { id: 'audit', label: 'Audit trail', sub: 'Append-only, hash-chained history' },
      { id: 'settings', label: 'Settings', sub: 'Users, roles, reporting channel and schedules' }
    ]
  }
];
const HEAD = { overview: ['Compliance', 'Compliance Overview', 'Current status across activated packs, accepted evidence and open remediation.'], setup: ['Onboarding', 'Company Setup', 'Connect records, confirm context, activate packs and run the first assessment.'], cases: ['Remediation', 'Remediation Inbox', 'Each gap moves from identified to closed. Only accepted evidence closes a case.'], approvals: ['Decisions', 'Approvals', 'Consequential actions wait here for an authorized person.'], evidence: ['Intake', 'Evidence & AI Intake', 'AI proposes matches and fields. Uncertain documents go to a person.'], checks: ['Records', 'Checks', 'Every result has a reason, evidence references and a control version.'], workers: ['Workforce', 'Worker Register', 'Per-pack status for each worker. One pack never hides another.'], packs: ['Governance', 'Compliance Packs', 'Versioned packs reviewed and activated by an authorized person.'], controls: ['Rules', 'Custom Controls', 'Draft, preview and approve changes before they take effect.'], integrations: ['Connections', 'Connections & Health', 'Connectors, messages, background jobs and visible failures.'], dashboards: ['Reporting', 'Dashboards', 'Saved views with role-based access.'], reports: ['Reporting', 'Reports & Notices', 'Evidence-backed exports and tax notice intake.'], metrics: ['Pilot', 'Pilot Metrics', 'Measured from records. Blank means not measured yet.'], audit: ['Security', 'Audit Trail', 'Append-only, hash-chained history of evaluations, requests and closures.'], settings: ['Workspace', 'Settings', 'Users, roles, reporting channel and schedules.'] };

let caseClosed = false, me = null, route = 'overview', routeArg = null, checkFilter = {}, evidenceSel = null, lastDraft = null, importPreview = null;
const refresh = () => go(route, routeArg, true);

async function boot() {
  try { me = await api('/api/me'); } catch { return; }
  document.body.style.background = '';
  const ls = $('#loginScreen'); if (ls) { ls.hidden = true; ls.style.display = 'none'; ls.innerHTML = ''; }
  const as = $('#appShell'); if (as) { as.hidden = false; as.style.display = 'block'; }
  $('#chatPrompts').innerHTML = render(['What is missing for new workers?', 'Which credentials expire next month?', 'Request the missing documents.', 'What needs my approval?', 'Show unresolved cases by team', 'Create a healthcare dashboard showing missing evidence by facility.'].map((q) => h`<button class="prompt-pill" data-act="prompt" data-q="${q}">${q}</button>`));
  renderTop();
  renderDemoRack();
  readHash();
}

function renderTop() {
  if (!me || !me.user) return;
  const tenantAvatar = $('#tenantAvatar'); if (tenantAvatar) tenantAvatar.textContent = (me.tenant?.name || 'BH').slice(0, 2).toUpperCase();
  const tenantName = $('#tenantName'); if (tenantName) tenantName.textContent = me.tenant?.name || 'Aegis';
  const tenantStatus = $('#tenantStatus'); if (tenantStatus) tenantStatus.textContent = me.tenant?.kind === 'internal_pilot' ? 'Internal pilot' : 'External test';

  const userEmail = (me.user.email || '').toLowerCase();
  const pMatch = PERSONAS.find((p) => p.email && userEmail && p.email.toLowerCase() === userEmail) ||
                 PERSONAS.find((p) => p.roleName && me.user.role_label && p.roleName.toLowerCase() === me.user.role_label.toLowerCase()) ||
                 (me.user.is_admin ? PERSONAS[0] : null);
  const roleColor = pMatch?.color || (
    me.user.is_admin ? '#0E8A5F' :
    me.user.role === 'hr' ? '#D9622B' :
    me.user.role === 'immigration_owner' ? '#5B45C9' :
    me.user.role === 'healthcare_compliance' ? '#C2283F' :
    me.user.role === 'finance' ? '#B98A00' :
    me.user.role === 'viewer' ? '#2F6496' : '#0E8A5F'
  );
  document.documentElement.style.setProperty('--role', roleColor);

  const uAv = $('#userAvatar'); if (uAv) uAv.textContent = badgeInitials(me.user.name || '?');
  const uNm = $('#userName'); if (uNm) uNm.textContent = (me.user.name || 'User').split(' ')[0] || me.user.name;
  const uRl = $('#userRole'); if (uRl) uRl.textContent = me.user.role_label || words(me.user.role);
  const asof = $('#asof'); if (asof) asof.textContent = `As of ${me.today || ''}`;

  const meMenuSettings = $('#meMenuSettings');
  if (meMenuSettings) meMenuSettings.hidden = !me.user.is_admin;
}

async function renderNav() {
  const o = await api('/api/overview').catch(() => null);
  const ev = await api('/api/evidence').catch(() => []);
  const badge = {
    cases: o?.kpi?.open_cases || 0,
    approvals: o?.kpi?.pending_approvals || 0,
    evidence: (ev || []).filter((e) => e.status === 'needs_review').length
  };
  const totalWork = badge.cases + badge.approvals + badge.evidence;

  const tabsHtml = NAV.map((tab) => {
    if (tab.direct) {
      const on = route === tab.id;
      return h`<button class="tab${on ? ' on' : ''}" type="button" data-act="navDirect" data-id="${tab.id}">${tab.label}</button>`;
    }
    const on = tab.items.some((it) => it.id === route);
    const tabCnt = tab.id === 'work' && totalWork > 0 ? h`<span class="cnt">${totalWork}</span>` : '';
    return h`
      <div class="tabwrap">
        <button class="tab${on ? ' on' : ''}" type="button" aria-expanded="false" data-act="toggleDir">
          ${tab.label}
          <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg>
          ${tabCnt}
        </button>
        <div class="dir">
          ${tab.items.map((it) => {
            let flag = '';
            if (it.id === 'cases' && badge.cases > 0) flag = h`<span class="flag bad">${badge.cases} open</span>`;
            else if (it.id === 'approvals' && badge.approvals > 0) flag = h`<span class="flag n">${badge.approvals}</span>`;
            else if (it.id === 'evidence' && badge.evidence > 0) flag = h`<span class="flag n">${badge.evidence}</span>`;
            return h`<a href="#${it.id}" class="dir-link" data-act="dirLink"><span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${raw(I[it.id] || '')}</svg></span><b>${it.label}</b><small>${it.sub}</small>${flag}</a>`;
          })}
        </div>
      </div>`;
  });

  const tabsEl = $('#tabs');
  if (tabsEl) tabsEl.innerHTML = render(h`${tabsHtml}`);

  const sheetIn = $('#sheetIn');
  if (sheetIn) {
    sheetIn.innerHTML = render(h`
      <div class="sheet-group">
        <a href="#overview" class="dir-link" data-act="dirLink"><span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${raw(I.overview)}</svg></span><b>Overview</b><small>Compliance overview and badge wall</small></a>
        <a href="#setup" class="dir-link" data-act="dirLink"><span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${raw(I.setup)}</svg></span><b>Company setup</b><small>Onboarding and configuration</small></a>
      </div>
      ${NAV.filter((n) => !n.direct).map((group) => h`
        <div class="sheet-title" style="font-size:11px;font-weight:750;letter-spacing:0.05em;text-transform:uppercase;color:var(--ink-3);padding:10px 10px 4px">${group.label}</div>
        ${group.items.map((it) => h`
          <a href="#${it.id}" class="dir-link" data-act="dirLink"><span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${raw(I[it.id] || '')}</svg></span><b>${it.label}</b><small>${it.sub}</small></a>
        `)}
      `)}
    `);
  }
}

function readHash() { const [r, a] = location.hash.slice(1).split('/'); go(VIEWS[r] ? r : 'overview', a || null); }

async function go(r, arg = null, keep) {
  route = r; routeArg = arg;
  closeAllDirMenus();
  $('#sheet')?.classList.remove('open');
  if (r !== 'overview') {
    const alertEl = $('#alert');
    if (alertEl) { alertEl.hidden = true; alertEl.innerHTML = ''; }
  }
  const [c, t, d] = HEAD[r] || ['Workspace', words(r), ''];
  const crumb = $('#crumb'); if (crumb) crumb.textContent = c;
  const heading = $('#heading'); if (heading) heading.textContent = t;
  const scopeEl = $('#scope'); if (scopeEl) scopeEl.textContent = d;
  try {
    const out = await VIEWS[r](arg);
    $('#view').innerHTML = render(out);
    if (!keep) window.scrollTo(0, 0);
    const q = $('#globalSearch')?.value; if (q) filterRows(q);
  } catch (e) {
    $('#view').innerHTML = render(h`<div class="panel empty"><span class="hook">${raw(hookSvg)}</span><div><b>Error loading view</b><span>${e.message}</span></div></div>`);
  }
  renderNav();
}

const scope = (c) => {
  const el = $('#scope');
  if (!el) return;
  if (!c) {
    const cur = HEAD[route];
    el.textContent = cur ? cur[2] : '';
    return;
  }
  el.innerHTML = render(h`${c.all_pass ? h`<span class="pill pill-pass">All checks in scope pass</span> ` : h`<span class="pill pill-warn">Verified scope only</span> `}${c.scope_statement} Evidence as of ${dt(c.as_of)} UTC.`);
};
function filterRows(q) { q = q.toLowerCase(); document.querySelectorAll('#view tbody tr').forEach((r) => { r.hidden = !r.textContent.toLowerCase().includes(q); }); }

function openCaseCell(c) { return h`<button class="btn-link-action" data-act="caseDetail" data-id="${c.id}">Open</button>`; }
const VIEWS = {
  async overview() {
    const [o, workers, setup, hl] = await Promise.all([
      api('/api/overview'),
      api('/api/workers'),
      api('/api/setup'),
      api('/api/health')
    ]);
    const c = o.coverage, k = o.kpi, st = setup.steps;
    scope(c);

    const alertEl = $('#alert');
    const badCon = hl.connectors?.find((con) => con.last_error);
    if (badCon) {
      alertEl.hidden = false;
      alertEl.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
        <p><b>${esc(badCon.name)} connector stopped:</b> ${esc(badCon.last_error)}</p>
        <a class="btn" href="#integrations">Check connector</a>
      `;
    } else if (alertEl) {
      alertEl.hidden = true;
      alertEl.innerHTML = '';
    }

    const pct = (n) => c.total ? (n / c.total * 100) : 0;
    const clinicalWorkers = workers.filter((w) => w.category === 'clinical' || (w.role && /nurse|rn|np|md|physician|doctor|therapist|clinical/i.test(w.role)));
    const corpWorkers = workers.filter((w) => !clinicalWorkers.includes(w));
    const checkedWorkers = workers.filter((w) => w.overall && w.overall !== 'not_assessed').length;

    let nextSubtext = 'All onboarding steps finished. Continuous monitoring and auto-chasing active.';
    let nextBtnLabel = 'Review setup';
    if (!st.connect) {
      nextSubtext = 'Add workers or connect your HRMS to begin compliance monitoring.';
      nextBtnLabel = 'Start company setup';
    } else if (!st.context) {
      nextSubtext = 'Confirm entities and facility requirements to avoid unknown check results.';
      nextBtnLabel = 'Confirm company context';
    } else if (!st.packs) {
      nextSubtext = 'Select which compliance rules apply to your workforce.';
      nextBtnLabel = 'Review and activate packs';
    } else if (!st.channel) {
      nextSubtext = 'Connect Slack or outbox for automated chase notifications.';
      nextBtnLabel = 'Configure alerts';
    } else if (!st.assessed) {
      nextSubtext = 'Evaluate all worker documents against activated compliance rules.';
      nextBtnLabel = 'Run assessment now';
    }

    function badgeStatusClass(s) {
      if (s === 'pass') return 'pass';
      if (s === 'fail') return 'fail';
      if (s === 'unknown') return 'unknown';
      return 'unchecked';
    }

    return h`
      <!-- Worker Badge Wall & Next Steps -->
      <div class="wallbox">
        <div class="rackside">
          <div class="ph2" style="margin-bottom:18px">
            <div>
              <h2>Worker badge wall</h2>
              <p>${workers.length} active workers across 2 departments. Gray badges haven't been checked yet; red badges have an active compliance gap.</p>
            </div>
          </div>
          <div class="depts">
            <div class="dept" style="--c:var(--clinical)">
              <h3><i></i>Clinical <small style="font-weight:400;color:var(--ink-3)">(${clinicalWorkers.length} workers)</small></h3>
              <div class="rail"></div>
              <div class="row">
                ${clinicalWorkers.map((w, i) => h`
                  <div class="peg" style="--c:var(--clinical);--i:${i}">
                    <span class="s"></span>
                    <span class="clip"></span>
                    <button class="wb ${badgeStatusClass(w.overall)}" type="button" data-act="workerDetail" data-id="${w.id}" title="${w.name}: ${words(w.overall)}">
                      <div class="band"></div>
                      <div class="ph">${badgeInitials(w.name)}</div>
                      <span class="nm">${w.name}</span>
                      <span class="rl">${w.role}</span>
                      <span class="st"><i></i>${words(w.overall || 'unchecked')}</span>
                    </button>
                  </div>
                `)}
              </div>
            </div>
            <div class="dept" style="--c:var(--corporate)">
              <h3><i></i>Corporate &amp; operations <small style="font-weight:400;color:var(--ink-3)">(${corpWorkers.length} workers)</small></h3>
              <div class="rail"></div>
              <div class="row">
                ${corpWorkers.map((w, i) => h`
                  <div class="peg" style="--c:var(--corporate);--i:${i}">
                    <span class="s"></span>
                    <span class="clip"></span>
                    <button class="wb ${badgeStatusClass(w.overall)}" type="button" data-act="workerDetail" data-id="${w.id}" title="${w.name}: ${words(w.overall)}">
                      <div class="band"></div>
                      <div class="ph">${badgeInitials(w.name)}</div>
                      <span class="nm">${w.name}</span>
                      <span class="rl">${w.role}</span>
                      <span class="st"><i></i>${words(w.overall || 'unchecked')}</span>
                    </button>
                  </div>
                `)}
              </div>
            </div>
          </div>
          <div class="legend">
            <span><i style="background:var(--pass)"></i>Pass — verified</span>
            <span><i style="background:var(--fail)"></i>Fail — active gap</span>
            <span><i style="background:repeating-linear-gradient(135deg,var(--unknown) 0 2px,transparent 2px 4px);border:1px solid var(--unknown)"></i>Unknown — unproven</span>
            <span><i style="border:1.5px dashed var(--unchecked)"></i>Unchecked</span>
          </div>
        </div>

        <aside class="next">
          <div class="big">${checkedWorkers} <small>/ ${workers.length} workers checked</small></div>
          <p>${nextSubtext}</p>
          <ol class="steps">
            <li class="${st.connect ? 'done' : ''}"><span class="m">${st.connect ? '✓' : '1'}</span><span class="t">Connect HRMS or import roster</span></li>
            <li class="${st.context ? 'done' : ''}"><span class="m">${st.context ? '✓' : '2'}</span><span class="t">Confirm facility requirements</span></li>
            <li class="${st.packs ? 'done' : ''}"><span class="m">${st.packs ? '✓' : '3'}</span><span class="t">Activate compliance packs</span></li>
            <li class="${st.channel ? 'done' : ''}"><span class="m">${st.channel ? '✓' : '4'}</span><span class="t">Connect reporting channel</span></li>
            <li class="${st.assessed ? 'done' : ''}"><span class="m">${st.assessed ? '✓' : '5'}</span><span class="t">Run initial assessment</span></li>
          </ol>
          <a class="btn primary" href="#setup">${nextBtnLabel}</a>
        </aside>
      </div>

      <!-- 4 Key Measures -->
      <div class="measures">
        <a class="ms" href="#checks" style="text-decoration:none;color:inherit">
          <h2>Applicable checks</h2>
          <div class="v">${c.total} <small>in ${c.packs.length} active pack(s)</small></div>
          <div class="bar3">
            <i style="width:${pct(c.pass)}%;background:var(--pass)"></i>
            <i style="width:${pct(c.fail)}%;background:var(--fail)"></i>
            <i style="width:${pct(c.unknown)}%;background:#8b5cf6"></i>
          </div>
          <dl>
            <div><dt>Pass</dt><dd class="num">${c.pass}</dd></div>
            <div><dt>Fail</dt><dd class="num ${c.fail ? 'hot' : ''}">${c.fail}</dd></div>
            <div><dt>Unknown</dt><dd class="num">${c.unknown}</dd></div>
          </dl>
        </a>
        <a class="ms" href="#cases" style="text-decoration:none;color:inherit">
          <h2>Open remediation cases</h2>
          <div class="v">${k.open_cases} <small>${k.pending_approvals} awaiting approval</small></div>
          <dl>
            <div><dt>Expiring credentials</dt><dd class="num">${k.expiring}</dd></div>
            <div><dt>Onboarding gaps</dt><dd class="num">${k.missing_onboarding}</dd></div>
            <div><dt>Immigration / payroll reviews</dt><dd class="num">${k.specialist}</dd></div>
          </dl>
        </a>
        <a class="ms" href="#workers" style="text-decoration:none;color:inherit">
          <h2>Worker coverage</h2>
          <div class="v">${k.workers} <small>active</small></div>
          <dl>
            <div><dt>Clinical</dt><dd class="num">${k.clinical}</dd></div>
            <div><dt>Corporate &amp; operations</dt><dd class="num">${k.corporate}</dd></div>
            <div><dt>With open checks</dt><dd class="num ${k.with_gaps ? 'hot' : ''}">${k.with_gaps}</dd></div>
          </dl>
        </a>
        <a class="ms" href="#metrics" style="text-decoration:none;color:inherit">
          <h2>Automation results</h2>
          <div class="v ${k.hours_saved === null ? 'muted' : ''}">${k.hours_saved === null ? '—' : `${k.hours_saved} hrs`} <small>${k.hours_saved === null ? 'set a baseline' : 'estimated saved'}</small></div>
          <dl>
            <div><dt>Automated messages</dt><dd class="num">${k.automated_messages}</dd></div>
            <div><dt>Verified closures</dt><dd class="num">${k.verified_closures}</dd></div>
            <div><dt>Median closure</dt><dd class="num">${k.median_closure_hours === null ? '—' : `${k.median_closure_hours} h`}</dd></div>
          </dl>
        </a>
      </div>

      <!-- Lower Split Panels: Packs, Queue, Feed -->
      <div class="lower">
        <div>
          <div class="panel">
            <div class="ph2">
              <div>
                <h2>Active compliance packs</h2>
                <p>Versioned packs with assigned owners and evidence requirements.</p>
              </div>
              <a class="btn" href="#packs">Manage packs</a>
            </div>
            ${table(['Pack', 'Version', 'Mode', 'Checks', 'Pass', 'Fail', 'Unknown', 'Open cases', 'Owner'], o.packs.map((p) => h`<tr><td><div class="pack-name-cell"><span class="pack-icon-box">${p.icon}</span><strong>${p.name}</strong></div></td><td><span class="version-tag">v${p.version}${p.pilot ? ' pilot' : ''}</span></td><td>${modePill(p.mode)}</td><td><strong>${p.total}</strong></td><td class="text-green-bold">${p.pass}</td><td class="text-red-bold">${p.fail}</td><td style="color:#6d28d9;font-weight:700">${p.unknown}</td><td>${p.open_cases}</td><td>${p.owner}</td></tr>`), 'No packs are active. Finish Company Setup to run the first assessment.')}
          </div>
          <div class="panel" style="margin-top:20px">
            <div class="ph2">
              <div>
                <h2>Priority remediation queue</h2>
                <p>Gaps needing immediate attention.</p>
              </div>
              <a class="btn" href="#cases">View all</a>
            </div>
            ${table(['Priority', 'Issue', 'Subject', 'Due', 'Stage', ''], o.urgent.map((c) => h`<tr><td>${prio(c.priority)}</td><td><strong>${c.control_name}</strong></td><td class="text-secondary">${c.subject_name}</td><td class="date-urgent">${date(c.due_date)}</td><td>${statePill(c.state)}</td><td style="text-align:right">${openCaseCell(c)}</td></tr>`), 'No open gaps in the activated packs.')}
          </div>
        </div>
        <div>
          <div class="panel">
            <div class="ph2">
              <div>
                <h2>Activity</h2>
                <p>Recent automated evaluations, requests, and closures.</p>
              </div>
              ${me.user.is_admin ? h`<a class="btn" href="#audit">View all</a>` : ''}
            </div>
            ${o.feed && o.feed.length ? h`<ul class="log">${o.feed.map((f) => h`<li><time class="num">${f.ts ? f.ts.slice(11, 16) : '—'}</time><div><b><i style="background:var(--clinical)"></i>${f.action}</b><p>Logged by orchestrator</p></div></li>`)}</ul>` : h`<div class="empty"><span class="hook">${raw(hookSvg)}</span><div><b>No events recorded yet</b><span>Events appear here after the first sync or evaluation.</span></div></div>`}
          </div>
        </div>
      </div>
    `;
  },
  async setup() {
    scope(null);
    const s = await api('/api/setup'), st = s.steps;
    const step = (n, done, title, sub, body) => h`<div class="step${done ? ' done' : ''}"><div class="step-num">${done ? '✓' : n}</div><div class="step-body"><h3>${title}</h3><p class="muted small mb">${sub}</p>${body}</div></div>`;
    return h`<div class="stack">
    ${step(1, st.connect, 'Connect records or start manually', `${s.summary.workers} workers, ${s.summary.facilities} locations and ${s.summary.entities} employing entities on record.`, h`<div class="row"><a class="top-action-btn" href="#integrations">Connect a system</a><button class="top-action-btn" data-act="importRoster">Upload Excel or CSV</button><button class="top-action-btn" data-act="addWorker">Add a worker</button></div>`)}
    ${step(2, st.context, 'Confirm company context', 'Confirm entities, locations and each facility’s requirements. Unconfirmed facilities produce Unknown results.', h`${s.gaps.length ? h`<div class="alert-box"><strong>Gaps found</strong><ul>${s.gaps.map((g) => h`<li>${g}</li>`)}</ul></div>` : ''}${table(['Facility', 'State', 'Requirements', 'Status', ''], s.facilities.map((f) => h`<tr><td><strong>${f.name}</strong></td><td>${f.state}</td><td>${f.requirements.map(words).join(', ') || 'None'}</td><td>${f.requirements_confirmed ? h`<span class="pill pill-pass">Confirmed</span>` : h`<span class="pill pill-unknown">Not confirmed</span>`}</td><td style="text-align:right"><button class="btn-link-action" data-act="facility" data-id="${f.id}" data-name="${f.name}" data-state="${f.state}" data-req="${f.requirements.join(',')}">Edit</button></td></tr>`), 'Add records first.')}<div class="mt"><button class="btn-submit-green" data-act="confirmContext" ${st.connect ? '' : raw('disabled')}>Confirm company profile</button></div>`)}
    ${step(3, st.packs, 'Review and activate packs', 'New packs start in validation mode. Nothing is sent until owners validate findings.', h`${table(['Pack', 'Recommended', 'Status', ''], s.recommended.map((p) => h`<tr><td>${p.icon} <strong>${p.name}</strong></td><td>${p.recommended ? 'Yes' : 'Not yet'}</td><td>${statePill(p.status)}</td><td style="text-align:right"><button class="btn-link-action" data-act="reviewPack" data-id="${p.key}">Review</button></td></tr>`), '')}`)}
    ${step(4, st.channel, 'Connect the reporting channel', s.slack_ready ? 'Slack is configured on this server.' : 'Slack needs a bot token on the server. Until then, messages stay in the in-app outbox.', h`<form class="row" data-form="channel"><select name="type" class="mini-select"><option value="outbox" ${s.channel.type !== 'slack' ? raw('selected') : ''}>In-app outbox</option><option value="slack" ${s.channel.type === 'slack' ? raw('selected') : ''} ${s.slack_ready ? '' : raw('disabled')}>Slack</option></select><input name="channel" class="mini-select" value="${s.channel.channel || '#compliance-alerts'}" aria-label="Channel"><button class="btn-card-outline">Save</button></form>`)}
    ${step(5, st.assessed, 'Run the initial assessment', st.assessed ? s.coverage.scope_statement : 'Shows checked records, missing evidence and unknown results.', h`${st.assessed ? h`<div class="grid-3 mb" style="max-width:420px"><div class="tile"><b>${s.coverage.pass}</b><span>Pass</span></div><div class="tile"><b>${s.coverage.fail}</b><span>Fail</span></div><div class="tile"><b>${s.coverage.unknown}</b><span>Unknown</span></div></div>` : ''}<button class="btn-submit-green" data-act="assess" ${st.packs ? '' : raw('disabled')}>${st.assessed ? 'Run again' : 'Run assessment'}</button>`)}
    </div>`;
  },
  async cases(arg) {
    scope(null);
    const rows = await api(`/api/cases${caseClosed ? '?closed=1' : ''}`);
    const tabs = h`<div class="filters"><button class="chip${caseClosed ? '' : ' on'}" data-act="caseTab" data-v="">Open</button><button class="chip${caseClosed ? ' on' : ''}" data-act="caseTab" data-v="1">Closed</button></div>`;
    if (arg) setTimeout(() => ACT.caseDetail({ dataset: { id: arg } }));
    return card(caseClosed ? 'Closed Cases' : 'Open Cases', 'Identify → assign → request → follow up → review → re-evaluate → close.', h`${tabs}${table(['Case', 'Subject', 'Pack', caseClosed ? 'Gap found' : 'Gap', 'Stage', 'Owner', 'Due', 'Finding', ''], rows.map((c) => h`<tr class="click" data-act="caseDetail" data-id="${c.id}"><td class="mono">${c.id}</td><td><strong>${c.subject_name}</strong></td><td><span class="priority-pill pill-low">${c.pack_key}</span></td><td>${c.gap}</td><td>${statePill(c.state)}${c.escalated ? h` <span class="pill pill-fail">Escalated</span>` : ''}</td><td class="text-muted">${c.owner_name || c.owner_team}</td><td class="date-urgent">${date(c.due_date)}</td><td>${c.finding_verdict ? words(c.finding_verdict) : h`<span class="muted">Not validated</span>`}</td><td style="text-align:right">${caseClosed ? words(c.closure) : h`<button class="top-action-btn" data-act="followUp" data-id="${c.id}">Follow up</button>`}</td></tr>`), caseClosed ? 'No closed cases yet.' : 'No open cases.')}`, caseClosed ? null : h`<button class="btn-intake-evidence" data-act="chaseAll">Follow up on all</button>`);
  },
  async approvals() {
    scope(null);
    const rows = await api('/api/approvals'), done = await api('/api/approvals?status=approved');
    return h`<div class="stack">${card('Waiting for you', 'Only items your role can decide appear here.', table(['Type', 'Item', 'Detail', 'Requested by', ''], rows.map((a) => h`<tr><td><span class="priority-pill pill-low">${words(a.kind)}</span></td><td><strong>${a.title}</strong></td><td class="text-secondary">${a.detail}</td><td class="text-muted">${a.requested_by}</td><td style="text-align:right;white-space:nowrap"><button class="btn-link-action" data-act="decide" data-id="${a.id}" data-d="approved">Approve</button> <button class="btn-link-action" style="color:#b91c1c" data-act="decide" data-id="${a.id}" data-d="rejected">Reject</button></td></tr>`), 'Nothing needs your approval.'))}
    ${card('Recently approved', 'Decisions stay in the audit trail.', table(['Item', 'Decided by', 'When', 'Note'], done.slice(0, 10).map((a) => h`<tr><td>${a.title}</td><td>${a.decided_by}</td><td class="mono">${dt(a.decided_at)}</td><td class="text-muted">${a.note}</td></tr>`), 'No decisions yet.'))}</div>`;
  },
  async checks() {
    const qs = new URLSearchParams(Object.entries(checkFilter).filter(([, v]) => v)).toString();
    const d = await api(`/api/checks?${qs}`); scope(d.coverage);
    const chip = (k, v, l) => h`<button class="chip${(checkFilter[k] || '') === v ? ' on' : ''}" data-act="checkFilter" data-k="${k}" data-v="${v}">${l}</button>`;
    return card('All Evaluations', `${d.rows.length} shown. Unknown means the record cannot prove the requirement yet.`, h`<div class="filters">${chip('status', '', 'All')}${chip('status', 'pass', 'Pass')}${chip('status', 'fail', 'Fail')}${chip('status', 'unknown', 'Unknown')}${chip('status', 'not_applicable', 'N/A')}<span style="width:12px"></span>${chip('pack', '', 'All packs')}${['healthcare', 'onboarding', 'immigration', 'payroll'].map((p) => chip('pack', p, p))}</div>${table(['Subject', 'Control', 'Requirement', 'Result', 'Reason', 'Evidence', 'Version'], d.rows.map((c) => h`<tr><td><strong>${c.subject_name}</strong><div class="muted small">${c.facility}</div></td><td>${c.control_name}</td><td class="muted">${words(c.requirement_type)}</td><td>${statusPill(c.status)}</td><td>${c.reason}</td><td class="mono">${c.evidence_ids.length ? c.evidence_ids.length : '—'}</td><td class="mono">${c.control_version}</td></tr>`), 'No checks match.')}`);
  },
  async workers() {
    scope(null);
    const rows = await api('/api/workers');
    return card('Workforce Compliance Register', 'Unified roster with per-pack status.', table(['Worker', 'Role & facility', 'Onboarding', 'Healthcare', 'Immigration', 'Payroll', 'Overall', 'Readiness', ''], rows.map((w) => h`<tr class="click" data-act="workerDetail" data-id="${w.id}"><td><strong>${w.name}</strong>${w.status !== 'active' ? h` <span class="pill pill-na">${w.status}</span>` : ''}<div class="muted small">${words(w.source?.startsWith('con_') ? 'HRMS' : w.source)}</div></td><td>${w.role}<div class="muted small">${w.facility || 'No confirmed location'}</div></td><td>${statusPill(w.packs.onboarding)}</td><td>${statusPill(w.packs.healthcare)}</td><td>${statusPill(w.packs.immigration)}</td><td>${statusPill(w.packs.payroll)}</td><td>${statusPill(w.overall)}</td><td class="muted">${w.readiness}</td><td style="text-align:right"><button class="btn-link-action" data-act="workerDetail" data-id="${w.id}">Details</button></td></tr>`), 'No workers yet. Add one or import a roster.'), h`<button class="btn-card-outline" data-act="addWorker">+ Add Worker</button><button class="btn-card-outline" data-act="importRoster">Upload Roster</button>`);
  },
  async evidence() {
    scope(null);
    const rows = (await api('/api/evidence')).sort((a, b) => (b.status === 'needs_review') - (a.status === 'needs_review'));
    const ev = rows.find((e) => e.id === evidenceSel) || rows.find((e) => e.status === 'needs_review') || null;
    return h`<div class="bottom-split-row"><div class="split-card"><div class="split-card-header"><h3 class="split-title">Evidence Inbox</h3><div class="row"><button class="btn-card-outline" data-act="bulkUpload">Bulk upload</button><button class="btn-intake-evidence" data-act="uploadEvidence">+ Upload</button></div></div>${table(['Document', 'Subject', 'Confidence', 'Status', ''], rows.map((e) => h`<tr class="click" data-act="selectEvidence" data-id="${e.id}"><td><strong>${words(e.doc_type)}</strong><div class="muted small">${e.filename}</div></td><td class="text-secondary">${e.subject_name}</td><td>${e.source === 'demo_seed' ? '—' : `${Math.round((e.confidence || 0) * 100)}%`}</td><td>${statePill(e.status)}</td><td style="text-align:right"><button class="btn-link-action" data-act="selectEvidence" data-id="${e.id}">Inspect</button></td></tr>`), 'No evidence yet.')}</div>
    <div class="split-card" style="position:sticky;top:80px;align-self:start"><div class="split-card-header"><h3 class="split-title">Field Inspector</h3>${ev ? statePill(ev.status) : ''}</div>${ev ? evidencePanel(ev) : h`<div class="empty">Select a document to inspect it.</div>`}</div></div>`;
  },
  async packs() {
    scope(null);
    const rows = await api('/api/packs');
    return h`<div class="grid-2">${rows.map((p) => h`<div class="plain-card"><div class="between"><strong style="font-size:14px">${p.icon} ${p.name}</strong>${p.status === 'active' ? modePill(p.mode) : h`<span class="pill pill-na">Not active</span>`}</div><p class="muted small mt">${p.description}</p><p class="small mt"><span class="version-tag">v${p.version}${p.pilot ? ' pilot' : ''}</span> · ${p.controls.length} controls · Owner: ${p.owner || 'not assigned'}</p>
    ${p.status === 'active' ? h`<p class="small mt">${p.pass} pass · ${p.fail} fail · ${p.unknown} unknown · ${p.unvalidated} finding(s) to validate</p>` : ''}<div class="row mt"><button class="btn-card-outline" data-act="reviewPack" data-id="${p.key}">${p.status === 'active' ? 'View controls' : 'Review & activate'}</button>${p.status === 'active' ? (p.mode === 'shadow' ? h`<button class="btn-submit-green" data-act="packMode" data-id="${p.key}" data-m="auto">Enable automatic requests</button>` : h`<button class="btn-card-outline" data-act="packMode" data-id="${p.key}" data-m="shadow">Return to validation mode</button>`) : ''}</div></div>`)}</div>`;
  },
  async controls() {
    scope(null);
    const d = await api('/api/controls');
    return h`<div class="stack">${card('Natural Language Rule Drafter', 'Aegis drafts the change and previews it. Nothing takes effect until it is approved.', h`<form class="row" data-form="draftRule"><input name="text" class="form-select" style="flex:1;min-width:220px" required placeholder="Request renewals 30 days before expiration and escalate after two unanswered reminders." aria-label="Rule"><button class="btn-submit-green">Draft & preview</button></form>${lastDraft ? lastDraft.map(draftCard) : ''}`)}
    ${card('Active Controls', 'Reviewed pack requirements stay separate from customer overrides.', table(['Control', 'Pack', 'Requirement', 'Schedule', 'Version', 'Source'], d.controls.map((c) => h`<tr><td><strong>${c.name}</strong><div class="mono muted">${c.key}</div></td><td><span class="priority-pill pill-low">${c.pack}</span></td><td class="muted">${words(c.requirement_type)}</td><td class="small">${c.remediation?.request_days_before !== undefined ? `${c.remediation.request_days_before}d before expiry; ` : ''}${c.remediation?.max_reminders !== undefined ? `escalate after ${c.remediation.max_reminders}` : 'owner task'}</td><td class="mono">${c.version}</td><td>${c.custom ? h`<span class="pill pill-blue">Custom</span>` : c.overridden ? h`<span class="pill pill-warn">Override</span>` : h`<span class="pill pill-na">Pack</span>`}</td></tr>`), 'No active controls.'))}
    ${card('Change History', 'Drafts, approvals and superseded versions.', table(['Change', 'Control', 'Request', 'Status', 'By'], d.changes.map((c) => h`<tr><td>${c.kind}</td><td class="mono">${c.control_key}</td><td class="small">${c.source_text}</td><td>${statePill(c.status)}</td><td class="muted">${c.created_by}${c.approved_by ? ` → ${c.approved_by}` : ''}</td></tr>`), 'No changes yet.'))}</div>`;
  },
  async integrations() {
    scope(null);
    const hl = await api('/api/health'), msgs = me.user.is_admin ? await api('/api/messages') : [];
    return h`<div class="stack"><div class="grid-3">${hl.connectors.map((c) => h`<div class="plain-card"><div class="between"><strong>${c.name}</strong><span class="pill ${c.status === 'connected' ? 'pill-pass' : 'pill-fail'}">${c.status}</span></div><p class="muted small mt">Last sync ${dt(c.last_sync_at)} · ${c.records} records · ${c.capabilities.map(words).join(', ')}</p>${c.last_error ? h`<p class="small mt" style="color:#b91c1c">${c.last_error}</p>` : ''}<button class="top-action-btn mt" data-act="syncConnector" data-id="${c.id}">Sync now</button></div>`)}
      <div class="plain-card"><strong>Excel / CSV register</strong><p class="muted small mt">For companies without API access. Someone must keep this roster current.</p><button class="top-action-btn mt" data-act="importRoster">Upload roster</button></div>
      ${me.user.is_admin ? h`<form class="plain-card" data-form="connector"><strong>Add HRMS connector</strong><input name="name" class="form-select mt" placeholder="Name" aria-label="Name"><input name="base_url" class="form-select mt" placeholder="https://hrms.example.com/api" required aria-label="Base URL"><input name="api_key" type="password" class="form-select mt" placeholder="API key" required aria-label="API key"><button class="top-action-btn mt">Save connector</button></form>` : ''}</div>
    ${card('Failures', 'Problems stay visible here until they are fixed.', table(['Type', 'Item', 'Error'], [...(hl.ai_error ? [h`<tr><td>AI</td><td>AI engine</td><td style="color:#b91c1c">${hl.ai_error.message}</td></tr>`] : []), ...hl.jobs.dead.map((j) => h`<tr><td>Job</td><td>${j.type}</td><td style="color:#b91c1c">${j.last_error}</td></tr>`), ...hl.failed_actions.map((a) => h`<tr><td>Message</td><td>${a.recipient}</td><td style="color:#b91c1c">${a.error}</td></tr>`), ...hl.connectors.filter((c) => c.last_error).map((c) => h`<tr><td>Connector</td><td>${c.name}</td><td style="color:#b91c1c">${c.last_error}</td></tr>`)], 'No failures.'))}
    ${me.user.is_admin ? card('Message Outbox', 'Everything Aegis sent. Secure links open the worker’s upload page.', table(['When', 'To', 'Subject', 'Channel', ''], msgs.map((m) => { const u = /https?:\/\/\S+\/submit\/\S+/.exec(m.body)?.[0]; return h`<tr><td class="mono">${dt(m.created_at)}</td><td><strong>${m.recipient}</strong></td><td>${m.subject}<div class="muted small">${m.body.replace(/https?:\/\/\S+/, '[secure link]').slice(0, 130)}</div></td><td>${m.channel === 'outbox' ? 'Outbox only (not sent)' : `Sent by ${m.channel}`}</td><td style="text-align:right">${u ? h`<a class="btn-link-action" href="/submit/${u.split('/submit/')[1]}" target="_blank" rel="noopener">Open link</a>` : ''}</td></tr>`; }), 'Nothing sent yet.')) : ''}</div>`;
  },
  async dashboards(arg) {
    scope(null);
    const list = await api('/api/dashboards'), cur = arg ? await api(`/api/dashboards/${arg}`) : null;
    return h`<div class="stack">${cur ? card(cur.name, `Grouped by ${cur.definition.group_by}. ${cur.data.total} item(s). Access: ${JSON.parse(cur.roles_json).map(words).join(', ')}.`, cur.data.groups.length ? cur.data.groups.map((g) => h`<div class="bar-row"><span>${g.name}</span><div class="bar-track"><div class="bar-fill" style="width:${g.count / cur.data.groups[0].count * 100}%"></div></div><strong>${g.count}</strong></div><div class="muted small mb">${g.items.slice(0, 5).map((i) => `${i.subject}: ${i.control}`).join(' · ')}</div>`) : h`<div class="empty">Nothing to show for this view.</div>`, h`<button class="btn-card-outline" data-act="copyLink">Copy link</button>`) : ''}
    ${card('Saved Views', 'Ask the coworker to create one, or use the form.', table(['Name', 'Created by', ''], list.map((d) => h`<tr><td><strong>${d.name}</strong></td><td class="muted">${d.created_by}</td><td style="text-align:right"><a class="btn-link-action" href="#dashboards/${d.id}">Open</a></td></tr>`), 'No saved views yet.'))}
    <form class="plain-card" data-form="dashboard"><strong>New view</strong><div class="form-grid mt"><div class="form-group"><label class="form-label">Name</label><input name="name" class="form-select" required></div><div class="form-group"><label class="form-label">Pack</label><select name="pack" class="form-select"><option value="">All</option><option>healthcare</option><option>onboarding</option><option>immigration</option><option>payroll</option></select></div><div class="form-group"><label class="form-label">Show</label><select name="metric" class="form-select"><option value="open_gaps">Open gaps</option><option value="missing_evidence">Missing evidence</option><option value="expirations">Expirations</option><option value="coverage">All applicable checks</option></select></div><div class="form-group"><label class="form-label">Group by</label><select name="group_by" class="form-select"><option>facility</option><option>team</option><option>pack</option><option>status</option><option>control</option></select></div></div><button class="btn-submit-green">Save view</button></form></div>`;
  },
  async reports() {
    const o = await api('/api/overview'); scope(o.coverage);
    const canFin = me.user.is_admin || me.user.role === 'finance', notices = canFin ? await api('/api/notices') : [];
    return h`<div class="stack"><div class="grid-3">${o.packs.map((p) => h`<div class="plain-card"><strong>${p.icon} ${p.name}</strong><p class="muted small mt">${p.pass} pass, ${p.fail} fail and ${p.unknown} unknown of ${p.total} applicable checks.</p><a class="btn-card-outline mt" href="/api/reports/${p.key}" download>Download CSV</a></div>`)}<div class="plain-card"><strong>All activated packs</strong><p class="muted small mt">Includes the scope statement, reasons and evidence references.</p><a class="btn-card-outline mt" href="/api/reports/all" download>Download CSV</a></div>
    ${me.user.is_admin ? h`<div class="plain-card"><strong>Digest</strong><p class="muted small mt">Posted daily to the reporting channel. Uses the same records as this page.</p><button class="btn-card-outline mt" data-act="sendDigest">Send digest now</button></div>` : ''}</div>
    ${canFin ? h`${card('Tax Notice Intake', 'Aegis drafts a response. Finance reviews it, and nothing is filed by Aegis.', table(['Agency', 'Type', 'Respond by', 'Status', ''], notices.map((n) => h`<tr><td><strong>${n.agency}</strong></td><td>${n.notice_type}</td><td class="date-urgent">${date(n.response_due)}</td><td>${statePill(n.status)}</td><td style="text-align:right"><button class="btn-link-action" data-act="viewNotice" data-text="${n.draft_response}">View draft</button></td></tr>`), 'No notices logged.'))}<form class="plain-card" data-form="notice"><strong>Log a notice</strong><div class="form-grid mt"><div class="form-group"><label class="form-label">Agency</label><input name="agency" class="form-select" required></div><div class="form-group"><label class="form-label">Notice type</label><input name="notice_type" class="form-select" required></div><div class="form-group"><label class="form-label">Respond by</label><input name="response_due" type="date" class="form-select"></div><div class="form-group"><label class="form-label">Summary</label><input name="summary" class="form-select" required></div></div><button class="btn-submit-green">Draft response</button></form>` : ''}</div>`;
  },
  async metrics() {
    scope(null);
    const m = await api('/api/metrics');
    const v = (x, u = '') => x === null || x === undefined ? 'Not measured' : `${x}${u}`;
    const rows = [['Labor saved', v(m.hours_saved, ' hrs'), `${m.automated_messages} automated messages × ${v(m.minutes_per_chase, ' min')} baseline`], ['Verified closure time (median)', v(m.median_closure_hours, ' h'), `${m.verified_closures} verified closures`], ['Closed with accepted evidence', `${m.closures_with_evidence} of ${m.verified_closures}`, 'Field-based checks reference the worker record'], ['False findings', `${m.false_findings} of ${m.findings_reviewed} reviewed`, 'Marked by the responsible owner'], ['Unknown results', m.unknown_results, 'Current checks that cannot be proven yet'], ['Duplicate actions blocked', m.duplicates_blocked, `${m.duplicate_messages_sent} duplicate messages actually sent`], ['Onboarding effort', v(m.onboarding_minutes, ' min'), 'Tenant created to first assessment'], ['Manual support', `${m.manual_support_minutes} min`, 'Logged by the delivery team'], ['AI usage (operating cost input)', `${m.llm_calls} calls, ${m.llm_tokens} tokens`, 'Add messaging and hosting costs separately']];
    return h`<div class="stack">${card('Pilot Scorecard', 'Internal success proves function. External paying customers must still prove demand.', table(['Measure', 'Result', 'Basis'], rows.map((r) => h`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td class="muted">${r[2]}</td></tr>`), ''))}
    <div class="grid-2"><form class="plain-card" data-form="baseline"><strong>Set baseline</strong><p class="muted small">Measure how long a person takes to chase one document.</p><div class="form-group mt"><label class="form-label">Minutes per manual chase</label><input name="value" type="number" min="0" step="0.5" class="form-select" value="${m.minutes_per_chase ?? ''}" required></div><button class="btn-submit-green">Save</button></form>
    <form class="plain-card" data-form="manualSupport"><strong>Log manual support</strong><p class="muted small">Time your team spent helping this tenant.</p><div class="form-group mt"><label class="form-label">Minutes</label><input name="minutes" type="number" min="1" class="form-select" required></div><div class="form-group"><label class="form-label">What was done</label><input name="note" class="form-select"></div><button class="btn-submit-green">Log time</button></form></div></div>`;
  },
  async audit() {
    scope(null);
    if (!me.user.is_admin) return h`<div class="plain-card empty">The audit trail is available to administrators.</div>`;
    const rows = await api('/api/audit'), v = await api('/api/audit/verify');
    return card('Audit Log', `${v.entries} entries. Chain ${v.ok ? 'verified' : `broken at entry ${v.broken_at_seq}`}.`, table(['Time (UTC)', 'Event', 'Subject', 'Action', 'Actor', 'Hash'], rows.map((a) => h`<tr><td class="mono">${dt(a.ts)}</td><td><span class="priority-pill pill-low">${a.type}</span></td><td><strong>${a.subject}</strong></td><td>${a.action}</td><td class="text-muted">${a.actor}</td><td class="mono" title="${a.hash}">${a.hash.slice(0, 10)}…</td></tr>`), 'No entries yet.'), h`<span class="pill ${v.ok ? 'pill-pass' : 'pill-fail'}">${v.ok ? 'Chain verified' : 'Chain broken'}</span><a class="btn-card-outline" href="/api/audit/export" download>Export JSON</a>`);
  },
  async settings() {
    scope(null);
    if (!me.user.is_admin) return h`<div class="plain-card empty">Settings are available to administrators.</div>`;
    const users = await api('/api/users'), hl = await api('/api/health'), ai = await api('/api/ai');
    return h`<div class="stack">${card('AI Engine', 'Reads photos and scanned documents, and helps chat understand free-form questions. It cannot accept evidence or set a result.', h`${ai.last_error ? h`<div class="alert-box"><strong>Last AI problem:</strong> ${ai.last_error.message}</div>` : ''}${ai.configured ? h`<dl class="kv mb"><dt>Status</dt><dd><span class="pill pill-pass">Connected</span></dd><dt>Provider</dt><dd>${ai.provider_label} (${ai.model})</dd><dt>Key</dt><dd class="mono">${ai.key_hint}</dd><dt>Set from</dt><dd>${ai.source}${ai.approved_by ? ` · approved by ${ai.approved_by}` : ''}</dd><dt>Scanned PDFs</dt><dd>${ai.reads_scanned_pdf ? 'Supported' : 'Not supported by this provider. They go to human review.'}</dd></dl><div class="row mb"><button class="btn-card-outline" data-act="aiTest">Test connection</button>${ai.source === 'settings' ? h`<button class="btn-danger" data-act="aiRemove">Remove key</button>` : ''}</div>` : ''}<form data-form="aiKey"><div class="form-grid"><div class="form-group"><label class="form-label">Provider</label><select name="provider" class="form-select">${ai.providers.slice().sort((a) => (a.key === 'deepseek' ? -1 : 1)).map((p) => h`<option value="${p.key}" ${(ai.provider || 'deepseek') === p.key ? raw('selected') : ''}>${p.label}</option>`)}</select></div><div class="form-group"><label class="form-label">API key</label><input name="api_key" type="password" class="form-select" autocomplete="off" required placeholder="${ai.configured ? 'Paste a new key to replace it' : 'Paste your key'}"></div></div><label class="row small mb"><input type="checkbox" name="approved" required> Our compliance owner approved sending worker documents to this provider.</label><button class="btn-submit-green">Test & save</button></form>`)}
    ${card('Users & Roles', 'Roles limit which packs a person can act on. Immigration records are restricted.', table(['Name', 'Email', 'Role', 'Slack ID'], users.map((u) => h`<tr><td><strong>${u.name}</strong></td><td>${u.email}</td><td>${words(u.role)}</td><td class="mono">${u.slack_id}</td></tr>`), ''))}
    <form class="plain-card" data-form="user"><strong>Add user</strong><div class="form-grid mt"><div class="form-group"><label class="form-label">Name</label><input name="name" class="form-select" required></div><div class="form-group"><label class="form-label">Email</label><input name="email" type="email" class="form-select" required></div><div class="form-group"><label class="form-label">Role</label><select name="role" class="form-select"><option>hr</option><option>healthcare_compliance</option><option>immigration_owner</option><option>finance</option><option>viewer</option><option>admin</option></select></div><div class="form-group"><label class="form-label">Temporary password</label><input name="password" type="password" minlength="8" class="form-select" required></div></div><button class="btn-submit-green">Add user</button></form>
    ${card('Schedules', 'Checks run daily. Reminders run on each control’s cadence.', table(['Job', 'Cadence', 'Next run'], hl.schedules.map((s) => h`<tr><td>${s.kind}</td><td>${s.cadence}</td><td class="mono">${dt(s.next_run_at)}</td></tr>`), 'No schedules.'))}</div>`;
  },
};
const modePill = (m) => m === 'auto' ? h`<span class="pill pill-pass">Automatic requests</span>` : h`<span class="pill pill-warn">Validation only</span>`;
function draftCard(d) {
  const p = d.preview;
  return h`<div class="tile mt"><div class="between"><strong>${p.control}</strong><button class="btn-submit-green" data-act="submitDraft" data-id="${d.id}">Submit for approval</button></div><p class="small mt"><strong>${p.would_act}</strong> of ${p.applicable} applicable records would be acted on. ${p.schedule}.</p><p class="small muted">Message: ${p.sample_message}</p><div class="small mt">${p.rows.filter((r) => r.would_act).slice(0, 6).map((r) => h`<div>${statusPill(r.status)} ${r.name}: ${r.reason}</div>`)}</div></div>`;
}
function evidencePanel(e) {
  const pending = e.status === 'needs_review', f = (k, l, type = 'text') => h`<div class="form-group"><label class="form-label">${l} ${e.field_confidence[k] ? h`<span class="muted">(${Math.round(e.field_confidence[k] * 100)}%)</span>` : ''}</label><input name="${k}" type="${type}" class="form-select" value="${e[k] || ''}" ${pending ? '' : raw('disabled')}></div>`;
  return h`${e.review_reasons.length ? h`<div class="alert-box"><strong>Why this needs a person</strong><ul>${e.review_reasons.map((r) => h`<li>${r}</li>`)}</ul></div>` : ''}
  <dl class="kv mb"><dt>File</dt><dd>${e.filename} ${e.has_file ? h`<a class="btn-link-action" href="/api/evidence/${e.id}/file">Download</a>` : ''}</dd><dt>Subject</dt><dd>${e.subject_name}</dd><dt>Control</dt><dd>${e.control_key || 'Not matched'}</dd><dt>Source</dt><dd>${words(e.source)}</dd>${e.reviewed_by ? h`<dt>Reviewed by</dt><dd>${e.reviewed_by}</dd>` : ''}${e.reject_reason ? h`<dt>Rejected</dt><dd>${e.reject_reason}</dd>` : ''}</dl>
  <form data-form="reviewEvidence" data-id="${e.id}"><div class="form-grid">${f('holder_name', 'Name on document')}${f('doc_number', 'Document number')}${f('issued_on', 'Issued', 'date')}${f('expires_on', 'Expires', 'date')}${f('state', 'State')}${f('period', 'Period')}${f('entity_name', 'Entity')}</div>${e.doc_type === 'unknown' && pending ? h`<div class="form-group"><label class="form-label">Document type</label><select name="doc_type" class="form-select" required><option value="">Choose</option>${['professional_license', 'bls_card', 'acls_card', 'tb_screening', 'flu_vaccine', 'facility_orientation', 'handbook_ack', 'security_training', 'i9_record', 'work_authorization', 'w4', 'payroll_filing_receipt'].map((x) => h`<option value="${x}">${words(x)}</option>`)}</select></div>` : ''}
  ${pending ? h`<div class="form-group"><label class="form-label">Rejection reason</label><input name="reason" class="form-select" placeholder="Required when rejecting"></div><div class="row"><button class="btn-submit-green" name="decision" value="accept">Accept evidence</button><button class="btn-danger" name="decision" value="reject">Reject</button></div><p class="muted small mt">Accepting records the document. The check is then rerun, and the case closes only if it passes.</p>` : ''}</form>`;
}
const LIFE = [['Identify', ['identified']], ['Assign', ['assigned']], ['Request', ['requested']], ['Follow up', ['following_up']], ['Review', ['in_review']], ['Re-evaluate', ['reevaluating']], ['Close', ['closed']]];
const lifecycle = (s) => { const i = LIFE.findIndex(([, a]) => a.includes(s)); return h`<div class="lifecycle">${LIFE.map(([l], n) => h`<div class="${n < i ? 'done' : n === i ? 'now' : ''}">${l}</div>`)}</div>`; };
function closeAllDirMenus(except) {
  document.querySelectorAll('.dir.open').forEach((d) => {
    if (d !== except) {
      d.classList.remove('open');
      const btn = d.previousElementSibling;
      if (btn && btn.setAttribute) btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function renderDemoRack() {
  const rackEl = $('#rack');
  if (!rackEl) return;
  rackEl.innerHTML = PERSONAS.map((p, i) => `
    <div class="peg" style="--c:${p.color};--i:${i}">
      <span class="s"></span>
      <button class="mini" type="button" data-persona-idx="${i}">
        <span class="mb">${p.name}<small>${p.email}</small></span>
        <span class="md" style="display:block">${p.desc}</span>
        <span class="zones" style="display:block"><span class="zgrid" style="display:grid">${renderZonesHtml(p.z)}</span></span>
        <span class="go">Sign in as ${p.short}</span>
      </button>
    </div>
  `).join('');
}

async function selectPersonaInWorkspace(p) {
  closeDemoRack();
  toast(`Switching to ${p.name} (${p.roleName})…`, 'info');
  try {
    await api('/api/login', { email: p.email, password: demoPassword });
    location.reload();
  } catch (err) {
    toast(err.message || 'Failed to switch demo account', 'warning');
  }
}

const ACT = {
  toggleMenu: () => $('#sheet')?.classList.toggle('open'),
  openDemoRack: () => { renderDemoRack(); openDemoRack(); },
  closeDemoRack: () => { closeDemoRack(); },
  navDirect: (el) => {
    closeAllDirMenus();
    const id = el.dataset.id;
    if (id) {
      location.hash = '#' + id;
      go(id);
    }
  },
  toggleDir: (el, ev) => {
    ev?.stopPropagation();
    const btn = el.closest('.tab') || el;
    const wrap = btn.closest('.tabwrap');
    const dir = wrap?.querySelector('.dir');
    if (dir) {
      const wasOpen = dir.classList.contains('open');
      closeAllDirMenus();
      if (!wasOpen) {
        dir.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    }
  },
  dirLink: (el) => {
    closeAllDirMenus();
    $('#sheet')?.classList.remove('open');
    const href = el.getAttribute('href') || el.closest('a')?.getAttribute('href');
    if (href && href.startsWith('#') && href.length > 1) {
      const [r, a] = href.slice(1).split('/');
      location.hash = href;
      go(VIEWS[r] ? r : 'overview', a || null);
    }
  },
  closeModal, openChat: () => { $('#chatDrawer').classList.add('open'); loadChat(); }, closeChat: () => $('#chatDrawer').classList.remove('open'),
  async logout() { await api('/api/logout', {}); location.hash = ''; location.reload(); },
  prompt: (el) => { $('#chatDrawer').classList.add('open'); sendChat(el.dataset.q); },
  async caseDetail(el) {
    const c = await api(`/api/cases/${el.dataset.id}`), e = c.evaluation, open = !c.closed_at;
    openModal(`${c.control_name}: ${c.subject_name}`, `${c.id} · ${c.owner_name || c.owner_team}`, h`${lifecycle(c.state)}
    <dl class="kv mb"><dt>Current result</dt><dd>${e ? statusPill(e.status) : '—'} ${e?.reason}</dd><dt>Control version</dt><dd class="mono">${e?.control_version}</dd><dt>Evidence used</dt><dd class="mono">${e?.evidence_ids.join(', ') || 'None'}</dd><dt>Due</dt><dd>${date(c.due_date)}</dd><dt>Reminders</dt><dd>${c.reminders_sent}${c.escalated ? ' · Escalated' : ''}</dd>${c.closure ? h`<dt>Closure</dt><dd>${words(c.closure)}</dd>` : ''}<dt>Finding</dt><dd>${c.finding_verdict ? `${words(c.finding_verdict)} by ${c.verdict_by}` : 'Not validated by owner'}</dd></dl>
    ${c.evidence.length ? h`<strong class="small">Evidence</strong>${c.evidence.map((x) => h`<div class="timeline-item"><span>${statePill(x.status)}</span><span>${x.filename}${x.review_reasons.length ? ` · ${x.review_reasons.join(' ')}` : ''}</span></div>`)}` : ''}
    <div class="mt"><strong class="small">History</strong>${c.timeline.map((t) => h`<div class="timeline-item"><time>${dt(t.ts)}</time><span>${t.action}</span></div>`)}${c.notes.map((n) => h`<div class="timeline-item"><time>${dt(n.created_at)}</time><span><strong>${n.author}:</strong> ${n.note}</span></div>`)}</div>
    ${open ? h`<form class="row mt" data-form="note" data-id="${c.id}"><input name="note" class="form-select" style="flex:1" placeholder="Add a note. Notes do not change the result." required aria-label="Note"><button class="btn-card-outline">Add note</button></form>` : ''}`,
      open ? h`${!c.finding_verdict ? h`<button class="btn-cancel" data-act="verdict" data-id="${c.id}" data-v="false_finding">False finding</button><button class="btn-cancel" data-act="verdict" data-id="${c.id}" data-v="confirmed">Confirm finding</button>` : ''}<button class="btn-cancel" data-act="humanDecision" data-id="${c.id}">Request decision</button><button class="btn-submit-green" data-act="followUp" data-id="${c.id}">Send follow-up</button>` : '', true);
  },
  async followUp(el, ev) { ev?.stopPropagation(); const r = await api(`/api/cases/${el.dataset.id}/follow-up`, {}); toast(r.message, r.sent ? 'success' : 'warning'); after(); },
  async verdict(el) { await api(`/api/cases/${el.dataset.id}/verdict`, { verdict: el.dataset.v }); toast('Finding recorded.', 'success'); closeModal(); refresh(); },
  async humanDecision(el) { await api(`/api/cases/${el.dataset.id}/decision`, { title: 'Assignment decision', detail: 'Requested from the case.' }); toast('Sent to Approvals.', 'success'); closeModal(); refresh(); },
  async chaseAll() { const r = await api('/api/cases/chase-all', {}); toast(`${r.sent} follow-up(s) queued. ${r.skipped} skipped.`, 'success'); after(); },
  async decide(el) { await api(`/api/approvals/${el.dataset.id}/decide`, { decision: el.dataset.d }); toast(`Marked ${el.dataset.d}.`, 'success'); after(); },
  caseTab(el) { caseClosed = !!el.dataset.v; refresh(); },
  checkFilter(el) { checkFilter[el.dataset.k] = el.dataset.v; refresh(); },
  async workerDetail(el, ev) {
    ev?.stopPropagation();
    const w = await api(`/api/workers/${el.dataset.id}`), rv = w.readiness_view;
    openModal(w.name, `${w.role || ''} · ${w.facility || 'No confirmed location'}`, h`<div class="grid-3 mb" style="grid-template-columns:repeat(4,1fr)">${rv.summary.map((s) => h`<div class="tile"><span>${s.pack}</span><div class="mt">${statusPill(s.status)}</div></div>`)}</div><div class="alert-box">${rv.statement}</div>${table(['Control', 'Result', 'Reason'], w.checks_list.filter((c) => c.status !== 'not_applicable').map((c) => h`<tr><td>${c.control_name}</td><td>${statusPill(c.status)}</td><td class="small">${c.reason}</td></tr>`), 'No checks yet.')}`, h`<button class="btn-cancel" data-act="moveWorker" data-id="${w.id}">Change assignment</button><button class="btn-submit-green" data-act="readiness" data-id="${w.id}">Request readiness decision</button>`, true);
  },
  moveWorker(el) { openModal('Change assignment', 'Aegis re-runs the checks that apply to the new location.', h`<form data-form="move" data-id="${el.dataset.id}"><div class="form-group"><label class="form-label">Facility</label><input name="facility" class="form-select" required></div><div class="form-group"><label class="form-label">State</label><input name="facility_state" class="form-select" maxlength="2"></div><button class="btn-submit-green">Save</button></form>`); },
  async readiness(el) { await api(`/api/workers/${el.dataset.id}/readiness-review`, {}); toast('Sent to Approvals.', 'success'); closeModal(); refresh(); },
  selectEvidence(el, ev) { ev?.stopPropagation(); evidenceSel = el.dataset.id; refresh(); },
  addWorker() { openModal('Add Worker', 'Added workers are checked against activated packs.', h`<form data-form="addWorker"><div class="form-grid"><div class="form-group"><label class="form-label">Full name</label><input name="name" class="form-select" required></div><div class="form-group"><label class="form-label">Email</label><input name="email" type="email" class="form-select"></div><div class="form-group"><label class="form-label">Role</label><input name="role" class="form-select" required></div><div class="form-group"><label class="form-label">Category</label><select name="category" class="form-select"><option value="clinical">Clinical</option><option value="corporate">Corporate</option></select></div><div class="form-group"><label class="form-label">License type</label><select name="license_type" class="form-select"><option value="">None</option><option>RN</option><option>NP</option><option>MD</option><option>PT</option></select></div><div class="form-group"><label class="form-label">Hire date</label><input name="hire_date" type="date" class="form-select" value="${me.today}"></div><div class="form-group"><label class="form-label">Facility</label><input name="facility" class="form-select"></div><div class="form-group"><label class="form-label">State</label><input name="facility_state" maxlength="2" class="form-select"></div><div class="form-group"><label class="form-label">Employing entity</label><input name="entity" class="form-select"></div></div><button class="btn-submit-green">Save worker</button></form>`, null, true); },
  importRoster() { importPreview = null; openModal('Import Worker Roster', 'Excel or CSV. You review the mapping before anything is saved.', h`<form data-form="importFile"><div class="drop-zone-box"><input type="file" name="file" accept=".csv,.xlsx" required aria-label="Roster file"><span class="subtext mt">Columns like Name, Email, Role, Facility, State, License Type, Hire Date</span></div><button class="btn-submit-green mt">Preview import</button></form>`); },
  async commitImport(el) { const r = await api(`/api/import/${el.dataset.id}/commit`, {}); toast(`${r.created} added, ${r.updated} updated.`, 'success'); closeModal(); after(); },
  async uploadEvidence(el, ev, bulk) {
    const [ws, ctl] = await Promise.all([api('/api/workers'), api('/api/controls')]);
    const setup = await api('/api/setup');
    openModal(bulk ? 'Bulk upload' : 'Intake Evidence', 'AI proposes fields. The evaluator decides the result.', h`<form data-form="upload" data-bulk="${bulk ? '1' : ''}"><div class="form-group"><label class="form-label">Subject</label><select name="subject" class="form-select" required>${ws.map((w) => h`<option value="worker:${w.id}">${w.name}</option>`)}${setup.entities.map((e) => h`<option value="entity:${e.id}">${e.name} (company)</option>`)}</select></div><div class="form-group"><label class="form-label">Requirement</label><select name="control_key" class="form-select"><option value="">Let Aegis match it</option>${ctl.controls.filter((c) => c.remediation && c.type !== 'field_required').map((c) => h`<option value="${c.key}">${c.pack}: ${c.name}</option>`)}</select></div><div class="form-group"><label class="form-label">File${bulk ? 's' : ''}</label><input type="file" name="file" class="form-select" required ${bulk ? raw('multiple') : ''}></div><div class="form-grid"><div class="form-group"><label class="form-label">Document number (optional)</label><input name="doc_number" class="form-select"></div><div class="form-group"><label class="form-label">Expiration (optional)</label><input name="expires_on" type="date" class="form-select"></div></div><button class="btn-submit-green">Scan & match</button></form>`);
  },
  bulkUpload(el, ev) { return ACT.uploadEvidence(el, ev, true); },
  async reviewPack(el) {
    const [packs, owners] = await Promise.all([api('/api/packs'), api('/api/owners')]), p = packs.find((x) => x.key === el.dataset.id);
    openModal(`${p.icon} ${p.name}`, `Version ${p.latest_version}`, h`<div class="alert-box">${p.review_note}</div>${table(['Control', 'Type', 'Source'], p.controls.map((c) => h`<tr><td><strong>${c.name}</strong></td><td class="muted">${words(c.requirement_type)}</td><td class="small">${c.source}</td></tr>`), '')}<p class="small mt"><strong>Validation tests:</strong> ${p.validation.filter((v) => v.ok).length} of ${p.validation.length} pass.</p>${me.user.is_admin ? h`<form data-form="activate" data-id="${p.key}" class="mt"><div class="form-group"><label class="form-label">Responsible owner</label><select name="owner_user_id" class="form-select" required>${owners.map((o) => h`<option value="${o.id}" ${(p.owner_user_id ? o.id === p.owner_user_id : o.role === p.owner_role) ? raw('selected') : ''}>${o.name} (${words(o.role)})</option>`)}</select></div><label class="row small"><input type="checkbox" name="reviewed" required> I reviewed applicability, sources and deadlines for this company.</label><button class="btn-submit-green mt">${p.status === 'active' ? 'Update' : 'Activate in validation mode'}</button></form>` : ''}`, null, true);
  },
  async packMode(el) { await api(`/api/packs/${el.dataset.id}/mode`, { mode: el.dataset.m }); toast('Pack mode updated.', 'success'); after(); },
  async submitDraft(el) { await api(`/api/controls/${el.dataset.id}/submit`, {}); lastDraft = (lastDraft || []).filter((d) => d.id !== el.dataset.id); toast('Sent to Approvals. It is not active yet.', 'success'); refresh(); },
  facility(el) { openModal(`Requirements: ${el.dataset.name}`, 'These come from the client contract or facility policy.', h`<form data-form="facility" data-id="${el.dataset.id}"><div class="form-group"><label class="form-label">State</label><input name="state" class="form-select" maxlength="2" value="${el.dataset.state}"></div>${[['acls', 'ACLS card'], ['flu_vaccine', 'Flu vaccination'], ['facility_orientation', 'Facility orientation']].map(([k, l]) => h`<label class="row small mb"><input type="checkbox" name="req" value="${k}" ${el.dataset.req.split(',').includes(k) ? raw('checked') : ''}> ${l}</label>`)}<button class="btn-submit-green">Confirm requirements</button></form>`); },
  async confirmContext() { await api('/api/setup/context', {}); toast('Company profile confirmed.', 'success'); refresh(); },
  async assess() { const c = await api('/api/setup/assess', {}); toast(`${c.pass} pass, ${c.fail} fail, ${c.unknown} unknown.`, 'success'); after(); },
  async syncConnector(el) { const r = await api(`/api/connectors/${el.dataset.id}/sync`, {}); toast(`${r.records} record(s) synced.`, 'success'); after(); },
  async aiTest() { const r = await api('/api/ai/test', {}); toast(`${r.provider} is responding.`, 'success'); refresh(); },
  async aiRemove() { await api('/api/ai/remove', {}); toast('AI key removed.', 'success'); refresh(); },
  async sendDigest() { await api('/api/digest/send', {}); toast('Digest posted to the outbox.', 'success'); },
  viewNotice(el) { openModal('Draft response', 'For finance review. Aegis does not file or send this.', h`<div style="white-space:pre-wrap;font-size:12px">${el.dataset.text}</div>`); },
  copyLink() { navigator.clipboard?.writeText(location.href); toast('Link copied. Access still depends on role.', 'success'); },
  demoPanel() { openModal('Demo controls', 'These call the same webhook and scheduler paths as production.', h`<div class="stack"><div><strong class="small">Signed HRMS events</strong><div class="row mt"><button class="top-action-btn" data-act="demoEvent" data-k="new_hire">New clinical hire</button><button class="top-action-btn" data-act="demoEvent" data-k="assignment_change">Assignment change</button><button class="top-action-btn" data-act="demoEvent" data-k="termination">Termination</button></div></div><div><strong class="small">Time</strong><div class="row mt"><button class="top-action-btn" data-act="demoAdvance" data-d="4">Advance 4 days</button><span class="muted small">Today in demo: ${me.today}</span></div></div><div><strong class="small">Data</strong><div class="row mt"><button class="btn-danger" data-act="demoReset">Reset all demo data</button></div></div></div>`); },
  async demoEvent(el) { const r = await api('/api/demo/hrms-event', { kind: el.dataset.k }); toast(`${r.type}: ${r.worker}`, 'success'); closeModal(); after(); },
  async demoAdvance(el) { const r = await api('/api/demo/advance', { days: +el.dataset.d }); me.today = r.today; renderTop(); toast(`Demo date is now ${r.today}.`, 'success'); closeModal(); after(); },
  async demoReset() { await api('/api/demo/reset', {}); location.hash = ''; location.reload(); },
};
const after = () => refresh();
const FORM = {
  chat: (d, f) => { f.reset(); sendChat(d.text); },
  async addWorker(d) { await api('/api/workers', d); toast('Worker added. Checks are running.', 'success'); closeModal(); setTimeout(after, 1200); },
  async move(d, f) { await api(`/api/workers/${f.dataset.id}/assignment`, d); toast('Assignment updated. Checks are running.', 'success'); closeModal(); setTimeout(after, 1200); },
  async note(d, f) { await api(`/api/cases/${f.dataset.id}/note`, d); toast('Note added.', 'success'); ACT.caseDetail({ dataset: { id: f.dataset.id } }); },
  async importFile(d, f) {
    const p = await api('/api/import/preview', { file: await fileData(f.elements.file.files[0]) });
    openModal(`Review ${p.filename}`, `${p.total} worker(s) ready. Nothing is saved yet.`, h`${p.errors.length ? h`<div class="alert-box">${p.errors.length} row(s) will be skipped: ${p.errors.map((e) => `row ${e.row}: ${e.error}`).join('; ')}</div>` : ''}${p.unmapped.length ? h`<p class="small muted mb">Ignored columns: ${p.unmapped.join(', ')}</p>` : ''}<p class="small mb">Missing: ${p.missing.facility} location, ${p.missing.email} email, ${p.missing.hire_date} hire date. These will show as data gaps.</p>${table(['Name', 'Email', 'Role', 'Facility', 'Hire date'], p.sample.map((r) => h`<tr><td>${r.name}</td><td>${r.email}</td><td>${r.role}</td><td>${r.facility}</td><td>${r.hire_date}</td></tr>`), '')}`, h`<button class="btn-cancel" data-act="closeModal">Cancel</button><button class="btn-submit-green" data-act="commitImport" data-id="${p.id}">Import ${p.total} worker(s)</button>`, true);
  },
  async upload(d, f) {
    const [subject_type, subject_id] = d.subject.split(':'); let last;
    for (const file of f.elements.file.files) last = await api('/api/evidence', { subject_type, subject_id, control_key: d.control_key || null, bulk: !!f.dataset.bulk, file: await fileData(file), claimed: { doc_number: d.doc_number, expires_on: d.expires_on } });
    toast(last.duplicate ? 'That file is already on record.' : last.status === 'accepted' ? 'Evidence matched. Re-running the check.' : `Sent to review: ${last.reasons[0]}`, last.status === 'accepted' ? 'success' : 'warning');
    closeModal(); evidenceSel = last.id; if (route !== 'evidence') location.hash = 'evidence'; setTimeout(after, 1200);
  },
  async reviewEvidence(d, f, sub) {
    const { reason, ...fields } = d;
    await api(`/api/evidence/${f.dataset.id}/review`, { decision: sub?.value, reason, fields });
    toast(sub?.value === 'accept' ? 'Accepted. Re-running the check.' : 'Rejected. The submitter will be asked again.', 'success'); setTimeout(after, 1200);
  },
  async draftRule(d) { lastDraft = await api('/api/controls/draft', d); refresh(); },
  async activate(d, f) { await api(`/api/packs/${f.dataset.id}/activate`, { owner_user_id: d.owner_user_id, reviewed: !!d.reviewed }); toast('Pack activated in validation mode.', 'success'); closeModal(); setTimeout(after, 1200); },
  async facility(d, f) { await api(`/api/setup/facility/${f.dataset.id}`, { state: d.state, requirements: [...f.querySelectorAll('[name=req]:checked')].map((x) => x.value) }); toast('Requirements confirmed.', 'success'); closeModal(); setTimeout(after, 1200); },
  async channel(d) { await api('/api/setup/channel', d); toast('Channel saved.', 'success'); refresh(); },
  async connector(d) { await api('/api/connectors', d); toast('Connector saved.', 'success'); refresh(); },
  async dashboard(d) { const r = await api('/api/dashboards', { ...d, pack: d.pack || null }); location.hash = `dashboards/${r.id}`; },
  async notice(d) { await api('/api/notices', d); toast('Draft created and sent to Approvals.', 'success'); refresh(); },
  async baseline(d) { await api('/api/metrics/baseline', { key: 'minutes_per_chase', value: d.value }); toast('Baseline saved.', 'success'); refresh(); },
  async manualSupport(d) { await api('/api/metrics/manual-support', d); toast('Logged.', 'success'); refresh(); },
  async aiKey(d) { const r = await api('/api/ai', { provider: d.provider, api_key: d.api_key, approved: !!d.approved }); toast(`${r.provider_label} connected.`, 'success'); refresh(); },
  async user(d) { await api('/api/users', d); toast('User added.', 'success'); refresh(); },
  async login(d) { await api('/api/login', d); location.reload(); },
};
const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/#dashboards\/(dash_[a-f0-9]+)/g, '<a href="#dashboards/$1">Open dashboard</a>').replace(/\n/g, '<br>');
async function loadChat() {
  const list = await api('/api/chat'), m = $('#chatMessages');
  m.innerHTML = list.length ? list.map((x) => `<div class="chat-bubble ${x.sender === 'bot' ? 'bot' : 'user'}"><span class="chat-bubble-author">${esc(x.author)}</span><div class="chat-bubble-content">${md(x.text)}</div></div>`).join('') : '<div class="empty">Ask about gaps, expirations or approvals.</div>';
  m.scrollTop = m.scrollHeight;
}
async function sendChat(text) { if (!text) return; try { await api('/api/chat', { text }); } catch (e) { toast(e.message, 'warning'); } await loadChat(); refresh(); }
/* ==========================================================================
   AEGIS HANGING BADGE AUTH & RBAC PERSONAS
   ========================================================================== */

const ZONES = ["Immigration", "Clinical", "Tax", "HR", "Audit log", "Settings"];
// 2 = full access, 1 = view only, 0 = blocked  (same order as ZONES)
const PERSONAS = [
  {
    name: "Sathinath Padhi",
    roleName: "Full Admin",
    short: "Admin",
    email: "sathinath@bluebix.demo",
    color: "#0E8A5F",
    desc: "Sees everything. Manages settings and AI keys, and approves rule changes.",
    z: [2, 2, 2, 2, 2, 2]
  },
  {
    name: "Hannah Reed",
    roleName: "HR Operations",
    short: "HR",
    email: "hr@bluebix.demo",
    color: "#D9622B",
    desc: "Runs handbooks and onboarding. Legally blocked from passport and immigration files.",
    z: [0, 0, 0, 2, 0, 0]
  },
  {
    name: "Ivan Morales",
    roleName: "Immigration Specialist",
    short: "Immigration",
    email: "immigration@bluebix.demo",
    color: "#5B45C9",
    desc: "Reviews passports, Form I-9, STEM OPT and visa documents.",
    z: [2, 0, 0, 1, 0, 0]
  },
  {
    name: "Grace Okafor",
    roleName: "Clinical Compliance",
    short: "Clinical",
    email: "health@bluebix.demo",
    color: "#C2283F",
    desc: "Reviews clinical credentials only: RN licenses, BLS/CPR cards and TB tests.",
    z: [0, 2, 0, 0, 0, 0]
  },
  {
    name: "Farah Ali",
    roleName: "Payroll / Finance",
    short: "Finance",
    email: "finance@bluebix.demo",
    color: "#B98A00",
    desc: "Handles Form W-4 withholding certificates and payroll tax notices.",
    z: [0, 0, 2, 0, 0, 0]
  },
  {
    name: "Vikram Shah",
    roleName: "Auditor / Read-Only",
    short: "Auditor",
    email: "viewer@bluebix.demo",
    color: "#2F6496",
    desc: "Reads records and the audit log for inspections. Can't change anything.",
    z: [1, 1, 1, 1, 1, 0]
  }
];

const BLANK_BADGE = { name: "Your name here", role: "Not signed in", email: "", color: "#0E8A5F", z: [0, 0, 0, 0, 0, 0] };
let currentPersona = null;
let demoPassword = "demo1234";

function badgeInitials(s) {
  const w = String(s || '').replace(/[^a-zA-Z ]/g, ' ').trim().split(/\s+/);
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
}

function renderBarcode(seed) {
  let h = 2166136261;
  for (const c of String(seed || '')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  let x = 0, out = '';
  while (x < 250) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const w = 1 + (Math.abs(h) % 4);
    if ((h >>> 3) & 1) out += `<rect x="${x}" y="0" width="${w}" height="30"/>`;
    x += w + 1;
  }
  const el = $('#bCode');
  if (el) {
    el.setAttribute('viewBox', '0 0 250 30');
    el.innerHTML = `<g fill="#16202B">${out}</g>`;
  }
}

const zoneClass = (v) => (v === 2 ? 'full' : v === 1 ? 'view' : 'none');
const renderZonesHtml = (z) => ZONES.map((n, i) => `<span class="z ${zoneClass(z[i])}"><i></i>${n}</span>`).join('');

function updateHangingBadge({ name, role, email, color, z }) {
  document.documentElement.style.setProperty('--role', color || '#0E8A5F');
  const bName = $('#bName'); if (bName) bName.textContent = name || 'Your name here';
  const bRole = $('#bRole'); if (bRole) bRole.textContent = role || 'Not signed in';
  const bMail = $('#bMail'); if (bMail) bMail.textContent = email || '';
  const bInit = $('#bInit'); if (bInit) bInit.textContent = badgeInitials(name === 'Your name here' ? '?' : name);
  const bZones = $('#bZones'); if (bZones) bZones.innerHTML = renderZonesHtml(z || [0, 0, 0, 0, 0, 0]);
  renderBarcode(email || 'aegis');
}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
async function typeIntoInput(el, text, ms) {
  if (!el) return;
  el.value = '';
  for (let i = 1; i <= text.length; i++) {
    el.value = text.slice(0, i);
    if (ms > 0) await sleepMs(ms);
  }
}

let tiltInitialized = false;
function setupTiltListener() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || tiltInitialized) return;
  tiltInitialized = true;
  let cur = 0, target = 0;
  window.addEventListener('pointermove', (e) => {
    target = ((e.clientX / window.innerWidth) - 0.5) * -5;
  });
  function loop() {
    const tilt = $('#tilt');
    if (tilt) {
      cur += (target - cur) * 0.06;
      tilt.style.transform = `rotate(${cur.toFixed(2)}deg)`;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

let rackLastFocus = null;
function openDemoRack() {
  const overlay = $('#overlay');
  if (!overlay) return;
  rackLastFocus = document.activeElement;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const first = overlay.querySelector('.mini');
    if (first) first.focus();
  }, 60);
}

function closeDemoRack() {
  const overlay = $('#overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (rackLastFocus) rackLastFocus.focus();
}

let selectingDemo = false;
async function selectDemoBadge(p) {
  if (selectingDemo) return;
  selectingDemo = true;
  try {
    closeDemoRack();
    const hanger = $('#hanger');
    const stamp = $('#stamp');
    const emailInput = $('#email');
    const passInput = $('#password');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (stamp) stamp.classList.remove('hit');
    if (hanger && !reduced) {
      hanger.classList.remove('again');
      hanger.classList.add('lift');
      await sleepMs(430);
    }

    updateHangingBadge({ name: p.name, role: p.roleName, email: p.email, color: p.color, z: p.z });

    if (hanger) {
      hanger.classList.remove('lift');
      void hanger.offsetWidth;
      hanger.classList.add('again');
    }

    currentPersona = p;
    await sleepMs(reduced ? 0 : 450);
    await typeIntoInput(emailInput, p.email, reduced ? 0 : 20);
    currentPersona = p;
    await typeIntoInput(passInput, demoPassword, reduced ? 0 : 35);
    submitBadgeLogin();
  } finally {
    selectingDemo = false;
  }
}

async function submitBadgeLogin() {
  const emailInput = $('#email');
  const passInput = $('#password');
  const submitBtn = $('#submit');
  const statusEl = $('#status');
  if (statusEl) { statusEl.className = 'status status-desk'; statusEl.textContent = ''; }

  const em = emailInput ? emailInput.value.trim() : '';
  const pw = passInput ? passInput.value : '';

  if (!em) {
    if (statusEl) { statusEl.className = 'status status-desk err'; statusEl.textContent = 'Enter your work email to sign in.'; }
    if (emailInput) emailInput.focus();
    return;
  }
  if (!pw) {
    if (statusEl) { statusEl.className = 'status status-desk err'; statusEl.textContent = 'Enter your password to sign in.'; }
    if (passInput) passInput.focus();
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking your badge…'; }

  try {
    await api('/api/login', { email: em, password: pw });
    if (submitBtn) { submitBtn.textContent = 'Signed in'; submitBtn.classList.add('done'); }
    const bRole = $('#bRole'); if (bRole) bRole.textContent = currentPersona ? `${currentPersona.roleName}, cleared` : 'Cleared';
    const stamp = $('#stamp'); if (stamp) stamp.classList.add('hit');
    if (statusEl) {
      statusEl.className = 'status status-desk ok';
      statusEl.textContent = currentPersona
        ? `Signed in as ${currentPersona.name}. Opening the workspace…`
        : 'Signed in. Opening the workspace…';
    }
    setTimeout(() => { location.reload(); }, 1000);
  } catch (err) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign in'; }
    if (statusEl) {
      statusEl.className = 'status status-desk err';
      statusEl.textContent = err.message || "That email and password don't match. Check them and try again.";
    }
  }
}

async function showLogin() {
  const as = $('#appShell'); if (as) { as.hidden = true; as.style.display = 'none'; }
  const ls = $('#loginScreen'); if (ls) { ls.hidden = false; ls.style.display = 'block'; }
  document.body.style.background = 'var(--wall)';

  const info = await fetch('/api/public/info').then((r) => r.json()).catch(() => ({ demo: true, demo_password: 'demo1234' }));
  demoPassword = info.demo_password || 'demo1234';

  $('#loginScreen').innerHTML = `
    <div class="page badge-page">
      <!-- Left: the hanging badge on lanyard -->
      <aside class="stand" aria-label="Badge preview">
        <div class="hanger" id="hanger">
          <div class="tilt" id="tilt">
            <div class="strap"><span>aegis&nbsp;&nbsp;aegis&nbsp;&nbsp;aegis&nbsp;&nbsp;aegis&nbsp;&nbsp;aegis&nbsp;&nbsp;aegis</span></div>
            <div class="clip"></div>
            <div class="holder">
              <div class="badge">
                <div class="band">
                  <span class="org">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/></svg>
                    Aegis
                  </span>
                  <small>Bluebix workspace</small>
                </div>
                <div class="photo" id="bInit">?</div>
                <div class="who">
                  <div class="name" id="bName">Your name here</div>
                  <div class="role" id="bRole">Not signed in</div>
                  <div class="mail" id="bMail"></div>
                </div>
                <div class="zones">
                  <p>Records this badge opens</p>
                  <div class="zgrid" id="bZones"></div>
                </div>
                <svg class="barcode" id="bCode" preserveAspectRatio="none" aria-hidden="true"></svg>
                <div class="stamp" id="stamp">Cleared</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right: the sign-in desk -->
      <main class="desk">
        <div class="top top-desk">
          <div class="logo desk-logo">
            <b><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg></b>
            Aegis
          </div>
          <a href="#help" id="helpLink">Need help signing in?</a>
        </div>

        <section class="main main-desk">
          <h1>Badge in.</h1>
          <p class="lead">Sign in to see the employee records your role is cleared for. Nothing more, nothing less.</p>

          <form id="form" class="form-desk" novalidate>
            <div>
              <label for="email">Work email</label>
              <input id="email" type="email" placeholder="name@company.com" autocomplete="username" />
            </div>
            <div>
              <div class="lab"><label for="password">Password</label><a href="#forgot" id="forgotLink">Forgot password?</a></div>
              <div class="pw">
                <input id="password" type="password" autocomplete="current-password" />
                <button type="button" id="toggle" aria-pressed="false">Show</button>
              </div>
            </div>
            <button class="primary primary-badge-btn" id="submit" type="submit">Sign in</button>
          </form>

          <div class="or or-divider">or try it without an account</div>
          <button class="demo demo-trigger" id="openRack" type="button" aria-haspopup="dialog">
            <span class="swatch" id="swatch">${PERSONAS.map(p => `<i style="background:${p.color}"></i>`).join('')}</span>
            Use a demo badge
            <span class="count">6 roles</span>
          </button>

          <p class="status status-desk" id="status" role="status" aria-live="polite"></p>
        </section>

        <p class="fine">Immigration, health and tax records are kept apart by law. Each person only sees the files their job needs, and every action is logged.</p>
      </main>
    </div>
  `;

  renderDemoRack();
  updateHangingBadge(BLANK_BADGE);
  setupTiltListener();

  const emailInput = $('#email');
  const passInput = $('#password');
  const formEl = $('#form');
  const toggleBtn = $('#toggle');
  const openRackBtn = $('#openRack');
  const closeRackBtn = $('#closeRack');
  const overlayEl = $('#overlay');
  const helpLink = $('#helpLink');
  const forgotLink = $('#forgotLink');

  if (emailInput) {
    emailInput.addEventListener('input', () => {
      const val = emailInput.value.trim();
      const found = PERSONAS.find((p) => p.email.toLowerCase() === val.toLowerCase());
      if (found) {
        currentPersona = found;
        updateHangingBadge({ name: found.name, role: found.roleName, email: found.email, color: found.color, z: found.z });
      } else {
        currentPersona = null;
        const local = val.split('@')[0].replace(/[._-]+/g, ' ').trim();
        const name = local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : BLANK_BADGE.name;
        updateHangingBadge({ ...BLANK_BADGE, name, role: val ? 'Signing in' : BLANK_BADGE.role, email: val });
      }
      const stamp = $('#stamp');
      if (stamp) stamp.classList.remove('hit');
    });
  }

  if (toggleBtn && passInput) {
    toggleBtn.onclick = () => {
      const isPw = passInput.type === 'password';
      passInput.type = isPw ? 'text' : 'password';
      toggleBtn.textContent = isPw ? 'Hide' : 'Show';
      toggleBtn.setAttribute('aria-pressed', String(isPw));
    };
  }

  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      currentPersona = currentPersona && emailInput && emailInput.value === currentPersona.email ? currentPersona : null;
      submitBadgeLogin();
    });
  }

  if (openRackBtn) openRackBtn.onclick = openDemoRack;
  if (closeRackBtn) closeRackBtn.onclick = closeDemoRack;
  if (overlayEl) {
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closeDemoRack();
    });
  }

  if (helpLink) {
    helpLink.onclick = (e) => {
      e.preventDefault();
      openDemoRack();
    };
  }

  if (forgotLink) {
    forgotLink.onclick = (e) => {
      e.preventDefault();
      alert(`Demo environment: all test accounts use ${demoPassword}`);
    };
  }
}

ACT.quickLogin = async (el) => {
  const e = el.dataset.e;
  const p = el.dataset.p || demoPassword || 'demo1234';
  try {
    await api('/api/login', { email: e, password: p });
    location.reload();
  } catch (err) {
    toast(err.message || 'Login failed', 'warning');
  }
};

document.addEventListener('click', async (ev) => {
  // Check worn badge menu toggle
  const meBtn = ev.target.closest('#meBtn');
  if (meBtn) {
    ev.stopPropagation();
    const meMenu = $('#meMenu');
    if (meMenu) {
      const wasOpen = meMenu.classList.contains('open');
      closeAllDirMenus();
      if (!wasOpen) {
        meMenu.classList.add('open');
        meBtn.setAttribute('aria-expanded', 'true');
      }
    }
    return;
  }

  // Check demo rack mini clicks
  const miniBtn = ev.target.closest('#rack .mini');
  if (miniBtn) {
    ev.preventDefault();
    ev.stopPropagation();
    const idx = parseInt(miniBtn.dataset.personaIdx, 10);
    if (!isNaN(idx) && PERSONAS[idx]) {
      if ($('#loginScreen') && !$('#loginScreen').hidden) {
        selectDemoBadge(PERSONAS[idx]);
      } else {
        selectPersonaInWorkspace(PERSONAS[idx]);
      }
    }
    return;
  }

  // Check close rack button or backdrop click
  if (ev.target.closest('#closeRack') || ev.target.id === 'overlay') {
    closeDemoRack();
    return;
  }

  // Check mobile menu button or sheet backdrop
  if (ev.target.closest('#menu')) {
    $('#sheet')?.classList.toggle('open');
    return;
  }
  if (ev.target.id === 'sheet') {
    $('#sheet')?.classList.remove('open');
    return;
  }

  // Check any link inside a .dir dropdown or mobile sheet
  const dirLink = ev.target.closest('.dir a, .sheet a');
  if (dirLink) {
    const act = dirLink.dataset.act;
    const href = dirLink.getAttribute('href');
    closeAllDirMenus();
    $('#sheet')?.classList.remove('open');
    if (act && ACT[act] && act !== 'dirLink') {
      ev.preventDefault();
      try { await ACT[act](dirLink, ev); } catch (e) { toast(e.message, 'warning'); }
      return;
    }
    if (href && href.startsWith('#') && href.length > 1) {
      ev.preventDefault();
      const [r, a] = href.slice(1).split('/');
      location.hash = href;
      go(VIEWS[r] ? r : 'overview', a || null);
      return;
    }
  }

  // Close open dropdowns if clicking outside
  if (!ev.target.closest('.dir') && !ev.target.closest('.tab') && !ev.target.closest('#meBtn')) {
    closeAllDirMenus();
  }

  const el = ev.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) {
    ev.preventDefault();
    if (el.tagName === 'BUTTON' && el.closest('tr[data-act]')) ev.stopPropagation();
    try { await ACT[el.dataset.act](el, ev); } catch (e) { toast(e.message, 'warning'); }
  } else if (ev.target.id === 'modal') {
    closeModal();
  }
});
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  const data = Object.fromEntries([...new FormData(f).entries()].filter(([, v]) => !(v instanceof File)));
  const sub = ev.submitter, btn = sub || f.querySelector('button');
  if (btn) btn.disabled = true;
  try { await FORM[f.dataset.form](data, f, sub); } catch (e) { toast(e.message, 'warning'); } finally { if (btn) btn.disabled = false; }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDemoRack();
    closeAllDirMenus();
    $('#sheet')?.classList.remove('open');
  }
  const overlay = $('#overlay');
  if (overlay && overlay.classList.contains('open') && e.key === 'Tab') {
    const f = overlay.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('#globalSearch')?.addEventListener('input', (e) => filterRows(e.target.value));
window.addEventListener('hashchange', readHash);
fetch('/api/me').then((r) => { if (r.ok) boot(); else showLogin(); });
