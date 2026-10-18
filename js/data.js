// שכבת הנתונים: מתרגמת בין שורות בגליון לבין אובייקטים, לפי שמות העמודות בשורה 1.
// ככה הוספה או הזזה של עמודה בגליון לא שוברת את התוכנה.
import {
  readTabs, readColumn, readCell, appendRow, appendRows, updateRow, updateCell, updateRange,
  ensureDriveScope, hasDriveScope, driveFolder, driveUpload,
  pickSheet, sheetPermissions, shareSheet, unshareSheet,
} from './google.js';
import { CONFIG } from './config.js';
import { nowStamp } from './util.js';
import { t } from './i18n.js';

export const state = {
  email: '',
  isAdmin: false,
  headers: {},       // { Contacts: [...], Phones: [...] }
  contacts: [],      // אובייקטים, עם _row (מספר השורה בגליון)
  phones: new Map(), // contact_id → אובייקט טלפונים
  areas: [],         // [{ name, zips, keywords }] — זיהוי געגנט לפי כתובת
  donations: [],     // תרומות, כולל _row
  relations: [],     // { relation_id, contact_id_a, relation_type, contact_id_b, _row }
  occasions: [],
  orgNotes: [],
  campaigns: [],
  yearly: [],
  orgDetails: [],     // פרטים פאר קבלות: { org, legal_name, address, city_state_zip, phone, email, website, ein, is_501c3, signer_name, signer_title, receipt_prefix, receipt_note, thanks_yi }
  receipts: [],       // אלע קבלות / Invoices וואס זענען ארויסגעגעבן (לשונית Receipts)        // יערליכע קאמפיינען (YearlyCampaigns): { series, org, event_tags, note, active, order }
  savedLists: [],
  mailTemplates: [],
  messages: [],
  tasks: [],
  orgLogos: {},      // { 'ביהמ"ד מאנסי': dataURL }         // To Do: משימות (אויך צו אנדערע)      // מעסעדזשעס צווישן די באנוצער (און בקשות גישה) // Mail Merge: אפגעהיטענע עיצובים פון קאנווערטן / לעיבלס    // רשימות שמורות (תנאים + עמודות)     // { campaign, org } — לאיזה ארגון שייך כל קאמפיין      // לשונית "ארגון": תיבות טקסט לכל איש קשר     // מאורעות: יארצייט, געבורטסטאג, חתונה...
  lists: {},         // { title_he: [...], ... }
  titleHeToEn: {},
  titleEnToHe: {},
  relationReverse: {},
};

function rowsToObjects(rows) {
  const [header = [], ...body] = rows;
  const objects = body
    .map((r, i) => {
      const o = { _row: i + 2 };
      header.forEach((h, j) => { if (h) o[h] = r[j] ?? ''; });
      return o;
    })
    .filter((o) => header.some((h) => h && o[h] !== ''));
  return { header, objects };
}

function objectToRow(header, o) {
  return header.map((h) => (o[h] === undefined || o[h] === null ? '' : o[h]));
}

function parseLists(rows) {
  const [header = [], ...body] = rows;
  const cols = {};
  header.forEach((h, j) => {
    if (h) cols[h] = body.map((r) => (r[j] ?? '')).map((v) => String(v).trim());
  });
  const lists = {};
  for (const [h, values] of Object.entries(cols)) lists[h] = values.filter(Boolean);
  state.rawLists = cols;

  // טבלאות התאמה: השורה ה-i בעמודה אחת מתאימה לשורה ה-i בעמודה השנייה
  const pair = (a, b) => {
    const map = {};
    (cols[a] || []).forEach((v, i) => { if (v && cols[b]?.[i]) map[v] = cols[b][i]; });
    return map;
  };
  const split = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const areas = (cols.area || []).map((name, i) => ({
    name, zips: split(cols.area_zips?.[i]), keywords: split(cols.area_keywords?.[i]),
  })).filter((x) => x.name);
  return {
    lists,
    areas,
    titleHeToEn: pair('title_he', 'title_he_default_en'),
    titleEnToHe: pair('title_en', 'title_en_default_he'),
    relationReverse: pair('relation_type', 'relation_reverse'),
  };
}

