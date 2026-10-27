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
  shacharis: [M('5:30', '', 'הודו'), M('6:00', "חדר ב'"), M('7:00', "חדר ב'"), M('7:30', "חדר א'"), M('8:00', "חדר ב'"), M('8:30', "חדר א'"), M('9:00', "חדר ב'"), M('9:30', 'למטה'), M('10:00', "חדר ב'")],
  mincha: [M('12:40', "חדר ב'"), M('13:25', "חדר ב'"), M('15:00', "חדר ב'"), M('15:30', "חדר ב'"), M('16:00', "חדר ב'"), M('16:30', "חדר ב'"), M('17:00', "חדר ב'"), M('17:30', "חדר ב'"), M('18:00', "חדר ב'"), M('18:30', "חדר ב'"), M('19:00', "חדר ב'"), M('19:30', "חדר ב'")],
  maariv: [M(REL('shkia', 60), "חדר א'", 'בערך'), M('20:00'), M('20:30'), M('21:00'), M('21:30'), M('22:00'), M('22:30'), M('23:00')],
};
const MINCHA_LAST = REL('shkia', 25);
const SHABBOS = { shacharis: M('9:00', 'ביהמ"ד הגדול'), minchaErev: REL('shkia', 2), motzei: REL('shkia', 72, 1) };

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
];
const PER = 2;
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
  const fri = sat - 1;
  const parsha = dayOf(sat)?.parsha || dayOf(sat)?.items.find((i) => i.kind === 'hol')?.text || '';
  
  const zFri = zmanim(isoOf(fri), LOC); const zSat = zmanim(isoOf(sat), LOC);

  // [נאמען, מג"א/איינס, גר"א, הדגשה]
  const rows = [
    ['עלות השחר', z.alos], ['הנחת תפילין', z.neitz - 48], ['נץ החמה', z.neitz, null, true],
    ['סוזק"ש', z.alos + 3 * maHour, z.neitz + 3 * graHour, true],
    ['סוז"ת', z.alos + 4 * maHour, z.neitz + 4 * graHour],
    ['חצות', z.chatzos], ['שקיעת החמה', z.shkia, null, true], ['רבינו תם', z.shkia + 72],
  ];
  if (dw === 5) rows.push(['הדלקת נרות', z.candles, null, true]);
  const holAll = (day?.items || []).filter((i) => i.kind === 'hol').map((i) => i.text).join(' · ');
  const adds = additions(n, day);
  // ספירת העומר: ביז שקיעה — וואס מ'האט געציילט נעכטן ביינאכט; נאך שקיעה — וואס מ'ציילט היינט ביינאכט
  const omerDay = nowMin >= z.shkia ? dayOf(n + 1) : day;
  const omer = omerDay?.items.find((i) => i.kind === 'omer')?.text || '';
  const nextShiur = SHIURIM.find((x) => x.min >= nowMin) || null;

  // מניינים
  const isShabbos = dw === 6;
  const list = isShabbos ? null : {
    shacharis: WEEKDAY.shacharis.map((m) => ({ ...m, min: resolve(m.t, zm) })),
    mincha: WEEKDAY.mincha.map((m) => ({ ...m, min: resolve(m.t, zm) })).filter((m) => m.min <= resolve(MINCHA_LAST, zm)),
    maariv: WEEKDAY.maariv.map((m) => ({ ...m, min: resolve(m.t, zm) })).sort((a, b) => a.min - b.min),
  };
  const all = list ? [...list.shacharis.map((m) => ({ ...m, k: 'שחרית' })), ...list.mincha.map((m) => ({ ...m, k: 'מנחה' })), ...list.maariv.map((m) => ({ ...m, k: 'מעריב' }))].sort((a, b) => a.min - b.min) : [];
  const next = all.find((m) => m.min >= nowMin) || null;
  const lastMincha = resolve(MINCHA_LAST, zm);
  const cd = next ? Math.max(0, (next.min - nowMin) * 60) : 0;
  const cdText = `${String(Math.floor(cd / 3600)).padStart(2, '0')}:${String(Math.floor((cd % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(cd % 60)).padStart(2, '0')}`;
  const tm = (min) => hhmm(min);
  const timesHtml = (arr) => arr.map((m) => `<span class="${m.min < nowMin ? 'past' : ''}${next && m === next ? ' nx' : ''}">${tm(m.min)}${m.note === 'בערך' ? '<small style="font-size:20px"> בערך</small>' : ''}</span>`).join('');
  const mark = (arr) => arr.map((m) => (next && m.min === next.min && m.k === next.k ? next : m));

  const hh = now.getHours() % 12 || 12; const ap = now.getHours() < 12 ? 'AM' : 'PM';
  const heDate = `${hebrewNumber(x.d)} ${MONTH[x.m] || x.m} ${hebrewNumber(x.y % 1000)}`;
  const mz = mitzvaYomis(iso); const daf = dafYomi(iso);
  const pages = Math.ceil(MAZEL.length / PER);
  const mzIx = Math.floor(Date.now() / 15000) % pages;
  const mzList = MAZEL.slice(mzIx * PER, mzIx * PER + PER);

  $('#screen').innerHTML = `<div class="safe">
    ${SAMPLE ? '<div class="sample">דוגמה לעיצוב — המניינים מהתוכנה הישנה</div>' : ''}
    <div class="top">
      <div class="day">${h(YDAY[dw])}${parsha ? `<small>פרשת ${h(parsha)}</small>` : ''}${holAll ? `<small class="sp">${h(holAll)}</small>` : ''}</div>
      <div class="logo"><img src="img/logo.png" alt=""><b>קהל אונגוואר</b><i>בנשיאות כ"ק מרן אדמו"ר שליט"א</i></div>
      <div class="clock">${hh}:${String(now.getMinutes()).padStart(2, '0')}<span>${String(now.getSeconds()).padStart(2, '0')} ${ap}</span></div>
    </div>

    <div class="frame mny">
      <div class="ttl">זמני התפילות</div>
      ${list ? `
      <div class="grp"><h3>שחרית <small>(הודו +10 דק')</small></h3><div class="times">${timesHtml(mark(list.shacharis.map((m) => ({ ...m, k: 'שחרית' }))))}</div></div>
      <div class="grp"><h3>מנחה</h3><div class="times">${timesHtml(mark(list.mincha.map((m) => ({ ...m, k: 'מנחה' }))))}</div></div>
      <div class="grp"><h3>מעריב</h3><div class="times">${timesHtml(mark(list.maariv.map((m) => ({ ...m, k: 'מעריב' }))))}</div></div>` : '<div class="grp"><h3>שבת קודש</h3></div>'}
    </div>

    <div class="frame next">
      <div class="row1"><div class="lbl">המנין הבא</div>${next ? `<div class="cd">${cdText}</div>` : ''}</div>
      ${next ? `<div class="big"><span class="name">${h(next.k)}</span><span class="time">${tm(next.min)}</span></div>
      <div class="room">${next.room ? h(next.room) : '&nbsp;'}</div>` : '<div class="big"><span class="name">לילה טוב</span></div>'}
    </div>

    <div class="last">מנחה מנין אחרון: <b>${tm(lastMincha)}</b></div>

    ${AD ? `<div class="ad">${AD === '1' ? '<div class="ad-demo"><b>מודעה</b><span dir="ltr">8.5 × 11</span><small>כאן תופיע מודעה (קמפיין וכו\')<br>היא מכסה את זמני השבת והשמחות</small></div>' : `<img src="${h(AD)}" alt="">`}</div>` : `
    <div class="frame shab">
      <div class="ttl">זמני שבת קודש${parsha ? ` · פרשת ${h(parsha)}` : ''}</div>
      <table>
        <tr class="hl"><td>הדלקת נרות</td><td>${tm(zFri.candles)}</td></tr>
        <tr><td>מנחה ערב שבת</td><td>${tm(resolve(SHABBOS.minchaErev, zFri))}</td></tr>
        <tr><td>שחרית</td><td>${h(SHABBOS.shacharis.t)}</td></tr>
        <tr><td>סוזק"ש <small>מג"א · גר"א</small></td><td>${tm(zSat.alos + 3 * ((zSat.tzeis - zSat.alos) / 12))} · ${tm(zSat.neitz + 3 * ((zSat.shkia - zSat.neitz) / 12))}</td></tr>
        <tr><td>שקיעת החמה</td><td>${tm(zSat.shkia)}</td></tr>
        <tr class="hl"><td>מוצאי שבת קודש</td><td>${tm(zSat.motzei)}</td></tr>
        ${Math.round(zSat.shkia + 72) !== Math.round(zSat.motzei) ? `<tr><td>רבינו תם</td><td>${tm(zSat.shkia + 72)}</td></tr>` : ''}
      </table>
    </div>

    <div class="frame mzl">
      <img class="head" src="img/display/simcha-head.jpg" alt="שהשמחה במעונם">
      <div class="wk">${parsha ? `פרשת ${h(parsha)}` : ''}</div>
      <div class="list">${mzList.map(entryHtml).join('')}</div>
      ${pages > 1 ? `<div class="dots">${Array.from({ length: pages }, (_, i) => `<i class="${i === mzIx ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    </div>`}

    <div class="frame zm">
      <div class="ttl">זמני היום</div>
      <table>
        <tr class="sub"><td></td><td>מג"א</td><td>גר"א</td></tr>
        ${rows.map(([l, a, b, hl]) => `<tr${hl ? ' class="hl"' : ''}><td>${h(l)}</td>${b == null ? `<td colspan="2">${tm(a)}</td>` : `<td>${tm(a)}</td><td>${tm(b)}</td>`}</tr>`).join('')}
      </table>
      <div class="note">${adds.map(h).join(' · ')}</div>
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
        <div class="shiur"><h4>השיעורים</h4>${SHIURIM.map((x) => `<div class="${x === nextShiur ? 'nx' : ''}"><b>${h(x.t)}</b> <small>${h(x.when)}</small><span>${h(x.who)}${x.room ? ` · ${h(x.room)}` : ''}</span></div>`).join('')}</div>
      </div>
    </div>

    </div>
    <div class="bottom">
      <div class="hd">${h(heDate)}</div>
      <div class="kol">קול אונגוואר <b>605-477-4427</b></div>
      <div class="greg">${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>`;
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
