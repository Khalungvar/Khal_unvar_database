// אתר פון א מוסד — יומנים: 🤝 חברותות, ✅ השתתפות (מיט ⏱ כניסה/יציאה פון אברכים), 🏥 ביטוח בריאות, 📞 יומן מיט טעלעפאנען.
// אלעס ווערט געדרוקט ווי די דפים פון דער ישיבה: צוויי זיילן מיט נומערירטע נעמען, "פרשת ...", טעג א–ה.
// דער לוח (פרשיות) — לויט די הגדרות פונעם מוסד (ארץ ישראל / חוץ לארץ).
import { downloadXlsx } from '../excel.js?v=506';
import { todayIso, isoToHebrewText, toHebrew, monthHe, yearLabel } from '../hebdate.js?v=506';
import { shabbatTitle, shabbatOfWeek } from '../parasha.js?v=506';
import { loadSchool, schoolLoaded, activeStudents, zmanim, currentZman } from './school.js?v=506';
import { letterhead, heShort } from './brand.js?v=506';

let X = null;
export function initJournal(ctx) { X = ctx; }
const J = { seder: '', week: '', zman: '', chav: null, att: {}, hours: null, ins: null, mode: '', month: '' };
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MARKS = ['', 'v', 'x', 'l']; // ריק → ✓ → ✗ → ⏰
const MARK_TXT = { v: '✓', x: '✗', l: '⏰' };
const KUPOT = ['מכבי', 'מאוחדת', 'כללית', 'לאומית', 'ישראלי', 'ביטוח פרטי'];
const INS_STATUS = ['', 'סודר', 'לטיפול', 'לא רלוונטי'];

const sedarim = () => (X.st.settings?.sedarim || []);
const il = () => (X.st.settings?.calendar || 'il') !== 'chul';
const pad = (n) => String(n).padStart(2, '0');
const isoAdd = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const sundayOf = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return isoAdd(iso, -d.getUTCDay()); };
const weekTitle = (sun) => shabbatTitle(shabbatOfWeek(sun), il());
const fmtDay = (iso) => heShort(iso); // עברי: "כ"ה חשון"
const first = (id) => X.S(X.pById(id)?.first_name_he || X.pById(id)?.first_name_en);
const last = (id) => X.S(X.pById(id)?.last_name_he || X.pById(id)?.last_name_en);
const full = (id) => { const p = X.pById(id); return p ? X.nameOf(p) : ''; };

async function needSchool() { if (!schoolLoaded()) await loadSchool(); }
function students(day) { return activeStudents(day).map((e) => e.contact_id).filter((id) => X.pById(id)); }
const avreichim = () => X.st.people.filter((p) => (p.kinds || [p.kind]).includes('avreich')).sort((a, b) => X.S(a.last_name_he).localeCompare(X.S(b.last_name_he), 'he'));

// ---------- דרוקן: א שיין בלאט (A4) מיטן בלאנק / לאגא ----------
const PRINT_CSS = `
  @page { size: A4 var(--orient); margin: 9mm; }
  body { font-family: 'Heebo', Arial, sans-serif; margin: 0; color: #1d1a14; }
  .bar { padding: 8px 10px; background: #f6f1e4; border-bottom: 1px solid #e2d6b8; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; font-size: 14px; }
  .bar button { font: inherit; padding: 5px 14px; border-radius: 8px; border: 1px solid #b89a5a; background: #fff; cursor: pointer; }
  .bar button.pr { background: #7a2020; color: #fff; border-color: #7a2020; }
  .bar select { font: inherit; padding: 3px 6px; }
  .page { padding: 6mm 8mm; }
  .lh { text-align: center; margin-bottom: 2mm; } .lh img { max-width: 100%; max-height: 30mm; }
  .hd { display: flex; align-items: center; gap: 12px; }
  .hd img { height: 46px; }
  .ttl { text-align: center; margin: 1mm 0 4mm; padding-bottom: 2mm; border-bottom: 2px solid #b8913c; }
  .ttl h1 { font-family: 'Frank Ruhl Libre', serif; font-size: 25px; margin: 0; font-weight: 900; color: #2a2560; }
  .ttl .sub { font-size: 13px; color: #6b6150; margin-top: 2px; }
  .cols { display: flex; gap: 6mm; align-items: flex-start; }
  .cols > table { flex: 1; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  th, td { border: 1px solid #c9bfa8; padding: 3px 6px; height: 18px; }
  th { background: #f1ead8; font-weight: 700; color: #3a3220; border-bottom: 2px solid #b8913c; }
  tbody tr:nth-child(even) td { background: #faf7ef; }
  td.n, th.n { width: 24px; text-align: center; color: #8a7d62; font-size: 11px; }
  td.nm { font-weight: 500; white-space: nowrap; }
  td.c, th.c { min-width: 22px; text-align: center; }
  td.t, th.t { width: 44px; text-align: center; }
  .muted { color: #6b6150; font-size: 11px; }
  .foot { margin-top: 4mm; font-size: 10px; color: #8a7d62; text-align: left; }
  @media print { .bar { display: none; } .page { padding: 0; } tbody tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  /* 📏 כווץ לעמוד A4 אחד */
  body.fit .page { padding: 0; margin: 0 auto; box-sizing: border-box; font-size: var(--fz); }
  body.fit table { font-size: var(--fz); }
  body.fit th, body.fit td { padding: var(--padv) var(--pad); height: auto; line-height: var(--lnh, 1.15); }
  body.fit td.n, body.fit th.n { font-size: calc(var(--fz) * .85); width: auto; }
  body.fit .lh img { max-height: var(--lhh); }
  body.fit .hd img { height: calc(var(--lhh) * .5); }
  body.fit .ttl { margin: 0 0 1.5mm; padding-bottom: 1mm; }
  body.fit .ttl h1 { font-size: calc(var(--fz) * 2); }
  body.fit .ttl .sub, body.fit .muted { font-size: calc(var(--fz) * .9); }
  body.fit .foot { margin-top: 1mm; font-size: calc(var(--fz) * .8); }
  body.fit .cols { gap: 3mm; }
  @media print { body.fit .page { width: auto !important; } }`;
