// שמות פרטיים: אנגלית → עברית. קודם השם העברי (גם מכינוי: Shea → יהושע, Mottie → מרדכי);
// רק שם שהוא באמת אידיש (לייב, הערש, זיסל…) נשאר באידיש. שם לועזי (George, Robert) → אין הצעה — לכתוב ידנית.
// מפתח = האותיות באנגלית בלי רווחים / סימנים, באותיות קטנות.

const M = {
  // ---- זכר: שמות עבריים ----
  'אברהם': 'Avraham Avrohom Avrom Avrum Abraham Abram Avrumi Avrumy Avrumie Avi Avy Avrumele Abe Avromi Avrahum',
  'יצחק': 'Yitzchok Yitzchak Yitzhak Yitzhok Itzchok Isaac Issac Isaak Itzik Itzy Itzu Yitzy Yitzi Yitz Izzy Izzi Yitzie Itche Itchie Yitchok',
  'יעקב': 'Yaakov Yakov Yaacov Yankev Yaakow Jacob Jakob Jack Yanky Yankey Yankie Yanki Yankel Yankee Kobi Koby Yakob Yaakob',
  'משה': 'Moshe Moishe Moishy Moishe Moshy Moses Moishi Moish Moishie Moshie Mosh Moise Moisy',
  'אהרן': 'Aharon Aaron Aron Ahron Arele Ahrele Ahara',
  'דוד': 'Dovid Duvid David Dovi Dov Duvi Dudi Duvy Dave Davi Dovy Dovidl Duvidl',
  'שלמה': 'Shlomo Shloime Shloimy Shloimi Solomon Sholmo Shlomie Shloimie Shlome Salamon Shlomi',
  'יוסף': 'Yosef Yossef Yoseph Yosel Yossel Yossi Yossy Yosi Yoshe Joseph Joe Joey Yossie Yoseif Yusef Yosele',
  'בנימין': 'Binyomin Binyamin Benjamin Binyamin Binyumin Benyomin Benyamin Benny Ben Binny Bini Biny Yomi Yumi Yoni Yumy',
  'שמואל': 'Shmuel Shmiel Samuel Sam Shmuely Shmuli Shmuly Shmulik Shmiel Shmil Sammy Shmelke',
  'יהושע': 'Yehoshua Yehoshia Joshua Josh Shia Shea Shaya Shie Shiye Shuie Yeshua Yehoshie Shiye Yeshie',
  'ישעיה': 'Yeshaya Yeshayahu Yeshayah Isaiah Shaya Shaye Shayu Shayah',
  'ישראל': 'Yisroel Yisrael Israel Yisrul Srul Sruly Sruli Srulik Isruel Israel Yisruel Srully',
  'מרדכי': 'Mordechai Mordche Mordchai Mordy Mordi Motty Mottie Motti Moti Motel Motl Mordecai Mutty Mutti Mottel Mordkhe',
  'אליעזר': 'Eliezer Lazer Leizer Leiser Lezer Laizer Elazer Eluzer Lazar Leizy',
  'אלעזר': 'Elazar Eleazar Elozor Elozer',
  'אליהו': 'Eliyahu Eliyohu Eliahu Eliahou Elijah Eli Elia Elya Elye Elyahu',
  'אלימלך': 'Elimelech Elimelch Meilech Meilach Melech Meilich Mailech',
  'חיים': 'Chaim Chayim Haim Hayim Chaimy Chaimie Chaimke Chayim Hyman Chaimi',
  'מנחם': 'Menachem Menachum Menuchem Menachim Mendy Mendi Mendel Menny Menchy Mendel Mendie',
  'נחמן': 'Nachman Nachmen Nuchem',
  'נחום': 'Nachum Nochum Nuchum Nahum',
  'נח': 'Noach Noah Noach Noi',
  'פנחס': 'Pinchos Pinchas Pinches Pinchus Pinny Pini Pinnie Pinky Pinchy Pinchie Phineas',
  'שמשון': 'Shimshon Shimson Samson Shimshy Shimshi',
  'שמעון': 'Shimon Shimen Simon Shimmy Shimi Shimie Shimmie Shimy Simcha?',
  'שמחה': 'Simcha Simchy Simchie Simche Simchi',
  'אשר': 'Osher Asher Usher Oshy Oshi Oshie',
  'יואב': 'Yoav Yoev',
  'יואל': 'Yoel Joel Yoely Yoeli Yoelie',
  'ניסן': 'Nissan Nisan Nisson Nison Nissen Nisen',
  'נתן': 'Nosson Nasan Natan Nathan Noson Nusen Nossen Nusi Nossi Nati',
  'יחזקאל': 'Yechezkel Yecheskel Yecheskal Chezkel Chesky Cheskel Chezky Cheski Ezekiel Chaskel Chatzkel Chatzkel Hezkel Khaskel',
  'יחיאל': 'Yechiel Yechial Yechil Yechiel Chiel Chili Chily',
  'יהודה': 'Yehuda Yehudah Yidel Yidl Yudel Yudi Yudy Yehudi Judah Yiddy Yiddi Yidi Yide',
  'יונה': 'Yona Yonah Jonah',
  'יונתן': 'Yonasan Yonason Yonatan Jonathan Yoni Yony Jon',
  'ירמיה': 'Yirmiyahu Yirmiya Yirmiyah Yermiya Yermi Yermy Jeremiah Yirmi',
  'מאיר': 'Meir Mayer Meyer Myer Mayir Meiry Meiri Meyir',
  'מיכאל': 'Michoel Michael Mechel Michel Michal Michi Michy Mike',
  'דניאל': 'Daniel Doniel Danny Dani Donny Doni',
  'גבריאל': 'Gavriel Gavreil Gabriel Gavi',
  'רפאל': 'Refoel Rafael Raphael Refael Refuel Rafi Rafy Refoeli',
  'עזריאל': 'Azriel Azrial',
  'עזרא': 'Ezra Ezrah',
  'שאול': 'Shaul Shoul Saul',
  'שבתי': 'Shabsi Shabtai Shabsai Shepsel',
  'זאב': 'Zev Zeev Zeeb Zevi Zevy Zevie',
  'צבי': 'Tzvi Zvi Tzevi Zevi? Tzvika Tzviki Hirsh?',
  'דב': 'Dov Dovi? Dovy?',
  'ברוך': 'Boruch Baruch Burech Boruch Buruch Burich Borich Barry? Bori Borie Boruchy',
  'בן ציון': 'Bentzion Benzion Bentzy Benzy Bentzi Bentzie',
  'זלמן': 'Zalman Zalmen Zalmy Zalmi Zalmie',
  'אפרים': 'Efraim Ephraim Efrayim Ephrayim Efroim Froim Fraim Froimy',
  'מנשה': 'Menashe Menashi Menasheh Manasseh',
  'אלכסנדר': 'Alexander Sender Sendy Senderel Alex',
  'ראובן': 'Reuven Ruvein Ruven Reuben Ruby Ruvy',
  'גדליה': 'Gedalya Gedalia Gedaliah Gedalyah Gedaliahu',
  'זכריה': 'Zecharya Zechariah Zachariah Zecharia',
  'יוחנן': 'Yochanan Yochonon Yochonan Johanan',
  'יקותיאל': 'Yekusiel Yekutiel Kusiel Kusi',
  'אביגדור': 'Avigdor Avigdur Vigdor',
  'עמרם': 'Amrom Amram Amrum Amromy Amri',
  'עקיבא': 'Akiva Akiba Kivi Kivy',
  'אורי': 'Uri Ury',
  'אריה': 'Aryeh Arye Aryeh Arie Arieh',
  'אליקים': 'Elyakim Eliakim',
  'אלחנן': 'Elchonon Elchanan Elhanan',
  'בצלאל': 'Betzalel Bezalel Tzali Tzaly Betzy',
  'חנוך': 'Chanoch Henoch Chanoch Hanoch',
  'חנניה': 'Chananya Chananyah Chananiah Chanina',
  'יהונתן': 'Yehonasan Yehonatan',
  'יוחאי': 'Yochai',
  'כתריאל': 'Kasriel Katriel Casriel',
  'לוי': 'Levi Levy Levie',
  'מתתיהו': 'Matisyahu Mattisyahu Matityahu Matis Mattis Matisyohu',
  'נפתלי': 'Naftoli Naftali Naftula Naftuli Tuli Tully Tuly Tulie Hertzka?',
  'עובדיה': 'Ovadia Ovadya Ovadiah',
  'צדוק': 'Tzodok Tzadok Zadok',
  'שלום': 'Sholom Shalom Sholem Shulem Shloimi? Shuli Shuly',
  'שמריה': 'Shmaryahu Shmarya Shmaria',
  'תנחום': 'Tanchum Tanchem',
  'אהרן יהודה': 'AharonYehuda',
  'חזקיה': 'Chizkiya Chizkiyahu Hezekiah',
  'עמנואל': 'Emanuel Emmanuel Manny',
  'פסח': 'Pesach Pesech Pesi',
  'קלונימוס': 'Kalman Kalonymus Kalonimus Kalmen',
  'יחזקיה': 'Yechezkiyahu',
  'שמעיה': 'Shmaya Shmaiah',
  'אליהו חיים': '',
  'נחמיה': 'Nechemya Nechemia Nehemiah',
  'מלכיאל': 'Malkiel',
  'חנן': 'Chanan',
  'יוסף חיים': '',
  'ישכר': 'Yisachar Yissachar Yisochor Yisuchur Sachar Berish?',
  'זבולון': 'Zevulun Zevulen Zebulun',
  'גד': 'Gad',
  'אשר זעליג': '',
  'שניאור': 'Shneur Shneor Shneier Shneur',
  'אהרן משה': '',
  'צמח': 'Tzemach Tzemech',
  'מאיר צבי': '',
  // ---- נקבה: שמות עבריים ----
  'שרה': 'Sarah Sara Suri Surie Suri Soro Surah Sury Sorale Sarala Surele',
  'רבקה': 'Rivka Rivkah Rifka Rifky Rivky Rivki Rebecca Rivkie Riki Ricky Rifki',
  'רחל': 'Rochel Rachel Ruchel Ruchy Ruchie Ruchi Rochi Rochy Rochie',
  'לאה': 'Leah Lea Leeba?',
  'חיה': 'Chaya Chayah Chayi Chayie Haya',
  'חוה': 'Chava Chavi Chavy Chavie Eva Eve Chavah',
  'דבורה': 'Devorah Devora Dvora Dvorah Deborah Debbie Devory Devori Dvory Dvoiry Dvori Dvoiri Dvoirah',
  'מרים': 'Miriam Miryam Mimi Miri Mindy?',
  'אסתר': 'Esther Ester Esty Esti Estie Essie Ettie Etty',
  'חנה': 'Chana Chanah Channah Hannah Hanna Chani Chany Chanie Chanele',
  'פרידא': 'Frida Frieda Freida Fraida Friedy Fraidy',
  'יהודית': 'Yehudis Yehudit Judith Judy Yudis',
  'שושנה': 'Shoshana Shoshanah Shoshi Shoshy',
  'פייגא': 'Feiga Faiga Feige Faigy Feigy Faigie',
  'מלכה': 'Malka Malky Malki Malkie Malkah',
  'רייזל': 'Raizel Reizel Raizy Raizi Rose? Reizy',
  'שיינדל': 'Sheindel Shaindel Shaindy Sheindy Shaindie',
  'בלומא': 'Bluma Blima Blimie Blimy Blimi Bloomie',
  'פערל': 'Perel Pearl Perl Peril Perry? Perele',
  'גיטל': 'Gitel Gittel Gitty Gitti Gittie Gitta',
  'הינדא': 'Hinda Hindy Hindi Hindie',
  'צירל': 'Tzirel Tziril Tzirey Tziri Tzirie',
  'אלישבע': 'Elisheva Elisheba Elizabeth? Shevi Shevy',
  'יוכבד': 'Yocheved Yachet Yochi Yochy Yocheved',
  'נחמה': 'Nechama Nechomy Nechami Nechamie Nechy',
  'שפרה': 'Shifra Shifrah Shifry Shifri',
  'פועה': 'Pua Puah',
  'רות': 'Rus Ruth Rut Ruti',
  'אילה': 'Ayala Ayelet',
  'טויבא': 'Toby Tova? Toiby Tauba Toba',
  'טובה': 'Tova Tovah Tovi Tovy',
  'בתיה': 'Basya Batya Bashy Bashi Bashie Basha?',
  'ברכה': 'Bracha Brocha Brucha Brachy Bruchy Bruchi Brachie',
  'פנינה': 'Penina Peninah Penny',
  'חנה מירל': '',
  'מירל': 'Mirel Mirl Mirele',
  'ליבא': 'Liba Libby Libi Liby Libbi',
  'הדסה': 'Hadassah Hadasa Hadas Dassy Dassi Dassie',
  'בינה': 'Bina Binah Binie',
  'זיסל': 'Zissel Zisel Zissy Zisy',
  'שרה לאה': '',
  'צביה': 'Tzivia Tziviah Tzivya Zivia Tzivi Tzivy',
  'אסנת': 'Osnas Osnat Asnat',
  'גולדא': 'Golda Goldie Goldy',
  'דינה': 'Dina Dinah Dini Dinie',
  'עדינה': 'Adina Adinah',
  'נעמי': 'Naomi Nomi',
  'שולמית': 'Shulamis Shulamit',
  'סימא': 'Sima Simi Simy',
  'חיה שרה': '',
  // ---- אידיש (נשאר באידיש) ----
  'לייב': 'Leib Leibel Leibi Leibie Leiby Leibish Leibele Lieb Leb Laib Leibl',
  'הערש': 'Hersh Hershel Hershy Hershi Hershie Hersch Herschel Hirsh Hirsch Heshy Heshi Heshie',
  'בער': 'Ber Berel Berl Berish Beri Berry?',
  'וואלף': 'Wolf Velvel Velvi Volvi Welwel',
  'פייוויש': 'Feivish Feivel Fivel Feival Feivy Feivi',
  'קאפל': 'Kopel Koppel Kopy Koppy',
  'געצל': 'Getzel Getzl Getzy',
  'זעליג': 'Zelig Selig Zeligh Zeligy',
  'אנשיל': 'Anshel Anshi Anshy',
  'ליפא': 'Lipa Lipe Lipy Lippy Lipi',
  'בונים': 'Bunim Bunem',
  'מענדל': 'Mendel? Mendl',
  'זיסקינד': 'Ziskind Zisking',
  'שרגא': 'Shraga',
  'פישל': 'Fishel Fishl Fishy',
  'יאנקל': 'Yankel?',
  'מאטל': 'Motel?',
  'עוזר': 'Ozer Oizer Uzer Oizy',
  'זושא': 'Zusha Zushe Zisha Zishe Zushy',
  'אייזיק': 'Aizik Eizik Isaac?',
  'הערצקא': 'Hertzka Hertzke',
  'שייע': 'Shaye?',
  'נטע': 'Nuta Nute Nusi? Nota Nosi?',
  'פערץ': 'Peretz Perets',
  'מאניס': 'Manis Mannis Manes Mannes',
  'שעפטל': 'Sheftel Sheftl',
  'קלמן': 'Kalmen?',
  'חסקל': '',
};

