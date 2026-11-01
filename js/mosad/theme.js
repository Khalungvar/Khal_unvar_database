// 🌙/☀️ מתג כהה/בהיר: אוטומטי (לפי המכשיר) → כהה → בהיר. נשמר על המחשב הזה.
// עובד בלי לשכפל CSS: הכללים של "@media (prefers-color-scheme: dark)" מופעלים / מכובים ישירות.
const KEY = 'ms-theme';
const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const put = (v) => { try { if (v === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* */ } };
const ORIG = new WeakMap();
function rulesOf(list, out = []) {
  for (const r of list) {
    if (r instanceof CSSMediaRule && (ORIG.has(r) || /prefers-color-scheme:\s*dark/.test(r.media.mediaText))) out.push(r);
    if (r.cssRules) { try { rulesOf(r.cssRules, out); } catch { /* */ } }
  }
  return out;
}
export function applyTheme(mode = get()) {
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; } // CSS ממקור אחר (גופנים)
    rulesOf(rules).forEach((r) => {
      if (!ORIG.has(r)) ORIG.set(r, r.media.mediaText);
      const want = mode === 'dark' ? 'all' : mode === 'light' ? 'not all' : ORIG.get(r);
      if (r.media.mediaText !== want) r.media.mediaText = want;
    });
  }
  if (mode === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = mode;
}
const ICON = { auto: '🌓', dark: '🌙', light: '☀️' };
const TIP = { auto: 'תצוגה: לפי המכשיר', dark: 'תצוגה: כהה', light: 'תצוגה: בהירה' };
/** slot: איפה לשים את הכפתור (או null — רק להחיל) */
export function initTheme(slot) {
  const run = () => applyTheme();
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run, { once: true });
  // גיליונות CSS שנוספים אחר כך (חלונות, סינון) — גם הם
  if (!initTheme.obs) { initTheme.obs = new MutationObserver(() => { if (get() !== 'auto') applyTheme(); }); initTheme.obs.observe(document.head, { childList: true }); }
  if (!slot) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small-btn ms-theme-btn';
  const show = () => { b.textContent = ICON[get()]; b.title = TIP[get()]; };
  b.onclick = () => { const nx = { auto: 'dark', dark: 'light', light: 'auto' }[get()]; put(nx); applyTheme(nx); show(); };
  show(); slot.innerHTML = ''; slot.append(b);
}
