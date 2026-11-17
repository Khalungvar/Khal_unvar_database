# HANDOFF — מסירת העבודה לחשבון החדש (17/11/2026)

> נכתב בסוף השיחה האחרונה בחשבון האישי של הרב, לפני המעבר לחשבון הצוות **Khal Ungvar** (Claude Team).
> מי שממשיך: לקרוא את כל הקובץ לפני שנוגעים במשהו. השיחה הקודמת **לא** זמינה לך — רק הריפו, הגיליון, והזיכרון (Memory) של Claude.
> הריפו **ציבורי**: אין כאן סודות ולא מידע אישי של אנשים, וגם אתה לא מוסיף כאלה.

---

## 0. מי, מה, ואיך עובדים איתו

- **הרב יחיאל קליין**, רב קהל אונגוואר (בארא פארק). בונה עם Claude את מערכת "מוסדות אונגוואר": אתר + מאגר אנשי קשר + SMS + לוח + תצוגה בביהמ"ד + קול אונגוואר + אתר ישיבת בית שערים.
- **שפה:** תמיד לענות **בעברית**, בתוך `<div dir="rtl" align="right">…</div>`. הקהילה עצמה מדברת אידיש/אנגלית — טקסטים ציבוריים באתר באידיש/אנגלית, לא ביטויים של עברית מודרנית ("שימו לב" וכו').
- **הוא מקליד לפעמים עברית במקלדת אנגלית:** `cumg` = בוצע, `cmg` = בצע, `fi` = כן, `cmg srl c` = בצע דרך ב.
- **כלל הבנייה:** מתכננים בדיאלוג, ו**בונים רק אחרי שהוא כותב "בצע"**. גם שאלה כמו "מה צריך לעשות?" אינה "בצע".
- **אחרי כל ביצוע:** לכתוב מה נעשה ("בוצע"), האם נדרש ממנו משהו, וכמה זמן לחכות (כדי שידע אם אפשר לקום מהמחשב).
- **הדרכה:** צעד אחרי צעד, לאט, מיושר לימין. כשמבקשים ממנו ללחוץ על משהו — לתאר בדיוק איפה.
- אין לו סמארטפון (יש לו טלפון כשר + יוניהרץ אנדרואיד בלי פילטר, על WiFi + SIM של US Mobile — ראו §4.2).
- "לילה טוב" / "כשאגיד לילה טוב" = רשימת דברים לבנות כשהוא הולך לישון (ראו §6).

---

## 1. מצב נוכחי — מה רץ עכשיו ומה באמצע

| מה | איפה רץ | מצב (17/11 04:45) | הצעד הבא |
| --- | --- | --- | --- |
| **בדיקת כתובות מול JBD** (thejbd.com) | Apps Script **"Mosdos Ungvar SMS" בחשבון הדאטאבייס** (`khalungvardatabase@gmail.com`), טריגר `jbdTick` כל דקה | 129 מתוך 1,761 נבדקו (45 ✓ תואם, 3 ⚠ כתובת שונה, 6 ? אולי, 22 ? כמה אפשרויות, 53 ✗ לא נמצא). ~100 בשעה → מסתיים לבד בערך 17/11 בערב–לילה, ואז הטריגר מוחק את עצמו | הרב עובר על לשונית `JBD_Check` וכותב בעמודה `decision`. אחר כך לבנות (אחרי "בצע") עדכון Contacts לפי ה-decision. ראו §4.1 |
| **קו SMS זמני לגבאים** (718) 928-5098 | יוניהרץ + אפליקציית **SMSGate** (SMS Gateway for Android, cloud) → webhook ל-Apps Script **בחשבון הדאטאבייס**, פריסה פעילה `AKfycbzK63…O1vPZ` (גרסה 26) | עובד מקצה לקצה (נבדק). הרב רשום כגבאי + מנהל קו; הלל דוד גינזבורג מנהל קו | לבדוק שעובד גם כשמסך היוניהרץ כבוי; להוסיף טלפונים לגבאים. ראו §4.2 |
| **Toll-free ב-Telnyx** (866-830-0089, 866-796-2646) | Telnyx | נשלח מחדש 16/11 עם `https://ungvar.org/?lang=en`. סטטוס "Waiting For Telnyx" | לחכות. כשמאושר: להחליף בדף הציבורי את 1-833-646-3971 במספר Telnyx; לשקול לסגור את הקו הזמני |
| **ההעברה לחשבון admin@ungvar.org** | Google Workspace for Nonprofits | חלק גדול הועבר ב-12/11 (ראו §5). **הקו הזמני ו-JBD עדיין בפרויקט הישן של הדאטאבייס** | לפני מחיקת הדאטאבייס (~אמצע דצמבר) — להעביר אותם. ראו §4.3 |

### ⚠️ חשוב: שני פרויקטי SMS
- **הפרויקט הפעיל של האתר** הוא ה-SMS Apps Script ב-**admin@ungvar.org** (`CONFIG.SMS_URL` = `AKfycbywXAJY…7v6A`; גם ה-Worker של Cloudflare מצביע אליו מאז 12/11). שם רץ הטריגר `runJobs` (כל 5 דקות).
- **הפרויקט הישן** (`1Umt0ZqVV_pfExMvM49Rm-LhdvS8ZQs58xCxRQTuQQz1rIvLXUGsery0K`, חשבון הדאטאבייס) כבר לא משמש את האתר, אבל ב-17/11 הוספנו אליו את **JBD** ואת **הקו הזמני**. נבדק: הטריגר היחיד בו הוא `jbdTick` (אין `runJobs` כפול).
- `apps-script/sms.gs` בריפו = **הקוד של הפרויקט הישן כפי שהוא היום** (כולל gw + JBD + `grantAdminProtections`). הקוד החי ב-admin@ **לא נבדק מול הריפו** — לפני שמדביקים אליו משהו, להשוות.

---

## 2. כל המשימות הפתוחות

### 2.1 אושרו ונבנו היום (17/11) — לוודא/לעקוב
- בדיקת JBD ברקע (§4.1). לסיים: עדכון Contacts לפי `decision` — **לא נבנה עדיין, צריך "בצע"**.
- קו SMS זמני (§4.2) — נבנה ופורסם. **הובטח לרב:** גבאים שמוסיפים ב-SMS לא יופיעו באתר (נשמרים ב-`SmsGabbaim`).
- שיפור אפשרי שהוזכר: בבדיקת JBD, כשלא נמצא לפי שם — חיפוש נוסף לפי שם משפחה בלבד והתאמה לפי כתובת/טלפון (JBD לא תומך בחיפוש לפי טלפון). לא אושר.

### 2.2 מחכים להחלטה / "בצע"
- **מחיקת לשוניות זמניות:** `_claude_jbd` (לא בשימוש) ו-`_claude_backup_2026-11-16` (גיבוי לפני שינויי רשימת הרבנים) — שאלתי, אין תשובה עדיין.
- **כפתור "✓ סמן כנבדק" בעריכה מרוכזת** (bulk edit) — הוצע, לא אושר. (שמירה בעריכה מרוכזת **לא** מורידה "לא נבדק"; רק שמירה בכרטיס עם דיאלוג tgCheckQ.)
- **Excel של 527 אנשי קשר שיש להם רק "חתונה פ"ג"** מהרשימה הישנה — הוצע.
- **רשימת המשימות 26–40 ב-Tasks** (TO DO כללי, `assigned_to=all`) — להוסיף בנים/רבנים מהערות רשימת הרבנים, כתובות, קשר של צינער וכו'. הגבאים עושים.
- **מחסן (Machsan) — החלטות קודים:** הרב עובר על הקודים ב-Excel; קודים שלא הוחלטו נשארים במחסן; רשימת FW (ד"ר פאריווא) נמחקת; KLN+CL = קבוצת CLNH.
- **רשימות/Lists, Machsan decisions** — המשך מהשיחות הקודמות.
- **שלב 2 של הודעות אוטומטיות** — מתוכנן ומאושר בתוכן ב-`docs/specs/sms-auto-v2.md`; בונים רק אחרי "בצע".
- **טעינה ב-SMS** ("טעינה 20" מחייב כרטיס שמור) — לזכור כשבונים Stripe בהמשך.
- **"🔎 מי זה?"** — חיפוש מספר לא מוכר דרך Telnyx Number Lookup (כולל Caller Identity) — להזכיר לו לתכנן, לא אושר.
- **מצלמות DW Cloud** — כפתור "מצלמות" לגבאים מחוברים בלבד, צפייה חיה בכמה מצלמות — הוצע, לא אושר.
- **אתר ציבורי מלא ב-ungvar.org** (זמנים, תפילות, שמחות, שיעורים, הורדות, תרומה) והעברת האפליקציה ל-`ungvar.org/login` — בתכנון. כבר הוחלט: שורת תאריך, פרטי קשר + קישורים משפטיים בתחתית, מספר קול אונגוואר ליד השיעורים, כפתור תרומה, הורדת חוברת מצוה יומית (החודש + הבא) ולוחות, ספרי מכון משנה הלכות עם מחירים בלבד, שמחות ציבוריות, בלי מודעות.
- **אזור כולל** ("מרכז הכוללים אונגוואר" כמוסד חדש במערכת המוסדות): טופס רישום ציבורי (מייל + קוד שבחר; איפוס קוד ע"י גבאי; Gemini ממלא מתוך מסמכים; חתימה; אנגלית+אידיש; הדפסה 8.5×11). החלק "Kollel & Enrollment" נדחה — לשאול אותו בהמשך.
- **AI של הישיבה על קרדיטים** (ארנק אחד, טעינה דרך Stripe של קהל אונגוואר, ‎$0.35 עמלה, לא יורד מתחת ל-0, מחיר = עלות + 30% שלא מוצג) — "לבנות כשיגיד בצע כשהוא הולך".
- **זיהוי פנים במצלמות הכניסה** — רעיון, נדחה.
- **פלטפורמת קול אונגוואר (קו טלפון) משלנו** — שוקל אם זול מ-~$235 לחודש.
- **Sola/Donary** — שאל את Sola אם אפשר לשלוח עסקאות למכשיר Donary (CloudIM); דפי קמפיין עם Sola (לא Stripe), תורמים אחרונים, פס התקדמות, תרומה חודשית — לא אושר.
- **Stripe — בקשת הנחת עמותות** דרך טופס התמיכה "Non Profit pricing" (הטקסט וצילום IRS Pub 78 מוכנים) — לחזור לזה.
- **תשלום עליות ונדרים באתר** דרך Stripe — תוכנית.
- **נושאים ישנים פתוחים:** Claude Team לעמותות (נרשם — ראו §5), ייבוא CSV ל-Mailchimp, חימום kol@ (warm-up), אימות OAuth של Google, לוי לבדוק, העברת מיילים של beissheurim@, נתוני חסידי אלכסנדר, העברת office@ (**לא** להגדיר העברה מ-office@ ל-khalungvar@gmail.com עדיין), עדכון המייל ב-Mailchimp/Adobe/WeTransfer/OpenAI/ezcount (הרב עושה בעצמו).

### 2.3 רשימת "לילה טוב" (לבנות כשהוא הולך לישון — כל אחד צריך שיאשר)
1. **תצוגה — עדכון אוטומטי:** בודקת גרסה חדשה כל ~20 דק' וטוענת מחדש; כשאין אינטרנט ממשיכה להציג; heartbeat בכל בדיקה כדי שהאתר יראה אם התצוגה מחוברת.
2. **"חלון דילוג" בזמנים:** אם הזמן הבסיסי (למשל ר"ת) בין 18:00–19:00 → לחשב מ-19:00 ואז להוסיף דקות. + אפשרות "המאוחר/המוקדם מבין" בכל הגדרות הזמנים (שבת, חג, ימי דפגרא, תשרי — לא רק חול).
3. **תצוגה:** לוח שבת עם אותיות תוויות גדולות (בערך כגודל השעות); לוח חול = שבוע קבוע מאחרי שחרית האחרונה של שישי עד שישי הבא, לפי יום ראשון של השבוע (כולל עונות וקאמפ); שישי עדיין מראה מנחה/מעריב; מניין "חוץ מיום א'" נשאר בלוח כל השבוע אבל מדולג ב"המנין הבא" ביום ראשון.
4. **קובץ התקנה למחשב התצוגה** (Chrome, kiosk, הפעלה אוטומטית, מינימום תקלות).
5. **עזרה/הסבר בדף זמני התפילות** (איך זמנים בנויים, מה אפשר, הדלקת נרות 18 דק' לפני שקיעה וכו').
6. **"✈ כ"ק אדמו"ר שליט"א נסע":** כפתור קטן מתחת לכפתור זמני התפילות, תאריכים עבריים מ-עד (רשימה + מחיקה; כל גבאי עם הרשאת זמני תפילות; ביטול רק באתר); לכל שורת שבת "כשאד"ש לא כאן": כרגיל / מוסתר / X דקות מאוחר; בתפריט אישור ההודעות האוטומטיות של הגבאי — אפשרות 6 "כ"ק אד"ש לא נמצא בבארא פארק" (רק בהודעות עם זמנים שתלויים ברבי), שרושמת היעדרות עד אחרי שבת ושולחת מחדש עם החישוב המעודכן.
7. **AI של הישיבה על קרדיטים** (ראו למעלה).

---

## 3. כל ההחלטות וההעדפות (ריכוז)

### 3.1 ארגון ושמות
- שם האתר/הארגון: **מוסדות אונגוואר** (לא "קהל אונגוואר"). ארגון הגג: כלל מוסדות אונגוואר (Khal Ungvar, DBA Mishne Halachoth Gedoloth). 501(c)(3), EIN מסתיים ב-0829.
- ביהמ"ד: 5306 16th Ave, Brooklyn 11204. משרד: 1578 53rd St, Brooklyn 11219. טלפון עסקי (718) 851-0806.
- 3 בתי כנסת: בארא פארק, מאנסי (9 First St, Spring Valley), ירושלים; 8 כוללים (~200 אברכים). הכוללים אינם ישיבה. ישיבת בית שערים (ירושלים) היא עמותה נפרדת.
- קידומת SMS: "Ungvar" (נדון). מקור הכתובות הכי מוסמך בעיניו: JBD.

### 3.2 אנשי קשר ושמות
- שם פרטי בעברית: קודם השם העברי (Joshua → יהושע), יידיש רק כשהשם עצמו יידי; כינויים → שם מלא (Shea → יהושע, Mottie → מרדכי); שמות לא-יהודיים (George) בכתב יד; "Yitzchok Isaac" = יצחק אייזיק; Isaac לבד = אייזיק.
- תיוגים: JSON `{"p":[path ids],"s":"a|f|u|ok|auto","d":date}`; `s:'u'` = לא נבדק; `_ok` = נבדק. TagTree: `node_id, parent_id, name, sort, kind, applies, mirror`. דוגמאות: 7>90–93 רשימת רבנים (90 רבני ביהמ"ד, 91 משפחה, 92 קרובים, 93 כללי), 8>100 חתונה פ"ג, 5>73 חסידי אלכסנדר.
- קשרים: לשונית Relations (`relation_id, contact_id_a, relation_type, contact_id_b`) — תמיד בשני הכיוונים: `זון פון`↔`טאטע פון`, `איידעם פון`↔`שווער פון`, `ברודער פון`, `שוואגער פון`, `זיידע פון`↔`אייניקל פון`.
- `contact_id` מתחיל ב-2001 (1001–1735 היו ניסיון ונמחקו — לא לחזור עליהם). בגיליון: שורה = contact_id − 1999 (נכון ל-2115–5401).
- מחיקה = `deleted_at` + `deleted_by` (פח; משחזרים באתר). לא מוחקים שורות.

### 3.3 זמנים ותפילות
- הדלקת נרות 18 דק' לפני שקיעה (לוח ותצוגה). זמנים לבארא פארק (בעבר chaitables.com).
- מנחה של הרבי — תמיד המניין האחרון. שחרית 5:30 כל השנה; כשעלות אחרי 5:30 — 5 דק' אחרי עלות.
- ליל שבת: אין קידוש לפני ר"ת ולא בין 18:00–19:00; שולחן הטהור 120 דק' אחרי ר"ת, או 120 דק' אחרי 19:00 כשר"ת בין 18:00–19:00.
- שבת שהרבי לא בעיר: מנייני חול כרגיל; בשבת אין שולחן הטהור ופרקי אבות; מנחה ושלש סעודות 10 דק' מאוחר (אופציה באתר — לא אושר).
- קאמפ: חלק ממנייני החול לא מתקיימים (חלק רק בימי א'); מניין הרבי תמיד.
- זמני תפילות בארא פארק → תוכנית עצמאית שאפשר לשכפל לבתי כנסת אחרים (תוכנית 5 שלבים אושרה, נובמבר).

### 3.4 SMS
- ספק: **Telnyx** (חשבון על office@ → להעביר ל-admin@). מספרים: 866-796-2646 (שידורים/זמנים, 866-7-ZMANIM), 866-830-0089 (גבאים), 929-219-1653 (מקומי לשיחות).
- מגבלות שליחה — רק באתר, לא בהגדרות Telnyx.
- עלויות: הארגון משלם קבועים + שיח הגבאים; כל גבאי משדר על הקרדיטים שלו (נקנים ב-Stripe; ‎$0.35 לרכישה; מוגדר כתרומה).
- הודעות אוטומטיות: לכל אחת גבאי אחראי שמשלם ומאשר לפני שליחה.
- רשימות: ZMANIM SMS (Gloo "Ungvar"), מאנסי SMS (Gloo "Ungvar Monsey"), ישיבה SMS; Gloo גם "Kehilchaso" (~500).
- גבאי אחד כותב רק באנגלית — מותר לענות לו ביידיש.

### 3.5 מיילים/חשבונות
- admin@ungvar.org = חשבון המערכת היחיד (ניהול האתר וכל השירותים). office@ungvar.org = הכתובת ששולחת מיילים מהאתר. kol@ungvar.org = קול אונגוואר. beissheurim@ungvar.org = הישיבה (מועבר ל-Gmail של לוי). כמה שפחות חשבונות.
- מיילים מאתר הישיבה יוצאים מ-beissheurim@gmail.com.
- **לא** להגדיר העברה מ-office@ ל-khalungvar@gmail.com עדיין.

### 3.6 ישיבה
- משתמשים בישראל — תאריכים עבריים בכל מקום (חוץ ממסמכים משפטיים); הדפסות A4 (קבלות אמריקאיות 8.5×11).
- מערכת רישום מועמדים (אפיון של לוי — `archive/specs-from-gabbaim/`), לאט; תשלומים (Cardknox) בסוף.

### 3.7 כללי עבודה ואבטחה (חובה)
- **לעולם לא** לשמור/להשתמש ב-OAuth client secret; לא לבקש או להקליד סיסמאות (הרב מתחבר בעצמו); כרטיסים/חשבונות בנק — רק 4 ספרות אחרונות; אין מפתחות API בצ'אט; סודות נכנסים ל-Script Properties רק ע"י הרב.
- לא פותחים חשבונות ולא קונים. אישור מפורש לפני OAuth consent, פרסום, webhooks, שליחת טפסים עם מידע אישי.
- דרייב: לעולם לא מחיקה סופית (רק לפח). מחיקת טריגרים — הרב. בדיקות שמשנות מידע אמיתי — לשאול קודם. לא לגעת בלשוניות `BACKUP`.
- לא להריץ JS בלשוניות לא קשורות. לא להשתמש בסיסמת ניהול של ימות. לא לחזור על סיסמת Telnyx.
- גופנים בתשלום (Livorna, PFT_Vilna) — פרטיים, לא בריפו.
- לא למחוק את חשבון הדאטאבייס (עד שהכל הועבר — מתוכנן באמצע דצמבר). לא להתנתק/לשנות חשבונות מעבר למשימה. לא לגעת בסיסמאות שמורות ב-Chrome.
- **הריפו ציבורי** — אף פעם לא מידע אישי או מפתחות. פלטי מחסן/רבנים/JBD נשארים מחוץ לריפו. Excel החשבונות עם סיסמאות — לעולם לא ל-GitHub.
- נתוני כרטיס אשראי מטפסי נייר — AI לא קורא (רק מטשטש את האזור).
- **JBD:** רק חיפושים ממוקדים, בקצב זהיר (עד ~100 בשעה), בלי גריפה ובלי העתקת ה-eBook. עדכון המאגר רק אחרי אישור.

---

## 4. מה נבנה בשיחה האחרונה (פירוט טכני)

### 4.1 בדיקת JBD (`apps-script/sms.gs`, פונקציות `jbd*`)
- `jbdStart()` — יוצר `JBD_Check` ומתקין טריגר `jbdTick` כל דקה. `jbdStop()` עוצר. `jbdStatus()` — ספירות ושגיאה אחרונה (Script Property `JBD_ERR`).
- מי נבדק: לא מחוקים, ו(רשימת רבנים 7>90–93) או (8>100 ולא 5>73). עדיפות: 1 רבנים → 2 בלי כתובת → 3 לא נבדק → 4 נבדק (`_ok`).
- כל טיק: 1–2 חיפושים (`GET https://thejbd.com/directory-search?q=<last first>` → JSON `data[]` עם `firstName,lastName,benReb,locations[{fullAddress,telephone}]`). שגיאה → הפסקה של 10 דק'.
- התאמה: טלפון (+5), כתובת אחרי נרמול (+4), שם פרטי (+2), מיקוד (+1). סטטוסים: `✓ תואם`, `⚠ כתובת שונה`, `+ כתובת מ-JBD`, `? אולי — …`, `? כמה אפשרויות`, `✗ לא נמצא`, `— אין שם באנגלית`.
- עמודות `JBD_Check`: `contact_id, priority, name, sys_address, sys_phones, status, jbd_name, jbd_address, jbd_phone, note, checked_at, decision`.
- **לא נבנה:** החלת `decision` על Contacts.

### 4.2 קו SMS זמני לגבאים (`gw*` ב-`apps-script/sms.gs`)
- **חומרה:** Unihertz Titan Slim, SIM של US Mobile ברשת Light Speed (T-Mobile), "Light Plan". APN אם צריך: `pwg`, MCC 310, MNC 240. צריך להישאר דלוק, על WiFi ומטען; בהגדרות: SMSGate בלי Battery optimization, Background data מותר, "Start on boot" דלוק.
- **אפליקציה:** SMSGate v1.78.4 (`me.capcom.smsgateway`, הותקן מ-GitHub releases `app-release.apk`), מצב Cloud server. Username/Password שלה נמצאים **רק** ב-Script Properties `GW_USER` / `GW_PASS` (הרב הכניס).
- **חיבור:** `gwSetup()` — יוצר `GW_SECRET` חדש ורושם webhook `sms:received` ל-`GW_EXEC_URL?k=<secret>` (`GW_EXEC_URL` = הפריסה הפעילה; אפשר לדרוס עם Script Property `WEB_APP_URL`). מוחק webhooks ישנים של script.google.com. `gwStatus()` — מצב המכשיר בשרת SMSGate (lastSeen) + webhooks.
- **זרימה:** `doPost` → אם יש `event` + `?k=` → `gwInbound_` (מניעת כפילות לפי messageId, יומן ב-`SmsLog` עם `line=gw`) → `gwHandle_` → תשובה דרך `POST https://api.sms-gate.app/3rdparty/v1/messages` (Basic auth).
- **מי מורשה:** `gabbaiByPhone` — גבאים מהאתר עם טלפון בלשונית Settings (`gabbai_phone`, כמה מספרים מופרדים בפסיק) **או** לשונית `SmsGabbaim` (`name, phone, added_by, added_at, note`) — גבאים של הקו בלבד, לא מופיעים באתר. מנהלי קו: עמודה `sms_admin` (TRUE) ב-Settings — כרגע הרב והרב הלל דוד גינזבורג.
- **יכולות (רק עבודה על הרשימה):** חיפוש חכם (טלפון → כתובת → שם עם מפתחות פונטיים לעברית/יידיש/אנגלית, כינויים, Gemini לווריאנטים של שם) ברשימה **ובמחסן** (`Machsan`); כרטיס + תפריט 1 עדכון / 2 תיוג / 3 משפחה / 4 הערה / 5 מחיקה / 0 סיום; העברה מהמחסן לרשימה; הוספת איש חדש (בדיקת כפילות → כתובת/טלפון או 0 לדלג → הצעה לחפש ב-JBD → משימה ב-TO DO כללי אם חסר); כל שינוי באישור 1/2. מנהלי קו: "גבאי חדש: שם טלפון", "להסיר גבאי …" (רק גבאי קו), "הוסף מספר לגבאי …", "רשימת גבאים". תרומות/שמחות/תפוצות — חסומים בקו הזה.
- **פריסה:** כל שינוי ב-`doPost`/gw דורש פריסה חדשה (ניהול פריסות → עיפרון → גרסה חדשה → פריסה) של **אותה** פריסה (לא "פריסה חדשה"!).

### 4.3 העברת הקו הזמני ו-JBD ל-admin@ (לעשות לפני מחיקת הדאטאבייס)
1. להשוות את הקוד החי בפרויקט ה-SMS של admin@ מול `apps-script/sms.gs` ולהוסיף את החלקים `jbd*`, `gw*`, `SmsGabbaim` (ב-TABS), `gabbaiByPhone` החדש, וה-hook ב-`doPost`.
2. הרב מכניס `GW_USER`/`GW_PASS` ב-Script Properties של admin@; לעדכן `GW_EXEC_URL` לכתובת /exec של admin@ (`AKfycbywXAJY…7v6A`) ולפרוס.
3. להריץ `gwSetup()` שם (ימחק את ה-webhook הישן וירשום חדש). בדיקה עם SMS.
4. JBD: `jbdStop()` בדאטאבייס → `jbdStart()` ב-admin@ (ממשיך מאיפה שעצר — מדלג על מי שכבר ב-`JBD_Check`).

---

## 5. מבנה המערכת

### 5.1 אתר (GitHub Pages)
- ריפו: **`Khalungvar/Khal_unvar_database`** (ציבורי), ענף `main`, מוצג ב-**https://ungvar.org** (CNAME). פריסה = `git push` ל-main (Pages מתעדכן תוך ~דקה).
- **גרסאות `?v=`:** כל קבצי JS/CSS נטענים עם `?v=NNN` ב-importmap וב-CSS. בכל שחרור מעלים את המספר בכל קבצי ה-HTML (כולל `login/`, `index.html`, `machon.html` וכו'), למשל: `grep -rl 'v=704' --include=*.html . | xargs sed -i 's/v=704/v=705/g'`. **הגרסה הנוכחית: v704.**
- דפים: `index.html` (ציבורי; `?lang=en|he|yi` כופה שפה), `login/` (אפליקציית הגבאים), `display.html` (תצוגת ביהמ"ד), `shul/` (זמני תפילות לבית כנסת), `kol/` + `kolungvar/` (קול אונגוואר + ארכיון ציבורי), `yeshiva/` (אתר הישיבה, `register/`, `kitchen/`), `kollel/` (רישום כולל), `campaign.html`, `machon.html`, `about.html`, `sms.html`, `privacy.html`, `terms.html`, `refund.html`, `books/`, `help/` (מדריכים), `rel/` (גרסאות נעולות של התצוגה — `node tools/release.mjs "הערה"`).
- מודולים ב-`js/` (עיקריים): `config.js` (כתובות השרתים; אין סודות), `google.js` (לוגאין + Sheets), `data.js`, `app.js`, `tags.js`, `machsan.js` (מחסן), `lists.js`/`listsync.js`, `mailmerge.js`/`mm-render.js`, `receipts.js`, `donations.js`, `campaigns.js`/`webcamp.js`/`camptablet.js`, `simchos.js` (שהשמחה במעונם), `occasions.js`, `sms.js`, `luach/` (לוח + זמנים + shulapp), `display/`, `kol/`, `mosad/` (אתרי מוסדות, ישיבה), `public/` (האתר הציבורי), `i18n.js` (אידיש/אנגלית), `i18n-he.js`, `help*.js`, `bulkedit.js`, `faces.js`, `books.js`.
- `tools/build-luach-gs.mjs` בונה את `apps-script/luach-bundle.gs` מ-`js/luach/` (לא לערוך ידנית). `tools/deps.mjs` — סגירת תלויות.
- אפיון: `docs/SPEC.md`, `docs/specs/*.md` (SMS, Telnyx, הודעות אוטומטיות v2, mail merge, מלגות ישיבה), `docs/claude-docs/*.md` (5 המסמכים), `docs/LUACH-TITLES.md`.

### 5.2 Google Sheets
- **הגיליון הראשי** `16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY` (בבעלות החשבון האישי של הרב). לשוניות עיקריות: Contacts, Phones, Donations, Relations, Occasions, OrgNotes, Lists, SavedLists, Settings, Tasks, Messages, History, Receipts, EmailLog, Requests, Photos, Simchos (+SimchaIssues, SimchaSettings), TagTree, Machsan (מחסן — הרשימה הישנה ~8,160), Mosdos, Enrollments, Tuition, Books/BookMoves, Booklet/BookletDedications, LuachEdits/LuachZmanim, Minyanim, Kiosk, Campaigns/YearlyCampaigns/WebCampaigns/CampaignSettings, Fonts, HelpTexts, FaceEvents/FaceShots/FaceLearn, SMS: SmsLog, SmsJobs, SmsAuto, SmsInbox, SmsEvents, SmsOptIn, SmsRecordings, SmsConfig, Credits, WebSignups, **SmsGabbaim** (חדש), **JBD_Check** (חדש). זמניות: `_claude_jbd`, `_claude_backup_2026-11-16`. לא לגעת: `BACKUP 2026-10-18 *`.
- עמודות Contacts חשובות: A contact_id, C first_name_he, D last_name_he, E is_alive, H first_name_en, I last_name_en, U address, V city, W state, X zip, Y country, AK deleted_at, AL deleted_by, AM org_tags, AN name_note, AO tags.
- Tasks: `task_id, text, assigned_to ("all"=כללי), from_email, status, remind_at, done_at, done_by, contact_id, created_at, created_by, updated_at, updated_by`.
- **גיליון תצוגה** `1hhrsXNhDCK7OGXOClTPE8pxOJ3EjmTmndH0r_qrms70` (פתוח לקריאה).
- טכניקות כתיבה דרך Sheets MCP: findReplace על תא יחיד; updateCells; לשונית עזר עם ARRAYFORMULA/QUERY/FILTER ואז למחוק; גיבוי לפני שינויים גדולים.

### 5.3 Apps Script (כל פרויקט: "Execute as me, Anyone")
| פרויקט | קובץ בריפו | חשבון | שימוש |
| --- | --- | --- | --- |
| Mosdos Ungvar SMS (פעיל לאתר) | `sms.gs` | admin@ | SMS/טלפון/Stripe/runJobs. `CONFIG.SMS_URL` |
| Mosdos Ungvar SMS (ישן) | `sms.gs` (המצב הנוכחי שלו) | דאטאבייס, id `1Umt0ZqV…sery0K` | **JBD + קו זמני** בלבד כרגע |
| Guard / מוסדות | `mosad.gs` | admin@ | אתרי המוסדות (ישיבה). `MOSAD_URL` |
| Help AI | `help-ai.gs` | admin@ | עוזר AI באתר (Gemini). `HELP_AI_URL` |
| Images | `images.gs` | admin@ | תמונות לדרייב. `IMAGES_URL` |
| Kol | `kol.gs` | kol@ (project `1VjWzKuX…`) | מיילי קול אונגוואר (Gmail API). `KOL_URL` |
| Office mailer | `mailer-office.gs` | office@ (project `1T20g7YM…`) | שליחת מיילים בשם office@. `MAILER_URL` |
| Beis Sheurim mailer | `mailer-beissheurim.gs` | beissheurim@gmail.com | מיילים של הישיבה |
| לוח | `luach-bundle.gs` | בתוך פרויקט ה-SMS (קובץ `luach.gs`) | נבנה מ-`js/luach` |

רק פרויקט ה-SMS הישן נבדק מול הריפו ב-17/11 (סונכרן). השאר — להשוות לפני עריכה.

### 5.4 שירותים מחוברים (איפה כל מפתח — בלי הסודות עצמם)
| שירות | מה עושה | חשבון | איפה המפתחות |
| --- | --- | --- | --- |
| **Cloudflare** | דומיין ungvar.org (Registrar, 10 שנים), DNS, Worker `ungvar-sms` (מקבל webhooks מ-Telnyx ו-Stripe, מאמת חתימות ומעביר ל-Apps Script) | החשבון האישי (Gmail) עם 2FA במייל | Worker secrets: `APPS_SCRIPT_URL`, `SHARED_SECRET`, `TELNYX_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Telnyx** | SMS + שיחות, 3 מספרים, toll-free verification | office@ (→ להעביר ל-admin@) | Script Properties של SMS: `TELNYX_API_KEY`, `TELNYX_GABBAI_NUMBER`, `TELNYX_BROADCAST_NUMBER`, `TELNYX_VOICE_NUMBER`, `TELNYX_MESSAGING_PROFILE`, `TELNYX_TEXML_APP_ID` |
| **Stripe** | קרדיטי SMS (חי מ-2/11), בעתיד תרומות | admin@ | `STRIPE_SECRET_KEY` ב-Script Properties; webhook secret ב-Worker |
| **Gemini** | הבנת הודעות הגבאים, עוזר AI, מילוי טפסים | Google AI Studio (חשבון בתשלום) | `GEMINI_API_KEY` (+`GEMINI_MODEL` אופציונלי) ב-Script Properties של SMS ושל Help AI |
| **SMSGate** | הקו הזמני ביוניהרץ | נוצר מהאפליקציה | `GW_USER`, `GW_PASS`, `GW_SECRET` ב-Script Properties (פרויקט הדאטאבייס) |
| **Google Cloud** `khal-unvar-database` (73541082309) | OAuth לוגאין (Testing — Test users), Places/Maps API | דאטאבייס (→ להעביר) | Client ID ומפתח Maps בקוד — ציבוריים ומוגבלים לדומיין. Client secret מושבת — לא להשתמש |
| **Google Workspace for Nonprofits** | admin@, office@, kol@, beissheurim@ + 4 Shared Drives | admin@ (Admin Console) | — |
| **Gloo** | רשימות SMS הישנות (Ungvar, Ungvar Monsey, Kehilchaso) | — | — |
| **DW Cloud** | מצלמות ביהמ"ד ("Ungvar DW") | שותף עם הרב | — |
| **Sola (Cardknox) / Donary** | מכשיר אשראי לתרומות במקום; ל-Sola יש API key | חשבון Sola של קהל אונגוואר | אצל הרב |
| **Mailchimp** | המייל השבועי הישן של קול אונגוואר (מוחלף ע"י `kol/`) | — | — |
| **Chrome Remote Desktop** | גישה למחשב התצוגה ("תצוגת בית המדרש BP", DESKTOP-CLUBUDQ) | admin@ | PIN אצל הרב |
| **Goodstack** | אימות עמותה (Google, Claude) | office@ | — |
| **US Mobile** | קו 718-928-5098 ליוניהרץ | החשבון של הרב | — |
| **ימות המשיח** | (קו טלפון) | — | לא להשתמש בסיסמת הניהול |

### 5.5 מחשב התצוגה
- KINGDEL mini-PC, Windows 10, משתמש מקומי בלי סיסמה, Chrome kiosk ל-`https://ungvar.org/display.html` (נעול ל-ungvar.org), `Documents\Ungvar Display` (watchdog.ps1, start/stop .vbs), גופנים Livorna + PFT_Vilna מותקנים מקומית. מותקן גבוה — חייב לרוץ בלי מגע. הדאגה העיקרית: שלא תופיע לעולם תמונה לא ראויה.

---

## 6. בדיקות

- **אין חבילת בדיקות אוטומטית בריפו.** בשיחות קודמות בדקנו כך: שרת מקומי `python3 -m http.server 8000` מתוך הריפו, ו-**Playwright** (מותקן מראש בסביבה: `require('playwright')`, `chromium.launch()`) עם צילומי מסך. הלוגאין דורש Google — לבדיקות של המסכים הפנימיים השתמשנו ב"mockbase" (החלפת השכבה של Sheets בנתונים מדומים) שהיה בסביבה הישנה ו**לא נשמר בריפו**; צריך לבנות מחדש אם רוצים.
- Apps Script: בודקים עם `node -e "new Function(require('fs').readFileSync('apps-script/sms.gs','utf8'))"` (תחביר), ואחר כך הרצת פונקציות מהעורך ("הפעלה") + יומן ביצוע.
- קו ה-SMS הזמני: `gwStatus()` בעורך; SMS אמיתי מטלפון של גבאי; יומן `SmsLog` (`line=gw`) ו-`SmsEvents`.
- JBD: `jbdStatus()`; לשונית `JBD_Check`.
- הדפדפן המובנה (Claude desktop) — חלונות קופצים חסומים בו (כניסה עם Google, אישורי Gmail), Telnyx portal נכשל שם ב-"Security verification". לכן אישורי OAuth ופעולות כאלה — הרב עושה ב-Chrome הרגיל שלו.

---

## 7. הקמה בחשבון החדש

לכל פריט: **Claude לבד** / **צריך מהרב**.

1. **ריפו GitHub** `Khalungvar/Khal_unvar_database`
   - Claude: בקשת גישה לריפו עם `add_repo` (owner `Khalungvar`, repo `Khal_unvar_database`, access `push`), `git clone`, ואז לקרוא את הקובץ הזה, `docs/SPEC.md`, `docs/specs/`.
   - הרב: אם מופיעה שגיאת הרשאה — לחבר GitHub ב-claude.ai → Settings → Connectors, או לאשר בחלון שמופיע. (התוכנית: להעביר את GitHub ל-admin@ungvar.org.)
2. **קונקטור Google Sheets**
   - Claude: לבדוק שיש כלים `Google_Sheets`; לנסות לקרוא `Settings!A1:K1` בגיליון הראשי.
   - הרב: לחבר את Google Sheets ב-Connectors **עם חשבון שיש לו גישת עריכה לגיליון** (החשבון האישי שלו, או admin@ — שקיבל עריכה על הלשוניות המוגנות ב-12/11).
3. **Claude Docs**
   - Claude: לשחזר את 5 המסמכים מ-`docs/claude-docs/` כ-Claude Docs חדשים (כל אחד מסמך, עם הכותרת המקורית): תוכנית מעבר ל-Google Workspace של ungvar.org; הוראות הפעלה לגבאים – האתר הכללי (טיוטה); מפרט רשימות; מפרט עץ התגיות; Shehasimcha Bim'onam – Gabbai Guide.
   - הרב: לאשר אם מתבקש. (המסמכים הישנים נשארים בחשבון האישי.)
4. **הדפדפן המובנה** (Claude desktop → חלונית Browser)
   - Claude: להפעיל (`enable__mcp__remote-devices__Claude_Browser`), לקרוא את ה-skill שלו.
   - הרב: לאשר אתרים כשמתבקש: `script.google.com`, `docs.google.com` (גיליונות), `thejbd.com` (רק לחיפושים ממוקדים), `ungvar.org`, `github.com`, `portal.telnyx.com`, `dashboard.stripe.com`, `dash.cloudflare.com`, `admin.google.com`, `app.usmobile.com`, `mail.google.com`. ולהתחבר בעצמו לחשבונות (בעיקר חשבון הדאטאבייס ו-admin@ ב-script.google.com).
5. **תיקיות במחשב של הרב**
   - Claude: `get_device_info` / `device_list_dir` כדי לראות מה מחובר.
   - הרב: לחבר תיקייה אם רוצה שיעבדו על קבצים מקומיים (למשל תיקיית InDesign של הלוח, או ה-Excel של קודי המחסן).
6. **משימות מתוזמנות** — לא היו משימות מתוזמנות של Claude בשיחה האחרונה. הטריגרים של Google (jbdTick, runJobs, שליחת מיילים) רצים בתוך Apps Script ולא צריכים כלום. אם רוצים תזכורת (למשל לבדוק את JBD_Check בערב, או לבדוק אישור Telnyx כל יום) — ליצור משימה מתוזמנת חדשה באישור הרב.
7. **זיכרון Claude (Memory)** — אם החשבון החדש לא רואה את הזיכרון הישן: לקרוא את הקובץ הזה; העדפות הרב בסעיף 0 ו-3.
8. **קבצים שאינם בריפו** — Excel של רשימות, PDF של רשימת הרבנים, גופני הלוח, ספר מצות המלך PDF, סרטון דמו — אצל הרב. אם צריך: הרב מעלה מחדש לשיחה (ראו `archive/README.md`).
9. **לחפש במחשב של הרב את הקבצים ששמרנו + את תמליל השיחה**
   - Claude: בתחילת העבודה **לבקש מהרב** לחבר את התיקייה שבה שמר אותם (בקשת גישה לתיקייה דרך הקישור למחשב), ואז לחפש לפי השמות (`device_list_dir` רקורסיבי / חיפוש בשמות). אם לא נמצאים — לשאול איפה שמר.
   - הקבצים לחפש (מידע אישי — לא להעלות לריפו):
     - `שיחה עם Claude - 16-17.11.2026.md` — **תמליל השיחה האחרונה** (כולל סיכומי החלקים המוקדמים). כשצריך לדעת מה הוחלט/נאמר — לחפש בו (grep) לפני שמנחשים או שואלים.
     - `קהל אונגוואר + חתונה פג - לאתר (מלא).xlsx`
     - `קהל אונגוואר - פראבע 25.xlsx`
     - `בית שערים - החסרים (112 תלמידים).xlsx`
     - `חתונה פג - החסרים (71).xlsx`
     - `ישיבת בית שערים ירושלים - לאתר.xlsx`
     - `פת שחרית - בדיקה מול אנשי קשר.xlsx`, `פת שחרית היסטוריה - לבדיקה.xlsx`, `פת שחרית שטר - בדיקה מול אנשי קשר.xlsx`
     - `רשימת רבנים - סיכום הסימונים.xlsx`, `רשימת רבנים - ההערות בכתב יד.pdf`
     - גופני הלוח (`EFT_*.ttf`, `FontbitLivorna*.ttf`, `Guttman David-Bold.TTF` וכו'), `חלק_ב_מצות_המלך_יא_אייר_תשפב__1_.pdf`, `ungvar-demo1.mp4`
   - הרב: לחבר את התיקייה כשמתבקש (לחיצה על אישור).
10. **בדיקה ראשונה בחשבון החדש** (Claude, אחרי שהכל מחובר): לקרוא `JBD_Check` (כמה נבדקו), `SmsLog` עם `line=gw` (האם הקו עובד), ולענות לרב מה המצב.

---

## 8. סודות — איפה הם (אין סודות שקיימים רק בסביבת Claude)
- כל המפתחות שמורים ב-**Script Properties** של פרויקטי Apps Script, ב-**Cloudflare Worker secrets**, או אצל הרב. אף מפתח לא נשמר בסביבת העבודה של Claude.
- נחשפו בשיחה (לא סודיים במיוחד, אבל טוב לדעת): `GW_SECRET` הוחלף אחרי שהופיע בצילום מסך; הערך הנוכחי רק ב-Script Properties. ה-Username/Password של SMSGate הוקלדו ע"י הרב ישירות ב-Script Properties.

---

## 9. היסטוריה קצרה של השיחה האחרונה (16–17/11/2026)
- העברת Gmail/דרייב של kolungvar@gmail.com ל-kol@ungvar.org, וניקוי הדרייב הישן (פח 30 יום).
- רשימת הרבנים: ההערות בכתב יד של האדמו"ר עובדו → 124 תיוגים, 102 מחיקות; משימות 26–40 ב-TO DO; 3591 שוחזר; תיוג 3741 הוסר. (קבצי הסיכום אצל הרב — מידע אישי.)
- Toll-free: נדחה → נשלח מחדש עם `?lang=en` (v704) והסבר מעודכן.
- קו US Mobile ליוניהרץ: Warp לא עבד (SIM של T-Mobile/Sprint) → הועבר ל-Light Speed → עובד.
- JBD: נבדק שאין חסימה (Apache, בלי Cloudflare) → הבדיקה הועברה ל-Apps Script כדי לא להיות תלויה ב-Claude.
- נבנה הקו הזמני לגבאים (§4.2) + מנהלי קו + SmsGabbaim.
- הרב נרשם ל-Claude Team ("Khal Ungvar": office@ בכסא Standard, החשבון האישי בכסא Premium); המנוי האישי Max בוטל ב-17/11.
