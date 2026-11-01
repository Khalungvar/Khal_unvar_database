// ❓ עוזר AI בכל דף: שאלה → השרת (ask) → Gemini, שעונה רק לפי המדריך (help/yeshiva.md). לא רואה ולא משנה נתונים.
let X = null; let box = null;
const ERR = { 'ai-no-key': 'העוזר עוד לא הופעל (חסר מפתח בשרת).', 'ai-limit': 'הגעת למספר השאלות להיום. נסה מחר.', 'bad-action': 'השרת עוד לא עודכן.' };
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
  box.innerHTML = `<div class="ms-ask-head"><b>❓ עוזר האתר</b><span class="muted small">שואלים איך עושים משהו — הוא עונה לפי המדריך</span><button type="button" class="linkish" data-close>✕</button></div>
    <div class="ms-ask-log"><div class="ms-ask-m bot">שלום! על מה תרצה לשאול? למשל: "איך מדפיסים יומן טלפונים רק למי שאין לו טלפון?"</div></div>
    <form class="ms-ask-f"><textarea rows="2" placeholder="השאלה…"></textarea><button type="submit" class="btn primary">שלח</button></form>`;
  document.body.append(box);
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
    try { const r = await X.call(X.KEY, 'ask', { question: q, page }); w.remove(); add('bot', md(r.answer)); } catch (err) { w.remove(); add('bot warn', X.h(ERR[err?.message] || X.msg(err))); } finally { delete f.dataset.busy; }
  };
  ta.focus();
}
