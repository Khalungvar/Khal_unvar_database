// לוגאין עם גוגל וגישה לגוגל שיטס.
// גוגל נותנת "מפתח כניסה" (טוקן) שתקף שעה אחת. שומרים אותו בדפדפן עד שהוא פג,
// כדי שרענון של הדף לא ידרוש התחברות מחדש. אחרי שעה מבקשים לחיצה אחת לחידוש.
import { CONFIG, SCOPES, DRIVE_SCOPE, GMAIL_SCOPE } from './config.js';

const STORE = 'khal-auth';
let tokenClient = null;
let accessToken = null;
let expiresAt = 0;
let hintEmail = '';
let onExpire = null;
let expireTimer = null;
let grantedScopes = '';
let silentMode = false;
/** ביים ארויפלאדן פונעם בלאט: א פארפאלענער טאקען → צוריק צום לאגאין, אן א פאפ-אפ */
export function setSilent(v) { silentMode = v; }

function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ accessToken, expiresAt, hintEmail, grantedScopes })); } catch { /* ignore */ }
}

function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || '{}');
    hintEmail = d.hintEmail || '';
    grantedScopes = d.grantedScopes || '';
    if (d.accessToken && d.expiresAt > Date.now() + 60_000) {
      accessToken = d.accessToken;
      expiresAt = d.expiresAt;
    }
  } catch { /* ignore */ }
}

function scheduleExpire() {
  clearTimeout(expireTimer);
  if (!expiresAt) return;
  // דקה לפני שהטוקן פג — מודיעים לממשק, שיבקש לחיצה לחידוש
  expireTimer = setTimeout(() => onExpire?.(), Math.max(0, expiresAt - Date.now() - 60_000));
}

/** יש טוקן תקף מהפעם הקודמת? */
export function hasSavedSession() {
  return Boolean(accessToken) && expiresAt > Date.now() + 60_000;
}

/** הממשק מבקש לדעת כשהכניסה עומדת לפוג. */
export function setOnExpire(fn) { onExpire = fn; scheduleExpire(); }

export function rememberEmail(email) { hintEmail = email; save(); }
let pendingResolve = null;
let pendingReject = null;

function waitForGis() {
  return new Promise((resolve) => {
    const check = () => (window.google?.accounts?.oauth2 ? resolve() : setTimeout(check, 50));
    check();
  });
}

restore();

export async function initAuth() {
  await waitForGis();
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPES,
    include_granted_scopes: true, // דער טאקען נעמט אריין אלע הרשאות וואס מען האט שוין אמאל דערלויבט (Gmail, Drive)
    callback: (resp) => {
      if (resp.error) {
        pendingReject?.(new Error(resp.error_description || resp.error));
      } else {
        accessToken = resp.access_token;
        expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        grantedScopes = resp.scope || grantedScopes;
        save();
        scheduleExpire();
        pendingResolve?.(accessToken);
      }
      pendingResolve = pendingReject = null;
    },
    error_callback: (err) => {
      pendingReject?.(new Error(err?.message || err?.type || 'login failed'));
      pendingResolve = pendingReject = null;
    },
  });
}

/** פותח חלון התחברות של גוגל. prompt='' = בלי לשאול שוב אם כבר אישר. */
/** דער יעצטיגער טאקען (פאר אונזער Apps Script — ער קוקט ווער פרעגט). */
export function currentToken() { return accessToken || ''; }

export function requestToken(prompt = '') {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient.requestAccessToken(hintEmail && prompt !== 'select_account'
      ? { prompt, login_hint: hintEmail } : { prompt });
  });
}

/** האט דער באנוצער דערלויבט "Google Sheets"? (אין גוגל'ס פענצטער קען מען אויסמעקן א הרשאה) */
export function hasSheetsScope() {
  return !grantedScopes || grantedScopes.includes('https://www.googleapis.com/auth/spreadsheets');
}

export function hasDriveScope() {
  return grantedScopes.includes(DRIVE_SCOPE);
}

/**
 * בעט (איין מאל) די הרשאה פאר דרייב. מוז גערופן ווערן גלייך פון א קליק
 * (אנדערש בלאקירט דער בראוזער דעם פענצטער פון גוגל).
 */
