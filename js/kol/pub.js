// 🌐 ungvar.org/kolungvar — הדף הציבורי של קול אונגוואר:
//   · ארכיון "מהנעשה והנשמע" לפי שנים ופרשיות (רק רכיבים שסומנו ✓ לארכיון)
//   · ?v=<drive id>&t=כותרת — נגן וידאו (מהמייל)
//   · ?u=<email>&k=<חתימה> — הסרה מרשימת התפוצה
//   · ?e=<מזהה> — מייל אחד (לפי יום הפרסום; ?w=<שבת> — קישורים ישנים)
import { CONFIG } from '../config.js?v=699';
import { shabbatTitle } from '../parasha.js?v=699';
import { toHebrew, yearLabel, isoToHebrewText } from '../hebdate.js?v=699';
import { emailHtml, weekOf, dateOf, dayText } from './render.js?v=699';

const main = document.getElementById('kp-main');
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.search);
const post = async (body) => (await fetch(CONFIG.KOL_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })).json();

function video() {
  const id = q.get('v').replace(/[^\w-]/g, ''); const t = q.get('t') || 'וידאו';
  document.title = `${t} – קול אונגוואר`;
  main.innerHTML = `<h1 class="kp-h1">${h(t)}</h1><div class="kp-video"><iframe src="https://drive.google.com/file/d/${h(id)}/preview" allow="autoplay; fullscreen" allowfullscreen title="${h(t)}"></iframe></div>
    <p class="kp-muted">אם הסרטון לא נפתח — ייתכן שהפילטר שלכם חוסם. אפשר לבקש מחברת הפילטר לפתוח את ungvar.org.</p><p><a href="./">← לכל המיילים</a></p>`;
}

async function unsub() {
  const u = q.get('u'); const k = q.get('k');
  main.innerHTML = `<div class="kp-box"><h1 class="kp-h1">הסרה מרשימת התפוצה</h1><p>להסיר את <b dir="ltr">${h(u)}</b> מרשימת המיילים של קול אונגוואר?</p>
    <button type="button" class="kp-btn" id="kp-go">כן, להסיר</button></div>`;
  document.getElementById('kp-go').onclick = async (ev) => {
    ev.target.disabled = true;
    try {
      const r = await post({ action: 'unsub', u, k });
      if (r.error) throw new Error(r.error === 'bad-link' ? 'הקישור לא תקין.' : r.error);
      main.innerHTML = `<div class="kp-box"><h1 class="kp-h1">✔ הוסר</h1><p><b dir="ltr">${h(r.email)}</b> לא יקבל יותר את המיילים.</p>
        <p class="kp-muted">בטעות? <button type="button" class="linkish" id="kp-re">להחזיר לרשימה</button></p></div>`;
      document.getElementById('kp-re').onclick = async () => { const x = await post({ action: 'resub', u, k }); main.innerHTML = `<div class="kp-box"><h1 class="kp-h1">${x.ok ? '✔ הוחזר לרשימה' : 'שגיאה'}</h1></div>`; };
    } catch (err) { ev.target.disabled = false; alert(err.message); }
  };
}

async function archive() {
  let data;
  try { data = await (await fetch(`${CONFIG.KOL_URL}?action=archive`)).json(); } catch { main.innerHTML = '<p class="kp-muted">לא הצלחתי לטעון. נסו שוב מאוחר יותר.</p>'; return; }
  // לפי יום הפרסום — החדש למעלה
  const list = (data.emails || []).filter((e) => e.sent_at).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)));
  if (!list.length) { main.innerHTML = '<p class="kp-muted">עוד אין מיילים בארכיון.</p>'; return; }
  const yearOf = (e) => { const x = toHebrew(weekOf(e)); return x ? x.y : 0; };
  const label = (e) => shabbatTitle(weekOf(e)).replace(/^פרשת /, '');
  const years = [...new Set(list.map(yearOf))].sort((a, b) => b - a);
  const want = q.get('e') || '';
  const wantW = q.get('w') || ''; // קישורים ישנים
  const show = (e, scroll = false) => {
    history.replaceState(null, '', `?e=${encodeURIComponent(e.id)}`);
    document.title = `${shabbatTitle(weekOf(e))} – קול אונגוואר`;
    const view = document.getElementById('kp-view');
    view.innerHTML = `<h2 class="kp-h2">${h(shabbatTitle(weekOf(e)))} <span class="kp-muted">${h(dayText(dateOf(e)))}</span></h2>${emailHtml({ ...e, kind: 'weekly' }, 'archive')}`;
    document.querySelectorAll('[data-e]').forEach((a) => a.classList.toggle('on', a.dataset.e === e.id));
    if (scroll) view.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const first = list.find((e) => e.id === want) || list.find((e) => wantW && weekOf(e) === wantW) || list[0];
  main.innerHTML = `<div class="kp-arch"><nav class="kp-nav">${years.map((y) => `<details${y === yearOf(first) ? ' open' : ''}><summary>שנת ${h(yearLabel(y))}</summary>
      ${list.filter((e) => yearOf(e) === y).map((e) => `<a href="?e=${h(e.id)}" data-e="${h(e.id)}">${h(label(e))} <span class="kp-muted">${h(isoToHebrewText(dateOf(e)))}</span></a>`).join('')}</details>`).join('')}</nav>
    <section id="kp-view"></section></div>`;
  document.querySelectorAll('[data-e]').forEach((a) => { a.onclick = (ev) => { ev.preventDefault(); show(list.find((e) => e.id === a.dataset.e), true); }; });
  show(first);
}

if (q.get('v')) video();
else if (q.get('u') && q.get('k')) unsub();
else archive();
