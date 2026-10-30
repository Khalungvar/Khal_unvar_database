/**
 * מוסדות אונגוואר — SMS און טעלעפאן ("דער מוח"), Google Apps Script אין חשבון "דאטאבייס".
 *
 * ווער רופט:
 *   1) דער Cloudflare Worker (מיט SHARED_SECRET): הודעות וואס קומען אריין, סטאטוס, טעלעפאנען, Stripe.
 *   2) דער אתר (מיט דעם Google טאקען פונעם באנוצער): שיקן צו א רשימה, קרעדיטן, הקלטות.
 *   3) א זייגער (Trigger) יעדע 5 מינוט: runJobs — שיקט די געפלאנטע שליחות.
 *
 * קיין שליסלען שטייען נישט דא! אלעס אין: Project Settings → Script Properties:
 *   SHARED_SECRET            — דער זעלבער ווי אינעם Worker
 *   TELNYX_API_KEY           — פון Telnyx (Auth → API Keys)
 *   TELNYX_GABBAI_NUMBER     — +18xx... (דער Toll-Free פאר די גבאים)
 *   TELNYX_BROADCAST_NUMBER  — +18xx... (דער Toll-Free פאר שליחות צום עולם)
 *   TELNYX_VOICE_NUMBER      — +1718... (נישט געמוזט: דער מקומי'דיגער פאר הקלטות)
 *   TELNYX_MESSAGING_PROFILE — (נישט געמוזט) messaging_profile_id
 *   TELNYX_TEXML_APP_ID      — די TeXML Application (פאר טעלעפאנען)
 *   WORKER_URL               — https://....workers.dev (אן "/" אויפן סוף)
 *   GEMINI_API_KEY           — פאר צו פארשטיין די הודעות פון די גבאים
 *   STRIPE_SECRET_KEY        — sk_live_... (פאר קויפן קרעדיטן)
 *   SITE_URL                 — https://ungvar.org/
 */
const SHEET_ID = '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY';
const TZ = 'America/New_York';
const REC_FOLDER = 'Mosdos Ungvar – הקלטות';
const IMG_FOLDER = 'Mosdos Ungvar – תמונות';
const FIRST_CONTACT_ID = 2001;
const SITE_CLIENT_ID = '73541082309-bb0bc3jv1dchtpgsr129m5bbertk79ua.apps.googleusercontent.com';

const TABS = {
  SmsLog: ['at', 'dir', 'line', 'from', 'to', 'gabbai_email', 'contact_id', 'text', 'media', 'status', 'cost', 'telnyx_id', 'job_id'],
  SmsJobs: ['job_id', 'created_at', 'created_by', 'kind', 'title', 'list_name', 'org', 'text', 'recording_id', 'send_at', 'status', 'total', 'sent', 'failed', 'skipped', 'cost', 'credits', 'cursor', 'recipients', 'updated_at', 'note'],
  Credits: ['at', 'email', 'delta', 'kind', 'ref', 'note', 'by'],
  SmsOptIn: ['phone', 'status', 'source', 'contact_id', 'name', 'at', 'by'],
  SmsRecordings: ['rec_id', 'name', 'drive_id', 'mime', 'seconds', 'created_at', 'created_by', 'source'],
  SmsConfig: ['key', 'value'],
  SmsEvents: ['at', 'kind', 'gabbai_email', 'phone', 'contact_id', 'name', 'text', 'detail'],
  SmsAuto: ['auto_id', 'name', 'owner_email', 'list_id', 'list_name', 'text', 'sched', 'active', 'line', 'occ_at', 'occ_state', 'rem1', 'rem2',
    'recipients', 'recips_at', 'last_job', 'created_at', 'created_by', 'updated_at', 'occ_mod'],
  // תשובות מהציבור: א תיבה פאר אלע (נישט פאר איין גבאי — מ'ווייסט נישט אויף וועלכע מעסעדזש ער ענטפערט)
  SmsInbox: ['at', 'phone', 'contact_id', 'name', 'text', 'status', 'done_by', 'done_at', 'context'],
};
const DEFAULT_CONFIG = {
  price_sms: '0.01', price_mms: '0.03', price_call: '0.03', quiet_from: '21', quiet_to: '8', friday_cutoff: '13',
  blocked_dates: '', erev_dates: '', zmanim_text: '', call_text: 'Welcome to Mosdos Ungvar.',
  sms_brand: 'Khal Ungvar', // דער נאמען וואס הייבט אן יעדע מעסעדזש צום עולם — ווי אין דער Toll-Free Verification
};
// ---- טעקסטן צום עולם: ממש ווי אין דער Toll-Free Verification (Telnyx) און https://ungvar.org/sms.html ----
function brandOf(cfg) { return String((cfg || config()).sms_brand || '').trim() || 'Khal Ungvar'; }
/** יעדע מעסעדזש צום עולם הייבט זיך אן מיטן נאמען ("Khal Ungvar: ...") — די טעלעפאן־פירמעס פאדערן עס */
function branded(text, cfg) {
  const b = brandOf(cfg); const s = String(text || '').trim();
  // א העברעאישע מעסעדזש: דער נאמען אויף א באזונדערער שורה, כדי דער טעלעפאן זאל נישט צעמישן די ריכטונג
  return s.toLowerCase().indexOf(b.toLowerCase()) === 0 ? s : b + ':' + (/[\u0590-\u05FF]/.test(s) ? '\n' : ' ') + s;
}
// ---- אלע טעקסטן פון אונזער זייט: מ'קען זיי טוישן אויפן אתר (Calls & SMS → ניהול → נוסחים). {brand} = דער נאמען ----
const TEXTS = {
  opt_in: { g: 'public', def: '{brand}: You are subscribed to community updates. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.' },
  join_ask: { g: 'public', def: '{brand}: To complete your subscription, please reply with your full name followed by the word CONFIRM.\nExample: John Doe CONFIRM\nMsg & data rates may apply. Reply STOP to opt out.' },
  join_again: { g: 'public', def: '{brand}: Please include the word CONFIRM after your name, for example: John Doe CONFIRM' },
  new_line: { g: 'public', def: 'This is the new number of {brand}. Reply HELP for help, STOP to opt out.' },
  kw_invite: { g: 'public', def: '{brand}: Did you want to subscribe to our updates? If so, reply JOIN.' },
  auto_menu: { g: 'auto', def: '1 = לאשר · 2 = לבטל פעם אחת · 3 = להוריד שורה · 4 = הודעה מחליפה · 5 = שורת גבאי' },
  auto_menu6: { g: 'auto', def: '6 = כ"ק אד"ש לא נמצא בבארא פארק' },
  auto_away_fail: { g: 'auto', def: 'לא הצלחתי לרשום שכ"ק אד"ש לא נמצא. אנא רשמו באתר: זמני תפילות ← ✈ נסע.' },
  auto_rem1: { g: 'auto', def: 'תזכורת: "{title}" תישלח {when} ל-{count} אנשים (בערך {cost}). הקרדיטים שלך: {credits}.\n---\n{text}\n---\n{menu}' },
  auto_rem2: { g: 'auto', def: 'תזכורת אחרונה: "{title}" תישלח {when} רק אם תאשרו.\n---\n{text}\n---\n{menu}' },
  auto_now: { g: 'auto', def: 'ההודעה כרגע ("{title}", {when}):\n---\n{text}\n---\n{menu}' },
  auto_long: { g: 'auto', def: '⚠ הודעה ארוכה: {parts} חלקים, כל נמען יחויב כמו {parts} הודעות.' },
  auto_nocredit: { g: 'auto', def: 'שימו לב: חסרים {missing} בקרדיטים (צריך בערך {cost}, יש לך {credits}). לטעינה היכנסו לאתר ← קרדיטים.' },
  auto_ok_approved: { g: 'auto', def: 'אושר ✓ {title}' },
  auto_ok_approved_short: { g: 'auto', def: 'אושר ✓ {title}, אבל עדיין חסרים {missing} בקרדיטים. בלי טעינה היא לא תישלח.' },
  auto_ok_canceled: { g: 'auto', def: 'בוטל ✓ {title}' },
  auto_cancel_q: { g: 'auto', def: 'לבטל את "{title}" הפעם? 1 = כן, לבטל · 2 = לא' },
  auto_kept: { g: 'auto', def: 'ההודעה נשארת מאושרת ✓ {title}' },
  auto_drop_q: { g: 'auto', def: '{numbered}\n---\nאיזו שורה להוריד? לכמה שורות כתבו עם פסיק, למשל: 2,4 · 0 = חזרה' },
  auto_text_q: { g: 'auto', def: 'אנא כתבו את הטקסט המלא לשליחה הזאת. 0 = חזרה' },
  auto_line_q: { g: 'auto', def: 'אנא כתבו: 111 ואחריו שורת גבאי 1, או 222 ואחריו שורת גבאי 2. 0 = חזרה' },
  auto_nobrand_q: { g: 'auto', def: 'ההודעה שלך תרד מ-{from} חלקים ל-{to} אם נוריד את המילה {brand}, רק הפעם.\n1 = לשלוח בלי {brand} · 2 = להשאיר עם {brand}' },
  auto_nobrand_ok: { g: 'auto', def: 'יישלח בלי {brand} ✓ {title}' },
  auto_nobrand_keep: { g: 'auto', def: 'נשאר עם {brand} ✓ {title}' },
  auto_missed: { g: 'auto', def: '"{title}" לא נשלחה {when}, כי לא אושרה. לשליחה אנא היכנסו לאתר.' },
  auto_failed_credit: { g: 'auto', def: '"{title}" לא נשלחה {when}, כי חסרים {missing} בקרדיטים. לטעינה ולשליחה אנא היכנסו לאתר.' },
  auto_skip: { g: 'auto', def: '"{title}" לא תישלח {when}, כי {reason}.' },
};
/** א טעקסט: פון די הגדרות (txt_<key>) אדער דער ברירת מחדל; {x} → vars.x */
function txt_(key, vars, cfg) {
  cfg = cfg || config();
  const v = Object.assign({ brand: brandOf(cfg) }, vars || {});
  const t = String(cfg['txt_' + key] || (TEXTS[key] || {}).def || '');
  return t.replace(/\{([^{}]+)\}/g, function (all, k) { return v[k] !== undefined ? String(v[k]) : all; });
}
function optInText(cfg) { return txt_('opt_in', null, cfg); }
function askNameText(cfg) { return txt_('join_ask', null, cfg); }
function confirmAgainText(cfg) { return txt_('join_again', null, cfg); }
function newLineNote(cfg) { return '\n\n' + txt_('new_line', null, cfg); }

// ====================================================================== אריינגאנג
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    if (req.secret) {
      if (req.secret !== props.getProperty('SHARED_SECRET')) return out({ error: 'bad-secret' });
      return out(fromWorker(req));
    }
    // התצוגה בבית הכנסת: "אני מחובר" (בלי כניסה) · והסטטוס לאתר
    if (req.action === 'display_ping') return out(displayPing_(req));
    if (req.action === 'display_status') return out(displayStatus_());
    const email = whoIs(req.token);
    if (!email || !allowed(email)) return out({ error: 'not-allowed' });
    return out(fromSite(req, email));
  } catch (err) {
    return out({ error: String(err && err.message || err).slice(0, 300) });
  }
}
function displayPing_(req) {
  const v = String(req.v || '').replace(/[^\d]/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('display_seen', JSON.stringify({ at: Date.now(), v: v }));
  return { ok: true };
}
function displayStatus_() {
  let s = null; try { s = JSON.parse(PropertiesService.getScriptProperties().getProperty('display_seen') || 'null'); } catch (e) { s = null; }
  return { seen: s, now: Date.now() };
}
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/** איינמאל: מאכט די לשוניות און דעם זייגער (Trigger) פאר runJobs. Run ← setup */
function setup() {
  Object.keys(TABS).forEach(function (k) { sheetOf(k); });
  const cfg = sheetOf('SmsConfig');
  const have = cfg.getDataRange().getValues().map(function (r) { return String(r[0]); });
  Object.keys(DEFAULT_CONFIG).forEach(function (k) { if (have.indexOf(k) < 0) cfg.appendRow([k, DEFAULT_CONFIG[k]]); });
  // קרעדיטן / שליחות / הגדרות: נאר דער סקריפט (און דער בעל הבית) קען טוישן — נישט די גבאים
  ['Credits', 'SmsJobs', 'SmsConfig', 'SmsRecordings'].forEach(function (n) {
    const pr = sheetOf(n).protect().setDescription('SMS — only the script');
    const me = Session.getEffectiveUser();
    pr.addEditor(me);
    pr.removeEditors(pr.getEditors().filter(function (u) { return u.getEmail() !== me.getEmail(); }));
    if (pr.canDomainEdit()) pr.setDomainEdit(false);
  });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runJobs') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runJobs').timeBased().everyMinutes(5).create();
  Logger.log('ok — tabs + trigger');
}

