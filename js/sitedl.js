// 🌐 הורדות באתר הציבורי (ungvar.org): קובץ PDF → דרייב (פתוח לכל מי שיש לו קישור) → שורה בלשונית SiteDownloads של גיליון התצוגה (פומבי).
// מפתחות: booklet|<שנה>|<חודש> (קונטרס מצוה יומית לחודש) · luach_year (לוח שנתי) · luach_pocket (לוח כיס)
import { ensureDriveScope, driveFolder, driveUpload, drivePublic, otherSheet } from './google.js';
import { CONFIG } from './config.js';

const TAB = 'SiteDownloads';
const HEAD = ['key', 'label', 'url', 'file_id', 'updated_at', 'by'];
const FOLDER = 'ungvar.org – הורדות לאתר';
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export async function siteDownloads() {
  const sh = otherSheet(CONFIG.DISPLAY_SHEET_ID);
  let rows;
  try { rows = await sh.read(`${TAB}!A1:F200`); } catch { await sh.addTab(TAB); await sh.write(`${TAB}!A1:F1`, [HEAD]); rows = [HEAD]; }
  return rows.slice(1).filter((r) => r[0]).map((r) => ({ key: String(r[0]), label: String(r[1] || ''), url: String(r[2] || ''), file_id: String(r[3] || ''), updated_at: String(r[4] || '') }));
}

/** מעלה את הקובץ ומעדכן את השורה. חייב להיקרא ישר מלחיצה (בקשת הרשאת דרייב בפעם הראשונה). */
export async function publishDownload(key, label, bytesOrFile, fileName, by = '') {
  await ensureDriveScope();
  const folder = await driveFolder(FOLDER);
  const blob = bytesOrFile instanceof Blob ? bytesOrFile : new Blob([bytesOrFile], { type: 'application/pdf' });
  const id = await driveUpload(blob, fileName, folder);
  await drivePublic(id);
  const url = `https://drive.google.com/uc?export=download&id=${id}`;
  const sh = otherSheet(CONFIG.DISPLAY_SHEET_ID);
  const list = await siteDownloads();
  const all = [...list.filter((x) => x.key !== key).map((x) => [x.key, x.label, x.url, x.file_id, x.updated_at, '']), [key, label, url, id, stamp(), by]];
  await sh.clear(`${TAB}!A2:F200`);
  await sh.write(`${TAB}!A1:F${all.length + 1}`, [HEAD, ...all]);
  return { url, id };
}

export async function unpublishDownload(key) {
  const sh = otherSheet(CONFIG.DISPLAY_SHEET_ID);
  const list = (await siteDownloads()).filter((x) => x.key !== key);
  await sh.clear(`${TAB}!A2:F200`);
  if (list.length) await sh.write(`${TAB}!A2:F${list.length + 1}`, list.map((x) => [x.key, x.label, x.url, x.file_id, x.updated_at, '']));
}

const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SLOTS = [['luach_year', '📅 לוח שנתי'], ['luach_pocket', '🗓 לוח כיס']];

/** חלון: מה מופיע עכשיו באתר + העלאת לוח שנתי / לוח כיס (קובץ PDF מהמחשב) */
export async function openSiteDownloads(toast = () => {}) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg'; dlg.dir = 'rtl';
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  const draw = async () => {
    dlg.innerHTML = '<button type="button" class="x-close">✕</button><h3>🌐 הורדות באתר ungvar.org</h3><p class="muted">טוען…</p>';
    dlg.querySelector('.x-close').onclick = close;
    let list = [];
    try { list = await siteDownloads(); } catch (err) { dlg.querySelector('p').textContent = `❌ ${err.message || err}`; return; }
    const by = (k) => list.find((x) => x.key === k);
    const bk = list.filter((x) => x.key.startsWith('booklet|'));
    dlg.innerHTML = `<button type="button" class="x-close">✕</button><h3>🌐 הורדות באתר ungvar.org</h3>
      <p class="muted small">הקבצים עולים לדרייב (פתוחים לכל מי שיש לו את הקישור) ומופיעים בדף הבית של האתר. קונטרס מצוה יומית — מפרסמים מתוך הקונטרס עצמו: 🖨 הדפסה / PDF ← 🌐 פרסום באתר.</p>
      <table class="ms-table" style="width:100%"><tbody>
      ${SLOTS.map(([k, l]) => { const x = by(k); return `<tr><td><b>${l}</b></td><td>${x ? `<a href="${h(x.url)}" target="_blank" rel="noopener">${h(x.label || 'קובץ')}</a> <span class="muted small">${h(x.updated_at)}</span>` : '<span class="muted">— אין —</span>'}</td>
        <td><label class="btn small-btn">⬆ העלאת PDF<input type="file" accept="application/pdf" hidden data-up="${k}" data-l="${h(l.replace(/^\S+\s/, ''))}"></label>${x ? ` <button type="button" class="linkish" data-del="${k}">✕ הסרה</button>` : ''}</td></tr>`; }).join('')}
      ${bk.map((x) => `<tr><td><b>📘 קונטרס</b></td><td><a href="${h(x.url)}" target="_blank" rel="noopener">${h(x.label)}</a> <span class="muted small">${h(x.updated_at)}</span></td><td><button type="button" class="linkish" data-del="${h(x.key)}">✕ הסרה</button></td></tr>`).join('')}
      </tbody></table><p id="sd-msg" class="muted"></p>
      <p><button type="button" class="btn ghost" data-close>סגירה</button></p>`;
    dlg.querySelector('.x-close').onclick = close; dlg.querySelector('[data-close]').onclick = close;
    const msg = dlg.querySelector('#sd-msg');
    dlg.querySelectorAll('[data-up]').forEach((inp) => {
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        msg.textContent = 'מעלה…';
        try { await publishDownload(inp.dataset.up, inp.dataset.l, f, f.name); toast('פורסם באתר.'); draw(); } catch (err) { msg.textContent = `❌ ${err.message || err}`; }
      };
    });
    dlg.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!window.confirm('להסיר מהאתר? (הקובץ נשאר בדרייב)')) return;
        try { await unpublishDownload(b.dataset.del); draw(); } catch (err) { msg.textContent = `❌ ${err.message || err}`; }
      };
    });
  };
  draw();
}
