// 🎉 עדכון שמחות: שמחה של בחור / איש צוות → (1) נכנסת לרשימת השמחות של אונגוואר (מערכת האם, לשונית Simchos)
// (2) דף "מזל טוב" מעוצב על הבלאנק של המוסד — מוכן להדפסה / PDF.
import { letterhead } from './brand.js?v=686';
import { todayIso, isoToHebrewText } from '../hebdate.js?v=653';
import { shabbatTitle } from '../parasha.js?v=653';

let X = null;
export function initSimcha(ctx) { X = ctx; }
const TYPES = [
  ['birth_m', 'הולדת בן', 'birth', 'm'], ['birth_f', 'הולדת בת', 'birth', 'f'], ['upsherin', 'אפשערן', 'upsherin', 'm'],
  ['barmitzvah', 'בר מצוה', 'barmitzvah', 'm'], ['erusin', 'אירוסין', 'erusin', 'm'], ['nisuin', 'נישואין', 'nisuin', 'm'],
];
const add = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const satOf = (iso) => add(iso, (6 - new Date(`${iso}T12:00:00Z`).getUTCDay() + 7) % 7);
const hasKind = (p, k) => (p?.kinds || [p?.kind]).includes(k);
// 🏛 לאן נכנסת השמחה ברשימה של אונגוואר: תחת "ישיבת בית שערים", או תחת "ק"ק אונגוואר ירושלים" (ביהמ"ד מוסיאוף — לא קשור לישיבה)
const BRANCH = [['yeshiva', 'ישיבת בית שערים'], ['jlm', 'ק"ק אונגוואר ירושלים (ביהמ"ד מוסיאוף)']];
let BR = 'yeshiva';

/** הנוסח של דף המזל טוב */
function textOf(type, p, child, other) {
  const { nameOf, fatherOf } = X;
  if (!p.contact_id) p = { ...p, kinds: ['other'] };
  const nm = p.contact_id ? nameOf(p) : p.name;
  const stud = hasKind(p, 'student');
  const f = stud ? fatherOf(p) : null;
  const to = stud ? `לידידנו הבה"ח החשוב ${nm} נ"י${f ? `\nולהוריו הנכבדים ${nameOf(f)} שליט"א` : ''}` : `לידידנו ${nm} שליט"א`;
  const why = {
    birth_m: `לרגל הולדת הבן${child ? ` ${child}` : ''} למזל טוב`, birth_f: `לרגל הולדת הבת${child ? ` ${child}` : ''} למזל טוב`,
    upsherin: `לרגל שמחת האפשערן של בנו${child ? ` ${child}` : ''}`, barmitzvah: `לרגל הכנסת בנו${child ? ` ${child}` : ''} לעול התורה והמצוות`,
    erusin: stud ? `לרגל אירוסיו בשעטו"מ${other ? ` עם ${other}` : ''}` : `לרגל אירוסי ${child ? `בנו/בתו ${child}` : 'צאצאיו'}${other ? ` עם ${other}` : ''}`,
    nisuin: stud ? `לרגל נישואיו בשעטו"מ${other ? ` עם ${other}` : ''}` : `לרגל נישואי ${child ? `בנו/בתו ${child}` : 'צאצאיו'}${other ? ` עם ${other}` : ''}`,
  }[type] || '';
  return `${to}\n${why}\n\nיה"ר שתזכו לרוב נחת דקדושה ולשמחות רבות, ותזכו לראות דורות ישרים ומבורכים עוסקים בתורה ובמצוות, מתוך הרחבת הדעת ובריות גופא ונהורא מעליא, אכי"ר`;
}

