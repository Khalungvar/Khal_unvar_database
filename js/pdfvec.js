// HTML → PDF מיט לעבעדיגן טעקסט (וועקטאר), אן א דרויסנדיגע ביבליאטעק פאר שריפטן:
// דער בלעטערער שטעלט אויס דעם בלאט; מיר נעמען די פאזיציע פון יעדן אות, יעדן בילד און יעדן ראם/הינטערגרונט,
// און מיר צייכענען זיי אין א pdf-lib בלאט. די שריפטן (פונעם פריוואטן גיליון) ווערן אריינגעלייגט אין PDF (TrueType, Identity-H).
import { customFonts } from './fonts.js';

// ---------- TrueType ----------
function parseTTF(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o) => dv.getUint16(o); const i16 = (o) => dv.getInt16(o); const u32 = (o) => dv.getUint32(o);
  const n = u16(4); const T = {};
  for (let i = 0; i < n; i += 1) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    T[tag] = { off: u32(o + 8), len: u32(o + 12) };
  }
  const head = T.head.off; const hhea = T.hhea.off;
  const upm = u16(head + 18);
  const bbox = [i16(head + 36), i16(head + 38), i16(head + 40), i16(head + 42)];
  const asc = i16(hhea + 4); const desc = i16(hhea + 6); const nH = u16(hhea + 34);
  const hmtx = T.hmtx.off;
  const adv = (g) => u16(hmtx + 4 * Math.min(g, nH - 1));
  let capH = asc;
  if (T['OS/2'] && T['OS/2'].len >= 90) { const v = i16(T['OS/2'].off + 88); if (v > 0) capH = v; }
  // cmap
  const cm = T.cmap.off; const nt = u16(cm + 2); let best = null; let bestScore = -1;
  for (let i = 0; i < nt; i += 1) {
    const pid = u16(cm + 4 + i * 8); const eid = u16(cm + 6 + i * 8); const off = cm + u32(cm + 8 + i * 8);
    const fmt = u16(off);
    const score = (fmt === 12 ? 10 : fmt === 4 ? 5 : 0) + (pid === 3 && (eid === 10 || eid === 1) ? 2 : pid === 0 ? 1 : 0) + (pid === 3 && eid === 0 ? -3 : 0);
    if ((fmt === 4 || fmt === 12) && score > bestScore) { best = { off, fmt, sym: pid === 3 && eid === 0 }; bestScore = score; }
  }
  let lookup = () => 0;
  if (best && best.fmt === 4) {
    const o = best.off; const segX2 = u16(o + 6); const ends = o + 14; const starts = ends + segX2 + 2; const deltas = starts + segX2; const ranges = deltas + segX2;
    lookup = (c) => {
      for (let s = 0; s < segX2; s += 2) {
        const end = u16(ends + s); if (c > end) continue;
        const start = u16(starts + s); if (c < start) return 0;
        const delta = i16(deltas + s); const ro = u16(ranges + s);
        if (!ro) return (c + delta) & 0xffff;
        const gi = u16(ranges + s + ro + 2 * (c - start));
        return gi ? (gi + delta) & 0xffff : 0;
      }
      return 0;
    };
    if (best.sym) { const base = lookup; lookup = (c) => base(c) || (c < 256 ? base(0xf000 + c) : 0); }
  } else if (best && best.fmt === 12) {
    const o = best.off; const ng = u32(o + 12);
    lookup = (c) => {
      for (let i = 0; i < ng; i += 1) {
        const g = o + 16 + i * 12; const s = u32(g); const e = u32(g + 4);
        if (c >= s && c <= e) return u32(g + 8) + (c - s);
      }
      return 0;
    };
  }
  const cache = new Map();
  const gid = (c) => { if (!cache.has(c)) cache.set(c, lookup(c)); return cache.get(c); };
  return { bytes, upm, bbox, asc, desc, capH, adv, gid };
}

// ---------- שריפטן אין א דאקומענט ----------
const parsed = new Map(); // name → parsed TTF
function fontBytes(name) {
  if (parsed.has(name)) return parsed.get(name);
  const f = customFonts().find((x) => x.name === name);
  let p = null;
  if (f && f.dataUrl) {
    try {
      const b64 = f.dataUrl.split(',')[1]; const bin = atob(b64);
      const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
      p = parseTTF(u8);
    } catch (err) { console.warn('ttf', name, err); p = null; }
  }
  parsed.set(name, p);
  return p;
}

