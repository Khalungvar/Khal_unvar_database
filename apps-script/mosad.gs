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
const PERMS = ['people_edit', 'tuition', 'chavrusas', 'journals', 'insurance'];
// וואס דער מוסד מעג זען / טוישן אין א קאנטאקט
const C_FIELDS = ['title_he', 'first_name_he', 'last_name_he', 'title_en', 'first_name_en', 'last_name_en', 'legal_first_name',
  'marital_status', 'wife_name_he', 'wife_name_en', 'address', 'city', 'state', 'zip', 'country', 'is_alive'];
const P_FIELDS = ['mobile', 'home_phone', 'email_1'];
const TABS = {
  Staff: ['email', 'name', 'role', 'perms', 'active', 'added_by', 'added_at', 'updated_by', 'updated_at'],
  People: ['contact_id', 'kind', 'status', 'added_by', 'added_at', 'removed_by', 'removed_at', 'note'],
  Log: ['at', 'by', 'action', 'contact_id', 'detail'],
};

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
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
    r.head.forEach(function (h, j) { if (h) o[h] = row[j]; });
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
  return { key: k, name: S(m.name), org: S(m.org), book: book, owners: owners };
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
  const en = objs(main().getSheetByName('Enrollments')).filter(function (e) { return S(e.org) === org; });
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
  const en = objs(ss.getSheetByName('Enrollments')).filter(function (e) { return S(e.org) === M.org && ids[S(e.contact_id)]; })
    .map(function (e) { return { contact_id: S(e.contact_id), status: S(e.status), start: S(e.start_date).slice(0, 10), end: S(e.end_date).slice(0, 10), shiur: S(e.shiur), room: S(e.room) }; });
  return {
    people: contacts.map(function (c) { const v = contactView(c, phones[S(c.contact_id)]); v.kind = S(ids[S(c.contact_id)].kind); return v; }),
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
    return { me: { email: me.email, name: me.name, role: me.role, perms: me.perms }, mosad: { key: M.key, name: M.name, org: M.org }, permsAll: PERMS };
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

/** א פראבע פונעם עדיטאר: הפעלה ← testMosad (באשטעטיגט דעם צוטריט און מאכט דעם גיליון פון דער ישיבה) */
function testMosad() {
  const M = mosadOf('yeshiva');
  Logger.log(M ? ('OK: ' + M.name + ' · ' + M.book.getUrl() + ' · owners: ' + M.owners.join(', ') + ' · people: ' + (M.book.getSheetByName('People').getLastRow() - 1)) : 'no row "yeshiva" in Mosdos');
}
