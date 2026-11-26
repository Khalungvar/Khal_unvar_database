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
    match: (m, sp) => `כל דולר מוכפל ×${m}${sp ? ` בזכות ${sp}` : ''}`, withMatch: 'כולל ההכפלה', toEvent: 'עד האירוע', scan: 'לתרומה:',
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
    match: (m, sp) => `יעדער דאלער ווערט געטאפלט ×${m}${sp ? ` א דאנק ${sp}` : ''}`, withMatch: 'מיט די טאפלונג', toEvent: 'ביז די סעודה', scan: 'געבן:',
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
    match: (m, sp) => `Every dollar matched ×${m}${sp ? ` thanks to ${sp}` : ''}`, withMatch: 'with matching', toEvent: 'until the event', scan: 'Donate:',
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
// מצב "שתי השפות ביחד" (both בקובץ התמונות): אידיש + אנגלית באותו דף, בלי בחירת שפה
let BOTH = false; let BOTH_T = null;
const ISO = (t) => `\u2068${t}\u2069`; // בידוד כיווניות: אנגלית בתוך דף מימין לשמאל
function bothDict() {
  if (BOTH_T) return BOTH_T; const a = T.yi; const b = T.en; BOTH_T = {};
  Object.keys(a).forEach((k) => {
    const x = a[k]; const y = b[k];
    if (typeof x === 'string' && typeof y === 'string') BOTH_T[k] = x === y ? x : `${ISO(x)} · ${ISO(y)}`;
    else if (typeof x === 'function' && typeof y === 'function') BOTH_T[k] = (...v) => `${ISO(x(...v))} · ${ISO(y(...v))}`;
    else BOTH_T[k] = x;
  });
  return BOTH_T;
}
const L = () => (BOTH ? bothDict() : T[LANG]);
const tr = (o, k) => {
  if (BOTH) { const v = [o?.[`${k}_yi`], o?.[`${k}_en`]].filter(Boolean); const j = [...new Set(v)].map(ISO).join('\n'); if (j) return j; }
  return o?.[`${k}_${LANG}`] || o?.[`${k}_he`] || o?.[`${k}_yi`] || o?.[`${k}_en`] || '';
};

async function guard(body) {
  const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}

