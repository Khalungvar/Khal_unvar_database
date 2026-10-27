// תצוגת בית הכנסת (1920×1080) — זמנים, מניינים, מצוה יומית, דף יומי, מזל טובים.
// דוגמה: די מניינים זענען איבערגענומען פון דער אלטער תוכנה (BZS); שפעטער — פון "זמני תפילות" אינעם אתר.
import { buildYear, isoOf, nOf, dowOf, hdOf, dafYomi, mitzvaYomis } from '../luach/engine.js';
import { zmanim, hhmm, LOCATIONS } from '../luach/zmanim.js';
import { MONTH } from '../luach/mitzva.js';
import { hebrewNumber } from '../hebdate.js';
import { defaults, computeWeekday, computeShabbos, computeSpecial } from '../luach/minyanim.js';

// ---------- דאטן: תצוגה מקדימה (פון "זמני תפילות" — localStorage), אנדערש ברירת מחדל ----------
const QS = new URLSearchParams(location.search);
const PREVIEW = QS.has('preview');
let DATA = defaults();
if (PREVIEW) { try { const j = JSON.parse(localStorage.getItem('tf-preview') || 'null'); if (j) DATA = { ...DATA, ...j }; } catch { /* */ } }
// א פאלשע שעה (?at=2026-12-20T15:00) — צו זען א געוויסן טאג
let OFFSET = 0;
if (QS.get('at')) { const t = new Date(QS.get('at')); if (!Number.isNaN(t.getTime())) OFFSET = t.getTime() - Date.now(); }
const nowD = () => new Date(Date.now() + OFFSET);

const LOC = LOCATIONS.bp;
const $ = (s, r = document) => r.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const YDAY = ['זונטאג', 'מאנטאג', 'דינסטאג', 'מיטוואך', 'דאנערשטאג', 'פרייטאג', 'שבת קודש'];
const SAMPLE = !PREVIEW;

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
  const omer = omerDay?.items.find((i) => i.kind === 'omer')?.text || '';
  const nextShiur = SHIURIM.find((x) => x.min >= nowMin) || null;

  // מניינים
  // ---- דער לוח פון מניינים: וואכנטאג, אדער שבת/יו"ט (פון ערב שבת/יו"ט נאך דער לעצטער שחרית) ----
  // min = מינוט פון היינט האלבנאכט (נעכטן: -1440, מארגן: +1440)
  const holy = (k) => dowOf(k) === 6 || !!dayOf(k)?.items.some((i) => i.yt);
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
    const groups = ['shacharis', 'mincha', 'maariv'].map((g) => ({ h: GN[g], sub: notes[g] ? `(${notes[g]})` : '',
      items: w[g].map((m) => ({ ...m, k: GN[g], min: m.min + off })) }));
    for (const bk of specials(k, off, 'weekday')) {
      for (const r of bk.rows) groups.push({ h: r.label, sub: r.note ? `(${r.note})` : '', special: true, items: r.mins.map((m) => ({ min: m, k: r.label, room: '' })) });
    }
    return { holy: false, last: w.last == null ? null : w.last + off, groups };
  }
  // שבת / יו"ט: שורות פאר די גרויסע קעסטל. eve = ערב (פרייטאג / ערב יו"ט), d = דער טאג
  function holyRows(eve) {
    const d = eve + 1; const oe = (eve - n) * 1440; const od = (d - n) * 1440;
    const hasChag = [eve, d].some((k) => specials(k, 0, 'shab').some((bk) => bk.type === 'chag'));
    if (dowOf(d) === 6 && !dayOf(d)?.items.some((i) => i.yt) && !hasChag) {
      return computeShabbos(DATA, eve, LOC).filter((r) => r.screen !== false).map((r) => ({ label: r.label, kind: r.kind, note: r.note, min: r.min == null ? null : r.min + (r.day === 'sat' ? od : oe) }));
    }
    const out = [];
    if (!holy(eve)) out.push({ label: 'הדלקת נרות', kind: 'zman', min: zOf(eve).candles + oe });
    // פונעם ערב: אויב דער ערב איז אליין א יו"ט (יום ב') — נאר די אוונט-זאכן (נאכן שקיעה בערך), כדי נישט צו איבערחזרן
    const eveCut = holy(eve) ? zOf(eve).shkia - 90 + oe : -Infinity;
    for (const [k, off] of [[eve, oe], [d, od]]) for (const bk of specials(k, off, 'shab')) for (const r of bk.rows) {
      if (k === eve && (r.mins[0] ?? -Infinity) < eveCut) continue;
      out.push({ label: r.label, kind: r.kind, note: r.note, min: r.mins[0] ?? null, more: r.mins.slice(1) });
    }
    return out;
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
      <div class="ttl">זמני התפילות ימות החול${(() => { const k0 = swap ? wk : n; let s6 = k0; while (dowOf(s6) !== 6) s6 += 1; const p6 = dayOf(s6)?.parsha; return p6 ? ` לפרשת ${h(p6)}` : ''; })()}</div>
      ${bd.groups.map((g) => `<div class="grp"><h3>${h(g.h)}${g.sub ? ` <small>${h(g.sub)}</small>` : ''}</h3><div class="times">${timesHtml(g.items)}</div></div>`).join('')}
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
    ${PREVIEW ? '<div class="sample">תצוגה מקדימה — לא נשמר</div>' : SAMPLE ? '<div class="sample">דוגמה — זמני ברירת מחדל</div>' : ''}
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
    </div>` : swap ? mnyHtml(board, 'pos-side') : shabHtml(nextEve, nextEve + 1, 'pos-side')}

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
