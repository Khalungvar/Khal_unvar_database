// 🔤 תיקון שמות פרטיים בעברית: שמות שנכתבו בעברית ע"י תעתיק אוטומטי מאנגלית (Joshua → דזשאשוא)
// → השם העברי (יהושע). כינוי → השם המלא. כמה אפשרויות → לבחור. שם לועזי → לכתוב ידנית. שום דבר לא נשמר בלי ✓.
import { state, loadAll, bulkSetContactFields } from './data.js';
import { escapeHtml as h } from './util.js';
import { transliterateEnglish } from './names.js';
import { heOfName } from './hebnames.js';

let ui = null;
export function initNameFix(helpers) { ui = helpers; }

const tr = (en) => String(en || '').split(/\s+/).filter(Boolean).map((w) => transliterateEnglish(w)).join(' ');
const clean = (s) => String(s || '').trim();
/** נראה כמו תעתיק אוטומטי (או ריק) */
const looksAuto = (he, en) => !clean(he) || clean(he) === tr(en) || /דזש|טשש/.test(he);

export function nameFixCandidates() {
  const out = [];
  state.contacts.filter((c) => !c.deleted_at).forEach((c) => {
    [['first_name_he', 'first_name_en', 'שם פרטי'], ['wife_name_he', 'wife_name_en', 'שם האשה']].forEach(([fh, fe, label]) => {
      const en = clean(c[fe]); const cur = clean(c[fh]);
      if (!en || !looksAuto(cur, en)) return;
      const s = heOfName(en, (w) => transliterateEnglish(w));
      if (!s) return;
      if (s.foreign) { out.push({ c, fh, label, en, cur, kind: 'manual', options: [] }); return; }
      if (!s.he || s.he === cur) return;
      out.push({ c, fh, label, en, cur, kind: s.options.length > 1 ? 'choose' : s.sure ? 'sure' : 'check', options: s.options, he: s.he });
    });
  });
  const ord = { sure: 0, choose: 1, check: 2, manual: 3 };
  return out.sort((a, b) => ord[a.kind] - ord[b.kind] || a.en.localeCompare(b.en));
}

export function openNameFix() {
  const list = nameFixCandidates();
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet wide ls-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  const KIND = { sure: '✓ בטוח', choose: '❓ לבחור', check: '⚠ לבדוק', manual: '✎ לכתוב ידנית' };
  const cnt = (k) => list.filter((r) => r.kind === k).length;
  const last = (c) => clean(c.last_name_he) || clean(c.last_name_en);
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="סגירה">✕</button>
    <h2>🔤 תיקון שמות פרטיים בעברית</h2>
    <p class="muted small">שמות שנכתבו בעברית בתעתיק אוטומטי מאנגלית. ההצעה — השם העברי (כינוי → השם המלא); רק שם שהוא באמת אידיש נשאר באידיש. אפשר לשנות כל הצעה. נשמר רק מה שמסומן.</p>
    <p>${Object.keys(KIND).map((k) => `<span class="nf-pill nf-${k}">${KIND[k]}: ${cnt(k)}</span>`).join(' ')}</p>
    ${list.length ? `<p><label class="check"><input type="checkbox" id="nf-sure"> לסמן את כל ה"בטוחים"</label> · <b id="nf-n"></b></p>
    <div class="ls-table-wrap"><table class="ls-table"><thead><tr><th></th><th>אנגלית</th><th>עכשיו בעברית</th><th>חדש בעברית</th><th></th><th>משפחה</th></tr></thead>
    <tbody>${list.map((r, i) => `<tr class="nf-r nf-${r.kind}"><td><input type="checkbox" data-i="${i}"></td>
      <td dir="ltr">${h(r.en)}${r.fh === 'wife_name_he' ? ' <span class="muted small">(אשה)</span>' : ''}</td>
      <td class="muted">${h(r.cur) || '—'}</td>
      <td>${r.kind === 'choose' ? `<select data-v="${i}">${r.options.map((o) => `<option>${h(o)}</option>`).join('')}</select>` : `<input data-v="${i}" value="${h(r.he || '')}" placeholder="${r.kind === 'manual' ? 'לכתוב ידנית…' : ''}" style="width:11em">`}</td>
      <td class="small">${KIND[r.kind]}</td><td class="small">${h(last(r.c))} <span class="muted">#${h(r.c.contact_id)}</span></td></tr>`).join('')}</tbody></table></div>`
    : '<p class="fc-msg">אין שמות לתקן. 👍</p>'}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button>
    ${list.length ? '<button type="button" class="btn primary" id="nf-go">💾 לשמור את המסומנים</button>' : ''}</div>`;
  dlg.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => dlg.close(); });
  dlg.showModal();
  if (!list.length) return;
  const boxes = [...dlg.querySelectorAll('input[data-i]')];
  const val = (i) => clean(dlg.querySelector(`[data-v="${i}"]`)?.value);
  const count = () => { dlg.querySelector('#nf-n').textContent = `מסומנים: ${boxes.filter((b) => b.checked).length}`; };
  // כתיבה / בחירה בשורה → מסמן אותה
  dlg.querySelectorAll('[data-v]').forEach((el) => { el.addEventListener('input', () => { const b = boxes[Number(el.dataset.v)]; b.checked = !!val(el.dataset.v); count(); }); el.addEventListener('change', () => { boxes[Number(el.dataset.v)].checked = !!val(el.dataset.v); count(); }); });
  dlg.addEventListener('change', count);
  dlg.querySelector('#nf-sure').onchange = (e) => { list.forEach((r, i) => { if (r.kind === 'sure') boxes[i].checked = e.target.checked; }); count(); };
  count();
  dlg.querySelector('#nf-go').onclick = async (e) => {
    const pick = boxes.filter((b) => b.checked).map((b) => Number(b.dataset.i)).filter((i) => val(i));
    if (!pick.length) return;
    if (!window.confirm(`לעדכן ${pick.length} שמות בעברית?`)) return;
    e.target.disabled = true; e.target.textContent = 'שומר…';
    try {
      // כמה שדות באותו כרטיס → שינוי אחד
      const by = new Map();
      pick.forEach((i) => { const r = list[i]; const x = by.get(r.c) || {}; x[r.fh] = val(i); by.set(r.c, x); });
      await bulkSetContactFields([...by].map(([c, set]) => ({ c, set })), 'Hebrew first name fix (🔤)');
      ui?.toast?.(`עודכנו ${pick.length} שמות.`);
      dlg.close();
      await loadAll();
      ui?.refreshAll?.();
    } catch (err) { ui?.toast?.(ui.friendlyError ? ui.friendlyError(err) : String(err), 'error'); e.target.disabled = false; e.target.textContent = '💾 לשמור את המסומנים'; }
  };
}
