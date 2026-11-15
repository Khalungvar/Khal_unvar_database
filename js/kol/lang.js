// 📻 קול אונגוואר — השפות של המסך (אידיש / עברית / English), לפי השפה שנבחרה באתר הכללי.
// המקור כתוב בעברית; כאן: עברית → [אידיש, אנגלית]. תוכן המייל עצמו לא מתורגם.
// L(he, vars) — תרגום מפורש; tr(text) — טקסט שלם (גם עם {משתנים}); watch(el) — מתרגם לבד כל מה שמופיע במסך.
import { getLang } from '../i18n.js?v=702';

const D = {
  // ---- כללי
  'טוען…': ['לאדט…', 'Loading…'],
  'המערכת עוד לא מחוברת.': ['די סיסטעם איז נאך נישט פארבונדן.', 'The system is not connected yet.'],
  'לנסות שוב': ['פרובירן נאכאמאל', 'Try again'],
  'חזרה': ['צוריק', 'Back'],
  'הגדרות': ['איינשטעלונגען', 'Settings'],
  'לוגו, ראש ותחתית של המייל': ['לאגא, קאפ און פוס פונעם אימעיל', 'Logo, header and footer of the email'],
  'קול אונגוואר': ['קול אונגוואר', 'Kol Ungvar'],
  'אימייל שבועי': ['וועכנטליכער אימעיל', 'Weekly email'],
  'אימייל חד פעמי': ['איינמאליגער אימעיל', 'One-time email'],
  'שמירה, ממתינים לשליחה': ['אפהיטן, ווארטן צו שיקן', 'Saved, waiting to be sent'],
  'ארכיון מנהלים': ['ארכיוו פאר די מנהלים', 'Admin archive'],
  'כל מה שנשלח · תמונות בלי לוגו': ['אלעס וואס איז געשיקט געווארן · בילדער אן לאגא', 'Everything sent · photos without logo'],
  'הדף הציבורי (ungvar.org/kolungvar)': ['דער עפנטליכער בלאט (ungvar.org/kolungvar)', 'Public page (ungvar.org/kolungvar)'],
  'הגדרות (לוגו, ראש ותחתית)': ['איינשטעלונגען (לאגא, קאפ און פוס)', 'Settings (logo, header and footer)'],
  'שולח: {f} · נשארו היום: {q} מיילים': ['שיקט פון: {f} · געבליבן היינט: {q} אימעילס', 'Sender: {f} · Left today: {q} emails'],
  // ---- חד פעמי
  '(בלי שם)': ['(אן נאמען)', '(no name)'],
  'נשלח {a} · {n} נמענים': ['געשיקט {a} · {n} באקומער', 'Sent {a} · {n} recipients'],
  'עודכן {a} · {u}': ['געטוישט {a} · {u}', 'Updated {a} · {u}'],
  'שכפול': ['קאפירן', 'Duplicate'],
  'פתיחה': ['עפענען', 'Open'],
  'אימייל חד פעמי חדש': ['נייער איינמאליגער אימעיל', 'New one-time email'],
  'ממתינים לשליחה': ['ווארטן צו שיקן', 'Waiting to be sent'],
  'אין.': ['נישטא.', 'None.'],
  'נשלחו לאחרונה': ['לעצטנס געשיקט', 'Recently sent'],
  'אין עדיין. (העותקים המלאים — ב"דואר יוצא" של kol@ungvar.org)': ['נאך נישטא. (די פולע קאפיעס — אין "געשיקטע" פון kol@ungvar.org)', 'None yet. (Full copies are in the Sent folder of kol@ungvar.org)'],
  'עותק': ['קאפיע', 'copy'],
  'למחוק את "{x}"?': ['אויסמעקן "{x}"?', 'Delete "{x}"?'],
  // ---- עורך טקסט
  'קטן': ['קליין', 'Small'], 'רגיל-': ['געווענליך-', 'Normal-'], 'רגיל': ['געווענליך', 'Normal'], 'בינוני': ['מיטל', 'Medium'],
  'גדול': ['גרויס', 'Large'], 'גדול מאוד': ['זייער גרויס', 'Very large'], 'כותרת': ['קעפל', 'Title'],
  'גופן': ['שריפט', 'Font'], 'גודל': ['גרייס', 'Size'], 'מודגש': ['פעט', 'Bold'], 'נטוי': ['שיף', 'Italic'], 'קו תחתון': ['אונטערגעשטראכן', 'Underline'],
  'צבע אותיות': ['קאליר פון די אותיות', 'Text color'], 'צבע רקע לטקסט': ['הינטערגרונט פארן טעקסט', 'Text highlight'],
  'ימין': ['רעכטס', 'Right'], 'מרכז': ['אין מיטן', 'Center'], 'שמאל': ['לינקס', 'Left'], 'מיושר': ['גלייך', 'Justified'],
  'קישור': ['לינק', 'Link'], 'תגית {פרשת השבוע}': ['טאג {פרשת השבוע}', 'Tag {פרשת השבוע}'],
  'תגית {תאריך} — התאריך העברי של יום הפרסום': ['טאג {תאריך} — דער אידישער דאטום פונעם טאג וואס מ\'שיקט', 'Tag {תאריך} — the Hebrew date of the publishing day'],
  'ניקוי עיצוב': ['אראפנעמען די פארמאט', 'Clear formatting'],
  'קודם לסמן טקסט.': ['צייכנט קודם א טעקסט.', 'Select some text first.'],
  'כתובת הקישור (https://…):': ['די אדרעס פונעם לינק (https://…):', 'Link address (https://…):'],
  // ---- חיתוך
  'חיתוך': ['אפשניידן', 'Crop'],
  'גוררים עם העכבר מלבן על החלק שרוצים להשאיר.': ['שלעפט מיטן מויז א פירעק אויפן טייל וואס מ\'וויל לאזן.', 'Drag a rectangle with the mouse over the part to keep.'],
  'בלי חיתוך (כל התמונה)': ['נישט אפשניידן (דאס גאנצע בילד)', 'No crop (whole image)'],
  'ביטול': ['אפזאגן', 'Cancel'],
  // ---- העורך
  'אם יפורסם היום:': ['אויב מ\'שיקט היינט:', 'If published today:'],
  'נשלח {a} ל-{n} נמענים': ['געשיקט {a} צו {n} באקומער', 'Sent {a} to {n} recipients'],
  'אי אפשר לערוך מייל שנשלח.': ['מ\'קען נישט טוישן אן אימעיל וואס איז שוין געשיקט.', 'A sent email cannot be edited.'],
  'שם פנימי (רק לכם)': ['אינערליכער נאמען (נאר פאר אייך)', 'Internal name (only for you)'],
  'למשל: הזמנה לדינער': ['למשל: איינלאדונג צום דינער', 'e.g. Dinner invitation'],
  'נושא המייל': ['דער נושא פונעם אימעיל', 'Email subject'],
  'נושא — אפשר {פרשת השבוע}': ['נושא — מ\'קען {פרשת השבוע}', 'Subject — {פרשת השבוע} allowed'],
  'הוספה:': ['צולייגן:', 'Add:'],
  'עיצוב כללי': ['אלגעמיינער אויסזען', 'General look'],
  'רקע מסביב': ['הינטערגרונט ארום', 'Outer background'],
  'רקע המייל': ['הינטערגרונט פונעם אימעיל', 'Email background'],
  'צבע טקסט': ['קאליר פונעם טעקסט', 'Text color'],
  'לשמור כברירת מחדל למיילים הבאים': ['אפהיטן אלס דיפאלט פאר די קומענדיגע אימעילס', 'Save as default for future emails'],
  'ראש ותחתית מיוחדים למייל הזה (אחרת — מה שב־⚙ הגדרות)': ['א באזונדערער קאפ און פוס פאר דעם אימעיל (אנדערש — וואס אין ⚙ איינשטעלונגען)', 'Custom header and footer for this email (otherwise — from ⚙ Settings)'],
  'שמירה': ['אפהיטן', 'Save'],
  'שלח ניסיון אליי': ['שיק א פרוב צו מיר', 'Send me a test'],
  'מחיקת הטיוטה': ['אויסמעקן דעם דראפט', 'Delete the draft'],
  'מחיקה': ['אויסמעקן', 'Delete'],
  'רשימת התפוצה': ['די רשימה', 'Mailing list'],
  'פרסום': ['פארעפנטליכן', 'Publish'],
  'תצוגה מקדימה': ['ווי עס וועט אויסזען', 'Preview'],
  'טלפון': ['טעלעפאן', 'Phone'],
  'נשמר {a} · {u}': ['אפגעהיט {a} · {u}', 'Saved {a} · {u}'],
  'נשמר {a}': ['אפגעהיט {a}', 'Saved {a}'],
  'עוד לא נשמר': ['נאך נישט אפגעהיט', 'Not saved yet'],
  'שומר…': ['היט אפ…', 'Saving…'],
  '⚠ לא נשמר': ['⚠ נישט אפגעהיט', '⚠ Not saved'],
  'לא נשמר עדיין…': ['נאך נישט אפגעהיט…', 'Not saved yet…'],
  'יש שינויים שלא נשמרו': ['ס\'זענען דא ענדערונגען וואס זענען נישט אפגעהיט', 'There are unsaved changes'],
  'נשמר כברירת מחדל.': ['אפגעהיט אלס דיפאלט.', 'Saved as default.'],
  'שולח…': ['שיקט…', 'Sending…'],
  'נשלח ניסיון ל-{x}.': ['א פרוב איז געשיקט צו {x}.', 'Test sent to {x}.'],
  'למחוק את כל הטיוטה הזו?\nאי אפשר לשחזר.': ['אויסמעקן דעם גאנצן דראפט?\nמ\'קען עס נישט צוריקברענגען.', 'Delete this whole draft?\nThis cannot be undone.'],
  'נמחק.': ['אויסגעמעקט.', 'Deleted.'],
  'נמענים': ['באקומער', 'recipients'],
  '{n} הסירו את עצמם (לא יקבלו)': ['{n} האבן זיך אראפגענומען (וועלן נישט באקומען)', '{n} unsubscribed (will not receive)'],
  'טוען את רשימת הנמענים…': ['לאדט די רשימה פון באקומער…', 'Loading the recipients…'],
  'לא הצלחתי לטעון את אנשי הקשר:': ['ס\'האט נישט געקענט לאדן די קאנטאקטן:', 'Could not load the contacts:'],
  'המייל גדול ({kb}KB). ב-Gmail מייל מעל ~100KB נחתך באמצע עם "[ההודעה נחתכה]", וזה גם פוגע במוניטין.\nכדאי לקצר טקסט / לפצל לשני מיילים.\n\nלשלוח בכל זאת?': ['דער אימעיל איז גרויס ({kb}KB). אין Gmail ווערט אן אימעיל העכער ~100KB אפגעשניטן אין מיטן, און עס שאדט אויך דעם שם.\nבעסער פארקירצן / צעטיילן אויף צוויי אימעילס.\n\nסיי ווי שיקן?', 'The email is large ({kb}KB). Gmail clips emails over ~100KB ("[Message clipped]"), which also hurts reputation.\nBetter to shorten or split into two emails.\n\nSend anyway?'],
  'תמונה…': ['בילד…', 'image…'],
  'הגליון → תמונה…': ['דער גליון → בילד…', 'Gilyon → image…'],
  'לוגו': ['לאגא', 'Logo'],
  // ---- זמני שבת / שמחות
  'טוען מגיליון התצוגה…': ['לאדט פונעם גיליון פונעם מסך…', 'Loading from the display sheet…'],
  'רק במייל הזה': ['נאר אין דעם אימעיל', 'Only in this email'],
  'קבוע (כל שבוע)': ['שטענדיג (יעדע וואך)', 'Permanent (every week)'],
  'בסוף': ['צום סוף', 'At the end'],
  'שם, למשל: שיעור לפני מנחה': ['נאמען, למשל: שיעור פאר מנחה', 'Name, e.g. Shiur before Mincha'],
  'אחרי': ['נאך', 'After'],
  'שורה מתחת': ['שורה אונטן', 'Line below'],
  'הכותרת והשורה — קבועות לכל שבוע': ['דער קעפל און די שורה — שטענדיג פאר יעדע וואך', 'Title and line — permanent for every week'],
  'תגיות:': ['טאגס:', 'Tags:'],
  'תגיות: {פרשת השבוע} {תאריך}': ['טאגס: {פרשת השבוע} {תאריך}', 'Tags: {פרשת השבוע} {תאריך}'],
  'להציג': ['ווייזן', 'Show'],
  'שם': ['נאמען', 'Name'],
  'שעה': ['צייט', 'Time'],
  'אין זמנים בגיליון.': ['קיין זמנים אין גיליון.', 'No times in the sheet.'],
  'שורות נוספות': ['נאך שורות', 'Extra rows'],
  'שורה': ['שורה', 'Row'],
  'לחשב מחדש מהגיליון (מבטל שינויים במייל הזה)': ['אויסרעכענען פון ניי פונעם גיליון (מעקט אויס די ענדערונגען אין דעם אימעיל)', 'Recalculate from the sheet (discards changes in this email)'],
  'שינוי שם / שעה / הסתרה — רק במייל הזה. בפרסום הקופסה נצרבת לתמונה. לא עולה לארכיון.': ['טוישן נאמען / צייט / באהאלטן — נאר אין דעם אימעיל. ביים שיקן ווערט די קעסטל א בילד. גייט נישט ארויף צום ארכיוו.', 'Changing name / time / hiding — only in this email. On publish the box becomes an image. Not archived.'],
  'גליון קודם': ['פריערדיגער גליון', 'Previous gilyon'],
  'גליון הבא': ['קומענדיגער גליון', 'Next gilyon'],
  'מכין את הגליון…': ['גרייט צו דעם גליון…', 'Preparing the gilyon…'],
  '{n} עמודים בגליון — במייל הם מחוברים לתמונה אחת ארוכה.': ['{n} בלעטער אינעם גליון — אינעם אימעיל זענען זיי צוזאמענגעשטעלט אין איין לאנג בילד.', '{n} pages in the gilyon — in the email they are joined into one long image.'],
  'אין שמחות בגליון הזה. (הקופסה לא תופיע במייל)': ['קיין שמחות אין דעם גליון. (די קעסטל וועט זיך נישט ווייזן אינעם אימעיל)', 'No simchos in this gilyon. (The box will not appear in the email)'],
  'לרענן מהגליון': ['דערהיינטיגן פונעם גליון', 'Refresh from the gilyon'],
  'לפתוח את הגליון לעריכה': ['עפענען דעם גליון צו טוישן', 'Open the gilyon to edit'],
  'את השמחות, הסדר, הנוסח, הגופן והרקע עורכים בגליון ("שהשמחה במעונם"). בפרסום הגליון נצרב לתמונה. לא עולה לארכיון.': ['די שמחות, דעם סדר, דעם נוסח, דעם שריפט און דעם הינטערגרונט טוישט מען אינעם גליון ("שהשמחה במעונם"). ביים שיקן ווערט דער גליון א בילד. גייט נישט ארויף צום ארכיוו.', 'Simchos, order, wording, font and background are edited in the gilyon ("שהשמחה במעונם"). On publish the gilyon becomes an image. Not archived.'],
  'למשל: משפחת … לרגל …': ['למשל: משפחת … לרגל …', 'e.g. משפחת … לרגל …'],
  'לחזור לנוסח מהגיליון': ['צוריק צום נוסח פונעם גיליון', 'Back to the sheet wording'],
  'אין כרגע שמחות ברשימה של מסך התצוגה.': ['איצט זענען נישטא קיין שמחות אויפן מסך.', 'No simchos on the display screen right now.'],
  'שמחות נוספות': ['נאך שמחות', 'Extra simchos'],
  'שמחה': ['שמחה', 'Simcha'],
  'לטעון מחדש מהגיליון': ['לאדן פון ניי פונעם גיליון', 'Reload from the sheet'],
  'שינוי נוסח (טקסט פשוט) / הסתרה — רק במייל הזה. בפרסום הקופסה נצרבת לתמונה. לא עולה לארכיון.': ['טוישן דעם נוסח / באהאלטן — נאר אין דעם אימעיל. ביים שיקן ווערט די קעסטל א בילד. גייט נישט ארויף צום ארכיוו.', 'Changing wording / hiding — only in this email. On publish the box becomes an image. Not archived.'],
  '✓ עודכן מהגיליון.': ['✓ דערהיינטיגט פונעם גיליון.', '✓ Updated from the sheet.'],
  '✓ נשמר כקבוע לכל שבוע.': ['✓ אפגעהיט שטענדיג פאר יעדע וואך.', '✓ Saved as permanent for every week.'],
  '{n} עמודים': ['{n} בלעטער', '{n} pages'],
  'עמוד אחד בגליון.': ['איין בלאט אינעם גליון.', 'One page in the gilyon.'],
  'עמוד אחד': ['איין בלאט', 'One page'],
  'אין שמחות': ['קיין שמחות', 'No simchos'],
  'מהגליון · לא לארכיון': ['פונעם גליון · נישט צום ארכיוו', 'From the gilyon · not archived'],
  'כמו שיצא במייל': ['ווי עס איז ארויס אינעם אימעיל', 'As it went out in the email'],
  'מתמלא לבד מגיליון התצוגה': ['פילט זיך אליין פונעם גיליון פונעם מסך', 'Filled automatically from the display sheet'],
  'עם שינויים': ['מיט ענדערונגען', 'with changes'],
  'לא לארכיון': ['נישט צום ארכיוו', 'not archived'],
  // ---- רכיבים
  'מודעה': ['מודעה', 'Ad'], 'תמונה': ['בילד', 'Photo'], 'קובץ מצורף': ['צוגעלייגטע טעקע', 'Attachment'], 'טקסט': ['טעקסט', 'Text'],
  'וידאו': ['ווידעא', 'Video'], 'כפתור': ['קנעפל', 'Button'], 'שהשמחה במעונם': ['שהשמחה במעונם', 'Simchos'],
  'זמני שבת / יום טוב': ['זמני שבת / יום טוב', 'Shabbos / Yom Tov times'],
  '(ריק)': ['(ליידיג)', '(empty)'], '(בלי כיתוב)': ['(אן טעקסט)', '(no label)'], '(בלי קישור)': ['(אן לינק)', '(no link)'],
  '(בלי קובץ)': ['(אן טעקע)', '(no file)'], '(בלי תמונה)': ['(אן בילד)', '(no image)'], '{n} תמונות': ['{n} בילדער', '{n} photos'],
  'לעלות גם לדף הציבורי': ['ארויפלייגן אויך אויפן עפנטליכן בלאט', 'Also post to the public page'],
  'לארכיון': ['צום ארכיוו', 'To archive'],
  'למעלה': ['ארויף', 'Up'], 'למטה': ['אראפ', 'Down'], 'סגירה': ['צומאכן', 'Close'], 'עריכה': ['טוישן', 'Edit'],
  'עוד אין כלום. מוסיפים רכיבים מהכפתורים למטה.': ['נאך גארנישט. לייגט צו טיילן מיט די קנעפלעך אונטן.', 'Nothing yet. Add parts with the buttons below.'],
  'למחוק את ה{x}?': ['אויסמעקן: {x}?', 'Delete: {x}?'],
  'רקע לרכיב': ['הינטערגרונט פארן טייל', 'Part background'],
  'בלי רקע': ['אן הינטערגרונט', 'No background'],
  'יישור': ['אויסגלייכן', 'Alignment'],
  'סיבוב 90°': ['דרייען 90°', 'Rotate 90°'],
  'לפני': ['פריער', 'Before'],
  'הסרה': ['אראפנעמען', 'Remove'],
  'הוספת מודעה לאותה קבוצה': ['צולייגן א מודעה צו דער זעלבער גרופע', 'Add an ad to the same group'],
  'בחירת מודעה (JPG / PNG / GIF / PDF)': ['אויסקלייבן א מודעה (JPG / PNG / GIF / PDF)', 'Choose an ad (JPG / PNG / GIF / PDF)'],
  'קישור בלחיצה על המודעה (רשות)': ['לינק ביים קליקן אויף דער מודעה (אויב מ\'וויל)', 'Link when clicking the ad (optional)'],
  '📄 PDF: בלחיצה נפתח ה-PDF המלא (אם לא כתבתם קישור אחר).': ['📄 PDF: ביים קליקן עפנט זיך דער פולער PDF (אויב מ\'האט נישט געשריבן אן אנדער לינק).', '📄 PDF: clicking opens the full PDF (unless you wrote another link).'],
  'טקסט מתחת למודעה': ['טעקסט אונטער דער מודעה', 'Text under the ad'],
  'להוסיף את הלוגו': ['צולייגן דעם לאגא', 'Add the logo'],
  'מקום': ['ארט', 'Position'],
  'למטה שמאל': ['אונטן לינקס', 'Bottom left'], 'למטה ימין': ['אונטן רעכטס', 'Bottom right'], 'למעלה שמאל': ['אויבן לינקס', 'Top left'], 'למעלה ימין': ['אויבן רעכטס', 'Top right'],
  'הוספת תמונות לאותו מעמד': ['צולייגן בילדער צום זעלבן מעמד', 'Add photos to the same event'],
  'בחירת תמונות': ['אויסקלייבן בילדער', 'Choose photos'],
  'סידור': ['סדר', 'Layout'],
  'אחת מתחת לשנייה': ['איינס אונטער די אנדערע', 'One under the other'],
  'שתיים בשורה': ['צוויי אין א שורה', 'Two per row'],
  'אפשר לבחור כמה תמונות ביחד. ⟳ סיבוב · ✂ חיתוך. הלוגו מוצג בתצוגה המקדימה, ונצרב בתמונה רק בפרסום (ובשליחת ניסיון).': ['מ\'קען אויסקלייבן עטלעכע בילדער צוזאמען. ⟳ דרייען · ✂ אפשניידן. דער לאגא ווייזט זיך ביים פארקוקן, און ווערט אריינגעברענט אינעם בילד נאר ביים שיקן (און ביי א פרוב).', 'You can choose several photos at once. ⟳ rotate · ✂ crop. The logo shows in the preview and is burned into the photo only on publish (and on a test send).'],
  'החלפת לוגו': ['טוישן דעם לאגא', 'Change logo'],
  'טקסט מתחת לתמונה': ['טעקסט אונטערן בילד', 'Text under the photo'],
  'קישור לעוד תמונות מהמעמד (רשות)': ['לינק צו נאך בילדער פונעם מעמד (אויב מ\'וויל)', 'Link to more photos of the event (optional)'],
  'כיתוב הכפתור': ['דער טעקסט אויפן קנעפל', 'Button label'],
  'לעוד תמונות מהמעמד': ['לעוד תמונות מהמעמד', 'לעוד תמונות מהמעמד'],
  'צבע הכפתור': ['קאליר פונעם קנעפל', 'Button color'],
  'צבע הכיתוב': ['קאליר פונעם טעקסט', 'Label color'],
  'בחירת קובץ': ['אויסקלייבן א טעקע', 'Choose a file'],
  'לצרף את הקובץ גם כקובץ מצורף למייל (עד 20MB) — אחרת רק קישור להורדה': ['צולייגן די טעקע אויך אלס צוגעלייגטע טעקע צום אימעיל (ביז 20MB) — אנדערש נאר א לינק צום אראפנעמען', 'Also attach the file to the email (up to 20MB) — otherwise only a download link'],
  'מודעה / תמונה שקשורה לקובץ (רשות)': ['א מודעה / בילד וואס געהערט צו דער טעקע (אויב מ\'וויל)', 'Ad / image for the file (optional)'],
  'טקסט': ['טעקסט', 'Text'],
  'כיתוב כפתור ההורדה': ['דער טעקסט אויפן קנעפל צום אראפנעמען', 'Download button label'],
  'להורדת {x}': ['להורדת {x}', 'להורדת {x}'],
  'להורדת הקובץ': ['להורדת הקובץ', 'להורדת הקובץ'],
  'קישור לסרטון בדרייב (פתוח לכל מי שיש לו קישור)': ['לינק צום ווידעא אין דרייוו (אפן פאר יעדן מיטן לינק)', 'Link to the video in Drive (open to anyone with the link)'],
  'לצפייה בסרטון': ['לצפייה בסרטון', 'לצפייה בסרטון'],
  'תמונה מקדימה (רשות — אחרת כפתור ▶)': ['א בילד פארנט (אויב מ\'וויל — אנדערש א ▶ קנעפל)', 'Preview image (optional — otherwise a ▶ button)'],
  'בלחיצה נפתח דף שלנו (ungvar.org/kolungvar) שמנגן את הסרטון — מתאים גם למי שיש לו פילטר שבו ungvar.org פתוח.': ['ביים קליקן עפנט זיך אונזער בלאט (ungvar.org/kolungvar) וואס שפילט דעם ווידעא — פאסט אויך פאר ווער עס האט א פילטער וואו ungvar.org איז אפן.', 'Clicking opens our page (ungvar.org/kolungvar) which plays the video — works also with filters where ungvar.org is open.'],
  'למשל: לתרומה': ['למשל: לתרומה', 'e.g. לתרומה'],
  'זה לא נראה כמו קישור לדרייב.': ['דאס זעט נישט אויס ווי א לינק צו דרייוו.', 'This does not look like a Drive link.'],
  'מעלה': ['לייגט ארויף', 'Uploading'],
  'מעלה…': ['לייגט ארויף…', 'Uploading…'],
  '⏳ מעלה…': ['⏳ לייגט ארויף…', '⏳ Uploading…'],
  'ה-GIF גדול מדי (עד 8MB).': ['דער GIF איז צו גרויס (ביז 8MB).', 'The GIF is too large (up to 8MB).'],
  'ה-PDF גדול מדי (עד 20MB).': ['דער PDF איז צו גרויס (ביז 20MB).', 'The PDF is too large (up to 20MB).'],
  'הקובץ הועלה, אבל לא נפתח לכולם — ייתכן שלא יופיע במייל.': ['די טעקע איז ארויפגעלייגט, אבער נישט אפן פאר אלע — עס קען זיך נישט ווייזן אינעם אימעיל.', 'The file was uploaded but is not public — it may not show in the email.'],
  'הקובץ הועלה, אבל לא נפתח לכולם — ייתכן שלא יופיע במייל. לבדוק את הגדרות השיתוף של Workspace.': ['די טעקע איז ארויפגעלייגט, אבער נישט אפן פאר אלע — עס קען זיך נישט ווייזן אינעם אימעיל. קוקט די שיתוף איינשטעלונגען פון Workspace.', 'The file was uploaded but is not public — it may not show in the email. Check the Workspace sharing settings.'],
  'להסיר את התמונה?': ['אראפנעמען דאס בילד?', 'Remove the photo?'],
  'אי אפשר לערוך GIF (הוא יפסיק לזוז). מסובבים / חותכים אותו לפני ההעלאה.': ['מ\'קען נישט טוישן א GIF (ער וועט אויפהערן זיך רירן). דרייט / שניידט אים פאר\'ן ארויפלייגן.', 'A GIF cannot be edited (it would stop moving). Rotate / crop it before uploading.'],
  '⏳ הופך את העמוד הראשון לתמונה…': ['⏳ מאכט דעם ערשטן בלאט פאר א בילד…', '⏳ Turning the first page into an image…'],
  '✓ הועלה': ['✓ ארויפגעלייגט', '✓ Uploaded'],
  'הקובץ גדול מדי (עד 20MB).': ['די טעקע איז צו גרויס (ביז 20MB).', 'The file is too large (up to 20MB).'],
  // ---- פרסום
  'המייל ריק.': ['דער אימעיל איז ליידיג.', 'The email is empty.'],
  'חסר נושא.': ['ס\'פעלט א נושא.', 'Subject is missing.'],
  'רשימת הנמענים עוד לא נטענה.': ['די רשימה פון באקומער איז נאך נישט געלאדנט.', 'The recipients are not loaded yet.'],
  'אין נמענים ברשימה "{x}".': ['קיין באקומער אין דער רשימה "{x}".', 'No recipients in the list "{x}".'],
  'נשארו היום רק {q} מיילים, וברשימה {n}. אפשר לשלוח עכשיו חלק, ולהמשיך מחר (מי שכבר קיבל — לא יקבל שוב).': ['היינט זענען נאר געבליבן {q} אימעילס, און אין דער רשימה {n}. מ\'קען שיקן א טייל איצט און ווייטער מארגן (ווער עס האט שוין באקומען — וועט נישט באקומען נאכאמאל).', 'Only {q} emails left today, and the list has {n}. You can send part now and continue tomorrow (whoever got it will not get it again).'],
  'לשלוח את "{s}" ל-{n} נמענים ברשימה "{l}"?\nאחרי השליחה אי אפשר לבטל.': ['שיקן "{s}" צו {n} באקומער אין דער רשימה "{l}"?\nנאכן שיקן קען מען נישט צוריקנעמען.', 'Send "{s}" to {n} recipients in the list "{l}"?\nThis cannot be undone after sending.'],
  '🚀 פרסום': ['🚀 פארעפנטליכן', '🚀 Publish'],
  '📨 שלח ניסיון אליי': ['📨 שיק א פרוב צו מיר', '📨 Send me a test'],
  '⏳ שולח…': ['⏳ שיקט…', '⏳ Sending…'],
  '{n} נשלחו · ממשיך בעוד {t} שנ\'…': ['{n} געשיקט · גייט ווייטער אין {t} סעק\'…', '{n} sent · continuing in {t}s…'],
  'הוסרו מהרשימה: {a} כתובות שחזרו, {b} שביקשו הסרה במייל.': ['אראפגענומען פון דער רשימה: {a} אדרעסן וואס זענען צוריקגעקומען, {b} וואס האבן געבעטן אין אן אימעיל.', 'Removed from the list: {a} bounced addresses, {b} who asked by email.'],
  'הגענו למגבלה היומית. מחר אפשר ללחוץ שוב "פרסום" — מי שכבר קיבל לא יקבל שוב.': ['מ\'האט דערגרייכט די טעגליכע גרעניץ. מארגן קען מען דריקן נאכאמאל "פארעפנטליכן" — ווער עס האט שוין באקומען וועט נישט באקומען נאכאמאל.', 'Daily limit reached. Tomorrow press "Publish" again — whoever got it will not get it again.'],
  'נשלח ל-{n} נמענים': ['געשיקט צו {n} באקומער', 'Sent to {n} recipients'],
  '{n} שגיאות': ['{n} טעותים', '{n} errors'],
  'נפתחה טיוטה חדשה לשבוע הבא.': ['ס\'האט זיך געעפנט א נייער דראפט פאר די קומענדיגע וואך.', 'A new draft was opened for next week.'],
  'השליחה נעצרה: {e}. אפשר ללחוץ שוב "פרסום" — מי שכבר קיבל לא יקבל שוב.': ['דאס שיקן האט זיך אפגעשטעלט: {e}. מ\'קען דריקן נאכאמאל "פארעפנטליכן" — ווער עס האט שוין באקומען וועט נישט באקומען נאכאמאל.', 'Sending stopped: {e}. Press "Publish" again — whoever got it will not get it again.'],
  'לא הצלחתי לטעון את השמחות / זמני השבת מגיליון התצוגה.': ['ס\'האט נישט געקענט לאדן די שמחות / זמני שבת פונעם גיליון.', 'Could not load the simchos / Shabbos times from the display sheet.'],
  // ---- הגדרות
  'הלוגו שמודבק על התמונות': ['דער לאגא וואס ווערט אריינגעלייגט אויף די בילדער', 'The logo placed on the photos'],
  '(ברירת מחדל — הלוגו של האתר)': ['(דיפאלט — דער לאגא פונעם וועבזייטל)', '(default — the site logo)'],
  'חזרה ללוגו של האתר': ['צוריק צום לאגא פונעם וועבזייטל', 'Back to the site logo'],
  'מומלץ PNG עם רקע שקוף. בעריכה הלוגו רק מוצג מעל התמונות; הוא נצרב בתמונה בפרסום — עם הלוגו שמוגדר כאן באותו רגע.': ['בעסער PNG מיט א דורכזיכטיגן הינטערגרונט. ביים טוישן ווייזט זיך דער לאגא נאר איבער די בילדער; ער ווערט אריינגעברענט ביים שיקן — מיטן לאגא וואס שטייט דא אין יענעם מאמענט.', 'PNG with a transparent background is best. While editing the logo is only shown over the photos; it is burned in on publish — with the logo set here at that moment.'],
  '✓ הלוגו נשמר.': ['✓ דער לאגא איז אפגעהיט.', '✓ Logo saved.'],
  '✓ חזר ללוגו של האתר.': ['✓ צוריק צום לאגא פונעם וועבזייטל.', '✓ Back to the site logo.'],
  'ראש המייל': ['דער קאפ פונעם אימעיל', 'Email header'],
  'להציג ראש': ['ווייזן א קאפ', 'Show header'],
  'תמונת באנר / לוגו': ['באנער / לאגא בילד', 'Banner / logo image'],
  'הסרת התמונה': ['אראפנעמען דאס בילד', 'Remove image'],
  'רוחב': ['ברייט', 'Width'],
  'כותרת / טקסט בראש': ['קעפל / טעקסט אויבן', 'Header title / text'],
  'שורת תאריך אוטומטית (התאריך של יום הפרסום · הפרשה)': ['אויטאמאטישע שורה מיטן דאטום (פונעם טאג וואס מ\'שיקט · די פרשה)', 'Automatic date line (publishing day · parsha)'],
  'רקע': ['הינטערגרונט', 'Background'],
  'תחתית המייל': ['דער פוס פונעם אימעיל', 'Email footer'],
  'טקסט בתחתית (כתובת, טלפון…)': ['טעקסט אונטן (אדרעס, טעלעפאן…)', 'Footer text (address, phone…)'],
  'כפתורים קבועים בתחתית': ['שטענדיגע קנעפלעך אונטן', 'Fixed footer buttons'],
  'כיתוב, למשל: לתרומה': ['טעקסט, למשל: לתרומה', 'Label, e.g. לתרומה'],
  'בסוף התחתית תמיד (חובה — לא ניתן להוריד), בעברית ובאנגלית: למי נשלח המייל · למה קיבלת אותו · כל המיילים הקודמים · להסרה מרשימת התפוצה. את כתובת הדואר כותבים בטקסט התחתית.': ['צום סוף פונעם פוס שטענדיג (מוז — מ\'קען נישט אראפנעמען), אויף לשון הקודש און ענגליש: צו וועמען איז געשיקט · פארוואס מ\'האט באקומען · אלע פריערדיגע אימעילס · זיך אראפנעמען פון דער רשימה. די פאסט־אדרעס שרייבט מען אינעם טעקסט אונטן.', 'Always at the end of the footer (required — cannot be removed), in Hebrew and English: who it was sent to · why you got it · all previous emails · unsubscribe. Write the postal address in the footer text.'],
  'הגדרות קול אונגוואר': ['איינשטעלונגען פון קול אונגוואר', 'Kol Ungvar settings'],
  'תצוגה מקדימה (ראש ותחתית לכל המיילים)': ['ווי עס וועט אויסזען (קאפ און פוס פאר אלע אימעילס)', 'Preview (header and footer for all emails)'],
  'המיילים יוצאים מ-{f}. הסרות מהרשימה: {n}. מייל שסומן בו "ראש ותחתית מיוחדים" — לא מושפע מכאן.': ['די אימעילס גייען ארויס פון {f}. אראפגענומען פון דער רשימה: {n}. אן אימעיל מיט "א באזונדערער קאפ און פוס" — ווערט נישט געטוישט פון דא.', 'Emails are sent from {f}. Unsubscribed: {n}. An email marked "custom header and footer" is not affected by this.'],
  'שמירת הראש והתחתית': ['אפהיטן דעם קאפ און פוס', 'Save header and footer'],
  'יש שינויים בראש / בתחתית שלא נשמרו. לסגור בלי לשמור?': ['ס\'זענען דא ענדערונגען אינעם קאפ / פוס וואס זענען נישט אפגעהיט. צומאכן אן אפהיטן?', 'Header / footer changes are not saved. Close without saving?'],
  '✓ הראש והתחתית נשמרו.': ['✓ דער קאפ און פוס זענען אפגעהיט.', '✓ Header and footer saved.'],
  // ---- ארכיון
  'חד פעמי': ['איינמאליג', 'One-time'],
  'עוד לא פורסם.': ['נאך נישט פארעפנטליכט.', 'Nothing published yet.'],
  'כמו הדף הציבורי — אבל התמונות בלי הלוגו, עם ⬇ הורדה.': ['ווי דער עפנטליכער בלאט — אבער די בילדער אן לאגא, מיט ⬇ אראפנעמען.', 'Like the public page — but photos without the logo, with ⬇ download.'],
  'שנת': ['יאר', 'Year'],
  'צפייה': ['אנקוקן', 'View'],
  'עוד לא נשלח מייל חד פעמי.': ['נאך קיין איינמאליגער אימעיל נישט געשיקט.', 'No one-time email sent yet.'],
  'התמונות בלי לוגו': ['די בילדער אן לאגא', 'Photos without logo'],
  // ---- שגיאות מהשרת
  'אין הרשאה — רק מי שמורשה באתר הכללי.': ['קיין רשות — נאר ווער עס איז ערלויבט אויפן אלגעמיינעם וועבזייטל.', 'No permission — only users allowed on the main site.'],
  'מישהו אחר שמר בינתיים — טוען מחדש.': ['איינער אנדערש האט אינצווישן אפגעהיט — לאדט פון ניי.', 'Someone else saved meanwhile — reloading.'],
  'המייל הזה כבר נשלח.': ['דער אימעיל איז שוין געשיקט.', 'This email was already sent.'],
  'המייל גדול מדי — פחות רכיבים.': ['דער אימעיל איז צו גרויס — ווייניגער טיילן.', 'The email is too large — fewer parts.'],
  'הקובץ גדול מדי.': ['די טעקע איז צו גרויס.', 'The file is too large.'],
  'קובץ לא תקין.': ['א פאלשע טעקע.', 'Invalid file.'],
  'השרת לא ענה בזמן — נסו שוב.': ['דער סערווער האט נישט געענטפערט אין צייט — פרובירט נאכאמאל.', 'The server did not answer in time — try again.'],
  'קריאת הקובץ נכשלה': ['ס\'האט נישט געקענט לייענען די טעקע', 'Could not read the file'],
  'לא הצלחתי לקרוא את התמונה': ['ס\'האט נישט געקענט לייענען דאס בילד', 'Could not read the image'],
};

