// א נייע גרסה פונעם אתר: יעדע 5 מינוט קוקט מען צי index.html האט א נייע ?v=. אויב יא — א פאס "יש עדכון — לחץ לרענון".
// קיין אויטאמאטישער רענון (א גבאי קען זיין אינמיטן שרייבן); ער דריקט ווען ער איז גרייט.
import { getLang } from './i18n.js';

const MYV = (document.querySelector('script[type=importmap]')?.textContent.match(/\?v=(\d+)/) || [])[1] || '';
const TXT = {
  yi: ['ס\'איז דא א נייע גרסה פונעם אתר', 'דריקט צו רענון'],
  he: ['יש עדכון לאתר', 'לחץ לרענון'],
  en: ['A new version of the site is available', 'Click to refresh'],
};
let shown = false;
export function show() {
  if (shown) return; shown = true;
  const [a, b] = TXT[getLang()] || TXT.he;
  const bar = document.createElement('div');
  bar.id = 'upd-bar';
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:12px;'
    + 'background:#0f2140;color:#fff;border:2px solid #c9a24c;border-radius:12px;padding:10px 16px;box-shadow:0 6px 18px rgba(0,0,0,.35);font:600 15px Heebo,Arial,sans-serif;direction:rtl;max-width:calc(100vw - 32px)';
  bar.innerHTML = `<span>🔄 ${a}</span>`;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.textContent = b;
  btn.style.cssText = 'background:#c9a24c;color:#0f2140;border:0;border-radius:8px;padding:6px 14px;font:700 15px Heebo,Arial,sans-serif;cursor:pointer';
  btn.onclick = () => location.reload();
  bar.appendChild(btn);
  document.body.appendChild(bar);
}
async function check() {
  if (!MYV || shown || document.hidden) return;
  try {
    const r = await fetch(`index.html?chk=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const v = ((await r.text()).match(/\?v=(\d+)/) || [])[1];
    if (v && v !== MYV && Number(v) > Number(MYV)) show();
  } catch { /* בלי אינטרנט */ }
}
export function initUpdateCheck() {
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}
