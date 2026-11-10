/**
 * מוסדות אונגוואר — דער "שומר" פאר די אתרים פון די מוסדות (למשל ישיבת בית שערים: ungvar.org/yeshiva).
 * לויפט אין חשבון "דאטאבייס" (Execute as: Me, Who has access: Anyone).
 *
 * די צוות פון א מוסד באקומען נישט קיין צוטריט צום גיליון. דער אתר שיקט זיין גוגל-טאקען, און דא:
 *  - מ'קוקט ווער ער איז (tokeninfo) און וואס ער מעג (לשונית Staff אינעם גיליון פונעם מוסד);
 *  - מ'גיט צוריק נאר די מענטשן וואס געהערן צום מוסד (לשונית People), און נאר די פעלדער וואס זיי דארפן;
 *  - ענדערונגען אין קאנטאקטן גייען גלייך אריין אין דעם הויפט-גיליון (מיט היסטאריע: "by email @mosad");
 *  - אויסמעקן א מענטש = ארויס פונעם מוסד + א בקשה (Requests) פאר דעם מנהל פונעם הויפט-אתר.
 *
 * הויפט-גיליון → לשונית Mosdos: key | name | org | sheet_id | owner_email
 *   (sheet_id ליידיג = דער שומר מאכט אליין א נייעם גיליון פאר דעם מוסד, אין דרייב פונעם דאטאבייס)
 */
const MAIN_ID = '16gyhQ4W7p2DHjPMtdXldFynG1KUzDypGvTvYlS7cnJY';
const CLIENT_ID = '73541082309-bb0bc3jv1dchtpgsr129m5bbertk79ua.apps.googleusercontent.com';
const FIRST_CONTACT_ID = 2001;
// יעדער כפתור אויפן ערשטן בלאט איז א הרשאה; people_edit = צולייגן / טוישן אנשי קשר (שרייבט אינעם הויפט-מאגר)
const PERMS = ['students', 'alumni', 'staff_list', 'tuition', 'insurance', 'parents', 'chavrusas', 'attendance', 'donations', 'finance', 'people_edit', 'dorm', 'dorm_att', 'stipends', 'kitchen', 'manager', 'salary', 'shabbos', 'simchos', 'budget'];
// 👑 מנהל מוסד / טכני: משכורות (salary), שכר לימוד (tuition), נדבות וקבלות (donations) — נאר מיט דער הרשאה (אדמין / בעלים: אלעס)
const MGR_PERMS = ['tuition', 'donations', 'salary'];
// וואס דער מוסד מעג זען / טוישן אין א קאנטאקט
const C_FIELDS = ['title_he', 'first_name_he', 'last_name_he', 'title_en', 'first_name_en', 'last_name_en', 'legal_first_name',
  'marital_status', 'wife_name_he', 'wife_name_en', 'address', 'city', 'state', 'zip', 'country', 'is_alive'];
