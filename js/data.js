// שכבת הנתונים: מתרגמת בין שורות בגליון לבין אובייקטים, לפי שמות העמודות בשורה 1.
// ככה הוספה או הזזה של עמודה בגליון לא שוברת את התוכנה.
import { readTabs, readColumn, appendRow, appendRows, updateRow, updateCell } from './google.js';
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
  orgNotes: [],      // לשונית "ארגון": תיבות טקסט לכל איש קשר     // מאורעות: יארצייט, געבורטסטאג, חתונה...
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
  const tabs = await readTabs(['Contacts', 'Phones', 'Lists', 'Settings', 'Relations', 'Donations', 'Occasions', 'OrgNotes']);

  const contacts = rowsToObjects(tabs.Contacts);
  state.headers.Contacts = contacts.header;
  state.contacts = contacts.objects;

  const phones = rowsToObjects(tabs.Phones);
  state.headers.Phones = phones.header;
  state.phones = new Map(phones.objects.map((p) => [String(p.contact_id), p]));

  const donations = rowsToObjects(tabs.Donations);
  state.headers.Donations = donations.header;
  state.donations = donations.objects;

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
  const admins = settings.map((s) => String(s.admin_email || '').trim().toLowerCase()).filter(Boolean);
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

function columnLetter(index) {
  let s = '';
  let n = index + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
