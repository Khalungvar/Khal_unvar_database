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
  Books: ['image'],
};
const byId = new Map(); // id → data:
const byData = new Map(); // data: → id
let helperOk = null; // null = נאך נישט פרובירט
export const isDrv = (v) => /^drv:[\w-]+$/.test(String(v || ''));
const isData = (v) => String(v || '').startsWith('data:');
const LS = 'khal-img-';

// דער קעש פון בילדער: אין IndexedDB (גרויס). פריער איז עס געווען אין localStorage (ביז 5MB) — מיט די פנים
// פון "רשימות משתתפים" איז עס געווארן פול, און דאן האט מען יעדעס מאל ווידער געלאדן לאגאס/בריוו-בילדער (פאמעלעך).
let dbP = null;
function idb() {
  if (!dbP) {
    dbP = new Promise((res) => {
      try {
        const r = indexedDB.open('khal-img', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('img')) r.result.createObjectStore('img'); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      } catch { res(null); }
    });
  }
  return dbP;
}
async function idbGetMany(ids) {
  const out = {};
  if (!ids.length) return out;
  const db = await idb();
  if (!db) return out;
  return new Promise((res) => {
    try {
      const tx = db.transaction('img');
      const st = tx.objectStore('img');
      ids.forEach((id) => { const q = st.get(id); q.onsuccess = () => { if (q.result) out[id] = q.result; }; });
      tx.oncomplete = () => res(out);
      tx.onerror = () => res(out);
      tx.onabort = () => res(out);
    } catch { res(out); }
  });
}
function cacheGet(id) { // אלטער קעש (localStorage) — ווערט אריבערגעטראגן אין IndexedDB
  try { return localStorage.getItem(LS + id) || ''; } catch { return ''; }
}
function cachePut(id, data) {
  idb().then((db) => { if (!db) return; try { db.transaction('img', 'readwrite').objectStore('img').put(data, id); } catch { /* */ } });
}
/** איינמאל: די בילדער פון localStorage → IndexedDB, און localStorage ווערט באפרייט */
let migrated = false;
export function migrateImageCache() {
  if (migrated) return;
  migrated = true;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); if (k && k.startsWith(LS)) keys.push(k); }
    if (!keys.length) return;
    idb().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction('img', 'readwrite');
        const st = tx.objectStore('img');
        keys.forEach((k) => { const v = localStorage.getItem(k); if (v) st.put(v, k.slice(LS.length)); });
        tx.oncomplete = () => { keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } }); };
      } catch { /* */ }
    });
  } catch { /* */ }
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
  let need = [];
  [...new Set(ids)].forEach((id) => {
    if (byId.has(id)) return;
    const c = cacheGet(id);
    if (c) remember(id, c); else need.push(id);
  });
  if (need.length) {
    const got = await idbGetMany(need);
    Object.entries(got).forEach(([id, d]) => remember(id, d));
    need = need.filter((id) => !got[id]);
  }
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
  const recs = [...(state.mailTemplates || []), ...(state.orgDetails || []), ...(state.yearly || []), ...(state.books || [])];
  const ids = [];
  const scan = (v) => { if (isDrv(v)) ids.push(String(v).slice(4)); };
  recs.forEach((o) => Object.values(o).forEach(scan));
  // בילדער אינעם טעקסט פון א בריוו און א סימן מים (settings)
  (state.mailTemplates || []).forEach((x) => { for (const m of String(x.settings || '').matchAll(/drv:([\w-]+)/g)) ids.push(m[1]); });
  Object.values(state.orgLogos || {}).forEach(scan);
  setTimeout(migrateImageCache, 3000);
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
