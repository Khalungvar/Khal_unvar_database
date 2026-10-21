// איינמאליגער מעבר: די אלטע פעלדער (מוסדות, "יוצא", תגיות כלליות, תגיות נוספות, נשי) → עץ התגיות (c.tags).
// אלעס קומט אריין אלס "לא נבדק". מ'רירט נישט קיין קאנטאקט וואס האט שוין תגיות. גארנישט ווערט אויסגעמעקט.
import { state, loadAll } from './data.js';
import { batchUpdate } from './google.js';
import { tagsOf, serialize, UNCHECKED } from './tags.js';
import { splitTags } from './util.js';

const T = (v) => v === true || String(v).toUpperCase() === 'TRUE';
const BP = 'ביהמ"ד בארא פארק';
const YS = 'ישיבת בית שערים (ירושלים)';

function finder() {
  const nodes = (state.tagTree || []).map((r) => ({ id: String(r.node_id), parent: String(r.parent_id ?? '').trim(), name: String(r.name || '').trim() }));
  const by = (parent, name) => nodes.find((n) => n.parent === String(parent) && n.name === name)?.id;
  const root = (name) => by('', name);
  return { by, root };
}

/** וועג פון נעמען: ['ביהמ"ד', 'o:…', 'מתפלל שבת', 'שבת שחרית'] → ids */
function resolver() {
  const { by, root } = finder();
  return (names) => {
    const out = [];
    let parent = '';
    let group = '';
    for (const nm of names) {
      if (nm.startsWith('o:')) { out.push(nm); continue; }
      // אונטער א מוסד: די תפקידים הענגען אונטער דער גרופע (שלב 1)
      const pid = out.length && String(out[out.length - 1]).startsWith('o:') ? group : parent;
      const id = pid === '' ? root(nm) : by(pid, nm);
      if (!id) return null;
      out.push(id);
      if (out.length === 1) group = id;
      parent = id;
    }
    return out;
  };
}

