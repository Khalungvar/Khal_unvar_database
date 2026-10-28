// אתר פון א מוסד — 🛏 פנימייה: חדרים (מיט וויפל בעטן), שיבוץ פון די תלמידים (דאס פעלד "חדר" אינעם רישום), דרוקן.
import { downloadXlsx } from '../excel.js?v=495';
import { loadSchool, schoolLoaded, activeStudents } from './school.js?v=495';
import { heDate } from './brand.js?v=495';
import { todayIso } from '../hebdate.js?v=495';

let X = null;
export function initDorm(ctx) { X = ctx; }

const D = { pending: new Map(), drag: null }; // enroll_id → room (נאך נישט געשפייכלט)
const first = (id) => X.S(X.pById(id)?.first_name_he || X.pById(id)?.first_name_en);
const last = (id) => X.S(X.pById(id)?.last_name_he || X.pById(id)?.last_name_en);
const nameOf = (id) => [first(id), last(id)].filter(Boolean).join(' ');
const byName = (a, b) => last(a.contact_id).localeCompare(last(b.contact_id), 'he') || first(a.contact_id).localeCompare(first(b.contact_id), 'he');
const rooms = () => (Array.isArray(X.st.settings?.rooms) ? X.st.settings.rooms : []).filter((r) => X.S(r.name));
const roomOf = (e) => (D.pending.has(String(e.enroll_id)) ? D.pending.get(String(e.enroll_id)) : X.S(e.room));