export async function loadAll() {
  const tabs = await readTabs(['Contacts', 'Phones', 'Lists', 'Settings', 'Relations', 'Donations', 'Occasions', 'OrgNotes', 'Campaigns', 'SavedLists', 'MailTemplates', 'Messages', 'Tasks', 'OrgLogos', 'YearlyCampaigns', 'OrgDetails', 'Receipts']);

  const contacts = rowsToObjects(tabs.Contacts);
  state.headers.Contacts = contacts.header;
  state.contacts = contacts.objects;

  const phones = rowsToObjects(tabs.Phones);
  state.headers.Phones = phones.header;
  state.phones = new Map(phones.objects.map((p) => [String(p.contact_id), p]));

  const donations = rowsToObjects(tabs.Donations);
  state.headers.Donations = donations.header;
  state.donations = donations.objects;

  const msgs = rowsToObjects(tabs.Messages || []);
  state.headers.Messages = msgs.header;
  state.messages = msgs.objects;

  const tasks = rowsToObjects(tabs.Tasks || []);
  state.headers.Tasks = tasks.header;
  state.tasks = tasks.objects;

  const logos = rowsToObjects(tabs.OrgLogos || []);
  state.headers.OrgLogos = logos.header;
  state.orgLogos = Object.fromEntries(logos.objects.filter((x) => x.org && x.logo_data).map((x) => [x.org, x.logo_data]));

  const mt = rowsToObjects(tabs.MailTemplates || []);
  state.headers.MailTemplates = mt.header;
  state.mailTemplates = mt.objects;

  const saved = rowsToObjects(tabs.SavedLists);
  state.headers.SavedLists = saved.header;
  state.savedLists = saved.objects;

  const campaigns = rowsToObjects(tabs.Campaigns);
  state.headers.Campaigns = campaigns.header;
  state.campaigns = campaigns.objects;

  const od = rowsToObjects(tabs.OrgDetails || [['org']]);
  state.headers.OrgDetails = od.header;
  state.orgDetails = od.objects.filter((o) => String(o.org || '').trim());
  const rc = rowsToObjects(tabs.Receipts || [['receipt_no']]);
  state.headers.Receipts = rc.header;
  state.receipts = rc.objects.filter((r) => String(r.receipt_no || '').trim());

  const yearly = rowsToObjects(tabs.YearlyCampaigns || [['series']]);
  state.headers.YearlyCampaigns = yearly.header;
  state.yearly = yearly.objects.filter((y) => String(y.series || '').trim());

  const orgNotes = rowsToObjects(tabs.OrgNotes);
  state.headers.OrgNotes = orgNotes.header;
  state.orgNotes = orgNotes.objects;

  const occasions = rowsToObjects(tabs.Occasions);
  state.headers.Occasions = occasions.header;
  state.occasions = occasions.objects;

  const relations = rowsToObjects(tabs.Relations);
  state.headers.Relations = relations.header;
  state.relations = relations.objects;

  Object.assign(state, parseLists(tabs.Lists));

  const settings = rowsToObjects(tabs.Settings).objects;
  const [sHead = [], ...sBody] = tabs.Settings || [];
  state.rawSettings = Object.fromEntries(sHead.filter(Boolean).map((hd) => [hd, sBody.map((r) => String(r[sHead.indexOf(hd)] ?? '').trim())]));
  const admins = settings.map((s) => String(s.admin_email || '').trim().toLowerCase()).filter(Boolean);
  state.admins = admins;
  state.isAdmin = admins.includes(state.email);
  // נאר ווער עס איז רעגיסטרירט אין אדמין (מנהל אדער גבאי) קען אריין
  const gabbaim = settings.map((s) => String(s.gabbai_email || '').trim().toLowerCase()).filter(Boolean);
  state.isAllowed = state.isAdmin || gabbaim.includes(state.email);
  // בעל הבית (Settings → owner_email): נאר ער זעט "מנהלים, גבאים און צוטריט". די לשונית Settings איז
  // אויך פארשלאסן אין גוגל שיטס (Protected range) — נאר ער קען זי טוישן, אפילו גלייך אין שיט.
  const owners = settings.map((s) => String(s.owner_email || '').trim().toLowerCase()).filter(Boolean);
  state.isOwner = owners.length ? owners.includes(state.email) : state.isAdmin;
}

/** המספר הבא, לפי מה שכתוב בגליון ממש עכשיו (למקרה שגבאי אחר הוסיף בינתיים). */
async function nextContactId() {
  const ids = (await readColumn('Contacts', 'A')).slice(1).map(Number).filter(Number.isFinite);
  return Math.max(CONFIG.FIRST_CONTACT_ID - 1, ...ids) + 1;
}

/** מוצא את מספר השורה של איש קשר לפי ה-ID שלו, לפי הגליון העדכני. */
async function findRow(tab, contactId) {
  const ids = await readColumn(tab, 'A');
  const idx = ids.findIndex((v, i) => i > 0 && String(v) === String(contactId));
  return idx > 0 ? idx + 1 : null;
}

// ---------- היסטאריע פון ענדערונגען (לשונית History) ----------
const SKIP_FIELDS = new Set(['contact_id', 'donation_id', 'occasion_id', 'note_id', 'relation_id', '_row', 'updated_at', 'updated_by', 'created_at', 'created_by', 'unverified_fields', 'photo_data', 'logo_data']);
let historyCache = null;

/** ליידיג = פאלש (אדער "לעבט"/"אקטיוו"/USA ביי די פעלדער וואס דאס איז זייער סטאנדארט) — נישט קיין ענדערונג. */
function sameValue(k, o, n) {
  const norm = (v) => {
    let x = String(v ?? '').trim();
    if (!x && (/(^|_)is_(alive|active)$/.test(k))) x = 'true';
    if (!x && k === 'country') x = 'USA';
    if (/^(false|FALSE)$/.test(x)) x = '';
    if (/^(true|TRUE)$/.test(x)) x = 'true';
    return x;
  };
  return norm(o) === norm(n);
}

