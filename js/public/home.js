// 🌐 ungvar.org — דף הבית הציבורי: תאריך ופרשה, זמני תפילה (חול ושבת), זמני היום, שיעורים, מצוה יומית (הורדות), שמחות, מכון משנה הלכות, הרשמה ל-SMS.
// הנתונים: גיליון התצוגה (פומבי, gviz) — Minyanim / RebbeAway / Simchos / ShulConfig / SiteDownloads; ספרים — מהשומר (webBooks); הרשמה — webSignup.
import { buildYear, isoOf, nOf, dowOf, hdOf, mitzvaYomis } from '../luach/engine.js';
import { zmanim, hhmm } from '../luach/zmanim.js';
import { defaults, normData, computeWeekday, computeShabbos, computeShiurim, partOfDay, chagOn } from '../luach/minyanim.js';
import { SHULS, DEFAULT_SHUL, normShul, applyShul } from '../luach/shul.js';
import { isoToHebrewText, hebrewNumber } from '../hebdate.js';
import { CONFIG } from '../config.js';

const SHEET = SHULS[DEFAULT_SHUL].sheetId;
const $ = (s, r = document) => r.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tm = (m) => (m == null ? '' : hhmm(((m % 1440) + 1440) % 1440));
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(`pub:${k}`) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(`pub:${k}`, JSON.stringify(v)); } catch { /* */ } };

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

function useRows(name, rows) {
  if (!rows) return;
  if (name === 'Minyanim') { const j = partsJson(rows); if (j) { DATA = normData({ ...defaults(), ...j }); HAVE = true; } }
  if (name === 'ShulConfig') { const j = partsJson(rows); if (j && j.kind === 'shul') { CFG = normShul(j, DEFAULT_SHUL); LOC = applyShul(CFG); } }
  if (name === 'RebbeAway' && rows[0]?.[0] === 'from') {
    const dt = (v) => { const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); if (a) return a[0]; const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || ''); return b ? `${b[3]}-${b[1].padStart(2, '0')}-${b[2].padStart(2, '0')}` : ''; };
    DATA.rebbeAway = rows.slice(1).map((x) => ({ from: dt(x[0]), to: dt(x[1]) })).filter((x) => x.from && x.to);
  }
  if (name === 'Simchos' && rows[0]?.[0] === 'simcha_id') SIMCHOS = rows.slice(1).filter((x) => x[0] && x[1]).map((x) => ({ id: x[0], html: x[1], until: Number(x[2]) || 0 }));
  if (name === 'SiteDownloads' && rows[0]?.[0] === 'key') DOWNLOADS = rows.slice(1).filter((x) => x[0] && x[2]).map((x) => ({ key: x[0], label: x[1], url: x[2] }));
}
const TABS = ['ShulConfig', 'Minyanim', 'RebbeAway', 'Simchos', 'SiteDownloads'];

// ---------- היום ----------
const DAYN = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת קודש'];
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
  // אחרי השקיעה — כבר התאריך העברי של מחר
  const night = nowMin >= z.shkia;
  let sat = n; while (dowOf(sat) !== 6) sat += 1;
  if (sat === n && nowMin > z.shkia + 90) sat += 7;
  return { d, iso, n, nowMin, z, night, sat, fri: sat - 1 };
}
function parshaOf(sat) {
  const day = dayOf(sat);
  if (day?.parsha) return `פרשת ${day.parsha}`;
  return day?.items?.find((i) => i.kind === 'hol')?.text || '';
}

// ---------- הציור ----------
function renderDate(I) {
  const heb = isoToHebrewText(isoOf(I.night ? I.n + 1 : I.n));
  const civil = I.d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const hol = (dayOf(I.n)?.items || []).filter((i) => i.kind === 'hol').map((i) => i.text).join(' · ');
  const dl = I.night ? `אור ל${DAYN[dowOf(I.n + 1)]}` : DAYN[dowOf(I.n)];
  $('#pb-date').innerHTML = `<b>${h(dl)}</b>
    <span class="sep">·</span><span>${h(heb)}</span>
    <span class="sep">·</span><span dir="ltr">${h(civil)}</span>
    ${parshaOf(I.sat) ? `<span class="sep">·</span><span class="pb-parsha">${h(parshaOf(I.sat))}</span>` : ''}
    ${hol ? `<div class="pb-hol">${h(hol)}</div>` : ''}`;
}