export async function renderDorm(box) {
  const { h } = X;
  if (!schoolLoaded()) { box.innerHTML = '<p class="muted">טוען…</p>'; try { await loadSchool(); } catch (err) { box.innerHTML = `<p class="ms-note err">${h(X.msg(err))}</p>`; return; } }
  const edit = X.can('dorm');
  const studs = activeStudents().filter((e) => X.pById(e.contact_id)).sort(byName);
  const defined = rooms();
  // חדרים וואס שטייען ביי א בחור אבער נישט אין דער רשימה — אויך ווייזן
  const extra = [...new Set(studs.map(roomOf).filter((r) => r && !defined.some((x) => X.S(x.name) === r)))].sort((a, b) => a.localeCompare(b, 'he', { numeric: true }));
  const all = [...defined.map((r) => ({ name: X.S(r.name), beds: Number(r.beds) || 0, note: X.S(r.note) })), ...extra.map((n) => ({ name: n, beds: 0, note: '', extra: true }))];
  const inRoom = (n) => studs.filter((e) => roomOf(e) === n);
  const none = studs.filter((e) => !roomOf(e));
  const beds = all.reduce((s, r) => s + r.beds, 0);
  const used = studs.length - none.length;
  const chip = (e) => `<span class="dm-chip${D.pending.has(String(e.enroll_id)) ? ' moved' : ''}" draggable="${edit}" data-e="${h(e.enroll_id)}" title="${edit ? 'לגרור לחדר, או ללחוץ לבחירת חדר' : ''}">${h(nameOf(e.contact_id))}</span>`;
  box.innerHTML = `<h2 class="ms-h">🛏 פנימייה</h2>
    <div class="ms-bar">
      <span class="dm-stat">${all.length} חדרים · ${beds} מיטות · <b>${used}</b> משובצים · <b class="${none.length ? 'ms-owe' : ''}">${none.length}</b> לא משובצים${beds ? ` · ${Math.max(0, beds - used)} מיטות פנויות` : ''}</span>
      <span class="spacer"></span>
      ${edit ? `<button type="button" class="btn primary" id="dm-save"${D.pending.size ? '' : ' disabled'}>💾 שמירה${D.pending.size ? ` (${D.pending.size})` : ''}</button>` : ''}
      ${edit ? '<button type="button" class="btn" id="dm-rooms">⚙️ חדרים</button>' : ''}
      <button type="button" class="btn" id="dm-pr">🖨 לפי חדר</button><button type="button" class="btn" id="dm-pn">🖨 לפי שם</button><button type="button" class="btn" id="dm-xl">⬇ Excel</button>
    </div>
    ${edit ? '<p class="muted small">גוררים בחור לחדר (או לוחצים על השם ובוחרים חדר). השינויים נשמרים רק אחרי 💾 שמירה.</p>' : ''}
    <div class="dm-none dm-drop" data-room=""><h4>לא משובצים <span class="count-pill">${none.length}</span></h4><div class="dm-list">${none.map(chip).join('') || '<span class="muted small">כולם משובצים 👍</span>'}</div></div>
    ${all.length ? `<div class="dm-grid">${all.map((r) => { const list = inRoom(r.name); const over = r.beds && list.length > r.beds; return `<div class="dm-room dm-drop${over ? ' over' : ''}${r.extra ? ' extra' : ''}" data-room="${h(r.name)}">
        <div class="dm-rh"><b>חדר ${h(r.name)}</b><span class="dm-occ">${list.length}${r.beds ? ` / ${r.beds}` : ''}</span></div>
        ${r.note ? `<div class="muted small">${h(r.note)}</div>` : ''}${r.extra ? '<div class="muted small">לא ברשימת החדרים</div>' : ''}
        <div class="dm-list">${list.map(chip).join('')}${r.beds > list.length ? Array.from({ length: r.beds - list.length }, () => '<span class="dm-free">מיטה פנויה</span>').join('') : ''}</div></div>`; }).join('')}</div>`
    : `<p class="ms-note">עדיין אין חדרים.${edit ? ' לוחצים ⚙️ חדרים ומוסיפים.' : ''}</p>`}`;

  // גרירה / קליק
  const move = (eid, room) => {
    const e = studs.find((x) => String(x.enroll_id) === String(eid)); if (!e) return;
    if (X.S(e.room) === room) D.pending.delete(String(eid)); else D.pending.set(String(eid), room);
    renderDorm(box);
  };
  if (edit) {
    X.$$('.dm-chip', box).forEach((c) => {
      c.ondragstart = (ev) => { D.drag = c.dataset.e; ev.dataTransfer.setData('text/plain', c.dataset.e); };
      c.onclick = () => roomPick(c.dataset.e, all, (room) => move(c.dataset.e, room));
    });
    X.$$('.dm-drop', box).forEach((z) => {
      z.ondragover = (ev) => { ev.preventDefault(); z.classList.add('hov'); };
      z.ondragleave = () => z.classList.remove('hov');
      z.ondrop = (ev) => { ev.preventDefault(); z.classList.remove('hov'); const id = ev.dataTransfer.getData('text/plain') || D.drag; if (id) move(id, z.dataset.room); };
    });
    X.$('#dm-save', box).onclick = async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      const rows = [...D.pending].map(([enroll_id, room]) => ({ enroll_id, room }));
      try {
        await X.call(X.KEY, 'roomSet', { rows });
        rows.forEach((r) => { const e = studs.find((x) => String(x.enroll_id) === String(r.enroll_id)); if (e) e.room = r.room; });
        D.pending.clear(); X.toast('נשמר.'); renderDorm(box);
      } catch (err) { b.disabled = false; X.toast(X.msg(err), 'err'); }
    };
    X.$('#dm-rooms', box).onclick = () => roomsDialog(box);
  }
  // דרוקן / Excel
  const title = 'פנימייה';
  X.$('#dm-pr', box).onclick = () => {
    const blocks = [...all, ...(none.length ? [{ name: '', none: true }] : [])].map((r) => {
      const list = r.none ? none : inRoom(r.name);
      return `<div class="dm-pb"><div class="dm-ph">${r.none ? 'לא משובצים' : `חדר ${h(r.name)}`}<span>${list.length}${r.beds ? ` / ${r.beds}` : ''}</span></div>
        <table><tbody>${list.map((e, i) => `<tr><td class="n">${i + 1}</td><td class="nm">${h(nameOf(e.contact_id))}</td></tr>`).join('')}</tbody></table></div>`;
    }).join('');
    X.printWin(`${title} — לפי חדר`, h(heDate(todayIso())), `<style>.dm-pg{columns:3;column-gap:6mm}.dm-pb{break-inside:avoid;margin-bottom:4mm}.dm-ph{display:flex;justify-content:space-between;font-weight:700;background:#f1ead8;border-bottom:2px solid #b8913c;padding:3px 6px;font-family:'Frank Ruhl Libre',serif;font-size:15px}</style><div class="dm-pg">${blocks}</div>`);
  };
  X.$('#dm-pn', box).onclick = () => X.printList(`${title} — לפי שם`, h(heDate(todayIso())), { cols: [{ t: 'חדר', c: 'c' }], rows: studs.map((e) => ({ id: e.contact_id, cells: [roomOf(e)] })), twoUp: true });
  X.$('#dm-xl', box).onclick = () => downloadXlsx(title, ['שם', 'משפחה', 'חדר'], studs.map((e) => [first(e.contact_id), last(e.contact_id), roomOf(e)]), { rtl: true });
}