/** וועלכן שריפט האט דער בלעטערער גענוצט: { name, faux } — לויט דער רשימה פון font-family און דעם weight */
function resolveFont(familyList, weight, ch) {
  const fams = String(familyList).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const names = customFonts().map((f) => f.name);
  const cp = ch.codePointAt(0);
  for (const fam of fams) {
    const cands = [];
    if (weight >= 600 && names.includes(`${fam} Bold`)) cands.push({ name: `${fam} Bold`, faux: false });
    if (names.includes(fam)) cands.push({ name: fam, faux: weight >= 600 && !names.includes(`${fam} Bold`) });
    if (!names.includes(fam) && names.includes(`${fam} Bold`)) cands.push({ name: `${fam} Bold`, faux: false });
    for (const c of cands) { const p = fontBytes(c.name); if (p && p.gid(cp)) return c; }
  }
  for (const fb of ['Livorna', 'PFT_Vilna', 'EFT_Pnina', 'Cambria Bold']) { const p = fontBytes(fb); if (p && p.gid(cp)) return { name: fb, faux: weight >= 600 }; }
  return null;
}

/** א "FontSet" פאר איין PDF: נעמט אויף שריפטן, און ביים סוף שרייבט די אביעקטן (W, ToUnicode) */
export function fontSet(PL, doc) {
  const { PDFName, PDFString, PDFHexString } = PL;
  const fonts = new Map(); // name → { ref, used: Map(gid → cp) }
  let n = 0;
  return {
    use(name, gid, cp) {
      let f = fonts.get(name);
      if (!f) { f = { ref: doc.context.nextRef(), used: new Map(), tag: `KF${(n += 1)}` }; fonts.set(name, f); }
      if (!f.used.has(gid)) f.used.set(gid, cp);
      return f;
    },
    finalize() {
      fonts.forEach((f, name) => {
        const p = fontBytes(name); const k = 1000 / p.upm;
        const base = `${'ABCDEF'[name.length % 6]}KUNGV+${name.replace(/[^A-Za-z0-9_-]/g, '')}`;
        const file = doc.context.flateStream(p.bytes, { Length1: p.bytes.length });
        const fileRef = doc.context.register(file);
        const desc = doc.context.obj({
          Type: 'FontDescriptor', FontName: base, Flags: 4,
          FontBBox: p.bbox.map((v) => Math.round(v * k)), ItalicAngle: 0,
          Ascent: Math.round(p.asc * k), Descent: Math.round(p.desc * k), CapHeight: Math.round(p.capH * k), StemV: 80, FontFile2: fileRef,
        });
        const descRef = doc.context.register(desc);
        const gids = [...f.used.keys()].sort((a, b) => a - b);
        const W = []; gids.forEach((g) => { W.push(g, [Math.round(p.adv(g) * k)]); });
        const cid = doc.context.obj({
          Type: 'Font', Subtype: 'CIDFontType2', BaseFont: base,
          CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 },
          FontDescriptor: descRef, W, DW: 1000, CIDToGIDMap: 'Identity',
        });
        const cidRef = doc.context.register(cid);
        const hex4 = (v) => v.toString(16).padStart(4, '0').toUpperCase();
        const uni = (cp) => { if (cp > 0xffff) { const v = cp - 0x10000; return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff)); } return hex4(cp); };
        const lines = []; gids.forEach((g) => lines.push(`<${hex4(g)}> <${uni(f.used.get(g))}>`));
        const chunks = []; for (let i = 0; i < lines.length; i += 100) chunks.push(lines.slice(i, i + 100));
        const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.map((c) => `${c.length} beginbfchar\n${c.join('\n')}\nendbfchar`).join('\n')}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
        const tuRef = doc.context.register(doc.context.flateStream(cmap));
        doc.context.assign(f.ref, doc.context.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: base, Encoding: 'Identity-H', DescendantFonts: [cidRef], ToUnicode: tuRef }));
      });
      void PDFName; void PDFHexString;
    },
  };
}

// ---------- צייכענען א בלאט ----------
const parseColor = (s) => {
  const m = /rgba?\(([^)]+)\)/.exec(String(s || '')); if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: p.length > 3 ? p[3] : 1 };
};
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
const HEB = /[֐-׿]/;
const LTRCH = /[A-Za-z0-9]/;

const imgCache = new WeakMap();
async function embedImg(doc, src) {
  let m = imgCache.get(doc); if (!m) { m = new Map(); imgCache.set(doc, m); }
  if (m.has(src)) return m.get(src);
  const p = (async () => {
    const res = await fetch(src); const buf = new Uint8Array(await res.arrayBuffer());
    const png = buf[0] === 0x89 && buf[1] === 0x50;
    return png ? doc.embedPng(buf) : doc.embedJpg(buf);
  })();
  m.set(src, p);
  return p;
}

