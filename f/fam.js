// 👨‍👩‍👦 דף משפחה ציבורי: ungvar.org/f/<כתובת> (צפייה) או ungvar.org/f/<כתובת>-<קוד> (עריכה). בלי כניסה.
import { suggest, details, placesEnabled } from '/js/places.js';

const API = 'https://script.google.com/macros/s/AKfycbzK63Qd9P3Gb-255-gVFGvqkF_NddBjJ9i5yHKrnaK_E8PwLsB_7WDO6Lh2iyqO1vPZ/exec';
const T = {
  he: { dir: 'rtl', loading: 'טוען…', notFound: 'הדף לא נמצא.', people: '{n} אנשים',
    introView: 'זו רשימת המשפחה כפי שהיא רשומה אצלנו.',
    introEdit: 'אנא עברו על הרשימה. אפשר לתקן שמות, כתובות וטלפונים, להוסיף ילדים וחתנים שחסרים, ולהוריד מי שלא שייך. בסיום לחצו "💾 שמירה".',
    s: 'בן', h: 'חתן', wife: 'אשתו', edit: '✏ תיקון', del: '✕ לא שייך', add: '➕ הוספת ילד / חתן', undo: '↩ ביטול', ok: '✓ אישור', cancel: 'ביטול',
    t: 'תואר', f: 'שם פרטי', l: 'שם משפחה', w: 'שם האשה', a: 'כתובת', city: 'עיר', st: 'מדינה', zip: 'מיקוד', m: 'טלפון', e: 'אימייל', rel: 'הוא',
    removed: 'יוסר', added: 'חדש', changed: 'תוקן',
    who: 'מי ממלא?', whoName: 'שם', whoPhone: 'טלפון', save: '💾 שמירה', saving: 'שומר…',
    pending: '{n} שינויים שעוד לא נשמרו', none: 'אין עדיין שינויים', saved: '✓ נשמר — תודה רבה!',
    errWho: 'נא למלא שם וטלפון', err: 'משהו השתבש, נסו שוב', busy: 'יותר מדי פעמים, נסו מאוחר יותר',
    leave: 'יש שינויים שעוד לא נשמרו' },
  en: { dir: 'ltr', loading: 'Loading…', notFound: 'Page not found.', people: '{n} people',
    introView: 'This is the family list as we have it.',
    introEdit: 'Please review the list. You can fix names, addresses and phones, add missing children and sons-in-law, and remove anyone who doesn\'t belong. When done, press "💾 Save".',
    s: 'Son', h: 'Son-in-law', wife: 'Wife', edit: '✏ Edit', del: '✕ Remove', add: '➕ Add child / son-in-law', undo: '↩ Undo', ok: '✓ OK', cancel: 'Cancel',
    t: 'Title', f: 'First name', l: 'Last name', w: "Wife's name", a: 'Address', city: 'City', st: 'State', zip: 'ZIP', m: 'Phone', e: 'Email', rel: 'He is a',
    removed: 'Will be removed', added: 'New', changed: 'Edited',
    who: "Who's filling this in?", whoName: 'Name', whoPhone: 'Phone', save: '💾 Save', saving: 'Saving…',
    pending: '{n} unsaved changes', none: 'No changes yet', saved: '✓ Saved — thank you!',
    errWho: 'Please enter your name and phone', err: 'Something went wrong, please try again', busy: 'Too many tries, please try later',
    leave: 'You have unsaved changes' },
};
const FIELDS = ['t', 'f', 'l', 'w', 'a', 'city', 'st', 'zip', 'm', 'e'];
const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
let lang = ['he', 'en'].includes(store.get('famLang')) ? store.get('famLang') : 'he';
const tr = (k, v = {}) => String(T[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);

const slug = (() => {
  const m = location.pathname.match(/^\/f\/([^/?#]+)/);
  return decodeURIComponent((m && m[1]) || new URLSearchParams(location.search).get('s') || '').trim().toLowerCase();
})();
let data = null; // { name, mode, people }
let edits = {}; // key → { field: value }
let dels = new Set();
let adds = []; // { temp, parent, rel, fields }
let open = null; // { kind: 'edit'|'add', key }
let msg = '';
const root = () => $('#fam');

async function api(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
const nPending = () => Object.keys(edits).length + dels.size + adds.length;
const nameOf = (x) => [x.t, x.f || x.fe, x.l || x.le].filter(Boolean).join(' ');
const val = (x, f) => (edits[x.k] && f in edits[x.k] ? edits[x.k][f] : x[f] || '');

function tree() {
  const all = [...data.people, ...adds.map((a) => ({ k: a.temp, ...a.fields, p: a.parent, r: a.rel, _new: 1 }))];
  const keys = new Set(all.map((x) => String(x.k)));
  const kids = new Map();
  const roots = [];
  all.forEach((x) => { const p = x.p && keys.has(String(x.p)) && String(x.p) !== String(x.k) ? String(x.p) : ''; if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(x); } else roots.push(x); });
  roots.sort((a, b) => (b.hd || 0) - (a.hd || 0));
  return { roots, kids };
}
function fieldsHtml(x, isNew) {
  const fs = FIELDS.filter((f) => !(f === 't' && x.x));
  return `<div class="ff-grid">${fs.map((f) => `<label class="ff-${f}"><span>${h(tr(f))}</span>
    <input data-f="${f}" value="${h(isNew ? '' : val(x, f))}" ${['m', 'e', 'zip'].includes(f) ? 'dir="ltr"' : ''} ${f === 'm' ? 'type="tel"' : f === 'e' ? 'type="email"' : ''} autocomplete="off">
    ${f === 'a' ? '<div class="ff-sugg" hidden></div>' : ''}</label>`).join('')}</div>`;
}
function personHtml(x, kids, seen, depth) {
  if (seen.has(String(x.k))) return '';
  seen.add(String(x.k));
  const edit = data.mode === 'edit';
  const gone = dels.has(String(x.k));
  const ch = edits[x.k] && Object.keys(edits[x.k]).length;
  const w = val(x, 'w'); const city = val(x, 'city');
  const shown = { ...x, ...(edits[x.k] || {}) };
  const isOpen = open && String(open.key) === String(x.k);
  const sub = (kids.get(String(x.k)) || []).map((y) => personHtml(y, kids, seen, depth + 1)).join('');
  return `<li class="fp${gone ? ' gone' : ''}${x._new ? ' new' : ''}${ch ? ' changed' : ''}${x.hd ? ' head' : ''}">
    <div class="fp-row">
      <div class="fp-name">${x.r ? `<span class="fp-rel">${h(tr(x.r === 'h' ? 'h' : 's'))}</span>` : ''}<b>${h(nameOf(shown))}</b>${x.d ? ' <span class="muted">ז"ל</span>' : ''}
        ${w ? `<span class="fp-wife">· ${h(tr('wife'))}: ${h(w)}</span>` : ''}${city ? `<span class="fp-city">· ${h(city)}</span>` : ''}
        ${gone ? `<span class="fp-tag bad">${h(tr('removed'))}</span>` : x._new ? `<span class="fp-tag new">${h(tr('added'))}</span>` : ch ? `<span class="fp-tag ok">${h(tr('changed'))}</span>` : ''}
        ${edit && !x._new && (val(x, 'a') || val(x, 'm')) ? `<div class="fp-more muted">${h([val(x, 'a'), val(x, 'm'), val(x, 'e')].filter(Boolean).join(' · '))}</div>` : ''}</div>
      ${edit ? `<div class="fp-acts">${gone ? `<button type="button" data-undel="${h(x.k)}">${h(tr('undo'))}</button>`
        : x._new ? `<button type="button" data-unadd="${h(x.k)}">${h(tr('undo'))}</button>`
        : `<button type="button" data-edit="${h(x.k)}">${h(tr('edit'))}</button>${ch ? `<button type="button" data-unedit="${h(x.k)}">${h(tr('undo'))}</button>` : ''}<button type="button" data-del="${h(x.k)}">${h(tr('del'))}</button>`}</div>` : ''}
    </div>
    ${isOpen && open.kind === 'edit' ? `<form class="fp-form" data-for="${h(x.k)}">${fieldsHtml(x)}<div class="fp-formacts"><button type="submit" class="pri">${h(tr('ok'))}</button><button type="button" data-close>${h(tr('cancel'))}</button></div></form>` : ''}
    ${(sub || (edit && !gone)) ? `<ul>${sub}
      ${edit && !gone ? (isOpen && open.kind === 'add' ? `<li class="fp-addli"><form class="fp-form" data-add="${h(x.k)}">
          <label class="ff-rel"><span>${h(tr('rel'))}</span><select data-f="rel"><option value="s">${h(tr('s'))}</option><option value="h">${h(tr('h'))}</option></select></label>
          ${fieldsHtml({}, true)}<div class="fp-formacts"><button type="submit" class="pri">${h(tr('ok'))}</button><button type="button" data-close>${h(tr('cancel'))}</button></div></form></li>`
        : `<li class="fp-addli"><button type="button" class="fp-addbtn" data-add="${h(x.k)}">${h(tr('add'))}</button></li>`) : ''}</ul>` : ''}
  </li>`;
}
function render() {
  const el = root();
  document.documentElement.lang = lang;
  document.documentElement.dir = T[lang].dir;
  const langs = `<div class="fam-langs">${[['he', 'עברית'], ['en', 'English']].map(([k, l]) => `<button type="button" data-lang="${k}" class="${lang === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (!data) { el.innerHTML = `${langs}<p class="fam-msg">${h(msg || tr('loading'))}</p>`; return; }
  const { roots, kids } = tree();
  const seen = new Set();
  const edit = data.mode === 'edit';
  const n = nPending();
  el.innerHTML = `${langs}
    <header class="fam-head"><h1>${h(data.name)}</h1><p class="muted">${h(tr('people', { n: data.people.length }))}</p>
      <p class="fam-intro">${h(tr(edit ? 'introEdit' : 'introView'))}</p></header>
    <ul class="fam-tree">${roots.map((x) => personHtml(x, kids, seen, 0)).join('')}</ul>
    ${edit ? `<div class="fam-savebar">
      <div class="fam-who"><b>${h(tr('who'))}</b>
        <input id="who-name" placeholder="${h(tr('whoName'))}" value="${h(store.get('famWho'))}" autocomplete="name">
        <input id="who-phone" type="tel" dir="ltr" placeholder="${h(tr('whoPhone'))}" value="${h(store.get('famPhone'))}" autocomplete="tel">
        <input id="hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"></div>
      <div class="fam-savewrap"><span class="fam-pending">${h(msg || (n ? tr('pending', { n }) : tr('none')))}</span>
        <button type="button" id="fam-save" class="fam-save"${n ? '' : ' disabled'}>${h(tr('save'))}</button></div></div>` : ''}`;
  const f = el.querySelector('.fp-form input[data-f="f"]') || el.querySelector('.fp-form input');
  if (f && !f.dataset.focused) { f.focus(); f.dataset.focused = 1; }
}
function readForm(form) {
  const o = {};
  form.querySelectorAll('[data-f]').forEach((i) => { o[i.dataset.f] = i.value.trim(); });
  return o;
}
async function save() {
  const who = $('#who-name').value.trim(); const ph = $('#who-phone').value.trim();
  if (!who || ph.replace(/\D/g, '').length < 7) { msg = tr('errWho'); render(); $('#who-name').focus(); msg = ''; return; }
  store.set('famWho', who); store.set('famPhone', ph);
  const changes = [
    ...Object.entries(edits).filter(([k]) => !dels.has(k)).map(([key, fields]) => ({ kind: 'fix', key, fields })),
    ...[...dels].map((key) => ({ kind: 'del', key })),
    ...adds.map((a) => ({ kind: 'add', temp: a.temp, parent: a.parent, rel: a.rel, fields: a.fields })),
  ];
  const b = $('#fam-save'); b.disabled = true; b.textContent = tr('saving');
  try {
    const r = await api({ action: 'fam_save', slug, who_name: who, who_phone: ph, hp: $('#hp').value, changes });
    if (r.error) throw new Error(r.error);
    data.people = r.people || data.people;
    edits = {}; dels = new Set(); adds = []; open = null;
    msg = tr('saved'); render(); setTimeout(() => { msg = ''; render(); }, 6000);
  } catch (err) {
    msg = tr(err.message === 'who' ? 'errWho' : err.message === 'busy' ? 'busy' : 'err'); render(); msg = '';
  }
}
let tmpN = 0;
let suggT = null;
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) { if (!e.target.closest('.ff-sugg')) document.querySelectorAll('.ff-sugg').forEach((s) => { s.hidden = true; }); return; }
  if (b.dataset.lang) { lang = b.dataset.lang; store.set('famLang', lang); render(); return; }
  if (b.dataset.edit) { open = { kind: 'edit', key: b.dataset.edit }; render(); return; }
  if (b.dataset.add) { open = { kind: 'add', key: b.dataset.add }; render(); return; }
  if (b.hasAttribute('data-close')) { open = null; render(); return; }
  if (b.dataset.del) { dels.add(b.dataset.del); delete edits[b.dataset.del]; adds = adds.filter((a) => a.parent !== b.dataset.del); render(); return; }
  if (b.dataset.undel) { dels.delete(b.dataset.undel); render(); return; }
  if (b.dataset.unedit) { delete edits[b.dataset.unedit]; render(); return; }
  if (b.dataset.unadd) { const gone = new Set([b.dataset.unadd]); let more = true; while (more) { more = false; adds.forEach((a) => { if (gone.has(a.parent) && !gone.has(a.temp)) { gone.add(a.temp); more = true; } }); } adds = adds.filter((a) => !gone.has(a.temp)); render(); return; }
  if (b.id === 'fam-save') { save(); return; }
  if (b.dataset.pick !== undefined) {
    const box = b.closest('.ff-sugg'); const form = b.closest('form');
    const p = box._list?.[Number(b.dataset.pick)]; box.hidden = true;
    if (!p) return;
    const d = await details(p.prediction);
    const set = (f, v) => { const i = form.querySelector(`[data-f="${f}"]`); if (i && v !== undefined) i.value = v; };
    if (d) { set('a', d.address); set('city', d.city); set('st', d.state); set('zip', d.zip); } else set('a', p.text);
  }
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('.fp-form'); if (!form) return;
  e.preventDefault();
  const o = readForm(form);
  if (form.dataset.for) {
    const k = form.dataset.for; const x = data.people.find((p) => String(p.k) === k);
    const ch = {};
    Object.entries(o).forEach(([f, v]) => { if (v !== String(x[f] || '')) ch[f] = v; });
    if (Object.keys(ch).length) edits[k] = ch; else delete edits[k];
  } else if (form.dataset.add) {
    const { rel, ...fields } = o;
    if (!fields.f && !fields.l) { form.querySelector('[data-f="f"]').focus(); return; }
    tmpN += 1;
    adds.push({ temp: `n${tmpN}`, parent: form.dataset.add, rel: rel === 'h' ? 'h' : 's', fields });
  }
  open = null; render();
});
document.addEventListener('input', (e) => {
  const i = e.target;
  if (i.id === 'who-name') store.set('famWho', i.value);
  if (i.id === 'who-phone') store.set('famPhone', i.value);
  if (i.dataset.f !== 'a' || !placesEnabled()) return;
  const box = i.parentElement.querySelector('.ff-sugg');
  clearTimeout(suggT);
  suggT = setTimeout(async () => {
    const list = await suggest(i.value, ['us', 'ca', 'gb', 'il', 'be', 'at']);
    if (!Array.isArray(list) || !list.length) { box.hidden = true; return; }
    box._list = list;
    box.innerHTML = list.map((p, n) => `<button type="button" data-pick="${n}">${h(p.text)}</button>`).join('');
    box.hidden = false;
  }, 350);
});
window.addEventListener('beforeunload', (e) => { if (data?.mode === 'edit' && nPending()) { e.preventDefault(); e.returnValue = tr('leave'); } });

(async function start() {
  render();
  if (!slug) { msg = tr('notFound'); render(); return; }
  try {
    const r = await api({ action: 'fam_get', slug });
    if (r.error || !r.people) { msg = tr('notFound'); render(); return; }
    data = r; document.title = r.name; render();
  } catch { msg = tr('err'); render(); }
}());
