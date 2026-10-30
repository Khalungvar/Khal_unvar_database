// אתר פון א מוסד — 🛏 פנימייה: א בילד פונעם געביידע (די סקיצע), מיטות אויף איר וואס מ'קען ארומשלעפן, און דירות.
// מבנים: Settings "dorm_bld" = [{ id, name, ar (רוחב/הויך), beds: [{ id, x, y, w, h, room }], labels: [{ id, t, x, y, svc }] }] (x/y/w/h אין %)
// די בילד פון א מבנה: Settings "dormimg:<id>" (נאר דורך "dormImg" — נישט מיט די אלגעמיינע הגדרות)
// א זמן: Settings "dorm:<זמן>" = { b: מבנה, beds: { bedId: contact_id }, apts: [{ id, name, beds, ids: [contact_id|''] }] }
// אן אלטער זמן בלייבט מיט זיין מבנה — אויך ווען מ'מאכט שפעטער א נייעם (א נייער בנין).
import { downloadXlsx } from '../excel.js?v=528';
import { loadSchool, schoolLoaded, activeStudents, zmanim, currentZman } from './school.js?v=528';
import { heDate, letterhead } from './brand.js?v=528';
import { todayIso } from '../hebdate.js?v=528';

let X = null;
export function initDorm(ctx) { X = ctx; }

const D = { zman: '', doc: null, dirty: false, mode: 'view', drag: null, img: {}, bld: null, bdirty: false, sel: null, newImg: {} };
const first = (id) => X.S(X.pById(id)?.first_name_he || X.pById(id)?.first_name_en);
const last = (id) => X.S(X.pById(id)?.last_name_he || X.pById(id)?.last_name_en);
const nameOf = (id) => [first(id), last(id)].filter(Boolean).join(' ');
const byName = (a, b) => last(a).localeCompare(last(b), 'he') || first(a).localeCompare(first(b), 'he');
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const clone = (o) => JSON.parse(JSON.stringify(o));
const r2 = (n) => Math.round(n * 100) / 100;

function parse(v, d) { if (v && typeof v === 'object') return v; try { return JSON.parse(v) ?? d; } catch { return d; } }
const buildings = () => { const v = parse(X.st.settings?.dorm_bld, []); return Array.isArray(v) ? v : []; };
const savedZmanim = () => Object.keys(X.st.settings || {}).filter((k) => k.startsWith('dorm:')).map((k) => k.slice(5));
function loadDoc(z) {
  const d = parse(X.st.settings?.[`dorm:${z}`], {}) || {};
  const beds = d.beds && !Array.isArray(Object.values(d.beds)[0]) ? { ...d.beds } : {}; // אן אלטע פארמע (לויט חדרים) — ווערט נישט גענוצט
  return { b: X.S(d.b), beds, apts: clone(Array.isArray(d.apts) ? d.apts : []) };
}
/** דער מבנה פון דעם זמן (אדער דער לעצטער) */
const bldOf = (doc) => { const bs = D.bld || buildings(); return bs.find((b) => b.id === doc.b) || bs[bs.length - 1] || null; };
async function imgOf(bid) {
  if (!bid) return '';
  if (D.newImg[bid]) return D.newImg[bid];
  if (D.img[bid] === undefined) { try { const r = await X.call(X.KEY, 'dormImg', { bid }); D.img[bid] = r.data || ''; } catch { D.img[bid] = ''; } }
  return D.img[bid];
}
/** וואו איז א בחור: 'bed:<id>' / 'apt:<id>' / '' */
function whereIs(doc, cid) {
  const c = String(cid);
  const bed = Object.keys(doc.beds).find((k) => String(doc.beds[k]) === c);
  if (bed) return `bed:${bed}`;
  const a = doc.apts.find((x) => (x.ids || []).some((y) => String(y) === c));
  return a ? `apt:${a.id}` : '';
}
function takeOut(doc, cid) {
  const c = String(cid);
  Object.keys(doc.beds).forEach((k) => { if (String(doc.beds[k]) === c) delete doc.beds[k]; });
  doc.apts.forEach((a) => { a.ids = (a.ids || []).map((y) => (String(y) === c ? '' : y)); });
}
/** דער נאמען פון דעם חדר / דירה וואו ער איז */
function placeName(doc, b, cid) {
  const w = whereIs(doc, cid);
  if (w.startsWith('bed:')) return X.S(b?.beds.find((x) => x.id === w.slice(4))?.room);
  if (w.startsWith('apt:')) return X.S(doc.apts.find((x) => x.id === w.slice(4))?.name) || 'דירה';
  return '';
}

