import { toHebrew, hebrewNumber, monthHe, isoToHebrewText } from '../hebdate.js?v=519';
// נייר מכתבים (בלאנק) פון א מוסד: א בילד פאר אויבן און פאר אונטן — פאר קבלות און מכתבים.
const LH = {
  yeshiva: { top: 'img/mosad/yeshiva/letterhead-top.png', bottom: 'img/mosad/yeshiva/letterhead-bottom.png', logo: 'img/mosad/yeshiva/logo.png' },
};
/** { top, bottom, logo } — פולע אדרעסן (פאר א נייעם פענצטער), אדער null */
export function letterhead(key) {
  const x = LH[key]; if (!x) return null;
  const abs = (p) => new URL(`../${p}`, location.href).href;
  return { top: abs(x.top), bottom: abs(x.bottom), logo: abs(x.logo) };
}
/** CSS + HTML פארן אויבן / אונטן פון א קבלה */
export const LH_CSS = '.lh-top { text-align: center; border-bottom: 1px solid #c9b48d; padding-bottom: 10px; } .lh-top img { width: 100%; max-height: 1.6in; object-fit: contain; } .lh-top .addr { margin-top: 6px; } .lh-bot { margin-top: 22px; } .lh-bot img { width: 100%; }';

// ---------- תאריך עברי (פאר חרדים אין ארץ ישראל קען קיינער נישט קיין לועזי) ----------
const iso10 = (v) => {
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v || ''))) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000).toISOString().slice(0, 10);
  return String(v || '').slice(0, 10);
};
/** "כ"ה חשון תשפ"ז" (ליידיג אויב קיין דאטום) */
export const heDate = (v) => { const s = iso10(v); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? isoToHebrewText(s) : String(v || ''); };
/** "כ"ה חשון" — קורץ, אן א יאר */
export const heShort = (v) => { const s = iso10(v); const x = /^\d{4}-\d{2}-\d{2}$/.test(s) ? toHebrew(s) : null; return x ? `${hebrewNumber(x.d)} ${monthHe(x.m)}` : String(v || ''); };
/** ביי יעדן <input type="date"> — דער עברי'שער דאטום דערנעבן */
export function hebrewDateHints(root = document.body) {
  const fix = (inp) => {
    if (inp.dataset.heHint) return; inp.dataset.heHint = '1';
    const sp = document.createElement('small'); sp.className = 'he-hint'; inp.after(sp);
    const upd = () => { sp.textContent = inp.value ? heDate(inp.value) : ''; };
    inp.addEventListener('input', upd); inp.addEventListener('change', upd); upd();
  };
  root.querySelectorAll('input[type=date]').forEach(fix);
  new MutationObserver(() => root.querySelectorAll('input[type=date]:not([data-he-hint])').forEach(fix)).observe(root, { childList: true, subtree: true });
}