/**
 * root = אן עלעמענט וואס איז שוין אויסגעשטעלט (א בלאט, 1px = 0.75pt). מאכט א נייעם בלאט אין doc און צייכנט אים.
 * fs = fontSet(); דערנאך — fs.finalize() איינמאל פארן save().
 */
export async function drawDomPage(PL, doc, fs, root, { widthPt, heightPt }) {
  const { rgb, pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextMatrix, showText, PDFHexString,
    setFillingRgbColor, setStrokingRgbColor, setTextRenderingMode, setLineWidth, TextRenderingMode } = PL;
  const page = doc.addPage([widthPt, heightPt]);
  const R = root.getBoundingClientRect();
  const K = widthPt / R.width;
  const X = (x) => (x - R.left) * K; const Y = (y) => heightPt - (y - R.top) * K;
  const keys = new Map(); // font name → page resource key
  const keyFor = (f) => { if (!keys.has(f.tag)) keys.set(f.tag, page.node.newFontDictionary(f.tag, f.ref)); return keys.get(f.tag); };

  const rect = (x, y, w, h, c, opacity) => page.drawRectangle({ x: X(x), y: Y(y + h), width: w * K, height: h * K, color: rgb(c.r, c.g, c.b), opacity: (opacity ?? 1) * c.a });

  const els = [root, ...root.querySelectorAll('*')];
  for (const el of els) {
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const op = Number(cs.opacity) || 1;
    const r = el.getBoundingClientRect();
    if (r.width < 0.1 || r.height < 0.1) continue;
    // הינטערגרונט
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0.01) rect(r.left, r.top, r.width, r.height, bg, op);
    const gm = /linear-gradient\((.*)\)/.exec(cs.backgroundImage || '');
    if (gm) {
      const cols = [...gm[1].matchAll(/rgba?\([^)]+\)/g)].map((x) => parseColor(x[0])).filter(Boolean);
      if (cols.length > 1) {
        const N = 48;
        for (let i = 0; i < N; i += 1) {
          const t = (i + 0.5) / N; const seg = t * (cols.length - 1); const a = Math.floor(seg); const b = Math.min(cols.length - 1, a + 1); const f = seg - a;
          const c = { r: cols[a].r + (cols[b].r - cols[a].r) * f, g: cols[a].g + (cols[b].g - cols[a].g) * f, b: cols[a].b + (cols[b].b - cols[a].b) * f, a: 1 };
          rect(r.left + (r.width * i) / N, r.top, r.width / N + 0.4, r.height, c, op);
        }
      }
    }
    // ראמען
    [['Top', (w) => [r.left, r.top, r.width, w]], ['Bottom', (w) => [r.left, r.bottom - w, r.width, w]],
      ['Left', (w) => [r.left, r.top, w, r.height]], ['Right', (w) => [r.right - w, r.top, w, r.height]]].forEach(([side, geo]) => {
      const w = parseFloat(cs[`border${side}Width`]); const st = cs[`border${side}Style`];
      const c = parseColor(cs[`border${side}Color`]);
      if (w > 0 && st !== 'none' && st !== 'hidden' && c && c.a > 0) { const [x, y, ww, hh] = geo(w); rect(x, y, ww, hh, c, op); }
    });
    // inset box-shadow (א דינער שטריך) — ווי .cy-new
    const sh = /inset\s+0(?:px)?\s+([\d.]+)px\s+0(?:px)?\s+(rgba?\([^)]+\))|(rgba?\([^)]+\))\s+0(?:px)?\s+([\d.]+)px\s+0(?:px)?\s+0(?:px)?\s+inset/.exec(cs.boxShadow || '');
    if (sh) { const w = Number(sh[1] || sh[4]); const c = parseColor(sh[2] || sh[3]); if (c && w > 0) rect(r.left, r.top, r.width, w, c, op); }
    // בילדער
    if (el.tagName === 'IMG' && el.getAttribute('src')) {
      try {
        const im = await embedImg(doc, el.currentSrc || el.src);
        page.drawImage(im, { x: X(r.left), y: Y(r.bottom), width: r.width * K, height: r.height * K, opacity: op });
      } catch (err) { console.warn('img', err); }
    }
    // טעקסט — יעדער אות באזונדער, ווי דער בלעטערער האט אים געשטעלט
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
      const fill = parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
      const sizePx = parseFloat(cs.fontSize); const weight = Number(cs.fontWeight) || 400;
      const rtl = cs.direction === 'rtl';
      const txt = node.nodeValue; const range = document.createRange();
      const ops = [];
      let tokHeb = false; let tokLtr = false;
      for (let i = 0; i < txt.length; i += 1) {
        const ch = txt[i];
        if (/\s/.test(ch)) { tokHeb = false; tokLtr = false; continue; }
        if (i === 0 || /\s/.test(txt[i - 1])) { // א נייע ווארט: וואס איז אין איר
          let j = i; tokHeb = false; tokLtr = false;
          while (j < txt.length && !/\s/.test(txt[j])) { if (HEB.test(txt[j])) tokHeb = true; else if (LTRCH.test(txt[j])) tokLtr = true; j += 1; }
        }
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rr = range.getClientRects()[0]; if (!rr || rr.width === 0) continue;
        let drawCh = ch;
        if (MIRROR[ch] && (tokHeb || (rtl && !tokLtr))) drawCh = MIRROR[ch];
        const fnt = resolveFont(cs.fontFamily, weight, drawCh);
        if (!fnt) continue;
        const p = fontBytes(fnt.name); const cp = drawCh.codePointAt(0); const g = p.gid(cp);
        const f = fs.use(fnt.name, g, ch.codePointAt(0));
        const sizePt = sizePx * K;
        // באזע-ליניע: דער אות-קעסטל איז ascent+descent
        const tot = p.asc - p.desc; const baseY = rr.top + (rr.height * p.asc) / tot;
        // ברייט: אויב דער בלעטערער האט עס צוזאמגעדריקט (transform scaleX) — דאס זעלבע
        const natural = (p.adv(g) / p.upm) * sizePx; const sx = natural > 0 ? Math.max(0.3, Math.min(2, rr.width / natural)) : 1;
        ops.push({ key: keyFor(f), sizePt, x: X(rr.left), y: Y(baseY), sx: Math.abs(sx - 1) < 0.04 ? 1 : sx, hex: g.toString(16).padStart(4, '0'), faux: fnt.faux });
      }
      if (!ops.length) continue;
      const list = [pushGraphicsState(), setFillingRgbColor(fill.r, fill.g, fill.b), beginText()];
      let lastKey = null; let lastSize = 0; let lastFaux = null;
      ops.forEach((o) => {
        if (o.key !== lastKey || o.sizePt !== lastSize) { list.push(setFontAndSize(o.key, o.sizePt)); lastKey = o.key; lastSize = o.sizePt; }
        if (o.faux !== lastFaux) {
          if (o.faux) list.push(setTextRenderingMode(TextRenderingMode.FillAndOutline), setStrokingRgbColor(fill.r, fill.g, fill.b), setLineWidth(o.sizePt * 0.028));
          else list.push(setTextRenderingMode(TextRenderingMode.Fill));
          lastFaux = o.faux;
        }
        list.push(setTextMatrix(o.sx, 0, 0, 1, o.x, o.y), showText(PDFHexString.of(o.hex)));
      });
      list.push(endText(), popGraphicsState());
      if (op < 1) page.pushOperators(...list); else page.pushOperators(...list);
    }
  }
  return page;
}

