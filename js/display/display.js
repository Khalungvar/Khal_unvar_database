// תצוגת בית הכנסת (1920×1080) — זמנים, מניינים, מצוה יומית, דף יומי, מזל טובים.
// דוגמה: די מניינים זענען איבערגענומען פון דער אלטער תוכנה (BZS); שפעטער — פון "זמני תפילות" אינעם אתר.
import { buildYear, isoOf, nOf, dowOf, hdOf, dafYomi, mitzvaYomis, omerText } from '../luach/engine.js';
import { zmanim, hhmm, LOCATIONS } from '../luach/zmanim.js';
import { MONTH } from '../luach/mitzva.js';
import { hebrewNumber } from '../hebdate.js';
import { normScreen, currentByPlace, adUrl, themeCss } from './screenset.js';
import { printCss, weekdayPage, shabbosPage, fitPages } from '../luach/tfprint.js';
import { CONFIG } from '../config.js';
import { defaults, computeWeekday, computeShabbos, computeSpecial, computeShiurim, computeHoly, chagOn, partOfDay, minorBlockOn, maarivNight, ptAround, PT, normData, eventsBetween } from '../luach/minyanim.js';
import { periodNow, dayLabel, clearPeriodCache } from '../luach/periods.js';

// ---------- דאטן: תצוגה מקדימה (פון "זמני תפילות" — localStorage), אנדערש ברירת מחדל ----------
const QS = new URLSearchParams(location.search);
const PREVIEW = QS.has('preview');
let DATA = defaults();
let LIVE = false; // נתונים מהגיליון (לא ברירת מחדל)
if (PREVIEW) { try { const j = JSON.parse(localStorage.getItem('tf-preview') || 'null'); if (j) DATA = { ...DATA, ...j }; } catch { /* */ } normData(DATA); }
else {
  // דער לעצטער וואס מ'האט באקומען — אויב דער אינטערנעט פאלט
  try { const j = JSON.parse(localStorage.getItem('disp-data') || 'null'); if (j) { DATA = { ...DATA, ...j }; LIVE = true; } } catch { /* */ }
  normData(DATA);
}
// ---------- לייענען פונעם גיליון פון דער תצוגה (פארעפנטלעכט) — יעדע 5 מינוט ----------
const SHEET_ID = '1hhrsXNhDCK7OGXOClTPE8pxOJ3EjmTmndH0r_qrms70';
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
let dataLast = '';
async function pull() {
  if (PREVIEW) return;
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Minyanim&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const rows = parseCsv(await r.text());
    const parts = rows.filter((x) => /^data#\d+$/.test(x[0] || '')).sort((a, b) => Number(a[0].split('#')[1]) - Number(b[0].split('#')[1]));
    if (!parts.length) return;
    const j = JSON.parse(parts.map((x) => x[1] || '').join(''));
    // נאר ווען עפעס האט זיך באמת געטוישט — אנדערש רעכנט מען יעדע מינוט איבער די גרייסן
    const js = JSON.stringify(j);
    if (js !== dataLast) { DATA = normData({ ...defaults(), ...j }); if (AWAY) DATA.rebbeAway = AWAY; } LIVE = true;
    if (js !== dataLast) { dataLast = js; boardCache.clear(); shLast = null; }
    try { localStorage.setItem('disp-data', js); } catch { /* */ }
  } catch { /* בלייבט מיט דעם וואס מ'האט */ }
}
// ✈ כ"ק אדמו"ר שליט"א נסע: לשונית RebbeAway — [from, to] (תאריכים)
let AWAY = null;
try { const j = JSON.parse(localStorage.getItem('disp-away') || 'null'); if (Array.isArray(j)) AWAY = j; } catch { /* */ }
async function pullAway() {
  if (PREVIEW) return;
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=RebbeAway&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const rows = parseCsv(await r.text());
    if (!rows.length || rows[0][0] !== 'from') { AWAY = []; return; }
    const dt = (v) => { const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); if (a) return a[0]; const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || ''); return b ? `${b[3]}-${b[1].padStart(2, '0')}-${b[2].padStart(2, '0')}` : ''; };
    const list = rows.slice(1).map((x) => ({ from: dt(x[0]), to: dt(x[1]) })).filter((x) => x.from && x.to);
    if (JSON.stringify(list) !== JSON.stringify(AWAY)) { AWAY = list; boardCache.clear(); DATA.rebbeAway = AWAY; clearPeriodCache(DATA); }
    try { localStorage.setItem('disp-away', JSON.stringify(AWAY)); } catch { /* */ }
  } catch { /* */ }
}
// שמחות: לשונית Simchos — [simcha_id, html, until(ms)]; יעדע שמחה ווייזט זיך ביז "until"
let SIMCHOS = null;
try { const j = JSON.parse(localStorage.getItem('disp-simchos') || 'null'); if (Array.isArray(j)) SIMCHOS = j; } catch { /* */ }
async function pullSimchos() {
  if (PREVIEW) return;
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Simchos&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const rows = parseCsv(await r.text());
    if (!rows.length || rows[0][0] !== 'simcha_id') return;
    SIMCHOS = rows.slice(1).filter((x) => x[0] && x[1]).map((x) => ({ id: x[0], html: x[1], until: Number(x[2]) || 0 }));
    try { localStorage.setItem('disp-simchos', JSON.stringify(SIMCHOS)); } catch { /* */ }
  } catch { /* */ }
}
// ---------- הגדרות פונעם מסך (לשונית Screen); ?scrpv=1 — תצוגה מקדימה פון "תצוגת והגדרות המסך" (נאך נישט געשפייכלט) ----------
const SCRPV = QS.has('scrpv');
let SCR = normScreen(null);
try { const j = JSON.parse(localStorage.getItem(SCRPV ? 'scr-preview' : 'disp-screen') || 'null'); if (j) SCR = normScreen(j); } catch { /* */ }
async function pullScreen() {
  if (SCRPV) return;
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Screen&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const rows = parseCsv(await r.text());
    const parts = rows.filter((x) => /^data#\d+$/.test(x[0] || '')).sort((a, b) => Number(a[0].split('#')[1]) - Number(b[0].split('#')[1]));
    if (!parts.length) return;
    const j = JSON.parse(parts.map((x) => x[1] || '').join(''));
    SCR = normScreen(j); applySafe(); mzCache.key = ''; shLast = null;
    try { localStorage.setItem('disp-screen', JSON.stringify(j)); } catch { /* */ }
  } catch { /* */ }
}
// אלע מינוט: די הגדרות, די זמנים און די שמחות
pull(); setInterval(pull, 60 * 1000);
pullScreen(); setInterval(pullScreen, 60 * 1000);
pullSimchos(); setInterval(pullSimchos, 60 * 1000);
pullAway(); setInterval(pullAway, 60 * 1000);

