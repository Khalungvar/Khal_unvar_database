// הילף: דער פירער (help/guide.md) מיט זוכן. שפעטער — א AI וואס ענטפערט לויט דעם זעלבן פירער.
import { CONFIG } from './config.js';
import { t, getLang } from './i18n.js';
import { escapeHtml as h } from './util.js';
import { state } from './data.js';

const $ = (sel, root = document) => root.querySelector(sel);
// דער פירער אויף אידיש (guide.md) און ענגליש (guide.en.md)
const cache = {};
let sections = null; // [{ title, keys, body, text }]
let guideLang = '';

async function load(lang) {
  guideLang = lang;
  if (cache[lang]) { sections = cache[lang]; return sections; }
  const res = await fetch(`help/guide${lang === 'en' ? '.en' : ''}.md?v=${Date.now() >> 22}`);
  const guideText = await res.text();
  sections = cache[lang] = guideText.replace(/<!--[\s\S]*?-->/g, '').split(/^## /m).slice(1).map((chunk) => {
    const [title, ...rest] = chunk.split('\n');
    let keys = '';
    const lines = rest.filter((l) => {
      const m = /^(?:שליסלווערטער|Keywords):\s*(.*)$/.exec(l.trim());
      if (m) { keys = m[1]; return false; }
      return true;
    });
    const body = lines.join('\n').trim();
    return { title: title.trim(), keys, body, text: norm(`${title} ${keys} ${body}`) };
  });
  return sections;
}

/** פאר זוכן: אן ניקוד/גרשיים, קליינע אותיות, סופיות = נארמאל */
function norm(s) {
  return String(s).toLowerCase().replace(/[֑-ׇ"'״׳*]/g, '')
    .replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ');
}

function search(q) {
  const words = norm(q).split(/[\s,.?!]+/).filter((w) => w.length > 1);
  if (!words.length) return sections.map((s) => ({ s, score: 0 }));
  return sections.map((s) => {
    const title = norm(s.title); const keys = norm(s.keys);
    let score = 0;
    words.forEach((w) => {
      if (title.includes(w)) score += 5;
      if (keys.includes(w)) score += 3;
      if (s.text.includes(w)) score += 1;
    });
    return { s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

/** א ביסל markdown: רשימות, נומערן, **דיק** */
function md(body) {
  const inline = (x) => h(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const out = []; let list = '';
  const close = () => { if (list) { out.push(`</${list}>`); list = ''; } };
  body.split('\n').forEach((line) => {
    const l = line.trim();
    let m;
    if ((m = /^- (.*)$/.exec(l))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = /^\d+\. (.*)$/.exec(l))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (l) { close(); out.push(`<p>${inline(l)}</p>`); }
  });
  close();
  return out.join('');
}

function listHtml(q) {
  const res = search(q);
  if (!res.length) return `<p class="empty">${h(t('helpNothing'))}</p>`;
  const open = q.trim() ? 2 : 0; // ביים זוכן — די ערשטע 2 אפן
  return res.map(({ s }, i) => `<details class="hp-sec"${i < open ? ' open' : ''}><summary>${h(s.title)}</summary><div class="hp-body" dir="rtl">${md(s.body)}</div></details>`).join('');
}

export async function openHelp(q = '') {
  let dlg = $('#help-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'help-dialog';
    dlg.className = 'sheet wide';
    document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  dlg.innerHTML = `<button type="button" class="x-close" aria-label="${h(t('close'))}">✕</button>
    <div class="hp-head"><h2>❓ ${h(t('helpTitle'))}</h2><span class="spacer"></span>
      <div class="lang-switch hp-lang"><button type="button" data-hl="yi">אידיש</button><button type="button" data-hl="en">English</button></div></div>
    ${CONFIG.HELP_AI_URL ? `<form class="hp-ask" id="hp-ask"><input id="hp-q" dir="auto" placeholder="${h(t('helpAskPh'))}" autocomplete="off">
      <button class="btn primary" type="submit">${h(t('helpAsk'))}</button></form><div id="hp-answer" class="hp-answer" hidden></div>`
      : `<input id="hp-q" class="hp-search" dir="auto" type="search" placeholder="${h(t('helpSearchPh'))}" autocomplete="off">`}
    <div id="hp-list" class="hp-list"><p class="muted">…</p></div>`;
  $('.x-close', dlg).onclick = () => dlg.close();
  if (!dlg.open) dlg.showModal();
  const input = $('#hp-q', dlg);
  input.value = q;
  const render = () => { $('#hp-list', dlg).innerHTML = listHtml(input.value); };
  const show = async (lang) => {
    dlg.querySelectorAll('[data-hl]').forEach((b) => b.classList.toggle('on', b.dataset.hl === lang));
    try { await load(lang); render(); } catch { $('#hp-list', dlg).innerHTML = `<p class="empty">${h(t('helpLoadFail'))}</p>`; }
  };
  dlg.querySelectorAll('[data-hl]').forEach((b) => { b.onclick = () => show(b.dataset.hl); });
  input.oninput = render;
  await show(guideLang || (getLang() === 'en' ? 'en' : 'yi'));
  input.focus();
  const form = $('#hp-ask', dlg);
  if (form) form.onsubmit = (e) => { e.preventDefault(); ask(input.value, dlg); };
}

/** א שאלה צום AI (דורכן "סערווער" — Apps Script). ער באקומט דעם פירער און ענטפערט נאר לויט אים. */
async function ask(question, dlg) {
  const box = $('#hp-answer', dlg);
  if (!question.trim()) return;
  box.hidden = false;
  box.innerHTML = `<p class="muted">⏳ ${h(t('helpThinking'))}</p>`;
  try {
    const res = await fetch(CONFIG.HELP_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // אן "preflight" — Apps Script האט דאס ליב
      body: JSON.stringify({ question: question.trim(), lang: guideLang, user: state.email || '' }),
    });
    const data = await res.json();
    if (!data.answer) throw new Error(data.error || 'no answer');
    box.innerHTML = `<div class="hp-ai" dir="auto">${md(data.answer)}</div><p class="muted small">${h(t('helpAiNote'))}</p>`;
  } catch (err) {
    box.innerHTML = `<p class="warn-text">${h(t('helpAiFail'))}</p>`;
  }
}
