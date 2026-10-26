// פרשת השבוע — לויט חוץ לארץ (צוויי טעג יום טוב).
// א אייגענער חשבון: די שבתים פון א יאר, אן די יום-טוב'דיגע שבתים, און די "אנקערס":
//   שבת פאר פסח = צו (א פשוט'ע יאר) · שבת נחמו (נאך ט' באב) = ואתחנן · שבת פאר ראש השנה = נצבים (מיט/אן וילך).
// געפרואווט קעגן Hebcal (חו"ל) פאר די יארן תש"ע–תת"ל: גלייך (אחוץ ווען דער בראוזער'ס לוח האט א טעות).
// צווישן די אנקערס ווערן די פרשיות צוזאמגעשטעלט (ויקהל-פקודי, תזריע-מצורע א.א.וו.) לויט ווי פיל שבתים ס'זענען דא.
import { toHebrew, fromHebrew, isLeapYear } from './hebdate.js';
import { sedra, PARSHIYOS } from './luach/engine.js';

// [ענגליש, אידיש/לשון קודש]
const P = [
  ['Bereshit', 'בראשית'], ['Noach', 'נח'], ['Lech-Lecha', 'לך לך'], ['Vayera', 'וירא'], ['Chayei Sara', 'חיי שרה'],
  ['Toldot', 'תולדות'], ['Vayetzei', 'ויצא'], ['Vayishlach', 'וישלח'], ['Vayeshev', 'וישב'], ['Miketz', 'מקץ'],
  ['Vayigash', 'ויגש'], ['Vayechi', 'ויחי'], ['Shemot', 'שמות'], ['Vaera', 'וארא'], ['Bo', 'בא'],
  ['Beshalach', 'בשלח'], ['Yitro', 'יתרו'], ['Mishpatim', 'משפטים'], ['Terumah', 'תרומה'], ['Tetzaveh', 'תצוה'],
  ['Ki Tisa', 'כי תשא'], ['Vayakhel', 'ויקהל'], ['Pekudei', 'פקודי'], ['Vayikra', 'ויקרא'], ['Tzav', 'צו'],
  ['Shmini', 'שמיני'], ['Tazria', 'תזריע'], ['Metzora', 'מצורע'], ['Achrei Mot', 'אחרי'], ['Kedoshim', 'קדושים'],
  ['Emor', 'אמור'], ['Behar', 'בהר'], ['Bechukotai', 'בחוקותי'], ['Bamidbar', 'במדבר'], ['Nasso', 'נשא'],
  ["Beha'alotcha", 'בהעלותך'], ["Sh'lach", 'שלח'], ['Korach', 'קרח'], ['Chukat', 'חוקת'], ['Balak', 'בלק'],
  ['Pinchas', 'פנחס'], ['Matot', 'מטות'], ['Masei', 'מסעי'], ['Devarim', 'דברים'], ['Vaetchanan', 'ואתחנן'],
  ['Eikev', 'עקב'], ["Re'eh", 'ראה'], ['Shoftim', 'שופטים'], ['Ki Teitzei', 'כי תצא'], ['Ki Tavo', 'כי תבוא'],
  ['Nitzavim', 'נצבים'], ['Vayeilech', 'וילך'], ["Ha'azinu", 'האזינו'],
];
const IX = Object.fromEntries(P.map(([en], i) => [en, i]));
// קורצע נעמען פאר צוזאמענגעשטעלטע (ווי אינעם גליון)
const SHORT = { 'Achrei Mot Kedoshim': 'אחרי-קדושים' };

const DAY = 86400000;
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
const utc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** יום טוב / חול המועד (נישט קיין פרשה). il = ארץ ישראל (איין טאג יום טוב) */
function isChag(h, il = false) {
  if (h.m === 'Tishri') return [1, 2, 10].includes(h.d) || (h.d >= 15 && h.d <= (il ? 22 : 23));
  if (h.m === 'Nisan') return h.d >= 15 && h.d <= (il ? 21 : 22);
  if (h.m === 'Sivan') return h.d === 6 || (!il && h.d === 7);
  return false;
}

/** אלע שבתים פון א העברעאישן יאר: [{ iso, h, chag }] */
function shabbatot(y, il = false) {
  const a = utc(fromHebrew(1, 'Tishri', y));
  const b = utc(fromHebrew(1, 'Tishri', y + 1));
  let t = a + ((6 - new Date(a).getUTCDay() + 7) % 7) * DAY;
  const out = [];
  for (; t < b; t += 7 * DAY) { const h = toHebrew(new Date(t)); out.push({ iso: isoOf(t), h, chag: isChag(h, il) }); }
  return out;
}

/** וויפיל שבתים (נישט יום טוב) צווישן ראש השנה און שמחת תורה */
const tishreiCount = (y, il = false) => shabbatot(y, il).filter((s) => s.h.m === 'Tishri' && s.h.d < 23 && !s.chag).length;