const P_FIELDS = ['mobile', 'home_phone', 'email_1'];
const TABS = {
  Staff: ['email', 'name', 'role', 'perms', 'active', 'added_by', 'added_at', 'updated_by', 'updated_at'],
  People: ['contact_id', 'kind', 'status', 'added_by', 'added_at', 'removed_by', 'removed_at', 'note', 'il_phone', 'abroad_phone'],
  Log: ['at', 'by', 'action', 'contact_id', 'detail', 'entity', 'entity_id', 'changes'],
  Enrollments: ['enroll_id', 'contact_id', 'parent_id', 'status', 'start_date', 'end_date', 'zman', 'shiur', 'room', 'tuition_amount', 'tuition_period', 'month_amounts', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Tuition: ['payment_id', 'enroll_id', 'contact_id', 'payer_id', 'date', 'amount', 'method', 'check_number', 'card_last4', 'for_text', 'receipt_no', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Gifts: ['gift_id', 'donor_name', 'date', 'currency', 'amount_orig', 'fx_rate', 'amount_usd', 'payment_method', 'check_number', 'card_last4', 'dedication_type', 'dedication_text', 'note', 'il_receipt_no', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Settings: ['key', 'value', 'updated_at', 'updated_by'],
  Chavrusas: ['zman', 'seder', 'contact_id', 'partner_id', 'partner_text', 'updated_at', 'updated_by'],
  Attendance: ['week', 'seder', 'contact_id', 'marks', 'note', 'updated_at', 'updated_by'],
  Hours: ['date', 'contact_id', 'time_in', 'time_out', 'note', 'updated_at', 'updated_by'],
  Insurance: ['contact_id', 'kupah', 'member_no', 'company', 'policy_no', 'expires', 'passport', 'debt', 'left_date', 'status', 'note', 'updated_at', 'updated_by'],
  Team: ['contact_id', 'email', 'role', 'start_date', 'end_date', 'active', 'pay_type', 'schedule', 'note', 'updated_at', 'updated_by', 'pay_via'], // pay_via: us = דורך אונז, parents = גלייך פון די עלטערן (אברכים)
  PayInfo: ['contact_id', 'id_number', 'bank_last4', 'global_amount', 'hourly_rate', 'note', 'updated_at', 'updated_by'],
  PayItems: ['item_id', 'contact_id', 'month', 'kind', 'amount', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  PayPayments: ['pay_id', 'contact_id', 'date', 'amount', 'method', 'advance', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Expenses: ['exp_id', 'date', 'amount', 'currency', 'category', 'paid_to', 'charged_type', 'charged_to', 'charged_id', 'is_paid', 'paid_by', 'paid_by_id', 'method', 'note', 'receipt_file', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Incomes: ['inc_id', 'date', 'amount', 'currency', 'category', 'source', 'source_id', 'is_loan', 'method', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Debts: ['debt_id', 'date', 'direction', 'person', 'person_id', 'amount', 'currency', 'reason', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Repayments: ['rep_id', 'debt_key', 'date', 'amount', 'currency', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Tasks: ['task_id', 'text', 'assigned_to', 'from_email', 'due', 'urgent', 'status', 'contact_id', 'done_at', 'done_by', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Receipts: ['receipt_no', 'payment_id', 'contact_id', 'payer_id', 'amount', 'issued_at', 'issued_by', 'void', 'void_by', 'void_at', 'note'],
  // 🍳 מלאי המטבח
  Kitchen: ['product_id', 'product_name', 'category', 'current_stock', 'unit', 'min_threshold', 'lead_time_days', 'daily_use', 'expiry_date', 'supplier_name', 'unit_price', 'recurring_day', 'standard_qty', 'note', 'updated_at', 'updated_by', 'pack_size', 'frozen'],
  KitchenOrders: ['order_id', 'date', 'supplier', 'items', 'total', 'status', 'note', 'created_at', 'created_by'],
  KitchenEvents: ['event_id', 'name', 'date', 'items', 'note', 'updated_at', 'updated_by'],
  KitchenRequests: ['req_id', 'type', 'product_id', 'data', 'note', 'by', 'at', 'status', 'decided_by', 'decided_at'],
};
const K_NUM = { current_stock: 1, min_threshold: 1, lead_time_days: 1, daily_use: 1, unit_price: 1, standard_qty: 1, pack_size: 1 };
// א דאטום פון גיליון (Date) → 'yyyy-MM-dd' (מיט צייט ווען ס'איז דא)
let TZ = '';
function cell(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (!TZ) TZ = main().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
    const tz = TZ;
    const hm = Utilities.formatDate(v, tz, 'HH:mm');
    return Utilities.formatDate(v, tz, hm === '00:00' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm');
  }
  return v;
}

// גרויסע ווערטן אין cache (צעטיילט אויף שטיקלעך פון 90KB)
function cachePut(key, obj, sec) {
  try {
    const t = JSON.stringify(obj);
    const n = Math.ceil(t.length / 90000);
    if (n > 20) return;
    const m = { };
    m[key] = String(n);
    for (let i = 0; i < n; i++) m[key + ':' + i] = t.slice(i * 90000, (i + 1) * 90000);
    CacheService.getScriptCache().putAll(m, sec);
  } catch (err) { /* */ }
}
function cacheGet(key) {
  try {
    const c = CacheService.getScriptCache();
    const n = Number(c.get(key));
    if (!n) return null;
    const keys = [];
    for (let i = 0; i < n; i++) keys.push(key + ':' + i);
    const parts = c.getAll(keys);
    let t = '';
    for (let i = 0; i < n; i++) { if (parts[keys[i]] == null) return null; t += parts[keys[i]]; }
    return JSON.parse(t);
  } catch (err) { return null; }
}
// ---------- א קאפיע (מירור) פון די שווערע רשימות, אין א באהאלטענער לשונית "Cache" אינעם גיליון פונעם מוסד ----------
// גוגל'ס cache פארגעסט נאך עטלעכע שעה; די קאפיע בלייבט. זי גילט נאר ווען דער הויפט-גיליון איז נישט געטוישט געווארן זינט דעמאלט.
let MAIN_UPD = null;
function mainUpdated() {
  if (MAIN_UPD === null) { try { MAIN_UPD = DriveApp.getFileById(MAIN_ID).getLastUpdated().getTime(); } catch (err) { MAIN_UPD = Date.now(); } }
  return MAIN_UPD;
}
function mirrorSheet(M, make) {
  let sh = M.book.getSheetByName('Cache');
  if (!sh && make) { sh = M.book.insertSheet('Cache'); try { sh.hideSheet(); } catch (err) { /* */ } }
  return sh;
}
let MIRROR = null; // די שורות פון "Cache" — איינמאל פער קריאה
function mirrorRows(M) {
  if (MIRROR) return MIRROR;
  const sh = mirrorSheet(M, false);
  MIRROR = sh && sh.getLastRow() ? sh.getDataRange().getValues() : [];
  return MIRROR;
}
/** prune = אויסמעקן אנדערע שורות מיט דעם אנהייב (אלטע ווערסיעס) */
function store(M, key, obj, prune) {
  cachePut(key, obj, LONG);
  try {
    const t = JSON.stringify(obj);
    const parts = [];
    for (let i = 0; i < t.length; i += 45000) parts.push(t.slice(i, i + 45000));
    if (parts.length > 40) return;
    const sh = mirrorSheet(M, true);
    let n = sh.getLastRow();
    if (prune && n) {
      const ks0 = sh.getRange(1, 1, n, 1).getValues();
      for (let i = ks0.length - 1; i >= 0; i--) { const k = String(ks0[i][0]); if (k !== key && k.indexOf(prune) === 0) sh.deleteRow(i + 1); }
      n = sh.getLastRow();
    }
    const keys = n ? sh.getRange(1, 1, n, 1).getValues().map(function (x) { return String(x[0]); }) : [];
    const r = keys.indexOf(key) >= 0 ? keys.indexOf(key) + 1 : n + 1;
    const w = Math.max(sh.getLastColumn(), parts.length + 2);
    if (r <= n) sh.getRange(r, 1, 1, w).clearContent();
    sh.getRange(r, 1, 1, parts.length + 2).setValues([[key, Date.now()].concat(parts)]);
    MIRROR = null;
  } catch (err) { /* נישט קריטיש */ }
}
function load(M, key) {
  const hit = cacheGet(key);
  if (hit) return hit;
  try {
    const row = mirrorRows(M).filter(function (x) { return String(x[0]) === key; })[0];
    if (!row || !Number(row[1]) || Number(row[1]) < mainUpdated()) return null;
    const obj = JSON.parse(row.slice(2).join(''));
    cachePut(key, obj, LONG);
    return obj;
  } catch (err) { return null; }
}
function unstore(M, keys) {
  CacheService.getScriptCache().removeAll(keys);
  try {
    const sh = mirrorSheet(M, false);
    if (!sh || !sh.getLastRow()) return;
    sh.getRange(1, 1, sh.getLastRow(), 1).getValues().forEach(function (x, i) { if (keys.indexOf(String(x[0])) >= 0) sh.getRange(i + 1, 2).setValue(0); });
    MIRROR = null;
  } catch (err) { /* */ }
}

// נאך וועלכע אקציעס — פאר וועמען — מ'דערהיינטיגט די תגיות פון דער ישיבה אינעם הויפט-מאגר
const Y_SYNC = {
  enrollSave: function (req) { const e = req.enroll || {}; return [e.contact_id, e.parent_id, req._cid, req._pid, req._pid2].filter(Boolean); },
  enrollDelete: function (req) { return [req._cid, req._pid].filter(Boolean); },
  link: function (req) { return [req.contact_id]; },
  unlink: function (req) { return [req.contact_id]; },
  remove: function (req) { return [req.contact_id]; },
  teamSave: function (req) { return [(req.team || {}).contact_id]; },
};
// וועלכע שרייבונגען טוישן וואס (כדי נישט אויסמעקן אומזיסט)
const PPL_ACTS = { save: 1, link: 1, unlink: 1, remove: 1, ilPhone: 1, enrollSave: 1, enrollDelete: 1, giftSave: 1, backupRestore: 1 };
const NAMES_ACTS = { save: 1, giftSave: 1, backupRestore: 1 };
const DON_ACTS = { giftSave: 1, giftDelete: 1, giftReceipt: 1, receipt: 1, receiptVoid: 1, backupRestore: 1 };
const LONG = 10800; // 3 שעות — מ'מעקט אויס ביי יעדער ענדערונג (אויך פונעם הויפט-אתר: "touch")
/** א "דור" פאר דעם מוסד (פערמאנענט, אין ScriptProperties): יעדע שרייבונג → א נייער דור → די אלטע קאפיעס גילטן מער נישט */
let GEN = {};
function genOf(M) {
  if (!GEN[M.key]) GEN[M.key] = PropertiesService.getScriptProperties().getProperty('gen:' + M.key) || '0';
  return GEN[M.key];
}
function dropCaches(M, ppl, names, don) {
  GEN[M.key] = String(Date.now());
  try { PropertiesService.getScriptProperties().setProperty('gen:' + M.key, GEN[M.key]); } catch (err) { /* */ }
  const ks = [];
  if (ppl) ks.push('ppl:' + M.key);
  if (names) ks.push('names:main');
  if (don) ks.push('don:' + M.key);
  if (ks.length) unstore(M, ks);
}
// אקציעס וואס לייענען נאר; יעדע אנדערע (א שרייבונג) מעקט אויס דעם cache פון די מענטשן
const READS = { budgetGet: 1, ask: 1, kitchen: 1, dormImg: 1, batch: 1, me: 1, people: 1, find: 1, school: 1, whereIs: 1, gifts: 1, chav: 1, att: 1, hours: 1, ins: 1, team: 1, clock: 0, users: 1, tasks: 1, log: 1, history: 1, fin: 1, fileGet: 1, backups: 1, staff: 1, assetGet: 1 };

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'brand') return out(brandOf(req.mosad)); // פארן לאגאין: נאר נאמען + לאגא
    if (req.action === 'webSignup') return out(webSignup_(req)); // 🌐 ungvar.org: הרשמה ל-SMS (בלי כניסה)
    if (req.action === 'webBooks') return out(webBooks_()); // 🌐 ungvar.org: ספרים ומחירים (בלי כניסה)
    if (req.action === 'webCampaign') return out(webCampaign_(req)); // 🌐 ungvar.org: דף קמפיין (בלי כניסה)
    if (req.action === 'webDonate') return out(webDonate_(req)); // 🌐 ungvar.org: תרומה בכרטיס דרך Sola (בלי כניסה)
    if (KPUB[req.action]) { const KM = mosadOf(req.mosad); if (!KM) return out({ error: 'no-mosad' }); return out(KPUB[req.action](KM, req)); } // 🍳 דף המטבח (סיסמה, אן גוגל)
    if (PUBLIC[req.action]) { const PM = mosadOf(req.mosad); if (!PM) return out({ error: 'no-mosad' }); return out(PUBLIC[req.action](PM, req)); } // דער טופס רישום (אן לאגאין)
    const email = whoIs(req.token);
    if (!email) return out({ error: 'not-signed-in' });
    if (req.action === 'wcTranslate') return out(wcTranslate_(req)); // 🌐 אשף דף הקמפיין: תרגום עברית → אידיש/אנגלית
    if (req.action === 'touch') return out(touchAll()); // דער הויפט-אתר האט געשריבן — פריש לאדן
    const M = mosadOf(req.mosad);
    if (!M) return out({ error: 'no-mosad' });
    const me = roleOf(M, email);
    if (!me) return out({ error: 'not-allowed', email: email });
    CUR = { M: M, me: me };
    const fn = ACTIONS[req.action];
    if (!fn) return out({ error: 'bad-action' });
    if (req.fresh) dropCaches(M, true, true, true);
    const res = fn(M, me, req);
    if (!READS[req.action]) dropCaches(M, PPL_ACTS[req.action], NAMES_ACTS[req.action], DON_ACTS[req.action]);
    // די תגיות פון דער ישיבה אינעם הויפט-מאגר (תלמיד / הורה / צוות — פעיל / יוצא)
    if (Y_SYNC[req.action]) { try { syncYeshivaTags(M, Y_SYNC[req.action](req), me.email); } catch (err) { /* נישט שטערן די אקציע */ } }
    return out(res);
  } catch (err) {
    return out({ error: String((err && err.message) || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- ווער איז עס ----------
function whoIs(token) {
  if (!token) return '';
  const cache = CacheService.getScriptCache();
  const key = 'mt:' + String(token).slice(-32);
  const hit = cache.get(key);
  if (hit) return hit;
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return '';
  const info = JSON.parse(r.getContentText());
  // נאר א טאקען וואס איז געמאכט געווארן פאר אונזער אתר
  if (String(info.aud || info.azp || '') !== CLIENT_ID) return '';
  if (String(info.email_verified) === 'false') return '';
  const email = String(info.email || '').toLowerCase();
  if (email) cache.put(key, email, 1500);
  return email;
}

// ---------- גיליונות ----------
let MAIN_SS = null;
function main() { return MAIN_SS || (MAIN_SS = SpreadsheetApp.openById(MAIN_ID)); }
let MEMO = null; // בשעת "batch" (נאר לייענען): יעדע לשונית ווערט געלייענט נאר איין מאל
function rows(sheet) {
  if (!sheet) return { head: [], body: [] };
  let mk = '';
  if (MEMO) { mk = sheet.getParent().getId() + '/' + sheet.getName(); if (MEMO[mk]) return MEMO[mk]; }
  const v = sheet.getDataRange().getValues();
  const head = (v[0] || []).map(function (x) { return String(x).trim(); });
  const out = { head: head, body: v.slice(1) };
  if (MEMO) MEMO[mk] = out;
  return out;
}
function objs(sheet) {
  const r = rows(sheet);
  return r.body.map(function (row, i) {
    const o = { _row: i + 2 };
    r.head.forEach(function (h, j) { if (h) o[h] = cell(row[j]); });
    return o;
  });
}
/** גיך: לייענט נאר דעם שטח צווישן די נויטיגע קאלאנעס (נישט אלע 40+) */
function objsCols(sheet, names) {
  if (!sheet) return [];
  const head = headOf(sheet);
  const idx = names.map(function (n) { return head.indexOf(n); }).filter(function (i) { return i >= 0; });
  const n = sheet.getLastRow() - 1;
  if (!idx.length || n < 1) return [];
  const lo = Math.min.apply(null, idx), hi = Math.max.apply(null, idx);
  const v = sheet.getRange(2, lo + 1, n, hi - lo + 1).getValues();
  return v.map(function (row, r) {
    const o = { _row: r + 2 };
    names.forEach(function (nm) { const j = head.indexOf(nm); if (j >= 0) o[nm] = cell(row[j - lo]); });
    return o;
  });
}
function headOf(sh) {
  const n = sh.getLastColumn();
  return n ? sh.getRange(1, 1, 1, n).getValues()[0].map(function (x) { return String(x).trim(); }) : [];
}
function ensureTab(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); return sh; }
  // א פעלנדע קאלאנע → צולייגן אין סוף (נאר די ערשטע שורה ווערט געלייענט)
  const cur = headOf(sh);
  const add = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (add.length) sh.getRange(1, cur.length + 1, 1, add.length).setValues([add]);
  return sh;
}
// ---------- יומן פעולות: יעדע שרייבונג ווערט פארשריבן (ווער, ווען, פריער → יעצט) ----------
let CUR = null; // { M, me } — פון doPost
const NO_AUDIT = { Log: true, History: true };
const BIG = { logo: true, logo_data: true, photo_data: true, data: true };
function entityOf(sheet) {
  let pre = '';
  try { pre = sheet.getParent().getId() === MAIN_ID ? 'main.' : ''; } catch (err) { pre = ''; }
  return pre + sheet.getName();
}
function audit(sheet, action, id, cid, changes) {
  if (!CUR || NO_AUDIT[sheet.getName()]) return;
  try {
    const lg = CUR.M.book.getSheetByName('Log');
    const head = headOf(lg);
    const o = { at: now(), by: CUR.me.email, action: action, contact_id: cid || '', entity: entityOf(sheet), entity_id: S(id), changes: JSON.stringify(changes).slice(0, 45000) };
    lg.appendRow(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
  } catch (err) { /* דאס יומן זאל נישט שטערן */ }
}
const clean = function (v) { const x = cell(v); return S(x).replace(/^'/, ''); };
function appendObj(sheet, o) {
  const head = headOf(sheet);
  sheet.appendRow(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
  const snap = {};
  head.forEach(function (h) { if (o[h] !== undefined && S(o[h]) !== '' && !BIG[h] && ['created_at', 'created_by', 'updated_at', 'updated_by'].indexOf(h) < 0) snap[h] = S(o[h]).replace(/^'/, '').slice(0, 300); });
  audit(sheet, 'create', o[head[0]], o.contact_id, snap);
}
/** טוישן א שורה: אלע ווערטן אויף איינמאל, און אין יומן — וואס האט זיך געטוישט */
function setCells(sheet, rowNo, o) {
  const head = headOf(sheet);
  const rng = sheet.getRange(rowNo, 1, 1, head.length);
  const row = rng.getValues()[0];
  const changes = [];
  const next = row.slice();
  Object.keys(o).forEach(function (k) {
    const j = head.indexOf(k);
    if (j < 0) return;
    const before = clean(row[j]); const after = S(o[k]).replace(/^'/, '');
    if (before !== after && ['updated_at', 'updated_by'].indexOf(k) < 0) changes.push([k, BIG[k] ? '…' : before.slice(0, 300), BIG[k] ? '…' : after.slice(0, 300)]);
    next[j] = o[k];
  });
  rng.setValues([next]);
  if (changes.length) {
    const ci = head.indexOf('contact_id');
    audit(sheet, 'update', row[0], ci >= 0 ? S(row[ci]) : '', changes);
  }
}
/** אויסמעקן א שורה — מיט א קאפיע אין יומן */
function delRow(sheet, rowNo) {
  const head = headOf(sheet);
  const row = sheet.getRange(rowNo, 1, 1, head.length).getValues()[0];
  const snap = {};
  head.forEach(function (h, j) { if (S(row[j]) !== '' && !BIG[h]) snap[h] = clean(row[j]).slice(0, 300); });
  sheet.deleteRow(rowNo);
  const ci = head.indexOf('contact_id');
  audit(sheet, 'delete', row[0], ci >= 0 ? S(row[ci]) : '', snap);
}
/** פילע נייע שורות אויף איינמאל (רייען = מערכים לויט headOf) */
function addRows(sheet, list) {
  if (!list.length) return;
  const head = headOf(sheet);
  sheet.getRange(sheet.getLastRow() + 1, 1, list.length, head.length).setValues(list);
  const ci = head.indexOf('contact_id');
  list.forEach(function (r) {
    const snap = {};
    head.forEach(function (h, j) { if (S(r[j]) !== '' && ['created_at', 'created_by', 'updated_at', 'updated_by'].indexOf(h) < 0) snap[h] = S(r[j]).replace(/^'/, '').slice(0, 300); });
    audit(sheet, 'create', r[0], ci >= 0 ? S(r[ci]) : '', snap);
  });
}
function now() { return Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HH:mm'); }
const S = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };

// ---------- דער מוסד ----------
// גיכקייט: דער מוסד (גיליון, נאמען, בעלים) ווערט געהאלטן אין cache 10 מינוט; די קאלאנעס פון די לשוניות
// ווערן נאר דעמאלט געקאנטראלירט (און נאך יעדן נייעם TABS — דער סימן איז אינעם שליסל).
function skelHash(t) {
  let x = 0;
  for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) | 0;
  return String(x >>> 0);
}
function tabsSig() {
  const t = JSON.stringify(TABS);
  let x = 0;
  for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) | 0;
  return String(x >>> 0);
}
function mosadOf(key) {
  const k = S(key);
  if (!k) return null;
  const cache = CacheService.getScriptCache();
  const ck = 'mosad:' + k + ':' + tabsSig();
  const hit = cache.get(ck);
  if (hit) {
    try {
      const c = JSON.parse(hit);
      const bk = SpreadsheetApp.openById(c.sheet_id);
      return { key: k, name: c.name, org: c.org, prefix: c.prefix, book: bk, owners: c.owners };
    } catch (err) { /* ווייטער — פון אנהייב */ }
  }
  const M0 = mosadLoad(k);
  if (M0) cache.put(ck, JSON.stringify({ sheet_id: M0.book.getId(), name: M0.name, org: M0.org, prefix: M0.prefix, owners: M0.owners }), 600);
  return M0;
}
function mosadLoad(k) {
  const ss = main();
  const list = objs(ss.getSheetByName('Mosdos'));
  const m = list.filter(function (x) { return S(x.key) === k; })[0];
  if (!m) return null;
  let sheetId = S(m.sheet_id);
  let book = null;
  if (sheetId) { try { book = SpreadsheetApp.openById(sheetId); } catch (err) { book = null; } }
  if (!book) {
    // א נייער גיליון פאר דעם מוסד (אין דרייב פונעם דאטאבייס) — מיט די מענטשן פון זיינע תלמידים
    book = SpreadsheetApp.create(S(m.name) || k);
    sheetId = book.getId();
    setCells(ss.getSheetByName('Mosdos'), m._row, { sheet_id: sheetId });
    Object.keys(TABS).forEach(function (t) { ensureTab(book, t, TABS[t]); });
    const first = book.getSheets()[0];
    if (first && Object.keys(TABS).indexOf(first.getName()) < 0 && book.getSheets().length > 1) book.deleteSheet(first);
  }
  Object.keys(TABS).forEach(function (t) { ensureTab(book, t, TABS[t]); });
  // נאך קיינער נישט אין People → די תלמידים / עלטערן פון Enrollments (אויך ווען דאס ערשטע מאל איז איבערגעריסן געווארן)
  if (book.getSheetByName('People').getLastRow() < 2) seedPeople(book, S(m.org));
  const owners = S(m.owner_email).toLowerCase().split(/[,\s]+/).filter(Boolean)
    .concat(settingsEmails(['owner_email']));
  return { key: k, name: S(m.name), org: S(m.org), prefix: S(m.receipt_prefix), book: book, owners: owners };
}
function settingsEmails(cols) {
  const cache = CacheService.getScriptCache();
  const ck = 'set:' + cols.join(',');
  const hit = cache.get(ck);
  if (hit !== null) return hit ? hit.split(',') : [];
  const r = rows(main().getSheetByName('Settings'));
  const out2 = [];
  cols.forEach(function (c) {
    const j = r.head.indexOf(c);
    if (j < 0) return;
    r.body.forEach(function (row) { const v = S(row[j]).toLowerCase(); if (v) out2.push(v); });
  });
  cache.put(ck, out2.join(','), 300);
  return out2;
}
/** ביים מאכן דעם גיליון: די תלמידים (און זייערע עלטערן) פון Enrollments אינעם הויפט-גיליון */
function seedPeople(book, org) {
  if (!org) return;
  const en = objs(main().getSheetByName('Enrollments')).filter(function (e) { return S(e.org) === org; })
    .concat(book.getSheetByName('Enrollments') ? objs(book.getSheetByName('Enrollments')) : []);
  const sh = book.getSheetByName('People');
  const head = headOf(sh);
  const seen = {};
  objs(sh).forEach(function (p) { seen[S(p.contact_id)] = true; });
  const at = now();
  const out3 = [];
  en.forEach(function (e) {
    [[e.contact_id, 'student'], [e.parent_id, 'parent']].forEach(function (p) {
      const id = S(p[0]);
      if (!id || seen[id]) return;
      seen[id] = true;
      const o = { contact_id: Number(id) || id, kind: p[1], status: 'active', added_by: 'system', added_at: at };
      out3.push(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
    });
  });
  // אלעס אויף איינמאל (גיך)
  if (out3.length) sh.getRange(sh.getLastRow() + 1, 1, out3.length, head.length).setValues(out3);
}
/** פונעם עדיטאר: צולייגן תלמידים / עלטערן פון Enrollments וואס זענען נאך נישט אין People */
function reseedYeshiva() {
  const M = mosadOf('yeshiva');
  seedPeople(M.book, M.org);
  Logger.log('People rows: ' + (M.book.getSheetByName('People').getLastRow() - 1));
}

/** ווער ער איז אינעם מוסד: owner / admin / staff (מיט הרשאות) — אדער null */
function roleOf(M, email) {
  if (M.owners.indexOf(email) >= 0) return { email: email, name: '', role: 'owner', perms: PERMS.slice() };
  const st = objs(M.book.getSheetByName('Staff')).filter(function (s) {
    return S(s.email).toLowerCase() === email && S(s.active) !== 'FALSE' && String(s.active) !== 'false';
  })[0];
  if (!st) return null;
  const role = S(st.role) === 'admin' ? 'admin' : 'staff';
  let perms = role === 'admin' ? PERMS.slice() : S(st.perms).split(',').map(S).filter(function (p) { return PERMS.indexOf(p) >= 0; });
  if (role !== 'admin') {
    const mgr = perms.indexOf('manager') >= 0;
    perms = perms.filter(function (p) { return MGR_PERMS.indexOf(p) < 0; });
    if (mgr) perms = perms.concat(MGR_PERMS);
  }
  return { email: email, name: S(st.name), role: role, perms: perms };
}
const isAdminRole = function (me) { return me.role === 'owner' || me.role === 'admin'; };
function need(me, perm) {
  if (isAdminRole(me) || me.perms.indexOf(perm) >= 0) return;
  throw new Error('no-permission');
}
function logIt(M, me, action, cid, detail) {
  appendObj(M.book.getSheetByName('Log'), { at: now(), by: me.email, action: action, contact_id: cid || '', detail: detail || '' });
}
function histRows(me, M, id, changes) {
  const h = main().getSheetByName('History');
  if (!h) return;
  const at = now();
  const by = me.email + ' @' + M.key;
  changes.forEach(function (c) { h.appendRow([at, by, c[0], String(id), String(id), c[1], c[2], c[3]]); });
}

// ---------- די מענטשן ----------
function peopleRows(M) {
  return objs(M.book.getSheetByName('People')).filter(function (p) { return S(p.contact_id) && S(p.status) !== 'removed'; });
}
function contactView(c, ph) {
  const o = { contact_id: c.contact_id };
  C_FIELDS.forEach(function (f) { o[f] = c[f] === undefined ? '' : c[f]; });
  const p = ph || {};
  P_FIELDS.forEach(function (f) { o[f] = p[f] === undefined ? '' : p[f]; });
  return o;
}
function linkedData(M) {
  const ss = main();
  const people = peopleRows(M);
  const ids = {};
  people.forEach(function (p) { ids[S(p.contact_id)] = p; });
  const contacts = objsCols(ss.getSheetByName('Contacts'), ['contact_id', 'deleted_at'].concat(C_FIELDS)).filter(function (c) { return ids[S(c.contact_id)] && !S(c.deleted_at); });
  const phones = {};
  objsCols(ss.getSheetByName('Phones'), ['contact_id'].concat(P_FIELDS)).forEach(function (p) { if (ids[S(p.contact_id)]) phones[S(p.contact_id)] = p; });
  // קשרים — נאר צווישן די מענטשן פונעם מוסד
  const rel = objs(ss.getSheetByName('Relations')).filter(function (r) { return ids[S(r.contact_id_a)] && ids[S(r.contact_id_b)]; })
    .map(function (r) { return { a: S(r.contact_id_a), type: S(r.relation_type), b: S(r.contact_id_b) }; });
  const en = objs(M.book.getSheetByName('Enrollments')).filter(function (e) { return ids[S(e.contact_id)]; })
    .map(function (e) { return { contact_id: S(e.contact_id), status: S(e.status), start: S(e.start_date).slice(0, 10), end: S(e.end_date).slice(0, 10), shiur: S(e.shiur), room: S(e.room) }; });
  return {
    people: contacts.map(function (c) { const v = contactView(c, phones[S(c.contact_id)]); v.kind = S(ids[S(c.contact_id)].kind); v.il_phone = S(ids[S(c.contact_id)].il_phone); v.abroad_phone = S(ids[S(c.contact_id)].abroad_phone); return v; }),
    relations: rel, enrollments: en,
  };
}

function nextContactId(ss) {
  let mx = FIRST_CONTACT_ID - 1;
  const scan = function (sheet, cols) {
    const r = rows(sheet);
    const idx = cols.map(function (c) { return r.head.indexOf(c); }).filter(function (i) { return i >= 0; });
    r.body.forEach(function (row) { idx.forEach(function (i) { const n = Number(row[i]); if (isFinite(n) && n > mx) mx = n; }); });
  };
  scan(ss.getSheetByName('Contacts'), ['contact_id']);
  scan(ss.getSheetByName('Donations'), ['contact_id']);
  scan(ss.getSheetByName('Relations'), ['contact_id_a', 'contact_id_b']);
  return mx + 1;
}
const REVERSE = { 'זון פון': 'טאטע פון', 'טאטע פון': 'זון פון' };

const GIFT_F = ['date', 'currency', 'amount_orig', 'fx_rate', 'amount_usd', 'payment_method', 'check_number', 'card_last4', 'dedication_type', 'dedication_text', 'il_receipt_no'];
/** די נדבות פונעם מוסד אינעם הויפט-גיליון (מיט קבלה-נומער) — אין cache (לייענען 2,000 שורות איז פאמעלעך) */
function orgDonations(M) {
  const ck = 'don:' + M.key;
  const hit = load(M, ck);
  if (hit) return hit;
  const ss = main();
  const rc = {};
  objs(ss.getSheetByName('Receipts')).forEach(function (r) {
    if (isVoid(r) || S(r.kind) !== 'receipt') return;
    S(r.donation_ids).split(',').map(S).forEach(function (x) { if (x) rc[x] = S(r.receipt_no); });
  });
  const list = [];
  objs(ss.getSheetByName('Donations')).forEach(function (d) {
    if (S(d.org) !== M.org || !S(d.donation_id)) return;
    const o = { src: 'm', id: S(d.donation_id), contact_id: S(d.contact_id), donor_name: S(d.donor_name), note: S(d.event_note), is_paid: S(d.is_paid), receipt_no: rc[S(d.donation_id)] || '', by: S(d.created_by) };
    GIFT_F.forEach(function (k) { o[k] = S(d[k]); });
    list.push(o);
  });
  store(M, ck, list);
  return list;
}

/** דער הויפט-אתר האט עפעס געטוישט (קאנטאקטן / נדבות): אויסמעקן און גלייך ווידער אנגרייטן (ווארעם) פאר יעדן מוסד */
function touchAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: true, busy: true };
  try {
    objs(main().getSheetByName('Mosdos')).forEach(function (m) {
      if (!S(m.key) || !S(m.sheet_id)) return;
      const M = mosadOf(S(m.key));
      if (!M) return;
      dropCaches(M, true, true, true);
      store(M, 'ppl:' + M.key, linkedData(M));
      orgDonations(M);
      ACTIONS.gifts(M, { role: 'owner', perms: PERMS.slice(), email: '' }, {}); // די נעמען פון די תורמים
    });
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** א בקשה פאר דעם מנהל פונעם הויפט-מאגר: אויסמעקן דעם איש קשר אינגאנצן */
function deleteRequest(M, me, id, why) {
  const c = objsCols(main().getSheetByName('Contacts'), ['contact_id', 'first_name_he', 'last_name_he']).filter(function (x) { return S(x.contact_id) === id; })[0];
  const name = c ? [c.first_name_he, c.last_name_he].map(S).filter(Boolean).join(' ') : '#' + id;
  const rq = main().getSheetByName('Requests');
  if (!rq) return;
  let rid = 0; objs(rq).forEach(function (r) { const n = Number(r.request_id); if (isFinite(n) && n > rid) rid = n; });
  appendObj(rq, { request_id: rid + 1, type: 'delete_contact', payload: JSON.stringify({ contact_id: id, mosad: M.key }),
    summary: '🎓 ' + (M.name || M.key) + ': ' + name + ' (#' + id + ')' + (why ? ' — ' + why : ''),
    status: 'pending', requested_by: me.email + ' @' + M.key, requested_at: now() });
}
/** FALSE אין א צעל ווערט א boolean → "false"; ביידע = לא פעיל */
function isOff(v) { return S(v).toUpperCase() === 'FALSE'; }
/** אברך → דער תואר "ר'" (נאר ווען עס איז ליידיג) */
function avreichTitle(id, by) {
  const cs = main().getSheetByName('Contacts');
  const c = objsCols(cs, ['contact_id', 'title_he']).filter(function (x) { return S(x.contact_id) === S(id); })[0];
  if (c && !S(c.title_he)) setCells(cs, c._row, { title_he: "ר'", updated_at: now(), updated_by: by });
}
/** אינעם הויפט-אתר "יוצא" ביי צוות / אברכים (און נישט פעיל ביי די אנדערע) → Team: לשעבר */
function teamFromTags(M) {
  const sh = M.book.getSheetByName('Team'); if (!sh) return 0;
  const team = objs(sh).filter(function (t) { return S(t.contact_id) && !isOff(t.active); });
  if (!team.length) return 0;
  const want = {}; team.forEach(function (t) { want[S(t.contact_id)] = t; });
  const org = 'o:' + M.org; let n = 0;
  objsCols(main().getSheetByName('Contacts'), ['contact_id', 'tags']).forEach(function (r) {
    const t = want[S(r.contact_id)]; if (!t) return;
    let tg = []; try { tg = JSON.parse(S(r.tags) || '[]'); } catch (err) { return; }
    const mine = (Array.isArray(tg) ? tg : []).filter(function (x) { return x.p && String(x.p[0]) === '2' && String(x.p[1]) === org && (String(x.p[2]) === Y_NODE.staff || String(x.p[2]) === Y_NODE.avreich); });
    if (!mine.length || mine.some(function (x) { return x.s !== 'f'; })) return;
    const d = mine.map(function (x) { return S(x.d); }).sort().pop() || Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
    setCells(sh, t._row, { active: 'FALSE', end_date: S(t.end_date).slice(0, 10) || d.slice(0, 10), updated_at: now(), updated_by: 'main-site tag' });
    n++;
  });
  return n;
}
/** ער ארבעט מער נישט (נישט צוות און נישט אברך) → Team: לשעבר, מיט א סוף-טאג */
function teamOff(M, id) {
  const sh = M.book.getSheetByName('Team');
  const t = objs(sh).filter(function (x) { return S(x.contact_id) === id; })[0];
  if (t && !isOff(t.active)) setCells(sh, t._row, { active: 'FALSE', end_date: S(t.end_date) || Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd') });
}

const ACTIONS = {
  /** אלעס אויף איינמאל ביים אריינקומען: א רשימה פון קריאות (נאר לייענען); יעדע מיט אירע הרשאות */
  batch: function (M, me, req) {
    const OK = { me: 1, people: 1, school: 1, gifts: 1, fin: 1, team: 1, tasks: 1, ins: 1, users: 1, staff: 1, chav: 1, att: 1, hours: 1 };
    const PERSONAL = { me: 1, tasks: 1 }; // פערזענליך (שעון, משימות) — אלעמאל פריש
    const calls = [].concat(req.calls || []).slice(0, 30);
    const run = function (c) {
      if (!c || !OK[c.action]) return { error: 'bad-action' };
      try { return ACTIONS[c.action](M, me, c.params || {}); } catch (err) { return { error: String((err && err.message) || err) }; }
    };
    // דער גאנצער ענטפער (אן די פערזענליכע) — אין cache ביז דער נעקסטער ענדערונג; לויט די הרשאות
    const sig = isAdminRole(me) ? 'all' : me.perms.slice().sort().join(',');
    const shared = calls.filter(function (c) { return c && !PERSONAL[c.action]; });
    const pre = 'bundle:' + skelHash(sig) + ':';
    const ck = pre + skelHash(JSON.stringify(shared));
    MEMO = {};
    try {
      const hit = load(M, ck);
      let got = hit && hit.g === genOf(M) ? hit.d : null;
      if (!got) {
        got = shared.map(run);
        // נאר ווען אלעס איז געלונגען (א "קיין הרשאה" איז נישט קיין פעלער)
        if (got.every(function (r) { return !r || !r.error || r.error === 'no-permission' || r.error === 'bad-action'; })) store(M, ck, { g: genOf(M), d: got }, pre);
      }
      let j = 0;
      return { results: calls.map(function (c) { return c && !PERSONAL[c.action] ? got[j++] : run(c); }) };
    } finally { MEMO = null; }
  },
  /** ארויס פון איין רשימה (צוות / אברך / תלמיד…). די אנדערע סוגים בלייבן; קיין סוג נישט געבליבן → ארויס פונעם מוסד.
   *  req.request = אויך א בקשה צום הויפט-מאגר (נאר ווען ער איז אינגאנצן ארויס) */
  unlink: function (M, me, req) {
    need(me, 'people_edit');
    const id = S(req.contact_id), kind = S(req.kind);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let gone = false;
    try {
      const sh = M.book.getSheetByName('People');
      const p = objs(sh).filter(function (x) { return S(x.contact_id) === id && S(x.status) !== 'removed'; })[0];
      if (!p) throw new Error('not-yours');
      const kinds = S(p.kind).split(',').map(S).filter(function (k) { return k && k !== kind; });
      if (kinds.length) setCells(sh, p._row, { kind: kinds.join(',') });
      else { setCells(sh, p._row, { status: 'removed', removed_by: me.email, removed_at: now() }); gone = true; }
      if (kinds.indexOf('staff') < 0 && kinds.indexOf('avreich') < 0) teamOff(M, id);
      if (gone && req.request) deleteRequest(M, me, id, S(req.why));
      logIt(M, me, 'unlink', id, kind + (gone ? ' → removed' : '') + (S(req.why) ? ' — ' + S(req.why) : ''));
    } finally { lock.releaseLock(); }
    return { ok: true, removed: gone };
  },

  me: function (M, me) {
    const team = teamOf(M, me.email);
    const tasks = objs(M.book.getSheetByName('Tasks')).filter(function (t) { return S(t.task_id) && S(t.status) !== 'done' && S(t.assigned_to).toLowerCase() === me.email; });
    return { me: { email: me.email, name: me.name, role: me.role, perms: me.perms }, mosad: { key: M.key, name: M.name, org: M.org, logo: brandOf(M.key).logo }, permsAll: PERMS, settings: settingsOf(M),
      team: team, openTasks: tasks.length, clock: team ? clockState(M, team) : null };
  },

  people: function (M) {
    const ck = 'ppl:' + M.key;
    const hit = load(M, ck);
    if (hit) return hit;
    const r = linkedData(M);
    store(M, ck, r);
    return r;
  },

  /** א מענטש וואס איז שוין אינעם הויפט-מאגר? (כדי נישט צו מאכן טאפלט) — נאר נאמען + שטאט */
  find: function (M, me, req) {
    need(me, 'people_edit');
    const q = S(req.q).toLowerCase();
    const ph = S(req.phone).replace(/\D/g, '').slice(-7);
    if (q.length < 2 && ph.length < 7) return { found: [] };
    const words = q.length >= 2 ? q.split(/\s+/).filter(Boolean) : [];
    const phones = {};
    if (ph.length === 7) objs(main().getSheetByName('Phones')).forEach(function (p) { P_FIELDS.concat(['wife_mobile', 'other_phone']).forEach(function (f) { if (S(p[f]).replace(/\D/g, '').slice(-7) === ph) phones[S(p.contact_id)] = true; }); });
    const found = objs(main().getSheetByName('Contacts')).filter(function (c) {
      if (S(c.deleted_at)) return false;
      if (phones[S(c.contact_id)]) return true;
      if (!words.length) return false;
      const hay = [c.first_name_he, c.last_name_he, c.first_name_en, c.last_name_en].map(S).join(' ').toLowerCase();
      const hayS = skel(hay);
      // גענוי, אדער לויטן "שלד" (גינזבורג = גינסבערג)
      return words.every(function (w) { return hay.indexOf(w) >= 0 || (skel(w).length >= 2 && hayS.indexOf(skel(w)) >= 0); });
    }).slice(0, 25).map(function (c) {
      return { contact_id: c.contact_id, name: [c.title_he, c.first_name_he, c.last_name_he].map(S).filter(Boolean).join(' '), en: [c.first_name_en, c.last_name_en].map(S).filter(Boolean).join(' '), city: S(c.city) };
    });
    return { found: found };
  },

  /** צולייגן א מענטש וואס איז שוין אינעם הויפט-מאגר */
  link: function (M, me, req) {
    need(me, 'people_edit');
    const id = S(req.contact_id);
    const c = objs(main().getSheetByName('Contacts')).filter(function (x) { return S(x.contact_id) === id && !S(x.deleted_at); })[0];
    if (!c) throw new Error('not-found');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('People');
      const ex = objs(sh).filter(function (p) { return S(p.contact_id) === id; })[0];
      // א מענטש קען האבן כמה סוגים (למשל הורה + אברך): "parent,avreich"
      const KS = ['student', 'parent', 'staff', 'avreich', 'donor', 'other'];
      let kinds;
      if (req.kinds) kinds = [].concat(req.kinds).map(S).filter(function (k) { return KS.indexOf(k) >= 0; });
      else {
        kinds = S(ex && S(ex.status) !== 'removed' ? ex.kind : '').split(',').map(S).filter(Boolean);
        if (S(req.kind) && kinds.indexOf(S(req.kind)) < 0) kinds.push(S(req.kind));
      }
      if (!kinds.length) kinds = [S(req.kind) || 'other'];
      if (ex) setCells(sh, ex._row, { status: 'active', kind: kinds.join(','), removed_by: '', removed_at: '' });
      else appendObj(sh, { contact_id: Number(id) || id, kind: kinds.join(','), status: 'active', added_by: me.email, added_at: now() });
      logIt(M, me, 'link', id, kinds.join(','));
      if (kinds.indexOf('avreich') >= 0) avreichTitle(id, me.email + ' @' + M.key);
    } finally { lock.releaseLock(); }
    return { ok: true, contact_id: id };
  },

  /** א נייער / טוישן א קאנטאקט (נאר די ערלויבטע פעלדער) — גלייך אין דעם הויפט-מאגר */
  save: function (M, me, req) {
    need(me, 'people_edit');
    const ss = main();
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const cs = ss.getSheetByName('Contacts');
      const id0 = S(req.contact_id);
      const linked = peopleRows(M).some(function (p) { return S(p.contact_id) === id0; });
      if (id0 && !linked) throw new Error('not-yours');
      const c = req.contact || {};
      const pIn = req.phones || {};
      let id = id0;
      const hist = [];
      if (id) {
        const cur = objs(cs).filter(function (x) { return S(x.contact_id) === id; })[0];
        if (!cur) throw new Error('not-found');
        const set = {};
        C_FIELDS.forEach(function (f) { if (f in c && S(c[f]) !== S(cur[f])) { set[f] = c[f]; hist.push(['contact', f, S(cur[f]), S(c[f])]); } });
        if (Object.keys(set).length) { set.updated_at = now(); set.updated_by = me.email + ' @' + M.key; setCells(cs, cur._row, set); }
      } else {
        if (!S(c.last_name_he) && !S(c.last_name_en)) throw new Error('need-name');
        id = String(nextContactId(ss));
        const o = { contact_id: Number(id), is_alive: true, is_active: true, country: 'USA', created_at: now(), created_by: me.email + ' @' + M.key, updated_at: now(), updated_by: me.email + ' @' + M.key };
        C_FIELDS.forEach(function (f) { if (f in c && S(c[f]) !== '') o[f] = c[f]; });
        if (S(req.kind) === 'avreich' && !S(o.title_he)) o.title_he = "ר'";
        appendObj(cs, o);
        hist.push(['contact', '*', '', 'created by ' + M.key]);
        appendObj(M.book.getSheetByName('People'), { contact_id: Number(id), kind: S(req.kind) || 'student', status: 'active', added_by: me.email, added_at: now() });
      }
      // טעלעפאנען / אימעיל
      const ps = ss.getSheetByName('Phones');
      const pr = objs(ps).filter(function (x) { return S(x.contact_id) === id; })[0];
      const pset = {};
      P_FIELDS.forEach(function (f) { if (f in pIn && S(pIn[f]) !== S(pr ? pr[f] : '')) { pset[f] = pIn[f]; hist.push(['phones', f, S(pr ? pr[f] : ''), S(pIn[f])]); } });
      if (Object.keys(pset).length) {
        if (pr) setCells(ps, pr._row, pset);
        else { pset.contact_id = Number(id); appendObj(ps, pset); }
      }
      // קשר (למשל "זון פון" דעם טאטן) — נאר צו א מענטש פונעם מוסד
      if (req.rel && S(req.rel.to) && REVERSE[S(req.rel.type)]) {
        const to = S(req.rel.to);
        if (!peopleRows(M).some(function (p) { return S(p.contact_id) === to; })) throw new Error('not-yours');
        const rs = ss.getSheetByName('Relations');
        const all = objs(rs);
        const has = function (a, t, b) { return all.some(function (r) { return S(r.contact_id_a) === a && S(r.relation_type) === t && S(r.contact_id_b) === b; }); };
        let rid = 0; all.forEach(function (r) { const n = Number(r.relation_id); if (isFinite(n) && n > rid) rid = n; });
        const t1 = S(req.rel.type); const t2 = REVERSE[t1];
        if (!has(id, t1, to)) { appendObj(rs, { relation_id: ++rid, contact_id_a: Number(id), relation_type: t1, contact_id_b: Number(to), created_at: now(), created_by: me.email + ' @' + M.key }); hist.push(['relation', '+', '', t1 + ' #' + to]); }
        if (!has(to, t2, id)) appendObj(rs, { relation_id: ++rid, contact_id_a: Number(to), relation_type: t2, contact_id_b: Number(id), created_at: now(), created_by: me.email + ' @' + M.key });
      }
      if (hist.length) histRows(me, M, id, hist);
      logIt(M, me, id0 ? 'edit' : 'new', id, hist.map(function (x) { return x[1]; }).join(','));
      return { ok: true, contact_id: id };
    } finally { lock.releaseLock(); }
  },

  /** ארויס פונעם מוסד + א בקשה צום מנהל פונעם הויפט-אתר אים אויסצומעקן */
  remove: function (M, me, req) {
    need(me, 'people_edit');
    const id = S(req.contact_id);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('People');
      const p = objs(sh).filter(function (x) { return S(x.contact_id) === id && S(x.status) !== 'removed'; })[0];
      if (!p) throw new Error('not-yours');
      setCells(sh, p._row, { status: 'removed', removed_by: me.email, removed_at: now() });
      teamOff(M, id);
      if (req.request) deleteRequest(M, me, id, S(req.why));
      histRows(me, M, id, [['contact', '*', '', 'removed from ' + M.key + (req.request ? ' (delete requested)' : '')]]);
      logIt(M, me, 'remove', id, S(req.why));
    } finally { lock.releaseLock(); }
    return { ok: true };
  },

  /** א טעלעפאן אין ארץ ישראל (נאר אינעם גיליון פונעם מוסד) */
  ilPhone: function (M, me, req) {
    if (!isAdminRole(me) && me.perms.indexOf('students') < 0 && me.perms.indexOf('people_edit') < 0) throw new Error('no-permission');
    const sh = M.book.getSheetByName('People');
    const p = objs(sh).filter(function (x) { return S(x.contact_id) === S(req.contact_id) && S(x.status) !== 'removed'; })[0];
    if (!p) throw new Error('not-yours');
    // il_phone = טלפון בארץ; abroad_phone = טלפון בחו"ל (נאר וואס מ'שיקט)
    const o = {};
    if (req.il_phone !== undefined) o.il_phone = S(req.il_phone).slice(0, 40);
    if (req.abroad_phone !== undefined) o.abroad_phone = S(req.abroad_phone).slice(0, 40);
    if (!Object.keys(o).length) throw new Error('bad-request');
    setCells(sh, p._row, o);
    logIt(M, me, o.abroad_phone !== undefined ? 'abroad-phone' : 'il-phone', S(req.contact_id), JSON.stringify(o));
    return { ok: true };
  },

  /** דער לאגא פונעם מוסד (נאר בעלים / מנהל) — א קליין בילד (data:image), ביז 45KB */
  setLogo: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const d = S(req.logo);
    if (d && (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(d) || d.length > 45000)) throw new Error('bad-logo');
    const sh = main().getSheetByName('Mosdos');
    const head = headOf(sh);
    if (head.indexOf('logo') < 0) sh.getRange(1, head.length + 1).setValue('logo');
    const m = objs(sh).filter(function (x) { return S(x.key) === M.key; })[0];
    setCells(sh, m._row, { logo: d });
    CacheService.getScriptCache().remove('brand:' + M.key);
    logIt(M, me, 'logo', '', d ? d.length + ' chars' : 'removed');
    return { ok: true };
  },

  // ---------- נדבות פאר דעם מוסד ----------
  // מיט אן איש קשר → אינעם הויפט-גיליון (Donations, org = דער מוסד) — עס ווייזט זיך אויך אינעם הויפט-אתר;
  // אן איש קשר → נאר אינעם גיליון פונעם מוסד (Gifts).
  gifts: function (M, me) {
    need(me, 'donations');
    const ss = main();
    const F = GIFT_F;
    const list = orgDonations(M);
    const cids = {};
    list.forEach(function (o) { if (o.contact_id) cids[o.contact_id] = true; });
    objs(M.book.getSheetByName('Gifts')).forEach(function (g) {
      if (!S(g.gift_id)) return;
      const o = { src: 'l', id: S(g.gift_id), contact_id: '', donor_name: S(g.donor_name), note: S(g.note), is_paid: 'TRUE', receipt_no: '', by: S(g.created_by) };
      F.forEach(function (k) { o[k] = S(g[k]); });
      list.push(o);
    });
    // די נעמען פון אלע אנשי קשר — אין cache 10 מינוט (לייענען 3,000+ שורות איז פאמעלעך)
    let all = load(M, 'names:main');
    if (!all) {
      all = {};
      objsCols(ss.getSheetByName('Contacts'), ['contact_id', 'title_he', 'first_name_he', 'last_name_he', 'first_name_en', 'last_name_en', 'city']).forEach(function (c) {
        if (!S(c.contact_id)) return;
        all[S(c.contact_id)] = [[S(c.title_he), S(c.first_name_he), S(c.last_name_he)].filter(Boolean).join(' '), [S(c.first_name_en), S(c.last_name_en)].filter(Boolean).join(' '), S(c.city)];
      });
      store(M, 'names:main', all);
    }
    const names = {};
    Object.keys(cids).forEach(function (id) { const c = all[id]; if (c) names[id] = { he: c[0], en: c[1], city: c[2] }; });
    return { gifts: list, names: names, methods: listValues('payment_method'), dedications: listValues('dedication_type') };
  },

  giftSave: function (M, me, req) {
    need(me, 'donations');
    const g = req.gift || {};
    const cid = S(g.contact_id);
    const cur = ['USD', 'ILS', 'EUR', 'GBP'].indexOf(S(g.currency)) >= 0 ? S(g.currency) : 'USD';
    const orig = Math.round(Number(g.amount_orig || g.amount_usd) * 100) / 100;
    const usd = cur === 'USD' ? orig : Math.round(Number(g.amount_usd) * 100) / 100;
    if (!(orig > 0) || !(usd > 0)) throw new Error('bad-amount');
    const last4 = S(g.card_last4).replace(/\D/g, '');
    if (last4 && last4.length !== 4) throw new Error('bad-last4');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(S(g.date)) ? S(g.date) : now().slice(0, 10);
    const fx = cur === 'USD' ? { currency: '', amount_orig: '', fx_rate: '' } : { currency: cur, amount_orig: orig, fx_rate: Math.round((usd / orig) * 1e6) / 1e6 };
    const by = me.email + ' @' + M.key;
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const ss = main();
      const ds = ss.getSheetByName('Donations');
      const gs = M.book.getSheetByName('Gifts');
      let old = null;
      if (S(g.id)) {
        old = S(g.src) === 'm' ? objs(ds).filter(function (x) { return S(x.donation_id) === S(g.id); })[0] : objs(gs).filter(function (x) { return S(x.gift_id) === S(g.id); })[0];
        if (!old) throw new Error('not-found');
        if (S(g.src) === 'm' && S(old.org) !== M.org) throw new Error('not-yours');
        if (S(g.src) === 'm' && onReceipt(ss, S(g.id)) && Number(old.amount_usd) !== usd) throw new Error('has-receipt');
      }
      if (cid) {
        const c = objs(ss.getSheetByName('Contacts')).filter(function (x) { return S(x.contact_id) === cid && !S(x.deleted_at); })[0];
        if (!c) throw new Error('not-found');
        // דער נדבן → אינעם מוסד (סוג "תורם"), ווען ער איז נאך נישט דארט
        const ps = M.book.getSheetByName('People');
        const pr = objs(ps).filter(function (x) { return S(x.contact_id) === cid; })[0];
        if (!pr) appendObj(ps, { contact_id: Number(cid), kind: 'donor', status: 'active', added_by: me.email, added_at: now() });
        else if (S(pr.status) === 'removed') setCells(ps, pr._row, { status: 'active', kind: 'donor' });
        else if (S(pr.kind).split(',').map(S).indexOf('donor') < 0) setCells(ps, pr._row, { kind: S(pr.kind) + ',donor' });
        const o = { contact_id: Number(cid), donor_name: '', date: date, amount_usd: usd, is_paid: true, paid_date: date, payment_method: S(g.payment_method),
          check_number: S(g.check_number), card_last4: last4, dedication_type: S(g.dedication_type), dedication_text: S(g.dedication_text), event_note: S(g.note),
          il_receipt_no: S(g.il_receipt_no), org: M.org, updated_at: now(), updated_by: by };
        Object.keys(fx).forEach(function (k) { o[k] = fx[k]; });
        let id;
        if (old && S(g.src) === 'm') { id = S(g.id); setCells(ds, old._row, o); }
        else {
          id = String(nextDonationId(ss));
          o.donation_id = Number(id); o.created_at = now(); o.created_by = by;
          appendObj(ds, o);
          if (old) delRow(gs, old._row); // פון "אן איש קשר" → צו אן איש קשר
        }
        main().getSheetByName('History').appendRow([now(), by, 'donation', id, cid, '*', '', (old ? 'updated' : 'created') + ': $' + usd]);
        logIt(M, me, 'gift', cid, 'm' + id + ' $' + usd);
        return { ok: true, src: 'm', id: id };
      }
      if (old && S(g.src) === 'm') throw new Error('need-contact'); // א נדבה אינעם הויפט-גיליון בלייבט מיט אן איש קשר
      const o2 = { donor_name: S(g.donor_name), date: date, amount_usd: usd, payment_method: S(g.payment_method), check_number: S(g.check_number), card_last4: last4,
        dedication_type: S(g.dedication_type), dedication_text: S(g.dedication_text), note: S(g.note), il_receipt_no: S(g.il_receipt_no), updated_at: now(), updated_by: me.email };
      Object.keys(fx).forEach(function (k) { o2[k] = fx[k]; });
      let id2;
      if (old) { id2 = S(g.id); setCells(gs, old._row, o2); }
      else {
        let mx = 0; objs(gs).forEach(function (x) { const n = Number(x.gift_id); if (isFinite(n) && n > mx) mx = n; });
        id2 = String(mx + 1); o2.gift_id = Number(id2); o2.created_at = now(); o2.created_by = me.email;
        appendObj(gs, o2);
      }
      logIt(M, me, 'gift', '', 'l' + id2 + ' $' + usd);
      return { ok: true, src: 'l', id: id2 };
    } finally { lock.releaseLock(); }
  },

  giftDelete: function (M, me, req) {
    need(me, 'donations');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (S(req.src) === 'l') {
        const gs = M.book.getSheetByName('Gifts');
        const g = objs(gs).filter(function (x) { return S(x.gift_id) === S(req.id); })[0];
        if (g) { delRow(gs, g._row); logIt(M, me, 'gift-delete', '', 'l' + S(req.id) + ' $' + S(g.amount_usd)); }
        return { ok: true };
      }
      const ss = main();
      const ds = ss.getSheetByName('Donations');
      const d = objs(ds).filter(function (x) { return S(x.donation_id) === S(req.id); })[0];
      if (!d) return { ok: true };
      // נאר וואס מ'האט צוגעלייגט פונעם אתר פונעם מוסד, און אן א קבלה
      if (S(d.org) !== M.org || S(d.created_by).slice(-(M.key.length + 2)) !== ' @' + M.key) throw new Error('not-yours');
      if (onReceipt(ss, S(req.id))) throw new Error('has-receipt');
      delRow(ds, d._row);
      ss.getSheetByName('History').appendRow([now(), me.email + ' @' + M.key, 'donation', S(req.id), S(d.contact_id), '*', '$' + S(d.amount_usd), 'deleted']);
      logIt(M, me, 'gift-delete', S(d.contact_id), 'm' + S(req.id) + ' $' + S(d.amount_usd));
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  /** קבלה פון אמעריקע (EIN פון קהל אונגוואר) — אין דער זעלבער סעריע ווי אינעם הויפט-אתר */
  giftReceipt: function (M, me, req) {
    need(me, 'donations');
    const id = S(req.id);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const ss = main();
      const d = objs(ss.getSheetByName('Donations')).filter(function (x) { return S(x.donation_id) === id; })[0];
      if (!d || S(d.org) !== M.org) throw new Error('not-found');
      if (!S(d.contact_id)) throw new Error('need-contact');
      const rs = ss.getSheetByName('Receipts');
      const all = objs(rs);
      let r = all.filter(function (x) { return !isVoid(x) && S(x.kind) === 'receipt' && S(x.donation_ids).split(',').map(S).indexOf(id) >= 0; })[0];
      const copy = Boolean(r);
      if (!r) {
        let mx = 1000;
        all.forEach(function (x) { const m = S(x.receipt_no).match(/^(\d+)$/); if (m && Number(m[1]) > mx) mx = Number(m[1]); });
        r = { receipt_no: String(mx + 1), kind: 'receipt', org: M.org, contact_id: d.contact_id, donor_name: '', donation_ids: id, amount: Number(d.amount_usd),
          period: '', issued_at: now(), issued_by: me.email + ' @' + M.key, void: '', note: '', meta: '' };
        appendObj(rs, r);
        logIt(M, me, 'gift-receipt', S(d.contact_id), S(r.receipt_no));
      }
      const c = objs(ss.getSheetByName('Contacts')).filter(function (x) { return S(x.contact_id) === S(d.contact_id); })[0] || {};
      const gift = {};
      ['donation_id', 'date', 'amount_usd', 'currency', 'amount_orig', 'fx_rate', 'payment_method', 'check_number', 'card_last4', 'dedication_type', 'dedication_text'].forEach(function (k) { gift[k] = S(d[k]); });
      return { receipt: { receipt_no: S(r.receipt_no), issued_at: S(r.issued_at), copy: copy }, gift: gift, donor: contactView(c, null),
        org: orgDetails(M), umbrella: orgDetByName(listValues('umbrella_org')[0] || 'כלל מוסדות אונגוואר') };
    } finally { lock.releaseLock(); }
  },

  // ---------- הגדרות (סדרים, טעג) — נאר בעלים / מנהל ----------
  // ---------- 🍳 מלאי המטבח ----------
  kitchen: function (M, me) {
    need(me, 'kitchen');
    const rd = function (name) { const sh = ensureTab(M.book, name, TABS[name]); return objs(sh).filter(function (x) { return S(x[TABS[name][0]]); }).map(function (x) { const o = {}; TABS[name].forEach(function (k) { o[k] = S(x[k]).replace(/^'/, ''); }); return o; }); };
    const items = rd('Kitchen').map(function (o) { o.expiry_date = o.expiry_date.slice(0, 10); return o; });
    const orders = rd('KitchenOrders').slice(-300);
    const events = rd('KitchenEvents').map(function (e) { e.date = String(e.date).slice(0, 10); return e; });
    let sups = []; try { const sr = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === 'k_suppliers'; })[0]; sups = JSON.parse(S(sr && sr.value) || '[]') || []; } catch (err) { sups = []; }
    if (me.kw) { // עובד מטבח (סיסמה)
      if (!me.kw.prices) items.forEach(function (o) { o.unit_price = ''; });
      return { items: items, events: events, suppliers: sups, orders: orders.map(function (o) { if (!me.kw.prices) o.total = ''; return o; }), kw: { name: me.kw.name, prices: !!me.kw.prices },
        requests: rd('KitchenRequests').filter(function (r) { return r.by === me.email; }).slice(-50) };
    }
    return { items: items, events: events, suppliers: sups, orders: orders, requests: rd('KitchenRequests').filter(function (r) { return r.status === 'pending'; }), workers: kWorkers(M).map(function (w) { return { id: w.id, name: w.name, prices: !!w.prices, active: w.active !== false }; }) };
  },
  /** 🎉 הזמנה מיוחדת (פורים, שבועות, שבת שהרבי נמצא…): { event_id?, name, date, items: [{ id, name, qty, unit, supplier }], note } · remove */
  kitchenEventSave: function (M, me, req) {
    need(me, 'kitchen');
    const e = req.event || {};
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = ensureTab(M.book, 'KitchenEvents', TABS.KitchenEvents);
      const all = objs(sh);
      const ex = S(e.event_id) && all.filter(function (x) { return S(x.event_id) === S(e.event_id); })[0];
      if (req.remove) { if (ex) delRow(sh, ex._row); return { ok: true }; }
      const items = [].concat(e.items || []).slice(0, 300).map(function (x) { return { id: S(x.id).slice(0, 20), name: S(x.name).slice(0, 120), qty: Number(x.qty) || 0, unit: S(x.unit).slice(0, 20), supplier: S(x.supplier).slice(0, 80) }; }).filter(function (x) { return x.name; });
      const o = { name: S(e.name).slice(0, 80) || 'הזמנה מיוחדת', date: S(e.date) ? "'" + S(e.date).slice(0, 10) : '', items: JSON.stringify(items), note: S(e.note).slice(0, 300), updated_at: now(), updated_by: me.email };
      if (ex) { setCells(sh, ex._row, o); return { ok: true, id: S(ex.event_id) }; }
      let max = 0; all.forEach(function (x) { const n = Number(x.event_id); if (n > max) max = n; });
      o.event_id = max + 1; appendObj(sh, o);
      return { ok: true, id: String(max + 1) };
    } finally { lock.releaseLock(); }
  },
  /** 🔑 עובדי מטבח: { id?, name, password?, prices, active } */
  kitchenWorkerSave: function (M, me, req) {
    need(me, 'kitchen');
    const w = req.worker || {};
    const list = kWorkers(M);
    let x = list.filter(function (v) { return v.id === S(w.id); })[0];
    if (!x) { if (!S(w.name) || !S(w.password)) throw new Error('need-text'); x = { id: 'w' + Date.now().toString(36), ver: 1 }; list.push(x); }
    if (S(w.name)) x.name = S(w.name).slice(0, 40);
    x.prices = !!w.prices; x.active = w.active !== false;
    if (S(w.password)) { if (S(w.password).length < 4) throw new Error('short-pass'); x.salt = Utilities.getUuid(); x.hash = kHash(x.salt, S(w.password)); x.ver = (Number(x.ver) || 0) + 1; }
    if (w.remove) list.splice(list.indexOf(x), 1);
    // נישט דורך setCells — די סיסמאות (hash) זאלן נישט אריין אין יומן
    const sh = M.book.getSheetByName('Settings'); const ex = objs(sh).filter(function (r) { return S(r.key) === 'kitchen_workers'; })[0];
    const head = headOf(sh); const row = { key: 'kitchen_workers', value: JSON.stringify(list), updated_at: now(), updated_by: me.email };
    if (ex) sh.getRange(ex._row, 1, 1, head.length).setValues([head.map(function (h) { return row[h] === undefined ? '' : row[h]; })]);
    else sh.appendRow(head.map(function (h) { return row[h] === undefined ? '' : row[h]; }));
    logIt(M, me, 'kitchen-worker', '', (w.remove ? 'remove ' : '') + x.name + (S(w.password) ? ' (סיסמה חדשה)' : ''));
    return { ok: true };
  },
  /** בקשה פון א עובד (הוספה / מחיקה) → אישור / דחייה */
  kitchenReqDecide: function (M, me, req) {
    need(me, 'kitchen');
    const sh = ensureTab(M.book, 'KitchenRequests', TABS.KitchenRequests);
    const r = objs(sh).filter(function (x) { return S(x.req_id) === S(req.id); })[0];
    if (!r || S(r.status) !== 'pending') return { ok: true };
    if (req.approve) {
      if (S(r.type) === 'add') { let d = {}; try { d = JSON.parse(S(r.data)) || {}; } catch (err) { d = {}; } d.product_id = ''; ACTIONS.kitchenSave(M, me, { row: d }); }
      if (S(r.type) === 'delete') ACTIONS.kitchenDelete(M, me, { id: S(r.product_id) });
    }
    setCells(sh, r._row, { status: req.approve ? 'approved' : 'rejected', decided_by: me.email, decided_at: now() });
    return { ok: true };
  },
  /** פריט חדש / עדכון. rows: [{...}] — כמה ביחד (ייבוא) */
  kitchenSave: function (M, me, req) {
    need(me, 'kitchen');
    const rows = [].concat(req.rows || (req.row ? [req.row] : [])).slice(0, 2000);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = ensureTab(M.book, 'Kitchen', TABS.Kitchen);
      const all = objs(sh);
      let max = 0; all.forEach(function (x) { const n = Number(String(x.product_id).replace(/\D/g, '')); if (n > max) max = n; });
      const ids = [];
      rows.forEach(function (r) {
        const o = { updated_at: now(), updated_by: me.email };
        TABS.Kitchen.forEach(function (k) { if (k === 'product_id' || k === 'updated_at' || k === 'updated_by' || !(k in r)) return; const v = S(r[k]).slice(0, 300); o[k] = K_NUM[k] ? (v === '' ? '' : Number(v) || 0) : (k === 'expiry_date' && v ? "'" + v.slice(0, 10) : v); });
        if (!S(o.product_name) && !S(r.product_id)) return;
        const ex = S(r.product_id) && all.filter(function (x) { return S(x.product_id) === S(r.product_id); })[0];
        if (ex) { setCells(sh, ex._row, o); ids.push(S(r.product_id)); }
        else { o.product_id = 'K' + (++max); appendObj(sh, o); ids.push(o.product_id); }
      });
      return { ok: true, ids: ids };
    } finally { lock.releaseLock(); }
  },
  kitchenDelete: function (M, me, req) {
    need(me, 'kitchen');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = ensureTab(M.book, 'Kitchen', TABS.Kitchen);
      const ex = objs(sh).filter(function (x) { return S(x.product_id) === S(req.id); })[0];
      if (ex) { logIt(M, me, 'kitchen-delete', '', S(ex.product_name)); delRow(sh, ex._row); }
      return { ok: true };
    } finally { lock.releaseLock(); }
  },
  /** 📞 קו טלפון (ימות המשיח): טלפונים מורשים + הכתובת לשלוחת ה-API — רק מנהל */
  kPhoneInfo: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const props = PropertiesService.getScriptProperties();
    let key = props.getProperty('YEMOT_KEY_' + M.key);
    if (req && req.newKey) { key = Utilities.getUuid().replace(/-/g, ''); props.setProperty('YEMOT_KEY_' + M.key, key); logIt(M, me, 'settings', '', 'yemot key'); }
    // ימות לא עוקבים אחרי הפניה של Apps Script — הכתובת דרך ה-Worker (שמעביר לכאן)
    // בלי & ובלי = — ימות המשיח מוחקים & מתוך api_link
    return { phones: kPhones(M), link: key ? YEMOT_PROXY + '/' + encodeURIComponent(M.key) + '/' + key : '' };
  },
  kPhoneSave: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const list = [].concat(req.phones || []).slice(0, 50).map(function (x) { return { phone: phoneKey(x.phone), name: S(x.name).slice(0, 60) }; }).filter(function (x) { return x.phone.length >= 9; });
    putSetting(M, me, 'k_phones', JSON.stringify(list));
    logIt(M, me, 'settings', '', 'k_phones ' + list.length);
    return { ok: true, phones: list };
  },
  /** הזמנה: נרשמת בהיסטוריה; received = true → המלאי עולה */
  kitchenOrder: function (M, me, req) {
    need(me, 'kitchen');
    const items = [].concat(req.items || []).slice(0, 300).map(function (x) { return { id: S(x.id), name: S(x.name).slice(0, 120), qty: Number(x.qty) || 0, unit: S(x.unit).slice(0, 20), price: Number(x.price) || 0, mult: Math.max(1, Number(x.mult) || 1) }; }).filter(function (x) { return x.qty > 0; });
    if (!items.length) throw new Error('need-text');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = ensureTab(M.book, 'KitchenOrders', TABS.KitchenOrders);
      let max = 0; objs(sh).forEach(function (x) { const n = Number(x.order_id); if (n > max) max = n; });
      const total = items.reduce(function (t, x) { return t + x.qty * x.price; }, 0);
      appendObj(sh, { order_id: max + 1, date: "'" + Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd'), supplier: S(req.supplier).slice(0, 120), items: JSON.stringify(items), total: Math.round(total * 100) / 100,
        status: req.received ? 'received' : 'ordered', note: S(req.note).slice(0, 300), created_at: now(), created_by: me.email });
      if (req.received) {
        const ks = ensureTab(M.book, 'Kitchen', TABS.Kitchen); const all = objs(ks);
        items.forEach(function (x) { const ex = all.filter(function (k) { return S(k.product_id) === x.id; })[0]; if (ex) setCells(ks, ex._row, { current_stock: (Number(ex.current_stock) || 0) + x.qty * (x.mult || 1), updated_at: now(), updated_by: me.email }); });
      }
      return { ok: true, order_id: max + 1 };
    } finally { lock.releaseLock(); }
  },
  /** הזמנה שהגיעה → המלאי עולה */
  kitchenReceive: function (M, me, req) {
    need(me, 'kitchen');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = ensureTab(M.book, 'KitchenOrders', TABS.KitchenOrders);
      const o = objs(sh).filter(function (x) { return S(x.order_id) === S(req.id); })[0];
      if (!o || S(o.status) === 'received') return { ok: true };
      let items = []; try { items = JSON.parse(S(o.items)) || []; } catch (err) { items = []; }
      const ks = ensureTab(M.book, 'Kitchen', TABS.Kitchen); const all = objs(ks);
      items.forEach(function (x) { const ex = all.filter(function (k) { return S(k.product_id) === S(x.id); })[0]; if (ex) setCells(ks, ex._row, { current_stock: (Number(ex.current_stock) || 0) + (Number(x.qty) || 0) * Math.max(1, Number(x.mult) || 1), updated_at: now(), updated_by: me.email }); });
      setCells(sh, o._row, { status: 'received' });
      return { ok: true };
    } finally { lock.releaseLock(); }
  },
  /** ❓ עוזר AI: מדריך האתר + גישה לנתונים (לפי ההרשאות) דרך "כלים"; הוספה / שינוי — רק הצעה, המשתמש מאשר באתר. מפתח: Script Properties → GEMINI_API_KEY */
  ask: function (M, me, req) {
    const q = S(req.question).slice(0, 800);
    if (!q) throw new Error('need-text');
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty('GEMINI_API_KEY');
    if (!key) throw new Error('ai-no-key');
    const c = CacheService.getScriptCache();
    const day = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
    const limit = Number(props.getProperty('DAILY_LIMIT') || 40);
    const lk = 'ai:' + day + ':' + me.email; const n = Number(c.get(lk) || 0);
    if (n >= limit) throw new Error('ai-limit');
    c.put(lk, String(n + 1), 21600);
    let guide = c.get('ai-guide:' + M.key);
    if (!guide) {
      const r = UrlFetchApp.fetch('https://ungvar.org/help/yeshiva.md?t=' + Date.now(), { muteHttpExceptions: true });
      guide = r.getResponseCode() === 200 ? r.getContentText().slice(0, 90000) : '';
      if (guide) c.put('ai-guide:' + M.key, guide, 3600);
    }
    const can = function (p) { return isAdminRole(me) || me.perms.indexOf(p) >= 0; };
    const seePeople = ['students', 'alumni', 'parents', 'staff_list', 'people_edit', 'insurance', 'attendance', 'chavrusas'].some(can);
    const T = aiTools(M, me, can);
    const decls = seePeople ? T.decls : [];
    const system = ['You are the assistant of the management website of ' + (M.name || 'the yeshiva') + ' (ungvar.org/' + M.key + ').',
      'Answer in Hebrew (or in the language of the question). Be short and practical. Exact button names in **bold** as in the guide.',
      'For "how do I" questions answer ONLY from the guide below; never invent buttons or features.',
      seePeople ? 'You can look up people with the tools (find_people, person_details). Use them for questions about a specific person. Never guess data; if not found, say so.' : 'You have no access to people data for this user.',
      seePeople ? 'To add a person or change a phone, call the propose_* tools — this only PREPARES the change; tell the user to press the ✓ button that appears to confirm. Never claim it was saved.' : '',
      'You CANNOT do anything else on the site: you cannot save, edit, delete, mark attendance, change stipends, kitchen stock or settings. Never say you did or will do such an action — instead explain step by step how the user does it in the site.',
      'Do not reveal data beyond what the tools return. The user is on page: ' + S(req.page).slice(0, 60) + '. Their permissions: ' + (isAdminRole(me) ? 'admin (all)' : me.perms.join(', ')) + '.',
      'Today: ' + day + '.', '', '=== GUIDE ===', guide].join('\n');
    const model = props.getProperty('GEMINI_MODEL') || 'gemini-flash-latest';
    const contents = [].concat((req.history || []).slice(-6).map(function (x) { return { role: x.role === 'model' ? 'model' : 'user', parts: [{ text: S(x.text).slice(0, 2000) }] }; }), [{ role: 'user', parts: [{ text: q }] }]);
    const actions = [];
    for (let turn = 0; turn < 5; turn++) {
      const body = { systemInstruction: { parts: [{ text: system }] }, contents: contents, generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } };
      if (decls.length) body.tools = [{ functionDeclarations: decls }];
      const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true, payload: JSON.stringify(body) });
      if (res.getResponseCode() !== 200) throw new Error('ai-' + res.getResponseCode());
      const cand = ((JSON.parse(res.getContentText()).candidates || [])[0] || {}).content || { parts: [] };
      const calls = (cand.parts || []).filter(function (p) { return p.functionCall; });
      if (!calls.length) {
        const answer = (cand.parts || []).map(function (p) { return p.text || ''; }).join('').trim();
        if (!answer && !actions.length) throw new Error('ai-empty');
        return { answer: answer, actions: actions, left: Math.max(0, limit - n - 1) };
      }
      contents.push({ role: 'model', parts: cand.parts });
      contents.push({ role: 'user', parts: calls.map(function (p) {
        let out; try { out = T.run(p.functionCall.name, p.functionCall.args || {}, actions); } catch (err) { out = { error: String(err.message || err) }; }
        return { functionResponse: { name: p.functionCall.name, response: { result: out } } };
      }) });
    }
    return { answer: 'לא הצלחתי להשלים את הבקשה. נסה לנסח אחרת.', actions: actions };
  },
  // ---------- 📎 קבצים קבועים: בלאנק למלגה (stipbg) / תבנית Word לדף קבוע (tpl) — בדרייב; הרשומה ב-Settings: asset:<kind>:<id> ----------
  assetSave: function (M, me, req) {
    const kind = S(req.kind); const id = S(req.id).replace(/[^\w-]/g, '').slice(0, 30);
    if (['stipbg', 'tpl'].indexOf(kind) < 0 || !id) throw new Error('bad-file');
    need(me, kind === 'stipbg' ? 'stipends' : 'shabbos');
    const key = 'asset:' + kind + ':' + id;
    if (req.remove) { putSetting(M, me, key, ''); logIt(M, me, 'asset', '', 'remove ' + key); return { ok: true, settings: settingsOf(M) }; }
    let rec = {};
    if (S(req.data)) {
      const m = S(req.data).match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,(.+)$/);
      if (!m) throw new Error('bad-file');
      if (m[2].length > 7000000) throw new Error('file-big');
      const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], (S(req.name) || id).slice(0, 80));
      const file = folderPath(['מוסדות אונגוואר', S(M.name) || M.key, 'תבניות']).createFile(blob);
      file.setDescription('by ' + me.email + ' · ' + now());
      rec = { file: file.getId(), type: m[1], name: S(req.name).slice(0, 80) };
    } else {
      const ex = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === key; })[0];
      try { rec = JSON.parse(S(ex && ex.value) || '{}') || {}; } catch (err) { rec = {}; }
    }
    if (req.meta) { const mt = req.meta; rec.title = S(mt.title).slice(0, 80); rec.fields = [].concat(mt.fields || []).map(function (f) { return S(f).slice(0, 60); }).slice(0, 40); }
    rec.at = now(); rec.by = me.email;
    putSetting(M, me, key, JSON.stringify(rec));
    logIt(M, me, 'asset', '', key);
    return { ok: true, settings: settingsOf(M) };
  },
  assetGet: function (M, me, req) {
    const kind = S(req.kind); const id = S(req.id).replace(/[^\w-]/g, '').slice(0, 30);
    if (['stipbg', 'tpl'].indexOf(kind) < 0) throw new Error('not-found');
    need(me, kind === 'stipbg' ? 'stipends' : 'shabbos');
    const ex = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === 'asset:' + kind + ':' + id; })[0];
    let rec = {}; try { rec = JSON.parse(S(ex && ex.value) || '{}') || {}; } catch (err) { rec = {}; }
    if (!rec.file) throw new Error('not-found');
    const b = DriveApp.getFileById(rec.file).getBlob();
    return { data: 'data:' + (rec.type || b.getContentType()) + ';base64,' + Utilities.base64Encode(b.getBytes()), name: rec.name || '' };
  },
  /** 🎖 מלגה שולמה: Settings stippaid:<type>:<month> = { id: { at, by, amt } } */
  stipPaidSave: function (M, me, req) {
    need(me, 'stipends');
    const key = 'stippaid:' + S(req.type).replace(/[^\w-]/g, '').slice(0, 30) + ':' + S(req.mon).slice(0, 10);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const ex = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === key; })[0];
      let map = {}; try { map = JSON.parse(S(ex && ex.value) || '{}') || {}; } catch (err) { map = {}; }
      [].concat(req.rows || []).slice(0, 500).forEach(function (r) {
        const id = S(r.contact_id).replace(/\D/g, ''); if (!id) return;
        if (r.paid) map[id] = { at: now(), by: me.email, amt: Number(r.amt) || 0 }; else delete map[id];
      });
      putSetting(M, me, key, JSON.stringify(map));
      logIt(M, me, 'stipends', '', 'paid ' + key);
      return { ok: true, settings: settingsOf(M) };
    } finally { lock.releaseLock(); }
  },
  /** 🎯 בחור רק בסדרים מסוימים: Settings seder_only = { contact_id: [seder keys] } */
  sederOnlySave: function (M, me, req) {
    need(me, 'attendance');
    const ex = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === 'seder_only'; })[0];
    let map = {}; try { map = JSON.parse(S(ex && ex.value) || '{}') || {}; } catch (err) { map = {}; }
    const id = S(req.contact_id).replace(/\D/g, ''); if (!id) throw new Error('not-found');
    const list = [].concat(req.sedarim || []).map(S).filter(Boolean).slice(0, 12);
    if (list.length) map[id] = list; else delete map[id];
    putSetting(M, me, 'seder_only', JSON.stringify(map));
    logIt(M, me, 'attendance', id, 'seder_only ' + list.join(','));
    return { ok: true, settings: settingsOf(M) };
  },
  /** 🍳 ספקים: Settings k_suppliers = [{ name, phone, contact, email, days, note }] */
  kitchenSuppliersSave: function (M, me, req) {
    need(me, 'kitchen');
    const cut = function (v, n) { return S(v).slice(0, n); };
    const list = [].concat(req.suppliers || []).slice(0, 300).map(function (x) { return { name: cut(x.name, 80), phone: cut(x.phone, 40), contact: cut(x.contact, 60), email: cut(x.email, 80), days: cut(x.days, 40), note: cut(x.note, 200) }; }).filter(function (x) { return x.name; });
    putSetting(M, me, 'k_suppliers', JSON.stringify(list));
    logIt(M, me, 'kitchen', '', 'suppliers ' + list.length);
    return { ok: true, suppliers: list };
  },
  /** 🎉 שמחה → מערכת האם (גיליון הראשי, לשונית Simchos) */
  simchaAdd: function (M, me, req) {
    need(me, 'simchos');
    const types = { birth: 1, upsherin: 1, barmitzvah: 1, erusin: 1, nisuin: 1 };
    const type = types[S(req.type)] ? S(req.type) : 'birth';
    const hon = [].concat(req.honorees || []).slice(0, 4).map(function (x) { const id = S(x.id).replace(/\D/g, ''); return { id: id, name: id ? '' : S(x.name).slice(0, 80), title: S(x.title).slice(0, 30), suffix: S(x.suffix).slice(0, 20) || 'שליט"א', noteOn: false, note: '', toChild: x.toChild ? '1' : '' }; }).filter(function (x) { return x.id || x.name; });
    if (!hon.length) throw new Error('need-honoree');
    const branch = { yeshiva: 1, jlm: 1 }[S(req.branch)] ? S(req.branch) : 'yeshiva';
    const week = /^\d{4}-\d{2}-\d{2}$/.test(S(req.week)) ? S(req.week) : '';
    if (!week) throw new Error('bad-date');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = main().getSheetByName('Simchos');
      if (!sh) throw new Error('not-found');
      let max = 0; objs(sh).forEach(function (x) { const n = Number(x.simcha_id); if (n > max) max = n; });
      const o = { simcha_id: max + 1, week: "'" + week, type: type, honorees: JSON.stringify(hon), child_gender: S(req.gender) === 'f' ? 'f' : 'm', child_name: S(req.child_name).slice(0, 60),
        child_contact_id: S(req.child_id).replace(/\D/g, ''), other_side: S(req.other_side).slice(0, 200), text_override: S(req.text).slice(0, 2000), sort: '',
        created_at: now(), created_by: me.email + ' (' + (S(M.name) || M.key) + ')', updated_at: now(), updated_by: me.email, branch: branch };
      appendObj(sh, o);
      logIt(M, me, 'simcha', o.child_contact_id, type + ' #' + o.simcha_id);
      try { screenPush_(o, hon); } catch (err) { console.warn('screen push', err); } // 📺 גלייך אויפן מסך אין בית המדרש
      return { ok: true, id: max + 1 };
    } finally { lock.releaseLock(); }
  },
  // ---------- 📆 הוצאות והכנסות קבועות + מאזן — הרשאה נפרדת "budget" (לא נשלח עם ההגדרות הכלליות) ----------
  // { opening: { date, amount }, items: [{ id, kind: 'exp'|'inc', name, amount, freq: 'week'|'heb'|'greg'|'once', dow, hday, gday, date, from, to, note }] }
  budgetGet: function (M, me) {
    need(me, 'budget');
    const ex = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === 'budget'; })[0];
    let v = { opening: { date: '', amount: '' }, items: [] };
    try { if (ex && S(ex.value)) v = JSON.parse(S(ex.value)); } catch (err) { /* */ }
    return { budget: v };
  },
  budgetSave: function (M, me, req) {
    need(me, 'budget');
    const b = req.budget || {};
    const num = function (v) { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
    const d10 = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(S(v)) ? S(v) : ''; };
    const items = [].concat(b.items || []).slice(0, 300).map(function (x, i) {
      return { id: S(x.id).slice(0, 30) || ('b' + i), kind: S(x.kind) === 'inc' ? 'inc' : 'exp', name: S(x.name).slice(0, 120) || '—', amount: num(x.amount),
        freq: { week: 1, heb: 1, greg: 1, once: 1 }[S(x.freq)] ? S(x.freq) : 'greg', dow: Math.max(0, Math.min(6, Number(x.dow) || 0)), hday: Math.max(1, Math.min(30, Number(x.hday) || 1)),
        gday: Math.max(1, Math.min(31, Number(x.gday) || 1)), date: d10(x.date), from: d10(x.from), to: d10(x.to), note: S(x.note).slice(0, 300) };
    });
    const v = { opening: { date: d10(b.opening && b.opening.date), amount: b.opening && S(b.opening.amount) !== '' ? num(b.opening.amount) : '' }, items: items };
    putSetting(M, me, 'budget', JSON.stringify(v));
    logIt(M, me, 'budget', '', items.length + ' items');
    return { ok: true, budget: v };
  },
  /** 🎖 סוגי מלגות: [{ id, name, sedarim: [keys], tpl: { to: [], bless, intro, amount, quotes: [] } }] */
  stipTypesSave: function (M, me, req) {
    need(me, 'stipends');
    const cut = function (v, n) { return S(v).slice(0, n); };
    const list = [].concat(req.types || []).slice(0, 20).map(function (t, i) {
      const tp = t.tpl || {};
      return { id: cut(t.id, 30) || ('t' + i), name: cut(t.name, 60) || 'מלגה', sedarim: [].concat(t.sedarim || []).map(S).slice(0, 10),
        tpl: { to: [].concat(tp.to || []).map(function (x) { return cut(x, 200); }).slice(0, 6), bless: cut(tp.bless, 1000), intro: cut(tp.intro, 200), amount: cut(tp.amount, 200), quotes: [].concat(tp.quotes || []).map(function (x) { return cut(x, 600); }).slice(0, 8) } };
    });
    putSetting(M, me, 'stip_types', JSON.stringify(list));
    logIt(M, me, 'settings', '', 'stip_types');
    return { ok: true, settings: settingsOf(M) };
  },
  settingsSave: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const sh = M.book.getSheetByName('Settings');
    const all = objs(sh);
    const vals = req.settings || {};
    Object.keys(vals).forEach(function (k) {
      if (['sedarim', 'avreich_rate', 'calendar'].indexOf(k) < 0) return;
      const v = typeof vals[k] === 'string' ? vals[k] : JSON.stringify(vals[k]);
      const ex = all.filter(function (x) { return S(x.key) === k; })[0];
      if (ex) setCells(sh, ex._row, { value: v, updated_at: now(), updated_by: me.email });
      else appendObj(sh, { key: k, value: v, updated_at: now(), updated_by: me.email });
    });
    logIt(M, me, 'settings', '', Object.keys(vals).join(','));
    return { ok: true, settings: settingsOf(M) };
  },

  // ---------- 🛏 פנימייה: די רשימה פון חדרים (Settings: rooms), און דער חדר פון יעדן רישום ----------
  roomsSave: function (M, me, req) {
    need(me, 'dorm');
    const list = [].concat(req.rooms || []).slice(0, 500).map(function (r, i) { return { id: S(r.id).slice(0, 24) || ('r' + i), name: S(r.name).slice(0, 40), desc: S(r.desc || r.note).slice(0, 120), beds: Math.max(0, Math.min(50, Number(r.beds) || 0)), wing: ['A', 'B', 'C'].indexOf(S(r.wing)) >= 0 ? S(r.wing) : 'A', kind: S(r.kind) === 'service' ? 'service' : 'room' }; }).filter(function (r) { return r.name || r.desc; });
    putSetting(M, me, 'rooms', JSON.stringify(list));
    logIt(M, me, 'rooms', '', list.length + ' rooms');
    return { ok: true, settings: settingsOf(M) };
  },
  // דער שיבוץ פון א זמן: { b: מבנה, beds: { bedId: contact_id }, apts: [{ id, name, beds, ids: [contact_id|''] }] }
  dormSave: function (M, me, req) {
    need(me, 'dorm');
    const z = S(req.zman).slice(0, 40);
    if (!z) throw new Error('חסר זמן');
    const d = req.doc || {};
    const num = function (x) { return S(x).replace(/\D/g, '').slice(0, 10); };
    const beds = {};
    Object.keys(d.beds || {}).slice(0, 800).forEach(function (k) { const v = num(d.beds[k]); if (v) beds[S(k).slice(0, 24)] = v; });
    const apts = [].concat(d.apts || []).slice(0, 100).map(function (a) { return { id: S(a.id).slice(0, 24), name: S(a.name).slice(0, 80), beds: Math.max(0, Math.min(50, Number(a.beds) || 0)), ids: [].concat(a.ids || []).slice(0, 50).map(num) }; });
    const v = JSON.stringify({ b: S(d.b).slice(0, 24), beds: beds, apts: apts });
    if (v.length > 45000) throw new Error('גדול מדי');
    putSetting(M, me, 'dorm:' + z, v);
    logIt(M, me, 'dorm', '', z);
    return { ok: true, settings: settingsOf(M) };
  },
  // די מבנים (בילד + מיטות + כיתובים) — אלע צוזאמען
  dormBld: function (M, me, req) {
    need(me, 'dorm');
    const n = function (x) { return Math.round(Math.max(0, Math.min(100, Number(x) || 0)) * 100) / 100; };
    const list = [].concat(req.buildings || []).slice(0, 30).map(function (b) {
      return { id: S(b.id).slice(0, 24), name: S(b.name).slice(0, 80), ar: Math.max(0.05, Math.min(20, Number(b.ar) || 0.5)),
        beds: [].concat(b.beds || []).slice(0, 400).map(function (x) { return { id: S(x.id).slice(0, 24), x: n(x.x), y: n(x.y), w: n(x.w), h: n(x.h), room: S(x.room).slice(0, 40) }; }),
        labels: [].concat(b.labels || []).slice(0, 200).map(function (x) { return { id: S(x.id).slice(0, 24), t: S(x.t).slice(0, 60), x: n(x.x), y: n(x.y), svc: !!x.svc }; }) };
    }).filter(function (b) { return b.id; });
    const v = JSON.stringify(list);
    if (v.length > 45000) throw new Error('גדול מדי');
    putSetting(M, me, 'dorm_bld', v);
    logIt(M, me, 'dorm', '', 'buildings ' + list.length);
    return { ok: true, settings: settingsOf(M) };
  },
  dormImgSave: function (M, me, req) {
    need(me, 'dorm');
    const bid = S(req.bid).slice(0, 24); const data = S(req.data);
    if (!bid || !/^data:image\/(webp|png|jpeg);base64,/.test(data) || data.length > 45000) throw new Error('תמונה לא תקינה');
    putSetting(M, me, 'dormimg:' + bid, data);
    logIt(M, me, 'dorm', '', 'image ' + bid);
    return { ok: true };
  },
  dormImg: function (M, me, req) {
    if (!isAdminRole(me) && me.perms.indexOf('dorm') < 0) throw new Error('no-permission');
    const k = 'dormimg:' + S(req.bid);
    const r = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === k; })[0];
    return { data: r ? S(r.value) : '' };
  },
  roomSet: function (M, me, req) {
    need(me, 'dorm');
    const rows = [].concat(req.rows || []).slice(0, 500);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Enrollments');
      const all = objs(sh);
      let n = 0;
      rows.forEach(function (r) {
        const e = all.filter(function (x) { return S(x.enroll_id) === S(r.enroll_id); })[0];
        if (!e) return;
        setCells(sh, e._row, { room: S(r.room).slice(0, 40), updated_at: now(), updated_by: me.email });
        n++;
      });
      logIt(M, me, 'room', '', n + ' students');
      return { ok: true, n: n };
    } finally { lock.releaseLock(); }
  },

  // ---------- 🤝 חברותות: א שורה פאר יעדן בחור אין א סדר (אין א זמן) — מיט וועמען ער לערנט (א מענטש, אדער טעקסט: "שיעור ...") ----------
  chav: function (M, me, req) {
    need(me, 'chavrusas');
    const z = S(req.zman);
    const all = objs(M.book.getSheetByName('Chavrusas')).filter(function (x) { return S(x.contact_id) && (!z || S(x.zman) === z); });
    const zmanim = {}; objs(M.book.getSheetByName('Chavrusas')).forEach(function (x) { if (S(x.zman)) zmanim[S(x.zman)] = true; });
    return { rows: all.map(function (x) { return { zman: S(x.zman), seder: S(x.seder), contact_id: S(x.contact_id), partner_id: S(x.partner_id), partner_text: S(x.partner_text) }; }), zmanim: Object.keys(zmanim) };
  },
  /** אלע חברותות פון א סדר אין א זמן אויף איינמאל: rows = [{ contact_id, partner_id, partner_text }] */
  chavSave: function (M, me, req) {
    need(me, 'chavrusas');
    const z = S(req.zman); const seder = S(req.seder);
    if (!z || !seder) throw new Error('bad-week');
    const mine = {}; peopleRows(M).forEach(function (p) { mine[S(p.contact_id)] = true; });
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Chavrusas');
      const have = {};
      objs(sh).forEach(function (x) { if (S(x.zman) === z && S(x.seder) === seder) have[S(x.contact_id)] = x; });
      const head = headOf(sh);
      const add = [];
      [].concat(req.rows || []).forEach(function (r) {
        const cid = S(r.contact_id);
        if (!mine[cid]) return;
        const pid = S(r.partner_id) && mine[S(r.partner_id)] ? S(r.partner_id) : '';
        const o = { partner_id: pid ? Number(pid) : '', partner_text: pid ? '' : S(r.partner_text), updated_at: now(), updated_by: me.email };
        if (have[cid]) setCells(sh, have[cid]._row, o);
        else if (pid || o.partner_text) { o.zman = z; o.seder = seder; o.contact_id = Number(cid); add.push(head.map(function (h) { return o[h] === undefined ? '' : o[h]; })); }
      });
      addRows(sh, add);
      logIt(M, me, 'chavrusas', '', z + ' ' + seder);
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  // ---------- ✅ השתתפות: א שורה פאר וואך + סדר + בחור; marks = { "0": "v", "0b": "x" } (טאג 0=זונטאג; b = די צווייטע משבצת) ----------
  att: function (M, me, req) {
    // השתתפות; גם 🎖 מלגות (לקרוא) ו-🧹 ימי עבודה במשכורות
    // 🌙 נוכחות בפנימייה (seder "_dorm") — גם עם הרשאה dorm_att בלבד
    const dormOnly = !isAdminRole(me) && ['attendance', 'stipends', 'salary'].every(function (p) { return me.perms.indexOf(p) < 0; });
    if (dormOnly && me.perms.indexOf('dorm_att') < 0) throw new Error('no-permission');
    const from = S(req.from); const to = S(req.to) || from;
    return { rows: objs(M.book.getSheetByName('Attendance')).filter(function (x) { const w = S(x.week).slice(0, 10); return w >= from && w <= to && (!dormOnly || S(x.seder) === '_dorm'); })
      .map(function (x) { return { week: S(x.week).slice(0, 10), seder: S(x.seder), contact_id: S(x.contact_id), marks: S(x.marks), note: S(x.note) }; }) };
  },
  attSave: function (M, me, req) {
    const week = S(req.week).slice(0, 10); const seder = S(req.seder);
    need(me, seder === '_dorm' ? 'dorm_att' : seder === '_work' && me.perms.indexOf('salary') >= 0 ? 'salary' : 'attendance');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !seder) throw new Error('bad-week');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Attendance');
      const all = objs(sh);
      const have = {};
      all.forEach(function (x) { if (S(x.week).slice(0, 10) === week && S(x.seder) === seder) have[S(x.contact_id)] = x; });
      const head = headOf(sh);
      const add = [];
      [].concat(req.rows || []).forEach(function (r) {
        const cid = S(r.contact_id); if (!cid) return;
        const o = { marks: typeof r.marks === 'string' ? r.marks : JSON.stringify(r.marks || {}), note: S(r.note), updated_at: now(), updated_by: me.email };
        if (have[cid]) setCells(sh, have[cid]._row, o);
        else { o.week = week; o.seder = seder; o.contact_id = Number(cid) || cid; add.push(head.map(function (h) { return o[h] === undefined ? '' : o[h]; })); }
      });
      addRows(sh, add);
      logIt(M, me, 'attendance', '', week + ' ' + seder);
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  // ---------- ⏱ שעות פון אברכים (כניסה / יציאה) — א שורה פאר א טאג ----------
  hours: function (M, me, req) {
    need(me, 'attendance');
    const from = S(req.from); const to = S(req.to) || from;
    return { hours: objs(M.book.getSheetByName('Hours')).filter(function (x) { const d = S(x.date).slice(0, 10); return S(x.contact_id) && d >= from && d <= to; })
      .map(function (x) { return { date: S(x.date).slice(0, 10), contact_id: S(x.contact_id), time_in: hhmm(x.time_in), time_out: hhmm(x.time_out), note: S(x.note) }; }) };
  },
  /** rows = [{ date, contact_id, time_in, time_out }] — ליידיג = אויסמעקן */
  hoursSave: function (M, me, req) {
    need(me, 'attendance');
    const mine = {}; peopleRows(M).forEach(function (p) { mine[S(p.contact_id)] = true; });
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Hours');
      const all = objs(sh);
      const have = {}; all.forEach(function (x) { have[S(x.date).slice(0, 10) + '|' + S(x.contact_id)] = x; });
      const head = headOf(sh);
      const add = []; const del = [];
      const tm = function (v) { const m = S(v).match(/^(\d{1,2}):(\d{2})$/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; };
      [].concat(req.rows || []).forEach(function (r) {
        const cid = S(r.contact_id); const d = S(r.date).slice(0, 10);
        if (!mine[cid] || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        const tin = tm(r.time_in); const tout = tm(r.time_out);
        const ex = have[d + '|' + cid];
        if (!tin && !tout) { if (ex) del.push(ex._row); return; }
        const o = { time_in: tin ? "'" + tin : '', time_out: tout ? "'" + tout : '', note: S(r.note), updated_at: now(), updated_by: me.email };
        if (ex) setCells(sh, ex._row, o);
        else { o.date = d; o.contact_id = Number(cid); add.push(head.map(function (h) { return o[h] === undefined ? '' : o[h]; })); }
      });
      del.sort(function (a, b) { return b - a; }).forEach(function (r) { delRow(sh, r); });
      addRows(sh, add);
      logIt(M, me, 'hours', '', String((req.rows || []).length));
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  // ---------- 🏥 ביטוח בריאות ----------
  ins: function (M, me) {
    need(me, 'insurance');
    return { insurance: objs(M.book.getSheetByName('Insurance')).filter(function (x) { return S(x.contact_id); }).map(function (x) {
      const o = {}; TABS.Insurance.forEach(function (k) { o[k] = S(x[k]); }); o.expires = o.expires.slice(0, 10); o.left_date = o.left_date.slice(0, 10); return o; }) };
  },
  insSave: function (M, me, req) {
    need(me, 'insurance');
    const r = req.ins || {};
    const mine = {}; peopleRows(M).forEach(function (p) { mine[S(p.contact_id)] = true; });
    if (!mine[S(r.contact_id)]) throw new Error('not-yours');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Insurance');
      const o = { updated_at: now(), updated_by: me.email };
      ['kupah', 'member_no', 'company', 'policy_no', 'expires', 'passport', 'debt', 'left_date', 'status', 'note'].forEach(function (k) { o[k] = S(r[k]); });
      ['member_no', 'policy_no', 'passport'].forEach(function (k) { if (o[k]) o[k] = "'" + o[k]; }); // טעקסט (נולן פארנט)
      const ex = objs(sh).filter(function (x) { return S(x.contact_id) === S(r.contact_id); })[0];
      if (ex) setCells(sh, ex._row, o); else { o.contact_id = Number(r.contact_id) || r.contact_id; appendObj(sh, o); }
      logIt(M, me, 'insurance', S(r.contact_id), '');
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  // ---------- 👔 צוות (Team): תפקיד, טעלעפאן, פעיל/לשעבר, סארט שכר — אן סכומים ----------
  team: function (M, me) {
    if (!isAdminRole(me) && ['staff_list', 'finance', 'attendance'].every(function (p) { return me.perms.indexOf(p) < 0; })) throw new Error('no-permission');
    try { teamFromTags(M); } catch (err) { /* נישט שטערן */ }
    return { team: objs(M.book.getSheetByName('Team')).filter(function (t) { return S(t.contact_id); }).map(function (t) {
      const o = {}; TABS.Team.forEach(function (k) { o[k] = S(t[k]); }); o.start_date = o.start_date.slice(0, 10); o.end_date = o.end_date.slice(0, 10); o.active = isOff(o.active) ? 'FALSE' : 'TRUE'; return o; }) };
  },
  teamSave: function (M, me, req) {
    need(me, 'staff_list');
    const t = req.team || {};
    const mine = {}; peopleRows(M).forEach(function (p) { mine[S(p.contact_id)] = true; });
    if (!mine[S(t.contact_id)]) throw new Error('not-yours');
    const em = S(t.email).toLowerCase();
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error('bad-email');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Team');
      const o = { email: em, role: S(t.role), start_date: S(t.start_date), end_date: S(t.end_date), active: t.active === false || isOff(t.active) ? 'FALSE' : 'TRUE',
        pay_type: ['global', 'schedule', 'log', 'mixed', 'days'].indexOf(S(t.pay_type)) >= 0 ? S(t.pay_type) : '', schedule: typeof t.schedule === 'string' ? t.schedule : JSON.stringify(t.schedule || []), note: S(t.note), pay_via: ['us', 'parents'].indexOf(S(t.pay_via)) >= 0 ? S(t.pay_via) : '', updated_at: now(), updated_by: me.email };
      const ex = objs(sh).filter(function (x) { return S(x.contact_id) === S(t.contact_id); })[0];
      if (ex) setCells(sh, ex._row, o); else { o.contact_id = Number(t.contact_id) || t.contact_id; appendObj(sh, o); }
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  // ---------- ⏱ שעון נוכחות (פונעם אזור אישי) ----------
  clock: function (M, me) {
    const t = teamOf(M, me.email);
    if (!t) throw new Error('not-team');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Hours');
      const d = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
      const tm = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'HH:mm');
      const ex = objs(sh).filter(function (x) { return S(x.date).slice(0, 10) === d && S(x.contact_id) === S(t.contact_id); })[0];
      if (!ex) appendObj(sh, { date: d, contact_id: Number(t.contact_id) || t.contact_id, time_in: "'" + tm, time_out: '', note: 'שעון', updated_at: now(), updated_by: me.email });
      else if (!hhmm(ex.time_out)) setCells(sh, ex._row, { time_out: "'" + tm, updated_at: now(), updated_by: me.email });
      else throw new Error('clock-done');
      return { ok: true, clock: clockState(M, t) };
    } finally { lock.releaseLock(); }
  },

  // ---------- 📋 משימות ----------
  users: function (M) {
    const list = M.owners.map(function (e) { return { email: e, name: '' }; });
    objs(M.book.getSheetByName('Staff')).forEach(function (x) { if (S(x.email) && S(x.active) !== 'FALSE') list.push({ email: S(x.email).toLowerCase(), name: S(x.name) }); });
    const seen = {};
    return { users: list.filter(function (u) { if (seen[u.email]) return false; seen[u.email] = true; return true; }) };
  },
  tasks: function (M, me) {
    const all = objs(M.book.getSheetByName('Tasks')).filter(function (t) { return S(t.task_id); });
    const mine = all.filter(function (t) { return isAdminRole(me) || S(t.assigned_to).toLowerCase() === me.email || S(t.from_email).toLowerCase() === me.email; });
    return { tasks: mine.map(function (t) { const o = {}; TABS.Tasks.forEach(function (k) { o[k] = S(t[k]); }); o.due = o.due.slice(0, 10); return o; }) };
  },
  taskSave: function (M, me, req) {
    const t = req.task || {};
    if (!S(t.text)) throw new Error('need-text');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Tasks');
      const all = objs(sh);
      const o = { text: S(t.text).slice(0, 2000), assigned_to: S(t.assigned_to).toLowerCase() || me.email, due: S(t.due), urgent: t.urgent ? 'TRUE' : '', contact_id: S(t.contact_id), updated_at: now(), updated_by: me.email };
      let id = S(t.task_id);
      if (id) {
        const ex = all.filter(function (x) { return S(x.task_id) === id; })[0];
        if (!ex) throw new Error('not-found');
        if (!isAdminRole(me) && [S(ex.assigned_to).toLowerCase(), S(ex.from_email).toLowerCase()].indexOf(me.email) < 0) throw new Error('no-permission');
        setCells(sh, ex._row, o);
      } else {
        let mx = 0; all.forEach(function (x) { const n = Number(x.task_id); if (isFinite(n) && n > mx) mx = n; });
        id = String(mx + 1);
        o.task_id = Number(id); o.from_email = me.email; o.status = 'open'; o.created_at = now(); o.created_by = me.email;
        appendObj(sh, o);
      }
      return { ok: true, task_id: id };
    } finally { lock.releaseLock(); }
  },
  taskDone: function (M, me, req) {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Tasks');
      const ex = objs(sh).filter(function (x) { return S(x.task_id) === S(req.task_id); })[0];
      if (!ex) throw new Error('not-found');
      if (!isAdminRole(me) && [S(ex.assigned_to).toLowerCase(), S(ex.from_email).toLowerCase()].indexOf(me.email) < 0) throw new Error('no-permission');
      if (req.del) { if (!isAdminRole(me) && S(ex.from_email).toLowerCase() !== me.email) throw new Error('no-permission'); delRow(sh, ex._row); return { ok: true }; }
      if (req.status === 'doing') setCells(sh, ex._row, { status: 'doing', done_at: '', done_by: '', updated_at: now(), updated_by: me.email });
      else setCells(sh, ex._row, req.undo ? { status: 'open', done_at: '', done_by: '' } : { status: 'done', done_at: now(), done_by: me.email });
      return { ok: true };
    } finally { lock.releaseLock(); }
  },

  // ---------- 📜 יומן פעולות ----------
  log: function (M, me, req) {
    const own = !isAdminRole(me) || req.mine;
    const from = S(req.from); const to = S(req.to); const by = S(req.by).toLowerCase(); const ent = S(req.entity); const q = S(req.q);
    const fin = isAdminRole(me) || me.perms.indexOf('salary') >= 0;
    const rowsL = objs(M.book.getSheetByName('Log')).filter(function (x) {
      const at = S(x.at);
      if (own && S(x.by).toLowerCase() !== me.email) return false;
      if (from && at.slice(0, 10) < from) return false;
      if (to && at.slice(0, 10) > to) return false;
      if (by && S(x.by).toLowerCase() !== by) return false;
      if (ent && S(x.entity) !== ent) return false;
      if (!fin && SECRET[S(x.entity)]) return false;
      if (q && (S(x.detail) + ' ' + S(x.changes) + ' ' + S(x.contact_id) + ' ' + S(x.entity_id)).indexOf(q) < 0) return false;
      return true;
    });
    const list = rowsL.slice(-1500).reverse().map(function (x) { return { at: S(x.at), by: S(x.by), action: S(x.action), contact_id: S(x.contact_id), detail: S(x.detail), entity: S(x.entity), entity_id: S(x.entity_id), changes: S(x.changes) }; });
    return { log: list, total: rowsL.length };
  },
  /** די היסטאריע פון איין רשומה (entity + id), אדער פון א מענטש (contact_id) */
  history: function (M, me, req) {
    const ent = S(req.entity); const id = S(req.id); const cid = S(req.contact_id);
    const fin = isAdminRole(me) || me.perms.indexOf('salary') >= 0;
    if (SECRET[ent] && !fin) throw new Error('no-permission');
    return { log: objs(M.book.getSheetByName('Log')).filter(function (x) {
      if (SECRET[S(x.entity)] && !fin) return false;
      return (ent && S(x.entity) === ent && S(x.entity_id) === id) || (cid && S(x.contact_id) === cid);
    }).reverse().slice(0, 500).map(function (x) { return { at: S(x.at), by: S(x.by), action: S(x.action), entity: S(x.entity), entity_id: S(x.entity_id), detail: S(x.detail), changes: S(x.changes) }; }) };
  },

  // ---------- 💰 משכורות והוצאות (finance) ----------
  fin: function (M, me) {
    if (!isAdminRole(me) && me.perms.indexOf('finance') < 0 && me.perms.indexOf('salary') < 0) throw new Error('no-permission');
    const sal = isAdminRole(me) || me.perms.indexOf('salary') >= 0;
    const take = function (tab) { return objs(M.book.getSheetByName(tab)).filter(function (x) { return S(x[TABS[tab][0]]); }).map(function (x) { const o = {}; TABS[tab].forEach(function (k) { o[k] = S(x[k]).replace(/^'/, ''); }); return o; }); };
    const team = take('Team');
    const ids = {}; team.forEach(function (t) { ids[S(t.contact_id)] = true; });
    const hours = objs(M.book.getSheetByName('Hours')).filter(function (x) { return ids[S(x.contact_id)]; })
      .map(function (x) { return { date: S(x.date).slice(0, 10), contact_id: S(x.contact_id), time_in: hhmm(x.time_in), time_out: hhmm(x.time_out) }; });
    // הכנסות פון שכר לימוד און נדבות (נאר סכומים לויט טאג)
    const tuition = objs(M.book.getSheetByName('Tuition')).filter(function (x) { return S(x.payment_id); }).map(function (x) { return { date: S(x.date).slice(0, 10), amount: Number(x.amount) || 0 }; });
    const gifts = orgDonations(M).map(function (d) { return { date: S(d.date).slice(0, 10), currency: S(d.currency) || 'USD', orig: Number(d.amount_orig) || 0, usd: Number(d.amount_usd) || 0 }; })
      .concat(objs(M.book.getSheetByName('Gifts')).filter(function (g) { return S(g.gift_id); }).map(function (g) { return { date: S(g.date).slice(0, 10), currency: S(g.currency) || 'USD', orig: Number(g.amount_orig) || 0, usd: Number(g.amount_usd) || 0 }; }));
    if (!sal) return { sal: false, team: team.map(function (t) { return { contact_id: t.contact_id, role: t.role, active: t.active }; }), payInfo: [], items: [], payments: [], expenses: take('Expenses'), incomes: [],
      debts: take('Debts'), repayments: take('Repayments'), hours: [], tuition: [], gifts: [], settings: settingsOf(M) };
    return { sal: true, team: team, payInfo: take('PayInfo'), items: take('PayItems'), payments: take('PayPayments'), expenses: take('Expenses'), incomes: take('Incomes'),
      debts: take('Debts'), repayments: take('Repayments'), hours: hours, tuition: tuition, gifts: gifts, settings: settingsOf(M) };
  },
  /** א שורה אין איינע פון די finance-לשוניות (נייע אדער טוישן) */
  finSave: function (M, me, req) {
    const tab = S(req.tab);
    need(me, FIN_SAL[tab] ? 'salary' : 'finance');
    if (!FIN_TABS[tab]) throw new Error('bad-tab');
    const r = req.row || {};
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName(tab);
      const idf = TABS[tab][0];
      const all = objs(sh);
      const o = { updated_at: now(), updated_by: me.email };
      TABS[tab].forEach(function (k) { if (k !== idf && ['created_at', 'created_by', 'updated_at', 'updated_by'].indexOf(k) < 0 && k in r) o[k] = S(r[k]); });
      if (o.currency && ['ILS', 'USD'].indexOf(o.currency) < 0) throw new Error('bad-currency');
      if ('amount' in o) { const n = Math.round(Number(o.amount) * 100) / 100; if (!isFinite(n)) throw new Error('bad-amount'); o.amount = n; }
      if (o.id_number) o.id_number = "'" + o.id_number.replace(/\D/g, '');
      if ('bank_last4' in o) { o.bank_last4 = o.bank_last4.replace(/\D/g, ''); if (o.bank_last4 && o.bank_last4.length !== 4) throw new Error('bad-last4'); }
      let id = S(r[idf]);
      if (tab === 'PayInfo') { // איין שורה פאר א מענטש
        id = S(r.contact_id);
        const ex0 = all.filter(function (x) { return S(x.contact_id) === id; })[0];
        if (ex0) setCells(sh, ex0._row, o); else { o.contact_id = Number(id) || id; appendObj(sh, o); }
        return { ok: true, id: id };
      }
      const ex = id ? all.filter(function (x) { return S(x[idf]) === id; })[0] : null;
      if (id && !ex) throw new Error('not-found');
      if (ex) setCells(sh, ex._row, o);
      else {
        let mx = 0; all.forEach(function (x) { const n = Number(x[idf]); if (isFinite(n) && n > mx) mx = n; });
        id = String(mx + 1); o[idf] = Number(id); o.created_at = now(); o.created_by = me.email;
        appendObj(sh, o);
      }
      return { ok: true, id: id };
    } finally { lock.releaseLock(); }
  },
  finDelete: function (M, me, req) {
    const tab = S(req.tab);
    need(me, FIN_SAL[tab] ? 'salary' : 'finance');
    if (!FIN_TABS[tab] || tab === 'PayInfo') throw new Error('bad-tab');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName(tab);
      const ex = objs(sh).filter(function (x) { return S(x[TABS[tab][0]]) === S(req.id); })[0];
      if (ex) delRow(sh, ex._row);
    } finally { lock.releaseLock(); }
    return { ok: true };
  },
  finSettings: function (M, me, req) {
    need(me, 'finance');
    const sh = M.book.getSheetByName('Settings');
    const all = objs(sh);
    ['exp_cats', 'inc_cats'].forEach(function (k) {
      if (!(k in (req.settings || {}))) return;
      const v = JSON.stringify([].concat(req.settings[k] || []).map(S).filter(Boolean).slice(0, 80));
      const ex = all.filter(function (x) { return S(x.key) === k; })[0];
      if (ex) setCells(sh, ex._row, { value: v, updated_at: now(), updated_by: me.email }); else appendObj(sh, { key: k, value: v, updated_at: now(), updated_by: me.email });
    });
    return { ok: true, settings: settingsOf(M) };
  },
  /** א צילום פון א קבלה → דרייב (אין דעם דאטאבייס) */
  upload: function (M, me, req) {
    need(me, 'finance');
    const m = S(req.data).match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/);
    if (!m) throw new Error('bad-file');
    if (m[2].length > 2800000) throw new Error('file-big');
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], (S(req.name) || 'receipt').slice(0, 80));
    const file = folderPath(['מוסדות אונגוואר', S(M.name) || M.key, 'קבלות הוצאות']).createFile(blob);
    file.setDescription('by ' + me.email + ' · ' + now());
    return { ok: true, id: file.getId() };
  },
  fileGet: function (M, me, req) {
    need(me, 'finance');
    const id = S(req.id);
    const used = objs(M.book.getSheetByName('Expenses')).some(function (x) { return S(x.receipt_file) === id; });
    if (!used) throw new Error('not-found');
    const b = DriveApp.getFileById(id).getBlob();
    return { data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
  },

  // ---------- 🗂 גיבויים (נאר בעלים / מנהל) ----------
  backups: function (M, me) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const out2 = { mosad: backupList(M.key) };
    if (me.role === 'owner') out2.main = backupList('main');
    return out2;
  },
  backupNow: function (M, me) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    makeBackup(M.key, M.book, 'ידני · ' + me.email);
    return { ok: true, mosad: backupList(M.key) };
  },
  /** צו זען א גיבוי: דער מענטש באקומט "צפייה" אויף דעם טעקע */
  backupOpen: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const f = backupFile(req.id, me.role === 'owner' ? [M.key, 'main'] : [M.key]);
    f.addViewer(me.email);
    return { url: f.getUrl() };
  },
  /** שחזור: די לשוניות פונעם גיבוי → אינעם גיליון פונעם מוסד (פריער — א גיבוי פונעם יעצטיגן) */
  backupRestore: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const f = backupFile(req.id, [M.key]);
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      makeBackup(M.key, M.book, 'לפני שחזור · ' + me.email);
      const src = SpreadsheetApp.openById(f.getId());
      src.getSheets().forEach(function (s2) {
        const name = s2.getName();
        if (name === 'Log') return; // דאס יומן בלייבט (מיט דעם שחזור אליין)
        let dst = M.book.getSheetByName(name);
        if (!dst) dst = M.book.insertSheet(name);
        const v = s2.getDataRange().getValues();
        dst.clearContents();
        if (v.length && v[0].length) dst.getRange(1, 1, v.length, v[0].length).setValues(v);
      });
      logIt(M, me, 'restore', '', f.getName());
    } finally { lock.releaseLock(); }
    return { ok: true };
  },

  // ---------- ישיבה: רישום, שכר לימוד, קבלות ----------
  school: function (M, me) {
    if (!isAdminRole(me) && !['students', 'alumni', 'parents', 'tuition', 'chavrusas', 'attendance', 'insurance', 'finance', 'dorm'].some(function (p) { return me.perms.indexOf(p) >= 0; })) throw new Error('no-permission');
    const tu = isAdminRole(me) || me.perms.indexOf('tuition') >= 0; // נאר מנהל מוסד
    const en = objs(M.book.getSheetByName('Enrollments')).filter(function (e) { return S(e.enroll_id); }).map(function (e) {
      const o = {};
      TABS.Enrollments.forEach(function (k) { if (tu || ['tuition_amount', 'month_amounts', 'tuition_period'].indexOf(k) < 0) o[k] = S(e[k]); });
      return o;
    });
    const out4 = { enrollments: en, tuitionAccess: tu, org: orgDetails(M) };
    if (tu) {
      out4.tuition = objs(M.book.getSheetByName('Tuition')).filter(function (p) { return S(p.payment_id); }).map(function (p) { const o = {}; TABS.Tuition.forEach(function (k) { o[k] = S(p[k]); }); return o; });
      out4.receipts = objs(M.book.getSheetByName('Receipts')).filter(function (r) { return S(r.receipt_no); }).map(function (r) { const o = {}; TABS.Receipts.forEach(function (k) { o[k] = S(r[k]); }); return o; });
    }
    return out4;
  },

  /** א רישום (נייער / טוישן). שכר לימוד-פעלדער נאר מיט "tuition" */
  enrollSave: function (M, me, req) {
    const pe = isAdminRole(me) || me.perms.indexOf('people_edit') >= 0;
    const tu = isAdminRole(me) || me.perms.indexOf('tuition') >= 0;
    if (!pe && !tu) throw new Error('no-permission');
    const e = req.enroll || {};
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Enrollments');
      const all = objs(sh);
      let id = S(e.enroll_id);
      const ex = id ? all.filter(function (x) { return S(x.enroll_id) === id; })[0] : null;
      if (id && !ex) throw new Error('not-found');
      if (!pe && !ex) throw new Error('no-permission'); // נאר "שכר לימוד" → נאר טוישן די סכומים פון א רישום וואס איז שוין דא
      const f = (pe ? ['contact_id', 'parent_id', 'status', 'start_date', 'end_date', 'zman', 'shiur', 'room', 'note'] : [])
        .concat(tu ? ['tuition_amount', 'tuition_period', 'month_amounts'] : []);
      const o = {};
      f.forEach(function (k) { if (k in e) o[k] = S(e[k]); });
      const mine = {}; peopleRows(M).forEach(function (p) { mine[S(p.contact_id)] = true; });
      const cid = 'contact_id' in o ? o.contact_id : S(ex && ex.contact_id);
      if (!mine[cid]) throw new Error('not-yours');
      req._cid = cid; req._pid = S('parent_id' in o ? o.parent_id : (ex && ex.parent_id)); // פאר די תגיות אינעם הויפט-מאגר
      if (ex && S(ex.parent_id) && S(ex.parent_id) !== req._pid) req._pid2 = S(ex.parent_id);
      if (o.parent_id && !mine[o.parent_id]) throw new Error('not-yours');
      ['contact_id', 'parent_id'].forEach(function (k) { if (o[k] && isFinite(Number(o[k]))) o[k] = Number(o[k]); });
      o.updated_at = now(); o.updated_by = me.email;
      if (ex) setCells(sh, ex._row, o);
      else {
        let mx = 0; all.forEach(function (x) { const n = Number(x.enroll_id); if (isFinite(n) && n > mx) mx = n; });
        id = String(mx + 1);
        o.enroll_id = Number(id); o.created_at = now(); o.created_by = me.email;
        if (!o.status) o.status = 'לומד';
        if (!o.tuition_period) o.tuition_period = 'month';
        appendObj(sh, o);
      }
      logIt(M, me, 'enroll', cid, id);
      return { ok: true, enroll_id: id };
    } finally { lock.releaseLock(); }
  },
  enrollDelete: function (M, me, req) {
    need(me, 'people_edit');
    const id = S(req.enroll_id);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (objs(M.book.getSheetByName('Tuition')).some(function (p) { return S(p.enroll_id) === id; })) throw new Error('has-payments');
      const sh = M.book.getSheetByName('Enrollments');
      const ex = objs(sh).filter(function (x) { return S(x.enroll_id) === id; })[0];
      if (!ex) return { ok: true };
      delRow(sh, ex._row);
      req._cid = S(ex.contact_id); req._pid = S(ex.parent_id);
      logIt(M, me, 'enroll-delete', S(ex.contact_id), id);
    } finally { lock.releaseLock(); }
    return { ok: true };
  },

  /** א תשלום (נייער / טוישן). נאך א קבלה — דער סכום טוישט מען נישט (ערשט בטל'ן די קבלה) */
  paySave: function (M, me, req) {
    need(me, 'tuition');
    const p = req.pay || {};
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const en = objs(M.book.getSheetByName('Enrollments')).filter(function (x) { return S(x.enroll_id) === S(p.enroll_id); })[0];
      if (!en) throw new Error('not-found');
      const mine = {}; peopleRows(M).forEach(function (x) { mine[S(x.contact_id)] = true; });
      const payer = S(p.payer_id) || S(en.parent_id) || S(en.contact_id);
      if (!mine[payer]) throw new Error('not-yours');
      const amount = Math.round(Number(p.amount) * 100) / 100;
      if (!(amount > 0)) throw new Error('bad-amount');
      const last4 = S(p.card_last4).replace(/\D/g, '');
      if (last4 && last4.length !== 4) throw new Error('bad-last4');
      const sh = M.book.getSheetByName('Tuition');
      const all = objs(sh);
      const o = { enroll_id: Number(en.enroll_id), contact_id: Number(en.contact_id) || en.contact_id, payer_id: Number(payer) || payer, date: S(p.date).slice(0, 10), amount: amount,
        method: S(p.method), check_number: S(p.check_number), card_last4: last4, for_text: S(p.for_text), note: S(p.note), updated_at: now(), updated_by: me.email };
      let id = S(p.payment_id);
      if (id) {
        const ex = all.filter(function (x) { return S(x.payment_id) === id; })[0];
        if (!ex) throw new Error('not-found');
        if (S(ex.receipt_no) && Number(ex.amount) !== amount) throw new Error('has-receipt');
        setCells(sh, ex._row, o);
      } else {
        // אויך פון די קבלות — א נומער פון אן אויסגעמעקטן תשלום ווערט נישט ווידער גענוצט
        let mx = 0; all.concat(objs(M.book.getSheetByName('Receipts'))).forEach(function (x) { const n = Number(x.payment_id); if (isFinite(n) && n > mx) mx = n; });
        id = String(mx + 1);
        o.payment_id = Number(id); o.created_at = now(); o.created_by = me.email;
        appendObj(sh, o);
      }
      logIt(M, me, 'pay', S(en.contact_id), id + ' $' + amount);
      return { ok: true, payment_id: id };
    } finally { lock.releaseLock(); }
  },
  payDelete: function (M, me, req) {
    need(me, 'tuition');
    const id = S(req.payment_id);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Tuition');
      const ex = objs(sh).filter(function (x) { return S(x.payment_id) === id; })[0];
      if (!ex) return { ok: true };
      if (S(ex.receipt_no)) throw new Error('has-receipt');
      delRow(sh, ex._row);
      logIt(M, me, 'pay-delete', S(ex.contact_id), id + ' $' + S(ex.amount));
    } finally { lock.releaseLock(); }
    return { ok: true };
  },

  /** א קבלה פאר א תשלום — די זעלבע ווען ס'איז שוין דא; אנדערש א נייער נומער אין דער סעריע פונעם מוסד */
  receipt: function (M, me, req) {
    need(me, 'tuition');
    const id = S(req.payment_id);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const ts = M.book.getSheetByName('Tuition');
      const p = objs(ts).filter(function (x) { return S(x.payment_id) === id; })[0];
      if (!p) throw new Error('not-found');
      const rs = M.book.getSheetByName('Receipts');
      const all = objs(rs);
      let r = S(p.receipt_no) ? all.filter(function (x) { return S(x.receipt_no) === S(p.receipt_no) && !isVoid(x); })[0] : null;
      let copy = Boolean(r);
      if (!r) {
        const od = orgDetails(M);
        // די סעריע פון קבלות: Mosdos → receipt_prefix (למשל BS), אנדערש פון OrgDetails
        const pre = (M.prefix || S(od.receipt_prefix) || M.key).toUpperCase() + '-';
        let mx = 1000;
        all.forEach(function (x) { const m = S(x.receipt_no).match(/(\d+)$/); if (m && Number(m[1]) > mx) mx = Number(m[1]); });
        r = { receipt_no: pre + (mx + 1), payment_id: Number(id), contact_id: p.contact_id, payer_id: p.payer_id, amount: Number(p.amount), issued_at: now(), issued_by: me.email, void: '' };
        appendObj(rs, r);
        setCells(ts, p._row, { receipt_no: r.receipt_no });
        logIt(M, me, 'receipt', S(p.contact_id), r.receipt_no);
      }
      const ids = {}; [S(p.payer_id), S(p.contact_id)].forEach(function (x) { if (x) ids[x] = true; });
      const people = objs(main().getSheetByName('Contacts')).filter(function (c) { return ids[S(c.contact_id)]; }).map(function (c) { return contactView(c, null); });
      const pr = {}; TABS.Tuition.forEach(function (k) { pr[k] = S(p[k]); });
      pr.receipt_no = S(r.receipt_no);
      return { receipt: { receipt_no: S(r.receipt_no), issued_at: S(r.issued_at), copy: copy }, payment: pr, people: people, org: orgDetails(M) };
    } finally { lock.releaseLock(); }
  },
  receiptVoid: function (M, me, req) {
    need(me, 'tuition');
    const no = S(req.receipt_no);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const rs = M.book.getSheetByName('Receipts');
      const r = objs(rs).filter(function (x) { return S(x.receipt_no) === no; })[0];
      if (!r) throw new Error('not-found');
      setCells(rs, r._row, { void: 'TRUE', void_by: me.email, void_at: now(), note: S(req.why) });
      const ts = M.book.getSheetByName('Tuition');
      objs(ts).filter(function (x) { return S(x.receipt_no) === no; }).forEach(function (x) { setCells(ts, x._row, { receipt_no: '' }); });
      logIt(M, me, 'receipt-void', S(r.contact_id), no + (S(req.why) ? ' — ' + S(req.why) : ''));
    } finally { lock.releaseLock(); }
    return { ok: true };
  },

  /** פונעם הויפט-אתר: וואו לערנט דער מענטש (פאר דעם כרטיס) */
  whereIs: function (M, me, req) {
    const id = S(req.contact_id);
    const en = objs(M.book.getSheetByName('Enrollments')).filter(function (e) { return S(e.contact_id) === id || S(e.parent_id) === id; })
      .map(function (e) { return { contact_id: S(e.contact_id), parent_id: S(e.parent_id), status: S(e.status), shiur: S(e.shiur), start: S(e.start_date).slice(0, 10), end: S(e.end_date).slice(0, 10) }; });
    return { mosad: { key: M.key, name: M.name }, enrollments: en };
  },

  // ---------- צוות און הרשאות (נאר בעלים / מנהל) ----------
  staff: function (M, me) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const list = objs(M.book.getSheetByName('Staff')).filter(function (s) { return S(s.email); })
      .map(function (s) { return { email: S(s.email).toLowerCase(), name: S(s.name), role: S(s.role) === 'admin' ? 'admin' : 'staff', perms: S(s.perms).split(',').map(S).filter(Boolean), active: S(s.active) !== 'FALSE' && String(s.active) !== 'false' }; });
    return { staff: list, owners: M.owners, permsAll: PERMS.filter(function (p) { return MGR_PERMS.indexOf(p) < 0; }) };
  },
  staffSave: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const s = req.staff || {};
    const email = S(s.email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('bad-email');
    if (M.owners.indexOf(email) >= 0) throw new Error('is-owner'); // דעם בעלים טוישט מען נישט
    const role = S(s.role) === 'admin' ? 'admin' : 'staff';
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Staff');
      const ex = objs(sh).filter(function (x) { return S(x.email).toLowerCase() === email; })[0];
      // נאר דער בעלים מעג מאכן / טוישן / אראפנעמען א מנהל
      if (me.role !== 'owner' && (role === 'admin' || (ex && S(ex.role) === 'admin'))) throw new Error('owner-only');
      const perms = (s.perms || []).map(S).filter(function (p) { return PERMS.indexOf(p) >= 0; }).join(',');
      const o = { email: email, name: S(s.name), role: role, perms: perms, active: s.active === false ? false : true, updated_by: me.email, updated_at: now() };
      if (ex) setCells(sh, ex._row, o);
      else { o.added_by = me.email; o.added_at = now(); appendObj(sh, o); }
      logIt(M, me, 'staff', '', email + ' ' + role + ' ' + perms + (o.active ? '' : ' (off)'));
    } finally { lock.releaseLock(); }
    return { ok: true };
  },
  staffRemove: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const email = S(req.email).toLowerCase();
    if (M.owners.indexOf(email) >= 0) throw new Error('is-owner');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = M.book.getSheetByName('Staff');
      const ex = objs(sh).filter(function (x) { return S(x.email).toLowerCase() === email; })[0];
      if (!ex) return { ok: true };
      if (me.role !== 'owner' && S(ex.role) === 'admin') throw new Error('owner-only');
      delRow(sh, ex._row);
      logIt(M, me, 'staff-remove', '', email);
    } finally { lock.releaseLock(); }
    return { ok: true };
  },
};

