// מטבעות: דולר / שקל / אירו / ליש"ט. א נדבה אין אן אנדער מטבע האט: currency, amount_orig, fx_rate — און amount_usd (פאר די סכומים).
// דער שער: פונעם אייראפעאישן צענטראל-באנק (frankfurter), לויטן טאג פון דער נדבה/קבלה. מ'קען אים טוישן.
export const CURRENCIES = [
  { code: 'USD', sym: '$', he: 'דולר' },
  { code: 'ILS', sym: '₪', he: 'שקל' },
  { code: 'EUR', sym: '€', he: 'אירו' },
  { code: 'GBP', sym: '£', he: 'ליש"ט' },
];
const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const symOf = (code) => (CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]).sym;
export const isForeign = (d) => Boolean(d && d.currency && d.currency !== 'USD' && Number(d.amount_orig));
/** "₪500" */
export const fmtCur = (n, code) => `${symOf(code)}${NF.format(Number(n || 0))}`;
/** פאר א נדבה: "₪500 ≈ $135" (אדער נאר "$135") */
export function amountLabel(d) {
  const usd = `$${NF.format(Number(d?.amount_usd || 0))}`;
  return isForeign(d) ? `${fmtCur(d.amount_orig, d.currency)} ≈ ${usd}` : usd;
}

const KEY = 'khal-fx';
let mem = null;
function cache() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { mem = {}; }
  return mem;
}
function remember(k, v) {
  cache()[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* */ }
}
/** וויפיל דולער פאר 1 פון דעם מטבע, אויף דעם טאג (date = 'YYYY-MM-DD'; ליידיג = היינט). { rate, date } אדער null */
export async function usdRate(code, date = '') {
  if (!code || code === 'USD') return { rate: 1, date };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : 'latest';
  const k = `${code}:${day}`;
  if (day !== 'latest' && cache()[k]) return cache()[k];
  const urls = [`https://api.frankfurter.app/${day}?from=${code}&to=USD`, `https://api.frankfurter.dev/v1/${day}?base=${code}&symbols=USD`];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = await r.json();
      const rate = Number(j?.rates?.USD);
      if (rate > 0) { const out = { rate, date: j.date || day }; if (day !== 'latest') remember(k, out); return out; }
    } catch { /* דער צווייטער */ }
  }
  return null;
}
/** סכום אין דעם מטבע → דולער (2 ציפערן) */
export const toUsd = (amount, rate) => Math.round(Number(amount || 0) * Number(rate || 0) * 100) / 100;
