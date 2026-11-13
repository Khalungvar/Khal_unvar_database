/**
 * 📻 קול אונגוואר — שרת המיילים (Google Apps Script), רץ בחשבון kol@ungvar.org.
 *
 * למה ב-kol@: המיילים יוצאים מ-kol@ באמת (העותקים ב"דואר יוצא" שלו, תשובות חוזרות אליו),
 * והקבצים נשמרים בארון המשותף "קול אונגוואר".
 *
 * מה נשמר (בארון "קול אונגוואר"):
 *   גיליון "קול אונגוואר – מערכת": Emails (שבועי + חד פעמי), Sent (למי נשלח — כדי לא לשלוח פעמיים), Unsubs (הסרות), Settings.
 *   תיקייה "קבצי מיילים": תמונות / מודעות / קבצים — "כל מי שיש לו קישור" (כדי שהתמונות יופיעו במייל ובדף הציבורי).
 *
 * הרשאות: מי שמופיע ב-Settings של הגיליון הראשי (admin_email / gabbai_email / owner_email). kol@ צריך הרשאת צפייה בגיליון הראשי.
 * פריסה: Deploy → Web app → Execute as: Me (kol@) · Who has access: Anyone.
 * אין כאן סיסמאות או מפתחות. הסוד לקישורי ההסרה נוצר לבד ב-Script Properties (UNSUB_SECRET).
 */
const MAIN_SHEET_ID = '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY';
const KOL_DRIVE_ID = '0AD2PK8co-YttUk9PVA'; // הארון המשותף "קול אונגוואר"
const SITE = 'https://ungvar.org';
const TABS = {
  Emails: ['id', 'kind', 'week', 'title', 'subject', 'status', 'blocks', 'opts', 'created_at', 'created_by', 'updated_at', 'updated_by', 'sent_at', 'sent_by', 'sent_n'],
  Sent: ['email_id', 'to', 'at', 'ok', 'error'],
  Unsubs: ['email', 'at', 'source'],
  Settings: ['key', 'value'],
};
const BATCH = 60; // כמה נמענים בקריאה אחת (מגבלת 6 דקות של Apps Script)

