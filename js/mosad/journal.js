// אתר פון א מוסד — יומנים: 🤝 חברותות, ✅ השתתפות (מיט ⏱ כניסה/יציאה פון אברכים), 🏥 ביטוח בריאות, 📞 יומן מיט טעלעפאנען.
// אלעס ווערט געדרוקט ווי די דפים פון דער ישיבה: צוויי זיילן מיט נומערירטע נעמען, "פרשת ...", טעג א–ה.
// דער לוח (פרשיות) — לויט די הגדרות פונעם מוסד (ארץ ישראל / חוץ לארץ).
import { downloadXlsx } from '../excel.js?v=653';
import { colFilters } from '../sorttables.js?v=653';
import { todayIso, isoToHebrewText, toHebrew, fromHebrew, monthHe, yearLabel } from '../hebdate.js?v=653';
import { shabbatTitle, shabbatOfWeek } from '../parasha.js?v=653';
import { loadSchool, schoolLoaded, activeStudents, zmanim, currentZman } from './school.js?v=671';
import { letterhead, heShort } from './brand.js?v=671';
import { dayInfo, rulesOf } from './hdays.js?v=671';

let X = null;
export function initJournal(ctx) { X = ctx; }
const J = { seder: '', week: '', zman: '', chav: null, att: {}, hours: null, ins: null, mode: '', month: '' };
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MARKS = ['', 'v', 'l']; // ריק (= חסר) → ✓ → ⏰ → ריק. ✗ ישן (מלפני) נשאר כמו שהוא — לחיצה עליו → ✓
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
// 🎯 בחור שנמצא רק בסדרים מסוימים (Settings: seder_only = { id: [keys] }) — אצל כל השאר: כל הסדרים
const onlyMap = () => { try { return JSON.parse(X.st.settings?.seder_only || '{}') || {}; } catch { return {}; } };
/** סדר שבו 2 המשבצות = הגעה בזמן + השתתפות (במקום תחילה וסוף) */
const slotLbl = (seder, b) => (seder.split ? (b ? 'השתתפות' : 'בזמן') : (b ? '2' : '1'));
const inSeder = (id, key) => { const m = onlyMap()[String(id)]; return !m || !m.length || m.includes(String(key).replace(/:exam$/, '')); };
const stipOf = (s, dow) => (dow === 6 && Number(s.stipShab) > 0 ? Number(s.stipShab) : Number(s.stip) || 0);
const hasStip = (s) => Number(s.stip) > 0 || Number(s.stipShab) > 0 || tiersOf(s).length > 0;
/** 🏅 מדרגות לשבוע: [{n, amt}] — לפי כמה פעמים השתתף בשבוע (א'–ש', נסגר במוצאי שבת), מהגבוה לנמוך */
function tiersOf(s) { return (Array.isArray(s.tiers) ? s.tiers : []).map((t) => ({ n: Number(t.n) || 0, amt: Number(t.amt) || 0 })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n); }
const parseTiers = (txt) => String(txt || '').split(/[,،;\n]+/).map((x) => x.match(/(\d+)\s*[=:→-]\s*(\d+(?:\.\d+)?)/)).filter(Boolean).map((m) => ({ n: Number(m[1]), amt: Number(m[2]) }));
const tiersTxt = (s) => tiersOf(s).slice().reverse().map((t) => `${t.n}=${t.amt}`).join(', ');
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
  .cols > div { flex: 1; min-width: 0; }
  #pl table { width: auto; max-width: none; font-size: var(--fz0, 12.5px); }
  #pl td, #pl th { height: var(--rh, 18px); }
  #pl td.nm, #pl td.tx { white-space: nowrap; }
  #pl td.ek { width: var(--ekw, 17px); min-width: var(--ekw, 17px); padding-left: 1px; padding-right: 1px; }
  #pl th.ek { padding-left: 2px; padding-right: 2px; }
  .bar .cset { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .bar .cset label { white-space: nowrap; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  th, td { border: 1px solid #c9bfa8; padding: 3px 6px; height: 18px; }
  th { background: #f1ead8; font-weight: 700; color: #3a3220; border-bottom: 2px solid #b8913c; }
  tbody tr:nth-child(even) td { background: #faf7ef; }
  td.n, th.n { width: 24px; text-align: center; color: #8a7d62; font-size: 11px; }
  td.nm { font-weight: 500; white-space: nowrap; }
  td.c, th.c { min-width: 22px; text-align: center; }
  td.mk, th.mk { width: 17px; min-width: 17px; } /* משבצת סימון ביומן השתתפות: מינימום 1.5 תווים */
  td.t, th.t { width: 44px; text-align: center; }
  .muted { color: #6b6150; font-size: 11px; }
  .foot { margin-top: 4mm; font-size: 10px; color: #8a7d62; text-align: left; }
  @media print { .bar { display: none; } .page { padding: 0; } tbody tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  /* 📏 כווץ לעמוד A4 אחד */
  body.fit .page { padding: 0; margin: 0 auto; box-sizing: border-box; font-size: var(--fz); }
  body.fit table { font-size: var(--fz); }
  body.fit th, body.fit td { padding: var(--padv) var(--pad); line-height: var(--lnh, 1.15); }
  body.fit #pl table { font-size: var(--fz); }
  body.fit th, body.fit td { height: auto; } body.fit #pl td { height: calc(var(--rh, 18px) * var(--fz-k, 1)); }
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
      if (!cb.checked) { ['--fz', '--lhh', '--pad', '--padv', '--lnh', '--fz-k'].forEach((k) => R.removeProperty(k)); pg.style.width = ''; note.textContent = ''; if (window.__cols) window.__cols(); return; }
      pg.style.width = W + 'px';
      let fz = 9.5;
      for (let i = 0; i < 40; i += 1) {
        R.setProperty('--fz', fz + 'pt'); R.setProperty('--fz-k', String(Math.min(1, fz / 9.5))); if (window.__cols) window.__cols(); R.setProperty('--lhh', Math.max(12, 30 * (fz - 3.5) / 6) + 'mm'); R.setProperty('--lnh', fz < 7 ? '1.05' : '1.15'); R.setProperty('--pad', (fz >= 8 ? 4 : fz >= 6.5 ? 2 : 1) + 'px'); R.setProperty('--padv', (fz >= 8 ? 1 : 0) + 'px');
        if ((pg.scrollHeight <= H && pg.scrollWidth <= W + 1) || fz <= 5.5) break;
        fz = Math.max(5.5, Math.round((fz - 0.25) * 100) / 100);
      }
      note.textContent = pg.scrollHeight <= H ? ' (' + fz + ')' : ' (גם בגודל 5.5 לא נכנס — ימשיך לעמוד שני)';
    }
    cb.onchange = apply; window.__refit = () => { if (cb.checked) apply(); };
    // ברירת מחדל: כווץ לעמוד A4 אחד
    cb.checked = true; apply();
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
  // עמודה ריקה (לסימון / לכתיבה ביד): משבצת mk, אדער קיין איין ווערט אין דער גאנצער שפאלט
  D.cols.forEach((c, j) => { c.ek = /\bmk\b/.test(c.c) || D.rows.every((r) => !String(r.v[j] || '').trim()); });
  D.key = `plset:${X.KEY}:${cols.map((c) => c.t).join('|')}`;
  const sel = (id, lbl, o) => `<label>${lbl} <select id="${id}">${o.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
  // הגדרות קבועות (לפי הישיבה): A4 אחד, 2 טורים, משבצת בינונית, אות רגילה, שורה מרווחת, כל העמודות — רק הסינון נשאר לבחירה
  const anyEk = D.cols.some((c) => c.ek);
  const fopts = cols.map((c, i) => `<option value="f${i}">רק מי שמלא — ${X.h(c.t)}</option><option value="e${i}">רק מי שריק — ${X.h(c.t)}</option>`).join('');
  const bar = `<label>להציג: <select id="pf"><option value="-1">כולם</option>${fopts}</select></label>
    <span hidden><input type="checkbox" id="p2" checked>
    ${anyEk ? sel('pw', '', [['30', 'בינונית']]) : ''}
    ${sel('pz', '', [['12.5', 'רגילה']])}
    ${sel('ph', '', [[anyEk ? '26' : '18', '']])}</span>`;
  const script = `<script>
    const D = ${JSON.stringify(D).replace(/</g, '\\u003c')};
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const $ = (id) => document.getElementById(id); const R = document.documentElement.style;
    let hid = new Set();
    const ST = { load() { try { return JSON.parse(window.opener?.localStorage.getItem(D.key) || localStorage.getItem(D.key) || '{}') || {}; } catch (e) { return {}; } },
      save(o) { const t = JSON.stringify(o); try { (window.opener || window).localStorage.setItem(D.key, t); } catch (e) { /* */ } } };
    // ראשי עמודות (גם מיט כמה שורות / colspan): וועלכע דאטן־שפאלטן דעקט יעדע תא, כדי צו באהאלטן עמודות
    function headHtml() {
      const n = D.head.length; const C = D.cols.length; const occ = D.head.map(() => new Array(C).fill(false));
      return D.head.map((row, i) => { let col = 0; const cells = row.map((h) => {
          while (col < C && occ[i][col]) col += 1;
          const cs = h.cs > 1 ? h.cs : 1; const rs = h.rs > 1 ? h.rs : 1; const from = col;
          for (let r = i; r < Math.min(n, i + rs); r += 1) for (let k = from; k < from + cs && k < C; k += 1) occ[r][k] = true;
          col += cs;
          let vis = 0; let allEk = true; for (let k = from; k < from + cs && k < C; k += 1) if (!hid.has(k)) { vis += 1; if (!D.cols[k].ek) allEk = false; }
          if (!vis) return '';
          return '<th class="' + (h.c || 'c') + (allEk && cs === 1 ? ' ek' : '') + '"' + (vis > 1 ? ' colspan="' + vis + '"' : '') + (rs > 1 ? ' rowspan="' + rs + '"' : '') + '>' + esc(h.t) + '</th>';
        }).join('');
        return '<tr>' + (i === 0 ? '<th class="n" rowspan="' + n + '">#</th><th rowspan="' + n + '">שם</th>' : '') + cells + '</tr>'; }).join('');
    }
    function tbl(list, off) {
      return '<table><thead>' + headHtml() + '</thead><tbody>' + list.map((r, i) => '<tr><td class="n">' + (off + i + 1) + '</td><td class="nm">' + esc(r.n) + '</td>'
        + r.v.map((v, j) => (hid.has(j) ? '' : '<td class="' + D.cols[j].c + (D.cols[j].ek ? ' ek' : ' tx') + '"' + (D.cols[j].ltr ? ' dir="ltr"' : '') + '>' + esc(v) + '</td>')).join('') + '</tr>').join('') + '</tbody></table>';
    }
    // דער רוחב פון די ריקע משבצות: פון 17px ביז דער גרייס וואס מ'האט אויסגעוועלט — לויט וויפל פלאץ עס בלייבט אין דער ברייט
    window.__cols = function () {
      const max = Number(($('pw') || {}).value || 17);
      document.querySelectorAll('#pl table').forEach((t) => {
        const k = D.cols.filter((c, j) => c.ek && !hid.has(j)).length; if (!k) return;
        t.style.setProperty('--ekw', '17px');
        const room = t.parentElement.clientWidth - t.offsetWidth;
        t.style.setProperty('--ekw', Math.max(17, Math.min(max, 17 + Math.floor(room / k))) + 'px');
      });
    };
    function draw() {
      const fv = $('pf').value; const two = $('p2').checked;
      hid = new Set([...document.querySelectorAll('.pv')].filter((c) => !c.checked).map((c) => Number(c.value)));
      R.setProperty('--fz0', $('pz').value + 'px'); R.setProperty('--rh', $('ph').value + 'px');
      const fi = fv === '-1' ? -1 : Number(fv.slice(1)); const fe = fv[0] === 'e';
      const list = fi < 0 ? D.rows : D.rows.filter((r) => (fe ? !String(r.v[fi] || '').trim() : !!String(r.v[fi] || '').trim()));
      const half = Math.ceil(list.length / 2);
      $('pl').innerHTML = two && list.length > 1 ? '<div class="cols"><div>' + tbl(list.slice(0, half), 0) + '</div><div>' + tbl(list.slice(half), half) + '</div></div>' : tbl(list, 0);
      $('pc').textContent = list.length + ' / ' + D.rows.length;
      window.__cols();
      if (window.__refit) window.__refit();
    }
    function store() { ST.save({ two: $('p2').checked, pw: ($('pw') || {}).value, pz: $('pz').value, ph: $('ph').value, hid: [...hid] }); }
    (function init() { /* הגדרות קבועות — לא נשמרות */ })();
    ['pf'].forEach((id) => { if ($(id)) $(id).onchange = () => { draw(); }; });
    document.querySelectorAll('.pv').forEach((c) => { c.onchange = () => { draw(); store(); }; });
    draw();
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
  const ids = students().filter((id) => inSeder(id, seder.key)); // 🎯 בחור לסדר מסוים — רק בסדרים שלו
  const rowOf = (id) => J.chav.rows.find((r) => r.seder === seder.key && String(r.contact_id) === String(id));
  const partnerTxt = (r) => (r ? (r.partner_id ? full(r.partner_id) || `#${r.partner_id}` : r.partner_text) : '');
  const label = (id) => (X.pById(id) ? `${X.nameOf(X.pById(id))} (#${id})` : '');
  const zs = [...new Set([...zmanim().slice(0, 6).map((z) => z.label), ...(J.chav.zmanim || []), J.zman].filter(Boolean))];
  const others = X.st.people.filter((p) => (p.kinds || [p.kind]).some((k) => ['student', 'avreich', 'staff', 'other'].includes(k)) && inSeder(p.contact_id, seder.key)).sort((a, b) => X.nameOf(a).localeCompare(X.nameOf(b), 'he'));
  box.innerHTML = `<h2 class="ms-h">🤝 חברותות <span class="jc-cur">${h(seder.name)}</span></h2>
    <div class="ms-bar">
      <label>זמן <select id="jc-zman">${zs.map((z) => `<option${z === J.zman ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
      <div class="seg jc-seg">${ss.map((s) => `<button type="button" data-seder="${h(s.key)}" class="${s.key === seder.key ? 'on' : ''}">${h(s.name)}</button>`).join('')}</div>
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
  // 💰 מלגות — דף בפני עצמו; 🧹 ימי עבודה — במשכורות
  const tabs = [...ss.map((s) => [s.key, s.name]), ['_hours', '⏱ אברכים — כניסה ויציאה'], ['_sum', '📊 סיכום חודשי'], ['_person', '👤 לפי בחור'],
    ...(ss.some((s) => s.exam?.on) ? [['_exam', '📝 מבחנים']] : [])];
  if (!tabs.some(([k]) => k === J.seder)) J.seder = tabs[0][0];
  try { await needSchool(); } catch (err) { fail(box, err); return; }
  const head = `<h2 class="ms-h">✅ השתתפות</h2>
    <nav class="ms-subtabs">${tabs.map(([k, l]) => `<button type="button" data-tab="${h(k)}" class="${k === J.seder ? 'on' : ''}">${h(l)}</button>`).join('')}
      <span class="spacer"></span>${X.can('attendance') ? '<button type="button" class="linkish" id="ja-only">🎯 בחור לסדר מסוים</button>' : ''}</nav>`;
  const body = document.createElement('div');
  box.innerHTML = head; box.append(body);
  X.$$('[data-tab]', box).forEach((b) => { b.onclick = () => { if (J.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return; J.dirty = false; J.seder = b.dataset.tab; renderAtt(box); }; });
  X.$('#ja-only', box)?.addEventListener('click', () => onlyDialog(() => renderAtt(box)));
  if (J.seder === '_hours') return renderHours(body);
  if (J.seder === '_sum') return renderSum(body);
  if (J.seder === '_person') return renderPerson(body);
  if (J.seder === '_exam') return renderExam(body);
  const sd = ss.find((s) => s.key === J.seder);
  if (sd?.cal) return renderCal(body, sd);
  return renderWeek(body, sd);
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
  const ids = students(isoAdd(sun, 4)).filter((id) => inSeder(id, seder.key));
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
    <p class="muted small">לחיצה על משבצת: ✓ נוכח → ⏰ איחור → ריק. משבצת ריקה = חסר (ביום שהתקיים בו הסדר — כלומר מישהו סומן בו). יום שאף אחד לא סומן בו לא נחשב.${two ? (seder.split ? ' "בזמן" = הגיע בזמן · "השתתפות" = השתתף בסדר. בסיכום החודשי — אחוז נפרד לכל אחד. ✓ בהשתתפות כש"בזמן" ריק — "בזמן" מסומן אוטומטית ⏰ איחור.' : ' 1 / 2 = תחילת הסדר וסוף הסדר. ✓ ב-2 כש-1 ריק — 1 מסומן אוטומטית ⏰ איחור.') : ''} אפשר גם "✓ לכולם" ביום.</p>
    <div class="ms-wrap"><table class="ms-table ja-table"><thead>
      <tr><th rowspan="${two ? 2 : 1}">#</th><th rowspan="${two ? 2 : 1}">שם</th><th rowspan="${two ? 2 : 1}">משפחה</th>${days.map((d) => `<th colspan="${slotsOn(seder, d)}"${two && slotsOn(seder, d) < 2 ? ' rowspan="2"' : ''} class="c">${DAYS[d]}<div class="muted small">${fmtDay(isoAdd(sun, d))}</div>${edit ? `<button type="button" class="linkish small" data-all="${d}">✓ לכולם</button>` : ''}</th>`).join('')}</tr>
      ${two ? `<tr>${days.filter((d) => slotsOn(seder, d) > 1).map(() => `<th class="c small">${slotLbl(seder, 0)}</th><th class="c small">${slotLbl(seder, 1)}</th>`).join('')}</tr>` : ''}
    </thead><tbody>${ids.map((id, i) => `<tr><td class="num">${i + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
      ${keys.map((k) => `<td class="c"><button type="button" class="ja-cell m-${marks[id][k] || 'e'}" data-id="${h(id)}" data-k="${k}"${edit ? '' : ' disabled'}>${MARK_TXT[marks[id][k]] || ''}</button></td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
  wireWeek(body, () => renderWeek(body, seder));
  const saveBtn = X.$('#ja-save', body);
  const changed = new Set();
  const setCell = (b, v) => { marks[b.dataset.id][b.dataset.k] = v; if (!v) delete marks[b.dataset.id][b.dataset.k]; b.textContent = MARK_TXT[v] || ''; b.className = `ja-cell m-${v || 'e'}`; changed.add(b.dataset.id); J.dirty = true; if (saveBtn) saveBtn.disabled = false; };
  // משבצת 2 ✓ און משבצת 1 איז ליידיג → ער איז געקומען שפעטער: משבצת 1 ווערט ⏰ איחור (מ'קען עס טוישן)
  const lateFirst = (b) => {
    const k = b.dataset.k; if (!k.endsWith('b') || marks[b.dataset.id][k] !== 'v') return;
    const k1 = k.slice(0, -1); if (marks[b.dataset.id][k1]) return;
    const b1 = X.$(`.ja-cell[data-id="${CSS.escape(b.dataset.id)}"][data-k="${k1}"]`, body); if (b1) setCell(b1, 'l');
  };
  X.$$('.ja-cell', body).forEach((b) => { b.onclick = () => { const cur = marks[b.dataset.id][b.dataset.k] || ''; const i = MARKS.indexOf(cur); setCell(b, i < 0 ? 'v' : MARKS[(i + 1) % MARKS.length]); lateFirst(b); }; });
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
    if (two) head.push(days.filter((d) => slotsOn(seder, d) > 1).flatMap(() => [{ t: slotLbl(seder, 0), c: 'c mk' }, { t: slotLbl(seder, 1), c: 'c mk' }]));
    printList(`השתתפות ${seder.name}`, h(weekTitle(sun)), { head, cols: keys.map((k) => ({ t: `${DAYS[Number(k[0])]}${slotsOn(seder, Number(k[0])) > 1 ? ` ${slotLbl(seder, k.endsWith('b'))}` : ''}`, c: 'c mk' })),
      rows: ids.map((id) => ({ id, cells: keys.map((k) => (filled ? MARK_TXT[marks[id][k]] || '' : '')) })), twoUp: keys.length <= 6 });
  };
  X.$('#ja-blank', body).onclick = () => sheet(false);
  X.$('#ja-full', body).onclick = () => sheet(true);
  X.$('#ja-xl', body).onclick = () => downloadXlsx(`השתתפות ${seder.name} - ${weekTitle(sun)}`, ['#', 'שם', 'משפחה', ...keys.map((k) => `${DAYS[Number(k[0])]}${slotsOn(seder, Number(k[0])) > 1 ? ` ${slotLbl(seder, k.endsWith('b'))}` : ''}`)],
    ids.map((id, i) => [i + 1, first(id), last(id), ...keys.map((k) => MARK_TXT[marks[id][k]] || '')]), { rtl: true });
}

// ---------- 📊 סיכום חודשי (חודש עברי) ----------
// סדר שהתקיים = יום+סדר שבו סומן לפחות בחור אחד. אצל כל בחור: נכח (✓ או ⏰ באחת המשבצות) / חסר (ריק או ✗) מתוך הסדרים שהתקיימו.
// האחוז = נכח ÷ סדרים שהתקיימו; ⏰ = הגיע באיחור (נספר כנוכח, ומוצג בנפרד). אחוז כולל = כל הסדרים ביחד.
async function attMonth(mon, ss) {
  const rows = (await X.call(X.KEY, 'att', { from: sundayOf(mon.from), to: mon.to })).rows;
  const ids = students(mon.to < todayIso() ? mon.to : todayIso());
  const held = {}; // seder → Set(day)
  const got = {}; // id → seder → day → [marks]
  const slot = {}; // id → seder → day → { a, b } (לסדר "בזמן + השתתפות")
  ss.forEach((s) => { held[s.key] = new Set(); });
  rows.forEach((r) => {
    if (!held[r.seder]) return;
    Object.entries(parseMarks(r.marks)).forEach(([k, v]) => {
      if (!v) return;
      const day = isoAdd(r.week, Number(k[0])); if (day < mon.from || day > mon.to) return;
      held[r.seder].add(day);
      const g = (((got[r.contact_id] ||= {})[r.seder] ||= {})[day] ||= []); g.push(v);
      (((slot[r.contact_id] ||= {})[r.seder] ||= {})[day] ||= {})[k.endsWith('b') ? 'b' : 'a'] = v;
    });
  });
  const cache = {}; const onDay = (d) => (cache[d] ||= new Set(students(d).map(String)));
  const cnt = {};
  ids.forEach((id) => {
    cnt[id] = { _all: { held: 0, here: 0, late: 0 } };
    ss.forEach((s) => {
      const c = { held: 0, here: 0, late: 0, oh: 0, ot: 0 };
      if (!inSeder(id, s.key)) { cnt[id][s.key] = c; return; } // 🎯 לא בסדר הזה — לא נחשב כלל
      held[s.key].forEach((day) => {
        if (!onDay(day).has(String(id))) return; // לא היה בישיבה ביום הזה
        c.held += 1;
        const a = got[id]?.[s.key]?.[day] || [];
        if (s.split && slotsOn(s, new Date(`${day}T12:00:00Z`).getUTCDay()) > 1) {
          // "בזמן" = משבצת 1 ✓ · "השתתפות" = משבצת 2 ✓/⏰
          const x = slot[id]?.[s.key]?.[day] || {};
          c.oh += 1; if (x.a === 'v') c.ot += 1;
          if (x.b === 'v' || x.b === 'l') c.here += 1;
          return;
        }
        if (a.some((v) => v === 'v' || v === 'l')) { c.here += 1; if (a.includes('l')) c.late += 1; }
      });
      cnt[id][s.key] = c;
      cnt[id]._all.held += c.held; cnt[id]._all.here += c.here; cnt[id]._all.late += c.late;
    });
  });
  return { ids, cnt, held };
}
const attPct = (c) => (c && c.held ? Math.round((c.here / c.held) * 100) : '');
const otPct = (c) => (c && c.oh ? Math.round((c.ot / c.oh) * 100) : '');
async function renderSum(body) {
  const { h } = X;
  const months = hebMonths();
  if (!months.some((m) => m.key === J.sumMon)) J.sumMon = months[0]?.key;
  const mon = months.find((m) => m.key === J.sumMon);
  const ss = sedarim().filter((s) => s.att);
  body.innerHTML = '<p class="muted">טוען…</p>';
  let D;
  try { D = await attMonth(mon, ss); } catch (err) { fail(body, err); return; }
  const { ids, cnt, held } = D;
  const txt = (c) => (c.held ? `${c.here}/${c.held}${c.late ? ` ⏰${c.late}` : ''} · ${attPct(c)}%${c.oh ? ` | בזמן ${c.ot}/${c.oh} · ${otPct(c)}%` : ''}` : '—');
  body.innerHTML = `<div class="ms-bar"><label>חודש <select id="js-mon">${months.map((m) => `<option value="${h(m.key)}"${m.key === mon.key ? ' selected' : ''}>${h(m.label)}</option>`).join('')}</select></label><span class="spacer"></span>
      <button type="button" class="btn" id="js-print">🖨 הדפסה</button><button type="button" class="btn" id="js-xl">⬇ Excel</button></div>
    <p class="muted small">${h(mon.label)}: ${h(isoToHebrewText(mon.from))} – ${h(isoToHebrewText(mon.to))}. סדרים שהתקיימו: ${ss.map((s) => `${h(s.name)} ${held[s.key].size}`).join(' · ')}.<br>
      בכל סדר: נכח / מתוך הסדרים שהתקיימו (ביום שאף אחד לא סומן — לא נחשב) · ⏰ איחורים · אחוז. "כולל" = כל הסדרים ביחד.${ss.some((s) => s.split) ? ' בסדר עם "בזמן + השתתפות": האחוז הראשון = השתתפות, "בזמן" = אחוז ההגעה בזמן.' : ''}</p>
    <div class="ms-wrap"><table class="ms-table col-filter" data-fkey="attsum"><thead><tr><th>#</th><th>שם</th>${ss.map((s) => `<th class="c">${h(s.name)}</th>`).join('')}<th class="c">כולל</th></tr></thead><tbody>
      ${ids.map((id, i) => `<tr><td class="num">${i + 1}</td><td>${h(full(id))}</td>${ss.map((s) => { const c = cnt[id][s.key]; const p = attPct(c); return `<td class="c small${p !== '' && p < 80 ? ' ms-owe' : ''}" data-v="${p}">${h(txt(c))}</td>`; }).join('')}
        <td class="c${attPct(cnt[id]._all) !== '' && attPct(cnt[id]._all) < 80 ? ' ms-owe' : ''}" data-v="${attPct(cnt[id]._all)}"><b>${attPct(cnt[id]._all) !== '' ? `${attPct(cnt[id]._all)}%` : '—'}</b></td></tr>`).join('')}
    </tbody></table></div>`;
  colFilters(body);
  X.$('#js-mon', body).onchange = (e) => { J.sumMon = e.target.value; renderSum(body); };
  const title = `סיכום השתתפות ${mon.label}`;
  X.$('#js-print', body).onclick = () => printList(title, '', { cols: [...ss.map((s) => ({ t: s.name, c: 'c' })), { t: 'כולל', c: 'c' }],
    rows: ids.map((id) => ({ id, cells: [...ss.map((s) => (cnt[id][s.key].held ? txt(cnt[id][s.key]) : '')), attPct(cnt[id]._all) !== '' ? `${attPct(cnt[id]._all)}%` : ''] })), twoUp: ss.length <= 2 });
  X.$('#js-xl', body).onclick = () => downloadXlsx(title, ['#', 'שם', ...ss.flatMap((s) => [`${s.name} — נכח`, `${s.name} — התקיימו`, `${s.name} — איחורים`, `${s.name} %`, ...(s.split ? [`${s.name} — בזמן`, `${s.name} — בזמן %`] : [])]), 'כולל %'],
    ids.map((id, i) => [i + 1, full(id), ...ss.flatMap((s) => { const c = cnt[id][s.key]; return [c.here, c.held, c.late, attPct(c), ...(s.split ? [c.ot, otPct(c)] : [])]; }), attPct(cnt[id]._all)]), { rtl: true });
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
    rows.filter((r) => String(r.contact_id) === String(J.pId) && !String(r.seder).endsWith(':exam') && r.seder !== '_work').forEach((r) => {
      Object.entries(parseMarks(r.marks)).forEach(([k, v]) => {
        const day = isoAdd(r.week, Number(k[0]));
        if (day < J.pFrom || day > J.pTo) return;
        ((got[day] ||= {})[r.seder] ||= [])[k.endsWith('b') ? 1 : 0] = v;
      });
    });
    // סדר שהתקיים = מישהו (לא דווקא הוא) סומן בו ביום הזה
    const held = {};
    rows.forEach((r) => { Object.entries(parseMarks(r.marks)).forEach(([k, v]) => { if (!v) return; const day = isoAdd(r.week, Number(k[0])); if (day >= J.pFrom && day <= J.pTo) (held[r.seder] ||= new Set()).add(day); }); });
    const dates = [];
    for (let d = J.pFrom; d <= J.pTo && dates.length < 400; d = isoAdd(d, 1)) {
      const dw = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (ss.some((s) => (s.days || []).includes(dw)) || got[d]) dates.push(d);
    }
    const isHeld = (d, s) => !!held[s.key]?.has(d);
    const mk = (v, hd) => MARK_TXT[v] || (hd ? '✗' : '·');
    const cell = (d, s) => { const dw = new Date(`${d}T12:00:00Z`).getUTCDay(); const hd = isHeld(d, s); if (!(s.days || []).includes(dw) && !hd) return '—'; if (!hd) return 'לא התקיים'; const a = got[d]?.[s.key] || []; return slotsOn(s, dw) > 1 ? `${mk(a[0], 1)} ${mk(a[1], 1)}` : mk(a[0], 1); };
    const cnt = Object.fromEntries(ss.map((s) => [s.key, { held: 0, here: 0, late: 0 }]));
    ss.forEach((s) => (held[s.key] ? [...held[s.key]] : []).forEach((d) => { const c = cnt[s.key]; c.held += 1; const a = (got[d]?.[s.key] || []).filter(Boolean); if (a.some((v) => v === 'v' || v === 'l')) { c.here += 1; if (a.includes('l')) c.late += 1; } }));
    const all = ss.reduce((t, s) => ({ held: t.held + cnt[s.key].held, here: t.here + cnt[s.key].here }), { held: 0, here: 0 });
    const dLabel = (d) => `${DAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]}' ${isoToHebrewText(d)}`;
    const sumRow = ss.map((s) => { const c = cnt[s.key]; const p = attPct(c); return c.held ? `${c.here}/${c.held}${c.late ? ` ⏰${c.late}` : ''} · ${p}%` : '—'; });
    const table = `<table class="ms-table"><thead><tr><th>תאריך</th>${ss.map((s) => `<th class="c">${h(s.name)}</th>`).join('')}</tr></thead><tbody>
      ${dates.map((d) => `<tr><td>${h(dLabel(d))}</td>${ss.map((s) => `<td class="c">${h(cell(d, s))}</td>`).join('')}</tr>`).join('')}
      <tr><td><b>סה"כ</b></td>${sumRow.map((x) => `<td class="c"><b>${h(x)}</b></td>`).join('')}</tr>
      <tr><td><b>אחוז כולל</b></td><td class="c" colspan="${ss.length}"><b>${all.held ? `${Math.round((all.here / all.held) * 100)}% (${all.here}/${all.held})` : '—'}</b></td></tr></tbody></table>`;
    out.innerHTML = `<p><b>${h(full(J.pId))}</b> · ${h(isoToHebrewText(J.pFrom))} – ${h(isoToHebrewText(J.pTo))}</p><div class="ms-wrap">${table}</div>
      <p class="muted small">✓ נוכח · ⏰ איחור · ✗ חסר (הסדר התקיים ולא סומן) · "לא התקיים" = אף אחד לא סומן · — אין סדר ביום הזה. האחוז — מתוך הסדרים שהתקיימו.</p>`;
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
  const ids0 = act.filter((e) => !J.insZ || zOf(e) === J.insZ).map((e) => e.contact_id).filter((id) => X.pById(id));
  // 🔎 חיפוש לפי שם (או טלפון)
  const qq = S(J.insQ || '');
  const ids = !qq ? ids0 : ids0.filter((id) => `${full(id)} ${X.pById(id)?.il_phone || ''}`.includes(qq));
  // טלפון האבא: ההורה ברישום, אחרת "בן של" בכרטיס
  const fPhone = (id) => { const e = act.find((x) => String(x.contact_id) === String(id)); const par = (e?.parent_id && X.pById(e.parent_id)) || X.fatherOf(X.pById(id) || {}); return par ? X.phoneOf(par) || '' : ''; };
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
      <input type="search" id="ji-q" placeholder="🔎 חיפוש לפי שם…" value="${h(J.insQ || '')}">
      <label class="small">זמן <select id="ji-z"><option value="">כל הזמנים</option>${zAll.map((z) => `<option${z === J.insZ ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
      <span class="spacer"></span>
      <button type="button" class="btn" id="ji-print">🖨 הדפסה</button><button type="button" class="btn" id="ji-xl">⬇ Excel</button>
    </div>
    <p class="muted small">"לטיפול" = אין קופה / אין מספר חבר / יש חוב / הביטוח נגמר בתוך 30 יום / סומן "לטיפול". הטלפון — הטלפון בארץ (מ"תלמידי הישיבה"); טלפון האבא — של ההורה ברישום; מייל — של האב.</p>
    <div class="ms-wrap"><table class="ms-table col-filter" data-fkey="ins"><thead><tr><th>#</th><th>שם</th><th>משפחה</th><th>טלפון</th><th>טלפון האבא</th><th>מספר חבר</th><th>אימייל הורים</th><th>קופה</th><th>הערות</th><th></th></tr></thead><tbody>
      ${list.map((id, i) => { const r = insOf(id); return `<tr class="${needs(r) ? 'ji-need' : ''}"><td class="num">${i + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
        <td dir="ltr" class="small">${h(X.pById(id)?.il_phone || '')}</td><td dir="ltr" class="small">${h(fPhone(id))}</td><td dir="ltr" class="small">${h(r.member_no || r.policy_no || '')}</td>
        <td dir="ltr" class="small">${h(parentMail(id))}</td><td>${h(r.kupah === 'ביטוח פרטי' ? r.company || r.kupah : r.kupah || '')}</td><td class="small">${h(stat(r))}</td>
        <td>${X.can('insurance') ? `<button type="button" class="btn small-btn" data-ed="${h(id)}">✎</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  X.$$('[data-f]', box).forEach((b) => { b.onclick = () => { J.insFilter = b.dataset.f; renderIns(box); }; });
  X.$('#ji-z', box).onchange = (e) => { J.insZ = e.target.value; renderIns(box); };
  const qi = X.$('#ji-q', box); qi.oninput = () => { J.insQ = qi.value; clearTimeout(J.insT); J.insT = setTimeout(() => { renderIns(box); const x = X.$('#ji-q', box); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 300); };
  X.$$('[data-ed]', box).forEach((b) => { b.onclick = () => insDialog(b.dataset.ed, insOf(b.dataset.ed), box); });
  colFilters(box);
  const cols = (id) => { const r = insOf(id); return [first(id), last(id), X.pById(id)?.il_phone || '', fPhone(id), r.member_no || r.policy_no || '', parentMail(id), r.kupah === 'ביטוח פרטי' ? r.company || r.kupah : r.kupah || '', stat(r)]; };
  X.$('#ji-xl', box).onclick = () => downloadXlsx('ביטוח בריאות', ['#', 'שם', 'משפחה', 'טלפון', 'טלפון האבא', 'מספר חבר', 'אימייל הורים', 'קופה', 'הערות'], list.map((id, i) => [i + 1, ...cols(id)]), { rtl: true });
  X.$('#ji-print', box).onclick = () => printList(`ביטוח בריאות${J.insZ ? ` — ${J.insZ}` : ''}`, h(isoToHebrewText(todayIso())), {
    cols: [{ t: 'טלפון', ltr: true }, { t: 'טלפון האבא', ltr: true }, { t: 'מספר חבר', ltr: true }, { t: 'אימייל הורים', ltr: true }, { t: 'קופה' }, { t: 'הערות' }],
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
// 📝 מבחנים שבועיים (למשל סדר שלישי) — נשמר כ"השתתפות" מיט סדר "<key>:exam", marks = { s: ציון }
// =====================================================================
const examSed = () => sedarim().filter((s) => s.att && s.exam?.on);
// מבחן: "fixed" = סכום קבוע לכל מבחן (כל ציון); "min" = רק מציון מינימלי ומעלה
const examPass = (s, v) => {
  const x = String(v ?? '').trim(); if (!x) return null;
  if (/^(x|✗|לא|נכשל|-)$/i.test(x)) return false;
  if (s.exam?.mode === 'fixed' || !Number.isFinite(Number(x))) return true;
  return Number(x) >= (Number(s.exam?.min) || 0);
};
const HDAYS = [0, 1, 2, 3, 4]; // הספק יומי: א'–ה'
const hesOf = (m) => HDAYS.filter((d) => m[`h${d}`]);
async function renderExam(body) {
  const { h } = X;
  const ss = examSed();
  if (!ss.length) { body.innerHTML = '<p class="ms-note">אין סדר עם מבחן שבועי. (⚙️ הגדרות → 💰 מלגות)</p>'; return; }
  if (!ss.some((s) => s.key === J.examSeder)) J.examSeder = ss[0].key;
  const s = ss.find((x) => x.key === J.examSeder);
  const sun = J.week;
  body.innerHTML = '<p class="muted">טוען…</p>';
  let rows;
  try { rows = await attRows(sun); } catch (err) { fail(body, err); return; }
  const key = `${s.key}:exam`;
  const ids = students(isoAdd(sun, 4)).filter((id) => inSeder(id, s.key));
  const chk = s.exam?.mode === 'check'; const hes = !!s.exam?.hespek;
  const M = {}; ids.forEach((id) => { M[id] = parseMarks(rows.find((r) => r.seder === key && String(r.contact_id) === String(id))?.marks); });
  const val = (id) => M[id].s ?? '';
  const edit = X.can('attendance');
  const amt = Number(s.exam?.amount) || 0;
  const DN = ['א', 'ב', 'ג', 'ד', 'ה'];
  body.innerHTML = `${weekBar(sun)}
      ${ss.length > 1 ? `<div class="seg">${ss.map((x) => `<button type="button" data-ex="${h(x.key)}" class="${x.key === s.key ? 'on' : ''}">${h(x.name)}</button>`).join('')}</div>` : `<b>${h(s.name)}</b>`}
      ${edit ? '<button type="button" class="btn primary" id="je-save" disabled>💾 שמירה</button>' : ''}
      <button type="button" class="btn" id="je-print">🖨 הדפסה</button>
      ${hes ? '<button type="button" class="btn" id="je-hsum">📊 סיכום הספק חודשי</button>' : ''}
    </div>
    <p class="muted small">${chk ? `✓ = המבחן מולא${amt ? ` → ${amt} ₪ מלגה` : ''}; ריק = לא מולא.` : `ציון (מספר), או "עבר" / "לא". ${s.exam?.mode === 'fixed' ? `כל מבחן${amt ? ` → ${amt} ₪ מלגה` : ''} (סכום קבוע)` : `עובר = ציון ${h(s.exam?.min || 0)} ומעלה${amt ? ` → ${amt} ₪ מלגה` : ''}`}. ריק = לא נבחן.`}
      ${hes ? ' הספק: ✓ לכל יום (א\'–ה\') שלמד את ההספק — בלי מלגה, רק לסיכום החודשי.' : ''}</p>
    <div class="ms-wrap"><table class="ms-table"><thead><tr><th>#</th><th>שם</th><th>משפחה</th><th class="c">${chk ? 'המבחן מולא' : 'ציון'}</th>${chk ? '' : '<th class="c"></th>'}
      ${hes ? DN.map((d, k) => `<th class="c">הספק ${d}'<div class="muted small">${fmtDay(isoAdd(sun, k))}</div>${edit ? `<button type="button" class="linkish small" data-hall="${k}">✓ לכולם</button>` : ''}</th>`).join('') : ''}</tr></thead><tbody>
      ${ids.map((id, i) => { const v = val(id); const p = examPass(s, v); return `<tr><td class="num">${i + 1}</td><td>${h(first(id))}</td><td><b>${h(last(id))}</b></td>
        ${chk ? `<td class="c"><input type="checkbox" class="je-ck" data-id="${h(id)}"${v ? ' checked' : ''}${edit ? '' : ' disabled'}></td>`
          : `<td class="c"><input class="je-in" data-id="${h(id)}" value="${h(v)}" style="width:70px" dir="auto"${edit ? '' : ' disabled'}></td><td class="c je-st">${p === null ? '' : p ? '✓' : '✗'}</td>`}
        ${hes ? HDAYS.map((d) => `<td class="c"><input type="checkbox" class="je-h" data-id="${h(id)}" data-d="${d}"${M[id][`h${d}`] ? ' checked' : ''}${edit ? '' : ' disabled'}></td>`).join('') : ''}</tr>`; }).join('')}
    </tbody></table></div>`;
  wireWeek(body, () => renderExam(body));
  X.$$('[data-ex]', body).forEach((b) => { b.onclick = () => { if (J.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return; J.dirty = false; J.examSeder = b.dataset.ex; renderExam(body); }; });
  const saveBtn = X.$('#je-save', body); const changed = new Set();
  const dirty = (id) => { changed.add(id); J.dirty = true; if (saveBtn) saveBtn.disabled = false; };
  X.$$('.je-in', body).forEach((inp) => {
    inp.oninput = () => { M[inp.dataset.id].s = X.S(inp.value); dirty(inp.dataset.id); const p = examPass(s, inp.value); inp.closest('tr').querySelector('.je-st').textContent = p === null ? '' : p ? '✓' : '✗'; };
  });
  X.$$('.je-ck', body).forEach((c) => { c.onchange = () => { M[c.dataset.id].s = c.checked ? 'v' : ''; dirty(c.dataset.id); }; });
  X.$$('.je-h', body).forEach((c) => { c.onchange = () => { if (c.checked) M[c.dataset.id][`h${c.dataset.d}`] = 1; else delete M[c.dataset.id][`h${c.dataset.d}`]; dirty(c.dataset.id); }; });
  X.$$('[data-hall]', body).forEach((a) => { a.onclick = () => X.$$(`.je-h[data-d="${a.dataset.hall}"]`, body).forEach((c) => { if (!c.checked) { c.checked = true; c.onchange(); } }); });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const out = [...changed].map((id) => { const m = { ...M[id] }; if (!X.S(m.s)) delete m.s; return { contact_id: id, marks: JSON.stringify(m) }; });
    try {
      await X.call(X.KEY, 'attSave', { week: sun, seder: key, rows: out });
      out.forEach((r) => { const ex = rows.find((x) => x.seder === key && String(x.contact_id) === String(r.contact_id)); if (ex) ex.marks = r.marks; else rows.push({ week: sun, seder: key, ...r }); });
      changed.clear(); J.dirty = false; X.toast('נשמר.');
    } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  X.$('#je-print', body).onclick = () => printList(`מבחן ${s.name}`, h(weekTitle(sun)), {
    cols: [{ t: chk ? 'מבחן' : 'ציון', c: 'c mk' }, ...(hes ? DN.map((d) => ({ t: `${d}'`, c: 'c mk' })) : [])],
    rows: ids.map((id) => ({ id, cells: [chk ? (val(id) ? '✓' : '') : val(id), ...(hes ? HDAYS.map((d) => (M[id][`h${d}`] ? '✓' : '')) : [])] })), twoUp: true });
  X.$('#je-hsum', body)?.addEventListener('click', () => hespekMonth(s));
}
/** 📊 סיכום הספק לחודש עברי: ימים שלמד ההספק מתוך ימי ההספק שהתקיימו (מישהו סומן בהם) */
async function hespekMonth(s) {
  const { h } = X;
  const months = hebMonths();
  const d = X.dialog(`<h2>📊 סיכום הספק — ${h(s.name)}</h2><label>חודש <select id="hs-mon">${months.map((m) => `<option value="${h(m.key)}">${h(m.label)}</option>`).join('')}</select></label>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" id="hs-go">🖨 הדפסה</button><button type="button" class="btn" id="hs-xl">⬇ Excel</button></div>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  const build = async () => {
    const mon = months.find((m) => m.key === X.$('#hs-mon', d).value);
    const rows = (await X.call(X.KEY, 'att', { from: sundayOf(mon.from), to: mon.to })).rows.filter((r) => r.seder === `${s.key}:exam`);
    const held = new Set(); const got = {};
    rows.forEach((r) => { const m = parseMarks(r.marks); hesOf(m).forEach((dd) => { const day = isoAdd(r.week, dd); if (day < mon.from || day > mon.to) return; held.add(day); (got[r.contact_id] ||= new Set()).add(day); }); });
    const ids = sortIds([...new Set([...students(mon.to < todayIso() ? mon.to : todayIso()), ...Object.keys(got)])].filter((id) => X.pById(id)));
    const n = held.size;
    return { mon, n, ids, cnt: (id) => got[id]?.size || 0 };
  };
  X.$('#hs-go', d).onclick = async () => {
    try { const D = await build(); d.close();
      printList(`סיכום הספק — ${s.name} — ${D.mon.label}`, `ימי הספק שהתקיימו: ${D.n}`, { cols: [{ t: 'ימים', c: 'c' }, { t: '%', c: 'c' }], rows: D.ids.map((id) => ({ id, cells: [`${D.cnt(id)} / ${D.n}`, D.n ? `${Math.round((D.cnt(id) / D.n) * 100)}%` : ''] })), twoUp: true });
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$('#hs-xl', d).onclick = async () => {
    try { const D = await build(); d.close();
      downloadXlsx(`הספק ${s.name} ${D.mon.label}`, ['#', 'שם', 'ימים', 'מתוך', '%'], D.ids.map((id, i) => [i + 1, full(id), D.cnt(id), D.n, D.n ? Math.round((D.cnt(id) / D.n) * 100) : '']), { rtl: true });
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// =====================================================================
// 💰 מלגות: לפי השתתפות בסדרים (₪ לכל ✓) + מבחנים שבועיים — לחודש עברי
// סיכום · פתקים אישיים (למעטפה עם חלון) · הכנת המזומן (שטרות ומטבעות)
// =====================================================================
const DENOMS = [200, 100, 50, 20, 10, 5, 2, 1];
/** דער חודש העברי: { key, label, from, to } — 12 חדשים צוריק */
function hebMonths(n = 12) {
  const out = []; let iso = todayIso();
  for (let i = 0; i < n; i += 1) {
    const hd = toHebrew(iso); if (!hd) break;
    const from = fromHebrew(1, hd.m, hd.y);
    let to = from; while (toHebrew(isoAdd(to, 1))?.m === hd.m) to = isoAdd(to, 1);
    out.push({ key: from, label: `${monthHe(hd.m)} ${yearLabel(hd.y)}`, from, to });
    iso = isoAdd(from, -1);
  }
  return out;
}
const stipSed = () => sedarim().filter((s) => s.att && (hasStip(s) || s.exam?.on));
async function stipData(mon, only) {
  const rows = (await X.call(X.KEY, 'att', { from: sundayOf(mon.from), to: mon.to })).rows;
  const ss = only || stipSed();
  const res = {};
  const get = (id) => (res[id] ||= { cnt: {}, shab: {}, amt: {}, ex: {}, wk: {}, pend: {}, total: 0 });
  const weeks = {}; // 🏅 מדרגות: { contact|seder|week: count }
  const today = todayIso();
  rows.forEach((r) => {
    const isEx = String(r.seder).endsWith(':exam');
    const s = ss.find((x) => x.key === (isEx ? r.seder.slice(0, -5) : r.seder)); if (!s) return;
    const m = parseMarks(r.marks);
    if (isEx) {
      const day = isoAdd(r.week, 4); if (day < mon.from || day > mon.to || !s.exam?.on) return;
      const p = examPass(s, m.s); if (p === null) return;
      const e = (get(r.contact_id).ex[s.key] ||= { n: 0, pass: 0, amt: 0 });
      e.n += 1; if (p) { e.pass += 1; e.amt += Number(s.exam?.amount) || 0; }
      return;
    }
    if (!hasStip(s)) return;
    const byDay = {};
    Object.entries(m).forEach(([k, v]) => { (byDay[k[0]] ||= []).push(v); });
    if (tiersOf(s).length) {
      // שבוע שלם (א'–ש'): שייך לחודש לפי השבת שלו; נחשב רק אחרי מוצאי שבת
      const shab = isoAdd(r.week, 6); if (shab < mon.from || shab > mon.to) return;
      const n0 = Object.values(byDay).filter((arr) => arr.some((v) => v === 'v' || (s.stipLate && v === 'l'))).length;
      const k = `${r.contact_id}|${s.key}|${r.week}`; weeks[k] = (weeks[k] || 0) + n0;
      return;
    }
    Object.entries(byDay).forEach(([d, arr]) => {
      const day = isoAdd(r.week, Number(d)); if (day < mon.from || day > mon.to) return;
      if (arr.some((v) => v === 'v' || (s.stipLate && v === 'l'))) {
        const o = get(r.contact_id); o.cnt[s.key] = (o.cnt[s.key] || 0) + 1;
        if (Number(d) === 6) o.shab[s.key] = (o.shab[s.key] || 0) + 1;
        o.amt[s.key] = (o.amt[s.key] || 0) + stipOf(s, Number(d));
      }
    });
  });
  Object.entries(weeks).forEach(([k, n0]) => {
    const [id, key, wk] = k.split('|'); const s = ss.find((x) => x.key === key); const o = get(id);
    o.cnt[key] = (o.cnt[key] || 0) + n0;
    if (isoAdd(wk, 6) >= today) { o.pend[key] = (o.pend[key] || 0) + 1; return; } // השבוע עוד לא נגמר — עד מוצאי שבת
    const t = tiersOf(s).find((x) => n0 >= x.n);
    if (t) { o.amt[key] = (o.amt[key] || 0) + t.amt; o.wk[key] = (o.wk[key] || 0) + 1; }
  });
  Object.values(res).forEach((o) => { o.total = ss.reduce((t, s) => t + (o.amt[s.key] || 0) + (o.ex[s.key]?.amt || 0), 0); });
  const act = students(mon.to < todayIso() ? mon.to : todayIso());
  const ids = sortIds([...new Set([...act, ...Object.keys(res)])].filter((id) => X.pById(id)));
  return { ids, res, ss, of: (id) => res[id] || { cnt: {}, shab: {}, amt: {}, ex: {}, wk: {}, pend: {}, total: 0 } };
}
/** שטרות און מטבעות: { 20: 4, 5: 4 } */
function breakdown(amount) { const out = {}; let left = Math.round(Number(amount) || 0); DENOMS.forEach((d) => { const n = Math.floor(left / d); if (n) { out[d] = n; left -= n * d; } }); return out; }
const shekel = (n) => `${Math.round(Number(n) * 100) / 100} ₪`;
// ---------- 🎖 סוגי מלגות (Settings: stip_types) — לכל סוג: אילו סדרים, ונוסח פתק משלו ----------
const STIP_TPL = {
  to: ['לכבוד הבה"ח מחשובי תלמידי ישיבתנו הק\'', 'העמל בתוה"ק ממשכימי קום לעבודת הבורא', 'ה"ה {שם} נ"י'],
  bless: 'יה"ר שתזכה להמשיך לעלות מעלה מעלה בעבודת הק\' ותשרה עליך שכינה ויקויים בך הברכות אורך ימים בימינה ובשמאלה עושר וכבוד וכמאמר הגמ\' כל הקובע מקום לתפילתו אלוקי אברהם בעזרו אכי"ר',
  intro: 'בחודש {חודש} השתתפת:',
  amount: 'סכום המלגה: {סכום}',
  quotes: ['"ללמוד גמרא בחול קודם אור היום הוא בבחינת גן עדן התחתון, ובשבת הוא בבחינת גן עדן העליון" (בית אהרן)', 'שעה לימוד התורה בשבת נחשב כאלף שעות בימות החול (ספה"ק)',
    '"ובבאה עם הספר אמר להעביר מחשבתו הרעה" בבאה הנשמה להתפלל עם לימוד התוה"ק היינו בספר וכו\' (תפארת שלמה)',
    'ועבדתם את ה\' אלוקיכם וברך את לחמך ואת מימך והסירותי מחלה מקרבך (שמות כג, כה) ועבדתם את ה\' אלוקיכם היינו תורה ותפילה ברבים (לשון רבים) – וברך את לחמך ואת מימך והסירותי מחלה מקרבך – היינו ישועה פרטית (לשון יחיד)'],
};
function stipTypes() {
  let t = []; try { t = JSON.parse(X.st.settings?.stip_types || '[]') || []; } catch { t = []; }
  const ss = stipSed();
  t = t.map((x) => ({ ...x, sedarim: (x.sedarim || []).filter((k) => ss.some((s) => s.key === k)), tpl: { ...STIP_TPL, ...(x.tpl || {}) } })).filter((x) => x.sedarim.length);
  // ברירת מחדל: כל סדר עם מלגה — סוג בפני עצמו
  if (!t.length) t = ss.map((s) => ({ id: s.key, name: s.name, sedarim: [s.key], tpl: { ...STIP_TPL } }));
  return t;
}
export async function renderStipPage(box) {
  const { h } = X;
  box.innerHTML = '<p class="muted">טוען…</p>';
  try { await needSchool(); } catch (err) { fail(box, err); return; }
  const types = stipTypes();
  if (!types.some((t) => t.id === J.stipType)) J.stipType = types[0]?.id;
  box.innerHTML = `<h2 class="ms-h">🎖 מלגות</h2>
    <nav class="ms-subtabs">${types.map((t) => `<button type="button" data-st="${h(t.id)}" class="${t.id === J.stipType ? 'on' : ''}">${h(t.name)}</button>`).join('')}
      <span class="spacer"></span>${X.isAdmin?.() || X.can('stipends') ? '<button type="button" class="linkish" id="st-types">⚙️ סוגי מלגות ונוסח הפתקים</button>' : ''}</nav><div id="st-body"></div>`;
  X.$$('[data-st]', box).forEach((b) => { b.onclick = () => { J.stipType = b.dataset.st; renderStipPage(box); }; });
  X.$('#st-types', box)?.addEventListener('click', () => stipTypesDialog(() => renderStipPage(box)));
  const type = types.find((t) => t.id === J.stipType);
  return renderStip(X.$('#st-body', box), type);
}
function stipTypesDialog(after) {
  const { h } = X;
  const ss = stipSed();
  if (!ss.length) { X.toast('קודם מגדירים מלגה בסדרים (⚙️ הגדרות).', 'err'); return; }
  let list = stipTypes().map((t) => ({ ...t, tpl: { ...t.tpl } }));
  const d = X.dialog(`<h2>🎖 סוגי מלגות</h2>
    <p class="muted small">לכל סוג מלגה — פתק משלו. סוג עם 2 סדרים (או יותר) = מלגה אחת מאוחדת: שורה לכל סדר באותו פתק, וסכום אחד. בנוסח: {שם} {חודש} {סכום}.</p>
    <div id="stt-list"></div>
    <div class="actions"><button type="button" class="btn" id="stt-add">＋ סוג חדש</button><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" id="stt-save">💾 שמירה</button></div>`);
  const wrap = X.$('#stt-list', d);
  const draw = () => {
    wrap.innerHTML = list.map((t, i) => `<fieldset class="stt" data-i="${i}" style="border:1px solid #ccc;border-radius:8px;padding:8px;margin-bottom:10px">
      <legend><input data-f="name" value="${h(t.name)}" placeholder="שם הסוג (למשל: סדר בוקר)"> <button type="button" class="linkish" data-del="${i}">🗑</button></legend>
      <div>סדרים: ${ss.map((s) => `<label class="check"><input type="checkbox" data-s="${h(s.key)}"${t.sedarim.includes(s.key) ? ' checked' : ''}> ${h(s.name)}</label>`).join(' ')}</div>
      <div class="stt-bg">🖼 בלאנק לפתק: ${X.st.settings?.[`asset:stipbg:${t.id}`] ? '<b>✓ יש בלאנק</b> <button type="button" class="linkish" data-bgrm>הסרה</button>' : '<b class="err-txt">⚠ אין בלאנק — אי אפשר להדפיס פתקים לסוג הזה</b>'}
        <label class="btn small-btn">⬆ העלאת בלאנק (תמונה A4)<input type="file" accept="image/*" data-bgup hidden></label>
        <span class="muted small">תמונה של הדף (JPG / PNG), הטקסט נכתב עליו באמצע.</span></div>
      <details><summary>נוסח הפתק</summary>
        <label>פנייה (שורה לכל שורה)<textarea data-f="to" rows="3">${h(t.tpl.to.join('\n'))}</textarea></label>
        <label>ברכה<textarea data-f="bless" rows="3">${h(t.tpl.bless)}</textarea></label>
        <label>פתיחה<input data-f="intro" value="${h(t.tpl.intro)}"></label>
        <label>שורת סכום (ריק = בלי)<input data-f="amount" value="${h(t.tpl.amount)}"></label>
        <label>מאמרים בסוף (שורה לכל מאמר)<textarea data-f="quotes" rows="4">${h(t.tpl.quotes.join('\n'))}</textarea></label>
        <p class="muted small">השורה של כל סדר: "X פעמים" + הטקסט שבהגדרות הסדר (למשל "בסדר הלימוד לפני התפילה בימות החול").</p>
      </details></fieldset>`).join('');
    X.$$('[data-del]', wrap).forEach((b) => { b.onclick = () => { read(); list.splice(Number(b.dataset.del), 1); draw(); }; });
    X.$$('[data-bgup]', wrap).forEach((inp) => {
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return; read();
        const t = list[Number(inp.closest('.stt').dataset.i)];
        try {
          X.toast('מעלה…');
          const data = await shrinkA4(f);
          const r = await X.call(X.KEY, 'assetSave', { kind: 'stipbg', id: t.id, name: f.name, data });
          X.st.settings = r.settings || X.st.settings; draw(); X.toast('הבלאנק נשמר. (לשמור גם את הסוגים — 💾)');
        } catch (err) { X.toast(X.msg(err), 'err'); }
      };
    });
    X.$$('[data-bgrm]', wrap).forEach((b) => {
      b.onclick = async () => {
        read(); const t = list[Number(b.closest('.stt').dataset.i)];
        try { const r = await X.call(X.KEY, 'assetSave', { kind: 'stipbg', id: t.id, remove: true }); X.st.settings = r.settings || X.st.settings; draw(); } catch (err) { X.toast(X.msg(err), 'err'); }
      };
    });
  };
  const read = () => {
    list = X.$$('.stt', wrap).map((f, i) => { const v = (k) => X.$(`[data-f="${k}"]`, f).value; return { id: list[i].id || `t${Date.now()}${i}`, name: X.S(v('name')) || 'מלגה',
      sedarim: X.$$('[data-s]:checked', f).map((x) => x.dataset.s),
      tpl: { to: v('to').split('\n').map(X.S).filter(Boolean), bless: X.S(v('bless')), intro: X.S(v('intro')), amount: X.S(v('amount')), quotes: v('quotes').split('\n').map(X.S).filter(Boolean) } }; });
  };
  draw();
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => d.close(); });
  X.$('#stt-add', d).onclick = () => { read(); list.push({ id: `t${Date.now()}`, name: '', sedarim: [], tpl: { ...STIP_TPL } }); draw(); };
  X.$('#stt-save', d).onclick = async () => {
    read();
    if (list.some((t) => !t.sedarim.length)) { X.toast('בכל סוג צריך לבחור לפחות סדר אחד.', 'err'); return; }
    try { const r = await X.call(X.KEY, 'stipTypesSave', { types: list }); X.st.settings = r.settings || { ...X.st.settings, stip_types: JSON.stringify(list) }; d.close(); X.toast('נשמר.'); after(); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}
async function renderStip(body, type) {
  const { h } = X;
  const months = hebMonths();
  if (!months.some((m) => m.key === J.stipMon)) J.stipMon = months[0]?.key;
  const mon = months.find((m) => m.key === J.stipMon);
  const ss = type ? stipSed().filter((s) => type.sedarim.includes(s.key)) : stipSed();
  if (!ss.length) { body.innerHTML = '<p class="ms-note">לא הוגדרו מלגות. (⚙️ הגדרות → 💰 מלגות: סכום לכל השתתפות בסדר, ומבחן שבועי)</p>'; return; }
  body.innerHTML = '<p class="muted">טוען…</p>';
  let D;
  try { D = await stipData(mon, ss); } catch (err) { fail(body, err); return; }
  D.tpl = type?.tpl || STIP_TPL;
  const list = D.ids.filter((id) => J.stipAll || D.of(id).total > 0);
  const total = list.reduce((t, id) => t + D.of(id).total, 0);
  const cell = (id, s) => { const o = D.of(id); const parts = []; if (hasStip(s)) parts.push(`${o.cnt[s.key] || 0}${o.shab[s.key] ? ` (ש׳ ${o.shab[s.key]})` : ''}${tiersOf(s).length ? ` · 🏅${o.wk?.[s.key] || 0} שב׳${o.pend?.[s.key] ? ' + ⏳1' : ''}` : ''}`); if (s.exam?.on) parts.push(`📝${o.ex[s.key]?.pass || 0}/${o.ex[s.key]?.n || 0}`); return parts.join(' · '); };
  // ✓ שולם — Settings stippaid:<type>:<month>
  const paidKey = `stippaid:${type?.id || 'all'}:${mon.key}`;
  const paid = (() => { try { return JSON.parse(X.st.settings?.[paidKey] || '{}') || {}; } catch { return {}; } })();
  const canPay = X.can('stipends');
  const paidSum = list.filter((id) => paid[id]).reduce((t, id) => t + D.of(id).total, 0);
  body.innerHTML = `<div class="ms-bar">
      <label>חודש <select id="st-mon">${months.map((m) => `<option value="${h(m.key)}"${m.key === mon.key ? ' selected' : ''}>${h(m.label)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="st-all"${J.stipAll ? ' checked' : ''}> גם מי שלא מגיע לו</label>
      <span class="spacer"></span>
      ${canPay ? '<button type="button" class="btn" id="st-paidall">✓ סמן הכל כשולם</button>' : ''}
      <button type="button" class="btn primary" id="st-notes">✉ פתקי מלגה</button>
      <button type="button" class="btn" id="st-cash">💵 הכנת מזומן</button>
      <button type="button" class="btn" id="st-print">🖨 סיכום</button><button type="button" class="btn" id="st-xl">⬇ Excel</button>
    </div>
    <p class="muted small">${h(mon.label)}: ${h(isoToHebrewText(mon.from))} – ${h(isoToHebrewText(mon.to))}. ${ss.map((s) => `${s.name}: ${tiersOf(s).length ? `🏅 לשבוע: ${tiersOf(s).slice().reverse().map((t) => `${t.n}+ פעמים → ${shekel(t.amt)}`).join(', ')}` : hasStip(s) ? `${shekel(s.stip || 0)} להשתתפות${Number(s.stipShab) > 0 ? ` · שבת ${shekel(s.stipShab)}` : ''}` : ''}${s.exam?.on ? `${hasStip(s) ? ' · ' : ''}מבחן ${shekel(s.exam.amount || 0)}` : ''}`).map(h).join(' · ')}</p>
    <div class="ms-stats"><div class="ms-stat"><span class="muted small">בחורים</span><b>${list.filter((id) => D.of(id).total > 0).length}</b></div><div class="ms-stat"><span class="muted small">סה"כ מלגות</span><b>${h(shekel(total))}</b></div><div class="ms-stat"><span class="muted small">שולם</span><b>${list.filter((id) => paid[id]).length} · ${h(shekel(paidSum))}</b></div><div class="ms-stat"><span class="muted small">נשאר לשלם</span><b>${h(shekel(total - paidSum))}</b></div></div>
    <div class="ms-wrap"><table class="ms-table col-filter" data-fkey="stip"><thead><tr><th>#</th><th>שם</th>${ss.map((s) => `<th class="c">${h(s.name)}</th>`).join('')}<th class="c">סה"כ</th><th class="c">שולם</th></tr></thead><tbody>
      ${list.map((id, i) => `<tr${paid[id] ? ' class="st-paid"' : ''}><td class="num">${i + 1}</td><td>${h(full(id))}</td>${ss.map((s) => `<td class="c small">${h(cell(id, s))}</td>`).join('')}<td class="c"><b>${h(shekel(D.of(id).total))}</b></td>
        <td class="c" data-v="${paid[id] ? 1 : 0}"><label class="check" title="${paid[id] ? h(`${paid[id].at} · ${paid[id].by}`) : ''}"><input type="checkbox" data-paid="${h(id)}"${paid[id] ? ' checked' : ''}${canPay && D.of(id).total > 0 ? '' : ' disabled'}> ${paid[id] ? '✓ שולם' : ''}</label></td></tr>`).join('')}
    </tbody></table></div>
    <p class="muted small">המספר = כמה פעמים השתתף (✓${ss.some((s) => s.stipLate) ? ', ובסדרים המסומנים גם ⏰' : ''}). 📝 = מבחנים שעבר / נבחן.${ss.some((s) => tiersOf(s).length) ? ' 🏅 = שבועות שהגיע בהם למדרגה (כל שבוע בנפרד, א\'–ש\'); ⏳ = השבוע הנוכחי — נחשב רק במוצאי שבת.' : ''}</p>`;
  X.$('#st-mon', body).onchange = (e) => { J.stipMon = e.target.value; renderStip(body, type); };
  const setPaid = async (rowsP) => {
    try { const r = await X.call(X.KEY, 'stipPaidSave', { type: type?.id || 'all', mon: mon.key, rows: rowsP }); X.st.settings = r.settings || X.st.settings; renderStip(body, type); X.toast('נשמר.'); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$$('[data-paid]', body).forEach((c) => { c.onchange = () => setPaid([{ contact_id: c.dataset.paid, paid: c.checked, amt: D.of(c.dataset.paid).total }]); });
  X.$('#st-paidall', body)?.addEventListener('click', () => {
    const todo = list.filter((id) => !paid[id] && D.of(id).total > 0);
    if (!todo.length) { X.toast('הכל כבר מסומן כשולם.'); return; }
    if (!window.confirm(`לסמן ${todo.length} בחורים כשולם?`)) return;
    setPaid(todo.map((id) => ({ contact_id: id, paid: true, amt: D.of(id).total })));
  });
  X.$('#st-all', body).onchange = (e) => { J.stipAll = e.target.checked; renderStip(body, type); };
  const title = `מלגות ${type ? `${type.name} ` : ''}${mon.label}`;
  X.$('#st-print', body).onclick = () => printList(title, '', { cols: [...ss.map((s) => ({ t: s.name, c: 'c' })), { t: 'סה"כ ₪', c: 'c' }], rows: list.map((id) => ({ id, cells: [...ss.map((s) => cell(id, s)), D.of(id).total] })) });
  X.$('#st-xl', body).onclick = () => downloadXlsx(title, ['#', 'שם', ...ss.flatMap((s) => [...(hasStip(s) ? [`${s.name} — השתתפויות`] : []), ...(s.exam?.on ? [`${s.name} — מבחנים שעבר`] : [])]), 'סה"כ ₪', 'שולם'],
    list.map((id, i) => { const o = D.of(id); return [i + 1, full(id), ...ss.flatMap((s) => [...(hasStip(s) ? [o.cnt[s.key] || 0] : []), ...(s.exam?.on ? [o.ex[s.key]?.pass || 0] : [])]), o.total, paid[id] ? 'כן' : '']; }), { rtl: true });
  X.$('#st-cash', body).onclick = () => cashSheet(title, list.filter((id) => D.of(id).total > 0), D);
  X.$('#st-notes', body).onclick = () => stipNotes(mon, list.filter((id) => J.stipAll || D.of(id).total > 0), D, type);
  colFilters(body);
}
/** 💵 וואס צו גרייטן: יעדער בחור מיט זיינע שטרות און מטבעות, און דער סך הכל פון יעדן סארט */
function cashSheet(title, ids, D) {
  const { h } = X;
  const per = ids.map((id) => ({ id, amt: D.of(id).total, b: breakdown(D.of(id).total) }));
  const used = DENOMS.filter((d) => per.some((x) => x.b[d]));
  const tot = Object.fromEntries(used.map((d) => [d, per.reduce((t, x) => t + (x.b[d] || 0), 0)]));
  const sum = per.reduce((t, x) => t + x.amt, 0);
  const kind = (d) => (d >= 20 ? 'שטרות' : 'מטבעות');
  printWin(`הכנת כספי המלגות — ${title.replace(/^מלגות /, '')}`, `${per.length} בחורים · סה"כ ${h(shekel(sum))}`, `
    <h3 style="margin:0 0 6px">להכין:</h3>
    <table style="width:auto;margin-bottom:10px"><thead><tr><th>₪</th><th>כמה</th><th>סה"כ</th></tr></thead><tbody>
      ${used.map((d) => `<tr><td style="text-align:center">${d} ₪ (${kind(d)})</td><td style="text-align:center"><b>${tot[d]}</b></td><td style="text-align:center">${tot[d] * d} ₪</td></tr>`).join('')}
      <tr><th>סה"כ</th><th></th><th style="text-align:center">${h(shekel(sum))}</th></tr></tbody></table>
    <table><thead><tr><th class="n">#</th><th>שם</th><th style="text-align:center">סכום</th>${used.map((d) => `<th style="text-align:center">${d}</th>`).join('')}</tr></thead><tbody>
      ${per.map((x, i) => `<tr><td class="n">${i + 1}</td><td class="nm">${h(full(x.id))}</td><td style="text-align:center"><b>${x.amt}</b></td>${used.map((d) => `<td style="text-align:center">${x.b[d] || ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`);
}
/** ✉ פתק לכל בחור (A4, למעטפה עם חלון) — לפי התבנית של הישיבה */
async function stipNotes(mon, ids, D, type) {
  const { h } = X;
  // 🖼 כל סוג מלגה — עם הבלאנק שלו (⚙️ סוגי מלגות). אין בלאנק כללי.
  if (!type?.id || !X.st.settings?.[`asset:stipbg:${type.id}`]) {
    X.toast(type?.id ? `לסוג "${type.name}" עוד לא הועלה בלאנק — ⚙️ סוגי מלגות ← ⬆ העלאת בלאנק.` : 'בחר סוג מלגה (לכל סוג — הבלאנק שלו).', 'err');
    return;
  }
  const w = window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  w.document.write('<p style="font:16px Arial;text-align:center;margin-top:40px">טוען…</p>');
  let bg = '';
  try { bg = (await X.call(X.KEY, 'assetGet', { kind: 'stipbg', id: type.id })).data || ''; } catch (err) { w.close(); X.toast(X.msg(err), 'err'); return; }
  if (!bg) { w.close(); X.toast('הבלאנק לא נמצא — העלה אותו שוב.', 'err'); return; }
  const lh = !bg ? letterhead(X.KEY) : null;
  const nm = (id) => [first(id), last(id)].filter(Boolean).join(' ');
  const T = { ...STIP_TPL, ...(D.tpl || {}) };
  const fill = (t, id) => h(t).replace(/\{שם\}/g, `<b>${h(nm(id))}</b>`).replace(/\{חודש\}/g, h(mon.label.replace(/ תש.*$/, ''))).replace(/\{סכום\}/g, `<b>${h(shekel(D.of(id).total))}</b>`);
  const lines = (id) => { const o = D.of(id); const out = [];
    D.ss.forEach((s) => {
      if (hasStip(s)) {
        const wk = (o.cnt[s.key] || 0) - (o.shab[s.key] || 0);
        if (wk || !o.shab[s.key]) out.push(`<b>${wk}</b> פעמים ${h(s.stipText || `בסדר ${s.name}`)}`);
        if (o.shab[s.key]) out.push(`<b>${o.shab[s.key]}</b> פעמים ${h(s.stipTextShab || `בשבת קודש`)}`);
      }
      if (s.exam?.on && o.ex[s.key]?.n) out.push(`<b>${o.ex[s.key].pass}</b> מבחנים ${h(`ב${s.name}`)}`);
    });
    return out; };
  const page = (id) => `<section class="nt">${bg ? `<img class="bg" src="${bg}" alt="">` : ''}<div class="tx">
      ${lh ? `<img class="lh" src="${lh.top}" alt="">` : ''}
      <div class="to">${T.to.map((l) => `<p>${fill(l, id)}</p>`).join('')}</div>
      ${T.bless ? `<p class="bl">${fill(T.bless, id)}</p>` : ''}
      ${T.intro ? `<p>${fill(T.intro, id)}</p>` : ''}
      ${lines(id).map((l) => `<p class="ln">${l}</p>`).join('')}
      ${T.amount ? `<p class="amt">${fill(T.amount, id)}</p>` : ''}
      ${T.quotes.length ? '<div class="tl">~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~</div>' : ''}
      ${T.quotes.map((q) => `<p class="q">${h(q)}</p>`).join('')}
    </div></section>`;
  w.document.open();
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>פתקי מלגה ${h(mon.label)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&display=swap" rel="stylesheet">
    <style>@page { size: A4; margin: 0; } body { margin: 0; font-family: 'Frank Ruhl Libre', 'David', serif; color: #1d1a14; }
      .bar { padding: 8px; background: #f6f1e4; text-align: center; font: 14px Arial; } .bar button { font: inherit; padding: 5px 14px; margin: 0 4px; }
      .nt { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; margin: 0 auto; }
      .nt .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; z-index: 0; }
      .tx { position: absolute; top: 25%; right: 13%; left: 13%; bottom: 17%; z-index: 1; font-size: 13.5pt; line-height: 1.35; }
      .tx .lh { width: 100%; margin-bottom: 4mm; } .tx p { margin: 0 0 1.6mm; }
      .to { min-height: 30mm; margin-bottom: 4mm; } .bl { margin-bottom: 4mm !important; }
      .ln { margin-right: 6mm !important; } .amt { margin-top: 3mm !important; font-size: 15pt; }
      .tl { text-align: center; color: #9a7b3c; margin: 3mm 0; letter-spacing: 1px; } .q { font-size: 11.5pt; text-align: center; }
      @media print { .bar { display: none; } .nt { margin: 0; } img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 הדפסה</button> ${ids.length} פתקים · למעטפה עם חלון 11×23 ס"מ: מקפלים לשלושה, השם בשליש העליון מול החלון <button onclick="window.close()">סגירה</button></div>
    ${ids.map(page).join('')}</body></html>`);
  w.document.close();
}

// =====================================================================
// 🧹 ימי עבודה: עובדים מיט "שכר לפי ימי עבודה" — מ'צייכנט יעדן טאג וואס ער האט געארבעט (סדר "_work")
// דער חשבון — לפי חודש עברי: ימים × סכום ליום (💰 משכורות)
// =====================================================================
export async function renderWork(body) {
  const { h } = X;
  if (!J.week) J.week = sundayOf(todayIso());
  try { await needSchool(); } catch (err) { fail(body, err); return; }
  const sun = J.week;
  body.innerHTML = '<p class="muted">טוען…</p>';
  let rows; let team;
  try { [rows, team] = await Promise.all([attRows(sun), J.team ? J.team : X.call(X.KEY, 'team').then((r) => r.team)]); J.team = team; } catch (err) { fail(body, err); return; }
  const workers = team.filter((t) => t.pay_type === 'days' && t.active !== 'FALSE' && X.pById(t.contact_id)).sort((a, b) => full(a.contact_id).localeCompare(full(b.contact_id), 'he'));
  if (!workers.length) { body.innerHTML = '<p class="ms-note">אין עובדים עם "שכר לפי ימי עבודה". בוחרים את סוג השכר ב"👔 אנשי צוות" (✎).</p>'; return; }
  const il = (X.st.settings?.calendar || 'il') !== 'chul';
  const marks = {};
  workers.forEach((t) => { marks[t.contact_id] = parseMarks(rows.find((r) => r.seder === '_work' && String(r.contact_id) === String(t.contact_id))?.marks); });
  const dowsOf = (t) => rulesOf(t.schedule).dows;
  const edit = X.can('salary');
  const D7 = [0, 1, 2, 3, 4, 5, 6];
  body.innerHTML = `${weekBar(sun)}
      ${edit ? '<button type="button" class="btn primary" id="jw-save" disabled>💾 שמירה</button>' : ''}
      <select id="jw-mon" aria-label="חודש">${hebMonths().map((m) => `<option value="${h(m.key)}">${h(m.label)}</option>`).join('')}</select>
      <button type="button" class="btn" id="jw-month">📊 סיכום חודש</button>
    </div>
    <p class="muted small">מסמנים ✓ בכל יום שהעובד עבד בפועל. "—" = לא יום עבודה שלו (אפשר לשנות ב"👔 אנשי צוות").</p>
    <div class="ms-wrap"><table class="ms-table ja-table"><thead><tr><th>#</th><th>העובד</th>${D7.map((d) => { const x = dayInfo(isoAdd(sun, d), il); return `<th class="c">${DAYS[d]}<div class="muted small">${fmtDay(isoAdd(sun, d))}</div>${x.text ? `<div class="muted small">${h(x.text)}</div>` : ''}</th>`; }).join('')}<th class="c">ימים</th></tr></thead><tbody>
      ${workers.map((t, i) => `<tr data-w="${h(t.contact_id)}"><td class="num">${i + 1}</td><td><b>${h(full(t.contact_id))}</b><div class="muted small">${h(t.role || '')}</div></td>
        ${D7.map((d) => (dowsOf(t).includes(d) || marks[t.contact_id][d] ? `<td class="c"><button type="button" class="ja-cell m-${marks[t.contact_id][d] ? 'v' : 'e'}" data-id="${h(t.contact_id)}" data-k="${d}"${edit ? '' : ' disabled'}>${marks[t.contact_id][d] ? '✓' : ''}</button></td>` : '<td class="c muted">—</td>')).join('')}
        <td class="c jw-n">${Object.values(marks[t.contact_id]).filter((v) => v === 'v').length}</td></tr>`).join('')}
    </tbody></table></div>`;
  wireWeek(body, () => renderWork(body));
  const saveBtn = X.$('#jw-save', body); const changed = new Set();
  X.$$('.ja-cell', body).forEach((b) => {
    b.onclick = () => {
      const m = marks[b.dataset.id]; const on = !m[b.dataset.k];
      if (on) m[b.dataset.k] = 'v'; else delete m[b.dataset.k];
      b.textContent = on ? '✓' : ''; b.className = `ja-cell m-${on ? 'v' : 'e'}`;
      b.closest('tr').querySelector('.jw-n').textContent = Object.values(m).filter((v) => v === 'v').length;
      changed.add(b.dataset.id); J.dirty = true; if (saveBtn) saveBtn.disabled = false;
    };
  });
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const out = [...changed].map((id) => ({ contact_id: id, marks: JSON.stringify(marks[id]) }));
    try {
      await X.call(X.KEY, 'attSave', { week: sun, seder: '_work', rows: out });
      out.forEach((r) => { const ex = rows.find((x) => x.seder === '_work' && String(x.contact_id) === String(r.contact_id)); if (ex) ex.marks = r.marks; else rows.push({ week: sun, seder: '_work', ...r }); });
      changed.clear(); J.dirty = false; X.toast('נשמר.');
    } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  X.$('#jw-month', body).onclick = () => workMonth(workers, hebMonths().find((m) => m.key === X.$('#jw-mon', body).value));
}
/** 📊 א חודש עברי: ימים מסומנים פאר יעדן עובד, און (מיט הרשאה "finance") דער סכום */
async function workMonth(workers, mon) {
  const { h } = X;
  if (!mon) return;
  let rows; let rates = {};
  try { rows = (await X.call(X.KEY, 'att', { from: sundayOf(mon.from), to: mon.to })).rows.filter((r) => r.seder === '_work'); } catch (err) { X.toast(X.msg(err), 'err'); return; }
  if (X.can('finance')) { try { (await X.call(X.KEY, 'fin')).payInfo.forEach((p) => { rates[p.contact_id] = Number(p.hourly_rate) || 0; }); } catch { rates = {}; } }
  const daysOf = (id) => { const out = []; rows.filter((r) => String(r.contact_id) === String(id)).forEach((r) => Object.entries(parseMarks(r.marks)).forEach(([k, v]) => { const d = isoAdd(r.week, Number(k[0])); if (v === 'v' && d >= mon.from && d <= mon.to) out.push(d); })); return out.sort(); };
  const fin = X.can('finance');
  const data = workers.map((t) => { const ds = daysOf(t.contact_id); const r = rates[t.contact_id] || 0; return { t, ds, r, amt: ds.length * r }; });
  const title = `ימי עבודה — ${mon.label}`;
  printWin(title, `${h(isoToHebrewText(mon.from))} – ${h(isoToHebrewText(mon.to))}`, `<table><thead><tr><th class="n">#</th><th>העובד</th><th>ימים</th>${fin ? '<th>₪ ליום</th><th>לתשלום</th>' : ''}<th>התאריכים</th></tr></thead><tbody>
    ${data.map((x, i) => `<tr><td class="n">${i + 1}</td><td class="nm">${h(full(x.t.contact_id))}</td><td style="text-align:center"><b>${x.ds.length}</b></td>${fin ? `<td style="text-align:center">${x.r || '—'}</td><td style="text-align:center"><b>${x.r ? `${x.amt} ₪` : '—'}</b></td>` : ''}<td class="small">${h(x.ds.map((d) => heShort(d)).join(', '))}</td></tr>`).join('')}
    ${fin ? `<tr><th></th><th>סה"כ</th><th>${data.reduce((s, x) => s + x.ds.length, 0)}</th><th></th><th>${data.reduce((s, x) => s + x.amt, 0)} ₪</th><th></th></tr>` : ''}</tbody></table>`);
  downloadXlsx(title, ['העובד', 'ימים', ...(fin ? ['₪ ליום', 'לתשלום'] : []), 'התאריכים'], data.map((x) => [full(x.t.contact_id), x.ds.length, ...(fin ? [x.r, x.amt] : []), x.ds.map((d) => heShort(d)).join(', ')]), { rtl: true });
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
      <table class="ms-table ms-sedarim"><thead><tr><th>סדר</th><th>השתתפות</th><th>חברותות</th><th>ימים · משבצות (1 / 2 = תחילה וסוף)</th><th title="במקום תחילה וסוף: משבצת 1 = הגיע בזמן, משבצת 2 = השתתף — ובסיכום אחוז נפרד לכל אחד">2 = בזמן + השתתפות</th><th></th></tr></thead><tbody>
        ${(s.sedarim || []).map((x, i) => sederRow(x, i)).join('')}
      </tbody></table>
      <h4>💰 מלגות</h4>
      <p class="muted small">סכום לכל השתתפות (✓) בסדר — או 🏅 מדרגות לשבוע (למשל 3=50, 5=100: לפי כמה פעמים השתתף באותו שבוע; כל שבוע בנפרד, נחשב במוצאי שבת); "₪ בשבת" = סכום אחר לשבת (למשל סדר בוקר: 25 בחול, 50 בשבת — וצריך לסמן גם את יום ש' בימי הסדר למעלה); "לוח חודשי" = במקום היומן השבועי, מחפשים בחור ומסמנים בלוח של החודש העברי (כמו הפנקס); "גם איחור" = ⏰ נחשב השתתפות. הנוסח בפתק — למשל "בסדר הלימוד לפני התפילה בימות החול". מבחן שבועי (למשל בסדר שלישי): סכום קבוע לכל מבחן, או רק מציון מינימלי ומעלה.</p>
      <table class="ms-table ms-stip"><thead><tr><th>סדר</th><th>₪ להשתתפות</th><th>₪ בשבת</th><th title="במקום ₪ לכל השתתפות: סכום לשבוע לפי כמה פעמים השתתף באותו שבוע">🏅 מדרגות לשבוע</th><th>לוח חודשי לפי בחור</th><th>גם איחור</th><th>הנוסח בפתק</th><th>מבחן שבועי</th><th>חישוב</th><th>ציון מינימלי</th><th>₪ למבחן</th><th>הספק יומי א'–ה'</th></tr></thead><tbody>
        ${(s.sedarim || []).map((x) => `<tr data-key="${h(x.key)}"><td>${h(x.name)}</td>
          <td><input name="stip" type="number" min="0" step="1" dir="ltr" style="width:70px" value="${h(x.stip || '')}"></td>
          <td><input name="stipShab" type="number" min="0" step="1" dir="ltr" style="width:70px" value="${h(x.stipShab || '')}" title="ריק = כמו בחול"></td>
          <td><input name="tiers" dir="ltr" style="width:110px" value="${h(tiersTxt(x))}" placeholder="3=50, 5=100" title="פעמים בשבוע = ₪. למשל 3=50, 5=100: מי שהשתתף 3–4 פעמים בשבוע מקבל 50, 5 ומעלה — 100. כל שבוע בנפרד (א'–ש'), נחשב במוצאי שבת. ריק = ₪ לכל השתתפות."></td>
          <td class="c"><input type="checkbox" name="cal"${x.cal ? ' checked' : ''} title="במקום יומן שבועי: חיפוש בחור → לוח חודשי (כמו הפנקס)"></td>
          <td class="c"><input type="checkbox" name="stipLate"${x.stipLate ? ' checked' : ''}></td>
          <td><input name="stipText" value="${h(x.stipText || '')}" placeholder="בסדר ${h(x.name)}"></td>
          <td class="c"><input type="checkbox" name="exOn"${x.exam?.on ? ' checked' : ''}></td>
          <td><select name="exMode"><option value="min"${!['fixed', 'check'].includes(x.exam?.mode) ? ' selected' : ''}>מציון מינימלי</option><option value="fixed"${x.exam?.mode === 'fixed' ? ' selected' : ''}>סכום קבוע לכל מבחן</option><option value="check"${x.exam?.mode === 'check' ? ' selected' : ''}>✓ מולא / לא (בלי ציון)</option></select></td>
          <td><input name="exMin" type="number" min="0" max="100" dir="ltr" style="width:60px" value="${h(x.exam?.min || '')}"></td>
          <td><input name="exAmt" type="number" min="0" step="1" dir="ltr" style="width:70px" value="${h(x.exam?.amount || '')}"></td>
          <td class="c"><input type="checkbox" name="exHes"${x.exam?.hespek ? ' checked' : ''}></td></tr>`).join('')}
      </tbody></table>
      <div class="actions"><button type="button" class="btn" id="ms-sed-add">➕ סדר</button><span class="spacer"></span><button type="submit" class="btn primary">💾 שמירת ההגדרות</button></div>
    </form>`;
}
function sederRow(x, i) {
  const { h } = X;
  return `<tr data-i="${i}"><td><input name="name" value="${h(x.name || '')}"><input type="hidden" name="key" value="${h(x.key || '')}"></td>
    <td class="c"><input type="checkbox" name="att"${x.att ? ' checked' : ''}></td>
    <td class="c"><input type="checkbox" name="chav"${x.chav ? ' checked' : ''}></td>
    <td class="ms-days">${DAYS.map((d, j) => { const n = (x.days || []).includes(j) ? slotsOn(x, j) : 0; return `<label class="ms-dsel">${d} <select name="d${j}">${[[0, '—'], [1, '1'], [2, '2']].map(([v, l]) => `<option value="${v}"${v === n ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`; }).join('')}
      <button type="button" class="linkish small" data-same title="כל הימים כמו יום א'">= הכל כמו א'</button></td>
    <td class="c"><input type="checkbox" name="split"${x.split ? ' checked' : ''}></td>
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
      const per = [0, 1, 2, 3, 4, 5, 6].map((j) => Number(v(`d${j}`).value) || 0);
      const days = [0, 1, 2, 3, 4, 5, 6].filter((j) => per[j] > 0);
      const slotsBy = Object.fromEntries(days.map((j) => [j, per[j]]));
      const key = X.S(v('key').value) || `s${Date.now().toString(36)}${i}`;
      // 💰 מלגות (פון דער טאבעלע אונטן)
      const st = X.$(`.ms-stip tr[data-key="${key}"]`, form); const g = (n) => st?.querySelector(`[name=${n}]`);
      const old = (X.st.settings?.sedarim || []).find((x) => x.key === key) || {};
      const stip = st ? { stip: Number(g('stip').value) || 0, stipShab: Number(g('stipShab').value) || 0, tiers: parseTiers(g('tiers')?.value), cal: g('cal').checked, stipLate: g('stipLate').checked, stipText: X.S(g('stipText').value), exam: { on: g('exOn').checked, mode: ['fixed', 'check'].includes(g('exMode').value) ? g('exMode').value : 'min', min: Number(g('exMin').value) || 0, amount: Number(g('exAmt').value) || 0, hespek: g('exHes').checked } }
        : { stip: old.stip || 0, stipShab: old.stipShab || 0, tiers: old.tiers || [], cal: !!old.cal, stipLate: !!old.stipLate, stipText: old.stipText || '', exam: old.exam || { on: false, min: 0, amount: 0 } };
      return name ? { key, name, att: v('att').checked, chav: v('chav').checked, split: v('split').checked, slots: Math.max(1, ...days.map((j) => per[j])), slotsBy, days, ...stip } : null;
    }).filter(Boolean);
    if (!list.length) { X.toast('צריך לפחות סדר אחד.', 'err'); return; }
    try {
      const r = await X.call(X.KEY, 'settingsSave', { settings: { sedarim: list, calendar: form.elements.calendar.value, avreich_rate: form.elements.avreich_rate.value } });
      X.st.settings = r.settings; X.toast('ההגדרות נשמרו.');
    } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// =====================================================================
// 🎯 בחור לסדר מסוים — רק לבחורים בודדים (כל השאר: כל הסדרים)
// =====================================================================
function onlyDialog(after) {
  const { h } = X;
  const ss = sedarim().filter((x) => x.att);
  const map = onlyMap();
  const studs = students().map((id) => X.pById(id)).filter(Boolean).sort((a, b) => X.S(a.last_name_he).localeCompare(X.S(b.last_name_he), 'he'));
  const label = (p) => `${X.nameOf(p)} (#${p.contact_id})`;
  const d = X.dialog(`<h2>🎯 בחור לסדר מסוים</h2>
    <p class="muted small">רק לבחור שלומד בחלק מהסדרים. הוא יופיע ביומן ובמלגות רק בסדרים שמסומנים. כל שאר הבחורים — בכל הסדרים, כרגיל.</p>
    <div class="ms-wrap"><table class="ms-table"><thead><tr><th>בחור</th><th>סדרים</th><th></th></tr></thead><tbody>
      ${Object.entries(map).filter(([id]) => X.pById(id)).map(([id, ks]) => `<tr><td>${h(full(id))}</td><td>${h(ks.map((k) => ss.find((x) => x.key === k)?.name || k).join(', '))}</td>
        <td><button type="button" class="btn small-btn" data-oed="${h(id)}">✎</button> <button type="button" class="btn small-btn" data-orm="${h(id)}">✕ כל הסדרים</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">אין.</td></tr>'}
    </tbody></table></div>
    <h3>➕ להוסיף / לשנות</h3>
    <label>בחור <input id="oo-who" list="oo-dl" style="min-width:16em" placeholder="שם…"></label><datalist id="oo-dl">${studs.map((p) => `<option value="${h(label(p))}">`).join('')}</datalist>
    <div id="oo-s">${ss.map((x) => `<label class="check"><input type="checkbox" value="${h(x.key)}"> ${h(x.name)}</label>`).join(' ')}</div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button><button type="button" class="btn primary" id="oo-save">💾 שמירה</button></div>`);
  X.$$('[data-x]', d).forEach((b) => { b.onclick = () => { d.close(); after(); }; });
  const pick = (id) => { const p = X.pById(id); if (!p) return; X.$('#oo-who', d).value = label(p); X.$$('#oo-s input', d).forEach((c) => { c.checked = (map[id] || []).includes(c.value); }); };
  X.$$('[data-oed]', d).forEach((b) => { b.onclick = () => pick(b.dataset.oed); });
  const save = async (id, ks) => {
    try { const r = await X.call(X.KEY, 'sederOnlySave', { contact_id: id, sedarim: ks }); X.st.settings = r.settings || X.st.settings; d.close(); X.toast('נשמר.'); onlyDialog(after); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$$('[data-orm]', d).forEach((b) => { b.onclick = () => save(b.dataset.orm, []); });
  X.$('#oo-save', d).onclick = () => {
    const m = X.S(X.$('#oo-who', d).value).match(/\(#(\d+)\)$/);
    if (!m) { X.toast('בחר בחור מהרשימה.', 'err'); return; }
    const ks = X.$$('#oo-s input:checked', d).map((c) => c.value);
    if (!ks.length && !window.confirm('לא סומן אף סדר — להחזיר אותו לכל הסדרים?')) return;
    save(m[1], ks);
  };
}

// =====================================================================
// 🗓 לוח חודשי לפי בחור (למשל סדר בוקר) — כמו הפנקס: מסמנים V על הימים, והמלגה מחושבת לבד
// נשמר כהשתתפות רגילה (שבוע + יום), כך שהסיכומים והמלגות עובדים כרגיל
// =====================================================================
async function renderCal(body, seder) {
  const { h } = X;
  const months = hebMonths(6);
  // גם החודש הבא (למילוי מראש)
  const nx = (() => { const t = toHebrew(isoAdd(months[0].to, 1)); if (!t) return null; const from = isoAdd(months[0].to, 1); let to = from; while (toHebrew(isoAdd(to, 1))?.m === t.m) to = isoAdd(to, 1); return { key: from, label: `${monthHe(t.m)} ${yearLabel(t.y)}`, from, to }; })();
  const all = nx ? [nx, ...months] : months;
  if (!all.some((m) => m.key === J.calMon)) J.calMon = months[0].key;
  const mon = all.find((m) => m.key === J.calMon);
  body.innerHTML = '<p class="muted">טוען…</p>';
  let rows;
  try { rows = (await X.call(X.KEY, 'att', { from: sundayOf(mon.from), to: mon.to })).rows.filter((r) => r.seder === seder.key); } catch (err) { fail(body, err); return; }
  const ids = students(mon.to < todayIso() ? mon.to : todayIso()).filter((id) => inSeder(id, seder.key));
  const label = (id) => `${full(id)} (#${id})`;
  const marksOf = (id, week) => parseMarks(rows.find((r) => String(r.contact_id) === String(id) && String(r.week).slice(0, 10) === week)?.marks);
  const dows = new Set([...(seder.days || []), ...(Number(seder.stipShab) > 0 ? [6] : [])]);
  const dates = []; for (let d = mon.from; d <= mon.to; d = isoAdd(d, 1)) dates.push(d);
  const dowOf = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();
  const isOn = (id, d) => { const m = marksOf(id, sundayOf(d)); const k = String(dowOf(d)); return ['v', 'l'].includes(m[k]) || ['v', 'l'].includes(m[`${k}b`]); };
  const sumOf = (id) => dates.reduce((t, d) => { if (!isOn(id, d)) return t; t.n += 1; if (dowOf(d) === 6) t.s += 1; t.amt += stipOf(seder, dowOf(d)); return t; }, { n: 0, s: 0, amt: 0 });
  const edit = X.can('attendance');
  const cur = J.calId && ids.includes(String(J.calId)) ? String(J.calId) : (J.calId && X.pById(J.calId) ? String(J.calId) : '');
  body.innerHTML = `<div class="ms-bar">
      <label>חודש <select id="jc-mon">${all.map((m) => `<option value="${h(m.key)}"${m.key === mon.key ? ' selected' : ''}>${h(m.label)}</option>`).join('')}</select></label>
      <label>🔎 בחור <input id="jc-who" list="jc-dl" style="min-width:16em" value="${h(cur ? label(cur) : '')}" placeholder="מקלידים שם…"></label>
      <datalist id="jc-dl">${ids.map((id) => `<option value="${h(label(id))}">`).join('')}</datalist>
      <span class="spacer"></span>
      ${edit ? '<button type="button" class="btn primary" id="jc-save" disabled>💾 שמירה</button>' : ''}
      <button type="button" class="btn" id="jc-print">🖨 סיכום החודש</button>
    </div>
    <p class="muted small">${h(seder.name)} · ${h(mon.label)}: ${h(shekel(seder.stip || 0))} ליום חול${Number(seder.stipShab) > 0 ? ` · ${h(shekel(seder.stipShab))} לשבת` : ''}. בוחרים בחור ומסמנים V על הימים שסומנו בפנקס — הסכום מחושב לבד. (ימים אפורים — אין סדר.)</p>
    <div id="jc-cal"></div>
    <h3>📊 כל הבחורים — ${h(mon.label)}</h3>
    <div class="ms-wrap"><table class="ms-table col-filter" data-fkey="calsum"><thead><tr><th>#</th><th>שם</th><th class="c">ימים</th><th class="c">מתוכם שבת</th><th class="c">₪</th></tr></thead><tbody>
      ${ids.map((id, i) => { const x = sumOf(id); return `<tr class="jc-row" data-id="${h(id)}" style="cursor:pointer"><td class="num">${i + 1}</td><td>${h(full(id))}</td><td class="c">${x.n || ''}</td><td class="c">${x.s || ''}</td><td class="c"><b>${x.amt ? h(shekel(x.amt)) : ''}</b></td></tr>`; }).join('')}
    </tbody></table></div>`;
  colFilters(body);
  const box = X.$('#jc-cal', body);
  const saveBtn = X.$('#jc-save', body);
  const edits = {}; // week → marks (של הבחור הנבחר)
  const drawCal = (id) => {
    if (!id) { box.innerHTML = '<p class="ms-note">בוחרים בחור מהרשימה (או לוחצים על שם בטבלה למטה).</p>'; return; }
    const lead = dowOf(mon.from);
    const cells = [...Array(lead).fill(''), ...dates];
    while (cells.length % 7) cells.push('');
    const on = (d) => { const w = sundayOf(d); const m = edits[w] || marksOf(id, w); const k = String(dowOf(d)); return ['v', 'l'].includes(m[k]) || ['v', 'l'].includes(m[`${k}b`]); };
    const tot = dates.reduce((t, d) => { if (!on(d)) return t; t.n += 1; if (dowOf(d) === 6) t.s += 1; t.amt += stipOf(seder, dowOf(d)); return t; }, { n: 0, s: 0, amt: 0 });
    box.innerHTML = `<div class="jc-head"><b>${h(full(id))}</b> · ${h(mon.label)} · <b>${tot.n}</b> ימים${tot.s ? ` (שבת: ${tot.s})` : ''} · מלגה: <b>${h(shekel(tot.amt))}</b></div>
      <table class="jc-grid"><thead><tr>${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שב"ק'].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>
      ${Array.from({ length: cells.length / 7 }, (_, r) => `<tr>${cells.slice(r * 7, r * 7 + 7).map((d) => {
        if (!d) return '<td class="jc-x"></td>';
        const ok = dows.has(dowOf(d)); const inf = dayInfo(d, il());
        return `<td class="jc-d${ok ? '' : ' jc-off'}${on(d) ? ' jc-on' : ''}"${ok && edit ? ` data-d="${d}" role="button" tabindex="0"` : ''}><span class="jc-n">${h(heShort(d).split(' ')[0])}</span>${on(d) ? '<span class="jc-v">✓</span>' : ''}${dowOf(d) === 6 ? `<span class="jc-t">${h(weekTitle(sundayOf(d)).replace(/^שבת\s*/, ''))}</span>` : ''}${inf.text ? `<span class="jc-t jc-hol">${h(inf.text)}</span>` : ''}${dowOf(d) === 6 && Number(seder.stipShab) > 0 ? `<span class="jc-t">${h(shekel(seder.stipShab))}</span>` : ''}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>`;
    X.$$('[data-d]', box).forEach((td) => {
      const tog = () => {
        const d = td.dataset.d; const w = sundayOf(d); const k = String(dowOf(d));
        const m = (edits[w] ||= { ...marksOf(id, w) });
        if (['v', 'l'].includes(m[k]) || ['v', 'l'].includes(m[`${k}b`])) { delete m[k]; delete m[`${k}b`]; } else m[k] = 'v';
        J.dirty = true; if (saveBtn) saveBtn.disabled = false; drawCal(id);
      };
      td.onclick = tog; td.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } };
    });
  };
  const choose = (id) => {
    if (Object.keys(edits).length && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) return false;
    Object.keys(edits).forEach((k) => delete edits[k]); J.dirty = false; if (saveBtn) saveBtn.disabled = true;
    J.calId = id; X.$('#jc-who', body).value = id ? label(id) : ''; drawCal(id); return true;
  };
  drawCal(cur);
  X.$('#jc-who', body).onchange = (e) => { const m = X.S(e.target.value).match(/\(#(\d+)\)$/); if (m) choose(m[1]); };
  X.$$('.jc-row', body).forEach((tr) => { tr.onclick = () => { if (choose(tr.dataset.id)) box.scrollIntoView({ behavior: 'smooth' }); }; });
  X.$('#jc-mon', body).onchange = (e) => { if (J.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) { e.target.value = mon.key; return; } J.dirty = false; J.calMon = e.target.value; renderCal(body, seder); };
  saveBtn?.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const id = J.calId;
    try {
      for (const [w, m] of Object.entries(edits)) {
        await X.call(X.KEY, 'attSave', { week: w, seder: seder.key, rows: [{ contact_id: id, marks: JSON.stringify(m) }] });
        const ex = rows.find((r) => String(r.contact_id) === String(id) && String(r.week).slice(0, 10) === w);
        if (ex) ex.marks = JSON.stringify(m); else rows.push({ week: w, seder: seder.key, contact_id: id, marks: JSON.stringify(m) });
        Object.keys(J.att).forEach((k) => { if (k === w) delete J.att[k]; });
      }
      Object.keys(edits).forEach((k) => delete edits[k]); J.dirty = false; X.toast('נשמר.');
      renderCal(body, seder);
    } catch (err) { saveBtn.disabled = false; X.toast(X.msg(err), 'err'); }
  });
  X.$('#jc-print', body).onclick = () => printList(`${seder.name} — ${mon.label}`, '', { cols: [{ t: 'ימים', c: 'c' }, { t: 'שבת', c: 'c' }, { t: '₪', c: 'c' }],
    rows: ids.map((id) => { const x = sumOf(id); return { id, cells: [x.n || '', x.s || '', x.amt || ''] }; }), twoUp: true });
}

/** 🖼 תמונת בלאנק → JPEG ברוחב עד 2000 פיקסלים */
async function shrinkA4(file) {
  if (!/^image\//.test(file.type)) throw new Error('bad-file');
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = new Image(); img.src = url; await img.decode();
  const k = Math.min(1, 2000 / img.width);
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
