// תלויות של מודול (import סטטי ודינמי, רק נתיבים יחסיים) — לשחרור גרסה ולקובץ התצוגה העצמאי
import fs from 'node:fs'; import path from 'node:path';
export const RE = /(\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]+\s*from\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;
export function closure(entry, root = '.') {
  const seen = new Map(); const order = [];
  const visit = (p) => {
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (seen.has(rel)) return; seen.set(rel, true);
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(RE)) visit(path.join(path.dirname(p), m[3].split('?')[0]));
    order.push(rel);
  };
  visit(path.join(root, entry)); return order;
}
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) console.log(closure(process.argv[2]).join('\n'));