export function renderSimcha(box) {
  const { h, st } = X;
  const people = st.people.filter((p) => BR === 'jlm' || ['student', 'staff', 'avreich'].some((k) => hasKind(p, k)))
    .sort((a, b) => X.S(a.last_name_he).localeCompare(X.S(b.last_name_he), 'he') || X.S(a.first_name_he).localeCompare(X.S(b.first_name_he), 'he'));
  const label = (p) => `${X.nameOf(p)} (#${p.contact_id})`;
  box.innerHTML = `<h2 class="ms-h">🎉 עדכון שמחות</h2>
    <p class="muted small">בלחיצה אחת: השמחה נכנסת לרשימת השמחות של אונגוואר (הגבאים שם רואים אותה ומשבצים לגליון ולמסך), ונפתח דף "מזל טוב" מעוצב — להדפסה או לשמירה כ-PDF.</p>
    <nav class="ms-subtabs">${BRANCH.map(([k, l]) => `<button type="button" data-br="${k}" class="${k === BR ? 'on' : ''}">🏛 ${h(l)}</button>`).join('')}</nav>
    <p class="muted small">${BR === 'jlm' ? 'שמחה בק"ק אונגוואר ירושלים — נכנסת לרשימה של אונגוואר תחת "ק"ק אונגוואר ירושלים". אפשר לבחור מהרשימה, או להקליד שם מלא של מי שלא ברשימה.' : 'שמחה של בחור / איש צוות / אברך — נכנסת לרשימה של אונגוואר תחת "ישיבת בית שערים".'}</p>
    <form class="ms-form" id="sm-form" autocomplete="off"><div class="grid">
      <label>סוג השמחה<select name="type">${TYPES.map(([k, l]) => `<option value="${k}">${h(l)}</option>`).join('')}</select></label>
      <label class="wide">בעל השמחה ${BR === 'jlm' ? '(מהרשימה, או שם מלא עם תואר)' : '(בחור / איש צוות / אברך)'}<input name="who" list="sm-dl" placeholder="מקלידים שם…" required></label>
      <datalist id="sm-dl">${people.map((p) => `<option value="${h(label(p))}">`).join('')}</datalist>
      <label>שם הילד / החתן (לא חובה)<input name="child" placeholder="למשל: יעקב"></label>
      <label>הצד השני (באירוסין / נישואין)<input name="other" placeholder="למשל: בת הרה&quot;ח ר' … שליט&quot;א"></label>
      <label>שבת (לגליון באונגוואר)<input type="date" name="week" value="${h(satOf(todayIso()))}"></label>
    </div>
    <p class="muted small" id="sm-who"></p>
    <label>הנוסח בדף המזל טוב<textarea name="text" rows="7" dir="rtl"></textarea></label>
    <div class="actions"><button type="button" class="btn" id="sm-auto">↻ נוסח אוטומטי</button><span class="spacer"></span>
      <button type="button" class="btn" id="sm-page">🖨 רק דף מזל טוב</button>
      <button type="submit" class="btn primary">🎉 עדכון באונגוואר + דף מזל טוב</button></div></form>`;
  X.$$('[data-br]', box).forEach((b) => { b.onclick = () => { BR = b.dataset.br; renderSimcha(box); }; });
  const form = X.$('#sm-form', box);
  // בירושלים: גם שם חופשי (מי שלא ברשימה) — { name }
  const person = () => { const v = X.S(form.elements.who.value); const m = v.match(/\(#(\d+)\)$/); return m ? X.pById(m[1]) : (BR === 'jlm' && v.length > 2 ? { name: v } : null); };
  const auto = () => { const p = person(); if (!p) return; form.elements.text.value = textOf(form.elements.type.value, p, X.S(form.elements.child.value), X.S(form.elements.other.value)); };
  const info = () => {
    const p = person(); const el = X.$('#sm-who', box);
    if (!p) { el.textContent = ''; return; }
    if (!p.contact_id) { el.textContent = `באונגוואר: בעל השמחה — "${p.name}" (שם חופשי, בלי כרטיס).`; return; }
    const f = hasKind(p, 'student') ? X.fatherOf(p) : null;
    el.textContent = hasKind(p, 'student') ? (f ? `באונגוואר: בעל השמחה — האבא, ${X.nameOf(f)}, והבחור ${X.nameOf(p)} כ"ילד".` : '⚠ לא רשום אבא לבחור — באונגוואר יירשם הבחור עצמו. (אפשר להוסיף את האבא בכרטיס שלו)') : `באונגוואר: בעל השמחה — ${X.nameOf(p)}.`;
  };
  ['who', 'type', 'child', 'other'].forEach((n) => { form.elements[n].addEventListener('change', () => { info(); auto(); }); });
  X.$('#sm-auto', box).onclick = auto;
  X.$('#sm-page', box).onclick = () => { const p = person(); if (!p) { X.toast('בחר את בעל השמחה מהרשימה.', 'err'); return; } mazelTov(form.elements.text.value || textOf(form.elements.type.value, p, '', '')); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const p = person(); if (!p) { X.toast('בחר את בעל השמחה מהרשימה.', 'err'); return; }
    if (!form.elements.text.value.trim()) auto();
    const T = TYPES.find(([k]) => k === form.elements.type.value);
    const stud = hasKind(p, 'student'); const f = stud ? X.fatherOf(p) : null;
    const hon = !p.contact_id ? [{ name: p.name, suffix: 'שליט"א' }] : f ? [{ id: f.contact_id, title: X.S(f.title_he), suffix: 'שליט"א', toChild: true }] : [{ id: p.contact_id, title: X.S(p.title_he), suffix: stud ? 'נ"י' : 'שליט"א' }];
    const req = { type: T[2], gender: T[3], honorees: hon, child_name: f ? X.S(p.first_name_he) || X.S(form.elements.child.value) : X.S(form.elements.child.value),
      child_id: f ? p.contact_id : '', other_side: X.S(form.elements.other.value), week: form.elements.week.value, branch: BR };
    const w = window.open('', '_blank'); // לפני ה-await — כדי שהדפדפן לא יחסום
    const btn = X.$('button[type=submit]', form); btn.disabled = true;
    try {
      const r = await X.call(X.KEY, 'simchaAdd', req);
      X.toast(`נוסף לרשימת השמחות באונגוואר תחת "${BRANCH.find(([k]) => k === BR)[1]}" (#${r.id}).`);
      mazelTov(form.elements.text.value, w);
    } catch (err) { if (w) w.close(); X.toast(X.msg(err), 'err'); } finally { btn.disabled = false; }
  };
}

/** 🖨 דף מזל טוב: הבלאנק של המוסד, "מזל טוב" גדול, הנוסח, ותאריך */
function mazelTov(text, w0) {
  const { h } = X;
  const w = w0 || window.open('', '_blank');
  if (!w) { X.toast('הדפדפן חסם חלון חדש — אפשר חלונות קופצים לאתר הזה.', 'err'); return; }
  const lh = letterhead(X.KEY);
  const lines = String(text || '').split('\n');
  const body = lines.map((l, i) => (l.trim() ? `<p class="${i === 0 ? 'to' : ''}">${h(l)}</p>` : '<p class="sp"></p>')).join('');
  w.document.open();
  w.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>מזל טוב</title>
    <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700;900&display=swap" rel="stylesheet">
    <style>@page { size: A4; margin: 0; } body { margin: 0; font-family: 'Frank Ruhl Libre', 'David', serif; color: #1d1a14; }
      .bar { padding: 8px; background: #f6f1e4; text-align: center; font: 14px Arial; } .bar button { font: inherit; padding: 5px 14px; margin: 0 4px; }
      .pg { width: 210mm; min-height: 297mm; margin: 0 auto; box-sizing: border-box; padding: 10mm 16mm 12mm; display: flex; flex-direction: column; }
      .top img, .bot img { width: 100%; display: block; } .bot { margin-top: auto; }
      .mt { text-align: center; font-size: 64pt; font-weight: 900; color: #7a1219; margin: 14mm 0 4mm; letter-spacing: 2px; }
      .orn { text-align: center; color: #b08d3c; font-size: 20pt; margin-bottom: 8mm; }
      .tx { text-align: center; font-size: 19pt; line-height: 1.55; padding: 0 8mm; } .tx p { margin: 0 0 2mm; } .tx .to { font-weight: 700; font-size: 21pt; } .tx .sp { height: 5mm; }
      .sig { text-align: center; margin-top: 12mm; font-size: 17pt; font-weight: 700; } .dt { text-align: center; color: #6b5a3a; font-size: 13pt; margin-top: 3mm; }
      @media print { .bar { display: none; } img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .mt { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 הדפסה / שמירה כ-PDF</button> <button onclick="window.close()">סגירה</button></div>
    <div class="pg">${lh ? `<div class="top"><img src="${lh.top}" alt=""></div>` : `<h2 style="text-align:center">${h(X.st.mosad?.name || '')}</h2>`}
      <div class="mt">מזל טוב</div><div class="orn">✦ ✦ ✦</div>
      <div class="tx">${body}</div>
      <div class="sig">${h(BR === 'jlm' ? 'גבאי ק"ק אונגוואר ירושלים' : X.KEY === 'yeshiva' ? 'הנהלת הישיבה' : `הנהלת ${X.st.mosad?.name || 'המוסד'}`)}</div>
      <div class="dt">${h(isoToHebrewText(todayIso()))} · ${h(shabbatTitle(satOf(todayIso()), true))}</div>
      ${lh ? `<div class="bot"><img src="${lh.bottom}" alt=""></div>` : ''}</div></body></html>`);
  w.document.close();
}
