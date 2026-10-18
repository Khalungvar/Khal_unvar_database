// הצעת שם באנגלית לפי השם בעברית.
// סדר העדיפויות: 1) איך השם הזה כבר נכתב באנגלית אצל אנשי קשר אחרים במאגר (לומד מהשימוש שלכם)
//                2) רשימה בסיסית של שמות נפוצים.
// זו רק הצעה: היא מתמלאת רק כשהשדה באנגלית ריק, ואפשר לשנות אותה.
import { normalize } from './util.js';

const COMMON = {
  // שמות גברים
  'אהרן': 'Aron', 'אהרון': 'Aron', 'אברהם': 'Avraham', 'אליהו': 'Eliyahu', 'אליעזר': 'Eliezer',
  'אלימלך': 'Elimelech', 'אלחנן': 'Elchanan', 'אפרים': 'Efraim', 'אשר': 'Asher', 'בנימין': 'Binyamin',
  'ברוך': 'Boruch', 'בערל': 'Berel', 'בער': 'Ber', 'גבריאל': 'Gavriel', 'גדליה': 'Gedalya',
  'דוד': 'Dovid', 'דניאל': 'Daniel', 'הלל': 'Hillel', 'הערשל': 'Hershel', 'הירש': 'Hirsch',
  'זאב': 'Zev', 'זלמן': 'Zalmen', 'זכריה': 'Zecharya', 'חיים': 'Chaim', 'חנוך': 'Chanoch',
  'חנניה': 'Chananya', 'טוביה': 'Tuvya', 'יואל': 'Yoel', 'יודא': 'Yidel', 'יהודה': 'Yehuda',
  'יהושע': 'Yehoshua', 'יוסף': 'Yosef', 'יחזקאל': 'Yechezkel', 'יחיאל': 'Yechiel', 'יעקב': 'Yaakov',
  'יצחק': 'Yitzchok', 'ישעיה': 'Yeshaya', 'ישראל': 'Yisroel', 'יששכר': 'Yissachar', 'יקותיאל': 'Yekusiel',
  'ירחמיאל': 'Yerachmiel', 'יונה': 'Yona', 'יונתן': 'Yonasan', 'כתריאל': 'Kasriel', 'לוי': 'Levi',
  'לייב': 'Leib', 'מאיר': 'Meir', 'מנחם': 'Menachem', 'מנשה': 'Menashe', 'מענדל': 'Mendel',
  'מרדכי': 'Mordechai', 'משה': 'Moshe', 'משולם': 'Meshulem', 'נחום': 'Nachum', 'נחמן': 'Nachman',
  'נפתלי': 'Naftali', 'נתן': 'Nosson', 'סנדר': 'Sender', 'עזריאל': 'Azriel', 'עקיבא': 'Akiva',
  'פנחס': 'Pinchas', 'פנחס': 'Pinchas', 'פייביש': 'Feivish', 'פישל': 'Fishel', 'צבי': 'Tzvi',
  'ראובן': 'Reuven', 'רפאל': 'Refoel', 'שאול': 'Shaul', 'שבתי': 'Shabsi', 'שלום': 'Sholom',
  'שלמה': 'Shloime', 'שמואל': 'Shmuel', 'שמעון': 'Shimon', 'שמחה': 'Simcha', 'שמעלקא': 'Shmelka',
  'שרגא': 'Shraga', 'פייוויש': 'Feivish', 'קלונימוס': 'Kalonymus', 'וואלף': 'Wolf', 'זושא': 'Zusha',
  'חנה': 'Chana', 'מתתיהו': 'Matisyahu', 'עמרם': 'Amrom', 'אריה': 'Aryeh', 'ליפא': 'Lipa',
  'אלטר': 'Alter', 'בצלאל': 'Betzalel', 'דב': 'Dov', 'הערש': 'Hersh', 'וועלוול': 'Velvel',
  'יעקב יוסף': 'Yaakov Yosef', 'איסר': 'Isser', 'אנשיל': 'Anshel', 'מיכאל': 'Michoel', 'נטע': 'Nuta',
  'עזרא': 'Ezra', 'פסח': 'Pesach', 'קאפל': 'Kopel', 'שאלתיאל': 'Shealtiel', 'תנחום': 'Tanchum',
  // שמות נשים
  'אסתר': 'Esther', 'בלומא': 'Bluma', 'ביילא': 'Baila', 'גיטל': 'Gitty', 'דבורה': 'Devora',
  'הינדא': 'Hinda', 'חוה': 'Chava', 'חיה': 'Chaya', 'טויבא': 'Toby', 'יהודית': 'Yehudis',
  'יוכבד': 'Yocheved', 'לאה': 'Leah', 'מלכה': 'Malka', 'מרים': 'Miriam', 'נחמה': 'Nechama',
  'פערל': 'Perel', 'פייגא': 'Feiga', 'פריידא': 'Frieda', 'צירל': 'Tzirel', 'רבקה': 'Rivka',
  'רחל': 'Rochel', 'רייזל': 'Raizel', 'שרה': 'Sara', 'שיינדל': 'Shaindel', 'שיינא': 'Shaina',
  'חנה': 'Chana', 'גולדא': 'Golda', 'מאטיל': 'Matil', 'רוחמה': 'Ruchama', 'ברכה': 'Bracha',
  'אסתר מלכה': 'Esther Malka', 'מינדל': 'Mindel', 'פרומט': 'Frumet', 'חנה רחל': 'Chana Rochel',
  'זיסל': 'Zissel', 'טעמא': 'Teme', 'ליבא': 'Liba', 'אלטא': 'Alta', 'בתיה': 'Basya', 'יענטא': 'Yenta',
  'שפרה': 'Shifra', 'פועה': 'Pua', 'סימא': 'Sima', 'דינה': 'Dina', 'נעמי': 'Naomi', 'רות': 'Rus',
};

