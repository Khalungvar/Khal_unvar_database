// ⬇ וורד: דער בלאט פון ימות החול → .docx. די מסגרת = א בילד הינטער דעם טעקסט; דער טעקסט = אמת'ער טעקסט (מ'קען עס טוישן).
// מ'מעסט די גרייסן און ערטער פונעם בלאט וואס איז שוין אויפן עקראן (נאך fitPages), אז אין וורד זאל עס אויסזען די זעלבע.
import { htmlToJpeg } from '../pdf.js';

// ---------- זיפ (אן צוזאמענדריקן) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i += 1) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files) {
  const enc = new TextEncoder(); const parts = []; const cen = []; let off = 0;
  for (const [name, data0] of files) {
    const data = typeof data0 === 'string' ? enc.encode(data0) : data0; const nm = enc.encode(name); const c = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint32(14, c, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(lh.buffer), nm, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cen.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const cs = cen.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------- וורד XML ----------
const X = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TW = (px) => Math.max(0, Math.round(px * 15)); // 1px = 15 twips
const HP = (px) => Math.max(2, Math.round(px * 1.5)); // halbe פונקטן
const HEB = /[֐-׿]/;

/** טעקסט-שטיקלעך פון אן עלעמענט: { t, size, bold, font, white, bg, raise } */
function runsOf(el, heFont) {
  const out = [];
  const walk = (node) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) {
        const p = ch.parentElement; const cs = getComputedStyle(p);
        let t = ch.nodeValue.replace(/\s+/g, ' '); if (!t) continue;
        const fam = cs.fontFamily || ''; const isNum = /Times|Liberation Serif/i.test(fam.split(',')[0]);
        const nw = p.closest('.tp-new');
        out.push({ t, size: parseFloat(cs.fontSize), bold: Number(cs.fontWeight) >= 600 || cs.fontWeight === 'bold', font: isNum ? 'Times New Roman' : heFont, white: !!nw || cs.color === 'rgb(255, 255, 255)', bg: nw ? '000000' : '', raise: nw ? 0.35 : 0 });
      } else if (ch.nodeType === 1) {
        if (ch.classList.contains('t') && ch.parentElement?.classList.contains('tp-rbl')) continue; // די כותרת פון כ"ק — באזונדער
        const cs = getComputedStyle(ch);
        const padS = parseFloat(cs.marginInlineStart || cs.marginRight) || 0; const padE = parseFloat(cs.marginInlineEnd || cs.marginLeft) || 0;
        if (padS > 2 && out.length) out.push({ t: ' ', size: parseFloat(cs.fontSize), font: heFont });
        walk(ch);
        if (padE > 2 || ch.classList.contains('dot')) out.push({ t: ' ', size: parseFloat(cs.fontSize), font: heFont });
        if (ch.classList.contains('dot') && out.length > 1) out.splice(out.length - 2, 0, { t: ' ', size: parseFloat(cs.fontSize), font: heFont });
      }
    }
  };
  walk(el);
  return out;
}
const runXml = (r) => {
  const rtl = HEB.test(r.t) || !/\d/.test(r.t);
  const rp = `<w:rPr><w:rFonts w:ascii="${X(r.font)}" w:hAnsi="${X(r.font)}" w:cs="${X(r.font)}"/>${r.bold ? '<w:b/><w:bCs/>' : ''}${r.white ? '<w:color w:val="FFFFFF"/>' : ''}${r.raise ? `<w:position w:val="${Math.round(r.size * 1.5 * r.raise)}"/>` : ''}<w:sz w:val="${HP(r.size)}"/><w:szCs w:val="${HP(r.size)}"/>${r.bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${r.bg}"/>` : ''}${rtl ? '<w:rtl/>' : ''}</w:rPr>`;
  return `<w:r>${rp}<w:t xml:space="preserve">${X(r.t)}</w:t></w:r>`;
};
const para = (runs, { jc = 'center', before = 0, line = 0, pageBreak = false, extra = '' } = {}) => `<w:p><w:pPr>${pageBreak ? '<w:pageBreakBefore/>' : ''}<w:bidi/><w:spacing w:before="${TW(before)}" w:after="0"${line ? ` w:line="${Math.max(20, TW(line))}" w:lineRule="exact"` : ''}/><w:jc w:val="${jc}"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>${extra}${runs.map(runXml).join('')}</w:p>`;
const spacer = (h, extra = '', pageBreak = false) => `<w:p><w:pPr>${pageBreak ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="0" w:after="0" w:line="${Math.max(20, TW(h))}" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>${extra}</w:p>`;
const bd = (sz, v = 'single') => ['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="${v}" w:sz="${sz}" w:space="0" w:color="000000"/>`).join('');
/** א טאבעלע מיט איין שורה. cells: [{ w, runs, jc }]; fill = שווארץ */
function table(cells, { h, fill = '', border = 0, center = false, width = 0, padX = 0 }) {
  const tw = width ? `<w:tblW w:w="${TW(width)}" w:type="dxa"/>` : '<w:tblW w:w="0" w:type="auto"/>';
  const ins = '<w:insideH w:val="nil"/><w:insideV w:val="nil"/>';
  const brd = border ? `<w:tblBorders>${bd(border)}${ins}</w:tblBorders>` : `<w:tblBorders>${bd(0, 'nil')}${ins}</w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:bidiVisual/>${tw}${center ? '<w:jc w:val="center"/>' : ''}${brd}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:tblLayout w:type="${width ? 'fixed' : 'autofit'}"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="${TW(padX)}" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="${TW(padX)}" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${cells.map((c) => `<w:gridCol w:w="${TW(c.w)}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:trHeight w:val="${TW(h)}" w:hRule="exact"/>${center ? '<w:jc w:val="center"/>' : ''}</w:trPr>
${cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${width ? TW(c.w) : 0}" w:type="${width ? 'dxa' : 'auto'}"/>${fill ? `<w:tcBorders>${['top', 'left', 'bottom', 'right'].map((x) => `<w:${x} w:val="nil"/>`).join('')}</w:tcBorders>` : ''}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${para(c.runs, { jc: c.jc || 'center' })}</w:tc>`).join('')}</w:tr></w:tbl>`;
}

/** בילד הינטער דעם טעקסט, אויף דעם גאנצן בלאט */
const anchor = (id, wIn, hIn) => { const cx = Math.round(wIn * 914400); const cy = Math.round(hIn * 914400);
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="frame${id}"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="frame.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdFrame"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`; };

/** pages = די .tp-page עלעמענטן אויפן עקראן (ימות החול); size = { w, h } אינטשעס */
export async function weekdayDocx(pages, { size, font, css }) {
  // די מסגרת: א בלאט אן טעקסט → בילד
  const pg0 = pages[0].cloneNode(true); pg0.querySelector('.tp-in').innerHTML = '';
  const fr = await htmlToJpeg(`<style>${css}</style>${pg0.outerHTML}`, { widthIn: size.w, heightIn: size.h, scale: 2, quality: 0.92 });
  const body = []; let margins = null;
  pages.forEach((pg, pi) => {
    const inn = pg.querySelector('.tp-in'); const k = pg.getBoundingClientRect().width / pg.offsetWidth || 1;
    const R0 = inn.getBoundingClientRect(); const PR = pg.getBoundingClientRect();
    const VS = 0.965; // וורד איז א ביסל העכער
    const Y = (r) => (r.top - R0.top) / k * VS; const H = (r) => r.height / k * VS; const W = (r) => r.width / k;
    if (!margins) margins = { l: (R0.left - PR.left) / k, r: (PR.right - R0.right) / k, t: (R0.top - PR.top) / k, b: 8 };
    const blocks = [...inn.children].flatMap((c) => (c.classList.contains('tp-times') ? [...c.children] : [c]));
    let y = 0; let first = true;
    const gap = (top) => { const g = Math.max(0, top - y); return g; };
    const lead = () => { const x = first ? anchor(pi + 1, size.w, size.h) : ''; const pb = first && pi > 0; first = false; return { x, pb }; };
    for (const el of blocks) {
      const r = el.getBoundingClientRect(); let top = Y(r); const hh = H(r);
      if (el.classList.contains('tp-band') || el.classList.contains('tp-rbl')) {
        if (el.classList.contains('tp-rbl')) {
          // די כותרת אויבן (א קליינע מסגרת), און דערנאך די משבצת
          const t = el.querySelector(':scope > .t'); const tr = t.getBoundingClientRect();
          const { x, pb } = lead(); body.push(spacer(gap(Y(tr)), x, pb));
          const tcs = getComputedStyle(t);
          body.push(table([{ w: W(tr) * 1.3, runs: runsOf(t, font) }], { h: H(tr), width: W(tr) * 1.3, border: Math.round(parseFloat(tcs.borderTopWidth) * 6) || 8, center: true, padX: 4 }));
          y = Y(tr) + H(tr);
          body.push(spacer(Math.max(1, top - y)));
          const cs = getComputedStyle(el);
          body.push(table([{ w: Math.min(W(R0), W(r) * 1.12), runs: runsOf(el, font) }], { h: hh, width: Math.min(W(R0), W(r) * 1.12), border: Math.round(parseFloat(cs.borderTopWidth) * 6) || 12, center: true, padX: parseFloat(cs.paddingLeft) || 0 }));
        } else {
          const { x, pb } = lead(); body.push(spacer(gap(top), x, pb));
          const ch = [...el.children]; const cw = ch.map((c) => W(c.getBoundingClientRect())); const tot = W(r);
          const need = Math.max(cw[0] || 0, cw[2] || 0) * 1.12 + 14; const mid = Math.max((cw[1] || 0) * 1.15, Math.min(tot - 2 * need, tot * 0.6)); const side = (tot - mid) / 2;
          body.push(table([
            { w: side, runs: ch[0] ? runsOf(ch[0], font) : [], jc: 'left' },
            { w: mid, runs: ch[1] ? runsOf(ch[1], font) : [] },
            { w: side, runs: ch[2] ? runsOf(ch[2], font) : [], jc: 'right' },
          ], { h: hh, fill: '000000', width: tot, padX: 6 }));
        }
        y = top + hh; continue;
      }
      const { x, pb } = lead();
      body.push(para(runsOf(el, font), { before: gap(top), line: hh, pageBreak: pb, extra: x }));
      y = top + hh;
    }
  });
  const m = margins || { l: 62, r: 62, t: 62, b: 8 };
  const sect = `<w:sectPr><w:pgSz w:w="${Math.round(size.w * 1440)}" w:h="${Math.round(size.h * 1440)}"/><w:pgMar w:top="${TW(m.t)}" w:right="${TW(m.r)}" w:bottom="${TW(m.b)}" w:left="${TW(m.l)}" w:header="0" w:footer="0" w:gutter="0"/><w:bidi/></w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('')}${sect}</w:body></w:document>`;
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFrame" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frame.jpeg"/><Relationship Id="rIdSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>'],
    ['word/settings.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>'],
    ['word/document.xml', doc],
    ['word/media/frame.jpeg', fr.bytes],
  ];
  return zip(files);
}
