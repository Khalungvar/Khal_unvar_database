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
const PERMS = ['students', 'alumni', 'staff_list', 'tuition', 'insurance', 'parents', 'chavrusas', 'attendance', 'donations', 'people_edit'];
// וואס דער מוסד מעג זען / טוישן אין א קאנטאקט
const C_FIELDS = ['title_he', 'first_name_he', 'last_name_he', 'title_en', 'first_name_en', 'last_name_en', 'legal_first_name',
  'marital_status', 'wife_name_he', 'wife_name_en', 'address', 'city', 'state', 'zip', 'country', 'is_alive'];
const P_FIELDS = ['mobile', 'home_phone', 'email_1'];
const TABS = {
  Staff: ['email', 'name', 'role', 'perms', 'active', 'added_by', 'added_at', 'updated_by', 'updated_at'],
  People: ['contact_id', 'kind', 'status', 'added_by', 'added_at', 'removed_by', 'removed_at', 'note', 'il_phone'],
  Log: ['at', 'by', 'action', 'contact_id', 'detail'],
  Enrollments: ['enroll_id', 'contact_id', 'parent_id', 'status', 'start_date', 'end_date', 'zman', 'shiur', 'room', 'tuition_amount', 'tuition_period', 'month_amounts', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Tuition: ['payment_id', 'enroll_id', 'contact_id', 'payer_id', 'date', 'amount', 'method', 'check_number', 'card_last4', 'for_text', 'receipt_no', 'note', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Gifts: ['gift_id', 'donor_name', 'date', 'currency', 'amount_orig', 'fx_rate', 'amount_usd', 'payment_method', 'check_number', 'card_last4', 'dedication_type', 'dedication_text', 'note', 'il_receipt_no', 'created_at', 'created_by', 'updated_at', 'updated_by'],
  Receipts: ['receipt_no', 'payment_id', 'contact_id', 'payer_id', 'amount', 'issued_at', 'issued_by', 'void', 'void_by', 'void_at', 'note'],
};
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

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'brand') return out(brandOf(req.mosad)); // פארן לאגאין: נאר נאמען + לאגא
    const email = whoIs(req.token);
    if (!email) return out({ error: 'not-signed-in' });
    const M = mosadOf(req.mosad);
    if (!M) return out({ error: 'no-mosad' });
    const me = roleOf(M, email);
    if (!me) return out({ error: 'not-allowed', email: email });
    const fn = ACTIONS[req.action];
    if (!fn) return out({ error: 'bad-action' });
    return out(fn(M, me, req));
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
function main() { return SpreadsheetApp.openById(MAIN_ID); }
function rows(sheet) {
  if (!sheet) return { head: [], body: [] };
  const v = sheet.getDataRange().getValues();
  const head = (v[0] || []).map(function (x) { return String(x).trim(); });
  return { head: head, body: v.slice(1) };
}
function objs(sheet) {
  const r = rows(sheet);
  return r.body.map(function (row, i) {
    const o = { _row: i + 2 };
    r.head.forEach(function (h, j) { if (h) o[h] = cell(row[j]); });
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
function appendObj(sheet, o) {
  const head = rows(sheet).head;
  sheet.appendRow(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
}
function setCells(sheet, rowNo, o) {
  const head = rows(sheet).head;
  Object.keys(o).forEach(function (k) {
    const j = head.indexOf(k);
    if (j >= 0) sheet.getRange(rowNo, j + 1).setValue(o[k]);
  });
}
function now() { return Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HH:mm'); }
const S = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };

// ---------- דער מוסד ----------
function mosadOf(key) {
  const k = S(key);
  if (!k) return null;
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
  const perms = role === 'admin' ? PERMS.slice() : S(st.perms).split(',').map(S).filter(function (p) { return PERMS.indexOf(p) >= 0; });
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
  const contacts = objs(ss.getSheetByName('Contacts')).filter(function (c) { return ids[S(c.contact_id)] && !S(c.deleted_at); });
  const phones = {};
  objs(ss.getSheetByName('Phones')).forEach(function (p) { if (ids[S(p.contact_id)]) phones[S(p.contact_id)] = p; });
  // קשרים — נאר צווישן די מענטשן פונעם מוסד
  const rel = objs(ss.getSheetByName('Relations')).filter(function (r) { return ids[S(r.contact_id_a)] && ids[S(r.contact_id_b)]; })
    .map(function (r) { return { a: S(r.contact_id_a), type: S(r.relation_type), b: S(r.contact_id_b) }; });
  const en = objs(M.book.getSheetByName('Enrollments')).filter(function (e) { return ids[S(e.contact_id)]; })
    .map(function (e) { return { contact_id: S(e.contact_id), status: S(e.status), start: S(e.start_date).slice(0, 10), end: S(e.end_date).slice(0, 10), shiur: S(e.shiur), room: S(e.room) }; });
  return {
    people: contacts.map(function (c) { const v = contactView(c, phones[S(c.contact_id)]); v.kind = S(ids[S(c.contact_id)].kind); v.il_phone = S(ids[S(c.contact_id)].il_phone); return v; }),
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

const ACTIONS = {
  me: function (M, me) {
    return { me: { email: me.email, name: me.name, role: me.role, perms: me.perms }, mosad: { key: M.key, name: M.name, org: M.org, logo: brandOf(M.key).logo }, permsAll: PERMS };
  },

  people: function (M) { return linkedData(M); },

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
      return words.every(function (w) { return hay.indexOf(w) >= 0; });
    }).slice(0, 15).map(function (c) {
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
      if (ex) setCells(sh, ex._row, { status: 'active', kind: S(req.kind) || ex.kind, removed_by: '', removed_at: '' });
      else appendObj(sh, { contact_id: Number(id) || id, kind: S(req.kind) || 'student', status: 'active', added_by: me.email, added_at: now() });
      logIt(M, me, 'link', id, S(req.kind));
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
      const c = objs(main().getSheetByName('Contacts')).filter(function (x) { return S(x.contact_id) === id; })[0];
      const name = c ? [c.first_name_he, c.last_name_he].map(S).filter(Boolean).join(' ') : '#' + id;
      const rq = main().getSheetByName('Requests');
      if (rq) {
        let rid = 0; objs(rq).forEach(function (r) { const n = Number(r.request_id); if (isFinite(n) && n > rid) rid = n; });
        appendObj(rq, { request_id: rid + 1, type: 'delete_contact', payload: JSON.stringify({ contact_id: id, mosad: M.key }),
          summary: '🎓 ' + (M.name || M.key) + ': ' + name + ' (#' + id + ')' + (S(req.why) ? ' — ' + S(req.why) : ''),
          status: 'pending', requested_by: me.email + ' @' + M.key, requested_at: now() });
      }
      histRows(me, M, id, [['contact', '*', '', 'removed from ' + M.key + ' (delete requested)']]);
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
    setCells(sh, p._row, { il_phone: S(req.il_phone) });
    logIt(M, me, 'il-phone', S(req.contact_id), S(req.il_phone));
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
    const rc = {};
    objs(ss.getSheetByName('Receipts')).forEach(function (r) {
      if (isVoid(r) || S(r.kind) !== 'receipt') return;
      S(r.donation_ids).split(',').map(S).forEach(function (x) { if (x) rc[x] = S(r.receipt_no); });
    });
    const F = ['date', 'currency', 'amount_orig', 'fx_rate', 'amount_usd', 'payment_method', 'check_number', 'card_last4', 'dedication_type', 'dedication_text', 'il_receipt_no'];
    const list = [];
    const cids = {};
    objs(ss.getSheetByName('Donations')).forEach(function (d) {
      if (S(d.org) !== M.org || !S(d.donation_id)) return;
      const o = { src: 'm', id: S(d.donation_id), contact_id: S(d.contact_id), donor_name: S(d.donor_name), note: S(d.event_note), is_paid: S(d.is_paid), receipt_no: rc[S(d.donation_id)] || '', by: S(d.created_by) };
      F.forEach(function (k) { o[k] = S(d[k]); });
      if (o.contact_id) cids[o.contact_id] = true;
      list.push(o);
    });
    objs(M.book.getSheetByName('Gifts')).forEach(function (g) {
      if (!S(g.gift_id)) return;
      const o = { src: 'l', id: S(g.gift_id), contact_id: '', donor_name: S(g.donor_name), note: S(g.note), is_paid: 'TRUE', receipt_no: '', by: S(g.created_by) };
      F.forEach(function (k) { o[k] = S(g[k]); });
      list.push(o);
    });
    const names = {};
    objs(ss.getSheetByName('Contacts')).forEach(function (c) {
      if (!cids[S(c.contact_id)]) return;
      names[S(c.contact_id)] = { he: [S(c.title_he), S(c.first_name_he), S(c.last_name_he)].filter(Boolean).join(' '), en: [S(c.first_name_en), S(c.last_name_en)].filter(Boolean).join(' '), city: S(c.city) };
    });
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
        else if (S(pr.status) === 'removed') setCells(ps, pr._row, { status: 'active' });
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
          if (old) gs.deleteRow(old._row); // פון "אן איש קשר" → צו אן איש קשר
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
        if (g) { gs.deleteRow(g._row); logIt(M, me, 'gift-delete', '', 'l' + S(req.id) + ' $' + S(g.amount_usd)); }
        return { ok: true };
      }
      const ss = main();
      const ds = ss.getSheetByName('Donations');
      const d = objs(ds).filter(function (x) { return S(x.donation_id) === S(req.id); })[0];
      if (!d) return { ok: true };
      // נאר וואס מ'האט צוגעלייגט פונעם אתר פונעם מוסד, און אן א קבלה
      if (S(d.org) !== M.org || S(d.created_by).slice(-(M.key.length + 2)) !== ' @' + M.key) throw new Error('not-yours');
      if (onReceipt(ss, S(req.id))) throw new Error('has-receipt');
      ds.deleteRow(d._row);
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

  // ---------- ישיבה: רישום, שכר לימוד, קבלות ----------
  school: function (M, me) {
    if (!isAdminRole(me) && !['students', 'alumni', 'parents', 'tuition'].some(function (p) { return me.perms.indexOf(p) >= 0; })) throw new Error('no-permission');
    const tu = isAdminRole(me) || me.perms.indexOf('tuition') >= 0;
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
      sh.deleteRow(ex._row);
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
      sh.deleteRow(ex._row);
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
    return { staff: list, owners: M.owners, permsAll: PERMS };
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
      sh.deleteRow(ex._row);
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
