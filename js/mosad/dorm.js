// אתר פון א מוסד — 🛏 פנימייה: א מאפע פונעם געביידע (אגפים → חדרים → מיטות), און פאר יעדן זמן — ווער שלאפט אין וועלכער מיטה.
// דער פלאן: Settings "rooms" = [{ id, name, desc, beds, wing, kind: 'room'|'service' }] (די סדר = די סדר אויף דער מאפע).
// דער שיבוץ פון א זמן: Settings "dorm:<זמן>" = { beds: { roomId: [contact_id|''] }, out: [contact_id] } (out = וואוינט אין א דירה פרטית).
import { downloadXlsx } from '../excel.js?v=496';
import { loadSchool, schoolLoaded, activeStudents, zmanim, currentZman } from './school.js?v=496';
import { heDate } from './brand.js?v=496';
import { todayIso } from '../hebdate.js?v=496';

let X = null;
export function initDorm(ctx) { X = ctx; }

const D = { zman: '', doc: null, dirty: false, drag: null };
const first = (id) => X.S(X.pById(id)?.first_name_he || X.pById(id)?.first_name_en);
const last = (id) => X.S(X.pById(id)?.last_name_he || X.pById(id)?.last_name_en);
const nameOf = (id) => [first(id), last(id)].filter(Boolean).join(' ');
const byName = (a, b) => last(a).localeCompare(last(b), 'he') || first(a).localeCompare(first(b), 'he');
const WINGS = [['A', 'אגף א'], ['B', 'אגף ב'], ['C', 'דירות / אחר']];
export const plan = () => (Array.isArray(X.st.settings?.rooms) ? X.st.settings.rooms : []).filter((r) => X.S(r.name) || X.S(r.desc)).map((r, i) => ({
  id: X.S(r.id) || `r${i}`, name: X.S(r.name), desc: X.S(r.desc || r.note), beds: Math.max(0, Number(r.beds) || 0), wing: ['A', 'B', 'C'].includes(r.wing) ? r.wing : 'A', kind: r.kind === 'service' ? 'service' : 'room' }));
const roomLabel = (r) => (r.name ? `חדר ${r.name}` : '') + (r.desc ? `${r.name ? ' · ' : ''}${r.desc}` : '');
/** די זמנים וואס האבן א שיבוץ */
const savedZmanim = () => Object.keys(X.st.settings || {}).filter((k) => k.startsWith('dorm:')).map((k) => k.slice(5));
function loadDoc(z) {
  const raw = X.st.settings?.[`dorm:${z}`];
  let d = null; try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { d = null; }
  return { beds: { ...(d?.beds || {}) }, out: [...(d?.out || [])] };
}
/** וואו איז א בחור יעצט (אינעם doc): { room, i } אדער 'out' אדער null */
function whereIs(doc, cid) {
  for (const [rid, arr] of Object.entries(doc.beds)) { const i = (arr || []).findIndex((x) => String(x) === String(cid)); if (i >= 0) return { rid, i }; }
  return doc.out.some((x) => String(x) === String(cid)) ? 'out' : null;
}
function takeOut(doc, cid) {
  Object.values(doc.beds).forEach((arr) => { (arr || []).forEach((x, i) => { if (String(x) === String(cid)) arr[i] = ''; }); });
  doc.out = doc.out.filter((x) => String(x) !== String(cid));
}

