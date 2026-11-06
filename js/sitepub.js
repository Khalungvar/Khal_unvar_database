// 🌐 פרסום אוטומטי לאתר הציבורי (ungvar.org): כשמנהל עם הרשאת דרייב נכנס למערכת — ברקע, בלי לחיצה.
// קונטרס מצוה יומית (החודש + הבא, עם ההנצחות), לוח אונגוואר החודשי (החודש + הבא), לוח המחזור הנוכחי.
// כל קובץ נבנה מחדש רק כשמשהו בו השתנה (sig) — ומוחלף באותו קישור. הגופנים (בתשלום) נשארים פרטיים; הם רק בתוך ה-PDF.
import { hasDriveScope } from './google.js';
import { state } from './data.js';
import { siteDownloads, publishDownload } from './sitedl.js';

let running = false; let again = false; let timer = 0;

async function targets() {
  const out = [];
  try { const { bookletTargets } = await import('./luach/booklet.js'); out.push(...await bookletTargets()); } catch (err) { console.warn('sitepub booklet', err); }
  try { const { luachTargets } = await import('./luach/view.js'); out.push(...await luachTargets()); } catch (err) { console.warn('sitepub luach', err); }
  try { const { cycleTarget } = await import('./luach/cycle.js'); out.push(await cycleTarget()); } catch (err) { console.warn('sitepub cycle', err); }
  return out;
}

/** בודק ומעלה מה שחסר / השתנה. מחזיר כמה קבצים עלו. */
export async function autoPublish({ toast = null } = {}) {
  if (!state.isAdmin || !hasDriveScope()) return 0;
  if (running) { again = true; return 0; }
  running = true; let n = 0;
  try {
    const have = await siteDownloads();
    for (const t of await targets()) {
      const row = have.find((x) => x.key === t.key);
      if (row && row.sig === t.sig) continue;
      try {
        const bytes = await t.build(); // eslint-disable-line no-await-in-loop
        await publishDownload(t.key, t.label, bytes, t.file, state.email || 'auto', t.sig); // eslint-disable-line no-await-in-loop
        n += 1;
      } catch (err) { console.warn('sitepub', t.key, err); }
    }
    if (n && toast) toast(`🌐 עודכנו ${n} קבצים באתר ungvar.org`);
  } catch (err) { console.warn('sitepub', err); } finally { running = false; }
  if (again) { again = false; return n + await autoPublish({ toast }); }
  return n;
}

/** אחרי שינוי (הנצחה, שורה בלוח, טקסט) — בעוד דקה */
export function sitePubSoon(toast = null) {
  clearTimeout(timer);
  timer = setTimeout(() => { autoPublish({ toast }).catch(() => {}); }, 60000);
}
