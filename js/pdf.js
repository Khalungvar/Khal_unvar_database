// מאכט א PDF פון א קבלה — אינעם בלעטערער, אן קיין דרויסנדיגע ביבליאטעק:
// דער דאקומענט (HTML) → בילד (SVG foreignObject → canvas → JPEG) → PDF מיט איין בילד אויף יעדן בלאט.

import { customFontCss } from './fonts.js';

const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

let cssCache = null;
async function appCss() {
  if (cssCache != null) return cssCache;
  try {
    const link = [...document.querySelectorAll('link[rel=stylesheet]')].find((l) => /css\/style\.css/.test(l.href));
    cssCache = await (await fetch(link ? link.href : 'css/style.css')).text();
  } catch { cssCache = ''; }
  return cssCache;
}

// די שריפטן מוזן זיין אינעווייניג (data:) — אן דעם זעט א בילד נישט קיין דרויסנדיגע שריפטן
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&family=Playpen+Sans+Hebrew:wght@400&family=Amatic+SC:wght@700&family=Noto+Rashi+Hebrew:wght@500&display=block';
let fontCache = null;
async function fontCss() {
  if (fontCache != null) return fontCache;
  try {
    const css = await (await fetch(FONT_CSS)).text();
    // נאר העברעאיש און לאטייניש (נישט קיין קירילישע א.א.וו.)
    const blocks = css.split(/(?=\/\*\s*[\w-]+\s*\*\/)/).filter((b) => /^\/\*\s*(hebrew|latin)\s*\*\//.test(b));
    const out = await Promise.all(blocks.map(async (b) => {
      const m = /url\((https:[^)]+)\)/.exec(b);
      if (!m) return '';
      try { return b.replace(m[1], await toDataUrl(await (await fetch(m[1])).blob())); } catch { return ''; }
    }));
    fontCache = out.join('\n');
  } catch { fontCache = ''; }
  return fontCache;
}

async function inlineImages(root) {
  await Promise.all([...root.querySelectorAll('img')].map(async (img) => {
    const src = img.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    try { img.setAttribute('src', await toDataUrl(await (await fetch(src)).blob())); } catch { img.remove(); }
  }));
}

const xmlText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * מאכט א JPEG פון HTML. widthIn/heightIn = די גרייס אין אינטשעס (96px = 1in).
 * גיט צוריק { bytes: Uint8Array, w, h, dataUrl }
 */
export async function htmlToJpeg(html, { widthIn = 7.5, heightIn = 10, scale = 2, quality = 0.88 } = {}) {
  const W = Math.round(widthIn * 96); const H = Math.round(heightIn * 96);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  await inlineImages(wrap);
  const [css, fonts0] = await Promise.all([appCss(), fontCss()]);
  const fonts = `${fonts0}\n${customFontCss()}`;
  const body = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<foreignObject x="0" y="0" width="${W}" height="${H}">
<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;background:#fff;overflow:hidden">
<style>${xmlText(fonts)}\n${xmlText(css)}\n.rc-doc{display:flex;background:#fff}.rd-letter{background:#fff}</style>${body}</div></foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('render')); });
  await new Promise((r) => setTimeout(r, 150)); // די שריפטן אינעם בילד
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { bytes, w: canvas.width, h: canvas.height, dataUrl };
}

/** PDF (Letter): יעדער JPEG אויף א בלאט, מיט 0.5in ראנד. */
export function jpegsToPdf(pages, { pageW = 612, pageH = 792, margin = 36 } = {}) {
  const enc = new TextEncoder();
  const chunks = []; const offsets = []; let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  const pageNum = (i) => 3 + i * 3;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(' ')}] >>`));
  pages.forEach((p, i) => {
    const pn = pageNum(i);
    const bw = pageW - margin * 2; const bh = pageH - margin * 2;
    const k = Math.min(bw / p.w, bh / p.h);
    const dw = p.w * k; const dh = p.h * k;
    const x = (pageW - dw) / 2; const y = pageH - margin - dh;
    const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${i} ${pn + 2} 0 R >> >> /Contents ${pn + 1} 0 R >>`));
    obj(pn + 1, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(pn + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      push(p.bytes);
      push('\nendstream');
    });
  });
  const total = 3 + n * 3;
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i += 1) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let o = 0;
  chunks.forEach((c) => { out.set(c, o); o += c.length; });
  return out;
}
