// בילדער (לאגאס, באנערס, אונטערשריפטן, הינטערגרונטן) אין דרייב פונעם "דאטאבייס" חשבון — דורכן "עוזר התמונות" (Apps Script).
// אין גיליון שטייט נאר "drv:<id>"; אין זכרון (state) — דאס בילד אליין (data:...), אזוי ארבעט די גאנצע אלטע קאוד ווי פריער.
// ווען דער הילף ארבעט נישט → מ'שפייכלט ווי פריער (דאס בילד אינעם תא), גארנישט ווערט פארלוירן.
import { CONFIG } from './config.js';
import { currentToken } from './google.js';

export const IMG_FIELDS = {
  MailTemplates: ['logo_data', 'background_data', 'postage_data'],
  OrgLogos: ['logo_data'],
  OrgDetails: ['header_img', 'signature_img'],
  YearlyCampaigns: ['header_img'],
};
const byId = new Map(); // id → data:
const byData = new Map(); // data: → id
let helperOk = null; // null = נאך נישט פרובירט
export const isDrv = (v) => /^drv:[\w-]+$/.test(String(v || ''));
const isData = (v) => String(v || '').startsWith('data:');
const LS = 'khal-img-';

function cacheGet(id) {
  try { return localStorage.getItem(LS + id) || ''; } catch { return ''; }
}
function cachePut(id, data) {
  try { localStorage.setItem(LS + id, data); } catch { /* פול — נישט קיין פראבלעם */ }
}
function remember(id, data) {
  byId.set(id, data);
  byData.set(data, id);
}

async function call(body, ms = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(CONFIG.IMAGES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // אן "preflight"
      body: JSON.stringify({ ...body, token: currentToken() }),
      signal: ctl.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const helperOn = () => Boolean(CONFIG.IMAGES_URL);
export const helperWorks = () => helperOk;

/** א בילד (data:) → "drv:<id>". ווען עס גייט נישט — דאס בילד אליין (ווי פריער). */
export async function storeImage(data, name = 'image') {
  if (!isData(data) || !helperOn() || helperOk === false) return data;
  if (byData.has(data)) return `drv:${byData.get(data)}`;
  try {
    // בילדער פאר בריוו → די טעקע "תמונות למכתבים" (מ'קען זיי נאכאמאל נוצן)
    const r = await call({ action: 'img_put', data, name, folder: ['letter', 'watermark'].includes(name) ? 'letters' : '' });
    if (!r.id) { helperOk = false; return data; }
    helperOk = true;
    remember(r.id, data);
    cachePut(r.id, data);
    return `drv:${r.id}`;
  } catch {
    helperOk = false;
    return data;
  }
}

/** די בילדער אין דער טעקע "תמונות למכתבים" (מיט קליינע בילדלעך) */
export async function listImages() {
  if (!helperOn()) return { error: 'no-helper', files: [] };
  try {
    const r = await call({ action: 'img_list' }, 30000);
    if (r.error) return { error: r.error, files: [] };
    return { files: Array.isArray(r.files) ? r.files : [] };
  } catch { return { error: 'failed', files: [] }; }
}

/** לייגט אריין אין זכרון די בילדער פון די ids (פון קעש אדער פונעם הילף) */
export async function fetchImages(ids) {
  const need = [];
  [...new Set(ids)].forEach((id) => {
    if (byId.has(id)) return;
    const c = cacheGet(id);
    if (c) remember(id, c); else need.push(id);
  });
  for (let i = 0; i < need.length; i += 10) {
    try {
      const r = await call({ action: 'img_get', ids: need.slice(i, i + 10) }, 8000);
      Object.entries(r.images || {}).forEach(([id, d]) => { remember(id, d); cachePut(id, d); });
      if (r.images) helperOk = true;
    } catch { /* נעקסטע מאל */ }
  }
}
export const imageOf = (v) => (isDrv(v) ? byId.get(String(v).slice(4)) || '' : String(v || ''));

/** פאר א רעקארד וואס מ'שפייכלט: יעדעס בילד (data:) → "drv:<id>". די _2/_3 טיילן ווערן ליידיג. */
export async function persistImages(tab, obj) {
  const fields = IMG_FIELDS[tab];
  if (!fields || !helperOn()) return obj;
  const o = { ...obj };
  for (const f of fields) {
    // א בילד וואס איז צעטיילט אויף 3 תאים — צוזאמען
    const whole = [o[f], o[`${f}_2`], o[`${f}_3`]].map((x) => String(x || '')).join('');
    if (!isData(whole)) continue;
    const v = await storeImage(whole, `${tab}-${f}`);
    if (!isDrv(v)) return obj; // דער הילף ארבעט נישט — אלעס ווי פריער
    o[f] = v;
    if (`${f}_2` in o || f === 'header_img') { o[`${f}_2`] = ''; o[`${f}_3`] = ''; }
  }
  return o;
}

/** נאכן לאדן: אלע "drv:" אין state → די בילדער (אין זכרון). */
export async function resolveState(state) {
  const recs = [...(state.mailTemplates || []), ...(state.orgDetails || []), ...(state.yearly || [])];
  const ids = [];
  const scan = (v) => { if (isDrv(v)) ids.push(String(v).slice(4)); };
  recs.forEach((o) => Object.values(o).forEach(scan));
  // בילדער אינעם טעקסט פון א בריוו און א סימן מים (settings)
  (state.mailTemplates || []).forEach((x) => { for (const m of String(x.settings || '').matchAll(/drv:([\w-]+)/g)) ids.push(m[1]); });
  Object.values(state.orgLogos || {}).forEach(scan);
  if (!ids.length) return;
  await fetchImages(ids);
  // נאר ווען דאס בילד איז געקומען — אנדערש בלייבט "drv:" (אזוי ווערט עס נישט אויסגעמעקט ביים קומענדיגן שפייכלערן)
  const fix = (o) => Object.keys(o).forEach((k) => { if (isDrv(o[k]) && imageOf(o[k])) o[k] = imageOf(o[k]); });
  recs.forEach(fix);
  Object.keys(state.orgLogos || {}).forEach((k) => { if (isDrv(state.orgLogos[k]) && imageOf(state.orgLogos[k])) state.orgLogos[k] = imageOf(state.orgLogos[k]); });
}

/** וויפל בילדער שטייען נאך אינעם גיליון (נישט אין דרייב)? */
export function sheetImageCount(state) {
  let n = 0;
  const has = (o, f) => isData([o[f], o[`${f}_2`], o[`${f}_3`]].map((x) => String(x || '')).join('')) && !byData.has([o[f], o[`${f}_2`], o[`${f}_3`]].map((x) => String(x || '')).join(''));
  (state.mailTemplates || []).forEach((o) => IMG_FIELDS.MailTemplates.forEach((f) => { if (has(o, f)) n++; }));
  (state.orgDetails || []).forEach((o) => IMG_FIELDS.OrgDetails.forEach((f) => { if (has(o, f)) n++; }));
  (state.yearly || []).forEach((o) => IMG_FIELDS.YearlyCampaigns.forEach((f) => { if (has(o, f)) n++; }));
  Object.values(state.orgLogos || {}).forEach((v) => { if (isData(v) && !byData.has(v)) n++; });
  return n;
}
