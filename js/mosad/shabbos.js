// 🕯 דף זמני השבת — זמני ירושלים מהלוח (js/luach/zmanim.js), אורח לסעודה, ואז Word לפי התבנית של הישיבה.
// התבנית: img/mosad/yeshiva/shabbos-template.docx — מחליפים רק את הטקסטים (הרקע, הגופנים והמסגרת נשארים).
import { zmanim, hhmm, LOCATIONS } from '../luach/zmanim.js?v=595';
import { parashaOf, holidayOf } from '../parasha.js?v=595';
import { toHebrew, yearLabel, todayIso, isoToHebrewText } from '../hebdate.js?v=595';

let X = null;
const S = { fri: '' };
const add = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const nextFri = (iso) => { const dw = new Date(`${iso}T12:00:00Z`).getUTCDay(); return add(iso, (5 - dw + 7) % 7); };
const toMin = (t) => { const m = String(t).match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; let h = Number(m[1]); if (h < 12 && h <= 6) h += 12; return h * 60 + Number(m[2]); };

/** ברירות מחדל לשבת הזאת (ירושלים): שקיעה בגובה (650 מ') = מוצ"ש ר"ת − 72; הדלקה = שקיעה − 40 */
function defaults(fri) {
  const sat = add(fri, 1);
  const zf = zmanim(fri, LOCATIONS.jlm); const zs = zmanim(sat, LOCATIONS.jlm);
  const shkF = Math.round(zf.motzei - 72); const shkS = Math.round(zs.motzei - 72);
  const par = holidayOf(sat, true) || parashaOf(sat, true)?.he || '';
  const hy = toHebrew(sat);
  const shach = 9 * 60;
  return {
    parasha: par, year: hy ? yearLabel(hy.y) : '',
    candles: hhmm(shkF - 40, 'floor'), shkia: hhmm(shkF, 'floor'), minchaF: hhmm(shkF - 1, 'floor'),
    guest: '',
    seder: hhmm(shach - 60), shacharis: hhmm(shach), ks: hhmm(zs.maKS, 'floor'),
    minchaS: hhmm(shkS - 10, 'floor'), motzei: hhmm(zs.motzei, 'ceil'),
  };
}

export function initShabbos(ctx) { X = ctx; }
export function renderShabbos(box) {
  const { h } = X;
  if (!S.fri) S.fri = nextFri(todayIso());
  const v = S.v && S.v._fri === S.fri ? S.v : (S.v = { _fri: S.fri, ...defaults(S.fri) });
  const f = (k, l, ph = '') => `<label>${h(l)}<input name="${k}" value="${h(v[k] || '')}" placeholder="${h(ph)}"${/candles|shkia|mincha|seder|shacharis|ks|motzei/.test(k) ? ' dir="ltr" style="width:6em"' : ''}></label>`;
  box.innerHTML = `<h2 class="ms-h">🕯 זמני השבת</h2>
    <div class="ms-bar"><label>ערב שבת <input type="date" id="sb-fri" value="${h(S.fri)}"></label>
      <button type="button" class="btn" id="sb-prev">→ שבוע קודם</button><button type="button" class="btn" id="sb-next">שבוע הבא ←</button>
      <span class="muted small">${h(isoToHebrewText(S.fri))}</span><span class="spacer"></span>
      <button type="button" class="linkish" id="sb-reset">⟳ לחשב מחדש מהלוח</button></div>
    <p class="muted small">הזמנים — לפי ירושלים, מהלוח של הקהילה (שקיעה בגובה; הדלקה 40 דק' לפני; מוצ"ש ר"ת). אפשר לשנות כל זמן לפני ההורדה.</p>
    <form id="sb-form" class="ms-form">
      <fieldset><legend>כותרת</legend><div class="grid">${f('parasha', 'פרשה / שבת')}${f('year', 'שנה')}</div></fieldset>
      <fieldset><legend>ערש"ק</legend><div class="grid">${f('candles', 'הדלקת הנרות')}${f('shkia', 'שקיעה')}${f('minchaF', 'מנחה וסדר לימוד')}</div>
        ${f('guest', 'סעודת ליל שב"ק בראשות (אורח — ריק = בלי)', 'הרה"ג ר\' … שליט"א')}</fieldset>
      <fieldset><legend>יום שבת קודש</legend><div class="grid">${f('seder', 'סדר לימוד (שעה קודם התפילה)')}${f('shacharis', 'שחרית')}${f('ks', 'סוף זמן קרי"ש')}${f('minchaS', 'מנחה ושל"ס')}${f('motzei', 'מוצאי שב"ק (ר"ת)')}</div></fieldset>
      <div class="actions"><span class="spacer"></span><button type="submit" class="btn primary">⬇ Word לפי התבנית</button></div>
    </form>`;
  const form = X.$('#sb-form', box);
  const read = () => { Object.keys(v).forEach((k) => { if (form.elements[k]) v[k] = X.S(form.elements[k].value); }); };
  form.oninput = read;
  const go = (iso) => { read(); S.fri = nextFri(iso); renderShabbos(box); };
  X.$('#sb-fri', box).onchange = (e) => e.target.value && go(e.target.value);
  X.$('#sb-prev', box).onclick = () => go(add(S.fri, -7));
  X.$('#sb-next', box).onclick = () => go(add(S.fri, 7));
  X.$('#sb-reset', box).onclick = () => { const g = v.guest; S.v = { _fri: S.fri, ...defaults(S.fri), guest: g }; renderShabbos(box); };
  form.onsubmit = async (e) => {
    e.preventDefault(); read();
    const bad = ['candles', 'shkia', 'minchaF', 'seder', 'shacharis', 'ks', 'minchaS', 'motzei'].find((k) => toMin(v[k]) === null);
    if (bad) { X.toast('זמן לא תקין (צריך להיות כמו 4:16).', 'err'); form.elements[bad].focus(); return; }
    try { await makeDocx(v); } catch (err) { X.toast(X.msg(err), 'err'); }
  };
}