const GN = { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' };
function renderWeekday(I) {
  const dw = dowOf(I.n);
  const k = dw <= 4 ? I.n : I.n - dw + 7; // שישי/שבת → השבוע הבא
  const w = computeWeekday(DATA, k, LOC, { plain: true });
  const today = k === I.n;
  const notes = { shacharis: w.shacharisNote, mincha: w.minchaNote, maariv: w.maarivNote };
  let nextDone = !today;
  const chip = (g, m) => {
    let cls = m.rebbe ? 'rb' : '';
    if (!nextDone && m.min >= I.nowMin) { cls += ' nx'; nextDone = true; }
    return `<span class="pb-chip ${cls}" title="${h([m.room, m.note].filter(Boolean).join(' · '))}">${tm(m.min)}${m.rebbe ? `<small>${g === 'maariv' ? 'מנין כ"ק (בערך)' : 'מנין כ"ק'}</small>` : ''}</span>`;
  };
  const rows = ['shacharis', 'mincha', 'maariv'].map((g) => {
    const list = w[g] || [];
    if (!list.length) return '';
    return `<div class="pb-grp"><div class="pb-gh">${GN[g]}${notes[g] ? ` <small>(${h(notes[g])})</small>` : ''}</div><div class="pb-chips">${list.map((m) => chip(g, m)).join('')}</div></div>`;
  }).join('');
  $('#pb-week').innerHTML = `<h2>🕍 זמני תפילה — ימות החול</h2>
    <p class="pb-sub">${today ? 'היום' : 'מיום ראשון'} · בית המדרש 5306 16th Ave${chagOn(DATA, I.n) ? ' · <b>היום: לפי זמני יום טוב</b>' : ''}</p>
    ${rows || '<p class="muted">הזמנים יעודכנו בקרוב.</p>'}
    <p class="pb-legend"><span class="pb-sw rb"></span> מנין כ"ק מרן אדמו"ר שליט"א ${today ? '· <span class="pb-sw nx"></span> המנין הבא' : ''}</p>`;
}

function renderShabbos(I) {
  const rows = computeShabbos(DATA, I.fri, LOC).filter((r) => r.min != null && r.screen !== false);
  $('#pb-shab').innerHTML = `<h2>🕯 זמני שבת קודש</h2><p class="pb-sub">${h(parshaOf(I.sat))} · ${h(isoToHebrewText(isoOf(I.sat)))}</p>
    <div class="pb-rows">${rows.map((r) => `<div class="pb-row${r.kind === 'zman' ? ' z' : ''}"><span>${h(r.label)}${r.note ? ` <small>(${h(r.note)})</small>` : ''}</span><i></i><b>${tm(r.min)}</b></div>`).join('')}</div>`;
}

function renderZmanim(I) {
  const z = I.z;
  const ma = (z.tzeis - z.alos) / 12; const gra = (z.shkia - z.neitz) / 12;
  const rows = [
    ['עלות השחר', z.alos], ['זמן טלית ותפילין', z.neitz - 48], ['נץ החמה', z.neitz],
    ['סוף זמן קריאת שמע', z.alos + 3 * ma, z.neitz + 3 * gra], ['סוף זמן תפילה', z.alos + 4 * ma, z.neitz + 4 * gra],
    ['חצות היום', z.chatzos], ['שקיעת החמה', z.shkia], ['צאת הכוכבים לר"ת', z.shkia + 72],
  ];
  if (dowOf(I.n) === 5) rows.push(['הדלקת נרות', z.candles]);
  $('#pb-zm').innerHTML = `<h2>☀ זמני היום</h2><p class="pb-sub">${h(isoToHebrewText(I.iso))} · ברוקלין</p>
    <div class="pb-rows">${rows.map(([l, a, b]) => `<div class="pb-row"><span>${l}</span><i></i><b>${b != null ? `<small>מג"א</small> ${tm(a)} <small>גר"א</small> ${tm(b)}` : tm(a)}</b></div>`).join('')}</div>`;
}

const HDW = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", 'ש"ק'];
function daysText(ds) {
  const s = [...new Set((ds || []).map(Number))].sort();
  if (s.length === 7) return 'כל יום';
  if (s.join() === '0,1,2,3,4,5') return 'א\'–ו\'';
  if (s.join() === '0,1,2,3,4') return 'א\'–ה\'';
  return s.map((d) => HDW[d]).join(' ');
}
function renderShiurim(I) {
  const list = computeShiurim(DATA, I.n, LOC, true);
  const byId = new Map((DATA.shiurim?.rows || []).map((r) => [r.id, r]));
  $('#pb-shiur').innerHTML = `<h2>📖 שיעורים</h2>
    <a class="pb-kol" href="tel:+16054774427">🎧 קול אונגוואר — שיעורים בטלפון: <b dir="ltr">605-477-4427</b></a>
    ${list.length ? `<div class="pb-shl">${list.map((x) => `<div class="pb-sh"><b>${x.min == null ? h(x.note || '') : `${tm(x.min)} <small>${partOfDay(x.min)}</small>`}</b>
      <span>${h([x.type === 'daf' ? 'דף היומי' : x.title, x.room].filter(Boolean).join(' · '))}${x.who ? `<small class="who">${h(x.who)}</small>` : ''}</span>
      <em>${h(daysText(byId.get(x.id)?.days))}</em></div>`).join('')}</div>` : '<p class="muted">רשימת השיעורים תתעדכן בקרוב.</p>'}`;
}

function curMonth(n) {
  for (let Y = hdOf(n).y - 1; Y <= hdOf(n).y + 1; Y += 1) {
    const pages = buildYear(Y).pages; const ix = pages.findIndex((p) => p.monthDays.some((d) => d.n === n));
    if (ix >= 0) return { Y, ix, pages };
  }
  return null;
}
function renderMitzva(I) {
  const m = curMonth(I.night ? I.n + 1 : I.n);
  const keyOf = (Y, p) => `booklet|${Y}|${p.key}`;
  let a = null; let b = null;
  if (m) {
    a = { k: keyOf(m.Y, m.pages[m.ix]), he: m.pages[m.ix].he };
    const nx = m.ix + 1 < m.pages.length ? { Y: m.Y, p: m.pages[m.ix + 1] } : { Y: m.Y + 1, p: buildYear(m.Y + 1).pages[0] };
    b = { k: keyOf(nx.Y, nx.p), he: nx.p.he };
  }
  const dl = (k) => DOWNLOADS.find((x) => x.key === k);
  const big = (x, word) => { const f = x && dl(x.k); return f ? `<a class="pb-dl big" href="${h(f.url)}" target="_blank" rel="noopener">⬇ <span>קונטרס ${word}<small>${h(f.label || x.he)}</small></span></a>`
    : `<span class="pb-dl big off">⬇ <span>קונטרס ${word}<small>${h(x?.he || '')} — בקרוב</small></span></span>`; };
  const small = (k, l) => { const f = dl(k); return f ? `<a class="pb-dl" href="${h(f.url)}" target="_blank" rel="noopener">⬇ ${l}</a>` : ''; };
  const mz = mitzvaYomis(isoOf(I.night ? I.n + 1 : I.n));
  $('#pb-mitzva').innerHTML = `<h2>📘 מצוה יומית</h2>
    <p class="pb-today"><small>המצוה של היום · מצוה ${h(hebrewNumber(mz.n))}</small><b>${h(mz.text)}</b></p>
    <div class="pb-dls">${big(a, 'לחודש זה')}${big(b, 'לחודש הבא')}</div>
    <div class="pb-dls sm">${small('luach_year', 'לוח שנתי')}${small('luach_pocket', 'לוח כיס')}</div>`;
}

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
function renderSimchos() {
  const t = Date.now();
  const list = SIMCHOS.filter((x) => !x.until || x.until > t);
  const box = $('#pb-simchos'); box.hidden = !list.length;
  if (!list.length) return;
  box.innerHTML = `<h2>🎉 שמחה במעונם</h2><div class="pb-sg">${list.map((x) => `<div class="pb-sge">${clean(x.html)}</div>`).join('')}</div>`;
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
export async function loadBooks(box, limit = 0) {
  let books = lsGet('books');
  const draw = () => {
    if (!books) { box.innerHTML = '<p class="muted">טוען…</p>'; return; }
    const day = new Date().toISOString().slice(0, 10);
    const g = books.find((b) => b.category === '__all__');
    const all = books.filter((b) => b.category !== '__all__' && b.name).sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || Number(a.book_id) - Number(b.book_id));
    const list = limit ? all.slice(0, limit) : all;
    box.innerHTML = list.length ? `<div class="pb-books">${list.map((b) => {
      const p = priceOf(b, g, day); const img = String(b.image || '').replace(/^(img\/books\/\d+)\.jpg$/, '$1.webp');
      const extra = [num(b.vol_price) != null ? `כרך בודד ${money(b.vol_price)}` : '', num(b.old_price) != null ? `מהדורה קודמת ${money(b.old_price)}` : ''].filter(Boolean).join(' · ');
      return `<div class="pb-book">${img ? `<img src="${h(img)}" alt="" loading="lazy">` : '<div class="pb-noimg">📖</div>'}
        <div><b>${h(b.name)}</b>${b.subtitle || Number(b.volumes) > 1 ? `<small>${h([b.subtitle, Number(b.volumes) > 1 && !/כרכים|חלקים/.test(b.subtitle || '') ? `${b.volumes} כרכים` : ''].filter(Boolean).join(' · '))}</small>` : ''}
        <div class="pb-price">${p.now != null ? money(p.now) : ''}${p.was != null && p.was !== p.now ? ` <s>${money(p.was)}</s> <span class="pb-sale">מבצע</span>` : ''}</div>${extra ? `<small>${h(extra)}</small>` : ''}</div></div>`;
    }).join('')}</div>${limit && all.length > limit ? `<p class="pb-more"><a href="machon.html">לכל ${all.length} הספרים ←</a></p>` : ''}` : '<p class="muted">רשימת הספרים תתעדכן בקרוב.</p>';
  };
  draw();
  try {
    const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'webBooks' }) });
    const j = await r.json();
    if (Array.isArray(j.books)) { books = j.books; lsSet('books', books); }
  } catch { /* נשאר מהזיכרון */ }
  if (!books) books = [];
  draw();
}

