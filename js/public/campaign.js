// 🌐 דף קמפיין באתר הציבורי: campaign.html?c=<slug> (בלי slug — רשימת הקמפיינים הפעילים).
// הנתונים: השומר (webCampaign) — הגדרות מהלשונית WebCampaigns, נאסף + תורמים מ-Donations.
// תשלום: Sola iFields — מספר הכרטיס וה-CVV נכנסים בתוך iframe של Sola; אלינו מגיע רק "טוקן חד-פעמי" (SUT),
// והשומר מבצע cc:Sale. הוראת קבע: Sola Recurring (מהחודש הבא).
import { CONFIG } from '../config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(`pub:${k}`) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(`pub:${k}`, JSON.stringify(v)); } catch { /* */ } };
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: Number(n) % 1 ? 2 : 0, minimumFractionDigits: Number(n) % 1 ? 2 : 0 })}`;

const LANGS = ['yi', 'he', 'en'];
function pickLang() {
  const mine = lsGet('lang'); if (LANGS.includes(mine)) return mine;
  try { const app = localStorage.getItem('khal-lang'); if (LANGS.includes(app)) return app; } catch { /* */ }
  for (const l of navigator.languages || [navigator.language || '']) {
    const x = String(l).toLowerCase();
    if (/^(he|iw)\b/.test(x)) return 'he';
    if (/^(yi|ji)\b/.test(x)) return 'yi';
  }
  return 'en';
}
let LANG = pickLang();

const T = {
  he: {
    home: '← לדף הבית', raised: 'נאספו', of: 'מתוך יעד של', donors: 'תורמים', daysLeft: (n) => `נשארו ${n} ימים`, ended: 'הקמפיין הסתיים', pctGoal: 'מהיעד',
    pkgs: 'אפשרויות הקדשה', taken: '✓ כבר הוקדש', recent: 'תורמים אחרונים', anonName: 'תורם בעילום שם', perMonth: '/חודש',
    give: 'לתרום עכשיו', once: 'חד-פעמי', monthly: 'הוראת קבע חודשית', months: 'מספר חודשים', monthsAll: 'עד לביטול', other: 'סכום אחר',
    ded: 'הקדשה (לא חובה)', dedTypes: ['לע"נ', 'לזכות', 'לרפו"ש', 'להצלחת'], dedText: 'שם המוקדש', you: 'פרטי התורם', first: 'שם פרטי', last: 'שם משפחה',
    phone: 'טלפון נייד', email: 'אימייל — לקבלה', card: 'מספר כרטיס', exp: 'תוקף (MM/YY)', cvv: 'CVV',
    fee: (x) => `אני רוצה לכסות את עמלת הסליקה (${x})`, anon: 'להציג אותי בעילום שם', pay: (x) => `לתרום ${x}`, payM: (x) => `לתרום ${x} לחודש`,
    secure: '🔒 תשלום מאובטח דרך Sola. מספר הכרטיס לא עובר דרכנו.', receipt: 'קבלה נשלחת במייל.',
    soon: 'התרומה בכרטיס באתר תיפתח בקרוב. בינתיים: (718) 851-0806 · office@ungvar.org',
    working: 'מעבד…', thanks: 'תודה רבה!', thanksTxt: (a, l4) => `התרומה ע"ס ${a} התקבלה (כרטיס ${l4}).`, thanksM: 'הוראת הקבע נקבעה מהחודש הבא.',
    schedErr: 'התשלום עבר, אבל הוראת הקבע לא נקבעה. נחזור אליך.', again: 'תרומה נוספת', list: 'קמפיינים', none: 'אין כרגע קמפיינים פעילים.', notFound: 'הקמפיין לא נמצא.',
    err: { 'need-name': 'נא למלא שם פרטי ומשפחה.', 'bad-phone': 'מספר טלפון לא תקין.', 'bad-email': 'אימייל לא תקין.', 'bad-exp': 'תוקף לא תקין (MM/YY).', 'bad-amount': 'נא לבחור סכום.', 'need-card': 'נא למלא את פרטי הכרטיס.', declined: 'הכרטיס לא אושר.', 'too-many': 'יותר מדי ניסיונות. נסה שוב מאוחר יותר.', 'not-ready': 'התרומה באתר עוד לא פעילה.', gateway: 'תקלה בחיבור. נסה שוב.', other: 'משהו השתבש. נסה שוב.' },
  },
  yi: {
    home: '← צום היים בלאט', raised: 'געזאמלט', of: 'פון א ציל פון', donors: 'נדבנים', daysLeft: (n) => `נאך ${n} טעג`, ended: 'דער קאמפיין האט זיך געענדיגט', pctGoal: 'פון ציל',
    pkgs: 'אפציעס פאר נדבות', taken: '✓ שוין גענומען', recent: 'לעצטע נדבנים', anonName: 'א נדבן אן נאמען', perMonth: '/חודש',
    give: 'געבן יעצט', once: 'איין מאל', monthly: 'יעדן חודש', months: 'וויפיל חדשים', monthsAll: 'ביז אפגעשטעלט', other: 'אנדער סכום',
    ded: 'לזכר / לזכות (נישט מוז)', dedTypes: ['לע"נ', 'לזכות', 'לרפו"ש', 'להצלחת'], dedText: 'נאמען', you: 'פרטים פונעם נדבן', first: 'ערשטע נאמען', last: 'פאמיליע נאמען',
    phone: 'סעלפאון', email: 'אימעיל — פאר א קבלה', card: 'קארטל נומער', exp: 'ביז (MM/YY)', cvv: 'CVV',
    fee: (x) => `איך וויל צאלן די פראצעסינג אפצאל (${x})`, anon: 'ווייזן מיר אן נאמען', pay: (x) => `געבן ${x}`, payM: (x) => `געבן ${x} יעדן חודש`,
    secure: '🔒 זיכערע צאלונג דורך Sola. דער קארטל נומער גייט נישט דורך אונז.', receipt: 'א קבלה ווערט געשיקט אין אימעיל.',
    soon: 'געבן מיט א קארטל אויפן וועבזייטל עפנט זיך באלד. דערווייל: (718) 851-0806 · office@ungvar.org',
    working: 'ארבעט…', thanks: 'א גרויסן דאנק!', thanksTxt: (a, l4) => `די נדבה פון ${a} איז אנגענומען (קארטל ${l4}).`, thanksM: 'די חודש\'ליכע צאלונג הייבט זיך אן קומענדיגן חודש.',
    schedErr: 'די צאלונג איז דורך, אבער די חודש\'ליכע איז נישט אויפגעשטעלט. מיר וועלן זיך פארבינדן.', again: 'נאך א נדבה', list: 'קאמפיינען', none: 'יעצט זענען נישטא קיין קאמפיינען.', notFound: 'דער קאמפיין איז נישט געפונען.',
    err: { 'need-name': 'ביטע אריינשרייבן נאמען און פאמיליע נאמען.', 'bad-phone': 'נישט ריכטיגער טעלעפאן.', 'bad-email': 'נישט ריכטיגער אימעיל.', 'bad-exp': 'נישט ריכטיג (MM/YY).', 'bad-amount': 'ביטע אויסקלייבן א סכום.', 'need-card': 'ביטע אריינשרייבן די קארטל פרטים.', declined: 'דער קארטל איז נישט אנגענומען.', 'too-many': 'צופיל פרואוון. פרואווט שפעטער.', 'not-ready': 'נאך נישט אקטיוו.', gateway: 'א פראבלעם מיטן פארבינדונג. פרואווט נאכאמאל.', other: 'עפעס איז נישט געגאנגען. פרואווט נאכאמאל.' },
  },
  en: {
    home: '← Home', raised: 'raised', of: 'of a goal of', donors: 'donors', daysLeft: (n) => `${n} days left`, ended: 'This campaign has ended', pctGoal: 'of goal',
    pkgs: 'Sponsorship options', taken: '✓ Sponsored', recent: 'Recent donors', anonName: 'Anonymous', perMonth: '/mo',
    give: 'Donate now', once: 'One-time', monthly: 'Monthly', months: 'Number of months', monthsAll: 'Until cancelled', other: 'Other amount',
    ded: 'Dedication (optional)', dedTypes: ['In memory of', 'In honor of', 'For the recovery of', 'For the success of'], dedText: 'Name', you: 'Your details', first: 'First name', last: 'Last name',
    phone: 'Mobile phone', email: 'Email — for your receipt', card: 'Card number', exp: 'Expiry (MM/YY)', cvv: 'CVV',
    fee: (x) => `Cover the processing fee (${x})`, anon: 'Show me as anonymous', pay: (x) => `Donate ${x}`, payM: (x) => `Donate ${x} monthly`,
    secure: '🔒 Secure payment through Sola. Your card number never passes through our servers.', receipt: 'A receipt is emailed to you.',
    soon: 'Online card donations open soon. Meanwhile: (718) 851-0806 · office@ungvar.org',
    working: 'Processing…', thanks: 'Thank you!', thanksTxt: (a, l4) => `Your donation of ${a} was received (card ${l4}).`, thanksM: 'Your monthly donation starts next month.',
    schedErr: 'Your payment went through, but the monthly schedule was not set up. We will contact you.', again: 'Another donation', list: 'Campaigns', none: 'There are no active campaigns right now.', notFound: 'Campaign not found.',
    err: { 'need-name': 'Please enter your first and last name.', 'bad-phone': 'Invalid phone number.', 'bad-email': 'Invalid email.', 'bad-exp': 'Invalid expiry (MM/YY).', 'bad-amount': 'Please choose an amount.', 'need-card': 'Please enter your card details.', declined: 'The card was declined.', 'too-many': 'Too many attempts. Please try later.', 'not-ready': 'Online donations are not active yet.', gateway: 'Connection problem. Please try again.', other: 'Something went wrong. Please try again.' },
  },
};
const L = () => T[LANG];
const tr = (o, k) => o?.[`${k}_${LANG}`] || o?.[`${k}_he`] || o?.[`${k}_yi`] || o?.[`${k}_en`] || '';