let DATA = null; let SLUG = ''; let SCREEN = false;
// 🎞 סרט תמונות נע בראש הדף: img/<slug>-gallery.json = [{src, cap}] (אם אין קובץ — אין סרט)
let GAL = null; let CAMP_LANGS = null; let BANNER = null; let STATIC = null; const REEL_T0 = Date.now(); const REEL_PX = 38; // מהירות הסרט: פיקסלים לשנייה
let GAL_P = null;
function loadGallery() { GAL_P = GAL_P || loadGallery0(); return GAL_P; }
async function loadGallery0() {
  GAL = [];
  try { const r = await fetch(`img/${encodeURIComponent(SLUG)}-gallery.json`); if (r.ok) { const j = await r.json(); const items = Array.isArray(j) ? j : j?.items; if (Array.isArray(items)) GAL = items.filter((x) => x && x.src); if (Array.isArray(j?.langs) && j.langs.length) CAMP_LANGS = j.langs.filter((l) => LANGS.includes(l)); if (j?.both) { BOTH = true; LANG = 'yi'; } if (j?.banner) BANNER = j.banner; if (j?.campaign?.slug) STATIC = j.campaign; } } catch { /* */ }
  if (GAL.length && !document.getElementById('cp-reel-css')) {
    const st = document.createElement('style'); st.id = 'cp-reel-css';
    st.textContent = `.cp-main{min-width:0}.cp-reel{--s:34px;--g:10px;position:relative;height:210px;width:100%;overflow:hidden;contain:inline-size;direction:ltr;background:linear-gradient(180deg,#ecd28c,#c9a23f 55%,#9c7425)}
.cp-reel-track{display:flex;height:100%;width:max-content;animation:cpReel 120s linear infinite}
.cp-reel:hover .cp-reel-track{animation-play-state:paused}
.cp-reel figure{position:relative;margin:0 0 0 calc(var(--g) - var(--s));height:100%;flex:none;clip-path:polygon(var(--s) 0,100% 0,calc(100% - var(--s)) 100%,0 100%)}
.cp-reel img{height:100%;width:auto;display:block}
.cp-reel figcaption{position:absolute;inset:auto 0 0 0;padding:22px calc(var(--s) + 8px) 7px;direction:rtl;text-align:center;color:#fff;font-size:14px;line-height:1.3;font-weight:600;background:linear-gradient(transparent,rgba(0,0,0,.72));text-shadow:0 1px 2px rgba(0,0,0,.6)}
.cp-reel-logo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);height:88%;aspect-ratio:1126/1185;display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none}
.cp-reel-logo img{height:100%;width:100%;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.55)) drop-shadow(0 3px 4px rgba(0,0,0,.45))}
.cp-bnr > .cp-reel-logo{top:calc(var(--h) * .155);height:calc(var(--h) * 1.045);transform:translateX(-50%);z-index:3}
.cp-reel + .cp-pic{min-height:0;padding-top:14px}
body.cp-banner .cp-top{display:none}body.cp-both .pb-bar{display:none}
body.cp-both .cp-pkg b,body.cp-both .cp-pkg em,body.cp-both .cp-h{white-space:pre-line}body.cp-banner #cp-root{margin-top:0}
.cp-bnr{--h:340px;width:100vw;margin:0 calc(50% - 50vw) 18px;position:relative}
.cp-bnr .cp-reel{height:var(--h);--s:46px;--g:12px}
.cp-bnr .cp-pic{min-height:calc(var(--h) * .24);padding:14px max(22px,calc(50vw - 574px)) 16px}
.cp-bnr .cp-pic.two{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;direction:ltr}
.cp-bnr .cp-pic.two > div{max-width:calc(50% - var(--h) * .55)}
.cp-bnr .cp-pic.two h1{font-size:clamp(22px,2.5vw,32px);white-space:nowrap}.cp-bnr .cp-pic.two .yi{direction:rtl;text-align:right}.cp-bnr .cp-pic.two .en{direction:ltr;text-align:left}
@media (max-width:900px){.cp-bnr .cp-pic.two{padding-top:calc(var(--h) * .22 + 8px)}.cp-bnr .cp-pic.two > div{max-width:50%}.cp-bnr .cp-pic.two h1{font-size:24px;white-space:normal}}
@media (max-width:640px){.cp-bnr .cp-pic.two h1{font-size:18px;white-space:normal}.cp-bnr .cp-pic.two small{font-size:11px}}
@keyframes cpReel{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (max-width:640px){.cp-bnr{--h:190px}.cp-reel{height:170px}.cp-reel,.cp-bnr .cp-reel{--s:24px;--g:7px}.cp-reel figcaption{font-size:12px;padding:16px calc(var(--s) + 4px) 5px}}`;
    document.head.appendChild(st);
  }
}
/** מהירות קבועה לפי רוחב הסרט, וממשיך מאותה נקודה גם כשהדף מתרנדר מחדש */
function fixReel() {
  const tr = $('.cp-reel-track'); if (!tr) return;
  const dur = Math.max(20, tr.scrollWidth / 2 / REEL_PX);
  tr.style.animationDuration = `${dur.toFixed(1)}s`;
  tr.style.animationDelay = `-${(((Date.now() - REEL_T0) / 1000) % dur).toFixed(2)}s`;
}
let reelResize = false;
/** באנר לכל רוחב העמוד: סרט התמונות + הלוגו באמצע + שם הקמפיין */
function bannerHtml(c) {
  const logo = /#logo$/.test(c.image || '');
  const src = logo ? c.image.replace(/#logo$/, '') : '';
  return `<section class="cp-bnr">${reelHtml(c, '')}${src ? `<div class="cp-reel-logo"><img src="${h(src)}" alt="${h(tr(c, 'title'))}"></div>` : ''}${CAMP_LANGS && CAMP_LANGS.length === 2 ? `<div class="cp-pic two">${['en', 'yi'].filter((l) => CAMP_LANGS.includes(l)).map((l) => `<div class="${l}" lang="${l}"><small>${h(c[`sub_${l}`] || '')}</small><h1>${h(c[`title_${l}`] || '')}</h1></div>`).join('')}</div>` : `<div class="cp-pic"><div><small>${h(tr(c, 'sub'))}</small><h1>${h(tr(c, 'title'))}</h1></div></div>`}</section>`;
}
function reelHtml(c, logoSrc) {
  const one = GAL.map((g) => `<figure><img src="${h(g.src)}" alt="${h(g.cap || '')}"${g.w && g.h ? ` width="${Number(g.w)}" height="${Number(g.h)}"` : ''}>${g.cap ? `<figcaption>${h(g.cap)}</figcaption>` : ''}</figure>`).join('');
  return `<div class="cp-reel"><div class="cp-reel-track">${one}${one}</div>${logoSrc ? `<div class="cp-reel-logo"><img src="${h(logoSrc)}" alt="${h(tr(c, 'title'))}"></div>` : ''}</div>`;
}
const F = { amount: 0, pkg: '', preset: '', monthly: false, months: 0, fee: true, anon: false, dedT: '', dedOpen: false, ys: null, n: 1, day: Math.min(28, new Date().getDate()) };

function applyLang() {
  document.body.classList.toggle('cp-both', BOTH);
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl';
  $$('[data-t]').forEach((e) => { const v = L()[e.dataset.t]; if (typeof v === 'string') e.textContent = v; });
  $$('[data-lang]').forEach((b) => { b.classList.toggle('on', b.dataset.lang === LANG); b.hidden = !!(CAMP_LANGS && !CAMP_LANGS.includes(b.dataset.lang)); });
  $$('.pb-langs > span').forEach((sp) => { let p = sp.previousElementSibling; let vis = false; while (p) { if (p.matches('[data-lang]') && !p.hidden) vis = true; p = p.previousElementSibling; } sp.hidden = !!sp.nextElementSibling?.hidden || !vis; });
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
/** הסכום כולל ההכפלה (Matching): raised + (mult-1)×raised, עד התקרה */
const shown = () => { const m = DATA.campaign?.match; if (!m) return DATA.raised; const extra = DATA.raised * (m.mult - 1); return DATA.raised + (m.cap ? Math.min(extra, m.cap) : extra); };
const matchHtml = (c) => (c.match ? `<p class="cp-match">✖${c.match.mult} · ${h(L().match(c.match.mult, c.match.sponsor))}</p>` : '');
function heroHtml(c) {
  const goal = Number(c.goal) || 0; const pct = goal ? Math.min(100, Math.round((shown() / goal) * 100)) : 0;
  let left = '';
  if (c.end_date) { const d = Math.ceil((new Date(`${c.end_date}T23:59:59`) - new Date()) / 864e5); left = d >= 0 ? L().daysLeft(d) : L().ended; }
  const logo = /#logo$/.test(c.image || ''); // תמונה שמסתיימת ב-#logo = לוגו במרכז (לא רקע)
  const img = c.image && !logo ? `style="background-image:linear-gradient(180deg,rgba(40,10,10,.05),rgba(40,10,10,.65)),url('${h(c.image)}')"` : '';
  const reel = GAL && GAL.length;
  if (reel && !tr(c, 'desc') && c.donors_mode === 'none' && !goal && !c.match) return ''; // אין מה להציג
  return `<section class="pb-card cp-hero">
    ${logo && !reel ? `<div style="text-align:center;padding:14px 10px 4px"><img src="${h(c.image.replace(/#logo$/, ''))}" alt="${h(tr(c, 'title'))}" style="width:min(320px,80%);height:auto"></div>` : ''}
    ${reel ? '' : `<div class="cp-pic${c.image && !logo ? ' has-img' : ''}" ${img}><div><small>${h(tr(c, 'sub'))}</small><h1>${h(tr(c, 'title'))}</h1></div></div>`}
    <div class="cp-hb">${tr(c, 'desc') ? `<p class="cp-desc" dir="auto">${h(tr(c, 'desc')).replace(/\n/g, '<br>')}</p>` : ''}
      ${matchHtml(c)}
      ${c.donors_mode === 'none' && !goal ? '' : `<div class="cp-prog"><span class="cp-big">${money(shown())}</span>
        <span>${goal ? `${h(L().raised)}${c.match ? ` (${h(L().withMatch)})` : ''} ${h(L().of)} <b>${money(goal)}</b>` : h(L().raised)}</span></div>
      ${goal ? `<div class="cp-track"><i style="width:${pct}%"></i></div>` : ''}
      <div class="cp-stats">${goal ? `<span><b>${pct}%</b> ${h(L().pctGoal)}</span>` : ''}<span><b>${DATA.donors}</b> ${h(L().donors)}</span>${left ? `<span>${h(left)}</span>` : ''}</div>`}
    </div></section>`;
}
// ---------- שותפות יששכר וזבולון: 3 קבוצות, שנה שלימה או חודשים לבחירה, תשלומים + יום חיוב ----------
const YS_N_YEAR = [1, 2, 3, 6, 10, 12]; const YS_N_MONTHS = [1, 2, 3, 4];
const ysGroup = (c) => (F.ys ? (c.ys?.groups || []).find((g) => g.id === F.ys.g) : null);
function ysTotal(c) { const g = ysGroup(c); if (!g) return 0; return F.ys.year ? Number(g.month) * 12 : Number(g.month) * F.ys.months.length; }
function ysApply(c) {
  const tot = ysTotal(c); const opts = F.ys.year ? YS_N_YEAR : YS_N_MONTHS; if (!opts.includes(F.n)) F.n = 1;
  F.pkg = ''; F.preset = ''; F.amount = Math.round((tot / F.n) * 100) / 100; F.monthly = F.n > 1; F.months = F.n > 1 ? F.n : 0;
}
/** מה נבחר — נשמר ברשומת התרומה (בשביל שטר ידני) */
function ysSel(c) { const g = ysGroup(c); if (!g) return ''; return `${g.name_yi || g.name_en} · ${F.ys.year ? 'שנה שלימה' : F.ys.months.join(', ')} · ${money(ysTotal(c))}`; }
function ysHtml(c) {
  const y = c.ys; const lb = y.lbl || {};
  return `<section class="pb-card cp-ys"><h2 class="cp-h">${h(tr(y, 'head'))}</h2>${tr(y, 'sub') ? `<p class="cp-ys-sub">${h(tr(y, 'sub'))}</p>` : ''}
    ${y.groups.map((g) => {
      const on = F.ys && F.ys.g === g.id; const m = Number(g.month);
      return `<div class="cp-ysg${on ? ' on' : ''}"><b class="cp-ysn">${h(tr(g, 'name'))}</b>
        <small class="cp-ysp">${h(tr(lb, 'year'))} <b>${money(m * 12)}</b> · ${h(tr(lb, 'month'))} <b>${money(m)}</b></small>
        <button type="button" class="cp-ysy${on && F.ys.year ? ' on' : ''}" data-ysy="${h(g.id)}">${h(tr(lb, 'year'))} — ${money(m * 12)}</button>
        <small class="cp-ysor">${h(tr(lb, 'pick'))}</small>
        <div class="cp-ysm">${(y.months || []).map((mo) => `<button type="button" data-ysm="${h(g.id)}|${h(mo)}" class="${on && !F.ys.year && F.ys.months.includes(mo) ? 'on' : ''}">${h(mo)}</button>`).join('')}</div>
      </div>`;
    }).join('')}</section>`;
}
function ysFormHtml(c) {
  const g = ysGroup(c); if (!g) return ''; const y = c.ys; const lb = y.lbl || {}; const tot = ysTotal(c);
  const opts = F.ys.year ? YS_N_YEAR : YS_N_MONTHS;
  return `<div class="cp-yssum"><p class="cp-pkgsel">✓ <b>${h(tr(g, 'name'))}</b><br>${h(F.ys.year ? tr(lb, 'year') : F.ys.months.join(', '))} — <b>${money(tot)}</b> <button type="button" class="cp-link" data-unys>✕</button></p>
    <div class="cp-row"><label class="cp-l">${h(tr(lb, 'payments'))}<select name="ysn">${opts.map((n) => `<option value="${n}"${F.n === n ? ' selected' : ''}>${n === 1 ? h(tr(lb, 'once')) : `${n} × ${money(Math.round((tot / n) * 100) / 100)}`}</option>`).join('')}</select></label>
    ${F.n > 1 ? `<label class="cp-l">${h(tr(lb, 'day'))}<select name="ysd">${Array.from({ length: 28 }, (_, i) => i + 1).map((d) => `<option value="${d}"${F.day === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label>` : ''}</div>
    ${F.n > 1 ? `<p class="cp-ysnote">${h(tr(lb, 'firstNow'))}</p>` : ''}</div>`;
}
function lettersHtml(c) {
  const L2 = c.letters || []; if (!L2.length) return '';
  return `<section class="cp-letters">${L2.map((l) => `<a href="${h(l.src)}" class="cp-let" data-zoom><img src="${h(l.src)}" alt="${h(l.alt || '')}" loading="lazy"${l.w ? ` width="${Number(l.w)}" height="${Number(l.h)}"` : ''}></a>`).join('')}</section>`;
}
function pkgsHtml(c) {
  if (!c.packages.length) return '';
  // אפשרות עם months = תשלומים חודשיים (הוראת קבע ל-X חודשים), לא "הקדשה" אחת. head_* באפשרות הראשונה = כותרת המקטע
  return `<section class="pb-card"><h2 class="cp-h">${h(tr(c.packages[0], 'head') || L().pkgs)}</h2><div class="cp-pkgs"${c.packages.some((p) => Number(p.months)) ? ' style="grid-template-columns:repeat(2,minmax(0,1fr))"' : ''}>${c.packages.map((p) => {
    const lim = Number(p.limit) || 0; const used = DATA.taken[p.id] || 0; const full = lim && used >= lim;
    const on = Number(p.months) ? F.preset === p.id : F.pkg === p.id;
    return `<button type="button" class="cp-pkg${on ? ' on' : ''}${full ? ' taken' : ''}" data-pkg="${h(p.id)}"${full ? ' disabled' : ''}>
      <b dir="auto">${h(tr(p, 'name'))}</b><span>${money(p.amount)}${Number(p.months) ? ` <small>× ${Number(p.months)}</small>` : ''}</span><em dir="auto">${full ? h(L().taken) : h(tr(p, 'note'))}</em></button>`;
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
// ---------- הקדשה: לע"נ (שם, בן/בת, שם האב, יום היארצייט) · לזכות (שם, תאריך, הערה) · לרפו"ש (שם, בן/בת, שם האם) ----------
const DED = {
  yi: { title: 'לזכר / לזכות', types: ['לע"נ', 'לזכות', 'לרפו"ש'], pick: '— אויסקלייבן —', name: 'נאמען', bn: ['בן', 'בת'], father: 'נאמען פונעם טאטן', mother: 'נאמען פון די מאמע', yahr: 'יארצייט', date: 'דאטום (נישט מוז)', note: 'באמערקונג', day: 'טאג', month: 'חודש' },
  he: { title: 'הקדשה', types: ['לע"נ', 'לזכות', 'לרפו"ש'], pick: '— בחירה —', name: 'שם', bn: ['בן', 'בת'], father: 'שם האב', mother: 'שם האם', yahr: 'יום היארצייט', date: 'תאריך (לא חובה)', note: 'הערה', day: 'יום', month: 'חודש' },
  en: { title: 'Dedication', types: ['In memory of', 'In honor of', 'For the recovery of'], pick: '— choose —', name: 'Name', bn: ['son of', 'daughter of'], father: "Father's name", mother: "Mother's name", yahr: 'Yahrzeit', date: 'Date (optional)', note: 'Note', day: 'Day', month: 'Month' },
};
const HDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ', 'כא', 'כב', 'כג', 'כד', 'כה', 'כו', 'כז', 'כח', 'כט', 'ל'].map((d) => (d.length === 1 ? `${d}'` : `${d[0]}"${d[1]}`));
const HMONTHS = ['תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר א\'', 'אדר ב\'', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'];
const dedL = () => DED[BOTH ? 'yi' : LANG] || DED.yi;
function dedHtml() {
  const D = dedL(); const sel = (n, opts, ph) => `<select name="${n}"><option value="">${h(ph)}</option>${opts.map((o) => `<option>${h(o)}</option>`).join('')}</select>`;
  return `<details class="cp-ded" data-t="${h(F.dedT ?? '')}"${F.dedOpen ? ' open' : ''}><summary>${h(D.title)}</summary>
    <select name="dedType"><option value="">${h(D.pick)}</option>${D.types.map((t, i) => `<option value="${i}"${String(F.dedT) === String(i) ? ' selected' : ''}>${h(t)}</option>`).join('')}</select>
    <div class="cp-dedf" data-for="0 1 2"><input name="d_name" maxlength="40" placeholder="${h(D.name)}"></div>
    <div class="cp-dedf cp-row" data-for="0 2"><select name="d_bn">${D.bn.map((b) => `<option>${h(b)}</option>`).join('')}</select><input name="d_father" data-for="0" maxlength="30" placeholder="${h(D.father)}"><input name="d_mother" data-for="2" maxlength="30" placeholder="${h(D.mother)}"></div>
    <p class="cp-l cp-dedf" data-for="0">${h(D.yahr)}</p><p class="cp-l cp-dedf" data-for="1">${h(D.date)}</p>
    <div class="cp-dedf cp-row" data-for="0 1">${sel('d_day', HDAYS, D.day)}${sel('d_month', HMONTHS, D.month)}</div>
    <div class="cp-dedf" data-for="1"><input name="d_note" maxlength="40" placeholder="${h(D.note)}"></div>
  </details>`;
}
/** ההקדשה כפי שנשמרת: סוג + טקסט אחד (עד 120 תווים) */
function dedOf(form) {
  const t = form.dedType?.value ?? ''; if (t === '' || !form.d_name?.value.trim()) return { type: '', text: '' };
  const D = DED.yi; const v = (k) => (form[k]?.value || '').trim();
  const date = [v('d_day'), v('d_month')].filter(Boolean).join(' ');
  let text = v('d_name');
  if (t === '0') text = [text, v('d_father') ? `${v('d_bn')} ${v('d_father')}` : '', date ? `· יארצייט ${date}` : ''].filter(Boolean).join(' ');
  if (t === '1') text = [text, date ? `· ${date}` : '', v('d_note') ? `· ${v('d_note')}` : ''].filter(Boolean).join(' ');
  if (t === '2') text = [text, v('d_mother') ? `${v('d_bn')} ${v('d_mother')}` : ''].filter(Boolean).join(' ');
  return { type: D.types[Number(t)] || '', text: text.slice(0, 120) };
}
function formHtml(c) {
  const amts = String(c.amounts || '36,54,100,180,360,500,1000').split(/[,\s]+/).map(Number).filter((x) => x > 0);
  const ready = DATA.pay && (DATA.ifields || DATA.pending);
  const T0 = L();
  const E = BOTH ? T.en : T0; // בדף דו-לשוני: משבצת הכרטיס והפרטים באנגלית בלבד
  const donor = `<p class="cp-l">${h(E.you)}</p>
      <div class="cp-row"><input name="first" autocomplete="given-name" placeholder="${h(E.first)}" required><input name="last" autocomplete="family-name" placeholder="${h(E.last)}" required></div>
      <div class="cp-row"><input name="phone" type="tel" dir="ltr" autocomplete="tel" placeholder="${h(E.phone)}"><input name="email" type="email" dir="ltr" autocomplete="email" placeholder="${h(E.email)}"></div>`;
  return `<section class="pb-card cp-form" id="cp-form"><h2 class="cp-h"${BOTH ? ' style="text-align:center"' : ''}>${h(BOTH ? T.en.give : T0.give)}</h2>
    ${ready ? '' : `<p class="cp-soon">${h(T0.soon)}</p>`}
    <form ${ready ? '' : 'inert class="cp-off"'} autocomplete="on">
      ${c.monthly && !F.pkg && !F.ys ? `<div class="cp-tog"><button type="button" data-mon="0" class="${F.monthly ? '' : 'on'}">${h(T0.once)}</button><button type="button" data-mon="1" class="${F.monthly ? 'on' : ''}">${h(T0.monthly)}</button></div>
        ${F.monthly ? `<label class="cp-l">${h(T0.months)} <select name="months"><option value="0">${h(T0.monthsAll)}</option>${[3, 6, 10, 12, 18, 24, 36].map((m) => `<option value="${m}"${F.months === m ? ' selected' : ''}>${m}</option>`).join('')}</select></label>` : ''}` : ''}
      ${F.ys ? ysFormHtml(c) : ''}
      ${F.pkg || F.ys ? '' : `<div class="cp-amts">${amts.map((a) => `<button type="button" data-amt="${a}" class="${F.amount === a ? 'on' : ''}">${money(a)}</button>`).join('')}
        <input type="number" min="1" step="1" inputmode="decimal" name="custom" placeholder="${h(T0.other)}" value="${amts.includes(F.amount) || !F.amount ? '' : F.amount}"></div>`}
      ${F.preset ? `<p class="cp-pkgsel">✓ <b>${h(tr(c.packages.find((p) => p.id === F.preset), 'name'))}</b> — ${money(F.amount)} × ${F.months}</p>` : ''}
      ${F.pkg ? `<p class="cp-pkgsel">✓ <b>${h(tr(c.packages.find((p) => p.id === F.pkg), 'name'))}</b> — ${money(totalOf().base)} <button type="button" class="cp-link" data-unpkg>✕</button></p>` : ''}
      ${dedHtml()}
      ${BOTH ? '' : donor}
      <div class="cp-card" dir="ltr">
        ${BOTH ? donor : ''}
        <label>${h(E.card)}<iframe class="cp-if" data-ifields-id="card-number" data-ifields-placeholder="Card number" src="${IF_VER ? `https://cdn.cardknox.com/ifields/${IF_VER}/ifield.htm` : 'about:blank'}" title="card"></iframe></label>
        <div class="cp-row"><label>${h(E.exp)}<input name="exp" inputmode="numeric" maxlength="5" placeholder="MM/YY" autocomplete="cc-exp"></label>
          <label>${h(E.cvv)}<iframe class="cp-if" data-ifields-id="cvv" data-ifields-placeholder="CVV" src="${IF_VER ? `https://cdn.cardknox.com/ifields/${IF_VER}/ifield.htm` : 'about:blank'}" title="cvv"></iframe></label></div>
        <input type="hidden" data-ifields-id="card-number-token" name="xCardNum"><input type="hidden" data-ifields-id="cvv-token" name="xCVV">
        <label data-ifields-id="card-data-error" class="cp-err"></label>
      </div>
      ${c.fee ? `<label class="cp-chk"><input type="checkbox" name="fee"${F.fee ? ' checked' : ''}> ${h(T0.fee(money(feeOf(totalOf().base) || 0)))}</label>` : ''}
      ${c.donors_mode === 'none' ? '' : `<label class="cp-chk"><input type="checkbox" name="anon"${F.anon ? ' checked' : ''}> ${h(T0.anon)}</label>`}
      <input name="website" class="cp-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="left:0;top:0;pointer-events:none">
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
  if (SCREEN) { root.innerHTML = screenHtml(c); return; }
  const bnr = !!(GAL && GAL.length);
  document.body.classList.toggle('cp-banner', bnr);
  const three = !!(c.ys || (c.letters && c.letters.length)); // שלושה טורים: מכתבים · אפשרויות · טופס
  root.innerHTML = `${bnr ? bannerHtml(c) : ''}${three
    ? `<div class="cp-grid3"><div class="cp-c-let">${lettersHtml(c)}</div><div class="cp-c-opt">${heroHtml(c)}${c.ys ? ysHtml(c) : pkgsHtml(c)}${recentHtml(c)}</div><div class="cp-c-form">${formHtml(c)}</div></div>`
    : `<div class="cp-grid"><div class="cp-main">${heroHtml(c)}${pkgsHtml(c)}${recentHtml(c)}</div><div class="cp-side">${formHtml(c)}</div></div>`}`;
  if (bnr) { fixReel(); if (!reelResize) { reelResize = true; addEventListener('resize', fixReel); } }
  wire();
}

// ---------- 📺 מסך ציבורי (campaign.html?c=...&screen=1): מספר גדול, פס התקדמות, תורמים אחרונים; מתרענן לבד ----------
function screenHtml(c) {
  const goal = Number(c.goal) || 0; const pct = goal ? Math.min(100, Math.round((shown() / goal) * 100)) : 0;
  let cd = '';
  if (c.event_date) { const ms = new Date(`${c.event_date}T19:00:00`) - new Date(); if (ms > 0) { const d = Math.floor(ms / 864e5); const hh = Math.floor((ms % 864e5) / 36e5); cd = `${d ? `${d}d ` : ''}${hh}h ${h(L().toEvent)}`; } }
  const url = `ungvar.org/campaign.html?c=${SLUG}`;
  return `<div class="cs-wrap"><div class="cs-top"><small>${h(tr(c, 'sub'))}</small><h1>${h(tr(c, 'title'))}</h1>${matchHtml(c)}</div>
    <div class="cs-num">${money(shown())}</div>
    ${goal ? `<div class="cs-track"><i style="width:${pct}%"></i></div><div class="cs-sub"><b>${pct}%</b> · ${h(L().of)} ${money(goal)} · <b>${DATA.donors}</b> ${h(L().donors)}${cd ? ` · ${cd}` : ''}</div>` : `<div class="cs-sub"><b>${DATA.donors}</b> ${h(L().donors)}${cd ? ` · ${cd}` : ''}</div>`}
    ${c.donors_mode === 'none' ? '' : `<div class="cs-wall">${DATA.recent.slice(0, 12).map((d) => `<div class="cs-dn"><b><bdi>${h(d.anon ? L().anonName : (LANG === 'en' ? d.en || d.he : d.he || d.en))}</bdi></b>${d.amount != null ? `<span>${money(d.amount)}${d.monthly ? h(L().perMonth) : ''}</span>` : ''}</div>`).join('')}</div>`}
    <div class="cs-foot">${h(L().scan)} <b dir="ltr">${h(url)}</b></div></div>`;
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
    const vals = {}; ['first', 'last', 'phone', 'email', 'exp', 'd_name', 'd_bn', 'd_father', 'd_mother', 'd_day', 'd_month', 'd_note'].forEach((k) => { if (form[k]) vals[k] = form[k].value; });
    render();
    const f2 = $('#cp-form form'); Object.entries(vals).forEach(([k, v]) => { if (f2[k]) f2[k].value = v; });
    setupIfields();
  };
  $$('[data-pkg]').forEach((b) => { b.onclick = () => {
    const p = c.packages.find((x) => x.id === b.dataset.pkg) || {};
    if (Number(p.months)) { // תשלומים: סכום חודשי + הוראת קבע ל-X חודשים
      F.pkg = ''; F.preset = F.preset === p.id ? '' : p.id;
      if (F.preset) { F.amount = Number(p.amount) || 0; F.monthly = true; F.months = Number(p.months); } else { F.monthly = false; F.months = 0; }
    } else { F.preset = ''; F.pkg = F.pkg === b.dataset.pkg ? '' : b.dataset.pkg; F.monthly = false; F.months = 0; }
    rerender(); $('#cp-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
  $$('[data-unpkg]').forEach((b) => { b.onclick = () => { F.pkg = ''; rerender(); }; });
  const ysChanged = () => { if (F.ys) ysApply(c); else { F.monthly = false; F.months = 0; F.n = 1; const a = String(c.amounts || '').split(/[,\s]+/).map(Number).filter((x) => x > 0); F.amount = a[3] || a[0] || 180; } rerender(); };
  $$('[data-ysy]').forEach((b) => { b.onclick = () => { const g = b.dataset.ysy; F.ys = F.ys && F.ys.g === g && F.ys.year ? null : { g, year: true, months: [] }; ysChanged(); }; });
  $$('[data-ysm]').forEach((b) => { b.onclick = () => {
    const [g, mo] = b.dataset.ysm.split('|'); if (!F.ys || F.ys.g !== g || F.ys.year) F.ys = { g, year: false, months: [] };
    const i = F.ys.months.indexOf(mo); if (i >= 0) F.ys.months.splice(i, 1); else F.ys.months.push(mo);
    const order = c.ys?.months || []; F.ys.months.sort((a, z) => order.indexOf(a) - order.indexOf(z));
    if (!F.ys.months.length) F.ys = null; ysChanged(); }; });
  $$('[data-unys]').forEach((b) => { b.onclick = () => { F.ys = null; ysChanged(); }; });
  if (form.ysn) form.ysn.onchange = () => { F.n = Number(form.ysn.value) || 1; ysApply(c); rerender(); };
  if (form.ysd) form.ysd.onchange = () => { F.day = Number(form.ysd.value) || 1; };
  $$('[data-zoom]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const o = document.createElement('div'); o.className = 'cp-zoom'; o.innerHTML = `<img src="${h(a.getAttribute('href'))}" alt="">`; o.onclick = () => o.remove(); document.body.appendChild(o); }; });
  $$('[data-amt]').forEach((b) => { b.onclick = () => { F.preset = ''; F.amount = Number(b.dataset.amt); rerender(); }; });
  $$('[data-mon]').forEach((b) => { b.onclick = () => { F.preset = ''; F.monthly = b.dataset.mon === '1'; rerender(); }; });
  if (form.custom) form.custom.onchange = () => { F.preset = ''; F.amount = Math.max(0, Number(form.custom.value) || 0); rerender(); };
  if (form.months) form.months.onchange = () => { F.preset = ''; F.months = Number(form.months.value) || 0; rerender(); };
  if (form.fee) form.fee.onchange = () => { F.fee = form.fee.checked; rerender(); };
  const ded = $('.cp-ded', form);
  if (ded) { ded.ontoggle = () => { F.dedOpen = ded.open; }; form.dedType.onchange = () => { F.dedT = form.dedType.value; ded.dataset.t = F.dedT; }; }
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
      const j = await guard({ action: 'webDonate', c: SLUG, amount: base, pkg: F.pkg, monthly: F.monthly && !F.pkg, months: F.months, day: F.ys && F.n > 1 ? F.day : 0, sel: F.ys ? ysSel(DATA.campaign) : '', fee: !!(DATA.campaign.fee && F.fee), anon: F.anon,
        first: form.first.value.trim(), last: form.last.value.trim(), phone: form.phone.value.trim(), email: form.email.value.trim(),
        dedType: dedOf(form).type, dedText: dedOf(form).text, card, cvv, exp, website: form.website.value, lang: LANG });
      if (j.error) return fail(j.error, j.error === 'declined' ? j.msg : '');
      $('#cp-form').innerHTML = `<h2 class="cp-h">${h(T0.thanks)}</h2><p>${h(T0.thanksTxt(money(j.amount), j.last4 || ''))}</p>
        ${j.monthly ? `<p>${h(j.sched ? T0.thanksM : T0.schedErr)}</p>` : ''}
        <p><button type="button" class="pb-btn primary" data-again>${h(T0.again)}</button></p>`;
      $('[data-again]').onclick = () => { F.pkg = ''; F.preset = ''; F.ys = null; F.n = 1; F.monthly = false; F.months = 0; load(); };
      setTimeout(load, 4000);
    } catch { fail('gateway'); }
  }, () => fail('need-card'), 30000);
}

async function loadIfFrames() {
  try { await loadIfields(); } catch { DATA.pay = false; render(); return; }
  const ifr = $$('.cp-if');
  await Promise.all(ifr.map((f) => new Promise((ok) => { f.addEventListener('load', ok, { once: true }); setTimeout(ok, 8000); f.src = `https://cdn.cardknox.com/ifields/${IF_VER}/ifield.htm`; })));
  setupIfields();
}
async function load() {
  const gp = guard({ action: 'webCampaign', c: SLUG, preview: new URLSearchParams(location.search).get('preview') || '' }).catch(() => ({ error: 'net' }));
  const gal = SCREEN ? Promise.resolve() : loadGallery();
  // קמפיין עם פרטים קבועים בקובץ התמונות: מציגים את כל הדף מיד, והשרת עונה ברקע (רק בשביל התשלום)
  if (!SCREEN) {
    await gal;
    if (STATIC && !DATA) {
      DATA = { campaign: STATIC, raised: 0, donors: 0, recent: [], taken: {}, pay: true, ifields: '', pending: true };
      if (!F.amount && !F.pkg) { const a = String(STATIC.amounts || '').split(/[,\s]+/).map(Number).filter((x) => x > 0); F.amount = a[3] || a[0] || 180; }
      if (CAMP_LANGS && CAMP_LANGS.length && !CAMP_LANGS.includes(LANG)) LANG = CAMP_LANGS[0];
      applyLang(); render();
      const g = await gp;
      if (!g.campaign) { DATA = g; render(); return; } // נגמר / כבוי / תקלה
      Object.assign(DATA, { raised: g.raised, donors: g.donors, recent: g.recent || [], taken: g.taken || {}, pay: g.pay, ifields: g.ifields, pending: false });
      if (!(g.pay && g.ifields)) { render(); return; }
      if (window.setAccount && IF_VER) setupIfields(); else await loadIfFrames();
      return;
    }
  }
  DATA = await gp;
  if (DATA.campaign) {
    if (!F.amount && !F.pkg) { const a = String(DATA.campaign.amounts || '').split(/[,\s]+/).map(Number).filter((x) => x > 0); F.amount = a[3] || a[0] || 180; }
  }
  // קודם מציגים את הדף; שדות הכרטיס של Sola נטענים ברקע (בלי לעכב את התצוגה)
  const needIf = !SCREEN && DATA.campaign && DATA.pay && DATA.ifields && !(window.setAccount && IF_VER);
  await gal;
  if (CAMP_LANGS && CAMP_LANGS.length && !CAMP_LANGS.includes(LANG)) LANG = CAMP_LANGS[0]; // שפות שהקמפיין לא תומך בהן — לא מציגים
  applyLang();
  render(); if (!SCREEN && !needIf) setupIfields();
  if (needIf) await loadIfFrames();
}

const FORM_CSS = `.cp-ded{margin:6px 0 10px;border:1px solid #e8dcc4;border-radius:10px;padding:8px 12px;background:#fffdf8}
.cp-ded summary{cursor:pointer;font-weight:600;color:#7a1219;padding:2px 0}
.cp-ded[open] summary{margin-bottom:8px}.cp-ded select,.cp-ded input{margin-bottom:8px;width:100%}
.cp-ded .cp-dedf{display:none}.cp-ded .cp-row{gap:8px}
.cp-ded[data-t="0"] [data-for~="0"],.cp-ded[data-t="1"] [data-for~="1"],.cp-ded[data-t="2"] [data-for~="2"]{display:block}
.cp-ded[data-t="0"] .cp-row[data-for~="0"],.cp-ded[data-t="1"] .cp-row[data-for~="1"],.cp-ded[data-t="2"] .cp-row[data-for~="2"]{display:flex}
.cp-ded .cp-row > input[data-for]{display:none}.cp-ded[data-t="0"] input[data-for="0"],.cp-ded[data-t="2"] input[data-for="2"]{display:block}
.cp-ded .cp-row select[name=d_bn]{flex:0 0 90px}
body.cp-both .cp-amts input[name=custom]{border:2px solid #c9a23f}
.cp-card .cp-l{margin-top:0}
.cp-grid3{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.15fr) 380px;gap:16px;align-items:start}
.cp-c-opt{display:flex;flex-direction:column;gap:16px;min-width:0}.cp-c-form{position:sticky;top:12px}
.cp-letters{display:flex;flex-direction:column;gap:12px}.cp-let{display:block;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(60,20,10,.25);cursor:zoom-in}.cp-let img{display:block;width:100%;height:auto}
.cp-zoom{position:fixed;inset:0;background:rgba(20,8,6,.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;cursor:zoom-out}.cp-zoom img{max-width:100%;max-height:100%;border-radius:10px}
.cp-ys-sub{margin:-6px 0 10px;color:#7a5a3a}
.cp-ysg{border:1px solid #e8dcc4;border-radius:12px;padding:12px;margin-bottom:12px;background:#fffdf8;display:flex;flex-direction:column;gap:7px}
.cp-ysg.on{border-color:#c9a23f;box-shadow:0 0 0 2px rgba(201,162,63,.35)}
.cp-ysn{font-size:17px;color:#5a1010;white-space:pre-line}.cp-ysp{color:#6b5a48}.cp-ysor{color:#8a7a68}
.cp-ysy{border:1px solid #c9a23f;background:#fff;border-radius:9px;padding:8px;font-weight:600;cursor:pointer}.cp-ysy.on{background:#7a1219;color:#fff;border-color:#7a1219}
.cp-ysm{display:flex;flex-wrap:wrap;gap:6px}.cp-ysm button{border:1px solid #e0cfa8;background:#fff;border-radius:8px;padding:5px 9px;cursor:pointer;font-size:14px}.cp-ysm button.on{background:#7a1219;color:#fff;border-color:#7a1219}
.cp-yssum b{white-space:pre-line}.cp-yssum .cp-row{gap:8px}.cp-yssum label{flex:1}.cp-yssum select{width:100%}.cp-ysnote{font-size:12px;color:#7a5a3a;margin:2px 0 8px}
@media (max-width:1000px){.cp-grid3{grid-template-columns:1fr}.cp-c-opt{order:1}.cp-c-form{order:2;position:static}.cp-c-let{order:3}}`;
export function startCampaign() {
  if (!document.getElementById('cp-form-css')) { const st = document.createElement('style'); st.id = 'cp-form-css'; st.textContent = FORM_CSS; document.head.appendChild(st); }
  const qs = new URLSearchParams(location.search);
  SLUG = (qs.get('c') || '').trim().toLowerCase();
  SCREEN = qs.get('screen') === '1' && !!SLUG;
  if (SCREEN) { document.body.classList.add('cp-screen'); setInterval(load, 20000); }
  $$('[data-lang]').forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
  applyLang();
  // הבאנר מוצג מיד מקובץ התמונות, עוד לפני שהנתונים מגיעים מהשרת
  const pre = () => document.documentElement.classList.remove('cp-pre');
  setTimeout(pre, 3000);
  if (!SCREEN && SLUG) {
    loadGallery().then(() => {
      if (GAL.length && BANNER && !DATA) {
        if (CAMP_LANGS && CAMP_LANGS.length && !CAMP_LANGS.includes(LANG)) LANG = CAMP_LANGS[0];
        applyLang(); document.body.classList.add('cp-banner');
        const root = $('#cp-root'); if (root) { root.innerHTML = `${bannerHtml(BANNER)}<section class="pb-card"><p class="pb-sub">…</p></section>`; fixReel(); }
      }
      pre();
    });
  } else pre();
  load();
}
