// 🌐 ungvar.org — דף הבית הציבורי: תאריך ופרשה, זמני תפילה (חול ושבת), זמני היום, שיעורים, מצוה יומית (הורדות), שמחות, מכון משנה הלכות, הרשמה ל-SMS.
// הנתונים: גיליון התצוגה (פומבי, gviz) — Minyanim / RebbeAway / Simchos / ShulConfig / SiteDownloads / Screen; ספרים — מהשומר (webBooks); הרשמה — webSignup.
// שפות: אידיש / עברית / English. ברירת מחדל: בחירה קודמת באתר → השפה שנבחרה במערכת הגבאים (khal-lang) → שפת הטלפון/המחשב (he → עברית, yi → אידיש, אחר → English).
import { buildYear, isoOf, nOf, dowOf, hdOf, mitzvaYomis } from '../luach/engine.js';
import { MITZVA_ANCHOR } from '../luach/mitzvos.js';
import { zmanim, hhmm } from '../luach/zmanim.js';
import { defaults, normData, computeWeekday, computeShiurim, computeHoly, computeSpecial, maarivNight, partOfDay, chagOn } from '../luach/minyanim.js';
import { SHULS, DEFAULT_SHUL, normShul, applyShul } from '../luach/shul.js';
import { isoToHebrewText, hebrewNumber, toHebrew } from '../hebdate.js';
import { CONFIG } from '../config.js';

const SHEET = SHULS[DEFAULT_SHUL].sheetId;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tm = (m) => (m == null ? '' : hhmm(((m % 1440) + 1440) % 1440));
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(`pub:${k}`) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(`pub:${k}`, JSON.stringify(v)); } catch { /* */ } };