// ====================================================================== גיליון
let SS = null;
function ss() { if (!SS) SS = SpreadsheetApp.openById(SHEET_ID); return SS; }
function sheetOf(name) {
  let sh = ss().getSheetByName(name);
  if (!sh) {
    sh = ss().insertSheet(name);
    if (TABS[name]) sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]);
  }
  return sh;
}
/** { head, rows: [obj + _row] } */
function readTab(name) {
  const sh = sheetOf(name);
  const v = sh.getDataRange().getValues();
  const head = (v[0] || []).map(String);
  const rows = [];
  for (let i = 1; i < v.length; i += 1) {
    const o = { _row: i + 1 };
    let any = false;
    head.forEach(function (h, j) { if (h) { o[h] = cellOut(v[i][j]); if (v[i][j] !== '' && v[i][j] !== null) any = true; } });
    if (any) rows.push(o);
  }
  return { head: head, rows: rows, sheet: sh };
}
/** א טעקסט וואס זעט אויס ווי א דאטום → בלייבט טעקסט (נישט א Date אין גיליון) */
function txt(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? "'" + v : v; }
function cellOut(v) {
  if (v instanceof Date) { const s = Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm'); return / 00:00$/.test(s) ? s.slice(0, 10) : s; }
  return v;
}
function appendObj(name, obj) {
  const t = readHead(name);
  t.sheet.appendRow(t.head.map(function (h) { return obj[h] === undefined || obj[h] === null ? '' : txt(obj[h]); }));
  return t.sheet.getLastRow();
}
function readHead(name) {
  const sh = sheetOf(name);
  const head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  return { head: head, sheet: sh };
}
function setFields(name, row, fields) {
  const t = readHead(name);
  Object.keys(fields).forEach(function (k) {
    const j = t.head.indexOf(k);
    if (j >= 0) t.sheet.getRange(row, j + 1).setValue(txt(fields[k]));
  });
}
function stamp() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function today() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
/** א געשעעניש פאר "די גבאים אין SMS" (אויפן אתר): action / fail / error / canceled / unregistered / join_phone / join_name / join_review */
function ev(kind, f) {
  try {
    f = f || {};
    appendObj('SmsEvents', { at: stamp(), kind: kind, gabbai_email: f.g ? f.g.email : '', phone: f.phone ? fmtPhone(f.phone) : '', contact_id: f.contact_id || '',
      name: f.name || '', text: String(f.text || '').slice(0, 500), detail: String(f.detail || '').slice(0, 500) });
  } catch (e) { /* דער לאג טאר נישט שטערן */ }
}
let CFG = null; // איינמאל פער לויף
function config() {
  if (CFG) return CFG;
  const c = {};
  Object.keys(DEFAULT_CONFIG).forEach(function (k) { c[k] = DEFAULT_CONFIG[k]; });
  readTab('SmsConfig').rows.forEach(function (r) { c[String(r.key)] = String(r.value); });
  CFG = c;
  return c;
}
function history(by, entity, id, contactId, field, oldV, newV) {
  try { sheetOf('History').appendRow([txt(stamp()), by, entity, String(id), String(contactId || ''), field, String(oldV || '').slice(0, 500), String(newV || '').slice(0, 500)]); } catch (e) { /* */ }
}

// ====================================================================== ווער איז ער
function whoIs(token) {
  if (!token) return '';
  const cache = CacheService.getScriptCache();
  const hit = cache.get('t:' + token.slice(-24));
  if (hit) return hit;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const info = JSON.parse(r.getContentText());
  // נאר א טאקען וואס איז געמאכט געווארן פאר אונזער אתר
  if (info.aud !== SITE_CLIENT_ID && info.azp !== SITE_CLIENT_ID) return '';
  const email = String(info.email || '').toLowerCase();
  if (email) cache.put('t:' + token.slice(-24), email, 1800);
  return email;
}
function settingsCols(cols) {
  const t = readTab('Settings');
  const out = [];
  t.rows.forEach(function (r) { const o = {}; cols.forEach(function (c) { o[c] = String(r[c] || '').trim(); }); out.push(o); });
  return out;
}
function allowed(email) {
  const s = settingsCols(['admin_email', 'gabbai_email', 'owner_email']);
  return s.some(function (r) { return [r.admin_email, r.gabbai_email, r.owner_email].map(lower).indexOf(email) >= 0; });
}
function isAdmin(email) {
  return settingsCols(['admin_email', 'owner_email']).some(function (r) { return lower(r.admin_email) === email || lower(r.owner_email) === email; });
}
function lower(v) { return String(v || '').trim().toLowerCase(); }
/** א גבאי לויט זיין טעלעפאן (Settings: gabbai_phone) */
function gabbaiByPhone(phone) {
  const d = last10(phone);
  if (!d) return null;
  const s = settingsCols(['gabbai_email', 'gabbai_name', 'gabbai_phone']);
  for (let i = 0; i < s.length; i += 1) {
    if (last10(s[i].gabbai_phone) === d && s[i].gabbai_email) return { email: lower(s[i].gabbai_email), name: s[i].gabbai_name || s[i].gabbai_email };
  }
  return null;
}
function last10(p) { const d = String(p || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; }
function isT(v) { return v === true || /^(true|1|yes)$/i.test(String(v)); }
function e164(p) { const d = last10(p); return d ? '+1' + d : ''; }
function fmtPhone(p) { const d = last10(p); return d ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : String(p || ''); }

// ====================================================================== פונעם Worker
function fromWorker(req) {
  const P = PropertiesService.getScriptProperties();
  if (req.action === 'sms_in') {
    const to = last10(req.to);
    sheetOf('SmsLog').appendRow(rowOf('SmsLog', { at: stamp(), dir: 'in', line: to === last10(P.getProperty('TELNYX_GABBAI_NUMBER')) ? 'gabbai' : 'broadcast', from: e164(req.from), to: e164(req.to), text: req.text || '', media: (req.media || []).map(function (m) { return m.url; }).join(' '), telnyx_id: req.id || '' }));
    if (to === last10(P.getProperty('TELNYX_GABBAI_NUMBER'))) return gabbaiInbound(req.from, String(req.text || ''), req.media || []);
    return publicInbound(req.from, String(req.text || ''));
  }
  if (req.action === 'sms_status') return smsStatus(req);
  if (req.action === 'call_in') return { xml: callIn(req) };
  if (req.action === 'call_menu') return { xml: callMenu(req) };
  if (req.action === 'call_recorded') return { xml: callRecorded(req) };
  if (req.action === 'call_play') return { xml: callPlay(req) };
  if (req.action === 'audio') return audioOf(req.id);
  if (req.action === 'stripe_paid') return stripePaid(req);
  return { error: 'unknown-action' };
}
function rowOf(name, obj) { return TABS[name].map(function (h) { return obj[h] === undefined ? '' : txt(obj[h]); }); }

// ====================================================================== שיקן א SMS
function sendSms(fromNumber, to, text, media, meta) {
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('TELNYX_API_KEY');
  const body = { from: fromNumber, to: e164(to), text: String(text || '').slice(0, 1500) };
  const prof = P.getProperty('TELNYX_MESSAGING_PROFILE');
  if (prof) body.messaging_profile_id = prof;
  if (media && media.length) body.media_urls = media;
  let id = ''; let status = 'sent'; let err = '';
  if (!key) { status = 'no-key'; } else {
    const r = UrlFetchApp.fetch('https://api.telnyx.com/v2/messages', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key }, payload: JSON.stringify(body), muteHttpExceptions: true,
    });
    if (r.getResponseCode() >= 300) { status = 'error'; err = r.getContentText().slice(0, 200); } else id = JSON.parse(r.getContentText()).data.id;
  }
  meta = meta || {};
  sheetOf('SmsLog').appendRow(rowOf('SmsLog', { at: stamp(), dir: 'out', line: meta.line || '', from: fromNumber, to: e164(to), gabbai_email: meta.email || '', contact_id: meta.contact_id || '', text: body.text + (err ? ' ⚠ ' + err : ''), media: (media || []).join(' '), status: status, telnyx_id: id, job_id: meta.job_id || '' }));
  return { id: id, status: status };
}
function replyGabbai(to, text) { return sendSms(PropertiesService.getScriptProperties().getProperty('TELNYX_GABBAI_NUMBER'), to, text, null, { line: 'gabbai' }); }
function smsStatus(req) {
  const t = readTab('SmsLog');
  for (let i = t.rows.length - 1; i >= 0 && i >= t.rows.length - 3000; i -= 1) {
    if (String(t.rows[i].telnyx_id) === String(req.id)) {
      setFields('SmsLog', t.rows[i]._row, { status: req.status || t.rows[i].status, cost: req.cost !== undefined ? req.cost : t.rows[i].cost });
      return { ok: true };
    }
  }
  return { ok: false };
}

// ====================================================================== דער עולם: STOP / START / JOIN / ענטפערס
const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'סטאפ', 'סטופ'];
const START_WORDS = ['start', 'unstop', 'yes'];
const JOIN_WORDS = ['join', 'subscribe'];
const HELP_WORDS = ['help', 'info']; // Telnyx ענטפערט אליין (Messaging Profile → Keywords)
function optRow(phone) {
  const d = last10(phone);
  const t = readTab('SmsOptIn');
  for (let i = 0; i < t.rows.length; i += 1) if (last10(t.rows[i].phone) === d) return t.rows[i];
  return null;
}
function setOpt(phone, fields) {
  const r = optRow(phone);
  const f = Object.assign({ at: stamp() }, fields);
  if (r) setFields('SmsOptIn', r._row, f);
  else appendObj('SmsOptIn', Object.assign({ phone: fmtPhone(phone) }, f));
}
function publicInbound(from, text) {
  const P = PropertiesService.getScriptProperties();
  const line = P.getProperty('TELNYX_BROADCAST_NUMBER');
  const w = text.trim().toLowerCase().replace(/[^\w֐-׿]/g, '');
  const cache = CacheService.getScriptCache();
  const k = 'join:' + last10(from);
  if (STOP_WORDS.indexOf(w) >= 0) {
    // Telnyx שיקט אליין די "You have been unsubscribed" — מ'פארשרייבט נאר
    setOpt(from, { status: 'out', source: 'stop', by: 'sms' });
    return { ok: true, handled: 'stop' };
  }
  if (HELP_WORDS.indexOf(w) >= 0) return { ok: true, handled: 'help' };
  if (START_WORDS.indexOf(w) >= 0) {
    // Telnyx שיקט אליין די באשטעטיגונג (Messaging Profile → Keywords) — מ'פארשרייבט נאר
    const r = optRow(from);
    setOpt(from, { status: 'in', source: r && r.source && r.source !== 'stop' ? r.source : 'start', by: 'sms' });
    return { ok: true, handled: 'start' };
  }
  if (JOIN_WORDS.indexOf(w) >= 0) {
    // 1) דער נומער איז שוין ביי א קאנטאקט → גלייך
    const c = contactsByPhone(from)[0];
    if (c) {
      setOpt(from, { status: 'in', source: 'join', contact_id: c.contact_id, name: heName(c), by: 'sms' });
      sendSms(line, from, optInText(), null, { line: 'broadcast', contact_id: c.contact_id });
      ev('join_phone', { phone: from, contact_id: c.contact_id, name: heName(c), text: text });
      return { ok: true, handled: 'join-known' };
    }
    // 2) נישט באקאנט: בעטן דעם נאמען + CONFIRM (ערשט דאן איז ער פארשריבן)
    cache.put(k, 'ask', 21600);
    sendSms(line, from, askNameText(), null, { line: 'broadcast' });
    return { ok: true, handled: 'join' };
  }
  // א גבאי ענטפערט אויף א דערמאנונג פון א הודעה אוטומטית (1–5 / 0 / 111 / 222 / טעקסט)
  const gb = gabbaiByPhone(from);
  if (gb) { const ar = autoReply(from, text, gb); if (ar) return ar; }
  // א "מילה" פון א הודעה אוטומטית (למשל "זמנים") → גלייך דער ענטפער
  const kwA = kwMatch(w);
  if (kwA) return kwReply(from, kwA, line, text);
  const jst = cache.get(k);
  if (jst) {
    const m = text.match(/^(.*?)\s*\bconfirm\b\.?\s*(.*)$/i);
    if (!m) {
      // אן CONFIRM: איינמאל דערקלערן; דערנאך ווארטן (א שטיקל ענטפער גייט צום גבאי)
      if (jst === 'ask') { cache.put(k, 'again', 21600); sendSms(line, from, confirmAgainText(), null, { line: 'broadcast' }); return { ok: true, handled: 'join-again' }; }
    } else {
      cache.remove(k);
      const name = (m[1] + ' ' + m[2]).replace(/\s+/g, ' ').trim().slice(0, 80);
      setOpt(from, { status: 'in', source: 'join', name: name, contact_id: '', by: 'sms' });
      sendSms(line, from, optInText(), null, { line: 'broadcast' });
      // 3) זוכן לויטן נאמען (Gemini) — נישט פרעגן דעם מענטש
      const r = joinMatch(name);
      if (r.contact) {
        setOpt(from, { contact_id: r.contact.contact_id });
        ev('join_name', { phone: from, contact_id: r.contact.contact_id, name: name, text: text, detail: heName(r.contact) });
      } else {
        const opts = r.cands.slice(0, 4).map(function (c) { return heName(c) + (parentLine(c) ? ' (' + parentLine(c) + ')' : ''); }).join(' / ');
        ev('join_review', { phone: from, name: name, text: text, detail: opts ? 'אפשרויות: ' + opts : 'לא נמצא באנשי הקשר' });
        generalTask('📱 הצטרף לקבלת הודעות: ' + name + ' · ' + fmtPhone(from) + ' — לשייך לאיש קשר (Calls & SMS → הגבאים בהודעות)' + (opts ? '. אפשרויות: ' + opts : ''), '');
      }
      return { ok: true, handled: 'join-name' };
    }
  }
  // אן ענטפער → די געמיינזאמע תיבה "תשובות מהציבור" (פאר אלע מיט SMS)
  const lastJob = lastJobTo(from);
  const c = contactsByPhone(from)[0];
  appendObj('SmsInbox', { at: stamp(), phone: fmtPhone(from), contact_id: c ? c.contact_id : '', name: c ? heName(c) : '', text: text.slice(0, 1000), status: 'new', context: lastJob ? lastJob.title : '' });
  return { ok: true, handled: 'reply' };
}
function lastJobTo(phone) {
  const d = last10(phone);
  const log = readTab('SmsLog').rows;
  for (let i = log.length - 1; i >= 0 && i >= log.length - 5000; i -= 1) {
    if (log[i].dir === 'out' && log[i].job_id && last10(log[i].to) === d) {
      const j = readTab('SmsJobs').rows.filter(function (x) { return String(x.job_id) === String(log[i].job_id); })[0];
      if (j) return j;
    }
  }
  return null;
}
function adminEmails() { return settingsCols(['admin_email']).map(function (r) { return lower(r.admin_email); }).filter(String); }
function notifyAdmins(kind, subject, text) {
  adminEmails().forEach(function (e) {
    appendObj('Messages', { msg_id: kind + Date.now() + Math.floor(Math.random() * 1000), from_email: 'sms', to_email: e, kind: kind, subject: subject, text: text, status: 'new', created_at: stamp(), created_by: 'sms' });
  });
}

