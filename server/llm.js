'use strict';
// Optional AI adapter. Used for interpretation and field extraction only: output is schema-limited
// and can never set a check status, accept evidence or send anything.
// Claude and DeepSeek both use the Anthropic /v1/messages format, so one client covers both.
const db = require('./lib/db'), { encrypt, decrypt, clock } = require('./lib/util'), P = require('./platform');
const PROVIDERS = {
  anthropic: { label: 'Claude (Anthropic)', url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5-5', pdf: true, env: 'ANTHROPIC_API_KEY', extra: {} },
  // DeepSeek returns 400 for a forced tool in thinking mode, so thinking is turned off.
  deepseek: { label: 'DeepSeek', url: 'https://api.deepseek.com/anthropic/v1/messages', model: 'deepseek-flash', pdf: false, env: 'DEEPSEEK_API_KEY', extra: { thinking: { type: 'disabled' } } },
};
const metaKey = (t) => `llm:${t}`, errKey = (t) => `llmerr:${t}`;
function stored(t) {
  const r = db.get('SELECT v FROM meta WHERE k=?', metaKey(t));
  if (!r) return null;
  try { return JSON.parse(decrypt(Buffer.from(r.v, 'base64')).toString()); } catch { return null; }
}
function fromEnv() {
  const wanted = process.env.AEGIS_LLM_PROVIDER;
  const name = PROVIDERS[wanted] && process.env[PROVIDERS[wanted].env] ? wanted : Object.keys(PROVIDERS).find((k) => process.env[PROVIDERS[k].env]);
  return name ? { provider: name, key: process.env[PROVIDERS[name].env], source: 'environment' } : null;
}
const config = (t) => { const s = stored(t); return s ? { ...s, source: 'settings' } : fromEnv(); };
const enabled = (t) => !!config(t);
const supportsPdf = (t) => { const c = config(t); return !!c && PROVIDERS[c.provider].pdf; };
const url = (p) => process.env.AEGIS_LLM_BASE_URL || p.url;

async function request(t, cfg, system, userContent, name, schema) {
  const p = PROVIDERS[cfg.provider];
  const res = await fetch(url(p), {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.AEGIS_LLM_MODEL || p.model, max_tokens: 1000, system, messages: [{ role: 'user', content: userContent }], tools: [{ name, description: 'Record the structured result.', input_schema: schema }], tool_choice: { type: 'tool', name }, ...p.extra }),
  }).catch((e) => { if (e.name === 'TimeoutError') throw e; throw new Error(`Could not reach ${p.label}. Check this server's internet access.`); });
  if (res.status === 401 || res.status === 403) throw new Error(`${p.label} rejected this API key.`);
  if (res.status === 402) throw new Error(`${p.label} reports insufficient balance on this account.`);
  if (!res.ok) throw new Error(`${p.label} returned an error (${res.status}).`);
  const out = await res.json();
  P.bump(t, 'llm_calls'); P.bump(t, 'llm_input_tokens', out.usage?.input_tokens || 0); P.bump(t, 'llm_output_tokens', out.usage?.output_tokens || 0);
  return out.content?.find((b) => b.type === 'tool_use')?.input || null;
}
// Never throws: a failed AI call falls back to human review, and the failure stays visible.
async function callTool(t, system, userContent, name, schema) {
  const cfg = config(t);
  if (!cfg) return null;
  try {
    const out = await request(t, cfg, system, userContent, name, schema);
    db.run('DELETE FROM meta WHERE k=?', errKey(t));
    return out;
  } catch (e) {
    const msg = e.name === 'TimeoutError' ? 'The AI provider timed out.' : e.message;
    db.run('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', errKey(t), JSON.stringify({ message: msg, at: clock.iso() }));
    P.audit(t, 'AI_ERROR', 'AI engine', `AI call failed: ${msg} Work continues through human review.`);
    return null;
  }
}
const PING = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] };
const test = (t, cfg) => request(t, cfg, 'Connection test. Call the tool with ok set to true.', [{ type: 'text', text: 'Connection test.' }], 'record_ping', PING);
function save(t, cfg) { db.run('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', metaKey(t), encrypt(Buffer.from(JSON.stringify(cfg))).toString('base64')); db.run('DELETE FROM meta WHERE k=?', errKey(t)); }
function remove(t) { db.run('DELETE FROM meta WHERE k=?', metaKey(t)); db.run('DELETE FROM meta WHERE k=?', errKey(t)); }
function lastError(t) { const r = db.get('SELECT v FROM meta WHERE k=?', errKey(t)); return r ? JSON.parse(r.v) : null; }
function status(t) {
  const c = config(t), p = c && PROVIDERS[c.provider];
  return { configured: !!c, provider: c?.provider || null, provider_label: p?.label || null, model: p ? process.env.AEGIS_LLM_MODEL || p.model : null, source: c?.source || null, key_hint: c ? `••••${c.key.slice(-4)}` : null, reads_scanned_pdf: !!p?.pdf, approved_by: c?.approved_by || null, approved_at: c?.approved_at || null, last_error: lastError(t), providers: Object.entries(PROVIDERS).map(([key, v]) => ({ key, label: v.label })) };
}
module.exports = { PROVIDERS, enabled, supportsPdf, callTool, test, save, remove, status, lastError };
