// 🎀 סרגל כמו וורד (בית · הוספה) לעורך ההדפסות — בעיצוב של המכתבים (wr-*), עם הקודים במקום השדות של המכתבים.
// גדלים ב-pt ובקנה מידה של הדף (var(--k)) — אז הכל גדל / קטן עם גודל הדף.
import { escapeHtml as h, shrinkImage } from '../util.js';

const COLORS = ['#000000', '#7a1219', '#c00000', '#ff0000', '#ffc000', '#c9a23f', '#00b050', '#0070c0', '#002060', '#7030a0', '#7f7f7f', '#ffffff'];
const HILITE = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffc000', '#d9d9d9'];
const LINE_SP = [0.9, 1, 1.15, 1.3, 1.5, 2, 2.5];
const SPACE = [0, 3, 6, 12, 18, 24, 36];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72, 96];
const BLOCKS = 'p,div,li,td,th,h1,h2,h3,h4,blockquote';

const btn = (cmd, label, title) => `<button type="button" class="wr-b" data-rc="${cmd}" title="${h(title)}">${label}</button>`;
const group = (label, inner) => `<div class="wr-group"><div class="wr-gbody">${inner}</div><div class="wr-glabel">${h(label)}</div></div>`;
const dd = (summary, title, menu, cls = '') => `<details class="wr-dd ${cls}"><summary title="${h(title)}">${summary}</summary><div class="wr-menu">${menu}</div></details>`;
const mi = (attrs, label) => `<button type="button" class="wr-mi" ${attrs}>${label}</button>`;
function alignIcon(k) {
  const w = { r: [14, 9, 14, 9], c: [14, 9, 14, 9], l: [14, 9, 14, 9], j: [14, 14, 14, 14] }[k];
  const x = (len) => (k === 'r' ? 16 - len : k === 'c' ? (16 - len) / 2 : 1);
  return `<svg width="16" height="14" viewBox="0 0 17 14" aria-hidden="true">${w.map((len, i) => `<rect x="${x(len)}" y="${1 + i * 3.4}" width="${len}" height="1.6" fill="currentColor"/>`).join('')}</svg>`;
}

