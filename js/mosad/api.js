// אתר פון א מוסד (למשל ישיבה): לאגאין מיט גוגל (נאר "ווער ביסטו" — קיין צוטריט צום גיליון),
// און אלע ידיעות דורכן "שומר" (Apps Script mosad.gs), וואס גיט נאר וואס מ'מעג.
import { CONFIG } from '../config.js?v=412';

const STORE = 'khal-mosad-auth';
const SCOPE = 'openid email profile';
let client = null;
let token = '';
let expiresAt = 0;
let hint = '';
let pending = null;

function save() { try { localStorage.setItem(STORE, JSON.stringify({ token, expiresAt, hint })); } catch { /* */ } }
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || '{}');
    hint = d.hint || '';
    if (d.token && d.expiresAt > Date.now() + 60_000) { token = d.token; expiresAt = d.expiresAt; }
  } catch { /* */ }
}
restore();

export const configured = () => Boolean(CONFIG.MOSAD_URL);
export const hasSession = () => Boolean(token) && expiresAt > Date.now() + 60_000;
export const rememberHint = (email) => { hint = email; save(); };

function waitGis() {
  return new Promise((res) => { const go = () => (window.google?.accounts?.oauth2 ? res() : setTimeout(go, 50)); go(); });
}
export async function initAuth() {
  await waitGis();
  client = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPE,
    callback: (r) => {
      if (r.error) pending?.reject(new Error(r.error_description || r.error));
      else {
        token = r.access_token;
        expiresAt = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        save();
        pending?.resolve(token);
      }
      pending = null;
    },
    error_callback: (err) => { pending?.reject(new Error(err?.message || err?.type || 'login failed')); pending = null; },
  });
}
export function signIn(prompt = '') {
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    client.requestAccessToken(hint && prompt !== 'select_account' ? { prompt, login_hint: hint } : { prompt });
  });
}
export function signOut() {
  try { if (token) window.google?.accounts?.oauth2?.revoke(token, () => {}); } catch { /* */ }
  token = ''; expiresAt = 0; save();
}

/** נאמען + לאגא פונעם מוסד — אן לאגאין (פארן ערשטן בלאט) */
export async function brand(mosad) {
  if (!configured()) return {};
  try {
    const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'brand', mosad }) });
    return await r.json();
  } catch { return {}; }
}

/** א קריאה צום שומר. mosad = דער שליסל (למשל "yeshiva") */
async function rawCall(mosad, action, body = {}) {
  if (!configured()) throw Object.assign(new Error('not-configured'), { code: 'not-configured' });
  if (!hasSession()) await signIn('');
  const res = await fetch(CONFIG.MOSAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // אן "preflight"
    body: JSON.stringify({ ...body, action, mosad, token }),
  });
  const j = await res.json();
  if (j.error) throw Object.assign(new Error(j.error), { code: j.error, email: j.email });
  return j;
}

// ---------- אלעס אויף איינמאל: ביים אריינקומען ווערט אלעס געלאדן מיט איין קריאה ----------
// יעדער כפתור באקומט דאן זיינע ידיעות גלייך (דאס ערשטע מאל). נאך א שרייבונג / יעדע 5 מינוט —
// ווערט ווידער געלאדן (ברקע) נאר וואס מ'האט נאך נישט גענוצט; א גענוצטע ידיעה גילט נאך 2 מינוט. נאר אין זכרון (נישט אויפן קאמפיוטער).
const READS = new Set(['me', 'people', 'school', 'gifts', 'fin', 'team', 'tasks', 'ins', 'users', 'staff', 'chav', 'att', 'hours']);
const PRE = new Map();
const used = new Set();
const keyOf = (action, body) => `${action}|${JSON.stringify(body || {})}`;
let plan = null; // { mosad, calls }
let gen = 0;
let timer = null;
export async function prefetch(mosad, calls) {
  plan = { mosad, calls };
  const g = gen;
  const todo = calls.filter((c) => !used.has(keyOf(c.action, c.params)));
  if (!todo.length) return;
  const r = await rawCall(mosad, 'batch', { calls: todo });
  if (g !== gen) return; // אין דערווייל האט מען עפעס געשריבן — אלט
  todo.forEach((c, i) => { const x = r.results?.[i]; const k = keyOf(c.action, c.params); if (x && !x.error && !used.has(k)) PRE.set(k, { v: x, t: Date.now() }); });
}
function refetchSoon(ms) {
  clearTimeout(timer);
  timer = setTimeout(() => { if (plan) prefetch(plan.mosad, plan.calls).catch(() => {}); }, ms);
}
setInterval(() => { if (plan && document.visibilityState === 'visible') refetchSoon(0); }, 5 * 60 * 1000);
export function clearPrefetch() { PRE.clear(); used.clear(); plan = null; gen += 1; }

export async function call(mosad, action, body = {}) {
  const k = keyOf(action, body);
  if (READS.has(action)) {
    used.add(k);
    // א געלאדענע ידיעה גילט 2 מינוט (ביז א שרייבונג); דערנאך — פונעם שומר
    const hit = PRE.get(k);
    if (hit && Date.now() - hit.t < 120000) return hit.v;
    PRE.delete(k);
  } else if (action !== 'brand') { gen += 1; PRE.clear(); refetchSoon(2500); }
  return rawCall(mosad, action, body);
}