/** רעכנט אויס וואס האט זיך געטוישט און שרייבט עס אין History (א פעלער דא שטערט נישט דאס אפהיטן). */
async function logChanges(entity, entityId, contactId, before, after, kind = '') {
  try {
    const at = nowStamp();
    const rows = [];
    const base = [at, state.email, entity, String(entityId ?? ''), String(contactId ?? '')];
    if (kind) rows.push([...base, '*', '', kind]);
    else {
      const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
      keys.forEach((k) => {
        if (SKIP_FIELDS.has(k)) return;
        const o = before?.[k] ?? '';
        const n = after?.[k] ?? '';
        if (sameValue(k, o, n)) return;
        if (after && !(k in after)) return; // א פעלד וואס מען האט נישט געשיקט — נישט געטוישט
        rows.push([...base, k, String(o).slice(0, 500), String(n).slice(0, 500)]);
      });
    }
    if (rows.length) {
      await appendRows('History', rows);
      historyCache = null;
    }
  } catch (err) { console.warn('history log failed', err); }
}

/** די ענדערונגען פון א קאנטאקט (אויך זיינע טעלעפאנען, נדבות, מאורעות...) — די נייסטע פריער. */
export async function getHistory(contactId) {
  if (!historyCache) {
    const tabs = await readTabs(['History']);
    const [hd = [], ...body] = tabs.History || [];
    historyCache = body.map((r) => Object.fromEntries(hd.map((k, i) => [k, r[i] ?? ''])));
  }
  return historyCache.filter((x) => String(x.contact_id) === String(contactId)).reverse();
}