// ---------- שפה ----------
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
    title: 'קהל אונגוואר', login: 'כניסה', donate: 'תרומה', sms: 'לקבלת זמני התפילות בהודעת SMS', smsR: 'לקבלת זמני התפילות',
    days: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'], eve: (d) => `אור ל${d}`,
    parsha: (p) => `פרשת ${p}`, week: 'זמני תפילה ימות החול', g: { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' },
    rebbe: 'מנין אד"ש', approx: '(בערך)', yt: 'היום: לפי זמני יום טוב', soon: 'הזמנים יעודכנו בקרוב.',
    shab: 'זמני שבת קודש', ytT: 'זמני יום טוב', special: 'זמנים מיוחדים', zm: 'זמני היום', brooklyn: 'ברוקלין',
    Z: ['עלות השחר', 'זמן טלית ותפילין', 'נץ החמה', 'סוף זמן קריאת שמע', 'סוף זמן תפילה', 'חצות היום', 'שקיעת החמה', 'צאת הכוכבים לר"ת', 'הדלקת נרות'], ma: 'מג"א', gra: 'גר"א',
    shiur: 'שיעורים', noShiur: 'רשימת השיעורים תתעדכן בקרוב.', pod: null,
    mitzva: 'מצוה יומית', mz: (n, t) => `מצוה ${hebrewNumber(n)} - ${t}`, kThis: 'קונטרס לחודש זה', kNext: 'קונטרס לחודש הבא', soonW: 'בקרוב', year: 'לוח חודשי', pocket: (k) => `לוח מחזור ${hebrewNumber(k)}`,
    simchos: 'שהשמחה במעונם', noSimchos: '',
    machon: 'מכון משנה הלכות', machonSub: 'ספרי רבותינו', allBooks: 'לכל הספרים ←', noBooks: '', vol: 'כרך בודד', old: 'מהדורה קודמת', vols: (n) => `${n} כרכים`, sale: 'מבצע', home: '← לדף הבית',
    machonInfo: 'להזמנות ולפרטים: (718) 851-0806 · office@ungvar.org · איסוף מהמשרד 1578 53rd St, או משלוח בתיאום.', policy: 'מדיניות החזרות ומשלוחים',
    smsH: 'קבלת זמני התפילות בהודעת SMS', smsSub: 'זמני התפילה של בית המדרש בבארא פארק, זמני היום והודעות הקהילה — ישר לטלפון.', name: 'שם', opt: '(לא חובה)', phone: 'מספר טלפון נייד',
    signup: 'הרשמה', cancel: 'ביטול', close: 'סגירה', needName: 'נא לכתוב שם.', badPhone: 'נא להקליד מספר טלפון אמריקאי של 10 ספרות.', needOk: 'נא לסמן את ההסכמה לקבלת הודעות.', sending: 'שולח…',
    thanks: 'תודה! ההרשמה התקבלה', thanksTxt: (p) => `בקרוב תגיע הודעה למספר <b dir="ltr">${p}</b> לאישור ההרשמה — יש להשיב <b dir="ltr">YES</b>, ומאז יתחילו להגיע ההודעות.`,
    invalid: 'המספר אינו תקין.', tooMany: 'יותר מדי בקשות כרגע — נסו שוב מאוחר יותר.', failed: 'לא הצלחנו לשלוח. נסו שוב',
    donH: 'תרומה לקהל אונגוואר', donTxt: 'התרומה באתר תיפתח בקרוב בעז"ה.', donAlt: 'בינתיים אפשר לתרום בטלפון <a href="tel:+17188510806" dir="ltr">(718) 851-0806</a> או במייל <a href="mailto:office@ungvar.org">office@ungvar.org</a>.',
    prev: 'הקודם', next: 'הבא', loading: 'טוען…',
  },
  yi: {
    title: 'קהל אונגוואר', login: 'לאגין', donate: 'נדבה', sms: 'באקומען זמני תפילה אויף SMS', smsR: 'באקומען זמני תפילה',
    days: ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שבת קודש'], eve: (d) => `אור ל${d}`,
    parsha: (p) => `פרשת ${p}`, week: 'זמני תפילה ימות החול', g: { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' },
    rebbe: 'מנין אד"ש', approx: '(בערך)', yt: 'היינט: לויט די זמני יום טוב', soon: 'Times will be updated soon.',
    shab: 'זמני שבת קודש', ytT: 'זמני יום טוב', special: 'זמנים מיוחדים', zm: 'זמני היום', brooklyn: 'ברוקלין',
    Z: ['עלות השחר', 'זמן טלית ותפילין', 'נץ החמה', 'סוף זמן קריאת שמע', 'סוף זמן תפילה', 'חצות היום', 'שקיעת החמה', 'צאת הכוכבים לר"ת', 'הדלקת נרות'], ma: 'מג"א', gra: 'גר"א',
    shiur: 'שיעורים', noShiur: 'The shiurim list will be updated soon.', pod: { 'לפנות בוקר': 'פארטאגס', 'בבוקר': 'אינדערפרי', 'בצהריים': 'נאכמיטאג', 'בערב': 'פארנאכט', 'בלילה': 'ביינאכט' },
    mitzva: 'מצוה יומית', mz: (n, t) => `מצוה ${hebrewNumber(n)} - ${t}`, kThis: 'קונטרס פאר דעם חודש', kNext: 'קונטרס פאר קומענדיגן חודש', soonW: 'בקרוב', year: 'לוח פאר די חודש', pocket: (k) => `לוח מחזור ${hebrewNumber(k)}`,
    simchos: 'שהשמחה במעונם', noSimchos: '',
    machon: 'מכון משנה הלכות', machonSub: 'ספרי רבותינו', allBooks: 'צו אלע ספרים ←', noBooks: '', vol: 'איין באנד', old: 'פריערדיגע מהדורה', vols: (n) => `${n} בענדער`, sale: 'מבצע', home: '← Home',
    machonInfo: 'צו באשטעלן: (718) 851-0806 · office@ungvar.org · אפנמען אין אפיס 1578 53rd St, אדער אויפ\'ן פאסט.', policy: 'Refund & Shipping Policy',
    smsH: 'באקומען זמני תפילה אויף SMS', smsSub: 'די זמני תפילה פונעם בית המדרש אין בארא פארק, זמני היום און הודעות פון קהל — גלייך צום טעלעפאן.', name: 'נאמען', opt: '(נישט נויטיג)', phone: 'סעל נומבער',
    signup: 'Sign up', cancel: 'Cancel', close: 'Close', needName: 'ביטע שרייבט א נאמען.', badPhone: 'ביטע שרייבט אן אמעריקאנער נומער פון 10 נומבער\'ס.', needOk: 'ביטע צייכנט אן אז איר זענט מסכים צו באקומען מעסעדזשעס.', sending: 'שיקט…',
    thanks: 'א דאנק! איר זענט איינגעשריבן', thanksTxt: (p) => `באלד וועט אנקומען א מעסעדזש צו <b dir="ltr">${p}</b> צו באשטעטיגן — ענטפערט <b dir="ltr">YES</b>, און פון דעמאלט אן וועט איר באקומען די מעסעדזשעס.`,
    invalid: 'דער נומער איז נישט ריכטיג.', tooMany: 'צופיל בקשות יעצט — פרובירט שפעטער.', failed: 'נישט געלונגען. פרובירט נאכאמאל',
    donH: 'נדבה פאר קהל אונגוואר', donTxt: 'Online donations are coming soon.', donAlt: 'דערווייל קען מען געבן דורכן טעלעפאן <a href="tel:+17188510806" dir="ltr">(718) 851-0806</a> אדער אימעיל <a href="mailto:office@ungvar.org">office@ungvar.org</a>.',
    prev: 'פריער', next: 'ווייטער', loading: 'Loading…',
  },
  en: {
    title: 'Khal Ungvar', login: 'Sign in', donate: 'Donate', sms: 'Get davening times by SMS', smsR: 'Get davening times',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'], eve: (d) => `${d} eve`,
    parsha: (p) => `Parshas ${p}`, week: 'Weekday Davening Times', g: { shacharis: 'Shacharis', mincha: 'Mincha', maariv: 'Maariv' },
    rebbe: 'Rebbe\'s minyan', approx: '(approx.)', yt: 'Today: Yom Tov schedule', soon: 'Times will be updated soon.',
    shab: 'Shabbos Times', ytT: 'Yom Tov Times', special: 'Special times', zm: 'Zmanim Today', brooklyn: 'Brooklyn',
    Z: ['Alos Hashachar', 'Talis & Tefillin', 'Netz (sunrise)', 'Sof Zman Krias Shema', 'Sof Zman Tefila', 'Chatzos', 'Shkia (sunset)', 'Tzeis (Rabbeinu Tam)', 'Candle lighting'], ma: 'MA', gra: 'GRA',
    shiur: 'Shiurim', noShiur: 'The shiurim list will be updated soon.', pod: { 'לפנות בוקר': 'early am', 'בבוקר': 'am', 'בצהריים': 'pm', 'בערב': 'pm', 'בלילה': 'night' },
    mitzva: 'Mitzva Yomis', mz: (n, t) => `Mitzva ${n} - ${t}`, kThis: 'This month\'s booklet', kNext: 'Next month\'s booklet', soonW: 'coming soon', year: 'Monthly luach', pocket: (k) => `Cycle ${k} luach`,
    simchos: 'Simchos', noSimchos: '',
    machon: 'Machon Mishnah Halachot', machonSub: 'Seforim of our Rabbes', allBooks: 'All seforim →', noBooks: '', vol: 'single volume', old: 'previous edition', vols: (n) => `${n} volumes`, sale: 'Sale', home: '← Home',
    machonInfo: 'To order: (718) 851-0806 · office@ungvar.org · pickup at our office, 1578 53rd St, or shipping by arrangement.', policy: 'Refund & Shipping Policy',
    smsH: 'Davening times by SMS', smsSub: 'Boro Park beis medrash davening times, daily zmanim and community updates — straight to your phone.', name: 'Name', opt: '(optional)', phone: 'Mobile number',
    signup: 'Sign up', cancel: 'Cancel', close: 'Close', needName: 'Please enter your name.', badPhone: 'Please enter a 10-digit US phone number.', needOk: 'Please check the consent box.', sending: 'Sending…',
    thanks: 'Thank you! You are signed up', thanksTxt: (p) => `You will soon receive a text at <b>${p}</b> to confirm — reply <b>YES</b> and the messages will start.`,
    invalid: 'That number is not valid.', tooMany: 'Too many requests right now — please try later.', failed: 'Could not send. Please try again',
    donH: 'Donate to Khal Ungvar', donTxt: 'Online donations are coming soon.', donAlt: 'Meanwhile you can donate by phone <a href="tel:+17188510806">(718) 851-0806</a> or email <a href="mailto:office@ungvar.org">office@ungvar.org</a>.',
    prev: 'Previous', next: 'Next', loading: 'Loading…',
  },
};
const L = () => T[LANG];
const EN_MON = { Tishri: 'Tishrei', Heshvan: 'Cheshvan', Kislev: 'Kislev', Tevet: 'Teves', Shevat: 'Shevat', Adar: 'Adar', 'Adar I': 'Adar I', 'Adar II': 'Adar II', Nisan: 'Nisan', Iyar: 'Iyar', Sivan: 'Sivan', Tamuz: 'Tamuz', Av: 'Av', Elul: 'Elul' };
const hebDate = (iso) => { if (LANG !== 'en') return isoToHebrewText(iso); const x = toHebrew(iso); return x ? `${x.d} ${EN_MON[x.m] || x.m} ${x.y}` : ''; };
const pod = (m) => { const p = partOfDay(m); return L().pod?.[p] || p; };

