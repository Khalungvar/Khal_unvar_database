// בויט apps-script/luach-bundle.gs פון js/luach/autovars.js (און וואס ער ניצט) — אן קיין npm.
// יעדער מאדול ווערט א פונקציע; import/export ווערן פשוטע משתנים. דערנאך: LUACH.autoVars(...), LUACH.nextOccurrence(...)
// לויפן: node tools/build-luach-gs.mjs — און קאפירן די טעקע אין Apps Script (טעקע "luach").
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const order = []; const seen = new Set();
function visit(file) {
  if (seen.has(file)) return; seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^import\s+\{[^}]*\}\s+from\s+'([^']+)';/gm)) visit(path.resolve(path.dirname(file), m[1]));
  order.push(file);
}
visit(path.join(root, 'js/luach/autovars.js'));
const id = (f) => path.relative(root, f);
let out = '// נישט טוישן מיט דער האנט — געבויט פון js/luach/autovars.js דורך tools/build-luach-gs.mjs\nvar LUACH = (function () {\n  var __m = {};\n';
for (const f of order) {
  let src = fs.readFileSync(f, 'utf8');
  const exps = [];
  src = src.replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';/gm, (all, names, from) => {
    const key = id(path.resolve(path.dirname(f), from));
    const parts = names.split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/\s+as\s+/, ': '));
    return `const { ${parts.join(', ')} } = __m[${JSON.stringify(key)}];`;
  });
  src = src.replace(/^export\s+(async\s+function|function)\s+([A-Za-z_$][\w$]*)/gm, (all, kw, n) => { exps.push(n); return `${kw} ${n}`; });
  src = src.replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (all, kw, n) => { exps.push(n); return `${kw} ${n}`; });
  src = src.replace(/^export\s+\{([^}]*)\};?/gm, (all, names) => { names.split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => exps.push(x.replace(/\s+as\s+/, ':'))); return ''; });
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`unsupported import/export in ${id(f)}`);
  const obj = exps.map((e) => (e.includes(':') ? `${e.split(':')[1]}: ${e.split(':')[0]}` : e)).join(', ');
  out += `  __m[${JSON.stringify(id(f))}] = (function () {\n${src}\nreturn { ${obj} };\n  })();\n`;
}
out += `  return __m[${JSON.stringify('js/luach/autovars.js')}];\n})();\n`;
fs.writeFileSync(path.join(root, 'apps-script/luach-bundle.gs'), out);
console.log('apps-script/luach-bundle.gs', out.length, 'bytes,', order.map(id).join(' → '));
