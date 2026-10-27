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

// ---------- מזל טוב (שפעטער: פון "שהשמחה במעונם") ----------
const MAZEL = [
  '<b>מזל טוב</b><br>להרה"ח ר\' <b>פלוני בן פלוני</b> הי"ו<br>לרגל שמחת הבר מצוה לבנו ני"ו',
  '<b>מזל טוב</b><br>להרה"ח ר\' <b>אלמוני</b> הי"ו<br>לרגל אירוסי בתו תחי\'',
  '<b>מזל טוב</b><br>להרה"ח ר\' <b>פלוני</b> הי"ו<br>לרגל הולדת הבן',
];

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
  const hol = day?.items.find((i) => i.kind === 'hol')?.text || '';
  const zFri = zmanim(isoOf(fri), LOC); const zSat = zmanim(isoOf(sat), LOC);

  const rows = [
    ['עלות השחר', z.alos], ['הנחת תפילין', z.neitz - 48], ['נץ החמה', z.neitz, true],
    ['סוזק"ש מג"א', z.alos + 3 * maHour], ['סוזק"ש גר"א', z.neitz + 3 * graHour, true],
    ['סוז"ת מג"א', z.alos + 4 * maHour], ['סוז"ת גר"א', z.neitz + 4 * graHour],
    ['חצות', z.chatzos], ['מנחה גדולה', z.chatzos + 30], ['שקיעת החמה', z.shkia, true], ['רבינו תם', z.shkia + 72],
  ];
  if (dw === 5) rows.push(['הדלקת נרות', z.candles, true]);

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
  const mzIx = Math.floor(Date.now() / 12000) % MAZEL.length;

  $('#screen').innerHTML = `
    ${SAMPLE ? '<div class="sample">דוגמה לעיצוב — המניינים מהתוכנה הישנה</div>' : ''}
    <div class="top">
      <div class="day">${h(YDAY[dw])}<small>${h(hol || (parsha ? `פרשת ${parsha}` : ''))}</small></div>
      <div class="logo"><img src="img/logo.png" alt=""><b>קהל אונגוואר</b></div>
      <div class="clock">${hh}:${String(now.getMinutes()).padStart(2, '0')}<span>${String(now.getSeconds()).padStart(2, '0')} ${ap}</span></div>
    </div>

    <div class="frame mny">
      <div class="ttl">זמני התפילות${parsha ? ` · פרשת ${h(parsha)}` : ''}</div>
      ${list ? `
      <div class="grp"><h3>שחרית <small>(הודו +10 דק')</small></h3><div class="times">${timesHtml(mark(list.shacharis.map((m) => ({ ...m, k: 'שחרית' }))))}</div></div>
      <div class="grp"><h3>מנחה</h3><div class="times">${timesHtml(mark(list.mincha.map((m) => ({ ...m, k: 'מנחה' }))))}</div></div>
      <div class="grp"><h3>מעריב</h3><div class="times">${timesHtml(mark(list.maariv.map((m) => ({ ...m, k: 'מעריב' }))))}</div></div>` : '<div class="grp"><h3>שבת קודש</h3></div>'}
      <div class="shab">
        <h3>זמני שבת קודש</h3>
        <p>הדלקת נרות <b>${tm(zFri.candles)}</b> · מנחה ער"ש <b>${tm(resolve(SHABBOS.minchaErev, zFri))}</b></p>
        <p>שחרית <b>${h(SHABBOS.shacharis.t)}</b> · מוצאי שבת <b>${tm(zSat.motzei)}</b></p>
      </div>
    </div>

    <div class="frame next">
      <div class="lbl">המנין הבא</div>
      ${next ? `<div class="name">${h(next.k)}</div>
      <div class="time">${tm(next.min)}</div>
      ${next.room ? `<div class="room">${h(next.room)}</div>` : '<div class="room">&nbsp;</div>'}
      <div class="cd">${cdText}</div>` : '<div class="name" style="margin-top:60px">לילה טוב</div>'}
    </div>
    <div class="last">מנחה מנין אחרון: <b>${tm(lastMincha)}</b></div>

    <div class="frame mzl">
      <div class="ttl">🎉 מזל טוב 🎉</div>
      <div class="body">${MAZEL[mzIx]}</div>
      <div class="dots">${MAZEL.map((_, i) => `<i class="${i === mzIx ? 'on' : ''}"></i>`).join('')}</div>
    </div>

    <div class="frame zm">
      <div class="ttl">זמני היום</div>
      <table>${rows.map(([l, v, hl]) => `<tr${hl ? ' class="hl"' : ''}><td>${h(l)}</td><td>${tm(v)}</td></tr>`).join('')}</table>
      <div class="note">${h(prayerNote(n))}</div>
    </div>

    <div class="frame lrn">
      <div><h4>מצוה יומית</h4><p>מצוה ${h(hebrewNumber(mz.n))}<small>${h(mz.text)}</small></p></div>
      <div><h4>דף יומי</h4><p>${h(daf.text)}</p></div>
    </div>

    <div class="bottom">
      <div class="hd">${h(heDate)}</div>
      <div class="kol">קול אונגוואר<b>605-477-4427</b></div>
      <div class="greg">${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>`;
}

function fit() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  $('#screen').style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit(); render();
setInterval(render, 1000);
