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
  // גבאים של הקו הזמני בלבד (נוספו ב-SMS ע"י מנהלי קו) — לא מופיעים באתר
  SmsGabbaim: ['name', 'phone', 'added_by', 'added_at', 'note'],
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
    // 📱 הקו הזמני (SMS Gateway for Android ביוניהרץ) — עם קוד סודי בכתובת
    if (req.event && e.parameter && e.parameter.k) {
      if (!props.getProperty('GW_SECRET') || e.parameter.k !== props.getProperty('GW_SECRET')) return out({ error: 'bad-key' });
      return out(gwInbound_(req));
    }
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
  const s = settingsCols(['gabbai_email', 'gabbai_name', 'gabbai_phone', 'sms_admin']);
  for (let i = 0; i < s.length; i += 1) {
    // א גבאי קען האבן עטלעכע טעלעפאנען (געשיידט מיט א קאמע). גבאי בלי מייל = נאר SMS (נוסף דרך הקו)
    const mine = String(s[i].gabbai_phone || '').split(/[,;\/]/).map(last10);
    if (mine.indexOf(d) >= 0 && (s[i].gabbai_email || s[i].gabbai_name)) {
      return { email: s[i].gabbai_email ? lower(s[i].gabbai_email) : 'sms:' + d, name: s[i].gabbai_name || s[i].gabbai_email, smsAdmin: isT(s[i].sms_admin) };
    }
  }
  // גבאים של הקו בלבד (לשונית SmsGabbaim)
  try {
    const q = readTab('SmsGabbaim').rows;
    for (let j = 0; j < q.length; j += 1) {
      if (String(q[j].phone || '').split(/[,;\/]/).map(last10).indexOf(d) >= 0 && String(q[j].name || '').trim()) return { email: 'sms:' + d, name: q[j].name, smsAdmin: false, smsOnly: true };
    }
  } catch (e) { /* */ }
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
/** JOIN: דער טעלעפאן ווערט צוגעלייגט צו דער רשימה פון "join_list" (SmsConfig) — דער טעג ביים ריכטיגן טעלעפאן אינעם קאנטאקט */
function joinListName() { return String(config().join_list || '').trim(); }
function addPhoneToList(contactId, phone, list) {
  if (!list || !contactId) return false;
  const d = last10(phone);
  const t = readTab('Phones');
  const r = t.rows.filter(function (x) { return String(x.contact_id) === String(contactId); })[0];
  if (!r) return false;
  const k = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].filter(function (f) { return last10(r[f]) === d; })[0];
  if (!k) return false;
  const tags = String(r[k + '_tags'] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  if (tags.indexOf(list) < 0) { tags.push(list); const f = {}; f[k + '_tags'] = tags.join(', '); setFields('Phones', r._row, f); PHONES = null; }
  return true;
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
      addPhoneToList(c.contact_id, from, joinListName());
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
        ev('join_name', { phone: from, contact_id: r.contact.contact_id, name: name, text: text, detail: heName(r.contact) + (joinListName() ? ' · להוסיף את המספר לכרטיס ולרשימה: ' + joinListName() : '') });
      } else {
        const opts = r.cands.slice(0, 4).map(function (c) { return heName(c) + (parentLine(c) ? ' (' + parentLine(c) + ')' : ''); }).join(' / ');
        ev('join_review', { phone: from, name: name, text: text, detail: (opts ? 'אפשרויות: ' + opts : 'לא נמצא באנשי הקשר') + (joinListName() ? ' · רשימה: ' + joinListName() : '') });
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
  if (a === 'screen_simchos') return screenSimchos_(req.rows);
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
const STRIPE_FEE = 0.35; // דמי טיפול לכל רכישה (גם ב-js/sms.js)
function stripeCheckout(req, email) {
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('STRIPE_SECRET_KEY');
  if (!key) return { error: 'no-stripe' };
  const usd = Math.round(Number(req.usd) * 100) / 100;
  if (!(usd >= 1 && usd <= 500)) return { error: 'bad-amount' };
  const pay = Math.round((usd + STRIPE_FEE) * 100); // הקרדיטים = usd; התשלום = usd + דמי טיפול
  const site = P.getProperty('SITE_URL') || 'https://ungvar.org/';
  const form = {
    mode: 'payment', submit_type: 'donate',
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(Math.round(usd * 100)), 'line_items[0][price_data][product_data][name]': 'Donation – Khal Ungvar',
    'line_items[1][quantity]': '1', 'line_items[1][price_data][currency]': 'usd',
    'line_items[1][price_data][unit_amount]': String(pay - Math.round(usd * 100)), 'line_items[1][price_data][product_data][name]': 'Processing fee',
    'payment_intent_data[statement_descriptor_suffix]': 'DONATION', 'payment_intent_data[description]': 'Donation – Khal Ungvar',
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
  appendObj('Credits', { at: stamp(), email: email, delta: Number(req.credits) || Number(req.amount_total) / 100 || 0, kind: 'purchase', ref: req.session_id, note: 'Donation $' + (Number(req.amount_total) / 100), by: 'stripe' });
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
/** שהשמחה במעונם → דער מסך: די לשונית Simchos אין גיליון פון דער תצוגה (דער סקריפט שרייבט — די גבאים דארפן נישט קיין רשות אויפן גיליון) */
function screenSimchos_(rows) {
  if (!Array.isArray(rows) || rows.length > 190) return { error: 'bad-rows' };
  const vals = rows.map(function (r) { return [0, 1, 2, 3].map(function (i) { return String((r || [])[i] == null ? '' : r[i]).slice(0, 8000); }); });
  const book = SpreadsheetApp.openById(DISPLAY_SHEET);
  let sh = book.getSheetByName('Simchos');
  if (!sh) sh = book.insertSheet('Simchos');
  sh.getRange(1, 1, 1, 4).setValues([['simcha_id', 'html', 'until', 'updated_at']]);
  sh.getRange(2, 1, 199, 4).clearContent();
  if (vals.length) sh.getRange(2, 1, vals.length, 4).setNumberFormat('@').setValues(vals);
  return { ok: true, n: vals.length };
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
  for (let i = 0; i < s.length; i += 1) { const ph = String(s[i].gabbai_phone || '').split(/[,;\/]/)[0]; if (lower(s[i].gabbai_email) === lower(email) && last10(ph)) return e164(ph); }
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

/** נאר דער טריגער (runJobs יעדע 5 מינוט) — אן setup (וואס טוישט באשיצונגען) */
function installJobsTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runJobs') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runJobs').timeBased().everyMinutes(5).create();
  Logger.log('ok — trigger');
}

/** 2026-11-12 (זמני): admin@ungvar.org באקומט רעדאגירן אויף אלע באשיצטע לשוניות פונעם הויפט-גיליון — פאר דעם נייעם סקריפט (קיים בעורך החי) */
function grantAdminProtections() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let n = 0;
  ss.getProtections(SpreadsheetApp.ProtectionType.SHEET).concat(ss.getProtections(SpreadsheetApp.ProtectionType.RANGE)).forEach(function (p) { try { p.addEditor('admin@ungvar.org'); n++; } catch (e) { Logger.log('skip: ' + p.getDescription() + ' ' + e); } });
  Logger.log('ok: ' + n);
}

/** פונעם עדיטאר: אלע פרטים פון די Toll-Free בקשות (כדי צו זען פארוואס מ'האט אפגעזאגט) */
function logTfFull() {
  const key = PropertiesService.getScriptProperties().getProperty('TELNYX_API_KEY');
  if (!key) { Logger.log('no-key'); return; }
  const r = UrlFetchApp.fetch('https://api.telnyx.com/v2/messaging_tollfree/verification/requests?page=1&page_size=20', { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  Logger.log('HTTP ' + r.getResponseCode());
  const j = JSON.parse(r.getContentText() || '{}');
  (j.records || []).forEach(function (x) {
    const o = {};
    Object.keys(x).forEach(function (k) { if (!/email|phone(?!Numbers)|contact/i.test(k)) o[k] = x[k]; });
    Logger.log(JSON.stringify(o, null, 1));
  });
}

/** פונעם עדיטאר: שיקט נאכאמאל א Toll-Free בקשה וואס מ'האט אפגעזאגט, מיט א טויש אין אתר + הערה */
function tfResubmit() {
  const ID = 'b78ceb10-40f8-5f19-b6d7-babfbc06809b';
  const key = PropertiesService.getScriptProperties().getProperty('TELNYX_API_KEY');
  const base = 'https://api.telnyx.com/v2/messaging_tollfree/verification/requests/' + ID;
  const g = UrlFetchApp.fetch(base, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  if (g.getResponseCode() !== 200) { Logger.log('GET ' + g.getResponseCode() + ' ' + g.getContentText()); return; }
  const x = JSON.parse(g.getContentText());
  const rec = x.data || x;
  ['id', 'verificationStatus', 'reason', 'createdAt', 'updatedAt', 'ticketNumber'].forEach(function (k) { delete rec[k]; });
  rec.corporateWebsite = 'https://ungvar.org/?lang=en';
  rec.additionalInformation = 'Website (English): https://ungvar.org/?lang=en - the home page of Khal Ungvar, our synagogue (EIN 11-2330829). '
    + 'The SMS signup is the round "SMS" button on the home page (opens the consent form, see the opt-in image). '
    + 'Full SMS program terms: https://ungvar.org/sms.html ; privacy policy: https://ungvar.org/privacy.html (both linked in the home page footer). '
    + 'No purchased or third-party lists. Every recipient\'s consent is recorded with its source and date. STOP and HELP are handled automatically.';
  Object.keys(rec).forEach(function (k) { if (rec[k] === null) delete rec[k]; });
  const r = UrlFetchApp.fetch(base, { method: 'patch', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key }, payload: JSON.stringify(rec), muteHttpExceptions: true });
  Logger.log('PATCH ' + r.getResponseCode());
  try { const j = JSON.parse(r.getContentText()); const d = j.data || j; Logger.log(JSON.stringify({ status: d.verificationStatus, website: d.corporateWebsite, errors: j.errors }, null, 1)); } catch (e) { Logger.log(r.getContentText().slice(0, 1500)); }
}

/** פונעם עדיטאר: דער סטאטוס פון Toll-Free אימות ביי Telnyx */
function logTf() { Logger.log(JSON.stringify(tfStatus(), null, 1)); }

// ======================================================================
// 🔎 JBD — בדיקת כתובות מול thejbd.com (רץ לבד, אחד-שניים בדקה)
//   jbdStart()  — מפעיל (פעם אחת). jbdStop() — עוצר. jbdStatus() — מצב.
//   התוצאות: לשונית "JBD_Check". שום דבר לא משתנה ב-Contacts — רק אחרי אישור.
//   מי נבדק: רשימת הרבנים (7>90-93) + חתונה פ"ג (8>100) שאינם חסידי אלכסנדר (5>73), לא מחוקים.
// ======================================================================
const JBD_TAB = 'JBD_Check';
const JBD_HEAD = ['contact_id', 'priority', 'name', 'sys_address', 'sys_phones', 'status', 'jbd_name', 'jbd_address', 'jbd_phone', 'note', 'checked_at', 'decision'];

function jbdStart() {
  const sh = jbdSheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'jbdTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('jbdTick').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().deleteProperty('JBD_PAUSE_UNTIL');
  const r = jbdTick(); // בדיקה ראשונה מיד
  Logger.log('JBD started. first: ' + JSON.stringify(r) + ' | rows: ' + (sh.getLastRow() - 1));
}
function jbdStop() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'jbdTick') ScriptApp.deleteTrigger(t); });
  Logger.log('JBD stopped');
}
function jbdStatus() {
  const q = jbdQueue_();
  const sh = jbdSheet_();
  const st = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 6, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { st[r[0]] = (st[r[0]] || 0) + 1; });
  Logger.log('left: ' + q.left.length + ' | done: ' + q.doneCount + ' | ' + JSON.stringify(st) + ' | err: ' + (PropertiesService.getScriptProperties().getProperty('JBD_ERR') || '-'));
}
function jbdSheet_() {
  let sh = ss().getSheetByName(JBD_TAB);
  if (!sh) {
    sh = ss().insertSheet(JBD_TAB);
    sh.getRange(1, 1, 1, JBD_HEAD.length).setValues([JBD_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}
/** התור: מי צריך בדיקה ועוד לא נבדק, לפי סדר עדיפות */
function jbdQueue_() {
  const sh = jbdSheet_();
  const done = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { done[String(r[0])] = 1; });
  const list = [];
  readTab('Contacts').rows.forEach(function (c) {
    if (String(c.deleted_at || '').trim() || !String(c.contact_id || '').trim()) return;
    const tg = String(c.tags || '');
    const rabbi = /\["7","9[0-3]"/.test(tg);
    const wed = tg.indexOf('["8","100"]') >= 0 && tg.indexOf('["5","73"]') < 0;
    if (!rabbi && !wed) return;
    const pr = rabbi ? 1 : (!String(c.address || '').trim() ? 2 : (tg.indexOf('_ok') >= 0 ? 4 : 3));
    list.push({ c: c, pr: pr });
  });
  list.sort(function (a, b) { return a.pr - b.pr || Number(a.c.contact_id) - Number(b.c.contact_id); });
  return { left: list.filter(function (x) { return !done[String(x.c.contact_id)]; }), doneCount: Object.keys(done).length };
}
function jbdTick() {
  const P = PropertiesService.getScriptProperties();
  const pause = Number(P.getProperty('JBD_PAUSE_UNTIL') || 0);
  if (pause && Date.now() < pause) return { paused: true };
  // לא מחזיקים את הנעילה בזמן ההמתנה — כדי לא לעכב את ה-SMS של הגבאים
  const C = CacheService.getScriptCache();
  if (C.get('jbd_running')) return { busy: true };
  C.put('jbd_running', '1', 90);
  try {
    const q = jbdQueue_();
    if (!q.left.length) { jbdStop(); return { finished: true }; }
    const n = (new Date().getMinutes() % 3 === 0) ? 1 : 2; // ~100 בשעה
    const out = [];
    for (let i = 0; i < n && i < q.left.length; i += 1) {
      if (i) Utilities.sleep(22000);
      const res = jbdCheckOne_(q.left[i].c, q.left[i].pr);
      if (res === 'ERR') break;
      out.push(res);
    }
    return { checked: out };
  } finally { C.remove('jbd_running'); }
}

// ---- השוואה ----
function jbdD_(p) { return last10(p); }
function jbdAddrKey_(s) {
  s = String(s || '').toLowerCase().split(',')[0].replace(/#.*$/, '').replace(/\b(apt|unit|fl|ste)\b.*$/, '');
  s = s.replace(/\bavenue\b|\bav\b/g, 'ave').replace(/\bstreet\b/g, 'st').replace(/\broad\b/g, 'rd').replace(/\bplace\b/g, 'pl').replace(/\bdrive\b/g, 'dr')
    .replace(/\bcourt\b/g, 'ct').replace(/\blane\b/g, 'ln').replace(/\bparkway\b/g, 'pkwy').replace(/\beast\b/g, 'e').replace(/\bwest\b/g, 'w')
    .replace(/\bnorth\b/g, 'n').replace(/\bsouth\b/g, 's').replace(/(\d+)(st|nd|rd|th)\b/g, '$1').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
function jbdName_(s) { return String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function jbdFirstOk_(sysFirst, jFirst) {
  const a = jbdName_(sysFirst).split(' ').filter(String); const b = jbdName_(jFirst).split(' ').filter(String);
  if (!a.length || !b.length) return false;
  return a.some(function (x) { return b.some(function (y) { return x === y || (x.length > 2 && y.length > 2 && (x.indexOf(y) === 0 || y.indexOf(x) === 0)) || (x.length === 1 && y[0] === x); }); });
}
function jbdCheckOne_(c, pr) {
  const P = PropertiesService.getScriptProperties();
  const ph = phonesMap()[String(c.contact_id)] || {};
  const sysPh = [ph.mobile, ph.home_phone, ph.wife_mobile].map(jbdD_).filter(String);
  const first = String(c.first_name_en || '').trim(); const last = String(c.last_name_en || '').trim();
  const row = { contact_id: c.contact_id, priority: pr, name: (heName(c) + ' / ' + first + ' ' + last).trim(),
    sys_address: [c.address, c.city, c.zip].filter(function (x) { return String(x || '').trim(); }).join(', '),
    sys_phones: sysPh.map(fmtPhone).join(' · '), checked_at: stamp() };
  if (!last) { row.status = '— אין שם באנגלית'; jbdWrite_(row); return row.status; }
  const term = (last + ' ' + first.split(/\s+/)[0]).trim();
  let data;
  try {
    const r = UrlFetchApp.fetch('https://thejbd.com/directory-search?q=' + encodeURIComponent(term),
      { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
    data = JSON.parse(r.getContentText()).data || [];
    P.deleteProperty('JBD_ERR');
  } catch (e) {
    P.setProperty('JBD_ERR', stamp() + ' ' + String(e.message || e).slice(0, 200));
    P.setProperty('JBD_PAUSE_UNTIL', String(Date.now() + 10 * 60000)); // הפסקה של 10 דקות
    return 'ERR';
  }
  const sysA = jbdAddrKey_(c.address); const sysZip = String(c.zip || '').slice(0, 5);
  const cands = [];
  data.filter(function (d) { return !d.business && jbdName_(d.lastName) === jbdName_(last); }).forEach(function (d) {
    (d.locations || []).forEach(function (l) {
      const addr = l.fullAddress || ((l.addressFirst || '') + ', ' + (l.addressLast || ''));
      const lp = jbdD_(l.telephone);
      const x = { d: d, addr: addr, tel: l.telephone || '', phoneHit: lp && sysPh.indexOf(lp) >= 0, addrHit: sysA && jbdAddrKey_(addr) === sysA, firstHit: jbdFirstOk_(first, d.firstName) };
      x.zipHit = sysZip && addr.indexOf(sysZip) >= 0;
      x.score = (x.phoneHit ? 5 : 0) + (x.addrHit ? 4 : 0) + (x.firstHit ? 2 : 0) + (x.zipHit ? 1 : 0);
      cands.push(x);
    });
  });
  cands.sort(function (a, b) { return b.score - a.score; });
  const best = cands[0];
  const nm = function (x) { return [x.d.title, x.d.firstName, x.d.lastName].join(' ').replace(/\s+/g, ' ').trim() + (x.d.benReb ? ' (בן ר\' ' + x.d.benReb + ')' : ''); };
  const firsts = cands.filter(function (x) { return x.firstHit; });
  if (best && best.addrHit) { row.status = '✓ תואם'; if (!best.phoneHit && best.tel) row.note = 'טלפון ב-JBD שונה'; }
  else if (best && best.phoneHit) row.status = sysA ? '⚠ כתובת שונה' : '+ כתובת מ-JBD';
  else if (firsts.length === 1) row.status = sysA ? '? אולי — כתובת שונה' : '? אולי — כתובת מ-JBD';
  else if (firsts.length > 1) { row.status = '? כמה אפשרויות'; row.note = firsts.slice(1, 4).map(function (x) { return nm(x) + ' · ' + x.addr + ' · ' + x.tel; }).join(' | '); }
  else row.status = '✗ לא נמצא';
  const show = (best && (best.addrHit || best.phoneHit)) ? best : (firsts[0] || null);
  if (show) { row.jbd_name = nm(show); row.jbd_address = show.addr; row.jbd_phone = show.tel; }
  jbdWrite_(row);
  return c.contact_id + ' ' + row.status;
}
function jbdWrite_(row) {
  jbdSheet_().appendRow(JBD_HEAD.map(function (h) { return row[h] === undefined ? '' : txt(row[h]); }));
}

// ======================================================================
// 📱 קו זמני לגבאים — SMS Gateway for Android (היוניהרץ, 718-928-5098)
//   רק עבודה על הרשימה: חיפוש (רשימה + מחסן), הוספה, עדכון, תיוג, משפחה, הערה, מחיקה.
//   Script Properties (מכניס הרב בעצמו): GW_USER, GW_PASS — מהאפליקציה (Cloud server).
//   gwSetup() — פעם אחת אחרי פריסה: יוצר GW_SECRET ורושם את ה-webhook באפליקציה.
// ======================================================================
const GW_API = 'https://api.sms-gate.app/3rdparty/v1';
const GW_EXEC_URL = 'https://script.google.com/macros/s/AKfycbzK63Qd9P3Gb-255-gVFGvqkF_NddBjJ9i5yHKrnaK_E8PwLsB_7WDO6Lh2iyqO1vPZ/exec';
function gwAuth_() {
  const P = PropertiesService.getScriptProperties();
  const u = P.getProperty('GW_USER'); const p = P.getProperty('GW_PASS');
  if (!u || !p) throw new Error('חסרים GW_USER / GW_PASS ב-Script Properties');
  return 'Basic ' + Utilities.base64Encode(u + ':' + p);
}
function gwSetup() {
  const P = PropertiesService.getScriptProperties();
  // כל הרצה: קוד סודי חדש (הישן נמחק עם ה-webhook הישן)
  const k = Utilities.getUuid().replace(/-/g, '');
  P.setProperty('GW_SECRET', k);
  // הכתובת של הפריסה הפעילה (Manage deployments) — לא getService().getUrl(), שמחזיר כתובת בדיקה
  const url = P.getProperty('WEB_APP_URL') || GW_EXEC_URL;
  if (!url) throw new Error('הסקריפט עוד לא פורסם כ-Web app');
  const hook = url + '?k=' + k;
  const H = { Authorization: gwAuth_() };
  const list = JSON.parse(UrlFetchApp.fetch(GW_API + '/webhooks', { headers: H, muteHttpExceptions: true }).getContentText() || '[]');
  (Array.isArray(list) ? list : []).forEach(function (w) {
    if (w.event === 'sms:received' && String(w.url || '').indexOf('script.google.com/macros/') >= 0) UrlFetchApp.fetch(GW_API + '/webhooks/' + w.id, { method: 'delete', headers: H, muteHttpExceptions: true });
  });
  const r = UrlFetchApp.fetch(GW_API + '/webhooks', { method: 'post', contentType: 'application/json', headers: H, payload: JSON.stringify({ url: hook, event: 'sms:received' }), muteHttpExceptions: true });
  Logger.log('webhook: ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
}
function gwSend_(to, text) {
  text = String(text || '').slice(0, 1500);
  let st = 'sent'; let err = '';
  try {
    const r = UrlFetchApp.fetch(GW_API + '/messages', { method: 'post', contentType: 'application/json', headers: { Authorization: gwAuth_() },
      payload: JSON.stringify({ textMessage: { text: text }, phoneNumbers: [e164(to)], ttl: 3600 }), muteHttpExceptions: true });
    if (r.getResponseCode() >= 300) { st = 'error'; err = r.getContentText().slice(0, 200); }
  } catch (e) { st = 'error'; err = String(e.message || e).slice(0, 200); }
  try { sheetOf('SmsLog').appendRow(rowOf('SmsLog', { at: stamp(), dir: 'out', line: 'gw', from: 'gw', to: e164(to), text: text + (err ? ' ⚠ ' + err : ''), status: st })); } catch (e) { /* */ }
}
function gwInbound_(req) {
  const p = req.payload || {};
  const mid = String(p.messageId || p.id || req.id || '');
  const C = CacheService.getScriptCache();
  if (mid) { if (C.get('gwm:' + mid)) return { ok: true, dup: true }; C.put('gwm:' + mid, '1', 21600); }
  const from = String(p.sender || p.phoneNumber || '');
  const text = String(p.message || p.text || '').trim();
  try { sheetOf('SmsLog').appendRow(rowOf('SmsLog', { at: stamp(), dir: 'in', line: 'gw', from: e164(from), to: 'gw', text: text })); } catch (e) { /* */ }
  const g = gabbaiByPhone(from);
  const lang0 = langOf(text);
  if (!g) {
    if (!C.get('gwun:' + last10(from))) { C.put('gwun:' + last10(from), '1', 21600); gwSend_(from, say('notReg', lang0)); notifyAdmins('sms_unknown', 'SMS (קו זמני): ' + fmtPhone(from), 'מספר לא רשום שלח לקו הזמני: ' + fmtPhone(from) + '\n"' + text.slice(0, 300) + '"'); }
    return { ok: true, handled: 'unregistered' };
  }
  let reply = '';
  try { reply = gwHandle_(from, text, g); } catch (err) {
    reply = say('error', lang0) + ' ' + String(err && err.message || err).slice(0, 120);
    ev('error', { g: g, phone: from, text: text, detail: 'gw: ' + String(err && err.message || err) });
  }
  if (reply) gwSend_(from, reply);
  return { ok: true };
}

// ---- מצב שיחה ----
function gwSt_(ph) { const v = CacheService.getScriptCache().get('gw:' + last10(ph)); return v ? JSON.parse(v) : {}; }
function gwPut_(ph, st) { CacheService.getScriptCache().put('gw:' + last10(ph), JSON.stringify(st), 21600); }
function gwClr_(ph) { CacheService.getScriptCache().remove('gw:' + last10(ph)); }

// ---- טקסטים ----
const GWT = {
  help: { he: 'כתבו שם לחיפוש (אפשר להוסיף כתובת / טלפון).\nלהוספה: "חדש" + שם ופרטים.\n0 = סיום', yi: 'שרייבט א נאמען צו זוכן (מ\'קען צולייגן אדרעס / טעלעפאן).\nצולייגן: "נייע" + נאמען און פרטים.\n0 = ענדיגן', en: 'Text a name to search (you can add address / phone).\nTo add: "new" + name and details.\n0 = end' },
  menu: { he: 'מה לעשות?\n1 עדכון פרטים\n2 תיוג\n3 קשר משפחה\n4 הערה\n5 מחיקה\n0 סיום', yi: 'וואס צו טון?\n1 טוישן פרטים\n2 תיוג\n3 משפחה\n4 הערה\n5 אויסמעקן\n0 ענדיגן', en: 'What to do?\n1 Update details\n2 Tags\n3 Family\n4 Note\n5 Delete\n0 End' },
  upd: { he: 'מה לעדכן?\n1 כתובת\n2 טלפון\n3 שם', yi: 'וואס צו טוישן?\n1 אדרעס\n2 טעלעפאן\n3 נאמען', en: 'Update what?\n1 Address\n2 Phone\n3 Name' },
  phKind: { he: 'איזה טלפון?\n1 נייד\n2 בית\n3 נייד אשה', yi: 'וועלכער טעלעפאן?\n1 סעלפאן\n2 שטוב\n3 סעלפאן פון ווייב', en: 'Which phone?\n1 Cell\n2 Home\n3 Wife cell' },
  askAddr: { he: 'כתבו את הכתובת החדשה:', yi: 'שרייבט די נייע אדרעס:', en: 'Text the new address:' },
  askPh: { he: 'כתבו את המספר:', yi: 'שרייבט דעם נומער:', en: 'Text the number:' },
  askName: { he: 'כתבו את השם הנכון:', yi: 'שרייבט דעם ריכטיגן נאמען:', en: 'Text the correct name:' },
  tagMode: { he: '1 הוספת תיוג\n2 הסרת תיוג', yi: '1 צולייגן א תיוג\n2 אראפנעמען א תיוג', en: '1 Add tag\n2 Remove tag' },
  askTag: { he: 'איזה תיוג? כתבו את שמו:', yi: 'וועלכער תיוג? שרייבט דעם נאמען:', en: 'Which tag? Text its name:' },
  noTag: { he: 'אין תיוג כזה ברשימה (לא פותחים חדש ב-SMS).', yi: 'אזא תיוג איז נישטא (מ\'מאכט נישט קיין נייעם אין SMS).', en: 'No such tag (new tags are not created by SMS).' },
  noTags: { he: 'אין לו תיוגים.', yi: 'ער האט נישט קיין תיוגים.', en: 'No tags.' },
  rel: { he: 'הוא...\n1 בן של\n2 אבא של\n3 חתן של\n4 חותן של\n5 אח של\n6 מחיקת קשר קיים', yi: 'ער איז...\n1 זון פון\n2 טאטע פון\n3 איידעם פון\n4 שווער פון\n5 ברודער פון\n6 אויסמעקן א קשר', en: 'He is...\n1 Son of\n2 Father of\n3 Son-in-law of\n4 Father-in-law of\n5 Brother of\n6 Delete a relation' },
  relWho: { he: 'של מי? כתבו שם (ואפשר כתובת):', yi: 'פון וועמען? שרייבט א נאמען (מ\'קען צולייגן אדרעס):', en: 'Of whom? Text a name (address helps):' },
  noRels: { he: 'אין קשרים רשומים.', yi: 'קיין קשרים.', en: 'No relations.' },
  askNote: { he: 'כתבו את ההערה:', yi: 'שרייבט די הערה:', en: 'Text the note:' },
  pick: { he: 'השיבו במספר:', yi: 'ענטפערט מיטן נומער:', en: 'Reply with the number:' },
  notFound: { he: '✗ לא נמצא ברשימה ולא במחסן:', yi: '✗ נישט געפונען, נישט אין דער רשימה און נישט אין מחסן:', en: '✗ Not found (list or warehouse):' },
  addQ: { he: 'להוסיף כחדש? 1 כן, 2 לא', yi: 'צולייגן ווי א נייער? 1 יא, 2 ניין', en: 'Add as new? 1 yes, 2 no' },
  dup: { he: 'אולי זה אחד מאלה? השיבו במספר, או 9 = בכל זאת להוסיף חדש:', yi: 'אפשר איז עס איינער פון די? ענטפערט מיטן נומער, אדער 9 = יא צולייגן א נייעם:', en: 'Is it one of these? Reply with the number, or 9 = add new anyway:' },
  newAddr: { he: 'כתובת? (או 0 לדלג)', yi: 'אדרעס? (אדער 0 איבערשפרינגען)', en: 'Address? (or 0 to skip)' },
  newPh: { he: 'טלפון? (או 0 לדלג)', yi: 'טעלעפאן? (אדער 0 איבערשפרינגען)', en: 'Phone? (or 0 to skip)' },
  jbdQ: { he: 'לחפש בספר JBD את "{n}"? 1 כן, 2 לא', yi: 'זוכן אין JBD "{n}"? 1 יא, 2 ניין', en: 'Search JBD for "{n}"? 1 yes, 2 no' },
  jbdNone: { he: 'לא נמצא ב-JBD.', yi: 'נישט געפונען אין JBD.', en: 'Not found in JBD.' },
  jbdPick: { he: 'מ-JBD — השיבו במספר, או 0 אף אחד:', yi: 'פון JBD — ענטפערט מיטן נומער, אדער 0 קיינער:', en: 'From JBD — reply with the number, or 0 none:' },
  mMove: { he: '1 להעביר לרשימה\n0 סיום', yi: '1 אריבערפירן צו דער רשימה\n0 ענדיגן', en: '1 Move to the list\n0 End' },
  confirm: { he: '1 לאישור, 2 לביטול', yi: '1 באשטעטיגן, 2 אפזאגן', en: '1 confirm, 2 cancel' },
  canceled: { he: 'בוטל.', yi: 'אפגעזאגט.', en: 'Canceled.' },
  done: { he: 'בוצע ✓', yi: 'געטון ✓', en: 'Done ✓' },
  bye: { he: 'סיום ✓', yi: 'געענדיגט ✓', en: 'Ended ✓' },
  notAvail: { he: 'בקו הזה אפשר רק לעבוד על הרשימה (חיפוש, הוספה, עדכון, תיוג, משפחה, הערה, מחיקה).', yi: 'אויף די ליניע קען מען נאר ארבעטן אויף דער רשימה (זוכן, צולייגן, טוישן, תיוג, משפחה, הערה, אויסמעקן).', en: 'This line only works on the list (search, add, update, tags, family, note, delete).' },
  delQ: { he: 'למחוק את {n}? (אפשר לשחזר באתר)', yi: 'אויסמעקן {n}? (מ\'קען צוריקברענגען אויפן אתר)', en: 'Delete {n}? (can be restored on the site)' },
  inM: { he: '📦 במחסן (לא ברשימה):', yi: '📦 אין מחסן (נישט אין דער רשימה):', en: '📦 In the warehouse (not on the list):' },
  inL: { he: '✓ ברשימה:', yi: '✓ אין דער רשימה:', en: '✓ On the list:' },
};
function gt_(k, lang, vars) {
  let s = (GWT[k] || {})[lang] || (GWT[k] || {}).he || k;
  Object.keys(vars || {}).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
  return s;
}

// ---- חיפוש חכם ----
const GW_NICK = { shea: 'yehoshua', shaya: 'yeshaya', mottie: 'mordechai', motty: 'mordechai', mordche: 'mordechai', motti: 'mordechai', shloime: 'shlomo', yossi: 'yosef', yossie: 'yosef', yoely: 'yoel', srulik: 'yisroel', sruly: 'yisroel', hershy: 'hersh', chaskel: 'yechezkel', cheskel: 'yechezkel', chesky: 'yechezkel', lipa: 'lipa', berish: 'berish', zishe: 'zisha', mendy: 'menachem', mendel: 'menachem', nachman: 'nachman', duvid: 'dovid', david: 'dovid', moishe: 'moshe', moishy: 'moshe' };
function gwKeyEn_(w) {
  w = String(w || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  w = GW_NICK[w] || w;
  w = w.replace(/sch/g, 'sh').replace(/sz/g, 's').replace(/tz|ts/g, 'z').replace(/ck/g, 'k').replace(/ph/g, 'f').replace(/kh|ch/g, 'x').replace(/w/g, 'v')
    .replace(/[yj]/g, 'i').replace(/c(?=[eiy])/g, 's').replace(/[cq]/g, 'k').replace(/x/g, 'ks').replace(/(.)\1+/g, '$1');
  return w[0] + w.slice(1).replace(/[aeiouh]/g, '');
}
function gwKeyHe_(w) {
  w = norm(w).replace(/[^א-ת]/g, '');
  if (!w) return '';
  w = w.replace(/(.)\1+/g, '$1');
  return w.length <= 2 ? w : w[0] + w.slice(1).replace(/[אהויע]/g, '');
}
function gwKey_(w) { return /[א-ת]/.test(w) ? 'h:' + gwKeyHe_(w) : 'e:' + gwKeyEn_(w); }
function gwLev_(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9;
  const d = []; for (let i = 0; i <= a.length; i += 1) { d[i] = [i]; for (let j = 1; j <= b.length; j += 1) d[i][j] = i ? Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; }
  return d[a.length][b.length];
}
function gwSame_(q, k) {
  if (!q || !k || q.slice(0, 2) !== k.slice(0, 2)) return false;
  const a = q.slice(2); const b = k.slice(2);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return true;
  return a.length >= 4 && b.length >= 4 && gwLev_(a, b) <= 1;
}
function gwWords_(s) { return norm(s).split(' ').filter(function (w) { return w && TITLES.indexOf(w) < 0 && !/\d/.test(w); }); }
/** מציון: כל מילה בשאלה צריכה להתאים, ולפחות אחת לשם המשפחה */
function gwScore_(qw, firstArr, lastArr) {
  const fk = firstArr.join(' ').split(' ').filter(String).map(gwKey_); const lk = lastArr.join(' ').split(' ').filter(String).map(gwKey_);
  let hit = 0; let lastHit = false;
  qw.forEach(function (w) {
    const k = gwKey_(w);
    if (lk.some(function (x) { return gwSame_(k, x); })) { hit += 1; lastHit = true; } else if (fk.some(function (x) { return gwSame_(k, x); })) hit += 1;
  });
  if (!lastHit || hit < qw.length - (qw.length >= 3 ? 1 : 0)) return 0;
  return hit * 2 + (qw.length === 1 ? 0 : 1);
}
function gwAddrKey_(s) { return jbdAddrKey_(s); }
function gwAddrHit_(q, addr) {
  const a = gwAddrKey_(q); const b = gwAddrKey_(addr);
  if (!a || !b) return false;
  const na = (a.match(/^\d+/) || [''])[0]; const nb = (b.match(/^\d+/) || [''])[0];
  if (na && nb && na !== nb) return false;
  return a === b || (na && na === nb && a.split(' ')[1] === b.split(' ')[1]);
}
let MACHSAN = null;
function gwMachsan_() { if (!MACHSAN) MACHSAN = readTab('Machsan').rows.filter(function (m) { return !String(m.contact_id || '').trim() && m.status !== 'added' && String(m.decision || '') !== 'delete'; }); return MACHSAN; }
/** q: { name, phone, address, he:[], en:[] } → { list:[contact], mach:[machsan rows] } */
function gwFind_(q) {
  const names = [q.name].concat(q.he || [], q.en || []).filter(function (x) { return String(x || '').trim(); });
  const dig = String(q.phone || '').replace(/\D/g, '');
  const P = phonesMap();
  const scored = {};
  const bump = function (id, s) { scored[id] = Math.max(scored[id] || 0, 0) + s; };
  if (dig.length >= 7) contacts().forEach(function (c) {
    const p = P[String(c.contact_id)] || {};
    if (['mobile', 'home_phone', 'wife_mobile', 'other_phone'].some(function (k) { const d = String(p[k] || '').replace(/\D/g, ''); return d && d.slice(-7) === dig.slice(-7); })) bump(c.contact_id, 20);
  });
  names.forEach(function (nm) {
    const qw = gwWords_(nm);
    if (!qw.length) return;
    contacts().forEach(function (c) {
      let s = Math.max(gwScore_(qw, [c.first_name_he], [c.last_name_he]), gwScore_(qw, [c.first_name_en], [c.last_name_en]));
      if (!s) return;
      if (norm(c.first_name_he) === norm(qw.slice(0, -1).join(' ')) || norm(c.first_name_en) === norm(qw.slice(0, -1).join(' '))) s += 1;
      if (!scored[c.contact_id] || scored[c.contact_id] < 20) scored[c.contact_id] = Math.max(scored[c.contact_id] || 0, s);
      else scored[c.contact_id] += s;
    });
  });
  if (q.address) Object.keys(scored).forEach(function (id) { const c = byId(id); if (c && gwAddrHit_(q.address, c.address)) scored[id] += 5; });
  let list = Object.keys(scored).sort(function (a, b) { return scored[b] - scored[a]; });
  if (list.length > 1 && scored[list[0]] >= 20 && scored[list[1]] < 20) list = [list[0]];
  else if (list.length > 1 && q.address && scored[list[0]] - scored[list[1]] >= 5) list = [list[0]];
  list = list.slice(0, 6).map(byId).filter(Boolean);
  // מחסן
  const ms = [];
  gwMachsan_().forEach(function (m) {
    let s = 0;
    const md = String(m.phones || '').split(/[,;]/).map(function (x) { return x.replace(/\D/g, '').slice(-7); });
    if (dig.length >= 7 && md.indexOf(dig.slice(-7)) >= 0) s += 20;
    names.forEach(function (nm) { const qw = gwWords_(nm); if (qw.length) s = Math.max(s, s >= 20 ? s : 0, gwScore_(qw, [m.first], [m.last, m.last_he])); });
    if (s && q.address && gwAddrHit_(q.address, m.address)) s += 5;
    if (s) ms.push({ m: m, s: s });
  });
  ms.sort(function (a, b) { return b.s - a.s; });
  return { list: list, mach: ms.slice(0, list.length ? 2 : 4).map(function (x) { return x.m; }) };
}
function gwLine_(c) { return (heName(c) || enName(c)) + (c.address ? ', ' + c.address : (c.city ? ', ' + c.city : '')); }
function gwMLine_(m) { return '📦 ' + [m.title, m.first, m.last].join(' ').replace(/\s+/g, ' ').trim() + (m.address ? ', ' + m.address : '') + (m.city ? ', ' + m.city : ''); }

// ---- כרטיס ----
const GW_REL = { 'זון פון': 'בן של', 'טאטע פון': 'אבא של', 'איידעם פון': 'חתן של', 'שווער פון': 'חותן של', 'ברודער פון': 'אח של', 'שוואגער פון': 'גיס של', 'זיידע פון': 'סבא של', 'אייניקל פון': 'נכד של' };
function gwTagNodes_() {
  const rows = readTab('TagTree').rows; const by = {};
  rows.forEach(function (r) { by[String(r.node_id)] = r; });
  return { by: by, rows: rows };
}
function gwTagPath_(T, id) { const p = []; let n = T.by[String(id)]; let g = 0; while (n && g < 10) { p.unshift(String(n.node_id)); n = String(n.parent_id || '').trim() ? T.by[String(n.parent_id)] : null; g += 1; } return p; }
function gwTagLabel_(T, p) { return p.filter(function (x) { return T.by[x]; }).map(function (x) { return T.by[x].name; }).slice(-2).join(' › '); }
function gwTagsOf_(c) { try { const j = JSON.parse(String(c.tags || '[]')); return Array.isArray(j) ? j : []; } catch (e) { return []; } }
function gwCard_(id, lang) {
  CONTACTS = null; RELS = null; PHONES = null;
  const c = byId(id); if (!c) return gt_('notFound', lang);
  const p = phonesMap()[String(id)] || {};
  const L = [(heName(c) + (enName(c) ? ' / ' + enName(c) : '')) + ' (#' + id + ')'];
  if (c.address) L.push('📍 ' + [c.address, c.city, c.state, c.zip].filter(function (x) { return String(x || '').trim(); }).join(', '));
  const ph = [['📱', p.mobile], ['☎', p.home_phone], ['אשה', p.wife_mobile]].filter(function (x) { return String(x[1] || '').trim(); }).map(function (x) { return x[0] + ' ' + x[1]; });
  if (ph.length) L.push(ph.join(' · '));
  const T = gwTagNodes_();
  const tg = gwTagsOf_(c).filter(function (t) { return t.s !== 'f' && t.s !== 'auto' && (t.p || []).every(function (x) { return T.by[String(x)]; }); }).map(function (t) { return gwTagLabel_(T, t.p.map(String)); });
  if (tg.length) L.push('🏷 ' + tg.join(' · '));
  rels().filter(function (r) { return String(r.contact_id_a) === String(id); }).slice(0, 6).forEach(function (r) { const o = byId(r.contact_id_b); if (o) L.push('👪 ' + (GW_REL[r.relation_type] || r.relation_type) + ' ' + heName(o)); });
  readTab('OrgNotes').rows.filter(function (n) { return String(n.contact_id) === String(id); }).slice(-2).forEach(function (n) { L.push('📝 ' + String(n.text || n.note || '').slice(0, 120)); });
  return L.join('\n') + '\n\n' + gt_('menu', lang);
}
function gwMCard_(m, lang) {
  const L = [gwMLine_(m)];
  if (m.state || m.zip) L.push([m.state, m.zip].filter(String).join(' '));
  if (m.phones) L.push('☎ ' + m.phones);
  if (m.codes) L.push('קודים: ' + m.codes);
  if (m.gift_total) L.push('$' + m.gift_total + (m.gift_years ? ' · ' + m.gift_years + ' שנים' : ''));
  return gt_('inM', lang) + '\n' + L.join('\n') + '\n\n' + gt_('mMove', lang);
}

// ---- AI ----
function gwParse_(text, ctxName) {
  const sys = [
    'You read SMS messages from gabbaim of a Chassidic synagogue (Khal Ungvar, Brooklyn) who work on the contacts list. Messages are Yiddish, Hebrew or English.',
    ctxName ? 'The gabbai currently has this contact open: "' + ctxName + '". If the message is about him (no other person named), set who.self=true.' : '',
    'Return ONLY JSON: {"lang":"yi|he|en","intent":"find|add|update|tag|untag|delete|note|relation|gabbai_add|gabbai_remove|gabbai_list|gabbai_phone|other",',
    '"who":{"name":"","address":"","phone":"","self":false,"he":["name in Hebrew letters, up to 2 spellings"],"en":["name in English letters, up to 3 spellings"]},',
    '"fields":{"first_name_he":"","last_name_he":"","first_name_en":"","last_name_en":"","address":"","city":"","state":"","zip":"","mobile":"","home_phone":""},',
    '"tag":"","note":"","relation":{"type":"son|father|son_in_law|father_in_law|brother","name":"","address":""},"gabbai":{"name":"","phone":""}}',
    'Gabbai management (managing who may use this SMS line, NOT contacts): intent "gabbai_add" (add a gabbai: name + phone), "gabbai_remove", "gabbai_list", "gabbai_phone" (add a phone number to an existing gabbai). Use these only when the message clearly talks about gabbaim/גבאי/גבאים.',
    'find = just a name (maybe with address/phone) → is he on the list? add = new person ("new", "חדש", "נייע", "add"). fields = only what is given for add/update.',
    'other = donations, simchas, broadcasts, credits or anything that is not about the contacts list. Hebrew names in Hebrew letters, English in English; split US addresses; phones digits only. Never invent.',
  ].join('\n');
  return geminiJson(sys, [{ text: text }]);
}
function gwSplitAddr_(text) {
  try { return geminiJson('Split this US address into JSON {"address":"","city":"","state":"","zip":""}. Default city Brooklyn, state NY only if it is clearly a Brooklyn street. Return ONLY JSON.', [{ text: text }]); } catch (e) { return { address: text }; }
}
function gwSplitName_(text) {
  try { return geminiJson('Split this Jewish man\'s name into JSON {"first_name_he":"","last_name_he":"","first_name_en":"","last_name_en":""}. Fill only the script that was given (Hebrew letters → _he, English → _en). Return ONLY JSON.', [{ text: text }]); } catch (e) { return {}; }
}

// ---- JBD לפי בקשה ----
function gwJbd_(first, last) {
  const r = UrlFetchApp.fetch('https://thejbd.com/directory-search?q=' + encodeURIComponent((last + ' ' + String(first || '').split(/\s+/)[0]).trim()),
    { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return [];
  const out = [];
  (JSON.parse(r.getContentText()).data || []).filter(function (d) { return !d.business && jbdName_(d.lastName) === jbdName_(last) && (!first || jbdFirstOk_(first, d.firstName)); }).forEach(function (d) {
    (d.locations || []).forEach(function (l) {
      out.push({ name: [d.title, d.firstName, d.lastName].join(' ').replace(/\s+/g, ' ').trim() + (d.benReb ? ' (בן ר\' ' + d.benReb + ')' : ''), addr: l.fullAddress || ((l.addressFirst || '') + ', ' + (l.addressLast || '')), tel: l.telephone || '' });
    });
  });
  return out.slice(0, 5);
}

// ---- המוח ----
function gwHandle_(from, text, g) {
  const st = gwSt_(from);
  const lang = text && !/^\d+$/.test(text) ? langOf(text) : (st.lang || 'he');
  const L = st.lang || lang;
  const t = text.trim();
  const num = /^\d{1,2}$/.test(t) ? Number(t) : null;
  if (/^(0|תפריט|menu|סוף|end)$/i.test(t) && ['add_addr', 'add_ph', 'jbd_pick'].indexOf(st.step) < 0) { gwClr_(from); return st.step ? gt_('bye', L) : gt_('help', lang); }
  if (/^(\?|עזרה|help)$/i.test(t)) return gt_('help', lang);
  const put = function (o) { o.lang = o.lang || L; gwPut_(from, o); };
  const cid = st.cid;
  const c = cid ? byId(cid) : null;

  // --- שלבים שמחכים למספר ---
  if (num !== null) {
    if (st.step === 'pick') {
      const o = (st.opts || [])[num - 1];
      if (st.add && num === 9) return gwAddAsk_(from, st.add, L, put);
      if (o && o.k === 'c') { put({ step: 'card', cid: o.id }); return gwCard_(o.id, L); }
      if (o && o.k === 'm') { put({ step: 'mcard', mrow: o.row }); const m = gwMachsan_().filter(function (x) { return String(x._row) === String(o.row); })[0]; return m ? gwMCard_(m, L) : gt_('notFound', L); }
    }
    if (st.step === 'notfound') { if (num === 1) return gwAddAsk_(from, st.add || {}, L, put); gwClr_(from); return gt_('bye', L); }
    if (st.step === 'mcard' && num === 1) return gwMove_(from, st.mrow, g, L, put);
    if (st.step === 'card' && c) {
      if (num === 1) { put({ step: 'upd', cid: cid }); return gt_('upd', L); }
      if (num === 2) { put({ step: 'tagmode', cid: cid }); return gt_('tagMode', L); }
      if (num === 3) { put({ step: 'rel', cid: cid }); return gt_('rel', L); }
      if (num === 4) { put({ step: 'note', cid: cid }); return gt_('askNote', L); }
      if (num === 5) { put({ step: 'confirm', cid: cid, act: { a: 'delete' } }); return gt_('delQ', L, { n: heName(c) || enName(c) }) + '\n' + gt_('confirm', L); }
    }
    if (st.step === 'upd' && c) {
      if (num === 1) { put({ step: 'upd_addr', cid: cid }); return gt_('askAddr', L); }
      if (num === 2) { put({ step: 'phkind', cid: cid }); return gt_('phKind', L); }
      if (num === 3) { put({ step: 'upd_name', cid: cid }); return gt_('askName', L); }
    }
    if (st.step === 'phkind' && c && num >= 1 && num <= 3) { put({ step: 'upd_ph', cid: cid, kind: ['mobile', 'home_phone', 'wife_mobile'][num - 1] }); return gt_('askPh', L); }
    if (st.step === 'tagmode' && c) {
      if (num === 1) { put({ step: 'tag_name', cid: cid }); return gt_('askTag', L); }
      if (num === 2) {
        const T = gwTagNodes_();
        const mine = gwTagsOf_(c).filter(function (x) { return x.s !== 'auto' && (x.p || []).every(function (y) { return T.by[String(y)]; }); });
        if (!mine.length) { put({ step: 'card', cid: cid }); return gt_('noTags', L) + '\n\n' + gt_('menu', L); }
        put({ step: 'untag_pick', cid: cid, opts: mine.map(function (x) { return x.p.map(String); }) });
        return gt_('pick', L) + '\n' + mine.map(function (x, i) { return (i + 1) + '. ' + gwTagLabel_(T, x.p.map(String)); }).join('\n');
      }
    }
    if (st.step === 'tag_pick' && c && st.opts[num - 1]) { const T = gwTagNodes_(); const p = st.opts[num - 1]; put({ step: 'confirm', cid: cid, act: { a: 'tag', p: p } }); return '🏷 + ' + gwTagLabel_(T, p) + ' → ' + heName(c) + '\n' + gt_('confirm', L); }
    if (st.step === 'untag_pick' && c && st.opts[num - 1]) { const T = gwTagNodes_(); const p = st.opts[num - 1]; put({ step: 'confirm', cid: cid, act: { a: 'untag', p: p } }); return '🏷 − ' + gwTagLabel_(T, p) + ' ← ' + heName(c) + '\n' + gt_('confirm', L); }
    if (st.step === 'rel' && c) {
      if (num >= 1 && num <= 5) { put({ step: 'rel_who', cid: cid, rt: ['זון פון', 'טאטע פון', 'איידעם פון', 'שווער פון', 'ברודער פון'][num - 1] }); return gt_('relWho', L); }
      if (num === 6) {
        const mine = rels().filter(function (r) { return String(r.contact_id_a) === String(cid); });
        if (!mine.length) { put({ step: 'card', cid: cid }); return gt_('noRels', L) + '\n\n' + gt_('menu', L); }
        put({ step: 'unrel_pick', cid: cid, opts: mine.map(function (r) { return [String(r.contact_id_b), r.relation_type]; }) });
        return gt_('pick', L) + '\n' + mine.map(function (r, i) { const o = byId(r.contact_id_b); return (i + 1) + '. ' + (GW_REL[r.relation_type] || r.relation_type) + ' ' + (o ? heName(o) : '#' + r.contact_id_b); }).join('\n');
      }
    }
    if (st.step === 'rel_pick' && c && st.opts[num - 1]) { const o = byId(st.opts[num - 1]); put({ step: 'confirm', cid: cid, act: { a: 'rel', rt: st.rt, other: st.opts[num - 1] } }); return heName(c) + ' — ' + (GW_REL[st.rt] || st.rt) + ' ' + (o ? gwLine_(o) : '') + '\n' + gt_('confirm', L); }
    if (st.step === 'unrel_pick' && c && st.opts[num - 1]) { const x = st.opts[num - 1]; const o = byId(x[0]); put({ step: 'confirm', cid: cid, act: { a: 'unrel', other: x[0], rt: x[1] } }); return '✗ ' + heName(c) + ' — ' + (GW_REL[x[1]] || x[1]) + ' ' + (o ? heName(o) : '') + '\n' + gt_('confirm', L); }
    if (st.step === 'jbd_q') {
      if (num === 1) {
        const a = st.add; const res = gwJbd_(a.first_name_en, a.last_name_en);
        if (!res.length) return gwAddNext_(from, a, L, put, gt_('jbdNone', L) + '\n');
        put({ step: 'jbd_pick', add: a, opts: res });
        return gt_('jbdPick', L) + '\n' + res.map(function (x, i) { return (i + 1) + '. ' + x.name + ', ' + x.addr + (x.tel ? ', ' + x.tel : ''); }).join('\n');
      }
      st.add._noaddr = true; return gwAddNext_(from, st.add, L, put);
    }
    if (st.step === 'jbd_pick') {
      const a = st.add; const x = st.opts[num - 1];
      if (x) { const sp = gwSplitAddr_(x.addr); ['address', 'city', 'state', 'zip'].forEach(function (k) { if (sp[k]) a[k] = sp[k]; }); if (x.tel && !a.home_phone && !a.mobile) a.home_phone = x.tel; }
      else a._noaddr = true;
      return gwAddNext_(from, a, L, put);
    }
    if (st.step === 'confirm') {
      if (num === 1) { const r = gwExec_(st, g, L); const nid = r.id || cid; if (nid) { put({ step: 'card', cid: nid }); return r.msg + '\n\n' + gwCard_(nid, L); } gwClr_(from); return r.msg; }
      if (num === 2) { if (cid) { put({ step: 'card', cid: cid }); return gt_('canceled', L) + '\n\n' + gt_('menu', L); } gwClr_(from); return gt_('canceled', L); }
    }
  }

  // --- שלבים שמחכים לטקסט ---
  if (t && c) {
    if (st.step === 'upd_addr') { const f = gwSplitAddr_(t); put({ step: 'confirm', cid: cid, act: { a: 'upd', f: f } }); return heName(c) + ':\n' + fieldsLine(f) + '\n' + gt_('confirm', L); }
    if (st.step === 'upd_ph') { const d = last10(t); if (!d) return gt_('askPh', L); const f = {}; f[st.kind] = d; put({ step: 'confirm', cid: cid, act: { a: 'upd', f: f } }); return heName(c) + ': ' + fmtPhone(d) + '\n' + gt_('confirm', L); }
    if (st.step === 'upd_name') { const f = gwSplitName_(t); put({ step: 'confirm', cid: cid, act: { a: 'upd', f: f } }); return '#' + cid + ':\n' + fieldsLine(f) + '\n' + gt_('confirm', L); }
    if (st.step === 'note') { put({ step: 'confirm', cid: cid, act: { a: 'note', note: t.slice(0, 1000) } }); return '📝 ' + heName(c) + ': "' + t.slice(0, 300) + '"\n' + gt_('confirm', L); }
    if (st.step === 'tag_name') return gwTagSearch_(from, cid, t, L, put);
    if (st.step === 'rel_who') {
      const pr = (function () { try { return gwParse_(t); } catch (e) { return {}; } })();
      const w = pr.who || {}; const r = gwFind_({ name: w.name || t, address: w.address, phone: w.phone, he: w.he, en: w.en });
      const list = r.list.filter(function (x) { return String(x.contact_id) !== String(cid); });
      if (!list.length) { put({ step: 'card', cid: cid }); return gt_('notFound', L) + ' ' + t + '\n(להוסיף אותו קודם ואז לקשר)\n\n' + gt_('menu', L); }
      put({ step: 'rel_pick', cid: cid, rt: st.rt, opts: list.map(function (x) { return String(x.contact_id); }) });
      return gt_('pick', L) + '\n' + list.map(function (x, i) { return (i + 1) + '. ' + gwLine_(x); }).join('\n');
    }
  }
  if (t && (st.step === 'add_addr' || st.step === 'add_ph')) {
    const a = st.add;
    if (st.step === 'add_addr') { if (t === '0') { a._askJbd = true; } else { const sp = gwSplitAddr_(t); ['address', 'city', 'state', 'zip'].forEach(function (k) { if (sp[k]) a[k] = sp[k]; }); } }
    else { if (t === '0') a._noph = true; else { const d = last10(t); if (d) a.mobile = d; else return gt_('newPh', L); } }
    return gwAddNext_(from, a, L, put);
  }

  // --- הודעה חדשה (או טקסט חופשי כשאיש פתוח) ---
  const pr = gwParse_(t, c ? heName(c) || enName(c) : '');
  const lg = pr.lang || lang;
  const w = pr.who || {};
  if (pr.intent === 'other') return gt_('notAvail', lg);
  if (/^gabbai_/.test(pr.intent || '')) return gwGabbaiCmd_(from, pr, g, lg, put);
  if (pr.intent === 'add') {
    const f = pr.fields || {};
    if (!f.last_name_he && !f.last_name_en) return gt_('help', lg);
    const nm = [f.first_name_he, f.last_name_he].join(' ').trim() || [f.first_name_en, f.last_name_en].join(' ').trim();
    const r = gwFind_({ name: nm, phone: f.mobile || f.home_phone, address: f.address, he: w.he, en: w.en });
    if (r.list.length || r.mach.length) return gwPickList_(from, r, lg, put, f);
    return gwAddAsk_(from, f, lg, put);
  }
  // מי?
  let target = c && w.self ? c : null;
  if (!target) {
    const q = { name: w.name || (pr.intent === 'find' ? t : ''), address: w.address, phone: w.phone, he: w.he, en: w.en };
    if (!q.name && !q.phone) return gt_('help', lg);
    const r = gwFind_(q);
    if (pr.intent === 'find' || !r.list.length || r.list.length > 1) {
      if (!r.list.length && !r.mach.length) {
        const f = pr.fields || {}; const add = {};
        const nm = String(w.name || t).trim();
        if (/[א-ת]/.test(nm)) { const p = nm.split(/\s+/); add.last_name_he = p.pop(); add.first_name_he = p.join(' '); } else { const p = nm.split(/\s+/); add.last_name_en = p.pop(); add.first_name_en = p.join(' '); }
        if (w.en && w.en[0] && !add.last_name_en) { const p = String(w.en[0]).split(/\s+/); add.last_name_en = p.pop(); add.first_name_en = p.join(' '); }
        if (w.address) { const sp = gwSplitAddr_(w.address); Object.assign(add, sp); }
        if (w.phone) add.mobile = w.phone;
        Object.keys(f).forEach(function (k) { if (f[k] && !add[k]) add[k] = f[k]; });
        put({ step: 'notfound', add: add, lang: lg });
        return gt_('notFound', lg) + ' ' + nm + '\n' + gt_('addQ', lg);
      }
      if (r.list.length === 1 && !r.mach.length) { put({ step: 'card', cid: r.list[0].contact_id, lang: lg }); return gt_('inL', lg) + '\n' + gwCard_(r.list[0].contact_id, lg); }
      return gwPickList_(from, r, lg, put, null);
    }
    target = r.list[0];
  }
  const tid = String(target.contact_id);
  if (pr.intent === 'update') {
    const f = pr.fields || {};
    if (!Object.keys(f).some(function (k) { return String(f[k] || '').trim(); })) { put({ step: 'upd', cid: tid, lang: lg }); return heName(target) + '\n' + gt_('upd', lg); }
    put({ step: 'confirm', cid: tid, act: { a: 'upd', f: f }, lang: lg }); return gwLine_(target) + ':\n' + fieldsLine(f) + '\n' + gt_('confirm', lg);
  }
  if (pr.intent === 'tag' && pr.tag) return gwTagSearch_(from, tid, pr.tag, lg, put);
  if (pr.intent === 'note' && pr.note) { put({ step: 'confirm', cid: tid, act: { a: 'note', note: pr.note }, lang: lg }); return '📝 ' + heName(target) + ': "' + pr.note + '"\n' + gt_('confirm', lg); }
  if (pr.intent === 'delete') { put({ step: 'confirm', cid: tid, act: { a: 'delete' }, lang: lg }); return gt_('delQ', lg, { n: gwLine_(target) }) + '\n' + gt_('confirm', lg); }
  if (pr.intent === 'relation' && pr.relation && pr.relation.name) {
    const rt = { son: 'זון פון', father: 'טאטע פון', son_in_law: 'איידעם פון', father_in_law: 'שווער פון', brother: 'ברודער פון' }[pr.relation.type];
    if (rt) {
      const r2 = gwFind_({ name: pr.relation.name, address: pr.relation.address }).list.filter(function (x) { return String(x.contact_id) !== tid; });
      if (r2.length) { put({ step: 'rel_pick', cid: tid, rt: rt, opts: r2.map(function (x) { return String(x.contact_id); }), lang: lg }); return heName(target) + ' — ' + GW_REL[rt] + ':\n' + gt_('pick', lg) + '\n' + r2.map(function (x, i) { return (i + 1) + '. ' + gwLine_(x); }).join('\n'); }
    }
  }
  put({ step: 'card', cid: tid, lang: lg });
  return gwCard_(tid, lg);
}
function gwPickList_(from, r, lang, put, add) {
  const opts = r.list.map(function (c) { return { k: 'c', id: String(c.contact_id) }; }).concat(r.mach.map(function (m) { return { k: 'm', row: m._row }; }));
  put({ step: 'pick', opts: opts, add: add || null, lang: lang });
  const lines = r.list.map(function (c, i) { return (i + 1) + '. ' + gwLine_(c); }).concat(r.mach.map(function (m, i) { return (r.list.length + i + 1) + '. ' + gwMLine_(m); }));
  return (add ? gt_('dup', lang) : (r.list.length ? gt_('inL', lang) + ' (' + r.list.length + ')' : gt_('inM', lang)) + '\n' + gt_('pick', lang)) + '\n' + lines.join('\n');
}
function gwTagSearch_(from, cid, q, lang, put) {
  const T = gwTagNodes_(); const qn = norm(q);
  const hits = T.rows.filter(function (r) { return String(r.parent_id || '').trim() && String(r.name || '').trim() && (norm(r.name).indexOf(qn) >= 0 || qn.indexOf(norm(r.name)) >= 0); }).slice(0, 8);
  if (!hits.length) { put({ step: 'card', cid: cid, lang: lang }); return gt_('noTag', lang) + ' "' + q + '"\n\n' + gt_('menu', lang); }
  const opts = hits.map(function (r) { return gwTagPath_(T, r.node_id); });
  put({ step: 'tag_pick', cid: cid, opts: opts, lang: lang });
  return gt_('pick', lang) + '\n' + opts.map(function (p, i) { return (i + 1) + '. ' + gwTagLabel_(T, p); }).join('\n');
}
// ---- הוספה ----
function gwAddAsk_(from, a, lang, put) { return gwAddNext_(from, a || {}, lang, put); }
function gwAddNext_(from, a, lang, put, pre) {
  pre = pre || '';
  if (!a.address && !a._noaddr) {
    if (a._askJbd) {
      delete a._askJbd;
      if (!a.last_name_en) {
        try { const v = geminiJson('Write this Jewish name in English letters as JSON {"first":"","last":""}. Return ONLY JSON.', [{ text: [a.first_name_he, a.last_name_he].join(' ') }]); a.first_name_en = a.first_name_en || v.first; a.last_name_en = v.last; } catch (e) { /* */ }
      }
      if (a.last_name_en) { put({ step: 'jbd_q', add: a, lang: lang }); return pre + gt_('jbdQ', lang, { n: [a.first_name_en, a.last_name_en].join(' ').trim() }); }
      a._noaddr = true;
    } else { put({ step: 'add_addr', add: a, lang: lang }); return pre + gt_('newAddr', lang); }
  }
  if (!a.mobile && !a.home_phone && !a._noph) { put({ step: 'add_ph', add: a, lang: lang }); return pre + gt_('newPh', lang); }
  const show = {}; CFIELDS.concat(['mobile', 'home_phone']).forEach(function (k) { if (a[k]) show[k] = a[k]; });
  put({ step: 'confirm', act: { a: 'add', f: a }, lang: lang });
  return pre + (LBL.add_contact[lang] || LBL.add_contact.he) + ':\n' + fieldsLine(show) + '\n' + gt_('confirm', lang);
}
function gwMove_(from, row, g, lang, put) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const m = readTab('Machsan').rows.filter(function (x) { return String(x._row) === String(row); })[0];
    if (!m || String(m.contact_id || '').trim()) { gwClr_(from); return gt_('notFound', lang); }
    const ph = String(m.phones || '').split(/[,;]/).map(function (s) { return s.trim(); }).filter(String);
    const x = { first_name_en: m.first, last_name_en: m.last, last_name_he: m.last_he, address: m.address, city: m.city, state: m.state, zip: m.zip, home_phone: ph[0] || '' };
    const res = addContact(x, g, lang);
    const id = (res.match(/#(\d+)/) || [])[1];
    if (id) { setFields('Machsan', m._row, { contact_id: id, status: 'added', updated_at: stamp(), updated_by: g.email }); MACHSAN = null; }
    ev('action', { g: g, phone: from, contact_id: id || '', text: 'gw', detail: 'מחסן → רשימה' });
    if (!id) return res;
    put({ step: 'card', cid: id, lang: lang });
    return gt_('done', lang) + '\n\n' + gwCard_(id, lang);
  } finally { lock.releaseLock(); }
}
// ---- ביצוע (אחרי "1") ----
function gwExec_(st, g, lang) {
  const a = st.act || {}; const id = st.cid;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    CONTACTS = null; PHONES = null; RELS = null;
    if (a.a === 'add') {
      const f = a.f || {};
      const res = addContact(f, g, lang);
      const nid = (res.match(/#(\d+)/) || [])[1];
      const miss = []; if (!f.address) miss.push('כתובת'); if (!f.mobile && !f.home_phone) miss.push('טלפון');
      if (nid && miss.length) generalTask('⚠ להשלים ' + miss.join(' ו') + ' ל' + ([f.first_name_he, f.last_name_he].join(' ').trim() || [f.first_name_en, f.last_name_en].join(' ').trim()) + ' (#' + nid + ') — נוסף ב-SMS ע"י ' + g.name, nid);
      ev('action', { g: g, phone: '', contact_id: nid || '', text: 'gw', detail: 'הוספה' + (miss.length ? ' (חסר ' + miss.join(', ') + ')' : '') });
      return { msg: res, id: nid };
    }
    if (/^g_/.test(a.a || '')) return { msg: gwGabbaiExec_(a, g, lang) };
    const c = byId(id); if (!c) return { msg: gt_('notFound', lang) };
    if (a.a === 'upd') {
      const f = Object.assign({}, a.f || {});
      if (f.wife_mobile) {
        const pt = readTab('Phones'); const p = pt.rows.filter(function (r) { return String(r.contact_id) === String(id); })[0];
        history(g.email, 'phones', id, id, 'wife_mobile', p ? p.wife_mobile : '', fmtPhone(f.wife_mobile));
        if (p) setFields('Phones', p._row, { wife_mobile: fmtPhone(f.wife_mobile) }); else appendObj('Phones', { contact_id: id, wife_mobile: fmtPhone(f.wife_mobile) });
        delete f.wife_mobile;
      }
      updateContact(id, f, g, lang);
      ev('action', { g: g, contact_id: id, text: 'gw', detail: 'עדכון ' + Object.keys(a.f || {}).join(',') });
      return { msg: gt_('done', lang), id: id };
    }
    if (a.a === 'note') { addNote(id, a.note, g, lang); return { msg: gt_('done', lang), id: id }; }
    if (a.a === 'delete') {
      setFields('Contacts', c._row, { deleted_at: stamp(), deleted_by: g.email });
      history(g.email, 'contact', id, id, 'deleted_at', '', stamp() + ' (SMS)');
      ev('action', { g: g, contact_id: id, text: 'gw', detail: 'מחיקה' });
      return { msg: gt_('done', lang) + ' ✗ ' + heName(c) };
    }
    if (a.a === 'tag' || a.a === 'untag') {
      const list = gwTagsOf_(c); const key = a.p.join('>');
      const old = JSON.stringify(list);
      let out = list.filter(function (x) { return (x.p || []).map(String).join('>') !== key; });
      if (a.a === 'tag') out.push({ p: a.p, s: 'a', d: today() });
      setFields('Contacts', c._row, { tags: JSON.stringify(out), updated_at: stamp(), updated_by: g.email });
      history(g.email, 'contact', id, id, 'tags', old, JSON.stringify(out));
      ev('action', { g: g, contact_id: id, text: 'gw', detail: (a.a === 'tag' ? 'תיוג + ' : 'תיוג − ') + key });
      return { msg: gt_('done', lang), id: id };
    }
    if (a.a === 'rel' || a.a === 'unrel') {
      const INV = { 'זון פון': 'טאטע פון', 'טאטע פון': 'זון פון', 'איידעם פון': 'שווער פון', 'שווער פון': 'איידעם פון', 'ברודער פון': 'ברודער פון', 'שוואגער פון': 'שוואגער פון', 'זיידע פון': 'אייניקל פון', 'אייניקל פון': 'זיידע פון' };
      const sh = sheetOf('Relations');
      if (a.a === 'rel') {
        const n = nextId('Relations', 1);
        sh.appendRow([n, Number(id), a.rt, Number(a.other)]);
        sh.appendRow([n + 1, Number(a.other), INV[a.rt] || a.rt, Number(id)]);
      } else {
        const t = readTab('Relations');
        const rows = t.rows.filter(function (r) {
          return (String(r.contact_id_a) === String(id) && String(r.contact_id_b) === String(a.other) && r.relation_type === a.rt)
            || (String(r.contact_id_a) === String(a.other) && String(r.contact_id_b) === String(id) && r.relation_type === (INV[a.rt] || a.rt));
        }).map(function (r) { return r._row; }).sort(function (x, y) { return y - x; });
        rows.forEach(function (rw) { sh.deleteRow(rw); });
      }
      history(g.email, 'relation', id, id, a.rt, a.a === 'rel' ? '' : String(a.other), a.a === 'rel' ? String(a.other) : '');
      ev('action', { g: g, contact_id: id, text: 'gw', detail: (a.a === 'rel' ? 'קשר + ' : 'קשר − ') + a.rt + ' ' + a.other });
      return { msg: gt_('done', lang), id: id };
    }
    return { msg: gt_('notAvail', lang) };
  } finally { lock.releaseLock(); }
}

// ---- 👤 מנהלי קו: הוספה / הסרה של גבאים ב-SMS (עמודה sms_admin בהגדרות) ----
//   גבאי שנוסף ב-SMS נשמר בלשונית SmsGabbaim בלבד — לא באתר. גבאי מהאתר מוסרים רק באתר.
function gwGabbaiRows_() {
  const out = [];
  readTab('Settings').rows.forEach(function (r) {
    if (String(r.gabbai_name || '').trim() || String(r.gabbai_email || '').trim()) out.push({ src: 'site', row: r._row, name: r.gabbai_name || r.gabbai_email, email: r.gabbai_email || '', phone: r.gabbai_phone || '', admin: isT(r.sms_admin) });
  });
  readTab('SmsGabbaim').rows.forEach(function (r) {
    if (String(r.name || '').trim()) out.push({ src: 'sms', row: r._row, name: r.name, email: '', phone: r.phone || '', admin: false });
  });
  return out;
}
function gwGabbaiFind_(q) {
  const qd = last10(q.phone || q.name || ''); const qn = norm(q.name || '');
  return gwGabbaiRows_().filter(function (r) {
    if (qd && String(r.phone || '').split(/[,;\/]/).map(last10).indexOf(qd) >= 0) return true;
    if (!qn) return false;
    const n = norm(r.name);
    return qn.split(' ').filter(function (w) { return w && TITLES.indexOf(w) < 0 && !/\d/.test(w); }).every(function (w) { return n.indexOf(w) >= 0; });
  });
}
function gwGabbaiCmd_(from, pr, g, lang, put) {
  if (!g.smsAdmin) return gt_('notAvail', lang);
  const q = pr.gabbai || {};
  if (pr.intent === 'gabbai_list') {
    gwClr_(from);
    return gwGabbaiRows_().map(function (r, i) {
      return (i + 1) + '. ' + (r.src === 'site' ? '🌐 ' : '📱 ') + r.name + (r.phone ? ' · ' + String(r.phone).split(/[,;\/]/).map(fmtPhone).join(', ') : ' · (אין טלפון)') + (r.admin ? ' 👤' : '');
    }).join('\n') + '\n\n🌐 = מהאתר · 📱 = רק לקו · 👤 = מנהל קו';
  }
  if (pr.intent === 'gabbai_add') {
    const d = last10(q.phone);
    if (!q.name || !d) return 'צריך שם ומספר טלפון. לדוגמה: גבאי חדש: משה כ"ץ 718-555-1234';
    if (gabbaiByPhone(d)) return 'המספר ' + fmtPhone(d) + ' כבר רשום כגבאי.';
    put({ step: 'confirm', act: { a: 'g_add', name: q.name, phone: d }, lang: lang });
    return 'להוסיף גבאי לקו (לא לאתר): ' + q.name + ' · ' + fmtPhone(d) + '\n' + gt_('confirm', lang);
  }
  const m = gwGabbaiFind_(q);
  if (!m.length) return 'לא נמצא גבאי: ' + (q.name || q.phone || '');
  if (m.length > 1) return 'יש כמה גבאים כאלה, כתבו שם מלא:\n' + m.map(function (r) { return '· ' + r.name; }).join('\n');
  const r = m[0];
  if (pr.intent === 'gabbai_remove') {
    if (r.src === 'site') return r.name + ' רשום באתר — מסירים אותו רק באתר.';
    put({ step: 'confirm', act: { a: 'g_remove', name: r.name, phone: r.phone }, lang: lang });
    return 'להסיר את ' + r.name + ' מהקו?\n' + gt_('confirm', lang);
  }
  if (pr.intent === 'gabbai_phone') {
    const d = last10(q.phone);
    if (!d) return 'איזה מספר להוסיף?';
    if (gabbaiByPhone(d)) return 'המספר ' + fmtPhone(d) + ' כבר רשום.';
    put({ step: 'confirm', act: { a: 'g_phone', src: r.src, name: r.name, old: r.phone, phone: d }, lang: lang });
    return 'להוסיף ל' + r.name + ' את המספר ' + fmtPhone(d) + '\n' + gt_('confirm', lang);
  }
  return gt_('notAvail', lang);
}
/** מוצא שורה מחדש לפי שם+טלפון (השורות יכולות לזוז בין האישור לביצוע) */
function gwGabbaiRowNow_(src, name, phone) {
  return gwGabbaiRows_().filter(function (r) { return r.src === src && r.name === name && String(r.phone || '') === String(phone || ''); })[0] || null;
}
function gwGabbaiExec_(a, g, lang) {
  if (!g.smsAdmin) return gt_('notAvail', lang);
  if (a.a === 'g_add') {
    if (gabbaiByPhone(a.phone)) return 'המספר כבר רשום.';
    appendObj('SmsGabbaim', { name: a.name, phone: fmtPhone(a.phone), added_by: g.name, added_at: stamp() });
    notifyAdmins('sms_gabbai', 'SMS: גבאי חדש לקו', g.name + ' הוסיף גבאי לקו ה-SMS: ' + a.name + ' · ' + fmtPhone(a.phone));
    ev('action', { g: g, text: 'gw', detail: 'גבאי + ' + a.name + ' ' + fmtPhone(a.phone) });
    return gt_('done', lang) + ' ' + a.name + ' יכול לעבוד עכשיו בקו.';
  }
  if (a.a === 'g_remove') {
    const r = gwGabbaiRowNow_('sms', a.name, a.phone);
    if (!r) return 'לא נמצא (אולי כבר הוסר).';
    sheetOf('SmsGabbaim').deleteRow(r.row);
    notifyAdmins('sms_gabbai', 'SMS: הוסר גבאי מהקו', g.name + ' הסיר מקו ה-SMS: ' + a.name);
    ev('action', { g: g, text: 'gw', detail: 'גבאי − ' + a.name });
    return gt_('done', lang) + ' ' + a.name + ' הוסר מהקו.';
  }
  if (a.a === 'g_phone') {
    const r = gwGabbaiRowNow_(a.src, a.name, a.old);
    if (!r) return 'לא נמצא.';
    const val = (String(r.phone || '').trim() ? String(r.phone).trim() + ', ' : '') + fmtPhone(a.phone);
    if (a.src === 'site') setFields('Settings', r.row, { gabbai_phone: val }); else setFields('SmsGabbaim', r.row, { phone: val });
    notifyAdmins('sms_gabbai', 'SMS: מספר לגבאי', g.name + ' הוסיף ל' + a.name + ' את המספר ' + fmtPhone(a.phone));
    ev('action', { g: g, text: 'gw', detail: 'גבאי טלפון ' + a.name + ' ' + fmtPhone(a.phone) });
    return gt_('done', lang);
  }
  return gt_('notAvail', lang);
}

/** בדיקה מרחוק: מצב הטלפון בשרת של SMSGate (מתי נראה לאחרונה וכו') + ה-webhooks */
function gwStatus() {
  const H = { Authorization: gwAuth_() };
  const d = UrlFetchApp.fetch(GW_API + '/devices', { headers: H, muteHttpExceptions: true });
  Logger.log('devices: ' + d.getResponseCode() + ' ' + d.getContentText().slice(0, 1500));
  const w = UrlFetchApp.fetch(GW_API + '/webhooks', { headers: H, muteHttpExceptions: true });
  Logger.log('webhooks: ' + w.getContentText().replace(/k=[0-9a-f]+/g, 'k=***').slice(0, 800));
}
