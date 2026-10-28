/**
 * שולח מיילים של ישיבת בית שערים — רץ בחשבון beissheurim@gmail.com
 *
 * איך זה עובד:
 *  - setup() יוצר גיליון "Beis Sheurim Outbox" בדרייב של הישיבה, ומשתף אותו (עריכה) עם חשבון המערכת.
 *  - המערכת (ungvar.org) כותבת לגיליון שורה לכל מייל שצריך לצאת.
 *  - כל 5 דקות הסקריפט הזה שולח את השורות הממתינות — מהכתובת beissheurim@gmail.com — ומסמן "נשלח".
 *  - אין כאן סיסמאות או מפתחות. אפשר לעצור הכול בכל רגע: stop().
 */
const SYSTEM_ACCOUNT = 'khalungvardatabase@gmail.com';
const SHEET_NAME = 'Beis Sheurim Outbox';
const FROM_NAME = 'ישיבת בית שערים';
const HEAD = ['id', 'created', 'to', 'subject', 'html', 'text', 'reply_to', 'status', 'sent_at', 'error'];
const KEEP_DAYS = 60; // אחרי כמה ימים מוחקים את תוכן המייל מהגיליון (נשאר רק: למי, מתי, נושא)

/** להריץ פעם אחת. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('OUTBOX_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    const sh = ss.getSheets()[0];
    sh.setName('outbox');
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    props.setProperty('OUTBOX_ID', ss.getId());
  }
  ss.addEditor(SYSTEM_ACCOUNT);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'send') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('send').timeBased().everyMinutes(5).create();
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: me, name: FROM_NAME, subject: 'מערכת הרישום — שליחת מיילים חוברה ✔',
    body: 'שליחת המיילים של מערכת הרישום מחוברת.\nגיליון: ' + ss.getUrl() + '\nמכסה יומית שנשארה: ' + MailApp.getRemainingDailyQuota() });
  Logger.log('מוכן. גיליון: ' + ss.getUrl());
}

/** רץ אוטומטית כל 5 דקות. */
function send() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const id = PropertiesService.getScriptProperties().getProperty('OUTBOX_ID');
    if (!id) return;
    const sh = SpreadsheetApp.openById(id).getSheetByName('outbox');
    const last = sh.getLastRow();
    if (last < 2) return;
    const rows = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
    const col = function (n) { return HEAD.indexOf(n); };
    const now = new Date();
    rows.forEach(function (r, i) {
      const rowNo = i + 2;
      const status = String(r[col('status')] || '');
      if (status === 'pending') {
        if (MailApp.getRemainingDailyQuota() < 1) return; // מחר
        const to = String(r[col('to')] || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { sh.getRange(rowNo, col('status') + 1, 1, 3).setValues([['error', now, 'כתובת לא תקינה']]); return; }
        try {
          const o = { to: to, name: FROM_NAME, subject: String(r[col('subject')] || ''), body: String(r[col('text')] || '') };
          if (r[col('html')]) o.htmlBody = String(r[col('html')]);
          if (r[col('reply_to')]) o.replyTo = String(r[col('reply_to')]);
          MailApp.sendEmail(o);
          sh.getRange(rowNo, col('status') + 1, 1, 3).setValues([['sent', now, '']]);
        } catch (err) {
          sh.getRange(rowNo, col('status') + 1, 1, 3).setValues([['error', now, String(err && err.message || err).slice(0, 300)]]);
        }
      } else if ((status === 'sent' || status === 'error') && r[col('sent_at')] && (now - new Date(r[col('sent_at')])) > KEEP_DAYS * 86400000 && (r[col('html')] || r[col('text')])) {
        sh.getRange(rowNo, col('html') + 1, 1, 2).setValues([['', '']]); // לא לשמור תוכן ישן
      }
    });
  } finally { lock.releaseLock(); }
}

/** לעצור את השליחה (אפשר להפעיל שוב עם setup). */
function stop() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'send') ScriptApp.deleteTrigger(t); });
  Logger.log('השליחה הופסקה.');
}