const lg = () => { try { return getLang(); } catch { return 'he'; } };
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m));
/** תרגום מפורש של טקסט עברי (המפתח) */
export function L(he, vars = {}) {
  const l = lg(); const e = l === 'he' ? null : D[he];
  return fill(e ? e[l === 'yi' ? 0 : 1] : he, vars);
}
let PAT = null;
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pats() {
  PAT ||= Object.keys(D).filter((k) => /\{\w+\}/.test(k) && !/\{(פרשת השבוע|תאריך)\}/.test(k)).map((k) => {
    const names = [];
    const re = new RegExp(`^${k.split(/\{(\w+)\}/).map((p, i) => (i % 2 ? (names.push(p), '(.+?)') : esc(p))).join('')}$`, 's');
    return { k, re, names };
  });
  return PAT;
}
function one(x) {
  if (D[x]) return L(x);
  for (const p of pats()) { const m = p.re.exec(x); if (m) { const v = {}; p.names.forEach((n, i) => { v[n] = m[i + 1]; }); return L(p.k, v); } }
  return null;
}
/** טקסט שלם (עם רווחים / אימוג'י / סימני פיסוק מסביב) */
export function tr(str) {
  if (lg() === 'he' || !str || !/[א-ת]/.test(str)) return str;
  const t = String(str).trim(); const at = str.indexOf(t);
  const lead = str.slice(0, at); const tail = str.slice(at + t.length);
  let r = one(t); if (r != null) return lead + r + tail;
  const m = /^([^\p{L}\d(]*)(.*?)([\s:.…"!?,·]*)$/su.exec(t);
  if (m && m[2] && (m[1] || m[3])) { r = one(m[2]); if (r != null) return lead + m[1] + r + m[3] + tail; }
  return str;
}
const SKIP = 'textarea,[contenteditable],iframe,.kol-notr,script,style,input,select[data-after]';
/** מתרגם את כל הטקסטים בתוך el (בלי שדות עריכה ובלי תוכן של מיילים) */
export function trDom(el) {
  if (lg() === 'he' || !el) return;
  if (el.nodeType === 3) { if (!el.parentElement?.closest(SKIP)) { const v = tr(el.nodeValue); if (v !== el.nodeValue) el.nodeValue = v; } return; }
  if (el.nodeType !== 1 || el.closest(SKIP)) {
    if (el.nodeType === 1 && el.matches('input')) ['placeholder', 'title'].forEach((a) => { const v = el.getAttribute(a); if (v) { const n = tr(v); if (n !== v) el.setAttribute(a, n); } });
    return;
  }
  const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) && !n.matches('input') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = el; n; n = w.nextNode()) {
    if (n.nodeType === 3) {
      const p = n.parentElement;
      if (p?.tagName === 'OPTION' && !p.hasAttribute('value')) continue; // הטקסט הוא הערך
      const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
    } else ['title', 'placeholder'].forEach((a) => { const v = n.getAttribute(a); if (v) { const x = tr(v); if (x !== v) n.setAttribute(a, x); } });
  }
}
/** מתרגם עכשיו, וכל מה שיתווסף אחר כך */
export function watch(el) {
  trDom(el);
  if (el._kolWatch) return;
  el._kolWatch = new MutationObserver((ms) => {
    if (lg() === 'he') return;
    ms.forEach((m) => { if (m.type === 'characterData') trDom(m.target); else m.addedNodes.forEach((n) => trDom(n)); });
  });
  el._kolWatch.observe(el, { childList: true, subtree: true, characterData: true });
}