export function ensureDriveScope() {
  if (hasDriveScope()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient.requestAccessToken({
      scope: `${SCOPES} ${DRIVE_SCOPE}`, include_granted_scopes: true, prompt: '', login_hint: hintEmail || undefined,
    });
  });
}

// ---------- Gmail: שיקן אימעילס ----------
export function hasGmailScope() {
  return grantedScopes.split(' ').includes(GMAIL_SCOPE);
}

/** בעט (איין מאל) די הרשאה צו שיקן אימעילס. גלייך פון א קליק! */
export function ensureGmailScope() {
  if (hasGmailScope()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient.requestAccessToken({
      scope: `${SCOPES} ${GMAIL_SCOPE}`, include_granted_scopes: true, prompt: '', login_hint: hintEmail || undefined,
    });
  });
}

/** שיקט איין אימעיל (א פולשטענדיגער MIME טעקסט). ביז ~35MB. */
export async function gmailSend(mime) {
  // דער געווענליכער וועג (JSON מיט "raw") — ער ארבעט פונעם בראוזער. דער "upload" וועג ווערט אפט אפגעשטעלט
  // אין בראוזער ("Failed to fetch"), דעריבער נאר פאר גאר גרויסע אימעילס.
  const bytes = new TextEncoder().encode(mime);
  if (bytes.length < 4.5 * 1024 * 1024) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const raw = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return authFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }),
    });
  }
  return authFetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
    method: 'POST', headers: { 'Content-Type': 'message/rfc822' }, body: mime,
  });
}

// ---------- שערן דעם שיט ----------
// מיר בעטן נישט די "גאנצע דרייב" הרשאה (גוגל בלאקירט עס פאר אפליקאציעס וואס זענען נישט געפרופט).
// אנשטאט: די קליינע הרשאה (drive.file) + דער בעל הבית קלייבט איין מאל דעם שיט אין גוגל'ס "Picker" —
// דערנאך מעג דער אתר פירן ווער עס האט צוטריט צו יענעם שיט (און נאר צו אים).
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('script'));
    document.head.append(s);
  });
}

/** עפנט גוגל'ס פענצטער מיט נאר אונזער שיט; דער באנוצער דריקט "Select". */
export async function pickSheet() {
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((resolve) => window.gapi.load('picker', resolve));
  const P = window.google.picker;
  return new Promise((resolve, reject) => {
    const view = new P.DocsView(P.ViewId.SPREADSHEETS).setFileIds(CONFIG.SPREADSHEET_ID).setMode(P.DocsViewMode.LIST);
    const picker = new P.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(CONFIG.MAPS_API_KEY)
      .setAppId(CONFIG.PROJECT_NUMBER)
      .setCallback((data) => {
        if (data.action === P.Action.PICKED) resolve(true);
        else if (data.action === P.Action.CANCEL) resolve(false);
        else if (data.action === 'error') reject(new Error('picker'));
      })
      .setOrigin(window.location.protocol + '//' + window.location.host)
      .build();
    window.scrollTo(0, 0);
    picker.setVisible(true);
  });
}

/** ווער האט צוטריט צום שיט: [{ id, email, role, type }] */
export async function sheetPermissions() {
  const res = await authFetch(`https://www.googleapis.com/drive/v3/files/${CONFIG.SPREADSHEET_ID}/permissions?fields=permissions(id,emailAddress,role,type)&pageSize=100`);
  return (res.permissions || []).map((p) => ({ id: p.id, email: String(p.emailAddress || '').toLowerCase(), role: p.role, type: p.type }));
}

/** שערט דעם שיט מיט אן אימעיל (קען רעדאגירן). גוגל שיקט אים אן אימעיל מיט א לינק. */
export async function shareSheet(email, message = '') {
  const q = `sendNotificationEmail=true${message ? `&emailMessage=${encodeURIComponent(message)}` : ''}`;
  return authFetch(`https://www.googleapis.com/drive/v3/files/${CONFIG.SPREADSHEET_ID}/permissions?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }),
  });
}

/** נעמט צוריק דעם צוטריט. */
export async function unshareSheet(permissionId) {
  return authFetch(`https://www.googleapis.com/drive/v3/files/${CONFIG.SPREADSHEET_ID}/permissions/${permissionId}`, { method: 'DELETE' });
}

const DRIVE = 'https://www.googleapis.com/drive/v3/files';

/** געפינט (אדער שאפט) א פאלדער לויטן נאמען. parent = ID פון דעם פאלדער אויבן (אדער 'root'). */
export async function driveFolder(name, parent = 'root') {
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;
  const found = await authFetch(`${DRIVE}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
  if (found.files?.length) return found.files[0].id;
  const made = await authFetch(`${DRIVE}?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
  });
  return made.id;
}