/** דער נאמען און לאגא פונעם מוסד (אן לאגאין — גאר נישט קיין פריוואטע ידיעות) */
function brandOf(key) {
  const k = S(key);
  const cache = CacheService.getScriptCache();
  const hit = cache.get('brand:' + k);
  if (hit) return JSON.parse(hit);
  const m = objs(main().getSheetByName('Mosdos')).filter(function (x) { return S(x.key) === k; })[0];
  const o = m ? { name: S(m.name), logo: /^data:image\//.test(S(m.logo)) ? S(m.logo) : '' } : { name: '', logo: '' };
  try { cache.put('brand:' + k, JSON.stringify(o), 3600); } catch (err) { /* צו גרויס */ }
  return o;
}
function onReceipt(ss, donationId) {
  return objs(ss.getSheetByName('Receipts')).some(function (r) { return !isVoid(r) && S(r.donation_ids).split(',').map(S).indexOf(String(donationId)) >= 0; });
}
function nextDonationId(ss) {
  let mx = 0;
  objs(ss.getSheetByName('Donations')).forEach(function (x) { const n = Number(x.donation_id); if (isFinite(n) && n > mx) mx = n; });
  objs(ss.getSheetByName('Receipts')).forEach(function (r) { S(r.donation_ids).split(',').forEach(function (x) { const n = Number(x); if (isFinite(n) && n > mx) mx = n; }); });
  return mx + 1;
}
/** א רשימה פון לשונית Lists (א קאלאנע) */
function listValues(col) {
  const r = rows(main().getSheetByName('Lists'));
  const j = r.head.indexOf(col);
  return j < 0 ? [] : r.body.map(function (row) { return S(row[j]); }).filter(Boolean);
}
/** די פרטים פון א ארגון (OrgDetails) — פאר א קבלה */
function orgDetByName(org) {
  const row = objs(main().getSheetByName('OrgDetails')).filter(function (o) { return S(o.org) === org; })[0] || {};
  const keep = ['legal_name', 'address', 'city_state_zip', 'phone', 'email', 'website', 'ein', 'is_501c3', 'signer_name', 'signer_title', 'receipt_note', 'org_name_he', 'tax_text'];
  const o = { org: org }; keep.forEach(function (k) { o[k] = S(row[k]); });
  return o;
}
/** הגדרות פונעם מוסד (מיט ברירות מחדל) */
// att = יש השתתפות (slots = משבצות ליום), chav = יש חברותות
const DEFAULT_SEDARIM = [
  { key: 'shacharis', name: 'שחרית', att: true, chav: false, slots: 1, days: [0, 1, 2, 3, 4] },
  { key: 'lifnei', name: 'לפנה"צ (סדר עיון)', att: false, chav: true, slots: 1, days: [0, 1, 2, 3, 4] },
  { key: 'achar', name: 'אחה"צ', att: true, chav: true, slots: 2, days: [0, 1, 2, 3, 4] },
  { key: 'shlishi', name: 'סדר שלישי', att: true, chav: true, slots: 2, days: [0, 1, 2, 3, 4] },
];
function putSetting(M, me, key, v) {
  const sh = M.book.getSheetByName('Settings');
  const ex = objs(sh).filter(function (x) { return S(x.key) === key; })[0];
  if (ex) setCells(sh, ex._row, { value: v, updated_at: now(), updated_by: me.email });
  else appendObj(sh, { key: key, value: v, updated_at: now(), updated_by: me.email });
}
function settingsOf(M) {
  // calendar: 'il' = לוח ארץ ישראל (פרשיות), 'chul' = חוץ לארץ
  const o = { sedarim: DEFAULT_SEDARIM, avreich_rate: '', calendar: 'il',
    exp_cats: ['שכירות', 'אוכל', 'חשמל ומים', 'הסעות', 'קניות', 'תיקונים ואחזקה', 'ספרים', 'אחר'],
    inc_cats: ['משרד החינוך', 'משרד הדתות', 'קהל אונגוואר', 'הלוואה שהתקבלה', 'אחר'] };
  objs(M.book.getSheetByName('Settings')).forEach(function (x) {
    const k = S(x.key);
    if (k === 'sedarim' || k === 'exp_cats' || k === 'inc_cats') { try { const v = JSON.parse(S(x.value)); if (v && v.length) o[k] = v; } catch (err) { /* */ } }
    else if (k === 'rooms') { try { const v = JSON.parse(S(x.value)); if (Array.isArray(v)) o.rooms = v; } catch (err) { /* */ } }
    else if (k === 'dorm_bld') { try { const v = JSON.parse(S(x.value)); if (Array.isArray(v)) o.dorm_bld = v; } catch (err) { /* */ } }
    else if (k && k.indexOf('dormimg:') !== 0 && k !== 'reg' && k.indexOf('reg_txt:') !== 0 && k !== 'kitchen_workers' && k !== 'budget' && k !== 'k_phones') o[k] = S(x.value); // budget — רק עם הרשאה (budgetGet); k_phones — טלפונים מורשים לקו // kitchen_workers (סיסמאות) — קיינמאל נישט צום אתר
  });
  return o;
}
/** א צייט פון גיליון → 'HH:mm' */
function hhmm(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ || main().getSpreadsheetTimeZone(), 'HH:mm');
  return S(v).replace(/^'/, '').slice(0, 5);
}
const FIN_TABS = { PayInfo: true, PayItems: true, PayPayments: true, Expenses: true, Incomes: true, Debts: true, Repayments: true };
const FIN_SAL = { PayInfo: true, PayItems: true, PayPayments: true, Incomes: true }; // נאר מנהל מוסד
const SECRET = { PayInfo: true, PayItems: true, PayPayments: true, Expenses: true, Incomes: true, Debts: true, Repayments: true };
/** דער צוות-מענטש וואס איז אריינגעקומען (לויט זיין גוגל-אדרעס) */
function teamOf(M, email) {
  const t = objs(M.book.getSheetByName('Team')).filter(function (x) { return S(x.email).toLowerCase() === email && !isOff(x.active); })[0];
  if (!t) return null;
  const o = {}; TABS.Team.forEach(function (k) { o[k] = S(t[k]); }); return o;
}
function clockState(M, t) {
  const d = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
  const ex = objs(M.book.getSheetByName('Hours')).filter(function (x) { return S(x.date).slice(0, 10) === d && S(x.contact_id) === S(t.contact_id); })[0];
  return { date: d, time_in: ex ? hhmm(ex.time_in) : '', time_out: ex ? hhmm(ex.time_out) : '' };
}
/** א טעקע אין דרייב: ['א', 'ב', 'ג'] — מאכט וואס פעלט */
function folderPath(parts) {
  let f = DriveApp.getRootFolder();
  parts.forEach(function (p) { const it = f.getFoldersByName(p); f = it.hasNext() ? it.next() : f.createFolder(p); });
  return f;
}
const BK_DAYS = 14; const BK_MONTHS = 6;
function backupFolder() { return folderPath(['מוסדות אונגוואר', 'גיבויים']); }
/** א קאפיע פונעם גאנצן גיליון: "גיבוי <key> 2026-10-25 03:00" */
function makeBackup(key, book, why) {
  const stamp = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd HH:mm');
  const f = DriveApp.getFileById(book.getId()).makeCopy('גיבוי ' + key + ' ' + stamp, backupFolder());
  f.setDescription(why || 'אוטומטי');
  pruneBackups(key);
  return f;
}
function backupList(key) {
  const it = backupFolder().getFiles();
  const list = [];
  const pre = 'גיבוי ' + key + ' ';
  while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf(pre) === 0) list.push({ id: f.getId(), name: f.getName(), at: f.getName().slice(pre.length), why: f.getDescription() || '' }); }
  return list.sort(function (a, b) { return b.at < a.at ? -1 : 1; });
}
function backupFile(id, keys) {
  const f = DriveApp.getFileById(S(id));
  const ok = f.getParents().hasNext() && f.getParents().next().getId() === backupFolder().getId() && keys.some(function (k) { return f.getName().indexOf('גיבוי ' + k + ' ') === 0; });
  if (!ok) throw new Error('not-found');
  return f;
}
/** לאזן: די לעצטע 14 טעג, און דער ערשטער פון יעדן חודש פאר 6 חדשים */
function pruneBackups(key) {
  const list = backupList(key);
  const keep = {};
  const days = []; list.forEach(function (b) { const d = b.at.slice(0, 10); if (days.indexOf(d) < 0) days.push(d); });
  const recentDays = days.slice(0, BK_DAYS);
  list.forEach(function (b) { if (recentDays.indexOf(b.at.slice(0, 10)) >= 0) keep[b.id] = true; });
  const months = {};
  list.slice().reverse().forEach(function (b) { const m = b.at.slice(0, 7); if (!months[m]) months[m] = b.id; });
  Object.keys(months).sort().reverse().slice(0, BK_MONTHS).forEach(function (m) { keep[months[m]] = true; });
  list.forEach(function (b) { if (!keep[b.id]) { try { DriveApp.getFileById(b.id).setTrashed(true); } catch (err) { /* */ } } });
}
/** יעדע נאכט (טריגער): אלע מוסדות + דער הויפט-גיליון */
function nightlyBackup() {
  makeBackup('main', main(), 'אוטומטי');
  objs(main().getSheetByName('Mosdos')).forEach(function (m) {
    if (!S(m.key) || !S(m.sheet_id)) return;
    try { makeBackup(S(m.key), SpreadsheetApp.openById(S(m.sheet_id)), 'אוטומטי'); } catch (err) { Logger.log('backup ' + S(m.key) + ': ' + err); }
  });
}
/** פונעם עדיטאר, איינמאל: א טריגער פאר יעדע נאכט 3:00 (ירושלים), און א ערשטער גיבוי */
function installBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'nightlyBackup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('nightlyBackup').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Jerusalem').create();
  nightlyBackup();
  Logger.log('OK: ' + backupList('main').length + ' main, ' + backupList('yeshiva').length + ' yeshiva');
}
/** דער "שלד" פון א נאמען — אן אהוי"ע, ס=ז, ת=ט, ק=כ, סוף-אותיות — כדי צו געפינען אנדערע שרייבונגען */
function skel(t) {
  return String(t || '').toLowerCase().replace(/[ם]/g, 'מ').replace(/[ן]/g, 'נ').replace(/[ץ]/g, 'צ').replace(/[ף]/g, 'פ').replace(/[ך]/g, 'כ')
    .replace(/[אהויע"'״׳\-]/g, '').replace(/ס/g, 'ז').replace(/ת/g, 'ט').replace(/ק/g, 'כ');
}
function isVoid(r) { const v = S(r.void).toLowerCase(); return v === 'true' || v === '1' || v === 'yes'; }
/** די פרטים פונעם מוסד פאר א קבלה (פון OrgDetails אינעם הויפט-גיליון) */
function orgDetails(M) {
  const cache = CacheService.getScriptCache();
  const ck = 'od:' + M.key;
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const row = objs(main().getSheetByName('OrgDetails')).filter(function (o) { return S(o.org) === M.org; })[0] || {};
  const keep = ['legal_name', 'address', 'city_state_zip', 'phone', 'email', 'website', 'ein', 'is_501c3', 'signer_name', 'signer_title', 'receipt_prefix', 'receipt_note', 'org_name_he', 'sub_line', 'tax_text', 'thanks_yi'];
  // ווען דער לאגא פונעם מוסד איז נישט אין OrgDetails — פון Mosdos
  const o = {}; keep.forEach(function (k) { o[k] = S(row[k]); });
  o.logo = '';
  const lg = objs(main().getSheetByName('OrgLogos')).filter(function (x) { return S(x.org) === M.org; })[0];
  if (lg && /^data:image\//.test(S(lg.logo_data)) && S(lg.logo_data).length < 90000) o.logo = S(lg.logo_data);
  if (!o.logo) o.logo = brandOf(M.key).logo;
  cache.put(ck, JSON.stringify(o), 600);
  return o;
}

/** פונעם עדיטאר, איינמאל: די רישומים / תשלומים פון דער ישיבה → אינעם גיליון פון דער ישיבה, און ארויס פונעם הויפט-גיליון */
function migrateYeshiva() {
  const M = mosadOf('yeshiva');
  const ss = main();
  const moved = {};
  [['Enrollments', 'enroll_id'], ['Tuition', 'payment_id']].forEach(function (pair) {
    const tab = pair[0]; const idf = pair[1];
    const src = ss.getSheetByName(tab);
    const rowsMain = objs(src).filter(function (x) { return S(x.org) === M.org && S(x[idf]); });
    const dst = M.book.getSheetByName(tab);
    const have = {}; objs(dst).forEach(function (x) { have[S(x[idf])] = true; });
    const head = headOf(dst);
    const add = rowsMain.filter(function (x) { return !have[S(x[idf])]; })
      .map(function (x) { return head.map(function (h) { return x[h] === undefined ? '' : x[h]; }); });
    if (add.length) dst.getRange(dst.getLastRow() + 1, 1, add.length, head.length).setValues(add);
    // ערשט נאכן איבערשרייבן — נאכאמאל לייענען און באשטעטיגן, דערנאך ארויסנעמען פונעם הויפט-גיליון (פון אונטן)
    const now2 = {}; objs(dst).forEach(function (x) { now2[S(x[idf])] = true; });
    const ok = rowsMain.every(function (x) { return now2[S(x[idf])]; });
    if (!ok) throw new Error(tab + ': copy check failed — nothing removed');
    rowsMain.map(function (x) { return x._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { src.deleteRow(r); });
    moved[tab] = rowsMain.length;
  });
  seedPeople(M.book, M.org);
  Logger.log('moved: ' + JSON.stringify(moved) + ' · people: ' + (M.book.getSheetByName('People').getLastRow() - 1));
}

/** א פראבע פונעם עדיטאר: הפעלה ← testMosad (באשטעטיגט דעם צוטריט און מאכט דעם גיליון פון דער ישיבה) */
function testMosad() {
  const M = mosadOf('yeshiva');
  Logger.log(M ? ('OK: ' + M.name + ' · ' + M.book.getUrl() + ' · owners: ' + M.owners.join(', ') + ' · people: ' + (M.book.getSheetByName('People').getLastRow() - 1)) : 'no row "yeshiva" in Mosdos');
}

/** פונעם עדיטאר: וויפיל צייט נעמט יעדער טייל (צו געפינען וואס איז פאמעלעך) */
function perfTest() {
  const t = function (label, fn) { const a = Date.now(); const r = fn(); Logger.log(label + ': ' + (Date.now() - a) + 'ms'); return r; };
  const M = t('mosadOf', function () { return mosadOf('yeshiva'); });
  const me = { email: M.owners[0], role: 'owner', perms: PERMS.slice(), name: '' };
  CUR = null;
  t('roleOf', function () { return roleOf(M, me.email); });
  ['Contacts', 'Phones', 'Relations', 'Donations', 'Receipts', 'History'].forEach(function (n) { t('main ' + n + ' (' + main().getSheetByName(n).getLastRow() + ' rows, ' + main().getSheetByName(n).getLastColumn() + ' cols)', function () { return objs(main().getSheetByName(n)).length; }); });
  Object.keys(TABS).forEach(function (n) { t('mosad ' + n, function () { return objs(M.book.getSheetByName(n)).length; }); });
  ['me', 'people', 'school', 'tasks', 'team', 'fin', 'gifts', 'log'].forEach(function (a) { t('ACTION ' + a, function () { return JSON.stringify(ACTIONS[a](M, me, {})).length; }); });
}
/** פונעם עדיטאר: וויפיל צייט נעמט די טעינה פון אלעס (batch) — יעדע קריאה באזונדער, און אלעס צוזאמען */
function perfBatch() {
  const M = mosadOf('yeshiva');
  const me = { email: M.owners[0], role: 'owner', perms: PERMS.slice(), name: '' };
  dropCaches(M, true, true, true);
  const calls = ['me', 'people', 'school', 'gifts', 'fin', 'team', 'tasks', 'ins', 'users', 'staff'].map(function (a) { return { action: a }; });
  MEMO = {};
  const t0 = Date.now();
  calls.forEach(function (c) { const a = Date.now(); const r = ACTIONS[c.action](M, me, {}); Logger.log(c.action + ': ' + (Date.now() - a) + 'ms, ' + JSON.stringify(r).length + ' bytes'); });
  MEMO = null;
  Logger.log('TOTAL cold: ' + (Date.now() - t0) + 'ms');
  const t1 = Date.now();
  ACTIONS.batch(M, me, { calls: calls });
  Logger.log('TOTAL batch (first): ' + (Date.now() - t1) + 'ms');
  const t2 = Date.now();
  ACTIONS.batch(M, me, { calls: calls });
  Logger.log('TOTAL batch (cached): ' + (Date.now() - t2) + 'ms');
  // "אינדערפרי": גוגל'ס cache ליידיג, אבער די קאפיע אינעם גיליון איז דא
  const sig = 'all';
  const ck = 'bundle:' + skelHash(sig) + ':' + skelHash(JSON.stringify(calls.filter(function (c) { return c.action !== 'me' && c.action !== 'tasks'; })));
  CacheService.getScriptCache().removeAll(['ppl:' + M.key, 'names:main', 'don:' + M.key, ck, ck + ':0', ck + ':1', ck + ':2', ck + ':3', ck + ':4', ck + ':5']);
  MIRROR = null; MAIN_UPD = null; GEN = {};
  const t3 = Date.now();
  ACTIONS.batch(M, me, { calls: calls });
  Logger.log('TOTAL batch (morning, from mirror): ' + (Date.now() - t3) + 'ms');
}

// ---------- תגיות פון דער ישיבה אינעם הויפט-מאגר (עץ התגיות: 2 > o:<org> > 40 תלמיד / 41 הורה / 42 צוות) ----------
const Y_NODE = { student: '40', parent: '41', staff: '42', avreich: '115' }; // 115 = צוות אברכים
/** וואס די תגיות פון יעדן מענטש אין דער ישיבה דארפן זיין, לויט די ידיעות פון דער ישיבה: { id: { student: 'a'|'f', parent, staff, avreich } } */
function yeshivaExpected(M) {
  const t = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
  const en = objs(M.book.getSheetByName('Enrollments')).filter(function (e) { return S(e.enroll_id); });
  const activeE = function (e) { const end = S(e.end_date).slice(0, 10); return S(e.status) !== 'יצא' && !(end && end < t); };
  const exp = {};
  const set = function (id, k, on) { id = S(id); if (!id) return; exp[id] = exp[id] || {}; exp[id][k] = (exp[id][k] === 'a' || on) ? 'a' : 'f'; };
  en.forEach(function (e) { set(e.contact_id, 'student', activeE(e)); if (S(e.parent_id)) set(e.parent_id, 'parent', activeE(e)); });
  const team = objs(M.book.getSheetByName('Team'));
  peopleRows(M).forEach(function (p) {
    const kinds = S(p.kind).split(',').map(S);
    const tm = team.filter(function (x) { return S(x.contact_id) === S(p.contact_id); })[0];
    const on = !tm || !isOff(tm.active);
    if (kinds.indexOf('staff') >= 0) set(p.contact_id, 'staff', on);
    if (kinds.indexOf('avreich') >= 0) set(p.contact_id, 'avreich', on);
  });
  return exp;
}
/** פונעם עדיטאר: א באריכט (גארנישט ווערט געטוישט) */
function yeshivaTagsReport() {
  const M = mosadOf('yeshiva');
  const exp = yeshivaExpected(M);
  const org = 'o:' + M.org;
  const rows = objsCols(main().getSheetByName('Contacts'), ['contact_id', 'tags', 'deleted_at']);
  const by = {}; rows.forEach(function (r) { by[S(r.contact_id)] = r; });
  const n = { people: 0, missing: 0, unchecked: 0, okAlready: 0, otherU: 0, tagMissing: 0, tagWrong: 0, tagRight: 0, uYeshiva: 0 };
  const samples = [];
  Object.keys(exp).forEach(function (id) {
    n.people++;
    const r = by[id];
    if (!r || S(r.deleted_at)) { n.missing++; return; }
    let tg = []; try { tg = JSON.parse(S(r.tags) || '[]'); } catch (err) { tg = []; }
    const ok = tg.some(function (x) { return x.p && x.p[0] === '_ok'; });
    if (ok) n.okAlready++; else n.unchecked++;
    const isY = function (x) { return x.p && String(x.p[0]) === '2' && String(x.p[1]) === org; };
    if (tg.some(function (x) { return !isY(x) && x.s === 'u' && x.p && String(x.p[0]) !== '8'; })) n.otherU++;
    Object.keys(exp[id]).forEach(function (k) {
      const cur = tg.filter(function (x) { return isY(x) && String(x.p[2]) === Y_NODE[k]; })[0];
      if (!cur) n.tagMissing++;
      else if (cur.s === 'u') n.uYeshiva++;
      else if (cur.s !== exp[id][k]) { n.tagWrong++; if (samples.length < 15) samples.push(id + ' ' + k + ': ' + cur.s + ' → ' + exp[id][k]); }
      else n.tagRight++;
    });
  });
  Logger.log(JSON.stringify(n));
  Logger.log('wrong: ' + samples.join(' | '));
}

/** איין מענטש: די תגיות לויט דער ישיבה. e = { student|parent|staff: 'a'|'f' }. מחזיר { tags, changed, ok } */
function yTagsApply(tg, e, org, today) {
  const isY = function (x) { return x.p && String(x.p[0]) === '2' && String(x.p[1]) === org; };
  let changed = false;
  const anyA = Object.keys(e).some(function (k) { return e[k] === 'a'; });
  Object.keys(e).forEach(function (k) {
    const cur = tg.filter(function (x) { return isY(x) && String(x.p[2]) === Y_NODE[k]; })[0];
    if (!cur) { tg.push({ p: ['2', org, Y_NODE[k]], s: e[k], d: today }); changed = true; }
    else if (cur.s !== e[k]) { cur.s = e[k]; cur.d = today; delete cur.o; changed = true; }
  });
  // "די ישיבה" אליין (אן א תפקיד), פון די אלטע רשימות
  tg.forEach(function (x) { if (isY(x) && !x.p[2] && x.s === 'u') { x.s = anyA ? 'a' : 'f'; x.d = today; delete x.o; changed = true; } });
  // "⚠ לא נבדק" אוועק — נאר ווען קיין אנדערע תגית (אויסער דער אלטער רשימה) איז נישט "לא נבדק"
  const hasOk = tg.some(function (x) { return x.p && x.p[0] === '_ok'; });
  const otherU = tg.some(function (x) { return x.p && x.s === 'u' && !isY(x) && String(x.p[0]) !== '8' && x.p[0] !== '_ok'; });
  let ok = false;
  if (!hasOk && !otherU) {
    tg.forEach(function (x) { if (x.s === 'u') { x.s = x.o === 'f' ? 'f' : 'a'; x.d = today; delete x.o; } });
    tg.push({ p: ['_ok'], s: 'ok', d: today });
    changed = true; ok = true;
  }
  return { tags: tg, changed: changed, ok: ok };
}
/** די תגיות פון דער ישיבה → אינעם הויפט-מאגר (ids ליידיג = אלע). מחזיר וויפל געטוישט */
function syncYeshivaTags(M, ids, by) {
  const exp = yeshivaExpected(M);
  const want = ids ? ids.map(S).filter(function (id) { return exp[id]; }) : Object.keys(exp);
  if (!want.length) return { changed: 0, ok: 0 };
  const sh = main().getSheetByName('Contacts');
  const head = headOf(sh);
  const cT = head.indexOf('tags') + 1, cU = head.indexOf('updated_at') + 1, cB = head.indexOf('updated_by') + 1;
  const rows = objsCols(sh, ['contact_id', 'tags', 'deleted_at']);
  const by2 = {}; rows.forEach(function (r) { by2[S(r.contact_id)] = r; });
  const today = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  const org = 'o:' + M.org;
  const hist = [];
  const at = now();
  const who = (by || 'system') + ' @' + M.key;
  let n = 0, okN = 0;
  want.forEach(function (id) {
    const r = by2[id];
    if (!r || S(r.deleted_at)) return;
    const old = S(r.tags);
    let tg = []; try { tg = JSON.parse(old || '[]'); if (!Array.isArray(tg)) tg = []; } catch (err) { return; } // א צעל וואס מ'קען נישט לייענען — נישט אנרירן
    const res = yTagsApply(tg, exp[id], org, today);
    if (!res.changed) return;
    const nv = JSON.stringify(res.tags);
    sh.getRange(r._row, cT).setValue(nv);
    if (cU) sh.getRange(r._row, cU).setValue(at);
    if (cB) sh.getRange(r._row, cB).setValue(who);
    hist.push([at, who, 'contact', id, id, 'tags', old.slice(0, 45000), nv.slice(0, 45000)]);
    n++; if (res.ok) okN++;
  });
  const h = main().getSheetByName('History');
  if (h && hist.length) h.getRange(h.getLastRow() + 1, 1, hist.length, hist[0].length).setValues(hist);
  if (n) dropCaches(M, false, false, false);
  return { changed: n, ok: okN };
}
/** פונעם עדיטאר, איינמאל: א גיבוי פונעם הויפט-גיליון, און דערנאך אלע מענטשן פון דער ישיבה */
function yeshivaTagsFix() {
  makeBackup('main', main(), 'לפני סידור התגיות של הישיבה');
  const M = mosadOf('yeshiva');
  const r = syncYeshivaTags(M, null, M.owners[0] || 'owner');
  Logger.log('changed: ' + r.changed + ', ⚠ removed: ' + r.ok);
}

// =====================================================================================
// 📝 רישום לישיבה: מועמדים (Applicants), היסטאריע (AppLog), א טופס פארן עולם (pub*), און א אזור אישי פאר די עלטערן.
// א מועמד איז נישט קיין "מענטש" אינעם מאגר — ביז מ'לייגט אים אריבער ("העבר לתלמידים", נאך "נתקבל").
// =====================================================================================
TABS.Applicants = ['app_id', 'token', 'created_at', 'period', 'status', 'lang', 'first_name', 'last_name', 'birth_date', 'birth_heb', 'home_phone',
  'engaged', 'wedding_date', 'wedding_heb', 'father_name', 'mother_family', 'father_phone', 'mother_phone', 'email', 'community', 'address', 'city', 'state', 'zip', 'country',
  'yeshiva_ketana', 'yeshiva_gedola', 'yeshiva_other', 'staff1_name', 'staff1_phone', 'staff2_name', 'staff2_phone', 'staff3_name', 'staff3_phone', 'notes',
  'under_age_ack', 'consents_at', 'consents_ver', 'photo_file', 'passport_file', 'birth_file', 'photo_state', 'passport_state', 'birth_state',
  'pay_reg', 'pay_visa', 'portal_edit', 'folder_id', 'contact_id', 'parent_id', 'enroll_id', 'transferred_at', 'test', 'updated_at', 'updated_by'];
TABS.AppLog = ['at', 'app_id', 'by', 'kind', 'from_status', 'to_status', 'subject', 'text', 'parent_visible', 'email_state'];
PERMS.push('reg', 'reg_docs');
PPL_ACTS.regTransfer = 1; NAMES_ACTS.regTransfer = 1; READS.regList = 1; READS.regFile = 1; BIG.token = true;

const APP_EDIT = ['first_name', 'last_name', 'birth_date', 'birth_heb', 'home_phone', 'engaged', 'wedding_date', 'wedding_heb', 'father_name', 'mother_family', 'father_phone',
  'mother_phone', 'email', 'community', 'address', 'city', 'state', 'zip', 'country', 'yeshiva_ketana', 'yeshiva_gedola', 'yeshiva_other',
  'staff1_name', 'staff1_phone', 'staff2_name', 'staff2_phone', 'staff3_name', 'staff3_phone', 'notes'];
const APP_DOCS = { photo: 'תמונה', passport: 'דרכון', birth: 'תעודת לידה' };
const REG_REQUIRED = ['first_name', 'last_name', 'birth_date', 'home_phone', 'engaged', 'father_name', 'mother_family', 'father_phone', 'mother_phone', 'email', 'community', 'address', 'city', 'country', 'yeshiva_ketana', 'yeshiva_gedola'];
const OUTBOX_NAME = 'Beis Sheurim Outbox';

function regConf(M) {
  const o = {};
  objs(M.book.getSheetByName('Settings')).forEach(function (x) {
    const k = S(x.key);
    if (k === 'reg' || k.indexOf('reg_txt:') === 0) { try { o[k] = JSON.parse(S(x.value)); } catch (err) { /* */ } }
  });
  return { conf: o.reg || null, texts: { he: o['reg_txt:he'] || null, yi: o['reg_txt:yi'] || null, en: o['reg_txt:en'] || null } };
}
/** צו וועלכן זמן גייט א נייע בקשה */
function regPeriod(conf) {
  if (!conf) return '';
  return conf.period_open === false ? S(conf.period_next) || S(conf.period) : S(conf.period);
}
const isT = function (v) { return S(v).toUpperCase() === 'TRUE'; };
const BOOLS = { test: 1, portal_edit: 1, under_age_ack: 1, parent_visible: 1 };
function appRows(M) { return objs(M.book.getSheetByName('Applicants')).filter(function (a) { return S(a.app_id); }); }
function appView(a, docs) {
  const o = {};
  TABS.Applicants.forEach(function (k) { o[k] = BOOLS[k] ? (isT(a[k]) ? 'TRUE' : '') : S(a[k]); });
  if (!docs) { o.passport_file = o.passport_file ? '1' : ''; o.birth_file = o.birth_file ? '1' : ''; }
  return o;
}
function appFolder(M, a) {
  if (S(a.folder_id)) { try { return DriveApp.getFolderById(S(a.folder_id)); } catch (err) { /* */ } }
  const f = folderPath(['מוסדות אונגוואר', S(M.name) || M.key, 'רישום']).createFolder(S(a.app_id) + ' ' + S(a.first_name) + ' ' + S(a.last_name));
  return f;
}
/** א טעקע (data:…;base64) → דרייב. kind: photo / passport / birth */
function appSaveFile(M, a, kind, data) {
  if (!APP_DOCS[kind]) throw new Error('bad-kind');
  const m = S(data).match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/);
  if (!m) throw new Error('bad-file');
  if (m[2].length > (kind === 'photo' ? 2000000 : 5600000)) throw new Error('file-big');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[m[1]];
  const folder = appFolder(M, a);
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], APP_DOCS[kind] + '.' + ext));
  const old = S(a[kind + '_file']);
  if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (err) { /* */ } }
  return { file: file.getId(), folder: folder.getId() };
}
function appLog(M, o) {
  const sh = M.book.getSheetByName('AppLog');
  const head = headOf(sh);
  sh.appendRow(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
}
function appLink(a) { return 'https://ungvar.org/yeshiva/register/?t=' + S(a.token); }

// ---------- מיילים: דורך "Beis Sheurim Outbox" (א גיליון וואס דער סקריפט אינעם חשבון פון דער ישיבה שיקט) ----------
function outboxSheet() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('outbox_id');
  if (id) { try { return SpreadsheetApp.openById(id).getSheetByName('outbox'); } catch (err) { props.deleteProperty('outbox_id'); } }
  const it = DriveApp.searchFiles('title = "' + OUTBOX_NAME + '" and trashed = false');
  while (it.hasNext()) {
    const f = it.next();
    try { const ss = SpreadsheetApp.openById(f.getId()); const sh = ss.getSheetByName('outbox'); if (sh) { props.setProperty('outbox_id', f.getId()); return sh; } } catch (err) { /* */ }
  }
  return null;
}
/** 'queued' / 'no-mailer' / 'no-email' */
function mailQueue(to, subject, text, html) {
  to = S(to);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return 'no-email';
  const sh = outboxSheet();
  if (!sh) return 'no-mailer';
  sh.appendRow([Utilities.getUuid(), new Date(), to, S(subject).slice(0, 200), S(html), S(text), '', 'pending', '', '']);
  return 'queued';
}
const htmlOf = function (t, rtl) {
  return '<div dir="' + (rtl ? 'rtl' : 'ltr') + '" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' + S(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    .replace(/(https:\/\/ungvar\.org\/yeshiva\/register\/\?t=[a-f0-9]+)/g, '<a href="$1">$1</a>') + '</div>';
};
function mailApp(a, subject, text) {
  const rtl = S(a.lang) !== 'en';
  const body = S(text).replace(/\{name\}/g, S(a.first_name) + ' ' + S(a.last_name)).replace(/\{link\}/g, appLink(a)).replace(/\{id\}/g, S(a.app_id));
  const subj = S(subject).replace(/\{name\}/g, S(a.first_name) + ' ' + S(a.last_name)).replace(/\{id\}/g, S(a.app_id));
  return mailQueue(a.email, subj, body, htmlOf(body, rtl));
}
const REG_MAIL_DEFAULT = {
  he: ['ישיבת בית שערים — טופס ההרשמה התקבל (#{id})', 'שלום,\n\nטופס ההרשמה של {name} התקבל בהצלחה (מספר פנייה {id}).\nהנהלת הישיבה תעבור על הפרטים ותעדכן אתכם בהמשך התהליך. קבלת הטופס אינה מהווה אישור קבלה לישיבה.\n\nלמעקב אחר מצב ההרשמה ולהשלמת מסמכים:\n{link}\n\nבברכה,\nהנהלת ישיבת בית שערים'],
  yi: ['ישיבת בית שערים — די אפליקאציע איז אנגעקומען (#{id})', 'שלום,\n\nדי אפליקאציע פון {name} איז אנגעקומען (נומער {id}).\nהנהלת הישיבה וועט דורכקוקן די פרטים און אייך לאזן וויסן. דאס איז נאך נישט קיין אננעמען אין ישיבה.\n\nצו זען וואו די אפליקאציע האלט און צולייגן דאקומענטן:\n{link}\n\nבברכה,\nהנהלת ישיבת בית שערים'],
  en: ['Yeshiva Beis Sheurim — application received (#{id})', 'Hello,\n\nThe application for {name} was received (reference #{id}).\nThe Yeshiva will review it and update you. Receiving the form is not an acceptance to the Yeshiva.\n\nTo follow the application and upload documents:\n{link}\n\nRegards,\nYeshiva Beis Sheurim'],
};

// ---------- פארן עולם (אן לאגאין) ----------
// ---------- ❓ כלים של העוזר (רק קריאה; שינויים — הצעה בלבד) ----------
function aiTools(M, me, can) {
  const P = ACTIONS.people(M);
  const byId = {}; P.people.forEach(function (p) { byId[S(p.contact_id)] = p; });
  const nm = function (p) { return p ? [S(p.title_he), S(p.first_name_he), S(p.last_name_he)].filter(Boolean).join(' ') || [S(p.first_name_en), S(p.last_name_en)].join(' ').trim() : ''; };
  const father = function (id) { const r = P.relations.filter(function (x) { return (x.a === id && x.type === 'זון פון') || (x.b === id && x.type === 'טאטע פון'); })[0]; return r ? byId[r.a === id ? r.b : r.a] : null; };
  const t = Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyy-MM-dd');
  let EN = null; const enOf = function (id) { if (!EN) { EN = {}; objs(M.book.getSheetByName('Enrollments')).forEach(function (e) { (EN[S(e.contact_id)] = EN[S(e.contact_id)] || []).push(e); }); } return EN[id] || []; };
  const status = function (id) { const es = enOf(id); if (!es.length) return ''; const act = es.some(function (e) { const end = S(e.end_date).slice(0, 10); return S(e.status) !== 'יצא' && !(end && end < t); }); return act ? 'לומד עכשיו' : 'בוגר / יצא'; };
  const brief = function (p) { const id = S(p.contact_id); const f = father(id); return { contact_id: id, name: nm(p), kinds: S(p.kind), status: status(id), il_phone: S(p.il_phone), abroad_phone: S(p.abroad_phone), mobile: S(p.mobile), father: f ? nm(f) + ' (#' + S(f.contact_id) + ')' : '' }; };
  const decls = [
    { name: 'find_people', description: 'Search people of the yeshiva (students, alumni, parents, staff, avreichim) by name or phone. Returns up to 15 matches.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'name (Hebrew/English, part is ok) or phone digits' } }, required: ['query'] } },
    { name: 'person_details', description: 'Full details of one person by contact_id: phones, email, address, father/children, enrollment dates, insurance (if allowed).', parameters: { type: 'OBJECT', properties: { contact_id: { type: 'STRING' } }, required: ['contact_id'] } },
    { name: 'propose_add_person', description: 'PREPARE adding a new person (not saved until the user confirms in the site).', parameters: { type: 'OBJECT', properties: { first_name_he: { type: 'STRING' }, last_name_he: { type: 'STRING' }, kind: { type: 'STRING', enum: ['student', 'parent', 'staff', 'avreich', 'other'] }, father_contact_id: { type: 'STRING', description: 'optional: contact_id of the father (must already exist)' }, mobile: { type: 'STRING' }, il_phone: { type: 'STRING' }, abroad_phone: { type: 'STRING' } }, required: ['first_name_he', 'last_name_he', 'kind'] } },
    { name: 'propose_set_phone', description: 'PREPARE changing the Israel phone or the abroad phone of an existing person (not saved until the user confirms).', parameters: { type: 'OBJECT', properties: { contact_id: { type: 'STRING' }, field: { type: 'STRING', enum: ['il_phone', 'abroad_phone'] }, value: { type: 'STRING' } }, required: ['contact_id', 'field', 'value'] } },
  ];
  const run = function (name, a, actions) {
    if (name === 'find_people') {
      const q = S(a.query).toLowerCase(); const dg = q.replace(/\D/g, '');
      const words = q.replace(/[0-9\-\s]+/g, ' ').trim().split(/\s+/).filter(Boolean);
      const hits = P.people.filter(function (p) {
        if (dg.length >= 5 && [p.mobile, p.home_phone, p.il_phone, p.abroad_phone, p.wife_mobile].map(S).some(function (x) { return x.replace(/\D/g, '').indexOf(dg) >= 0; })) return true;
        if (!words.length) return false;
        const hay = [p.first_name_he, p.last_name_he, p.first_name_en, p.last_name_en].map(S).join(' ').toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
      return { count: hits.length, people: hits.slice(0, 15).map(brief) };
    }
    if (name === 'person_details') {
      const id = S(a.contact_id).replace(/\D/g, ''); const p = byId[id];
      if (!p) return { error: 'not found' };
      const o = brief(p);
      ['email_1', 'home_phone', 'wife_mobile', 'address', 'city', 'state', 'zip', 'country', 'marital_status'].forEach(function (k) { if (S(p[k])) o[k] = S(p[k]); });
      o.children = P.relations.filter(function (x) { return (x.b === id && x.type === 'זון פון') || (x.a === id && x.type === 'טאטע פון'); }).map(function (x) { const k = byId[x.a === id ? x.b : x.a]; return k ? nm(k) + ' (#' + S(k.contact_id) + ')' : ''; }).filter(Boolean);
      o.enrollments = enOf(id).map(function (e) { const par = byId[S(e.parent_id)]; return { from: S(e.start_date).slice(0, 10), to: S(e.end_date).slice(0, 10), zman: S(e.zman), status: S(e.status), parent: par ? nm(par) + ' (' + S(par.mobile || par.home_phone) + ')' : '', note: S(e.note) }; });
      if (can('insurance')) { const r = objs(M.book.getSheetByName('Insurance')).filter(function (x) { return S(x.contact_id) === id; })[0]; if (r) o.insurance = { kupah: S(r.kupah), member_no: S(r.member_no), company: S(r.company), policy_no: S(r.policy_no), expires: S(r.expires).slice(0, 10), debt: S(r.debt), status: S(r.status), note: S(r.note) }; }
      if (can('staff_list')) { const tm = objs(M.book.getSheetByName('Team')).filter(function (x) { return S(x.contact_id) === id; })[0]; if (tm) o.team = { role: S(tm.role), active: !isOff(tm.active), from: S(tm.start_date).slice(0, 10), to: S(tm.end_date).slice(0, 10) }; }
      return o;
    }
    if (name === 'propose_add_person') {
      if (!can('people_edit')) return { error: 'no permission to add people' };
      if (S(a.father_contact_id) && !byId[S(a.father_contact_id).replace(/\D/g, '')]) return { error: 'father not found' };
      const dup = P.people.filter(function (p) { return S(p.first_name_he) === S(a.first_name_he) && S(p.last_name_he) === S(a.last_name_he); }).map(brief);
      actions.push({ type: 'add', data: { first_name_he: S(a.first_name_he), last_name_he: S(a.last_name_he), kind: S(a.kind), father: S(a.father_contact_id).replace(/\D/g, ''), mobile: S(a.mobile), il_phone: S(a.il_phone), abroad_phone: S(a.abroad_phone) } });
      return { prepared: true, possible_duplicates: dup, note: 'Tell the user to press ✓ to confirm' + (dup.length ? ' — warn: a person with the same name already exists' : '') };
    }
    if (name === 'propose_set_phone') {
      if (!can('students') && !can('people_edit')) return { error: 'no permission' };
      const id = S(a.contact_id).replace(/\D/g, ''); const p = byId[id]; if (!p) return { error: 'not found' };
      actions.push({ type: 'phone', data: { contact_id: id, name: nm(p), field: S(a.field) === 'abroad_phone' ? 'abroad_phone' : 'il_phone', value: S(a.value), old: S(p[S(a.field)]) } });
      return { prepared: true, note: 'Tell the user to press ✓ to confirm' };
    }
    return { error: 'unknown tool' };
  };
  return { decls: decls, run: run };
}
// ---------- 🍳 עובדי מטבח: סיסמה פאר יעדן (Settings: kitchen_workers) — נאר דער מטבח ----------
function kWorkers(M) { const r = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === 'kitchen_workers'; })[0]; try { const v = JSON.parse(S(r && r.value) || '[]'); return Array.isArray(v) ? v : []; } catch (err) { return []; } }
function kHash(salt, pass) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pass, Utilities.Charset.UTF_8)); }
/** דער סעסיע → דער עובד (נאר ווען ער איז נאך פעיל און די סיסמה איז נישט געטוישט) */
function kSession(M, tok) {
  if (!tok) throw new Error('k-login');
  const raw = CacheService.getScriptCache().get('ks:' + String(tok).slice(0, 80));
  if (!raw) throw new Error('k-login');
  const ss = JSON.parse(raw);
  if (ss.m !== M.key) throw new Error('k-login');
  const w = kWorkers(M).filter(function (x) { return x.id === ss.w; })[0];
  if (!w || w.active === false || Number(w.ver) !== Number(ss.v)) throw new Error('k-login');
  return { email: 'מטבח: ' + w.name, name: w.name, role: 'staff', perms: ['kitchen'], kw: w };
}
const KPUB = {
  kNames: function (M) { return { names: kWorkers(M).filter(function (w) { return w.active !== false; }).map(function (w) { return { id: w.id, name: w.name }; }), mosad: M.name }; },
  kLogin: function (M, req) {
    const c = CacheService.getScriptCache();
    const fk = 'kf:' + M.key + ':' + S(req.id).slice(0, 30);
    const fails = Number(c.get(fk) || 0);
    if (fails >= 5) return { error: 'k-locked' };
    const w = kWorkers(M).filter(function (x) { return x.id === S(req.id) && x.active !== false; })[0];
    if (!w || kHash(w.salt, S(req.password)) !== w.hash) { c.put(fk, String(fails + 1), 600); return { error: 'k-bad' }; }
    c.remove(fk);
    const tok = Utilities.getUuid() + Utilities.getUuid();
    c.put('ks:' + tok, JSON.stringify({ m: M.key, w: w.id, v: Number(w.ver) }), 21600);
    return { ok: true, token: tok, name: w.name };
  },
  /** אלע אקציעס פונעם עובד: { ks, op, ... } */
  kAct: function (M, req) {
    try {
      const me = kSession(M, req.ks);
      CUR = { M: M, me: me };
      const op = S(req.op);
      if (op === 'read') return ACTIONS.kitchen(M, me);
      if (op === 'stock') { const v = Math.max(0, Number(req.value) || 0); return ACTIONS.kitchenSave(M, me, { row: { product_id: S(req.id), current_stock: v } }); }
      if (op === 'order') { const r = ACTIONS.kitchenOrder(M, me, { supplier: req.supplier, items: [].concat(req.items || []).map(function (x) { return { id: x.id, name: x.name, qty: x.qty, unit: x.unit, mult: x.mult, price: me.kw.prices ? x.price : 0 }; }), received: !!req.received, note: req.note }); return r; }
      if (op === 'receive') return ACTIONS.kitchenReceive(M, me, { id: req.id });
      if (op === 'event') return ACTIONS.kitchenEventSave(M, me, { event: req.event, remove: !!req.remove });
      if (op === 'request') {
        const type = S(req.type) === 'delete' ? 'delete' : 'add';
        const sh = ensureTab(M.book, 'KitchenRequests', TABS.KitchenRequests);
        let max = 0; objs(sh).forEach(function (x) { const n = Number(x.req_id); if (n > max) max = n; });
        const d = req.row || {}; const keep = {};
        TABS.Kitchen.forEach(function (k) { if (k in d && k !== 'product_id' && k !== 'updated_at' && k !== 'updated_by' && (me.kw.prices || k !== 'unit_price')) keep[k] = S(d[k]).slice(0, 300); });
        if (type === 'add' && !S(keep.product_name)) throw new Error('need-text');
        appendObj(sh, { req_id: max + 1, type: type, product_id: S(req.id), data: JSON.stringify(keep), note: S(req.note).slice(0, 300), by: me.email, at: now(), status: 'pending' });
        logIt(M, me, 'kitchen-request', '', type + ' ' + (S(keep.product_name) || S(req.id)));
        return { ok: true };
      }
      return { error: 'bad-action' };
    } catch (err) { return { error: String((err && err.message) || err) }; }
  },
};
const PUBLIC = {
  pubRegInfo: function (M) {
    const c = regConf(M);
    const conf = c.conf || {};
    return { on: conf.form_on === true, period: regPeriod(conf), conf: c.conf, texts: c.texts, name: M.name };
  },
  pubRegSubmit: function (M, req) {
    const c = regConf(M);
    const conf = c.conf || {};
    if (conf.form_on !== true) throw new Error('reg-closed');
    if (S(req.website)) return { ok: true, app_id: '0' }; // א "הוניג-טאפ" פאר ראבאטן
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('regsub:' + M.key) || 0);
    if (n > 40) throw new Error('too-many');
    cache.put('regsub:' + M.key, String(n + 1), 3600);
    const d = req.data || {};
    const miss = REG_REQUIRED.filter(function (k) { return !S(d[k]); });
    if (miss.length) throw new Error('missing:' + miss.join(','));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(S(d.email))) throw new Error('bad-email');
    if (S(d.engaged) === 'yes' && !S(d.wedding_date)) throw new Error('missing:wedding_date');
    const staffN = [1, 2, 3].filter(function (i) { return S(d['staff' + i + '_name']) && S(d['staff' + i + '_phone']); }).length;
    if (staffN < 2) throw new Error('need-staff');
    if (!req.consents) throw new Error('need-consents');
    const files = req.files || {};
    if (!S(files.photo)) throw new Error('need-photo');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let a;
    try {
      const sh = M.book.getSheetByName('Applicants');
      let mx = 1000; appRows(M).forEach(function (x) { const v = Number(x.app_id); if (isFinite(v) && v > mx) mx = v; });
      a = { app_id: mx + 1, token: (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), created_at: now(), period: regPeriod(conf), status: 'received',
        lang: ['he', 'yi', 'en'].indexOf(S(req.lang)) >= 0 ? S(req.lang) : 'he', consents_at: now(), consents_ver: S(req.consents).slice(0, 60), test: req.test ? 'TRUE' : '',
        under_age_ack: d.under_age_ack ? 'TRUE' : '', pay_reg: '', updated_at: now(), updated_by: 'form' };
      APP_EDIT.forEach(function (k) { if (k in d) a[k] = S(d[k]).slice(0, k === 'notes' ? 3000 : 300); });
      ['home_phone', 'father_phone', 'mother_phone', 'staff1_phone', 'staff2_phone', 'staff3_phone'].forEach(function (k) { if (a[k]) a[k] = "'" + a[k]; });
      appendObj(sh, a);
    } finally { lock.releaseLock(); }
    // טעקעס
    const sh2 = M.book.getSheetByName('Applicants');
    const row = appRows(M).filter(function (x) { return S(x.app_id) === S(a.app_id); })[0];
    const set = {};
    ['photo', 'passport', 'birth'].forEach(function (k) {
      if (!S(files[k])) return;
      const r = appSaveFile(M, row, k, files[k]);
      set[k + '_file'] = r.file; set[k + '_state'] = 'pending'; set.folder_id = r.folder; row.folder_id = r.folder;
    });
    if (Object.keys(set).length) setCells(sh2, row._row, set);
    const lang = a.lang;
    const tm = (conf.mail_received && conf.mail_received[lang]) || null;
    const subj = tm ? tm.subject : REG_MAIL_DEFAULT[lang][0];
    const body = tm ? tm.body : REG_MAIL_DEFAULT[lang][1];
    const st = mailApp(a, subj, body);
    appLog(M, { at: now(), app_id: a.app_id, by: 'form', kind: 'submit', to_status: 'received', subject: subj, text: '', parent_visible: '', email_state: st });
    return { ok: true, app_id: String(a.app_id), token: a.token };
  },
  pubPortal: function (M, req) {
    const a = appByToken(M, req.t);
    const c = regConf(M);
    const log = objs(M.book.getSheetByName('AppLog')).filter(function (l) { return S(l.app_id) === S(a.app_id) && isT(l.parent_visible); })
      .map(function (l) { return { at: S(l.at), kind: S(l.kind), subject: S(l.subject), text: S(l.text), status: S(l.to_status) }; });
    const v = {};
    ['app_id', 'created_at', 'period', 'status', 'lang', 'first_name', 'last_name', 'photo_state', 'passport_state', 'birth_state', 'portal_edit'].forEach(function (k) { v[k] = BOOLS[k] ? (isT(a[k]) ? 'TRUE' : '') : S(a[k]); });
    if (isT(a.portal_edit)) APP_EDIT.forEach(function (k) { v[k] = S(a[k]).replace(/^'/, ''); });
    return { app: v, log: log, conf: c.conf, texts: c.texts };
  },
  pubPortalUpload: function (M, req) {
    const a = appByToken(M, req.t);
    const kind = S(req.kind);
    if (!APP_DOCS[kind]) throw new Error('bad-kind');
    if (S(a[kind + '_state']) === 'ok') throw new Error('already-ok');
    const r = appSaveFile(M, a, kind, req.data);
    const sh = M.book.getSheetByName('Applicants');
    const o = { folder_id: r.folder, updated_at: now(), updated_by: 'parent' }; o[kind + '_file'] = r.file; o[kind + '_state'] = 'pending';
    setCells(sh, a._row, o);
    appLog(M, { at: now(), app_id: a.app_id, by: 'parent', kind: 'upload', text: APP_DOCS[kind], parent_visible: '' });
    return { ok: true };
  },
  pubPortalEdit: function (M, req) {
    const a = appByToken(M, req.t);
    if (!isT(a.portal_edit)) throw new Error('no-edit');
    const d = req.data || {};
    const o = {};
    APP_EDIT.forEach(function (k) { if (k in d) o[k] = S(d[k]).slice(0, k === 'notes' ? 3000 : 300); });
    o.updated_at = now(); o.updated_by = 'parent';
    setCells(M.book.getSheetByName('Applicants'), a._row, o);
    appLog(M, { at: now(), app_id: a.app_id, by: 'parent', kind: 'edit', text: Object.keys(o).filter(function (k) { return APP_EDIT.indexOf(k) >= 0; }).join(','), parent_visible: '' });
    return { ok: true };
  },
};
function appByToken(M, t) {
  t = S(t);
  if (t.length < 40) throw new Error('bad-link');
  const a = appRows(M).filter(function (x) { return S(x.token) === t; })[0];
  if (!a) throw new Error('bad-link');
  return a;
}

// ---------- פאר דער הנהלה ----------
const REG_ACTIONS = {
  regList: function (M, me) {
    need(me, 'reg');
    const docs = isAdminRole(me) || me.perms.indexOf('reg_docs') >= 0;
    const c = regConf(M);
    const log = objs(M.book.getSheetByName('AppLog')).filter(function (l) { return S(l.app_id); }).map(function (l) { const o = {}; TABS.AppLog.forEach(function (k) { o[k] = BOOLS[k] ? (isT(l[k]) ? 'TRUE' : '') : S(l[k]); }); return o; });
    return { apps: appRows(M).map(function (a) { return appView(a, docs); }), log: log, conf: c.conf, texts: c.texts, docs: docs, mailer: !!outboxSheet() };
  },
  regSettings: function (M, me, req) {
    need(me, 'reg');
    if (req.conf) { const v = JSON.stringify(req.conf); if (v.length > 45000) throw new Error('גדול מדי'); putSetting(M, me, 'reg', v); }
    if (req.texts) ['he', 'yi', 'en'].forEach(function (l) { if (req.texts[l]) { const v = JSON.stringify(req.texts[l]); if (v.length > 45000) throw new Error('גדול מדי'); putSetting(M, me, 'reg_txt:' + l, v); } });
    logIt(M, me, 'regSettings', '', '');
    const c = regConf(M);
    return { ok: true, conf: c.conf, texts: c.texts };
  },
  regEdit: function (M, me, req) {
    need(me, 'reg');
    const a = appRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0];
    if (!a) throw new Error('not-found');
    const d = req.data || {};
    const o = {};
    APP_EDIT.concat(['period', 'portal_edit', 'pay_reg', 'pay_visa']).forEach(function (k) { if (k in d) o[k] = S(d[k]).slice(0, 3000); });
    ['home_phone', 'father_phone', 'mother_phone', 'staff1_phone', 'staff2_phone', 'staff3_phone'].forEach(function (k) { if (o[k]) o[k] = "'" + o[k]; });
    o.updated_at = now(); o.updated_by = me.email;
    setCells(M.book.getSheetByName('Applicants'), a._row, o);
    if ('period' in o && S(o.period) !== S(a.period)) appLog(M, { at: now(), app_id: a.app_id, by: me.email, kind: 'period', from_status: S(a.period), to_status: o.period });
    return { ok: true };
  },
  /** א סטאטוס, מיט (נישט מוז) א מעלדונג פאר די עלטערן; send = אויך אין אימעיל */
  regStatus: function (M, me, req) {
    need(me, 'reg');
    const a = appRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0];
    if (!a) throw new Error('not-found');
    const st = S(req.status).slice(0, 40);
    if (!st) throw new Error('bad-status');
    setCells(M.book.getSheetByName('Applicants'), a._row, { status: st, updated_at: now(), updated_by: me.email });
    const n = req.notify || {};
    const vis = !!S(n.text);
    const es = vis && n.send ? mailApp(a, n.subject, n.email || n.text) : '';
    appLog(M, { at: now(), app_id: a.app_id, by: me.email, kind: 'status', from_status: S(a.status), to_status: st, subject: S(n.subject).slice(0, 200), text: S(n.text).slice(0, 5000), parent_visible: vis ? 'TRUE' : '', email_state: es });
    return { ok: true, email_state: es };
  },
  regMsg: function (M, me, req) {
    need(me, 'reg');
    const a = appRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0];
    if (!a) throw new Error('not-found');
    const note = !!req.note;
    const es = !note && req.send ? mailApp(a, req.subject, req.email || req.text) : '';
    appLog(M, { at: now(), app_id: a.app_id, by: me.email, kind: note ? 'note' : 'msg', subject: S(req.subject).slice(0, 200), text: S(req.text).slice(0, 5000), parent_visible: note ? '' : 'TRUE', email_state: es });
    return { ok: true, email_state: es };
  },
  regDoc: function (M, me, req) {
    need(me, 'reg');
    const a = appRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0];
    if (!a) throw new Error('not-found');
    const kind = S(req.kind);
    if (!APP_DOCS[kind]) throw new Error('bad-kind');
    const o = { updated_at: now(), updated_by: me.email };
    if (req.data) {
      if (kind !== 'photo' && !isAdminRole(me) && me.perms.indexOf('reg_docs') < 0) throw new Error('no-permission');
      const r = appSaveFile(M, a, kind, req.data); o[kind + '_file'] = r.file; o.folder_id = r.folder; o[kind + '_state'] = S(req.state) || 'ok';
    } else o[kind + '_state'] = S(req.state);
    setCells(M.book.getSheetByName('Applicants'), a._row, o);
    appLog(M, { at: now(), app_id: a.app_id, by: me.email, kind: 'doc', subject: APP_DOCS[kind], text: o[kind + '_state'] });
    return { ok: true };
  },
  regFile: function (M, me, req) {
    need(me, 'reg');
    const kind = S(req.kind);
    if (kind !== 'photo' && !isAdminRole(me) && me.perms.indexOf('reg_docs') < 0) throw new Error('no-permission');
    const ids = [].concat(req.app_ids || [req.app_id]).map(S).slice(0, 25);
    const out5 = {};
    appRows(M).forEach(function (a) {
      if (ids.indexOf(S(a.app_id)) < 0 || !S(a[kind + '_file'])) return;
      try { const b = DriveApp.getFileById(S(a[kind + '_file'])).getBlob(); out5[S(a.app_id)] = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()); } catch (err) { /* */ }
    });
    return { files: out5 };
  },
  regDelete: function (M, me, req) {
    if (!isAdminRole(me)) throw new Error('no-permission');
    const a = appRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0];
    if (!a) throw new Error('not-found');
    if (S(a.contact_id)) throw new Error('transferred');
    if (S(a.folder_id)) { try { DriveApp.getFolderById(S(a.folder_id)).setTrashed(true); } catch (err) { /* */ } }
    delRow(M.book.getSheetByName('Applicants'), a._row);
    appLog(M, { at: now(), app_id: a.app_id, by: me.email, kind: 'delete', text: S(a.first_name) + ' ' + S(a.last_name) });
    return { ok: true };
  },
  /** "העבר לתלמידים": dry = נאר זוכן ווער ס'איז שוין דא אינעם מאגר */
  regTransfer: function (M, me, req) {
    need(me, 'reg'); need(me, 'people_edit');
    const a = appRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0];
    if (!a) throw new Error('not-found');
    if (S(a.contact_id)) throw new Error('already-transferred');
    const nameQ = function (q) { return q ? ACTIONS.find(M, me, { q: q }).found : []; };
    const phoneQ = function (p) { const d = S(p).replace(/\D/g, ''); return d.length >= 7 ? ACTIONS.find(M, me, { q: '', phone: d }).found : []; };
    if (req.dry) {
      const uniq = function (list) { const seen = {}; return list.filter(function (x) { if (seen[x.contact_id]) return false; seen[x.contact_id] = true; return true; }); };
      return { student: uniq(nameQ(S(a.first_name) + ' ' + S(a.last_name))),
        parent: uniq(phoneQ(a.father_phone).concat(phoneQ(a.home_phone), phoneQ(a.mother_phone), nameQ(S(a.father_name) + ' ' + S(a.last_name)))) };
    }
    if (S(a.status) !== 'accepted' && S(a.status) !== 'tuition_ok') throw new Error('not-accepted');
    const ph = function (v) { return S(v).replace(/^'/, ''); };
    const addr = { address: S(a.address), city: S(a.city), state: S(a.state), zip: S(a.zip), country: S(a.country) };
    // הורה
    let pid = S(req.parent_id);
    if (pid) ACTIONS.link(M, me, { contact_id: pid, kind: 'parent' });
    else {
      const c = { first_name_he: S(a.father_name), last_name_he: S(a.last_name) }; Object.keys(addr).forEach(function (k) { if (addr[k]) c[k] = addr[k]; });
      pid = S(ACTIONS.save(M, me, { contact: c, phones: { mobile: ph(a.father_phone), home_phone: ph(a.home_phone), email_1: S(a.email) }, kind: 'parent' }).contact_id);
    }
    // דער בחור
    let sid = S(req.student_id);
    if (sid) { ACTIONS.link(M, me, { contact_id: sid, kind: 'student' }); ACTIONS.save(M, me, { contact_id: sid, contact: {}, phones: {}, rel: { type: 'זון פון', to: pid } }); }
    else {
      const c2 = { first_name_he: S(a.first_name), last_name_he: S(a.last_name) }; Object.keys(addr).forEach(function (k) { if (addr[k]) c2[k] = addr[k]; });
      sid = S(ACTIONS.save(M, me, { contact: c2, phones: { home_phone: ph(a.home_phone) }, kind: 'student', rel: { type: 'זון פון', to: pid } }).contact_id);
    }
    const note = [S(a.community) && 'קהילה: ' + S(a.community), S(a.yeshiva_ketana) && 'ישיבה קטנה: ' + S(a.yeshiva_ketana), S(a.yeshiva_gedola) && 'לומד כיום: ' + S(a.yeshiva_gedola),
      S(a.mother_family) && 'שם משפחת האם: ' + S(a.mother_family), ph(a.mother_phone) && 'טל׳ האם: ' + ph(a.mother_phone), 'רישום #' + S(a.app_id)].filter(Boolean).join(' · ');
    const en = ACTIONS.enrollSave(M, me, { enroll: { contact_id: sid, parent_id: pid, zman: S(req.zman) || S(a.period), start_date: S(req.start_date), status: 'לומד', note: note } });
    try { syncYeshivaTags(M, [sid, pid], me.email); } catch (err) { /* */ }
    setCells(M.book.getSheetByName('Applicants'), a._row, { contact_id: sid, parent_id: pid, enroll_id: en.enroll_id, transferred_at: now(), updated_at: now(), updated_by: me.email });
    appLog(M, { at: now(), app_id: a.app_id, by: me.email, kind: 'transfer', text: 'תלמיד #' + sid + ' · הורה #' + pid + ' · רישום ' + en.enroll_id });
    return { ok: true, contact_id: sid, parent_id: pid, enroll_id: en.enroll_id };
  },
};
Object.keys(REG_ACTIONS).forEach(function (k) { ACTIONS[k] = REG_ACTIONS[k]; });

