// 🌐 הורדות באתר הציבורי (ungvar.org): קובץ PDF → דרייב (פתוח לכל מי שיש לו קישור) → שורה בלשונית SiteDownloads של גיליון התצוגה (פומבי).
// מפתחות: booklet|<שנה>|<חודש> (קונטרס מצוה יומית לחודש) · luach_year (לוח שנתי) · luach_pocket (לוח כיס)
import { ensureDriveScope, driveFolder, driveUpload, drivePublic, otherSheet } from './google.js';
import { CONFIG } from './config.js';

const TAB = 'SiteDownloads';
const HEAD = ['key', 'label', 'url', 'file_id', 'updated_at', 'by', 'sig'];
const FOLDER = 'ungvar.org – הורדות לאתר';
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export async function siteDownloads() {
  const sh = otherSheet(CONFIG.DISPLAY_SHEET_ID);
  let rows;
  try { rows = await sh.read(`${TAB}!A1:G200`); } catch { await sh.addTab(TAB); await sh.write(`${TAB}!A1:G1`, [HEAD]); rows = [HEAD]; }
  return rows.slice(1).filter((r) => r[0]).map((r) => ({ key: String(r[0]), label: String(r[1] || ''), url: String(r[2] || ''), file_id: String(r[3] || ''), updated_at: String(r[4] || ''), by: String(r[5] || ''), sig: String(r[6] || '') }));
}
const rowOf = (x) => [x.key, x.label, x.url, x.file_id, x.updated_at, x.by || '', x.sig || ''];
async function writeAll(list) {
  const sh = otherSheet(CONFIG.DISPLAY_SHEET_ID);
  await sh.clear(`${TAB}!A2:G200`);
  await sh.write(`${TAB}!A1:G${list.length + 1}`, [HEAD, ...list.map(rowOf)]);
}
/** מחליף את התוכן של קובץ שכבר בדרייב (אותו קישור) */
async function driveReplace(id, blob) {
  const { currentToken } = await import('./google.js');
  const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id`, { method: 'PATCH', headers: { Authorization: `Bearer ${currentToken()}`, 'Content-Type': 'application/pdf' }, body: blob });
  if (!r.ok) { const e = new Error(`drive ${r.status}`); e.status = r.status; throw e; }
}

/** מעלה את הקובץ ומעדכן את השורה. חייב להיקרא ישר מלחיצה (בקשת הרשאת דרייב בפעם הראשונה). */
export async function publishDownload(key, label, bytesOrFile, fileName, by = '', sig = '') {
  await ensureDriveScope();
  const blob = bytesOrFile instanceof Blob ? bytesOrFile : new Blob([bytesOrFile], { type: 'application/pdf' });
  const list = await siteDownloads();
  const old = list.find((x) => x.key === key);
  let id = '';
  // כבר קיים — מחליפים את התוכן (הקישור נשאר אותו קישור)
  if (old?.file_id) { try { await driveReplace(old.file_id, blob); id = old.file_id; } catch { id = ''; } }
  if (!id) { const folder = await driveFolder(FOLDER); id = await driveUpload(blob, fileName, folder); await drivePublic(id); }
  const url = `https://drive.google.com/uc?export=download&id=${id}`;
  await writeAll([...list.filter((x) => x.key !== key), { key, label, url, file_id: id, updated_at: stamp(), by, sig }]);
  return { url, id };
}

export async function unpublishDownload(key) {
  await writeAll((await siteDownloads()).filter((x) => x.key !== key));
}

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = [['booklet|', '📘 קונטרס'], ['luach|', '📅 לוח חודשי'], ['cycle|', '🗓 לוח המחזור (כיס)']];
const kindOf = (k) => (KIND.find(([p]) => k.startsWith(p)) || ['', '📄 קובץ'])[1];

/** חלון: מה מופיע עכשיו באתר (הכל עולה לבד) + "לבנות ולהעלות עכשיו" */
export async function openSiteDownloads(toast = () => {}) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg'; dlg.dir = 'rtl';
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  const draw = async () => {
    dlg.innerHTML = '<button type="button" class="x-close">✕</button><h3>🌐 הורדות באתר ungvar.org</h3><p class="muted">טוען…</p>';
    dlg.querySelector('.x-close').onclick = close;
    let list = [];
    try { list = await siteDownloads(); } catch (err) { dlg.querySelector('p').textContent = `❌ ${err.message || err}`; return; }
    dlg.innerHTML = `<button type="button" class="x-close">✕</button><h3>🌐 הורדות באתר ungvar.org</h3>
      <p class="muted small">הכל עולה לבד: כשמנהל נכנס למערכת, הקונטרס (החודש + הבא, עם ההנצחות), הלוח החודשי (החודש + הבא) ולוח המחזור נבנים ומועלים — רק מה שהשתנה. אחרי הוספת הנצחה / שורה בלוח — תוך דקה. הקישור באתר נשאר אותו קישור.</p>
      <table class="ms-table" style="width:100%"><tbody>
      ${list.map((x) => `<tr><td><b>${h(kindOf(x.key))}</b></td><td><a href="${h(x.url)}" target="_blank" rel="noopener">${h(x.label || 'קובץ')}</a></td><td class="muted small">${h(x.updated_at)}</td></tr>`).join('') || '<tr><td class="muted">— עדיין לא עלה כלום —</td></tr>'}
      </tbody></table><p id="sd-msg" class="muted"></p>
      <p style="display:flex;gap:8px"><button type="button" class="btn primary" data-now>🔄 לבנות ולהעלות עכשיו</button><button type="button" class="btn ghost" data-close>סגירה</button></p>`;
    dlg.querySelector('.x-close').onclick = close; dlg.querySelector('[data-close]').onclick = close;
    const msg = dlg.querySelector('#sd-msg');
    dlg.querySelector('[data-now]').onclick = async (e) => {
      e.target.disabled = true; msg.textContent = 'בונה ומעלה… (יכול לקחת דקה-שתיים)';
      try {
        await ensureDriveScope(); // בפעם הראשונה — גוגל מבקש אישור לדרייב
        const { autoPublish } = await import('./sitepub.js');
        const n = await autoPublish();
        msg.textContent = n ? `✅ עלו ${n} קבצים` : '✅ הכל כבר מעודכן'; draw();
      } catch (err) { msg.textContent = `❌ ${err.message || err}`; e.target.disabled = false; }
    };
  };
  draw();
}