function applyLang() {
  document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl';
  $$('[data-t]').forEach((e) => { const v = L()[e.dataset.t]; if (typeof v === 'string') e.textContent = v; });
  $$('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
}
function setLang(l) { LANG = l; lsSet('lang', l); applyLang(); renderAll(); BOOKS_DRAW?.(); }

// ---------- קריאת הגיליון הפומבי ----------
function parseCsv(t) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i += 1; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
async function tab(name) {
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const rows = parseCsv(await r.text());
    lsSet(`tab:${name}`, rows);
    return rows;
  } catch { return null; }
}
const cached = (name) => lsGet(`tab:${name}`);
const partsJson = (rows) => {
  const parts = (rows || []).filter((x) => /^data#\d+$/.test(x[0] || '')).sort((a, b) => Number(a[0].split('#')[1]) - Number(b[0].split('#')[1]));
  try { return parts.length ? JSON.parse(parts.map((x) => x[1] || '').join('')) : null; } catch { return null; }
};

// ---------- מצב ----------
let DATA = normData(defaults());
let CFG = normShul(null, DEFAULT_SHUL);
let LOC = applyShul(CFG);
let SIMCHOS = [];
let DOWNLOADS = [];
let HAVE = false; // הגיעו נתונים אמיתיים (לא ברירת מחדל)
// טקסטים מהגדרות המסך (לשונית Screen) — כמו בתצוגה
let TXT = { kolText: 'קול אונגוואר', kolPhone: '605-477-4427', tShDaf: 'שיעורי דף היומי בבית מדרשינו:', tShOth: 'שיעורים הנלמדים בביהמ"ד:' };

function useRows(name, rows) {
  if (!rows) return;
  if (name === 'Minyanim') { const j = partsJson(rows); if (j) { DATA = normData({ ...defaults(), ...j }); HAVE = true; } }
  if (name === 'ShulConfig') { const j = partsJson(rows); if (j && j.kind === 'shul') { CFG = normShul(j, DEFAULT_SHUL); LOC = applyShul(CFG); } }
  if (name === 'RebbeAway' && rows[0]?.[0] === 'from') {
    const dt = (v) => { const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); if (a) return a[0]; const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || ''); return b ? `${b[3]}-${b[1].padStart(2, '0')}-${b[2].padStart(2, '0')}` : ''; };
    DATA.rebbeAway = rows.slice(1).map((x) => ({ from: dt(x[0]), to: dt(x[1]) })).filter((x) => x.from && x.to);
  }
  if (name === 'Screen') { const j = partsJson(rows); if (j?.texts) Object.keys(TXT).forEach((k) => { if (j.texts[k]) TXT[k] = String(j.texts[k]); }); }
  if (name === 'Simchos' && rows[0]?.[0] === 'simcha_id') SIMCHOS = rows.slice(1).filter((x) => x[0] && x[1]).map((x) => ({ id: x[0], html: x[1], until: Number(x[2]) || 0 }));
  if (name === 'SiteDownloads' && rows[0]?.[0] === 'key') DOWNLOADS = rows.slice(1).filter((x) => x[0] && x[2]).map((x) => ({ key: x[0], label: x[1], url: x[2], id: x[3] || '' }));
}
const TABS = ['ShulConfig', 'Minyanim', 'RebbeAway', 'Simchos', 'SiteDownloads', 'Screen'];

