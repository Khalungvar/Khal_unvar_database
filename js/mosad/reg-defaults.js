// 📝 רישום לישיבה — ברירות מחדל (טיוטה). כל זה ניתן לשינוי ב"⚙️ הגדרות רישום"; מה שנשמר שם גובר.
// בטקסטים אפשר לכתוב: {reg_usd} {visa_usd} {tuition_ils} {ins_ils} {ins_usd} {min_age} {phone_status} {phone_tuition} {email}
// ובהודעות גם: {name} {id} {link} {missing} {examiner_name} {examiner_phone} {exam_place} {exam_notes}

export const STATUS_KEYS = ['received', 'checking', 'exam', 'after_exam', 'accepted', 'rejected', 'tuition_ok'];

export const DEFAULT_CONF = {
  draft: true,
  form_on: false,
  period: 'זמן קיץ פ"ז',
  period_next: 'זמן חורף פ"ח',
  period_open: true,
  min_age: 18,
  amounts: { reg_usd: 150, visa_usd: 220, tuition_ils: 6000, ins_ils: 135, ins_usd: 45 },
  phone_status: '1-718-289-0908 #1',
  phone_tuition: '1-718-289-0908 #5',
  email: 'beissheurim@gmail.com',
  examiner: { name: '', phone: '', place: '', notes: '' },
  statuses: [
    { key: 'received', name: 'הטופס התקבל', color: '#7a6a40', msg: {
      he: 'נא לעקוב אחר סטטוס ההרשמה בימים הקרובים.',
      yi: 'ביטע קוקט נאך וואו די אפליקאציע האלט אין די קומענדיגע טעג.',
      en: 'Please follow the status of the application in the coming days.' } },
    { key: 'checking', name: 'באמצע בירור', color: '#2c6e9b', msg: {
      he: 'תשובות יתקבלו בימים הקרובים.',
      yi: 'א תשובה וועט אנקומען אין די קומענדיגע טעג.',
      en: 'Answers will be received in the coming days.' } },
    { key: 'exam', name: 'ממתין לבחינה', color: '#8a4fbf', msg: {
      he: 'נא ליצור קשר עם הבוחן.',
      yi: 'ביטע פארבינדט זיך מיטן בוחן.',
      en: 'Please contact the examiner.' } },
    { key: 'after_exam', name: 'לאחר הבחינה — בבירור', color: '#b8740c', msg: {
      he: 'תשובה סופית תתקבל בקרוב.',
      yi: 'א ענדגילטיגע תשובה וועט באלד אנקומען.',
      en: 'A final answer will be received soon.' } },
    { key: 'accepted', name: 'נתקבל', color: '#1e7d3a', msg: {
      he: 'בסייעתא דשמיא, בנכם התקבל לישיבה. להסדרת שכר הלימוד יש ליצור קשר: {phone_tuition}.',
      yi: 'בסייעתא דשמיא, אייער זון איז אנגענומען געווארן אין ישיבה. צו מסדר זיין די שכר לימוד, ביטע פארבינדט זיך: {phone_tuition}.',
      en: 'With the help of Hashem, your son has been accepted to the Yeshiva. To arrange tuition, please contact: {phone_tuition}.' } },
    { key: 'rejected', name: 'לא התקבל', color: '#a33', msg: {
      he: 'לצערנו, אין באפשרותנו לקבל את בנכם לישיבתנו.',
      yi: 'צום באדויערן קענען מיר נישט אננעמען אייער זון אין אונזער ישיבה.',
      en: 'Unfortunately, we are unable to accept your son to our Yeshiva.' } },
    { key: 'tuition_ok', name: 'שכר לימוד הוסדר', color: '#0f6b5e', msg: {
      he: 'הסדרת שכר הלימוד הושלמה. תודה.',
      yi: 'די שכר לימוד איז מסודר. א דאנק.',
      en: 'Tuition arrangements are complete. Thank you.' } },
  ],
  // העטיפה של מייל בשינוי סטטוס / הודעה ({text} = ההודעה)
  mail_wrap: {
    he: { subject: 'ישיבת בית שערים — עדכון בהרשמה של {name}', body: 'שלום,\n\n{text}\n\nלפרטים ולמעקב אחר ההרשמה:\n{link}\n\nבברכה,\nהנהלת ישיבת בית שערים' },
    yi: { subject: 'ישיבת בית שערים — א נייעס וועגן די אפליקאציע פון {name}', body: 'שלום,\n\n{text}\n\nצו זען די פרטים:\n{link}\n\nבברכה,\nהנהלת ישיבת בית שערים' },
    en: { subject: 'Yeshiva Beis Sheurim — update on the application of {name}', body: 'Hello,\n\n{text}\n\nTo see the details and follow the application:\n{link}\n\nRegards,\nYeshiva Beis Sheurim' },
  },
  // מייל אוטומטי כשהטופס נשלח
  mail_received: {
    he: { subject: 'ישיבת בית שערים — טופס ההרשמה התקבל (#{id})', body: 'שלום,\n\nטופס ההרשמה של {name} התקבל בהצלחה (מספר פנייה {id}).\nהנהלת הישיבה תעבור על הפרטים ותעדכן אתכם בהמשך התהליך. קבלת הטופס אינה מהווה אישור קבלה לישיבה.\n\nלמעקב אחר מצב ההרשמה ולהשלמת מסמכים:\n{link}\n\nבברכה,\nהנהלת ישיבת בית שערים' },
    yi: { subject: 'ישיבת בית שערים — די אפליקאציע איז אנגעקומען (#{id})', body: 'שלום,\n\nדי אפליקאציע פון {name} איז אנגעקומען (נומער {id}).\nהנהלת הישיבה וועט דורכקוקן די פרטים און אייך לאזן וויסן. דאס איז נאך נישט קיין אננעמען אין ישיבה.\n\nצו זען וואו די אפליקאציע האלט און צולייגן דאקומענטן:\n{link}\n\nבברכה,\nהנהלת ישיבת בית שערים' },
    en: { subject: 'Yeshiva Beis Sheurim — application received (#{id})', body: 'Hello,\n\nThe application for {name} was received (reference #{id}).\nThe Yeshiva will review it and update you. Receiving the form is not an acceptance to the Yeshiva.\n\nTo follow the application and upload documents:\n{link}\n\nRegards,\nYeshiva Beis Sheurim' },
  },
  // תבניות הודעה (בוחרים בכרטיס המועמד)
  templates: [
    { id: 'exam', name: 'פרטי הבחינה', status: 'exam',
      text: {
        he: 'בנכם {name} מוזמן לבחינה.\nהבוחן: {examiner_name}, טל׳ {examiner_phone}.\nנא ליצור קשר עם הבוחן לתיאום מועד.\nמקום הבחינה: {exam_place}\n{exam_notes}',
        yi: 'אייער זון {name} ווערט איינגעלאדנט צו א בחינה.\nדער בוחן: {examiner_name}, טעל. {examiner_phone}.\nביטע פארבינדט זיך מיטן בוחן צו באשטימען א צייט.\nוואו: {exam_place}\n{exam_notes}',
        en: 'Your son {name} is invited for a farher (exam).\nExaminer: {examiner_name}, phone {examiner_phone}.\nPlease contact the examiner to set a time.\nPlace: {exam_place}\n{exam_notes}' } },
    { id: 'docs', name: 'השלמת מסמכים', status: '',
      text: {
        he: 'להשלמת ההרשמה של {name} חסרים: {missing}.\nאפשר להעלות אותם באזור האישי (הקישור למטה).',
        yi: 'צו פארענדיגן די אפליקאציע פון {name} פעלט נאך: {missing}.\nמען קען עס ארויפלייגן אויפן לינק אונטן.',
        en: 'To complete the application of {name}, we still need: {missing}.\nYou can upload them using the link below.' } },
    { id: 'accepted', name: 'ברכת קבלה', status: 'accepted',
      text: {
        he: 'בסייעתא דשמיא, {name} התקבל לישיבה. מזל טוב!\nלהסדרת שכר הלימוד: {phone_tuition}.\nלהסדרת הוויזות יש להעלות צילום דרכון ותעודת לידה, אם עדיין לא הועלו.',
        yi: 'בסייעתא דשמיא, {name} איז אנגענומען געווארן אין ישיבה. מזל טוב!\nצו מסדר זיין די שכר לימוד: {phone_tuition}.\nפאר די וויזה\'ס ביטע לייגט ארויף א קאפי פון פאספארט און birth certificate, אויב נאך נישט.',
        en: 'With the help of Hashem, {name} has been accepted to the Yeshiva. Mazel tov!\nTo arrange tuition: {phone_tuition}.\nFor the visas, please upload a copy of the passport and birth certificate, if not uploaded yet.' } },
  ],
  exports: [],
};

