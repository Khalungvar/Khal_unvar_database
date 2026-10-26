// ❓ עזרה למסך הזה: א קנעפל אונטן רעכטס, וואס עפנט די הסברים פאר דעם מסך וואו מ'שטייט.
// טעקסט אין עברית / אידיש / ענגליש, 🔊 הקראה (עברית און ענגליש), און א מנהל קען טוישן יעדן טעקסט (לשונית HelpTexts).
import { HELP, helpForView } from './helptexts.js';
import { tIn, getLang } from './i18n.js';
import { escapeHtml as h, nowStamp } from './util.js';
import { readTabs, appendRow, updateRange } from './google.js';
import { state } from './data.js';
import { openHelp } from './help.js';
import { startTour, hasTour } from './tour.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// די ווערטער פונעם פענצטערל אליין
const UI = {
  he: { fab: 'עזרה למסך הזה', title: 'עזרה', other: 'נושאים אחרים', guide: '📖 המדריך המלא', listen: '🔊 הקראה', listenHe: '🔊 עברית', listenEn: '🔊 English', stop: '⏹ עצור', edit: '✏️ עריכה', save: 'שמירה', cancel: 'ביטול', reset: 'חזרה לטקסט המקורי', saved: 'נשמר ✓', titleL: 'כותרת', textL: 'טקסט', syntax: 'סימנים: "### " כותרת קטנה · "1. " שלב · "- " נקודה · **מודגש** · {{key}} שם של כפתור', noVoice: 'אין במחשב הזה קול לקריאה בעברית. אפשר להתקין קול עברי בהגדרות של Windows (שפה ← עברית ← דיבור), או ללחוץ 🔊 English.', noSpeech: 'הדפדפן הזה לא תומך בהקראה.', saveFail: 'השמירה נכשלה', edited: 'נערך', tour: '▶ סיור במסך', none: 'אין עדיין הסבר למסך הזה.' },
  yi: { fab: 'הילף פאר דעם מסך', title: 'הילף', other: 'אנדערע ענינים', guide: '📖 דער גאנצער פירער', listen: '🔊 הערן', listenHe: '🔊 עברית', listenEn: '🔊 English', stop: '⏹ אפשטעלן', edit: '✏️ טוישן', save: 'אפהיטן', cancel: 'בטל', reset: 'צוריק צום ערשטן טעקסט', saved: 'אפגעהיטן ✓', titleL: 'קעפל', textL: 'טעקסט', syntax: 'סימנים: "### " קליין קעפל · "1. " שריט · "- " פונקט · **פעט** · {{key}} נאמען פון א קנעפל', noVoice: 'אויף דעם קאמפיוטער איז נישטא קיין העברעאישע שטימע. מ\'קען איינשטעלן אין Windows (שפראך ← עברית ← רעדן), אדער דריקן 🔊 English.', noSpeech: 'דער בלעטערער קען נישט פארלייענען.', saveFail: 'נישט געלונגען אפצוהיטן', edited: 'געטוישט', tour: '▶ א טור אויפן מסך', none: 'נאך נישטא קיין הסבר פאר דעם מסך.' },
  en: { fab: 'Help for this screen', title: 'Help', other: 'Other topics', guide: '📖 Full guide', listen: '🔊 Listen', listenHe: '🔊 עברית', listenEn: '🔊 English', stop: '⏹ Stop', edit: '✏️ Edit', save: 'Save', cancel: 'Cancel', reset: 'Back to the original text', saved: 'Saved ✓', titleL: 'Title', textL: 'Text', syntax: 'Marks: "### " subhead · "1. " step · "- " point · **bold** · {{key}} a button name', noVoice: 'This computer has no English voice for reading aloud.', noSpeech: 'This browser can\'t read aloud.', saveFail: 'Saving failed', edited: 'edited', tour: '▶ Screen tour', none: 'No help for this screen yet.' },
};
const LANGS = ['he', 'yi', 'en'];
const LANG_NAME = { he: 'עברית', yi: 'אידיש', en: 'English' };

let view = 'lobby';
let textLang = '';
let overrides = null; // { 'id|lang': { title, text, row } }
let rowsCount = 1;
let fab = null;

