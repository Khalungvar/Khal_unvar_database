// 📄 רקע PDF למכתבים (עורך המכתבים): ה-PDF המקורי נשאר מאחורה כמו שהוא — וקטורי, בלי הקטנה.
// על המסך: pdf.js מצייר את העמוד לתמונה (רק לתצוגה). בייצוא: pdf-lib שם את עמוד ה-PDF המקורי מאחורה,
// ומעליו שכבה שקופה (PNG, 300 DPI) עם הטקסט, הכתובת והקבלה.
// הגדרות (D.ltr.pdfbg = [שכבה, ...]): { ref: 'drv:<id>', name, on: all|first|rest|list, list: '1,3-4', pg: עמוד ב-PDF,
//   fit: fit|fill|stretch|pct, pct, x, y (הזזה באינצ'ים), op: שקיפות }
import { imageOf, isDrv, fetchImages } from './images.js';
import { htmlToJpeg, jpegsToPdf } from './pdf.js';

export const DPI_OUT = 300; // הייצוא
const DPI_VIEW = 120; // התצוגה בעורך
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// הספריות שכבר באתר (js/vendor) — pdf.js לתצוגה, pdf-lib לבניית ה-PDF
let pjs = null;
function pdfjs() {
  if (!pjs) {
    pjs = import('./vendor/pdfjs.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs.worker.min.mjs', import.meta.url).href;
      return m;
    });
    pjs.catch(() => { pjs = null; });
  }
  return pjs;
}
let plib = null;
function pdflib() {
  if (!plib) { plib = import('./vendor/pdf-lib.esm.min.js'); plib.catch(() => { plib = null; }); }
  return plib;
}

function b64Bytes(dataUrl) {
  const bin = atob(String(dataUrl).split(',')[1] || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
/** ה-PDF (data:) — מהזכרון, ואם לא נטען עדיין — מהדרייב */
async function dataOf(ref) {
  if (!isDrv(ref)) return String(ref || '');
  let d = imageOf(ref);
  if (!d) { await fetchImages([String(ref).slice(4)]); d = imageOf(ref); }
  return d;
}

const docs = new Map(); // ref → Promise<pdfjs doc>
const infos = new Map(); // ref → { n, sizes: [[w, h] באינצ'ים] }
const pngs = new Map(); // `${ref}|${pg}` → data: (לתצוגה)
const busy = new Set();
const failed = new Set();
let readyFn = null;
/** נקרא כשעמוד PDF מוכן לתצוגה (כדי לצייר מחדש) */
export function onPdfBgReady(fn) { readyFn = fn; }

function docOf(ref) {
  if (!docs.has(ref)) {
    const p = (async () => {
      const d = await dataOf(ref);
      if (!d) throw new Error('pdf-missing');
      const lib = await pdfjs();
      return lib.getDocument({ data: b64Bytes(d) }).promise;
    })();
    p.catch(() => docs.delete(ref));
    docs.set(ref, p);
  }
  return docs.get(ref);
}
/** מספר העמודים וגודל כל עמוד (אינצ'ים) */
export async function pdfInfo(ref) {
  if (infos.has(ref)) return infos.get(ref);
  const doc = await docOf(ref);
  const sizes = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const v = (await doc.getPage(i)).getViewport({ scale: 1 });
    sizes.push([v.width / 72, v.height / 72]);
  }
  const o = { n: doc.numPages, sizes };
  infos.set(ref, o);
  return o;
}
async function renderPng(ref, pg, dpi = DPI_VIEW) {
  const doc = await docOf(ref);
  const p = await doc.getPage(pg);
  const v = p.getViewport({ scale: dpi / 72 });
  const c = document.createElement('canvas');
  c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
  await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
  return c.toDataURL('image/png');
}
/** טוען ברקע (מידע / תמונת עמוד) ומודיע כשמוכן */
function kick(ref, pg) {
  const key = `${ref}|${pg || 0}`;
  if (busy.has(key) || failed.has(key)) return;
  busy.add(key);
  (async () => {
    const info = await pdfInfo(ref);
    if (pg) pngs.set(`${ref}|${pg}`, await renderPng(ref, Math.min(pg, info.n)));
  })().then(() => { busy.delete(key); readyFn?.(); }, () => { busy.delete(key); failed.add(key); readyFn?.(); });
}
export const pdfFailed = (ref) => [...failed].some((k) => k.startsWith(`${ref}|`));

function pageSet(s) {
  const set = new Set();
  String(s || '').split(/[,\s]+/).forEach((p) => {
    const m = /^(\d+)(?:-(\d+))?$/.exec(p);
    if (m) { const a = +m[1]; const b = +(m[2] || m[1]); for (let i = a; i <= Math.min(b, a + 300); i += 1) set.add(i); }
  });
  return set;
}
/** האם השכבה שייכת לעמוד n (1 = הראשון) של המכתב */
export function layerOn(l, n) {
  switch (l.on) {
    case 'first': return n === 1;
    case 'rest': return n > 1;
    case 'list': return pageSet(l.list).has(n);
    default: return true;
  }
}
/** איפה השכבה על הדף (אינצ'ים): התאם / מלא / מתח / אחוזים, ממורכז + הזזה */
export function layerRect(l, W, H, sw, sh) {
  let w; let hh;
  const fit = l.fit || 'fit';
  if (fit === 'stretch') { w = W; hh = H; }
  else if (fit === 'pct') { const k = Math.max(1, Number(l.pct) || 100) / 100; w = sw * k; hh = sh * k; }
  else { const k = fit === 'fill' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh); w = sw * k; hh = sh * k; }
  return { x: (W - w) / 2 + (Number(l.x) || 0), y: (H - hh) / 2 + (Number(l.y) || 0), w, h: hh };
}