// שמות משפחה נפוצים בכתיב אידיש → הכתיב המקובל באנגלית
const SURNAMES = {
  'קליין': 'Klein', 'ווייס': 'Weiss', 'שווארץ': 'Schwartz', 'גרויס': 'Gross', 'גראס': 'Gross',
  'פרידמאן': 'Friedman', 'גאלדבערגער': 'Goldberger', 'גאלדשטיין': 'Goldstein', 'גרינוואלד': 'Greenwald',
  'גרינבערג': 'Greenberg', 'גרינפעלד': 'Greenfeld', 'הורוויץ': 'Horowitz', 'הורוביץ': 'Horowitz',
  'ראבינאוויטש': 'Rabinowitz', 'בערקאוויטש': 'Berkowitz', 'בערקאוויץ': 'Berkowitz', 'לעבאוויטש': 'Lebowitz',
  'הערשקאוויטש': 'Herskowitz', 'יאנקאוויטש': 'Jankowitz', 'מאשקאוויטש': 'Moskowitz', 'מאסקאוויטש': 'Moskowitz',
  'אבראמאוויטש': 'Abramowitz', 'דאווידאוויטש': 'Davidowitz', 'מארקאוויטש': 'Markowitz', 'לייבאוויטש': 'Leibowitz',
  'יוסקאוויטש': 'Joskowitz', 'קאהן': 'Kohn', 'כהן': 'Cohen', 'כ"ץ': 'Katz', 'כץ': 'Katz', 'לוי': 'Levy',
  'לעווי': 'Levy', 'טייטלבוים': 'Teitelbaum', 'הלברשטאם': 'Halberstam', 'ראזענבערג': 'Rosenberg',
  'ראזנבערג': 'Rosenberg', 'ראזענבוים': 'Rosenbaum', 'שטערן': 'Stern', 'שטיין': 'Stein', 'ברוין': 'Braun',
  'בראון': 'Braun', 'גוטמאן': 'Gutman', 'לאנדא': 'Landau', 'לאנדאו': 'Landau', 'שפיטצער': 'Spitzer',
  'שפיצער': 'Spitzer', 'פיש': 'Fish', 'פישער': 'Fischer', 'פרייליך': 'Freilich', 'פריעד': 'Fried',
  'פריד': 'Fried', 'גלאנץ': 'Glantz', 'גלאזער': 'Glazer', 'גרינבוים': 'Greenbaum', 'זאבעל': 'Sobel',
  'ליכטענשטיין': 'Lichtenstein', 'ווערטהיימער': 'Wertheimer', 'ווינטער': 'Winter', 'וואלף': 'Wolf',
  'וואלפסאן': 'Wolfson', 'ווייסמאן': 'Weissman', 'ווייסבערגער': 'Weissberger', 'ווייסבערג': 'Weissberg',
  'שוואב': 'Schwab', 'שנייער': 'Schneier', 'שניידער': 'Schneider', 'שעכטער': 'Schechter', 'שלעזינגער': 'Schlesinger',
  'שפירא': 'Shapiro', 'שאפירא': 'Shapiro', 'מאנדעל': 'Mandel', 'מענדעלאוויטש': 'Mendelowitz', 'מילער': 'Miller',
  'מערמעלשטיין': 'Mermelstein', 'נייגערשל': 'Neugershall', 'נוסבוים': 'Nussbaum', 'ענגעל': 'Engel',
  'ענגלענדער': 'Englander', 'פאללאק': 'Pollak', 'פאלאק': 'Pollak', 'פרענקעל': 'Frankel', 'פרענקל': 'Frankel',
  'פרייס': 'Preiss', 'קאפעל': 'Kopel', 'קאופמאן': 'Kaufman', 'קויפמאן': 'Kaufman', 'קעסלער': 'Kessler',
  'קרויס': 'Krauss', 'קרויז': 'Krausz', 'רובין': 'Rubin', 'רוטה': 'Roth', 'ראטה': 'Roth', 'ראטה': 'Roth',
  'ריינער': 'Reiner', 'רייך': 'Reich', 'רייכמאן': 'Reichman', 'שטיינער': 'Steiner', 'שטיינבערג': 'Steinberg',
  'שטיינמעץ': 'Steinmetz', 'טאוב': 'Taub', 'טויב': 'Taub', 'זילבער': 'Silber', 'זילבערמאן': 'Silberman',
  'זינגער': 'Singer', 'זיידמאן': 'Seidman', 'אייזנער': 'Eisner', 'אייזענבערג': 'Eisenberg', 'אויערבאך': 'Auerbach',
  'אדלער': 'Adler', 'אונגאר': 'Ungar', 'אוסטרייכער': 'Ostreicher', 'אקשטיין': 'Eckstein', 'בירנבוים': 'Birnbaum',
  'בלום': 'Blum', 'בערגער': 'Berger', 'בערנשטיין': 'Bernstein', 'גאנץ': 'Gantz', 'גוטליב': 'Gottlieb',
  'גרינשפאן': 'Greenspan', 'דייטש': 'Deutsch', 'הירש': 'Hirsch', 'הערץ': 'Hertz', 'הופמאן': 'Hoffman',
  'האפמאן': 'Hoffman', 'וויינבערגער': 'Weinberger', 'וויינבערג': 'Weinberg', 'וויינשטאק': 'Weinstock',
  'וואלדמאן': 'Waldman', 'זשעמבער': 'Zember', 'טאננענבוים': 'Tannenbaum', 'לעפקאוויטש': 'Lefkowitz',
  'לעווענשטיין': 'Lowenstein', 'מאיר': 'Meyer', 'מייער': 'Meyer', 'מאן': 'Mann', 'נויבערגער': 'Neuberger',
  'נייבערגער': 'Neuberger', 'נאכמאן': 'Nachman', 'עדעלשטיין': 'Edelstein', 'פרידלאנדער': 'Friedlander',
  'קאהאן': 'Kahan', 'קאצבורג': 'Katzburg', 'רוזנפעלד': 'Rosenfeld', 'ראזענפעלד': 'Rosenfeld',
  'שוורץ': 'Schwartz', 'שיק': 'Schick', 'שעהן': 'Schoen', 'שען': 'Schon', 'שערמאן': 'Sherman',
};