// שמחות — רק תגיות בטוחות (הטקסט מגיע מהגיליון)
const OK_TAG = new Set(['DIV', 'B', 'STRONG', 'I', 'EM', 'SPAN', 'BR', 'SMALL', 'U']);
function clean(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const walk = (el) => [...el.childNodes].forEach((c) => {
    if (c.nodeType === 1) {
      if (!OK_TAG.has(c.tagName)) { c.replaceWith(document.createTextNode(c.textContent)); return; }
      [...c.attributes].forEach((a) => { if (a.name !== 'class') c.removeAttribute(a.name); });
      walk(c);
    } else if (c.nodeType !== 3) c.remove();
  });
  walk(t.content);
  return t.innerHTML;
}
// ---------- היום ----------
const yc = new Map();
function dayOf(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) {
    const k = `${y}|${LOC.key}`;
    if (!yc.has(k)) yc.set(k, buildYear(y, {}, { loc: LOC }));
    const d = yc.get(k).days.find((x) => x.n === n);
    if (d) return d;
  }
  return null;
}
function nowInfo() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const n = nOf(iso); const nowMin = d.getHours() * 60 + d.getMinutes();
  const z = zmanim(iso, LOC);
  const night = nowMin >= z.shkia; // אחרי השקיעה — כבר התאריך העברי של מחר
  let sat = n; while (dowOf(sat) !== 6) sat += 1;
  if (sat === n && nowMin > z.shkia + 90) sat += 7;
  return { d, iso, n, nowMin, z, night, sat, fri: sat - 1 };
}
function parshaOf(sat) {
  const day = dayOf(sat);
  if (day?.parsha) return L().parsha(day.parsha);
  return day?.items?.find((i) => i.kind === 'hol')?.text || '';
}

// ---------- הציור ----------
function renderDate(I) {
  const civil = I.d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const hol = (dayOf(I.n)?.items || []).filter((i) => i.kind === 'hol').map((i) => i.text).join(' · ');
  const D = L().days;
  const dl = I.night ? L().eve(D[dowOf(I.n + 1)]) : D[dowOf(I.n)];
  const p = parshaOf(I.sat);
  $('#pb-date').innerHTML = `<b class="pb-parsha">${h(dl)}${p ? ` <bdi>${h(p)}</bdi>` : ''}</b><span class="sep">·</span><span>${h(hebDate(isoOf(I.night ? I.n + 1 : I.n)))}</span>
    <span class="sep">·</span><span dir="ltr">${h(civil)}</span>
    ${hol ? `<div class="pb-hol">${h(hol)}</div>` : ''}`;
}

function renderWeekday(I) {
  const holy = (x) => dowOf(x) === 6 || chagOn(DATA, x);
  // כמו בתצוגה: שחרית נשאר "המנין הבא" עוד X דקות אחרי ההתחלה (הודו +10 — לפי ההערה של שחרית; בלי הערה: 10)
  const grace = (() => { const mm = /\+\s*(\d+)/.exec(String(DATA?.weekday?.shacharisNote || '')); return mm ? Math.min(60, Number(mm[1])) : 10; })();
  let k = I.n; while (holy(k)) k += 1; // יום טוב באמצע השבוע — מהיום הראשון שאינו יו"ט
  // יום שישי: הלוח של השבוע הזה עד אחרי מנין השחרית האחרון; אחר כך (ובשבת) — השבוע הבא
  const friSh = dowOf(k) === 5 ? computeWeekday(DATA, k, LOC).shacharis : [];
  const friOpen = k === I.n && friSh.some((m) => m.min + grace >= I.nowMin);
  if (dowOf(k) === 6 || (dowOf(k) === 5 && !friOpen)) k = k - dowOf(k) + 7;
  const w = computeWeekday(DATA, k, LOC, { plain: true });
  const today = k === I.n;
  const notes = { shacharis: w.shacharisNote, mincha: w.minchaNote, maariv: w.maarivNote };
  // המנין הבא: היום — הראשון שעוד לא עבר (ביום שישי רק מניני שחרית של שישי); אחרי מעריב האחרון — שחרית הראשון של מחר
  const pool = !today ? [] : dowOf(I.n) === 5 ? friSh.map((m) => ({ g: 'shacharis', min: m.min }))
    : ['shacharis', 'mincha', 'maariv'].flatMap((g) => (w[g] || []).map((m) => ({ g, min: m.min })));
  let nxKey = pool.filter((x) => x.min + (x.g === 'shacharis' ? grace : 0) >= I.nowMin).sort((a, b) => a.min - b.min)[0] || null;
  if (!nxKey && today && dowOf(I.n) <= 4 && !holy(I.n + 1) && w.shacharis?.length) nxKey = { g: 'shacharis', min: Math.min(...w.shacharis.map((m) => m.min)) };
  const isNx = (g, m) => !!nxKey && nxKey.g === g && Math.round(nxKey.min) === Math.round(m.min);
  const chip = (g, m) => `<span class="pb-chip${isNx(g, m) ? ' nx' : ''}" title="${h([m.room, m.note].filter(Boolean).join(' · '))}">${tm(m.min)}${m.rebbe ? `<small>${h(L().rebbe)}${g === 'maariv' ? ` ${h(L().approx)}` : ''}</small>` : ''}</span>`;
  const grp = (g) => {
    const list = w[g] || [];
    if (!list.length) return '';
    return `<div class="pb-grp"><div class="pb-gh">${h(L().g[g])}${notes[g] ? ` <small><bdi>(${h(notes[g])})</bdi></small>` : ''}</div><div class="pb-chips">${list.map((m) => chip(g, m)).join('')}</div></div>`;
  };
  const rows = ['shacharis', 'mincha', 'maariv'].map(grp).join('');
  const p = parshaOf(k - dowOf(k) + 6);
  // מעריב והזמנים המיוחדים — בשורה אחת עם כפתור ה-SMS העגול (בפינה הפנויה, צמוד לשבת)
  $('#pb-week').innerHTML = `<h2>${h(L().week)}${p ? ` <span class="pb-hp2"><bdi>${h(p)}</bdi></span>` : ''}</h2>
    ${rows ? grp('shacharis') + grp('mincha') : `<p class="muted">${h(L().soon)}</p>`}
    <div class="pb-wk-end"><div class="pb-wk-last">${rows ? grp('maariv') : ''}${specialHtml(I)}</div>
    <button type="button" class="pb-smsr" data-sms><b>SMS</b><span>${h(L().smsR)}</span></button></div>`;
  $('#pb-week .pb-smsr').onclick = smsDialog;
  // אם הכפתור העגול נוגע במנחה (הרבה מניינים) — יורד מתחת לשורה
  requestAnimationFrame(() => {
    const b = $('#pb-week .pb-smsr'); if (!b || getComputedStyle(b).position !== 'absolute') return;
    const r = b.getBoundingClientRect();
    const hit = $$('#pb-week .pb-chip, #pb-week .pb-gh').some((c) => { const q = c.getBoundingClientRect(); return q.left < r.right && r.left < q.right && q.top < r.bottom && r.top < q.bottom; });
    if (hit) b.parentElement.classList.add('flow');
  });
}

