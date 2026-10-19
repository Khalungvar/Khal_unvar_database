// פרשת השבוע — לויט חוץ לארץ (צוויי טעג יום טוב).
// א אייגענער חשבון: די שבתים פון א יאר, אן די יום-טוב'דיגע שבתים, און די "אנקערס":
//   שבת פאר פסח = צו (א פשוט'ע יאר) · שבת נחמו (נאך ט' באב) = ואתחנן · שבת פאר ראש השנה = נצבים (מיט/אן וילך).
// געפרואווט קעגן Hebcal (חו"ל) פאר די יארן תש"ע–תת"ל: גלייך (אחוץ ווען דער בראוזער'ס לוח האט א טעות).
// צווישן די אנקערס ווערן די פרשיות צוזאמגעשטעלט (ויקהל-פקודי, תזריע-מצורע א.א.וו.) לויט ווי פיל שבתים ס'זענען דא.
import { toHebrew, fromHebrew, isLeapYear } from './hebdate.js';

// [ענגליש, אידיש/לשון קודש]
const P = [
  ['Bereshit', 'בראשית'], ['Noach', 'נח'], ['Lech-Lecha', 'לך לך'], ['Vayera', 'וירא'], ['Chayei Sara', 'חיי שרה'],
  ['Toldot', 'תולדות'], ['Vayetzei', 'ויצא'], ['Vayishlach', 'וישלח'], ['Vayeshev', 'וישב'], ['Miketz', 'מקץ'],
  ['Vayigash', 'ויגש'], ['Vayechi', 'ויחי'], ['Shemot', 'שמות'], ['Vaera', 'וארא'], ['Bo', 'בא'],
  ['Beshalach', 'בשלח'], ['Yitro', 'יתרו'], ['Mishpatim', 'משפטים'], ['Terumah', 'תרומה'], ['Tetzaveh', 'תצוה'],
  ['Ki Tisa', 'כי תשא'], ['Vayakhel', 'ויקהל'], ['Pekudei', 'פקודי'], ['Vayikra', 'ויקרא'], ['Tzav', 'צו'],
  ['Shmini', 'שמיני'], ['Tazria', 'תזריע'], ['Metzora', 'מצורע'], ['Achrei Mot', 'אחרי מות'], ['Kedoshim', 'קדושים'],
  ['Emor', 'אמור'], ['Behar', 'בהר'], ['Bechukotai', 'בחקתי'], ['Bamidbar', 'במדבר'], ['Nasso', 'נשא'],
  ["Beha'alotcha", 'בהעלתך'], ["Sh'lach", 'שלח'], ['Korach', 'קרח'], ['Chukat', 'חקת'], ['Balak', 'בלק'],
  ['Pinchas', 'פינחס'], ['Matot', 'מטות'], ['Masei', 'מסעי'], ['Devarim', 'דברים'], ['Vaetchanan', 'ואתחנן'],
  ['Eikev', 'עקב'], ["Re'eh", 'ראה'], ['Shoftim', 'שופטים'], ['Ki Teitzei', 'כי תצא'], ['Ki Tavo', 'כי תבוא'],
  ['Nitzavim', 'נצבים'], ['Vayeilech', 'וילך'], ["Ha'azinu", 'האזינו'],
];
const IX = Object.fromEntries(P.map(([en], i) => [en, i]));
// קורצע נעמען פאר צוזאמענגעשטעלטע (ווי אינעם גליון)
const SHORT = { 'Achrei Mot Kedoshim': 'אחרי-קדושים' };

const DAY = 86400000;
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
const utc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** יום טוב אין חוץ לארץ (נישט קיין פרשה) */
function isChag(h) {
  if (h.m === 'Tishri') return [1, 2, 10].includes(h.d) || (h.d >= 15 && h.d <= 23);
  if (h.m === 'Nisan') return h.d >= 15 && h.d <= 22;
  if (h.m === 'Sivan') return h.d === 6 || h.d === 7;
  return false;
}

/** אלע שבתים פון א העברעאישן יאר: [{ iso, h, chag }] */
function shabbatot(y) {
  const a = utc(fromHebrew(1, 'Tishri', y));
  const b = utc(fromHebrew(1, 'Tishri', y + 1));
  let t = a + ((6 - new Date(a).getUTCDay() + 7) % 7) * DAY;
  const out = [];
  for (; t < b; t += 7 * DAY) { const h = toHebrew(new Date(t)); out.push({ iso: isoOf(t), h, chag: isChag(h) }); }
  return out;
}

