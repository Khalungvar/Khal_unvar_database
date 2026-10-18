// אריינלייגן א סך קאנטאקטן פון Excel (נאר בעל הבית, אין אדמין ← מנהלים, גבאים און צוטריט):
// 1) אראפלאדן א דוגמא-טעקע  2) אנפילן / אריינקלעבן  3) ארויפלאדן ← א פריוויו מיט פראבלעמען ← אריינלייגן.
import { state, loadAll, importContacts, addListValue } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, formatPhone, digits, normalize, detectArea, splitTags, joinTags } from './util.js';
import { downloadXlsx } from './excel.js';
import { suggestFirstName, suggestLastName, suggestHeFirstName, suggestHeLastName } from './names.js';

const $ = (sel, root = document) => root.querySelector(sel);

// [שליסל, אידיש, ענגליש, 'c' = Contacts / 'p' = Phones, דוגמא 1, דוגמא 2]
const FIELDS = [
  ['title_he', 'טיטל', 'Title (Hebrew)', 'c', 'הרב', 'ר\''],
  ['first_name_he', 'ערשטע נאמען *', 'First name (Hebrew) *', 'c', 'משה', 'יעקב'],
  ['last_name_he', 'לעצטע נאמען *', 'Last name (Hebrew) *', 'c', 'גרינוואלד', 'פריעדמאן'],
  ['title_en', 'טיטל ענגליש', 'Title (English)', 'c', 'Rabbi', 'Mr.'],
  ['first_name_en', 'ערשטע נאמען ענגליש', 'First name (English)', 'c', 'Moshe', 'Jacob'],
  ['last_name_en', 'לעצטע נאמען ענגליש', 'Last name (English)', 'c', 'Grunwald', 'Friedman'],
  ['legal_first_name', 'לעגאלער נאמען', 'Legal first name', 'c', '', 'Jack'],
  ['marital_status', 'סטאטוס', 'Marital status', 'c', 'נשוי', 'נשוי'],
  ['wife_name_he', 'פרוי\'ס נאמען', 'Wife name (Hebrew)', 'c', 'רחל', 'שרה'],
  ['wife_name_en', 'פרוי\'ס נאמען ענגליש', 'Wife name (English)', 'c', 'Rachel', 'Sarah'],
  ['address', 'אדרעס', 'Address', 'c', '1578 53rd St', '12 Forshay Rd Apt 3'],
  ['city', 'שטאט', 'City', 'c', 'Brooklyn', 'Monsey'],
  ['state', 'סטעיט', 'State', 'c', 'NY', 'NY'],
  ['zip', 'זיפ', 'ZIP', 'c', '11219', '10952'],
  ['country', 'לאנד', 'Country', 'c', '', ''],
  ['mobile', 'סעל', 'Cell', 'p', '(718) 555-0101', '845-555-0102'],
  ['home_phone', 'שטוב טעלעפאן', 'Home phone', 'p', '(718) 555-0100', ''],
  ['wife_mobile', 'פרוי\'ס סעל', 'Wife cell', 'p', '', ''],
  ['other_phone', 'נאך א טעלעפאן', 'Other phone', 'p', '', ''],
  ['email_1', 'אימעיל 1', 'Email 1', 'p', 'moshe@example.com', ''],
  ['email_2', 'אימעיל 2', 'Email 2', 'p', '', ''],
  ['beis_medrash', 'ביהמ"ד', 'Beis medrash', 'c', '', ''],
  ['kollel', 'כולל/ישיבה', 'Kollel', 'c', '', ''],
  ['organization', 'ארגון', 'Organization', 'c', '', ''],
  ['community_tags', 'טעג\'ס (מיט קאמע)', 'Tags (comma separated)', 'c', '', ''],
  ['area', 'געגנט', 'Area', 'c', '', ''],
  ['comments', 'הערות', 'Notes', 'p', '', ''],
];
const header = (f) => `${f[1]} / ${f[2]}`;