export async function renderDorm(box) {
  const { h } = X;
  if (!schoolLoaded()) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await loadSchool(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  const can = X.can('dorm');
  if (!can) D.mode = 'view';
  const cz = currentZman();
  const order = zmanim().map((z) => z.label);
  const zs = [...new Set([...savedZmanim(), cz].filter(Boolean))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!D.zman || !zs.includes(D.zman)) { D.zman = zs.includes(cz) ? cz : zs[0] || cz; D.doc = null; }
  if (!D.doc) { D.doc = loadDoc(D.zman); D.dirty = false; }
  if (!D.bld) { D.bld = clone(buildings()); D.bdirty = false; }
  const doc = D.doc;
  const b = bldOf(doc);
  if (b && !doc.b) doc.b = b.id;
  const img = await imgOf(b?.id);
  const studs = activeStudents().map((e) => String(e.contact_id)).filter((id) => X.pById(id));
  const isStud = new Set(studs);
  const placed = new Set([...Object.values(doc.beds), ...doc.apts.flatMap((a) => a.ids || [])].filter(Boolean).map(String));
  const none = studs.filter((id) => !placed.has(id)).sort(byName);
  const bedsN = b?.beds.length || 0;
  const inBeds = (b?.beds || []).filter((x) => doc.beds[x.id]).length;
  const aptBeds = doc.apts.reduce((s, a) => s + (Number(a.beds) || 0), 0);
  const inApts = doc.apts.reduce((s, a) => s + (a.ids || []).filter(Boolean).length, 0);
  const M = D.mode;
  const chip = (id) => `<span class="dm-chip${isStud.has(String(id)) ? '' : ' gone'}"${M === 'edit' ? ` draggable="true"` : ''} data-c="${h(id)}">${h(nameOf(id) || `#${id}`)}</span>`;

  // די מאפע: די בילד + מיטות + כיתובים
  const mapHtml = () => {
    if (!b) return `<p class="ms-note">עדיין אין מבנה.${can ? ' עוברים ל"🏗 בניית המבנה" ומעלים תמונה.' : ''}</p>`;
    const bedEl = (x) => { const c = doc.beds[x.id];
      return `<div class="dm-pb${c ? ' full' : ''}${M === 'build' && D.sel === x.id ? ' sel' : ''}${M === 'edit' ? ' dm-drop' : ''}" data-bed="${h(x.id)}" style="right:${100 - x.x - x.w}%;top:${x.y}%;width:${x.w}%;height:${x.h}%" title="${h(x.room)}">
        ${M === 'build' ? `<span class="dm-pr">${h(x.room || '?')}</span>${D.sel === x.id ? '<i class="dm-rs" data-rs></i>' : ''}` : c ? chip(c) : ''}</div>`; };
    const lblEl = (l) => `<div class="dm-pl${l.svc ? ' svc' : ''}${M === 'build' && D.sel === l.id ? ' sel' : ''}" data-lbl="${h(l.id)}" style="left:${l.x}%;top:${l.y}%">${h(l.t)}</div>`;
    return `<div class="dm-map${M === 'build' ? ' build' : ''}" style="aspect-ratio:${b.ar || 0.5}">${img ? `<img src="${img}" alt="" draggable="false">` : '<div class="dm-noimg">אין תמונה</div>'}
      ${(b.labels || []).map(lblEl).join('')}${b.beds.map(bedEl).join('')}</div>`;
  };
  const aptHtml = (a) => {
    const ids = a.ids || []; const n = Math.max(Number(a.beds) || 0, ids.length);
    return `<div class="dm-apt" data-apt="${h(a.id)}"><div class="dm-rh"><b>${h(a.name || 'דירה')}</b><span class="dm-occ">${ids.filter(Boolean).length}/${Number(a.beds) || 0}</span>
      ${M === 'edit' ? `<span class="spacer"></span><button type="button" class="linkish" data-aedit="${h(a.id)}" title="עריכה">✏️</button>` : ''}</div>
      <div class="dm-abeds">${Array.from({ length: n }, (_, i) => `<div class="dm-ab${M === 'edit' ? ' dm-drop' : ''}${ids[i] ? ' full' : ''}" data-apt="${h(a.id)}" data-i="${i}">${ids[i] ? chip(ids[i]) : M === 'edit' ? '<span class="dm-free">פנוי</span>' : ''}</div>`).join('')}</div></div>`;
  };
  const sel = M === 'build' && b ? (b.beds.find((x) => x.id === D.sel) || (b.labels || []).find((x) => x.id === D.sel)) : null;
  const rooms = [...new Set((b?.beds || []).map((x) => x.room).filter(Boolean))];
  const bs = D.bld;
  const usedBy = (bid) => zs.filter((z) => z !== D.zman && X.S(parse(X.st.settings?.[`dorm:${z}`], {})?.b) === bid);

  box.innerHTML = `<h2 class="ms-h">🛏 פנימייה</h2>
    <div class="ms-bar">
      <label>זמן <select id="dm-z">${zs.map((z) => `<option${z === D.zman ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
      ${can ? '<button type="button" class="btn" id="dm-newz">➕ זמן חדש</button>' : ''}
      <span class="spacer"></span>
      ${can ? `<span class="dm-modes">${[['view', '👁 צפייה'], ['edit', '✏️ שיבוץ בחורים'], ['build', '🏗 בניית המבנה']].map(([k, t]) => `<button type="button" class="btn${M === k ? ' primary' : ''}" data-mode="${k}">${t}</button>`).join('')}</span>` : ''}
    </div>
    <div class="ms-bar">
      <span class="dm-stat">פנימייה: ${inBeds}/${bedsN} · דירות: ${inApts}/${aptBeds} · <b class="${none.length ? 'ms-owe' : ''}">${none.length}</b> לא משובצים${b ? ` · מבנה: ${h(b.name)}` : ''}</span>
      <span class="spacer"></span>
      ${M === 'edit' ? `<button type="button" class="btn primary" id="dm-save"${D.dirty ? '' : ' disabled'}>💾 שמירה</button>` : ''}
      ${M === 'build' ? `<button type="button" class="btn primary" id="dm-bsave"${D.bdirty || D.dirty ? '' : ' disabled'}>💾 שמירת המבנה</button>` : ''}
      <button type="button" class="btn" id="dm-pm">🖨 מפה</button><button type="button" class="btn" id="dm-pn">🖨 לפי שם</button><button type="button" class="btn" id="dm-xl">⬇ Excel</button>
    </div>
    ${M === 'edit' ? '<p class="muted small">גוררים שם למיטה או לדירה (או לוחצים על מיטה ובוחרים). גרירה על מיטה תפוסה — מחליפה ביניהם. גרירה חזרה ל"לא משובצים" — מוציאה. נשמר רק אחרי 💾.</p>' : ''}
    ${M === 'build' ? `<div class="dm-bbar">
        <label>מבנה של ${h(D.zman)} <select id="dm-bsel">${bs.map((x) => `<option value="${h(x.id)}"${x.id === b?.id ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select></label>
        <button type="button" class="btn" id="dm-bnew">➕ מבנה חדש</button>
        ${b ? `<label>שם <input id="dm-bname" value="${h(b.name)}" style="width:12em"></label>
        <label class="btn">🖼 החלפת תמונה<input type="file" id="dm-bimg" accept="image/*" hidden></label>
        <button type="button" class="btn" id="dm-addbed">➕ מיטה</button><button type="button" class="btn" id="dm-addlbl">➕ כיתוב</button>` : ''}
      </div>
      ${b && usedBy(b.id).length ? `<p class="ms-note">שימו לב: המבנה הזה משמש גם את ${h(usedBy(b.id).join(', '))} — שינוי כאן ישנה גם שם. בניין אחר? ➕ מבנה חדש.</p>` : ''}
      <p class="muted small">גוררים מיטה או כיתוב למקום. לוחצים על פריט כדי לערוך אותו (חדר, גודל, סיבוב, מחיקה). הפינה הקטנה במיטה — לשינוי הגודל.</p>
      ${sel ? `<div class="dm-selp">${sel.room !== undefined ? `<b>מיטה</b> <label>חדר <input id="dm-sroom" list="dm-rooms" value="${h(sel.room)}" style="width:9em"></label><datalist id="dm-rooms">${rooms.map((r) => `<option value="${h(r)}">`).join('')}</datalist>
          <button type="button" class="btn" id="dm-rot">↻ סיבוב</button><button type="button" class="btn" id="dm-dup">⧉ עוד מיטה כזאת</button>`
        : `<b>כיתוב</b> <label><input id="dm-stext" value="${h(sel.t)}" style="width:14em"></label><label class="check"><input type="checkbox" id="dm-ssvc"${sel.svc ? ' checked' : ''}> חדר שירות (אפור)</label>`}
          <button type="button" class="btn danger" id="dm-del">🗑 מחיקה</button></div>` : ''}` : ''}
    <div class="dm-lay">
      <div class="dm-mapw">${mapHtml()}</div>
      <div class="dm-sidep">
        ${M !== 'build' ? `<div class="dm-pool${M === 'edit' ? ' dm-drop' : ''}" data-pool="none"><h4>לא משובצים <span class="count-pill">${none.length}</span></h4><div class="dm-list">${none.map(chip).join('') || '<span class="muted small">כולם משובצים 👍</span>'}</div></div>` : ''}
        <div class="dm-apts"><h4>🏠 דירות${M === 'edit' ? ' <button type="button" class="btn" id="dm-addapt">➕ דירה</button>' : ''}</h4>
          ${doc.apts.map(aptHtml).join('') || '<p class="muted small">אין דירות.</p>'}</div>
      </div>
    </div>`;

  const rerender = () => renderDorm(box);
  X.$('#dm-z', box).onchange = (e) => {
    if ((D.dirty || D.bdirty) && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) { e.target.value = D.zman; return; }
    D.zman = e.target.value; D.doc = null; D.bld = null; D.sel = null; rerender();
  };
  X.$$('[data-mode]', box).forEach((bt) => { bt.onclick = () => {
    if (bt.dataset.mode === M) return;
    if ((D.dirty || D.bdirty) && !window.confirm('יש שינויים שלא נשמרו. לעזוב בלי לשמור?')) return;
    if (D.dirty || D.bdirty) { D.doc = null; D.bld = null; D.newImg = {}; }
    D.mode = bt.dataset.mode; D.sel = null; rerender();
  }; });
  X.$('#dm-newz', box)?.addEventListener('click', () => newZman(zs, rerender));
  const onPrint = () => printMap(doc, b, img, none);
  X.$('#dm-pm', box).onclick = onPrint;
  X.$('#dm-pn', box).onclick = () => X.printList(`פנימייה — ${D.zman}`, h(heDate(todayIso())), { cols: [{ t: 'חדר / דירה', c: 'c' }], rows: studs.map((id) => ({ id, cells: [placeName(doc, b, id)] })), twoUp: true });
  X.$('#dm-xl', box).onclick = () => downloadXlsx(`פנימייה ${D.zman}`, ['שם', 'משפחה', 'חדר / דירה'], [...studs].sort(byName).map((id) => [first(id), last(id), placeName(doc, b, id)]), { rtl: true });

  if (M === 'edit') wireEdit(box, doc, b, studs, rerender);
  if (M === 'build') wireBuild(box, doc, b, rerender);
}

// ---------- ✏️ שיבוץ ----------
function wireEdit(box, doc, b, studs, rerender) {
  const changed = () => { D.dirty = true; rerender(); };
  // 'bed:<id>' / 'apt:<id>:<i>' / 'none'
  const put = (cid, target) => {
    const from = whereIs(doc, cid);
    let other = '';
    if (target.startsWith('bed:')) other = doc.beds[target.slice(4)] || '';
    else if (target.startsWith('apt:')) { const [, aid, i] = target.split(':'); other = doc.apts.find((a) => a.id === aid)?.ids?.[Number(i)] || ''; }
    let fromSlot = '';
    if (from.startsWith('apt:')) { const a = doc.apts.find((x) => x.id === from.slice(4)); fromSlot = `apt:${a.id}:${a.ids.findIndex((y) => String(y) === String(cid))}`; } else fromSlot = from;
    takeOut(doc, cid);
    if (other && String(other) !== String(cid)) takeOut(doc, other);
    const set = (slot, id) => {
      if (slot.startsWith('bed:')) doc.beds[slot.slice(4)] = String(id);
      else if (slot.startsWith('apt:')) { const [, aid, i] = slot.split(':'); const a = doc.apts.find((x) => x.id === aid); a.ids = a.ids || []; while (a.ids.length <= Number(i)) a.ids.push(''); a.ids[Number(i)] = String(id); }
    };
    if (target !== 'none') set(target, cid);
    if (other && String(other) !== String(cid) && fromSlot) set(fromSlot, other);
    changed();
  };
  const slotOf = (z) => (z.dataset.pool ? 'none' : z.dataset.bed ? `bed:${z.dataset.bed}` : `apt:${z.dataset.apt}:${z.dataset.i}`);
  X.$$('.dm-chip[draggable]', box).forEach((c) => { c.ondragstart = (ev) => { D.drag = c.dataset.c; ev.dataTransfer.setData('text/plain', c.dataset.c); ev.stopPropagation(); }; });
  X.$$('.dm-drop', box).forEach((z) => {
    z.ondragover = (ev) => { ev.preventDefault(); z.classList.add('hov'); };
    z.ondragleave = () => z.classList.remove('hov');
    z.ondrop = (ev) => { ev.preventDefault(); ev.stopPropagation(); z.classList.remove('hov'); const cid = ev.dataTransfer.getData('text/plain') || D.drag; if (cid) put(cid, slotOf(z)); };
    if (!z.dataset.pool) z.onclick = (ev) => { if (ev.target.closest('button')) return; pick(slotOf(z), doc, b, studs, (cid) => (cid === '' ? (() => { const cur = curOf(doc, slotOf(z)); if (cur) put(cur, 'none'); })() : put(cid, slotOf(z)))); };
  });
  X.$('#dm-save', box).onclick = (ev) => saveDoc(ev.currentTarget, rerender);
  X.$('#dm-addapt', box).onclick = () => aptDialog(doc, null, changed);
  X.$$('[data-aedit]', box).forEach((bt) => { bt.onclick = (ev) => { ev.stopPropagation(); aptDialog(doc, doc.apts.find((a) => a.id === bt.dataset.aedit), changed); }; });
}
function curOf(doc, slot) {
  if (slot.startsWith('bed:')) return doc.beds[slot.slice(4)] || '';
  const [, aid, i] = slot.split(':'); return doc.apts.find((a) => a.id === aid)?.ids?.[Number(i)] || '';
}
function pick(slot, doc, b, studs, done) {
  const { h } = X;
  const cur = curOf(doc, slot);
  const where = (id) => { const p = placeName(doc, b, id); return p ? ` (${p})` : ''; };
  const title = slot.startsWith('bed:') ? `מיטה — ${b?.beds.find((x) => x.id === slot.slice(4))?.room || ''}` : `דירה — ${doc.apts.find((a) => a.id === slot.split(':')[1])?.name || ''}`;
  const d = X.dialog(`<h3>${h(title)}</h3><input class="dm-q" list="dm-dl" placeholder="שם הבחור…" style="width:100%" value="${cur ? h(`${nameOf(cur)} (#${cur})`) : ''}">
    <datalist id="dm-dl">${[...studs].sort(byName).map((id) => `<option value="${h(`${nameOf(id)} (#${id})`)}">${h(where(id))}</option>`).join('')}</datalist>
    <div class="actions">${cur ? '<button type="button" class="btn ghost" data-empty>⬜ לפנות</button>' : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>אישור</button></div>`);
  const q = X.$('.dm-q', d); q.focus(); q.select();
  X.$('[data-ok]', d).onclick = () => { const m = X.S(q.value).match(/\(#(\d+)\)$/); if (!m) { X.toast('בחר שם מהרשימה.', 'err'); return; } d.close(); done(m[1]); };
  X.$('[data-empty]', d)?.addEventListener('click', () => { d.close(); done(''); });
}
function aptDialog(doc, a, changed) {
  const { h } = X;
  const d = X.dialog(`<h3>${a ? '✏️ דירה' : '➕ דירה'}</h3>
    <label>שם / כתובת <input class="dm-an" value="${h(a?.name || '')}" placeholder="דירה ישיבה / רח' …" style="width:100%"></label>
    <label>מספר מיטות <input class="dm-ab2" type="number" min="1" max="30" value="${h(a?.beds || 4)}" style="width:6em"></label>
    <div class="actions">${a ? '<button type="button" class="btn danger" data-del>🗑 מחיקת הדירה</button>' : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>אישור</button></div>`);
  X.$('[data-ok]', d).onclick = () => {
    const name = X.S(X.$('.dm-an', d).value); const beds = Math.max(1, Math.min(30, Number(X.$('.dm-ab2', d).value) || 1));
    if (!name) { X.toast('חסר שם.', 'err'); return; }
    if (a) { a.name = name; a.beds = beds; } else doc.apts.push({ id: uid('a'), name, beds, ids: [] });
    d.close(); changed();
  };
  X.$('[data-del]', d)?.addEventListener('click', () => {
    if ((a.ids || []).some(Boolean) && !window.confirm('יש בחורים בדירה. הם יחזרו ל"לא משובצים". למחוק?')) return;
    doc.apts = doc.apts.filter((x) => x !== a); d.close(); changed();
  });
}

async function saveDoc(btn, rerender, quiet = false) {
  if (btn) btn.disabled = true;
  const doc = { b: D.doc.b, beds: Object.fromEntries(Object.entries(D.doc.beds).filter(([, v]) => v)), apts: D.doc.apts.map((a) => ({ id: a.id, name: a.name, beds: Number(a.beds) || 0, ids: (a.ids || []).map((x) => (x ? String(x) : '')) })) };
  try {
    const r = await X.call(X.KEY, 'dormSave', { zman: D.zman, doc });
    X.st.settings = r.settings;
    // דער היינטיגער זמן: אויך דאס פעלד "חדר" ביי די רישומים (דאס ווייזט זיך ביי "תלמידי הישיבה")
    if (D.zman === currentZman()) {
      const b = bldOf(D.doc);
      const rows = activeStudents().map((e) => { const rn = placeName(D.doc, b, e.contact_id); return X.S(e.room) === rn ? null : { enroll_id: e.enroll_id, room: rn, e }; }).filter(Boolean);
      if (rows.length) { await X.call(X.KEY, 'roomSet', { rows: rows.map(({ enroll_id, room }) => ({ enroll_id, room })) }); rows.forEach((x) => { x.e.room = x.room; }); }
    }
    D.dirty = false; D.doc = null; if (!quiet) X.toast('נשמר.'); rerender();
  } catch (err) { if (btn) btn.disabled = false; X.toast(X.msg(err), 'err'); throw err; }
}

function newZman(have, rerender) {
  const { h } = X;
  const opts = zmanim().map((z) => z.label).filter((z) => !have.includes(z));
  const d = X.dialog(`<h3>➕ זמן חדש</h3><label>זמן <select class="dm-nz">${opts.map((z) => `<option>${h(z)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" class="dm-copy" checked> להעתיק את השיבוץ של ${h(D.zman)} (אחר כך משנים מה שצריך)</label>
    <p class="muted small">הזמן החדש מקבל את המבנה הנוכחי. בניין אחר? אחרי הפתיחה: 🏗 בניית המבנה ← ➕ מבנה חדש.</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>פתיחה</button></div>`);
  X.$('[data-ok]', d).onclick = () => {
    const z = X.$('.dm-nz', d).value; if (!z) return;
    const cur = D.doc || { b: '', beds: {}, apts: [] };
    const copy = X.$('.dm-copy', d).checked ? clone(cur) : { b: cur.b, beds: {}, apts: cur.apts.map((a) => ({ ...a, ids: [] })) };
    d.close(); D.zman = z; D.doc = copy; D.dirty = true; D.mode = 'edit';
    X.st.settings = { ...X.st.settings, [`dorm:${z}`]: JSON.stringify(copy) };
    rerender();
  };
}

// ---------- 🏗 בניית המבנה ----------
function wireBuild(box, doc, b, rerender) {
  const bchanged = () => { D.bdirty = true; rerender(); };
  X.$('#dm-bsel', box)?.addEventListener('change', (e) => { doc.b = e.target.value; D.dirty = true; D.sel = null; rerender(); });
  X.$('#dm-bnew', box).onclick = () => newBuilding(doc, b, rerender);
  X.$('#dm-bsave', box).onclick = (ev) => saveBuild(ev.currentTarget, rerender);
  if (!b) return;
  X.$('#dm-bname', box).onchange = (e) => { b.name = X.S(e.target.value) || b.name; bchanged(); };
  X.$('#dm-bimg', box).onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const r = await toImg(f); D.newImg[b.id] = r.data; b.ar = r.ar; bchanged(); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$('#dm-addbed', box).onclick = () => { const id = uid('b'); b.beds.push({ id, x: 45, y: 45, w: 17, h: 3, room: '' }); D.sel = id; bchanged(); };
  X.$('#dm-addlbl', box).onclick = () => { const id = uid('l'); (b.labels ||= []).push({ id, t: 'חדר', x: 50, y: 50, svc: false }); D.sel = id; bchanged(); };
  const bed = b.beds.find((x) => x.id === D.sel); const lbl = (b.labels || []).find((x) => x.id === D.sel);
  X.$('#dm-sroom', box)?.addEventListener('change', (e) => { bed.room = X.S(e.target.value); bchanged(); });
  X.$('#dm-rot', box)?.addEventListener('click', () => { const ar = b.ar || 0.5; const w = bed.w; bed.w = r2(bed.h / ar); bed.h = r2(w * ar); bchanged(); });
  X.$('#dm-dup', box)?.addEventListener('click', () => { const id = uid('b'); b.beds.push({ ...bed, id, y: Math.min(100 - bed.h, bed.y + bed.h + 0.5) }); D.sel = id; bchanged(); });
  X.$('#dm-stext', box)?.addEventListener('change', (e) => { lbl.t = X.S(e.target.value) || lbl.t; bchanged(); });
  X.$('#dm-ssvc', box)?.addEventListener('change', (e) => { lbl.svc = e.target.checked; bchanged(); });
  X.$('#dm-del', box)?.addEventListener('click', () => {
    if (bed) { b.beds = b.beds.filter((x) => x !== bed); delete doc.beds[bed.id]; D.dirty = true; } else b.labels = b.labels.filter((x) => x !== lbl);
    D.sel = null; bchanged();
  });
  // גרירה / גרייס (pointer)
  const map = X.$('.dm-map', box);
  X.$$('[data-bed],[data-lbl]', map).forEach((el) => {
    el.onpointerdown = (ev) => {
      ev.preventDefault();
      const id = el.dataset.bed || el.dataset.lbl;
      const it = el.dataset.bed ? b.beds.find((x) => x.id === id) : b.labels.find((x) => x.id === id);
      const rs = !!ev.target.closest('[data-rs]');
      const R = map.getBoundingClientRect();
      const sx = ev.clientX, sy = ev.clientY; const o = { ...it }; let moved = false;
      el.setPointerCapture(ev.pointerId);
      el.onpointermove = (e) => {
        const dx = (e.clientX - sx) / R.width * 100, dy = (e.clientY - sy) / R.height * 100;
        if (Math.abs(dx) + Math.abs(dy) > 0.3) moved = true;
        if (rs) { // די ווינקל (לינקס־אונטן): ברייטער/הויכער
          it.w = r2(Math.max(2, o.w - dx)); it.x = r2(Math.min(o.x + o.w - 2, o.x + dx)); it.h = r2(Math.max(1, o.h + dy));
          el.style.width = `${it.w}%`; el.style.height = `${it.h}%`; el.style.right = `${100 - it.x - it.w}%`;
        } else {
          it.x = r2(Math.max(0, Math.min(100 - (it.w || 0), o.x + dx))); it.y = r2(Math.max(0, Math.min(100 - (it.h || 0), o.y + dy)));
          if (el.dataset.bed) { el.style.right = `${100 - it.x - it.w}%`; el.style.top = `${it.y}%`; } else { el.style.left = `${it.x}%`; el.style.top = `${it.y}%`; }
        }
      };
      el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; if (moved) D.bdirty = true; D.sel = id; rerender(); };
    };
  });
}
function newBuilding(doc, b, rerender) {
  const { h } = X;
  const d = X.dialog(`<h3>➕ מבנה חדש</h3><p class="muted small">למשל כשהישיבה עוברת בניין. הזמנים הקודמים נשארים עם המבנה הישן שלהם.</p>
    <label>שם <input class="dm-bn" placeholder="בניין … (תשפ&quot;ח)" style="width:100%"></label>
    ${b ? `<label class="check"><input type="checkbox" class="dm-bc"> להתחיל מהעתק של "${h(b.name)}" (אותה תמונה ומיטות)</label>` : ''}
    <label>תמונה (סקיצה בלי המיטות) <input type="file" class="dm-bf" accept="image/*"></label>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>יצירה</button></div>`);
  X.$('[data-ok]', d).onclick = async () => {
    const name = X.S(X.$('.dm-bn', d).value); if (!name) { X.toast('חסר שם.', 'err'); return; }
    const cp = X.$('.dm-bc', d)?.checked; const f = X.$('.dm-bf', d).files?.[0];
    if (!cp && !f) { X.toast('צריך תמונה (או העתק).', 'err'); return; }
    const nb = cp ? { ...clone(b), id: uid('B'), name } : { id: uid('B'), name, ar: 0.5, beds: [], labels: [] };
    if (cp) { nb.beds = nb.beds.map((x) => ({ ...x, id: uid('b') })); D.newImg[nb.id] = await imgOf(b.id); }
    if (f) { try { const r = await toImg(f); D.newImg[nb.id] = r.data; nb.ar = r.ar; } catch (err) { X.toast(X.msg(err), 'err'); return; } }
    D.bld.push(nb); doc.b = nb.id; doc.beds = {}; D.dirty = true; D.bdirty = true; D.sel = null;
    d.close(); rerender();
  };
}
/** א בילד → webp, קליין גענוג פאר איין צעל (≤ 44,000 אותיות) */
async function toImg(file) {
  const url = URL.createObjectURL(file);
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('לא הצלחתי לקרוא את התמונה.')); i.src = url; });
  URL.revokeObjectURL(url);
  for (const max of [1400, 1150, 950, 800, 650]) {
    const s = Math.min(1, max / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.65, 0.5]) { const data = c.toDataURL('image/webp', q); if (data.length <= 44000) return { data, ar: r2(im.width / im.height * 1000) / 1000 }; }
  }
  throw new Error('התמונה גדולה מדי — נסה תמונה פשוטה יותר (שחור-לבן).');
}
async function saveBuild(btn, rerender) {
  btn.disabled = true;
  try {
    for (const [bid, data] of Object.entries(D.newImg)) { await X.call(X.KEY, 'dormImgSave', { bid, data }); D.img[bid] = data; }
    D.newImg = {};
    if (D.bdirty) { const r = await X.call(X.KEY, 'dormBld', { buildings: D.bld }); X.st.settings = r.settings; }
    D.bdirty = false; D.bld = null;
    if (D.dirty) await saveDoc(null, () => {}, true);
    X.toast('נשמר.'); rerender();
  } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
}

// ---------- 🖨 PDF / A4: בלאט 1 — די מאפע, בלאט 2 — די דירות (מיטן בלאנק אויף יעדן בלאט) ----------
function printMap(doc, b, img, none) {
  const { h } = X;
  const w = window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  const lh = letterhead(X.KEY); const logo = X.st.logo || X.st.mosad?.logo || '';
  const title = `פנימייה — ${D.zman}`; const sub = heDate(todayIso());
  const bedP = (x) => { const c = doc.beds[x.id]; return `<div class="pb" style="right:${100 - x.x - x.w}%;top:${x.y}%;width:${x.w}%;height:${x.h}%"><span>${c ? h(nameOf(c)) : ''}</span></div>`; };
  const lblP = (l) => `<div class="pl${l.svc ? ' svc' : ''}" style="left:${l.x}%;top:${l.y}%">${h(l.t)}</div>`;
  const sheet = (t, inner) => `<section class="sh"><div class="top">${lh ? `<img src="${lh.top}" alt="">` : logo ? `<img src="${logo}" alt="" style="height:22mm">` : ''}</div>
    <div class="ttl"><h1>${h(t)}</h1><div class="sub">${h(sub)}</div></div><div class="mid">${inner}</div><div class="bot">${lh ? `<img src="${lh.bottom}" alt="">` : ''}</div></section>`;
  const map = `<div class="pm">${img ? `<img src="${img}" alt="">` : ''}${(b?.labels || []).map(lblP).join('')}${(b?.beds || []).map(bedP).join('')}</div>`;
  const apt = (a) => `<div class="pa"><b>${h(a.name)} <small>(${(a.ids || []).filter(Boolean).length}/${a.beds})</small></b>${Array.from({ length: Math.max(Number(a.beds) || 0, (a.ids || []).length) }, (_, i) => `<div>${a.ids?.[i] ? h(nameOf(a.ids[i])) : '&nbsp;'}</div>`).join('')}</div>`;
  const page2 = `${doc.apts.length ? `<h3>🏠 דירות</h3><div class="pas">${doc.apts.map(apt).join('')}</div>` : ''}
    ${none.length ? `<h3>לא משובצים (${none.length})</h3><div class="pn">${none.map((id) => `<div>${h(nameOf(id))}</div>`).join('')}</div>` : ''}`;
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${h(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    body { font-family: 'Heebo', Arial, sans-serif; margin: 0; color: #1d1a14; background: #eee; }
    .bar { padding: 8px; background: #f6f1e4; border-bottom: 1px solid #e2d6b8; display: flex; gap: 10px; justify-content: center; font-size: 14px; }
    .bar button { font: inherit; padding: 5px 14px; border-radius: 8px; border: 1px solid #b89a5a; background: #fff; cursor: pointer; }
    .bar button.pr { background: #7a2020; color: #fff; border-color: #7a2020; }
    .sh { width: 194mm; height: 280mm; margin: 6mm auto; background: #fff; display: flex; flex-direction: column; overflow: hidden; break-after: page; }
    .sh:last-child { break-after: auto; }
    .top { text-align: center; } .top img { max-width: 100%; max-height: 31mm; }
    .ttl { text-align: center; margin: 1mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 2px solid #b8913c; }
    .ttl h1 { font-family: 'Frank Ruhl Libre', serif; font-size: 22px; margin: 0; font-weight: 900; color: #2a2560; }
    .ttl .sub { font-size: 12px; color: #6b6150; }
    .mid { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: stretch; }
    .bot img { width: 100%; display: block; }
    .pm { position: relative; height: 100%; aspect-ratio: ${b?.ar || 0.5}; margin: 0 auto; }
    .pm img { position: absolute; inset: 0; width: 100%; height: 100%; }
    .pb { position: absolute; border: 1px solid #8a7444; border-radius: 3px; background: #fff; display: flex; align-items: center; justify-content: center; text-align: center; overflow: hidden; }
    .pb span { font-size: 8pt; line-height: 1.05; padding: 0 1px; font-weight: 500; }
    .pl { position: absolute; transform: translate(-50%, -50%); font-size: 8pt; font-weight: 700; color: #2a2560; text-align: center; white-space: nowrap; }
    .pl.svc { color: #555; font-weight: 500; white-space: normal; max-width: 30mm; }
    h3 { font-family: 'Frank Ruhl Libre', serif; font-size: 14pt; margin: 2mm 0 2mm; border-bottom: 1.5px solid #b8913c; }
    .pas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; align-items: start; font-size: 10pt; }
    .pa { border: 1px solid #c9bfa8; border-radius: 4px; }
    .pa b { display: block; background: #f1ead8; padding: 1px 5px; }
    .pa div { padding: 1px 5px; border-top: 1px solid #eee; min-height: 5mm; }
    .pn { columns: 3; font-size: 10pt; } .pn div { padding: 0.5mm 0; break-inside: avoid; }
    @media print { body { background: #fff; } .bar { display: none; } .sh { margin: 0; } }
    </style></head><body>
    <div class="bar"><button class="pr" onclick="window.print()">🖨 הדפסה / PDF</button><button onclick="window.close()">סגירה</button></div>
    ${sheet(title, map)}${page2.trim() ? sheet(`${title} — דירות`, page2) : ''}</body></html>`);
  w.document.close();
}
