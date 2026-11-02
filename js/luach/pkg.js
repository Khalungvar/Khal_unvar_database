// 📦 עותק עצמאי: חבילת ZIP עם דף הגבאים + התצוגה + מדריך התקנה — לבית כנסת שירוץ בלי שום קשר לאתר של אונגוואר.
// הם צריכים: חשבון גוגל, Client ID משלהם (Google Cloud), ואתר חינמי (GitHub Pages). הגיליון — העתק של הגיליון של בית הכנסת.
import { zip } from './tfdocx.js';

const TEXT = /\.(js|mjs|css|html|json|md|txt)$/;
const BLANK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const GUIDE = (name) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>התקנה – ${name}</title>
<style>body{font-family:Arial;max-width:820px;margin:30px auto;line-height:1.6;padding:0 16px}code{background:#eee;padding:1px 5px;border-radius:4px;direction:ltr;display:inline-block}li{margin:6px 0}</style></head><body>
<h1>התקנת מערכת זמני התפילות – ${name}</h1>
<p>החבילה הזאת עובדת לגמרי בפני עצמה. צריך לעשות את השלבים האלה פעם אחת.</p>
<h2>1. הגיליון</h2><ol>
<li>היכנסו לחשבון הגוגל של בית הכנסת, ופתחו את הגיליון שקיבלתם (או בקשו העתק). קובץ ← "יצירת עותק".</li>
<li>בגיליון החדש: שיתוף ← "כל מי שיש לו את הקישור" ← <b>צפייה</b> (המסך קורא ממנו בלי כניסה).</li>
<li>העתיקו את ה-ID של הגיליון (החלק הארוך בכתובת שבין <code>/d/</code> ל-<code>/edit</code>).</li>
<li>פתחו את הקובץ <code>js/luach/shul.js</code> ושימו את ה-ID במקום <code>PUT-SHEET-ID-HERE</code>.</li></ol>
<h2>2. כניסה עם גוגל (Client ID)</h2><ol>
<li>היכנסו ל-<code>console.cloud.google.com</code>, צרו פרויקט, והפעילו את <b>Google Sheets API</b>.</li>
<li>OAuth consent screen ← External ← מלאו שם ואימייל.</li>
<li>Credentials ← Create credentials ← OAuth client ID ← Web application. ב-Authorized JavaScript origins הוסיפו את כתובת האתר שלכם (שלב 3).</li>
<li>העתיקו את ה-Client ID לקובץ <code>js/config.js</code> במקום <code>PUT-CLIENT-ID-HERE</code>.</li></ol>
<h2>3. האתר (חינם)</h2><ol>
<li>פתחו חשבון ב-<code>github.com</code>, צרו מאגר (Repository) חדש, והעלו אליו את כל הקבצים מהחבילה (Add file ← Upload files).</li>
<li>Settings ← Pages ← Branch: main ← Save. אחרי דקה תקבלו כתובת, למשל <code>https://שם.github.io/מאגר/</code>.</li></ol>
<h2>4. שימוש</h2><ul>
<li>ניהול: <code>הכתובת/shul/</code> — כניסה עם גוגל. מי שיש לו הרשאת עריכה בגיליון — גבאי.</li>
<li>המסך: <code>הכתובת/display.html</code> בכרום, מסך מלא (F11). או: בהגדרות בית הכנסת ← "קובץ תצוגה עצמאי".</li>
<li>עדכונים: כשתקבלו חבילת עדכון — מעלים את הקבצים שוב לאותו מאגר (חוץ מ-<code>js/config.js</code> ו-<code>js/luach/shul.js</code>).</li></ul>
</body></html>`;

/** { name } → Blob (zip) */
export async function buildPackage({ name }, onStep = () => {}) {
  const files = await (await fetch(`rel/pkg-files.json?t=${Date.now()}`, { cache: 'no-store' })).json();
  const out = [];
  for (const [i, f] of files.entries()) {
    onStep(`${i + 1}/${files.length}`);
    const r = await fetch(`${f}?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) continue;
    if (f === 'img/logo.png') { out.push([f, Uint8Array.from(atob(BLANK_PNG), (c) => c.charCodeAt(0))]); continue; }
    if (!TEXT.test(f)) { out.push([f, new Uint8Array(await r.arrayBuffer())]); continue; }
    let t = await r.text();
    if (f === 'js/config.js') t = t.replace(/CLIENT_ID:\s*'[^']*'/, "CLIENT_ID: 'PUT-CLIENT-ID-HERE'").replace(/(_URL:\s*)'[^']*'/g, "$1''");
    if (f === 'js/luach/shul.js') t = t.replace(/bp: \{ key: 'bp', sheetId: '[^']*' \}/, `bp: { key: 'bp', sheetId: 'PUT-SHEET-ID-HERE', name: ${JSON.stringify(name)}, standalone: true }`);
    out.push([f, t]);
  }
  out.push(['index.html', '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=shul/"><a href="shul/">כניסה</a>']);
  out.push(['התקנה.html', GUIDE(name)]);
  const b = zip(out);
  return new Blob([b], { type: 'application/zip' });
}