// ====================================================================== קאנטאקטן
let CONTACTS = null; let PHONES = null; let RELS = null;
function contacts() { if (!CONTACTS) CONTACTS = readTab('Contacts').rows.filter(function (c) { return !String(c.deleted_at || '').trim(); }); return CONTACTS; }
function phonesMap() {
  if (!PHONES) { PHONES = {}; readTab('Phones').rows.forEach(function (p) { PHONES[String(p.contact_id)] = p; }); }
  return PHONES;
}
function rels() { if (!RELS) RELS = readTab('Relations').rows; return RELS; }
function byId(id) { return contacts().filter(function (c) { return String(c.contact_id) === String(id); })[0] || null; }
function heName(c) { return [c.title_he, c.first_name_he, c.last_name_he].filter(function (x) { return String(x || '').trim(); }).join(' '); }
function enName(c) { return [c.first_name_en, c.last_name_en].filter(function (x) { return String(x || '').trim(); }).join(' '); }
function contactsByPhone(phone) {
  const d = last10(phone);
  if (!d) return [];
  const P = phonesMap();
  return contacts().filter(function (c) {
    const p = P[String(c.contact_id)] || {};
    return ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some(function (k) { return last10(p[k]) === d; });
  });
}
function norm(s) {
  return String(s || '').toLowerCase().replace(/[֑-ׇ"'״׳.,]/g, '').replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ')
    .replace(/\s+/g, ' ').trim();
}
const TITLES = ['ר', 'רב', 'הרב', 'מוה', 'מו"ה', 'הר"ר', 'רבי', 'הבחור', 'reb', 'rabbi', 'mr', 'mrs', 'r'];
/** געפינט קאנטאקטן לויט א נאמען (לשון קודש אדער ענגליש), די בעסטע פריער */
function matchName(name, hint) {
  const words = norm(name).split(' ').filter(function (w) { return w && TITLES.indexOf(w) < 0; });
  if (!words.length) return [];
  const H = norm(hint || '');
  const scored = [];
  contacts().forEach(function (c) {
    const he = norm([c.first_name_he, c.last_name_he].join(' ')).split(' ');
    const en = norm([c.first_name_en, c.last_name_en].join(' ')).split(' ');
    let s = 0;
    words.forEach(function (w) { if (he.indexOf(w) >= 0 || en.indexOf(w) >= 0) s += 2; else if (he.concat(en).some(function (x) { return x && w.length > 2 && x.indexOf(w) === 0; })) s += 1; });
    if (s < words.length * 2 - 1 || s < 2) return;
    if (H) { const blob = norm([c.address, c.city, parentLine(c)].join(' ')); H.split(' ').forEach(function (w) { if (w && blob.indexOf(w) >= 0) s += 1; }); }
    scored.push({ c: c, s: s });
  });
  scored.sort(function (a, b) { return b.s - a.s; });
  const top = scored.length ? scored[0].s : 0;
  return scored.filter(function (x) { return x.s >= top; }).slice(0, 8).map(function (x) { return x.c; });
}
/** "זון פון X" / "איידעם פון Y" — אדער די אדרעס */
function parentLine(c) {
  const id = String(c.contact_id);
  let f = null; let fil = null;
  rels().forEach(function (r) {
    const a = String(r.contact_id_a); const b = String(r.contact_id_b); const t = String(r.relation_type);
    if (a === id && t === 'זון פון') f = f || byId(b);
    if (b === id && t === 'טאטע פון') f = f || byId(a);
    if (a === id && t === 'איידעם פון') fil = fil || byId(b);
    if (b === id && t === 'שווער פון') fil = fil || byId(a);
  });
  if (f) return 'בן ' + heName(f);
  if (fil) return 'חתן ' + heName(fil);
  return '';
}
function describe(c) { return heName(c) + (parentLine(c) ? ' · ' + parentLine(c) : (c.address ? ' · ' + c.address : '')); }

// ====================================================================== גבאים: א שמועס
const SAY = {
  notReg: { en: 'This number is not registered in the Mosdos Ungvar system.', yi: 'דער נומער איז נישט רעגיסטרירט אין סיסטעם פון מוסדות אונגוואר.', he: 'המספר הזה לא רשום במערכת מוסדות אונגוואר.' },
  confirm: { en: 'Reply 1 to confirm, 2 to cancel.', yi: 'ענטפערט 1 צו באשטעטיגן, 2 צו אפזאגן.', he: 'השיבו 1 לאישור, 2 לביטול.' },
  canceled: { en: 'Canceled.', yi: 'אפגעזאגט.', he: 'בוטל.' },
  done: { en: 'Done ✓', yi: 'געטון ✓', he: 'בוצע ✓' },
  choose: { en: 'Which one? Reply with the number:', yi: 'וועלכער? ענטפערט מיטן נומער:', he: 'מי מהם? השיבו במספר:' },
  notFound: { en: 'Not found:', yi: 'נישט געפונען:', he: 'לא נמצא:' },
  noUnderstand: { en: 'Sorry, I did not understand. You can add or update a contact, ask for a phone/address, add a note, record a donation, or send a simcha invitation.', yi: 'אנטשולדיגט, איך האב נישט פארשטאנען. מען קען צולייגן / טוישן א קאנטאקט, פרעגן א טעלעפאן / אדרעס, צולייגן א הערה, א נדבה, אדער שיקן א הזמנה פון א שמחה.', he: 'סליחה, לא הבנתי. אפשר להוסיף / לעדכן איש קשר, לשאול טלפון / כתובת, להוסיף הערה, לרשום תרומה, או לשלוח הזמנה לשמחה.' },
  imageWhat: { en: 'Is this a simcha invitation (1) or a photo for a contact (2)?', yi: 'איז דאס א הזמנה פון א שמחה (1) אדער א בילד פאר א קאנטאקט (2)?', he: 'זו הזמנה לשמחה (1) או תמונה לאיש קשר (2)?' },
  photoWho: { en: 'Whose photo is it? Reply with the name.', yi: 'וועמענס בילד איז דאס? ענטפערט מיטן נאמען.', he: 'של מי התמונה? השיבו בשם.' },
  noPerm: { en: 'This can only be done on the website.', yi: 'דאס קען מען נאר טון אויפן אתר.', he: 'את זה אפשר לעשות רק באתר.' },
  error: { en: 'Something went wrong:', yi: 'עפעס איז נישט געלונגען:', he: 'משהו לא הצליח:' },
};
function say(k, lang) {
  const c = config(); const o = c['say_' + k + '_' + lang];
  return o || (SAY[k] || {})[lang] || c['say_' + k + '_en'] || (SAY[k] || {}).en || k;
}
/** פאר דעם אתר: אלע טעקסטן — ברירת מחדל + וואס איז געטוישט */
function textsList() {
  const c = config(); const out = [];
  Object.keys(TEXTS).forEach(function (k) { out.push({ key: 'txt_' + k, group: TEXTS[k].g, def: TEXTS[k].def, value: c['txt_' + k] || '' }); });
  Object.keys(SAY).forEach(function (k) { ['he', 'yi', 'en'].forEach(function (l) { if (SAY[k][l] !== undefined) out.push({ key: 'say_' + k + '_' + l, group: 'gabbai', lang: l, def: SAY[k][l], value: c['say_' + k + '_' + l] || '' }); }); });
  return out;
}
function stateGet(phone) { const v = CacheService.getScriptCache().get('st:' + last10(phone)); return v ? JSON.parse(v) : null; }
function statePut(phone, st) { CacheService.getScriptCache().put('st:' + last10(phone), JSON.stringify(st), 21600); }
function stateClear(phone) { CacheService.getScriptCache().remove('st:' + last10(phone)); }
function langOf(text) { return /[֐-׿]/.test(text) ? (/\b(איז|נישט|פון|דער|מיט|וואס|ער|זיין)\b/.test(text) || /יי|וו|ײ/.test(text) ? 'yi' : 'he') : 'en'; }

function gabbaiInbound(from, text, media) {
  const g = gabbaiByPhone(from);
  const lang0 = langOf(text);
  if (!g) {
    // איינמאל אין 24 שעה, און א מעלדונג פאר די מנהלים
    const cache = CacheService.getScriptCache();
    const k = 'unreg:' + last10(from);
    if (!cache.get(k)) {
      cache.put(k, '1', 21600);
      replyGabbai(from, say('notReg', lang0));
      ev('unregistered', { phone: from, text: text });
      notifyAdmins('sms_unknown', 'SMS: ' + fmtPhone(from), 'א נישט רעגיסטרירטער נומער האט געשיקט צום גבאים-נומער: ' + fmtPhone(from) + '\n"' + text.slice(0, 300) + '"');
    }
    return { ok: true, handled: 'unregistered' };
  }
  const st = stateGet(from) || {};
  const lang = text.trim() ? lang0 : (st.lang || 'yi');
  const t = text.trim();
  try {
    // 1) א באשטעטיגונג
    if (st.step === 'confirm') {
      if (/^(1|yes|y|ok|כן|יא|יאָ|יע)$/i.test(t)) {
        stateClear(from); const res = execute(st.action, g, st.lang || lang); replyGabbai(from, res);
        ev('action', { g: g, phone: from, contact_id: st.action.contact_id || '', text: st.text || '', detail: summary(st.action, 'he') + ' → ' + res });
        return { ok: true };
      }
      if (/^(2|no|n|לא|ניין|נײן|ביטול)$/i.test(t)) {
        stateClear(from); replyGabbai(from, say('canceled', st.lang || lang));
        ev('canceled', { g: g, phone: from, contact_id: st.action.contact_id || '', text: st.text || '', detail: summary(st.action, 'he') });
        return { ok: true };
      }
    }
    // 2) א בחירה פון א ליסטע
    if (st.step === 'choose' && /^\d{1,2}$/.test(t)) {
      const pick = st.options[Number(t) - 1];
      if (pick) { st.action.contact_id = pick; return ask(from, st.action, g, st.lang || lang); }
    }
    // 3) א בילד: שמחה אדער קאנטאקט
    if (st.step === 'image' && /^[12]$/.test(t)) {
      if (t === '1') return parseAndAsk(from, 'simcha invitation image', [st.media], g, st.lang || lang);
      statePut(from, { step: 'photo_who', media: st.media, lang: st.lang || lang });
      replyGabbai(from, say('photoWho', st.lang || lang));
      return { ok: true };
    }
    if (st.step === 'photo_who' && t) {
      return ask(from, { action: 'photo', who: { name: t }, media: st.media }, g, st.lang || lang);
    }
    const img = (media || []).filter(function (m) { return /^image\//.test(m.content_type || m.type || ''); })[0];
    if (img && !t) {
      statePut(from, { step: 'image', media: img.url, lang: lang });
      replyGabbai(from, say('imageWhat', lang));
      return { ok: true };
    }
    return parseAndAsk(from, t, img ? [img.url] : [], g, lang);
  } catch (err) {
    replyGabbai(from, say('error', lang) + ' ' + String(err && err.message || err).slice(0, 120));
    ev('error', { g: g, phone: from, text: text, detail: String(err && err.message || err) });
    return { ok: false, error: String(err) };
  }
}

/** Gemini: וואס וויל דער גבאי? → { action, ... } */
function aiParse(text, images) {
  const system = [
    'You read SMS messages from gabbaim (managers) of a Jewish community database (Khal Ungvar, Brooklyn). Messages are in Yiddish, Hebrew or English.',
    'Return ONLY JSON: {"lang":"yi|he|en","action":..., ...}. Actions:',
    '- add_contact: {"contact":{title_he,first_name_he,last_name_he,first_name_en,last_name_en,address,city,state,zip,mobile,home_phone,email,wife_name_he}}',
    '- update_contact: {"who":{"name":"...","hint":"father/address if given"},"fields":{same keys as contact, only what changes}}',
    '- query: {"who":{...},"what":"phone|address|email|all|yahrzeit|simcha|donations"}',
    '- add_note: {"who":{...},"note":"..."}',
    '- donation: {"who":{...},"amount":number,"campaign":"...","method":"cash|check|card|other","check_number":"","date":"YYYY-MM-DD or empty","paid":true}',
    '- simcha: {"who":[{"name":"...","hint":""}],"type":"birth|upsherin|barmitzvah|erusin|nisuin","child":"name or empty","date":"YYYY-MM-DD or empty","note":"..."} (also when reading a simcha invitation image)',
    '- photo: {"who":{...}}',
    '- unknown: {}',
    'Hebrew names stay in Hebrew letters; English names in English. US addresses: split city/state/zip. Phone numbers: digits only. Never invent data.',
  ].join('\n');
  const parts = [{ text: text || '(image only)' }];
  (images || []).forEach(function (url) {
    try {
      const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) parts.push({ inline_data: { mime_type: r.getHeaders()['Content-Type'] || 'image/jpeg', data: Utilities.base64Encode(r.getContent()) } });
    } catch (e) { /* */ }
  });
  return geminiJson(system, parts);
}
/** Gemini → JSON. ענטפערט אמאל "פארנומען" (429/500/503) — נאכאמאל פרובירן, ביז 3 מאל */
function geminiJson(system, parts) {
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('no GEMINI_API_KEY');
  const model = P.getProperty('GEMINI_MODEL') || 'gemini-flash-latest';
  const req = {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
    // די נייע מאדעלן "טראכטן" אויך מיט די טאקענס — דערפאר 4096 (ווי אינעם הילף-AI)
    payload: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 4096 } }),
  };
  let res = null;
  for (let i = 0; i < 3; i += 1) {
    res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', req);
    if ([429, 500, 503].indexOf(res.getResponseCode()) < 0) break;
    Utilities.sleep(2000 * (i + 1));
  }
  if (res.getResponseCode() !== 200) throw new Error('AI ' + res.getResponseCode());
  const data = JSON.parse(res.getContentText());
  const txt = ((((data.candidates || [])[0] || {}).content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');
  return JSON.parse(txt.replace(/^```json|```$/g, '').trim());
}

/** JOIN: געפינען דעם קאנטאקט לויטן נאמען וואס דער מענטש האט געשיקט (ענגליש אדער לשון קודש). → contact אדער null + קאנדידאטן */
function joinMatch(name) {
  const seen = {}; let cands = [];
  const add = function (list) { list.forEach(function (c) { if (!seen[c.contact_id]) { seen[c.contact_id] = true; cands.push(c); } }); };
  add(matchName(name));
  let variants = null;
  try {
    variants = geminiJson('You convert a Jewish person\'s name (often Chassidic/Yiddish, may be written in English letters or Hebrew letters) into likely spellings. Return ONLY JSON: {"he":["first last" in Hebrew letters, up to 3 spellings],"en":["first last" in English letters, up to 3 spellings]}. Never invent extra people.',
      [{ text: name }]);
  } catch (e) { variants = null; }
  if (variants) [].concat(variants.he || [], variants.en || []).forEach(function (v) { if (v) add(matchName(String(v))); });
  if (cands.length > 12) cands = cands.slice(0, 12);
  if (cands.length === 1) return { contact: cands[0], cands: cands };
  if (cands.length > 1) {
    try {
      const list = cands.map(function (c) { return c.contact_id + ': ' + heName(c) + ' / ' + enName(c) + (parentLine(c) ? ' / ' + parentLine(c) : '') + (c.address ? ' / ' + c.address : ''); }).join('\n');
      const pick = geminiJson('A person texted their name to join a synagogue\'s SMS list. Choose which contact from the list is that person. Answer ONLY JSON {"id":"<contact id>"} when exactly one contact clearly matches the full name (first AND last name), otherwise {"id":""}. Do not guess between similar people.',
        [{ text: 'Name: ' + name + '\nContacts:\n' + list }]);
      const c = cands.filter(function (x) { return String(x.contact_id) === String(pick && pick.id || ''); })[0];
      if (c) return { contact: c, cands: cands };
    } catch (e) { /* בלייבט פאר א גבאי */ }
  }
  return { contact: null, cands: cands };
}
/** א משימה אין דעם כללי'דיגן To Do (לשונית Tasks, assigned_to = all) */
function generalTask(text, contactId) {
  try {
    appendObj('Tasks', { task_id: 'sms' + Date.now(), from_email: 'sms', text: text, contact_id: contactId || '', assigned_to: 'all', status: 'open',
      done_at: '', done_by: '', remind_at: '', created_at: stamp(), created_by: 'sms' });
  } catch (e) { /* */ }
}
function parseAndAsk(from, text, images, g, lang) {
  const a = aiParse(text, images);
  if (images && images.length) a.media = images[0];
  a._text = String(text || '').slice(0, 500); a._from = from; a._g = g ? g.email : '';
  return ask(from, a, g, a.lang || lang);
}

/** פארן טון: געפינען וועמען (אדער פרעגן וועלכער) און בעטן א באשטעטיגונג */
function ask(from, a, g, lang) {
  const act = a.action;
  if (!act || act === 'unknown') { replyGabbai(from, say('noUnderstand', lang)); ev('fail', { g: g, phone: from, text: a._text, detail: 'לא הובן' }); return { ok: true }; }
  if (['update_contact', 'query', 'add_note', 'donation', 'photo'].indexOf(act) >= 0 && !a.contact_id) {
    const who = a.who || {};
    const m = matchName(who.name || '', who.hint || '');
    if (!m.length) { stateClear(from); replyGabbai(from, say('notFound', lang) + ' ' + (who.name || '')); ev('fail', { g: g, phone: from, text: a._text, detail: 'לא נמצא: ' + (who.name || '') }); return { ok: true }; }
    if (m.length > 1) {
      statePut(from, { step: 'choose', action: a, options: m.map(function (c) { return String(c.contact_id); }), lang: lang });
      replyGabbai(from, say('choose', lang) + '\n' + m.map(function (c, i) { return (i + 1) + '. ' + describe(c); }).join('\n'));
      return { ok: true };
    }
    a.contact_id = String(m[0].contact_id);
  }
  if (act === 'query') { stateClear(from); const ans = answerQuery(a, g, lang); replyGabbai(from, ans); ev('action', { g: g, phone: from, contact_id: a.contact_id || '', text: a._text, detail: 'שאלה → ' + ans }); return { ok: true }; }
  if (act === 'simcha' && !a.ids) {
    a.ids = (a.who || []).map(function (w) { const m = matchName(w.name || '', w.hint || ''); return m.length ? String(m[0].contact_id) : ''; });
  }
  statePut(from, { step: 'confirm', action: a, lang: lang, text: a._text || '' });
  replyGabbai(from, summary(a, lang) + '\n' + say('confirm', lang));
  return { ok: true };
}
const LBL = {
  add_contact: { en: 'Add contact', yi: 'צולייגן א קאנטאקט', he: 'להוסיף איש קשר' },
  update_contact: { en: 'Update', yi: 'טוישן', he: 'לעדכן' },
  add_note: { en: 'Note for', yi: 'א הערה פאר', he: 'הערה ל' },
  donation: { en: 'Donation', yi: 'א נדבה', he: 'תרומה' },
  simcha: { en: 'Simcha', yi: 'שמחה', he: 'שמחה' },
  photo: { en: 'Photo for', yi: 'א בילד פאר', he: 'תמונה ל' },
};
const FLBL = {
  title_he: 'תואר', first_name_he: 'שם', last_name_he: 'משפחה', first_name_en: 'First', last_name_en: 'Last', address: 'Address', city: 'City', state: 'State', zip: 'ZIP',
  mobile: 'Cell', home_phone: 'Home', email: 'Email', wife_name_he: 'אשה',
};
function fieldsLine(o) {
  return Object.keys(o || {}).filter(function (k) { return String(o[k] || '').trim(); })
    .map(function (k) { return (FLBL[k] || k) + ': ' + (/phone|mobile/.test(k) ? fmtPhone(o[k]) : o[k]); }).join('\n');
}
function summary(a, lang) {
  const L = (LBL[a.action] || {})[lang] || a.action;
  const c = a.contact_id ? byId(a.contact_id) : null;
  const who = c ? describe(c) : '';
  if (a.action === 'add_contact') return L + ':\n' + fieldsLine(a.contact);
  if (a.action === 'update_contact') return L + ' ' + who + ':\n' + fieldsLine(a.fields);
  if (a.action === 'add_note') return L + ' ' + who + ':\n"' + a.note + '"';
  if (a.action === 'donation') return L + ': ' + who + '\n$' + a.amount + (a.campaign ? ' · ' + a.campaign : '') + (a.method ? ' · ' + a.method : '') + (a.paid === false ? ' (pledge)' : '');
  if (a.action === 'simcha') return L + ': ' + (a.type || '') + ' · ' + (a.who || []).map(function (w, i) { const x = a.ids && a.ids[i] ? byId(a.ids[i]) : null; return x ? describe(x) : (w.name + ' (?)'); }).join(' / ') + (a.child ? ' · ' + a.child : '') + (a.date ? ' · ' + a.date : '');
  if (a.action === 'photo') return L + ' ' + who;
  return L;
}
function answerQuery(a, g, lang) {
  const c = byId(a.contact_id);
  if (!c) return say('notFound', lang);
  const p = phonesMap()[String(c.contact_id)] || {};
  const lines = [describe(c)];
  const what = a.what || 'all';
  if (what === 'phone' || what === 'all') ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].forEach(function (k) { if (p[k]) lines.push(k.replace('_', ' ') + ': ' + p[k]); });
  if (what === 'email' || what === 'all') ['email_1', 'email_2'].forEach(function (k) { if (p[k]) lines.push(p[k]); });
  if (what === 'address' || what === 'all') if (c.address) lines.push([c.address, [c.city, c.state].filter(String).join(', ') + ' ' + (c.zip || '')].join(', '));
  if (what === 'yahrzeit') readTab('Occasions').rows.filter(function (o) { return String(o.contact_id) === String(c.contact_id); }).forEach(function (o) {
    lines.push([o.occasion_type, o.person_name, o.hebrew_day, o.hebrew_month].filter(String).join(' '));
  });
  if (what === 'simcha') readTab('Simchos').rows.filter(function (s) { return String(s.honorees || '').indexOf('"' + c.contact_id + '"') >= 0; }).slice(-3).forEach(function (s) { lines.push(s.type + ' · ' + String(s.week).slice(0, 10)); });
  if (what === 'donations') {
    if (!isAdmin(g.email)) return say('noPerm', lang);
    readTab('Donations').rows.filter(function (d) { return String(d.contact_id) === String(c.contact_id); }).slice(-5).forEach(function (d) { lines.push('$' + d.amount_usd + ' · ' + String(d.date).slice(0, 10) + (d.campaign ? ' · ' + d.campaign : '')); });
  }
  return lines.join('\n').slice(0, 900);
}

// ====================================================================== טון (נאך "1")
const CFIELDS = ['title_he', 'first_name_he', 'last_name_he', 'first_name_en', 'last_name_en', 'address', 'city', 'state', 'zip', 'wife_name_he'];
const PFIELDS = ['mobile', 'home_phone', 'email'];
function execute(a, g, lang) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (a.action === 'add_contact') return addContact(a.contact || {}, g, lang);
    if (a.action === 'update_contact') return updateContact(a.contact_id, a.fields || {}, g, lang);
    if (a.action === 'add_note') return addNote(a.contact_id, a.note, g, lang);
    if (a.action === 'donation') return addDonation(a, g, lang);
    if (a.action === 'simcha') return addSimcha(a, g, lang);
    if (a.action === 'photo') return savePhoto(a, g, lang);
    return say('noUnderstand', lang);
  } finally { lock.releaseLock(); }
}
function nextId(tab, min) {
  const sh = sheetOf(tab);
  const n = sh.getLastRow();
  const ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return Number(r[0]); }).filter(isFinite) : [];
  return Math.max.apply(null, [(min || 1) - 1].concat(ids)) + 1;
}
function addContact(x, g, lang) {
  const id = nextId('Contacts', FIRST_CONTACT_ID);
  const c = { contact_id: id, is_active: true, is_alive: true, country: 'USA', created_at: stamp(), created_by: g.email, updated_at: stamp(), updated_by: g.email };
  CFIELDS.forEach(function (k) { if (x[k]) c[k] = String(x[k]).trim(); });
  if (c.state) c.state = String(c.state).toUpperCase();
  appendObj('Contacts', c);
  const p = { contact_id: id };
  if (x.mobile) p.mobile = fmtPhone(x.mobile);
  if (x.home_phone) p.home_phone = fmtPhone(x.home_phone);
  if (x.email) p.email_1 = String(x.email).trim();
  if (Object.keys(p).length > 1) appendObj('Phones', p);
  history(g.email, 'contact', id, id, '*', '', 'created (SMS)');
  return say('done', lang) + ' #' + id + ' ' + heName(c);
}
function updateContact(id, f, g, lang) {
  const t = readTab('Contacts');
  const c = t.rows.filter(function (r) { return String(r.contact_id) === String(id); })[0];
  if (!c) return say('notFound', lang);
  const set = {};
  CFIELDS.forEach(function (k) { if (f[k]) { set[k] = String(f[k]).trim(); history(g.email, 'contact', id, id, k, c[k], set[k]); } });
  if (Object.keys(set).length) { set.updated_at = stamp(); set.updated_by = g.email; setFields('Contacts', c._row, set); }
  const pf = {};
  if (f.mobile) pf.mobile = fmtPhone(f.mobile);
  if (f.home_phone) pf.home_phone = fmtPhone(f.home_phone);
  if (f.email) pf.email_1 = String(f.email).trim();
  if (Object.keys(pf).length) {
    const pt = readTab('Phones');
    const p = pt.rows.filter(function (r) { return String(r.contact_id) === String(id); })[0];
    Object.keys(pf).forEach(function (k) { history(g.email, 'phones', id, id, k, p ? p[k] : '', pf[k]); });
    if (p) setFields('Phones', p._row, pf); else appendObj('Phones', Object.assign({ contact_id: id }, pf));
  }
  return say('done', lang) + ' ' + heName(c);
}
function addNote(id, note, g, lang) {
  const c = byId(id);
  appendObj('OrgNotes', { note_id: nextId('OrgNotes', 1), contact_id: id, org: '', text: String(note || '').slice(0, 1000), note: String(note || '').slice(0, 1000), created_at: stamp(), created_by: g.email, updated_at: stamp(), updated_by: g.email });
  history(g.email, 'note', id, id, '*', '', 'note (SMS)');
  return say('done', lang) + ' ' + (c ? heName(c) : '');
}
const METHOD = { cash: 'קאש', check: "צ'ק", card: 'כרטיס אשראי', other: '' };
function addDonation(a, g, lang) {
  const amount = Number(a.amount) || 0;
  if (!(amount > 0)) return say('error', lang) + ' amount';
  const id = nextId('Donations', 1);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today();
  const paid = a.paid !== false;
  appendObj('Donations', {
    donation_id: id, contact_id: a.contact_id, date: date, amount_usd: amount, is_paid: paid, paid_date: paid ? date : '', payment_method: METHOD[a.method] || '',
    check_number: a.check_number || '', campaign: a.campaign || '', created_at: stamp(), created_by: g.email, updated_at: stamp(), updated_by: g.email,
  });
  history(g.email, 'donation', id, a.contact_id, '*', '', 'created (SMS) $' + amount);
  return say('done', lang) + ' $' + amount;
}
function saturdayOf(iso) {
  const d = iso ? new Date(iso + 'T12:00:00') : new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
function addSimcha(a, g, lang) {
  const id = nextId('Simchos', 1);
  const hon = (a.ids || []).filter(String).map(function (cid) { return { contact_id: String(cid), title: (byId(cid) || {}).title_he || '', suffix: 'שליט"א' }; });
  let img = '';
  if (a.media) img = storeImage(a.media, 'simcha-' + id);
  appendObj('Simchos', {
    simcha_id: id, week: saturdayOf(a.date), type: ({ bar_mitzvah: 'barmitzvah', engagement: 'erusin', wedding: 'nisuin' })[a.type] || a.type || 'birth', honorees: JSON.stringify(hon), child_name: a.child || '',
    text_override: '', sort: '', created_at: stamp(), created_by: g.email, updated_at: stamp(), updated_by: g.email,
  });
  // דער גבאי האט עס געשיקט אין SMS — א מנהל זאל עס איבערקוקן אויפן אתר (מיט דער הזמנה אין דרייב)
  notifyAdmins('sms_simcha', 'SMS: שמחה #' + id, 'א שמחה פון SMS (' + g.name + '): ' + (a.type || '') + ' · ' + (a.who || []).map(function (w) { return w.name; }).join(' / ')
    + (a.child ? ' · ' + a.child : '') + (a.note ? '\n' + a.note : '') + (hon.length ? '' : '\n⚠ מ\'דארף צולייגן די בעלי שמחה אויפן אתר.') + (img ? '\nhttps://drive.google.com/file/d/' + img : ''));
  return say('done', lang) + ' #' + id;
}
function storeImage(url, name) {
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const props = PropertiesService.getScriptProperties();
  let folder = null;
  const fid = props.getProperty('IMG_FOLDER_ID');
  if (fid) { try { folder = DriveApp.getFolderById(fid); } catch (e) { folder = null; } }
  if (!folder) { const it = DriveApp.getFoldersByName(IMG_FOLDER); folder = it.hasNext() ? it.next() : DriveApp.createFolder(IMG_FOLDER); props.setProperty('IMG_FOLDER_ID', folder.getId()); }
  const f = folder.createFile(r.getBlob().setName(name));
  return f.getId();
}
function savePhoto(a, g, lang) {
  const id = a.contact_id;
  const r = UrlFetchApp.fetch(a.media, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return say('error', lang);
  // א קליינער בילד אין גיליון (ווי דער אתר) + דער אריגינאל אין דרייב
  const blob = r.getBlob();
  let small = blob;
  try { small = blob.getAs('image/jpeg'); } catch (e) { /* */ }
  const b64 = Utilities.base64Encode(small.getBytes());
  const driveId = storeImage(a.media, 'photo-' + id);
  if (b64.length > 48000) {
    // צו גרויס פאר א תא — נאר אין דרייב; דער גבאי קען עס שניידן אויפן אתר
    notifyAdmins('sms_photo', 'SMS: בילד', 'א בילד פאר #' + id + ' (' + heName(byId(id) || {}) + ') איז אין דרייב (drv:' + driveId + ') — צו גרויס; לייגט עס אריין אויפן אתר.');
    return say('done', lang) + ' (Drive)';
  }
  const t = readTab('Photos');
  const row = t.rows.filter(function (x) { return String(x.contact_id) === String(id); })[0];
  const vals = [Number(id), 'data:image/jpeg;base64,' + b64, txt(stamp()), g.email, driveId];
  if (row) t.sheet.getRange(row._row, 1, 1, 5).setValues([vals]); else t.sheet.appendRow(vals);
  history(g.email, 'photo', id, id, '*', '', 'photo (SMS)');
  return say('done', lang);
}

// ====================================================================== פונעם אתר
function fromSite(req, email) {
  const a = req.action;
  if (a === 'credits') return { credits: creditsOf(email), all: isAdmin(email) ? creditsAll() : null, price: config() };
  if (a === 'job_create') return jobCreate(req, email);
  if (a === 'job_cancel') return jobCancel(req.id, email);
  if (a === 'jobs') return { jobs: readTab('SmsJobs').rows.filter(function (j) { return isAdmin(email) || lower(j.created_by) === email; }).slice(-60).map(function (j) { delete j.recipients; return j; }) };
  if (a === 'credit_add') {
    if (!isAdmin(email)) return { error: 'admin-only' };
    appendObj('Credits', { at: stamp(), email: lower(req.email), delta: Number(req.amount) || 0, kind: 'manual', ref: '', note: String(req.note || '').slice(0, 200), by: email });
    return { ok: true, credits: creditsOf(lower(req.email)) };
  }
  if (a === 'checkout') return stripeCheckout(req, email);
  if (a === 'rec_upload') return recUpload(req, email);
  if (a === 'recs') return { recs: readTab('SmsRecordings').rows };
  if (a === 'texts') return { texts: textsList() };
  if (a === 'inbox_reply') return inboxReply(req, email);
  if (a === 'inbox_done') return inboxDone(req.phone, email);
  if (a === 'auto_save') return autoSave(req, email);
  if (a === 'auto_delete') return autoDel(req.id, email);
  if (a === 'auto_approve') return autoApprove(req.id, email, !!req.now);
  if (a === 'auto_cancel') return autoCancel(req.id, email);
  if (a === 'auto_line') return autoLine(req.id, req.line, email);
  if (a === 'auto_mod') return autoMod(req, email);
  if (a === 'tf_status') return isAdmin(email) ? tfStatus() : { error: 'admin-only' };
  if (a === 'auto_recips') return autoRecips(req.id, req.recipients, email);
  if (a === 'config_set') {
    if (!isAdmin(email)) return { error: 'admin-only' };
    const t = readTab('SmsConfig');
    Object.keys(req.values || {}).forEach(function (k) {
      const r = t.rows.filter(function (x) { return String(x.key) === k; })[0];
      if (r) setFields('SmsConfig', r._row, { value: String(req.values[k]) }); else appendObj('SmsConfig', { key: k, value: String(req.values[k]) });
    });
    CFG = null;
    return { ok: true, config: config() };
  }
  if (a === 'balance') {
    if (!isAdmin(email)) return { error: 'admin-only' };
    const key = PropertiesService.getScriptProperties().getProperty('TELNYX_API_KEY');
    if (!key) return { error: 'no-key' };
    const r = UrlFetchApp.fetch('https://api.telnyx.com/v2/balance', { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
    return r.getResponseCode() === 200 ? { balance: JSON.parse(r.getContentText()).data } : { error: 'telnyx-' + r.getResponseCode() };
  }
  if (a === 'report') return isAdmin(email) ? report(req.month) : { error: 'admin-only' };
  return { error: 'unknown-action' };
}

// ---------- קרעדיטן ----------
function creditsOf(email) {
  return Math.round(readTab('Credits').rows.filter(function (r) { return lower(r.email) === email; }).reduce(function (s, r) { return s + (Number(r.delta) || 0); }, 0) * 10000) / 10000;
}
function creditsAll() {
  const m = {};
  readTab('Credits').rows.forEach(function (r) { const e = lower(r.email); m[e] = (m[e] || 0) + (Number(r.delta) || 0); });
  return m;
}
function segments(text) {
  const s = String(text || '');
  // ניט-לאטייניש (אידיש) = UCS-2: 70 אותיות (67 ביי עטליכע)
  const uni = /[^\x00-\x7F]/.test(s);
  const n = s.length;
  if (uni) return n <= 70 ? 1 : Math.ceil(n / 67);
  return n <= 160 ? 1 : Math.ceil(n / 153);
}
function unitPrice(job, cfg) {
  if (job.kind === 'call') return Number(cfg.price_call) || 0.03;
  return (Number(cfg.price_sms) || 0.01) * segments(job.nobrand || job.note === 'nobrand' ? String(job.text || '') : branded(job.text, cfg));
}
function jobCreate(req, email) {
  const cfg = config();
  const rec = (req.recipients || []).map(function (r) { return { p: e164(r.phone), c: String(r.contact_id || ''), n: String(r.name || '').slice(0, 40) }; }).filter(function (r) { return r.p; });
  if (!rec.length) return { error: 'no-recipients' };
  if (req.kind === 'sms' && !String(req.text || '').trim()) return { error: 'no-text' };
  if (req.kind === 'call' && !req.recording_id) return { error: 'no-recording' };
  const job = { kind: req.kind === 'call' ? 'call' : 'sms', text: String(req.text || '').slice(0, 1200), nobrand: !!req.nobrand };
  const est = Math.round(rec.length * unitPrice(job, cfg) * 100) / 100;
  const have = creditsOf(email);
  if (have < est) return { error: 'no-credits', need: est, have: have };
  const id = 'J' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  appendObj('SmsJobs', {
    job_id: id, created_at: stamp(), created_by: email, kind: job.kind, title: String(req.title || '').slice(0, 80), list_name: String(req.list_name || '').slice(0, 80), org: req.org || '',
    text: job.text, recording_id: req.recording_id || '', send_at: req.send_at || stamp(), status: 'scheduled', total: rec.length, sent: 0, failed: 0, skipped: 0, cost: 0, credits: 0, cursor: 0,
    recipients: JSON.stringify(rec), updated_at: stamp(), note: job.nobrand ? 'nobrand' : '',
  });
  return { ok: true, job_id: id, estimate: est };
}
function jobCancel(id, email) {
  const t = readTab('SmsJobs');
  const j = t.rows.filter(function (x) { return String(x.job_id) === String(id); })[0];
  if (!j) return { error: 'not-found' };
  if (!isAdmin(email) && lower(j.created_by) !== email) return { error: 'not-allowed' };
  if (['done', 'canceled'].indexOf(String(j.status)) >= 0) return { error: 'finished' };
  setFields('SmsJobs', j._row, { status: 'canceled', updated_at: stamp() });
  return { ok: true };
}

// ---------- ווען מ'טאר שיקן ----------
function sendWindowOk(now, cfg) {
  const d = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const hr = Number(Utilities.formatDate(now, TZ, 'H')) + Number(Utilities.formatDate(now, TZ, 'm')) / 60;
  const dow = Number(Utilities.formatDate(now, TZ, 'u')); // 1=מאנטאג ... 6=שבת, 7=זונטאג
  if (hr < Number(cfg.quiet_to || 8) || hr >= Number(cfg.quiet_from || 21)) return false;
  if (dow === 6) return false;
  if (dow === 5 && hr >= Number(cfg.friday_cutoff || 13)) return false;
  if (String(cfg.blocked_dates || '').split(',').indexOf(d) >= 0) return false;
  if (String(cfg.erev_dates || '').split(',').indexOf(d) >= 0 && hr >= Number(cfg.friday_cutoff || 13)) return false;
  return true;
}

// ---------- דער זייגער: שיקן ----------
function runJobs() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const cfg = config();
    try { autoTick(cfg); } catch (e) { ev('error', { detail: 'autoTick: ' + String(e && e.message || e) }); }
    if (!sendWindowOk(new Date(), cfg)) return;
    const P = PropertiesService.getScriptProperties();
    const started = Date.now();
    const optOut = {};
    readTab('SmsOptIn').rows.forEach(function (r) { if (String(r.status) === 'out') optOut[last10(r.phone)] = true; });
    // ווער האט שוין באקומען עפעס פונעם שליחה-נומער (→ נישט נאכאמאל די STOP שורה)
    const seen = {};
    readTab('SmsLog').rows.forEach(function (r) { if (r.dir === 'out' && r.line === 'broadcast' && String(r.status).indexOf('sent') === 0) seen[last10(r.to)] = true; });
    const jobs = readTab('SmsJobs').rows.filter(function (j) { return ['scheduled', 'running'].indexOf(String(j.status)) >= 0 && String(j.send_at) <= stamp(); });
    for (let ji = 0; ji < jobs.length && Date.now() - started < 270000; ji += 1) {
      const j = jobs[ji];
      const rec = JSON.parse(j.recipients || '[]');
      let cur = Number(j.cursor) || 0; let sent = Number(j.sent) || 0; let failed = Number(j.failed) || 0; let skipped = Number(j.skipped) || 0; let credits = Number(j.credits) || 0;
      let have = creditsOf(lower(j.created_by)); // וואס די שליחה האט שוין גענוצט איז שוין אראפגערעכנט
      let status = 'running';
      const save = function () {
        setFields('SmsJobs', j._row, { status: status, cursor: cur, sent: sent, failed: failed, skipped: skipped, credits: Math.round(credits * 10000) / 10000, updated_at: stamp() });
        chargeJob(j, credits);
      };
      try {
        while (cur < rec.length && Date.now() - started < 270000) {
          const r = rec[cur];
          const d = last10(r.p);
          if (optOut[d]) { cur += 1; skipped += 1; continue; }
          const text = j.kind === 'call' ? '' : (j.note === 'nobrand' ? String(j.text) : branded(j.text, cfg)) + (seen[d] ? '' : newLineNote(cfg));
          const price = j.kind === 'call' ? unitPrice(j, cfg) : (Number(cfg.price_sms) || 0.01) * segments(text);
          if (have < price) { status = 'no_credits'; break; }
          cur += 1;
          let ok = false;
          try {
            if (j.kind === 'call') ok = placeCall(r, j, P);
            else ok = sendSms(P.getProperty('TELNYX_BROADCAST_NUMBER'), r.p, text, null, { line: 'broadcast', email: j.created_by, contact_id: r.c, job_id: j.job_id }).status === 'sent';
          } catch (e) { ok = false; }
          if (ok) { sent += 1; credits += price; have -= price; seen[d] = true; } else failed += 1;
          if (cur % 10 === 0) save();
        }
        if (cur >= rec.length) status = 'done';
      } finally { save(); }
    }
  } finally { lock.releaseLock(); }
}
function chargeJob(j, credits) {
  const t = readTab('Credits');
  const r = t.rows.filter(function (x) { return String(x.ref) === String(j.job_id) && String(x.kind) === 'usage'; })[0];
  const delta = -Math.round(credits * 10000) / 10000;
  if (r) setFields('Credits', r._row, { delta: delta, at: stamp() });
  else if (credits) appendObj('Credits', { at: stamp(), email: lower(j.created_by), delta: delta, kind: 'usage', ref: j.job_id, note: (j.kind === 'call' ? '📞 ' : '💬 ') + (j.title || j.list_name || ''), by: 'system' });
}
function placeCall(r, j, P) {
  const key = P.getProperty('TELNYX_API_KEY'); const app = P.getProperty('TELNYX_TEXML_APP_ID'); const worker = P.getProperty('WORKER_URL');
  const from = P.getProperty('TELNYX_VOICE_NUMBER') || P.getProperty('TELNYX_BROADCAST_NUMBER');
  if (!key || !app || !worker) return false;
  const res = UrlFetchApp.fetch('https://api.telnyx.com/v2/texml/calls/' + app, {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true,
    payload: JSON.stringify({ To: r.p, From: from, Url: worker + '/voice/play?rec=' + encodeURIComponent(j.recording_id), MachineDetection: 'DetectMessageEnd' }),
  });
  sheetOf('SmsLog').appendRow(rowOf('SmsLog', { at: stamp(), dir: 'out', line: 'call', from: from, to: r.p, gabbai_email: j.created_by, contact_id: r.c, text: '📞 ' + j.recording_id, status: res.getResponseCode() < 300 ? 'called' : 'error ' + res.getResponseCode(), job_id: j.job_id }));
  return res.getResponseCode() < 300;
}

// ---------- הקלטות ----------
function recFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('REC_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* */ } }
  const it = DriveApp.getFoldersByName(REC_FOLDER);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(REC_FOLDER);
  props.setProperty('REC_FOLDER_ID', f.getId());
  return f;
}
function recUpload(req, email) {
  const m = String(req.data || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { error: 'bad-data' };
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(req.name || 'recording').slice(0, 80));
  const f = recFolder().createFile(blob);
  const id = 'R' + Date.now();
  appendObj('SmsRecordings', { rec_id: id, name: String(req.name || '').slice(0, 80), drive_id: f.getId(), mime: m[1], seconds: Number(req.seconds) || '', created_at: stamp(), created_by: email, source: 'upload' });
  return { ok: true, rec_id: id };
}
function audioOf(id) {
  const r = readTab('SmsRecordings').rows.filter(function (x) { return String(x.rec_id) === String(id); })[0];
  if (!r) return { error: 'not-found' };
  const b = DriveApp.getFileById(String(r.drive_id)).getBlob();
  return { mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) };
}
function lastRecording() {
  const t = readTab('SmsRecordings').rows;
  return t.length ? t[t.length - 1] : null;
}

// ---------- טעלעפאנען (TeXML) ----------
function xmlEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function texml(inner) { return '<?xml version="1.0" encoding="UTF-8"?><Response>' + inner + '</Response>'; }
function callIn(req) {
  const P = PropertiesService.getScriptProperties();
  const W = P.getProperty('WORKER_URL');
  const to = last10(req.to);
  const cfg = config();
  // א גבאי רופט דעם הקלטות-נומער: 1 = הערן, 2 = א נייע הקלטה
  if (to === last10(P.getProperty('TELNYX_VOICE_NUMBER'))) {
    const g = gabbaiByPhone(req.from);
    if (g && req.signed) {
      return texml('<Gather numDigits="1" timeout="6" action="' + W + '/voice/menu"><Say voice="alice">Press 1 to hear the last message. Press 2 to record a new message.</Say></Gather>' + playLast(W));
    }
    return texml(playLast(W) || '<Say voice="alice">' + xmlEsc(cfg.call_text) + '</Say>');
  }
  // דער SMS-נומער: די זמנים פון דער וואך (ענגליש)
  const txt = cfg.zmanim_text || cfg.call_text;
  return texml('<Say voice="alice" language="en-US">' + xmlEsc(txt) + '</Say><Pause length="1"/><Say voice="alice">' + xmlEsc(txt) + '</Say>');
}
function playLast(W) { const r = lastRecording(); return r ? '<Play>' + W + '/audio/' + encodeURIComponent(r.rec_id) + '</Play>' : ''; }
function callMenu(req) {
  const W = PropertiesService.getScriptProperties().getProperty('WORKER_URL');
  if (String(req.digits) === '2' && req.signed && gabbaiByPhone(req.from)) {
    return texml('<Say voice="alice">Record after the beep. Press the pound key when done.</Say><Record maxLength="300" finishOnKey="#" playBeep="true" action="' + W + '/voice/recorded"/>');
  }
  return texml(playLast(W));
}
function callRecorded(req) {
  const g = gabbaiByPhone(req.from);
  // נאר א באשטעטיגטע בקשה פון Telnyx (דער Worker האט געקוקט די חתימה), און נאר א הקלטה אויף זייערע סערווערס
  let host = '';
  try { host = String(req.url || '').match(/^https:\/\/([^/?#]+)/)[1].toLowerCase(); } catch (e) { host = ''; }
  const telnyxHost = host === 'telnyx.com' || /\.telnyx\.com$/.test(host);
  const s3Host = /\.amazonaws\.com$/.test(host);
  if (!g || !req.signed || !(telnyxHost || s3Host)) return texml('<Hangup/>');
  const P = PropertiesService.getScriptProperties();
  let r = UrlFetchApp.fetch(req.url, { muteHttpExceptions: true });
  if ((r.getResponseCode() === 401 || r.getResponseCode() === 403) && telnyxHost) r = UrlFetchApp.fetch(req.url, { headers: { Authorization: 'Bearer ' + P.getProperty('TELNYX_API_KEY') }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return texml('<Say voice="alice">Sorry, the recording failed.</Say>');
  const f = recFolder().createFile(r.getBlob().setName('phone-' + stamp()));
  appendObj('SmsRecordings', { rec_id: 'R' + Date.now(), name: '📞 ' + g.name + ' ' + stamp(), drive_id: f.getId(), mime: r.getBlob().getContentType(), seconds: Number(req.duration) || '', created_at: stamp(), created_by: g.email, source: 'phone' });
  return texml('<Say voice="alice">Thank you. The message was saved.</Say>');
}
function callPlay(req) {
  const W = PropertiesService.getScriptProperties().getProperty('WORKER_URL');
  return texml('<Play>' + W + '/audio/' + encodeURIComponent(req.rec || '') + '</Play>');
}

// ---------- Stripe ----------
function stripeCheckout(req, email) {
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('STRIPE_SECRET_KEY');
  if (!key) return { error: 'no-stripe' };
  const usd = Math.max(10, Math.min(500, Math.round(Number(req.usd) || 0)));
  const site = P.getProperty('SITE_URL') || 'https://ungvar.org/';
  const form = {
    mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(usd * 100), 'line_items[0][price_data][product_data][name]': 'SMS credits – Mosdos Ungvar',
    customer_email: email, 'metadata[email]': email, 'metadata[credits]': String(usd), client_reference_id: email,
    success_url: site + '?credits=ok', cancel_url: site + '?credits=cancel',
  };
  const r = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'post', headers: { Authorization: 'Bearer ' + key }, payload: form, muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 300) return { error: 'stripe-' + r.getResponseCode() };
  return { url: JSON.parse(r.getContentText()).url };
}
function stripePaid(req) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return stripePaid_(req); } finally { lock.releaseLock(); }
}
function stripePaid_(req) {
  const email = lower(req.email);
  if (!email || !req.session_id) return { error: 'bad' };
  const t = readTab('Credits');
  if (t.rows.some(function (r) { return String(r.ref) === String(req.session_id); })) return { ok: true, dup: true };
  appendObj('Credits', { at: stamp(), email: email, delta: Number(req.credits) || Number(req.amount_total) / 100 || 0, kind: 'purchase', ref: req.session_id, note: 'Stripe $' + (Number(req.amount_total) / 100), by: 'stripe' });
  return { ok: true };
}

// ---------- באריכט (חודש) ----------
function report(month) {
  const m = month || Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  const log = readTab('SmsLog').rows.filter(function (r) { return String(r.at).slice(0, 7) === m; });
  const cost = { gabbai: 0, broadcast: 0, call: 0 };
  let n = 0;
  log.forEach(function (r) { const c = Number(r.cost) || 0; cost[r.line] = (cost[r.line] || 0) + c; n += 1; });
  const cr = readTab('Credits').rows.filter(function (r) { return String(r.at).slice(0, 7) === m; });
  const sold = cr.filter(function (r) { return r.kind === 'purchase' || r.kind === 'manual'; }).reduce(function (s, r) { return s + (Number(r.delta) || 0); }, 0);
  const used = -cr.filter(function (r) { return r.kind === 'usage'; }).reduce(function (s, r) { return s + (Number(r.delta) || 0); }, 0);
  const outs = log.filter(function (r) { return r.dir === 'out' && r.line === 'broadcast' && Number(r.cost) > 0; });
  const avg = outs.length ? outs.reduce(function (s, r) { return s + Number(r.cost); }, 0) / outs.length : 0;
  return { month: m, messages: n, cost: cost, sold: sold, used: used, avg_cost: avg, price_sms: Number(config().price_sms) };
}

/** א פראבע פונעם עדיטאר */
function testSms() {
  const P = PropertiesService.getScriptProperties();
  Logger.log('telnyx key: ' + Boolean(P.getProperty('TELNYX_API_KEY')) + ' · gemini: ' + Boolean(P.getProperty('GEMINI_API_KEY')) + ' · secret: ' + Boolean(P.getProperty('SHARED_SECRET')));
  Logger.log('contacts: ' + contacts().length + ' · config: ' + JSON.stringify(config()));
}

/**
 * פעם אחת, בהתחלה: שומר את המספרים (הם לא סודיים, הם מופיעים גם ב-ungvar.org/sms.html)
 * ויוצר סוד משותף לחיבור עם ה-Worker. את הסוד מעתיקים מהיומן (Execution log) ישר ל-Cloudflare — לא לצ'אט.
 */
function setupNumbersAndSecret() {
  const P = PropertiesService.getScriptProperties();
  P.setProperties({
    TELNYX_GABBAI_NUMBER: '+18668300089',     // הגבאים
    TELNYX_BROADCAST_NUMBER: '+18667962646',  // 1-866-7-ZMANIM — לקהילה, וזמנים בטלפון
    TELNYX_VOICE_NUMBER: '+19292191653',      // מקומי — הודעות קוליות
    SITE_URL: 'https://ungvar.org/',
  });
  if (!P.getProperty('SHARED_SECRET')) P.setProperty('SHARED_SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  Logger.log('המספרים נשמרו.');
  Logger.log('SHARED_SECRET (להעתיק ל-Cloudflare Worker → Settings → Variables and Secrets): ' + P.getProperty('SHARED_SECRET'));
}

/** בדיקה: האם מפתח Gemini עובד (רושם רק "עובד" או את השגיאה — לא את המפתח) */
function testGemini() {
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('GEMINI_API_KEY');
  if (!key) { Logger.log('אין GEMINI_API_KEY'); return; }
  const model = P.getProperty('GEMINI_MODEL') || 'gemini-flash-latest';
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true,
    payload: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }] }),
  });
  Logger.log(res.getResponseCode() < 300 ? 'Gemini עובד ✔' : 'שגיאה ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
}