// ---------- פונעם עדיטאר: בדיקות פון רישום (נאר פאר'ן בעל הבית) ----------
function regDevMe_() { const M = mosadOf('yeshiva'); return { M: M, me: { email: M.owners[0], role: 'owner', perms: PERMS.slice(), name: '' } }; }
function regFormTestOn() { const x = regDevMe_(); const c = regConf(x.M).conf || {}; c.form_on = true; putSetting(x.M, x.me, 'reg', JSON.stringify(c)); Logger.log('form_on = true'); }
function regFormTestOff() { const x = regDevMe_(); const c = regConf(x.M).conf || {}; c.form_on = false; putSetting(x.M, x.me, 'reg', JSON.stringify(c)); Logger.log('form_on = false'); }
/** א פולער דורכלויף אויף די "בדיקה" בקשות: סטאטוס, הודעה, הערה, מסמך, טעקע, העברה (dry) */
function regTestAdmin() {
  const x = regDevMe_(); CUR = { M: x.M, me: x.me };
  const tests = appRows(x.M).filter(function (a) { return isT(a.test); });
  Logger.log('test apps: ' + tests.map(function (a) { return a.app_id; }).join(','));
  tests.forEach(function (a, i) {
    const r1 = ACTIONS.regStatus(x.M, x.me, { app_id: a.app_id, status: i === 0 ? 'accepted' : 'exam', notify: { text: 'בדיקה — הודעה להורים', subject: 'בדיקה', email: 'בדיקה {link}', send: false } });
    const r2 = ACTIONS.regMsg(x.M, x.me, { app_id: a.app_id, text: 'הערה פנימית — בדיקה', note: true });
    const r3 = ACTIONS.regDoc(x.M, x.me, { app_id: a.app_id, kind: 'photo', state: 'ok' });
    const r4 = ACTIONS.regFile(x.M, x.me, { kind: 'photo', app_ids: [a.app_id] });
    const r5 = ACTIONS.regTransfer(x.M, x.me, { app_id: a.app_id, dry: true });
    const r6 = ACTIONS.regEdit(x.M, x.me, { app_id: a.app_id, data: { notes: S(a.notes) + ' ✓' } });
    Logger.log(JSON.stringify({ app: a.app_id, status: r1, note: r2, doc: r3, photo: Object.keys(r4.files).length, dry: { p: r5.parent.length, s: r5.student.length }, edit: r6 }));
  });
  const l = ACTIONS.regList(x.M, x.me, {});
  Logger.log('list: ' + l.apps.length + ' apps, ' + l.log.length + ' log, mailer=' + l.mailer);
}
function regTestCleanup() {
  const x = regDevMe_(); CUR = { M: x.M, me: x.me };
  appRows(x.M).filter(function (a) { return isT(a.test) && !S(a.contact_id); }).reverse().forEach(function (a) { ACTIONS.regDelete(x.M, x.me, { app_id: a.app_id }); Logger.log('deleted ' + a.app_id); });
}
/** פונעם עדיטאר: ווער פון צוות / אברכים איז צוויי מאל (לויט נאמען, אדער טעלעפאן) */
function staffDupReport() {
  const M = mosadOf('yeshiva');
  const ppl = objs(M.book.getSheetByName('People')).filter(function (p) { return S(p.status) !== 'removed'; });
  const team = objs(M.book.getSheetByName('Team'));
  const cs = {}; objs(main().getSheetByName('Contacts')).forEach(function (c) { cs[S(c.contact_id)] = c; });
  const ph = {}; objs(main().getSheetByName('Phones')).forEach(function (p) { ph[S(p.contact_id)] = p; });
  const ids = {}; ppl.forEach(function (p) { if (/staff|avreich/.test(S(p.kind))) ids[S(p.contact_id)] = S(p.kind); });
  team.forEach(function (t) { if (S(t.contact_id)) ids[S(t.contact_id)] = (ids[S(t.contact_id)] || '') + ' team'; });
  const norm = function (s) { return skel(S(s).replace(/["'״׳]/g, '')); };
  const byName = {}; const byPh = {};
  Object.keys(ids).forEach(function (id) {
    const c = cs[id] || {};
    const k = norm(S(c.first_name_he) + ' ' + S(c.last_name_he)) || norm(S(c.first_name_en) + ' ' + S(c.last_name_en));
    (byName[k] = byName[k] || []).push(id);
    const p = ph[id] || {};
    ['mobile', 'home_phone'].forEach(function (f) { const d = S(p[f]).replace(/\D/g, '').slice(-9); if (d.length >= 7) (byPh[d] = byPh[d] || []).push(id); });
  });
  const show = function (id) { const c = cs[id] || {}; return '#' + id + ' ' + [c.title_he, c.first_name_he, c.last_name_he].map(S).filter(Boolean).join(' ') + ' [' + ids[id] + ']' + (S(c.deleted_at) ? ' (deleted)' : '') + ' tel:' + S((ph[id] || {}).mobile); };
  Object.keys(byName).forEach(function (k) { if (byName[k].length > 1) Logger.log('NAME: ' + byName[k].map(show).join(' | ')); });
  Object.keys(byPh).forEach(function (k) { const u = byPh[k].filter(function (x, i, a) { return a.indexOf(x) === i; }); if (u.length > 1) Logger.log('PHONE ' + k + ': ' + u.map(show).join(' | ')); });
  Logger.log('staff/avreich/team ids: ' + Object.keys(ids).length);
}
/** פונעם עדיטאר: די 5 צוות-מענטשן וואס זענען אריין צוויי מאל ביים אימפארט (#5534–#5539) → איינס */
function staffDupFix() {
  const M = mosadOf('yeshiva'); const me = { email: M.owners[0], role: 'owner', perms: PERMS.slice(), name: '' }; CUR = { M: M, me: me };
  const pairs = [[5528, 5534], [5529, 5535], [5530, 5536], [5531, 5537], [5533, 5539]];
  makeBackup('main', main(), 'לפני איחוד צוות כפול'); makeBackup(M.key, M.book, 'לפני איחוד צוות כפול');
  const ss = main();
  const cs = ss.getSheetByName('Contacts');
  const repoint = function (sh, cols, keep, drop) {
    if (!sh) return 0;
    let n = 0;
    objs(sh).forEach(function (r) {
      const o = {};
      cols.forEach(function (c) { if (S(r[c]) === String(drop)) o[c] = keep; });
      if (Object.keys(o).length) { setCells(sh, r._row, o); n++; }
    });
    return n;
  };
  const MAIN_COLS = { Donations: ['contact_id'], Occasions: ['contact_id'], OrgNotes: ['contact_id'], Receipts: ['contact_id'], Enrollments: ['contact_id', 'parent_id'], Tuition: ['contact_id', 'payer_id'], Photos: ['contact_id'] };
  const MOSAD_COLS = { Chavrusas: ['contact_id', 'partner_id'], Attendance: ['contact_id'], Hours: ['contact_id'], Insurance: ['contact_id'], Enrollments: ['contact_id', 'parent_id'], Tuition: ['contact_id', 'payer_id'],
    Receipts: ['contact_id', 'payer_id'], PayInfo: ['contact_id'], PayItems: ['contact_id'], PayPayments: ['contact_id'], Tasks: ['contact_id'], Expenses: ['charged_id', 'paid_by_id'], Incomes: ['source_id'], Debts: ['person_id'] };
  const keeps = [];
  pairs.forEach(function (pr) {
    const keep = pr[0], drop = pr[1];
    const all = objs(cs);
    const k = all.filter(function (c) { return S(c.contact_id) === String(keep); })[0];
    const d = all.filter(function (c) { return S(c.contact_id) === String(drop); })[0];
    if (!k || !d || S(d.deleted_at)) { Logger.log('skip ' + keep + '/' + drop + ' (missing or already deleted)'); return; }
    const nm = function (c) { return skel(S(c.first_name_he) + ' ' + S(c.last_name_he)); };
    if (nm(k) !== nm(d)) { Logger.log('skip ' + keep + '/' + drop + ' — names differ'); return; }
    const set = {};
    C_FIELDS.forEach(function (f) { if (!S(k[f]) && S(d[f])) set[f] = d[f]; });
    if (Object.keys(set).length) { set.updated_at = now(); set.updated_by = me.email + ' @merge'; setCells(cs, k._row, set); }
    setCells(cs, d._row, { deleted_at: now(), deleted_by: me.email + ' (merged into #' + keep + ')' });
    // טעלעפאנען
    const ps = ss.getSheetByName('Phones'); const pall = objs(ps);
    const pk = pall.filter(function (p) { return S(p.contact_id) === String(keep); })[0];
    const pd = pall.filter(function (p) { return S(p.contact_id) === String(drop); })[0];
    if (pd) {
      const ph = {}; headOf(ps).forEach(function (f) { if (f !== 'contact_id' && S(pd[f]) && !/ERROR/.test(S(pd[f])) && (!pk || !S(pk[f]))) ph[f] = "'" + S(pd[f]).replace(/^'/, ''); });
      if (Object.keys(ph).length) { if (pk) setCells(ps, pk._row, ph); else { ph.contact_id = keep; appendObj(ps, ph); } }
    }
    // קשרים
    const rs = ss.getSheetByName('Relations');
    objs(rs).filter(function (r) { return S(r.contact_id_a) === String(drop) || S(r.contact_id_b) === String(drop); }).reverse().forEach(function (r) { delRow(rs, r._row); });
    let n = 0;
    Object.keys(MAIN_COLS).forEach(function (t) { n += repoint(ss.getSheetByName(t), MAIN_COLS[t], keep, drop); });
    Object.keys(MOSAD_COLS).forEach(function (t) { n += repoint(M.book.getSheetByName(t), MOSAD_COLS[t], keep, drop); });
    // People / Team אינעם מוסד
    const pe = M.book.getSheetByName('People'); const pa = objs(pe);
    const ek = pa.filter(function (p) { return S(p.contact_id) === String(keep); })[0];
    const ed = pa.filter(function (p) { return S(p.contact_id) === String(drop); })[0];
    if (ed) {
      if (ek) { const kinds = S(ek.kind).split(',').concat(S(ed.kind).split(',')).map(S).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); setCells(pe, ek._row, { kind: kinds.join(','), status: 'active' }); delRow(pe, ed._row); }
      else setCells(pe, ed._row, { contact_id: keep });
    }
    const tm = M.book.getSheetByName('Team'); const ta = objs(tm);
    const tk = ta.filter(function (x) { return S(x.contact_id) === String(keep); })[0];
    const td = ta.filter(function (x) { return S(x.contact_id) === String(drop); })[0];
    if (td) {
      if (tk) { const o = {}; TABS.Team.forEach(function (f) { if (f !== 'contact_id' && !S(tk[f]) && S(td[f])) o[f] = td[f]; }); if (Object.keys(o).length) setCells(tm, tk._row, o); delRow(tm, td._row); }
      else setCells(tm, td._row, { contact_id: keep });
    }
    histRows(me, M, keep, [['contact', 'merge', '', 'merged #' + drop + ' into #' + keep]]);
    histRows(me, M, drop, [['contact', 'merge', '', 'merged into #' + keep + ' (trash)']]);
    keeps.push(String(keep));
    Logger.log('merged #' + drop + ' → #' + keep + ' (' + n + ' rows repointed)');
  });
  // קלמן וויס: דער טעלעפאן איז געווען #ERROR! (פון א "+" אינעם אימפארט)
  const ps2 = ss.getSheetByName('Phones');
  const w = objs(ps2).filter(function (p) { return S(p.contact_id) === '5533'; })[0];
  if (w && (/ERROR/.test(S(w.mobile)) || !S(w.mobile))) { setCells(ps2, w._row, { mobile: "'+44 7878 514768" }); Logger.log('fixed phone #5533'); }
  try { syncYeshivaTags(M, keeps, me.email); } catch (err) { Logger.log('tags: ' + err); }
  dropCaches(M, true, true, true);
}
/** פונעם עדיטאר: די סקיצע פון דער פנימייה — חדר 107 אן דער וואנט אינמיטן */
function dormImg107Fix() { const x = regDevMe_(); putSetting(x.M, x.me, 'dormimg:B1', 'data:image/webp;base64,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'); Logger.log('ok ' + 'data:image/webp;base64,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'.length); }

// =====================================================================
// 📞 קו טלפון למלאי המטבח — ימות המשיח, שלוחה מסוג API (type=api)
// ימות המשיח שולחים GET לכתובת: ...exec?yemot=1&m=<מוסד>&k=<מפתח> + ApiPhone, ApiCallId, ApiExtension,
// וכל מה שהמתקשר כבר הקיש (P = מספר מוצר, A = פעולה, Q = כמות). התשובה — טקסט פקודות של ימות.
// מספר מוצר = הספרות של product_id (K12 → 12). רק טלפונים מורשים (Settings "k_phones" = [{ phone, name }]).
// המפתח: Script Properties "YEMOT_KEY_<מוסד>" — נוצר מהאתר (⚙ קו טלפון), לא בקוד.
// =====================================================================
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.yemot) {
    // 🔎 יומן לבדיקה (בלי המפתח): רואים ב"הפעלות" של הפרויקט
    const safe = {}; Object.keys(p).forEach(function (k) { if (k !== 'k') safe[k] = p[k]; });
    let res;
    try { res = yemotCall(p); } catch (err) { console.error('yemot error', err && err.stack || err); res = 'id_list_message=t-' + ytts('אירעה שגיאה, נסו שוב מאוחר יותר') + '&go_to_folder=hangup'; }
    const keyOk = !!S(p.k) && S(p.k) === S(PropertiesService.getScriptProperties().getProperty('YEMOT_KEY_' + S(p.m)));
    console.log('yemot in: ' + JSON.stringify(safe) + ' | key ok: ' + keyOk + ' | out: ' + res);
    try { const M0 = mosadOf(p.m); if (M0) ensureTab(M0.book, 'YemotLog', ['at', 'params', 'key_ok', 'out']).appendRow([now(), JSON.stringify(safe).slice(0, 1000), keyOk ? 'yes' : 'NO', String(res).slice(0, 1000)]); } catch (err) { /* */ }
    return yemotText(res);
  }
  return out({ ok: true });
}
const YEMOT_PROXY = 'https://ungvar-sms.8510089.workers.dev/yemot';
function yemotText(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
/** טקסט להקראה: בלי התווים שימות לא מקבל (. - " ' & | , =) */
function ytts(s) { return S(s).replace(/[.\-"'&|,=]/g, ' ').replace(/\s+/g, ' ').trim(); }
const yNum = function (n) { const v = Math.round(Number(n) * 100) / 100; return v % 1 ? ytts(String(v).replace('.', ' נקודה ')) : 'n-' + v; };
function phoneKey(v) { let d = S(v).replace(/\D/g, ''); if (d.indexOf('972') === 0) d = '0' + d.slice(3); return d; }
function kPhones(M) {
  try { const r = objs(M.book.getSheetByName('Settings')).filter(function (x) { return S(x.key) === 'k_phones'; })[0]; const v = JSON.parse(S(r && r.value) || '[]'); return Array.isArray(v) ? v : []; } catch (err) { return []; }
}
function yemotCall(p) {
  const M = mosadOf(p.m);
  if (!M) return 'go_to_folder=hangup';
  const key = PropertiesService.getScriptProperties().getProperty('YEMOT_KEY_' + M.key);
  if (!key || S(p.k) !== key) return 'go_to_folder=hangup';
  if (S(p.hangup) === 'yes') return '';
  const ext = S(p.ApiExtension);
  const again = ext ? '&go_to_folder=/' + ext : '&go_to_folder=hangup';
  const who = kPhones(M).filter(function (x) { return phoneKey(x.phone) && phoneKey(x.phone) === phoneKey(p.ApiPhone); })[0];
  if (!who) return 'id_list_message=t-' + ytts('המספר שלך אינו מורשה לעדכן את המלאי') + '&go_to_folder=hangup';
  const P = S(p.P).replace(/\D/g, ''); const A = S(p.A).replace(/\D/g, ''); const Q = S(p.Q).replace(/[^\d*]/g, '').replace('*', '.');
  // קלט מספר: P,לא לשאול שוב,מקסימום,מינימום,שניות,הקראה,חסום כוכבית,חסום אפס,,ספרות מותרות,ניסיונות,ריק,ערך ריק
  if (!P) return 'read=t-' + ytts('שלום ' + S(who.name)) + '.t-' + ytts('הקישו את מספר המוצר ובסיומו סולמית') + '=P,no,5,1,10,Number,yes,no,,,,,';
  const ks = ensureTab(M.book, 'Kitchen', TABS.Kitchen);
  const all = objs(ks);
  const it = all.filter(function (x) { return S(x.product_id).replace(/\D/g, '') === P && S(x.product_name); })[0];
  if (!it) return 'id_list_message=t-' + ytts('מוצר מספר') + '.n-' + P + '.t-' + ytts('לא נמצא') + again;
  const name = ytts(it.product_name); const unit = ytts(it.unit || 'יחידות'); const pack = Math.max(1, Number(it.pack_size) || 1);
  const stock = Number(it.current_stock) || 0;
  if (!A) {
    return 'read=t-' + name + '.t-' + ytts('במלאי') + '.' + yNum(stock) + '.t-' + unit +
      '.t-' + ytts('לעדכון הכמות שיש במלאי הקישו 1') + '.t-' + ytts('לדיווח שהמוצר נגמר הקישו 2') + '.t-' + ytts('להוספת סחורה שהגיעה הקישו 3') +
      '=A,no,1,1,10,No,yes,no,,1.2.3,,,';
  }
  const meK = { email: 'phone:' + phoneKey(p.ApiPhone) + ' (' + S(who.name) + ')', perms: ['kitchen'], role: 'staff' };
  const done = function (newStock, what) {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { setCells(ks, it._row, { current_stock: newStock, updated_at: now(), updated_by: meK.email }); } finally { lock.releaseLock(); }
    logIt(M, meK, 'kitchen-phone', '', S(it.product_name) + ': ' + what + ' → ' + newStock);
    return 'id_list_message=t-' + ytts('עודכן') + '.t-' + name + '.t-' + ytts('במלאי עכשיו') + '.' + yNum(newStock) + '.t-' + unit + '.t-' + ytts('תודה') + again;
  };
  if (A === '2') return done(0, 'נגמר');
  if (A !== '1' && A !== '3') return 'go_to_folder=hangup';
  if (!Q) {
    const ask = A === '1' ? 'כמה ' + S(it.unit || 'יחידות') + ' יש עכשיו במלאי' : pack > 1 ? 'כמה קרטונים הגיעו' : 'כמה ' + S(it.unit || 'יחידות') + ' הגיעו';
    return 'read=t-' + ytts(ask) + '.t-' + ytts('הקישו מספר ובסיומו סולמית') + '=Q,no,6,1,10,Number,no,no,,,,,';
  }
  const q = Number(Q) || 0;
  if (A === '1') return done(q, 'עדכון כמות');
  return done(stock + q * pack, 'הגיע ' + q + (pack > 1 ? ' קרטונים' : ''));
}

// =====================================================================
// 📺 א שמחה פון א מוסד → גלייך אויפן מסך אין בית המדרש (גיליון פון דער תצוגה, לשונית Simchos: simcha_id | html | until | updated_at)
// דער זעלבער אויסזען ווי simchaHtml אינעם הויפט-אתר (+ געגנט נאך שליט"א/הי"ו, נישט ביי ני"ו). ווען א גבאי עפנט "שהשמחה במעונם", שרייבט דער אתר אלעס איבער.
// =====================================================================
const DISPLAY_SHEET = '1hhrsXNhDCK7OGXOClTPE8pxOJ3EjmTmndH0r_qrms70';
const SG_TYPES = { birth: ['לרגל הולדת', ''], upsherin: ['לרגל שמחת האפשערן של', ''], barmitzvah: ['לרגל הכנסת', 'לעול התורה והמצוות'], erusin: ['לרגל אירוסי', '', 1], nisuin: ['לרגל נישואי', '', 1] };
function sgEsc_(v) { return S(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function sgNb_(x) { return x ? '<span class="nb">' + x + '</span>' : ''; }
function sgName_(title, first, last, suffix) {
  const a = [sgEsc_(title), first ? '<b>' + sgEsc_(first) + '</b>' : ''].filter(Boolean).join(' ');
  const b = [last ? '<b>' + sgEsc_(last) + '</b>' : '', sgEsc_(suffix)].filter(Boolean).join(' ');
  return [sgNb_(a), sgNb_(b)].filter(Boolean).join(' ');
}
function sgSplitLast_(nm) { const w = S(nm).split(/\s+/).filter(Boolean); return w.length > 1 ? [w.slice(0, -1).join(' '), w[w.length - 1]] : [w.join(' '), '']; }
function sgBold_(text, surname) {
  const t = S(text); if (!t) return '';
  const m = /^(\S*["״'׳]\S*)\s+(.+)$/.exec(t);
  const title = m ? m[1] : ''; const rest = m ? m[2] : t;
  if (!surname) return sgName_(title, rest, '', '');
  const fl = sgSplitLast_(rest); return sgName_(title, fl[0], fl[1], '');
}
/** געגנט נאכן סיומת — נאר ביי שליט"א / הי"ו (נישט ביי ני"ו / נ"י) */
function sgArea_(suffix, area) { return ''; } // געגנט — אראפגענומען (ער באבעטן)
function screenPush_(o, hon) {
  const ids = {}; hon.forEach(function (x) { if (x.id) ids[x.id] = 1; });
  const cs = {};
  if (Object.keys(ids).length) objsCols(main().getSheetByName('Contacts'), ['contact_id', 'first_name_he', 'last_name_he', 'area']).forEach(function (c) { if (ids[S(c.contact_id)]) cs[S(c.contact_id)] = c; });
  const lines = hon.map(function (x) {
    const c = cs[x.id] || {};
    const fl = x.id ? [S(c.first_name_he), S(c.last_name_he)] : sgSplitLast_(x.name);
    return '<div class="sg-name">' + sgName_(x.title, fl[0], fl[1], x.suffix) + sgArea_(x.suffix, x.id ? c.area : '') + '</div>';
  }).join('');
  const ty = SG_TYPES[o.type] || SG_TYPES.birth;
  const rel = hon.length > 1 ? 'צאצאיהם' : (o.child_gender === 'f' ? 'בתו' : 'בנו');
  const forLine = [sgEsc_(ty[0]), rel, sgBold_(o.child_name), ty[2] && S(o.other_side) ? ('עב"ג ' + sgBold_(o.other_side, true)) : '', sgEsc_(ty[1]), 'בשעטו"מ'].filter(function (x) { return S(x); }).join(' ');
  const html = '<div class="sg-entry">' + lines + '<div class="sg-for">' + forLine + '</div></div>';
  const until = String(Date.now() + 7 * 864e5);
  const sh = SpreadsheetApp.openById(DISPLAY_SHEET).getSheetByName('Simchos');
  if (!sh) return;
  const last = sh.getLastRow();
  const idsCol = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return S(r[0]); }) : [];
  const i = idsCol.indexOf(String(o.simcha_id));
  const row = i >= 0 ? i + 2 : Math.max(2, last + 1);
  sh.getRange(row, 1, 1, 4).setNumberFormat('@').setValues([[String(o.simcha_id), html, until, now()]]);
}


// ====================================================================== 🌐 האתר הציבורי ungvar.org (בלי כניסה)
/** הרשמה ל-SMS מהאתר: נשמר "pending" בלשונית WebSignups של המאגר הראשי. אחרי אישור Telnyx — הודעת אישור כפול (YES). */
const WEB_CONSENT = 'I agree to receive recurring automated text messages from Khal Ungvar (prayer times, zmanim and community updates) at this number. Consent is not a condition of any purchase. Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. Terms: ungvar.org/sms.html · Privacy: ungvar.org/privacy.html';
function webSignup_(req) {
  if (S(req.website)) return { ok: true }; // הוניג-טאפ פאר ראבאטן
  if (req.consent !== true) return { error: 'need-consent' };
  if (!String(req.name || '').trim()) return { error: 'need-name' };
  let d = String(req.phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  if (d.length !== 10 || /^[01]/.test(d)) return { error: 'bad-phone' };
  const phone = '+1' + d;
  const cache = CacheService.getScriptCache();
  const tot = Number(cache.get('websig:all') || 0);
  if (tot > 60) return { error: 'too-many' };
  if (cache.get('websig:' + phone)) return { ok: true, again: true };
  cache.put('websig:all', String(tot + 1), 3600);
  cache.put('websig:' + phone, '1', 600);
  const clean = function (v, n) { v = String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n); return /^[=+\-@]/.test(v) ? "'" + v : v; };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const book = SpreadsheetApp.openById(MAIN_ID);
    let sh = book.getSheetByName('WebSignups');
    const H = ['at', 'phone', 'name', 'list', 'status', 'consent_text', 'source'];
    if (!sh) { sh = book.insertSheet('WebSignups'); sh.getRange(1, 1, 1, H.length).setValues([H]); sh.setFrozenRows(1); }
    const last = sh.getLastRow();
    const have = last > 1 ? sh.getRange(2, 2, last - 1, 4).getValues() : [];
    if (have.some(function (r) { return S(r[0]) === phone && S(r[3]) === 'pending'; })) return { ok: true, again: true };
    sh.getRange(last + 1, 1, 1, H.length).setNumberFormat('@').setValues([[now(), phone, clean(req.name, 60), 'zmanim-bp', 'pending', WEB_CONSENT, 'ungvar.org']]);
  } finally { lock.releaseLock(); }
  return { ok: true };
}
/** ספרים ומחירים (בלי מלאי): מתוך הלשונית Books של המאגר הראשי. מטמון 10 דקות. */
function webBooks_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('webbooks2'); if (hit) return JSON.parse(hit);
  const sh = SpreadsheetApp.openById(MAIN_ID).getSheetByName('Books');
  if (!sh) return { books: [] };
  const v = sh.getDataRange().getValues(); const hd = (v.shift() || []).map(S);
  const F = ['book_id', 'name', 'subtitle', 'volumes', 'price', 'vol_price', 'old_price', 'sale_price', 'sale_from', 'sale_to', 'category', 'sort', 'image', 'active', 'name_en', 'subtitle_en'];
  const day = (x) => (x instanceof Date ? Utilities.formatDate(x, 'America/New_York', 'yyyy-MM-dd') : S(x));
  const books = v.map(function (r) {
    const o = {}; F.forEach(function (f) { const i = hd.indexOf(f); if (i >= 0) o[f] = /^sale_(from|to)$/.test(f) ? day(r[i]) : r[i]; });
    if (!/^img\//.test(S(o.image))) o.image = ''; // רק תמונות מהאתר (לא מהדרייב)
    return o;
  }).filter(function (o) { return S(o.name) || o.category === '__all__'; }).filter(function (o) { return o.active === undefined || o.active === '' || o.active === true || S(o.active) === '1' || S(o.active).toUpperCase() === 'TRUE'; });
  const res = { books: books, at: now() };
  try { cache.put('webbooks2', JSON.stringify(res), 600); } catch (e) { /* גדול מדי */ }
  return res;
}


// ====================================================================== 🌐 קמפיינים באתר (ungvar.org/campaign.html?c=...)
// הגדרות: לשונית WebCampaigns במאגר הראשי (נערכת במערכת: קמפיין → "🌐 דף באתר").
// הסכום שנאסף והתורמים: מתוך Donations (campaign = עמודת campaign של ההגדרה).
// תשלום: Sola (Cardknox) — iFields בדפדפן (מספר הכרטיס לא עובר דרכנו), כאן רק cc:Sale עם ה-SUT.
// מפתחות (Script Properties, לא בקוד): SOLA_XKEY (סודי) · SOLA_IFIELDS_KEY (ציבורי, לדפדפן).
const WC_SW = ['KhalUngvar', '1.0'];
function wcRows_() {
  const sh = SpreadsheetApp.openById(MAIN_ID).getSheetByName('WebCampaigns');
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(); const hd = v.shift().map(S);
  return v.map(function (r) { const o = {}; hd.forEach(function (k, i) { o[k] = r[i]; }); return o; }).filter(function (o) { return S(o.slug); });
}
const wcOn_ = function (v) { return v === true || /^(true|1|yes)$/i.test(S(v)); };
const wcDay_ = function (x) { return x instanceof Date ? Utilities.formatDate(x, 'America/New_York', 'yyyy-MM-dd') : S(x).slice(0, 10); };
function wcPublic_(o) {
  const F = ['slug', 'campaign', 'title_he', 'title_yi', 'title_en', 'sub_he', 'sub_yi', 'sub_en', 'desc_he', 'desc_yi', 'desc_en', 'image', 'goal', 'amounts', 'donors_mode', 'monthly', 'fee', 'org'];
  const p = {}; F.forEach(function (k) { p[k] = o[k] === undefined ? '' : o[k]; });
  p.end_date = wcDay_(o.end_date);
  let pk = []; try { pk = JSON.parse(S(o.packages) || '[]'); } catch (e) { pk = []; }
  p.packages = Array.isArray(pk) ? pk : [];
  p.monthly = wcOn_(o.monthly); p.fee = wcOn_(o.fee);
  let mt = null; try { mt = S(o.match) ? JSON.parse(S(o.match)) : null; } catch (e) { mt = null; }
  p.match = mt && Number(mt.mult) > 1 ? { mult: Number(mt.mult), sponsor: S(mt.sponsor), cap: Number(mt.cap) || 0 } : null;
  p.event_date = wcDay_(o.event_date);
  return p;
}
/** תרגום (רק למשתמש מחובר): texts → { yi:[...], en:[...] } */
function wcTranslate_(req) {
  const texts = (req.texts || []).slice(0, 20).map(function (x) { return S(x).slice(0, 4000); });
  const res = {};
  ['yi', 'en'].forEach(function (to) {
    res[to] = texts.map(function (t) { if (!t) return ''; try { return LanguageApp.translate(t, 'iw', to); } catch (e) { return ''; } });
  });
  return res;
}
/** {slug} → הגדרות + נאסף + תורמים; בלי slug → רשימת הקמפיינים הפעילים */
function webCampaign_(req) {
  const slug = S(req.c || req.slug).toLowerCase();
  const cache = CacheService.getScriptCache();
  const prev = S(req.preview) === '1' && !!slug; // תצוגה מקדימה (גם כשהדף כבוי) — רק עם הקישור המלא
  const ck = 'webcamp:' + (slug || '*') + (prev ? ':p' : '');
  const hit = cache.get(ck); if (hit) return JSON.parse(hit);
  const rows = wcRows_().filter(function (o) { return wcOn_(o.active) || (prev && S(o.slug).toLowerCase() === slug); });
  let res;
  if (!slug) {
    res = { list: rows.map(function (o) { return { slug: S(o.slug), title_he: S(o.title_he), title_yi: S(o.title_yi), title_en: S(o.title_en), image: S(o.image) }; }) };
  } else {
    const o = rows.filter(function (x) { return S(x.slug).toLowerCase() === slug; })[0];
    if (!o) return { error: 'not-found' };
    const p = wcPublic_(o);
    const st = wcStats_(S(o.campaign), p.donors_mode, p.packages);
    res = { campaign: p, raised: st.raised, donors: st.donors, recent: st.recent, taken: st.taken, ifields: S(PropertiesService.getScriptProperties().getProperty('SOLA_IFIELDS_KEY')), pay: !!PropertiesService.getScriptProperties().getProperty('SOLA_XKEY'), at: now() };
  }
  try { cache.put(ck, JSON.stringify(res), 20); } catch (e) { /* */ }
  return res;
}
function wcStats_(campaign, mode, packages) {
  const book = SpreadsheetApp.openById(MAIN_ID);
  const dsh = book.getSheetByName('Donations');
  const out = { raised: 0, donors: 0, recent: [], taken: {} };
  if (!dsh || !campaign) return out;
  const v = dsh.getDataRange().getValues(); const hd = v.shift().map(S);
  const ix = function (k) { return hd.indexOf(k); };
  const iC = ix('campaign'), iA = ix('amount_usd'), iId = ix('contact_id'), iN = ix('donor_name'), iNote = ix('event_note'), iCr = ix('created_at'), iDt = ix('dedication_type'), iDx = ix('dedication_text');
  const mine = v.filter(function (r) { return S(r[iC]) === campaign && Number(r[iA]) > 0; });
  const who = {};
  mine.forEach(function (r) { out.raised += Number(r[iA]) || 0; who[S(r[iId]) || ('n:' + S(r[iN]))] = 1; const m = /\[pkg:([^\]]+)\]/.exec(S(r[iNote])); if (m) out.taken[m[1]] = (out.taken[m[1]] || 0) + 1; });
  out.donors = Object.keys(who).length;
  out.raised = Math.round(out.raised * 100) / 100;
  if (mode === 'none') return out;
  const csh = book.getSheetByName('Contacts');
  const cv = csh.getDataRange().getValues(); const ch = cv.shift().map(S);
  const ci = function (k) { return ch.indexOf(k); };
  const cs = {}; cv.forEach(function (r) { cs[S(r[0])] = r; });
  const name = function (r) {
    const c = cs[S(r[iId])];
    if (!c) return { he: S(r[iN]), en: S(r[iN]) };
    return { he: [S(c[ci('title_he')]), S(c[ci('first_name_he')]), S(c[ci('last_name_he')])].filter(String).join(' '), en: [S(c[ci('title_en')]), S(c[ci('first_name_en')]), S(c[ci('last_name_en')])].filter(String).join(' ') };
  };
  out.recent = mine.slice().sort(function (a, b) { return S(b[iCr]).localeCompare(S(a[iCr])); }).slice(0, 30).map(function (r) {
    const anon = /\[anon\]/.test(S(r[iNote]));
    const nm = anon ? { he: '', en: '' } : name(r);
    const ded = [S(r[iDt]), S(r[iDx])].filter(String).join(' ');
    return { he: nm.he, en: nm.en, anon: anon, amount: mode === 'names' ? null : Number(r[iA]) || 0, ded: anon ? '' : ded.slice(0, 80), monthly: /\[monthly\]/.test(S(r[iNote])) };
  });
  return out;
}
function wcClean_(v, n) { v = String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n); return /^[=+\-@]/.test(v) ? "'" + v : v; }
/** תרומה מהאתר: cc:Sale ב-Sola, ואם חודשי — CreateSchedule (מהחודש הבא). נרשם ב-Donations + WebDonations. */
function webDonate_(req) {
  if (S(req.website)) return { ok: true }; // הוניג-טאפ
  const props = PropertiesService.getScriptProperties();
  const xKey = S(props.getProperty('SOLA_XKEY'));
  if (!xKey) return { error: 'not-ready' };
  const slug = S(req.c).toLowerCase();
  const o = wcRows_().filter(function (x) { return wcOn_(x.active) && S(x.slug).toLowerCase() === slug; })[0];
  if (!o) return { error: 'not-found' };
  const p = wcPublic_(o);
  let base = Math.round(Number(req.amount) * 100) / 100;
  let pkg = null;
  if (S(req.pkg)) { pkg = p.packages.filter(function (k) { return S(k.id) === S(req.pkg); })[0] || null; if (!pkg) return { error: 'bad-pkg' }; base = Number(pkg.amount) || 0; }
  if (!(base >= 1 && base <= 50000)) return { error: 'bad-amount' };
  const fee = p.fee && req.fee === true ? Math.round(base * 0.03 * 100) / 100 : 0;
  const total = Math.round((base + fee) * 100) / 100;
  const monthly = p.monthly && req.monthly === true && !pkg;
  const months = Math.max(0, Math.min(120, Math.floor(Number(req.months) || 0)));
  const first = wcClean_(req.first, 40), last = wcClean_(req.last, 40);
  if (!first || !last) return { error: 'need-name' };
  let ph = S(req.phone).replace(/\D/g, ''); if (ph.length === 11 && ph.charAt(0) === '1') ph = ph.slice(1);
  if (ph && ph.length !== 10) return { error: 'bad-phone' };
  const email = S(req.email).trim().slice(0, 100);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'bad-email' };
  if (!S(req.card) || !S(req.cvv)) return { error: 'need-card' };
  const exp = S(req.exp).replace(/\D/g, '');
  if (!/^(0[1-9]|1[0-2])\d{2}$/.test(exp)) return { error: 'bad-exp' };
  const cache = CacheService.getScriptCache();
  const tot = Number(cache.get('webdon:all') || 0);
  if (tot > 40) return { error: 'too-many' };
  cache.put('webdon:all', String(tot + 1), 3600);
  const inv = 'WEB' + Utilities.formatDate(new Date(), 'America/New_York', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  const sale = {
    xKey: xKey, xVersion: '5.0.0', xSoftwareName: WC_SW[0], xSoftwareVersion: WC_SW[1], xCommand: 'cc:Sale',
    xAmount: total.toFixed(2), xCardNum: S(req.card), xCVV: S(req.cvv), xExp: exp,
    xBillFirstName: first, xBillLastName: last, xBillMobile: ph, xEmail: email, xInvoice: inv,
    xDescription: S(o.campaign).slice(0, 100), xCustom01: slug, xCustom02: pkg ? S(pkg.id) : '', xCustReceipt: email ? 'True' : 'False'
  };
  let r;
  try { r = JSON.parse(UrlFetchApp.fetch('https://x1.cardknox.com/gatewayjson', { method: 'post', contentType: 'application/json', payload: JSON.stringify(sale), muteHttpExceptions: true }).getContentText()); }
  catch (err) { return { error: 'gateway', msg: String(err).slice(0, 120) }; }
  if (S(r.xResult) !== 'A') return { error: 'declined', msg: S(r.xError || r.xStatus).slice(0, 160) };
  const last4 = S(r.xMaskedCardNumber).replace(/\D/g, '').slice(-4);
  let sched = '', schedErr = '';
  if (monthly && S(r.xToken)) {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    const body = { SoftwareName: WC_SW[0], SoftwareVersion: WC_SW[1], IntervalType: 'month', IntervalCount: 1, Amount: Number(total.toFixed(2)),
      StartDate: Utilities.formatDate(d, 'America/New_York', 'yyyy-MM-dd'), Description: S(o.campaign).slice(0, 100), CustReceipt: !!email, Invoice: inv + 'M',
      NewCustomer: { BillFirstName: first, BillLastName: last, Email: email, BillMobile: ph, CustomerNotes: 'ungvar.org ' + slug },
      NewPaymentMethod: { Token: S(r.xToken), TokenType: 'cc' } };
    if (months > 1) body.TotalPayments = months - 1;
    try {
      const s2 = JSON.parse(UrlFetchApp.fetch('https://api.cardknox.com/v2/CreateSchedule', { method: 'post', contentType: 'application/json', headers: { Authorization: xKey, 'X-Recurring-Api-Version': '2.1' }, payload: JSON.stringify(body), muteHttpExceptions: true }).getContentText());
      if (S(s2.Result) === 'S') sched = S(s2.ScheduleId); else schedErr = S(s2.Error).slice(0, 120) || 'schedule-failed';
    } catch (err) { schedErr = String(err).slice(0, 120); }
  }
  try { wcRecord_(o, p, { total: total, base: base, fee: fee, first: first, last: last, phone: ph, email: email, last4: last4, ref: S(r.xRefNum), inv: inv, pkg: pkg, anon: req.anon === true, monthly: monthly, months: months, sched: sched, schedErr: schedErr, dedType: wcClean_(req.dedType, 20), dedText: wcClean_(req.dedText, 120), lang: S(req.lang).slice(0, 2) }); }
  catch (err) { Logger.log('webDonate record ' + err); }
  try { cache.removeAll(['webcamp:' + slug, 'webcamp:' + slug + ':p', 'webcamp:*']); } catch (e) { /* */ }
  return { ok: true, ref: S(r.xRefNum), amount: total, last4: last4, monthly: monthly, sched: !!sched, schedErr: schedErr ? true : false };
}
function wcRecord_(o, p, d) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const book = SpreadsheetApp.openById(MAIN_ID);
    // איש קשר לפי טלפון / אימייל (רק אם יש התאמה אחת)
    let cid = '';
    const psh = book.getSheetByName('Phones');
    if (psh && (d.phone || d.email)) {
      const pv = psh.getDataRange().getValues(); const ph = pv.shift().map(S);
      const pcols = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'].map(function (k) { return ph.indexOf(k); }).filter(function (i) { return i >= 0; });
      const ecols = ['email_1', 'email_2'].map(function (k) { return ph.indexOf(k); }).filter(function (i) { return i >= 0; });
      const hits = {};
      pv.forEach(function (r) {
        const id = S(r[0]); if (!id) return;
        if (d.phone && pcols.some(function (i) { const x = S(r[i]).replace(/\D/g, ''); return x.slice(-10) === d.phone; })) hits[id] = 1;
        if (d.email && ecols.some(function (i) { return S(r[i]).toLowerCase() === d.email.toLowerCase(); })) hits[id] = 1;
      });
      const ks = Object.keys(hits); if (ks.length === 1) cid = ks[0];
    }
    const dsh = book.getSheetByName('Donations');
    const hd = dsh.getRange(1, 1, 1, dsh.getLastColumn()).getValues()[0].map(S);
    const lastRow = dsh.getLastRow();
    const ids = lastRow > 1 ? dsh.getRange(2, 1, lastRow - 1, 1).getValues().map(function (r) { return Number(r[0]) || 0; }) : [];
    const nid = Math.max.apply(null, [0].concat(ids)) + 1;
    const today = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    const ym = /(תש\S*)\s*$/.exec(S(o.campaign));
    const tags = (d.anon ? ' [anon]' : '') + (d.monthly ? ' [monthly]' : '') + (d.pkg ? ' [pkg:' + S(d.pkg.id) + ']' : '');
    const note = 'אתר ungvar.org' + (d.pkg ? ' · ' + S(d.pkg.name_he || d.pkg.name_en) : '') + (d.monthly ? ' · הוראת קבע' + (d.months ? ' ' + d.months + ' חודשים' : '') : '') + (cid ? '' : ' · ' + [d.phone, d.email].filter(String).join(' ')) + tags;
    const rec = { donation_id: String(nid), contact_id: cid, date: today, event_year: ym ? ym[1] : '', event_note: note, amount_usd: d.total, is_paid: 'TRUE', paid_date: today,
      payment_method: 'כרטיס אשראי', card_last4: d.last4, payment_note: 'Sola ' + d.ref + (d.fee ? ' · כולל עמלה $' + d.fee : '') + (d.sched ? ' · Schedule ' + d.sched : '') + (d.schedErr ? ' · ⚠ הוראת קבע לא נוצרה' : ''),
      dedication_type: d.dedText ? d.dedType : '', dedication_text: d.dedText, created_at: now(), created_by: 'ungvar.org', updated_at: now(), updated_by: 'ungvar.org',
      donor_name: d.first + ' ' + d.last, campaign: S(o.campaign), org: S(o.org) };
    dsh.getRange(lastRow + 1, 1, 1, hd.length).setNumberFormat('@').setValues([hd.map(function (k) { return rec[k] === undefined ? '' : String(rec[k]); })]);
    let wsh = book.getSheetByName('WebDonations');
    const WH = ['at', 'donation_id', 'contact_id', 'slug', 'campaign', 'amount', 'fee', 'first', 'last', 'phone', 'email', 'last4', 'ref', 'invoice', 'package', 'monthly', 'months', 'schedule', 'schedule_error', 'dedication', 'anon', 'lang'];
    if (!wsh) { wsh = book.insertSheet('WebDonations'); wsh.getRange(1, 1, 1, WH.length).setValues([WH]); wsh.setFrozenRows(1); }
    wsh.appendRow([now(), String(nid), cid, S(o.slug), S(o.campaign), d.total, d.fee, d.first, d.last, d.phone, d.email, d.last4, d.ref, d.inv, d.pkg ? S(d.pkg.id) : '', d.monthly ? 'TRUE' : '', d.months || '', d.sched, d.schedErr, [d.dedType, d.dedText].filter(String).join(' '), d.anon ? 'TRUE' : '', d.lang]);
  } finally { lock.releaseLock(); }
}

// =====================================================================================
// 🕍 מרכז הכוללים — טופס הרשמה לאברכים (ungvar.org/kollel/register): אימייל + קוד (בלי גוגל).
//    חלק 1 = פתיחה: מצב משפחתי + ID ו-SS (שלו ושל האשה / של ההורים) — רק כשה-AI אישר → נפתחת רשומה (status open).
//    חלק 2 = שאר המסמכים + הפרטים + חתימה. מקום אחד להעלאה: Gemini ממיין כל קובץ, בודק שהוא קריא ובתוקף.
//    לגבאים: 📥 הרשמות (הרשאה kollel_reg).
// =====================================================================================
TABS.KollelApps = ['app_id', 'email', 'salt', 'hash', 'ver', 'created_at', 'status', 'lang', 'data', 'files', 'ai', 'submitted_at', 'updated_at', 'updated_by', 'folder_id', 'contact_id', 'note', 'opened_at'];
PERMS.push('kollel_reg');
['salt', 'hash', 'files', 'ai'].forEach(function (k) { BIG[k] = true; });
READS.kaList = 1; READS.kaFile = 1;
const KA_FIELDS = ['yi_name', 'legal_first', 'legal_last', 'phone', 'address', 'city', 'state', 'zip', 'dob', 'ssn', 'marital', 'marital_date',
  'wife_first', 'wife_last', 'wife_dob', 'wife_ssn', 'wife_phone', 'wedding_date', 'children', 'growing', 'oldest_dob',
  'parents_ny', 'father_name', 'mother_name', 'father_address', 'father_phone', 'fil_name', 'wife_mother_name', 'fil_address',
  'father_legal', 'father_dob', 'father_ssn', 'mother_legal', 'mother_dob', 'mother_ssn',
  'hs_name', 'hs_city', 'hs_grad', 'yg_name', 'yg_city', 'yg_start', 'yg_end', 'other_yeshivas', 'sig_self_name', 'sig_wife_name', 'sig_date', 'notes', 'email', 'dependents_count', 'dependents_names'];
// סוגי המסמכים (לזיהוי ע"י Gemini)
const KA_KINDS = {
  id_self: 'government photo ID (driver license / state ID / passport) of the APPLICANT (the man)', ss_self: 'Social Security card of the APPLICANT', birth_self: 'birth certificate of the APPLICANT',
  id_wife: 'government photo ID of the applicant\'s WIFE', ss_wife: 'Social Security card of the applicant\'s WIFE', birth_wife: 'birth certificate of the applicant\'s WIFE',
  marriage: 'marriage certificate / marriage registration of the applicant and his wife',
  diploma: 'school diploma or transcript (yeshiva / high school) of the APPLICANT',
  id_father: 'government photo ID of the applicant\'s FATHER', ss_father: 'Social Security card of the applicant\'s FATHER',
  id_mother: 'government photo ID of the applicant\'s MOTHER', ss_mother: 'Social Security card of the applicant\'s MOTHER',
  tax1: 'US tax document (Form 1040 / W-2 etc.) for tax year Y1 (of the applicant or a parent)', tax2: 'US tax document (Form 1040 / W-2 etc.) for tax year Y2 (of the applicant or a parent)' };
const KA_LABEL = { id_self: 'ID', ss_self: 'SS', birth_self: 'Birth cert', id_wife: 'ID wife', ss_wife: 'SS wife', birth_wife: 'Birth cert wife', marriage: 'Marriage cert', diploma: 'Diploma / transcript',
  id_father: 'ID father', ss_father: 'SS father', id_mother: 'ID mother', ss_mother: 'SS mother', tax1: 'Tax', tax2: 'Tax', sig_self: 'Signature', sig_wife: 'Signature wife' };
/** מה צריך לפי המצב המשפחתי: gate = לפתיחה (חלק 1), rest = בחלק 2 */
function kaReq(marital) {
  if (marital === 'married') return { gate: ['id_self', 'ss_self', 'id_wife', 'ss_wife'], rest: ['birth_self', 'birth_wife', 'marriage', 'diploma', 'tax1', 'tax2'] };
  if (marital === 'unmarried') return { gate: ['id_self', 'ss_self', 'id_father', 'ss_father', 'id_mother', 'ss_mother'], rest: ['birth_self', 'diploma', 'tax1', 'tax2'] };
  return { gate: ['id_self', 'ss_self'], rest: ['diploma', 'tax1', 'tax2'] };
}
const KA_STATUS = { draft: 1, open: 1, submitted: 1, updated: 1, approved: 1, rejected: 1 };
function kaTaxYears() { const y = Number(Utilities.formatDate(new Date(), 'America/New_York', 'yyyy')); return [y - 2, y - 1]; }
function kaRows(M) { return objs(ensureTab(M.book, 'KollelApps', TABS.KollelApps)).filter(function (a) { return S(a.app_id); }); }
function kaJ(v, d) { try { const x = JSON.parse(S(v) || ''); return x === null || x === undefined ? d : x; } catch (err) { return d; } }
function kaMail(v) { return S(v).toLowerCase(); }
/** files: { pool: [{id,name,type,at,kinds:[],check:{status:'ok'|'bad'|'pending',en,yi}}], sig_self: [..], sig_wife: [..] } (+ המרה מהמבנה הישן) */
function kaFiles(a) {
  const f = kaJ(a.files, {});
  if (!f.pool) {
    const pool = [];
    Object.keys(f).forEach(function (k) { if (k.indexOf('sig_') === 0) return; (f[k] || []).forEach(function (x) { pool.push({ id: x.id, name: x.name, type: x.type, at: x.at, kinds: KA_KINDS[k] ? [k] : [], check: x.check ? { status: x.check.ok ? 'ok' : 'bad', en: x.check.en, yi: x.check.yi } : { status: 'pending' } }); }); });
    const o = { pool: pool }; if (f.sig_self) o.sig_self = f.sig_self; if (f.sig_wife) o.sig_wife = f.sig_wife;
    return o;
  }
  return f;
}
function kaHave(files, kind) { return (files.pool || []).some(function (x) { return x.check && x.check.status === 'ok' && (x.kinds || []).indexOf(kind) >= 0; }); }
function kaView(a, staff) {
  const d = kaJ(a.data, {});
  const o = { app_id: S(a.app_id), email: S(a.email), status: S(a.status) || 'draft', lang: S(a.lang), created_at: S(a.created_at), submitted_at: S(a.submitted_at), opened_at: S(a.opened_at),
    updated_at: S(a.updated_at), updated_by: S(a.updated_by), data: d, contact_id: S(a.contact_id), taxYears: kaTaxYears(), req: kaReq(S(d.marital)) };
  const f = kaFiles(a);
  o.files = { pool: (f.pool || []).map(function (x) { return { name: S(x.name), type: S(x.type), at: S(x.at), kinds: x.kinds || [], check: x.check || { status: 'pending' } }; }),
    sig_self: (f.sig_self || []).map(function (x) { return { name: S(x.name), at: S(x.at) }; }), sig_wife: (f.sig_wife || []).map(function (x) { return { name: S(x.name), at: S(x.at) }; }) };
  if (staff) { o.note = S(a.note); o.ai = kaJ(a.ai, null); }
  return o;
}
function kaSession(M, tok) {
  const raw = CacheService.getScriptCache().get('kas:' + S(tok).slice(0, 90));
  if (!raw) throw new Error('ka-login');
  const s = JSON.parse(raw);
  if (s.m !== M.key) throw new Error('ka-login');
  const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(s.id); })[0];
  if (!a || Number(a.ver || 0) !== Number(s.v)) throw new Error('ka-login');
  return a;
}
function kaFolder(M, a) {
  if (S(a.folder_id)) { try { return DriveApp.getFolderById(S(a.folder_id)); } catch (err) { /* */ } }
  return folderPath(['מוסדות אונגוואר', S(M.name) || M.key, 'הרשמות']).createFolder(S(a.app_id) + ' ' + S(a.email));
}
function kaSaveBlob(M, a, dataUrl, name) {
  const m = S(dataUrl).match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/);
  if (!m) throw new Error('bad-file');
  if (m[2].length > 9000000) throw new Error('file-big');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[m[1]];
  const folder = kaFolder(M, a);
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], (S(name).replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'doc') + ' ' + Utilities.formatDate(new Date(), 'America/New_York', 'HHmmss') + '.' + ext));
  return { id: file.getId(), type: m[1], folder: folder.getId() };
}
function kaBlobUrl(id) { const b = DriveApp.getFileById(id).getBlob(); return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()); }
function kaSet(M, a, o) { setCells(M.book.getSheetByName('KollelApps'), a._row, o); Object.keys(o).forEach(function (k) { a[k] = o[k]; }); }
function kaClean(d) { const o = {}; KA_FIELDS.forEach(function (k) { if (k in (d || {})) o[k] = S(d[k]).slice(0, k === 'notes' || k === 'other_yeshivas' || k === 'dependents_names' ? 2000 : 300); }); return o; }

