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

/** מילון שנלמד מהמאגר: שם עברי → השם באנגלית הנפוץ ביותר אצלכם. */
function learned(contacts, heKey, enKey) {
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
  const dict = learned(contacts, 'first_name_he', 'first_name_en');
  learned(contacts, 'wife_name_he', 'wife_name_en').forEach((v, k) => { if (!dict.has(k)) dict.set(k, v); });
  return lookup(he, dict);
}

/** הצעה לשם משפחה באנגלית — רק מתוך המאגר (שמות משפחה משתנים מדי בשביל רשימה קבועה). */
export function suggestLastName(he, contacts) {
  return learned(contacts, 'last_name_he', 'last_name_en').get(normalize(he)) || '';
}