/** א קורצער טעקסט (למשל א מספר עמוד) אויף א געוויסן ארט. align: 'left' | 'right'. גיט צוריק די ברייט. */
export function drawPlainText(PL, page, fs, text, { font = 'Guttman David Bold', sizePt = 10, x = 0, y = 0, align = 'left', color = [0, 0, 0], measureOnly = false } = {}) {
  const { pushGraphicsState, popGraphicsState, beginText, endText, setFontAndSize, setTextMatrix, showText, PDFHexString, setFillingRgbColor } = PL;
  const p = fontBytes(font) || fontBytes('Livorna'); if (!p) return 0;
  const name = fontBytes(font) ? font : 'Livorna';
  const vis = HEB.test(text) ? [...text].reverse() : [...text];
  const glyphs = vis.map((ch) => { const cp = (MIRROR[ch] && HEB.test(text) ? MIRROR[ch] : ch).codePointAt(0); return { g: p.gid(cp), cp: ch.codePointAt(0) }; });
  const w = glyphs.reduce((s, o) => s + (p.adv(o.g) / p.upm) * sizePt, 0);
  if (measureOnly) return w;
  let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  const list = [pushGraphicsState(), setFillingRgbColor(...color), beginText()];
  glyphs.forEach((o) => {
    const f = fs.use(name, o.g, o.cp);
    const key = page.node.newFontDictionary(f.tag, f.ref);
    list.push(setFontAndSize(key, sizePt), setTextMatrix(1, 0, 0, 1, cx, y), showText(PDFHexString.of(o.g.toString(16).padStart(4, '0'))));
    cx += (p.adv(o.g) / p.upm) * sizePt;
  });
  list.push(endText(), popGraphicsState());
  page.pushOperators(...list);
  return w;
}