/** וויפיל שבתים (נישט יום טוב) צווישן ראש השנה און שמחת תורה */
const tishreiCount = (y) => shabbatot(y).filter((s) => s.h.m === 'Tishri' && s.h.d < 23 && !s.chag).length;

const cache = new Map();
/** פרשיות פון א יאר: Map(iso → { en, he, ix: [נומערן] }) */
export function yearParshiyot(y) {
  if (cache.has(y)) return cache.get(y);
  const map = new Map();
  const all = shabbatot(y);
  const leap = isLeapYear(y);
  const put = (s, ixs) => {
    const en = ixs.map((i) => P[i][0]).join(' ');
    map.set(s.iso, { en, he: SHORT[en] || ixs.map((i) => P[i][1]).join('-'), ix: ixs });
  };
  // תשרי: האזינו (און פריער וילך, ווען ס'זענען דא צוויי שבתים)
  const tish = all.filter((s) => s.h.m === 'Tishri' && s.h.d < 23 && !s.chag);
  if (tish.length === 2) { put(tish[0], [IX.Vayeilech]); put(tish[1], [IX["Ha'azinu"]]); } else if (tish.length) put(tish[0], [IX["Ha'azinu"]]);
  const main = all.filter((s) => !s.chag && !(s.h.m === 'Tishri' && s.h.d < 23));
  // וילך: אויב איבער א יאר איז נאר איין שבת אין תשרי — צוזאמען מיט נצבים היי-יאר
  const nitzVay = tishreiCount(y + 1) < 2;
  function ord(x) { const ms = ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul']; return ms.indexOf(x.m) * 100 + x.d; }
  const idxOf = (pred) => main.findIndex(pred);
  // אנקערס
  const pesach = idxOf((s) => ord(s.h) >= ord({ m: 'Nisan', d: 15 })) - 1;      // דער לעצטער שבת פאר פסח
  const nachamu = idxOf((s) => ord(s.h) > ord({ m: 'Av', d: 9 }));              // דער ערשטער שבת נאך ט' באב
  const segs = leap ? [
    { from: 0, to: nachamu - 1, first: IX.Bereshit, last: IX.Devarim, pairs: ['Matot', 'Chukat', 'Achrei Mot', 'Behar'].map((k) => IX[k]) },
  ] : [
    { from: 0, to: pesach, first: IX.Bereshit, last: IX.Tzav, pairs: [IX.Vayakhel] },
    { from: pesach + 1, to: nachamu - 1, first: IX.Shmini, last: IX.Devarim, pairs: ['Tazria', 'Achrei Mot', 'Behar', 'Matot', 'Chukat'].map((k) => IX[k]) },
  ];
  segs.push({ from: nachamu, to: main.length - 1, first: IX.Vaetchanan, last: nitzVay ? IX.Vayeilech : IX.Nitzavim, pairs: nitzVay ? [IX.Nitzavim] : [] });
  segs.forEach((g) => {
    const slots = main.slice(g.from, g.to + 1);
    const n = g.last - g.first + 1;
    const need = n - slots.length;
    const joined = new Set(g.pairs.slice(0, Math.max(0, need)));
    // די נישט-באנוצטע צוזאמשטעלונגען (שבתים מער ווי פרשיות) — זאל נישט פאסירן
    let i = g.first;
    slots.forEach((s) => {
      if (i > g.last) return;
      if (joined.has(i)) { put(s, [i, i + 1]); i += 2; } else { put(s, [i]); i += 1; }
    });
  });
  cache.set(y, map);
  return map;
}

/** די פרשה פון א שבת (iso), אדער '' (יום טוב) */
export function parashaOf(iso) {
  const h = toHebrew(iso);
  if (!h) return null;
  return yearParshiyot(h.y).get(iso) || null;
}

/** דער שבת פון דער וואך פון א טאג (שבת = דער זעלבער טאג) */
export function shabbatOfWeek(iso) {
  const t = utc(iso);
  return isoOf(t + ((6 - new Date(t).getUTCDay() + 7) % 7) * DAY);
}
