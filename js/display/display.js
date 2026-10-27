// תצוגת בית הכנסת (1920×1080) — זמנים, מניינים, מצוה יומית, דף יומי, מזל טובים.
// דוגמה: די מניינים זענען איבערגענומען פון דער אלטער תוכנה (BZS); שפעטער — פון "זמני תפילות" אינעם אתר.
import { buildYear, isoOf, nOf, dowOf, hdOf, dafYomi, mitzvaYomis } from '../luach/engine.js';
import { zmanim, hhmm, LOCATIONS } from '../luach/zmanim.js';
import { MONTH } from '../luach/mitzva.js';
import { hebrewNumber } from '../hebdate.js';

const LOC = LOCATIONS.bp;
const $ = (s, r = document) => r.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const YDAY = ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שבת קודש'];
const SAMPLE = new URLSearchParams(location.search).has('sample') || true;

// ---------- מניינים (פון BZS: Sch.SchText) ----------
// t: 'HH:MM' פעסט, אדער { base: 'shkia', add: +25, round: 5 }; room; note
const M = (t, room = '', note = '') => ({ t, room, note });
const REL = (base, add, round = 5, mode = 'nearest') => ({ base, add, round, mode });
const WEEKDAY = {
  shacharis: [M('5:30', '', 'הודו'), M('6:00', "חדר ב'"), M('6:30', "חדר א'"), M('7:00', "חדר ב'"), M('7:30', "חדר א'"), M('8:00', "חדר ב'"), M('8:30', "חדר א'"), M('9:00', "חדר ב'"), M('9:30', 'למטה'), M('10:00', "חדר ב'")],
  mincha: [M('12:40', "חדר ב'"), M('13:25', "חדר ב'"), M('15:00', "חדר ב'"), M('15:30', "חדר ב'"), M('16:00', "חדר ב'"), M('16:30', "חדר ב'"), M('17:00', "חדר ב'"), M('17:30', "חדר ב'"), M('18:00', "חדר ב'"), M('18:30', "חדר ב'"), M('19:00', "חדר ב'"), M('19:30', "חדר ב'")],
  maariv: [M(REL('shkia', 60), 'למטה', 'בערך'), M('20:00'), M('20:30'), M('21:00'), M('21:30'), M('22:00'), M('22:30'), M('23:00')],
};
const MINCHA_LAST = REL('shkia', 25);
const SHABBOS = {
  minchaErev: REL('shkia', 2), // מנחה ער"ש / ערב יו"ט
  shacharis: M('9:00', 'ביהמ"ד הגדול'), shacharisYT: M('9:15', 'ביהמ"ד הגדול'),
  mincha: REL('shkia', -10, 5, 'down'), // דוגמה — נישט אין דער אלטער תוכנה
  maariv: [REL('shkia', 72, 1, 'up'), REL('shkia', 82, 1, 'up')],
  // נאך נישט באשטימט — ווערט אויסגעפולט אין ניהול המניינים
  tish: null, pirkeiAvos: null, melaveMalka: null,
};
const tOr = (t, z, tm) => (t ? tm(resolve(t, z)) : '—');

const toMin = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
function resolve(t, zm) {
  if (typeof t === 'string') return toMin(t);
  const v = zm[t.base] + t.add;
  const r = t.round || 1;
  return t.mode === 'up' ? Math.ceil(v / r) * r : t.mode === 'down' ? Math.floor(v / r) * r : Math.round(v / r) * r;
}