/** Gemini — קריאה אחת עם ניסיונות חוזרים (עסוק → מחכה ומנסה שוב) */
function kaGemini_(parts, maxTok) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('ai-off');
  const model = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-flash-latest';
  const body = { contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0, maxOutputTokens: maxTok || 1024, responseMimeType: 'application/json' } };
  let res = null;
  for (let i = 0; i < 5; i++) {
    try { res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true, payload: JSON.stringify(body) }); } catch (err) { res = null; }
    if (res && [429, 500, 502, 503, 504].indexOf(res.getResponseCode()) < 0) break;
    Utilities.sleep(2000 * (i + 1));
  }
  if (!res || res.getResponseCode() !== 200) throw new Error('ai-busy');
  const txt = (((JSON.parse(res.getContentText()).candidates || [])[0] || {}).content || { parts: [] }).parts.map(function (p) { return p.text || ''; }).join('');
  try { return JSON.parse(txt.replace(/^```json|```$/g, '').trim()); } catch (err) { throw new Error('ai-busy'); }
}
/** 🤖 זיהוי + בדיקה של קובץ אחד. want = סוגים שהאברך בחר ידנית (אופציונלי) → { kinds, check } */
function kaClassify_(fileId, data, want) {
  const ty = kaTaxYears();
  const b = DriveApp.getFileById(fileId).getBlob();
  const known = [S(data.legal_first) && 'applicant: ' + S(data.legal_first) + ' ' + S(data.legal_last), S(data.wife_first) && 'wife: ' + S(data.wife_first) + ' ' + S(data.wife_last)].filter(Boolean).join('; ');
  const kinds = Object.keys(KA_KINDS).map(function (k) { return k + ' = ' + KA_KINDS[k].replace('Y1', ty[0]).replace('Y2', ty[1]); }).join('\n');
  const prompt = ['A kollel (Torah study program) applicant in Brooklyn uploaded this file for his enrollment. Marital status: ' + (S(data.marital) || 'unknown') + '.',
    want && want.length ? 'The applicant says this file is: ' + want.join(', ') + '. Verify that.' : 'Identify which of these documents it contains (a file may contain more than one, e.g. front and back, or ID and SS card on one page):',
    kinds,
    'Decide whose document it is from the name on it and the context (applicant = the man; wife; father; mother).' + (known ? ' Known names: ' + known + '.' : ''),
    'Then check: is it readable (not blurry, not cut off — names and numbers visible)? For an ID: is it expired? For tax: is it the right year?',
    'Return ONLY JSON: {"kinds": [codes from the list that this file really contains], "ok": true/false (false if unreadable, expired, wrong year, or not a needed document),',
    '"en": "short message to the applicant in simple English (empty if ok)", "yi": "the same message in Yiddish, Hebrew letters (empty if ok)"}'].join('\n');
  const j = kaGemini_([{ text: prompt }, { inline_data: { mime_type: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) } }], 500);
  const ks = (Array.isArray(j.kinds) ? j.kinds : []).map(S).filter(function (k) { return KA_KINDS[k]; });
  let ok = j.ok !== false && ks.length > 0;
  let en = S(j.en), yi = S(j.yi);
  if (!ks.length && !en) { en = 'We could not recognize this document. Please upload a clear photo of one of the required documents.'; yi = 'מען האט נישט דערקענט דעם דאקומענט. ביטע לייג ארויף א קלארע בילד פון איינעם פון די נויטיגע דאקומענטן.'; }
  return { kinds: ks, check: { status: ok ? 'ok' : 'bad', en: en.slice(0, 300), yi: yi.slice(0, 300), at: now() } };
}
/** בודק את כל הקבצים שממתינים (pending) — עם הגבלה */
function kaCheckPending_(M, a, onlyIdx) {
  const files = kaFiles(a); const d = kaJ(a.data, {});
  const c = CacheService.getScriptCache(); const ck = 'kachk:' + M.key + ':' + S(a.app_id);
  (files.pool || []).forEach(function (x, i) {
    if (onlyIdx !== undefined && i !== onlyIdx) return;
    if (x.check && x.check.status !== 'pending') return;
    const n = Number(c.get(ck) || 0); if (n >= 80) return;
    c.put(ck, String(n + 1), 21600);
    try { const r = kaClassify_(x.id, d, x.want || null); x.kinds = r.kinds; x.check = r.check; } catch (err) { x.check = { status: 'pending', en: '', yi: '' }; }
  });
  return files;
}
/** 🤖 מילוי השדות מכל המסמכים המאושרים */
function kaExtract_(M, a) {
  const files = kaFiles(a);
  const parts = [{ text: [
    'You read identity documents for a kollel enrollment form in Brooklyn NY. Extract ONLY what is clearly visible; never guess.',
    'Each document is preceded by its labels: *_self = the applicant (the man); *_wife = his wife; *_father / *_mother = his parents; marriage = marriage certificate; tax1/tax2 = tax documents (tax2 = most recent year).',
    'Return ONLY a JSON object with any of these keys (omit unknown): legal_first, legal_last, dob (YYYY-MM-DD), address, city, state, zip, ssn (###-##-####),',
    'wife_first, wife_last, wife_dob, wife_ssn, wedding_date (YYYY-MM-DD), father_name, mother_name (applicant\'s parents as on his birth certificate), fil_name, wife_mother_name (wife\'s parents, from her birth certificate),',
    'father_legal (father\'s full legal name from his ID/SS), father_dob, father_ssn, mother_legal, mother_dob, mother_ssn,',
    'dependents_count (number of dependent children on the most recent tax return) and dependents_names (one per line), and "notes": short English remarks about conflicts between documents.',
    'Legal names: as printed on the Social Security card when available (otherwise the ID).'].join('\n') }];
  let total = 0;
  (files.pool || []).forEach(function (x) {
    if (!x.check || x.check.status !== 'ok' || !(x.kinds || []).length) return;
    try {
      const b = DriveApp.getFileById(x.id).getBlob(); const bytes = b.getBytes();
      if (total + bytes.length > 15000000) return; total += bytes.length;
      parts.push({ text: 'Document: ' + x.kinds.join(', ') });
      parts.push({ inline_data: { mime_type: b.getContentType(), data: Utilities.base64Encode(bytes) } });
    } catch (err) { /* */ }
  });
  if (parts.length < 2) throw new Error('ai-no-docs');
  const j = kaGemini_(parts, 2048);
  const outF = {};
  ['legal_first', 'legal_last', 'dob', 'address', 'city', 'state', 'zip', 'ssn', 'wife_first', 'wife_last', 'wife_dob', 'wife_ssn', 'wedding_date', 'father_name', 'mother_name', 'fil_name', 'wife_mother_name',
    'father_legal', 'father_dob', 'father_ssn', 'mother_legal', 'mother_dob', 'mother_ssn', 'dependents_count', 'dependents_names'].forEach(function (k) {
    let v = j[k]; if (Array.isArray(v)) v = v.join('\n'); if (S(v)) outF[k] = S(v).slice(0, k === 'dependents_names' ? 1500 : 200); });
  return { fields: outF, notes: S(j.notes).slice(0, 600), at: now() };
}
/** ממלא רק שדות ריקים */
function kaMergeAi_(a, r) {
  const d = kaJ(a.data, {}); const filled = [];
  Object.keys(r.fields || {}).forEach(function (k) { if (!S(d[k])) { d[k] = r.fields[k]; filled.push(k); } });
  return { data: d, filled: filled };
}