// ---------- כל 20 דקות: "אני מחובר" (סטטוס באתר) + גרסה חדשה של האתר → מרעננים לבד ----------
// בלי אינטרנט — לא נוגעים בכלום (ממשיכים להציג מה שיש). מרעננים רק אחרי שהקובץ החדש נטען בהצלחה.
const MYV = (document.querySelector('script[type=importmap]')?.textContent.match(/\?v=(\d+)/) || [])[1] || '';
async function heartbeat() {
  if (PREVIEW || OFFSET || SCRPV) return;
  try {
    if (CONFIG.SMS_URL) fetch(CONFIG.SMS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'display_ping', v: MYV }) }).catch(() => {});
    const r = await fetch(`display.html?chk=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const v = ((await r.text()).match(/\?v=(\d+)/) || [])[1];
    if (!v || !MYV || v === MYV) return;
    const ok = await fetch(`js/display/display.js?v=${v}`, { cache: 'no-store' }).then((x) => x.ok).catch(() => false);
    if (ok) location.reload();
  } catch { /* בלי אינטרנט */ }
}
setTimeout(heartbeat, 60 * 1000); setInterval(heartbeat, 20 * 60 * 1000);
// א פאלשע שעה (?at=2026-12-20T15:00) — צו זען א געוויסן טאג
let OFFSET = 0;
if (QS.get('at')) { const t = new Date(QS.get('at')); if (!Number.isNaN(t.getTime())) OFFSET = t.getTime() - Date.now(); }
const nowD = () => new Date(Date.now() + OFFSET);

const LOC = LOCATIONS.bp;
const $ = (s, r = document) => r.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const YDAY = ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שבת קודש'];
const SAMPLE = !PREVIEW && !LIVE;

// ---------- מזל טוב (שפעטער: פון "שהשמחה במעונם" — אותו טקסט ווי אינעם גליון) ----------
// יעדע שמחה: שורות פון בעלי השמחה + "לרגל ..."; צוויי אויפאמאל, יעדע 15 סעקונדעס די קומענדיגע
const SAMPLE_MAZEL = [
  { names: ['הרה"ח ר\' <b>פלוני פלונישטיין</b> הי"ו', 'הרה"ח ר\' <b>אלמוני אלמנשטיין</b> הי"ו'], for: 'לרגל אירוסי בנו-נכדו <b>יוסף</b> ני"ו עב"ג בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>פלוני כהן</b> הי"ו'], for: 'לרגל הכנסת בנו <b>משה</b> ני"ו לעול התורה והמצוות בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>פלוני לוי</b> הי"ו'], for: 'לרגל הולדת בנו בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>אלמוני גרין</b> הי"ו'], for: 'לרגל שמחת האפשערן של בנו <b>אברהם</b> ני"ו בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>פלוני וויס</b> הי"ו'], for: 'לרגל הולדת בתו בשעטו"מ' },
];
// בלעטער: אזויפיל שמחות וויפיל עס גייט אריין (געמאסטן) — 2 פון 4 שורות, 3 פון 2–3 שורות א.א.וו.
let MAZEL = SAMPLE_MAZEL;
function mazelNow() {
  if (SIMCHOS === null) return SAMPLE_MAZEL;
  const t = nowD().getTime();
  return SIMCHOS.filter((x) => !x.until || x.until > t).map((x) => ({ html: x.html, id: x.id }));
}
let mzCache = { key: '', pages: [[0]] }; let PER_ON = false;
function mazelPages() {
  MAZEL = mazelNow();
  if (!MAZEL.length) return [[]];
  const key = `${MAZEL.map((x) => x.id || x.for).join(',')}|${document.fonts?.status}|${Math.floor(Date.now() / 60000)}|${PER_ON}`;
  if (mzCache.key === key) return mzCache.pages;
  let m = document.getElementById('mzmeas');
  if (!m) { m = document.createElement('div'); m.id = 'mzmeas'; m.style.cssText = 'visibility:hidden;position:fixed;left:0;top:0;z-index:-1;pointer-events:none;direction:rtl'; document.body.appendChild(m); }
  m.className = `frame mzl${PER_ON ? ' mzl-per' : ''}`;
  m.innerHTML = `<img class="head" src="${SCR.simchaHead || 'img/display/simcha-title.jpg'}" alt=""><div class="wk">x</div><div class="list">${MAZEL.map(entryHtml).join('')}</div>`;
  const list = m.querySelector('.list');
  const cs = getComputedStyle(list);
  const avail = list.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const hs = [...list.children].map((e) => e.offsetHeight);
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  const pages = []; let cur = []; let used = 0;
  hs.forEach((hh, i) => {
    const need = (cur.length ? gap : 0) + hh;
    if (cur.length && used + need > avail) { pages.push(cur); cur = []; used = 0; }
    used += (cur.length ? gap : 0) + hh; cur.push(i);
  });
  if (cur.length) pages.push(cur);
  mzCache = { key, pages: pages.length ? pages : [[0]] };
  return mzCache.pages;
}
const entryHtml = (e) => (e.html ? `<div class="mz-e">${e.html}</div>` : `<div class="mz-e">${e.names.map((x) => `<div>${x}</div>`).join('')}<div class="for">${e.for}</div></div>`);

// ---------- מודעה (8.5×11) — דעקט צו זמני שבת + שמחות. דוגמה: ?ad=1 ----------
const AD_Q = new URLSearchParams(location.search).get('ad');
let AD = null; let CUR = {}; // CUR = { place: item } — מודעות / תמונות / טעקסטן פון "תצוגת והגדרות המסך"

// ---------- וואס איז היינט ----------
const yc = new Map();
function dayOf(n) {
  const Y = hdOf(n).y;
  for (const y of [Y, Y + 1]) {
    if (!yc.has(y)) yc.set(y, buildYear(y, {}, { loc: LOC }));
    const d = yc.get(y).days.find((x) => x.n === n);
    if (d) return d;
  }
  return null;
}
function prayerNote(n) {
  // מוריד הגשם: שמיני עצרת — פסח; ותן טל ומטר (חו"ל): 4/5 דעצעמבער — פסח
  const x = hdOf(n); const iso = isoOf(n);
  const after = (m, d) => (x.m === m ? x.d >= d : false);
  const winter = after('Tishri', 22) || ['Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'].includes(x.m) || (x.m === 'Nisan' && x.d < 15);
  if (!winter) return 'מוריד הטל · ותן ברכה';
  const y = Number(iso.slice(0, 4)); const md = iso.slice(5);
  const leapNext = (y + 1) % 4 === 0;
  const tal = md >= (leapNext ? '12-05' : '12-04') || md < '05-01';
  return `מוריד הגשם · ${tal ? 'ותן טל ומטר' : 'ותן ברכה'}`;
}

/** הוספות בתפילה פאר היינט */
function additions(n, day) {
  const out = [prayerNote(n)];
  const it = day?.items || [];
  if (it.some((i) => i.rc || i.chm || i.yt)) out.push('יעלה ויבוא');
  if (it.some((i) => i.chanuka || (i.kind === 'hol' && /^פורים/.test(i.text) && !/קטן/.test(i.text)))) out.push('על הניסים');
  if (it.some((i) => i.fast)) out.push('עננו');
  return out;
}

// ---------- שינוי אין די זמני ימות החול ----------
const GN0 = { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' };
const DNAME = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
/** דער "שליסל" פון א מנין: א שעה וואס רוקט זיך לויט דער שקיעה — דער כלל (אז עס זאל נישט ווערן "חדש" יעדע וואך) */
function chgKey(m) { return !SCR.chg?.shift && m.spec ? `R${m.spec}` : `t${Math.round(((m.min % 1440) + 1440) % 1440)}`; }
/** { 'מנחה|key': min } פאר א טאג */
function sigOf(k) {
  const w = computeWeekday(DATA, k, LOC); const out = {};
  for (const g of ['shacharis', 'mincha', 'maariv']) for (const m of w[g] || []) out[`${GN0[g]}|${chgKey(m)}`] = m.min;
  return out;
}
const sigEq = (a, b) => { const ka = Object.keys(a); return ka.length === Object.keys(b).length && ka.every((x) => x in b); };
function chgText(from, to) {
  // { G: { add: [min], rem: [min] } } → "מנחה 12:40 במקום 1:45" (נאר ביטול — אן הודעה)
  const by = {};
  for (const [x, m] of Object.entries(to)) if (!(x in from)) (by[x.split('|')[0]] ||= { add: [], rem: [] }).add.push(m);
  for (const [x, m] of Object.entries(from)) if (!(x in to)) (by[x.split('|')[0]] ||= { add: [], rem: [] }).rem.push(m);
  const t = (m) => `<b>${hhmm(((m % 1440) + 1440) % 1440)}</b>`;
  return Object.entries(by).filter(([, v]) => v.add.length).map(([g, v]) => {
    // יעדע נייע שעה — מיט דער נאענטסטער אלטער (ביז 90 מינוט) = "במקום"; אנדערש "נוסף"
    const rem = [...v.rem]; const sw = []; const add = [];
    for (const m of v.add.sort((a, b) => a - b)) {
      let bi = -1; rem.forEach((r, i) => { if (Math.abs(r - m) <= 90 && (bi < 0 || Math.abs(r - m) < Math.abs(rem[bi] - m))) bi = i; });
      if (bi >= 0) sw.push(`${t(m)} במקום ${t(rem.splice(bi, 1)[0])}`); else add.push(t(m));
    }
    return `${g} ${[...sw, ...(add.length ? [`נוסף ${add.join(', ')}`] : [])].join(', ')}`;
  }).join(' · ');
}
const isNormal = (k, holy) => dowOf(k) <= 4 && !holy(k) && !holy(k + 1) && !minorBlockOn(DATA, k) && !minorBlockOn(DATA, k + 1) && !maarivNight(DATA, k);
/** d0 = דער טאג פונעם לוח (null = שבת/יו"ט). גיט { note, newKeys } */
let chgMemo = null;
function changesFor(d0, n, holy) {
  // איינמאל פער מינוט (אדער ווען די דאטן טוישן זיך)
  const mk = Math.floor(Date.now() / 60000);
  if (chgMemo && chgMemo.d0 === d0 && chgMemo.n === n && chgMemo.D === DATA && chgMemo.S === SCR && chgMemo.mk === mk) return chgMemo.v;
  const v = changesCalc(d0, n, holy); chgMemo = { d0, n, D: DATA, S: SCR, mk, v }; return v;
}
function changesCalc(d0, n, holy) {
  const C = SCR.chg || {}; const out = { note: '', newKeys: new Set() };
  if (C.on === false || d0 == null || !LIVE && !PREVIEW) return out;
  const before = Math.max(0, Number(C.before) || 0); const after = Math.max(0, Number(C.after) || 0);
  const prevNormal = (k) => { let j = k - 1; while (j > k - 15 && !isNormal(j, holy)) j -= 1; return isNormal(j, holy) ? j : null; };
  let ref = d0; if (!isNormal(ref, holy)) ref = prevNormal(ref);
  if (ref == null) return out;
  const cur = sigOf(ref);
  // פאראויס: דער ערשטער געווענליכער טאג מיט אנדערע זמנים
  for (let k = d0 + 1; k <= d0 + before; k += 1) {
    if (!isNormal(k, holy)) continue;
    const sg = sigOf(k); if (sigEq(sg, cur)) continue;
    const txt = chgText(cur, sg);
    if (txt) { const x = hdOf(k); out.note = `<b>מיום ${DNAME[dowOf(k)]}</b> ${hebrewNumber(x.d)} ${MONTH[x.m] || x.m}: ${txt}`; }
    break;
  }
  // "חדש": א שינוי לויטן קאלענדאר (חורף/זומער) אין די לעצטע טעג
  const curK = sigOf(d0);
  for (let k = ref; k > d0 - after; k -= 1) {
    if (!isNormal(k, holy)) continue;
    const p = prevNormal(k); if (p == null) break;
    const a = sigOf(k); const b = sigOf(p);
    for (const x of Object.keys(a)) if (!(x in b) && x in curK) out.newKeys.add(x);
  }
  // "חדש": א שינוי פון א גבאי (געזען אויף דעם מחשב) — נאר אויפן אמת'ן מסך
  if (!PREVIEW && !SCRPV && !OFFSET) {
    let st = null; try { st = JSON.parse(localStorage.getItem('disp-chg') || 'null'); } catch { /* */ }
    st = st && st.base ? st : { base: { day: ref, sig: cur }, seen: {} };
    const then = st.base.sig; const nowSig = sigOf(st.base.day);
    if (!sigEq(then, nowSig)) for (const x of Object.keys(nowSig)) if (!(x in then)) st.seen[x] = n;
    st.base = { day: ref, sig: cur };
    for (const [x, since] of Object.entries(st.seen)) { if (since <= n - Math.max(1, after) || !(x in curK)) delete st.seen[x]; else out.newKeys.add(x); }
    try { localStorage.setItem('disp-chg', JSON.stringify(st)); } catch { /* */ }
  }
  return out;
}

function render() {
  const HID = SCR.hide || {};
  if (!PREVIEW && AWAY) DATA.rebbeAway = AWAY;
  // פארבן (נאר ווען זיי טוישן זיך)
  const tc = themeCss(SCR);
  if (tc !== thmLast) { thmLast = tc; let st = document.getElementById('thm'); if (!st) { st = document.createElement('style'); st.id = 'thm'; document.head.appendChild(st); } st.textContent = tc; }
  CUR = currentByPlace(SCR, nowD());
  AD = AD_Q ? { q: AD_Q } : CUR.right || null;
  const now = nowD();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const n = nOf(iso); const dw = dowOf(n); const x = hdOf(n);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const z = zmanim(iso, LOC);
  const zm = { ...z, shkia: z.shkia, neitz: z.neitz, chatzos: z.chatzos };
  const maHour = (z.tzeis - z.alos) / 12; const graHour = (z.shkia - z.neitz) / 12;
  const day = dayOf(n);
  let sat = n; while (dowOf(sat) !== 6) sat += 1;
  if (sat === n && nowMin > z.shkia + 90) sat += 7; // מוצאי שבת: שוין די קומענדיגע וואך
  const fri = sat - 1;
  const parsha = dayOf(sat)?.parsha || dayOf(sat)?.items.find((i) => i.kind === 'hol')?.text || '';
  
  const zFri = zmanim(isoOf(fri), LOC); const zSat = zmanim(isoOf(sat), LOC);

  // [נאמען, מג"א/איינס, גר"א, הדגשה]
  const rows = [
    ['עלות השחר', z.alos], ['הנחת תפילין', z.neitz - 48], ['נץ החמה', z.neitz, null, true],
    ['סוף זמן קריאת שמע', z.alos + 3 * maHour, z.neitz + 3 * graHour, true],
    ['סוף זמן תפילה', z.alos + 4 * maHour, z.neitz + 4 * graHour],
    ['חצות', z.chatzos], ['שקיעת החמה', z.shkia, null, true], ['רבינו תם', z.shkia + 72],
  ];
  if (dw === 5) rows.push(['הדלקת נרות', z.candles, null, true]);
  // דער קומענדיגער זמן (ביי מג"א/גר"א — ביז דער שפעטערער)
  const nxz = rows.findIndex(([, a, b]) => Math.max(a, b ?? a) >= nowMin);
  const holAll = (day?.items || []).filter((i) => i.kind === 'hol').map((i) => i.text).join(' · ');
  const adds = additions(n, day);
  // ספירת העומר: ביז שקיעה — וואס מ'האט געציילט נעכטן ביינאכט; נאך שקיעה — וואס מ'ציילט היינט ביינאכט
  const omerDay = nowMin >= z.shkia ? dayOf(n + 1) : day;
  const omerT = omerDay?.items.find((i) => i.kind === 'omer')?.text || '';
  const omerK = omerT ? Array.from({ length: 49 }, (_, i) => i + 1).find((k) => omerText(k) === omerT) : 0;
  const omer = omerK ? `יום ${hebrewNumber(omerK)} לעומר` : '';
  const SHI = computeShiurim(DATA, n, LOC);
  const nextShiur = SHI.find((x) => x.min != null && x.min >= nowMin) || null;
  // {שעה} {חלק היום} - {שם השיעור} - {מגיד שיעור} - {מיקום}
  const shLine = (x) => {
    const t = x.min == null ? `<b>${h(x.note || '')}</b>` : `<b>${tm(x.min)}</b> <small>${partOfDay(x.min)}</small>`;
    const parts = [x.type === 'daf' ? '' : h(x.title), h(x.who), h(x.room)].filter(Boolean).join(' - ');
    return `<div class="${x === nextShiur ? 'nx' : 'ln'}">${t} - ${parts}</div>`;
  };

  // מניינים
  // ---- דער לוח פון מניינים: וואכנטאג, אדער שבת/יו"ט (פון ערב שבת/יו"ט נאך דער לעצטער שחרית) ----
  // min = מינוט פון היינט האלבנאכט (נעכטן: -1440, מארגן: +1440)
  const holy = (k) => dowOf(k) === 6 || chagOn(DATA, k);
  const zOf = (k) => zmanim(isoOf(k), LOC);
  const GN = { shacharis: 'שחרית', mincha: 'מנחה', maariv: 'מעריב' };
  function specials(k, off, place) {
    // שורות מיוחדות (ימי דפגרא / יו"ט / תשרי) פאר טאג k אין דעם ארט
    return computeSpecial(DATA, k, LOC).filter((bk) => !(bk.part === 'minor' && PT.includes(bk.when))).map((bk) => ({ title: bk.title, type: bk.type, rows: bk.rows.filter((r) => r.screen && (r.disp?.place || (bk.type === 'chag' ? 'shab' : 'weekday')) === place) }))
      .filter((bk) => bk.rows.length).map((bk) => ({ ...bk, rows: bk.rows.map((r) => ({ ...r, mins: r.mins.map((m) => m + off) })) }));
  }
  // לוח ימות החול: די גאנצע וואך די זעלבע (פון פרייטאג נאך דער לעצטער שחרית ביז פרייטאג נאך דער לעצטער שחרית), לויט דעם זונטאג.
  // פרייטאג: שחרית פון פרייטאג; ערב חג: זיינע אייגענע שעות. מעריב מוצאי תענית / חנוכה — באזונדערע פסים.
  // יעדער מנין: day = דער טאג וואס ער איז טאקע; skip = ער איז נישט היינט (חוץ מיום א' / מוצאי תענית / פרייטאג)
  function weekdayBoard(k, off) {
    const wP = computeWeekday(DATA, k, LOC, { plain: true });
    const wD = computeWeekday(DATA, k, LOC, { ytOnly: true });
    const dk = dowOf(k); const ov = wD.ov || {};
    const pick = (g) => (g === 'shacharis' || ov[g] ? wD[g] : wP[g]);
    const sun = k - dk + (dk === 6 ? 7 : 0);
    const nights = [0, 1, 2, 3, 4].map((i) => ({ d: sun + i, mn: maarivNight(DATA, sun + i) })).filter((x) => x.mn);
    const xNight = new Set(nights.map((x) => x.d));
    const chN = nights.filter((x) => x.mn.chanuka);
    const notes = { shacharis: wP.shacharisNote, mincha: wP.minchaNote, maariv: wP.maarivNote };
    // שולחן הטהור ודרשות: "אין מנין לפני / אחרי" (מנחה ומעריב פון דעם טאג)
    const quiet = eventsBetween(DATA, k, k, LOC).flatMap((e) => (Number(e.ev.qb) || Number(e.ev.qa) ? e.rows.map((r) => [r.min - (Number(e.ev.qb) || 0), r.min + (Number(e.ev.qa) || 0)]) : []));
    const skipOf = (g, m) => (m.xdays || []).includes(dk) || (g !== 'shacharis' && !ov[g] && dk === 5) || (g === 'maariv' && !ov.maariv && xNight.has(k))
      || (g !== 'shacharis' && !m.rebbe && quiet.some(([a, b]) => m.min >= a && m.min <= b));
    const groups = ['shacharis', 'mincha', 'maariv'].map((g) => ({ g, h: g === 'maariv' && chN.length ? 'מעריב (לא בימי חנוכה)' : GN[g], sub: notes[g] ? `(${notes[g]})` : '',
      items: pick(g).filter((m) => g === 'shacharis' || !m.rebbe).map((m) => ({ ...m, k: GN[g], key: chgKey(m), min: m.min + off, day: k, skip: skipOf(g, m) })) }));
    // אלע וואכנטעג זענען חנוכה — קיין מעריב הרגיל
    if (chN.length >= 5) groups.splice(2, 1);
    const rbM = pick('mincha').find((m) => m.rebbe); const rbA = pick('maariv').find((m) => m.rebbe);
    if (rbM || rbA) {
      groups.splice(2, 0, { h: SCR.texts.tRebbe, rebbe: true, items: [
        ...(rbM ? [{ ...rbM, k: 'מנחה', key: chgKey(rbM), lbl: 'מנחה', min: rbM.min + off, day: k, skip: skipOf('mincha', rbM) }] : []),
        ...(rbA ? [{ ...rbA, k: 'מעריב', key: chgKey(rbA), lbl: 'מעריב <small>(בערך)</small>', min: rbA.min + off, day: k, skip: skipOf('maariv', rbA) }] : [])] });
    }
    // פסים: מעריב מוצאי תענית / מעריב בחנוכה — פונעם אנפאנג פון דער וואך, ביז א האלבע שעה נאכן לעצטן מנין
    const extra = [];
    const strip = (label, list) => {
      const per = list.map((x) => ({ d: x.d, items: computeWeekday(DATA, x.d, LOC).maariv.map((m) => ({ ...m, k: label, min: m.min + (x.d - n) * 1440, day: x.d })) })).filter((x) => x.items.length);
      if (!per.length) return;
      const end = Math.max(...per.flatMap((x) => x.items.map((m) => m.min))) + 30;
      if (end < nowMin) return;
      per.forEach((x) => extra.push(...x.items));
      const show = per.find((x) => Math.max(...x.items.map((m) => m.min)) + 30 >= nowMin) || per[per.length - 1];
      groups.push({ h: label, sub: '', strip: true, items: show.items.map((m) => ({ ...m, skip: true })) });
    };
    nights.filter((x) => !x.mn.chanuka).forEach((x) => strip(x.mn.label, [x]));
    if (chN.length) strip('מעריב בחנוכה', chN);
    for (const bk of specials(k, off, 'weekday')) {
      for (const r of bk.rows) groups.push({ h: r.label, sub: r.note ? `(${r.note})` : '', special: true, items: r.mins.map((m) => ({ min: m, k: r.label, room: '', day: k })) });
    }
    const lastM = ov.mincha ? wD.last : wP.last;
    return { holy: false, k, last: lastM == null ? null : lastM + off, groups, extra };
  }
  // די מניינים פון א לוח וואס זענען טאקע אויף זיין טאג (אדער שבת/יו"ט)
  const dayItems = (bd) => [...bd.groups.flatMap((g) => g.items), ...(bd.extra || [])].filter((m) => !m.skip && (m.day == null || m.day === bd.k));
  // פורים / תשעה באב: זמנים מיוחדים — אנשטאט זמני שבת (אדער אנשטאט ימות החול, ווען עס איז זונטאג), ביז א האלבע שעה נאכן לעצטן
  function ptBox() {
    const pa = ptAround(DATA, n); if (!pa) return null;
    const { block: b, ds } = pa; const rows = [];
    for (let k = ds[0] - 1; k <= ds[ds.length - 1]; k += 1) {
      for (const bk of computeSpecial(DATA, k, LOC)) {
        if (bk.when !== b.when) continue;
        for (const r of bk.rows) if (r.screen && r.mins.length) rows.push({ label: r.label, note: r.note, kind: r.kind, min: r.mins[0] + (k - n) * 1440, more: r.mins.slice(1).map((m) => m + (k - n) * 1440) });
      }
    }
    if (!rows.length) return null;
    const end = Math.max(...rows.flatMap((r) => [r.min, ...r.more])) + 30;
    if (nowMin > end) return null;
    const sunCase = dowOf(ds[0]) === 0;
    const wsun = ds[0] - dowOf(ds[0]);
    const startOk = sunCase ? (n > ds[0] - 2 || (n === ds[0] - 2 && swap)) : (n > wsun - 1 || (n === wsun - 1 && !swap));
    if (!startOk) return null;
    return { title: b.title, d: ds[0], rows: rows.sort((a, c) => a.min - c.min) };
  }
  // שבת / יו"ט: שורות פאר די גרויסע קעסטל. eve = ערב (פרייטאג / ערב יו"ט), d = דער טאג
  function holyRows(eve) {
    const oe = (eve - n) * 1440; const od = (eve + 1 - n) * 1440;
    return computeHoly(DATA, eve, LOC).filter((r) => r.screen !== false && r.place === 'shab')
      .map((r) => { const off = r.day ? od : oe; return { label: r.label, kind: r.kind, note: r.note, min: r.min == null ? null : r.min + off, more: (r.more || []).map((m) => m + off) }; });
  }
  function holyBoard(eve) {
    const rows = holyRows(eve);
    return { holy: true, rows, groups: [{ items: rows.filter((r) => (r.kind === 'tefila' || r.kind === 'event') && r.min != null).map((r) => ({ min: r.min, k: r.label, room: '' })) }] };
  }
  const hasFuture = (bd) => dayItems(bd).some((m) => m.min >= nowMin);
  // שבת/יו"ט: פון ערב (נאך דער לעצטער שחרית) ביז נאך מעריב מוצאי — טוישן זיך די פלעצער:
  // די שבת-קעסטל ווערט גרויס אויפן ארט פון זמני התפילות, און זמני התפילות (וואכנטאג) ווערט קליין אויפן ארט פון שבת
  let hd = null;
  if (holy(n)) {
    hd = n;
    // מוצאי שבת/יו"ט: צוריק צום וואכנטאג X מינוט נאך דער לעצטער תפילה (הגדרות המסך)
    const rv = Number(SCR.revertMin) || 0;
    if (!holyBoard(n - 1).groups.some((g) => g.items.some((m) => m.min + rv >= nowMin))) hd = holy(n + 1) ? n + 1 : null;
  } else if (holy(n + 1)) {
    const lastSh = Math.max(0, ...computeWeekday(DATA, n, LOC).shacharis.map((m) => m.min));
    if (nowMin > lastSh) hd = n + 1;
  }
  const swap = hd != null;
  const hb = swap ? holyBoard(hd - 1) : null;
  let wk = hd != null ? hd + 1 : n; while (swap && holy(wk)) wk += 1;
  const board = swap ? weekdayBoard(wk, (wk - n) * 1440)
    : [weekdayBoard(n, 0), weekdayBoard(n + 1, 1440)].find(hasFuture) || weekdayBoard(n + 1, 1440);
  // שבת-קעסטל (ווען נישט געטוישט): די קומענדיגע שבת / יו"ט
  let nextEve = n; while (!holy(nextEve + 1) || holy(nextEve)) nextEve += 1;
  // ---- שולחן הטהור ודרשות וואס זענען נישט אין שבת: אין דער משבצת פון שבת (פאר / נאך די זמני שבת), ביז א שעה נאכן לעצטן ----
  const inShabEv = (e) => e.rows.every((r) => (dowOf(r.day) === 6 && r.min < zmanim(isoOf(r.day), LOC).motzei) || (dowOf(r.day) === 5 && r.min >= zmanim(isoOf(r.day), LOC).candles));
  const EVW = eventsBetween(DATA, n - 2, n + 10, LOC).filter((e) => !inShabEv(e))
    .map((e) => ({ ...e, rel: e.rows.map((r) => ({ ...r, rmin: r.min + (r.day - n) * 1440 })) }))
    .filter((e) => Math.max(...e.rel.map((r) => r.rmin)) + 60 >= nowMin);
  /** די אירועים פאר דער משבצת פון שבת (ערב = eve): פאר שבת (זונטאג–פרייטאג) און נאך שבת (זונטאג / מוצאי שבת) */
  const evFor = (eve) => {
    const before = EVW.filter((e) => e.n >= eve - 5 && e.n <= eve); const after = EVW.filter((e) => e.n === eve + 2);
    const rowsN = [...before, ...after].reduce((a, e) => a + e.rel.length, 0);
    return { before, after, only: before.length + after.length >= 2 || rowsN > 3 };
  };
  const evItems = EVW.flatMap((e) => e.rel.map((r) => ({ min: r.rmin, k: r.label, room: '' })));
  // ---- פסח / תשרי: א גרויסע משבצת מיט אלע זמנים פונעם חלק ----
  const PER = periodNow(DATA, n, nowMin, LOC); PER_ON = !!PER;
  const perItems = PER ? PER.seg.secs.flatMap((sc) => sc.lines.filter((l) => l.screen !== false && (l.kind === 'tefila' || l.kind === 'event')).flatMap((l) => l.per.flatMap((q) => q.mins.map((m) => ({ min: m + (q.n - n) * 1440, k: l.label, room: '' }))))) : [];
  const PTB = PER ? null : ptBox();
  const ptItems = PTB ? PTB.rows.filter((r) => r.kind === 'tefila').flatMap((r) => [r.min, ...r.more].map((m) => ({ min: m, k: r.label, room: '' }))) : [];
  const all = PER ? perItems.sort((x, y) => x.min - y.min) : [...dayItems(swap ? hb : board), ...ptItems, ...evItems].sort((x, y) => x.min - y.min);
  // דער קומענדיגער מנין — אויב נישט אויפן לוח (נאך דעם לעצטן מעריב), זוכן ווייטער: וואכנטאג / שבת / יו"ט
  const nextAny = () => {
    for (let k = n; k < n + 10; k += 1) {
      const items = holy(k) ? holyBoard(k - 1).groups.flatMap((g) => g.items) : dayItems(weekdayBoard(k, (k - n) * 1440));
      const f = items.filter((m) => m.min >= nowMin).sort((a, b) => a.min - b.min);
      if (f.length) return f[0];
    }
    return null;
  };
  const next = all.find((m) => m.min >= nowMin) || nextAny();
  const lastMincha = swap ? null : board.last;
  const cd = next ? Math.max(0, (next.min - nowMin) * 60) : 0;
  const cdText = `${String(Math.floor(cd / 3600)).padStart(2, '0')}:${String(Math.floor((cd % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(cd % 60)).padStart(2, '0')}`;
  const tm = (min) => hhmm(min);
  const pair = (a, b) => `<span class="pr">${tm(b)}<i>גר"א</i></span><span class="pr">${tm(a)}<i>מג"א</i></span>`;
  // שינוי אין די זמני ימות החול: "מיום ... במקום ..." פאראויס, און "חדש" נאכן שינוי (הגדרות המסך → chg)
  const chg = changesFor(swap ? null : board.k, n, holy);
  const isNew = (m) => !!(m.key && chg.newKeys.has(`${m.k}|${m.key}`));
  const isNx = (m) => !!next && (m === next || (m.k === next.k && m.min === next.min));
  const timesHtml = (arr) => arr.map((m) => `<span class="${m.min < nowMin ? 'past' : ''}${isNx(m) ? ' nx' : ''}${isNew(m) ? ' new' : ''}">${isNew(m) ? '<em>חדש</em>' : ''}${tm(((m.min % 1440) + 1440) % 1440)}${m.note === 'בערך' ? '<small style="font-size:20px"> בערך</small>' : ''}${m.xn ? `<small style="font-size:18px"> (${m.xn})</small>` : ''}</span>`).join('');

  const mnyHtml = (bd, pos) => `<div class="frame mny ${pos}${(chg.note || CUR.notice) && pos === 'pos-main' ? ' has-chg' : ''}">
      <div class="ttl">${h(SCR.texts.tWeek)}${(() => { const k0 = swap ? wk : n; let s6 = k0; while (dowOf(s6) !== 6) s6 += 1; const p6 = dayOf(s6)?.parsha; return p6 ? ` לפרשת ${h(p6)}` : ''; })()}</div>
      ${pos === 'pos-main' && CUR.notice ? `<div class="chg-note ntc">${esc2(CUR.notice.text)}</div>` : ''}
      ${bd.groups.map((g) => (g.rebbe
        ? `<div class="grp rb"><h3>${h(g.h)}</h3><div class="times rbt">${g.items.map((m) => `<span class="${m.min < nowMin ? 'past' : ''}${m === next ? ' nx' : ''}${isNew(m) ? ' new' : ''}">${isNew(m) ? '<em>חדש</em>' : ''}<i>${m.lbl}</i> ${tm(((m.min % 1440) + 1440) % 1440)}</span>`).join('')}</div></div>`
        : `<div class="grp"><h3>${h(g.h)}${g.sub ? ` <small>${h(g.sub)}</small>` : ''}</h3><div class="times">${timesHtml(g.items)}</div></div>`)).join('')}
      ${chg.note && pos === 'pos-main' ? `<div class="chg-note">⚠ ${chg.note}</div>` : ''}
    </div>`;
  function shabHtml(eve, d, pos) {
    const shab = dowOf(d) === 6;
    const ytName = dayOf(d)?.items.find((i) => i.kind === 'hol' && i.yt)?.text || '';
    const ps = shab ? (dayOf(d)?.parsha || '') : '';
    // דער נאמען פונעם בלאק פון חג (פסח, שבועות, שבת חול המועד ...) — ווי אין "זמני תפילות"
    const chagTitle = [d, eve].map((k) => specials(k, 0, 'shab').find((bk) => bk.type === 'chag')?.title).find(Boolean) || '';
    // נאר מיט א שעה, לויט דער שעה (הדלקת נרות / ער"ש / שבת)
    const E = evFor(eve);
    const evRows = (list) => list.flatMap((e, i) => [...(i ? [{ sep: true }] : []), ...e.rel.map((r) => ({ label: r.label, kind: 'event', min: r.rmin, more: [] }))]);
    const sh = E.only ? [] : holyRows(eve).filter((r) => r.min != null).sort((a, b) => a.min - b.min);
    const rows = E.only ? evRows([...E.before, ...E.after])
      : [...evRows(E.before), ...(E.before.length ? [{ sep: true }] : []), ...sh, ...(E.after.length ? [{ sep: true }] : []), ...evRows(E.after)];
    const dense = rows.length > (pos === 'pos-main' ? 8 : 7) ? ' dense' : '';
    return `<div class="shab ${pos}${dense}${pos === 'pos-main' && CUR.notice ? ' has-ntc' : ''}" style="--n:${rows.length}">
      ${pos === 'pos-main' && CUR.notice ? `<div class="chg-note ntc">${esc2(CUR.notice.text)}</div>` : ''}
      <div class="sh-t"><small class="pre">${h(SCR.texts.tHoly)}</small>${h(chagTitle ? `ל${chagTitle}` : shab ? 'לשבת קודש' : `ל${ytName || 'יום טוב'}`)}<small>${E.only ? '&nbsp;' : ps ? `פרשת ${h(ps)}` : '&nbsp;'}</small></div>
      ${rows.map((r) => (r.sep ? '<div class="sh-sep"></div>' : `<div class="sh-r${r.kind === 'tefila' ? ' big' : ''}${(r.kind === 'tefila' || r.kind === 'event') && r.min != null && r.min < nowMin ? ' past' : ''}"><span>${h(r.label)}</span><b>${r.min == null ? '—' : [r.min, ...(r.more || [])].map((m) => tm(((m % 1440) + 1440) % 1440)).join(' · ')}</b></div>`)).join('')}
    </div>`;
  }
  // פסח / תשרי: אלע טעג פונעם חלק, אין דריי שפאלטן (פון רעכטס צו לינקס)
  const DNS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", 'ש"ק'];
  function perHtml() {
    const secs = PER.seg.secs.map((sc) => ({ ...sc, ls: sc.lines.filter((l) => l.screen !== false) })).filter((sc) => sc.ls.length);
    const rel = (q, m) => m + (q.n - n) * 1440;
    const tt = (m) => tm(((m % 1440) + 1440) % 1440);
    const line = (l) => {
      const same = l.per.every((q) => q.mins.join() === l.per[0].mins.join());
      const lastQ = l.per[l.per.length - 1];
      const past = rel(lastQ, Math.max(...lastQ.mins)) < nowMin;
      const times = same ? l.per[0].mins.map((m) => tt(m)).join(' · ') : l.per.map((q) => `<i>${DNS[dowOf(q.n)]}</i> ${q.mins.map((m) => tt(m)).join(' · ')}`).join(' &nbsp;');
      return `<div class="pd-r${l.kind === 'tefila' ? ' t' : l.kind === 'event' ? ' e' : ''}${past ? ' past' : ''}"><span>${h(l.label)}${l.note ? ` <small>(${h(l.note)})</small>` : ''}</span><b>${times}</b></div>`;
    };
    const title = PER.part === 'pesach' ? 'זמני התפילות לחג הפסח' : 'זמני התפילות לימי תשרי';
    return `<div class="frame per"><div class="ttl">${h(title)}</div><div class="pcols">${secs.map((sc) => `<div class="pd"><div class="pd-h">${h(sc.title)} <small>${h(sc.dates)}</small></div>${sc.ls.map(line).join('')}</div>`).join('')}</div></div>`;
  }

  function ptHtml(pos) {
    const P = PTB; const x0 = hdOf(P.d);
    const dense = P.rows.length > 7 ? ' dense' : '';
    return `<div class="shab pt ${pos}${dense}" style="--n:${P.rows.length}">
      <div class="sh-t"><small class="pre">${h(SCR.texts.tHoly)}</small>${h(`ל${P.title}`)}<small>${h(`${YDAY[dowOf(P.d)]} ${hebrewNumber(x0.d)} ${MONTH[x0.m] || x0.m}`)}</small></div>
      ${P.rows.map((r) => `<div class="sh-r${r.kind === 'tefila' ? ' big' : ''}${r.min < nowMin && !r.more.some((m) => m >= nowMin) ? ' past' : ''}"><span>${h(r.label)}</span><b>${[r.min, ...r.more].map((m) => tm(((m % 1440) + 1440) % 1440)).join(' · ')}</b></div>`).join('')}
    </div>`;
  }
  const hh = now.getHours() % 12 || 12; const ap = now.getHours() < 12 ? 'AM' : 'PM';
  const heDate = `${hebrewNumber(x.d)} ${MONTH[x.m] || x.m} ${hebrewNumber(x.y % 1000)}`;
  const mz = mitzvaYomis(iso); const daf = dafYomi(iso);
  const mzPages = mazelPages(); const pages = mzPages.length;
  const mzSec = Math.max(3, Number(SCR.mzSec) || 15);
  const mzIx = QS.has('mzpage') ? Math.min(pages - 1, Math.max(0, Number(QS.get('mzpage')) || 0)) : Math.floor(Date.now() / (mzSec * 1000)) % pages;
  const mzList = mzPages[mzIx].map((i) => MAZEL[i]);

  const html = `
    ${PREVIEW ? '<div class="sample">תצוגה מקדימה — לא נשמר</div>' : !LIVE ? '<div class="sample">דוגמה — זמני ברירת מחדל</div>' : ''}
    <div class="top">
      ${HID.day ? '<div class="day"></div>' : `<div class="day">${h(dw === 6 && nowMin > z.motzei ? 'מוצאי שבת קודש' : YDAY[dw])}${parsha ? `<small>פרשת ${h(parsha)}</small>` : ''}${holAll ? `<small class="sp">${h(holAll)}</small>` : ''}</div>`}
      ${HID.logo ? '<div class="logo"></div>' : `<div class="logo"><img src="${h(SCR.logo || 'img/logo.png')}" alt=""><b>${h(SCR.texts.title)}</b><i>${h(SCR.texts.sub)}</i></div>`}
      ${HID.clock ? '<div class="clock"></div>' : `<div class="clock">${hh}:${String(now.getMinutes()).padStart(2, '0')}<span>${String(now.getSeconds()).padStart(2, '0')} ${ap}</span></div>`}
    </div>

    ${PER ? perHtml() : swap ? shabHtml(hd - 1, hd, 'pos-main') : mnyHtml(board, 'pos-main')}

    ${HID.next ? '' : `<div class="frame next">
      <div class="row1"><div class="lbl">${h(SCR.texts.tNext)}</div>${next && SCR.countdown !== false ? `<div class="cd">${cdText}</div>` : ''}</div>
      ${next ? `<div class="big${next.k.length > 6 ? ' long' : ''}"><span class="name">${h(next.k)}</span><span class="time">${tm(((next.min % 1440) + 1440) % 1440)}</span></div>
      <div class="room">${next.room ? h(next.room) : '&nbsp;'}</div>` : '<div class="big"><span class="name">&nbsp;</span></div>'}
    </div>`}

    ${false ? ''
      : ''}

    ${AD ? `
    <div class="frame zm zm-c pos-side">
      <div class="ttl">${h(SCR.texts.tZmanim)}</div>
      <table>
        ${rows.map(([l, a, b], i) => `<tr${i === nxz ? ' class="nx"' : ''}><td>${h(l)}</td><td>${b == null ? tm(a) : pair(a, b)}</td></tr>`).join('')}
      </table>
      <div class="note">${adds.map((a, i) => (i ? `<span class="chg">${h(a)}</span>` : h(a))).join(' · ')}</div>
      ${omer ? `<div class="omer">${h(omer)}</div>` : ''}
      <div class="lc"><div><h4>${h(SCR.texts.tMitzva)}</h4><p>מצוה ${h(hebrewNumber(mz.n))}</p><small>${h(mz.text)}</small></div><div><h4>${h(SCR.texts.tDaf)}</h4><p>${h(daf.text)}</p></div></div>
    </div>` : HID.side || PER ? '' : PTB ? ptHtml('pos-side') : swap ? mnyHtml(board, 'pos-side') : shabHtml(nextEve, nextEve + 1, 'pos-side')}

    ${HID.simchos ? '' : `<div class="frame mzl">
      <img class="head" src="${h(SCR.simchaHead || 'img/display/simcha-title.jpg')}" alt="שהשמחה במעונם">
      <div class="wk">${parsha ? `פרשת ${h(parsha)}` : ''}</div>
      <div class="list">${mzList.map(entryHtml).join('')}</div>
      ${pages > 1 ? `<div class="dots">${Array.from({ length: pages }, (_, i) => `<i class="${i === mzIx ? 'on' : ''}"></i>`).join('')}</div><div class="pg">${mzIx + 1} מתוך ${pages}</div>` : ''}
    </div>`}

    ${AD ? '' : `
    ${HID.zmanim ? '' : `<div class="frame zm zx${(dw === 5 ? 1 : 0) + (omer ? 1 : 0)}">
      <div class="ttl">${h(SCR.texts.tZmanim)}</div>
      <table>
        ${rows.map(([l, a, b], i) => `<tr${i === nxz ? ' class="nx"' : ''}><td>${h(l)}</td><td>${b == null ? tm(a) : pair(a, b)}</td></tr>`).join('')}
      </table>
      <div class="note">${adds.map((a, i) => (i ? `<span class="chg">${h(a)}</span>` : h(a))).join(' · ')}</div>
      ${omer ? `<div class="omer">${h(omer)}</div>` : ''}
    </div>`}

    ${HID.mitzva ? '' : `<div class="frame lrn-m">
      <div class="l1"><span>${h(SCR.texts.tMitzva)}:</span> מצוה ${h(hebrewNumber(mz.n))}</div>
      <div class="l2 fit">${h(mz.text)}</div>
    </div>`}
    ${HID.daf ? '' : `<div class="frame lrn-m lrn-d">
      <div class="l1"><span>${h(SCR.texts.tDaf)}</span></div>
      <div class="l2 fit">${h(daf.text)}</div>
    </div>`}`}
<!--BOT-->
    ${HID.bottom ? '' : `<div class="bottom">
      <div class="hd">${h(heDate)}</div>
      <div class="kol">${h(SCR.texts.kolText)} <b>${h(SCR.texts.kolPhone)}</b></div>
      <div class="greg">${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>`}`;
  // שיעורי תורה: אין אן אייגענעם שיכט (נישט איבערגעצייכנט יעדע סעקונדע) — ווען עס גייט נישט אריין, פארט עס פאמעלעך ארויף אין א קרייז
  const shDaf = SHI.filter((x) => x.type === 'daf'); const shOth = SHI.filter((x) => x.type !== 'daf');
  const shRow = (x) => `<div class="ln">${shLine(x).replace(/^<div[^>]*>|<\/div>$/g, '')}</div>`;
  const shInner = `${shDaf.length ? `<div class="shiur sh-daf"><h4>${h(SCR.texts.tShDaf)}</h4>${shDaf.map(shRow).join('')}</div>` : ''}${shOth.length ? `<div class="shiur sh-oth"><h4>${h(SCR.texts.tShOth)}</h4>${shOth.map(shRow).join('')}</div>` : ''}`;
  const [main, bot] = html.split('<!--BOT-->');
  if (!$('#dyn')) {
    $('#screen').innerHTML = '<div class="safe"><div id="dyn"></div><div id="shl"></div><div id="adlayer"></div><div id="ovl"></div></div><div id="dynb"></div>';
  }
  // די מודעה (רעכטס): נאר ווען זי טוישט זיך (א ווידעא הייבט זיך נישט אן פון אנפאנג)
  const adKey = AD ? (AD.q || `${AD.id}|${AD.lib || AD.sys || ''}|${AD.text || ''}|${AD.fit || ''}`) : '';
  if (adKey !== adLast) { adLast = adKey; $('#adlayer').innerHTML = AD ? `<div class="ad${AD.clear ? ' clr' : ''}">${adHtml(AD)}</div>` : ''; fillSystem($('#adlayer')); }
  $('#dyn').innerHTML = main;
  $('#screen').classList.toggle('per-on', !!PER);
  for (const box of document.querySelectorAll('#dyn .per .pcols')) {
    let fs = 30; box.style.fontSize = `${fs}px`;
    while ((box.scrollWidth > box.clientWidth + 2 || box.scrollHeight > box.clientHeight + 2) && fs > 12) { fs -= 1; box.style.fontSize = `${fs}px`; }
  }
  updateShiurim(AD || HID.shiurim ? '' : shInner);
  // לוח המניינים (חול): די אותיות ווערן אזוי גרויס אז זיי פילן אויס די מסגרת
  for (const box of document.querySelectorAll('#dyn .mny')) fitBoard(box);
  for (const box of document.querySelectorAll('#dyn .shab')) {
    fitBoard(box, '.sh-r > span, .sh-r > b', 1);
    // א לאנגער נאמען: נאר ער ווערט קלענער, אז די שעה זאל נישט ווערן געדריקט
    for (const sp of box.querySelectorAll('.sh-r > span')) {
      let fs = parseFloat(sp.style.fontSize || getComputedStyle(sp).fontSize);
      while (sp.scrollWidth > sp.clientWidth + 1 && fs > 12) { fs -= 1; sp.style.fontSize = `${fs}px`; }
    }
  }
  // .fit: גרויס ווי מעגליך, אבער אין איין שורה אין דער מסגרת
  for (const el of document.querySelectorAll('#dyn .fit')) {
    let fs = 40; el.style.fontSize = `${fs}px`;
    while (el.scrollWidth > el.clientWidth + 1 && fs > 14) { fs -= 1; el.style.fontSize = `${fs}px`; }
  }
  $('#dynb').innerHTML = bot;
  updateOverlays();
}
let shLast = null; let adLast = null; let ovLast = null; let thmLast = null;
// ---------- תמונות / טעקסטן / דפים אויפן מסך (פון "תצוגת והגדרות המסך") ----------
const esc2 = (x) => h(x).replace(/\n/g, '<br>');
function itemHtml(it) {
  if (it.type === 'media') {
    const u = adUrl(it.item); const fit = it.fit === 'cover' ? 'cover' : 'contain';
    return it.item.kind === 'video' ? `<video src="${h(u)}" autoplay muted loop playsinline style="object-fit:${fit}"></video>` : `<img src="${h(u)}" alt="" style="object-fit:${fit}${it.clear ? ';background:transparent;border-radius:0' : ''}">`;
  }
  if (it.type === 'system') return `<div class="ovs" data-sys="${h(it.sys || 'weekday')}"></div>`;
  return `<div class="ovt" style="font-size:${Number(it.size) || 48}px;color:${h(it.color || '#0d2350')};background:${it.clear ? 'transparent' : h(it.bg || 'transparent')};text-shadow:${it.clear ? '0 2px 6px rgba(0,0,0,.45)' : 'none'};font-weight:${it.bold === false ? 500 : 800}">${esc2(it.text)}</div>`;
}
// א בלאט פון "הדפסת זמני התפילה" (ימות החול / שבת) — מתעדכן לבד כל וואך
let pcssOn = false;
function fillSystem(root) {
  const boxes = root.querySelectorAll('.ovs');
  if (!boxes.length) return;
  if (!pcssOn) { const st = document.createElement('style'); st.textContent = printCss('Frank Ruhl Libre'); document.head.appendChild(st); pcssOn = true; }
  const iso0 = (() => { const d = nowD(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const n0 = nOf(iso0); let f = n0; if (dowOf(n0) === 6) f = n0 - 1; else while (dowOf(f) !== 5) f += 1;
  const ps = dayOf(f + 1)?.parsha || '';
  boxes.forEach((b) => {
    const pg = b.dataset.sys === 'shabbos' ? shabbosPage(DATA, f, `זמני שבת פרשת ${ps}`, LOC) : weekdayPage(DATA, f - 5, f, ps, LOC);
    b.innerHTML = `<div class="ovs-in">${pg}</div>`;
    const inn = b.firstChild; const k = Math.min(b.clientWidth / 816, b.clientHeight / 1056) || 0.5;
    inn.style.transform = `scale(${k})`; inn.style.width = '816px'; inn.style.height = '1056px';
    fitPages(inn);
  });
}
const SLOT = { main: '#dyn .pos-main', next: '#dyn .next', side: '#dyn .pos-side', simchos: '#dyn .mzl', zmanim: '#dyn .zm:not(.zm-c)', mitzva: '#dyn .lrn-m:not(.lrn-d)', daf: '#dyn .lrn-d', shiurim: '#shl .lrn-s' };
function updateOverlays() {
  const L = $('#ovl'); if (!L) return;
  const list = [];
  for (const [p, it] of Object.entries(CUR)) {
    if (p === 'right' || p === 'notice') continue;
    if (p === 'free') it.forEach((x) => list.push([p, x])); else list.push([p, it]);
  }
  const key = list.map(([p, x]) => `${p}:${x.id}:${x.lib || x.sys || ''}:${x.text || ''}:${x.size || ''}:${x.color || ''}:${x.bg || ''}:${x.fit || ''}:${x.frame}:${JSON.stringify(x.box || {})}`).join('|');
  if (key !== ovLast) {
    ovLast = key;
    L.innerHTML = list.map(([p, x]) => `<div class="ovi${x.frame !== false ? ' frame ovf' : ''}${x.clear ? ' clr' : ''}" data-p="${p}">${itemHtml(x)}</div>`).join('');
    // פלאץ פאר די בלעטער (נאכן אריינשטעלן)
    requestAnimationFrame(() => { place(); fillSystem(L); });
  }
  place();
  function place() {
    const R = L.getBoundingClientRect(); const k = R.width / (L.offsetWidth || 1920) || 1;
    document.querySelectorAll('.ov-covered').forEach((e) => e.classList.remove('ov-covered'));
    [...L.children].forEach((el, i) => {
      const [p, x] = list[i] || [];
      if (!p) return;
      let r = null;
      if (p === 'full') r = { x: 0, y: 0, w: 1920, h: 1080 };
      else if (p === 'free') r = { x: Number(x.box?.x) || 660, y: Number(x.box?.y) || 300, w: Number(x.box?.w) || 600, h: Number(x.box?.h) || 400 };
      else {
        const t = document.querySelector(SLOT[p]);
        if (t) { const b = t.getBoundingClientRect(); r = { x: (b.left - R.left) / k, y: (b.top - R.top) / k, w: b.width / k, h: b.height / k }; t.classList.add('ov-covered'); }
      }
      if (!r) { el.style.display = 'none'; return; }
      Object.assign(el.style, { display: '', left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    });
  }
}
function updateShiurim(inner) {
  const L = $('#shl'); if (!L) return;
  if (inner === shLast) return; shLast = inner;
  if (!inner) { L.innerHTML = ''; return; }
  L.innerHTML = `<div class="frame lrn-s"><div class="ttl">${h(SCR.texts.tShiurim)}</div><div class="shv"><div class="shin">${inner}</div></div></div>`;
  const v = L.querySelector('.shv'); const inn = L.querySelector('.shin');
  // גרויס ווי מעגליך: די לענגסטע שורה פילט אויס די ברייט
  const rows = [...inn.querySelectorAll('.shiur > div')];
  let fs = 30; const setFs = () => rows.forEach((r) => { r.style.fontSize = `${fs}px`; });
  setFs();
  while (fs > 16 && rows.some((r) => r.scrollWidth > r.clientWidth + 1)) { fs -= 1; setFs(); }
  // ווען עס גייט נישט אריין: קרייז ארויף
  if (inn.scrollHeight > v.clientHeight + 2) {
    const hgt = inn.scrollHeight;
    inn.innerHTML += `<div class="shgap"></div>${inner}`;
    inn.querySelectorAll('.shiur > div').forEach((r) => { r.style.fontSize = `${fs}px`; });
    const step = hgt + 30;
    inn.style.setProperty('--sh', `${step}px`);
    inn.style.animation = `shscroll ${Math.round(step / Math.max(4, Number(SCR.shiurSpeed) || 18))}s linear infinite`;
  }
}
const boardCache = new Map();
function fitBoard(box, sel = '.grp h3, .times span, .times.rbt i', max = 1.6) {
  const els = [...box.querySelectorAll(sel)];
  const key = `${box.className}|${box.textContent}`;
  const gaps = box.querySelectorAll('.grp');
  // די אותיות און די אפשטאנדן צווישן די גרופעס — אלעמאל צוזאמען (אויך ווען עס קומט פונעם cache),
  // אנדערש זעט מען יעדע מינוט אויף א סעקונדע אנדערע אפשטאנדן ("עס שפרינגט")
  const apply = (k) => {
    els.forEach((e) => { e.style.fontSize = `${(Number(e.dataset.b) * k).toFixed(1)}px`; });
    gaps.forEach((g) => { g.style.marginTop = `${Math.round(8 * k)}px`; });
  };
  els.forEach((e) => { if (!e.dataset.b) e.dataset.b = parseFloat(getComputedStyle(e).fontSize); });
  if (boardCache.has(key)) { apply(boardCache.get(key)); return; }
  let best = 0.6;
  for (let k = max; k >= 0.5; k -= 0.04) {
    apply(k);
    const br = box.getBoundingClientRect(); const sc = br.height / box.offsetHeight || 1;
    const bottom = Math.max(...[...box.children].map((c) => c.getBoundingClientRect().bottom));
    const tooWide = els.some((e) => e.closest('.times') && e.closest('.times').scrollWidth > e.closest('.times').clientWidth + 1);
    if (bottom <= br.bottom - 16 * sc && !tooWide) { best = k; break; }
  }
  apply(best); boardCache.set(key, best); if (boardCache.size > 50) boardCache.clear();
}
// די מודעה ווערט נישט איבערגעצייכנט יעדע סעקונדע (א ווידעא וואלט זיך אנגעהויבן פון אנפאנג)
function adHtml(it) {
  if (it && !it.q) return itemHtml(it);
  const AQ = it?.q;
  if (AQ === '1') return '<div class="ad-demo"><b>מודעה</b><span dir="ltr">8.5 × 11</span><small>כאן תופיע מודעה (תמונה או וידאו)<br>היא מכסה את זמני היום והלימוד</small></div>';
  return /\.(mp4|webm|mov)(\?|$)/i.test(AQ) ? `<video src="${h(AQ)}" autoplay muted loop playsinline></video>` : `<img src="${h(AQ)}" alt="">`;
}

// שוליים פאר א מסך מיט א ראם (?safe=40 פיקסל; 0 = אן שוליים)
function applySafe() {
  const q = new URLSearchParams(location.search).get('safe');
  const SAFE = Math.max(0, Math.min(120, Number(q ?? SCR.safe ?? 36) || 0));
  document.documentElement.style.setProperty('--safe', `${SAFE}px`);
  document.documentElement.style.setProperty('--safe-s', String(1 - (2 * SAFE) / 1080));
}
applySafe();

function fit() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  $('#screen').style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit(); render();
setInterval(render, 1000);
