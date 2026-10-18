// הגדרות כלליות של התוכנה.
// אין כאן שום מידע סודי: מזהה הלוגאין ומפתח המפות מוגבלים בגוגל לכתובת האתר בלבד.
export const CONFIG = {
  // מזהה הלוגאין (Google Auth Platform → Clients → Khal Ungvar Website)
  CLIENT_ID: '73541082309-bb0bc3jv1dchtpgsr129m5bbertk79ua.apps.googleusercontent.com',

  // הגוגל שיטס של המאגר (בבעלות החשבון האישי)
  SPREADSHEET_ID: '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY',

  // מפתח Places API (New) להשלמת כתובות. ריק = ההשלמה של גוגל כבויה,
  // והתוכנה משלימה רק מתוך כתובות שכבר קיימות במאגר.
  MAPS_API_KEY: 'AIzaSyCjsrUujYSZwuRf270KtvsLbAjiPwRZzIo',

  // תקרה יומית (לכל דפדפן) כדי להישאר בתוך המכסה החינמית של גוגל
  PLACES_DAILY_AUTOCOMPLETE: 160,
  PLACES_DAILY_DETAILS: 300,

  // מספר איש הקשר הראשון
  FIRST_CONTACT_ID: 1001,
};

export const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/spreadsheets',
].join(' ');