export async function renderDorm(box) {
  const { h } = X;
  if (!schoolLoaded()) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await loadSchool(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  const edit = X.can('dorm');
  const cz = currentZman();
  const zs = [...new Set([...savedZmanim(), cz].filter(Boolean))].sort((a, b) => { const o = zmanim(); return o.findIndex((z) => z.label === a) - o.findIndex((z) => z.label === b); });
  if (!D.zman || !zs.includes(D.zman)) { D.zman = zs.includes(cz) ? cz : zs[0] || cz; D.doc = null; }
  if (!D.doc) { D.doc = loadDoc(D.zman); D.dirty = false; }
  const doc = D.doc;
  const rooms = plan();
  const studs = activeStudents().map((e) => String(e.contact_id)).filter((id) => X.pById(id));
  const placed = new Set(Object.values(doc.beds).flat().filter(Boolean).map(String));
  const outSet = new Set(doc.out.map(String));
  const none = studs.filter((id) => !placed.has(id) && !outSet.has(id)).sort(byName);
  const outList = doc.out.map(String).filter((id) => X.pById(id)).sort(byName);
  const totalBeds = rooms.filter((r) => r.kind === 'room').reduce((s, r) => s + r.beds, 0);
  const chip = (id, extra = '') => `<span class="dm-chip${studs.includes(String(id)) ? '' : ' gone'}" draggable="${edit}" data-c="${h(id)}"${extra}>${h(nameOf(id) || `#${id}`)}</span>`;
  const bedHtml = (r, i) => { const cid = (doc.beds[r.id] || [])[i]; return `<div class="dm-bed dm-drop${cid ? ' full' : ''}" data-r="${h(r.id)}" data-i="${i}">${cid ? chip(cid) : '<span class="dm-free">פנוי</span>'}</div>`; };
  const roomHtml = (r) => (r.kind === 'service'
    ? `<div class="dm-room svc"><div class="dm-rh"><b>${h(r.name || r.desc)}</b>${r.name && r.desc ? `<span class="muted small">${h(r.desc)}</span>` : ''}</div></div>`
    : `<div class="dm-room${(doc.beds[r.id] || []).filter(Boolean).length > r.beds ? ' over' : ''}"><div class="dm-rh"><b>${h(r.name ? `חדר ${r.name}` : r.desc)}</b>${r.name && r.desc ? `<span class="muted small">${h(r.desc)}</span>` : ''}<span class="dm-occ">${(doc.beds[r.id] || []).filter(Boolean).length}/${r.beds}</span></div>
        <div class="dm-beds${r.beds > 4 ? ' many' : ''}">${Array.from({ length: r.beds }, (_, i) => bedHtml(r, i)).join('')}</div></div>`);
  box.innerHTML = `<h2 class="ms-h">🛏 פנימייה</h2>
    <div class="ms-bar">
      <label>זמן <select id="dm-z">${zs.map((z) => `<option${z === D.zman ? ' selected' : ''}>${h(z)}</option>`).join('')}</select></label>
      ${edit ? '<button type="button" class="btn" id="dm-newz">➕ זמן חדש</button>' : ''}
      <span class="dm-stat">${placed.size} בפנימייה · ${totalBeds} מיטות · ${Math.max(0, totalBeds - placed.size)} פנויות · ${outList.length} בדירה · <b class="${none.length ? 'ms-owe' : ''}">${none.length}</b> לא משובצים</span>
      <span class="spacer"></span>
      ${edit ? `<button type="button" class="btn primary" id="dm-save"${D.dirty ? '' : ' disabled'}>💾 שמירה</button><button type="button" class="btn" id="dm-rooms">⚙️ חדרים</button>` : ''}
      <button type="button" class="btn" id="dm-pm">🖨 מפה</button><button type="button" class="btn" id="dm-pn">🖨 לפי שם</button><button type="button" class="btn" id="dm-xl">⬇ Excel</button>
    </div>
    ${edit ? '<p class="muted small">גוררים שם למיטה (או לוחצים על מיטה ובוחרים בחור). גרירה על מיטה תפוסה — מחליפה ביניהם. השינויים נשמרים רק אחרי 💾 שמירה.</p>' : ''}
    <div class="dm-side">
      <div class="dm-pool dm-drop" data-pool="none"><h4>לא משובצים <span class="count-pill">${none.length}</span></h4><div class="dm-list">${none.map((id) => chip(id)).join('') || '<span class="muted small">כולם משובצים 👍</span>'}</div></div>
      <div class="dm-pool dm-drop out" data-pool="out"><h4>גרים בדירה (לא בפנימייה) <span class="count-pill">${outList.length}</span></h4><div class="dm-list">${outList.map((id) => chip(id)).join('') || '<span class="muted small">גוררים לכאן מי שגר בדירה</span>'}</div></div>
    </div>
    ${rooms.length ? WINGS.filter(([w]) => rooms.some((r) => r.wing === w)).map(([w, l]) => `<div class="dm-wing"><div class="dm-wl">${h(l)}</div><div class="dm-wrow">${rooms.filter((r) => r.wing === w).map(roomHtml).join('')}</div></div>`).join('')
    : `<p class="ms-note">עדיין אין חדרים.${edit ? ' לוחצים ⚙️ חדרים ומוסיפים.' : ''}</p>`}`;

  const rerender = () => renderDorm(box);
  const changed = () => { D.dirty = true; rerender(); };
  X.$('#dm-z', box).onchange = (e) => { if (D.dirty && !window.confirm('יש שינויים שלא נשמרו. לעבור בלי לשמור?')) { e.target.value = D.zman; return; } D.zman = e.target.value; D.doc = null; rerender(); };
  if (edit) {
    // לייגן א בחור (cid) אין א מיטה; ווען דארט איז שוין איינער — טוישן מיט אים
    const putBed = (cid, rid, i) => {
      const from = whereIs(doc, cid);
      const arr = (doc.beds[rid] ||= []); while (arr.length <= i) arr.push('');
      const other = arr[i];
      takeOut(doc, cid);
      arr[i] = String(cid);
      if (other && String(other) !== String(cid)) { if (from && from !== 'out') { doc.beds[from.rid][from.i] = String(other); } else if (from === 'out') doc.out.push(String(other)); }
      changed();
    };
    const putPool = (cid, pool) => { takeOut(doc, cid); if (pool === 'out') doc.out.push(String(cid)); changed(); };
    X.$$('.dm-chip', box).forEach((c) => { c.ondragstart = (ev) => { D.drag = c.dataset.c; ev.dataTransfer.setData('text/plain', c.dataset.c); ev.stopPropagation(); }; });
    X.$$('.dm-drop', box).forEach((z) => {
      z.ondragover = (ev) => { ev.preventDefault(); z.classList.add('hov'); };
      z.ondragleave = () => z.classList.remove('hov');
      z.ondrop = (ev) => { ev.preventDefault(); z.classList.remove('hov'); const cid = ev.dataTransfer.getData('text/plain') || D.drag; if (!cid) return; if (z.dataset.pool) putPool(cid, z.dataset.pool); else putBed(cid, z.dataset.r, Number(z.dataset.i)); };
    });
    X.$$('.dm-bed', box).forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); bedPick(b.dataset.r, Number(b.dataset.i), studs, doc, (cid) => { if (cid === '') { const arr = doc.beds[b.dataset.r] || []; arr[Number(b.dataset.i)] = ''; changed(); } else if (cid === '_out') { const cur = (doc.beds[b.dataset.r] || [])[Number(b.dataset.i)]; if (cur) putPool(cur, 'out'); } else putBed(cid, b.dataset.r, Number(b.dataset.i)); }); }; });
    X.$('#dm-save', box).onclick = (ev) => saveDoc(ev.currentTarget, rerender);
    X.$('#dm-rooms', box).onclick = () => roomsDialog(rerender);
    X.$('#dm-newz', box).onclick = () => newZman(zs, rerender);
  }
  // דרוקן / Excel
  const roomOfCid = (cid) => { const w = whereIs(doc, cid); if (w === 'out') return 'דירה'; if (!w) return ''; const r = rooms.find((x) => x.id === w.rid); return r ? (r.name || r.desc) : ''; };
  X.$('#dm-pm', box).onclick = () => {
    const card = (r) => (r.kind === 'service' ? `<div class="pr-r svc">${h(r.name || r.desc)}</div>`
      : `<div class="pr-r"><div class="pr-h">${h(r.name ? `חדר ${r.name}` : r.desc)}${r.name && r.desc ? ` <small>${h(r.desc)}</small>` : ''}</div>${Array.from({ length: r.beds }, (_, i) => { const c = (doc.beds[r.id] || [])[i]; return `<div class="pr-b">${c ? h(nameOf(c)) : '&nbsp;'}</div>`; }).join('')}</div>`);
    const css = `<style>.pr-w{margin-bottom:4mm}.pr-wl{font-weight:700;font-family:'Frank Ruhl Libre',serif;font-size:15px;margin:2mm 0}.pr-row{display:flex;flex-wrap:wrap;gap:3mm}.pr-r{border:1.5px solid #8a7444;border-radius:6px;width:42mm;break-inside:avoid;font-size:11.5px}.pr-r.svc{background:#eee;display:flex;align-items:center;justify-content:center;min-height:16mm;color:#555}.pr-h{background:#f1ead8;border-bottom:1.5px solid #b8913c;padding:2px 4px;font-weight:700;text-align:center}.pr-h small{font-weight:400;color:#6b6150}.pr-b{border-top:1px solid #ddd;padding:2px 4px;min-height:14px}</style>`;
    X.printWin(`פנימייה — ${D.zman}`, h(heDate(todayIso())), css + WINGS.filter(([w]) => rooms.some((r) => r.wing === w)).map(([w, l]) => `<div class="pr-w"><div class="pr-wl">${h(l)}</div><div class="pr-row">${rooms.filter((r) => r.wing === w).map(card).join('')}</div></div>`).join(''), { landscape: true });
  };
  X.$('#dm-pn', box).onclick = () => X.printList(`פנימייה — ${D.zman}`, h(heDate(todayIso())), { cols: [{ t: 'חדר', c: 'c' }], rows: studs.map((id) => ({ id, cells: [roomOfCid(id)] })), twoUp: true });
  X.$('#dm-xl', box).onclick = () => downloadXlsx(`פנימייה ${D.zman}`, ['שם', 'משפחה', 'חדר'], [...studs].sort(byName).map((id) => [first(id), last(id), roomOfCid(id)]), { rtl: true });
}