/**
 * תעתיק לפי הכתיב האידישי (פונטי), כשאין את השם ברשימות. זו הערכה בלבד — מוצגת באפור עד אישור.
 * דוגמאות: קליין → Klein, בערקאוויטש → Berkowitz, שטיינער → Steiner.
 */
export function transliterateYiddish(word) {
  let w = normalize(word).replace(/\s+/g, ' ');
  if (!w) return '';
  const rules = [
    [/אוויטש(?=\s|$)/g, 'owitz'], [/אוויץ(?=\s|$)/g, 'owitz'], [/וויטש(?=\s|$)/g, 'witz'], [/וויץ(?=\s|$)/g, 'witz'],
    [/דזש/g, 'j'], [/זש/g, 'zh'], [/טש/g, 'tch'],
    [/(^|\s)שט/g, '$1st'], [/(^|\s)שפ/g, '$1sp'],
    [/ייס(?=\s|$)/g, 'eiss'], [/יי/g, 'ei'], [/ײ/g, 'ei'], [/וו/g, 'w'], [/װ/g, 'w'], [/וי/g, 'oi'],
    [/(^|\s)א(?=[ויו])/g, '$1'],
    [/ש/g, 'sh'], [/[חכך]/g, 'ch'], [/[צץ]/g, 'tz'], [/ף/g, 'f'], [/ת/g, 's'],
    [/א/g, 'a'], [/ב/g, 'b'], [/ג/g, 'g'], [/ד/g, 'd'], [/ה/g, 'h'], [/ו/g, 'u'], [/ז/g, 'z'],
    [/ט/g, 't'], [/י(?=[aeiou])/g, 'y'], [/י/g, 'i'], [/ל/g, 'l'], [/[מם]/g, 'm'], [/[נן]/g, 'n'],
    [/ס/g, 's'], [/ע/g, 'e'], [/פ/g, 'p'], [/ק/g, 'k'], [/ר/g, 'r'],
  ];
  rules.forEach(([re, to]) => { w = w.replace(re, to); });
  w = w.replace(/[^a-z ]/g, '');
  return w.split(' ').filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1)).join(' ');
}