/** tab: 'home' | 'insert'; fonts: [..]; codes: [[קבוצה, [[קוד, תווית]]]]; blocks / reps: [[k, תווית]] */
export function ribbonHtml(tab, { fonts, codes, blocks, reps }) {
  const tabs = `<div class="wr-tabs">${[['home', 'בית'], ['insert', 'הוספה']].map(([k, l]) => `<button type="button" class="wr-tab${tab === k ? ' on' : ''}" data-rtab="${k}">${l}</button>`).join('')}</div>`;
  const home = group('היסטוריה', `<div class="wr-col">${btn('undo', '↶ בטל', 'בטל (Ctrl+Z)')}${btn('redo', '↷ חזור', 'חזור (Ctrl+Y)')}</div>`)
    + group('גופן', `<div class="wr-row">
        <select data-rs="font" title="גופן"><option value="">גופן</option>${fonts.map((f) => `<option style="font-family:'${h(f)}'">${h(f)}</option>`).join('')}</select>
        <select data-rs="size" title="גודל (pt)"><option value="">pt</option>${SIZES.map((n) => `<option>${n}</option>`).join('')}</select>
        ${btn('grow', 'A⁺', 'הגדל')}${btn('shrink', 'A⁻', 'הקטן')}</div>
      <div class="wr-row">${btn('bold', '<b>B</b>', 'מודגש (Ctrl+B)')}${btn('italic', '<i>I</i>', 'נטוי (Ctrl+I)')}${btn('underline', '<u>U</u>', 'קו תחתון (Ctrl+U)')}${btn('strikeThrough', '<s>S</s>', 'קו חוצה')}
        ${dd('<span class="wr-hl">ab</span>▾', 'צבע הדגשה', `${HILITE.map((c) => `<button type="button" class="wr-sw" data-hilite="${c}" style="background:${c}"></button>`).join('')}${mi('data-hilite="transparent"', 'בלי צבע')}`, 'wr-color')}
        ${dd('<span class="wr-fc">A</span>▾', 'צבע הטקסט', `${COLORS.map((c) => `<button type="button" class="wr-sw" data-fore="${c}" style="background:${c}"></button>`).join('')}<label class="wr-mi">… <input type="color" class="wr-forecustom" value="#7a1219"></label>`, 'wr-color')}
        ${btn('removeFormat', '<span class="wr-clear">A</span>', 'נקה עיצוב')}</div>`)
    + group('פסקה', `<div class="wr-row">${btn('insertUnorderedList', '•≡', 'תבליטים')}${btn('insertOrderedList', '1≡', 'מספור')}${btn('outdent', '⇤', 'הקטן הזחה')}${btn('indent', '⇥', 'הגדל הזחה')}
        ${dd('↕ ריווח▾', 'מרווח בין השורות', LINE_SP.map((n) => mi(`data-linesp="${n}"`, String(n))).join(''))}
        ${dd('¶ לפני▾', 'רווח לפני הפסקה', SPACE.map((n) => mi(`data-sp="top" data-v="${n}"`, `${n} pt`)).join(''))}
        ${dd('¶ אחרי▾', 'רווח אחרי הפסקה', SPACE.map((n) => mi(`data-sp="bottom" data-v="${n}"`, `${n} pt`)).join(''))}</div>
      <div class="wr-row">${btn('justifyRight', alignIcon('r'), 'יישור לימין')}${btn('justifyCenter', alignIcon('c'), 'מרכוז')}${btn('justifyLeft', alignIcon('l'), 'יישור לשמאל')}${btn('justifyFull', alignIcon('j'), 'יישור לשני הצדדים')}</div>`)
    + group('קודים', `${dd('<span class="wr-ic">{ }</span> קוד▾', 'הכנס קוד', codes.map(([g, l]) => `<div class="wr-mh">${h(g)}</div>${l.map(([c, t]) => mi(`data-code="${h(c)}"`, h(t))).join('')}`).join(''), 'wr-bigdd wr-allfields')}`);
  const grid = `<div class="wr-grid">${Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (__, c) => `<span data-gr="${r + 1}" data-gc="${c + 1}"></span>`).join('')).join('')}</div><div class="wr-gridlbl">טבלה</div>`;
  const insert = group('טבלה', `${dd('<span class="wr-ic">▦</span> טבלה▾', 'הכנס טבלה', grid, 'wr-bigdd')}
      <div class="wr-col">${btn('rowAbove', '⤒ שורה מעל', 'שורה מעל')}${btn('rowBelow', '⤓ שורה מתחת', 'שורה מתחת')}</div>
      <div class="wr-col">${btn('colBefore', '⇥ עמודה', 'עמודה לפני')}${btn('colAfter', '⇤ עמודה', 'עמודה אחרי')}</div>
      <div class="wr-col">${btn('delRow', '✕ שורה', 'מחק שורה')}${btn('delCol', '✕ עמודה', 'מחק עמודה')}${btn('delTable', '✕ טבלה', 'מחק טבלה')}</div>`)
    + group('איורים', `<label class="wr-b wr-wide wr-file">🖼 תמונה מהמחשב<input type="file" accept="image/*" data-rimg hidden></label>${btn('hr', '― קו', 'קו מפריד')}`)
    + group('זמני תפילות', `${dd('<span class="wr-ic">▤</span> בלוק▾', 'חלק שהמערכת ממלאת כמו בעיצוב הקבוע', blocks.map(([k, l]) => mi(`data-blk-ins="${k}"`, h(l))).join(''), 'wr-bigdd')}
      ${dd('<span class="wr-ic">↻</span> שורה חוזרת▾', 'שורה שמשוכפלת לכל מניין', reps.map(([k, l]) => mi(`data-rep-ins="${k}"`, h(l))).join(''), 'wr-bigdd')}`)
    + group('קודים', `${dd('<span class="wr-ic">{ }</span> קוד▾', 'הכנס קוד', codes.map(([g, l]) => `<div class="wr-mh">${h(g)}</div>${l.map(([c, t]) => mi(`data-code="${h(c)}"`, h(t))).join('')}`).join(''), 'wr-bigdd wr-allfields')}`);
  return `${tabs}<div class="wr-ribbon">${tab === 'insert' ? insert : home}</div>`;
}