// ====================================================================== הודעות אוטומטיות
// יעדע הודעה: א גבאי אחראי (צאלט פון זיינע קרעדיטן), א רשימה, א "מתי" (sched JSON), א מוסטער מיט {ערטער}.
// א טאג פריער + 3 שעה פריער: א דערמאנונג (SMS + אימעיל) — אן אן אישור גייט עס נישט ארויס.
// די {ערטער} ווערן גערעכנט ווי אויף דער תצוגה: LUACH (apps-script/luach-bundle.gs) + די "זמני תפילות" פונעם גיליון פון דער תצוגה.
const DISPLAY_SHEET = '1hhrsXNhDCK7OGXOClTPE8pxOJ3EjmTmndH0r_qrms70';
let MINY = null;
function minyanimData() {
  if (MINY) return MINY;
  try {
    const r = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + DISPLAY_SHEET + '/gviz/tq?tqx=out:csv&sheet=Minyanim&headers=1&t=' + Date.now(), { muteHttpExceptions: true });
    const rows = Utilities.parseCsv(r.getContentText());
    const parts = rows.filter(function (x) { return /^data#\d+$/.test(x[0] || ''); }).sort(function (a, b) { return Number(a[0].split('#')[1]) - Number(b[0].split('#')[1]); });
    MINY = parts.length ? JSON.parse(parts.map(function (x) { return x[1] || ''; }).join('')) : {};
  } catch (e) { MINY = {}; }
  MINY.rebbeAway = awayList_();
  return MINY;
}
// ✈ כ"ק אדמו"ר שליט"א נסע — לשונית RebbeAway אין דעם גיליון פון דער תצוגה: [from, to, by, at]
function awayList_() {
  try {
    const r = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + DISPLAY_SHEET + '/gviz/tq?tqx=out:csv&sheet=RebbeAway&headers=1&t=' + Date.now(), { muteHttpExceptions: true });
    const rows = Utilities.parseCsv(r.getContentText());
    if (!rows.length || rows[0][0] !== 'from') return [];
    const dt = function (v) { const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); if (a) return a[0]; const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || ''); return b ? b[3] + '-' + ('0' + b[1]).slice(-2) + '-' + ('0' + b[2]).slice(-2) : ''; };
    return rows.slice(1).map(function (x) { return { from: dt(x[0]), to: dt(x[1]) }; }).filter(function (x) { return x.from && x.to; });
  } catch (e) { return []; }
}
/** שרייבט א נסיעה (ביז מוצאי שבת) אין דער לשונית; true = געלונגען */
function awayAdd_(from, to, by) {
  try {
    const book = SpreadsheetApp.openById(DISPLAY_SHEET);
    let sh = book.getSheetByName('RebbeAway');
    if (!sh) { sh = book.insertSheet('RebbeAway'); sh.getRange(1, 1, 1, 4).setValues([['from', 'to', 'by', 'at']]); }
    if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, 4).setValues([['from', 'to', 'by', 'at']]);
    sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setNumberFormat('@').setValues([[from, to, by, stamp()]]);
    MINY = null; Object.keys(VARS).forEach(function (k) { delete VARS[k]; });
    const d = minyanimData(); // gviz קען זיין א רגע הינטערשטעליג
    if (!d.rebbeAway.some(function (x) { return x.from === from && x.to === to; })) d.rebbeAway.push({ from: from, to: to });
    return true;
  } catch (e) { ev('error', { detail: 'rebbe away: ' + String(e && e.message || e) }); return false; }
}
/** ווען שבת פון דער הודעה ווערט אנדערש אויב כ"ק אד"ש איז נישט דא — מ'ווייזט "6" */
function awaySat_(occ) { let n = LUACH.nOf(String(occ).slice(0, 10)); while (LUACH.dowOf(n) !== 6) n += 1; return n; }
function awayDepends(a, occ) {
  try {
    const data = minyanimData(); const sat = awaySat_(occ);
    if (LUACH.rebbeAwayOn(data, sat - 1)) return false;
    const alt = Object.assign({}, data, { rebbeAway: (data.rebbeAway || []).concat([{ from: LUACH.isoOf(sat - 1), to: LUACH.isoOf(sat) }]) });
    const b2 = LUACH.renderAuto(a.text, varsFor_(a, LUACH.autoVars(alt, String(occ).slice(0, 10))), a.line || '', a.occ_mod || '');
    return b2 !== bodyOf(a, occ);
  } catch (e) { return false; }
}
function autoRows() { return readTab('SmsAuto').rows; }
function autoById(id) { return autoRows().filter(function (x) { return String(x.auto_id) === String(id); })[0] || null; }
function schedOf(a) { try { return JSON.parse(a.sched || '{}'); } catch (e) { return {}; } }
/** דער טעקסט פאר א געוויסער צייט (occ = 'yyyy-MM-dd HH:mm') */
function autoRender(a, occ) { return bodyOf(a, occ); }
function autoRecipList(a) { try { return JSON.parse(a.recipients || '[]'); } catch (e) { return []; } }
function autoCost(a, text, cfg) { return Math.round(autoRecipList(a).length * (Number(cfg.price_sms) || 0.01) * segments(branded(text, cfg)) * 100) / 100; }
const money_ = function (n) { return '$' + (Number(n) || 0).toFixed(2); };
function whenText(occ) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return 'ביום ' + days[LUACH.dowOf(LUACH.nOf(String(occ).slice(0, 10)))] + ' ' + String(occ).slice(5, 10).split('-').reverse().join('/') + ' בשעה ' + String(occ).slice(11, 16);
}
function gabbaiPhone(email) {
  const s = settingsCols(['gabbai_email', 'gabbai_phone']);
  for (let i = 0; i < s.length; i += 1) if (lower(s[i].gabbai_email) === lower(email) && last10(s[i].gabbai_phone)) return e164(s[i].gabbai_phone);
  return '';
}
/** א מעלדונג פאר'ן גבאי: SMS פונעם נומער פון קהל (פון זיינע קרעדיטן, ביז מינוס $1) + אימעיל */
function tellGabbai(email, text, a) {
  const cfg = config(); const P = PropertiesService.getScriptProperties();
  const phone = gabbaiPhone(email);
  let viaSms = false; let blocked = false;
  if (phone) {
    const o = optRow(phone); blocked = !!(o && String(o.status) === 'out');
    const cost = (Number(cfg.price_sms) || 0.01) * segments(text);
    if (!blocked && creditsOf(lower(email)) - cost >= -1) {
      const r = sendSms(P.getProperty('TELNYX_BROADCAST_NUMBER'), phone, text, null, { line: 'broadcast', email: email, job_id: 'auto:' + (a ? a.auto_id : '') });
      if (r.status === 'sent') {
        viaSms = true;
        appendObj('Credits', { at: stamp(), email: lower(email), delta: -Math.round(cost * 10000) / 10000, kind: 'notify', ref: a ? a.auto_id : '', note: '🔔 ' + (a ? a.name : ''), by: 'system' });
      }
    }
  }
  const body = text + (blocked ? '\n\n(ה-SMS אליך חסום כי שלחת STOP למספר הקהילה. כדי לקבל שוב, שלחו START.)' : '');
  try { MailApp.sendEmail({ to: email, subject: 'הודעה אוטומטית' + (a ? ': ' + a.name : ''), body: body, name: brandOf(cfg) }); } catch (e) { ev('error', { detail: 'mail: ' + String(e && e.message || e) }); }
  return viaSms;
}
// ---- מצב פון דעם גבאי (לויט זיין טעלעפאן): [{ id, occ, wait: ''|drop|text|line|cancel|nobrand }] ----
function pendGet(phone) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('autopend_' + last10(phone)) || '[]'); } catch (e) { return []; } }
function pendSet(phone, list) { const P = PropertiesService.getScriptProperties(); if (list.length) P.setProperty('autopend_' + last10(phone), JSON.stringify(list.slice(-10))); else P.deleteProperty('autopend_' + last10(phone)); }
function pendPut(phone, item) {
  if (!phone) return;
  CacheService.getScriptCache().remove('autochoose:' + last10(phone));
  pendSet(phone, pendGet(phone).filter(function (x) { return x.id !== item.id; }).concat([Object.assign({ at: stamp() }, item)]));
}
function pendDrop(phone, id) { if (phone) pendSet(phone, pendGet(phone).filter(function (x) { return x.id !== id; })); }
function autoNext(a, now) { return LUACH.nextOccurrence(schedOf(a), minyanimData(), now); }
function autoReset(a, occ) { setFields('SmsAuto', a._row, { occ_at: occ, occ_state: '', rem1: '', rem2: '', line: '', occ_mod: '', updated_at: stamp() }); pendDrop(gabbaiPhone(a.owner_email), a.auto_id); }
/** נייע קאלומען אין SmsAuto (ווען דער גיליון איז געמאכט געווארן פריער) */
function ensureCols(name) {
  const t = readHead(name); const miss = TABS[name].filter(function (h) { return t.head.indexOf(h) < 0; });
  if (miss.length) t.sheet.getRange(1, t.sheet.getLastColumn() + 1, 1, miss.length).setValues([miss]);
}
function modOf_(a) { return LUACH.modOf(a.occ_mod || ''); }
function setMod(a, mod) { const v = JSON.stringify(LUACH.modOf(mod)); setFields('SmsAuto', a._row, { occ_mod: v, updated_at: stamp() }); a.occ_mod = v; }
// ---- דער טעקסט ----
const VARS = {};
function varsAt(occ) { const d = String(occ).slice(0, 10); if (!VARS[d]) VARS[d] = LUACH.autoVars(minyanimData(), d); return VARS[d]; }
/** אין א הודעה פון ערב שבת: {שולה"ט ודרשות} = די אין דער שבת */
function varsFor_(a, v) { const sc = schedOf(a); return sc.type === 'erev' && sc.what === 'shabbos' ? Object.assign({}, v, { 'שולה"ט ודרשות': v['__שולה"ט בשבת'] || '' }) : v; }
function bodyOf(a, occ) { return LUACH.renderAuto(a.text, varsFor_(a, varsAt(occ)), a.line || '', a.occ_mod || ''); }
function fullOf(a, occ, cfg) { const b = bodyOf(a, occ); return modOf_(a).nobrand ? b : branded(b, cfg); }
function costOf(a, occ, cfg) { return Math.round(autoRecipList(a).length * (Number(cfg.price_sms) || 0.01) * segments(fullOf(a, occ, cfg)) * 100) / 100; }
/** "זמני שבת, פרשת וירא" — מיט דער פרשה נאר ביי א הודעה פון שבת */
function titleOf(a, occ) {
  const sc = schedOf(a);
  const usesParsha = (sc.type === 'erev' && sc.what === 'shabbos') || /\{פרשה\}|\{משבצת שבת/.test(a.text || '');
  const p = usesParsha ? varsAt(occ)['פרשה'] : '';
  return a.name + (p ? ', פרשת ' + p : '');
}
function menuText(cfg, a, occ) { return txt_('auto_menu', null, cfg) + (a && awayDepends(a, occ) ? ' · ' + txt_('auto_menu6', null, cfg) : ''); }
/** ההודעה המלאה + דער תפריט (key = auto_rem1 / auto_rem2 / auto_now) */
function menuMsg(key, a, occ, cfg) {
  const have = creditsOf(lower(a.owner_email)); const cost = costOf(a, occ, cfg);
  const full = fullOf(a, occ, cfg);
  let msg = txt_(key, { title: titleOf(a, occ), name: a.name, when: whenText(occ), count: autoRecipList(a).length, cost: money_(cost), credits: money_(have), text: full, menu: menuText(cfg, a, occ) }, cfg);
  const parts = segments(full);
  if (parts >= 3) msg += '\n\n' + txt_('auto_long', { parts: parts }, cfg);
  if (have < cost) msg += '\n\n' + txt_('auto_nocredit', { missing: money_(cost - have), cost: money_(cost), credits: money_(have) }, cfg);
  return msg;
}
// ---- ווען מ'טאר שיקן א דערמאנונג: נישט שבת/יו"ט (מוצאי — פון צאת הכוכבים), נישט ביינאכט ----
function remWindowOk(d, cfg) {
  const hr = Number(Utilities.formatDate(d, TZ, 'H')) + Number(Utilities.formatDate(d, TZ, 'm')) / 60;
  if (hr < Number(cfg.quiet_to || 8) || hr >= Number(cfg.quiet_from || 21)) return false;
  return !holyNow(d, cfg);
}
const dOf = function (s) { return new Date(String(s).replace(' ', 'T') + ':00' + nyOffset_(s)); };
/** דער UTC־אפסעט פון ניו יארק פאר א צייט (EST/EDT) */
function nyOffset_(s) {
  const guess = new Date(String(s).replace(' ', 'T') + ':00Z');
  const o = Utilities.formatDate(guess, TZ, 'XXX'); // -04:00 / -05:00
  return o === 'Z' ? '+00:00' : o;
}
const sOf = function (d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm'); };
const addH = function (s, h) { return sOf(new Date(dOf(s).getTime() + h * 3600000)); };
/** ווען די ערשטע דערמאנונג: 24 שעה פריער; אויב דאן איז שבת/יו"ט — אין ערב, נאך די הודעות פון ערב, פאר דעם סוף פון שליחה */
function rem1Due(a, occ, cfg) {
  let due = addH(occ, -24);
  if (!holyNow(dOf(due), cfg)) return due;
  const data = minyanimData();
  let n = LUACH.nOf(due.slice(0, 10)); while (LUACH.holyOn(data, n) && n > 0) n -= 1; // דער ערב
  const day = LUACH.isoOf(n);
  const cut = Number(cfg.friday_cutoff || 13);
  // נאך די אנדערע אויטאמאטישע הודעות פון יענעם טאג (+10 מינוט), ביז האלבע שעה פאר'ן סוף
  let mins = 11 * 60;
  autoRows().forEach(function (o) { const t = String(o.occ_at || ''); if (o.auto_id !== a.auto_id && t.slice(0, 10) === day) { const m = Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)) + 10; if (m > mins) mins = m; } });
  mins = Math.min(mins, cut * 60 - 30);
  return day + ' ' + ('0' + Math.floor(mins / 60)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2);
}
/** די צווייטע: 3 שעה פריער; ביינאכט → 8:00 */
function rem2Due(occ, cfg) {
  const due = addH(occ, -3);
  const qt = Number(cfg.quiet_to || 8);
  const hr = Number(due.slice(11, 13));
  if (hr < qt && due.slice(0, 10) === String(occ).slice(0, 10)) return due.slice(0, 11) + ('0' + qt).slice(-2) + ':00';
  return due;
}
/** א צייט וואס מ'טאר נישט שיקן → די סיבה, אדער '' */
function forbiddenWhy(occ, cfg) {
  const d = dOf(occ);
  if (holyNow(d, cfg)) { const dow = Number(Utilities.formatDate(d, TZ, 'u')); return dow === 6 || dow === 5 ? 'הוא בשבת' : 'הוא ביום טוב'; }
  if (!sendWindowOk(d, cfg)) return 'בשעה הזאת אסור לשלוח';
  return '';
}
/** ווען הייבט זיך אן דער קומענדיגער מחזור: כניסת שבת (פרייטאג, סוף השליחה) נאך דעם מועד — אדער פריער, ווען די ערשטע דערמאנונג פון דעם קומענדיגן מאל קומט פריער */
function rollAt(a, occ, cfg) {
  const cut = Number(cfg.friday_cutoff || 13);
  let n = LUACH.nOf(String(occ).slice(0, 10));
  const cutS = function (k) { return LUACH.isoOf(k) + ' ' + ('0' + cut).slice(-2) + ':00'; };
  while (LUACH.dowOf(n) !== 5 || cutS(n) <= String(occ)) n += 1;
  let at = cutS(n);
  const nx = autoNext(a, String(occ));
  if (nx) { const r1 = rem1Due(a, nx, cfg); if (r1 < at) at = r1; }
  return at;
}
/** לויפט יעדע 5 מינוט (פון runJobs) */
function autoTick(cfg) {
  ensureCols('SmsAuto');
  const rows = autoRows().filter(function (a) { return isT(a.active) && schedOf(a).type !== 'keyword'; });
  if (!rows.length) return;
  const now = stamp(); const nowD = new Date();
  const okRem = remWindowOk(nowD, cfg);
  rows.forEach(function (a) {
    let occ = String(a.occ_at || '');
    const st = String(a.occ_state || '');
    const fin = ['sent', 'canceled', 'missed', 'skip'].indexOf(st) >= 0;
    // א נייער מאל: גלייך (ערשטע מאל), אדער נאך דעם מחזור (כניסת שבת)
    if (!occ || (occ <= now && fin && now >= rollAt(a, occ, cfg))) {
      const nx = autoNext(a, now);
      if (!nx) { setFields('SmsAuto', a._row, { active: 'FALSE', updated_at: stamp() }); return; }
      autoReset(a, nx);
      const why = forbiddenWhy(nx, cfg);
      if (why) setFields('SmsAuto', a._row, { occ_state: 'skip', rem2: why });
      return;
    }
    if (st === 'skip') {
      // די מעלדונג "לא תישלח" — ווען די ערשטע דערמאנונג וואלט געקומען
      if (!a.rem1 && okRem && now >= rem1Due(a, occ, cfg)) {
        tellGabbai(a.owner_email, txt_('auto_skip', { title: titleOf(a, occ), when: whenText(occ), reason: a.rem2 || '' }, cfg), a);
        setFields('SmsAuto', a._row, { rem1: stamp() });
        ev('auto_skip', { name: a.name, detail: occ + ' · ' + (a.rem2 || '') });
      }
      return;
    }
    const phone = gabbaiPhone(a.owner_email);
    if (occ > now) {
      if (st === 'canceled' || !okRem) return;
      if (!a.rem1 && now >= rem1Due(a, occ, cfg)) {
        tellGabbai(a.owner_email, menuMsg('auto_rem1', a, occ, cfg), a);
        pendPut(phone, { id: a.auto_id, occ: occ, wait: '' });
        setFields('SmsAuto', a._row, { rem1: stamp(), rem2: now >= rem2Due(occ, cfg) ? stamp() : '' });
        ev('auto_rem', { name: a.name, detail: 'תזכורת ראשונה · ' + occ });
      } else if (a.rem1 && !a.rem2 && st === '' && now >= rem2Due(occ, cfg)) {
        tellGabbai(a.owner_email, menuMsg('auto_rem2', a, occ, cfg), a);
        pendPut(phone, { id: a.auto_id, occ: occ, wait: '' }); // א פתוחה המתנה ענדיגט זיך
        setFields('SmsAuto', a._row, { rem2: stamp() });
        ev('auto_rem', { name: a.name, detail: 'תזכורת אחרונה · ' + occ });
      }
      return;
    }
    // די צייט איז דא
    pendDrop(phone, a.auto_id);
    if (st === 'approved') {
      const r = autoSend(a, occ, cfg);
      setFields('SmsAuto', a._row, { occ_state: r.ok ? 'sent' : 'missed', last_job: r.job_id || '', updated_at: stamp() });
      if (!r.ok) {
        const missing = money_((Number(r.need) || 0) - (Number(r.have) || 0));
        tellGabbai(a.owner_email, txt_('auto_failed_credit', { title: titleOf(a, occ), when: whenText(occ), missing: missing }, cfg), a);
        notifyAdmins('auto_nocredit', 'הודעה אוטומטית לא נשלחה: ' + a.name, '"' + titleOf(a, occ) + '" לא נשלחה ' + whenText(occ) + ', כי חסרים ' + missing + ' בקרדיטים של ' + userLabel(a.owner_email) + '.');
        ev('auto_missed', { name: a.name, detail: occ + ' · קרדיטים' });
      }
    } else if (st === '') {
      setFields('SmsAuto', a._row, { occ_state: 'missed', updated_at: stamp() });
      tellGabbai(a.owner_email, txt_('auto_missed', { title: titleOf(a, occ), when: whenText(occ) }, cfg), a);
      ev('auto_missed', { name: a.name, detail: occ });
    }
  });
}
function userLabel(email) { return String(email || ''); }
/** שאפן א שליחה (SmsJobs) — runJobs שיקט עס */
function autoSend(a, occ, cfg) {
  const text = bodyOf(a, occ);
  const rec = autoRecipList(a);
  const res = jobCreate({ kind: 'sms', text: text, nobrand: modOf_(a).nobrand, title: '🔁 ' + a.name, list_name: a.list_name, recipients: rec.map(function (r) { return { phone: r.p || r.phone, contact_id: r.c || r.contact_id, name: r.n || r.name }; }), send_at: stamp() }, lower(a.owner_email));
  if (res.error) return { ok: false, need: res.need, have: res.have, error: res.error };
  ev('auto_sent', { name: a.name, detail: occ + ' · ' + rec.length });
  return { ok: true, job_id: res.job_id };
}
/** א גבאי ענטפערט צום נומער פון קהל. null = נישט פאר אונז (ווייטער ווי געווענליך) */
function autoReply(from, t, g) {
  const cfg = config(); const cache = CacheService.getScriptCache(); const ck = 'autochoose:' + last10(from);
  // נאר וואס ווארט נאך: דער זעלבער מאל, פאר'ן מועד, נישט פארטיג
  let list = pendGet(from).filter(function (p) {
    const a = autoById(p.id);
    return a && String(a.occ_at) === p.occ && p.occ > stamp() && ['', 'approved'].indexOf(String(a.occ_state)) >= 0;
  });
  pendSet(from, list);
  if (!list.length) return null;
  const say1 = function (m) { sendSms(PropertiesService.getScriptProperties().getProperty('TELNYX_BROADCAST_NUMBER'), from, m, null, { line: 'broadcast', email: g.email, job_id: 'auto' }); return { ok: true, handled: 'auto' }; };
  // א בחירה פון "על איזו הודעה?"
  const ch = cache.get(ck);
  if (ch && /^\d{1,2}$/.test(t)) {
    const c = JSON.parse(ch); cache.remove(ck);
    const p = c.opts[Number(t) - 1]; if (!p) return say1('לא הבנתי. ' + chooseText(c.opts));
    return autoAct(from, p, c.t, g, cfg, say1);
  }
  // ווען איינס ווארט אויף אן ענטפער (3/4/5/2/בלי שם) — דאס איז עס
  const waiting = list.filter(function (p) { return p.wait; }).sort(function (x, y) { return String(y.at).localeCompare(String(x.at)); })[0];
  if (waiting) return autoAct(from, waiting, t, g, cfg, say1);
  if (list.length > 1) {
    cache.put(ck, JSON.stringify({ t: t, opts: list }), 600);
    return say1(chooseText(list));
  }
  return autoAct(from, list[0], t, g, cfg, say1);
}
function chooseText(opts) {
  return 'על איזו הודעה?\n' + opts.map(function (p, i) { const a = autoById(p.id); return (i + 1) + '. ' + (a ? a.name : p.id) + ' (' + String(p.occ).slice(5, 16) + ')'; }).join('\n');
}
/** די אקציעס פונעם תפריט */
function autoAct(from, p, t, g, cfg, say1) {
  const a = autoById(p.id); if (!a) return null;
  const occ = a.occ_at; const title = titleOf(a, occ);
  const setWait = function (w) { pendPut(from, { id: a.auto_id, occ: occ, wait: w }); };
  const unapprove = function () { if (String(a.occ_state) === 'approved') { setFields('SmsAuto', a._row, { occ_state: '', updated_at: stamp() }); a.occ_state = ''; } };
  const showNow = function () { setWait(''); return say1(menuMsg('auto_now', a, occ, cfg)); };
  const lines = function () { return bodyOf(a, occ).split('\n').filter(function (l) { return l.trim(); }); };
  const L = String(t || '').trim();
  const lm = L.match(/^(111|222)\s*[:：-]?\s*([\s\S]*)$/);
  // שורת גבאי — אין יעדן מצב
  if (lm) {
    setLine(a, lm[1] === '222' ? 2 : 1, lm[2]); a.line = autoById(a.auto_id).line;
    unapprove(); ev('auto_change', { g: g, name: a.name, detail: 'שורת גבאי ' + (lm[1] === '222' ? 2 : 1) });
    return showNow();
  }
  if (L === '0') return showNow();
  if (p.wait === 'drop') {
    const idx = (L.match(/\d+/g) || []).map(Number);
    const ls = lines(); const pick = idx.map(function (i) { return ls[i - 1]; }).filter(Boolean);
    if (!pick.length) return say1('לא מצאתי את השורה. ' + txt_('auto_drop_q', { numbered: numbered(ls) }, cfg));
    const m = modOf_(a); pick.forEach(function (l) { if (m.drop.indexOf(l.trim()) < 0) m.drop.push(l.trim()); });
    setMod(a, m); unapprove(); ev('auto_change', { g: g, name: a.name, detail: 'הורדת שורות: ' + pick.join(' / ') });
    return showNow();
  }
  if (p.wait === 'text') {
    const m = modOf_(a); m.text = L.slice(0, 1200); m.drop = [];
    setMod(a, m); unapprove(); ev('auto_change', { g: g, name: a.name, detail: 'הודעה מחליפה' });
    return showNow();
  }
  if (p.wait === 'line') return say1(txt_('auto_line_q', null, cfg));
  if (p.wait === 'cancel') {
    if (L === '1') return doCancel();
    setWait(''); return say1(txt_('auto_kept', { title: title }, cfg));
  }
  if (p.wait === 'nobrand') {
    setWait('');
    if (L === '1') { const m = modOf_(a); m.nobrand = true; setMod(a, m); ev('auto_change', { g: g, name: a.name, detail: 'בלי השם' }); return say1(txt_('auto_nobrand_ok', { title: title, brand: brandOf(cfg) }, cfg)); }
    return say1(txt_('auto_nobrand_keep', { title: title, brand: brandOf(cfg) }, cfg));
  }
  function doCancel() {
    setFields('SmsAuto', a._row, { occ_state: 'canceled', updated_at: stamp() }); pendDrop(from, a.auto_id);
    ev('auto_cancel', { g: g, name: a.name, detail: occ });
    return say1(txt_('auto_ok_canceled', { title: title }, cfg));
  }
  // דער תפריט
  if (L === '1') {
    if (String(a.occ_state) === 'approved') return { ok: true, handled: 'auto-noop' };
    setFields('SmsAuto', a._row, { occ_state: 'approved', updated_at: stamp() }); a.occ_state = 'approved';
    ev('auto_ok', { g: g, name: a.name, detail: 'אושר · ' + occ });
    const have = creditsOf(lower(a.owner_email)); const cost = costOf(a, occ, cfg);
    say1(have < cost ? txt_('auto_ok_approved_short', { title: title, missing: money_(cost - have) }, cfg) : txt_('auto_ok_approved', { title: title }, cfg));
    // בלי דעם נאמען — ווען עס שפארט א חלק
    const m = modOf_(a);
    if (!m.nobrand) {
      const b = bodyOf(a, occ); const withB = segments(branded(b, cfg)); const noB = segments(b);
      if (noB < withB) { setWait('nobrand'); return say1(txt_('auto_nobrand_q', { from: withB, to: noB, brand: brandOf(cfg) }, cfg)); }
    }
    setWait(''); return { ok: true, handled: 'auto' };
  }
  if (L === '2') {
    if (String(a.occ_state) === 'approved') { setWait('cancel'); return say1(txt_('auto_cancel_q', { title: title }, cfg)); }
    return doCancel();
  }
  if (L === '3') { setWait('drop'); return say1(txt_('auto_drop_q', { numbered: numbered(lines()) }, cfg)); }
  if (L === '4') { setWait('text'); return say1(txt_('auto_text_q', null, cfg)); }
  if (L === '5') { setWait('line'); return say1(txt_('auto_line_q', null, cfg)); }
  // 6: כ"ק אד"ש לא נמצא — נרשם ביז מוצאי שבת, און די הודעה ווערט איבערגערעכנט
  if (L === '6' && awayDepends(a, occ)) {
    const sat = awaySat_(occ); const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    if (!awayAdd_(today < LUACH.isoOf(sat - 1) ? today : LUACH.isoOf(sat - 1), LUACH.isoOf(sat), 'SMS ' + (g.email || last10(from)))) return say1(txt_('auto_away_fail', null, cfg));
    unapprove(); ev('auto_change', { g: g, name: a.name, detail: 'כ"ק אד"ש לא נמצא (6) עד ' + LUACH.isoOf(sat) });
    return showNow();
  }
  return null; // נישט פאר אונז
}
function numbered(ls) { return ls.map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n'); }
// ---- פונעם אתר ----
function canAuto(a, email) { return isAdmin(email) || lower(a.owner_email) === email || lower(a.created_by) === email; }
function autoSave(req, email) {
  const x = req.auto || {};
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const old = x.auto_id ? autoById(x.auto_id) : null;
    if (old && !canAuto(old, email)) return { error: 'not-allowed' };
    if ((x.sched || {}).type === 'keyword') {
      const words = kwWords(x.sched.words);
      if (!words.length) return { error: 'kw-empty' };
      const taken = autoRows().filter(function (o) { return String(o.auto_id) !== String(x.auto_id || '') && schedOf(o).type === 'keyword'; })
        .reduce(function (acc, o) { return acc.concat(kwWords(schedOf(o).words)); }, []);
      const dup = words.filter(function (w) { return taken.indexOf(w) >= 0; });
      if (dup.length) return { error: 'kw-taken', words: dup };
      x.sched = { type: 'keyword', words: words };
    }
    const sched = JSON.stringify(x.sched || {});
    const f = {
      name: String(x.name || '').slice(0, 80), owner_email: lower(x.owner_email || email), list_id: String(x.list_id || ''), list_name: String(x.list_name || '').slice(0, 80),
      text: String(x.text || '').slice(0, 1200), sched: sched, active: x.active === false ? 'FALSE' : 'TRUE', updated_at: stamp(),
    };
    if (Array.isArray(x.recipients)) { f.recipients = JSON.stringify(x.recipients.map(function (r) { return { p: e164(r.phone), c: String(r.contact_id || ''), n: String(r.name || '').slice(0, 40) }; }).filter(function (r) { return r.p; })); f.recips_at = stamp(); }
    if (old) {
      if (old.sched !== sched || !isT(old.active)) { f.occ_at = ''; f.occ_state = ''; f.rem1 = ''; f.rem2 = ''; f.line = ''; }
      setFields('SmsAuto', old._row, f);
      return { ok: true, auto_id: old.auto_id };
    }
    const id = 'A' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
    appendObj('SmsAuto', Object.assign({ auto_id: id, created_at: stamp(), created_by: email, occ_at: '', occ_state: '' }, f));
    return { ok: true, auto_id: id };
  } finally { lock.releaseLock(); }
}
// ---------- תשובות מהציבור: ענטפערן פונעם אתר (פון די קרעדיטן פון דעם וואס ענטפערט) ----------
function inboxReply(req, email) {
  const p = last10(req.phone); const text = String(req.text || '').trim();
  if (!p || !text) return { error: 'no-text' };
  const o = optRow(p); if (o && String(o.status) === 'out') return { error: 'opted-out' };
  const cfg = config(); const full = branded(text, cfg);
  const cost = Math.round((Number(cfg.price_sms) || 0.01) * segments(full) * 10000) / 10000;
  const have = creditsOf(email);
  if (have < cost) return { error: 'no-credits', need: cost, have: have };
  const c = contactsByPhone(p)[0];
  const r = sendSms(PropertiesService.getScriptProperties().getProperty('TELNYX_BROADCAST_NUMBER'), p, full, null, { line: 'broadcast', email: email, contact_id: c ? c.contact_id : '', job_id: 'inbox' });
  if (r.status !== 'sent') return { error: 'send-failed' };
  appendObj('Credits', { at: stamp(), email: email, delta: -cost, kind: 'reply', ref: fmtPhone(p), note: '↩ ' + (c ? heName(c) : fmtPhone(p)), by: email });
  inboxDone(p, email);
  return { ok: true, credits: creditsOf(email) };
}
function inboxDone(phone, email) {
  const p = last10(phone); if (!p) return { error: 'no-phone' };
  readTab('SmsInbox').rows.filter(function (r) { return String(r.status) === 'new' && last10(r.phone) === p; })
    .forEach(function (r) { setFields('SmsInbox', r._row, { status: 'done', done_by: email, done_at: stamp() }); });
  return { ok: true };
}
// ---------- "מילה": ווער עס שיקט די מילה באקומט גלייך די מעסעדזש (אן קרעדיטן, איינמאל א טאג פאר יעדע מילה) ----------
function kwNorm(v) { return String(v || '').trim().toLowerCase().replace(/[^\w֐-׿]/g, ''); }
const KW_RESERVED = STOP_WORDS.concat(START_WORDS, JOIN_WORDS, HELP_WORDS, ['confirm']);
function kwWords(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[,،\n]+/);
  const out = [];
  arr.map(kwNorm).forEach(function (w) { if (w && KW_RESERVED.indexOf(w) < 0 && out.indexOf(w) < 0) out.push(w); });
  return out;
}
function kwMatch(w) {
  if (!w) return null;
  return autoRows().filter(function (a) { return isT(a.active) && schedOf(a).type === 'keyword' && kwWords(schedOf(a).words).indexOf(w) >= 0; })[0] || null;
}
/** שבת / יו"ט — דאן ענטפערט מען נישט. פון ערב (friday_cutoff) ביז צאת הכוכבים (לויטן לוח) */
function holyNow(now, cfg) {
  const d = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const hr = Number(Utilities.formatDate(now, TZ, 'H')) + Number(Utilities.formatDate(now, TZ, 'm')) / 60;
  const cut = Number(cfg.friday_cutoff || 13);
  if (String(cfg.blocked_dates || '').split(',').indexOf(d) >= 0) return true;
  let data = {}; try { data = minyanimData(); } catch (e) { /* בלי הנתונים — נאר שבת און יו"ט פונעם לוח */ }
  const n = LUACH.nOf(d);
  const holy = LUACH.holyOn(data, n); const holyNext = LUACH.holyOn(data, n + 1);
  if (holy) {
    if (holyNext) return true;
    // דער לוח שרייבט 12 שעה ("7:06") — צאת הכוכבים איז שטענדיג נאכמיטאג
    const m = /^(\d{1,2}):(\d{2})/.exec(String(LUACH.autoVars(data, d)['צאת הכוכבים'] || ''));
    if (!m) return true;
    return hr * 60 < ((Number(m[1]) % 12) + 12) * 60 + Number(m[2]);
  }
  if (holyNext || String(cfg.erev_dates || '').split(',').indexOf(d) >= 0) return hr >= cut;
  return false;
}
/** האט מען היינט שוין געשיקט צו דעם טעלעפאן מיט דעם צייכן (job_id)? */
function sentToday(phone, tag) {
  const d = last10(phone); const day = today();
  const log = readTab('SmsLog').rows;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const r = log[i];
    if (String(r.at).slice(0, 10) < day) break;
    if (r.dir === 'out' && String(r.job_id) === tag && last10(r.to) === d && String(r.status) !== 'error') return true;
  }
  return false;
}
function kwReply(from, a, line, inText) {
  const cfg = config();
  const c = contactsByPhone(from)[0];
  const base = { phone: from, contact_id: c ? c.contact_id : '', name: a.name, text: inText };
  if (holyNow(new Date(), cfg)) { ev('auto_kw', Object.assign(base, { detail: a.auto_id + ' holy' })); return { ok: true, handled: 'kw-holy' }; }
  const r = optRow(from); const st = r ? String(r.status) : '';
  if (st === 'out') return { ok: true, handled: 'kw-stopped' };
  const subscribed = st === 'in';
  const tag = subscribed ? 'kw:' + a.auto_id : 'kw:invite';
  if (sentToday(from, tag)) { ev('auto_kw', Object.assign(base, { detail: a.auto_id + ' limit' })); return { ok: true, handled: 'kw-limit' }; }
  const text = subscribed ? branded(LUACH.fillTemplate(a.text, LUACH.autoVars(minyanimData(), today()), ''), cfg) : txt_('kw_invite', null, cfg);
  sendSms(line, from, text, null, { line: 'broadcast', contact_id: base.contact_id, job_id: tag });
  ev('auto_kw', Object.assign(base, { detail: a.auto_id + (subscribed ? ' sent' : ' invite') }));
  return { ok: true, handled: subscribed ? 'kw' : 'kw-invite' };
}
function autoGuard(id, email) { const a = autoById(id); if (!a) return { error: 'not-found' }; if (!canAuto(a, email)) return { error: 'not-allowed' }; return { a: a }; }
function autoDel(id, email) { const g = autoGuard(id, email); if (g.error) return g; readHead('SmsAuto').sheet.deleteRow(g.a._row); return { ok: true }; }
function autoApprove(id, email, now) {
  const g = autoGuard(id, email); if (g.error) return g; const a = g.a; const cfg = config();
  if (now) { // נאכן מועד (לא נשלחה): שיקן יעצט — ביז דער קומענדיגער מחזור
    if (String(a.occ_state) !== 'missed') return { error: 'not-missed' };
    const r = autoSend(a, a.occ_at, cfg); if (!r.ok) return { error: r.error || 'no-credits', need: r.need, have: r.have };
    setFields('SmsAuto', a._row, { occ_state: 'sent', last_job: r.job_id || '', updated_at: stamp() });
    ev('auto_sent', { name: a.name, detail: 'נשלח מהאתר · ' + a.occ_at + ' · ' + email });
    return { ok: true, sent: true };
  }
  setFields('SmsAuto', a._row, { occ_state: 'approved', updated_at: stamp() });
  ev('auto_ok', { name: a.name, detail: 'אושר באתר · ' + a.occ_at + ' · ' + email });
  return { ok: true };
}
function autoCancel(id, email) { const g = autoGuard(id, email); if (g.error) return g; setFields('SmsAuto', g.a._row, { occ_state: 'canceled', updated_at: stamp() }); pendDrop(gabbaiPhone(g.a.owner_email), g.a.auto_id); return { ok: true }; }
/** שינוי חד־פעמי פונעם אתר: הורדת שורות, טקסט אנשטאט, שורות הגבאי. דער אישור פאלט אוועק */
function autoMod(req, email) {
  const g = autoGuard(req.id, email); if (g.error) return g; const a = g.a;
  ensureCols('SmsAuto');
  const m = LUACH.modOf({ drop: (req.drop || []).map(function (x) { return String(x).trim(); }).filter(String).slice(0, 40), text: String(req.text || '').slice(0, 1200), nobrand: !!req.nobrand });
  setFields('SmsAuto', a._row, { occ_mod: JSON.stringify(m), line: lineStore_(lineParts_(req.line || '')), occ_state: String(a.occ_state) === 'approved' ? '' : a.occ_state, updated_at: stamp() });
  ev('auto_change', { name: a.name, detail: 'שינוי חד־פעמי מהאתר · ' + email });
  return { ok: true };
}
/** שורת הגבאי: צוויי שורות (JSON) אדער איינע (טעקסט) */
function lineParts_(v) {
  if (Array.isArray(v)) return [String(v[0] || ''), String(v[1] || '')];
  const s = String(v || '');
  if (s.charAt(0) === '[') { try { const a = JSON.parse(s); if (Array.isArray(a)) return [String(a[0] || ''), String(a[1] || '')]; } catch (e) { /* */ } }
  return [s, ''];
}
function lineStore_(parts) { const p = parts.map(function (x) { return String(x || '').trim().slice(0, 300); }); return p[1] ? JSON.stringify(p) : p[0]; }
function setLine(a, idx, text) {
  const parts = lineParts_(a.line); parts[idx === 2 ? 1 : 0] = String(text || '').trim();
  const v = lineStore_(parts);
  setFields('SmsAuto', a._row, { line: v, updated_at: stamp() });
  return v;
}
function autoLine(id, line, email) { const g = autoGuard(id, email); if (g.error) return g; setFields('SmsAuto', g.a._row, { line: lineStore_(lineParts_(line)), updated_at: stamp() }); return { ok: true }; }
function autoRecips(id, list, email) {
  const a = autoById(id); if (!a) return { error: 'not-found' };
  const rec = (list || []).map(function (r) { return { p: e164(r.phone), c: String(r.contact_id || ''), n: String(r.name || '').slice(0, 40) }; }).filter(function (r) { return r.p; });
  setFields('SmsAuto', a._row, { recipients: JSON.stringify(rec), recips_at: stamp() });
  return { ok: true, n: rec.length };
}