export function planMigration() {
  const R = resolver();
  const G = { bm: 'ביהמ"ד', k: 'כולל/ישיבה', o: 'חבורות און מסגרת', anash: 'אנ"ש', fam: 'משפחת רבותינו', tal: 'תלמידי רבותינו', rab: 'רבנים', old: 'אלטע רשימה' };
  const bmOf = (c) => { const b = splitTags(c.beis_medrash); return b.length === 1 ? b[0] : BP; };
  const OLD_MAP = {
    'מתפלל': () => [[G.bm, `o:${BP}`, 'מתפלל ימות החול'], ''],
    'תלמידים': () => [[G.tal, 'תלמיד רבינו זי"ע'], ''],
    'ישיבה גדולה דבארא פארק': () => [[G.tal, 'תלמיד ישיבה גדולה דבארא פארק'], ''],
    'רבנים': () => [[G.rab, 'רבנים ואדמורי"ם כללי'], ''],
    'קינדער פון מתפללים': () => [[G.bm, `o:${BP}`, 'מתפלל שבת'], 'f'],
    'מתפלל שבת בוקר': () => [[G.bm, `o:${BP}`, 'מתפלל שבת', 'שבת שחרית'], ''],
    'משפחת רבותינו': () => [[G.fam, 'משפחת קליין'], ''],
    'כולל': () => [[G.k, `o:${kollelName('כולל הוראה')}`, 'אברך כולל'], ''],
    'איחוד צעירי אונגוואר': () => [[G.o, 'o:חבורת הבחורים'], 'f'],
    'יונגעלייט מתפללים': () => [[G.bm, `o:${BP}`, 'מתפלל שבת', 'שבת שחרית'], ''],
    'וועד': () => [[G.bm, `o:${BP}`, 'גבאים ועסקנים'], ''],
    'חבורה': () => [[G.o, 'o:חבורת הבחורים'], 'f'],
  };
  const COMM = {
    'אנ"ש': () => [G.anash], 'משפחת רבותינו': () => [G.fam], 'תלמיד רבינו זי"ע': () => [G.tal, 'תלמיד רבינו זי"ע'],
    'תלמיד רבינו שליט"א': () => [G.tal, 'תלמיד ישיבות כ"ק אדמו"ר שליט"א'], 'רבנים': () => [G.rab],
    'מתפלל שבת בוקר': (c) => [G.bm, `o:${bmOf(c)}`, 'מתפלל שבת', 'שבת שחרית'],
    'מתפלל שבת לילה': (c) => [G.bm, `o:${bmOf(c)}`, 'מתפלל שבת', 'ליל שבת'],
    'מתפלל ימות החול': (c) => [G.bm, `o:${bmOf(c)}`, 'מתפלל ימות החול'],
    'לומדי בית המדרש והשיעורים': (c) => [G.bm, `o:${bmOf(c)}`, 'לומדים ושיעורים'],
    'תלמיד בית שערים ירושלים': () => [G.k, `o:${YS}`, 'תלמיד'],
    'כולל': () => [G.k], 'כולל מאנסי': () => [G.k, 'o:כולל מאנסי'],
    'מתפלל לשעבר בארא פארק': () => [G.bm, `o:${BP}`],
  };
  const DROP = new Set(['אלטע רשימה צו דורכגיין', '?', 'לייקוואוד', 'וויליאמסבורג', 'ירושלים']);
  const unknown = new Map();
  const plan = [];
  const skipped = { hasTags: 0 };
  for (const c of state.contacts) {
    if (tagsOf(c).length) { skipped.hasTags += 1; continue; }
    const E = [];
    const add = (names, o = '') => {
      const p = R(names);
      if (!p) { unknown.set(names.join(' › '), (unknown.get(names.join(' › ')) || 0) + 1); return; }
      E.push({ p, s: UNCHECKED, ...(o ? { o } : {}) });
    };
    [['beis_medrash', G.bm], ['kollel', G.k], ['organization', G.o]].forEach(([col, g]) => {
      splitTags(c[col]).forEach((v) => add([g, `o:${v}`], T(c[`${col}_former`]) ? 'f' : ''));
    });
    if (T(c.wife_in_neshei)) add([G.o, 'o:נשי אונגוואר']);
    splitTags(c.community_tags).forEach((tg) => {
      if (DROP.has(tg)) return;
      if (COMM[tg]) add(COMM[tg](c), tg === 'מתפלל לשעבר בארא פארק' ? 'f' : '');
      else unknown.set(`community: ${tg}`, (unknown.get(`community: ${tg}`) || 0) + 1);
    });
    String(c.org_tags || '').split(';').map((x) => x.trim()).filter(Boolean).forEach((e) => {
      const i = e.indexOf(':'); const org = e.slice(0, i).trim(); const tag = e.slice(i + 1).trim();
      if (org === G.old) {
        add([G.old, tag]);
        if (OLD_MAP[tag]) { const [names, o] = OLD_MAP[tag](); add(names, o); }
      } else if (org === YS) add([G.k, `o:${YS}`, tag.startsWith('הורה') ? 'הורה לתלמיד' : 'תלמיד'], T(c.kollel_former) ? 'f' : '');
      else unknown.set(`org_tag: ${e}`, (unknown.get(`org_tag: ${e}`) || 0) + 1);
    });
    // בלויז איינמאל; א קורצערער וועג וואס א לענגערער דעקט — ארויס
    const uniq = new Map();
    E.forEach((e) => { const k = e.p.join('>'); if (!uniq.has(k) || (e.o && !uniq.get(k).o)) uniq.set(k, e); });
    const keys = [...uniq.keys()];
    const final = [...uniq].filter(([k]) => !keys.some((o) => o !== k && o.startsWith(`${k}>`))).map(([, e]) => e);
    if (final.length) plan.push({ c, tags: final });
  }
  return { plan, unknown: [...unknown], skipped };
}

/** דער נאמען פון א כולל ווי ער שטייט יעצט אין דער רשימה (מיט אדער אן "(בארא פארק)") */
function kollelName(base) {
  const list = state.lists.kollel || [];
  return list.find((x) => x === base) || list.find((x) => x.startsWith(`${base} (`)) || base;
}

export async function runMigration(onProgress) {
  const { plan } = planMigration();
  const col = colLetter(state.headers.Contacts.indexOf('tags'));
  if (!col || state.headers.Contacts.indexOf('tags') < 0) throw new Error('no tags column');
  const data = plan.map(({ c, tags }) => ({ range: `Contacts!${col}${c._row}`, values: [[serialize(tags)]] }));
  for (let i = 0; i < data.length; i += 400) {
    await batchUpdate(data.slice(i, i + 400));
    onProgress?.(Math.min(i + 400, data.length), data.length);
  }
  await loadAll();
  return data.length;
}

function colLetter(i) {
  if (i < 0) return '';
  let s = ''; let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
