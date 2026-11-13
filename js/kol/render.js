// 📻 קול אונגוואר — בניית המייל (HTML שמתאים לכל תוכנות המייל: טבלאות, סגנון בתוך התגיות, בלי גופנים מבחוץ).
// אותו בנאי משמש לתצוגה מקדימה, לשליחה ולדף הציבורי (ungvar.org/kolungvar).
import { shabbatOfWeek, shabbatTitle } from '../parasha.js?v=683';
import { todayIso } from '../hebdate.js?v=683';

export const SITE = 'https://ungvar.org';
export const LIST_NAME = 'מהנעשה והנשמע';
/** גופנים שקיימים כמעט בכל מחשב / טלפון (גופן מבחוץ לא עובד במיילים) */
export const FONTS = [
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Tahoma, Arial, sans-serif', 'Tahoma'],
  ['Verdana, Arial, sans-serif', 'Verdana'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['Georgia, "Times New Roman", serif', 'Georgia'],
  ['David, "Times New Roman", serif', 'David'],
  ['"Courier New", Courier, monospace', 'Courier New'],
];
export const DEF_FONT = FONTS[0][0];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** תמונה מהדרייב (פתוחה לכל מי שיש לו קישור) */
export const imgUrl = (id, w = 1200) => (id ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${w}` : '');
export const fileUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
export const dlUrl = (id) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
/** מזהה קובץ מקישור דרייב */
export function driveId(link) {
  const s = String(link || '');
  return (s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/) || s.match(/^([\w-]{25,})$/) || [])[1] || '';
}
/** תמונות של מודעה / תמונה — כמה באותה קבוצה (וגם הצורה הישנה: תמונה אחת) */
export const imgsOf = (b) => (b?.imgs?.length ? b.imgs : (b?.img?.id ? [{ ...b.img, pdf: b.pdf }] : [])).filter((x) => x?.id);
export const videoPage = (b) => `${SITE}/kolungvar/?v=${encodeURIComponent(driveId(b.url) || b.url || '')}${b.title ? `&t=${encodeURIComponent(b.title)}` : ''}`;

// ---------- תגיות ----------
/** השבת של המייל: שבועי — השבת שלו; חד פעמי — השבת של השבוע של היום */
export const weekOf = (e) => (e?.kind === 'weekly' && e.week ? e.week : shabbatOfWeek(todayIso()));
export function tagVals(e) {
  return { 'פרשת השבוע': shabbatTitle(weekOf(e)) };
}
export function fillTags(s, e) {
  const v = tagVals(e);
  return String(s ?? '').replace(/\{([^{}]{2,30})\}/g, (m, k) => (v[k.trim()] !== undefined ? v[k.trim()] : m));
}

// ---------- ניקוי HTML של טקסט (מה שהעורך מייצר) ----------
const OK_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'SPAN', 'FONT', 'A', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'SMALL', 'BIG', 'SUP', 'SUB', 'S', 'STRIKE', 'BLOCKQUOTE', 'CENTER']);
const OK_CSS = new Set(['color', 'background-color', 'font-size', 'font-family', 'text-align', 'font-weight', 'font-style', 'text-decoration', 'direction', 'line-height', 'margin', 'padding']);
export function cleanHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const walk = (el) => {
    [...el.childNodes].forEach((n) => {
      if (n.nodeType === 3) return;
      if (n.nodeType !== 1 || !OK_TAGS.has(n.tagName)) {
        if (n.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(n.tagName)) { walk(n); n.replaceWith(...n.childNodes); } else n.remove();
        return;
      }
      [...n.attributes].forEach((a) => {
        const k = a.name.toLowerCase();
        if (k === 'style') {
          const keep = String(a.value).split(';').map((x) => x.trim()).filter((x) => OK_CSS.has(x.split(':')[0].trim().toLowerCase()) && !/url\(|expression/i.test(x));
          if (keep.length) n.setAttribute('style', keep.join('; ')); else n.removeAttribute('style');
        } else if (k === 'href' && n.tagName === 'A') {
          if (!/^(https?:|mailto:|tel:)/i.test(a.value.trim())) n.removeAttribute('href');
        } else if (!(n.tagName === 'FONT' && ['face', 'size', 'color'].includes(k)) && !['align', 'dir'].includes(k)) n.removeAttribute(a.name);
      });
      if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); }
      walk(n);
    });
  };
  const root = doc.body.firstChild; walk(root);
  return root.innerHTML;
}

// ---------- רכיבים ----------
const W = 600; // רוחב המייל
const pad = 'padding:8px 16px';
function textCell(html, b, e, opts) {
  if (!String(html || '').replace(/<[^>]*>|&nbsp;|\s/g, '')) return '';
  const font = b?.font || opts.font || DEF_FONT;
  return `<tr><td dir="rtl" style="${pad};font-family:${esc(font)};font-size:16px;line-height:1.5;color:${esc(opts.color || '#1d1d1d')};text-align:${esc(b?.align || 'center')}${b?.bg ? `;background-color:${esc(b.bg)}` : ''}">${fillTags(cleanHtml(html), e)}</td></tr>`;
}
function imgRow(src, link, alt = '') {
  if (!src) return '';
  const im = `<img src="${esc(src)}" alt="${esc(alt)}" width="${W - 32}" style="display:block;width:100%;max-width:${W - 32}px;height:auto;border:0;margin:0 auto">`;
  return `<tr><td style="${pad}" align="center">${link ? `<a href="${esc(link)}" target="_blank">${im}</a>` : im}</td></tr>`;
}
export function buttonHtml(label, link, color = '#ffffff', bg = '#7a1f1f', font = DEF_FONT) {
  if (!label || !link) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:6px auto"><tr><td bgcolor="${esc(bg)}" style="border-radius:6px;background:${esc(bg)}">
    <a href="${esc(link)}" target="_blank" style="display:inline-block;padding:11px 26px;font-family:${esc(font)};font-size:16px;font-weight:bold;color:${esc(color)};text-decoration:none;border-radius:6px">${esc(label)}</a></td></tr></table>`;
}
/** שתי תמונות בשורה */
function pairRow(a, b, link) {
  const cw = Math.floor((W - 32 - 8) / 2);
  const cell = (it) => { if (!it) return `<td width="${cw}"></td>`; const im = `<img src="${esc(imgUrl(it.id, 700))}" alt="תמונה" width="${cw}" style="display:block;width:100%;max-width:${cw}px;height:auto;border:0">`; return `<td width="${cw}" valign="top">${link ? `<a href="${esc(link)}" target="_blank">${im}</a>` : im}</td>`; };
  return `<tr><td style="${pad}" align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cell(a)}<td width="8" style="font-size:1px">&nbsp;</td>${cell(b)}</tr></table></td></tr>`;
}
const btnRow = (...a) => { const x = buttonHtml(...a); return x ? `<tr><td style="${pad}" align="center">${x}</td></tr>` : ''; };
const gap = (b) => (b?.gap === false ? '' : '<tr><td style="height:14px;line-height:14px;font-size:1px">&nbsp;</td></tr>');

export const KINDS = {
  ad: { icon: '📰', name: 'מודעה' },
  photo: { icon: '📷', name: 'תמונה' },
  file: { icon: '📎', name: 'קובץ מצורף' },
  text: { icon: '✏️', name: 'טקסט' },
  video: { icon: '🎬', name: 'וידאו' },
  button: { icon: '🔘', name: 'כפתור' },
};

/** רכיב אחד → שורות טבלה */
export function blockRows(b, e, opts = {}) {
  const f = b.font || opts.font || DEF_FONT;
  const bg = b.bg ? `background-color:${esc(b.bg)};` : '';
  let inner = '';
  if (b.type === 'ad') {
    inner = imgsOf(b).map((it) => imgRow(imgUrl(it.id), b.link || (it.pdf?.id ? fileUrl(it.pdf.id) : ''), 'מודעה')).join('') + textCell(b.text, b, e, opts);
  } else if (b.type === 'photo') {
    const ims = imgsOf(b); let rows = '';
    if (b.cols === 2 && ims.length > 1) for (let i = 0; i < ims.length; i += 2) rows += pairRow(ims[i], ims[i + 1], b.moreLink || '');
    else rows = ims.map((it) => imgRow(imgUrl(it.id), b.moreLink || '', 'תמונה')).join('');
    inner = rows + textCell(b.text, b, e, opts)
      + (b.moreLink ? btnRow(b.moreLabel || 'לעוד תמונות מהמעמד', b.moreLink, b.btnColor || '#ffffff', b.btnBg || '#7a1f1f', f) : '');
  } else if (b.type === 'file') {
    const name = b.file?.name || 'קובץ';
    inner = (b.img?.id ? imgRow(imgUrl(b.img.id), b.file?.id ? fileUrl(b.file.id) : '', name) : '') + textCell(b.text, b, e, opts)
      + (b.file?.id ? btnRow(`📎 ${b.btnLabel || `להורדת ${name}`}`, opts.archive ? dlUrl(b.file.id) : fileUrl(b.file.id), b.btnColor || '#ffffff', b.btnBg || '#2c4a6e', f) : '');
  } else if (b.type === 'text') {
    inner = textCell(b.html, b, e, opts);
  } else if (b.type === 'video') {
    const thumb = b.thumb?.id ? imgUrl(b.thumb.id) : '';
    inner = (thumb ? imgRow(thumb, videoPage(b), 'וידאו') : btnRow(`▶ ${b.title || 'לצפייה בסרטון'}`, videoPage(b), '#ffffff', '#1d1d1d', f))
      + textCell(b.text, b, e, opts);
  } else if (b.type === 'button') {
    inner = btnRow(fillTags(b.label, e), b.link, b.color || '#ffffff', b.btnBg || '#7a1f1f', f);
  }
  if (!inner) return '';
  return bg ? `<tr><td style="${bg}padding:4px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table></td></tr>${gap(b)}` : inner + gap(b);
}

/**
 * כל המייל. e = { kind, week, subject, blocks, opts }
 * mode: 'mail' (עם {{UNSUB}} להסרה) · 'preview' · 'archive' (בלי תחתית של מייל, רק רכיבים עם ✓ לארכיון)
 */
export function emailHtml(e, mode = 'mail') {
  const o = { font: DEF_FONT, bg: '#efe9dc', card: '#ffffff', color: '#1d1d1d', ...(e.opts || {}) };
  const opts = { ...o, archive: mode === 'archive' };
  const blocks = (e.blocks || []).filter((b) => mode !== 'archive' || b.arch !== false);
  const rowsHtml = blocks.map((b) => blockRows(b, e, opts)).join('');
  if (mode === 'archive') return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="max-width:${W}px;margin:0 auto;background:${esc(o.card)}">${rowsHtml}</table>`;
  const foot = `<tr><td dir="rtl" style="padding:18px 16px 22px;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6457;text-align:center;border-top:1px solid #e3dccb">
      קול אונגוואר · 5306 16th Ave · Brooklyn NY 11204<br>
      <a href="${SITE}/kolungvar/" target="_blank" style="color:#6b6457">כל המיילים הקודמים</a> ·
      <a href="${mode === 'mail' ? '{{UNSUB}}' : '#'}" target="_blank" style="color:#6b6457">להסרה מרשימת התפוצה</a></td></tr>`;
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fillTags(e.subject, e))}</title></head>
<body style="margin:0;padding:0;background:${esc(o.bg)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${esc(o.bg)}"><tr><td align="center" style="padding:12px 6px">
<table role="presentation" width="${W}" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="width:100%;max-width:${W}px;background:${esc(o.card)};border-radius:6px">
<tr><td style="height:10px;line-height:10px;font-size:1px">&nbsp;</td></tr>
${rowsHtml}${foot}
</table></td></tr></table></body></html>`;
}

/** טקסט פשוט (למי שתוכנת המייל שלו לא מציגה HTML) */
export function emailText(e) {
  const strip = (h) => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  const out = [fillTags(e.subject, e), ''];
  (e.blocks || []).forEach((b) => {
    const t = strip(fillTags(b.text || b.html || '', e));
    if (t) out.push(t);
    if (b.type === 'button' && b.link) out.push(`${b.label}: ${b.link}`);
    if (b.type === 'video') out.push(`▶ ${videoPage(b)}`);
    if (b.type === 'ad' && b.link) out.push(b.link);
    out.push('');
  });
  out.push('—', `${SITE}/kolungvar/`, 'להסרה: {{UNSUB}}');
  return out.join('\n');
}