/** שומר איש קשר (חדש או קיים) ואת הטלפונים שלו. מחזיר את ה-ID. */
export async function saveContact(contact, phones) {
  const stamp = nowStamp();
  const c = { ...contact, updated_at: stamp, updated_by: state.email };
  const isNew = !c.contact_id;

  if (isNew) {
    c.contact_id = await nextContactId();
    c.created_at = stamp;
    c.created_by = state.email;
    if (c.is_active === '' || c.is_active === undefined) c.is_active = true;
    await appendRow('Contacts', objectToRow(state.headers.Contacts, c));
  } else {
    const row = await findRow('Contacts', c.contact_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('Contacts', row, objectToRow(state.headers.Contacts, c));
  }

  const p = { ...phones, contact_id: c.contact_id };
  const hasPhones = Object.entries(p).some(([k, v]) => k !== 'contact_id' && String(v).trim());
  const phoneRow = await findRow('Phones', c.contact_id);
  if (phoneRow) await updateRow('Phones', phoneRow, objectToRow(state.headers.Phones, p));
  else if (hasPhones) await appendRow('Phones', objectToRow(state.headers.Phones, p));

  if (isNew) await logChanges('contact', c.contact_id, c.contact_id, null, null, 'created');
  else {
    const before = state.contacts.find((x) => String(x.contact_id) === String(c.contact_id)) || {};
    await logChanges('contact', c.contact_id, c.contact_id, before, c);
  }
  await logChanges('phones', c.contact_id, c.contact_id, state.phones.get(String(c.contact_id)) || {}, p);
  return c.contact_id;
}

/** שומר רק את הקוויטל של איש קשר (טקסט עם שורות). */
export async function saveKvitel(contact, text) {
  const row = await findRow('Contacts', contact.contact_id);
  if (!row) throw new Error(t('notFound'));
  const c = { ...contact, kvitel: text, updated_at: nowStamp(), updated_by: state.email };
  await updateRow('Contacts', row, objectToRow(state.headers.Contacts, c));
  await logChanges('contact', contact.contact_id, contact.contact_id, { kvitel: contact.kvitel || '' }, { kvitel: text });
}

// ---------- תרומות ----------
/** שומר תרומה (חדשה או קיימת). מחזיר את ה-donation_id. */
export async function saveDonation(donation) {
  const stamp = nowStamp();
  const d = { ...donation, updated_at: stamp, updated_by: state.email };
  delete d._row;
  if (!d.donation_id) {
    const ids = (await readColumn('Donations', 'A')).slice(1).map(Number).filter(Number.isFinite);
    d.donation_id = Math.max(0, ...ids) + 1;
    d.created_at = stamp;
    d.created_by = state.email;
    await appendRow('Donations', objectToRow(state.headers.Donations, d));
    await logChanges('donation', d.donation_id, d.contact_id, null, null, `created: $${d.amount_usd}`);
  } else {
    const row = await findRow('Donations', d.donation_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('Donations', row, objectToRow(state.headers.Donations, d));
    const before = state.donations.find((x) => String(x.donation_id) === String(d.donation_id)) || {};
    await logChanges('donation', d.donation_id, d.contact_id, before, d);
  }
  return d.donation_id;
}

/** שומר הרבה נדבות חדשות בבת אחת (קאמפיין). מחזיר כמה נשמרו. */
export async function saveDonations(list) {
  if (!list.length) return 0;
  const stamp = nowStamp();
  const ids = (await readColumn('Donations', 'A')).slice(1).map(Number).filter(Number.isFinite);
  let next = Math.max(0, ...ids) + 1;
  const rows = list.map((d) => objectToRow(state.headers.Donations, {
    ...d, donation_id: next++, created_at: stamp, created_by: state.email, updated_at: stamp, updated_by: state.email,
  }));
  await appendRows('Donations', rows);
  const first = next - rows.length;
  try {
    const at = nowStamp();
    await appendRows('History', list.map((d, i) => [at, state.email, 'donation', String(first + i), String(d.contact_id || ''), '*', '', `created: $${d.amount_usd}${d.campaign ? ` · ${d.campaign}` : ''}`]));
    historyCache = null;
  } catch { /* היסטאריע — נישט קריטיש */ }
  return rows.length;
}

/** נשי אונגוואר — א באזונדער ארגון (פון ווייבער), מיט א לאגא וואס איז שוין דא אויפן אתר. */
export const NESHEI_ORG = 'נשי אונגוואר';
const DEFAULT_LOGOS = { [NESHEI_ORG]: 'img/neshei-logo.png' };

/** דער לאגא פון א ארגון: וואס מען האט ארויפגעלייגט, אדער דער פון פריער (נשי), אדער ''. */
export function orgLogo(name) {
  return state.orgLogos?.[name] || DEFAULT_LOGOS[name] || '';
}

export function hasUploadedLogo(name) {
  return Boolean(state.orgLogos?.[name]);
}

/** מנהל בלבד: שומר (אדער מעקט אויס מיט '') דעם לאגא פון א ארגון. */
export async function saveOrgLogo(org, data, driveId = '') {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const row = await findRow('OrgLogos', org);
  const values = objectToRow(state.headers.OrgLogos, { org, logo_data: data, updated_at: nowStamp(), updated_by: state.email, drive_id: driveId });
  if (row) await updateRow('OrgLogos', row, data ? values : state.headers.OrgLogos.map(() => ''));
  else if (data) await appendRow('OrgLogos', values);
}

// ---------- דרייב פון "דאטאבייס" ----------
/** איז דער באנוצער יעצט דער "דאטאבייס" חשבון? (נאר דעמאלט ווערט דער אריגינאל געשפייכלט אין דרייב) */
export function isDatabaseAccount() {
  return state.email === String(CONFIG.DATABASE_ACCOUNT || '').toLowerCase();
}

/**
 * היט אפ דעם אריגינאל אין דרייב פון "דאטאבייס" (Khal Ungvar – Database / sub).
 * גיט צוריק דעם ID פון דער טעקע, אדער '' ווען מען איז נישט אריין מיטן "דאטאבייס" חשבון.
 */
export async function saveOriginalToDrive(file, sub, name) {
  if (!isDatabaseAccount() || !file) return '';
  if (!hasDriveScope()) throw new Error(t('driveNotConnected'));
  const root = await driveFolder(CONFIG.DRIVE_FOLDER);
  const folder = await driveFolder(sub, root);
  const ext = (file.name || '').split('.').pop() || 'jpg';
  return driveUpload(file, `${name}.${ext}`, folder);
}

/** פארבינדן דרייב (גערופן פון א קנעפל). */
export function connectDrive() {
  return ensureDriveScope();
}

export { hasDriveScope };

// ---------- בילדער פון מענטשן (לשונית Photos) ----------
// די בילדער ווערן נישט אראפגעלאדן מיט אלעס — נאר ווען מען עפנט א כרטיס (כדי עס זאל זיין שנעל).
const photoCache = new Map();

export async function getPhoto(contactId) {
  const k = String(contactId);
  if (photoCache.has(k)) return photoCache.get(k);
  const ids = await readColumn('Photos', 'A');
  const idx = ids.findIndex((v, i) => i > 0 && String(v) === k);
  const data = idx > 0 ? String(await readCell(`Photos!B${idx + 1}`)) : '';
  photoCache.set(k, data);
  return data;
}

export async function savePhoto(contactId, data, driveId = '') {
  const k = String(contactId);
  const row = await findRow('Photos', k);
  const values = [Number(k), data, nowStamp(), state.email, driveId];
  if (row) await updateRow('Photos', row, data ? values : ['', '', '', '', '']);
  else if (data) await appendRow('Photos', values);
  photoCache.set(k, data);
  await logChanges('photo', k, k, null, null, data ? 'photo' : 'photo removed');
}

/** לייענט נאר די מעסעדזשעס (פאר א שנעלע בדיקה יעדע פאר מינוט). */
export async function reloadMessages() {
  const tabs = await readTabs(['Messages', 'Tasks', 'OrgLogos']);
  const msgs = rowsToObjects(tabs.Messages || []);
  state.headers.Messages = msgs.header;
  state.messages = msgs.objects;
  const tasks = rowsToObjects(tabs.Tasks || []);
  state.headers.Tasks = tasks.header;
  state.tasks = tasks.objects;
}

/** אלע באנוצער (מנהלים + גבאים): [{ email, name, role }] */
export function allUsers() {
  const S = state.rawSettings || {};
  const out = [];
  const add = (emails, names, role) => (S[emails] || []).forEach((e, i) => {
    const email = String(e || '').trim().toLowerCase();
    if (email && !out.some((u) => u.email === email)) out.push({ email, name: String((S[names] || [])[i] || '').trim() || email, role });
  });
  add('admin_email', 'admin_name', 'admin');
  add('gabbai_email', 'gabbai_name', 'gabbai');
  return out;
}

// ---------- צוטריט צום שיט: לויט דער רשימה אין אדמין ----------
export { pickSheet };

/** צי האט דער אתר שוין רשות צו פירן דעם צוטריט (מיר פרובירן צו לייענען ווער עס האט צוטריט). */
export async function canManageSharing() {
  if (!hasDriveScope()) return false;
  try { await sheetPermissions(); return true; } catch (err) {
    if (err.status === 403 || err.status === 404) return false;
    throw err;
  }
}

/**
 * פארגלייכט ווער עס האט צוטריט צום שיט מיט די מנהלים + גבאים אין אדמין.
 * { add: [{email,name}], remove: [{id,email}], ok: [{email,name}], owner }
 */
export async function sharingPlan() {
  const users = allUsers();
  const perms = await sheetPermissions();
  const has = new Map(perms.filter((p) => p.type === 'user').map((p) => [p.email, p]));
  const owner = perms.find((p) => p.role === 'owner')?.email || '';
  const want = new Set(users.map((u) => u.email));
  return {
    owner,
    ok: users.filter((u) => has.has(u.email)),
    add: users.filter((u) => !has.has(u.email)),
    remove: perms.filter((p) => p.type === 'user' && p.role !== 'owner' && p.email && !want.has(p.email) && p.email !== state.email),
  };
}

/** טוט דעם פלאן: שערט מיט די נייע, נעמט צוריק פון די וואס זענען מער נישט אין דער רשימה. */
export async function applySharing(plan, { remove = true } = {}) {
  const msg = t('shareEmailMsg');
  for (const u of plan.add) await shareSheet(u.email, msg);
  if (remove) for (const p of plan.remove) await unshareSheet(p.id);
  await logChanges('sharing', 'sheet', '', null, null,
    `shared: ${plan.add.map((u) => u.email).join(', ') || '—'}${remove && plan.remove.length ? ` · removed: ${plan.remove.map((p) => p.email).join(', ')}` : ''}`);
}

/** שומר רשומה כללית (חדשה או קיימת) לפי שדה ה-ID. מחזיר את ה-ID. */
export async function saveRecord(tab, idField, record) {
  const stamp = nowStamp();
  const r = { ...record, updated_at: stamp, updated_by: state.email };
  delete r._row;
  if (!r[idField]) {
    const ids = (await readColumn(tab, 'A')).slice(1).map(Number).filter(Number.isFinite);
    r[idField] = Math.max(0, ...ids) + 1;
    r.created_at = stamp;
    r.created_by = state.email;
    await appendRow(tab, objectToRow(state.headers[tab], r));
  } else {
    const row = await findRow(tab, r[idField]);
    if (!row) throw new Error(t('notFound'));
    await updateRow(tab, row, objectToRow(state.headers[tab], r));
  }
  return r[idField];
}

export async function deleteRecord(tab, idField, record) {
  const row = await findRow(tab, record[idField]);
  if (row) await updateRow(tab, row, state.headers[tab].map(() => ''));
}

/** שומר רשימה (חדשה או קיימת). מחזיר את ה-list_id. */
export async function saveSavedList(list) {
  const stamp = nowStamp();
  const l = { ...list, updated_at: stamp, updated_by: state.email };
  delete l._row;
  if (!l.list_id) {
    const ids = (await readColumn('SavedLists', 'A')).slice(1).map(Number).filter(Number.isFinite);
    l.list_id = Math.max(0, ...ids) + 1;
    l.created_at = stamp;
    l.created_by = state.email;
    await appendRow('SavedLists', objectToRow(state.headers.SavedLists, l));
  } else {
    const row = await findRow('SavedLists', l.list_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('SavedLists', row, objectToRow(state.headers.SavedLists, l));
  }
  return l.list_id;
}

export async function deleteSavedList(list) {
  const row = await findRow('SavedLists', list.list_id);
  if (row) await updateRow('SavedLists', row, state.headers.SavedLists.map(() => ''));
}

/** שומר קאמפיין (חדש או קיים, לפי השם המלא). */
export async function saveCampaign(campaign) {
  const stamp = nowStamp();
  const existing = state.campaigns.find((c) => c.campaign === campaign.campaign);
  const c = { ...(existing || { created_at: stamp, created_by: state.email }), ...campaign, updated_at: stamp, updated_by: state.email };
  delete c._row;
  const row = existing ? await findRow('Campaigns', c.campaign) : null;
  if (row) await updateRow('Campaigns', row, objectToRow(state.headers.Campaigns, c));
  else await appendRow('Campaigns', objectToRow(state.headers.Campaigns, c));
}

/** א יערליכער קאמפיין (די "סעריע"): לייגט צו אדער פארריכט לויט נאמען. */
export async function saveYearly(y) {
  const stamp = nowStamp();
  const existing = state.yearly.find((x) => x.series === y.series);
  const o = { ...(existing || { created_at: stamp, created_by: state.email, active: true }), ...y, updated_at: stamp, updated_by: state.email };
  delete o._row;
  const row = existing ? await findRow('YearlyCampaigns', o.series) : null;
  if (row) await updateRow('YearlyCampaigns', row, objectToRow(state.headers.YearlyCampaigns, o));
  else await appendRow('YearlyCampaigns', objectToRow(state.headers.YearlyCampaigns, o));
  await logChanges('yearly', o.series, '', existing || {}, o);
}

// ---------- קבלות און Invoices ----------
export function orgDetailsOf(org) {
  return state.orgDetails.find((o) => o.org === org) || null;
}

/** היט אפ די פרטים פון א ארגון (פאר די קבלות). */
export async function saveOrgDetails(d) {
  const stamp = nowStamp();
  const existing = orgDetailsOf(d.org);
  const o = { ...(existing || {}), ...d, updated_at: stamp, updated_by: state.email };
  delete o._row;
  const row = existing ? await findRow('OrgDetails', o.org) : null;
  if (row) await updateRow('OrgDetails', row, objectToRow(state.headers.OrgDetails, o));
  else await appendRow('OrgDetails', objectToRow(state.headers.OrgDetails, o));
  await logChanges('orgDetails', o.org, '', existing || {}, o);
}

/** א שליסל וואס באשרייבט א דאקומענט — כדי ביים נאכאמאל דרוקן זאל עס האבן דעם זעלבן נומער. */
const docKey = (kind, org, ids, period, who) => [kind, org, [...ids].map(String).sort().join(','), period || '', who || ''].join('|');

/** געפינט א קבלה וואס איז שוין ארויסגעגעבן פאר די זעלבע נדבות. */
export function findIssued(kind, org, ids, period, who) {
  const k = docKey(kind, org, ids, period, who);
  return state.receipts.find((r) => !isTrueVal(r.void)
    && docKey(r.kind, r.org, String(r.donation_ids || '').split(',').filter(Boolean), r.period, r.contact_id || r.donor_name) === k) || null;
}
const isTrueVal = (v) => v === true || String(v).toUpperCase() === 'TRUE';

/**
 * גיט ארויס דאקומענטן (אדער גיט צוריק דעם אלטן נומער ווען ס'איז שוין דא).
 * docs = [{ kind, org, contact_id, donor_name, ids, amount, period }] → די זעלבע מיט receipt_no
 * נומערן: <prefix>-0001 (קבלות), <prefix>-INV-0001 (Invoices), <prefix>-YE2026-001 (יערליכע סיכומים) — באזונדער פאר יעדן ארגון.
 */
export async function issueDocs(docs) {
  const fresh = (await readColumn('Receipts', 'A')).slice(1).map(String);
  const used = new Set([...fresh, ...state.receipts.map((r) => String(r.receipt_no))]);
  const next = (base, pad) => {
    let n = 0;
    used.forEach((no) => { if (no.startsWith(`${base}-`)) { const m = Number(no.slice(base.length + 1)); if (m > n) n = m; } });
    const no = `${base}-${String(n + 1).padStart(pad, '0')}`;
    used.add(no);
    return no;
  };
  const stamp = nowStamp();
  const rows = [];
  const out = docs.map((d) => {
    const who = d.contact_id || d.donor_name;
    const old = findIssued(d.kind, d.org, d.ids, d.period, who);
    if (old) return { ...d, receipt_no: old.receipt_no, issued_at: old.issued_at, reprint: true };
    const det = orgDetailsOf(d.org) || {};
    const prefix = String(det.receipt_prefix || '').trim() || 'R';
    const base = d.kind === 'invoice' ? `${prefix}-INV` : d.kind === 'year' ? `${prefix}-YE${d.period}` : prefix;
    const no = next(base, d.kind === 'year' ? 3 : 4);
    const rec = {
      receipt_no: no, kind: d.kind, org: d.org, contact_id: d.contact_id || '', donor_name: d.contact_id ? '' : (d.donor_name || ''),
      donation_ids: d.ids.join(','), amount: d.amount, period: d.period || '', issued_at: stamp, issued_by: state.email, void: '', note: '',
    };
    rows.push(objectToRow(state.headers.Receipts, rec));
    state.receipts.push(rec);
    return { ...d, receipt_no: no, issued_at: stamp, reprint: false };
  });
  if (rows.length) await appendRows('Receipts', rows);
  return out;
}

/** בטל א קבלה (מ'מעקט נישט — מ'צייכנט "void"). */
export async function voidReceipt(no) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const row = await findRow('Receipts', no);
  const r = state.receipts.find((x) => x.receipt_no === no);
  if (row && r) await updateRow('Receipts', row, objectToRow(state.headers.Receipts, { ...r, void: true }));
}

/** מנהל בלבד: מעקט א יערליכן קאמפיין (נאר ווען ס'איז נישטא קיין נדבות). */
export async function deleteYearly(series) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const row = await findRow('YearlyCampaigns', series);
  if (row) await updateRow('YearlyCampaigns', row, state.headers.YearlyCampaigns.map(() => ''));
  await logChanges('yearly', series, '', null, null, 'deleted');
}

/** מנהל בלבד: מעקט א קאמפיין-שורה (איינמאליג, אדער סעטינגס פון איין יאר). */
export async function deleteCampaign(name) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const row = await findRow('Campaigns', name);
  if (row) await updateRow('Campaigns', row, state.headers.Campaigns.map(() => ''));
  await logChanges('campaign', name, '', null, null, 'deleted');
}

