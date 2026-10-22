# SMS והטלפון — שלבי החיבור

הקוד כבר בנוי. כדי שהמערכת תעבוד צריך לפתוח חשבונות ולחבר אותם. **כל המפתחות נשמרים רק במקומות שכתובים כאן**, ואף פעם לא בצ'אט או ב-GitHub.

## 1. Telnyx (אתם)
1. פותחים חשבון ב-telnyx.com ושומרים כרטיס אשראי (הכרטיס הייעודי). מגדירים **Auto-Recharge** (למשל: כשנשאר פחות מ-$10, להטעין $20).
2. **Messaging → Messaging Profiles:** יוצרים פרופיל. ב-Inbound Webhook URL כותבים: `https://<worker>/telnyx/sms`.
3. **Numbers → Buy:** קונים שני מספרי **Toll-Free**: אחד לגבאים ואחד לשליחה לקהל. משייכים את שניהם לפרופיל.
4. **Toll-Free Verification** לכל מספר. השימוש: גבאים / הודעות לקהילה. ההסכמה (opt-in): רשימה קיימת, בקשה בעל פה, או JOIN. התנאים נמצאים ב-https://ungvar.org/sms.html.
5. **Voice → TeXML Applications:** יוצרים אפליקציה עם Voice URL `https://<worker>/voice` (POST), ומשייכים אליה את המספרים. מספר מקומי לשיחות אפשר להוסיף אחר כך.
6. **Auth → API Keys:** יוצרים מפתח. הוא נכנס רק ל-Apps Script.
7. **Keys & Credentials → Public Key:** מעתיקים. הוא נכנס רק ל-Worker.

## 2. Apps Script "SMS" (בחשבון הדאטבייס)
1. פרויקט חדש בשם `Mosdos Ungvar SMS`, ומדביקים את `apps-script/sms.gs`.
2. **Project Settings → Script Properties:**
   - `SHARED_SECRET`: טקסט ארוך ואקראי. אותו טקסט נכנס גם ל-Worker.
   - `TELNYX_API_KEY`, `TELNYX_GABBAI_NUMBER`, `TELNYX_BROADCAST_NUMBER`, `TELNYX_TEXML_APP_ID`, `TELNYX_VOICE_NUMBER` (לא חובה).
   - `WORKER_URL`: הכתובת של ה-Worker.
   - `GEMINI_API_KEY`: אפשר את אותו מפתח של עוזר העזרה.
   - `STRIPE_SECRET_KEY`: רק אחרי שלב 4.
   - `SITE_URL` = `https://ungvar.org/`
3. מריצים **setup** פעם אחת. זה יוצר את הלשוניות בגיליון ואת השעון שמריץ את השליחות כל 5 דקות.
4. **Deploy → Web app:** Execute as **Me**, Who has access **Anyone**. את הכתובת שמים ב-`CONFIG.SMS_URL` באתר.

## 3. Cloudflare Worker
1. Cloudflare → **Workers & Pages → Create → Worker**, ומדביקים את `worker/index.js`.
2. **Settings → Variables and Secrets** (הכל כ-Secret): `APPS_SCRIPT_URL`, `SHARED_SECRET`, `TELNYX_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. את כתובת ה-Worker שמים ב-`CONFIG.SMS_WORKER_URL` באתר, ובשלבים 1 ו-4.

## 4. Stripe (אתם)
1. פותחים חשבון לעמותה עם חשבון הבנק.
2. **Developers → API keys:** את ה-Secret key שמים רק ב-Apps Script (`STRIPE_SECRET_KEY`).
3. **Developers → Webhooks:** מוסיפים endpoint `https://<worker>/stripe` עם האירוע `checkout.session.completed`. את ה-Signing secret (`whsec_…`) שמים רק ב-Worker.

## 5. באתר
1. **אדמין → גבאים:** לכל גבאי מוסיפים את הטלפון שלו (`gabbai_phone`). רק מהמספרים האלה המערכת מקבלת הודעות.
2. **Calls & SMS → ניהול:** קובעים מחיר ל-SMS ולשיחה, ולוחצים "עדכון ימים טובים".
3. **הרשימה הישנה:** מעלים אותה כרשימה מאקסל. בדף השליחה לוחצים "⚠ בלי הסכמה", ואז "לסמן כמאשרים" עם המקור "מהרשימה הישנה".

## הערות
- הקוד נבנה לפי התיעוד של Telnyx ו-Stripe ונבדק בהדמיה. בבדיקה האמיתית הראשונה כנראה יידרשו תיקונים קטנים.
- **אנשי קשר שנוספו ב-SMS** נשארים "לא נבדק" עד שגבאי מאשר אותם באתר.
- **הדיאלוג עם הגבאים** משולם על ידי העמותה ולא יורד מהקרדיטים.