/** wiring: root = הסרגל; pg = הדף (contenteditable); on = { change(), tab(k), insBlock(k), insRep(k) } */
export function wireRibbon(root, pg, on) {
  let range = null;
  const keep = () => { const s = getSelection(); if (s.rangeCount && pg.contains(s.anchorNode)) range = s.getRangeAt(0).cloneRange(); };
  document.addEventListener('selectionchange', keep);
  const restore = () => { pg.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
  const ex = (c, v = null, css = true) => { restore(); document.execCommand('styleWithCSS', false, css); document.execCommand(c, false, v); document.execCommand('styleWithCSS', false, false); on.change(); };
  const blocksSel = () => {
    restore(); const s = getSelection(); if (!s.rangeCount) return [];
    const r = s.getRangeAt(0);
    const leaf = [...pg.querySelectorAll(BLOCKS)].filter((el) => r.intersectsNode(el) && !el.querySelector(BLOCKS));
    if (leaf.length) return leaf;
    // טקסט ישר בתוך הדף — לעטוף בפסקה
    document.execCommand('formatBlock', false, 'div');
    const n = s.anchorNode; const b = (n.nodeType === 1 ? n : n.parentElement)?.closest(BLOCKS);
    return b && pg.contains(b) && b !== pg ? [b] : [];
  };
  const wrapSize = (fn) => {
    restore(); document.execCommand('styleWithCSS', false, false); document.execCommand('fontSize', false, '7');
    pg.querySelectorAll('font[size="7"]').forEach((f) => { const s = document.createElement('span'); s.style.fontSize = fn(f); s.innerHTML = f.innerHTML; f.replaceWith(s); });
    on.change();
  };
  const cell = () => { restore(); const n = getSelection().anchorNode; return (n?.nodeType === 1 ? n : n?.parentElement)?.closest('td,th'); };
  const T = {
    rowAbove: () => { const c = cell(); if (!c) return; const tr = c.parentElement; tr.before(tr.cloneNode(true)); tr.previousElementSibling.querySelectorAll('td,th').forEach((x) => { x.innerHTML = '&nbsp;'; }); },
    rowBelow: () => { const c = cell(); if (!c) return; const tr = c.parentElement; const n = tr.cloneNode(true); n.removeAttribute('data-rep'); n.querySelectorAll('td,th').forEach((x) => { x.innerHTML = '&nbsp;'; }); tr.after(n); },
    colBefore: () => { const c = cell(); if (!c) return; const i = c.cellIndex; c.closest('table').querySelectorAll('tr').forEach((tr) => { const x = tr.cells[i]; if (x) x.before(Object.assign(x.cloneNode(false), { innerHTML: '&nbsp;' })); }); },
    colAfter: () => { const c = cell(); if (!c) return; const i = c.cellIndex; c.closest('table').querySelectorAll('tr').forEach((tr) => { const x = tr.cells[i]; if (x) x.after(Object.assign(x.cloneNode(false), { innerHTML: '&nbsp;' })); }); },
    delRow: () => { const c = cell(); if (c) c.parentElement.remove(); },
    delCol: () => { const c = cell(); if (!c) return; const i = c.cellIndex; c.closest('table').querySelectorAll('tr').forEach((tr) => tr.cells[i]?.remove()); },
    delTable: () => { const c = cell(); if (c) c.closest('table').remove(); },
  };
  const close = () => root.querySelectorAll('details[open]').forEach((d) => { d.open = false; });
  root.querySelectorAll('[data-rtab]').forEach((b) => { b.onclick = () => on.tab(b.dataset.rtab); });
  root.querySelectorAll('[data-rc]').forEach((b) => {
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => {
      const c = b.dataset.rc;
      if (T[c]) { T[c](); on.change(); return; }
      if (c === 'grow' || c === 'shrink') { wrapSize((f) => { const cur = parseFloat(getComputedStyle(f).fontSize) || 16; return `${Math.round(cur * (c === 'grow' ? 1.15 : 0.87))}px`; }); return; }
      if (c === 'hr') { ex('insertHTML', '<hr style="border:0;border-top:2px solid #000;margin:.4em 0"><div><br></div>', false); return; }
      ex(c, null, !['undo', 'redo'].includes(c));
    };
  });
  root.querySelectorAll('[data-rs]').forEach((s) => {
    s.onchange = () => {
      const v = s.value; s.value = ''; if (!v) return;
      if (s.dataset.rs === 'font') ex('fontName', v);
      else wrapSize(() => `calc(${v}pt * var(--k, 1))`);
    };
  });
  root.querySelectorAll('[data-fore]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { ex('foreColor', b.dataset.fore); close(); }; });
  const fc = root.querySelector('.wr-forecustom'); if (fc) fc.onchange = () => { ex('foreColor', fc.value); close(); };
  root.querySelectorAll('[data-hilite]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { ex('hiliteColor', b.dataset.hilite); close(); }; });
  root.querySelectorAll('[data-linesp]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { blocksSel().forEach((el) => { el.style.lineHeight = b.dataset.linesp; }); on.change(); close(); }; });
  root.querySelectorAll('[data-sp]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { blocksSel().forEach((el) => { el.style[b.dataset.sp === 'top' ? 'marginTop' : 'marginBottom'] = `calc(${b.dataset.v}pt * var(--k, 1))`; }); on.change(); close(); }; });
  root.querySelectorAll('[data-code]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { restore(); document.execCommand('insertText', false, `{${b.dataset.code}}`); on.change(); close(); }; });
  root.querySelectorAll('[data-blk-ins]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { restore(); on.insBlock(b.dataset.blkIns); close(); }; });
  root.querySelectorAll('[data-rep-ins]').forEach((b) => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => { restore(); on.insRep(b.dataset.repIns); close(); }; });
  const lbl = root.querySelector('.wr-gridlbl');
  root.querySelectorAll('[data-gr]').forEach((x) => {
    x.onmouseenter = () => { const R = +x.dataset.gr; const C = +x.dataset.gc; root.querySelectorAll('[data-gr]').forEach((y) => y.classList.toggle('on', +y.dataset.gr <= R && +y.dataset.gc <= C)); if (lbl) lbl.textContent = `${C}×${R}`; };
    x.onmousedown = (e) => e.preventDefault();
    x.onclick = () => {
      const R = +x.dataset.gr; const C = +x.dataset.gc;
      ex('insertHTML', `<table style="width:100%;border-collapse:collapse;font-size:1.3em">${Array.from({ length: R }, () => `<tr>${Array.from({ length: C }, () => '<td style="border:1px solid #000;padding:.15em .3em">&nbsp;</td>').join('')}</tr>`).join('')}</table><div><br></div>`, false);
      close();
    };
  });
  const fi = root.querySelector('[data-rimg]');
  if (fi) fi.onchange = async () => {
    const f = fi.files[0]; fi.value = ''; if (!f) return;
    let url = ''; try { url = await shrinkImage(f, 900, 60000, true); } catch { url = await new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(f); }); }
    ex('insertHTML', `<img src="${url}" style="max-width:100%;width:40%;display:block;margin:0 auto" alt="">`, false);
  };
  return () => document.removeEventListener('selectionchange', keep);
}
