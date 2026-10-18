// שכבת הנתונים: מתרגמת בין שורות בגליון לבין אובייקטים, לפי שמות העמודות בשורה 1.
// ככה הוספה או הזזה של עמודה בגליון לא שוברת את התוכנה.
import { readTabs, readColumn, appendRow, updateRow, updateCell } from './google.js';
import { CONFIG } from './config.js';
import { nowStamp } from './util.js';

export const state = {
  email: '',
  isAdmin: false,
  headers: {},       // { Contacts: [...], Phones: [...] }
  contacts: [],      // אובייקטים, עם _row (מספר השורה בגליון)
  phones: new Map(), // contact_id → אובייקט טלפונים
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
  return {
    lists,
    titleHeToEn: pair('title_he', 'title_he_default_en'),
    titleEnToHe: pair('title_en', 'title_en_default_he'),
    relationReverse: pair('relation_type', 'relation_reverse'),
  };
}

export async function loadAll() {
  const tabs = await readTabs(['Contacts', 'Phones', 'Lists', 'Settings']);

  const contacts = rowsToObjects(tabs.Contacts);
  state.headers.Contacts = contacts.header;
  state.contacts = contacts.objects;

  const phones = rowsToObjects(tabs.Phones);
  state.headers.Phones = phones.header;
  state.phones = new Map(phones.objects.map((p) => [String(p.contact_id), p]));

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
    if (c.is_active === '' || c.is_active === undefined) c.is_active = true;
    await appendRow('Contacts', objectToRow(state.headers.Contacts, c));
  } else {
    const row = await findRow('Contacts', c.contact_id);
    if (!row) throw new Error('איש הקשר לא נמצא בגליון. ייתכן שמישהו מחק אותו. רעננו את הדף.');
    await updateRow('Contacts', row, objectToRow(state.headers.Contacts, c));
  }

  const p = { ...phones, contact_id: c.contact_id };
  const hasPhones = Object.entries(p).some(([k, v]) => k !== 'contact_id' && String(v).trim());
  const phoneRow = await findRow('Phones', c.contact_id);
  if (phoneRow) await updateRow('Phones', phoneRow, objectToRow(state.headers.Phones, p));
  else if (hasPhones) await appendRow('Phones', objectToRow(state.headers.Phones, p));

  return c.contact_id;
}

/** מנהל בלבד: מוסיף ערך חדש לרשימה בלשונית Lists. */
export async function addListValue(listName, value) {
  if (!state.isAdmin) throw new Error('רק מנהל יכול להוסיף ערכים לרשימות.');
  const tabs = await readTabs(['Lists']);
  const rows = tabs.Lists;
  const col = rows[0].indexOf(listName);
  if (col < 0) throw new Error(`הרשימה ${listName} לא נמצאה.`);
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
