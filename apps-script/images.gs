/**
 * מוסדות אונגוואר — בילדער (Google Apps Script), אין חשבון "דאטאבייס".
 * די בילדער ליגן אין דרייב פונעם דאטאבייס, אין דער טעקע IMG_FOLDER. קיינער באקומט נישט צוטריט צו דרייב — נאר דורכן אתר.
 * action: img_put (אריינלייגן) / img_get (לייענען) / img_del (אויסמעקן — נאר מנהלים).
 */
const SHEET_ID = '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY';
const IMG_FOLDER = 'Mosdos Ungvar – תמונות';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const email = whoIs(req.token);
    if (!email || !allowed(email)) return out({ error: 'not-allowed' });
    const folder = imgFolder();
    if (req.action === 'img_put') {
      const m = String(req.data || '').match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return out({ error: 'bad-data' });
      const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(req.name || 'image').slice(0, 80));
      const file = folder.createFile(blob);
      file.setDescription('by ' + email + ' · ' + new Date().toISOString());
      return out({ id: file.getId() });
    }
    if (req.action === 'img_get') {
      const ids = [].concat(req.ids || req.id || []).slice(0, 20);
      const res = {};
      ids.forEach(function (id) {
        try {
          const f = DriveApp.getFileById(String(id));
          if (!inFolder(f, folder)) return;
          const b = f.getBlob();
          res[id] = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
        } catch (err) { /* נישטא */ }
      });
      return out({ images: res });
    }
    if (req.action === 'img_del') {
      if (!isAdmin(email)) return out({ error: 'admin-only' });
      try { const f = DriveApp.getFileById(String(req.id)); if (inFolder(f, folder)) f.setTrashed(true); } catch (err) { /* */ }
      return out({ ok: true });
    }
    return out({ error: 'unknown-action' });
  } catch (err) {
    return out({ error: String(err).slice(0, 200) });
  }
}

/** א פראבע פונעם עדיטאר: הפעלה ← testImages (מאכט די טעקע און באשטעטיגט דעם צוטריט) */
function testImages() {
  Logger.log('folder: ' + imgFolder().getUrl());
  Logger.log('sheet: ' + SpreadsheetApp.openById(SHEET_ID).getName());
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function imgFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('IMG_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* אויסגעמעקט — א נייע */ } }
  const it = DriveApp.getFoldersByName(IMG_FOLDER);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(IMG_FOLDER);
  props.setProperty('IMG_FOLDER_ID', f.getId());
  return f;
}

function inFolder(file, folder) {
  const ps = file.getParents();
  while (ps.hasNext()) if (ps.next().getId() === folder.getId()) return true;
  return false;
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

function settingsEmails(cols) {
  const rows = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Settings').getDataRange().getValues();
  const head = rows[0].map(String);
  const idx = cols.map(function (h) { return head.indexOf(h); }).filter(function (i) { return i >= 0; });
  const emails = [];
  rows.slice(1).forEach(function (r) { idx.forEach(function (i) { const v = String(r[i] || '').trim().toLowerCase(); if (v) emails.push(v); }); });
  return emails;
}

function allowed(email) {
  const cache = CacheService.getScriptCache();
  let list = cache.get('allowed');
  if (!list) { list = settingsEmails(['admin_email', 'gabbai_email', 'owner_email']).join(','); cache.put('allowed', list, 600); }
  return list.split(',').indexOf(email) >= 0;
}

function isAdmin(email) {
  return settingsEmails(['admin_email', 'owner_email']).indexOf(email) >= 0;
}
