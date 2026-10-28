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