const cache = new Map();
/** פרשיות פון א יאר: Map(iso → { en, he, ix: [נומערן] }).
 *  יעצט פונעם לוח (js/luach/engine.js — טאבעלעס פון קביעות, חו"ל און א"י), אזוי שטימט אלעס אויפן אתר מיטן לוח.
 *  il = ארץ ישראל; אויפן אתר אלעמאל חו"ל (בארא פארק), חוץ ווען ס'שטייט אנדערש. */
export function yearParshiyot(y, il = false) {
  const ck = `${y}${il ? 'il' : ''}`;
  if (cache.has(ck)) return cache.get(ck);
  const map = new Map();
  for (const [iso, name] of sedra(y, il)) {
    const ixs = name.split('-').map((x) => PARSHIYOS.indexOf(x));
    if (ixs.some((i) => i < 0)) continue;
    const en = ixs.map((i) => P[i][0]).join(' ');
    map.set(iso, { en, he: SHORT[en] || ixs.map((i) => P[i][1]).join('-'), ix: ixs });
  }
  cache.set(ck, map);
  return map;
}

/** די פרשה פון א שבת (iso), אדער '' (יום טוב) */
// ארץ ישראל: ווען א צווייטער טאג יום טוב (חו"ל) פאלט אויף שבת, לייענט מען אין א"י שוין די קומענדיגע פרשה,
// און חו"ל כאפט זיך אן דורך צוזאמשטעלן — דער חשבון פון די אנקערס גיט דאס אליין (איין צוזאמשטעלונג ווייניגער).
export function parashaOf(iso, il = false) {
  const h = toHebrew(iso);
  if (!h) return null;
  return yearParshiyot(h.y, il).get(iso) || null;
}

/** א שבת אן א פרשה (יום טוב אין חו"ל): דער נאמען פונעם יום טוב */
export function holidayOf(iso, il = false) {
  const x = toHebrew(iso);
  if (!x) return '';
  if (il) {
    if (x.m === 'Tishri') {
      if (x.d <= 2) return 'ראש השנה';
      if (x.d === 10) return 'יום כיפור';
      if (x.d === 15) return 'סוכות';
      if (x.d >= 16 && x.d <= 21) return 'חול המועד סוכות';
      if (x.d === 22) return 'שמיני עצרת';
    }
    if (x.m === 'Nisan') {
      if (x.d === 15) return 'פסח';
      if (x.d >= 16 && x.d <= 20) return 'חול המועד פסח';
      if (x.d === 21) return 'שביעי של פסח';
    }
    if (x.m === 'Sivan' && x.d === 6) return 'שבועות';
    return '';
  }
  if (x.m === 'Tishri') {
    if (x.d <= 2) return 'ראש השנה';
    if (x.d === 10) return 'יום כיפור';
    if (x.d === 15 || x.d === 16) return 'סוכות';
    if (x.d >= 17 && x.d <= 21) return 'חול המועד סוכות';
    if (x.d === 22) return 'שמיני עצרת';
    if (x.d === 23) return 'שמחת תורה';
  }
  if (x.m === 'Nisan') {
    if (x.d === 15 || x.d === 16) return 'פסח';
    if (x.d >= 17 && x.d <= 20) return 'חול המועד פסח';
    if (x.d === 21 || x.d === 22) return 'אחרון של פסח';
  }
  if (x.m === 'Sivan' && (x.d === 6 || x.d === 7)) return 'שבועות';
  return '';
}

/** דער נאמען פון א שבת: "פרשת לך לך", "שבת ראש השנה", "שבת חול המועד סוכות" */
export function shabbatTitle(iso, il = false) {
  // שבת איז יום טוב: "שבת ראש השנה"
  const hol = holidayOf(iso, il);
  if (hol) return `שבת ${hol}`;
  // א יום טוב אין מיטן וואך (זונטאג–פרייטאג): נאר דער נאמען פונעם יום טוב, אן "פרשת".
  // נישט גערעכנט: א המשך פונעם יום טוב פון שבת פריער (למשל ב' ראש השנה / שמחת תורה אויף זונטאג)
  const t0 = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const day = (k) => new Date(t0 - k * 86400000).toISOString().slice(0, 10);
  const grp = (n) => (n === 'שמחת תורה' ? 'שמיני עצרת' : n);
  let prev = grp(holidayOf(day(7), il));
  const names = [];
  for (let k = 6; k >= 1; k -= 1) {
    const w = holidayOf(day(k), il);
    if (w && prev && grp(w) === prev) continue; // נאך דער זעלבער יום טוב פון שבת
    prev = '';
    if (w) names.push(w);
  }
  if (names.length) return `שבוע שחל בו ${names.find((n) => !n.startsWith('חול המועד')) || names[0]}`;
  const p = parashaOf(iso, il);
  return p ? `פרשת ${p.he}` : 'שבת';
}

/** דער שבת פון דער וואך פון א טאג (שבת = דער זעלבער טאג) */
export function shabbatOfWeek(iso) {
  const t = utc(iso);
  return isoOf(t + ((6 - new Date(t).getUTCDay() + 7) % 7) * DAY);
}