async function guard(body) {
  const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}

let DATA = null; let SLUG = '';
const F = { amount: 0, pkg: '', monthly: false, months: 0, fee: true, anon: false };

function applyLang() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl';
  $$('[data-t]').forEach((e) => { const v = L()[e.dataset.t]; if (typeof v === 'string') e.textContent = v; });
  $$('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
}
function setLang(l) { LANG = l; lsSet('lang', l); applyLang(); render(); }

// ---------- iFields (Sola) ----------
const IF_VERSIONS = ['2.15.2401.3101', '2.15.2309.2601', '2.14.2211.1101', '2.6.2006.0102'];
let IF_VER = '';
function loadIfields() {
  if (window.setAccount && IF_VER) return Promise.resolve(IF_VER);
  return IF_VERSIONS.reduce((p, v) => p.catch(() => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = `https://cdn.cardknox.com/ifields/${v}/ifields.min.js`;
    s.onload = () => { IF_VER = v; ok(v); }; s.onerror = () => { s.remove(); no(new Error('ifields')); };
    document.head.append(s);
  })), Promise.reject(new Error('start')));
}

// ---------- רינדור ----------
function heroHtml(c) {
  const goal = Number(c.goal) || 0; const pct = goal ? Math.min(100, Math.round((DATA.raised / goal) * 100)) : 0;
  let left = '';
  if (c.end_date) { const d = Math.ceil((new Date(`${c.end_date}T23:59:59`) - new Date()) / 864e5); left = d >= 0 ? L().daysLeft(d) : L().ended; }
  const img = c.image ? `style="background-image:linear-gradient(180deg,rgba(40,10,10,.05),rgba(40,10,10,.65)),url('${h(c.image)}')"` : '';
  return `<section class="pb-card cp-hero">
    <div class="cp-pic${c.image ? ' has-img' : ''}" ${img}><div><small>${h(tr(c, 'sub'))}</small><h1>${h(tr(c, 'title'))}</h1></div></div>
    <div class="cp-hb">${tr(c, 'desc') ? `<p class="cp-desc" dir="auto">${h(tr(c, 'desc')).replace(/\n/g, '<br>')}</p>` : ''}
      ${c.donors_mode === 'none' && !goal ? '' : `<div class="cp-prog"><span class="cp-big">${money(DATA.raised)}</span>
        <span>${goal ? `${h(L().raised)} ${h(L().of)} <b>${money(goal)}</b>` : h(L().raised)}</span></div>
      ${goal ? `<div class="cp-track"><i style="width:${pct}%"></i></div>` : ''}
      <div class="cp-stats">${goal ? `<span><b>${pct}%</b> ${h(L().pctGoal)}</span>` : ''}<span><b>${DATA.donors}</b> ${h(L().donors)}</span>${left ? `<span>${h(left)}</span>` : ''}</div>`}
    </div></section>`;
}
function pkgsHtml(c) {
  if (!c.packages.length) return '';
  return `<section class="pb-card"><h2 class="cp-h">${h(L().pkgs)}</h2><div class="cp-pkgs">${c.packages.map((p) => {
    const lim = Number(p.limit) || 0; const used = DATA.taken[p.id] || 0; const full = lim && used >= lim;
    return `<button type="button" class="cp-pkg${F.pkg === p.id ? ' on' : ''}${full ? ' taken' : ''}" data-pkg="${h(p.id)}"${full ? ' disabled' : ''}>
      <b dir="auto">${h(tr(p, 'name'))}</b><span>${money(p.amount)}</span><em dir="auto">${full ? h(L().taken) : h(tr(p, 'note'))}</em></button>`;
  }).join('')}</div></section>`;
}
function recentHtml(c) {
  if (c.donors_mode === 'none' || !DATA.recent.length) return '';
  return `<section class="pb-card"><h2 class="cp-h">${h(L().recent)}</h2><div class="cp-wall">${DATA.recent.map((d) => {
    const nm = d.anon ? L().anonName : (LANG === 'en' ? d.en || d.he : d.he || d.en);
    return `<div class="cp-dn"><div><b><bdi>${h(nm)}</bdi></b>${d.ded ? `<small dir="auto">${h(d.ded)}</small>` : ''}</div>${d.amount != null ? `<span class="cp-amt">${money(d.amount)}${d.monthly ? h(L().perMonth) : ''}</span>` : ''}</div>`;
  }).join('')}</div></section>`;
}
const feeOf = (a) => Math.round(a * 0.03 * 100) / 100;
function totalOf() { const c = DATA.campaign; const a = F.pkg ? Number(c.packages.find((p) => p.id === F.pkg)?.amount) || 0 : F.amount; return { base: a, total: Math.round((a + (c.fee && F.fee ? feeOf(a) : 0)) * 100) / 100 }; }
function formHtml(c) {
  const amts = String(c.amounts || '36,54,100,180,360,500,1000').split(/[,\s]+/).map(Number).filter((x) => x > 0);
  const ready = DATA.pay && DATA.ifields;
  const T0 = L();
  return `<section class="pb-card cp-form" id="cp-form"><h2 class="cp-h">${h(T0.give)}</h2>
    ${ready ? '' : `<p class="cp-soon">${h(T0.soon)}</p>`}
    <form ${ready ? '' : 'inert class="cp-off"'} autocomplete="on">
      ${c.monthly && !F.pkg ? `<div class="cp-tog"><button type="button" data-mon="0" class="${F.monthly ? '' : 'on'}">${h(T0.once)}</button><button type="button" data-mon="1" class="${F.monthly ? 'on' : ''}">${h(T0.monthly)}</button></div>
        ${F.monthly ? `<label class="cp-l">${h(T0.months)} <select name="months"><option value="0">${h(T0.monthsAll)}</option>${[3, 6, 10, 12, 18, 24, 36].map((m) => `<option value="${m}"${F.months === m ? ' selected' : ''}>${m}</option>`).join('')}</select></label>` : ''}` : ''}
      ${F.pkg ? '' : `<div class="cp-amts">${amts.map((a) => `<button type="button" data-amt="${a}" class="${F.amount === a ? 'on' : ''}">${money(a)}</button>`).join('')}
        <input type="number" min="1" step="1" inputmode="decimal" name="custom" placeholder="${h(T0.other)}" value="${amts.includes(F.amount) || !F.amount ? '' : F.amount}"></div>`}
      ${F.pkg ? `<p class="cp-pkgsel">✓ <b>${h(tr(c.packages.find((p) => p.id === F.pkg), 'name'))}</b> — ${money(totalOf().base)} <button type="button" class="cp-link" data-unpkg>✕</button></p>` : ''}
      <p class="cp-l">${h(T0.ded)}</p>
      <div class="cp-row"><select name="dedType">${T0.dedTypes.map((x) => `<option>${h(x)}</option>`).join('')}</select><input name="dedText" maxlength="120" placeholder="${h(T0.dedText)}"></div>
      <p class="cp-l">${h(T0.you)}</p>
      <div class="cp-row"><input name="first" autocomplete="given-name" placeholder="${h(T0.first)}" required><input name="last" autocomplete="family-name" placeholder="${h(T0.last)}" required></div>
      <div class="cp-row"><input name="phone" type="tel" dir="ltr" autocomplete="tel" placeholder="${h(T0.phone)}"><input name="email" type="email" dir="ltr" autocomplete="email" placeholder="${h(T0.email)}"></div>
      <div class="cp-card" dir="ltr">
        <label>${h(T0.card)}<iframe class="cp-if" data-ifields-id="card-number" data-ifields-placeholder="Card number" src="${IF_VER ? `https://cdn.cardknox.com/ifields/${IF_VER}/ifield.htm` : 'about:blank'}" title="card"></iframe></label>
        <div class="cp-row"><label>${h(T0.exp)}<input name="exp" inputmode="numeric" maxlength="5" placeholder="MM/YY" autocomplete="cc-exp"></label>
          <label>${h(T0.cvv)}<iframe class="cp-if" data-ifields-id="cvv" data-ifields-placeholder="CVV" src="${IF_VER ? `https://cdn.cardknox.com/ifields/${IF_VER}/ifield.htm` : 'about:blank'}" title="cvv"></iframe></label></div>
        <input type="hidden" data-ifields-id="card-number-token" name="xCardNum"><input type="hidden" data-ifields-id="cvv-token" name="xCVV">
        <label data-ifields-id="card-data-error" class="cp-err"></label>
      </div>
      ${c.fee ? `<label class="cp-chk"><input type="checkbox" name="fee"${F.fee ? ' checked' : ''}> ${h(T0.fee(money(feeOf(totalOf().base) || 0)))}</label>` : ''}
      <label class="cp-chk"><input type="checkbox" name="anon"${F.anon ? ' checked' : ''}> ${h(T0.anon)}</label>
      <input name="website" class="cp-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="cp-msg" role="alert"></p>
      <button type="submit" class="pb-btn gold cp-pay">${h(F.monthly && !F.pkg ? T0.payM(money(totalOf().total)) : T0.pay(money(totalOf().total)))}</button>
      <p class="cp-sec">${h(T0.secure)} ${h(T0.receipt)}<br><span dir="ltr">Khal Ungvar · 501(c)(3) · EIN 11-2330829</span></p>
    </form></section>`;
}

function render() {
  const root = $('#cp-root'); if (!root) return;
  if (!DATA) return;
  if (DATA.list) {
    root.innerHTML = `<section class="pb-card"><h2 class="cp-h">${h(L().list)}</h2>${DATA.list.length ? `<div class="cp-list">${DATA.list.map((x) => `<a class="cp-li" href="campaign.html?c=${encodeURIComponent(x.slug)}">${x.image ? `<img src="${h(x.image)}" alt="">` : ''}<b>${h(tr(x, 'title'))}</b></a>`).join('')}</div>` : `<p>${h(L().none)}</p>`}</section>`;
    return;
  }
  if (DATA.error) { root.innerHTML = `<section class="pb-card"><p>${h(L().notFound)}</p></section>`; return; }
  const c = DATA.campaign;
  document.title = `${tr(c, 'title')} – Khal Ungvar`;
  root.innerHTML = `<div class="cp-grid"><div class="cp-main">${heroHtml(c)}${pkgsHtml(c)}${recentHtml(c)}</div><div class="cp-side">${formHtml(c)}</div></div>`;
  wire();
}

function setupIfields() {
  if (!window.setAccount || !DATA?.ifields) return;
  try {
    window.setAccount(DATA.ifields, 'KhalUngvar', '1.0');
    const st = { border: '1px solid #e8dcc4', 'border-radius': '8px', padding: '8px 10px', 'font-size': '16px', width: '100%', 'box-sizing': 'border-box' };
    window.setIfieldStyle?.('card-number', st); window.setIfieldStyle?.('cvv', st);
    window.enableAutoFormatting?.(' ');
  } catch (err) { console.warn('ifields', err); }
}

function wire() {
  const form = $('#cp-form form'); if (!form) return;
  const c = DATA.campaign;
  // שומרים ערכים שהוקלדו כשמרנדרים מחדש (שינוי סכום וכו')
  const keep = lsGet('donor') || {};
  ['first', 'last', 'phone', 'email'].forEach((k) => { if (form[k] && keep[k]) form[k].value = keep[k]; });
  const rerender = () => {
    const vals = {}; ['first', 'last', 'phone', 'email', 'dedText', 'exp'].forEach((k) => { if (form[k]) vals[k] = form[k].value; });
    const dt = form.dedType?.selectedIndex || 0;
    render();
    const f2 = $('#cp-form form'); Object.entries(vals).forEach(([k, v]) => { if (f2[k]) f2[k].value = v; }); if (f2.dedType) f2.dedType.selectedIndex = dt;
    setupIfields();
  };
  $$('[data-pkg]').forEach((b) => { b.onclick = () => { F.pkg = F.pkg === b.dataset.pkg ? '' : b.dataset.pkg; F.monthly = false; rerender(); $('#cp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  $$('[data-unpkg]').forEach((b) => { b.onclick = () => { F.pkg = ''; rerender(); }; });
  $$('[data-amt]').forEach((b) => { b.onclick = () => { F.amount = Number(b.dataset.amt); rerender(); }; });
  $$('[data-mon]').forEach((b) => { b.onclick = () => { F.monthly = b.dataset.mon === '1'; rerender(); }; });
  if (form.custom) form.custom.onchange = () => { F.amount = Math.max(0, Number(form.custom.value) || 0); rerender(); };
  if (form.months) form.months.onchange = () => { F.months = Number(form.months.value) || 0; };
  if (form.fee) form.fee.onchange = () => { F.fee = form.fee.checked; rerender(); };
  if (form.anon) form.anon.onchange = () => { F.anon = form.anon.checked; };
  if (form.exp) form.exp.oninput = () => { let v = form.exp.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`; form.exp.value = v; };
  form.onsubmit = (e) => { e.preventDefault(); pay(form); };
  void c;
}