const KA_PUB = {
  /** כניסה / הרשמה: { email, code, create } */
  kaAuth: function (M, req) {
    const email = kaMail(req.email); const code = S(req.code);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('ka-bad-email');
    if (code.length < 6) throw new Error('ka-short-code');
    const c = CacheService.getScriptCache();
    const fk = 'kaf:' + M.key + ':' + email.slice(0, 80);
    const fails = Number(c.get(fk) || 0);
    if (fails >= 6) throw new Error('ka-locked');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let a;
    try {
      a = kaRows(M).filter(function (x) { return kaMail(x.email) === email; })[0];
      if (req.create) {
        if (a) throw new Error('ka-exists');
        const n = Number(c.get('kanew:' + M.key) || 0);
        if (n > 60) throw new Error('too-many');
        c.put('kanew:' + M.key, String(n + 1), 3600);
        let mx = 100; kaRows(M).forEach(function (x) { const v = Number(x.app_id); if (isFinite(v) && v > mx) mx = v; });
        const salt = Utilities.getUuid();
        appendObj(M.book.getSheetByName('KollelApps'), { app_id: mx + 1, email: email, salt: salt, hash: kHash(salt, code), ver: 1, created_at: now(), status: 'draft',
          lang: S(req.lang) === 'yi' ? 'yi' : 'en', data: JSON.stringify({ marital: 'married' }), files: '{"pool":[]}', updated_at: now(), updated_by: 'form' });
        a = kaRows(M).filter(function (x) { return kaMail(x.email) === email; })[0];
      } else if (!a || kHash(S(a.salt), code) !== S(a.hash)) {
        c.put(fk, String(fails + 1), 900);
        throw new Error(a ? 'ka-bad' : 'ka-none');
      }
    } finally { lock.releaseLock(); }
    c.remove(fk);
    const tok = Utilities.getUuid() + Utilities.getUuid();
    c.put('kas:' + tok, JSON.stringify({ m: M.key, id: S(a.app_id), v: Number(a.ver || 1) }), 21600);
    return { ok: true, ks: tok, app: kaView(a, false), name: M.name };
  },
  kaGet: function (M, req) { const a = kaSession(M, req.ks); return { app: kaView(a, false), name: M.name }; },
  /** שמירה / שליחה: { ks, data, submit, lang } */
  kaSave: function (M, req) {
    const a = kaSession(M, req.ks);
    const st = S(a.status) || 'draft';
    const nd = kaClean(req.data);
    if (st !== 'draft') delete nd.marital; // אחרי הפתיחה — מצב משפחתי רק דרך המשרד
    const d = Object.assign(kaJ(a.data, {}), nd);
    const o = { data: JSON.stringify(d), updated_at: now(), updated_by: 'form' };
    if (req.lang) o.lang = S(req.lang) === 'yi' ? 'yi' : 'en';
    if (req.submit) {
      if (st === 'draft') throw new Error('ka-not-open');
      const need2 = ['yi_name', 'legal_first', 'legal_last', 'phone', 'address', 'city', 'dob', 'ssn'];
      if (S(d.marital) === 'married') need2.push('wife_first', 'wife_last', 'wife_ssn', 'wedding_date');
      const miss = need2.filter(function (k) { return !S(d[k]); });
      if (miss.length) throw new Error('missing:' + miss.join(','));
      const f = kaFiles(a); const rq = kaReq(S(d.marital));
      const missD = rq.gate.concat(rq.rest).filter(function (k) { return !kaHave(f, k); });
      if (missD.length) throw new Error('missing-docs:' + missD.join(','));
      if (!(f.sig_self || []).length && !S(d.sig_self_name)) throw new Error('missing-sig');
      if (st === 'open') { o.status = 'submitted'; o.submitted_at = now(); } else if (st === 'approved') o.status = 'updated';
    } else if (st === 'approved' || st === 'submitted') o.status = 'updated';
    kaSet(M, a, o);
    return { ok: true, app: kaView(a, false) };
  },
  /** העלאה למקום האחד: { ks, data, name } → Gemini מזהה ובודק */
  kaUpload: function (M, req) {
    const a = kaSession(M, req.ks);
    const sig = S(req.kind).indexOf('sig_') === 0 ? S(req.kind) : '';
    const r = kaSaveBlob(M, a, req.data, sig ? 'signature' : req.name);
    const files = kaFiles(a);
    if (sig) {
      (files[sig] || []).forEach(function (x) { try { DriveApp.getFileById(x.id).setTrashed(true); } catch (err) { /* */ } });
      files[sig] = [{ id: r.id, name: 'signature', type: r.type, at: now() }];
    } else {
      if ((files.pool || []).length >= 40) throw new Error('too-many');
      files.pool.push({ id: r.id, name: S(req.name).slice(0, 80) || 'document', type: r.type, at: now(), kinds: [], check: { status: 'pending' } });
      const i = files.pool.length - 1;
      a.files = JSON.stringify(files);
      const chk = kaCheckPending_(M, a, i);
      files.pool[i] = chk.pool[i];
    }
    const o = { files: JSON.stringify(files), folder_id: r.folder, updated_at: now(), updated_by: 'form' };
    if (S(a.status) === 'submitted' || S(a.status) === 'approved') o.status = 'updated';
    kaSet(M, a, o);
    return { ok: true, app: kaView(a, false) };
  },
  /** בדיקה חוזרת (קובץ שממתין / אחרי שינוי סוג ידני): { ks, i, kinds? } */
  kaRecheck: function (M, req) {
    const a = kaSession(M, req.ks);
    const files = kaFiles(a); const i = Number(req.i); const x = (files.pool || [])[i];
    if (!x) throw new Error('not-found');
    x.check = { status: 'pending' };
    if (req.kinds) x.want = [].concat(req.kinds).map(S).filter(function (k) { return KA_KINDS[k]; }); 
    a.files = JSON.stringify(files);
    const chk = kaCheckPending_(M, a, i);
    files.pool[i] = chk.pool[i]; delete files.pool[i].want;
    kaSet(M, a, { files: JSON.stringify(files), updated_at: now(), updated_by: 'form' });
    return { ok: true, app: kaView(a, false) };
  },
  kaDelFile: function (M, req) {
    const a = kaSession(M, req.ks);
    const files = kaFiles(a); const k = S(req.kind); const i = Number(req.i);
    const list = k ? files[k] : files.pool; const x = (list || [])[i]; if (!x) throw new Error('not-found');
    try { DriveApp.getFileById(x.id).setTrashed(true); } catch (err) { /* */ }
    list.splice(i, 1);
    kaSet(M, a, { files: JSON.stringify(files), updated_at: now(), updated_by: 'form' });
    return { ok: true, app: kaView(a, false) };
  },
  kaFilePub: function (M, req) {
    const a = kaSession(M, req.ks);
    const f = kaFiles(a); const x = (S(req.kind) ? f[S(req.kind)] : f.pool || [])[Number(req.i)]; if (!x) throw new Error('not-found');
    return { data: kaBlobUrl(x.id) };
  },
  /** סוף חלק 1: כל ה-ID וה-SS אושרו → נפתחת רשומה + מילוי אוטומטי */
  kaOpen: function (M, req) {
    const a = kaSession(M, req.ks);
    const d = Object.assign(kaJ(a.data, {}), kaClean(req.data || {}));
    a.data = JSON.stringify(d);
    const f = kaFiles(a); const rq = kaReq(S(d.marital));
    const miss = rq.gate.filter(function (k) { return !kaHave(f, k); });
    if (miss.length) throw new Error('missing-docs:' + miss.join(','));
    let notes = '', filled = [];
    try { const r = kaExtract_(M, a); const mg = kaMergeAi_(a, r); a.data = JSON.stringify(mg.data); filled = mg.filled; notes = r.notes; kaSet(M, a, { ai: JSON.stringify(r) }); } catch (err) { /* המילוי לא חובה */ }
    const o = { data: a.data, updated_at: now(), updated_by: 'form' };
    if ((S(a.status) || 'draft') === 'draft') { o.status = 'open'; o.opened_at = now(); }
    kaSet(M, a, o);
    return { ok: true, app: kaView(a, false), filled: filled, notes: notes };
  },
  /** מילוי אוטומטי (בחלק 2, אחרי מסמכים חדשים) — רק שדות ריקים */
  kaAi: function (M, req) {
    const a = kaSession(M, req.ks);
    const c = CacheService.getScriptCache(); const ck = 'kaai:' + M.key + ':' + S(a.app_id);
    const n = Number(c.get(ck) || 0); if (n >= 12) throw new Error('too-many');
    c.put(ck, String(n + 1), 21600);
    const r = kaExtract_(M, a);
    const mg = kaMergeAi_(a, r);
    kaSet(M, a, { ai: JSON.stringify(r), data: JSON.stringify(mg.data) });
    return { ok: true, app: kaView(a, false), filled: mg.filled, notes: r.notes };
  },
};
Object.keys(KA_PUB).forEach(function (k) { PUBLIC[k] = KA_PUB[k]; });

