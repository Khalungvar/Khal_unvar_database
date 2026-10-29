// "הודעות אוטומטיות": די ערטער וואס פילן זיך אליין אויס ({הדלקת נרות}, {שחרית}, {מצוה יומית} ...)
// א ריינער מאדול (אן DOM) — דער אתר ניצט אים פאר דער תצוגה מקדימה, און דער Apps Script (א "bundle") ביים שיקן.
// די זמנים ווערן גערעכנט פונקט ווי אויף דער תצוגה אין בית הכנסת (luach/minyanim.js).
import { buildYear, isoOf, nOf, dowOf, hdOf, mitzvaYomis } from './engine.js';
import { zmanim, hhmm, LOCATIONS } from './zmanim.js';
import { defaults, computeWeekday, computeHoly, chagOn, computeSpecial, daysOf } from './minyanim.js';
import { hebrewNumber, monthHe } from '../hebdate.js';

const LOC = LOCATIONS.bp;
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
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmt = (m) => (m == null || !Number.isFinite(m) ? '' : hhmm(((m % 1440) + 1440) % 1440));
const list = (arr) => arr.map((x) => fmt(x.min)).filter(Boolean).join(' · ');

/** שבת אדער יו"ט */
export const holyOn = (data, n) => dowOf(n) === 6 || chagOn(data, n);
/** דער ערב פון דער קומענדיגער שבת/יו"ט (דער טאג פאר'ן ערשטן הייליגן טאג), פון טאג n און ווייטער */
export function nextEve(data, n) {
  let k = n; while (holyOn(data, k)) k += 1; // אינמיטן שבת/יו"ט → דער קומענדיגער
  while (!holyOn(data, k + 1)) k += 1;
  return k;
}

