// א PDF לייענער אינעם אתר אליין (pdf.js) — ארבעט אין יעדן בלעטערער, אויך ווען דער בלעטערער האט נישט קיין אייגענעם.
// בלעטער אונטער'נאנד, אדער "חוברת" (צוויי זייטן ביי א זייט, ווי א געעפנטע חוברת מיט כריכה מימין).
let PJ = null;
async function pdfjs() {
  if (!PJ) {
    PJ = await import('./vendor/pdfjs.min.mjs');
    PJ.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs.worker.min.mjs', import.meta.url).href;
  }
  return PJ;
}

const CSS = `
.pv{display:flex;flex-direction:column;width:100%;height:84vh;background:#525659;direction:rtl}
.pv-bar{display:flex;gap:6px;align-items:center;padding:6px 10px;background:#3b3e41;color:#fff;font-size:13px;flex-wrap:wrap}
.pv-bar button{background:#5a5e62;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;font:inherit}
.pv-bar button.on{background:#c9a64a;color:#111}
.pv-bar .pv-sp{flex:1}
.pv-scroll{flex:1;overflow:auto;padding:14px 0}
.pv-row{display:flex;justify-content:center;gap:0;margin:0 auto 14px}
.pv-pg{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.45);position:relative}
.pv-pg canvas{display:block;width:100%;height:100%}
.pv-pg .pv-n{position:absolute;bottom:-18px;left:0;right:0;text-align:center;color:#ddd;font-size:11px}
.pv-row.pv-spread{gap:2px}
`;

/** ווייזט א PDF (Uint8Array) אין box. גיט צוריק { destroy } */
export async function showPdfIn(box, bytes) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: bytes.slice(0) }).promise;
  const N = doc.numPages;
  const first = await doc.getPage(1); const vp1 = first.getViewport({ scale: 1 });
  const ratio = vp1.height / vp1.width;
  let zoom = 1; let spread = false; let destroyed = false;
  box.innerHTML = `<style>${CSS}</style><div class="pv">
    <div class="pv-bar"><span>${N} עמודים</span><span class="pv-sp"></span>
      <button type="button" data-m="single" class="on">עמוד אחרי עמוד</button><button type="button" data-m="spread">חוברת פתוחה</button>
      <button type="button" data-z="out" title="הקטנה">－</button><button type="button" data-z="fit" title="לרוחב">⤢</button><button type="button" data-z="in" title="הגדלה">＋</button></div>
    <div class="pv-scroll"></div></div>`;
  const scroller = box.querySelector('.pv-scroll');
  const rendered = new Map();
  let io = null;

  const layout = () => {
    if (io) io.disconnect();
    rendered.clear();
    const avail = scroller.clientWidth - 40;
    const perRow = spread ? 2 : 1;
    const w = Math.max(160, Math.min(avail / perRow, spread ? 9999 : 900) * zoom);
    const rows = [];
    if (!spread) for (let i = 1; i <= N; i += 1) rows.push([i]);
    else { rows.push([1]); for (let i = 2; i <= N; i += 2) rows.push(i + 1 <= N ? [i, i + 1] : [i]); } // כריכה מימין: [2 | 3] — 2 רעכטס
    scroller.innerHTML = rows.map((r) => `<div class="pv-row${r.length > 1 ? ' pv-spread' : ''}">${r.map((n) => `<div class="pv-pg" data-n="${n}" style="width:${w}px;height:${w * ratio}px"><span class="pv-n">${n}</span></div>`).join('')}</div>`).join('');
    io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) draw(Number(e.target.dataset.n), e.target, w); }), { root: scroller, rootMargin: '600px 0px' });
    scroller.querySelectorAll('.pv-pg').forEach((el) => io.observe(el));
  };
  async function draw(n, el, w) {
    if (rendered.get(n) === w || destroyed) return;
    rendered.set(n, w);
    const page = await doc.getPage(n);
    const scale = (w / page.getViewport({ scale: 1 }).width) * Math.min(3, window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    if (destroyed || rendered.get(n) !== w) return;
    el.querySelector('canvas')?.remove(); el.prepend(c);
  }
  box.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => {
    spread = b.dataset.m === 'spread';
    box.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x === b));
    layout();
  }; });
  box.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => {
    const z = b.dataset.z; zoom = z === 'in' ? Math.min(3, zoom * 1.25) : z === 'out' ? Math.max(0.4, zoom / 1.25) : 1;
    layout();
  }; });
  let rt = null; const onResize = () => { clearTimeout(rt); rt = setTimeout(layout, 200); };
  window.addEventListener('resize', onResize);
  layout();
  return { destroy() { destroyed = true; if (io) io.disconnect(); window.removeEventListener('resize', onResize); doc.destroy(); } };
}