// ---------- 📱 הרשמה ל-SMS ----------
function smsDialog() {
  const dlg = document.createElement('dialog'); dlg.className = 'pb-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = `<form method="dialog" novalidate>
    <button type="button" class="pb-x" aria-label="סגירה">✕</button>
    <h3>📱 הרשמה לקבלת SMS</h3>
    <p class="pb-sub">זמני התפילה של בית המדרש בבארא פארק, זמני היום והודעות הקהילה — ישר לטלפון.</p>
    <label>שם <small>(לא חובה)</small><input name="name" autocomplete="name" maxlength="60"></label>
    <label>מספר טלפון נייד<input name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="(718) 555-0123" required></label>
    <input name="website" tabindex="-1" autocomplete="off" class="pb-hp" aria-hidden="true">
    <label class="pb-consent" dir="ltr"><input type="checkbox" name="ok"> <span>I agree to receive recurring automated text messages from <b>Khal Ungvar</b> (prayer times, zmanim and community updates) at the number above. Consent is not a condition of any purchase. Msg frequency varies. Msg &amp; data rates may apply. Reply <b>STOP</b> to cancel, <b>HELP</b> for help. See our <a href="sms.html" target="_blank">SMS Terms</a> and <a href="privacy.html" target="_blank">Privacy Policy</a>.</span></label>
    <p class="pb-msg" role="alert"></p>
    <div class="pb-acts"><button type="submit" class="pb-btn primary">הרשמה</button><button type="button" class="pb-btn pb-cancel">ביטול</button></div>
  </form>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.pb-x', dlg).onclick = close; $('.pb-cancel', dlg).onclick = close;
  const f = $('form', dlg); const msg = $('.pb-msg', dlg);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const phone = f.phone.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (phone.length !== 10) { msg.textContent = 'נא להקליד מספר טלפון אמריקאי של 10 ספרות.'; return; }
    if (!f.ok.checked) { msg.textContent = 'נא לסמן את ההסכמה לקבלת הודעות.'; return; }
    const btn = $('[type=submit]', f); btn.disabled = true; msg.textContent = 'שולח…';
    try {
      const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'webSignup', name: f.name.value.trim(), phone, consent: true, website: f.website.value }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      f.innerHTML = `<button type="button" class="pb-x" aria-label="סגירה">✕</button><h3>✅ תודה! ההרשמה התקבלה</h3>
        <p>בקרוב תגיע הודעה למספר <b dir="ltr">${h(f.phone.value)}</b> לאישור ההרשמה — יש להשיב <b dir="ltr">YES</b>, ומאז יתחילו להגיע ההודעות.</p>
        <p class="pb-sub" dir="ltr">You will receive a confirmation text shortly. Reply YES to confirm. Reply STOP at any time to cancel.</p>
        <div class="pb-acts"><button type="button" class="pb-btn primary pb-cancel">סגירה</button></div>`;
      $('.pb-x', dlg).onclick = close; $('.pb-cancel', dlg).onclick = close;
    } catch (err) {
      btn.disabled = false;
      msg.textContent = /bad-phone/.test(err.message) ? 'המספר אינו תקין.' : /too-many/.test(err.message) ? 'יותר מדי בקשות כרגע — נסו שוב מאוחר יותר.' : 'לא הצלחנו לשלוח. נסו שוב, או התקשרו (718) 851-0806.';
    }
  };
}