/** הטקסטים של הטופס בכל שפה. כל רשימה = שורה לכל סעיף. */
export const DEFAULT_TEXTS = {
  he: {
    title: 'טופס הרשמה — ישיבת בית שערים',
    intro: [
      'ההרשמה מתבצעת באמצעות טופס זה. יש למלא את כל הפרטים.',
      'יש לצרף תמונה ברורה של הבחור.',
      'דמי הרשמה: {reg_usd}$, נגבים בעת ההרשמה.',
      'כרטיס האשראי שיוזן בטופס ישמש לדמי ההרשמה, ובהמשך בס״ד גם לשכר הלימוד ולוויזות. לשינוי הכרטיס לשכר לימוד: {phone_tuition}.',
      'קבלת בחורים חדשים: לזמן חורף בחודש תשרי, ולזמן קיץ בחודש ניסן. בקשה שתוגש בזמן אחר תישמר לתקופת ההרשמה הבאה.',
      'לבירור מצב ההרשמה: {phone_status}.',
      'הישיבה אינה מקבלת בחורים מתחת לגיל {min_age}.',
    ],
    tuition: [
      'שכר הלימוד הוא {tuition_ils} ש״ח לחודש, וכולל אש״ל מלא, לרבות שבת.',
      'יש להסדיר את שכר הלימוד מיד עם קבלת הבחור לישיבה. ההנהלה דורשת כרטיס אשראי לחיוב בתחילת כל חודש.',
      'לזמן חורף שכר הלימוד מחושב מחודש חשוון עד סוף חודש ניסן.',
      'לזמן קיץ שכר הלימוד מחושב מחודש אייר עד סוף חודש תשרי.',
      'בחור שעוזב את הישיבה באמצע הזמן, מכל סיבה שהיא — שכר הלימוד נגבה עד סוף אותו זמן (כולל חודש ניסן / תשרי).',
    ],
    visa: [
      'לכניסה לארץ ישראל נדרשת ויזת ETA, המאפשרת שהייה של שלושה חודשים. לשהייה ארוכה יותר נדרשת ויזת A2, שכל תלמיד בישיבה חייב בה.',
      'הישיבה תסדיר את שתי הוויזות מיד עם קבלת הבחור, והן יישלחו אליכם בדוא״ל.',
      'לשם כך יש לצרף צילום דרכון וצילום תעודת לידה (אפשר גם אחרי שליחת הטופס).',
      'עלות שתי הוויזות: {visa_usd}$, שייגבו מהכרטיס כאשר הבחור מתקבל.',
    ],
    insurance: [
      'כל בחור חייב להיות מבוטח בביטוח רפואי, על כל צרה שלא תבוא.',
      'הנהלת הישיבה תסדיר את הביטוח מיד עם הגעת הבחור לארץ ישראל.',
      'העלות: {ins_ils} ש״ח לחודש (כ-{ins_usd}$). החיוב מתבצע ישירות על ידי חברת הביטוח, ולא דרך הישיבה.',
      'האחריות לתשלום הסדיר מוטלת על ההורים. אם התשלומים לא יבוצעו, הביטוח עלול להתבטל.',
    ],
    takanon: [
      'תלמיד הישיבה חייב לשמור על סדרי הישיבה בזמנם המדויק בכל יום ויום, הן זמני הלימודים והן זמני התפילות, והכל כפי קביעות הנהלת הישיבה.',
      'תלמיד הישיבה שצריך לנסוע לחוץ לארץ (אפילו לזמן קצר, לשידוך וכו׳) צריך לבקש רשות קודם שמסדרים לו את הנסיעה וקונים את הכרטיס.',
      'כל בחור שמחזיק טלפון נייד מחויב שיהיה עם הכשר המקובל על הנהלת הישיבה, בלי הודעות טקסט וכיו״ב, לדיבור בלבד.',
      'אין להחזיק נגני MP3 וכדומה בלי הכשר מתאים, כדי שלא תהיה בהם אפשרות של צפייה בווידאו וכיו״ב. על ההורים מוטל לדאוג לכך, כדי למנוע עגמת נפש.',
    ],
    consents: [
      'קראתי את תנאי ההרשמה ואת תקנות הישיבה.',
      'אני מסכים/ה לתנאי ההרשמה.',
      'אני מאשר/ת את הסדרי התשלום והסכומים שהוצגו.',
      'אני מאשר/ת את השימוש בכרטיס האשראי לחיובים שאושרו.',
    ],
    age_warn: 'לפי תאריך הלידה, הבחור צעיר מגיל {min_age}. לכאורה הישיבה אינה מקבלת בחורים בגיל זה. אפשר בכל זאת להגיש את הבקשה, אך אין בכך משום אישור חריג.',
    age_ack: 'הבנתי, ואני מבקש/ת להמשיך בכל זאת.',
    success: 'טופס ההרשמה התקבל בהצלחה. הנהלת הישיבה תעבור על הפרטים ותעדכן אתכם בהמשך התהליך.\nקבלת הטופס אינה מהווה אישור קבלה לישיבה. את צילום הדרכון ותעודת הלידה אפשר להשלים אחר כך.',
    closed: 'ההרשמה המקוונת אינה פתוחה כרגע. לבירורים: {phone_status}.',
  },
  yi: {
    title: 'אפליקאציע — ישיבת בית שערים',
    intro: [
      'מען דארף אויספילן יעדן פרט אין די אפליקאציע.',
      'מען דארף צולייגן א קלארע בילד פונעם בחור.',
      'דמי הרשמה איז {reg_usd}$, וואס ווערט געטשארדזשט ביים איינשיקן.',
      'דעם קרעדיט קארד וואס איר פילט אריין וועט מען טשארדזשן פאר די דמי הרשמה, און שפעטער בס״ד אויך פאר די שכר לימוד און פאר די וויזה. אויב איר ווילט טוישן די קארטל פאר שכ״ל: {phone_tuition}.',
      'מיר נעמען אן נייע בחורים חודש תשרי פאר זמן חורף, און חודש ניסן פאר זמן קיץ. אן אפליקאציע וואס קומט אן אין אנדערע צייטן ווערט אוועקגעלייגט ביז דעם קומענדיגן תשרי / ניסן.',
      'צו הערן וואו אייער אפליקאציע האלט: {phone_status}.',
      'מיר נעמען נישט אן קיין בחורים יונגער פון {min_age} יאר.',
    ],
    tuition: [
      'די פרייז פון שכר לימוד איז {tuition_ils} שקל א חודש (וואס רעכנט אריין אש״ל מלא מיט שבת).',
      'די שכר לימוד מוז זיין מסודר גלייך ווען דער תלמיד ווערט נתקבל אין ישיבה. די הנהלה פארלאנגט א קרעדיט קארד וואס מען קען טשארדזשן יעדן אנהייב חודש.',
      'פארן ווינטער זמן ווערט די שכ״ל גערעכנט פון חודש חשון ביז נאך חודש ניסן.',
      'פארן זומער זמן ווערט די שכ״ל גערעכנט פון חודש אייר ביז נאך חודש תשרי.',
      'אויב גייט א בחור ארויס פון ישיבה אינמיטן זמן (פאר סיי וועלכע סיבה), וועט די הנהלה נעמען שכ״ל ביז סוף פונעם זמן (אריינגערעכנט חודש ניסן / תשרי).',
    ],
    visa: [
      'אריינצופארן קיין ארץ ישראל דארף מען האבן א ETA וויזה, און מיט דעם קען מען בלייבן דריי חדשים. צו בלייבן לענגער דארף מען האבן א A2 וויזה (וואס יעדער תלמיד הישיבה מוז האבן).',
      'די ישיבה וועט מסדר זיין ביידע וויזה׳ס גלייך ווען אייער זון ווערט אנגענומען, און איר וועט עס באקומען אין אימעיל.',
      'כדי דאס צו מסדר זיין דארף מען צולייגן א קאפי פון די פאספארט און פון די birth certificate (תעודת לידה) — מען קען עס אויך צולייגן שפעטער.',
      'די פרייז פאר די צוויי וויזה׳ס איז {visa_usd}$, וואס וועט ווערן געטשארדזשט פונעם קארטל ווען אייער זון ווערט אנגענומען.',
    ],
    insurance: [
      'מיר פארלאנגען פון יעדן בחור צו האבן מעדיקל אינשורנס, על כל צרה שלא תבוא.',
      'הנהלת הישיבה וועט מסדר זיין מעדיקל אינשורנס פאר יעדן בחור גלייך ווען ער קומט אן אין ארץ ישראל.',
      'עס קאסט {ins_ils} שקל א חודש (בערך {ins_usd}$). דאס ווערט געטשארדזשט גלייך פון די אינשורנס קאמפאני, נישט דורך די ישיבה.',
      'די עלטערן זענען אחראי צו באצאלן אין צייט; אויב ווערט נישט באצאלט, קען דער אינשורנס ווערן אפגעשטעלט.',
    ],
    takanon: [
      'תלמיד הישיבה חייב לשמור על סדרי הישיבה בזמנם המדויק בכל יום ויום, הן זמני הלימודים והן זמני התפילות, והכל כפי קביעות הנהלת הישיבה.',
      'תלמיד הישיבה שצריך לנסוע חוץ לארץ ישראל (אפילו לזמן קצר, לשידוך וכו׳), צריך לבקש רשות קודם שמסדרים לו הנסיעה וקונים הטיקעט.',
      'כל בחור שמחזיק סעלפון מחוייב שיהא עם הכשר מקובל על הנהלת הישיבה, ולוודאות שיהא בלי טקסט וכיו״ב, ושאינו עומד אלא לדיבור בלבד.',
      'אין בשום אופן להחזיק נגנים MP3 בלי הכשר וכנ״ל, בכדי שלא יהיה בהם אפשרות של צפיה בווידאו וכיו״ב, ועל ההורים מוטל לדאוג על הנ״ל בכדי למנוע עגמ״נ.',
    ],
    consents: [
      'איך האב געליינט די תנאים און די תקנות הישיבה.',
      'איך בין מסכים צו די תנאים.',
      'איך בין מסכים צו די צאלונגען און די סכומים וואס זענען אנגעשריבן.',
      'איך בין מסכים אז מען זאל נוצן דעם קרעדיט קארד פאר די טשארדזשעס וואס זענען אנגעשריבן.',
    ],
    age_warn: 'לויט די געבורטס-דאטום איז דער בחור יונגער פון {min_age}. לכאורה נעמט די ישיבה נישט אן בחורים אין דעם עלטער. מען קען פונדעסטוועגן איינשיקן די אפליקאציע, אבער דאס איז נישט קיין אויסנאם-באשטעטיגונג.',
    age_ack: 'איך פארשטיי, און איך וויל פונדעסטוועגן ווייטער גיין.',
    success: 'די אפליקאציע איז אנגעקומען. הנהלת הישיבה וועט דורכקוקן די פרטים און אייך לאזן וויסן.\nדאס איז נאך נישט קיין אננעמען אין ישיבה. די פאספארט און birth certificate קען מען צולייגן שפעטער.',
    closed: 'די אנליין אפליקאציע איז יעצט נישט אפן. פאר מער אינפארמאציע: {phone_status}.',
  },
  en: {
    title: 'Application — Yeshiva Beis Sheurim',
    intro: [
      'Please fill in every detail of the application.',
      'A clear photo of the bochur must be attached.',
      'The registration fee is ${reg_usd}, charged when the application is submitted.',
      'The credit card entered in this form will be charged for the registration fee, and later, with Hashem\'s help, also for tuition and the visas. To change the card used for tuition: {phone_tuition}.',
      'New bochurim are accepted in Tishrei for the winter zman and in Nissan for the summer zman. An application sent at another time will be kept for the next registration period.',
      'To hear the status of your application: {phone_status}.',
      'The Yeshiva does not accept bochurim younger than {min_age}.',
    ],
    tuition: [
      'Tuition is {tuition_ils} NIS per month, which includes full room and board, including Shabbos.',
      'Tuition must be arranged as soon as the bochur is accepted. The Yeshiva requires a credit card that can be charged at the beginning of every month.',
      'For the winter zman, tuition is charged from Cheshvan until the end of Nissan.',
      'For the summer zman, tuition is charged from Iyar until the end of Tishrei.',
      'If a bochur leaves in the middle of the zman (for any reason), tuition is charged until the end of that zman (including Nissan / Tishrei).',
    ],
    visa: [
      'To enter Eretz Yisroel an ETA visa is needed, which allows a stay of three months. To stay longer, an A2 visa is needed (every talmid of the Yeshiva must have one).',
      'The Yeshiva will arrange both visas as soon as your son is accepted, and you will receive them by email.',
      'For this, a copy of the passport and of the birth certificate is needed (they can also be uploaded after submitting the form).',
      'The cost of both visas is ${visa_usd}, charged to the card when your son is accepted.',
    ],
    insurance: [
      'Every bochur is required to have medical insurance.',
      'The Yeshiva will arrange medical insurance for every bochur as soon as he arrives in Eretz Yisroel.',
      'The cost is {ins_ils} NIS per month (about ${ins_usd}). It is charged directly by the insurance company, not through the Yeshiva.',
      'The parents are responsible for paying on time; if payments are not made, the insurance may be cancelled.',
    ],
    takanon: [
      'A talmid must keep the Yeshiva\'s schedule exactly, every day — both learning sedarim and tefillos — as set by the Yeshiva.',
      'A talmid who needs to travel outside Eretz Yisroel (even for a short time, for a shidduch, etc.) must ask permission before the trip is arranged and the ticket is bought.',
      'Any bochur who has a cell phone must have one with a hechsher accepted by the Yeshiva, with no texting etc., for calls only.',
      'MP3 players etc. without a proper hechsher are not allowed, so that there is no possibility of watching video etc. The parents are responsible for this, to prevent distress.',
    ],
    consents: [
      'I have read the registration terms and the Yeshiva\'s rules.',
      'I agree to the registration terms.',
      'I approve the payment arrangements and amounts shown.',
      'I authorize the use of the credit card for the approved charges.',
    ],
    age_warn: 'According to the date of birth, the bochur is younger than {min_age}. The Yeshiva generally does not accept bochurim of this age. You may still submit the application, but this is not an exception approval.',
    age_ack: 'I understand, and I want to continue anyway.',
    success: 'The application was received. The Yeshiva will review the details and update you.\nReceiving the form is not an acceptance to the Yeshiva. The passport and birth certificate can be uploaded later.',
    closed: 'Online registration is not open right now. For information: {phone_status}.',
  },
};