function bedPick(rid, i, studs, doc, done) {
  const { h } = X;
  const cur = (doc.beds[rid] || [])[i];
  const list = [...studs].sort(byName);
  const where = (id) => { const w = whereIs(doc, id); if (w === 'out') return ' (בדירה)'; if (!w) return ''; const r = plan().find((x) => x.id === w.rid); return r ? ` (${r.name || r.desc})` : ''; };
  const d = X.dialog(`<h3>מיטה ${i + 1}</h3><input class="dm-q" list="dm-dl" placeholder="שם הבחור…" style="width:100%" value="${cur ? h(`${nameOf(cur)} (#${cur})`) : ''}">
    <datalist id="dm-dl">${list.map((id) => `<option value="${h(`${nameOf(id)} (#${id})`)}">${h(where(id))}</option>`).join('')}</datalist>
    <div class="actions">${cur ? '<button type="button" class="btn ghost" data-empty>⬜ לפנות את המיטה</button><button type="button" class="btn ghost" data-out>🏠 עבר לדירה</button>' : ''}<span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>אישור</button></div>`);
  const q = X.$('.dm-q', d); q.focus(); q.select();
  X.$('[data-ok]', d).onclick = () => { const m = X.S(q.value).match(/\(#(\d+)\)$/); if (!m) { X.toast('בחר שם מהרשימה.', 'err'); return; } d.close(); done(m[1]); };
  X.$('[data-empty]', d)?.addEventListener('click', () => { d.close(); done(''); });
  X.$('[data-out]', d)?.addEventListener('click', () => { d.close(); done('_out'); });
}

async function saveDoc(btn, rerender) {
  btn.disabled = true;
  const doc = { beds: Object.fromEntries(Object.entries(D.doc.beds).map(([k, v]) => [k, (v || []).map((x) => (x ? String(x) : ''))]).filter(([, v]) => v.some(Boolean))), out: [...new Set(D.doc.out.map(String))] };
  try {
    const r = await X.call(X.KEY, 'dormSave', { zman: D.zman, doc });
    X.st.settings = r.settings;
    // דער היינטיגער זמן: אויך דאס פעלד "חדר" ביי די רישומים (דאס ווייזט זיך ביי "תלמידי הישיבה")
    if (D.zman === currentZman()) {
      const rooms = plan();
      const rows = activeStudents().map((e) => { const w = whereIs(doc, e.contact_id); const rn = w && w !== 'out' ? (rooms.find((x) => x.id === w.rid)?.name || rooms.find((x) => x.id === w.rid)?.desc || '') : w === 'out' ? 'דירה' : ''; return X.S(e.room) === rn ? null : { enroll_id: e.enroll_id, room: rn, e }; }).filter(Boolean);
      if (rows.length) { await X.call(X.KEY, 'roomSet', { rows: rows.map(({ enroll_id, room }) => ({ enroll_id, room })) }); rows.forEach((x) => { x.e.room = x.room; }); }
    }
    D.dirty = false; D.doc = null; X.toast('נשמר.'); rerender();
  } catch (err) { btn.disabled = false; X.toast(X.msg(err), 'err'); }
}

function newZman(have, rerender) {
  const { h } = X;
  const opts = zmanim().map((z) => z.label).filter((z) => !have.includes(z));
  const d = X.dialog(`<h3>➕ זמן חדש</h3><label>זמן <select class="dm-nz">${opts.map((z) => `<option>${h(z)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" class="dm-copy" checked> להעתיק את השיבוץ של ${h(D.zman)} (אחר כך משנים מה שצריך)</label>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>פתיחה</button></div>`);
  X.$('[data-ok]', d).onclick = () => {
    const z = X.$('.dm-nz', d).value; if (!z) return;
    const copy = X.$('.dm-copy', d).checked ? JSON.parse(JSON.stringify(D.doc || { beds: {}, out: [] })) : { beds: {}, out: [] };
    d.close(); D.zman = z; D.doc = copy; D.dirty = true;
    X.st.settings = { ...X.st.settings, [`dorm:${z}`]: JSON.stringify(copy) };
    rerender();
  };
}

function roomsDialog(rerender) {
  const { h } = X;
  const list = plan();
  const row = (r) => `<tr data-id="${h(r.id)}"><td><select name="wing">${WINGS.map(([k, l]) => `<option value="${k}"${k === r.wing ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></td>
    <td><input name="name" value="${h(r.name)}" placeholder="מספר" style="width:5.5em"></td><td><input name="desc" value="${h(r.desc)}" placeholder="תיאור (חדר קפה, דירה…)"></td>
    <td><select name="kind"><option value="room"${r.kind === 'room' ? ' selected' : ''}>חדר שינה</option><option value="service"${r.kind === 'service' ? ' selected' : ''}>חדר שירות</option></select></td>
    <td><input name="beds" type="number" min="0" max="50" value="${h(r.beds || '')}" style="width:4.5em"></td>
    <td class="nowrap"><button type="button" class="linkish" data-up title="למעלה">▲</button><button type="button" class="linkish" data-dn title="למטה">▼</button><button type="button" class="linkish" data-del>🗑</button></td></tr>`;
  const d = X.dialog(`<h2>⚙️ החדרים — המפה</h2>
    <p class="muted small">הסדר כאן = הסדר על המפה (מימין לשמאל בכל אגף). "חדר שירות" (מכבסה, מחסן, כניסה…) מופיע אפור, בלי מיטות.</p>
    <div class="ms-wrap"><table class="ms-table"><thead><tr><th>אגף</th><th>מספר</th><th>תיאור</th><th>סוג</th><th>מיטות</th><th></th></tr></thead><tbody class="dm-rt">${list.map(row).join('')}</tbody></table></div>
    <p><button type="button" class="btn" id="dm-add">➕ חדר</button></p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" id="dm-ok">💾 שמירה</button></div>`, 'wide');
  const tb = X.$('.dm-rt', d);
  tb.onclick = (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.closest('[data-del]')) tr.remove();
    else if (e.target.closest('[data-up]') && tr.previousElementSibling) tr.parentNode.insertBefore(tr, tr.previousElementSibling);
    else if (e.target.closest('[data-dn]') && tr.nextElementSibling) tr.parentNode.insertBefore(tr.nextElementSibling, tr);
  };
  X.$('#dm-add', d).onclick = () => { tb.insertAdjacentHTML('beforeend', row({ id: `r${Date.now().toString(36)}`, name: '', desc: '', beds: 4, wing: 'A', kind: 'room' })); };
  X.$('#dm-ok', d).onclick = async (ev) => {
    const out = X.$$('tr', tb).map((tr) => { const v = (n) => tr.querySelector(`[name=${n}]`).value; return { id: tr.dataset.id, name: X.S(v('name')), desc: X.S(v('desc')), beds: v('kind') === 'service' ? 0 : Number(v('beds')) || 0, wing: v('wing'), kind: v('kind') }; }).filter((r) => r.name || r.desc);
    ev.currentTarget.disabled = true;
    try { const r = await X.call(X.KEY, 'roomsSave', { rooms: out }); X.st.settings = r.settings; d.close(); X.toast('נשמר.'); rerender(); } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