// ---------- זמנים מיוחדים בימות החול (חנוכה, תעניות, פורים, תשעה באב, חול המועד, ימי דפגרא) — לשבוע הקרוב, כמו בתצוגה ----------
function specialHtml(I) {
  const holy = (x) => dowOf(x) === 6 || chagOn(DATA, x);
  const days = [];
  for (let d = I.n; d <= I.n + 6; d += 1) {
    if (holy(d)) continue;
    const list = [];
    computeSpecial(DATA, d, LOC).forEach((bk) => bk.rows.filter((r) => r.screen !== false && r.place === 'weekday' && r.mins.length).forEach((r) => list.push({ label: r.label, note: r.note, mins: r.mins })));
    const mn = maarivNight(DATA, d);
    if (mn) { const ms = computeWeekday(DATA, d, LOC).maariv.map((m) => m.min).filter((m) => m != null); if (ms.length) list.push({ label: mn.label, note: '', mins: ms }); }
    // היום: רק מה שעוד לא עבר
    const keep = d === I.n ? list.filter((r) => Math.max(...r.mins) >= I.nowMin - 30) : list;
    if (keep.length) days.push({ d, list: keep });
  }
  if (!days.length) return '';
  return `<div class="pb-spec"><div class="pb-gh">${h(L().special)}</div>${days.map(({ d, list }) => `<div class="pb-spd"><b>${h(L().days[dowOf(d)])}</b> <small><bdi>${h(hebDate(isoOf(d)))}</bdi></small>
    ${list.map((r) => `<div class="pb-row"><span dir="auto">${h(r.label)}${r.note ? ` <small>(${h(r.note)})</small>` : ''}</span><i></i><b>${r.mins.map(tm).join(' · ')}</b></div>`).join('')}</div>`).join('')}</div>`;
}

// שבת / יום טוב: מהערב ועד מוצאי היום האחרון (שבת ויו"ט סמוכים — ביחד), כמו בתצוגה
function renderShabbos(I) {
  const holy = (x) => dowOf(x) === 6 || chagOn(DATA, x);
  const spanFrom = (s0) => { let st = s0; while (!holy(st)) st += 1; while (holy(st - 1) && st - 1 >= I.n) st -= 1; let en = st; while (holy(en + 1)) en += 1; return [st, en]; };
  let st; let en;
  if (holy(I.n)) { st = I.n; while (holy(st - 1)) st -= 1; en = I.n; while (holy(en + 1)) en += 1; if (I.n === en && I.nowMin > zmanim(isoOf(en), LOC).motzei + 60) [st, en] = spanFrom(I.n + 1); }
  else [st, en] = spanFrom(I.n + 1);
  const eve = st - 1;
  const seen = new Set(); const rows = [];
  for (let k = eve; k < en; k += 1) {
    computeHoly(DATA, k, LOC).filter((r) => r.place === 'shab' && r.screen !== false && r.min != null).forEach((r) => {
      const day = k + (r.day || 0); const key = `${day}|${r.label}|${r.min}`;
      if (seen.has(key)) return; seen.add(key); rows.push({ ...r, abs: day });
    });
  }
  rows.sort((a, b) => a.abs - b.abs || a.min - b.min);
  const chag = [];
  for (let k = st; k <= en; k += 1) if (chagOn(DATA, k)) chag.push(k);
  let title = L().shab;
  if (chag.length) {
    const nm = [eve, ...chag].map((k) => computeSpecial(DATA, k, LOC).find((bk) => bk.type === 'chag')?.title).find(Boolean)
      || dayOf(chag[0])?.items.find((i) => i.kind === 'hol' && i.yt)?.text || '';
    title = `${L().ytT}${nm ? ` - ${nm}` : ''}`;
  }
  let sat = st; while (sat <= en && dowOf(sat) !== 6) sat += 1;
  const sub = [sat <= en ? parshaOf(sat) : '', hebDate(isoOf(st)) + (en > st ? ` – ${hebDate(isoOf(en))}` : '')].filter(Boolean);
  const multi = en > st;
  const line = (r) => `<div class="pb-row${r.kind === 'zman' ? ' z' : ''}"><span dir="auto">${h(r.label)}${r.note ? ` <small>(${h(r.note)})</small>` : ''}</span><i></i><b>${[r.min, ...(r.more || [])].map(tm).join(' · ')}</b></div>`;
  let body = '';
  if (!multi) body = rows.map(line).join('');
  else {
    let cur = null;
    rows.forEach((r) => { if (r.abs !== cur) { cur = r.abs; body += `<div class="pb-dh">${h(L().days[dowOf(r.abs)])} <small><bdi>${h(hebDate(isoOf(r.abs)))}</bdi></small></div>`; } body += line(r); });
  }
  const card = $('#pb-shab');
  card.classList.toggle('pb-multi', multi);
  card.innerHTML = `<h2><bdi>${h(title)}</bdi></h2><p class="pb-sub">${sub.map((x) => `<bdi>${h(x)}</bdi>`).join(' · ')}</p><div class="pb-rows">${body}</div>`;
}