function pay(form) {
  const T0 = L(); const msg = $('.cp-msg', form); const btn = $('.cp-pay', form);
  const fail = (code, extra = '') => { msg.textContent = (T0.err[code] || T0.err.other) + (extra ? ` (${extra})` : ''); btn.disabled = false; btn.classList.remove('busy'); };
  const { base } = totalOf();
  if (!(base >= 1)) return fail('bad-amount');
  if (!form.first.value.trim() || !form.last.value.trim()) return fail('need-name');
  const exp = form.exp.value.replace(/\D/g, '');
  if (!/^(0[1-9]|1[0-2])\d{2}$/.test(exp)) return fail('bad-exp');
  lsSet('donor', { first: form.first.value.trim(), last: form.last.value.trim(), phone: form.phone.value.trim(), email: form.email.value.trim() });
  btn.disabled = true; btn.classList.add('busy'); msg.textContent = T0.working;
  if (typeof window.getTokens !== 'function') return fail('gateway');
  window.getTokens(async () => {
    const card = $('[data-ifields-id="card-number-token"]', form).value; const cvv = $('[data-ifields-id="cvv-token"]', form).value;
    if (!card || !cvv) return fail('need-card');
    try {
      const j = await guard({ action: 'webDonate', c: SLUG, amount: base, pkg: F.pkg, monthly: F.monthly && !F.pkg, months: F.months, fee: !!(DATA.campaign.fee && F.fee), anon: F.anon,
        first: form.first.value.trim(), last: form.last.value.trim(), phone: form.phone.value.trim(), email: form.email.value.trim(),
        dedType: form.dedType.value, dedText: form.dedText.value.trim(), card, cvv, exp, website: form.website.value, lang: LANG });
      if (j.error) return fail(j.error, j.error === 'declined' ? j.msg : '');
      $('#cp-form').innerHTML = `<h2 class="cp-h">${h(T0.thanks)}</h2><p>${h(T0.thanksTxt(money(j.amount), j.last4 || ''))}</p>
        ${j.monthly ? `<p>${h(j.sched ? T0.thanksM : T0.schedErr)}</p>` : ''}
        <p><button type="button" class="pb-btn primary" data-again>${h(T0.again)}</button></p>`;
      $('[data-again]').onclick = () => { F.pkg = ''; load(); };
      setTimeout(load, 4000);
    } catch { fail('gateway'); }
  }, () => fail('need-card'), 30000);
}

async function load() {
  try { DATA = await guard({ action: 'webCampaign', c: SLUG, preview: new URLSearchParams(location.search).get('preview') || '' }); } catch { DATA = { error: 'net' }; }
  if (DATA.campaign) {
    if (!F.amount && !F.pkg) { const a = String(DATA.campaign.amounts || '').split(/[,\s]+/).map(Number).filter((x) => x > 0); F.amount = a[3] || a[0] || 180; }
    if (DATA.pay && DATA.ifields) { try { await loadIfields(); } catch { DATA.pay = false; } }
  }
  render(); setupIfields();
}

export function startCampaign() {
  SLUG = (new URLSearchParams(location.search).get('c') || '').trim().toLowerCase();
  $$('[data-lang]').forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
  applyLang();
  load();
}