/** מילון שנלמד מהמאגר: שם עברי → השם באנגלית הנפוץ ביותר אצלכם. */
const memo = new WeakMap();
function cached(contacts, key, build) {
  let m = memo.get(contacts);
  if (!m) { m = new Map(); memo.set(contacts, m); }
  if (!m.has(key)) m.set(key, build());
  return m.get(key);
}

function learned(contacts, heKey, enKey) {
  return cached(contacts, `l:${heKey}:${enKey}`, () => learnedRaw(contacts, heKey, enKey));
}
function learnedRaw(contacts, heKey, enKey) {
  const counts = new Map();
  const add = (he, en) => {
    const h = normalize(he);
    const e = String(en || '').trim();
    if (!h || !e) return;
    const m = counts.get(h) || new Map();
    m.set(e, (m.get(e) || 0) + 1);
    counts.set(h, m);
  };
  contacts.forEach((c) => {
    add(c[heKey], c[enKey]);
    // שמות פרטיים מרובים: אם מספר המילים זהה, לומדים גם כל מילה בנפרד
    const hw = normalize(c[heKey]).split(' ');
    const ew = String(c[enKey] || '').trim().split(/\s+/);
    if (hw.length > 1 && hw.length === ew.length) hw.forEach((w, i) => add(w, ew[i]));
  });
  const best = new Map();
  counts.forEach((m, h) => best.set(h, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]));
  return best;
}

function lookup(he, dict) {
  const full = normalize(he);
  if (!full) return '';
  if (dict.has(full)) return dict.get(full);
  if (COMMON[full]) return COMMON[full];
  // כמה שמות: מתרגמים כל מילה; אם אחת לא ידועה — לא מציעים כלום
  const words = full.split(' ');
  const out = words.map((w) => dict.get(w) || COMMON[w] || '');
  return out.every(Boolean) ? out.join(' ') : '';
}

/** הצעה לשם פרטי באנגלית (לגבר או לאישה). */
export function suggestFirstName(he, contacts) {
  const dict = new Map(learned(contacts, 'first_name_he', 'first_name_en'));
  learned(contacts, 'wife_name_he', 'wife_name_en').forEach((v, k) => { if (!dict.has(k)) dict.set(k, v); });
  const found = lookup(he, dict);
  if (found) return found;
  // שמות בכתיב אידיש (הערשל, בערל...) — תעתיק; שמות בכתיב עברי בלי ניקוד לא מתעתקים (מדי לא בטוח)
  return /ע|יי|וו/.test(normalize(he)) ? transliterateYiddish(he) : '';
}

/** הצעה לשם משפחה באנגלית: מהמאגר → רשימת שמות נפוצים → תעתיק לפי הכתיב האידישי. */
export function suggestLastName(he, contacts) {
  const key = normalize(he);
  if (!key) return '';
  return learned(contacts, 'last_name_he', 'last_name_en').get(key)
    || SURNAMES[key] || SURNAMES[String(he).trim()] || transliterateYiddish(he);
}

// ---------- פון ענגליש צו אידיש (פארקערט) — למשל פאר אן אלטע רשימה וואס איז נאר אויף ענגליש ----------
const lc = (s) => String(s || '').trim().toLowerCase();