// ---------- זיפ: לקרוא (inflate דרך DecompressionStream) ולכתוב (בלי דחיסה) ----------
async function unzip(buf) {
  const dv = new DataView(buf); const u8 = new Uint8Array(buf); const dec = new TextDecoder();
  let e = u8.length - 22; while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e -= 1;
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const method = dv.getUint16(p + 10, true); const csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true); const xl = dv.getUint16(p + 30, true); const cl = dv.getUint16(p + 32, true); const lo = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const raw = u8.slice(ds, ds + csize);
    let data = raw;
    if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    out.push([name, data]);
    p += 46 + nl + xl + cl;
  }
  return out;
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i += 1) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(); const parts = []; const cen = []; let off = 0;
  for (const [name, data0] of files) {
    const data = typeof data0 === 'string' ? enc.encode(data0) : data0; const nm = enc.encode(name); const c = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
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

// ---------- להחליף טקסט בתבנית ----------
const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** פסקה → { xml, texts: [{ s, e, t }] } — מיקום של כל <w:t> */
function runsOf(p) {
  const out = []; const re = /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g; let m;
  while ((m = re.exec(p))) out.push({ s: m.index + m[1].length, e: m.index + m[1].length + m[2].length, t: m[2] });
  return out;
}
function setRuns(p, vals) { // vals: מפה index → טקסט חדש (כבר מוצפן)
  const rs = runsOf(p); let out = ''; let last = 0;
  rs.forEach((r, i) => { out += p.slice(last, r.s) + (i in vals ? vals[i] : r.t); last = r.e; });
  out += p.slice(last);
  // רווחים בתחילה/סוף — xml:space="preserve"
  return out.replace(/<w:t>/g, '<w:t xml:space="preserve">');
}
const plain = (p) => runsOf(p).map((r) => r.t).join('').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** הזמן בסוף השורה: הריצה הראשונה עם ספרה (אחרי הנקודות) מקבלת את הזמן, והשאר מתרוקנות */
function setTime(p, time) {
  const rs = runsOf(p); let k = rs.length;
  while (k > 0 && /^[\d:\s]*$/.test(rs[k - 1].t)) k -= 1;
  // ריצה עם נקודות + זמן ביחד (למשל "... 7:52") — מפצלים בתוכה
  if (k > 0 && /\d{1,2}:\d{2}\s*$/.test(rs[k - 1].t) && !rs.slice(k).some((r) => /\d/.test(r.t))) {
    const vals = { [k - 1]: xe(rs[k - 1].t.replace(/\d{1,2}:\d{2}(\s*)$/, `${time}$1`)) };
    for (let i = k; i < rs.length; i += 1) vals[i] = '';
    return setRuns(p, vals);
  }
  if (!rs.slice(k).some((r) => /\d/.test(r.t))) return p;
  while (k < rs.length && !/\d/.test(rs[k].t)) k += 1;
  const vals = {}; const lead = rs[k].t.match(/^\s*/)[0];
  vals[k] = xe(`${lead}${time}${/\s$/.test(rs[rs.length - 1].t) ? ' ' : ''}`);
  for (let i = k + 1; i < rs.length; i += 1) vals[i] = '';
  return setRuns(p, vals);
}
async function makeDocx(v) {
  const res = await fetch(new URL('../../img/mosad/yeshiva/shabbos-template.docx', import.meta.url));
  if (!res.ok) throw new Error('התבנית לא נמצאה.');
  const blob = await build(await res.arrayBuffer(), v);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `זמני השבת - ${v.parasha} ${v.year}.docx`.replace(/["/\\?*:|<>]/g, '');
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function build(buf, v) {
  const files = await unzip(buf);
  const di = files.findIndex(([n]) => n === 'word/document.xml');
  let xml = new TextDecoder().decode(files[di][1]);
  xml = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => {
    const t = plain(p);
    if (/^ערב\s+שב"ק/.test(t)) { const rs = runsOf(p); const vals = {}; rs.forEach((r, i) => { vals[i] = i === 0 ? xe(`ערב שב"ק ${v.parasha} ${v.year}`.replace(/\s+/g, ' ')) : ''; }); return setRuns(p, vals); }
    if (/^הדלקת הנרות/.test(t)) return setTime(p, v.candles);
    if (/^שקיעה/.test(t)) return setTime(p, v.shkia);
    if (/^מנחה\s+וסדר/.test(t)) return setTime(p, v.minchaF);
    if (/^סעודת ליל/.test(t)) { const rs = runsOf(p); const vals = {}; rs.forEach((r, i) => { vals[i] = i === 0 ? xe(`סעודת ליל שב"ק${v.guest ? ` בראשות ${v.guest}` : ''}`) : ''; }); return setRuns(p, vals); }
    if (/^סדר לימוד/.test(t)) return setTime(p, v.seder);
    if (/^שחרית/.test(t)) return setTime(p, v.shacharis);
    if (/^סוף זמן/.test(t)) return setTime(p, v.ks);
    if (/^מנחה\s+ושל"ס/.test(t)) return setTime(p, v.minchaS);
    if (/^מוצאי/.test(t)) return setTime(p, v.motzei);
    return p;
  });
  files[di] = ['word/document.xml', xml];
  return zip(files);
}
// לבדיקה (node)
export const _test = { defaults, setTime, plain, runsOf, unzip, zip, build };