// ---------------------------------------------------------------------------------- כניסה
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const pub = PUBLIC[req.action];
    if (pub) return out(pub(req));
    const me = whoIs(req.token);
    if (!me || !allowed(me)) return out({ error: 'not-allowed' });
    const fn = ACTIONS[req.action];
    if (!fn) return out({ error: 'unknown-action' });
    return out(fn(req, me));
  } catch (err) {
    return out({ error: String((err && err.message) || err).slice(0, 300) });
  }
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action && PUBLIC[p.action]) return out(PUBLIC[p.action](p));
    return out({ ok: true });
  } catch (err) { return out({ error: String((err && err.message) || err).slice(0, 300) }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
let TZ_ = '';
/** טקסט — וגם תאריך שהגיליון הפך בעצמו לתאריך (2026-11-14 / 2026-11-12 20:35) */
const S = function (v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    const tz = TZ_ || (TZ_ = book().getSpreadsheetTimeZone());
    const t = Utilities.formatDate(v, tz, 'HH:mm');
    return Utilities.formatDate(v, tz, t === '00:00' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm');
  }
  return String(v);
};
function now() { return Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HH:mm'); }

// ---------------------------------------------------------------------------------- הגדרה ראשונה
/** הפעלה ← setup (פעם אחת): יוצר את הגיליון ואת התיקייה בארון המשותף */
function setup() {
  const P = PropertiesService.getScriptProperties();
  if (!P.getProperty('UNSUB_SECRET')) P.setProperty('UNSUB_SECRET', Utilities.getUuid() + Utilities.getUuid());
  book(); folder();
  Logger.log('sheet: ' + P.getProperty('SHEET_ID') + ' · folder: ' + P.getProperty('FOLDER_ID'));
  Logger.log('main: ' + SpreadsheetApp.openById(MAIN_SHEET_ID).getName());
}
function book() {
  const P = PropertiesService.getScriptProperties();
  let id = P.getProperty('SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('קול אונגוואר – מערכת');
    try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(KOL_DRIVE_ID)); } catch (err) { /* נשאר בדרייב של kol@ */ }
    P.setProperty('SHEET_ID', ss.getId());
  }
  Object.keys(TABS).forEach(function (n) { ensureTab(ss, n, TABS[n]); });
  const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (first && ss.getSheets().length > 1) { try { ss.deleteSheet(first); } catch (err) { /* */ } }
  return ss;
}
function folder() {
  const P = PropertiesService.getScriptProperties();
  const id = P.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (err) { /* */ } }
  let f;
  try { f = DriveApp.getFolderById(KOL_DRIVE_ID).createFolder('קבצי מיילים'); } catch (err) { f = DriveApp.createFolder('קול אונגוואר – קבצי מיילים'); }
  P.setProperty('FOLDER_ID', f.getId());
  return f;
}
function ensureTab(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); return sh; }
  const cur = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(S);
  const add = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (add.length) sh.getRange(1, cur.filter(Boolean).length + 1, 1, add.length).setValues([add]);
  return sh;
}
function rows(name) {
  const sh = book().getSheetByName(name);
  const v = sh.getDataRange().getValues();
  const head = v[0].map(S);
  return v.slice(1).map(function (r, i) { const o = { _row: i + 2 }; head.forEach(function (h, j) { if (h) o[h] = r[j]; }); return o; });
}
function put(name, o) {
  const sh = book().getSheetByName(name);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(S);
  const line = head.map(function (h) { return o[h] === undefined ? '' : o[h]; });
  // טקסט רגיל — שהגיליון לא יהפוך תאריכים / מספרים
  const r = sh.getRange(o._row || sh.getLastRow() + 1, 1, 1, head.length);
  r.setNumberFormat('@'); r.setValues([line.map(function (x) { return typeof x === 'string' ? x : S(x); })]);
}
function setting(k, v) {
  const all = rows('Settings');
  const ex = all.filter(function (x) { return S(x.key) === k; })[0];
  if (v === undefined) return ex ? S(ex.value) : '';
  put('Settings', { _row: ex ? ex._row : undefined, key: k, value: v });
  return v;
}

// ---------------------------------------------------------------------------------- מי זה
function whoIs(token) {
  if (!token) return '';
  const cache = CacheService.getScriptCache();
  const hit = cache.get('t:' + token.slice(-24));
  if (hit) return hit;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const email = S(JSON.parse(r.getContentText()).email).toLowerCase();
  if (email) cache.put('t:' + token.slice(-24), email, 1800);
  return email;
}
function allowed(email) {
  const cache = CacheService.getScriptCache();
  let list = cache.get('allowed');
  if (!list) {
    const v = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName('Settings').getDataRange().getValues();
    const head = v[0].map(S);
    const cols = ['admin_email', 'gabbai_email', 'owner_email'].map(function (h) { return head.indexOf(h); }).filter(function (i) { return i >= 0; });
    const emails = [];
    v.slice(1).forEach(function (r) { cols.forEach(function (i) { const x = S(r[i]).trim().toLowerCase(); if (x) emails.push(x); }); });
    list = emails.join(',');
    cache.put('allowed', list, 600);
  }
  return list.split(',').indexOf(email) >= 0;
}

// ---------------------------------------------------------------------------------- הסרה מהרשימה (קישור חתום)
function sig(email) {
  const P = PropertiesService.getScriptProperties();
  let sec = P.getProperty('UNSUB_SECRET');
  if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); P.setProperty('UNSUB_SECRET', sec); }
  const b = Utilities.computeHmacSha256Signature(S(email).toLowerCase().trim(), sec);
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '').slice(0, 22);
}
function unsubLink(email) { return SITE + '/kolungvar/?u=' + encodeURIComponent(email) + '&k=' + sig(email); }
function unsubbed() {
  const m = {};
  rows('Unsubs').forEach(function (u) { m[S(u.email).toLowerCase().trim()] = 1; });
  return m;
}

