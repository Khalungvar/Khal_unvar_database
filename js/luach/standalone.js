// ⬇ קובץ תצוגה עצמאי: HTML אחד עם כל הקוד, העיצוב, התמונות ותמונת-מצב של הנתונים.
// הקוד נלקח מגרסה משוחררת (rel/<N>/) — כך הקובץ נעול על הגרסה הזאת.
// בדפדפן: כל מודול הופך ל-Blob, ו-importmap מחבר ביניהם (במקום נתיבים יחסיים).

const RE = /(\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]+\s*from\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;
const resolve = (from, spec) => { const u = new URL(spec.split('?')[0], `https://x/${from}`); return u.pathname.slice(1); };
const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', woff2: 'font/woff2', svg: 'image/svg+xml' };

async function gviz(sheetId, tab) {
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${tab}&headers=1&t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

/** { key, sheetId, cfg, ver } → טקסט ה-HTML */
export async function buildStandalone({ key, sheetId, cfg, ver }) {
  if (!ver) throw new Error('אין עדיין גרסה משוחררת');
  const base = `rel/${ver}/`;
  const get = async (p, bin = false) => { const r = await fetch(base + p, { cache: 'no-store' }); if (!r.ok) throw new Error(`חסר ${p}`); return bin ? r.arrayBuffer() : r.text(); };
  const man = JSON.parse(await get('manifest.json'));
  // תמונות וגופן → data URL
  const data = {};
  for (const a of man.assets.filter((x) => !x.endsWith('.css'))) data[a] = `data:${MIME[a.split('.').pop()] || 'application/octet-stream'};base64,${toB64(await get(a, true))}`;
  // עיצוב: url('../img/…') → data
  let css = await get('css/display.css');
  css = css.replace(/url\((['"]?)\.\.\/([^'")]+)\1\)/g, (m, q, p) => (data[p] ? `url('${data[p]}')` : m));
  // קוד: נתיבים יחסיים → "@d/<נתיב>"; תמונות בקוד → data
  const src = {};
  for (const p of man.js) {
    let code = await get(p);
    code = code.replace(RE, (m, pre, q, spec) => `${pre}${q}@d/${resolve(p, spec)}${q}`);
    for (const [a, u] of Object.entries(data)) if (a.startsWith('img/')) code = code.split(`'${a}'`).join(`'${u}'`);
    src[p] = code;
  }
  // תמונת-מצב של הנתונים — כדי שגם בלי אינטרנט בפעם הראשונה יהיו זמנים נכונים
  const snap = {};
  for (const t of ['Minyanim', 'Screen', 'ShulConfig', 'Simchos', 'RebbeAway']) snap[t] = await gviz(sheetId, t);
  const html = await get('display.html');
  const body = (html.match(/<body>([\s\S]*?)<\/body>/) || [, ''])[1].replace(/<script[\s\S]*?<\/script>/g, '');
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'תצוגה'])[1];
  const boot = { key, sheetId, cfg, ver: Number(ver), built: Date.now(), snap, standalone: true };
  const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="he" dir="rtl" translate="no">
<head>
<meta charset="utf-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=1920,height=1080">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
${body}
<script>window.DISP_BOOT = ${esc(JSON.stringify(boot))};</script>
<script>
(function () {
  var SRC = ${esc(JSON.stringify(src))};
  var map = {};
  Object.keys(SRC).forEach(function (p) { map['@d/' + p] = URL.createObjectURL(new Blob([SRC[p]], { type: 'text/javascript' })); });
  var im = document.createElement('script'); im.type = 'importmap'; im.textContent = JSON.stringify({ imports: map }); document.head.appendChild(im);
  var m = document.createElement('script'); m.type = 'module'; m.textContent = "import '@d/js/display/display.js';"; document.body.appendChild(m);
})();
</script>
</body>
</html>`;
}