function renderZmanim(I) {
  const z = I.z; const Z = L().Z;
  const ma = (z.tzeis - z.alos) / 12; const gra = (z.shkia - z.neitz) / 12;
  const rows = [[Z[0], z.alos], [Z[1], z.neitz - 48], [Z[2], z.neitz], [Z[3], z.alos + 3 * ma, z.neitz + 3 * gra], [Z[4], z.alos + 4 * ma, z.neitz + 4 * gra], [Z[5], z.chatzos], [Z[6], z.shkia], [Z[7], z.shkia + 72]];
  if (dowOf(I.n) === 5) rows.push([Z[8], z.candles]);
  $('#pb-zm').innerHTML = `<h2>${h(L().zm)}</h2><p class="pb-sub">${h(hebDate(I.iso))} · ${h(L().brooklyn)}</p>
    <div class="pb-rows">${rows.map(([l, a, b]) => `<div class="pb-row"><span>${h(l)}</span><i></i><b>${b != null ? `<small>${L().ma}</small> ${tm(a)} <small>${L().gra}</small> ${tm(b)}` : tm(a)}</b></div>`).join('')}</div>`;
}

// כמו בתצוגה: דף היומי / שאר השיעורים — שעה, שם השיעור (לא בדף היומי), מקום; ובשורה שנייה המגיד שיעור
function renderShiurim(I) {
  const list = computeShiurim(DATA, I.n, LOC, true);
  const daf = list.filter((x) => x.type === 'daf'); const oth = list.filter((x) => x.type !== 'daf');
  const row = (x) => `<div class="pb-sh"><b>${x.min == null ? h(x.note || '') : `${tm(x.min)} <small>${h(pod(x.min))}</small>`}</b>
      <span dir="auto">${h([x.type === 'daf' ? '' : x.title, x.room].filter(Boolean).join(' - '))}${x.who ? `<small class="who">${h(x.who)}</small>` : ''}</span></div>`;
  const sec = (t, a) => (a.length ? `<h3 class="pb-sht" dir="auto">${h(t)}</h3><div class="pb-shl">${a.map(row).join('')}</div>` : '');
  $('#pb-shiur').innerHTML = `<h2>${h(L().shiur)}</h2>
    <a class="pb-kol" href="tel:+16054774427">${h(TXT.kolText)} <b dir="ltr">${h(TXT.kolPhone)}</b></a>
    ${list.length ? sec(TXT.tShDaf, daf) + sec(TXT.tShOth, oth) : `<p class="muted">${h(L().noShiur)}</p>`}`;
}

function curMonth(n) {
  for (let Y = hdOf(n).y - 1; Y <= hdOf(n).y + 1; Y += 1) {
    const pages = buildYear(Y).pages; const ix = pages.findIndex((p) => p.monthDays.some((d) => d.n === n));
    if (ix >= 0) return { Y, ix, pages };
  }
  return null;
}
function renderMitzva(I) {
  const n = I.night ? I.n + 1 : I.n;
  const m = curMonth(n);
  const keyOf = (Y, p) => `booklet|${Y}|${p.key}`;
  let a = null; let b = null;
  if (m) {
    a = { k: keyOf(m.Y, m.pages[m.ix]), he: m.pages[m.ix].he };
    const nx = m.ix + 1 < m.pages.length ? { Y: m.Y, p: m.pages[m.ix + 1] } : { Y: m.Y + 1, p: buildYear(m.Y + 1).pages[0] };
    b = { k: keyOf(nx.Y, nx.p), he: nx.p.he };
  }
  const dl = (k) => DOWNLOADS.find((x) => x.key === k);
  const big = (x, word) => { const f = x && dl(x.k); return f ? `<a class="pb-dl big" href="${h(f.url)}" target="_blank" rel="noopener"><span>${h(word)}<small>${h(f.label || x.he)}</small></span></a>`
    : `<span class="pb-dl big off"><span>${h(word)}<small>${h(x?.he || '')} — ${h(L().soonW)}</small></span></span>`; };
  const lx = m ? DOWNLOADS.find((x) => x.key === `luach|${m.Y}|${m.pages[m.ix].key}`) : null;
  const cyN = 40 + Math.floor((n - (nOf(MITZVA_ANCHOR.iso) - (MITZVA_ANCHOR.n - 1))) / 613);
  const cy = DOWNLOADS.find((x) => x.key === `cycle|${cyN}`);
  const view = (f) => (f.id ? `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view` : f.url);
  const mz = mitzvaYomis(isoOf(n));
  $('#pb-mitzva').innerHTML = `<h2>${h(L().mitzva)}</h2>
    <p class="pb-today"><b>${h(L().mz(mz.n, mz.text))}</b></p>
    <div class="pb-dls">${big(a, L().kThis)}${big(b, L().kNext)}</div>
    <div class="pb-dls sm">${lx ? `<a class="pb-dl" href="${h(view(lx))}" target="_blank" rel="noopener">${h(L().year)}</a>` : `<span class="pb-dl off">${h(L().year)} <small>(${h(L().soonW)})</small></span>`}${cy ? `<a class="pb-dl" href="${h(cy.url)}" target="_blank" rel="noopener">${h(L().pocket(cyN))}</a>` : `<span class="pb-dl off">${h(L().pocket(cyN))} <small>(${h(L().soonW)})</small></span>`}</div>`;
}