// ---------------------------------------------------------------------------------- פעולות פתוחות (בלי כניסה)
const PUBLIC = {
  /** הדף הציבורי: כל המיילים השבועיים שנשלחו — רק הרכיבים שסומנו "לארכיון" */
  archive: function () {
    const c = CacheService.getScriptCache();
    const hit = c.get('archive');
    if (hit) return JSON.parse(hit);
    const list = rows('Emails').filter(function (e) { return S(e.kind) === 'weekly' && S(e.status) === 'sent'; }).map(function (e) {
      let blocks = []; try { blocks = JSON.parse(S(e.blocks) || '[]'); } catch (err) { blocks = []; }
      let opts = {}; try { opts = JSON.parse(S(e.opts) || '{}'); } catch (err) { opts = {}; }
      return { id: S(e.id), week: S(e.week), subject: S(e.subject), sent_at: S(e.sent_at), opts: opts, blocks: blocks.filter(function (b) { return b.arch !== false; }) };
    }).sort(function (a, b) { return a.week < b.week ? 1 : -1; });
    const res = { emails: list };
    try { c.put('archive', JSON.stringify(res), 300); } catch (err) { /* גדול מדי */ }
    return res;
  },
  /** הסרה מהרשימה: { u: email, k: חתימה } */
  unsub: function (req) {
    const email = S(req.u).toLowerCase().trim();
    if (!email || S(req.k) !== sig(email)) return { error: 'bad-link' };
    if (!unsubbed()[email]) put('Unsubs', { email: email, at: now(), source: 'link' });
    return { ok: true, email: email };
  },
  /** חזרה לרשימה (מי שהוסר בטעות) */
  resub: function (req) {
    const email = S(req.u).toLowerCase().trim();
    if (!email || S(req.k) !== sig(email)) return { error: 'bad-link' };
    const sh = book().getSheetByName('Unsubs');
    rows('Unsubs').filter(function (u) { return S(u.email).toLowerCase().trim() === email; }).reverse().forEach(function (u) { sh.deleteRow(u._row); });
    return { ok: true, email: email };
  },
};