/** דער אישור פון די Toll-Free נומערן ביי טעלניקס: [{ status, numbers, reason, updated }] */
function tfStatus() {
  const key = PropertiesService.getScriptProperties().getProperty('TELNYX_API_KEY');
  if (!key) return { error: 'no-key' };
  const r = UrlFetchApp.fetch('https://api.telnyx.com/v2/messaging_tollfree/verification/requests?page=1&page_size=20', { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { error: 'telnyx-' + r.getResponseCode() };
  const j = JSON.parse(r.getContentText());
  return { requests: (j.records || []).map(function (x) { return { status: x.verificationStatus || '', numbers: (x.phoneNumbers || []).map(function (p) { return p.phoneNumber; }), reason: x.reason || '', updated: x.updatedAt || x.createdAt || '' }; }) };
}
/** בדיקה פונעם עדיטאר: די {ערטער} פון היינט (ווי אויף דער תצוגה) + הרשאה פאר אימעיל */
function testAuto() {
  const d = minyanimData();
  Logger.log('זמני תפילות: ' + (Object.keys(d).length ? 'נטען' : 'לא נטען'));
  Logger.log(JSON.stringify(LUACH.autoVars(d, today())));
  Logger.log('מיילים שנשארו היום: ' + MailApp.getRemainingDailyQuota());
}