const KA_ACTIONS = {
  kaList: function (M, me) { need(me, 'kollel_reg'); return { apps: kaRows(M).map(function (a) { return kaView(a, true); }), taxYears: kaTaxYears() }; },
  kaFile: function (M, me, req) {
    need(me, 'kollel_reg');
    const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0]; if (!a) throw new Error('not-found');
    const f = kaFiles(a); const x = (S(req.kind) ? f[S(req.kind)] : f.pool || [])[Number(req.i)]; if (!x) throw new Error('not-found');
    return { data: kaBlobUrl(x.id), name: S(x.name) };
  },
  kaEdit: function (M, me, req) {
    need(me, 'kollel_reg');
    const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0]; if (!a) throw new Error('not-found');
    const d0 = kaJ(a.data, {}); const nw = kaClean(req.data);
    const ch = Object.keys(nw).filter(function (k) { return S(d0[k]) !== S(nw[k]); });
    const o = { data: JSON.stringify(Object.assign(d0, nw)), updated_at: now(), updated_by: me.email };
    if ('note' in req) o.note = S(req.note).slice(0, 2000);
    kaSet(M, a, o);
    logIt(M, me, 'kollel-reg-edit', '', '#' + S(a.app_id) + ' ' + ch.join(','));
    return { ok: true, app: kaView(a, true) };
  },
  /** הגבאי משנה סוג של קובץ / מאשר ידנית: { app_id, i, kinds, status } */
  kaFileSet: function (M, me, req) {
    need(me, 'kollel_reg');
    const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0]; if (!a) throw new Error('not-found');
    const f = kaFiles(a); const x = (f.pool || [])[Number(req.i)]; if (!x) throw new Error('not-found');
    if (req.kinds) x.kinds = [].concat(req.kinds).map(S).filter(function (k) { return KA_KINDS[k]; });
    if (req.status) x.check = { status: S(req.status) === 'ok' ? 'ok' : 'bad', en: S(req.status) === 'ok' ? '' : S(x.check && x.check.en), yi: S(req.status) === 'ok' ? '' : S(x.check && x.check.yi), at: now(), by: me.email };
    kaSet(M, a, { files: JSON.stringify(f), updated_at: now(), updated_by: me.email });
    logIt(M, me, 'kollel-reg-file', '', '#' + S(a.app_id) + ' file ' + req.i + ' ' + (x.kinds || []).join(',') + ' ' + S(req.status));
    return { ok: true, app: kaView(a, true) };
  },
  kaStatus: function (M, me, req) {
    need(me, 'kollel_reg');
    if (!KA_STATUS[S(req.status)]) throw new Error('bad-status');
    const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0]; if (!a) throw new Error('not-found');
    const old = S(a.status);
    kaSet(M, a, { status: S(req.status), updated_at: now(), updated_by: me.email });
    logIt(M, me, 'kollel-reg-status', '', '#' + S(a.app_id) + ' ' + old + '→' + S(req.status));
    return { ok: true };
  },
  /** קוד חדש לאברך ששכח (הגבאי אומר לו בטלפון) */
  kaReset: function (M, me, req) {
    need(me, 'kollel_reg');
    const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0]; if (!a) throw new Error('not-found');
    let code = ''; for (let i = 0; i < 6; i++) code += String(Math.floor(Math.random() * 10));
    const salt = Utilities.getUuid();
    kaSet(M, a, { salt: salt, hash: kHash(salt, code), ver: Number(a.ver || 1) + 1, updated_at: now(), updated_by: me.email });
    logIt(M, me, 'kollel-reg-reset', '', '#' + S(a.app_id));
    return { ok: true, code: code };
  },
  /** אישור → איש קשר (אברך) במוסד. dry = חיפוש התאמות */
  kaApprove: function (M, me, req) {
    need(me, 'kollel_reg');
    const a = kaRows(M).filter(function (x) { return S(x.app_id) === S(req.app_id); })[0]; if (!a) throw new Error('not-found');
    const d = kaJ(a.data, {});
    if (req.dry) {
      const seen = {}; const res = [];
      const add = function (l) { (l || []).forEach(function (x) { if (!seen[x.contact_id]) { seen[x.contact_id] = 1; res.push(x); } }); };
      try { add(ACTIONS.find(M, me, { q: S(d.legal_first) + ' ' + S(d.legal_last) }).found); } catch (err) { /* */ }
      const ph = S(d.phone).replace(/\D/g, ''); if (ph.length >= 7) { try { add(ACTIONS.find(M, me, { q: '', phone: ph }).found); } catch (err) { /* */ } }
      return { matches: res.slice(0, 10) };
    }
    need(me, 'people_edit');
    let cid = S(req.contact_id);
    if (S(a.contact_id)) cid = S(a.contact_id);
    if (cid) ACTIONS.link(M, me, { contact_id: cid, kind: 'avreich' });
    else {
      const yi = S(d.yi_name).split(/\s+/);
      const c = { first_name_en: S(d.legal_first), last_name_en: S(d.legal_last), legal_first_name: S(d.legal_first), marital_status: S(d.marital) === 'married' ? 'נשוי' : '',
        first_name_he: yi.length > 1 ? yi.slice(0, -1).join(' ') : S(d.yi_name), last_name_he: yi.length > 1 ? yi[yi.length - 1] : '',
        wife_name_en: [S(d.wife_first), S(d.wife_last)].filter(Boolean).join(' '), address: S(d.address), city: S(d.city), state: S(d.state), zip: S(d.zip) };
      cid = S(ACTIONS.save(M, me, { contact: c, phones: { mobile: S(d.phone), email_1: S(a.email) }, kind: 'avreich' }).contact_id);
    }
    kaSet(M, a, { contact_id: cid, status: 'approved', updated_at: now(), updated_by: me.email });
    logIt(M, me, 'kollel-reg-approve', cid, '#' + S(a.app_id));
    return { ok: true, contact_id: cid };
  },
};
Object.keys(KA_ACTIONS).forEach(function (k) { ACTIONS[k] = KA_ACTIONS[k]; });
PPL_ACTS.kaApprove = 1; NAMES_ACTS.kaApprove = 1;