const ui = () => UI[textLang] || UI.he;

// ---------- טעקסטן (מיט די ענדערונגען פונעם מנהל) ----------
async function loadOverrides() {
  if (overrides) return overrides;
  overrides = {};
  try {
    const rows = (await readTabs(['HelpTexts'])).HelpTexts || [];
    rowsCount = Math.max(1, rows.length);
    rows.slice(1).forEach((r, i) => {
      const [key, lang, title, text] = r;
      if (key && lang) overrides[`${key}|${lang}`] = { title: String(title || ''), text: String(text || ''), row: i + 2 };
    });
  } catch { /* די לשונית איז נישטא — די ערשטע טעקסטן */ }
  return overrides;
}

const ov = (id, lang) => overrides?.[`${id}|${lang}`];
const titleOf = (s, lang) => ov(s.id, lang)?.title || s.title[lang] || s.title.he;
const bodyOf = (s, lang) => ov(s.id, lang)?.text || s.body[lang] || s.body.he;
const isEdited = (s, lang) => !!(ov(s.id, lang)?.title || ov(s.id, lang)?.text);

/** {{key}} → דער נאמען פונעם קנעפל אויפן אתר, אן "({n})" און "{n}" */
function label(lang, key) {
  return tIn(lang, key).replace(/\s*\(\{?\w*\}?\)/g, '').replace(/\{\w+\}/g, '').replace(/\s{2,}/g, ' ').trim();
}
const fillTitle = (str, lang) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => label(lang, k));

