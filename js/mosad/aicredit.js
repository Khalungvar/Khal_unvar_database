// 💳 קרדיט AI למוסד (הישיבה): היתרה, טעינה דרך Stripe, היסטוריה. בלי קרדיט — ה-AI לא עובד.
let X = null; let cache = null;
export function initAiCredit(ctx) { X = ctx; }
const usd = (n) => `$${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;
export async function aiCredit(force) {
  if (!cache || force) cache = await X.call(X.KEY, 'aiCredit', {}).catch(() => ({ on: false }));
  return cache;
}
export function setBalance(b) { if (cache && b != null) cache.balance = b; }
/** שורה קטנה: "💳 קרדיט AI: $3.20 · ➕ טעינה" */
export async function chipHtml() {
  const c = await aiCredit();
  if (!c.on) return '';
  return `<span class="ai-chip${c.balance < 1 ? ' low' : ''}">💳 קרדיט AI: <b dir="ltr">${usd(c.balance)}</b>${c.canBuy ? ' · <button type="button" class="linkish" data-ai-buy>➕ טעינה</button>' : ''}</span>`;
}
export function wireChip(root) { root.querySelectorAll('[data-ai-buy]').forEach((b) => { b.onclick = () => creditDialog(); }); }

export async function creditDialog() {
  const { h } = X;
  const c = await aiCredit(true);
  if (!c.on) { X.toast('אין קרדיט AI במוסד הזה.'); return; }
  const d = X.dialog(`<h2>💳 קרדיט AI</h2>
    <p>היתרה: <b dir="ltr" style="font-size:1.4em">${usd(c.balance)}</b></p>
    <p class="muted small">העוזר (❓ שאל) וקריאת טפסים (📷 טופס נייר) מורידים מהקרדיט לפי השימוש: שאלה — בערך סנט אחד, טופס — כמה סנטים. כשהקרדיט נגמר, הם לא עובדים עד שטוענים.</p>
    ${c.canBuy ? `<h4>➕ טעינה</h4><div class="ai-amts">${[10, 20, 50, 100].map((n) => `<button type="button" class="btn" data-amt="${n}">$${n}</button>`).join('')}
      <label class="small">סכום אחר: $<input type="number" id="ai-amt" min="5" max="500" step="1" style="width:6em" dir="ltr"></label><button type="button" class="btn primary" id="ai-go">לתשלום</button></div>
      <p class="muted small">התשלום בכרטיס אשראי, בדף מאובטח של Stripe. נוסף $${c.fee.toFixed(2)} דמי טיפול לכל טעינה. אחרי התשלום הקרדיט מתעדכן תוך דקה–שתיים.</p>` : '<p class="muted small">טעינה — רק למנהלים.</p>'}
    ${c.owner ? `<p class="rf-warn small">👑 (רק לבעלים) שימושים: ${c.owner.n} · עלות אמיתית ${usd(c.owner.cost)} · חויב ${usd(c.owner.charged)} · ×${c.owner.markup}</p>` : ''}
    ${(c.history || []).length ? `<h4>היסטוריה</h4><div class="ms-wrap" style="max-height:40vh"><table class="ms-table"><thead><tr><th>מתי</th><th>מה</th><th>מי</th><th>סכום</th></tr></thead><tbody>
      ${c.history.map((r) => `<tr><td class="small" dir="ltr">${h(String(r.at).slice(0, 16))}</td><td class="small">${h(r.kind === 'purchase' ? '➕ טעינה' : r.kind === 'manual' ? '➕ הוספה ידנית' : r.note)}</td><td class="small">${h(r.by === 'stripe' ? '' : r.by)}</td>
        <td dir="ltr" class="${r.delta < 0 ? '' : 'pos'}">${r.delta < 0 ? '−' : '+'}${usd(Math.abs(r.delta))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`);
  const pay = async (n) => {
    try { const r = await X.call(X.KEY, 'aiCheckout', { usd: n }); location.href = r.url; } catch (err) { X.toast(err?.message === 'no-stripe' ? 'התשלום עוד לא מחובר בשרת (חסר מפתח Stripe).' : X.msg(err), 'err'); }
  };
  X.$$('[data-amt]', d).forEach((b) => { b.onclick = () => pay(Number(b.dataset.amt)); });
  X.$('#ai-go', d)?.addEventListener('click', () => { const n = Number(X.$('#ai-amt', d).value); if (!(n >= 5 && n <= 500)) { X.toast('סכום בין $5 ל-$500.', 'err'); return; } pay(n); });
}