// =====================================================================================
// 🕍 מרכז הכוללים — כוללים: לכל כולל — האברכים, השתתפות חודשית (V לכל יום), מלגות, צ'קים של תמיכה.
// =====================================================================================
TABS.Kollelim = ['kollel_id', 'name', 'location', 'stip_day', 'stip_month', 'active', 'note', 'updated_at', 'updated_by'];
TABS.KollelMembers = ['kollel_id', 'contact_id', 'start_date', 'end_date', 'note', 'updated_at', 'updated_by'];
TABS.KollelAtt = ['kollel_id', 'month', 'contact_id', 'marks', 'paid', 'note', 'updated_at', 'updated_by'];
TABS.KollelChecks = ['check_id', 'kollel_id', 'date', 'payer', 'amount', 'check_no', 'for_month', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'];
PERMS.push('kollelim');
READS.klGet = 1;
function klTab(M, name) { return ensureTab(M.book, name, TABS[name]); }
const KL_ACTIONS = {
  /** הכל לכולל (או רשימת הכוללים): { kollel_id?, month? } */
  klGet: function (M, me, req) {
    need(me, 'kollelim');
    const ks = objs(klTab(M, 'Kollelim')).filter(function (k) { return S(k.kollel_id); }).map(function (k) { const o = {}; TABS.Kollelim.forEach(function (h) { o[h] = S(k[h]); }); return o; });
    const mem = objs(klTab(M, 'KollelMembers')).filter(function (m) { return S(m.kollel_id); }).map(function (m) { return { kollel_id: S(m.kollel_id), contact_id: S(m.contact_id), start_date: S(m.start_date), end_date: S(m.end_date), note: S(m.note) }; });
    const out2 = { kollelim: ks, members: mem };
    const kid = S(req.kollel_id);
    if (kid) {
      const mon = S(req.month);
      out2.att = objs(klTab(M, 'KollelAtt')).filter(function (r) { return S(r.kollel_id) === kid && (!mon || S(r.month) === mon); })
        .map(function (r) { return { month: S(r.month), contact_id: S(r.contact_id), marks: S(r.marks), paid: S(r.paid), note: S(r.note) }; });
      out2.checks = objs(klTab(M, 'KollelChecks')).filter(function (r) { return S(r.kollel_id) === kid; })
        .map(function (r) { const o = {}; TABS.KollelChecks.forEach(function (h) { o[h] = S(r[h]); }); return o; });
    }
    return out2;
  },
  klSave: function (M, me, req) {
    need(me, 'kollelim');
    const k = req.kollel || {};
    const sh = klTab(M, 'Kollelim');
    const rowsK = objs(sh);
    const o = { name: S(k.name).slice(0, 120), location: S(k.location).slice(0, 120), stip_day: Number(k.stip_day) || 0, stip_month: Number(k.stip_month) || 0,
      active: k.active === false ? 'FALSE' : 'TRUE', note: S(k.note).slice(0, 500), updated_at: now(), updated_by: me.email };
    if (!o.name) throw new Error('need-text');
    const ex = rowsK.filter(function (x) { return S(x.kollel_id) === S(k.kollel_id); })[0];
    if (ex) setCells(sh, ex._row, o);
    else { let mx = 0; rowsK.forEach(function (x) { const v = Number(x.kollel_id); if (v > mx) mx = v; }); o.kollel_id = mx + 1; appendObj(sh, o); }
    logIt(M, me, 'kollel-save', '', o.name);
    return { ok: true };
  },
  klMember: function (M, me, req) {
    need(me, 'kollelim');
    const sh = klTab(M, 'KollelMembers');
    const kid = S(req.kollel_id), cid = S(req.contact_id);
    if (!kid || !cid) throw new Error('need-text');
    const ex = objs(sh).filter(function (x) { return S(x.kollel_id) === kid && S(x.contact_id) === cid && !S(x.end_date); })[0];
    if (req.remove) { if (ex) setCells(sh, ex._row, { end_date: Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd'), updated_at: now(), updated_by: me.email }); }
    else if (!ex) appendObj(sh, { kollel_id: kid, contact_id: cid, start_date: S(req.start_date) || Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd'), note: S(req.note).slice(0, 300), updated_at: now(), updated_by: me.email });
    logIt(M, me, 'kollel-member', cid, kid + (req.remove ? ' remove' : ' add'));
    return { ok: true };
  },
  /** השתתפות לחודש: { kollel_id, month, rows: [{contact_id, marks, paid}] } */
  klAtt: function (M, me, req) {
    need(me, 'kollelim');
    const sh = klTab(M, 'KollelAtt');
    const kid = S(req.kollel_id), mon = S(req.month);
    if (!kid || !/^\d{4}-\d{2}$/.test(mon)) throw new Error('bad-month');
    const all = objs(sh);
    (req.rows || []).forEach(function (r) {
      const cid = S(r.contact_id); if (!cid) return;
      const o = { marks: S(r.marks).slice(0, 2000), updated_at: now(), updated_by: me.email };
      if ('paid' in r) o.paid = S(r.paid).slice(0, 60);
      const ex = all.filter(function (x) { return S(x.kollel_id) === kid && S(x.month) === mon && S(x.contact_id) === cid; })[0];
      if (ex) setCells(sh, ex._row, o); else appendObj(sh, Object.assign({ kollel_id: kid, month: mon, contact_id: cid }, o));
    });
    return { ok: true };
  },
  /** צ'ק של תמיכה: { check, remove } */
  klCheck: function (M, me, req) {
    need(me, 'kollelim');
    const sh = klTab(M, 'KollelChecks');
    const c = req.check || {};
    const all = objs(sh);
    const ex = all.filter(function (x) { return S(x.check_id) && S(x.check_id) === S(c.check_id); })[0];
    if (req.remove) { if (ex) sh.deleteRow(ex._row); logIt(M, me, 'kollel-check-del', '', S(c.check_id)); return { ok: true }; }
    const o = { kollel_id: S(c.kollel_id), date: S(c.date), payer: S(c.payer).slice(0, 120), amount: Number(c.amount) || 0, check_no: S(c.check_no).slice(0, 40),
      for_month: S(c.for_month).slice(0, 20), note: S(c.note).slice(0, 500), updated_at: now(), updated_by: me.email };
    if (ex) setCells(sh, ex._row, o);
    else { let mx = 0; all.forEach(function (x) { const v = Number(x.check_id); if (v > mx) mx = v; }); o.check_id = mx + 1; o.created_at = now(); o.created_by = me.email; appendObj(sh, o); }
    logIt(M, me, 'kollel-check', '', o.kollel_id + ' ' + o.amount);
    return { ok: true };
  },
};
Object.keys(KL_ACTIONS).forEach(function (k) { ACTIONS[k] = KL_ACTIONS[k]; });