let dragOn = false;
/** מצב "הזזת הרקע בגרירה" בעורך */
export function setBgDrag(on) { dragOn = Boolean(on); }
export const bgDragOn = () => dragOn;

/** ה-HTML של שכבות ה-PDF לעמוד n של המכתב (W×H אינצ'ים) */
export function pdfBgHtml(D, n, W, H, { edit = false } = {}) {
  const all = Array.isArray(D?.ltr?.pdfbg) ? D.ltr.pdfbg : [];
  return all.map((l, i) => {
    if (!l || !l.ref || !layerOn(l, n)) return '';
    const info = infos.get(l.ref);
    if (!info) { kick(l.ref, 0); return edit ? `<div class="mx-pdfbg-wait">📄 ${pdfFailed(l.ref) ? 'PDF ✗' : 'PDF…'}</div>` : ''; }
    const pg = Math.min(info.n, Math.max(1, Number(l.pg) || 1));
    const [sw, sh] = info.sizes[pg - 1];
    const r = layerRect(l, W, H, sw, sh);
    const src = pngs.get(`${l.ref}|${pg}`);
    if (!src) kick(l.ref, pg);
    const op = Math.min(1, Math.max(0.05, Number(l.op) || 1));
    const meta = encodeURIComponent(JSON.stringify({ ref: l.ref, pg, x: r.x, y: r.y, w: r.w, h: r.h, op }));
    return `<img class="mx-pdfbg${edit && dragOn ? ' mx-pdfbg-drag' : ''}" data-pdfbg="${meta}" data-li="${i}" src="${src || BLANK}" style="left:${r.x}in;top:${r.y}in;width:${r.w}in;height:${r.h}in;opacity:${op}" alt="">`;
  }).join('');
}
export const hasPdfBg = (html) => /class="mx-pdfbg/.test(String(html || ''));

// בייצוא: הדף עצמו שקוף, כדי שה-PDF שמאחורה ייראה
const CLEAR_CSS = '.mx-out,.mx-page,.mx-letter,.rd-letter,.rc-doc{background:transparent!important}';

