/**
 * 🔎 חיפוש "אולי התכוונת" — שמות דומים (כתיב עברי/אידיש, צליל באנגלית, טעות הקלדה קטנה, ובין עברית לאנגלית).
 * רק על שדות השם. משמש אחרי ההתאמות המדויקות.
 */

const NIQQUD = /[֑-ׇ'"׳״`.\-]/g;
const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const isHe = (w) => /[א-ת]/.test(w);

/** מילה מנורמלת (לבדיקת טעות הקלדה) */
function plain(w) {
  const s = String(w || '').toLowerCase().replace(NIQQUD, '');
  return isHe(s) ? s.replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/[^א-ת]/g, '') : s.replace(/[^a-z]/g, '');
}

/** "שלד" של עיצורים — משותף לעברית ולאנגלית, כך ש"פריעדמאן" = "פרידמן" = "Friedman" */
function skel(w) {
  let s = plain(w);
  if (!s) return '';
  let out = '';
  if (isHe(s)) {
    s = s.replace(/^וו/, 'ב').replace(/וו/g, 'ב').replace(/^ו(?=[א-ת])/, 'ב');
    for (let i = 0; i < s.length; i += 1) {
      const c = s[i];
      const next = s[i + 1];
      if (c === 'ש' || c === 'ס' || c === 'ז') out += 's';
      else if (c === 'צ') out += 'c';
      else if (c === 'ב') out += 'b';
      else if (c === 'ג') out += 'g';
      else if (c === 'ד') out += 'd';
      else if (c === 'ח') out += 'h';
      else if (c === 'כ') out += i === 0 ? 'k' : 'h';
      else if (c === 'ק') out += 'k';
      else if (c === 'ט' || c === 'ת') out += 't';
      else if (c === 'ל') out += 'l';
      else if (c === 'מ') out += 'm';
      else if (c === 'נ') out += 'n';
      else if (c === 'פ') out += 'p';
      else if (c === 'ר') out += 'r';
      else if (c === 'י' && i === 0 && next && !'יו'.includes(next)) out += 'j';
      // א ע ה ו י — תנועות, לא נכנסות
    }
  } else {
    s = s.replace(/sch/g, 's').replace(/sh/g, 's').replace(/tz|ts/g, 'c').replace(/ch|kh/g, 'h').replace(/ph/g, 'p')
      .replace(/ck/g, 'k').replace(/th/g, 't').replace(/x/g, 'ks').replace(/^y(?=[aeiou])/, 'j');
    for (let i = 0; i < s.length; i += 1) {
      const c = s[i];
      if ('bvw'.includes(c)) out += 'b';
      else if ('fp'.includes(c)) out += 'p';
      else if ('ckq'.includes(c)) out += 'k';
      else if ('sz'.includes(c)) out += 's';
      else if (c === 'j') out += i === 0 ? 'j' : 'g';
      else if ('aeiouyh'.includes(c)) { /* תנועות ו־h שקט */ }
      else out += c;
    }
  }
  return out.replace(/(.)\1+/g, '$1');
}

/** מרחק עריכה (לוונשטיין), עם עצירה מוקדמת */
function lev(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const NAME_FIELDS = ['first_name_he', 'last_name_he', 'wife_name_he', 'first_name_en', 'last_name_en', 'wife_name_en', 'legal_first_name'];
const cache = new WeakMap();
function wordsOf(c) {
  const key = NAME_FIELDS.map((f) => c[f] || '').join('|');
  const hit = cache.get(c);
  if (hit && hit.key === key) return hit.words;
  const words = [];
  NAME_FIELDS.forEach((f) => String(c[f] || '').split(/[\s\-–,]+/).forEach((w) => {
    const p = plain(w);
    if (p.length >= 2) words.push({ p, s: skel(w), he: isHe(p) });
  }));
  cache.set(c, { key, words });
  return words;
}

/** כמה דומה מילת חיפוש למילה בשם (0 = לא) */
function wordScore(q, w) {
  if (!q.p || !w.p) return 0;
  const same = q.he === w.he;
  if (same && w.p.startsWith(q.p)) return 5;
  if (q.s.length >= 2 && w.s === q.s) return same ? 4 : 3.5;
  if (same) {
    const max = q.p.length >= 7 ? 2 : q.p.length >= 4 ? 1 : 0;
    if (max) {
      const d = lev(q.p, w.p.slice(0, Math.max(q.p.length, Math.min(w.p.length, q.p.length + 1))), max);
      if (d <= max) return 3 - d * 0.6;
      if (lev(q.p, w.p, max) <= max) return 2.5 - max * 0.5;
    }
  }
  if (q.s.length >= 3 && w.s.startsWith(q.s)) return same ? 2.5 : 2.2;
  if (q.s.length >= 4 && lev(q.s, w.s, 1) <= 1) return 1.5;
  return 0;
}

/**
 * מחזיר את הכרטיסים הדומים (בלי אלה שב־exclude), מהדומה ביותר.
 * כל מילה בחיפוש צריכה להתאים למילה כלשהי בשם.
 */
export function fuzzySearch(contacts, query, { exclude = new Set(), limit = 30 } = {}) {
  const qs = String(query || '').split(/\s+/).map((w) => ({ p: plain(w), s: skel(w), he: isHe(plain(w)) })).filter((q) => q.p.length >= 2);
  if (!qs.length) return [];
  const out = [];
  contacts.forEach((c) => {
    if (exclude.has(c)) return;
    const words = wordsOf(c);
    if (!words.length) return;
    let total = 0;
    for (const q of qs) {
      let best = 0;
      for (const w of words) { const sc = wordScore(q, w); if (sc > best) best = sc; if (best >= 5) break; }
      if (!best) return;
      total += best;
    }
    out.push({ c, score: total / qs.length });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.c);
}
