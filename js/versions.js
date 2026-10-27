// גירסאות: א לשונית אין א גיליון — [version, saved_at, saved_by, note, json…] (דער JSON צוטיילט אויף E, F, G… פון 40,000)
// געניצט פאר "זמני התפילות" (MinyanimHistory) און "תצוגת והגדרות המסך" (ScreenHistory).
import { otherSheet } from './google.js';
import { CONFIG } from './config.js';
import { nowStamp } from './util.js';

const CHUNK = 40000;
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function versionStore(tab, sheetId = CONFIG.DISPLAY_SHEET_ID) {
  const sh = () => otherSheet(sheetId);
  return {
    /** [{ ver, at, by, note, row }] — די נייסטע ערשט */
    async list() {
      const rows = await sh().read(`${tab}!A2:D2000`);
      return rows.map((r, i) => ({ ver: Number(r[0]) || 0, at: String(r[1] || ''), by: String(r[2] || ''), note: String(r[3] || ''), row: i + 2 }))
        .filter((x) => x.ver).sort((a, b) => b.ver - a.ver);
    },
    async last() { const l = await this.list(); return l[0]?.ver || 0; },
    /** לייענט דעם JSON פון א גירסא */
    async get(row) {
      const [r = []] = await sh().read(`${tab}!E${row}:Z${row}`);
      return JSON.parse(r.map((x) => String(x ?? '')).join(''));
    },
    /** לייגט צו א נייע גירסא; גיט צוריק די נומער */
    async add(obj, note, email) {
      const rows = await sh().read(`${tab}!A1:A2000`);
      const nums = rows.slice(1).map((r) => Number(r[0]) || 0);
      const ver = Math.max(0, ...nums) + 1; const row = rows.length + 1;
      const v = JSON.stringify(obj); const parts = [];
      for (let i = 0; i < v.length; i += CHUNK) parts.push(v.slice(i, i + CHUNK));
      if (parts.length > 21) throw new Error('too big');
      await sh().write(`${tab}!A${row}:${COLS[4 + parts.length - 1]}${row}`, [[ver, nowStamp(), email || '', note || '', ...parts]]);
      return ver;
    },
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function overlay(html) {
  const bg = document.createElement('div'); bg.className = 'tf-dlg-bg vs-bg';
  bg.innerHTML = `<div class="tf-dlg vs-dlg">${html}</div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
  return bg;
}
/** פרעגט א הערה פאר א נייע גירסא. גיט צוריק דעם טעקסט (אדער null) */
export function askNote(title = 'שמירה כגרסה') {
  return new Promise((resolve) => {
    const bg = overlay(`<h3>📌 ${esc(title)}</h3><p class="muted small">הערה קצרה (לא חובה) — למשל "זמני חורף תשפ"ז"</p>
      <input class="vs-note" style="width:100%" maxlength="120"><div class="vs-acts"><button type="button" class="btn primary vs-ok">שמירה</button><button type="button" class="btn ghost vs-no">ביטול</button></div>`);
    const inp = bg.querySelector('.vs-note'); inp.focus();
    const done = (v) => { bg.remove(); resolve(v); };
    bg.querySelector('.vs-ok').onclick = () => done(inp.value.trim());
    bg.querySelector('.vs-no').onclick = () => done(null);
    inp.onkeydown = (e) => { if (e.key === 'Enter') done(inp.value.trim()); if (e.key === 'Escape') done(null); };
  });
}
/** די רשימה פון גירסאות; "↩ לחזור" (נאר מיט רשות) רופט onRestore(obj, ver) */
export async function openVersions({ store, title = 'גרסאות', canRestore = false, onRestore, nameOf = (e) => e }) {
  const bg = overlay(`<h3>🕘 ${esc(title)}</h3><div class="vs-list muted">טוען…</div><div class="vs-acts"><button type="button" class="btn ghost vs-no">סגירה</button></div>`);
  bg.querySelector('.vs-no').onclick = () => bg.remove();
  let list = [];
  try { list = await store.list(); } catch (err) { bg.querySelector('.vs-list').textContent = `שגיאה: ${err.message || err}`; return; }
  const box = bg.querySelector('.vs-list'); box.classList.remove('muted');
  box.innerHTML = list.length ? `<table class="vs-tbl"><tr><th>גרסה</th><th>תאריך</th><th>מי</th><th>הערה</th><th></th></tr>
    ${list.map((v) => `<tr><td><b>${v.ver}</b></td><td dir="ltr">${esc(v.at)}</td><td>${esc(nameOf(v.by))}</td><td>${esc(v.note)}</td>
      <td>${canRestore ? `<button type="button" class="btn small-btn" data-row="${v.row}" data-ver="${v.ver}">↩ לחזור לגרסה זו</button>` : ''}</td></tr>`).join('')}</table>
    ${canRestore ? '<p class="muted small">חזרה לגרסה טוענת אותה לעריכה. היא נכנסת לתוקף רק אחרי 💾 שמירה.</p>' : '<p class="muted small">אין לך הרשאה לחזור לגרסה קודמת (אדמין → הרשאות).</p>'}`
    : '<p class="muted">עדיין אין גרסאות שמורות.</p>';
  box.querySelectorAll('[data-row]').forEach((b) => { b.onclick = async () => {
    if (!confirm(`לטעון את גרסה ${b.dataset.ver}? השינויים שלא נשמרו יוחלפו.`)) return;
    b.disabled = true;
    try { const obj = await store.get(Number(b.dataset.row)); bg.remove(); onRestore(obj, Number(b.dataset.ver)); } catch (err) { b.disabled = false; alert(`שגיאה: ${err.message || err}`); }
  }; });
}