/**
 * עמודים → PDF. pages = [{ html, W, H, scale }] (html כבר עטוף ב-mx-out).
 * בלי רקע PDF — כמו קודם (JPEG לכל עמוד). עם רקע PDF — ה-PDF המקורי מאחורה + שכבה שקופה מעליו.
 */
export async function pagesToPdf(pages, onProgress = () => {}) {
  if (!pages.some((p) => hasPdfBg(p.html))) {
    const jpgs = [];
    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i];
      // eslint-disable-next-line no-await-in-loop
      const j = await htmlToJpeg(p.html, { widthIn: p.W, heightIn: p.H, scale: p.scale || DPI_OUT / 96, quality: 0.92 });
      jpgs.push(Object.assign(j, { pageW: p.W * 72, pageH: p.H * 72 }));
      onProgress(i + 1, pages.length);
    }
    return jpegsToPdf(jpgs, { margin: 0 });
  }
  const { PDFDocument } = await pdflib();
  const out = await PDFDocument.create();
  const emb = new Map();
  for (let i = 0; i < pages.length; i += 1) {
    const { W, H } = pages[i];
    const tmp = document.createElement('div');
    tmp.innerHTML = pages[i].html;
    const layers = [...tmp.querySelectorAll('.mx-pdfbg')].map((e) => { let m = null; try { m = JSON.parse(decodeURIComponent(e.dataset.pdfbg)); } catch { /* */ } e.remove(); return m; }).filter(Boolean);
    tmp.querySelectorAll('.mx-pdfbg-wait').forEach((e) => e.remove());
    const page = out.addPage([W * 72, H * 72]);
    for (const L of layers) {
      const key = `${L.ref}|${L.pg}`;
      let ep = emb.get(key);
      if (!ep) {
        // eslint-disable-next-line no-await-in-loop
        const d = await dataOf(L.ref);
        if (!d) throw new Error('pdf-missing');
        // eslint-disable-next-line no-await-in-loop
        [ep] = await out.embedPdf(b64Bytes(d), [L.pg - 1]);
        emb.set(key, ep);
      }
      page.drawPage(ep, { x: L.x * 72, y: (H - L.y - L.h) * 72, width: L.w * 72, height: L.h * 72, opacity: L.op });
    }
    const scale = pages[i].scale || DPI_OUT / 96;
    if (layers.length) {
      // eslint-disable-next-line no-await-in-loop
      const png = await htmlToJpeg(`<style>${CLEAR_CSS}</style>${tmp.innerHTML}`, { widthIn: W, heightIn: H, scale, png: true });
      // eslint-disable-next-line no-await-in-loop
      const im = await out.embedPng(png.bytes);
      page.drawImage(im, { x: 0, y: 0, width: W * 72, height: H * 72 });
    } else {
      // eslint-disable-next-line no-await-in-loop
      const jpg = await htmlToJpeg(tmp.innerHTML, { widthIn: W, heightIn: H, scale, quality: 0.92 });
      // eslint-disable-next-line no-await-in-loop
      const im = await out.embedJpg(jpg.bytes);
      page.drawImage(im, { x: 0, y: 0, width: W * 72, height: H * 72 });
    }
    onProgress(i + 1, pages.length);
  }
  return out.save();
}

/** הדפסה של PDF (בלי הורדה): בתוך iframe נסתר; אם לא הולך — נפתח בלשונית */
export function printPdfBytes(bytes, name = 'print') {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const fr = document.createElement('iframe');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  fr.src = url;
  fr.onload = () => {
    try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch {
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.download = `${name}.pdf`; document.body.append(a); a.click(); a.remove();
    }
    setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 120000);
  };
  document.body.append(fr);
}

/** קובץ PDF → data: (לשמירה בדרייב) */
export function fileToDataUrl(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