/** ממזג הגדרות שמורות על ברירת המחדל */
export function mergeConf(saved) {
  const s = saved || {};
  const c = { ...DEFAULT_CONF, ...s, amounts: { ...DEFAULT_CONF.amounts, ...(s.amounts || {}) }, examiner: { ...DEFAULT_CONF.examiner, ...(s.examiner || {}) } };
  const byKey = Object.fromEntries((s.statuses || []).map((x) => [x.key, x]));
  c.statuses = DEFAULT_CONF.statuses.map((d) => ({ ...d, ...(byKey[d.key] || {}), msg: { ...d.msg, ...((byKey[d.key] || {}).msg || {}) } }));
  c.mail_wrap = { ...DEFAULT_CONF.mail_wrap, ...(s.mail_wrap || {}) };
  c.mail_received = { ...DEFAULT_CONF.mail_received, ...(s.mail_received || {}) };
  c.templates = s.templates || DEFAULT_CONF.templates;
  c.exports = s.exports || [];
  return c;
}
export function mergeTexts(saved) {
  const out = {};
  ['he', 'yi', 'en'].forEach((l) => { out[l] = { ...DEFAULT_TEXTS[l], ...((saved || {})[l] || {}) }; });
  return out;
}
/** ממלא {reg_usd} וכו׳ */
export function fill(t, conf, extra = {}) {
  const a = conf.amounts || {};
  const ex = conf.examiner || {};
  const map = { reg_usd: a.reg_usd, visa_usd: a.visa_usd, tuition_ils: a.tuition_ils, ins_ils: a.ins_ils, ins_usd: a.ins_usd, min_age: conf.min_age,
    phone_status: conf.phone_status, phone_tuition: conf.phone_tuition, email: conf.email,
    examiner_name: ex.name, examiner_phone: ex.phone, exam_place: ex.place, exam_notes: ex.notes, ...extra };
  return String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in map && map[k] !== undefined ? String(map[k]) : m));
}