function render(body, lang) {
  const inline = (x) => h(x)
    .replace(/\{\{(\w+)\}\}/g, (_, k) => `<b class="hv-key">${h(label(lang, k))}</b>`)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const out = []; let list = '';
  const close = () => { if (list) { out.push(`</${list}>`); list = ''; } };
  String(body).split('\n').forEach((line) => {
    const l = line.trim(); let m;
    if ((m = /^###\s+(.*)$/.exec(l))) { close(); out.push(`<h4>${inline(m[1])}</h4>`); }
    else if ((m = /^[-*] (.*)$/.exec(l))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = /^\d+\. (.*)$/.exec(l))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (l) { close(); out.push(`<p>${inline(l)}</p>`); }
  });
  close();
  return out.join('');
}

/** פלאכער טעקסט פארן פארלייענען */
function speechText(s, lang) {
  const body = bodyOf(s, lang)
    .replace(/\{\{(\w+)\}\}/g, (_, k) => label(lang, k))
    .replace(/\*\*/g, '').replace(/^###\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '').replace(/^[-*]\s+/gm, '')
    .replace(/[←→]/g, ', ').replace(/[·✓✕☑⚠🤖📷🧾✉🖨⬇⏰📱▶◀‹›…]/g, ' ');
  return `${fillTitle(titleOf(s, lang), lang)}.\n${body}`;
}

// ---------- 🔊 הקראה ----------
function voiceFor(lang) {
  const all = window.speechSynthesis?.getVoices() || [];
  const want = lang === 'he' ? /^(he|iw)/i : /^en/i;
  const list = all.filter((v) => want.test(v.lang));
  return list.find((v) => /natural|online|google/i.test(v.name)) || list[0] || null;
}
function voicesReady() {
  const ss = window.speechSynthesis;
  if (!ss) return Promise.resolve();
  if (ss.getVoices().length) return Promise.resolve();
  return new Promise((res) => { ss.onvoiceschanged = () => res(); setTimeout(res, 1500); });
}
async function speak(s, lang, btn) {
  const ss = window.speechSynthesis;
  if (!ss) { alert(ui().noSpeech); return; }
  ss.cancel();
  await voicesReady();
  const v = voiceFor(lang);
  if (!v) { alert(lang === 'he' ? UI[textLang === 'en' ? 'he' : textLang].noVoice : UI.en.noVoice); return; }
  // לאנגע טעקסטן — שטיקער לויט שורות (Chrome שטעלט זיך אפ ביי לאנגע זאצן)
  const parts = speechText(s, lang).split(/\n+/).map((x) => x.trim()).filter(Boolean);
  $$('.hv-speaking').forEach((b) => b.classList.remove('hv-speaking'));
  btn?.classList.add('hv-speaking');
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.voice = v; u.lang = v.lang; u.rate = 0.95;
    if (i === parts.length - 1) u.onend = () => btn?.classList.remove('hv-speaking');
    ss.speak(u);
  });
}
function stopSpeak() {
  window.speechSynthesis?.cancel();
  $$('.hv-speaking').forEach((b) => b.classList.remove('hv-speaking'));
}

// ---------- דאס פענצטערל ----------
function dialog() {
  let dlg = $('#hv-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'hv-dialog';
    dlg.className = 'sheet wide hv-dialog';
    document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', stopSpeak);
  }
  return dlg;
}

function listenBtns(s) {
  const u = ui();
  if (textLang === 'yi') {
    return `<button type="button" class="btn ghost small-btn" data-say="he" data-id="${s.id}">${u.listenHe}</button>
      <button type="button" class="btn ghost small-btn" data-say="en" data-id="${s.id}">${u.listenEn}</button>`;
  }
  return `<button type="button" class="btn ghost small-btn" data-say="${textLang}" data-id="${s.id}">${u.listen}</button>`;
}

function sectionHtml(s, open) {
  const u = ui();
  return `<details class="hv-sec" data-sec="${s.id}"${open ? ' open' : ''}>
    <summary>${h(fillTitle(titleOf(s, textLang), textLang))}${state.isAdmin && isEdited(s, textLang) ? ` <span class="hv-edited">${h(u.edited)}</span>` : ''}</summary>
    <div class="hv-tools">${listenBtns(s)}
      <button type="button" class="btn ghost small-btn" data-stop>${u.stop}</button>
      ${state.isAdmin ? `<span class="spacer"></span><button type="button" class="btn ghost small-btn" data-edit="${s.id}">${u.edit}</button>` : ''}</div>
    <div class="hv-body" dir="${textLang === 'en' ? 'ltr' : 'rtl'}">${render(bodyOf(s, textLang), textLang)}</div>
  </details>`;
}

let focusId = '';

function draw() {
  const dlg = dialog();
  const u = ui();
  const mine = helpForView(view);
  const main = focusId ? HELP.filter((s) => s.id === focusId) : mine;
  const others = HELP.filter((s) => !main.includes(s));
  dlg.dir = textLang === 'en' ? 'ltr' : 'rtl';
  dlg.innerHTML = `<button type="button" class="x-close" aria-label="✕">✕</button>
    <div class="hv-head"><h2>❓ ${h(u.title)}</h2><span class="spacer"></span>
      <div class="lang-switch">${LANGS.map((l) => `<button type="button" data-hvl="${l}" class="${l === textLang ? 'on' : ''}">${LANG_NAME[l]}</button>`).join('')}</div></div>
    <div class="hv-actions">${hasTour(view) && !focusId ? `<button type="button" class="btn small-btn" id="hv-tour">${u.tour}</button>` : ''}
      <button type="button" class="btn ghost small-btn" id="hv-guide">${u.guide}</button></div>
    <div class="hv-main">${main.length ? main.map((s, i) => sectionHtml(s, i === 0)).join('') : `<p class="muted">${h(u.none)}</p>`}</div>
    <details class="hv-others"><summary>${h(u.other)}</summary>
      <div class="hv-chips">${others.map((s) => `<button type="button" class="chip" data-go="${s.id}">${h(fillTitle(titleOf(s, textLang), textLang))}</button>`).join('')}</div></details>`;
  $('.x-close', dlg).onclick = () => dlg.close();
  $$('[data-hvl]', dlg).forEach((b) => { b.onclick = () => { textLang = b.dataset.hvl; stopSpeak(); draw(); }; });
  $$('[data-say]', dlg).forEach((b) => { b.onclick = () => speak(HELP.find((s) => s.id === b.dataset.id), b.dataset.say, b); });
  $$('[data-stop]', dlg).forEach((b) => { b.onclick = stopSpeak; });
  $$('[data-go]', dlg).forEach((b) => { b.onclick = () => { focusId = b.dataset.go; stopSpeak(); draw(); $('.hv-main', dlg).scrollIntoView({ block: 'start' }); }; });
  $$('[data-edit]', dlg).forEach((b) => { b.onclick = () => editSection(HELP.find((s) => s.id === b.dataset.edit)); });
  $('#hv-guide', dlg).onclick = () => { dlg.close(); openHelp(); };
  const tb = $('#hv-tour', dlg);
  if (tb) tb.onclick = () => { dlg.close(); startTour(view, textLang); };
}

export async function openHelpView(id = '') {
  textLang = textLang || (LANGS.includes(getLang()) ? getLang() : 'yi');
  focusId = id;
  const dlg = dialog();
  draw();
  if (!dlg.open) dlg.showModal();
  if (!overrides) { await loadOverrides(); draw(); }
}

// ---------- ✏️ טוישן (נאר א מנהל) ----------
function editSection(s) {
  if (!state.isAdmin || !s) return;
  stopSpeak();
  const dlg = dialog();
  const u = ui();
  const sec = $(`.hv-sec[data-sec="${s.id}"]`, dlg);
  sec.open = true;
  const body = $('.hv-body', sec);
  $('.hv-tools', sec).hidden = true;
  body.innerHTML = `<form class="hv-edit">
    <label>${h(u.titleL)} (${LANG_NAME[textLang]})<input name="title" dir="auto" value="${h(titleOf(s, textLang))}"></label>
    <label>${h(u.textL)}<textarea name="text" dir="auto" rows="16">${h(bodyOf(s, textLang))}</textarea></label>
    <p class="muted small">${h(u.syntax)}</p>
    <div class="hv-edit-btns"><button type="submit" class="btn">${h(u.save)}</button>
      <button type="button" class="btn ghost" data-cancel>${h(u.cancel)}</button>
      ${isEdited(s, textLang) ? `<span class="spacer"></span><button type="button" class="btn ghost" data-reset>${h(u.reset)}</button>` : ''}
      <span class="hv-msg muted"></span></div></form>`;
  const form = $('form', body);
  $('[data-cancel]', form).onclick = () => draw();
  const write = async (title, text) => {
    const msg = $('.hv-msg', form);
    msg.textContent = '…';
    try {
      await saveOverride(s.id, textLang, title, text);
      msg.textContent = u.saved;
      setTimeout(draw, 500);
    } catch (e) { msg.textContent = `${u.saveFail}: ${e.message || e}`; }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const title = form.title.value.trim(); const text = form.text.value.trim();
    // דאס זעלבע ווי דער ערשטער טעקסט → נישט היטן אלס ענדערונג
    write(title === (s.title[textLang] || '') ? '' : title, text === (s.body[textLang] || '') ? '' : text);
  };
  const r = $('[data-reset]', form);
  if (r) r.onclick = () => write('', '');
}

async function saveOverride(id, lang, title, text) {
  await loadOverrides();
  const row = [id, lang, title, text, nowStamp(), state.email || ''];
  const cur = ov(id, lang);
  if (cur?.row) {
    await updateRange(`HelpTexts!A${cur.row}:F${cur.row}`, [row]);
    overrides[`${id}|${lang}`] = { title, text, row: cur.row };
  } else {
    await appendRow('HelpTexts', row);
    rowsCount += 1;
    overrides[`${id}|${lang}`] = { title, text, row: rowsCount };
  }
}

// ---------- דער קנעפל ----------
export function initHelpView() {
  if (fab) return;
  fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'hv-fab';
  fab.className = 'hv-fab';
  fab.innerHTML = '<span class="hv-q">?</span><span class="hv-fab-t"></span>';
  fab.onclick = () => openHelpView();
  ($('#app-view') || document.body).append(fab);
  setHelpView(view);
}

/** ווערט גערופן ביי יעדן מסך-טויש */
export function setHelpView(name) {
  view = name || 'lobby';
  if (!fab) return;
  const l = LANGS.includes(getLang()) ? getLang() : 'yi';
  $('.hv-fab-t', fab).textContent = UI[l].fab;
  fab.title = UI[l].fab;
  fab.hidden = !helpForView(view).length && !hasTour(view);
}
