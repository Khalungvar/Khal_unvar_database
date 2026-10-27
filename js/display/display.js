// תצוגת בית הכנסת (1920×1080) — זמנים, מניינים, מצוה יומית, דף יומי, מזל טובים.
// דוגמה: די מניינים זענען איבערגענומען פון דער אלטער תוכנה (BZS); שפעטער — פון "זמני תפילות" אינעם אתר.
import { buildYear, isoOf, nOf, dowOf, hdOf, dafYomi, mitzvaYomis, omerText } from '../luach/engine.js';
import { zmanim, hhmm, LOCATIONS } from '../luach/zmanim.js';
import { MONTH } from '../luach/mitzva.js';
import { hebrewNumber } from '../hebdate.js';
import { defaults, computeWeekday, computeShabbos, computeSpecial, computeShiurim, computeHoly, chagOn, partOfDay } from '../luach/minyanim.js';

// ---------- דאטן: תצוגה מקדימה (פון "זמני תפילות" — localStorage), אנדערש ברירת מחדל ----------
const QS = new URLSearchParams(location.search);
const PREVIEW = QS.has('preview');
let DATA = defaults();
let LIVE = false; // נתונים מהגיליון (לא ברירת מחדל)
if (PREVIEW) { try { const j = JSON.parse(localStorage.getItem('tf-preview') || 'null'); if (j) DATA = { ...DATA, ...j }; } catch { /* */ } }
else {
  // דער לעצטער וואס מ'האט באקומען — אויב דער אינטערנעט פאלט
  try { const j = JSON.parse(localStorage.getItem('disp-data') || 'null'); if (j) { DATA = { ...DATA, ...j }; LIVE = true; } } catch { /* */ }
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
async function pull() {
  if (PREVIEW) return;
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Minyanim&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const rows = parseCsv(await r.text());
    const parts = rows.filter((x) => /^data#\d+$/.test(x[0] || '')).sort((a, b) => Number(a[0].split('#')[1]) - Number(b[0].split('#')[1]));
    if (!parts.length) return;
    const j = JSON.parse(parts.map((x) => x[1] || '').join(''));
    DATA = { ...defaults(), ...j }; LIVE = true;
    try { localStorage.setItem('disp-data', JSON.stringify(j)); } catch { /* */ }
    boardCache.clear(); shLast = null;
  } catch { /* בלייבט מיט דעם וואס מ'האט */ }
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
pull(); setInterval(pull, 5 * 60 * 1000);
pullSimchos(); setInterval(pullSimchos, 5 * 60 * 1000);
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
let mzCache = { key: '', pages: [[0]] };
function mazelPages() {
  MAZEL = mazelNow();
  if (!MAZEL.length) return [[]];
  const key = `${MAZEL.map((x) => x.id || x.for).join(',')}|${document.fonts?.status}|${Math.floor(Date.now() / 60000)}`;
  if (mzCache.key === key) return mzCache.pages;
  let m = document.getElementById('mzmeas');
  if (!m) { m = document.createElement('div'); m.id = 'mzmeas'; m.className = 'frame mzl'; m.style.cssText = 'visibility:hidden;position:fixed;left:0;top:0;z-index:-1;pointer-events:none;direction:rtl'; document.body.appendChild(m); }
  m.innerHTML = `<img class="head" src="img/display/simcha-head.jpg" alt=""><div class="wk">x</div><div class="list">${MAZEL.map(entryHtml).join('')}</div>`;
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
const AD = new URLSearchParams(location.search).get('ad');

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

function render() {
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
    return computeSpecial(DATA, k, LOC).map((bk) => ({ title: bk.title, type: bk.type, rows: bk.rows.filter((r) => r.screen && (r.disp?.place || (bk.type === 'chag' ? 'shab' : 'weekday')) === place) }))
      .filter((bk) => bk.rows.length).map((bk) => ({ ...bk, rows: bk.rows.map((r) => ({ ...r, mins: r.mins.map((m) => m + off) })) }));
  }
  function weekdayBoard(k, off) {
    const w = computeWeekday(DATA, k, LOC);
    const notes = { shacharis: w.shacharisNote, mincha: w.minchaNote, maariv: w.maarivNote };
    // מנחה/מעריב פון מנין כ"ק — באזונדער, פאר דער שורה פון מעריב
    const groups = ['shacharis', 'mincha', 'maariv'].map((g) => ({ h: GN[g], sub: notes[g] ? `(${notes[g]})` : '',
      items: w[g].filter((m) => g === 'shacharis' || !m.rebbe).map((m) => ({ ...m, k: GN[g], min: m.min + off })) }));
    const rbM = w.mincha.find((m) => m.rebbe); const rbA = w.maariv.find((m) => m.rebbe);
    if (rbM || rbA) {
      groups.splice(2, 0, { h: 'מנחה מעריב מנין כ"ק אדמו"ר שליט"א', rebbe: true, items: [
        ...(rbM ? [{ ...rbM, k: 'מנחה', lbl: 'מנחה', min: rbM.min + off }] : []),
        ...(rbA ? [{ ...rbA, k: 'מעריב', lbl: 'מעריב <small>(בערך)</small>', min: rbA.min + off }] : [])] });
    }
    for (const bk of specials(k, off, 'weekday')) {
      for (const r of bk.rows) groups.push({ h: r.label, sub: r.note ? `(${r.note})` : '', special: true, items: r.mins.map((m) => ({ min: m, k: r.label, room: '' })) });
    }
    return { holy: false, last: w.last == null ? null : w.last + off, groups };
  }
  // שבת / יו"ט: שורות פאר די גרויסע קעסטל. eve = ערב (פרייטאג / ערב יו"ט), d = דער טאג
  function holyRows(eve) {
    const oe = (eve - n) * 1440; const od = (eve + 1 - n) * 1440;
    return computeHoly(DATA, eve, LOC).filter((r) => r.screen !== false && r.place === 'shab')
      .map((r) => { const off = r.day ? od : oe; return { label: r.label, kind: r.kind, note: r.note, min: r.min == null ? null : r.min + off, more: (r.more || []).map((m) => m + off) }; });
  }
  function holyBoard(eve) {
    const rows = holyRows(eve);
    return { holy: true, rows, groups: [{ items: rows.filter((r) => r.kind === 'tefila' && r.min != null).map((r) => ({ min: r.min, k: r.label, room: '' })) }] };
  }
  const hasFuture = (bd) => bd.groups.some((g) => g.items.some((m) => m.min >= nowMin));
  // שבת/יו"ט: פון ערב (נאך דער לעצטער שחרית) ביז נאך מעריב מוצאי — טוישן זיך די פלעצער:
  // די שבת-קעסטל ווערט גרויס אויפן ארט פון זמני התפילות, און זמני התפילות (וואכנטאג) ווערט קליין אויפן ארט פון שבת
  let hd = null;
  if (holy(n)) {
    hd = n;
    if (!hasFuture(holyBoard(n - 1))) hd = holy(n + 1) ? n + 1 : null;
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
  const all = (swap ? hb : board).groups.flatMap((g) => g.items).sort((x, y) => x.min - y.min);
  // דער קומענדיגער מנין — אויב נישט אויפן לוח (נאך דעם לעצטן מעריב), זוכן ווייטער: וואכנטאג / שבת / יו"ט
  const nextAny = () => {
    for (let k = n; k < n + 10; k += 1) {
      const items = holy(k) ? holyBoard(k - 1).groups.flatMap((g) => g.items) : weekdayBoard(k, (k - n) * 1440).groups.flatMap((g) => g.items);
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
  // דוגמה (?chg=before / ?chg=after): הודעה לפני א שינוי, און "חדש" נאכן שינוי
  const CHG = new URLSearchParams(location.search).get('chg');
  const isNew = (m) => CHG === 'after' && Math.round(((m.min % 1440) + 1440) % 1440) === 12 * 60 + 40;
  const timesHtml = (arr) => arr.map((m) => `<span class="${m.min < nowMin ? 'past' : ''}${m === next ? ' nx' : ''}${isNew(m) ? ' new' : ''}">${isNew(m) ? '<em>חדש</em>' : ''}${tm(((m.min % 1440) + 1440) % 1440)}${m.note === 'בערך' ? '<small style="font-size:20px"> בערך</small>' : ''}</span>`).join('');

  const mnyHtml = (bd, pos) => `<div class="frame mny ${pos}${CHG === 'before' && pos === 'pos-main' ? ' has-chg' : ''}">
      <div class="ttl">זמני התפילות ימות החול${(() => { const k0 = swap ? wk : n; let s6 = k0; while (dowOf(s6) !== 6) s6 += 1; const p6 = dayOf(s6)?.parsha; return p6 ? ` לפרשת ${h(p6)}` : ''; })()}</div>
      ${bd.groups.map((g) => (g.rebbe
        ? `<div class="grp rb"><h3>${h(g.h)}</h3><div class="times rbt">${g.items.map((m) => `<span class="${m.min < nowMin ? 'past' : ''}${m === next ? ' nx' : ''}"><i>${m.lbl}</i> ${tm(((m.min % 1440) + 1440) % 1440)}</span>`).join('')}</div></div>`
        : `<div class="grp"><h3>${h(g.h)}${g.sub ? ` <small>${h(g.sub)}</small>` : ''}</h3><div class="times">${timesHtml(g.items)}</div></div>`)).join('')}
      ${CHG === 'before' && pos === 'pos-main' ? '<div class="chg-note">⚠ <b>מיום ראשון</b> ט\' כסלו: מנחה <b>12:40</b> במקום <b>1:45</b></div>' : ''}
    </div>`;
  function shabHtml(eve, d, pos) {
    const shab = dowOf(d) === 6;
    const ytName = dayOf(d)?.items.find((i) => i.kind === 'hol' && i.yt)?.text || '';
    const ps = shab ? (dayOf(d)?.parsha || '') : '';
    // דער נאמען פונעם בלאק פון חג (פסח, שבועות, שבת חול המועד ...) — ווי אין "זמני תפילות"
    const chagTitle = [d, eve].map((k) => specials(k, 0, 'shab').find((bk) => bk.type === 'chag')?.title).find(Boolean) || '';
    // נאר מיט א שעה, לויט דער שעה (הדלקת נרות / ער"ש / שבת)
    const rows = holyRows(eve).filter((r) => r.min != null).sort((a, b) => a.min - b.min);
    const dense = rows.length > (pos === 'pos-main' ? 8 : 7) ? ' dense' : '';
    return `<div class="shab ${pos}${dense}" style="--n:${rows.length}">
      <div class="sh-t"><small class="pre">זמני התפילות</small>${h(chagTitle ? `ל${chagTitle}` : shab ? 'לשבת קודש' : `ל${ytName || 'יום טוב'}`)}<small>${ps ? `פרשת ${h(ps)}` : '&nbsp;'}</small></div>
      ${rows.map((r) => `<div class="sh-r${r.kind === 'tefila' ? ' big' : ''}${r.kind === 'tefila' && r.min != null && r.min < nowMin ? ' past' : ''}"><span>${h(r.label)}</span><b>${r.min == null ? '—' : [r.min, ...(r.more || [])].map((m) => tm(((m % 1440) + 1440) % 1440)).join(' · ')}</b></div>`).join('')}
    </div>`;
  }

  const hh = now.getHours() % 12 || 12; const ap = now.getHours() < 12 ? 'AM' : 'PM';
  const heDate = `${hebrewNumber(x.d)} ${MONTH[x.m] || x.m} ${hebrewNumber(x.y % 1000)}`;
  const mz = mitzvaYomis(iso); const daf = dafYomi(iso);
  const mzPages = mazelPages(); const pages = mzPages.length;
  const mzIx = Math.floor(Date.now() / 15000) % pages;
  const mzList = mzPages[mzIx].map((i) => MAZEL[i]);

  const html = `
    ${PREVIEW ? '<div class="sample">תצוגה מקדימה — לא נשמר</div>' : !LIVE ? '<div class="sample">דוגמה — זמני ברירת מחדל</div>' : ''}
    <div class="top">
      <div class="day">${h(dw === 6 && nowMin > z.motzei ? 'מוצאי שבת קודש' : YDAY[dw])}${parsha ? `<small>פרשת ${h(parsha)}</small>` : ''}${holAll ? `<small class="sp">${h(holAll)}</small>` : ''}</div>
      <div class="logo"><img src="img/logo.png" alt=""><b>קהל אונגוואר</b><i>בנשיאות כ"ק מרן אדמו"ר שליט"א</i></div>
      <div class="clock">${hh}:${String(now.getMinutes()).padStart(2, '0')}<span>${String(now.getSeconds()).padStart(2, '0')} ${ap}</span></div>
    </div>

    ${swap ? shabHtml(hd - 1, hd, 'pos-main') : mnyHtml(board, 'pos-main')}

    <div class="frame next">
      <div class="row1"><div class="lbl">המנין הבא</div>${next ? `<div class="cd">${cdText}</div>` : ''}</div>
      ${next ? `<div class="big${next.k.length > 6 ? ' long' : ''}"><span class="name">${h(next.k)}</span><span class="time">${tm(((next.min % 1440) + 1440) % 1440)}</span></div>
      <div class="room">${next.room ? h(next.room) : '&nbsp;'}</div>` : '<div class="big"><span class="name">לילה טוב</span></div>'}
    </div>

    ${false ? ''
      : ''}

    ${AD ? `
    <div class="frame zm zm-c pos-side">
      <div class="ttl">זמני היום</div>
      <table>
        ${rows.map(([l, a, b], i) => `<tr${i === nxz ? ' class="nx"' : ''}><td>${h(l)}</td><td>${b == null ? tm(a) : pair(a, b)}</td></tr>`).join('')}
      </table>
      <div class="note">${adds.map((a, i) => (i ? `<span class="chg">${h(a)}</span>` : h(a))).join(' · ')}</div>
      ${omer ? `<div class="omer">${h(omer)}</div>` : ''}
      <div class="lc"><div><h4>מצוה יומית</h4><p>מצוה ${h(hebrewNumber(mz.n))}</p><small>${h(mz.text)}</small></div><div><h4>דף יומי</h4><p>${h(daf.text)}</p></div></div>
    </div>` : swap ? mnyHtml(board, 'pos-side') : shabHtml(nextEve, nextEve + 1, 'pos-side')}

    <div class="frame mzl">
      <img class="head" src="img/display/simcha-head.jpg" alt="שהשמחה במעונם">
      <div class="wk">${parsha ? `פרשת ${h(parsha)}` : ''}</div>
      <div class="list">${mzList.map(entryHtml).join('')}</div>
      ${pages > 1 ? `<div class="dots">${Array.from({ length: pages }, (_, i) => `<i class="${i === mzIx ? 'on' : ''}"></i>`).join('')}</div><div class="pg">${mzIx + 1} מתוך ${pages}</div>` : ''}
    </div>

    ${AD ? '' : `
    <div class="frame zm zx${(dw === 5 ? 1 : 0) + (omer ? 1 : 0)}">
      <div class="ttl">זמני היום</div>
      <table>
        ${rows.map(([l, a, b], i) => `<tr${i === nxz ? ' class="nx"' : ''}><td>${h(l)}</td><td>${b == null ? tm(a) : pair(a, b)}</td></tr>`).join('')}
      </table>
      <div class="note">${adds.map((a, i) => (i ? `<span class="chg">${h(a)}</span>` : h(a))).join(' · ')}</div>
      ${omer ? `<div class="omer">${h(omer)}</div>` : ''}
    </div>

    <div class="frame lrn-m">
      <div class="l1"><span>מצוה יומית:</span> מצוה ${h(hebrewNumber(mz.n))}</div>
      <div class="l2 fit">${h(mz.text)}</div>
    </div>
    <div class="frame lrn-m lrn-d">
      <div class="l1"><span>דף היומי</span></div>
      <div class="l2 fit">${h(daf.text)}</div>
    </div>`}
<!--BOT-->
    <div class="bottom">
      <div class="hd">${h(heDate)}</div>
      <div class="kol">קול אונגוואר <b>605-477-4427</b></div>
      <div class="greg">${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>`;
  // שיעורי תורה: אין אן אייגענעם שיכט (נישט איבערגעצייכנט יעדע סעקונדע) — ווען עס גייט נישט אריין, פארט עס פאמעלעך ארויף אין א קרייז
  const shDaf = SHI.filter((x) => x.type === 'daf'); const shOth = SHI.filter((x) => x.type !== 'daf');
  const shRow = (x) => `<div class="ln">${shLine(x).replace(/^<div[^>]*>|<\/div>$/g, '')}</div>`;
  const shInner = `${shDaf.length ? `<div class="shiur sh-daf"><h4>שיעורי דף היומי בבית מדרשינו:</h4>${shDaf.map(shRow).join('')}</div>` : ''}${shOth.length ? `<div class="shiur sh-oth"><h4>שיעורים הנלמדים בביהמ"ד:</h4>${shOth.map(shRow).join('')}</div>` : ''}`;
  const [main, bot] = html.split('<!--BOT-->');
  if (!$('#dyn')) {
    $('#screen').innerHTML = '<div class="safe"><div id="dyn"></div><div id="shl"></div><div id="adlayer"></div></div><div id="dynb"></div>';
    if (AD) $('#adlayer').innerHTML = `<div class="ad">${adHtml()}</div>`;
  }
  $('#dyn').innerHTML = main;
  updateShiurim(AD ? '' : shInner);
  // לוח המניינים (חול): די אותיות ווערן אזוי גרויס אז זיי פילן אויס די מסגרת
  for (const box of document.querySelectorAll('#dyn .mny')) fitBoard(box);
  for (const box of document.querySelectorAll('#dyn .shab')) fitBoard(box, '.sh-r span, .sh-r b', 1);
  // .fit: גרויס ווי מעגליך, אבער אין איין שורה אין דער מסגרת
  for (const el of document.querySelectorAll('#dyn .fit')) {
    let fs = 40; el.style.fontSize = `${fs}px`;
    while (el.scrollWidth > el.clientWidth + 1 && fs > 14) { fs -= 1; el.style.fontSize = `${fs}px`; }
  }
  $('#dynb').innerHTML = bot;
}
let shLast = null;
function updateShiurim(inner) {
  const L = $('#shl'); if (!L) return;
  if (inner === shLast) return; shLast = inner;
  if (!inner) { L.innerHTML = ''; return; }
  L.innerHTML = `<div class="frame lrn-s"><div class="ttl">שיעורי תורה</div><div class="shv"><div class="shin">${inner}</div></div></div>`;
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
    inn.style.animation = `shscroll ${Math.round(step / 18)}s linear infinite`;
  }
}
const boardCache = new Map();
function fitBoard(box, sel = '.grp h3, .times span, .times.rbt i', max = 1.6) {
  const els = [...box.querySelectorAll(sel)];
  const key = `${box.className}|${box.textContent}`;
  const apply = (k) => els.forEach((e) => { e.style.fontSize = `${(Number(e.dataset.b) * k).toFixed(1)}px`; });
  els.forEach((e) => { if (!e.dataset.b) e.dataset.b = parseFloat(getComputedStyle(e).fontSize); });
  const gaps = box.querySelectorAll('.grp');
  if (boardCache.has(key)) { apply(boardCache.get(key)); return; }
  let best = 0.6;
  for (let k = max; k >= 0.5; k -= 0.04) {
    apply(k); gaps.forEach((g) => { g.style.marginTop = `${Math.round(8 * k)}px`; });
    const br = box.getBoundingClientRect(); const sc = br.height / box.offsetHeight || 1;
    const bottom = Math.max(...[...box.children].map((c) => c.getBoundingClientRect().bottom));
    const tooWide = els.some((e) => e.closest('.times') && e.closest('.times').scrollWidth > e.closest('.times').clientWidth + 1);
    if (bottom <= br.bottom - 16 * sc && !tooWide) { best = k; break; }
  }
  apply(best); boardCache.set(key, best); if (boardCache.size > 50) boardCache.clear();
}
// די מודעה ווערט נישט איבערגעצייכנט יעדע סעקונדע (א ווידעא וואלט זיך אנגעהויבן פון אנפאנג)
function adHtml() {
  if (AD === '1') return '<div class="ad-demo"><b>מודעה</b><span dir="ltr">8.5 × 11</span><small>כאן תופיע מודעה (תמונה או וידאו)<br>היא מכסה את זמני היום והלימוד</small></div>';
  return /\.(mp4|webm|mov)(\?|$)/i.test(AD) ? `<video src="${h(AD)}" autoplay muted loop playsinline></video>` : `<img src="${h(AD)}" alt="">`;
}

// שוליים פאר א מסך מיט א ראם (?safe=40 פיקסל; 0 = אן שוליים)
const SAFE = Math.max(0, Math.min(120, Number(new URLSearchParams(location.search).get('safe') ?? 36) || 0));
document.documentElement.style.setProperty('--safe', `${SAFE}px`);
document.documentElement.style.setProperty('--safe-s', String(1 - (2 * SAFE) / 1080));

function fit() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  $('#screen').style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit(); render();
setInterval(render, 1000);