// כינוי שיכול להיות כמה שמות → לבחור
const AMBIG = {
  nachie: ['נחמן', 'נחום'], nachy: ['נחמן', 'נחום'], nachi: ['נחמן', 'נחום'],
  shaya: ['יהושע', 'ישעיה'], shaye: ['יהושע', 'ישעיה'],
  ari: ['אריה', 'אהרן'], arie: ['אריה', 'אהרן'],
  avi: ['אברהם', 'אביגדור'], eli: ['אליהו', 'אליעזר', 'אלימלך'], yoni: ['יונתן', 'בנימין'], yomi: ['בנימין'], yumi: ['בנימין'],
  dovi: ['דוד', 'דב'], dovy: ['דוד', 'דב'], zevi: ['זאב', 'צבי'], mendy: ['מנחם', 'מענדל'], mendel: ['מנחם מענדל', 'מענדל'],
  benny: ['בנימין', 'בן ציון'], ben: ['בנימין', 'בן ציון'], kalman: ['קלונימוס'],
  shuli: ['שלום', 'שולמית'], shimmy: ['שמעון', 'שמשון'], shimi: ['שמעון', 'שמשון'], sam: ['שמואל', 'שמשון'], isaac: ['יצחק', 'אייזיק'],
};

// שמות לועזיים — אין שם עברי ידוע; לכתוב ידנית
const FOREIGN = new Set(('george robert harvey sidney charles ernest erno vivian william richard henry frank fred frederick edward eddie harry herbert ' +
  'martin michael? morris max maxwell milton murray norman paul peter philip ralph raymond roger ronald stanley steven stephen walter allen alan arthur ' +
  'bernard bruce carl david? dennis donald douglas eugene gary gerald gordon howard irving jerome jerry kenneth lawrence leonard lewis louis marvin ' +
  'melvin mitchell nathan? oscar phillip richard sheldon sol sydney ted terry thomas tom victor vincent warren wayne betty barbara carol dorothy edith ' +
  'florence gloria helen irene janet joan joyce judy? linda lillian lois marie marilyn mary nancy pauline phyllis ruth? shirley susan sylvia thelma ' +
  'jeffrey jeff mark scott brian kevin jason eric andrew anthony keith larry sandy sharon lisa karen').split(/\s+/).filter((w) => !w.endsWith('?')));

