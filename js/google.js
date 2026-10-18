// לוגאין עם גוגל וגישה לגוגל שיטס.
// הטוקן נשמר רק בזיכרון של הדף, ולא נשמר בדפדפן.
import { CONFIG, SCOPES } from './config.js';

let tokenClient = null;
let accessToken = null;
let pendingResolve = null;
let pendingReject = null;

function waitForGis() {
  return new Promise((resolve) => {
    const check = () => (window.google?.accounts?.oauth2 ? resolve() : setTimeout(check, 50));
    check();
  });
}

export async function initAuth() {
  await waitForGis();
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        pendingReject?.(new Error(resp.error_description || resp.error));
      } else {
        accessToken = resp.access_token;
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
export function requestToken(prompt = '') {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient.requestAccessToken({ prompt });
  });
}

export function signOut() {
  if (accessToken) window.google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
}

async function authFetch(url, options = {}, retried = false) {
  if (!accessToken) await requestToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 && !retried) {
    await requestToken();                 // הטוקן פג (אחרי שעה) — מחדשים ומנסים שוב
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

/** מעדכן תא אחד, למשל 'Lists!H13'. */
export function updateCell(a1, value) {
  return authFetch(
    `${SHEETS}/values/${enc(a1)}?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[value]] }) },
  );
}

/** מעדכן שורה שלמה לפי מספר השורה (1 = שורת הכותרות). */
export function updateRow(tab, rowNumber, row) {
  return authFetch(
    `${SHEETS}/values/${enc(`${tab}!A${rowNumber}`)}?valueInputOption=RAW`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) },
  );
}
