// ✥ סידור המשבצות במסך: גוררים משבצת למקום אחר, ומגדילים / מקטינים מהפינה. נשמר ב-S.boxes[k].pos
import { BOX_SEL } from '../display/screenset.js';

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GRID = 4;
const snap = (v) => Math.round(v / GRID) * GRID;

/** S = הגדרות המסך (משתנות במקום); src() = כתובת תצוגה מקדימה עדכנית; onChange() אחרי כל שינוי */
export function openLayout(S, src, onChange) {
  const d = document.createElement('dialog'); d.className = 'sheet ly-dlg';
  d.innerHTML = `<div class="ly-bar"><b>✥ סידור המשבצות</b><span class="muted small">גוררים משבצת · מגדילים מהריבוע הצהוב בפינה · השינוי נשמר רק אחרי 💾 שמירה</span><span style="flex:1"></span>
    <button type="button" class="btn small-btn ghost" id="ly-reset">↺ הכל למקום המקורי</button><button type="button" class="btn small-btn primary" id="ly-x">✔ סיום</button></div>
    <div class="ly-stage"><div class="ly-box"><iframe id="ly-fr" title="המסך"></iframe><div class="ly-ov"></div></div></div>`;
  document.body.append(d); d.addEventListener('close', () => d.remove()); d.showModal();
  const box = d.querySelector('.ly-box'); const fr = d.querySelector('#ly-fr'); const ov = d.querySelector('.ly-ov');
  let k = 1;
  const size = () => { const st = d.querySelector('.ly-stage'); k = Math.min(st.clientWidth / 1920, st.clientHeight / 1080); box.style.width = `${1920 * k}px`; box.style.height = `${1080 * k}px`; fr.style.transform = `scale(${k})`; };
  window.addEventListener('resize', size); d.addEventListener('close', () => window.removeEventListener('resize', size));
  const load = () => { ov.innerHTML = ''; fr.src = src(); };
  fr.onload = () => setTimeout(draw, 1500);
  function draw() {
    size(); ov.innerHTML = '';
    const doc = fr.contentDocument; if (!doc) return;
    for (const [key, [label, sel]] of Object.entries(BOX_SEL)) {
      const el = doc.querySelector(sel); if (!el) continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const sc = r.width / (el.offsetWidth || 1); // התאמת "שוליים" בתוך המסך
      const o = document.createElement('div'); o.className = `ly-r${S.boxes?.[key]?.pos ? ' moved' : ''}`;
      o.style.cssText = `left:${r.left * k}px;top:${r.top * k}px;width:${r.width * k}px;height:${r.height * k}px`;
      o.innerHTML = `<span>${h(label)}</span>${S.boxes?.[key]?.pos ? `<button type="button" title="למקום המקורי">↺</button>` : ''}<i></i>`;
      ov.append(o);
      const base = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      const reset = o.querySelector('button');
      if (reset) reset.onpointerdown = (e) => { e.stopPropagation(); delete S.boxes[key].pos; onChange(); load(); };
      o.onpointerdown = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault(); o.setPointerCapture(e.pointerId);
        const rs = e.target.tagName === 'I'; const x0 = e.clientX; const y0 = e.clientY; const r0 = { l: r.left * k, t: r.top * k, w: r.width * k, h: r.height * k };
        o.onpointermove = (ev) => {
          const dx = ev.clientX - x0; const dy = ev.clientY - y0;
          if (rs) { o.style.width = `${Math.max(40, r0.w + dx)}px`; o.style.height = `${Math.max(30, r0.h + dy)}px`; } else { o.style.left = `${r0.l + dx}px`; o.style.top = `${r0.t + dy}px`; }
        };
        o.onpointerup = (ev) => {
          o.onpointermove = null; o.onpointerup = null;
          const dx = (ev.clientX - x0) / k / sc; const dy = (ev.clientY - y0) / k / sc;
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
          S.boxes = S.boxes || {}; S.boxes[key] = S.boxes[key] || {};
          S.boxes[key].pos = rs ? { x: base.x, y: base.y, w: snap(Math.max(80, base.w + dx)), h: snap(Math.max(60, base.h + dy)) }
            : { x: snap(base.x + dx), y: snap(base.y + dy), w: base.w, h: base.h };
          onChange(); load();
        };
      };
    }
  }
  d.querySelector('#ly-x').onclick = () => d.close();
  d.querySelector('#ly-reset').onclick = () => { if (!confirm('להחזיר את כל המשבצות למקום ולגודל המקוריים?')) return; Object.values(S.boxes || {}).forEach((c) => { delete c.pos; }); onChange(); load(); };
  requestAnimationFrame(() => { size(); load(); });
}
