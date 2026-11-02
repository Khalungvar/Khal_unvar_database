// 🏛 בתי כנסת: הרשימה (לשונית Shuls בגיליון של בארא פארק), בית כנסת חדש, גבאים (שיתוף הגיליון).
// כל בית כנסת = גיליון משלו (Minyanim, Screen, ShulConfig …). ההרשאות = שיתוף הגיליון בגוגל: עורך = גבאי, צופה = צפייה בלבד.
import { otherSheet, createSpreadsheet, drivePublic, ensureDriveScope, filePermissions, shareFile, unshareFile } from '../google.js';
import { nowStamp } from '../util.js';
import { SHULS, DEFAULT_SHUL, CITIES, shulDefaults, registerShul } from './shul.js';
import { screenDefaults } from '../display/screenset.js';
import { defaults as minyanDefaults } from './minyanim.js';

const REG = () => otherSheet(SHULS[DEFAULT_SHUL].sheetId);
export const TABS = ['Minyanim', 'Screen', 'ShulConfig', 'Simchos', 'RebbeAway', 'PrintTemplates', 'MinyanimHistory', 'ScreenHistory', 'ShulHistory'];

/** הרשימה: [{ key, name, sheetId, at, by }] */
export async function loadShuls() {
  try {
    const rows = await REG().read('Shuls!A2:E200');
    const list = rows.filter((r) => r[0] && r[2]).map((r) => ({ key: String(r[0]), name: String(r[1] || ''), sheetId: String(r[2]), at: String(r[3] || ''), by: String(r[4] || '') }));
    list.forEach(registerShul);
    return list;
  } catch { return []; }
}

const chunks = (obj) => { const v = JSON.stringify(obj); const p = []; for (let i = 0; i < v.length; i += 40000) p.push(v.slice(i, i + 40000)); return p; };
async function writeJson(sh, tab, obj, email) {
  const parts = chunks(obj); const st = nowStamp();
  await sh.write(`${tab}!A1:D${parts.length + 1}`, [['key', 'value', 'updated_at', 'updated_by'], ...parts.map((x, i) => [`data#${i}`, x, st, email])]);
}

/** בית כנסת חדש: { name, city, lang, simchos } → { key, sheetId } */
export async function createShul({ name, city = 'bp', lang = 'yi', simchos = 'ungvar', email = '' }, onStep = () => {}) {
  await ensureDriveScope();
  const key = `s${Date.now().toString(36)}`;
  onStep('יוצר גיליון…');
  const sheetId = await createSpreadsheet(`בית כנסת – ${name}`, TABS);
  const sh = otherSheet(sheetId);
  onStep('פותח לקריאה (בשביל המסך)…');
  await drivePublic(sheetId); // המסך קורא בלי כניסה — כמו בבארא פארק
  onStep('כותב הגדרות…');
  const cfg = shulDefaults(key); const c = CITIES.find((x) => x.id === city) || CITIES[0];
  cfg.name = name; cfg.lang = lang; cfg.simchos = simchos;
  cfg.loc = { city: c.id, name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, elev: c.elev, il: /Jerusalem/.test(c.tz) };
  cfg.z = { alos: 'm72', motzei: 'm72', candles: c.candles, shkia: 'sea', table: false };
  await writeJson(sh, 'ShulConfig', cfg, email);
  // המסך: השם שלהם, בלי הדברים של אונגוואר (קול אונגוואר, נשיאות, מנין כ"ק)
  const scr = screenDefaults();
  scr.texts = { ...scr.texts, title: name, sub: '', sub2: '', kolText: '', kolPhone: '', tRebbe: '' };
  await writeJson(sh, 'Screen', scr, email);
  // זמני התפילות: ברירת המחדל, בלי מנין כ"ק אדמו"ר
  const mn = minyanDefaults(); Object.values(mn.weekday.rebbe || {}).forEach((r) => { r.on = false; });
  await writeJson(sh, 'Minyanim', mn, email);
  await sh.write('Simchos!A1:C1', [['simcha_id', 'html', 'until']]);
  await sh.write('RebbeAway!A1:B1', [['from', 'to']]);
  await Promise.all(['MinyanimHistory', 'ScreenHistory', 'ShulHistory'].map((t) => sh.write(`${t}!A1:D1`, [['version', 'saved_at', 'saved_by', 'note']])));
  onStep('מוסיף לרשימה…');
  const reg = REG();
  try { await reg.read('Shuls!A1:A1'); } catch { await reg.addTab('Shuls'); }
  const rows = await reg.read('Shuls!A1:A500');
  if (!rows.length) await reg.write('Shuls!A1:E1', [['key', 'name', 'sheetId', 'created_at', 'created_by']]);
  const row = Math.max(rows.length, 1) + 1;
  await reg.write(`Shuls!A${row}:E${row}`, [[key, name, sheetId, nowStamp(), email]]);
  registerShul({ key, name, sheetId });
  return { key, sheetId };
}

// ---------- גבאים: שיתוף הגיליון ----------
export const ROLE = { writer: 'גבאי (עורך)', reader: 'צפייה בלבד', owner: 'מנהל (בעלים)' };
export async function shulPeople(sheetId) { return (await filePermissions(sheetId)).filter((p) => p.type === 'user'); }
export async function addPerson(sheetId, email, role, shulName) {
  return shareFile(sheetId, email, role, `הוזמנת לנהל את זמני התפילות של ${shulName}. כניסה: https://ungvar.org/shul/?s=${encodeURIComponent(Object.values(SHULS).find((x) => x.sheetId === sheetId)?.key || '')}`);
}
export async function removePerson(sheetId, permId) { return unshareFile(sheetId, permId); }
