'use strict';
// Stand-in for the company HRMS so the workflow runs before real API access exists.
const crypto = require('crypto'), { clock, addDays } = require('./lib/util'), db = require('./lib/db');
const NAMES = ['Priya Nair', 'Tom Alvarez', 'Mei Tanaka', 'Omar Haddad', 'Lucy Grant', 'Noah Bell'];
let seq = 0, people = [], counter = 0;
const d = (n) => addDays(clock.today(), n);
const P = (id, full_name, job_title, worker_type, department, license_type, facility, state, hire, extra = {}) => ({ id, full_name, work_email: `${full_name.split(/[ ,]/)[0].toLowerCase()}@bluebix.demo`, job_title, worker_type, department, license_type, employing_entity: 'Bluebix Healthcare LLC', employment_status: 'active', hire_date: d(hire), assignment: { facility, state, start_date: d(hire) }, attributes: { emergency_contact: 'On file', tax_state: state, pay_method: 'direct_deposit' }, ...extra, _v: ++seq });
function reset() {
  seq = 0; counter = 0;
  people = [
    P('101', 'Sarah Jenkins, RN', 'ICU Charge Nurse', 'clinical', 'Clinical', 'RN', 'St. Jude Medical Center', 'CA', -700),
    P('102', 'David Kim, RN', 'ER Travel Nurse', 'clinical', 'Clinical', 'RN', 'Kaiser Permanente', 'CA', -400),
    P('103', 'Marcus Chen', 'Senior Software Engineer', 'corporate', 'Engineering', null, 'HQ Tech Hub', 'CA', -500, { employing_entity: 'Bluebix Staffing Inc' }),
    P('104', 'Elena Rostova, NP', 'Nurse Practitioner', 'clinical', 'Clinical', 'NP', 'UCSF Health', 'CA', -600),
    P('105', 'James Wilson', 'HR Operations Lead', 'corporate', 'HR', null, 'HQ Operations', 'CA', -900, { employing_entity: 'Bluebix Staffing Inc' }),
    P('106', 'Maria Rodriguez, MD', 'Attending Pediatrician', 'clinical', 'Clinical', 'MD', "Stanford Children's", 'CA', -800),
    P('107', 'Alex Patel', 'Data Analyst', 'corporate', 'Analytics', null, 'Remote HQ', 'CA', -300, { employing_entity: 'Bluebix Staffing Inc', work_auth_expires: d(45) }),
    P('108', 'Chloe Dubois', 'Staff Physical Therapist', 'clinical', 'Clinical', 'PT', 'Sutter Health', 'CA', -9),
  ];
}
function route(req, res, url) {
  if (req.headers.authorization !== 'Bearer mock-hrms-key') { res.writeHead(401).end('{}'); return; }
  const since = +(url.searchParams.get('since') || 0);
  const workers = people.filter((p) => p._v > since);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ workers, next_cursor: String(seq) }));
}
async function emit(slug, secret, kind) {
  let w, type;
  if (kind === 'new_hire') {
    counter = db.get("SELECT COUNT(*) n FROM workers WHERE external_id LIKE 'H%'").n + 1;
    const nm = NAMES[(counter - 1) % NAMES.length] + (counter > NAMES.length ? ` ${counter}` : '');
    w = P(`H${counter}`, `${nm}, RN`, 'Med-Surg Nurse', 'clinical', 'Clinical', 'RN', 'St. Jude Medical Center', 'CA', 0, { work_email: `h${counter}@bluebix.demo`, attributes: {} });
    people.push(w); type = 'worker.added';
  } else if (kind === 'assignment_change') {
    w = people.find((p) => p.id === '102');
    w.assignment = { facility: w.assignment.facility === 'St. Jude Medical Center' ? 'Kaiser Permanente' : 'St. Jude Medical Center', state: 'CA', start_date: clock.today() }; w._v = ++seq; type = 'assignment.changed';
  } else if (kind === 'termination') {
    w = people.find((p) => p.id === '105'); w.employment_status = 'terminated'; w._v = ++seq; type = 'worker.terminated';
  } else throw new Error('Unknown event');
  const body = JSON.stringify({ id: `evt_${kind}_${seq}`, type, occurred_at: clock.iso(), worker: w });
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  const r = await fetch(`http://127.0.0.1:${process.env.ACTUAL_PORT}/api/webhooks/hrms/${slug}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aegis-signature': sig }, body });
  return { status: r.status, type, worker: w.full_name, body };
}
module.exports = { reset, route, emit };