/** די ערטער (שם → טעקסט) פאר א טאג (iso). data = די "זמני תפילות" (Minyanim) */
export function autoVars(rawData, iso) {
  const data = { ...defaults(), ...(rawData || {}) };
  const n = nOf(iso);
  const out = {};
  // ---- שבת / יו"ט (די קומענדיגע — פון דעם טאג) ----
  const eve = nextEve(data, n);
  const first = eve + 1;
  const d1 = dayOf(first);
  const yt = (d1?.items || []).find((i) => i.kind === 'hol' && i.yt)?.text || '';
  out['פרשה'] = d1?.parsha || '';
  // די פרשה פון דער שבת נאך דער קומענדיגער שבת (למשל יעצט וירא → חיי שרה)
  let s1 = eve + 1; while (dowOf(s1) !== 6) s1 += 1;
  out['פרשה הבאה'] = dayOf(s1 + 7)?.parsha || '';
  out['שבת / יום טוב'] = dowOf(first) === 6 && !yt ? `שבת${d1?.parsha ? ` פרשת ${d1.parsha}` : ''}` : (yt || 'שבת');
  for (const r of computeHoly(data, eve, LOC)) {
    if (!r.label) continue;
    if (r.min == null) { if (out[r.label] === undefined) out[r.label] = r.note || ''; continue; } // בלי שעה (למשל שולחן הטהור) — ריק
    let k = r.label; let i = 2;
    while (out[k] !== undefined && out[k] !== '') { k = `${r.label} ${i}`; i += 1; }
    out[k] = [r.min, ...(r.more || [])].map(fmt).filter(Boolean).join(' · ');
  }
  // יעדע שורה אין די שבת־הגדרות באקומט א שדה, אויך ווען זי איז נישט די וואך (סעזאן) — דאן ריק
  for (const r of (data.shabbos?.rows || [])) if (r.label && out[r.label] === undefined) out[r.label] = '';
  // ---- וואכנטאג: די מניינים פון דעם טאג (אויב שבת/יו"ט — פונעם קומענדיגן וואכנטאג) ----
  let w = n; while (holyOn(data, w)) w += 1;
  const wd = computeWeekday(data, w, LOC);
  // "בחול" — אז עס זאל זיך נישט מישן מיט "מנחה" / "שחרית" פון שבת/יו"ט
  out['שחרית בחול'] = list(wd.shacharis || []);
  out['מנחה בחול'] = list((wd.mincha || []).filter((x) => !x.rebbe));
  out['מעריב בחול'] = list((wd.maariv || []).filter((x) => !x.rebbe));
  const rb = (g) => fmt((wd[g] || []).find((x) => x.rebbe)?.min);
  out['מנחה כ"ק אדמו"ר'] = rb('mincha');
  out['מעריב כ"ק אדמו"ר'] = rb('maariv');
  // דער קומענדיגער וואך: דער ערשטער וואכנטאג נאך דער קומענדיגער שבת
  let s2 = eve + 1; while (dowOf(s2) !== 6) s2 += 1;
  let nw = s2 + 1; while (holyOn(data, nw)) nw += 1;
  const wd2 = computeWeekday(data, nw, LOC);
  out['מנחה כ"ק אדמו"ר שבוע הבא'] = fmt((wd2.mincha || []).find((x) => x.rebbe)?.min);
  // ---- סליחות: דער ערשטער טאג פון היינט ביז א וואך מיט סליחות; אנדערש ריק (און די שורה פאלט אוועק) ----
  out['סליחות'] = '';
  for (let k = n; k < n + 8; k += 1) {
    const mins = computeSpecial(data, k, LOC).flatMap((b) => b.rows).filter((r) => /סליחות/.test(r.label || '')).flatMap((r) => r.mins);
    if (mins.length) { out['סליחות'] = [...new Set(mins)].sort((a, b) => a - b).map(fmt).filter(Boolean).join(' · '); break; }
  }
  // ---- זמני היום ----
  const z = zmanim(iso, LOC);
  Object.assign(out, {
    'עלות השחר': fmt(z.alos), 'נץ החמה': fmt(z.neitz), 'סוף זמן ק"ש מג"א': fmt(z.maKS), 'סוף זמן ק"ש גר"א': fmt(z.graKS),
    'חצות': fmt(z.chatzos), 'שקיעה': fmt(z.shkia), 'צאת הכוכבים': fmt(z.tzeis),
  });
  // ---- תאריך ----
  const h = hdOf(n);
  out['יום'] = DAYS[dowOf(n)];
  out['תאריך עברי'] = `${hebrewNumber(h.d)} ${monthHe ? monthHe(h.m, h.y) : ''} ${hebrewNumber(h.y % 1000)}`.replace(/\s+/g, ' ').trim();
  const [Y, M, D] = iso.split('-').map(Number);
  out['תאריך לועזי'] = `${M}/${D}/${Y}`;
  // ---- מצוה יומית ----
  const mz = mitzvaYomis(iso);
  out['מצוה יומית'] = mz ? `מצוה ${mz.num}: ${mz.text}` : '';
  // ---- משבצת שבת ויו"ט: פונקט ווי די הילצערנע משבצת אויף דער תצוגה ----
  out['משבצת שבת ויו"ט'] = holyBox(data, eve);
  // ---- משבצת יומא דפגרא: דער קומענדיגער טאג פון א "יומא דפגרא" (חנוכה, פורים, תעניות ...) ----
  out['משבצת יומא דפגרא'] = minorBox(data, n);
  return out;
}
const timesOf = (r) => [r.min, ...(r.more || [])].filter((m) => m != null).map(fmt).filter(Boolean).join(' · ');
/** די משבצת פון שבת/יו"ט ווי אויף דער תצוגה: א כותרת + "שם: שעה" פאר יעדע שורה (נאר מיט א שעה, לויט דער שעה) */
export function holyBox(data, eve) {
  const d = eve + 1;
  const shab = dowOf(d) === 6;
  const ytName = (dayOf(d)?.items || []).find((i) => i.kind === 'hol' && i.yt)?.text || '';
  const ps = shab ? (dayOf(d)?.parsha || '') : '';
  const chagTitle = [d, eve].map((k) => computeSpecial(data, k, LOC)
    .find((bk) => bk.type === 'chag' && bk.rows.some((r) => r.screen && (r.disp?.place || 'shab') === 'shab'))?.title).find(Boolean) || '';
  const rows = computeHoly(data, eve, LOC).filter((r) => r.screen !== false && r.place === 'shab' && r.min != null)
    .map((r) => ({ ...r, abs: r.min + (r.day ? 1440 : 0) })).sort((a, b) => a.abs - b.abs);
  const title = chagTitle ? `ל${chagTitle}` : shab ? `לשבת קודש${ps ? ` פרשת ${ps}` : ''}` : `ל${ytName || 'יום טוב'}`;
  return [title, ...rows.map((r) => `${r.label}: ${timesOf(r)}`)].join('\n');
}
/** דער ערשטער טאג פון א בלאק פון "ימי דפגרא" (data.minor) פון k און ווייטער (ביז 8 טעג) → { n, block } אדער null */
export function nextMinor(data, k, span = 8) {
  for (let n = k; n < k + span; n += 1) {
    const Y = hdOf(n).y;
    for (const b of data.minor?.blocks || []) {
      for (const y of [Y, Y + 1, Y - 1]) { const ds = daysOf(b.when, y); if (ds.length && ds[0] === n) return { n, block: b }; }
    }
  }
  return null;
}
export function minorBox(data, k) {
  const m = nextMinor(data, k); if (!m) return '';
  const rows = computeSpecial(data, m.n, LOC).filter((bk) => bk.part === 'minor' || bk.title === m.block.title).flatMap((bk) => bk.rows)
    .filter((r) => r.screen && r.mins.length);
  return [m.block.title, ...rows.map((r) => `${r.label}${r.note ? ` (${r.note})` : ''}: ${r.mins.map(fmt).join(' · ')}`)].join('\n');
}

