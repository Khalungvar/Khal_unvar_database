// הילף: דער פירער (help/guide.md) מיט זוכן. שפעטער — א AI וואס ענטפערט לויט דעם זעלבן פירער.
import { CONFIG } from './config.js';
import { t, getLang } from './i18n.js';
import { escapeHtml as h } from './util.js';
import { currentToken } from './google.js';

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
  const inline = (x) => h(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
  const out = []; let list = '';
  const close = () => { if (list) { out.push(`</${list}>`); list = ''; } };
  body.split('\n').forEach((line) => {
    const l = line.trim();
    let m;
    if ((m = /^[-*] (.*)$/.exec(l))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
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
    <input id="hp-q" class="hp-search" dir="auto" type="search" placeholder="${h(t('helpSearchPh'))}" autocomplete="off">
    ${CONFIG.HELP_AI_URL ? `<p class="hp-ai-link"><button type="button" class="linkish" id="hp-open-ai">💬 ${h(t('aiOpenFromHelp'))}</button></p>` : ''}
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
  const toAi = $('#hp-open-ai', dlg);
  if (toAi) toAi.onclick = () => { dlg.close(); openChat(); };
}

// ---------- דער AI: א שמועס-פענצטערל אונטן לינקס ----------
const AI_DAILY = 40;
const todayKey = () => `khal-ai-${new Date().toISOString().slice(0, 10)}`;
function usedToday() { try { return Number(localStorage.getItem(todayKey()) || 0); } catch { return 0; } }
function countOne() { try { localStorage.setItem(todayKey(), String(usedToday() + 1)); } catch { /* ignore */ } }

let chat = null;

/** שטעלט אריין דאס פענצטערל (נאר נאכן אריינגיין, און נאר ווען דער AI איז פארבונדן). */
export function initHelpChat() {
  if (!CONFIG.HELP_AI_URL || chat) return;
  const root = document.createElement('div');
  root.id = 'ai-chat';
  root.className = 'ai-chat';
  root.innerHTML = `<section class="ai-panel" hidden>
      <header class="ai-head"><b>💬 ${h(t('aiTitle'))}</b><span class="ai-left muted small"></span><span class="spacer"></span>
        <button type="button" class="ai-x" aria-label="${h(t('close'))}">✕</button></header>
      <div class="ai-log" aria-live="polite"></div>
    </section>
    <form class="ai-bar"><input class="ai-input" dir="auto" autocomplete="off" placeholder="${h(t('aiPh'))}">
      <button type="submit" class="ai-send" aria-label="${h(t('helpAsk'))}"><span class="ai-ico-closed">💬</span><span class="ai-ico-open">➤</span></button></form>`;
  ($('#app-view') || document.body).append(root);
  chat = { root, panel: $('.ai-panel', root), log: $('.ai-log', root), input: $('.ai-input', root), busy: false };
  chat.log.innerHTML = `<div class="ai-msg bot ai-welcome" dir="auto">${md(t('aiWelcome', { n: AI_DAILY }))}</div>`;
  const openIt = () => openChat();
  chat.input.addEventListener('focus', openIt);
  chat.input.addEventListener('input', openIt);
  $('.ai-x', root).onclick = () => { chat.panel.hidden = true; root.classList.remove('open'); };
  $('.ai-bar', root).onsubmit = (e) => { e.preventDefault(); askChat(); };
  updateLeft();
}

export function openChat() {
  if (!chat) return;
  chat.panel.hidden = false;
  chat.root.classList.add('open');
  updateLeft();
  chat.input.focus();
  chat.log.scrollTop = chat.log.scrollHeight;
}

function updateLeft() {
  if (!chat) return;
  const left = Math.max(0, AI_DAILY - usedToday());
  $('.ai-left', chat.root).textContent = t('aiLeft', { n: left });
}

function addMsg(cls, html) {
  const d = document.createElement('div');
  d.className = `ai-msg ${cls}`;
  d.dir = 'auto';
  d.innerHTML = html;
  chat.log.append(d);
  chat.log.scrollTop = chat.log.scrollHeight;
  return d;
}

/** א שאלה צום AI (דורכן "סערווער" — Apps Script). ער באקומט דעם פירער און ענטפערט נאר לויט אים. */
async function askChat() {
  const q = chat.input.value.trim();
  if (!q) { openChat(); return; } // אויפן טעלעפאן: דער קליינער 💬 קנעפל עפנט דאס פענצטערל
  if (chat.busy) return;
  openChat();
  addMsg('me', h(q));
  chat.input.value = '';
  if (usedToday() >= AI_DAILY) { addMsg('bot warn', h(t('helpAiLimit'))); return; }
  chat.busy = true;
  const wait = addMsg('bot muted', `⏳ ${h(t('helpThinking'))}`);
  try {
    const res = await fetch(CONFIG.HELP_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // אן "preflight" — Apps Script האט דאס ליב
      body: JSON.stringify({ question: q, lang: /[a-z]/i.test(q) && !/[֐-׿]/.test(q) ? 'en' : 'yi', token: currentToken() }),
    });
    const data = await res.json();
    wait.remove();
    if (data.error === 'daily-limit') { addMsg('bot warn', h(t('helpAiLimit'))); return; }
    if (!data.answer) throw new Error(`${data.error || 'no answer'}${data.detail ? ` · ${data.detail}` : ''}`);
    countOne();
    addMsg('bot', md(data.answer));
  } catch (err) {
    wait.remove();
    // דער פעלער-קאוד קליין — כדי מ'זאל קענען זען וואס איז נישט געלונגען
    addMsg('bot warn', `${h(t('helpAiFail'))}<br><small dir="ltr">${h(String(err.message || err).slice(0, 200))}</small>`);
  } finally {
    chat.busy = false;
    updateLeft();
  }
}