function printHead(title, sub) {
  const lh = letterhead(X.KEY); const logo = X.st.logo || X.st.mosad?.logo || '';
  return `${lh ? `<div class="lh"><img src="${lh.top}" alt=""></div>` : logo ? `<div class="hd"><img src="${logo}" alt=""></div>` : ''}
    <div class="ttl"><h1>${X.h(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}
function printDoc(w, title, inner, { landscape = false, bar = '', script = '' } = {}) {
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${X.h(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
    <style>:root { --orient: ${landscape ? 'landscape' : 'portrait'}; } ${PRINT_CSS.replace('var(--orient)', landscape ? 'landscape' : 'portrait')}</style></head><body>
    <div class="bar"><button class="pr" onclick="window.print()">🖨 הדפסה</button>${bar}<label><input type="checkbox" id="fit1"> 📏 כווץ לעמוד A4 אחד</label><span id="fitn" class="muted"></span><button onclick="window.close()">סגירה</button></div>
    <div class="page">${inner}<div class="foot">${X.h(isoToHebrewText(todayIso()))}</div></div>${script}${fitScript(landscape)}</body></html>`);
  w.document.close();
}
/** "כווץ לעמוד A4 אחד": מקטין את הבלאנק ואת האותיות (עד 5.5) עד שהכל נכנס; אם גם אז לא — ממשיך לעמוד שני */
function fitScript(landscape) {
  return `<script>(function () {
    const cb = document.getElementById('fit1'); const pg = document.querySelector('.page'); const R = document.documentElement.style;
    const MM = 96 / 25.4; const H = (${landscape ? 192 : 279} - 8) * MM; const W = ${landscape ? 279 : 192} * MM;
    function apply() {
      document.body.classList.toggle('fit', cb.checked);
      const note = document.getElementById('fitn');
      if (!cb.checked) { ['--fz', '--lhh', '--pad', '--padv', '--lnh'].forEach((k) => R.removeProperty(k)); pg.style.width = ''; note.textContent = ''; return; }
      pg.style.width = W + 'px';
      let fz = 9.5;
      for (let i = 0; i < 40; i += 1) {
        R.setProperty('--fz', fz + 'pt'); R.setProperty('--lhh', Math.max(12, 30 * (fz - 3.5) / 6) + 'mm'); R.setProperty('--lnh', fz < 7 ? '1.05' : '1.15'); R.setProperty('--pad', (fz >= 8 ? 4 : fz >= 6.5 ? 2 : 1) + 'px'); R.setProperty('--padv', (fz >= 8 ? 1 : 0) + 'px');
        if ((pg.scrollHeight <= H && pg.scrollWidth <= W + 1) || fz <= 5.5) break;
        fz = Math.max(5.5, Math.round((fz - 0.25) * 100) / 100);
      }
      note.textContent = pg.scrollHeight <= H ? ' (' + fz + ')' : ' (גם בגודל 5.5 לא נכנס — ימשיך לעמוד שני)';
    }
    cb.onchange = apply; window.__refit = () => { if (cb.checked) apply(); };
  })();<\/script>`;
}
/** א בלאט צום דרוקן (A4), מיטן בלאנק / לאגא און א קעפל */
export function printWin(title, sub, body, { landscape = false } = {}) {
  const w = window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  printDoc(w, title, `${printHead(title, sub)}${body}`, { landscape });
}
/** סדר א-ב: משפחה, דערנאך דער ערשטער נאמען */
const sortIds = (ids) => [...ids].sort((a, b) => last(a).localeCompare(last(b), 'he') || first(a).localeCompare(first(b), 'he'));
/**
 * א רשימה פון מענטשן צום דרוקן: # · שם (איין שפאלט, א-ב) · די שפאלטן.
 * cols: [{ t: כותרת, c: 'c'|'t'|'', ltr }] · rows: [{ id, cells: [טעקסט] }] · head: (נישט מוז) שורות פון א קעפל [[{ t, cs, rs, c }]]
 * אינעם פענצטער: "בלי מי שאצלו ... ריק" און "שני טורים בדף".
 */
export function printList(title, sub, { cols, rows, head = null, landscape = false, twoUp = false }) {
  const w = window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  const byId = Object.fromEntries(rows.map((r) => [String(r.id), r]));
  const ordered = sortIds(rows.map((r) => r.id)).map((id) => byId[String(id)]);
  const hr = head || [cols.map((c) => ({ t: c.t, c: c.c || '' }))];
  const D = { cols: cols.map((c) => ({ c: c.c || '', ltr: !!c.ltr })), head: hr, rows: ordered.map((r) => ({ n: [first(r.id), last(r.id)].filter(Boolean).join(' '), v: r.cells.map((x) => String(x ?? '')) })) };
  const opts = cols.map((c, i) => `<option value="${i}">${X.h(c.t)}</option>`).join('');
  const bar = `<label>בלי מי שאצלו <select id="pf"><option value="-1">— (כולם)</option>${opts}</select> ריק</label>
    <label><input type="checkbox" id="p2"${twoUp ? ' checked' : ''}> שני טורים בדף</label>`;
  const script = `<script>
    const D = ${JSON.stringify(D).replace(/</g, '\\u003c')};
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function headHtml() {
      const n = D.head.length;
      return D.head.map((row, i) => '<tr>' + (i === 0 ? '<th class="n" rowspan="' + n + '">#</th><th rowspan="' + n + '">שם</th>' : '')
        + row.map((h) => '<th class="' + (h.c || 'c') + '"' + (h.cs > 1 ? ' colspan="' + h.cs + '"' : '') + (h.rs > 1 ? ' rowspan="' + h.rs + '"' : '') + '>' + esc(h.t) + '</th>').join('') + '</tr>').join('');
    }
    function tbl(list, off) {
      return '<table><thead>' + headHtml() + '</thead><tbody>' + list.map((r, i) => '<tr><td class="n">' + (off + i + 1) + '</td><td class="nm">' + esc(r.n) + '</td>'
        + r.v.map((v, j) => '<td class="' + D.cols[j].c + '"' + (D.cols[j].ltr ? ' dir="ltr"' : '') + '>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    }
    function draw() {
      const f = Number(document.getElementById('pf').value); const two = document.getElementById('p2').checked;
      const list = f < 0 ? D.rows : D.rows.filter((r) => String(r.v[f] || '').trim());
      const half = Math.ceil(list.length / 2);
      document.getElementById('pl').innerHTML = two && list.length > 1 ? '<div class="cols">' + tbl(list.slice(0, half), 0) + tbl(list.slice(half), half) + '</div>' : tbl(list, 0);
      document.getElementById('pc').textContent = list.length + ' / ' + D.rows.length;
      if (window.__refit) window.__refit();
    }
    document.getElementById('pf').onchange = draw; document.getElementById('p2').onchange = draw; draw();
  <\/script>`;
  printDoc(w, title, `${printHead(title, sub)}<div id="pl"></div><div class="muted" id="pc"></div>`, { landscape, bar, script });
}
const wait = (box) => { box.innerHTML = '<p class="muted">טוען…</p>'; };
const fail = (box, err) => { box.innerHTML = `<p class="ms-note err">${X.h(X.msg(err))}</p>`; };