/** מנהל בלבד: מוחק תרומה (מנקה את השורה בגליון). */
export async function deleteDonation(donation) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const row = await findRow('Donations', donation.donation_id);
  if (row) await updateRow('Donations', row, state.headers.Donations.map(() => ''));
  await logChanges('donation', donation.donation_id, donation.contact_id, null, null, `deleted: $${donation.amount_usd}`);
}

// ---------- לשונית "ארגון": תיבות טקסט ----------
export const MAX_ORG_NOTES = 100;

/** שומר תיבה (חדשה או קיימת). */
export async function saveOrgNote(note) {
  const stamp = nowStamp();
  const n = { ...note, updated_at: stamp, updated_by: state.email };
  delete n._row;
  if (!n.note_id) {
    const mine = state.orgNotes.filter((x) => String(x.contact_id) === String(n.contact_id));
    if (mine.length >= MAX_ORG_NOTES) throw new Error(t('orgNotesMax', { n: MAX_ORG_NOTES }));
    const ids = (await readColumn('OrgNotes', 'A')).slice(1).map(Number).filter(Number.isFinite);
    n.note_id = Math.max(0, ...ids) + 1;
    n.created_at = stamp;
    n.created_by = state.email;
    await appendRow('OrgNotes', objectToRow(state.headers.OrgNotes, n));
    await logChanges('orgnote', n.note_id, n.contact_id, {}, { text: n.text });
  } else {
    const row = await findRow('OrgNotes', n.note_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('OrgNotes', row, objectToRow(state.headers.OrgNotes, n));
    const before = state.orgNotes.find((x) => String(x.note_id) === String(n.note_id)) || {};
    await logChanges('orgnote', n.note_id, n.contact_id, { text: before.text }, { text: n.text });
  }
  return n.note_id;
}

export async function deleteOrgNote(note) {
  const row = await findRow('OrgNotes', note.note_id);
  if (row) await updateRow('OrgNotes', row, state.headers.OrgNotes.map(() => ''));
  await logChanges('orgnote', note.note_id, note.contact_id, { text: note.text }, { text: '' });
}

// ---------- מאורעות (יארצייט, געבורטסטאג...) ----------
/** שומר מאורע (חדש או קיים). מחזיר את ה-occasion_id. */
export async function saveOccasion(occasion) {
  const stamp = nowStamp();
  const o = { ...occasion, updated_at: stamp, updated_by: state.email };
  delete o._row;
  if (!o.occasion_id) {
    const ids = (await readColumn('Occasions', 'A')).slice(1).map(Number).filter(Number.isFinite);
    o.occasion_id = Math.max(0, ...ids) + 1;
    o.created_at = stamp;
    o.created_by = state.email;
    await appendRow('Occasions', objectToRow(state.headers.Occasions, o));
    await logChanges('occasion', o.occasion_id, o.contact_id, null, null, `created: ${o.occasion_type} ${o.person_name}`);
  } else {
    const row = await findRow('Occasions', o.occasion_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('Occasions', row, objectToRow(state.headers.Occasions, o));
    const before = state.occasions.find((x) => String(x.occasion_id) === String(o.occasion_id)) || {};
    await logChanges('occasion', o.occasion_id, o.contact_id, before, o);
  }
  return o.occasion_id;
}

/** מוחק מאורע (מנקה את השורה בגליון). */
export async function deleteOccasion(occasion) {
  const row = await findRow('Occasions', occasion.occasion_id);
  if (row) await updateRow('Occasions', row, state.headers.Occasions.map(() => ''));
  await logChanges('occasion', occasion.occasion_id, occasion.contact_id, null, null, `deleted: ${occasion.occasion_type} ${occasion.person_name}`);
}

// ---------- קשרים משפחתיים ----------
// שורה (A, "טאטע פון", B) פירושה: A הוא הטאטע של B. הקשר ההפוך (B, "זון פון", A) נוצר אוטומטית.

function sameRel(r, a, type, b) {
  return String(r.contact_id_a) === String(a) && r.relation_type === type && String(r.contact_id_b) === String(b);
}

export async function addRelation(a, type, b) {
  const ids = (await readColumn('Relations', 'A')).slice(1).map(Number).filter(Number.isFinite);
  let next = Math.max(0, ...ids) + 1;
  const reverse = state.relationReverse[type];
  const rows = [[a, type, b]];
  if (reverse && !state.relations.some((r) => sameRel(r, b, reverse, a))) rows.push([b, reverse, a]);
  for (const [x, ty, y] of rows) {
    if (state.relations.some((r) => sameRel(r, x, ty, y))) continue;
    await appendRow('Relations', objectToRow(state.headers.Relations,
      { relation_id: next, contact_id_a: x, relation_type: ty, contact_id_b: y }));
    await logChanges('relation', next, x, null, null, `+ ${ty} #${y}`);
    next += 1;
  }
}

/** מוחק קשר ואת הקשר ההפוך שלו (מנקה את השורות בגליון). */
export async function removeRelation(rel) {
  const reverse = state.relationReverse[rel.relation_type];
  const targets = state.relations.filter((r) => r === rel
    || (reverse && sameRel(r, rel.contact_id_b, reverse, rel.contact_id_a)));
  const ids = await readColumn('Relations', 'A');
  for (const r of targets) {
    const idx = ids.findIndex((v, i) => i > 0 && String(v) === String(r.relation_id));
    if (idx > 0) await updateRow('Relations', idx + 1, state.headers.Relations.map(() => ''));
    await logChanges('relation', r.relation_id, r.contact_id_a, null, null, `− ${r.relation_type} #${r.contact_id_b}`);
  }
}

/** מנהל בלבד: מוסיף ערך חדש לרשימה בלשונית Lists. */
export async function addListValue(listName, value) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const tabs = await readTabs(['Lists']);
  const rows = tabs.Lists;
  const col = rows[0].indexOf(listName);
  if (col < 0) throw new Error(t('listMissing', { name: listName }));
  let r = 1;
  while (r < rows.length && String(rows[r][col] ?? '').trim()) r += 1;
  await updateCell(`Lists!${columnLetter(col)}${r + 1}`, value);
  state.lists[listName] = [...(state.lists[listName] || []), value];
}

/**
 * מנהל בלבד: כותב מחדש עמודות שלמות בלשונית Lists. columns = { header: [ערכים...] }.
 * עמודות שקשורות זו לזו (title_he + title_he_default_en וכו') נשלחות יחד, באותו סדר שורות.
 */
export async function saveListColumns(columns) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const rows = (await readTabs(['Lists'])).Lists;
  const header = rows[0] || [];
  for (const [name, values] of Object.entries(columns)) {
    let col = header.indexOf(name);
    if (col < 0) { // עמודה חדשה — בסוף
      col = header.length;
      header.push(name);
      await updateCell(`Lists!${columnLetter(col)}1`, name);
    }
    const oldLen = rows.slice(1).reduce((n, r, i) => (String(r[col] ?? '').trim() ? i + 1 : n), 0);
    const len = Math.max(oldLen, values.length, 1);
    const out = Array.from({ length: len }, (_, i) => [values[i] ?? '']);
    const L = columnLetter(col);
    await updateRange(`Lists!${L}2:${L}${len + 1}`, out);
  }
}

