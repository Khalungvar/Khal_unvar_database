// סארטירן א טאבעלע: א קליק אויף א קעפל (th) → לויט א-ב ארויף; נאך א קליק → אראפ.
// ארבעט אויף אלע טאבעלעס מיט <thead> (גרייטע רשימות, ישיבה, נדבות א.א.וו.), אחוץ class="no-sort".
const num = (s) => {
  const v = String(s).replace(/[$,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null;
};
const textOf = (row, i) => (row.cells[i]?.innerText || '').trim();

export function initSortTables() {
  document.addEventListener('click', (e) => {
    const th = e.target.closest('table thead th');
    if (!th || e.target.closest('button, a, input, select, label')) return;
    const table = th.closest('table');
    if (table.classList.contains('no-sort') || !th.textContent.trim() || table.closest('.wr-body, .mx-page, [contenteditable]')) return;
    const body = table.tBodies[0];
    if (!body || body.rows.length < 2) return;
    const i = [...th.parentElement.cells].indexOf(th);
    const dir = th.dataset.sort === 'asc' ? 'desc' : 'asc';
    table.querySelectorAll('thead th[data-sort]').forEach((x) => { delete x.dataset.sort; });
    th.dataset.sort = dir;
    const rows = [...body.rows];
    rows.sort((a, b) => {
      const x = textOf(a, i); const y = textOf(b, i);
      if (!x && y) return 1; // ליידיגע — אלעמאל צום סוף
      if (x && !y) return -1;
      const nx = num(x); const ny = num(y);
      const r = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, ['he', 'en'], { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? r : -r;
    });
    rows.forEach((r) => body.append(r));
  });
}