function donateDialog() {
  const dlg = document.createElement('dialog'); dlg.className = 'pb-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = `<button type="button" class="pb-x" aria-label="סגירה">✕</button><h3>💝 תרומה לקהל אונגוואר</h3>
    <p>התרומה באתר תיפתח בקרוב בעז"ה.</p>
    <p>בינתיים אפשר לתרום בטלפון <a href="tel:+17188510806" dir="ltr">(718) 851-0806</a> או במייל <a href="mailto:office@ungvar.org">office@ungvar.org</a>.</p>
    <p class="pb-sub" dir="ltr">Khal Ungvar is a 501(c)(3) nonprofit organization (EIN 11-2330829). Donations are tax-deductible to the extent allowed by law.</p>
    <div class="pb-acts"><button type="button" class="pb-btn primary pb-cancel">סגירה</button></div>`;
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  $('.pb-x', dlg).onclick = close; $('.pb-cancel', dlg).onclick = close;
}

function renderAll() {
  const I = nowInfo();
  const safe = (f) => { try { f(I); } catch (err) { console.error(err); } };
  [renderDate, renderWeekday, renderShabbos, renderZmanim, renderShiurim, renderMitzva, renderSimchos].forEach(safe);
}

export async function startHome() {
  document.querySelectorAll('[data-sms]').forEach((b) => { b.onclick = smsDialog; });
  document.querySelectorAll('[data-donate]').forEach((b) => { b.onclick = donateDialog; });
  TABS.forEach((t) => useRows(t, cached(t)));
  renderAll();
  loadBooks($('#pb-books'), 8);
  const rows = await Promise.all(TABS.map(tab));
  TABS.forEach((t, i) => useRows(t, rows[i]));
  renderAll();
  // כל 5 דקות (המנין הבא, אחרי השקיעה)
  setInterval(renderAll, 5 * 60 * 1000);
  setInterval(async () => { const rs = await Promise.all(TABS.map(tab)); TABS.forEach((t, i) => useRows(t, rs[i])); renderAll(); }, 30 * 60 * 1000);
  void HAVE;
}

export function startMachon() { loadBooks($('#pb-books'), 0); }