/** לייגט ארויף א טעקע (File/Blob) אין א פאלדער. גיט צוריק דעם ID. */
export async function driveUpload(file, name, folderId) {
  const meta = { name, parents: [folderId] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  body.append('file', file);
  const res = await authFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body });
  return res.id;
}

export function signOut() {
  // נישט revoke: דאס מעקט אויס די דערלויבעניש ביי גוגל, און ביים קומענדיגן אריינגיין פרעגט גוגל אלעס פון ס'ניי
  accessToken = null;
  expiresAt = 0;
  clearTimeout(expireTimer);
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}

async function authFetch(url, options = {}, retried = false) {
  if (!accessToken) await requestToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 && !retried) {
    accessToken = null;
    if (silentMode) { save(); const e = new Error('session-expired'); e.status = 401; throw e; } // ביים ארויפלאדן: נישט עפענען קיין פענצטער אן א קליק                   // הטוקן לא תקף — מבקשים חדש ומנסים שוב
    await requestToken();
    return authFetch(url, options, true);
  }
  if (!res.ok) {
    let message = `${res.status}`;
    try { message = (await res.json()).error?.message || message; } catch { /* ignore */ }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export async function getUserEmail() {
  const info = await authFetch('https://www.googleapis.com/oauth2/v3/userinfo');
  return (info.email || '').toLowerCase();
}

const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}`;
const enc = encodeURIComponent;

/** קורא כמה לשוניות בבת אחת. מחזיר { שם: [[...שורות]] }. */
export async function readTabs(tabs) {
  const params = tabs.map((t) => `ranges=${enc(`${t}!A:AZ`)}`).join('&');
  const data = await authFetch(`${SHEETS}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`);
  const out = {};
  data.valueRanges.forEach((vr, i) => { out[tabs[i]] = vr.values || []; });
  return out;
}

/** קורא עמודה אחת (למשל A) — כדי למצוא שורה או את המספר הגבוה ביותר. */
/** לייענט איין צעל, למשל 'Photos!B12'. */
export async function readCell(a1) {
  const data = await authFetch(`${SHEETS}/values/${enc(a1)}?valueRenderOption=UNFORMATTED_VALUE`);
  return data.values?.[0]?.[0] ?? '';
}

export async function readColumn(tab, col = 'A') {
  const data = await authFetch(`${SHEETS}/values/${enc(`${tab}!${col}:${col}`)}?valueRenderOption=UNFORMATTED_VALUE`);
  return (data.values || []).map((r) => r[0]);
}

/** מוסיף שורה בסוף הלשונית. הערכים נשמרים כמו שהם (RAW), בלי פענוח. */
export function appendRow(tab, row) {
  return authFetch(
    `${SHEETS}/values/${enc(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) },
  );
}

/** מוסיף כמה שורות בבת אחת (קריאה אחת לגוגל). */
export function appendRows(tab, rows) {
  return authFetch(
    `${SHEETS}/values/${enc(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows }) },
  );
}

/** כותב טווח שלם, למשל 'Lists!R2:R40' עם [[v],[v]...]. */
export function updateRange(range, values) {
  return authFetch(
    `${SHEETS}/values/${enc(range)}?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) },
  );
}

/** מעדכן תא אחד, למשל 'Lists!H13'. */
export function updateCell(a1, value) {
  return authFetch(
    `${SHEETS}/values/${enc(a1)}?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[value]] }) },
  );
}

/** א סך שורות אויף איינמאל (קריאה אחת). data = [{ range: 'Contacts!A12', values: [[...]] }] */
export function batchUpdate(data) {
  return authFetch(`${SHEETS}/values:batchUpdate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}

/** מעדכן שורה שלמה לפי מספר השורה (1 = שורת הכותרות). */
export function updateRow(tab, rowNumber, row) {
  return authFetch(
    `${SHEETS}/values/${enc(`${tab}!A${rowNumber}`)}?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) },
  );
}