/** מנהל בלבד: כותב מחדש עמודות שלמות בלשונית Settings (מנהלים, גבאים). */
export async function saveSettingsColumns(columns) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const rows = (await readTabs(['Settings'])).Settings;
  const header = rows[0] || [];
  for (const [name, values] of Object.entries(columns)) {
    let col = header.indexOf(name);
    if (col < 0) {
      col = header.length;
      header.push(name);
      await updateCell(`Settings!${columnLetter(col)}1`, name);
    }
    const oldLen = rows.slice(1).reduce((n, r, i) => (String(r[col] ?? '').trim() ? i + 1 : n), 0);
    const len = Math.max(oldLen, values.length, 1);
    const L = columnLetter(col);
    await updateRange(`Settings!${L}2:${L}${len + 1}`, Array.from({ length: len }, (_, i) => [values[i] ?? '']));
  }
}

/** דער נאמען פון א מנהל / גבאי לויט זיין אימעיל (פון Settings); אויב נישטא — דער אימעיל. */
export function displayName(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return '';
  const S = state.rawSettings || {};
  const find = (emails, names) => {
    const i = (S[emails] || []).findIndex((x) => String(x).trim().toLowerCase() === e);
    return i >= 0 ? String((S[names] || [])[i] || '').trim() : '';
  };
  return find('admin_email', 'admin_name') || find('gabbai_email', 'gabbai_name') || email;
}

export function rawSettingsColumn(name) {
  return state.rawSettings?.[name] || [];
}

/** הערכים הגולמיים של עמודה (כולל שורות ריקות באמצע, כדי לשמור על ההתאמה בין עמודות). */
export function rawListColumn(name) {
  return state.rawLists?.[name] || [];
}

function columnLetter(index) {
  let s = '';
  let n = index + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
