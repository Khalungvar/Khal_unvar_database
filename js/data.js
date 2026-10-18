// שכבת הנתונים: מתרגמת בין שורות בגליון לבין אובייקטים, לפי שמות העמודות בשורה 1.
// ככה הוספה או הזזה של עמודה בגליון לא שוברת את התוכנה.
import { readTabs, readColumn, appendRow, appendRows, updateRow, updateCell, updateRange } from './google.js';
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
  savedLists: [],
  mailTemplates: [],
  messages: [],
  tasks: [],         // To Do: משימות (אויך צו אנדערע)      // מעסעדזשעס צווישן די באנוצער (און בקשות גישה) // Mail Merge: אפגעהיטענע עיצובים פון קאנווערטן / לעיבלס    // רשימות שמורות (תנאים + עמודות)     // { campaign, org } — לאיזה ארגון שייך כל קאמפיין      // לשונית "ארגון": תיבות טקסט לכל איש קשר     // מאורעות: יארצייט, געבורטסטאג, חתונה...
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
  const tabs = await readTabs(['Contacts', 'Phones', 'Lists', 'Settings', 'Relations', 'Donations', 'Occasions', 'OrgNotes', 'Campaigns', 'SavedLists', 'MailTemplates', 'Messages', 'Tasks']);

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

  const mt = rowsToObjects(tabs.MailTemplates || []);
  state.headers.MailTemplates = mt.header;
  state.mailTemplates = mt.objects;

  const saved = rowsToObjects(tabs.SavedLists);
  state.headers.SavedLists = saved.header;
  state.savedLists = saved.objects;

  const campaigns = rowsToObjects(tabs.Campaigns);
  state.headers.Campaigns = campaigns.header;
  state.campaigns = campaigns.objects;

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

  return c.contact_id;
}

/** שומר רק את הקוויטל של איש קשר (טקסט עם שורות). */
export async function saveKvitel(contact, text) {
  const row = await findRow('Contacts', contact.contact_id);
  if (!row) throw new Error(t('notFound'));
  const c = { ...contact, kvitel: text, updated_at: nowStamp(), updated_by: state.email };
  await updateRow('Contacts', row, objectToRow(state.headers.Contacts, c));
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
  } else {
    const row = await findRow('Donations', d.donation_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('Donations', row, objectToRow(state.headers.Donations, d));
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
  return rows.length;
}

/** לייענט נאר די מעסעדזשעס (פאר א שנעלע בדיקה יעדע פאר מינוט). */
export async function reloadMessages() {
  const tabs = await readTabs(['Messages', 'Tasks']);
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

/** מנהל בלבד: מוחק תרומה (מנקה את השורה בגליון). */
export async function deleteDonation(donation) {
  if (!state.isAdmin) throw new Error(t('adminOnly'));
  const row = await findRow('Donations', donation.donation_id);
  if (row) await updateRow('Donations', row, state.headers.Donations.map(() => ''));
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
  } else {
    const row = await findRow('OrgNotes', n.note_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('OrgNotes', row, objectToRow(state.headers.OrgNotes, n));
  }
  return n.note_id;
}

export async function deleteOrgNote(note) {
  const row = await findRow('OrgNotes', note.note_id);
  if (row) await updateRow('OrgNotes', row, state.headers.OrgNotes.map(() => ''));
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
  } else {
    const row = await findRow('Occasions', o.occasion_id);
    if (!row) throw new Error(t('notFound'));
    await updateRow('Occasions', row, objectToRow(state.headers.Occasions, o));
  }
  return o.occasion_id;
}

/** מוחק מאורע (מנקה את השורה בגליון). */
export async function deleteOccasion(occasion) {
  const row = await findRow('Occasions', occasion.occasion_id);
  if (row) await updateRow('Occasions', row, state.headers.Occasions.map(() => ''));
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
