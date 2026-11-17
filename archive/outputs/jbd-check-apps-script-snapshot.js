
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
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { busy: true };
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
  } finally { lock.releaseLock(); }
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