// ---------- מזל טוב (שפעטער: פון "שהשמחה במעונם" — אותו טקסט ווי אינעם גליון) ----------
// יעדע שמחה: שורות פון בעלי השמחה + "לרגל ..."; צוויי אויפאמאל, יעדע 15 סעקונדעס די קומענדיגע
const MAZEL = [
  { names: ['הרה"ח ר\' <b>פלוני פלונישטיין</b> הי"ו', 'הרה"ח ר\' <b>אלמוני אלמנשטיין</b> הי"ו'], for: 'לרגל אירוסי בנו-נכדו <b>יוסף</b> ני"ו עב"ג בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>פלוני כהן</b> הי"ו'], for: 'לרגל הכנסת בנו <b>משה</b> ני"ו לעול התורה והמצוות בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>פלוני לוי</b> הי"ו'], for: 'לרגל הולדת בנו בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>אלמוני גרין</b> הי"ו'], for: 'לרגל שמחת האפשערן של בנו <b>אברהם</b> ני"ו בשעטו"מ' },
  { names: ['הרה"ח ר\' <b>פלוני וויס</b> הי"ו'], for: 'לרגל הולדת בתו בשעטו"מ' },
];
// בלעטער: אזויפיל שמחות וויפיל עס גייט אריין (געמאסטן) — 2 פון 4 שורות, 3 פון 2–3 שורות א.א.וו.
let mzCache = { key: '', pages: [[0]] };
function mazelPages() {
  const key = `${MAZEL.length}|${document.fonts?.status}|${Math.floor(Date.now() / 60000)}`;
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
const entryHtml = (e) => `<div class="mz-e">${e.names.map((x) => `<div>${x}</div>`).join('')}<div class="for">${e.for}</div></div>`;

// ---------- שיעורים (פון BZS) ----------
const SHIURIM = [
  { t: '4:30', min: 270, when: 'לפנות בוקר', who: 'ר\' שלום אליעזר טווערסקי', room: "חדר ב'" },
  { t: '7:00', min: 1140, when: 'בערב', who: 'ר\' יעקב חיים אפטער', room: '' },
  { t: '8:30', min: 1230, when: 'בערב', who: 'ר\' ישעי\' שטערן', room: '' },
];

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
  const now = new Date();
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
  const omer = omerDay?.items.find((i) => i.kind === 'omer')?.text || '';
  const nextShiur = SHIURIM.find((x) => x.min >= nowMin) || null;

  // מניינים
  // ---- דער לוח פון מניינים: וואכנטאג, אדער שבת/יו"ט (פון ערב שבת/יו"ט נאך דער לעצטער שחרית) ----
  // min = מינוט פון היינט האלבנאכט (נעכטן: -1440, מארגן: +1440)
  const holy = (k) => dowOf(k) === 6 || !!dayOf(k)?.items.some((i) => i.yt);
  const zOf = (k) => zmanim(isoOf(k), LOC);
  const at = (t, k, off, extra) => ({ ...extra, min: resolve(t, zOf(k)) + off });
  function weekdayBoard(k, off) {
    const zk = zOf(k); const last = resolve(MINCHA_LAST, zk);
    return { holy: false, last: last + off, groups: [
      { h: 'שחרית', sub: "(הודו +10 דק')", items: WEEKDAY.shacharis.map((m) => at(m.t, k, off, { k: 'שחרית', room: m.room })) },
      { h: 'מנחה', items: WEEKDAY.mincha.map((m) => at(m.t, k, off, { k: 'מנחה', room: m.room })).filter((m) => m.min <= last + off) },
      { h: 'מעריב', items: WEEKDAY.maariv.map((m) => at(m.t, k, off, { k: 'מעריב', room: m.room, note: m.note })).sort((x, y) => x.min - y.min) },
    ] };
  }
  function holyBoard(eve, off) {
    const d = eve + 1; const shab = dowOf(d) === 6;
    const ytName = dayOf(d)?.items.find((i) => i.kind === 'hol' && i.yt)?.text || '';
    const dayName = shab ? (ytName ? `שבת קודש · ${ytName}` : 'שבת קודש') : (ytName || 'יום טוב');
    const groups = [
      { h: holy(eve) ? `ליל ${dayName}` : (shab ? 'ערב שבת קודש' : `ערב ${ytName || 'יום טוב'}`), items: [at(SHABBOS.minchaErev, eve, off, { k: 'מנחה', room: '' })] },
      { h: dayName, items: [at(ytName ? SHABBOS.shacharisYT.t : SHABBOS.shacharis.t, d, off + 1440, { k: 'שחרית', room: SHABBOS.shacharis.room }), at(SHABBOS.mincha, d, off + 1440, { k: 'מנחה', room: '' })] },
    ];
    if (!holy(d + 1)) groups.push({ h: shab ? 'מוצאי שבת קודש' : 'מוצאי יום טוב', items: SHABBOS.maariv.map((t) => at(t, d, off + 1440, { k: 'מעריב', room: '' })) });
    return { holy: true, title: shab ? 'זמני התפילות לשבת קודש' : `זמני התפילות ל${ytName || 'יום טוב'}`, groups };
  }
  const hasFuture = (bd) => bd.groups.some((g) => g.items.some((m) => m.min >= nowMin));
  // שבת/יו"ט: פון ערב (נאך דער לעצטער שחרית) ביז נאך מעריב מוצאי — טוישן זיך די פלעצער:
  // די שבת-קעסטל ווערט גרויס אויפן ארט פון זמני התפילות, און זמני התפילות (וואכנטאג) ווערט קליין אויפן ארט פון שבת
  let hd = null;
  if (holy(n)) {
    hd = n;
    if (!hasFuture(holyBoard(n - 1, -1440))) hd = holy(n + 1) ? n + 1 : null;
  } else if (holy(n + 1)) {
    const lastSh = Math.max(...WEEKDAY.shacharis.map((m) => resolve(m.t, zm)));
    if (nowMin > lastSh) hd = n + 1;
  }
  const swap = hd != null;
  const hb = swap ? holyBoard(hd - 1, (hd - 1 - n) * 1440) : null;
  let wk = hd != null ? hd + 1 : n; while (swap && holy(wk)) wk += 1;
  const board = swap ? weekdayBoard(wk, (wk - n) * 1440)
    : [weekdayBoard(n, 0), weekdayBoard(n + 1, 1440)].find(hasFuture) || weekdayBoard(n + 1, 1440);
  const all = (swap ? hb : board).groups.flatMap((g) => g.items).sort((x, y) => x.min - y.min);
  const next = all.find((m) => m.min >= nowMin) || null;
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
      <div class="ttl">זמני התפילות${swap ? ` <small>${h(YDAY[dowOf(wk)])}</small>` : ''}</div>
      ${bd.groups.map((g) => `<div class="grp"><h3>${h(g.h)}${g.sub ? ` <small>${h(g.sub)}</small>` : ''}</h3><div class="times">${timesHtml(g.items)}</div></div>`).join('')}
      ${CHG === 'before' && pos === 'pos-main' ? '<div class="chg-note">⚠ שימו לב: <b>מיום ראשון</b> ט\' כסלו — מנחה <b>12:40</b> במקום <b>1:45</b></div>' : ''}
    </div>`;
  function shabHtml(eve, d, pos) {
    const ze = zOf(eve); const zd = zOf(d); const shab = dowOf(d) === 6;
    const ytName = dayOf(d)?.items.find((i) => i.kind === 'hol' && i.yt)?.text || '';
    const ps = shab ? (dayOf(d)?.parsha || '') : '';
    const oe = (eve - n) * 1440; const od = (d - n) * 1440;
    const P = (m) => (m < nowMin ? ' past' : '');
    // פרקי אבות: שבתות פון נאך פסח ביז ראש השנה
    const hx = hdOf(d);
    const avos = shab && (['Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'].includes(hx.m) || (hx.m === 'Nisan' && hx.d > 22));
    return `<div class="shab ${pos}">
      <div class="sh-t">${h(shab ? 'שבת קודש' : ytName || 'יום טוב')}<small>${ps ? `פרשת ${h(ps)}` : shab && ytName ? h(ytName) : '&nbsp;'}</small></div>
      ${holy(eve) ? '' : `<div class="sh-r"><span>הדלקת נרות</span><b>${tm(ze.candles)}</b></div>`}
      <div class="sh-r big${P(resolve(SHABBOS.minchaErev, ze) + oe)}"><span>${holy(eve) ? 'מנחה' : shab ? 'מנחה ערב שבת' : 'מנחה ערב יו"ט'}</span><b>${tm(resolve(SHABBOS.minchaErev, ze))}</b></div>
      <div class="sh-r"><span>שולחן הטהור</span><b>${tOr(SHABBOS.tish, ze, tm)}</b></div>
      <div class="sh-r big${P(toMin((ytName ? SHABBOS.shacharisYT : SHABBOS.shacharis).t) + od)}"><span>שחרית</span><b>${h(ytName ? SHABBOS.shacharisYT.t : SHABBOS.shacharis.t)}</b></div>
      ${avos ? `<div class="sh-r"><span>פרקי אבות</span><b>${tOr(SHABBOS.pirkeiAvos, zd, tm)}</b></div>` : ''}
      <div class="sh-r big${P(resolve(SHABBOS.mincha, zd) + od)}"><span>מנחה ושלש סעודות</span><b>${tm(resolve(SHABBOS.mincha, zd))}</b></div>
      ${holy(d + 1) ? '' : `<div class="sh-r"><span>מלוה מלכה</span><b>${tOr(SHABBOS.melaveMalka, zd, tm)}</b></div>`}
    </div>`;
  }

  const hh = now.getHours() % 12 || 12; const ap = now.getHours() < 12 ? 'AM' : 'PM';
  const heDate = `${hebrewNumber(x.d)} ${MONTH[x.m] || x.m} ${hebrewNumber(x.y % 1000)}`;
  const mz = mitzvaYomis(iso); const daf = dafYomi(iso);
  const mzPages = mazelPages(); const pages = mzPages.length;
  const mzIx = Math.floor(Date.now() / 15000) % pages;
  const mzList = mzPages[mzIx].map((i) => MAZEL[i]);

  const html = `
    ${SAMPLE ? '<div class="sample">דוגמה לעיצוב — המניינים מהתוכנה הישנה</div>' : ''}
    <div class="top">
      <div class="day">${h(dw === 6 && nowMin > z.motzei ? 'מוצאי שבת קודש' : YDAY[dw])}${parsha ? `<small>פרשת ${h(parsha)}</small>` : ''}${holAll ? `<small class="sp">${h(holAll)}</small>` : ''}</div>
      <div class="logo"><img src="img/logo.png" alt=""><b>קהל אונגוואר</b><i>בנשיאות כ"ק מרן אדמו"ר שליט"א</i></div>
      <div class="clock">${hh}:${String(now.getMinutes()).padStart(2, '0')}<span>${String(now.getSeconds()).padStart(2, '0')} ${ap}</span></div>
    </div>

    ${swap ? shabHtml(hd - 1, hd, 'pos-main') : mnyHtml(board, 'pos-main')}

    <div class="frame next">
      <div class="row1"><div class="lbl">המנין הבא</div>${next ? `<div class="cd">${cdText}</div>` : ''}</div>
      ${next ? `<div class="big"><span class="name">${h(next.k)}</span><span class="time">${tm(((next.min % 1440) + 1440) % 1440)}</span></div>
      <div class="room">${next.room ? h(next.room) : '&nbsp;'}</div>` : '<div class="big"><span class="name">לילה טוב</span></div>'}
    </div>

    ${lastMincha != null ? `<div class="last">מנחה מנין אחרון: <b>${tm(lastMincha)}</b></div>`
      : ''}

    ${AD ? `
    <div class="frame zm zm-c pos-side">
      <div class="ttl">זמני היום</div>
      <table>
        ${rows.map(([l, a, b], i) => `<tr${i === nxz ? ' class="nx"' : ''}><td>${h(l)}</td><td>${b == null ? tm(a) : pair(a, b)}</td></tr>`).join('')}
      </table>
      <div class="note">${adds.map((a, i) => (i ? `<span class="chg">${h(a)}</span>` : h(a))).join(' · ')}</div>
      ${omer ? `<div class="omer">${nowMin >= z.shkia ? 'הלילה: ' : ''}${h(omer)}</div>` : ''}
      <div class="lc"><div><h4>מצוה יומית</h4><p>מצוה ${h(hebrewNumber(mz.n))}</p><small>${h(mz.text)}</small></div><div><h4>דף יומי</h4><p>${h(daf.text)}</p></div></div>
    </div>` : swap ? mnyHtml(board, 'pos-side') : shabHtml(fri, sat, 'pos-side')}

    <div class="frame mzl">
      <img class="head" src="img/display/simcha-head.jpg" alt="שהשמחה במעונם">
      <div class="wk">${parsha ? `פרשת ${h(parsha)}` : ''}</div>
      <div class="list">${mzList.map(entryHtml).join('')}</div>
      ${pages > 1 ? `<div class="dots">${Array.from({ length: pages }, (_, i) => `<i class="${i === mzIx ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    </div>

    ${AD ? '' : `
    <div class="frame zm">
      <div class="ttl">זמני היום</div>
      <table>
        ${rows.map(([l, a, b], i) => `<tr${i === nxz ? ' class="nx"' : ''}><td>${h(l)}</td><td>${b == null ? tm(a) : pair(a, b)}</td></tr>`).join('')}
      </table>
      <div class="note">${adds.map((a, i) => (i ? `<span class="chg">${h(a)}</span>` : h(a))).join(' · ')}</div>
      ${omer ? `<div class="omer">${nowMin >= z.shkia ? 'הלילה: ' : ''}${h(omer)}</div>` : ''}
    </div>

    <div class="frame lrn">
      <div class="mzy">
        <h4>מצוה יומית</h4>
        <div class="num">מצוה ${h(hebrewNumber(mz.n))}</div>
        <div class="txt">${h(mz.text)}</div>
        <div class="kol">שיעור יומי בקול אונגוואר<b>605-477-4427</b>אחריו 3 ואחריו 1</div>
      </div>
      <div class="side">
        <div class="daf"><h4>דף יומי</h4><p>${h(daf.text)}</p></div>
        <div class="shiur"><h4>השיעורים</h4>${SHIURIM.map((x) => (x === nextShiur
          ? `<div class="nx"><b>${h(x.t)}</b> <small>${h(x.when)}</small><span>${h(x.who)}${x.room ? ` · ${h(x.room)}` : ''}</span></div>`
          : `<div class="ln"><b>${h(x.t)}</b> ${h(x.who)}${x.room ? ` · ${h(x.room)}` : ''}</div>`)).join('')}</div>
      </div>
    </div>`}
<!--BOT-->
    <div class="bottom">
      <div class="hd">${h(heDate)}</div>
      <div class="kol">קול אונגוואר <b>605-477-4427</b></div>
      <div class="greg">${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>`;
  const [main, bot] = html.split('<!--BOT-->');
  if (!$('#dyn')) {
    $('#screen').innerHTML = '<div class="safe"><div id="dyn"></div><div id="adlayer"></div></div><div id="dynb"></div>';
    if (AD) $('#adlayer').innerHTML = `<div class="ad">${adHtml()}</div>`;
  }
  $('#dyn').innerHTML = main;
  $('#dynb').innerHTML = bot;
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
