# SMS והטלפון — שלבי החיבור

הקוד כבר בנוי. כדי שהמערכת תעבוד צריך לחבר את החשבונות. **כל המפתחות נשמרים רק במקומות שכתובים כאן**, ואף פעם לא בצ'אט או ב-GitHub.

## מה כבר גמור (28.10.2026)
- **Telnyx:** חשבון מאומת (Verified) על office@ungvar.org, כרטיס, טעינה אוטומטית (מתחת ל-$10 → $30).
- **המספרים:**
  - `+1 866-830-0089` — הגבאים (תגית GABBI)
  - `+1 866-796-2646` — 1-866-7-ZMANIM, לקהילה וזמנים בטלפון (תגית 7-ZMANIM)
  - `+1 929-219-1653` — מקומי, הודעות קוליות בלבד (תגית CALLS)
- **Messaging Profile** "Khal Ungvar SMS": שני מספרי ה-866 משויכים, יעד רק ארה"ב, תשובות אוטומטיות ל-STOP / START / HELP. ה-Webhook עוד ריק.
- **Toll-Free Verification** נשלח על שני מספרי ה-866 (Religious Services). ממתינים לאישור.
- **באתר:** ungvar.org/sms.html עודכן, ותמונת ההרשמה ב-ungvar.org/img/sms-optin.png.

## נוסחים שנרשמו בטלניקס — לא לשנות בלי לעדכן גם שם
- כל הודעה לציבור מתחילה ב-`Khal Ungvar:` (המערכת מוסיפה את זה לבד; ההגדרה "sms_brand").
- אחרי JOIN: `Khal Ungvar: You are subscribed to community updates. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.`
- STOP / START / HELP — טלניקס עונים לבד (Messaging Profile → Keywords). המערכת רק רושמת.

- **28.10 בערב:** סקריפט "Mosdos Ungvar SMS" בחשבון הדאטאבייס (פורסם כ-Web app, setup רץ, כל המאפיינים חוץ מ-GEMINI_API_KEY), Worker `https://ungvar-sms.8510089.workers.dev` עם 3 הסודות, Webhook בפרופיל ההודעות, TeXML App "Khal Ungvar Voice" (ID 3081014596631266845) עם שלושת המספרים. **שיחה ל-1-866-796-2646 נבדקה ועובדת.**

## מה נשאר (הסעיפים 1–3 למטה כבר בוצעו, חוץ מ-GEMINI_API_KEY)

### 1. Apps Script "SMS" (בחשבון הדאטאבייס)
1. פרויקט חדש בשם `Mosdos Ungvar SMS`, ומדביקים את `apps-script/sms.gs`.
2. מריצים **setupNumbersAndSecret** פעם אחת. זה שומר את שלושת המספרים ויוצר `SHARED_SECRET`. את הסוד מעתיקים מהיומן ישר ל-Cloudflare (שלב 2).
3. **Project Settings → Script Properties**, מוסיפים בעצמכם:
   - `TELNYX_API_KEY` — מטלניקס: **Account Settings → API Keys → Create**.
   - `GEMINI_API_KEY` — אפשר את אותו מפתח של עוזר העזרה.
   - `WORKER_URL` — הכתובת של ה-Worker (אחרי שלב 2).
   - `TELNYX_TEXML_APP_ID` — אחרי שלב 3.
4. מריצים **setup** פעם אחת (לשוניות בגיליון ושעון כל 5 דקות).
5. **Deploy → Web app:** Execute as **Me**, Who has access **Anyone**. את הכתובת שמים ב-`CONFIG.SMS_URL` באתר.

### 2. Cloudflare Worker
1. Cloudflare → **Workers & Pages → Create → Worker**, ומדביקים את `worker/index.js`.
2. **Settings → Variables and Secrets** (הכל כ-Secret):
   - `APPS_SCRIPT_URL` — כתובת ה-Web app משלב 1.5
   - `SHARED_SECRET` — מהיומן של שלב 1.2
   - `TELNYX_PUBLIC_KEY` — מטלניקס: **Account Settings → Public Key**
   - `STRIPE_WEBHOOK_SECRET` — רק בשלב 4
3. את כתובת ה-Worker שמים ב-`CONFIG.SMS_WORKER_URL` באתר.

### 3. חזרה לטלניקס
1. **Messaging Profile → Inbound → Webhook URL:** `https://<worker>/telnyx/sms`
2. **Voice → TeXML Applications → Create:** Voice URL `https://<worker>/voice` (POST). משייכים את `866-796-2646` ואת `929-219-1653`. את ה-ID שמים ב-`TELNYX_TEXML_APP_ID`.

### 4. Stripe (אחר כך)
1. חשבון לעמותה. **Secret key** → רק ב-Apps Script (`STRIPE_SECRET_KEY`).
2. **Webhooks:** `https://<worker>/stripe`, אירוע `checkout.session.completed`. ה-Signing secret → רק ב-Worker.

### 5. באתר
1. **אדמין → גבאים:** לכל גבאי את הטלפון שלו (`gabbai_phone`).
2. **Calls & SMS → ניהול:** מחיר ל-SMS ולשיחה, "עדכון ימים טובים". השם בתחילת ההודעה כבר מוגדר: Khal Ungvar.
3. **הרשימה הישנה:** מעלים כרשימה מאקסל → "⚠ בלי הסכמה" → "לסמן כמאשרים", מקור "מהרשימה הישנה".

## הערות
- שליחה לקהילה תעבוד רק אחרי אישור ה-Toll-Free Verification. שיחת הגבאים והשיחות הקוליות אפשר לבדוק לפני.
- הקוד נבנה לפי התיעוד של Telnyx ונבדק בהדמיה. בבדיקה האמיתית הראשונה כנראה יידרשו תיקונים קטנים.
- **אבטחה:** הלשוניות Credits, SmsJobs, SmsConfig ו-SmsRecordings ננעלות ב-setup, כך שרק הסקריפט יכול לשנות אותן.