/** פארקערטע ווערטערבוך: ענגליש → העברעאיש (פון דער רשימה, און פון די באקאנטע נעמען) */
function reverseDict(contacts, pairs, base) {
  return cached(contacts, `r:${JSON.stringify(pairs)}`, () => reverseDictRaw(contacts, pairs, base));
}
function reverseDictRaw(contacts, pairs, base) {
  const counts = new Map();
  const add = (en, he) => {
    const e = lc(en); const hh = String(he || '').trim();
    if (!e || !hh) return;
    const m = counts.get(e) || new Map();
    m.set(hh, (m.get(hh) || 0) + 1);
    counts.set(e, m);
  };
  contacts.forEach((c) => pairs.forEach(([heKey, enKey]) => {
    add(c[enKey], c[heKey]);
    const hw = String(c[heKey] || '').trim().split(/\s+/); const ew = String(c[enKey] || '').trim().split(/\s+/);
    if (hw.length > 1 && hw.length === ew.length) hw.forEach((w, i) => add(ew[i], w));
  }));
  const best = new Map();
  counts.forEach((m, e) => best.set(e, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]));
  Object.entries(base).forEach(([he, en]) => { if (!best.has(lc(en))) best.set(lc(en), he); });
  return best;
}

/**
 * תעתיק פון ענגליש צו אידישע אותיות (א השערה — ווערט געצייכנט "צו באשטעטיגן").
 * Klein → קליין, Schwartz → שווארץ, Weinberger → וויינבערגער, Friedman → פרידמאן.
 */
export function transliterateEnglish(word) {
  const out = String(word || '').toLowerCase().replace(/[^a-z\s-]/g, '').split(/[\s-]+/).filter(Boolean).map((w) => {
    w = w.replace(/(.)\1+/g, '$1') // ss → s, nn → n
      .replace(/([aeiouy])s(?=[aeiou])/g, '$1z'); // Rosen → ראזען
    const rules = [
      ['sch', 'ש'], ['tsch', 'טש'], ['tch', 'טש'], ['sh', 'ש'], ['ch', 'כ'], ['ck', 'ק'], ['ph', 'פ'], ['th', 'ט'],
      ['tz', 'צ'], ['ts', 'צ'], ['zh', 'זש'], ['kh', 'כ'],
      ['ei', 'יי'], ['ey', 'יי'], ['ai', 'יי'], ['ay', 'יי'], ['ie', 'י'], ['ee', 'י'], ['oi', 'וי'], ['oy', 'וי'], ['ou', 'וי'], ['au', 'וי'], ['oo', 'ו'],
      ['w', 'וו'], ['v', 'וו'], ['f', 'פ'], ['k', 'ק'], ['c', 'ק'], ['q', 'ק'], ['g', 'ג'], ['j', 'דזש'], ['z', 'ז'], ['x', 'קס'],
      ['b', 'ב'], ['d', 'ד'], ['h', 'ה'], ['l', 'ל'], ['m', 'מ'], ['n', 'נ'], ['p', 'פ'], ['r', 'ר'], ['s', 'ס'], ['t', 'ט'],
      ['a', 'א'], ['o', 'א'], ['e', 'ע'], ['i', 'י'], ['u', 'ו'], ['y', 'י'],
    ];
    let res = ''; let i = 0;
    while (i < w.length) {
      const r = rules.find(([en]) => w.startsWith(en, i));
      if (!r) { i += 1; continue; }
      let he = r[1];
      // א וואקאל אין אנהייב: א / או / אי / ע
      if (i === 0 && /^[aeiou]/.test(r[0]) && ['ו', 'י', 'וי', 'יי'].includes(he)) he = `א${he}`;
      res += he; i += r[0].length;
    }
    // אויסלאזנדיגע אותיות
    return res.replace(/כ$/, 'ך').replace(/מ$/, 'ם').replace(/נ$/, 'ן').replace(/פ$/, 'ף').replace(/צ$/, 'ץ');
  });
  return out.join(' ');
}

function lookupEn(en, dict) {
  const full = lc(en);
  if (!full) return '';
  if (dict.has(full)) return dict.get(full);
  const words = full.split(/\s+/);
  const out = words.map((w) => dict.get(w) || '');
  return out.every(Boolean) ? out.join(' ') : '';
}

/** א פרטי נאמען אויף אידיש פון ענגליש: פון דער רשימה / באקאנטע נעמען → תעתיק. */
export function suggestHeFirstName(en, contacts) {
  const dict = reverseDict(contacts, [['first_name_he', 'first_name_en'], ['wife_name_he', 'wife_name_en']], COMMON);
  return lookupEn(en, dict) || transliterateEnglish(en);
}

/** א פאמיליע נאמען אויף אידיש פון ענגליש. */
export function suggestHeLastName(en, contacts) {
  const dict = reverseDict(contacts, [['last_name_he', 'last_name_en']], SURNAMES);
  return lookupEn(en, dict) || transliterateEnglish(en);
}