// ---------- דפדוף: רשימה שלא נכנסת במסגרת → חיצים ----------
const PG = new Map(); // id → מספר הדף
function pager(box, id, itemsHtml, empty) {
  if (!itemsHtml.length) { box.innerHTML = `<p class="muted">${h(empty)}</p>`; return; }
  box.innerHTML = `<div class="pb-pgv">${itemsHtml.map((x) => `<div class="pb-pgi">${x}</div>`).join('')}</div><div class="pb-pgn" hidden><button type="button" class="pb-arr" dir="ltr" data-d="-1" aria-label="${h(L().prev)}"></button><span dir="ltr"></span><button type="button" class="pb-arr" dir="ltr" data-d="1" aria-label="${h(L().next)}"></button></div>`;
  const v = $('.pb-pgv', box); const nav = $('.pb-pgn', box); const its = $$('.pb-pgi', v);
  const rtl = document.documentElement.dir === 'rtl';
  $$('.pb-arr', nav).forEach((b) => { b.textContent = (Number(b.dataset.d) < 0) === rtl ? '›' : '‹'; });
  const layout = () => {
    its.forEach((e) => { e.hidden = false; });
    nav.hidden = true;
    const avail = v.clientHeight;
    const gap = parseFloat(getComputedStyle(v).rowGap) || 0;
    const pages = []; let cur = []; let used = 0;
    its.forEach((e, i) => { const hh = e.offsetHeight; const need = (cur.length ? gap : 0) + hh; if (cur.length && avail > 0 && used + need > avail) { pages.push(cur); cur = []; used = 0; } used += (cur.length ? gap : 0) + hh; cur.push(i); });
    if (cur.length) pages.push(cur);
    if (pages.length > 1) {
      nav.hidden = false;
      // עם הסרגל של החיצים יש פחות מקום — מחשבים שוב
      const avail2 = v.clientHeight; const pg2 = []; let c2 = []; let u2 = 0;
      its.forEach((e, i) => { const hh = e.offsetHeight; const need = (c2.length ? gap : 0) + hh; if (c2.length && used >= 0 && u2 + need > avail2) { pg2.push(c2); c2 = []; u2 = 0; } u2 += (c2.length ? gap : 0) + hh; c2.push(i); });
      if (c2.length) pg2.push(c2);
      pages.splice(0, pages.length, ...pg2);
    }
    let p = Math.min(PG.get(id) || 0, pages.length - 1);
    const show = () => { PG.set(id, p); its.forEach((e, i) => { e.hidden = !pages[p].includes(i); }); $('span', nav).textContent = `${p + 1} / ${pages.length}`; };
    $$('.pb-arr', nav).forEach((b) => { b.onclick = () => { p = (p + Number(b.dataset.d) + pages.length) % pages.length; show(); }; });
    show();
  };
  layout();
  box._relayout = layout;
}

function renderSimchos() {
  const t = Date.now();
  const list = SIMCHOS.filter((x) => !x.until || x.until > t);
  const card = $('#pb-simchos');
  card.innerHTML = `<h2>${h(L().simchos)}</h2><div class="pb-pg" id="pb-sgl"></div>`;
  pager($('#pb-sgl'), 'sg', list.map((x) => `<div class="pb-sge" dir="rtl">${clean(x.html)}</div>`), L().noSimchos);
}

// ---------- מכון משנה הלכות: ספרים ומחירים (בלי מלאי) ----------
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const num = (v) => (v === '' || v == null ? null : Number(v));
function saleOn(b, day) { if (num(b.sale_price) == null) return false; if (b.sale_from && day < b.sale_from) return false; if (b.sale_to && day > b.sale_to) return false; return true; }
function priceOf(b, g, day) {
  if (saleOn(b, day)) return { now: Number(b.sale_price), was: num(b.price) };
  if (g && saleOn(g, day) && num(b.price) != null) {
    const raw = Number(b.price) * (1 - (Number(g.sale_price) || 0) / 100);
    return { now: g.vol_price ? Math.round(raw * 2) / 2 : Math.round(raw * 100) / 100, was: Number(b.price) };
  }
  return { now: num(b.price), was: null };
}
let BOOKS_DRAW = null;
async function loadBooks(box, paged) {
  let books = lsGet('books');
  const draw = () => {
    if (!books) { box.innerHTML = `<p class="muted">${h(L().loading)}</p>`; return; }
    const day = new Date().toISOString().slice(0, 10);
    const g = books.find((b) => b.category === '__all__');
    const all = books.filter((b) => b.category !== '__all__' && b.name).sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || Number(a.book_id) - Number(b.book_id));
    const EN = LANG === 'en'; // באנגלית: תעתיק ישיבתי של שם הספר (name_en) ותרגום התת-כותרת (subtitle_en) — מהגיליון
    const items = all.map((b) => {
      const p = priceOf(b, g, day); const img = String(b.image || '').replace(/^(img\/books\/\d+)\.jpg$/, '$1.webp');
      const extra = [num(b.vol_price) != null ? `${L().vol} ${money(b.vol_price)}` : '', num(b.old_price) != null ? `${L().old} ${money(b.old_price)}` : ''].filter(Boolean).join(' · ');
      return `<div class="pb-book">${img ? `<img src="${h(img)}" alt="" loading="lazy">` : '<div class="pb-noimg"></div>'}
        <div dir="auto"><b>${h(EN && b.name_en ? b.name_en : b.name)}</b>${EN && b.name_en ? (b.subtitle_en ? `<small>${h(b.subtitle_en)}</small>` : '') : b.subtitle || Number(b.volumes) > 1 ? `<small>${h([b.subtitle, Number(b.volumes) > 1 && !/כרכים|חלקים/.test(b.subtitle || '') ? L().vols(b.volumes) : ''].filter(Boolean).join(' · '))}</small>` : ''}
        <div class="pb-price">${p.now != null ? money(p.now) : ''}${p.was != null && p.was !== p.now ? ` <s>${money(p.was)}</s> <span class="pb-sale">${h(L().sale)}</span>` : ''}</div>${extra ? `<small>${h(extra)}</small>` : ''}</div></div>`;
    });
    if (paged) pager(box, 'bk', items, L().noBooks);
    else box.innerHTML = items.length ? `<div class="pb-books">${items.join('')}</div>` : `<p class="muted">${h(L().noBooks)}</p>`;
    if (paged) relayout();
  };
  BOOKS_DRAW = draw;
  draw();
  try {
    const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'webBooks' }) });
    const j = await r.json();
    if (Array.isArray(j.books)) { books = j.books; lsSet('books', books); }
  } catch { /* נשאר מהזיכרון */ }
  if (!books) books = [];
  draw();
}

