// 🍳 דף המטבח לאנשי המטבח — בלי גוגל: שם + סיסמה (שהמנהל נתן). רואים ועובדים רק על מלאי המטבח, על אותו גיליון של הישיבה.
import { CONFIG } from '../config.js?v=653';
import { initKitchen, renderKitchen } from './kitchen.js?v=696';
import { initTheme } from './theme.js?v=696';

const KEY = document.body.dataset.mosad || 'yeshiva';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = (v) => String(v ?? '').trim();
const SK = `kitchen:${KEY}`;
const store = { get() { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch { return null; } }, set(v) { try { if (v) localStorage.setItem(SK, JSON.stringify(v)); else localStorage.removeItem(SK); } catch { /* */ } } };
const ERR = { 'k-bad': 'סיסמה לא נכונה.', 'k-locked': 'יותר מדי ניסיונות. נסה שוב בעוד 10 דקות.', 'k-login': 'צריך להיכנס מחדש.', 'need-text': 'חסר שם.', 'bad-action': 'השרת עוד לא עודכן.' };
const msg = (e) => ERR[e?.message] || String(e?.message || e || 'שגיאה');

function toast(text, kind = '') {
  const t = $('#ms-toast'); t.textContent = text; t.className = `ms-toast ${kind}`; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => { t.hidden = true; }, 3500);
}
function dialog(html) {
  const d = document.createElement('dialog'); d.className = 'sheet ms-dlg';
  d.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button>${html}`;
  document.body.append(d); d.addEventListener('close', () => d.remove());
  $$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  d.showModal(); return d;
}
async function post(body) {
  const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, mosad: KEY }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}
// דאס זעלבע "call" ווי אינעם אתר — אבער דורך kAct מיט דער סעסיע
const OPS = { kitchen: (b) => ({ op: 'read' }), kitchenSave: (b) => ({ op: 'stock', id: b.row?.product_id, value: b.row?.current_stock }), kitchenOrder: (b) => ({ op: 'order', ...b }), kitchenReceive: (b) => ({ op: 'receive', id: b.id }), kitchenRequest: (b) => ({ op: 'request', ...b }), kitchenEventSave: (b) => ({ op: 'event', ...b }) };
async function call(_k, action, body = {}) {
  const s = store.get();
  if (!OPS[action]) throw new Error('bad-action');
  try { return await post({ action: 'kAct', ks: s?.token, ...OPS[action](body) }); } catch (err) { if (err.message === 'k-login') { store.set(null); login(); } throw err; }
}
const X = { KEY, st: { mosad: { name: 'ישיבת בית שערים' } }, $, $$, h, S, dialog, toast, msg, call, can: () => false, printWin: (title, sub, body) => {
  const w = window.open('', '_blank'); if (!w) return;
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${h(title)}</title><style>body{font-family:Arial;margin:12mm}table{border-collapse:collapse;width:100%;margin-bottom:8mm}th,td{border:1px solid #999;padding:4px 6px}</style></head><body><h2>${h(title)}</h2><p>${sub}</p>${body}<script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
} };

async function login() {
  const app = $('#ms-app');
  app.innerHTML = '<div class="ms-login"><p class="muted">טוען…</p></div>';
  let names = []; let mosad = '';
  try { const r = await post({ action: 'kNames' }); names = r.names || []; mosad = r.mosad || ''; } catch (err) { app.innerHTML = `<div class="ms-login"><p class="ms-note err">${h(msg(err))}</p></div>`; return; }
  if (mosad) X.st.mosad.name = mosad;
  app.innerHTML = `<form class="ms-login" id="kl">
      <img src="../../img/mosad/yeshiva/logo.png" alt="" class="ms-logo">
      <h1>🍳 מלאי המטבח</h1><p class="muted">${h(mosad)}</p>
      ${names.length ? `<label>שם<select name="id" required><option value="">— בחר —</option>${names.map((n) => `<option value="${h(n.id)}">${h(n.name)}</option>`).join('')}</select></label>
      <label>סיסמה<input name="password" type="password" required autocomplete="current-password" dir="ltr"></label>
      <button type="submit" class="btn primary">כניסה</button>` : '<p class="ms-note">עוד לא הוגדרו אנשי מטבח. המנהל מגדיר אותם באתר הישיבה → 🍳 מלאי המטבח → 🔑 אנשי המטבח.</p>'}
    </form>`;
  const f = $('#kl');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = $('button[type=submit]', f); b.disabled = true;
    try { const r = await post({ action: 'kLogin', id: f.elements.id.value, password: f.elements.password.value }); store.set({ token: r.token, name: r.name }); start(); } catch (err) { b.disabled = false; toast(msg(err), 'err'); }
  };
}
function start() {
  const s = store.get();
  if (!s?.token) { login(); return; }
  const app = $('#ms-app');
  app.innerHTML = `<header class="ms-top" style="display:flex;align-items:center;gap:10px;padding:8px 16px"><b>🍳 ${h(X.st.mosad.name)}</b><span style="flex:1"></span><span class="muted small">👤 ${h(s.name)}</span><span id="th-slot"></span><button type="button" class="btn small-btn" id="k-out">יציאה</button></header><main id="ms-main" style="padding:0 16px 24px"></main>`;
  initTheme($('#th-slot'));
  $('#k-out').onclick = () => { store.set(null); login(); };
  initKitchen(X);
  renderKitchen($('#ms-main'));
}
initTheme(null);
start();
