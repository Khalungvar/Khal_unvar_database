// הגדרות כלליות של התוכנה.
// אין כאן שום מידע סודי: מזהה הלוגאין ומפתח המפות מוגבלים בגוגל לכתובת האתר בלבד.
export const CONFIG = {
  // דער "סערווער" (Apps Script) פונעם הילף-AI. ליידיג = נאר דער פירער מיט זוכן.
  HELP_AI_URL: 'https://script.google.com/macros/s/AKfycbyva11piQYE0c-FIhWoHHJj_zqtOf3bB2DM_5S1WGUyXZ9WJqWamkDDMRqPYsoFsYKR/exec',
  // עוזר התמונות (Apps Script בחשבון הדאטבייס) — עדיין לא בשימוש עד שהקוד בצד האתר ייבנה
  // SMS און טעלעפאן: דער "מוח" (Apps Script sms.gs) און דער Worker (Cloudflare). ליידיג = נאך נישט פארבונדן.
  SMS_URL: 'https://script.google.com/macros/s/AKfycbzK63Qd9P3Gb-255-gVFGvqkF_NddBjJ9i5yHKrnaK_E8PwLsB_7WDO6Lh2iyqO1vPZ/exec',
  SMS_WORKER_URL: '',
  // דער "שומר" פאר די אתרים פון די מוסדות (Apps Script mosad.gs בחשבון הדאטאבייס). ליידיג = נאך נישט פארבונדן.
  // ארגונים מיט אן אייגענעם אתר (תלמידים, שכר לימוד וכו' זענען דארט, נישט דא)
  MOSAD_SITES: { 'ישיבת בית שערים (ירושלים)': 'yeshiva/' },
  MOSAD_URL: 'https://script.google.com/macros/s/AKfycby-iqDa2VyvWnGuPU70FYCPlyVgIFRGv3UbOgU8vQBsrjtWHB-UxXqMEJbJHQg_TnQv/exec',
  IMAGES_URL: 'https://script.google.com/macros/s/AKfycbzi44y-tKi2B3wnAvd93WOlxqJPULhWjsgAJqcMr1DAVvyx1HmQPr4o0rKypIxVgnju_Q/exec',

  // מזהה הלוגאין (Google Auth Platform → Clients → Khal Ungvar Website)
  CLIENT_ID: '73541082309-bb0bc3jv1dchtpgsr129m5bbertk79ua.apps.googleusercontent.com',

  // הגוגל שיטס של המאגר (בבעלות החשבון האישי)
  SPREADSHEET_ID: '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY',
  // גיליון נפרד פאר דער תצוגה אין ביהמ"ד (זמני תפילות, שיעורים ...) — ווערט פארעפנטלעכט פאר לייענען
  DISPLAY_SHEET_ID: '1hhrsXNhDCK7OGXOClTPE8pxOJ3EjmTmndH0r_qrms70',

  // מפתח Places API (New) להשלמת כתובות. ריק = ההשלמה של גוגל כבויה,
  // והתוכנה משלימה רק מתוך כתובות שכבר קיימות במאגר.
  MAPS_API_KEY: 'AIzaSyCjsrUujYSZwuRf270KtvsLbAjiPwRZzIo',

  // תקרה יומית (לכל דפדפן) כדי להישאר בתוך המכסה החינמית של גוגל
  PLACES_DAILY_AUTOCOMPLETE: 160,
  PLACES_DAILY_DETAILS: 300,

  // מספר איש הקשר הראשון
  FIRST_CONTACT_ID: 2001, // 2026-10-18: די ניסיון-קאנטאקטן (1001–1735) זענען אויסגעמעקט; נדבות וכו' פון זיי בלייבן — נישט ווידער באנוצן די נומערן

  // חשבון "דאטאבייס" (חשבון הפרויקט): כשמעלים תמונות / לוגאס כשמחוברים איתו,
  // הקובץ המקורי נשמר בדרייב שלו, בתיקייה הזאת (עם תת-תיקיות Logos / Photos).
  DATABASE_ACCOUNT: 'khalungvardatabase@gmail.com',
  DRIVE_FOLDER: 'Khal Ungvar – Database',

  // נומער פונעם פראיעקט אין Google Cloud (דער אנהייב פונעם CLIENT_ID) — פאר דעם "קלייבן א טעקע" פענצטער (Picker)
  PROJECT_NUMBER: '73541082309',
};

// הרשאה לדרייב — רק לקבצים שהאתר עצמו יוצר. מבקשים אותה רק כשמעלים בפעם הראשונה.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// שיקן אימעילס דורך Gmail פונעם אקאונט וואס איז אריין (מ'בעט עס ערשט ביים ערשטן שיקן).
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');