// ---------- עמודות באותו גובה (מחשב): הגובה של העמודה האמצעית; השמחות והספרים — לפי המקום, עם חיצים ----------
let relayT = 0;
function relayout() {
  cancelAnimationFrame(relayT);
  relayT = requestAnimationFrame(() => {
    const cols = $$('.pb-row3 > .pb-col'); if (cols.length !== 3) return;
    cols.forEach((c) => { c.style.height = ''; });
    if (window.innerWidth > 960) {
      const H = cols[1].offsetHeight;
      cols[0].style.height = `${H}px`; cols[2].style.height = `${H}px`;
    }
    ['#pb-sgl', '#pb-books'].forEach((s) => { const b = $(s); b?._relayout?.(); });
  });
}

// ---------- הרשמה ל-SMS ----------
function smsDialog() {
  const dlg = document.createElement('dialog'); dlg.className = 'pb-dlg'; dlg.dir = document.documentElement.dir;
  dlg.innerHTML = `<form method="dialog" novalidate>
    <button type="button" class="pb-x" aria-label="${h(L().close)}">✕</button>
    <h3>${h(L().smsH)}</h3>
    <p class="pb-sub">${h(L().smsSub)}</p>
    <label>${h(L().name)}<input name="name" autocomplete="name" maxlength="60" required></label>
    <label>${h(L().phone)}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="(718) 555-0123" required></label>
    <input name="website" tabindex="-1" autocomplete="off" class="pb-hp" aria-hidden="true">
    <label class="pb-consent" dir="ltr"><input type="checkbox" name="ok"> <span>I agree to receive recurring automated text messages from <b>Khal Ungvar</b> (prayer times, zmanim and community updates) at the number above. Consent is not a condition of any purchase. Msg frequency varies. Msg &amp; data rates may apply. Reply <b>STOP</b> to cancel, <b>HELP</b> for help. See our <a href="sms.html" target="_blank">SMS Terms</a> and <a href="privacy.html" target="_blank">Privacy Policy</a>.</span></label>
    <p class="pb-msg" role="alert"></p>
    <div class="pb-acts"><button type="submit" class="pb-btn primary">${h(L().signup)}</button><button type="button" class="pb-btn pb-cancel">${h(L().cancel)}</button></div>
  </form>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.pb-x', dlg).onclick = close; $('.pb-cancel', dlg).onclick = close;
  const f = $('form', dlg); const msg = $('.pb-msg', dlg);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const phone = f.phone.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (!f.name.value.trim()) { msg.textContent = L().needName; f.name.focus(); return; }
    if (phone.length !== 10) { msg.textContent = L().badPhone; return; }
    if (!f.ok.checked) { msg.textContent = L().needOk; return; }
    const btn = $('[type=submit]', f); btn.disabled = true; msg.textContent = L().sending;
    try {
      const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'webSignup', name: f.name.value.trim(), phone, consent: true, website: f.website.value, lang: LANG }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      f.innerHTML = `<button type="button" class="pb-x" aria-label="${h(L().close)}">✕</button><h3>${h(L().thanks)}</h3>
        <p>${L().thanksTxt(h(f.phone.value))}</p>
        <p class="pb-sub" dir="ltr">You will receive a confirmation text shortly. Reply YES to confirm. Reply STOP at any time to cancel.</p>
        <div class="pb-acts"><button type="button" class="pb-btn primary pb-cancel">${h(L().close)}</button></div>`;
      $('.pb-x', dlg).onclick = close; $('.pb-cancel', dlg).onclick = close;
    } catch (err) {
      btn.disabled = false;
      msg.textContent = /bad-phone/.test(err.message) ? L().invalid : /need-name/.test(err.message) ? L().needName : /too-many/.test(err.message) ? L().tooMany : L().failed;
    }
  };
}

function donateDialog() {
  const dlg = document.createElement('dialog'); dlg.className = 'pb-dlg'; dlg.dir = document.documentElement.dir;
  dlg.innerHTML = `<button type="button" class="pb-x" aria-label="${h(L().close)}">✕</button><h3>${h(L().donH)}</h3>
    <p>${h(L().donTxt)}</p><p>${L().donAlt}</p>
    <p class="pb-sub" dir="ltr">Khal Ungvar is a 501(c)(3) nonprofit organization (EIN 11-2330829). Donations are tax-deductible to the extent allowed by law.</p>
    <div class="pb-acts"><button type="button" class="pb-btn primary pb-cancel">${h(L().close)}</button></div>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.pb-x', dlg).onclick = close; $('.pb-cancel', dlg).onclick = close;
}

function renderAll() {
  if (!$('#pb-week')) return;
  const I = nowInfo();
  const safe = (f) => { try { f(I); } catch (err) { console.error(err); } };
  [renderDate, renderWeekday, renderShabbos, renderZmanim, renderShiurim, renderMitzva, renderSimchos].forEach(safe);
  relayout();
}

function common() {
  $$('[data-lang]').forEach((b) => { b.onclick = () => setLang(b.dataset.lang); });
  applyLang();
}

export async function startHome() {
  common();
  $$('[data-sms]').forEach((b) => { b.onclick = smsDialog; });
  $$('[data-donate]').forEach((b) => { b.onclick = donateDialog; });
  TABS.forEach((t) => useRows(t, cached(t)));
  renderAll();
  loadBooks($('#pb-books'), true);
  window.addEventListener('resize', relayout);
  document.fonts?.ready.then(relayout);
  const rows = await Promise.all(TABS.map(tab));
  TABS.forEach((t, i) => useRows(t, rows[i]));
  renderAll();
  setInterval(renderAll, 5 * 60 * 1000); // המנין הבא, אחרי השקיעה
  setInterval(async () => { const rs = await Promise.all(TABS.map(tab)); TABS.forEach((t, i) => useRows(t, rs[i])); renderAll(); }, 30 * 60 * 1000);
  void HAVE;
}

export function startMachon() {
  common();
  loadBooks($('#pb-books'), false);
}
