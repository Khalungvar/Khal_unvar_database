// 📜 קוויטל (שם + בן + שם האם + משפחה) לפי קבוצות: רבני הישיבה · צוות הישיבה · תלמידי הישיבה — A4.
// 🏷 מדבקות — שמות על דף A4 רגיל עם קווי חיתוך.
import { todayIso, isoToHebrewText } from '../hebdate.js?v=653';

const GROUPS = [['rabbi', 'רבני הישיבה'], ['staff', 'צוות הישיבה'], ['student', 'תלמידי הישיבה']];
const norm = (t) => String(t || '').replace(/["'׳״()\-.,]/g, '').replace(/\s+/g, ' ').trim();
const skel = (t) => norm(t).replace(/[וי]/g, '').replace(/\s/g, '');

/** מי בקוויטל: כל מי שסומן קבוצה + כל התלמידים הפעילים + כל אנשי הצוות */
function people(X, active) {
  const ids = new Map();
  active.forEach((id) => ids.set(String(id), 'student'));
  X.st.people.forEach((p) => {
    const id = String(p.contact_id);
    if ((p.kinds || [p.kind]).includes('staff') && !ids.has(id)) ids.set(id, 'staff');
    if (p.kv_group) ids.set(id, p.kv_group);
  });
  return [...ids.entries()].map(([id, auto]) => { const p = X.pById(id); return p ? { p, g: p.kv_group || auto } : null; }).filter(Boolean)
    .sort((a, b) => String(a.p.last_name_he).localeCompare(String(b.p.last_name_he), 'he') || String(a.p.first_name_he).localeCompare(String(b.p.first_name_he), 'he'));
}
const line = (p, mother) => `${p.first_name_he || ''}${mother ? ` בן ${mother}` : ''}${p.last_name_he ? ` (${p.last_name_he})` : ''}`.replace(/\s+/g, ' ').trim();

/** ⬆ ייבוא מ-Word: "שם בן שם-האם (משפחה)" + כותרות הקבוצות */
async function readDocx(file) {
  const { _test } = await import('./shabbos.js?v=696');
  const files = Object.fromEntries(await _test.unzip(await file.arrayBuffer()));
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(files['word/document.xml']), 'application/xml');
  return [...xml.getElementsByTagName('w:p')].map((p) => [...p.getElementsByTagName('w:t')].map((t) => t.textContent).join('').trim()).filter(Boolean);
}
function parseLines(lines) {
  let g = 'student'; const out = [];
  lines.forEach((l) => {
    if (/רבני/.test(l) && l.length < 25) { g = 'rabbi'; return; }
    if (/צוות/.test(l) && l.length < 25) { g = 'staff'; return; }
    if (/תלמידי|בחורי/.test(l) && l.length < 25) { g = 'student'; return; }
    const m = l.replace(/^ר['׳]\s*/, '').match(/^(.+?)\s+(?:בן|ב"ר)\s+(.+?)\s*\(([^)]*)\)?\s*$/) || l.replace(/^ר['׳]\s*/, '').match(/^(.+?)\s+(?:בן)\s+(.+?)\s*$/);
    if (m) out.push({ first: m[1].trim(), mother: m[2].trim(), last: (m[3] || '').trim(), g, raw: l });
  });
  return out;
}

/** ⬇ Word (.docx) — אותו עיצוב כמו ההדפסה: A4, שוליים 14 מ"מ, בס"ד, כותרת, תאריך עברי, קבוצות; קבוצה ארוכה (מעל 14) — בשני טורים */
async function kvitelDocx(X, by) {
  const { zip } = await import('../luach/tfdocx.js?v=696');
  const E = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const F = 'Frank Ruhl Libre';
  const run = (t, sz, b) => `<w:r><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}"/>${b ? '<w:b/><w:bCs/>' : ''}<w:rtl/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${E(t)}</w:t></w:r>`;
  const para = (t, { sz = 22, b = false, jc = 'right', after = 0, before = 0, border = false } = {}) => `<w:p><w:pPr><w:bidi/>${border ? '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="333333"/></w:pBdr>' : ''}<w:spacing w:before="${before}" w:after="${after}" w:line="${Math.round(sz * 12 * 1.1)}" w:lineRule="auto"/><w:jc w:val="${jc}"/></w:pPr>${t ? run(t, sz, b) : ''}</w:p>`;
  const cell = (items) => `<w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>${items.map((t) => para(t)).join('') || para('')}</w:tc>`;
  let body = para('בס"ד', { sz: 18 }) + para(X.st.mosad?.name || '', { sz: 33, b: true, jc: 'center' }) + para(isoToHebrewText(todayIso()), { sz: 18, jc: 'center', after: 200 });
  GROUPS.filter(([k]) => by[k].length).forEach(([k, t]) => {
    body += para(t, { sz: 26, b: true, before: 280, after: 80, border: true });
    const xs = by[k];
    if (xs.length > 14) {
      const half = Math.ceil(xs.length / 2);
      body += `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="9600" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4800"/><w:gridCol w:w="4800"/></w:tblGrid><w:tr>${cell(xs.slice(0, half))}${cell(xs.slice(half))}</w:tr></w:tbl>`;
    } else body += xs.map((x) => para(x)).join('');
  });
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="794" w:right="794" w:bottom="794" w:left="794" w:header="0" w:footer="0" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;
  const blob = zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', doc],
  ]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `קוויטל ${isoToHebrewText(todayIso())}.docx`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

export function kvitelDialog(X, active) {
  const { h } = X;
  const list = people(X, active);
  const edits = {}; // id → { mother_name, kv_group, kv_title }
  // תואר לקוויטל: ברירת מחדל לפי הקבוצה (רבנים/צוות "ר'", תלמידים בלי). שינוי — רק בקוויטל, לא בכרטיס. "-" = בלי תואר
  const defTitle = (g) => (g === 'student' ? '' : "ר'");
  const val = (x, k) => {
    const e = edits[x.p.contact_id]?.[k];
    if (e !== undefined) return e;
    if (k === 'kv_group') return x.p.kv_group || x.g;
    if (k === 'kv_title') return x.p.kv_title || '';
    return x.p.mother_name || '';
  };
  const titleOf = (x) => { const t = val(x, 'kv_title'); return t === '-' ? '' : (t || defTitle(val(x, 'kv_group'))); };
  const full = (x) => `${titleOf(x) ? `${titleOf(x)} ` : ''}${line(x.p, val(x, 'mother_name'))}`;
  const d = X.dialog(`<h2>📜 קוויטל</h2>
    <p class="muted small">לכל אחד: שם האם, הקבוצה ו<b>תואר לקוויטל</b> (ריק = לפי הקבוצה: "ר'" לרבנים ולצוות, בלי לתלמידים; "-" = בלי תואר — משנה רק את הקוויטל, לא את הכרטיס). בהדפסה: "שם בן שם-האם (משפחה)" לפי הקבוצות — רבני הישיבה, צוות הישיבה, תלמידי הישיבה. התלמידים הפעילים ואנשי הצוות נכנסים לבד; "לא בקוויטל" — מוציא.</p>
    <div class="ms-bar"><input type="search" id="kv-q" placeholder="חיפוש…"><label class="check small"><input type="checkbox" id="kv-miss"> רק בלי שם האם</label><span class="spacer"></span>
      <button type="button" class="btn" id="kv-imp">⬆ ייבוא מ-Word</button><button type="button" class="btn" id="kv-print">🖨 הדפסה (A4)</button><button type="button" class="btn" id="kv-docx">⬇ הורדה (Word)</button><button type="button" class="btn primary" id="kv-save">💾 שמירה</button></div>
    <p class="small" id="kv-msg"></p>
    <div class="ms-wrap" style="max-height:60vh"><table class="ms-table"><thead><tr><th>#</th><th>שם</th><th>תואר לקוויטל</th><th>שם האם</th><th>קבוצה</th><th>בקוויטל</th></tr></thead><tbody id="kv-rows"></tbody></table></div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>סגירה</button></div>`, 'ms-wide');
  const draw = () => {
    const q = norm(X.$('#kv-q', d).value); const miss = X.$('#kv-miss', d).checked;
    const rows = list.filter((x) => (!q || norm(`${x.p.first_name_he} ${x.p.last_name_he}`).includes(q)) && (!miss || !val(x, 'mother_name')));
    X.$('#kv-rows', d).innerHTML = rows.map((x, i) => `<tr data-id="${h(x.p.contact_id)}"><td class="num">${i + 1}</td><td>${h(X.nameOf(x.p))}</td>
      <td><input data-f="kv_title" value="${h(val(x, 'kv_title'))}" placeholder="${h(defTitle(val(x, 'kv_group')) || '—')}" style="width:80px"></td>
      <td><input data-f="mother_name" value="${h(val(x, 'mother_name'))}" placeholder="שם האם"></td>
      <td><select data-f="kv_group">${[...GROUPS, ['none', 'לא בקוויטל']].map(([k, t]) => `<option value="${k}"${val(x, 'kv_group') === k ? ' selected' : ''}>${h(t)}</option>`).join('')}</select></td>
      <td class="small">${h(full(x))}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">אין.</td></tr>';
    X.$$('[data-f]', d).forEach((el) => { el.oninput = el.onchange = () => { const id = el.closest('tr').dataset.id; (edits[id] ||= {})[el.dataset.f] = el.value.trim(); const x = list.find((y) => String(y.p.contact_id) === id); el.closest('tr').lastElementChild.textContent = full(x); }; });
  };
  draw();
  X.$('#kv-q', d).oninput = draw; X.$('#kv-miss', d).onchange = draw;
  const save = async (quiet) => {
    const rows = Object.entries(edits).map(([contact_id, o]) => ({ contact_id, ...o }));
    if (!rows.length) { if (!quiet) X.toast('אין שינויים.'); return true; }
    try {
      await X.call(X.KEY, 'kvitelSave', { rows });
      rows.forEach((r) => { const p = X.pById(r.contact_id); if (p) { if (r.mother_name !== undefined) p.mother_name = r.mother_name; if (r.kv_group !== undefined) p.kv_group = r.kv_group; if (r.kv_title !== undefined) p.kv_title = r.kv_title; } });
      Object.keys(edits).forEach((k) => delete edits[k]);
      if (!quiet) X.toast(`נשמר (${rows.length}).`); return true;
    } catch (err) { X.toast(X.msg(err), 'err'); return false; }
  };
  X.$('#kv-save', d).onclick = () => save(false);
  X.$('#kv-imp', d).onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const got = parseLines(await readDocx(f));
        let ok = 0; const miss = [];
        got.forEach((r) => {
          const cand = list.filter((x) => skel(x.p.last_name_he) === skel(r.last) || !r.last);
          const firstTok = (t) => skel(String(t).split(' ')[0]);
          const hit = cand.find((x) => skel(x.p.first_name_he) === skel(r.first)) || cand.find((x) => firstTok(x.p.first_name_he) === firstTok(r.first) && r.last);
          if (hit) { (edits[hit.p.contact_id] ||= {}).mother_name = r.mother; edits[hit.p.contact_id].kv_group = r.g; ok += 1; } else miss.push(r.raw);
        });
        draw();
        X.$('#kv-msg', d).innerHTML = `✓ נמצאו ${ok} מתוך ${got.length} — לבדוק וללחוץ 💾 שמירה.${miss.length ? `<details><summary>לא נמצאו באתר (${miss.length})</summary><div class="small">${miss.map(h).join('<br>')}</div></details>` : ''}`;
      } catch (err) { X.toast('לא הצלחתי לקרוא את הקובץ.', 'err'); }
    };
    inp.click();
  };
  const grouped = () => { const by = Object.fromEntries(GROUPS.map(([k]) => [k, []])); list.forEach((x) => { const g = val(x, 'kv_group'); if (by[g]) by[g].push(full(x)); }); return by; };
  X.$('#kv-docx', d).onclick = async () => {
    if (!(await save(true))) return;
    try { await kvitelDocx(X, grouped()); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
  X.$('#kv-print', d).onclick = async () => {
    if (!(await save(true))) return;
    const by = grouped();
    const w = window.open('', '_blank'); if (!w) { X.toast('הדפדפן חסם חלון חדש.', 'err'); return; }
    w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>קוויטל — ${h(X.st.mosad?.name || '')}</title>
      <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&display=swap" rel="stylesheet">
      <style>@page{size:A4;margin:14mm}body{font:15px/1.55 'Frank Ruhl Libre',David,serif;margin:0;color:#111}h1{text-align:center;font-size:22px;margin:0 0 2px}.sub{text-align:center;font-size:12px;color:#555;margin-bottom:10px}
      h2{font-size:17px;margin:14px 0 4px;border-bottom:1.5px solid #333;padding-bottom:2px}.cols{columns:2;column-gap:28px}.cols div{break-inside:avoid}
      @media screen{body{max-width:190mm;margin:20px auto}}</style></head><body>
      <div style="text-align:right;font-size:12px">בס"ד</div><h1>${h(X.st.mosad?.name || '')}</h1><div class="sub">${h(isoToHebrewText(todayIso()))}</div>
      ${GROUPS.filter(([k]) => by[k].length).map(([k, t]) => `<h2>${h(t)}</h2><div class="${by[k].length > 14 ? 'cols' : ''}">${by[k].map((x) => `<div>${h(x)}</div>`).join('')}</div>`).join('')}
      <script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  };
}

// ---------- 🏷 מדבקות על דף A4 רגיל ----------
export function labelsDialog(X, active, enrollOf = () => ({})) {
  const { h } = X;
  const d = X.dialog(`<h2>🏷 מדבקות — דף A4 רגיל</h2>
    <p class="muted small">מדפיסים על דף A4 רגיל (עם קווי חיתוך), או על דף מדבקות A4 באותה חלוקה.</p>
    <div class="rf-grid">
      <label class="rf-f">מי<select id="lb-who"><option value="student">תלמידים פעילים</option><option value="staff">אנשי צוות</option><option value="both">כולם</option></select></label>
      <label class="rf-f">חלוקה בדף<select id="lb-grid"><option value="3x8">3 × 8 = 24 (70×37 מ"מ)</option><option value="3x7">3 × 7 = 21 (70×42 מ"מ)</option><option value="2x7">2 × 7 = 14 (105×42 מ"מ)</option><option value="2x5">2 × 5 = 10 (105×59 מ"מ)</option><option value="4x10">4 × 10 = 40 (52×30 מ"מ)</option></select></label>
      <label class="rf-f">כמה מכל שם<input type="number" id="lb-n" min="1" max="40" value="1"></label>
    </div>
    <label class="check"><input type="checkbox" id="lb-room" checked> גם חדר / שיעור (אם יש)</label>
    <label class="check"><input type="checkbox" id="lb-name" checked> גם שם הישיבה בקטן</label>
    <div class="actions"><button type="button" class="btn primary" id="lb-go">🖨 הדפסה</button><button type="button" class="btn" data-x>ביטול</button></div>`);
  X.$('#lb-go', d).onclick = () => {
    const who = X.$('#lb-who', d).value; const [c, r] = X.$('#lb-grid', d).value.split('x').map(Number); const n = Math.max(1, Number(X.$('#lb-n', d).value) || 1);
    const staff = X.st.people.filter((p) => (p.kinds || [p.kind]).includes('staff')).map((p) => String(p.contact_id));
    const ids = [...new Set([...(who !== 'staff' ? active.map(String) : []), ...(who !== 'student' ? staff : [])])].map((id) => X.pById(id)).filter(Boolean)
      .sort((a, b) => String(a.last_name_he).localeCompare(String(b.last_name_he), 'he') || String(a.first_name_he).localeCompare(String(b.first_name_he), 'he'));
    if (!ids.length) { X.toast('אין שמות.', 'err'); return; }
    const sub = (p) => { if (!X.$('#lb-room', d).checked) return ''; const e = enrollOf(p.contact_id) || {}; return [e.room && `חדר ${e.room}`, e.shiur].filter(Boolean).join(' · '); };
    const org = X.$('#lb-name', d).checked ? X.st.mosad?.name || '' : '';
    const cells = ids.flatMap((p) => Array(n).fill(p)).map((p) => `<div class="l"><b>${h([p.first_name_he, p.last_name_he].filter(Boolean).join(' ') || X.nameOf(p))}</b>${sub(p) ? `<span>${h(sub(p))}</span>` : ''}${org ? `<i>${h(org)}</i>` : ''}</div>`);
    const per = c * r; const pages = [];
    for (let i = 0; i < cells.length; i += per) pages.push(cells.slice(i, i + per).join(''));
    const w = window.open('', '_blank'); if (!w) { X.toast('הדפדפן חסם חלון חדש.', 'err'); return; }
    w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>מדבקות</title>
      <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap" rel="stylesheet">
      <style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Heebo,Arial,sans-serif}
      .pg{width:210mm;height:297mm;padding:8mm 0;display:grid;grid-template-columns:repeat(${c},1fr);grid-template-rows:repeat(${r},1fr);page-break-after:always}
      .l{border:1px dashed #bbb;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2mm;overflow:hidden}
      .l b{font-size:${c >= 4 ? 12 : c === 3 ? 15 : 19}pt;line-height:1.2}.l span{font-size:${c >= 4 ? 8 : 10}pt;margin-top:1mm}.l i{font-size:${c >= 4 ? 6.5 : 8}pt;color:#666;font-style:normal;margin-top:1mm}
      @media screen{body{background:#ddd}.pg{background:#fff;margin:10px auto;box-shadow:0 0 6px #999}}</style></head><body>
      ${pages.map((p) => `<div class="pg">${p}</div>`).join('')}<script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close(); d.close();
  };
}
