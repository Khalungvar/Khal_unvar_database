// 🔄 עדכון "נשי אונגוואר" לויט א רשימת דיוור (אקסל): ווער עס איז אויף דער רשימה — נשי; ווער נישט — נישט.
// מ'פארגלייכט יעדע שורה מיט די קאנטאקטן (נאמען, אדרעס, טעלעפאן). נאר זיכערע התאמות ווערן געטוישט;
// א דוח (אקסל): פרטים וואס זענען אנדערש, וואס איז נישט געפונען, און וואס איז נישט זיכער.
import { state, loadAll, NESHEI_ORG, bulkSetContactFields, ADDR_FIELDS } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, isTrue, nowStamp } from './util.js';
import { readXlsx } from './import.js';
import { downloadXlsx } from './excel.js';
import { memberOrgs, isFormerOf } from './scope.js';
import { storedTags, serialize, hasRealTags, roots } from './tags.js';

const $ = (sel, root = document) => root.querySelector(sel);
let ui = null;
export function initListSync(helpers) { ui = helpers; }

// ---------- נארמאליזירן ----------
const low = (v) => String(v ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const letters = (v) => low(v).replace(/[^a-zא-ת]/g, '');
const tokens = (v) => low(v).split(/[^a-zא-ת]+/).filter((x) => x.length > 1);
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const zip5 = (v) => { const d = digits(v); return d ? d.slice(0, 5).padStart(5, '0') : ''; };
const ph7 = (v) => { const d = digits(v); return d.length >= 7 ? d.slice(-7) : ''; };
const WORDS = { street: 'st', avenue: 'ave', av: 'ave', road: 'rd', drive: 'dr', boulevard: 'blvd', place: 'pl', court: 'ct', lane: 'ln', terrace: 'ter', parkway: 'pkwy', east: 'e', west: 'w', north: 'n', south: 's' };
/** "1246 45th St #3" → { num: '1246', street: '45 st', apt: '3' } */
function addr(v) {
  let s = low(v).replace(/[.,]/g, ' ');
  let apt = '';
  const m = s.match(/(?:#|\bapt\.?|\bunit|\bsuite|\bfl(?:oor)?)\s*([a-z0-9-]+)/);
  if (m) { apt = m[1]; s = s.slice(0, m.index); }
  const w = s.split(/\s+/).filter(Boolean).map((x) => WORDS[x] || x.replace(/^(\d+)(st|nd|rd|th)$/, '$1'));
  const num = /^\d+[a-z]?$/.test(w[0] || '') ? w.shift() : '';
  return { num, street: w.join(' '), apt, full: [num, ...w].join(' ') };
}

// ---------- די קאלאנעס פון דער רשימה ----------
const COLS = {
  phone: /phone|tel|טלפון|טעלעפאן/i,
  last: /^l(ast)?_?name$|lname|surname|משפחה|פאמיליע/i,
  first: /m_friend|husband|^f(irst)?_?name$|^first|פרטי/i,
  wife: /f_fname|wife|אשה|ווייב/i,
  address: /^(?!.*e-?mail).*addr|כתובת|אדרעס/i, // נישט "Email Address"
  city: /city|עיר|שטאט/i,
  state: /^st(ate)?$|מדינה/i,
  zip: /zip|מיקוד/i,
};
function mapCols(head) {
  const out = {};
  head.forEach((hd, i) => {
    const s = String(hd || '').trim();
    // F_FNAME = די ווייב (פריער), נישט דער "ערשטער נאמען"
    if (COLS.wife.test(s) && out.wife == null) { out.wife = i; return; }
    Object.entries(COLS).forEach(([k, re]) => { if (k !== 'wife' && out[k] == null && re.test(s)) out[k] = i; });
  });
  return out;
}

// ---------- פארגלייכן ----------
function contactInfo(c) {
  const p = state.phones.get(String(c.contact_id)) || {};
  return {
    c,
    last: letters(c.last_name_en),
    firsts: [...tokens(c.first_name_en), ...tokens(c.legal_first_name)],
    wife: tokens(c.wife_name_en),
    a: addr(c.address),
    zip: zip5(c.zip),
    phones: ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].map((k) => ph7(p[k])).filter(Boolean),
  };
}
function score(r, k) {
  let s = 0; const why = [];
  const lastOk = r.last && r.last === k.last;
  if (lastOk) { s += 4; why.push('last'); }
  if (r.first.length && k.firsts.some((x) => r.first.includes(x))) { s += 2; why.push('first'); }
  if (r.wife.length && k.wife.some((x) => r.wife.includes(x))) { s += 2; why.push('wife'); }
  if (r.a.num && r.a.num === k.a.num && r.a.street && r.a.street === k.a.street) { s += 4; why.push('addr'); } else if (r.a.num && r.a.num === k.a.num && r.zip && r.zip === k.zip) { s += 2; why.push('num+zip'); }
  if (r.zip && r.zip === k.zip) s += 1;
  if (r.phone && k.phones.includes(r.phone)) { s += 4; why.push('phone'); }
  // אן דעם זעלבן פאמיליע נאמען (אדער טעלעפאן) — נישט קיין התאמה
  if (!lastOk && !why.includes('phone')) return { s: 0, why };
  return { s, why };
}
export const isNeshei = (c) => memberOrgs(c, 'organization').includes(NESHEI_ORG) && !isFormerOf(c, 'organization', NESHEI_ORG);

function analyze(rows) {
  const head = rows[0] || [];
  const cm = mapCols(head);
  const pool = state.contacts.map(contactInfo);
  const byLast = new Map();
  pool.forEach((k) => { if (!byLast.has(k.last)) byLast.set(k.last, []); byLast.get(k.last).push(k); });
  const byPhone = new Map();
  pool.forEach((k) => k.phones.forEach((p) => { if (!byPhone.has(p)) byPhone.set(p, []); byPhone.get(p).push(k); }));
  const get = (row, k) => (cm[k] == null ? '' : String(row[cm[k]] ?? '').trim());
  const res = [];
  rows.slice(1).forEach((row, i) => {
    if (!row.some((x) => String(x ?? '').trim())) return;
    const r = {
      n: i + 2, raw: { phone: get(row, 'phone'), last: get(row, 'last'), first: get(row, 'first'), wife: get(row, 'wife'), address: get(row, 'address'), city: get(row, 'city'), state: get(row, 'state'), zip: get(row, 'zip') },
    };
    Object.assign(r, { last: letters(r.raw.last), first: tokens(r.raw.first), wife: tokens(r.raw.wife), a: addr(r.raw.address), zip: zip5(r.raw.zip), phone: ph7(r.raw.phone) });
    const cands = new Set([...(byLast.get(r.last) || []), ...(r.phone ? byPhone.get(r.phone) || [] : [])]);
    const scored = [...cands].map((k) => ({ k, ...score(r, k) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const [b1, b2] = scored;
    if (b1 && b1.s >= 8 && (!b2 || b2.s <= b1.s - 3)) r.kind = 'ok';
    else if (b1 && b1.s >= 5) r.kind = 'unsure';
    else r.kind = 'missing';
    r.best = b1 || null;
    r.cands = scored.slice(0, 4);
    res.push(r);
  });
  // דער זעלבער קאנטאקט פאר צוויי שורות → ביידע נישט זיכער
  const seen = new Map();
  res.filter((r) => r.kind === 'ok').forEach((r) => { const id = String(r.best.k.c.contact_id); if (seen.has(id)) { r.kind = 'unsure'; seen.get(id).kind = 'unsure'; } else seen.set(id, r); });
  // וואס איז אנדערש ביי די זיכערע
  res.filter((r) => r.kind === 'ok').forEach((r) => {
    const k = r.best.k; const c = k.c; const d = [];
    if (r.a.full && r.a.full !== k.a.full) d.push(['address', r.raw.address, c.address]);
    else if (r.a.apt && r.a.apt !== k.a.apt) d.push(['address', r.raw.address, c.address]);
    if (r.zip && r.zip !== k.zip) d.push(['zip', r.raw.zip, c.zip]);
    if (r.raw.city && low(r.raw.city) !== low(c.city)) d.push(['city', r.raw.city, c.city]);
    if (r.raw.state && low(r.raw.state) !== low(c.state)) d.push(['state', r.raw.state, c.state]);
    if (r.first.length && !k.firsts.some((x) => r.first.includes(x))) d.push(['first_name_en', r.raw.first, c.first_name_en]);
    if (r.wife.length && !k.wife.some((x) => r.wife.includes(x))) d.push(['wife_name_en', r.raw.wife, c.wife_name_en]);
    if (r.phone && !k.phones.includes(r.phone)) d.push(['phone', r.raw.phone, k.phones.length ? '…' : '']);
    r.diffs = d;
  });
  const okIds = new Set(res.filter((r) => r.kind === 'ok').map((r) => String(r.best.k.c.contact_id)));
  const unsureIds = new Set(res.filter((r) => r.kind === 'unsure').flatMap((r) => r.cands.map((x) => String(x.k.c.contact_id))));
  const add = res.filter((r) => r.kind === 'ok' && !isNeshei(r.best.k.c)).map((r) => r.best.k.c);
  const remove = state.contacts.filter((c) => isNeshei(c) && !okIds.has(String(c.contact_id)) && !unsureIds.has(String(c.contact_id)));
  const keepUnsure = state.contacts.filter((c) => isNeshei(c) && !okIds.has(String(c.contact_id)) && unsureIds.has(String(c.contact_id)));
  return { res, add, remove, keepUnsure, cols: cm, already: res.filter((r) => r.kind === 'ok').length - add.length };
}

// ---------- טוישן ----------
function nesheiSet(c, on) {
  const set = { wife_in_neshei: on ? 'TRUE' : 'FALSE' };
  const list = storedTags(c);
  const key = `o:${NESHEI_ORG}`;
  const e = list.find((x) => x.p.includes(key));
  const today = nowStamp().slice(0, 10);
  if (e) {
    const want = on ? 'a' : 'f';
    if (e.s !== want) { e.s = want; e.d = today; delete e.o; set.tags = serialize(list); }
  } else if (on && hasRealTags(c)) {
    const root = roots().find((r) => r.kind === 'orgs:organization');
    if (root) { list.push({ p: [String(root.id), key], s: 'a', d: today }); set.tags = serialize(list); }
  }
  return { c, set };
}

// ---------- דער דוח ----------
const FIELD = { address: 'כתובת', zip: 'מיקוד', city: 'עיר', state: 'מדינה', first_name_en: 'שם פרטי (אנגלית)', wife_name_en: 'שם האשה (אנגלית)', phone: 'טלפון' };
function reportRows(A) {
  const nm = (c) => (c ? ui.fullNameHe(c) : '');
  const en = (c) => (c ? [c.first_name_en, c.last_name_en].filter(Boolean).join(' ') : '');
  const ad = (c) => (c ? [c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') : '');
  const lst = (r) => [r.raw.first, r.raw.wife ? `& ${r.raw.wife}` : '', r.raw.last].filter(Boolean).join(' ');
  const lad = (r) => [r.raw.address, r.raw.city, r.raw.state, r.raw.zip].filter(Boolean).join(', ');
  const out = [];
  A.res.filter((r) => r.kind === 'ok' && r.diffs.length).forEach((r) => r.diffs.forEach(([f, a, b]) => {
    out.push(['✏️ שונה', r.n, lst(r), lad(r), r.raw.phone, r.best.k.c.contact_id, nm(r.best.k.c), FIELD[f] || f, a, b ?? '']);
  }));
  A.res.filter((r) => r.kind === 'missing').forEach((r) => out.push(['❓ לא נמצא', r.n, lst(r), lad(r), r.raw.phone, '', '', '', '', '']));
  A.res.filter((r) => r.kind === 'unsure').forEach((r) => out.push(['🤔 לא בטוח', r.n, lst(r), lad(r), r.raw.phone, r.cands.map((x) => x.k.c.contact_id).join(', '),
    r.cands.map((x) => `${nm(x.k.c)} (${en(x.k.c)} · ${ad(x.k.c)})`).join(' | '), '', '', '']));
  A.keepUnsure.forEach((c) => out.push(['🤔 נשי — לא שונה (לא בטוח)', '', '', '', '', c.contact_id, nm(c), '', '', ad(c)]));
  return out;
}
const REPORT_HEAD = ['סוג', 'שורה ברשימה', 'שם ברשימה', 'כתובת ברשימה', 'טלפון ברשימה', 'ID במאגר', 'שם במאגר', 'מה שונה', 'ברשימה', 'במאגר'];

// ---------- דער דיאלאג ----------
export function openListSync() {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet wide ls-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>🔄 ${h(t('lsTitle'))}</h2>
    <p class="muted small">${h(t('lsHint'))}</p>
    <label class="btn primary">📄 ${h(t('lsPick'))}<input type="file" id="ls-file" accept=".xlsx,.csv" hidden></label>
    <div id="ls-out"></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`;
  dlg.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => dlg.close(); });
  let A = null; let fileName = '';
  $('#ls-file', dlg).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    fileName = f.name.replace(/\.[^.]+$/, '');
    const out = $('#ls-out', dlg);
    try {
      const rows = await readXlsx(f);
      A = analyze(rows);
    } catch (err) { out.innerHTML = `<p class="fc-msg err">${h(ui.friendlyError(err))}</p>`; return; }
    const n = (k) => A.res.filter((r) => r.kind === k).length;
    const diffs = A.res.filter((r) => r.kind === 'ok' && r.diffs.length).length;
    const missingCols = ['last', 'address'].filter((k) => A.cols[k] == null);
    out.innerHTML = `${missingCols.length ? `<p class="fc-msg err">⚠ ${h(t('lsColsMissing'))}</p>` : ''}
      <table class="ls-sum no-sort"><tbody>
        <tr><td>📋 ${h(t('lsRows'))}</td><td><b>${A.res.length}</b></td></tr>
        <tr><td>✅ ${h(t('lsAlready'))}</td><td><b>${A.already}</b></td></tr>
        <tr class="ls-act"><td>➕ ${h(t('lsAdd'))}</td><td><b>${A.add.length}</b></td></tr>
        <tr class="ls-act"><td>➖ ${h(t('lsRemove'))}</td><td><b>${A.remove.length}</b></td></tr>
        <tr><td>✏️ ${h(t('lsDiffs'))}</td><td><b>${diffs}</b></td></tr>
        <tr><td>❓ ${h(t('lsMissing'))}</td><td><b>${n('missing')}</b></td></tr>
        <tr><td>🤔 ${h(t('lsUnsure'))}</td><td><b>${n('unsure')}</b>${A.keepUnsure.length ? ` <span class="muted small">(${h(t('lsKeptUnsure', { n: A.keepUnsure.length }))})</span>` : ''}</td></tr>
      </tbody></table>
      ${A.remove.length ? `<details class="ls-det"><summary>➖ ${h(t('lsRemoveWho'))}</summary><p class="small">${A.remove.map((c) => h(ui.fullNameHe(c))).join(' · ')}</p></details>` : ''}
      <div class="fc-row">
        <button type="button" class="btn" id="ls-rep">⬇ ${h(t('lsReport'))}</button>
        <span class="spacer"></span>
        <button type="button" class="btn primary" id="ls-go"${A.add.length || A.remove.length ? '' : ' disabled'}>✓ ${h(t('lsApply', { a: A.add.length, r: A.remove.length }))}</button>
      </div><div id="ls-msg" class="fc-msg"></div>`;
    $('#ls-rep', dlg).onclick = () => downloadXlsx(`${fileName} - דוח`, REPORT_HEAD, reportRows(A), { sheet: 'report' });
    $('#ls-go', dlg).onclick = async () => {
      if (!confirm(t('lsApplyAsk', { a: A.add.length, r: A.remove.length }))) return;
      const btn = $('#ls-go', dlg); btn.disabled = true;
      try {
        const ch = [...A.add.map((c) => nesheiSet(c, true)), ...A.remove.map((c) => nesheiSet(c, false))];
        await bulkSetContactFields(ch, `${NESHEI_ORG} · ${fileName}`);
        await loadAll();
        ui.refreshAll?.();
        $('#ls-msg', dlg).textContent = t('lsDone', { a: A.add.length, r: A.remove.length });
        $('#ls-msg', dlg).className = 'fc-msg ok';
      } catch (err) { btn.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
    };
  };
  dlg.showModal();
}

// ---------- "גר אצל": בחורים וואס וואוינען ביי דעם טאטן — אויף איינמאל ----------
const isAliveC = (c) => !['false', 'FALSE', false].includes(c.is_alive);
function fatherOf(c) {
  const id = String(c.contact_id);
  const r = state.relations.find((x) => String(x.contact_id_a) === id && x.relation_type === 'זון פון')
    || state.relations.find((x) => String(x.contact_id_b) === id && x.relation_type === 'טאטע פון');
  if (!r) return null;
  const fid = String(r.contact_id_a) === id ? r.contact_id_b : r.contact_id_a;
  return state.contacts.find((x) => String(x.contact_id) === String(fid)) || null;
}
/** די קאנדידאטן: א בחור מיט א טאטן אין מאגר, וואס איז נאך נישט "גר אצל" */
export function livesWithCandidates() {
  return state.contacts.filter((c) => c.marital_status === 'בחור' && isAliveC(c) && !String(c.lives_with || '').trim())
    .map((c) => {
      const f = fatherOf(c);
      if (!f || !isAliveC(f) || String(f.lives_with || '').trim() === String(c.contact_id)) return null;
      const mine = addr(c.address).full; const his = addr(f.address).full;
      const kind = !String(c.address || '').trim() ? 'empty'
        : (mine && mine === his && (!zip5(c.zip) || !zip5(f.zip) || zip5(c.zip) === zip5(f.zip))) ? 'same' : 'diff';
      return { c, f, kind };
    }).filter(Boolean)
    .sort((a, b) => ({ same: 0, empty: 1, diff: 2 }[a.kind] - { same: 0, empty: 1, diff: 2 }[b.kind]));
}
export function openLivesWithTool() {
  const list = livesWithCandidates();
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet wide ls-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const adr = (x) => [x.address, x.city, x.zip].filter(Boolean).join(', ');
  const KL = { same: t('lwtSame'), empty: t('lwtEmpty'), diff: t('lwtDiff') };
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>🏠 ${h(t('lwtTitle'))}</h2>
    <p class="muted small">${h(t('lwtHint'))}</p>
    ${list.length ? `<p><label class="check"><input type="checkbox" id="lwt-all"> ${h(t('lwtAll'))}</label> · <b id="lwt-n"></b></p>
    <div class="ls-table-wrap"><table class="ls-table"><thead><tr><th></th><th>${h(t('lwtBochur'))}</th><th>${h(t('lwtFather'))}</th><th>${h(t('lwtNow'))}</th><th>${h(t('lwtFatherAddr'))}</th></tr></thead>
    <tbody>${list.map((r, i) => `<tr class="lwt-${r.kind}"><td><input type="checkbox" data-i="${i}" ${r.kind !== 'diff' ? 'checked' : ''}></td>
      <td>${h(ui.fullNameHe(r.c))} <span class="muted small">#${h(r.c.contact_id)}</span></td><td>${h(ui.fullNameHe(r.f))}</td>
      <td dir="ltr" class="small">${r.kind === 'empty' ? `<span class="muted">${h(KL.empty)}</span>` : h(adr(r.c))}${r.kind === 'diff' ? ` <b class="lwt-tag">${h(KL.diff)}</b>` : ''}</td>
      <td dir="ltr" class="small">${h(adr(r.f)) || '—'}</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="fc-msg">${h(t('lwtNone'))}</p>`}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('close'))}</button>
    ${list.length ? `<button type="button" class="btn primary" id="lwt-go">${h(t('lwtGo'))}</button>` : ''}</div>`;
  dlg.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => dlg.close(); });
  dlg.showModal();
  if (!list.length) return;
  const boxes = [...dlg.querySelectorAll('input[data-i]')];
  const count = () => { $('#lwt-n', dlg).textContent = t('lwtN', { n: boxes.filter((b) => b.checked).length }); };
  dlg.addEventListener('change', count);
  $('#lwt-all', dlg).onchange = (e) => { boxes.forEach((b) => { b.checked = e.target.checked; }); count(); };
  count();
  $('#lwt-go', dlg).onclick = async (e) => {
    const pick = boxes.filter((b) => b.checked).map((b) => list[Number(b.dataset.i)]);
    if (!pick.length) return;
    e.target.disabled = true; e.target.textContent = t('saving');
    try {
      await bulkSetContactFields(pick.map(({ c, f }) => ({ c, set: { lives_with: String(f.contact_id), ...Object.fromEntries(ADDR_FIELDS.map((k) => [k, f[k] ?? ''])) } })), 'lives with father');
      ui.toast(t('lwtDone', { n: pick.length }));
      dlg.close();
      await loadAll();
      ui.refreshAll?.();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); e.target.disabled = false; e.target.textContent = t('lwtGo'); }
  };
}
