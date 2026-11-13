/**
 * קהל אונגוואר — שולח המיילים של האתר בשם office@ungvar.org (Google Apps Script).
 *
 * רץ בחשבון office@ungvar.org. האתר שולח לכאן את המייל (עם הטוקן של מי שמחובר),
 * הסקריפט בודק שהשולח הוא מנהל/גבאי לפי Settings בגיליון, ושולח מ-office@ באמת:
 * העותק נשמר ב"דואר יוצא" של office@, ותשובות חוזרות ל-office@.
 *
 * אין כאן סיסמאות או מפתחות.
 * פריסה: Deploy → Web app → Execute as: Me (office@) · Who has access: Anyone.
 * office@ צריך הרשאת צפייה בגיליון הראשי (בשביל רשימת המורשים).
 */
const SHEET_ID = '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY';
const MAX_ITEMS = 25;

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const email = whoIs(req.token);
    if (!email || !allowed(email)) return out({ error: 'not-allowed' });
    if (req.action === 'quota') return out({ left: MailApp.getRemainingDailyQuota(), from: Session.getEffectiveUser().getEmail() });
    if (req.action !== 'send') return out({ error: 'unknown-action' });

    const items = (req.items || []).slice(0, MAX_ITEMS);
    const results = items.map(function (it) {
      const to = String(it.to || '').trim();
      if (!/^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(to)) return { to: to, error: 'bad-address' };
      if (MailApp.getRemainingDailyQuota() < 1) return { to: to, error: 'daily-limit' };
      try {
        const o = { to: to, subject: String(it.subject || ''), body: String(it.text || ''), name: String(it.fromName || 'Khal Ungvar') };
        if (it.html) o.htmlBody = String(it.html);
        const inline = {};
        (it.inline || []).forEach(function (x) { const b = blobOf(x.dataUrl, x.cid); if (b) inline[x.cid] = b; });
        if (Object.keys(inline).length) o.inlineImages = inline;
        const atts = (it.attachments || []).map(function (a) {
          return Utilities.newBlob(Utilities.base64Decode(a.b64), a.mime || 'application/octet-stream', String(a.name || 'file'));
        });
        if (atts.length) o.attachments = atts;
        if (it.replyTo) o.replyTo = String(it.replyTo);
        // GmailApp ולא MailApp: נשלח מתיבת ה-Gmail של office@ עצמה (MailApp נדחה ע"י Gmail בחשבונות חדשים)
        GmailApp.sendEmail(o.to, o.subject, o.body, o);
        return { to: to, ok: true };
      } catch (err) {
        return { to: to, error: String(err && err.message || err).slice(0, 200) };
      }
    });
    return out({ results: results, by: email });
  } catch (err) {
    return out({ error: String(err).slice(0, 200) });
  }
}

/** בדיקה מהעורך: הפעלה ← testMailer (שולח מייל ניסיון ל-office@ עצמו) */
function testMailer() {
  const me = Session.getEffectiveUser().getEmail();
  Logger.log('running as: ' + me);
  Logger.log('quota left: ' + MailApp.getRemainingDailyQuota());
  Logger.log('sheet: ' + SpreadsheetApp.openById(SHEET_ID).getName());
  GmailApp.sendEmail(me, 'שליחת מיילים מהאתר חוברה ✔', 'מעכשיו מיילים מהאתר יוצאים מ-' + me + '.', { name: 'Khal Ungvar' });
}

function blobOf(dataUrl, name) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  return Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(name || 'img'));
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function whoIs(token) {
  if (!token) return '';
  const cache = CacheService.getScriptCache();
  const hit = cache.get('t:' + token.slice(-24));
  if (hit) return hit;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const email = String(JSON.parse(r.getContentText()).email || '').toLowerCase();
  if (email) cache.put('t:' + token.slice(-24), email, 1800);
  return email;
}

function allowed(email) {
  const cache = CacheService.getScriptCache();
  let list = cache.get('allowed');
  if (!list) {
    const rows = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Settings').getDataRange().getValues();
    const head = rows[0].map(String);
    const cols = ['admin_email', 'gabbai_email', 'owner_email'].map(function (h) { return head.indexOf(h); }).filter(function (i) { return i >= 0; });
    const emails = [];
    rows.slice(1).forEach(function (r) { cols.forEach(function (i) { const v = String(r[i] || '').trim().toLowerCase(); if (v) emails.push(v); }); });
    list = emails.join(',');
    cache.put('allowed', list, 600);
  }
  return list.split(',').indexOf(email) >= 0;
}