// =====================================================================
// 🤝 חברותות
// =====================================================================
export async function renderChav(box) {
  const { h } = X;
  const ss = sedarim().filter((s) => s.chav);
  if (!ss.length) { box.innerHTML = '<p class="ms-note">אין סדרים עם חברותות. (⚙️ הגדרות)</p>'; return; }
  if (!J.zman) J.zman = currentZman();
  if (!ss.some((s) => s.key === J.chavSeder)) J.chavSeder = ss[0].key;
  if (!J.chav || J.chav.zman !== J.zman) {
    wait(box);
    try { await needSchool(); const r = await X.call(X.KEY, 'chav', { zman: J.zman }); J.chav = { zman: J.zman, rows: r.rows, zmanim: r.zmanim }; } catch (err) { fail(box, err); return; }
  }
  const seder = ss.find((s) => s.key === J.chavSeder);
  const ids = students();
  const rowOf = (id) => J.chav.rows.find((r) => r.seder === seder.key && String(r.contact_id) === String(id));
  const partnerTxt = (r) => (r ? (r.partner_id ? full(r.partner_id) || `#${r.partner_id}` : r.partner_text) : '');
  const label = (id) => (X.pById(id) ? `${X.nameOf(X.pById(id))} (#${id})` : '');
  const zs = [...new Set([...zmanim().slice(0, 6).map((z) => z.label), ...(J.chav.zmanim || []), J.zman].filter(Boolean))];
  const others = X.st.people.filter((p) => (p.kinds || [p.kind]).some((k) => ['student', 'avreich', 'staff', 'other'].includes(k))).sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'));
  box.innerHTML = `<h2 class="ms-h">🤝 חברותות</h2>
    <div class="ms-bar">
      <label>זמן <select id="jc-zman">${zs.map((z) => `<option${z === J.zman ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
      <div class="seg">${ss.map((s) => `<button type="button" data-seder="${h(s.key)}" class="${s.key === seder.key ? 'on' : ''}">${h(s.name)}</button>`).join('')}</div>
      <span class="spacer"></span>
      ${X.can('chavrusas') ? '<button type="button" class="btn primary" id="jc-save" disabled>💾 שמירה</button>' : ''}
      <button type="button" class="btn" id="jc-print">🖨 הדפסה</button>
      <button type="button" class="btn" id="jc-av">🖨 דף אברכים</button>
      <button type="button" class="btn" id="jc-xl">⬇ Excel</button>
    </div>
    <p class="muted small">כותבים את החברותא: בוחרים מהרשימה (בחור או אברך), או כותבים טקסט (למשל "שיעור ר' שמואל"). כשבוחרים בחור — גם אצלו נרשם אוטומטית, אם הוא עדיין ריק.</p>
    <datalist id="jc-dl">${others.map((p) => `<option value="${h(label(p.contact_id))}">`).join('')}</datalist>
    <div class="ms-wrap"><table class="ms-table jc-table"><thead><tr><th>#</th><th>שם</th><th>משפחה</th><th>חברותא</th></tr></thead><tbody>
      ${ids.map((id, i) => { const r = rowOf(id); const v = r ? (r.partner_id ? label(r.partner_id) || `#${r.partner_id}` : r.partner_text) : ''; return `<tr><td class="num">${i + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
        <td><input class="jc-in" data-id="${h(id)}" list="jc-dl" value="${h(v)}"${X.can('chavrusas') ? '' : ' disabled'}></td></tr>`; }).join('')}
    </tbody></table></div>`;
  const dirty = new Set();
  const saveBtn = X.$('#jc-save', box);
  X.$$('.jc-in', box).forEach((inp) => {
    inp.onchange = () => {
      dirty.add(inp.dataset.id);
      // דער חברותא איז א בחור מיט א ליידיגן פעלד → אויך ביי אים
      const m = X.S(inp.value).match(/\(#(\d+)\)$/);
      if (m) {
        const other = X.$(`.jc-in[data-id="${m[1]}"]`, box);
        if (other && !X.S(other.value)) { other.value = label(inp.dataset.id); dirty.add(m[1]); }
      }
      if (saveBtn) saveBtn.disabled = false;
    };
  });
  X.$('#jc-zman', box).onchange = (e) => { J.zman = e.target.value; renderChav(box); };
  X.$$('[data-seder]', box).forEach((b) => { b.onclick = () => { if (dirty.size && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return; J.chavSeder = b.dataset.seder; renderChav(box); }; });
  saveBtn?.addEventListener('click', async () => {
    const rows = [...dirty].map((id) => {
      const v = X.S(X.$(`.jc-in[data-id="${id}"]`, box)?.value);
      const m = v.match(/\(#(\d+)\)$/);
      return { contact_id: id, partner_id: m ? m[1] : '', partner_text: m ? '' : v };
    });
    saveBtn.disabled = true;
    try {
      await X.call(X.KEY, 'chavSave', { zman: J.zman, seder: seder.key, rows });
      rows.forEach((r) => {
        const ex = rowOf(r.contact_id);
        if (ex) Object.assign(ex, r); else J.chav.rows.push({ zman: J.zman, seder: seder.key, ...r });
      });
      dirty.clear(); X.toast('נשמר.');
    } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  X.$('#jc-print', box).onclick = () => printList(`חברותות ${seder.name}`, h(J.zman), { cols: [{ t: 'חברותא' }], rows: ids.map((id) => ({ id, cells: [partnerTxt(rowOf(id))] })), twoUp: true });
  X.$('#jc-xl', box).onclick = () => downloadXlsx(`חברותות ${seder.name} - ${J.zman}`, ['#', 'שם', 'משפחה', 'חברותא'], ids.map((id, i) => [i + 1, first(id), last(id), partnerTxt(rowOf(id))]), { rtl: true });
  X.$('#jc-av', box).onclick = () => {
    // די אברכים מיט וועמען זיי לערנען (פון אלע סדרים אין דעם זמן)
    const av = avreichim();
    const withOf = (aid) => J.chav.rows.filter((r) => String(r.partner_id) === String(aid)).map((r) => {
      const s = sedarim().find((x) => x.key === r.seder); return `${full(r.contact_id)}${s && sedarim().filter((x) => x.chav).length > 1 ? ` (${s.name})` : ''}`;
    });
    printWin('אברכים', h(J.zman), `<table><thead><tr><th class="n">#</th><th>האברך</th><th>טלפון</th><th>חברותא</th></tr></thead><tbody>
      ${av.map((p, i) => `<tr><td class="n">${i + 1}</td><td>${h(X.nameOf(p))}</td><td dir="ltr">${h(p.il_phone || X.phoneOf(p))}</td><td>${h(withOf(p.contact_id).join(', '))}</td></tr>`).join('')}</tbody></table>
      ${av.length ? '' : '<p class="muted">אין אברכים ברשימה. מוסיפים ב"👔 אנשי צוות ואברכים" (סוג "אברך").</p>'}`);
  };
}

// =====================================================================
// ✅ השתתפות
// =====================================================================
/** פון אנדערע כפתורים: גלייך צו א טאב (למשל '_hours') */
export function setAttTab(k) { J.seder = k; }
export async function renderAtt(box) {
  const { h } = X;
  const ss = sedarim().filter((s) => s.att);
  if (!J.week) J.week = sundayOf(todayIso());
  if (!J.month) J.month = todayIso().slice(0, 7);
  const tabs = [...ss.map((s) => [s.key, s.name]), ['_hours', '⏱ אברכים — כניסה ויציאה'], ['_sum', '📊 סיכום חודשי'], ['_person', '👤 לפי בחור']];
  if (!tabs.some(([k]) => k === J.seder)) J.seder = tabs[0][0];
  try { await needSchool(); } catch (err) { fail(box, err); return; }
  const head = `<h2 class="ms-h">✅ השתתפות</h2>
    <nav class="ms-subtabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${h(k)}" class="${k === J.seder ? 'on' : ''}">${h(l)}</button>`).join('')}</nav>`;
  const body = document.createElement('div');
  box.innerHTML = head; box.append(body);
  X.$$('[data-tab]', box).forEach((b) => { b.onclick = () => { if (J.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return; J.dirty = false; J.seder = b.dataset.tab; renderAtt(box); }; });
  if (J.seder === '_hours') return renderHours(body);
  if (J.seder === '_sum') return renderSum(body);
  if (J.seder === '_person') return renderPerson(body);
  return renderWeek(body, ss.find((s) => s.key === J.seder));
}
function weekBar(sun) {
  const { h } = X;
  return `<div class="ms-bar">
      <button type="button" class="btn" id="ja-prev">→ שבוע קודם</button>
      <b>${h(weekTitle(sun))}</b> <span class="muted small">${h(fmtDay(sun))} – ${h(fmtDay(isoAdd(sun, 5)))}</span>
      <button type="button" class="btn" id="ja-next">שבוע הבא ←</button>
      <button type="button" class="linkish" id="ja-now">השבוע</button>
      <span class="spacer"></span>`;
}
function wireWeek(body, rerender) {
  const go = (n) => { if (J.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return; J.dirty = false; J.week = n; rerender(); };
  X.$('#ja-prev', body).onclick = () => go(isoAdd(J.week, -7));
  X.$('#ja-next', body).onclick = () => go(isoAdd(J.week, 7));
  X.$('#ja-now', body).onclick = () => go(sundayOf(todayIso()));
}
async function attRows(week) {
  if (!J.att[week]) { const r = await X.call(X.KEY, 'att', { from: week, to: week }); J.att[week] = r.rows; }
  return J.att[week];
}
const parseMarks = (s) => { try { return JSON.parse(s || '{}') || {}; } catch { return {}; } };
// משבצות פאר א טאג: 1 אדער 2 (תחילה וסוף) — לויט slotsBy (פאר יעדן טאג), אנדערש slots
const slotsOn = (seder, d) => (Number(seder.slotsBy?.[d] ?? seder.slots) > 1 ? 2 : 1);
const slotKeys = (seder) => (seder.days || []).flatMap((d) => (slotsOn(seder, d) > 1 ? [String(d), `${d}b`] : [String(d)]));

async function renderWeek(body, seder) {
  const { h } = X;
  if (!seder) { body.innerHTML = '<p class="ms-note">אין סדרים עם השתתפות. (⚙️ הגדרות)</p>'; return; }
  const sun = J.week;
  body.innerHTML = '<p class="muted">טוען…</p>';
  let rows;
  try { rows = await attRows(sun); } catch (err) { fail(body, err); return; }
  const ids = students(isoAdd(sun, 4));
  const marks = {};
  ids.forEach((id) => { marks[id] = parseMarks(rows.find((r) => r.seder === seder.key && String(r.contact_id) === String(id))?.marks); });
  const days = seder.days || [];
  const two = days.some((d) => slotsOn(seder, d) > 1);
  const keys = slotKeys(seder);
  const edit = X.can('attendance');
  body.innerHTML = `${weekBar(sun)}
      ${edit ? '<button type="button" class="btn primary" id="ja-save" disabled>💾 שמירה</button>' : ''}
      <button type="button" class="btn" id="ja-blank">🖨 דף ריק</button>
      <button type="button" class="btn" id="ja-full">🖨 עם הסימונים</button>
      <button type="button" class="btn" id="ja-xl">⬇ Excel</button>
    </div>
    <p class="muted small">לחיצה על משבצת: ✓ נוכח → ✗ חסר → ⏰ איחור → ריק.${two ? ' 1 / 2 = תחילת הסדר וסוף הסדר.' : ''} אפשר גם "✓ לכולם" ביום.</p>
    <div class="ms-wrap"><table class="ms-table ja-table"><thead>
      <tr><th rowspan="${two ? 2 : 1}">#</th><th rowspan="${two ? 2 : 1}">שם</th><th rowspan="${two ? 2 : 1}">משפחה</th>${days.map((d) => `<th colspan="${slotsOn(seder, d)}"${two && slotsOn(seder, d) < 2 ? ' rowspan="2"' : ''} class="c">${DAYS[d]}<div class="muted small">${fmtDay(isoAdd(sun, d))}</div>${edit ? `<button type="button" class="linkish small" data-all="${d}">✓ לכולם</button>` : ''}</th>`).join('')}</tr>
      ${two ? `<tr>${days.filter((d) => slotsOn(seder, d) > 1).map(() => '<th class="c small">1</th><th class="c small">2</th>').join('')}</tr>` : ''}
    </thead><tbody>${ids.map((id, i) => `<tr><td class="num">${i + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
      ${keys.map((k) => `<td class="c"><button type="button" class="ja-cell m-${marks[id][k] || 'e'}" data-id="${h(id)}" data-k="${k}"${edit ? '' : ' disabled'}>${MARK_TXT[marks[id][k]] || ''}</button></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
  wireWeek(body, () => renderWeek(body, seder));
  const saveBtn = X.$('#ja-save', body);
  const changed = new Set();
  const setCell = (b, v) => { marks[b.dataset.id][b.dataset.k] = v; if (!v) delete marks[b.dataset.id][b.dataset.k]; b.textContent = MARK_TXT[v] || ''; b.className = `ja-cell m-${v || 'e'}`; changed.add(b.dataset.id); J.dirty = true; if (saveBtn) saveBtn.disabled = false; };
  X.$$('.ja-cell', body).forEach((b) => { b.onclick = () => { const cur = marks[b.dataset.id][b.dataset.k] || ''; setCell(b, MARKS[(MARKS.indexOf(cur) + 1) % MARKS.length]); }; });
  X.$$('[data-all]', body).forEach((a) => {
    a.onclick = () => X.$$(`.ja-cell[data-k="${a.dataset.all}"], .ja-cell[data-k="${a.dataset.all}b"]`, body).forEach((b) => { if (!marks[b.dataset.id][b.dataset.k]) setCell(b, 'v'); });
  });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const out = [...changed].map((id) => ({ contact_id: id, marks: JSON.stringify(marks[id]) }));
    try {
      await X.call(X.KEY, 'attSave', { week: sun, seder: seder.key, rows: out });
      out.forEach((r) => { const ex = rows.find((x) => x.seder === seder.key && String(x.contact_id) === String(r.contact_id)); if (ex) ex.marks = r.marks; else rows.push({ week: sun, seder: seder.key, ...r }); });
      changed.clear(); J.dirty = false; X.toast('נשמר.');
    } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  const sheet = (filled) => {
    const head = [days.map((d) => ({ t: `${DAYS[d]} ${fmtDay(isoAdd(sun, d))}`, cs: slotsOn(seder, d), rs: two && slotsOn(seder, d) < 2 ? 2 : 1 }))];
    if (two) head.push(days.filter((d) => slotsOn(seder, d) > 1).flatMap(() => [{ t: '1' }, { t: '2' }]));
    printList(`השתתפות ${seder.name}`, h(weekTitle(sun)), { head, cols: keys.map((k) => ({ t: `${DAYS[Number(k[0])]}${slotsOn(seder, Number(k[0])) > 1 ? (k.endsWith('b') ? ' 2' : ' 1') : ''}`, c: 'c' })),
      rows: ids.map((id) => ({ id, cells: keys.map((k) => (filled ? MARK_TXT[marks[id][k]] || '' : '')) })), twoUp: keys.length <= 6 });
  };
  X.$('#ja-blank', body).onclick = () => sheet(false);
  X.$('#ja-full', body).onclick = () => sheet(true);
  X.$('#ja-xl', body).onclick = () => downloadXlsx(`השתתפות ${seder.name} - ${weekTitle(sun)}`, ['#', 'שם', 'משפחה', ...keys.map((k) => `${DAYS[Number(k[0])]}${slotsOn(seder, Number(k[0])) > 1 ? (k.endsWith('b') ? ' 2' : ' 1') : ''}`)],
    ids.map((id, i) => [i + 1, first(id), last(id), ...keys.map((k) => MARK_TXT[marks[id][k]] || '')]), { rtl: true });
}

// ---------- 📊 סיכום חודשי ----------
async function renderSum(body) {
  const { h } = X;
  const mo = J.month;
  const [y, m] = mo.split('-').map(Number);
  const firstDay = `${mo}-01`; const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  body.innerHTML = '<p class="muted">טוען…</p>';
  let rows;
  try { rows = (await X.call(X.KEY, 'att', { from: sundayOf(firstDay), to: lastDay })).rows; } catch (err) { fail(body, err); return; }
  const ss = sedarim().filter((s) => s.att);
  const ids = students(lastDay < todayIso() ? lastDay : todayIso());
  // ספירה: נאר טעג אין דעם חודש
  const cnt = {};
  ids.forEach((id) => { cnt[id] = {}; ss.forEach((s) => { cnt[id][s.key] = { v: 0, x: 0, l: 0 }; }); });
  rows.forEach((r) => {
    const c = cnt[r.contact_id]?.[r.seder]; if (!c) return;
    Object.entries(parseMarks(r.marks)).forEach(([k, v]) => {
      const day = isoAdd(r.week, Number(k[0]));
      if (day >= firstDay && day <= lastDay && c[v] !== undefined) c[v] += 1;
    });
  });
  const pct = (c) => { const t = c.v + c.x + c.l; return t ? Math.round(((c.v + c.l * 0.5) / t) * 100) : ''; };
  body.innerHTML = `<div class="ms-bar"><label>חודש <input type="month" id="js-mo" value="${h(mo)}"></label><span class="spacer"></span>
      <button type="button" class="btn" id="js-print">🖨 הדפסה</button><button type="button" class="btn" id="js-xl">⬇ Excel</button></div>
    <p class="muted small">לכל סדר: ✓ נוכח / ✗ חסר / ⏰ איחור, ואחוז (איחור = חצי).</p>
    <div class="ms-wrap"><table class="ms-table"><thead><tr><th>#</th><th>שם</th>${ss.map((s) => `<th class="c">${h(s.name)}<div class="muted small">✓ ✗ ⏰ · %</div></th>`).join('')}</tr></thead><tbody>
      ${ids.map((id, i) => `<tr><td class="num">${i + 1}</td><td>${h(full(id))}</td>${ss.map((s) => { const c = cnt[id][s.key]; const p = pct(c); return `<td class="c small${p !== '' && p < 80 ? ' ms-owe' : ''}">${c.v} · ${c.x} · ${c.l}${p !== '' ? ` · ${p}%` : ''}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>`;
  X.$('#js-mo', body).onchange = (e) => { if (e.target.value) { J.month = e.target.value; renderSum(body); } };
  const title = `סיכום השתתפות ${monthHe(toHebrew(`${mo}-15`).m)} ${yearLabel(toHebrew(`${mo}-15`).y)}`;
  X.$('#js-print', body).onclick = () => printList(title, h(mo), { cols: ss.map((s) => ({ t: `${s.name} ✓/✗/⏰ · %`, c: 'c' })),
    rows: ids.map((id) => ({ id, cells: ss.map((s) => { const c = cnt[id][s.key]; const p = pct(c); return c.v + c.x + c.l ? `${c.v}/${c.x}/${c.l}${p !== '' ? ` · ${p}%` : ''}` : ''; }) })) });
  X.$('#js-xl', body).onclick = () => downloadXlsx(title, ['#', 'שם', ...ss.flatMap((s) => [`${s.name} ✓`, `${s.name} ✗`, `${s.name} ⏰`, `${s.name} %`])],
    ids.map((id, i) => [i + 1, full(id), ...ss.flatMap((s) => { const c = cnt[id][s.key]; return [c.v, c.x, c.l, pct(c)]; })]), { rtl: true });
}

// ---------- 👤 לפי בחור: מתאריך עד תאריך ----------
async function renderPerson(body) {
  const { h } = X;
  const ss = sedarim().filter((s) => s.att);
  if (!J.pFrom) J.pFrom = `${todayIso().slice(0, 7)}-01`;
  if (!J.pTo) J.pTo = todayIso();
  const studs = X.st.people.filter((p) => (p.kinds || [p.kind]).includes('student')).sort((a, b) => X.S(a.last_name_he).localeCompare(X.S(b.last_name_he), 'he') || X.S(a.first_name_he).localeCompare(X.S(b.first_name_he), 'he'));
  const label = (p) => `${X.nameOf(p)} (#${p.contact_id})`;
  body.innerHTML = `<div class="ms-bar">
      <label>בחור <input id="jp-who" list="jp-dl" style="min-width:16em" value="${h(J.pId && X.pById(J.pId) ? label(X.pById(J.pId)) : '')}" placeholder="שם…"></label>
      <datalist id="jp-dl">${studs.map((p) => `<option value="${h(label(p))}">`).join('')}</datalist>
      <label>מתאריך <input type="date" id="jp-from" value="${h(J.pFrom)}"></label>
      <label>עד <input type="date" id="jp-to" value="${h(J.pTo)}"></label>
      <button type="button" class="btn primary" id="jp-go">הצג</button>
      <span class="spacer"></span>
      <button type="button" class="btn" id="jp-print" disabled>🖨 הדפסה</button><button type="button" class="btn" id="jp-xl" disabled>⬇ Excel</button>
    </div><div id="jp-out"><p class="muted">בוחרים בחור ותאריכים, ולוחצים "הצג".</p></div>`;
  const out = X.$('#jp-out', body);
  const go = async () => {
    const m = X.S(X.$('#jp-who', body).value).match(/\(#(\d+)\)$/);
    if (!m) { X.toast('בחר בחור מהרשימה.', 'err'); return; }
    J.pId = m[1]; J.pFrom = X.$('#jp-from', body).value; J.pTo = X.$('#jp-to', body).value;
    if (!J.pFrom || !J.pTo || J.pTo < J.pFrom) { X.toast('תאריכים לא תקינים.', 'err'); return; }
    out.innerHTML = '<p class="muted">טוען…</p>';
    let rows;
    try { rows = (await X.call(X.KEY, 'att', { from: sundayOf(J.pFrom), to: J.pTo })).rows; } catch (err) { fail(out, err); return; }
    // תאריך → סדר → [1, 2]
    const got = {};
    rows.filter((r) => String(r.contact_id) === String(J.pId)).forEach((r) => {
      Object.entries(parseMarks(r.marks)).forEach(([k, v]) => {
        const day = isoAdd(r.week, Number(k[0]));
        if (day < J.pFrom || day > J.pTo) return;
        ((got[day] ||= {})[r.seder] ||= [])[k.endsWith('b') ? 1 : 0] = v;
      });
    });
    const dates = [];
    for (let d = J.pFrom; d <= J.pTo && dates.length < 400; d = isoAdd(d, 1)) {
      const dw = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (ss.some((s) => (s.days || []).includes(dw)) || got[d]) dates.push(d);
    }
    const cell = (d, s) => { const dw = new Date(`${d}T12:00:00Z`).getUTCDay(); if (!(s.days || []).includes(dw)) return '—'; const a = got[d]?.[s.key] || []; return slotsOn(s, dw) > 1 ? `${MARK_TXT[a[0]] || '·'} ${MARK_TXT[a[1]] || '·'}` : MARK_TXT[a[0]] || ''; };
    const cnt = Object.fromEntries(ss.map((s) => [s.key, { v: 0, x: 0, l: 0 }]));
    Object.values(got).forEach((o) => Object.entries(o).forEach(([k, arr]) => arr.forEach((v) => { if (cnt[k] && cnt[k][v] !== undefined) cnt[k][v] += 1; })));
    const pct = (c) => { const t = c.v + c.x + c.l; return t ? Math.round(((c.v + c.l * 0.5) / t) * 100) : ''; };
    const dLabel = (d) => `${DAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]}' ${isoToHebrewText(d)}`;
    const sumRow = ss.map((s) => { const c = cnt[s.key]; const p = pct(c); return `✓${c.v} ✗${c.x} ⏰${c.l}${p !== '' ? ` · ${p}%` : ''}`; });
    const table = `<table class="ms-table"><thead><tr><th>תאריך</th>${ss.map((s) => `<th class="c">${h(s.name)}</th>`).join('')}</tr></thead><tbody>
      ${dates.map((d) => `<tr><td>${h(dLabel(d))}</td>${ss.map((s) => `<td class="c">${h(cell(d, s))}</td>`).join('')}</tr>`).join('')}
      <tr><td><b>סה"כ</b></td>${sumRow.map((x) => `<td class="c"><b>${h(x)}</b></td>`).join('')}</tr></tbody></table>`;
    out.innerHTML = `<p><b>${h(full(J.pId))}</b> · ${h(isoToHebrewText(J.pFrom))} – ${h(isoToHebrewText(J.pTo))}</p><div class="ms-wrap">${table}</div>
      <p class="muted small">✓ נוכח · ✗ חסר · ⏰ איחור · · = לא סומן · — אין סדר ביום הזה. אחוז: איחור = חצי.</p>`;
    const title = `השתתפות — ${full(J.pId)}`;
    const sub = `${isoToHebrewText(J.pFrom)} – ${isoToHebrewText(J.pTo)}`;
    const pb = X.$('#jp-print', body); const xb = X.$('#jp-xl', body); pb.disabled = false; xb.disabled = false;
    pb.onclick = () => printWin(title, h(sub), table.replace('class="ms-table"', ''));
    xb.onclick = () => downloadXlsx(title, ['תאריך', ...ss.map((s) => s.name)], [...dates.map((d) => [dLabel(d), ...ss.map((s) => cell(d, s))]), ['סה"כ', ...sumRow]], { rtl: true });
  };
  X.$('#jp-go', body).onclick = go;
  if (J.pId) go();
}

// ---------- ⏱ אברכים: כניסה / יציאה ----------
const mins = (a, b) => { const p = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }; const x = p(a); const y = p(b); return x !== null && y !== null && y > x ? y - x : 0; };
const hhmm = (n) => `${Math.floor(n / 60)}:${pad(n % 60)}`;
async function renderHours(body) {
  const { h } = X;
  const sun = J.week;
  const days = [0, 1, 2, 3, 4];
  body.innerHTML = '<p class="muted">טוען…</p>';
  let rows;
  try { rows = (await X.call(X.KEY, 'hours', { from: sun, to: isoAdd(sun, 6) })).hours; } catch (err) { fail(body, err); return; }
  const av = avreichim();
  const get = (id, d) => rows.find((r) => String(r.contact_id) === String(id) && r.date === isoAdd(sun, d)) || {};
  const edit = X.can('attendance');
  const rate = Number(X.st.settings?.avreich_rate) || 0;
  body.innerHTML = `${weekBar(sun)}
      ${edit ? '<button type="button" class="btn primary" id="jh-save" disabled>💾 שמירה</button>' : ''}
      <button type="button" class="btn" id="jh-blank">🖨 דף ריק</button>
      <button type="button" class="btn" id="jh-month">📊 סיכום חודשי</button>
    </div>
    ${av.length ? `<div class="ms-wrap"><table class="ms-table jh-table"><thead><tr><th>#</th><th>האברך</th>${days.map((d) => `<th colspan="2" class="c">${DAYS[d]} <span class="muted small">${fmtDay(isoAdd(sun, d))}</span></th>`).join('')}<th>סה"כ</th></tr>
      <tr><th></th><th></th>${days.map(() => '<th class="c small">כניסה</th><th class="c small">יציאה</th>').join('')}<th></th></tr></thead><tbody>
      ${av.map((p, i) => { const tot = days.reduce((s, d) => s + mins(get(p.contact_id, d).time_in, get(p.contact_id, d).time_out), 0); return `<tr data-av="${h(p.contact_id)}"><td class="num">${i + 1}</td><td>${h(X.nameOf(p))}</td>
        ${days.map((d) => `<td class="c"><input type="time" class="jh-t" data-d="${d}" data-f="time_in" value="${h(get(p.contact_id, d).time_in || '')}"${edit ? '' : ' disabled'}></td><td class="c"><input type="time" class="jh-t" data-d="${d}" data-f="time_out" value="${h(get(p.contact_id, d).time_out || '')}"${edit ? '' : ' disabled'}></td>`).join('')}
        <td class="num jh-tot">${tot ? hhmm(tot) : ''}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<p class="ms-note">אין אברכים ברשימה. מוסיפים ב"👔 אנשי צוות ואברכים" (סוג "אברך").</p>'}`;
  wireWeek(body, () => renderHours(body));
  const saveBtn = X.$('#jh-save', body);
  const changed = new Set();
  X.$$('.jh-t', body).forEach((inp) => {
    inp.onchange = () => {
      const tr = inp.closest('tr'); changed.add(`${tr.dataset.av}|${inp.dataset.d}`); J.dirty = true; if (saveBtn) saveBtn.disabled = false;
      const tot = days.reduce((s, d) => s + mins(X.$(`.jh-t[data-d="${d}"][data-f=time_in]`, tr).value, X.$(`.jh-t[data-d="${d}"][data-f=time_out]`, tr).value), 0);
      X.$('.jh-tot', tr).textContent = tot ? hhmm(tot) : '';
    };
  });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const out = [...changed].map((k) => { const [id, d] = k.split('|'); const tr = X.$(`tr[data-av="${id}"]`, body); return { contact_id: id, date: isoAdd(sun, Number(d)), time_in: X.$(`.jh-t[data-d="${d}"][data-f=time_in]`, tr).value, time_out: X.$(`.jh-t[data-d="${d}"][data-f=time_out]`, tr).value }; });
    try { await X.call(X.KEY, 'hoursSave', { rows: out }); changed.clear(); J.dirty = false; X.toast('נשמר.'); } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  X.$('#jh-blank', body).onclick = () => printWin('אברכים — כניסה ויציאה', h(weekTitle(sun)), `<table><thead><tr><th class="n">#</th><th>האברך</th>${days.map((d) => `<th colspan="2" class="c">${DAYS[d]}</th>`).join('')}</tr>
    <tr><th></th><th></th>${days.map(() => '<th class="t">כניסה</th><th class="t">יציאה</th>').join('')}</tr></thead><tbody>
    ${av.map((p, i) => `<tr><td class="n">${i + 1}</td><td>${h(X.nameOf(p))}</td>${days.map(() => '<td class="t"></td><td class="t"></td>').join('')}</tr>`).join('')}</tbody></table>`, { landscape: true });
  X.$('#jh-month', body).onclick = async () => {
    const mo = window.prompt('איזה חודש? (YYYY-MM)', todayIso().slice(0, 7));
    if (!mo || !/^\d{4}-\d{2}$/.test(mo)) return;
    const [y, m] = mo.split('-').map(Number);
    let hr;
    try { hr = (await X.call(X.KEY, 'hours', { from: `${mo}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) })).hours; } catch (err) { X.toast(X.msg(err), 'err'); return; }
    // התשלום: "ישירות מההורים" — נישט דורך אונז (קיין סכום)
    const via = {}; try { (await X.call(X.KEY, 'team')).team.forEach((t) => { via[t.contact_id] = t.pay_via; }); } catch { /* */ }
    const pays = (p) => via[p.contact_id] !== 'parents';
    const per = av.map((p) => { const mine = hr.filter((r) => String(r.contact_id) === String(p.contact_id)); const t = mine.reduce((s, r) => s + mins(r.time_in, r.time_out), 0); return { p, days: mine.length, t }; });
    const title = `אברכים — שעות ${monthHe(toHebrew(`${mo}-15`).m)} ${yearLabel(toHebrew(`${mo}-15`).y)}`;
    downloadXlsx(title, ['האברך', 'ימים', 'שעות', ...(rate ? ['לתשלום'] : [])], per.map((x) => [X.nameOf(x.p), x.days, Math.round((x.t / 60) * 100) / 100, ...(rate ? [pays(x.p) ? Math.round((x.t / 60) * rate * 100) / 100 : 'מההורים'] : [])]), { rtl: true });
    printWin(title, h(mo), `<table><thead><tr><th class="n">#</th><th>האברך</th><th>ימים</th><th>שעות</th>${rate ? '<th>לתשלום</th>' : ''}</tr></thead><tbody>
      ${per.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${h(X.nameOf(x.p))}</td><td class="c">${x.days}</td><td class="c">${hhmm(x.t)}</td>${rate ? `<td class="c">${pays(x.p) ? Math.round((x.t / 60) * rate) : 'מההורים'}</td>` : ''}</tr>`).join('')}</tbody></table>`);
  };
}

// =====================================================================
// 🏥 ביטוח בריאות
// =====================================================================
export async function renderIns(box) {
  const { h, S } = X;
  if (!J.ins) {
    wait(box);
    try { await needSchool(); J.ins = (await X.call(X.KEY, 'ins')).insurance; } catch (err) { fail(box, err); return; }
  }
  // זמן: דער זמן ווען ער האט אנגעהויבן (פונעם רישום, אדער לויטן "מ-" דאטום)
  const zs = zmanim().filter((z) => z.start).sort((a, b) => b.start.localeCompare(a.start));
  const iso = (v) => (typeof v === 'number' || /^\d{5}$/.test(String(v || '')) ? new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000).toISOString().slice(0, 10) : String(v || '').slice(0, 10));
  const zOf = (e) => e.zman || (iso(e.start_date) && (zs.find((z) => z.start <= iso(e.start_date)) || {}).label) || '';
  const act = activeStudents();
  const zAll = [...new Set(act.map(zOf).filter(Boolean))].sort((a, b) => (zs.findIndex((z) => z.label === a) - zs.findIndex((z) => z.label === b)));
  if (J.insZ && !zAll.includes(J.insZ)) J.insZ = '';
  const ids = act.filter((e) => !J.insZ || zOf(e) === J.insZ).map((e) => e.contact_id).filter((id) => X.pById(id));
  const insOf = (id) => J.ins.find((r) => String(r.contact_id) === String(id)) || {};
  const parentMail = (id) => { const f = X.fatherOf(X.pById(id) || {}); return X.S(f?.email_1) || X.S(X.pById(id)?.email_1); };
  const soon = (d) => d && d <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const needs = (r) => r.status === 'לטיפול' || !r.kupah || (r.kupah !== 'ישראלי' && !r.member_no && !r.policy_no) || Boolean(S(r.debt)) || soon(r.expires);
  const f = J.insFilter || '';
  const list = ids.filter((id) => { const r = insOf(id); return !f || (f === '_need' ? needs(r) : r.kupah === f); });
  const counts = Object.fromEntries(KUPOT.map((k) => [k, ids.filter((id) => insOf(id).kupah === k).length]));
  const stat = (r) => [r.left_date ? `עזיבה ${r.left_date}` : '', S(r.debt) ? `חוב ${S(r.debt)}` : '', r.expires ? `עד ${r.expires}` : '', r.status, r.note].filter(Boolean).join(' · ');
  box.innerHTML = `<h2 class="ms-h">🏥 ביטוח בריאות <span class="count-pill">${ids.length}</span></h2>
    <div class="ms-bar">
      <div class="seg"><button type="button" data-f="" class="${f ? '' : 'on'}">הכל</button><button type="button" data-f="_need" class="${f === '_need' ? 'on' : ''}">⚠ לטיפול (${ids.filter((id) => needs(insOf(id))).length})</button>
        ${KUPOT.filter((k) => counts[k]).map((k) => `<button type="button" data-f="${h(k)}" class="${f === k ? 'on' : ''}">${h(k)} (${counts[k]})</button>`).join('')}</div>
      <label class="small">זמן <select id="ji-z"><option value="">כל הזמנים</option>${zAll.map((z) => `<option${z === J.insZ ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
      <span class="spacer"></span>
      <button type="button" class="btn" id="ji-print">🖨 הדפסה</button><button type="button" class="btn" id="ji-xl">⬇ Excel</button>
    </div>
    <p class="muted small">"לטיפול" = אין קופה / אין מספר חבר / יש חוב / הביטוח נגמר בתוך 30 יום / סומן "לטיפול". הטלפון — הטלפון בארץ (מ"תלמידי הישיבה"); מייל — של האב.</p>
    <div class="ms-wrap"><table class="ms-table"><thead><tr><th>#</th><th>שם</th><th>משפחה</th><th>טלפון</th><th>מספר חבר</th><th>אימייל הורים</th><th>קופה</th><th>הערות</th><th></th></tr></thead><tbody>
      ${list.map((id, i) => { const r = insOf(id); return `<tr class="${needs(r) ? 'ji-need' : ''}"><td class="num">${i + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
        <td dir="ltr" class="small">${h(X.pById(id)?.il_phone || '')}</td><td dir="ltr" class="small">${h(r.member_no || r.policy_no || '')}</td>
        <td dir="ltr" class="small">${h(parentMail(id))}</td><td>${h(r.kupah === 'ביטוח פרטי' ? r.company || r.kupah : r.kupah || '')}</td><td class="small">${h(stat(r))}</td>
        <td>${X.can('insurance') ? `<button type="button" class="btn small-btn" data-ed="${h(id)}">✎</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  X.$$('[data-f]', box).forEach((b) => { b.onclick = () => { J.insFilter = b.dataset.f; renderIns(box); }; });
  X.$('#ji-z', box).onchange = (e) => { J.insZ = e.target.value; renderIns(box); };
  X.$$('[data-ed]', box).forEach((b) => { b.onclick = () => insDialog(b.dataset.ed, insOf(b.dataset.ed), box); });
  const cols = (id) => { const r = insOf(id); return [first(id), last(id), X.pById(id)?.il_phone || '', r.member_no || r.policy_no || '', parentMail(id), r.kupah === 'ביטוח פרטי' ? r.company || r.kupah : r.kupah || '', stat(r)]; };
  X.$('#ji-xl', box).onclick = () => downloadXlsx('ביטוח בריאות', ['#', 'שם', 'משפחה', 'טלפון', 'מספר חבר', 'אימייל הורים', 'קופה', 'הערות'], list.map((id, i) => [i + 1, ...cols(id)]), { rtl: true });
  X.$('#ji-print', box).onclick = () => printList(`ביטוח בריאות${J.insZ ? ` — ${J.insZ}` : ''}`, h(isoToHebrewText(todayIso())), {
    cols: [{ t: 'טלפון', ltr: true }, { t: 'מספר חבר', ltr: true }, { t: 'אימייל הורים', ltr: true }, { t: 'קופה' }, { t: 'הערות' }],
    rows: list.map((id) => ({ id, cells: cols(id).slice(2) })), landscape: true });
}
function insDialog(id, r, box) {
  const { h, S } = X;
  const d = X.dialog(`<h2>🏥 ${h(full(id))}</h2>
    <form class="ms-form" autocomplete="off"><div class="grid">
      <label>קופה / ביטוח<select name="kupah"><option value=""></option>${KUPOT.map((k) => `<option${k === r.kupah ? ' selected' : ''}>${h(k)}</option>`).join('')}</select></label>
      <label>מספר חבר<input name="member_no" dir="ltr" value="${h(r.member_no || '')}"></label>
      <label>חברת ביטוח (פרטי)<input name="company" value="${h(r.company || '')}" placeholder="למשל: טרעוויל אינשורענס"></label>
      <label>מספר פוליסה<input name="policy_no" dir="ltr" value="${h(r.policy_no || '')}"></label>
      <label>בתוקף עד<input name="expires" type="date" value="${h(r.expires || '')}"></label>
      <label>מספר דרכון<input name="passport" dir="ltr" value="${h(r.passport || '')}"></label>
      <label>חוב לקופה<input name="debt" value="${h(r.debt || '')}" placeholder="למשל: 405"></label>
      <label>תאריך עזיבה<input name="left_date" type="date" value="${h(r.left_date || '')}"></label>
      <label>סטטוס<select name="status">${INS_STATUS.map((k) => `<option value="${h(k)}"${k === (r.status || '') ? ' selected' : ''}>${h(k || '—')}</option>`).join('')}</select></label>
      <label class="wide">הערה<input name="note" value="${h(r.note || '')}"></label>
    </div>
    <p class="muted small">הטלפון בארץ — מעדכנים ב"🎓 תלמידי הישיבה" (✎ ליד הטלפון).</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="submit" class="btn primary">💾 שמירה</button></div></form>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const form = X.$('form', d);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const o = { contact_id: id };
    ['kupah', 'member_no', 'company', 'policy_no', 'expires', 'passport', 'debt', 'left_date', 'status', 'note'].forEach((k) => { o[k] = S(form.elements[k].value); });
    try {
      await X.call(X.KEY, 'insSave', { ins: o });
      const ex = J.ins.find((x) => String(x.contact_id) === String(id));
      if (ex) Object.assign(ex, o); else J.ins.push(o);
      d.close(); renderIns(box); X.toast('נשמר.');
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// =====================================================================
// 📞 יומן מיט טעלעפאנען (פון "תלמידי הישיבה")
// =====================================================================
export function printPhones() {
  const { h } = X;
  const ids = students();
  const t = toHebrew(todayIso());
  printList(`יומן עם טלפונים ${monthHe(t.m)} ${yearLabel(t.y).replace(/^תש/, '')}`, '', { cols: [{ t: 'טלפון', ltr: true }], rows: ids.map((id) => ({ id, cells: [X.pById(id)?.il_phone || ''] })), twoUp: true });
}

// =====================================================================
// ⚙️ הגדרות: סדרים, לוח, תעריף לאברכים (נאר בעלים / מנהל)
// =====================================================================
export function settingsHtml() {
  const { h } = X;
  const s = X.st.settings || {};
  return `<h3>🗓 הגדרות יומנים</h3>
    <form class="ms-set" autocomplete="off">
      <label>לוח (פרשת השבוע) <select name="calendar"><option value="il"${il() ? ' selected' : ''}>ארץ ישראל</option><option value="chul"${il() ? '' : ' selected'}>חוץ לארץ</option></select></label>
      <label>תעריף לשעה לאברכים (לא חובה) <input name="avreich_rate" type="number" min="0" step="0.5" dir="ltr" value="${h(s.avreich_rate || '')}"></label>
      <table class="ms-table ms-sedarim"><thead><tr><th>סדר</th><th>השתתפות</th><th>חברותות</th><th>ימים · משבצות (1 / 2 = תחילה וסוף)</th><th></th></tr></thead><tbody>
        ${(s.sedarim || []).map((x, i) => sederRow(x, i)).join('')}
      </tbody></table>
      <div class="actions"><button type="button" class="btn" id="ms-sed-add">➕ סדר</button><span class="spacer"></span><button type="submit" class="btn primary">💾 שמירת ההגדרות</button></div>
    </form>`;
}
function sederRow(x, i) {
  const { h } = X;
  return `<tr data-i="${i}"><td><input name="name" value="${h(x.name || '')}"><input type="hidden" name="key" value="${h(x.key || '')}"></td>
    <td class="c"><input type="checkbox" name="att"${x.att ? ' checked' : ''}></td>
    <td class="c"><input type="checkbox" name="chav"${x.chav ? ' checked' : ''}></td>
    <td class="ms-days">${DAYS.slice(0, 6).map((d, j) => { const n = (x.days || []).includes(j) ? slotsOn(x, j) : 0; return `<label class="ms-dsel">${d} <select name="d${j}">${[[0, '—'], [1, '1'], [2, '2']].map(([v, l]) => `<option value="${v}"${v === n ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`; }).join('')}
      <button type="button" class="linkish small" data-same title="כל הימים כמו יום א'">= הכל כמו א'</button></td>
    <td><button type="button" class="linkish" data-del>🗑</button></td></tr>`;
}
export function wireSettings(root) {
  const form = X.$('.ms-set', root);
  if (!form) return;
  const tb = X.$('.ms-sedarim tbody', form);
  const wireDel = () => {
    X.$$('[data-del]', tb).forEach((b) => { b.onclick = () => b.closest('tr').remove(); });
    // "= הכל כמו א'": כל הימים וואס זענען אנגעצייכנט — אזויפיל משבצות ווי זונטאג
    X.$$('[data-same]', tb).forEach((b) => { b.onclick = () => { const tr = b.closest('tr'); const v0 = tr.querySelector('[name=d0]').value; [1, 2, 3, 4, 5].forEach((j) => { const sl = tr.querySelector(`[name=d${j}]`); if (sl.value !== '0') sl.value = v0; }); }; });
  };
  wireDel();
  X.$('#ms-sed-add', form).onclick = () => { tb.insertAdjacentHTML('beforeend', sederRow({ name: '', att: true, slots: 1, chav: false, days: [0, 1, 2, 3, 4] }, tb.children.length)); wireDel(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const list = X.$$('tr', tb).map((tr, i) => {
      const v = (n) => tr.querySelector(`[name=${n}]`);
      const name = X.S(v('name').value);
      const per = [0, 1, 2, 3, 4, 5].map((j) => Number(v(`d${j}`).value) || 0);
      const days = [0, 1, 2, 3, 4, 5].filter((j) => per[j] > 0);
      const slotsBy = Object.fromEntries(days.map((j) => [j, per[j]]));
      return name ? { key: X.S(v('key').value) || `s${Date.now().toString(36)}${i}`, name, att: v('att').checked, chav: v('chav').checked, slots: Math.max(1, ...days.map((j) => per[j])), slotsBy, days } : null;
    }).filter(Boolean);
    if (!list.length) { X.toast('צריך לפחות סדר אחד.', 'err'); return; }
    try {
      const r = await X.call(X.KEY, 'settingsSave', { settings: { sedarim: list, calendar: form.elements.calendar.value, avreich_rate: form.elements.avreich_rate.value } });
      X.st.settings = r.settings; X.toast('ההגדרות נשמרו.');
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}
