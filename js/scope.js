// "הקשר" (סקאופ): כשנכנסים לביהמ"ד / כולל / ארגון מתפריט הצד, כל האתר מציג רק מה ששייך אליו —
// קאנטאקטן, נדבות, קאמפיין'ס, יארצייטן — עד שיוצאים ל"הויפט בלאט" (הכללי).
import { state, NESHEI_ORG } from './data.js';
import { isTrue, splitTags } from './util.js';

export const ORG_TYPES = ['beis_medrash', 'kollel', 'organization'];
const SCOPE_TYPES = [...ORG_TYPES, 'area']; // 'area' = געגנט (פון אלע רעקארדס)
const KEY = 'khal-scope';

/** scope = { type, value } — value ריק = כל הסוג (למשל כל בתי המדרש). null = כללי. */
export function getScope() {
  return state.scope || null;
}

export function setScope(scope) {
  state.scope = scope && scope.type ? { type: scope.type, value: scope.value || '' } : null;
  try {
    if (state.scope) localStorage.setItem(KEY, JSON.stringify(state.scope));
    else localStorage.removeItem(KEY);
  } catch { /* אחסון חסום — לא נורא */ }
}

export function restoreScope() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && SCOPE_TYPES.includes(s.type)) state.scope = s;
  } catch { /* מתעלמים */ }
}

export function withFormer() {
  return Boolean(state.scopeFormer);
}

export function setWithFormer(v) {
  state.scopeFormer = Boolean(v);
}

/**
 * צו וועלכע ארגונים פון א סארט געהערט א מענטש. "נשי אונגוואר" (אין 'organization')
 * ווערט באשטימט דורכן קנעפל "נעמט א חלק אין נשי אונגוואר" אין זיין כרטיס.
 */
export function memberOrgs(c, type) {
  const list = splitTags(c[type]).filter((v) => v !== NESHEI_ORG);
  if (type === 'organization' && isTrue(c.wife_in_neshei)) list.push(NESHEI_ORG);
  return list;
}

/** איז ער א "יוצא" פון דעם ארגון? (ביי נשי — קיינמאל) */
export function isFormerOf(c, type, value) {
  return value !== NESHEI_ORG && isTrue(c[`${type}_former`]);
}

/** כל שמות הארגונים שבהקשר הנוכחי (אחד, או כל הסוג). */
export function scopeOrgs() {
  const s = getScope();
  if (!s || s.type === 'area') return null;
  if (s.value) return [s.value];
  return [...new Set([...(state.lists[s.type] || []), ...state.contacts.flatMap((c) => splitTags(c[s.type]))])];
}

/** האם איש הקשר שייך להקשר (יוצאים — רק אם ביקשו "מיט יוצאים"). */
export function contactInScope(c, former = withFormer()) {
  const s = getScope();
  if (!s) return true;
  if (s.type === 'area') return c.area === s.value;
  const mine = memberOrgs(c, s.type);
  const hit = s.value ? mine.includes(s.value) : mine.length > 0;
  if (!hit) return false;
  if (s.value) return former || !isFormerOf(c, s.type, s.value);
  return former || !isTrue(c[`${s.type}_former`]) || mine.includes(NESHEI_ORG);
}

export function isFormerInScope(c) {
  const s = getScope();
  return Boolean(s) && s.type !== 'area' && isTrue(c[`${s.type}_former`]);
}

export function campaignOrg(name) {
  return name ? String(state.campaigns.find((c) => c.campaign === name)?.org || '') : '';
}

/** הארגון של הנדבה: של הקאמפיין (אם מוגדר), אחרת מה שנבחר בנדבה. */
export function effectiveOrg(d) {
  return campaignOrg(d.campaign) || String(d.org || '');
}

export function donationInScope(d) {
  const s = getScope();
  if (s?.type === 'area') {
    const c = d.contact_id ? state.contacts.find((x) => String(x.contact_id) === String(d.contact_id)) : null;
    return Boolean(c) && c.area === s.value;
  }
  const orgs = scopeOrgs();
  return !orgs || orgs.includes(effectiveOrg(d));
}

/** ברירת מחדל לארגון בנדבה / קאמפיין חדש: כשנמצאים בתוך ארגון אחד. */
export function defaultOrg() {
  const s = getScope();
  return s && s.type !== 'area' ? s.value || '' : '';
}

/** שם ארגון הגג (כלל מוסדות אונגוואר) — מלשונית Lists, עמודה umbrella_org. */
export function umbrellaName() {
  return (state.lists.umbrella_org || [])[0] || 'כלל מוסדות אונגוואר';
}