/** די נעמען פון די ערטער (פאר די קנעפלעך) — פון א טאג וואס האט אלעס */
export function varNames(data, iso) { return Object.keys(autoVars(data, iso)); }

/** אויספילן א מוסטער: {שם} → ווערט; {הודעת הגבאי} → line. א נישט באקאנטער שם בלייבט ווי ער איז. */
/** שורת הגבאי: 'טעקסט' (= שורה 1) אדער JSON '["שורה 1","שורה 2"]' → [l1, l2] */
export function lineParts(v) {
  if (Array.isArray(v)) return [String(v[0] || ''), String(v[1] || '')];
  const s = String(v || '');
  if (s.startsWith('[')) { try { const a = JSON.parse(s); if (Array.isArray(a)) return [String(a[0] || ''), String(a[1] || '')]; } catch { /* */ } }
  return [s, ''];
}
// א שורה וואו אלע ערטער זענען ריק (למשל {סליחות} רוב יאר, {פרקי אבות} ווינטער) — פאלט אוועק אינגאנצן
export function fillTemplate(text, vars, line = '') {
  const L = lineParts(line);
  return String(text || '').split('\n').map((ln) => {
    let known = 0; let filled = 0;
    const out = ln.replace(/\{([^{}]+)\}/g, (all, k) => {
      const key = k.trim();
      const v = key === 'הודעת הגבאי' || key === 'הודעת הגבאי 1' ? L[0] : key === 'הודעת הגבאי 2' ? L[1] : vars[key];
      if (v === undefined) return all;
      known += 1; if (String(v).trim()) filled += 1;
      return v;
    });
    return known && !filled ? null : out;
  }).filter((ln) => ln !== null).join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** די קומענדיגע צייט (טעקסט 'yyyy-MM-dd HH:mm', ניו יארק) פון א "מתי" נאך now ('yyyy-MM-dd HH:mm'), אדער '' */
export function nextOccurrence(sched, rawData, now) {
  const s = sched || {}; const data = { ...defaults(), ...(rawData || {}) };
  const time = /^\d{1,2}:\d{2}$/.test(s.time || '') ? s.time.padStart(5, '0') : '10:00';
  if (s.type === 'once') { const at = String(s.at || '').replace('T', ' ').slice(0, 16); return at > now ? at : ''; }
  const n0 = nOf(now.slice(0, 10));
  for (let n = n0; n < n0 + 400; n += 1) {
    let ok = false;
    if (s.type === 'weekly') ok = dowOf(n) === Number(s.dow);
    else if (s.type === 'monthly') ok = Number(isoOf(n).slice(8, 10)) === Number(s.day);
    else if (s.type === 'hmonthly') {
      // א טאג אין חודש עברי; ל' אין א חודש פון כ"ט טעג → כ"ט
      const h = hdOf(n); const want = Number(s.day) || 1;
      ok = h.d === want || (want === 30 && h.d === 29 && hdOf(n + 1).d === 1);
    } else if (s.type === 'erev') {
      const e = n + (Number(s.before) || 0); // דער ערב איז "before" טעג נאך דעם טאג פונעם שיקן
      if (!holyOn(data, e) && holyOn(data, e + 1)) {
        // די גאנצע קייט פון הייליגע טעג: שבת אן יו"ט → "ערב שבת"; מיט יו"ט → "ערב יום טוב" (די משבצת האט אלעס)
        let k = e + 1; let hasShab = false; let hasChag = false;
        while (holyOn(data, k)) { if (dowOf(k) === 6) hasShab = true; if (chagOn(data, k)) hasChag = true; k += 1; }
        ok = s.what === 'shabbos' ? hasShab && !hasChag : s.what === 'yt' ? hasChag : true;
      }
    } else if (s.type === 'erevMinor') {
      // דער לעצטער וואכנטאג פאר א טאג פון "ימי דפגרא"
      if (!holyOn(data, n)) { let k = n + 1; while (holyOn(data, k)) k += 1; ok = !!nextMinor(data, n + 1, k - n); } // דער טאג פון דפגרא קען זיין אויך אין שבת
    }
    if (!ok) continue;
    const at = `${isoOf(n)} ${time}`;
    if (at > now) return at;
  }
  return '';
}
/** א קורצע באשרייבונג פון "מתי" (לשון קודש) */
export function schedText(sched) {
  const s = sched || {}; const tm = s.time || '';
  if (s.type === 'weekly') return `כל יום ${DAYS[Number(s.dow)] || ''} ב-${tm}`;
  if (s.type === 'monthly') return `כל חודש לועזי ב-${s.day} ב-${tm}`;
  if (s.type === 'hmonthly') return `כל חודש עברי ב-${hebrewNumber(Number(s.day) || 1)} ב-${tm}`;
  if (s.type === 'erevMinor') return `ערב יומא דפגרא ב-${tm}`;
  if (s.type === 'keyword') return `כשמישהו שולח: ${(s.words || []).join(', ')}`;
  if (s.type === 'erev') {
    const w = s.what === 'shabbos' ? 'שבת' : s.what === 'yt' ? 'יום טוב' : 'שבת ויום טוב';
    const b = Number(s.before) || 0;
    return `${b ? `${b === 1 ? 'יום' : `${b} ימים`} לפני ` : ''}ערב ${w} ב-${tm}`;
  }
  if (s.type === 'once') return `פעם אחת: ${String(s.at || '').replace('T', ' ')}`;
  return '';
}
export { isoOf, nOf, dowOf };
/** שינוי חד־פעמי פאר דעם קומענדיגן מאל: { drop: [שורות], text: 'מוסטער אנשטאט', nobrand: bool } */
export function modOf(v) {
  if (v && typeof v === 'object') return { drop: v.drop || [], text: v.text || '', nobrand: !!v.nobrand };
  try { const o = JSON.parse(String(v || '') || '{}'); return { drop: Array.isArray(o.drop) ? o.drop : [], text: String(o.text || ''), nobrand: !!o.nobrand }; } catch { return { drop: [], text: '', nobrand: false }; }
}
/** דער טעקסט וואס גייט ארויס (אן דעם נאמען): מוסטער (אדער דער טעקסט אנשטאט) + שורות הגבאי − די אראפגענומענע שורות */
export function renderAuto(tpl, vars, line, mod) {
  const m = modOf(mod);
  let t = fillTemplate(m.text || tpl, vars, line);
  if (m.drop.length) t = t.split('\n').filter((l) => !m.drop.includes(l.trim())).join('\n');
  return t.trim();
}