// ---------------------------------------------------------------------------------- פעולות (רק למורשים)
/** המייל השבועי של שבת מסוימת (אם יש כפולים — האחרון ששונה, ועדיף עם תוכן) */
function latestWeekly_(all, week) {
  const c = all.filter(function (r) { return S(r.kind) === 'weekly' && S(r.week) === week; });
  c.sort(function (a, b) { const fa = S(a.blocks).length > 2 ? 1 : 0; const fb = S(b.blocks).length > 2 ? 1 : 0; return fb - fa || (S(a.updated_at) < S(b.updated_at) ? 1 : -1); });
  return c[0] || null;
}
function emailView(e) {
  let blocks = []; try { blocks = JSON.parse(S(e.blocks) || '[]'); } catch (err) { blocks = []; }
  let opts = {}; try { opts = JSON.parse(S(e.opts) || '{}'); } catch (err) { opts = {}; }
  return { id: S(e.id), kind: S(e.kind), week: S(e.week), title: S(e.title), subject: S(e.subject), status: S(e.status) || 'draft', blocks: blocks, opts: opts,
    created_at: S(e.created_at), created_by: S(e.created_by), updated_at: S(e.updated_at), updated_by: S(e.updated_by), sent_at: S(e.sent_at), sent_by: S(e.sent_by), sent_n: S(e.sent_n) };
}
const ACTIONS = {
  me: function (req, me) {
    let logo = ''; try { logo = setting('logo'); } catch (err) { logo = ''; }
    return { email: me, from: Session.getEffectiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota(), logo: logo, defaults: setting('defaults') };
  },
  /** כל המיילים (בלי הישנים מאוד שנשלחו — רק 30 אחרונים) */
  list: function () {
    const all = rows('Emails').map(emailView);
    const sent = all.filter(function (e) { return e.status === 'sent'; }).sort(function (a, b) { return a.sent_at < b.sent_at ? 1 : -1; }).slice(0, 30);
    return { emails: all.filter(function (e) { return e.status !== 'sent'; }).concat(sent), unsubs: Object.keys(unsubbed()) };
  },
  get: function (req) {
    const e = rows('Emails').filter(function (x) { return S(x.id) === S(req.id); })[0];
    if (!e) throw new Error('not-found');
    return { email: emailView(e) };
  },
  /** שמירה: { email: { id?, kind, week?, title, subject, blocks, opts }, base? } */
  save: function (req, me) {
    const x = req.email || {};
    const kind = S(x.kind) === 'once' ? 'once' : 'weekly';
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const all = rows('Emails');
      let e = x.id ? all.filter(function (r) { return S(r.id) === S(x.id); })[0] : null;
      if (!e && kind === 'weekly' && x.week) e = latestWeekly_(all, S(x.week));
      if (e && S(e.status) === 'sent') throw new Error('already-sent');
      // שני אנשים עורכים ביחד: אם מישהו אחר שמר בינתיים — לא לדרוס
      if (e && req.base && S(e.updated_at) !== S(req.base) && S(e.updated_by) !== me) throw new Error('conflict:' + S(e.updated_by) + ' ' + S(e.updated_at));
      const blocks = JSON.stringify([].concat(x.blocks || []).slice(0, 120));
      if (blocks.length > 48000) throw new Error('too-big');
      const o = e || { id: 'k' + Date.now().toString(36), kind: kind, created_at: now(), created_by: me, status: 'draft' };
      o.week = kind === 'weekly' ? S(x.week).slice(0, 10) : '';
      o.title = S(x.title).slice(0, 120); o.subject = S(x.subject).slice(0, 200);
      o.blocks = blocks; o.opts = JSON.stringify(x.opts || {}).slice(0, 4000);
      o.updated_at = now(); o.updated_by = me;
      put('Emails', o);
      return { email: emailView(o) };
    } finally { lock.releaseLock(); }
  },
  remove: function (req) {
    const e = rows('Emails').filter(function (x) { return S(x.id) === S(req.id); })[0];
    if (!e) return { ok: true };
    if (S(e.status) === 'sent') throw new Error('already-sent');
    book().getSheetByName('Emails').deleteRow(e._row);
    return { ok: true };
  },
  /** העלאת קובץ: { data: dataURL, name } → { id, url } — "כל מי שיש לו קישור" */
  upload: function (req, me) {
    const m = S(req.data).match(/^data:([^;,]+);base64,(.+)$/);
    if (!m) throw new Error('bad-file');
    if (m[2].length > 34000000) throw new Error('file-big');
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], S(req.name || 'file').slice(0, 120));
    const f = folder().createFile(blob);
    f.setDescription('by ' + me + ' · ' + now());
    let pub = true;
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) { pub = false; }
    return { id: f.getId(), mime: m[1], size: blob.getBytes().length, public: pub };
  },
  /** קובץ מהתיקייה כ-dataURL (למשל הלוגו — כדי להדביק אותו על תמונות בדפדפן) */
  fileData: function (req) {
    const f = DriveApp.getFileById(S(req.id));
    let ok = false; const ps = f.getParents(); const fid = folder().getId();
    while (ps.hasNext()) if (ps.next().getId() === fid) ok = true;
    if (!ok) throw new Error('not-allowed');
    const b = f.getBlob();
    if (b.getBytes().length > 8000000) throw new Error('file-big');
    return { data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
  },
  settings: function (req) {
    if (req.logo !== undefined) setting('logo', S(req.logo).slice(0, 200));
    if (req.defaults !== undefined) setting('defaults', JSON.stringify(req.defaults || {}).slice(0, 4000));
    return { ok: true, logo: setting('logo'), defaults: setting('defaults') };
  },
  /** ניסיון: { html, subject, to?, files: [ids] } → לשולח עצמו */
  test: function (req, me) {
    const to = S(req.to || me).toLowerCase();
    MailApp.sendEmail(mailOf(to, req));
    return { ok: true, to: to, quota: MailApp.getRemainingDailyQuota() };
  },
  /**
   * פרסום (בחלקים): { id, html, subject, files, recipients: [email], final? }
   * — מדלג על מי שכבר קיבל את המייל הזה ועל מי שהסיר את עצמו. final=true → מסמן "נשלח".
   */
  publish: function (req, me) {
    const e = rows('Emails').filter(function (x) { return S(x.id) === S(req.id); })[0];
    if (!e) throw new Error('not-found');
    if (S(e.status) === 'sent' && !req.final) throw new Error('already-sent');
    const done = {};
    rows('Sent').forEach(function (r) { if (S(r.email_id) === S(e.id) && S(r.ok) === 'TRUE') done[S(r.to).toLowerCase()] = 1; });
    const un = unsubbed();
    const want = [].concat(req.recipients || []).map(function (x) { return S(x).toLowerCase().trim(); })
      .filter(function (x, i, a) { return /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(x) && a.indexOf(x) === i && !done[x] && !un[x]; }).slice(0, BATCH);
    const log = book().getSheetByName('Sent');
    let n = 0; const errs = [];
    const att = attachments(req.files);
    for (let i = 0; i < want.length; i++) {
      if (MailApp.getRemainingDailyQuota() < 1) { errs.push({ to: want[i], error: 'daily-limit' }); break; }
      try {
        MailApp.sendEmail(mailOf(want[i], req, att));
        log.appendRow([e.id, want[i], now(), 'TRUE', '']); n++;
      } catch (err) {
        const msg = S((err && err.message) || err).slice(0, 200);
        log.appendRow([e.id, want[i], now(), 'FALSE', msg]); errs.push({ to: want[i], error: msg });
      }
    }
    if (req.final) {
      e.status = 'sent'; e.sent_at = now(); e.sent_by = me;
      e.sent_n = rows('Sent').filter(function (r) { return S(r.email_id) === S(e.id) && S(r.ok) === 'TRUE'; }).length;
      if (req.subject) e.subject = S(req.subject).slice(0, 200);
      put('Emails', e);
      CacheService.getScriptCache().remove('archive');
    }
    return { sent: n, errors: errs, quota: MailApp.getRemainingDailyQuota(), skipped_done: Object.keys(done).length };
  },
  unsubAdd: function (req) {
    const email = S(req.email).toLowerCase().trim();
    if (email && !unsubbed()[email]) put('Unsubs', { email: email, at: now(), source: 'manual' });
    return { ok: true };
  },
  unsubRemove: function (req) {
    return PUBLIC.resub({ u: req.email, k: sig(req.email) });
  },
};

function attachments(ids) {
  return [].concat(ids || []).slice(0, 10).map(function (id) {
    try { return DriveApp.getFileById(S(id)).getBlob(); } catch (err) { return null; }
  }).filter(Boolean);
}
/** מייל אחד: {{UNSUB}} בתוך ה-HTML → קישור ההסרה האישי */
function mailOf(to, req, att) {
  const html = S(req.html).split('{{UNSUB}}').join(unsubLink(to));
  const o = { to: to, subject: S(req.subject) || 'קול אונגוואר', htmlBody: html, name: S(req.fromName) || 'קול אונגוואר',
    body: S(req.text || '').split('{{UNSUB}}').join(unsubLink(to)) || 'קול אונגוואר' };
  const a = att || attachments(req.files);
  if (a.length) o.attachments = a;
  return o;
}

/** בדיקה מהעורך */
function testKol() {
  Logger.log('running as: ' + Session.getEffectiveUser().getEmail());
  Logger.log('quota: ' + MailApp.getRemainingDailyQuota());
  setup();
}