export function downloadTemplate() {
  const rows = [FIELDS.map((f) => f[4]), FIELDS.map((f) => f[5])];
  downloadXlsx(t('impTemplateName'), FIELDS.map(header), rows, { sheet: 'Contacts' });
}

// ---------- לייענען א טעקע ----------
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** א ZIP → { שם: Uint8Array } (נאר די טעקעס וואס מ'דארף) */
async function unzip(buf, want) {
  const dv = new DataView(buf);
  let eocd = buf.byteLength - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('bad-file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = {};
  for (let i = 0; i < count; i += 1) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    if (want(name)) {
      const lNameLen = dv.getUint16(local + 26, true);
      const lExtra = dv.getUint16(local + 28, true);
      const data = new Uint8Array(buf, local + 30 + lNameLen + lExtra, size);
      out[name] = method === 0 ? data : await inflateRaw(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

/** .xlsx → רשימה פון שורות (דער ערשטער בלאט) */
async function readXlsx(file) {
  const files = await unzip(await file.arrayBuffer(), (n) => /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(n));
  const dec = new TextDecoder();
  const parse = (name) => (files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml') : null);
  const shared = [...(parse('xl/sharedStrings.xml')?.getElementsByTagName('si') || [])]
    .map((si) => [...si.getElementsByTagName('t')].map((x) => x.textContent).join(''));
  // דער ערשטער בלאט אינעם ספר
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = parse('xl/workbook.xml'); const rels = parse('xl/_rels/workbook.xml.rels');
  const firstSheet = wb?.getElementsByTagName('sheet')[0];
  if (firstSheet && rels) {
    const rid = firstSheet.getAttribute('r:id') || firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = [...rels.getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid);
    if (rel) { const tg = rel.getAttribute('Target').replace(/^\//, ''); sheetPath = tg.startsWith('xl/') ? tg : `xl/${tg}`; }
  }
  const sheet = parse(sheetPath);
  if (!sheet) throw new Error('bad-file');
  return [...sheet.getElementsByTagName('row')].map((row) => {
    const out = [];
    [...row.getElementsByTagName('c')].forEach((c) => {
      const tp = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let val;
      if (tp === 's') val = shared[Number(v)] ?? '';
      else if (tp === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
      else if (tp === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
      else val = v;
      out[colIndex(c.getAttribute('r') || '')] = val;
    });
    return Array.from(out, (x) => x ?? '');
  });
}

function readCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// ---------- פון שורות צו קאנטאקטן ----------
const clean = (s) => String(s ?? '').replace(/\*/g, '').trim().toLowerCase();
function mapHeaders(head) {
  return head.map((cell) => {
    const parts = [clean(cell), ...String(cell ?? '').split('/').map(clean)];
    const f = FIELDS.find((x) => parts.some((p) => p && [x[0], clean(x[1]), clean(x[2]), clean(header(x))].includes(p)));
    return f ? f[0] : null;
  });
}

function existingIndex() {
  const names = new Map(); const phones = new Map(); const emails = new Map();
  state.contacts.forEach((c) => {
    const k = normalize(`${c.first_name_he} ${c.last_name_he}`);
    if (k.trim()) names.set(k, c.contact_id);
    const en = `${c.first_name_en || ''} ${c.last_name_en || ''}`.trim().toLowerCase();
    if (c.first_name_en && c.last_name_en) names.set(`en:${en}`, c.contact_id);
  });
  state.phones.forEach((p, id) => {
    ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].forEach((k) => { const d = digits(p[k]).slice(-10); if (d.length >= 7) phones.set(d, id); });
    ['email_1', 'email_2'].forEach((k) => { const e = String(p[k] || '').trim().toLowerCase(); if (e) emails.set(e, id); });
  });
  return { names, phones, emails };
}

/** די אדרעס פאר פארגלייכן (נאר די גאס און נומער) */
const addrKey = (c) => String(c.address || '').toLowerCase().replace(/[^a-z0-9\u0590-\u05FF]/g, '')
  .replace(/(street|st|avenue|ave|road|rd)$/, '');

/**
 * פילט אויס וואס פעלט: ענגליש ↔ אידיש (נעמען, די פרוי, טיטל). אלעס וואס איז אויטאמאטיש
 * ווערט געצייכנט אין unverified_fields — אינעם כרטיס שטייט עס גרוי "צו באשטעטיגן".
 */
function fillNames(c) {
  const auto = [];
  const set = (k, v) => { if (!c[k] && v) { c[k] = v; auto.push(k); } };
  const all = state.contacts;
  set('first_name_he', c.first_name_en && suggestHeFirstName(c.first_name_en, all));
  set('last_name_he', c.last_name_en && suggestHeLastName(c.last_name_en, all));
  set('wife_name_he', c.wife_name_en && suggestHeFirstName(c.wife_name_en, all));
  set('first_name_en', c.first_name_he && suggestFirstName(c.first_name_he, all));
  set('last_name_en', c.last_name_he && suggestLastName(c.last_name_he, all));
  set('wife_name_en', c.wife_name_he && suggestFirstName(c.wife_name_he, all));
  set('title_en', c.title_he && (state.titleHeToEn || {})[c.title_he]);
  set('title_he', c.title_en && (state.titleEnToHe || {})[c.title_en]);
  if (auto.length) c.unverified_fields = joinTags(auto);
  return auto;
}

let autoFill = true;

/** גיט צוריק [{ n (שורה), contact, phones, status: 'ok'|'dup'|'error', note }] */
function buildRows(table) {
  const nonEmpty = table.filter((r) => r.some((v) => String(v).trim()));
  if (!nonEmpty.length) return { rows: [], unknown: [] };
  const [head, ...body] = nonEmpty;
  const keys = mapHeaders(head);
  const unknown = head.filter((x, i) => String(x).trim() && !keys[i]);
  const idx = existingIndex();
  const seen = { names: new Map(), phones: new Map() };
  const rows = body.map((r, i) => {
    const contact = {}; const phones = {};
    keys.forEach((k, j) => {
      if (!k) return;
      let v = String(r[j] ?? '').trim();
      const f = FIELDS.find((x) => x[0] === k);
      if (['mobile', 'home_phone', 'wife_mobile', 'other_phone'].includes(k)) v = formatPhone(v);
      if (k === 'zip' && /^\d{3,4}$/.test(v)) v = v.padStart(5, '0'); // Excel פארלירט די נול פון פארנט
      if (k.startsWith('email')) v = v.toLowerCase();
      (f[3] === 'p' ? phones : contact)[k] = v;
    });
    // ענגליש אין די אידישע קאלומס (אדער פארקערט)? — אריבערפירן צום ריכטיגן פלאץ
    [['first_name_he', 'first_name_en'], ['last_name_he', 'last_name_en'], ['wife_name_he', 'wife_name_en'], ['title_he', 'title_en']].forEach(([he, en]) => {
      const isLatin = (v) => /[a-z]/i.test(v || '') && !/[\u0590-\u05FF]/.test(v || '');
      const isHeb = (v) => /[\u0590-\u05FF]/.test(v || '');
      if (isLatin(contact[he]) && !contact[en]) { contact[en] = contact[he]; contact[he] = ''; }
      if (isHeb(contact[en]) && !contact[he]) { contact[he] = contact[en]; contact[en] = ''; }
    });
    if (!contact.area && (contact.zip || contact.city)) contact.area = detectArea(state.areas || [], contact);
    if (autoFill) fillNames(contact);
    const out = { n: i + 2, contact, phones, status: 'ok', note: '', pick: true };
    if (!contact.first_name_he || !contact.last_name_he) { out.pick = false; out.status = 'error'; out.note = t('impNeedName'); return out; }
    if (contact.unverified_fields) out.auto = new Set(contact.unverified_fields.split(', '));
    const nk = normalize(`${contact.first_name_he} ${contact.last_name_he}`);
    const ph = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].map((k) => digits(phones[k]).slice(-10)).filter((d) => d.length >= 7);
    const em = ['email_1', 'email_2'].map((k) => phones[k]).filter(Boolean);
    const enKey = contact.first_name_en && contact.last_name_en ? `en:${contact.first_name_en} ${contact.last_name_en}`.toLowerCase() : '';
    // 1) דער זעלבער טעלעפאן / אימעיל — זיכער דער זעלבער מענטש
    const byContact = ph.map((d) => idx.phones.get(d)).find(Boolean) || em.map((e) => idx.emails.get(e)).find(Boolean);
    const myAddr = addrKey(contact);
    const remember = () => { seen.names.set(nk, { n: out.n, addr: myAddr }); ph.forEach((d) => seen.phones.set(d, out.n)); };
    if (byContact) { out.status = 'dup'; out.pick = false; out.note = t('impDupDb', { id: byContact }); return out; }
    // 2) דער זעלבער נאמען — אויב די אדרעס איז אנדערש, איז עס מסתמא אן אנדער מענטש
    const byName = idx.names.get(nk) || (enKey && idx.names.get(enKey));
    if (byName) {
      const ex = state.contacts.find((c) => String(c.contact_id) === String(byName)) || {};
      const exAddr = [ex.address, ex.city].filter(Boolean).join(', ');
      if (myAddr && addrKey(ex) && myAddr !== addrKey(ex)) {
        out.status = 'maybe'; out.pick = true; out.note = t('impMaybeDb', { id: byName, addr: exAddr }); remember(); return out;
      }
      out.status = 'dup'; out.pick = false; out.note = t('impDupName', { id: byName, addr: exAddr || '—' }); return out;
    }
    const phoneInFile = ph.map((d) => seen.phones.get(d)).find(Boolean);
    if (phoneInFile) { out.status = 'dup'; out.pick = false; out.note = t('impDupFile', { n: phoneInFile }); return out; }
    const nameInFile = seen.names.get(nk);
    if (nameInFile) {
      if (myAddr && nameInFile.addr && myAddr !== nameInFile.addr) { out.status = 'maybe'; out.pick = true; out.note = t('impMaybeFile', { n: nameInFile.n }); remember(); return out; }
      out.status = 'dup'; out.pick = false; out.note = t('impDupFile', { n: nameInFile.n }); return out;
    }
    remember();
    return out;
  });
  return { rows, unknown };
}

// ---------- דער קעסטל אין אדמין ----------
let parsed = null; // { rows, unknown, file }

export function importBoxHtml() {
  return `<h3 class="adm-group-title">📥 ${h(t('impTitle'))}</h3>
    <ol class="imp-steps">
      <li>${h(t('impStep1'))} <button type="button" class="btn small-btn" id="imp-template">⬇ ${h(t('impTemplateBtn'))}</button></li>
      <li>${h(t('impStep2'))}</li>
      <li>${h(t('impStep3'))} <label class="btn small-btn primary">⬆ ${h(t('impUploadBtn'))}<input type="file" id="imp-file" accept=".xlsx,.csv" hidden></label></li>
    </ol>
    <div id="imp-preview"></div>`;
}

export function wireImport(box, ui) {
  if (!box) return;
  $('#imp-template', box).onclick = () => downloadTemplate();
  $('#imp-file', box).onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const prev = $('#imp-preview', box);
    prev.innerHTML = `<p class="muted">⏳ ${h(t('impReading'))}</p>`;
    try {
      const table = /\.csv$/i.test(file.name) ? readCsv(await file.text()) : await readXlsx(file);
      parsed = { ...buildRows(table), file: file.name, table };
      renderPreview(box, ui);
    } catch (err) {
      prev.innerHTML = `<p class="warn-text">${h(t('impBadFile'))}</p><p class="muted small" dir="ltr">${h(String(err.message || err))}</p>`;
    }
  };
}

function renderPreview(box, ui) {
  const prev = $('#imp-preview', box);
  const { rows, unknown } = parsed;
  if (!rows.length) { prev.innerHTML = `<p class="warn-text">${h(t('impEmpty'))}</p>`; return; }
  const ok = rows.filter((r) => r.status === 'ok').length;
  const dup = rows.filter((r) => r.status === 'dup').length;
  const maybe = rows.filter((r) => r.status === 'maybe').length;
  const bad = rows.filter((r) => r.status === 'error').length;
  const A = (r, k) => { const v = r.contact[k] || ''; return v && r.auto?.has(k) ? `<span class="imp-auto" title="${h(t('impAutoTip'))}">${h(v)}</span>` : h(v); };
  const nameOf = (r) => ['title_he', 'first_name_he', 'last_name_he'].map((k) => A(r, k)).filter(Boolean).join(' ');
  const enOf = (r) => ['first_name_en', 'last_name_en'].map((k) => A(r, k)).filter(Boolean).join(' ');
  const nAuto = rows.filter((r) => r.auto).length;
  // די פראבלעמען קודם (ראזע, דערנאך געל) — כדי מ'זאל זיי זען גלייך
  const rank = { error: 0, maybe: 1, dup: 2, ok: 3 };
  const shown = [...rows].sort((a, b) => rank[a.status] - rank[b.status] || a.n - b.n).slice(0, 300);
  prev.innerHTML = `<div class="imp-sum">
      <b>${h(parsed.file)}</b> · <span class="badge paid">✓ ${h(t('impOk', { n: ok }))}</span>
      ${maybe ? `<span class="badge imp-maybe-b">? ${h(t('impMaybe', { n: maybe }))}</span>` : ''}
      ${dup ? `<span class="badge muted">⚠ ${h(t('impDup', { n: dup }))}</span>` : ''}
      ${bad ? `<span class="badge unpaid">✕ ${h(t('impBad', { n: bad }))}</span>` : ''}
      ${bad + dup ? `<button type="button" class="btn small-btn" id="imp-xl-bad">⬇ ${h(t('impBadXl'))}</button>` : ''}</div>
    ${nAuto ? `<p class="hint-line">✎ ${h(t('impAutoNote', { n: nAuto }))}</p>` : ''}
    ${unknown.length ? `<p class="warn-text small">${h(t('impUnknownCols', { cols: unknown.join(', ') }))}</p>` : ''}
    ${dup + maybe ? `<p class="hint-line">☑ ${h(t('impPickHint'))}</p>` : ''}
    <label class="check"><input type="checkbox" id="imp-auto"${autoFill ? ' checked' : ''}> ${h(t('impAutoFill'))}</label>
    <label class="imp-tag">🏷 ${h(t('impTagLabel'))} <input id="imp-tag" dir="rtl" value="${h(t('impDefaultTag'))}"></label>
    <p class="hint-line">${h(t('impTagHint'))}</p>
    <div class="imp-table-wrap"><table class="lapsed-table imp-table"><thead><tr><th>#</th><th>${h(t('impColName'))}</th><th>${h(t('impColEn'))}</th><th>${h(t('impColAddr'))}</th><th>${h(t('impColPhone'))}</th><th></th></tr></thead>
      <tbody>${shown.map((r) => `<tr class="imp-${r.status}"><td class="muted small">${r.status === 'dup' || r.status === 'maybe' ? `<input type="checkbox" class="imp-pick" data-n="${r.n}"${r.pick ? ' checked' : ''}> ` : ''}${r.n}</td><td>${nameOf(r)}</td>
        <td dir="ltr">${enOf(r)}</td>
        <td class="small" dir="ltr">${h([r.contact.address, r.contact.city, r.contact.state, r.contact.zip].filter(Boolean).join(', '))}</td>
        <td class="small" dir="ltr">${h(r.phones.mobile || r.phones.home_phone || r.phones.email_1 || '')}</td>
        <td class="small">${r.status === 'ok' ? '✓' : `${{ dup: '⚠', maybe: '?', error: '✕' }[r.status]} ${h(r.note)}`}</td></tr>`).join('')}</tbody></table></div>
    ${rows.length > shown.length ? `<p class="muted small">${h(t('impMoreRows', { n: rows.length - shown.length }))}</p>` : ''}
    <div class="actions"><span class="spacer"></span>
      <button type="button" class="btn" id="imp-cancel">${h(t('cancelBtn'))}</button>
      <button type="button" class="btn primary" id="imp-go"></button></div>
    <div class="ml-progress" id="imp-progress" hidden><div class="ml-bar"><span></span></div><span class="ml-ptext"></span></div>`;
  $('#imp-xl-bad', prev)?.addEventListener('click', () => {
    // די שורות מיט פראבלעמען — מיט דער שורה-נומער און וואס פעלט, צו פאררעכטן אין Excel
    const keys = FIELDS.map((f) => f[0]);
    downloadXlsx(t('impBadXlName'), [t('impColRow'), t('impColProblem'), ...FIELDS.map(header)],
      rows.filter((r) => r.status !== 'ok').map((r) => [r.n, r.note, ...keys.map((k) => r.contact[k] ?? r.phones[k] ?? '')]));
  });
  $('#imp-auto', prev).onchange = (e) => { autoFill = e.target.checked; parsed = { ...buildRows(parsed.table), file: parsed.file, table: parsed.table }; renderPreview(box, ui); };
  const count = () => rows.filter((r) => r.pick).length;
  const go = $('#imp-go', prev);
  const sync = () => { go.textContent = `📥 ${t('impGo', { n: count() })}`; go.disabled = !count(); };
  prev.addEventListener('change', (e) => {
    if (!e.target.classList.contains('imp-pick')) return;
    const row = rows.find((x) => String(x.n) === e.target.dataset.n);
    if (row) row.pick = e.target.checked;
    sync();
  });
  sync();
  $('#imp-cancel', prev).onclick = () => { parsed = null; prev.innerHTML = ''; };
  go.onclick = async () => {
    const list = rows.filter((r) => r.pick && r.status !== 'error');
    // א טעג אויף יעדן — מ'זאל וויסן פון וואו ער איז געקומען, און קענען דורכגיין / געפינען אלע
    const tag = $('#imp-tag', prev).value.trim();
    if (!list.length || !confirm(t('impConfirm', { n: list.length }))) return;
    go.disabled = true; $('#imp-cancel', prev).disabled = true;
    const bar = $('#imp-progress', prev); bar.hidden = false;
    try {
      if (tag && !(state.lists.community_tag || []).includes(tag)) await addListValue('community_tag', tag);
      const res = await importContacts(list.map((r) => ({
        contact: { ...r.contact, community_tags: joinTags([...splitTags(r.contact.community_tags), ...(tag ? [tag] : [])]) },
        phones: r.phones,
      })), (done, total) => {
        $('.ml-bar span', bar).style.width = `${Math.round((done / total) * 100)}%`;
        $('.ml-ptext', bar).textContent = `${done} / ${total}`;
      });
      await loadAll();
      ui.refreshAll?.();
      parsed = null;
      prev.innerHTML = `<p class="drive-ok">✓ ${h(t('impDone', { n: list.length, first: res.first, last: res.last }))}</p>`;
      ui.toast(t('impDone', { n: list.length, first: res.first, last: res.last }));
    } catch (err) {
      ui.toast(ui.friendlyError(err), 'error');
      go.disabled = false; $('#imp-cancel', prev).disabled = false;
    }
  };
}
