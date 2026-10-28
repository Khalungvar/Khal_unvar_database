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
