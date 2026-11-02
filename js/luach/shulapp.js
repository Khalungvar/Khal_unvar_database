// 🕍 דף הניהול של בית כנסת (ungvar.org/shul/?s=key) — לגבאים של בתי כנסת אחרים.
// כניסה עם גוגל; ההרשאה = שיתוף הגיליון של בית הכנסת (עורך / צפייה). בלי גישה לשאר האתר של אונגוואר.
import { initAuth, requestToken, getUserEmail, hasSavedSession, otherSheet } from '../google.js';
import { state } from '../data.js';
import { SHULS, registerShul, setCurShul, curShul } from './shul.js';
import { initTefila, openTefila } from './tefila.js';
import { openScreen } from './screen.js';
import { openTfPrint } from './tfprintui.js';
import { openShul, loadShulCfg } from './shului.js';

const $ = (s) => document.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const main = $('#luach-main');
function toast(t, kind = '') { const e = document.createElement('div'); e.className = `sa-toast ${kind}`; e.textContent = t; document.body.append(e); setTimeout(() => e.remove(), 3500); }
const ui = { toast, friendlyError: (e) => String(e?.message || e) };
const KEY = new URLSearchParams(location.search).get('s') || '';

// הרשימה של בתי הכנסת — פתוחה לקריאה (כמו המסך)
async function registry() {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHULS.bp.sheetId}/gviz/tq?tqx=out:csv&sheet=Shuls&headers=1&t=${Date.now()}`, { cache: 'no-store' });
  const rows = (await r.text()).trim().split('\n').map((l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')));
  if (!rows.length || rows[0][0] !== 'key') return;
  rows.slice(1).forEach((x) => { if (x[0] && x[2]) registerShul({ key: x[0], name: x[1], sheetId: x[2] }); });
}

function hub() {
  const n = SHULS[curShul()]?.name || '';
  $('#sa-name').textContent = `🕍 ${n}`; document.title = `זמני תפילות – ${n}`;
  const tile = (k, icon, title) => `<button type="button" class="lobby-tile lx-hubt" data-k="${k}"><span class="lobby-icon">${icon}</span><b>${h(title)}</b></button>`;
  main.innerHTML = `<div class="lx-hub">${tile('times', '🕰', 'זמני התפילות והשיעורים')}${tile('screen', '📺', 'תצוגת והגדרות המסך')}${tile('print', '🖨', 'הדפסת זמני התפילה')}</div>
    <div class="aw-bar"><button type="button" class="btn ghost aw-btn" data-k="shul">⚙️ הגדרות בית הכנסת</button></div>`;
  main.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => {
    const back = () => hub(); const k = b.dataset.k;
    if (k === 'times') openTefila(main, back, 'זמני התפילות');
    if (k === 'screen') openScreen(main, back, ui);
    if (k === 'print') openTfPrint(main, back, ui);
    if (k === 'shul') openShul(main, back, ui);
  }; });
}

async function start() {
  try { await registry(); } catch { /* */ }
  if (!KEY || !SHULS[KEY] || KEY === 'bp') { main.innerHTML = '<div class="sa-login"><p>הקישור לא תקין. בקש מהמנהל את הקישור של בית הכנסת שלך.</p></div>'; return; }
  setCurShul(KEY);
  await initAuth();
  const go = async () => {
    try {
      if (!hasSavedSession()) await requestToken('select_account');
      state.email = String(await getUserEmail()).toLowerCase();
      // בדיקת הרשאה: קריאה מהגיליון (רק מי ששיתפו איתו)
      await otherSheet(SHULS[KEY].sheetId).read('ShulConfig!A1:A1');
      state.isAllowed = true; state.canScreen = true; state.canRestore = true;
      $('#sa-user').textContent = state.email;
      initTefila(ui);
      try { await loadShulCfg(true); } catch { /* */ }
      hub();
    } catch (err) {
      main.innerHTML = `<div class="sa-login"><p>אין לך הרשאה לבית הכנסת הזה${state.email ? ` (${h(state.email)})` : ''}.</p><p class="muted small">בקש מהמנהל להוסיף אותך כגבאי (הגדרות בית הכנסת → גבאים).</p><button type="button" class="btn" id="sa-again">כניסה עם חשבון אחר</button></div>`;
      $('#sa-again').onclick = async () => { await requestToken('select_account'); go(); };
    }
  };
  main.innerHTML = `<div class="sa-login"><h2>${h(SHULS[KEY].name)}</h2><p>ניהול זמני התפילות והמסך</p><button type="button" class="btn primary" id="sa-in">כניסה עם Google</button></div>`;
  $('#sa-in').onclick = go;
  if (hasSavedSession()) go();
}
start();
