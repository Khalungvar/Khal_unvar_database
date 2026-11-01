// סארטירן א טאבעלע: א קליק אויף א קעפל (th) → לויט א-ב ארויף; נאך א קליק → אראפ. יעדע קאלאנע פאר זיך.
// ארבעט אויף אלע טאבעלעס מיט <thead> (גרייטע רשימות, ישיבה, נדבות א.א.וו.), אחוץ class="no-sort".
// א <td data-v="…"> גיט א ווערט צום סארטירן (למשל א לועזי'שער דאטום הינטער א עברי'שן).
import { monthKeyFromHe } from './hebdate.js';

const num = (s) => {
  const v = String(s).replace(/[$₪€£,\s‎‏]/g, '');
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null;
};
// עברי'שע חדשים, פון תשרי
const MI = { Tishri: 1, Heshvan: 2, Kislev: 3, Tevet: 4, Shevat: 5, 'Adar I': 6, Adar: 7, 'Adar II': 7, Nisan: 8, Iyar: 9, Sivan: 10, Tamuz: 11, Av: 12, Elul: 13 };
const LV = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
const gem = (t) => [...String(t).replace(/["'״׳]/g, '')].reduce((s, ch) => s + (LV[ch] || 0), 0);
/** "כ"ה חשון תשפ"ז" / "כ"ה חשון" → א נומער לויט דער סדר; אנדערש null */
function heDateVal(s) {
  const m = String(s).trim().match(/^(\S{1,4})\s+(אדר [אב]'?|\S+)(?:\s+(\S{2,6}))?(?:\s|$)/);
  if (!m) return null;
  const key = monthKeyFromHe(m[2]) || monthKeyFromHe(`${m[2]}'`);
  if (!key || !MI[key]) return null;
  const d = gem(m[1]); if (!d || d > 30) return null;
  const y = m[3] ? gem(m[3]) : 0;
  return y * 10000 + MI[key] * 100 + d;
}
const textOf = (row, i) => {
  const c = row.cells[i];
  if (!c) return '';
  if (c.dataset.v !== undefined) return c.dataset.v;
  const inp = c.querySelector('input:not([type=checkbox]), select');
  return ((inp && !c.innerText.trim() ? inp.value : c.innerText) || '').trim();
};

export function initSortTables() {
  document.addEventListener('click', (e) => {
    const th = e.target.closest('table thead th');
    if (!th || e.target.closest('button, a, input, select, label')) return;
    const table = th.closest('table');
    if (table.classList.contains('no-sort') || !th.textContent.trim() || table.closest('.wr-body, .mx-page, [contenteditable]')) return;
    const body = table.tBodies[0];
    if (!body || body.rows.length < 2) return;
    // דער אמת'ער אינדעקס (מיט colspan)
    let i = 0;
    for (const c of th.parentElement.cells) { if (c === th) break; i += c.colSpan || 1; }
    const dir = th.dataset.sort === 'asc' ? 'desc' : 'asc';
    table.querySelectorAll('thead th[data-sort]').forEach((x) => { delete x.dataset.sort; });
    th.dataset.sort = dir;
    // שורות וואס געהערן צוזאמען (א "פארזעצונג" אן קיין ערשטע צעל) בלייבן ביי דער ערשטער
    const groups = [];
    [...body.rows].forEach((r) => { if (r.classList.contains('sub') && groups.length) groups[groups.length - 1].push(r); else groups.push([r]); });
    const key = (g) => textOf(g[0], i);
    groups.sort((ga, gb) => {
      const x = key(ga); const y = key(gb);
      if (!x && y) return 1; // ליידיגע — אלעמאל צום סוף
      if (x && !y) return -1;
      let r;
      const nx = num(x); const ny = num(y);
      const hx = nx === null ? heDateVal(x) : null; const hy = ny === null ? heDateVal(y) : null;
      if (nx !== null && ny !== null) r = nx - ny;
      else if (hx !== null && hy !== null) r = hx - hy;
      else r = x.localeCompare(y, ['he', 'en'], { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? r : -r;
    });
    groups.forEach((g) => g.forEach((r) => body.append(r)));
  });
}

// ---------- סינון כמו באקסל: טבלה עם class="col-filter" ו-data-fkey="…" ----------
// בכל כותרת ▾ → רשימת ערכים עם ✓ (+ חיפוש). הסינון נשמר לפי data-fkey גם אחרי רענון של הטבלה.
const FSTATE = {}; // fkey → { colIndex: Set(ערכים מוסתרים) }
const cellVal = (row, i) => { const c = row.cells[i]; return c ? (c.innerText || '').trim().replace(/\s*✎\s*$/, '').trim() : ''; };
function applyFilters(table) {
  const st = FSTATE[table.dataset.fkey] || {};
  const body = table.tBodies[0]; if (!body) return;
  let shown = 0;
  [...body.rows].forEach((r) => {
    const hide = Object.entries(st).some(([i, set]) => set.size && set.has(cellVal(r, Number(i))));
    r.hidden = hide; if (!hide) shown++;
  });
  table.querySelectorAll('thead th').forEach((th, i) => { const b = th.querySelector('.cf-btn'); if (b) b.classList.toggle('on', !!(st[i] && st[i].size)); });
  const pill = table.closest('section, .ms-page, div')?.parentElement?.querySelector('.cf-count');
  if (pill) pill.textContent = Object.values(st).some((s) => s.size) ? `מוצגים ${shown}` : '';
}
function openPop(table, th, i) {
  document.querySelectorAll('.cf-pop').forEach((p) => p.remove());
  const key = table.dataset.fkey; FSTATE[key] = FSTATE[key] || {}; const st = FSTATE[key];
  const set = st[i] || (st[i] = new Set());
  const vals = [...new Set([...table.tBodies[0].rows].map((r) => cellVal(r, i)))].sort((a, b) => a.localeCompare(b, ['he', 'en'], { numeric: true }));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pop = document.createElement('div'); pop.className = 'cf-pop'; pop.dir = 'rtl';
  pop.innerHTML = `<input type="search" class="cf-q" placeholder="חיפוש…">
    <div class="cf-acts"><button type="button" data-a="all">בחר הכל</button><button type="button" data-a="none">נקה הכל</button><button type="button" data-a="az">מיון א←ת</button><button type="button" data-a="za">מיון ת←א</button></div>
    <div class="cf-list">${vals.map((v) => `<label><input type="checkbox" value="${esc(v)}"${set.has(v) ? '' : ' checked'}> ${v ? esc(v) : '<i>(ריק)</i>'}</label>`).join('')}</div>`;
  document.body.append(pop);
  const r = th.getBoundingClientRect();
  pop.style.top = `${r.bottom + window.scrollY + 2}px`; pop.style.left = `${Math.max(4, Math.min(r.right - 230, window.innerWidth - 240)) + window.scrollX}px`;
  const boxes = () => [...pop.querySelectorAll('.cf-list input')];
  const sync = () => { set.clear(); boxes().forEach((b) => { if (!b.checked) set.add(b.value); }); applyFilters(table); };
  pop.querySelector('.cf-list').onchange = sync;
  pop.querySelector('.cf-q').oninput = (e) => { const q = e.target.value.trim(); boxes().forEach((b) => { b.parentElement.hidden = q && !b.value.includes(q); }); };
  pop.querySelector('.cf-acts').onclick = (e) => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'all' || a === 'none') { boxes().forEach((b) => { if (!b.parentElement.hidden) b.checked = a === 'all'; }); sync(); return; }
    th.dataset.sort = a === 'az' ? 'desc' : 'asc'; // הקליק הבא הופך
    pop.remove(); th.click();
  };
  setTimeout(() => document.addEventListener('mousedown', function off(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', off); } }), 0);
}
/** לקרוא אחרי שהטבלה נבנתה */
export function colFilters(root) {
  (root || document).querySelectorAll('table.col-filter').forEach((table) => {
    table.querySelectorAll('thead th').forEach((th, i) => {
      if (!th.textContent.trim() || th.querySelector('.cf-btn')) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cf-btn'; b.textContent = '▾'; b.title = 'סינון';
      b.onclick = (e) => { e.stopPropagation(); openPop(table, th, i); };
      th.append(b);
    });
    applyFilters(table);
  });
}
if (!document.getElementById('cf-css')) {
  const s = document.createElement('style'); s.id = 'cf-css';
  s.textContent = `.cf-btn{border:0;background:none;cursor:pointer;font-size:.8em;opacity:.55;padding:0 3px}.cf-btn.on{opacity:1;color:#c0392b;font-weight:bold}
  .cf-pop{position:absolute;z-index:9999;background:#fff;color:#222;border:1px solid #bbb;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);padding:8px;width:230px;font-size:13px}
  .cf-pop .cf-q{width:100%;box-sizing:border-box;margin-bottom:6px}.cf-acts{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}.cf-acts button{font-size:11px;padding:2px 6px;cursor:pointer}
  .cf-list{max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:2px}.cf-list label{display:flex;gap:6px;align-items:center;cursor:pointer}
  @media (prefers-color-scheme:dark){.cf-pop{background:#222;color:#eee;border-color:#555}}`;
  document.head.append(s);
}
