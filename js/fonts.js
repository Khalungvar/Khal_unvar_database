// שריפטן (פאנטס) וואס דער בעל הבית לייגט ארויף — באצאלטע שריפטן.
// זיי ווערן געהאלטן אינעם פריוואטן גיליון (לשונית Fonts, די טעקע צוטיילט אויף שטיקלעך פון 45,000 אותיות),
// נישט אינעם עפנטליכן קאד — אזוי קען זיי נאר באקומען ווער עס איז אריין אינעם אתר.
// אן אריגינעלע קאפיע גייט אויך אין דרייב פון "דאטאבייס" (Fonts).
import { readTabs, readColumn, appendRows, batchUpdate } from './google.js';
import { saveOriginalToDrive, state } from './data.js';
import { nowStamp } from './util.js';

const TAB = 'Fonts';
const CHUNK = 45000;
const FORMATS = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' };
const MIME = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

/** [{ name, format, dataUrl, driveId, updatedAt }] */
let fonts = [];
const loaded = new Set();

export const customFonts = () => fonts;
export const customFontNames = () => fonts.map((f) => f.name);

/** לייענט די שריפטן פונעם גיליון און לייגט זיי צו צום בלאט (מ'רופט נאכן אריינגיין) */
export async function loadFonts() {
  let rows = [];
  try { rows = (await readTabs([TAB]))[TAB] || []; } catch { fonts = []; return fonts; }
  const [head = [], ...body] = rows;
  const ix = (k) => head.indexOf(k);
  const by = new Map();
  body.forEach((r) => {
    const name = String(r[ix('font_name')] || '').trim();
    if (!name) return;
    const f = by.get(name) || { name, parts: [], format: '', driveId: '', updatedAt: '' };
    f.parts[Number(r[ix('part')]) || 0] = String(r[ix('data')] || '');
    if (r[ix('format')]) f.format = String(r[ix('format')]);
    if (r[ix('drive_id')]) f.driveId = String(r[ix('drive_id')]);
    if (r[ix('updated_at')]) f.updatedAt = String(r[ix('updated_at')]);
    by.set(name, f);
  });
  fonts = [...by.values()].map((f) => ({ ...f, dataUrl: `data:${MIME[f.format] || 'font/ttf'};base64,${f.parts.join('')}` }));
  await Promise.all(fonts.map(register));
  return fonts;
}

async function register(f) {
  if (loaded.has(f.name)) return;
  try {
    const src = `url(${f.dataUrl}) format('${FORMATS[f.format] || 'truetype'}')`;
    const face = new FontFace(f.name, src);
    await face.load();
    document.fonts.add(face);
    // "Livorna Bold" → אויך דער פעטער (700) פון "Livorna", אז <b> זאל נוצן דעם אמת'ן פעטן שריפט
    const base = boldBase(f.name);
    if (base) { const bf = new FontFace(base, src, { weight: '700' }); await bf.load(); document.fonts.add(bf); }
    loaded.add(f.name);
  } catch (err) { console.warn('font', f.name, err); }
}

/** @font-face פאר די שריפטן — צו לייגן אין א PDF/בילד (דארט קען מען נישט נעמען דרויסנדיגע שריפטן) */
const boldBase = (name) => { const m = /^(.+?)[\s_-]*bold$/i.exec(String(name).trim()); return m ? m[1].trim() : ''; };

export function customFontCss() {
  return fonts.map((f) => {
    const src = `url(${f.dataUrl}) format('${FORMATS[f.format] || 'truetype'}')`;
    const base = boldBase(f.name);
    return `@font-face{font-family:'${f.name.replace(/'/g, '')}';src:${src};}${base ? `@font-face{font-family:'${base.replace(/'/g, '')}';font-weight:700;src:${src};}` : ''}`;
  }).join('\n');
}

const toBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** ארויפלייגן א שריפט (אדער אריבערשרייבן מיט דעם זעלבן נאמען) */
export async function uploadFont(file, name) {
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  if (!FORMATS[ext]) throw new Error('bad-font');
  if (file.size > 3 * 1024 * 1024) throw new Error('font-too-big');
  const clean = String(name || '').trim() || file.name.replace(/\.[^.]+$/, '');
  // ערשט פרובירן אויב דער בראוזער קען עס לייענען
  const b64 = await toBase64(file);
  const test = new FontFace(`test-${Date.now()}`, `url(data:${MIME[ext]};base64,${b64})`);
  try { await test.load(); } catch { throw new Error('bad-font'); }
  let driveId = '';
  try { driveId = await saveOriginalToDrive(file, 'Fonts', clean); } catch { driveId = ''; }
  await removeFont(clean);
  const stamp = nowStamp();
  const rows = [];
  for (let i = 0, p = 0; i < b64.length; i += CHUNK, p += 1) rows.push([clean, p, b64.slice(i, i + CHUNK), ext, driveId, stamp, state.email]);
  // נישט מער ווי ~40 שורות אויף איין מאל
  for (let i = 0; i < rows.length; i += 40) await appendRows(TAB, rows.slice(i, i + 40));
  loaded.delete(clean);
  return clean;
}

/** אויסמעקן א שריפט (אלע זיינע שורות ווערן ליידיג) */
export async function removeFont(name) {
  const col = await readColumn(TAB, 'A');
  const data = [];
  col.forEach((v, i) => { if (i > 0 && String(v || '').trim() === name) data.push({ range: `${TAB}!A${i + 1}:G${i + 1}`, values: [['', '', '', '', '', '', '']] }); });
  for (let i = 0; i < data.length; i += 200) await batchUpdate(data.slice(i, i + 200));
}
