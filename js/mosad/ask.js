// ❓ עוזר AI בכל דף: שאלה → השרת (ask) → Gemini, שעונה רק לפי המדריך (help/yeshiva.md). לא רואה ולא משנה נתונים.
let X = null; let box = null; const HIST = [];
const ERR = { 'ai-no-key': 'העוזר עוד לא הופעל (חסר מפתח בשרת).', 'ai-limit': 'הגעת למספר השאלות להיום. נסה מחר.', 'bad-action': 'השרת עוד לא עודכן.', 'ai-no-credit': 'נגמר הקרדיט של ה-AI. צריך לטעון (💳 קרדיט AI).' };
let CR = null; // מודול הקרדיט (רק כשצריך)
const md = (t) => X.h(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*] /gm, '• ').replace(/\n/g, '<br>');
export function initAsk(ctx) {
  X = ctx;
  if (document.getElementById('ms-ask')) return;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'ms-ask'; b.className = 'btn primary ms-ask-btn'; b.textContent = '❓ שאל'; b.title = 'עוזר: איך עושים דברים באתר';
  b.onclick = open; document.body.append(b);
}
function open() {
  if (box) { box.hidden = !box.hidden; if (!box.hidden) box.querySelector('textarea').focus(); return; }
  box = document.createElement('div'); box.className = 'ms-ask-box'; box.dir = 'rtl';
  box.innerHTML = `<div class="ms-ask-head"><b>❓ עוזר האתר</b><span class="muted small">שואלים איך עושים משהו — הוא עונה לפי המדריך</span><button type="button" class="linkish" data-close>✕</button></div><div class="ms-ask-cr"></div>
    <div class="ms-ask-log"><div class="ms-ask-m bot">שלום! אפשר לשאול איך עושים משהו באתר, לבקש פרטים על בחור ("מה הטלפון של ההורים של …?"), או לבקש להוסיף / לעדכן ("תוסיף בחור חדש …") — שינויים נשמרים רק אחרי ✓ שלך.</div></div>
    <form class="ms-ask-f"><textarea rows="2" placeholder="השאלה…"></textarea><button type="submit" class="btn primary">שלח</button></form>`;
  document.body.append(box);
  const showCr = async () => { try { CR ||= await import('./aicredit.js?v=674'); CR.initAiCredit(X); const el = box.querySelector('.ms-ask-cr'); el.innerHTML = await CR.chipHtml(); CR.wireChip(el); } catch { /* */ } };
  showCr();
  const log = box.querySelector('.ms-ask-log'); const ta = box.querySelector('textarea'); const f = box.querySelector('form');
  box.querySelector('[data-close]').onclick = () => { box.hidden = true; };
  const add = (cls, html) => { const d = document.createElement('div'); d.className = `ms-ask-m ${cls}`; d.innerHTML = html; log.append(d); log.scrollTop = log.scrollHeight; return d; };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const q = ta.value.trim(); if (!q || f.dataset.busy) return;
    add('me', X.h(q)); ta.value = ''; f.dataset.busy = '1';
    const w = add('bot muted', '⏳ חושב…');
    const page = document.querySelector('.ms-h')?.textContent?.trim() || X.st.tab || '';
    try {
      const r = await X.call(X.KEY, 'ask', { question: q, page, history: HIST.slice(-6) });
      w.remove(); HIST.push({ role: 'user', text: q });
      if (r.answer) { add('bot', md(r.answer)); HIST.push({ role: 'model', text: r.answer }); }
      (r.actions || []).forEach((a) => actionCard(a, add));
      if (r.credit && CR) { CR.setBalance(r.credit.balance); showCr(); }
    } catch (err) {
      w.remove(); const el = add('bot warn', X.h(ERR[err?.message] || X.msg(err)));
      if (err?.message === 'ai-no-credit') { el.insertAdjacentHTML('beforeend', ' <button type="button" class="btn small-btn" data-buy>💳 טעינה</button>'); el.querySelector('[data-buy]').onclick = async () => { CR ||= await import('./aicredit.js?v=674'); CR.initAiCredit(X); CR.creditDialog(); }; }
    } finally { delete f.dataset.busy; }
  };
  ta.focus();
}

const KIND_HE = { student: 'תלמיד', parent: 'הורה', staff: 'צוות', avreich: 'אברך', other: 'אחר' };
/** הצעה של העוזר → כרטיס עם ✓ לאשר / ✕ — רק אז נשמר */
function actionCard(a, add) {
  const { h } = X; const d = a.data || {};
  const html = a.type === 'add'
    ? `➕ <b>להוסיף ${h(KIND_HE[d.kind] || '')}:</b> ${h(`${d.first_name_he} ${d.last_name_he}`)}${d.father ? ` · בן של ${h(X.nameOf(X.pById(d.father)) || `#${d.father}`)}` : ''}${d.mobile ? ` · נייד ${h(d.mobile)}` : ''}${d.il_phone ? ` · בארץ ${h(d.il_phone)}` : ''}${d.abroad_phone ? ` · בחו"ל ${h(d.abroad_phone)}` : ''}`
    : `📞 <b>${h(d.name)}</b> — ${d.field === 'abroad_phone' ? 'טלפון בחו"ל' : 'טלפון בארץ'}: ${d.old ? `${h(d.old)} ← ` : ''}<b dir="ltr">${h(d.value)}</b>`;
  const el = add('bot act', `${html}<div class="actions"><button type="button" class="btn small-btn primary" data-ok>✓ לאשר</button><button type="button" class="btn small-btn" data-no>✕ ביטול</button></div>`);
  el.querySelector('[data-no]').onclick = () => { el.querySelector('.actions').innerHTML = '<span class="muted small">בוטל.</span>'; };
  el.querySelector('[data-ok]').onclick = async (e) => {
    e.target.disabled = true;
    try {
      if (a.type === 'add') {
        const r = await X.call(X.KEY, 'save', { contact_id: '', contact: { first_name_he: d.first_name_he, last_name_he: d.last_name_he }, phones: { mobile: d.mobile || '' }, kind: d.kind || 'student', rel: d.father ? { type: 'זון פון', to: d.father } : null });
        if (d.il_phone || d.abroad_phone) await X.call(X.KEY, 'ilPhone', { contact_id: r.contact_id, ...(d.il_phone ? { il_phone: d.il_phone } : {}), ...(d.abroad_phone ? { abroad_phone: d.abroad_phone } : {}) });
      } else {
        await X.call(X.KEY, 'ilPhone', { contact_id: d.contact_id, [d.field]: d.value });
        const p = X.pById(d.contact_id); if (p) p[d.field] = d.value;
      }
      el.querySelector('.actions').innerHTML = '<span class="small">✓ נשמר.</span>';
      try { await X.loadPeople(); X.render(); } catch { /* */ }
    } catch (err) { e.target.disabled = false; X.toast(X.msg(err), 'err'); }
  };
}
