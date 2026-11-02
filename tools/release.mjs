// שחרור גרסה של התצוגה: node tools/release.mjs [הערה]
// מעתיק את כל מה שהתצוגה צריכה ל-rel/<N>/ (קוד, עיצוב, תמונות), ומוסיף ל-rel/index.json.
// בתי כנסת שנעולים על גרסה — רצים מהעותק הזה, ולא משתנים כשהאתר מתעדכן.
import fs from 'node:fs'; import path from 'node:path';
import { closure } from './deps.mjs';
const note = process.argv.slice(2).join(' ');
const idxP = 'rel/index.json';
const idx = fs.existsSync(idxP) ? JSON.parse(fs.readFileSync(idxP, 'utf8')) : [];
const n = (idx.length ? Math.max(...idx.map((x) => x.n)) : 0) + 1;
const out = `rel/${n}`;
const cp = (f) => { const d = path.join(out, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(f, d); };
const js = closure('js/display/display.js');
const assets = ['css/display.css', 'fonts/frank-ruhl-libre-latin.woff2', 'img/logo.png', ...fs.readdirSync('img/display').map((f) => `img/display/${f}`)];
[...js, ...assets].forEach(cp);
// display.html: בלי importmap ובלי ?v= — כל הקבצים מתוך התיקייה של הגרסה
let html = fs.readFileSync('display.html', 'utf8');
html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/css\/display\.css\?v=\d+/, 'css/display.css')
  .replace(/<script type="module" src="js\/display\/display\.js\?v=\d+"><\/script>/, `<script>window.DISP_REL = ${n};</script>\n<script type="module" src="js/display/display.js"></script>`);
fs.writeFileSync(path.join(out, 'display.html'), html);
const date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ n, date, note, js, assets }, null, 1));
idx.push({ n, date, note });
fs.writeFileSync(idxP, JSON.stringify(idx, null, 1));
console.log(`release ${n}: ${js.length} js, ${assets.length} assets`);