function roomPick(eid, all, done) {
  const { h } = X;
  const d = X.dialog(`<h3>בחירת חדר</h3><select class="dm-sel" style="width:100%"><option value="">— לא משובץ —</option>${all.map((r) => `<option value="${h(r.name)}">חדר ${h(r.name)}</option>`).join('')}</select>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" data-ok>אישור</button></div>`);
  X.$('[data-x]', d).onclick = () => d.close();
  X.$('[data-ok]', d).onclick = () => { const v = X.$('.dm-sel', d).value; d.close(); done(v); };
}

function roomsDialog(box) {
  const { h } = X;
  const list = rooms().map((r) => ({ name: X.S(r.name), beds: Number(r.beds) || '', note: X.S(r.note) }));
  const row = (r) => `<tr><td><input name="name" value="${h(r.name)}" placeholder="למשל 12"></td><td><input name="beds" type="number" min="0" max="30" value="${h(r.beds)}" style="width:5em"></td><td><input name="note" value="${h(r.note)}" placeholder="קומה, בניין…"></td><td><button type="button" class="linkish" data-del>🗑</button></td></tr>`;
  const d = X.dialog(`<h2>⚙️ חדרי הפנימייה</h2>
    <table class="ms-table"><thead><tr><th>חדר</th><th>מיטות</th><th>הערה</th><th></th></tr></thead><tbody class="dm-rt">${list.map(row).join('')}</tbody></table>
    <p><button type="button" class="btn" id="dm-add">➕ חדר</button> <button type="button" class="btn ghost" id="dm-many">➕ כמה חדרים ביחד</button></p>
    <p class="muted small">מחיקת חדר מהרשימה לא מוציאה את הבחורים ממנו — הם יופיעו תחת "לא ברשימת החדרים" עד שמעבירים אותם.</p>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>ביטול</button><button type="button" class="btn primary" id="dm-ok">💾 שמירה</button></div>`);
  const tb = X.$('.dm-rt', d);
  const wire = () => X.$$('[data-del]', tb).forEach((b) => { b.onclick = () => b.closest('tr').remove(); });
  wire();
  X.$('#dm-add', d).onclick = () => { tb.insertAdjacentHTML('beforeend', row({ name: '', beds: '', note: '' })); wire(); };
  X.$('#dm-many', d).onclick = () => {
    const v = window.prompt('מספרי חדרים (למשל 1-12, או 101,102,103) — ומספר מיטות אחרי נקודתיים, למשל 1-12:4', '');
    if (!v) return;
    const [part, bedsTxt] = v.split(':'); const bedsN = Number(bedsTxt) || '';
    const names = [];
    part.split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { const m = x.match(/^(\d+)\s*-\s*(\d+)$/); if (m) { for (let i = Number(m[1]); i <= Number(m[2]) && names.length < 300; i += 1) names.push(String(i)); } else names.push(x); });
    names.forEach((n) => tb.insertAdjacentHTML('beforeend', row({ name: n, beds: bedsN, note: '' })));
    wire();
  };
  X.$('[data-x]', d).onclick = () => d.close();
  X.$('#dm-ok', d).onclick = async (ev) => {
    const out = X.$$('tr', tb).map((tr) => ({ name: X.S(tr.querySelector('[name=name]').value), beds: Number(tr.querySelector('[name=beds]').value) || 0, note: X.S(tr.querySelector('[name=note]').value) })).filter((r) => r.name);
    const dup = out.map((r) => r.name).find((n, i, a) => a.indexOf(n) !== i);
    if (dup) { X.toast(`החדר "${dup}" מופיע פעמיים.`, 'err'); return; }
    ev.currentTarget.disabled = true;
    try { const r = await X.call(X.KEY, 'roomsSave', { rooms: out }); X.st.settings = r.settings; d.close(); X.toast('נשמר.'); renderDorm(box); } catch (err) { ev.currentTarget.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