const key = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const MAP = new Map();
Object.entries(M).forEach(([he, list]) => {
  String(list).split(/\s+/).filter(Boolean).forEach((w) => {
    if (w.endsWith('?')) return; // ספק — לא בטוח
    const k = key(w);
    if (k && !MAP.has(k)) MAP.set(k, he);
  });
});

/**
 * שם פרטי באנגלית (מילה אחת) → { he, sure, options, foreign }
 * sure = בטוח (ממילון); options = כמה אפשרויות (כינוי עם ספק); foreign = שם לועזי (לכתוב ידנית)
 */
export function heOfWord(w) {
  const k = key(w);
  if (!k) return null;
  if (AMBIG[k]) return { he: AMBIG[k][0], options: AMBIG[k], sure: false };
  if (MAP.has(k)) return { he: MAP.get(k), options: [MAP.get(k)], sure: true };
  if (FOREIGN.has(k)) return { he: '', options: [], sure: false, foreign: true };
  return null;
}
/** שם מלא (כמה מילים): כל מילה לבד. null = אין שום הצעה */
export function heOfName(en, translit = null) {
  const words = String(en || '').replace(/\([^)]*\)/g, ' ').replace(/[.,]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return null;
  let parts = words.map(heOfWord);
  if (parts.every((p) => !p)) return null;
  // מילה לא ידועה (שם אידיש נדיר) — תעתיק, והכל "לא בטוח"
  if (parts.some((p) => !p)) {
    if (!translit) return { he: '', sure: false, unknown: true };
    parts = parts.map((p, i) => p || { he: translit(words[i]), options: [translit(words[i])], sure: false });
  }
  if (parts.some((p) => p.foreign)) return { he: '', sure: false, foreign: true };
  // כמה אפשרויות — רק במילה אחת עם ספק
  const amb = parts.findIndex((p) => p.options.length > 1);
  const he = parts.map((p) => p.he).join(' ');
  const options = amb < 0 ? [he] : parts[amb].options.map((o) => parts.map((p, i) => (i === amb ? o : p.he)).join(' '));
  return { he, options, sure: parts.every((p) => p.sure) };
}
