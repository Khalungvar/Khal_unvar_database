// "הקשר" (סקאופ): כשנכנסים לביהמ"ד / כולל / ארגון מתפריט הצד, כל האתר מציג רק מה ששייך אליו —
// קאנטאקטן, נדבות, קאמפיין'ס, יארצייטן — עד שיוצאים ל"הויפט בלאט" (הכללי).
import { state } from './data.js';
import { isTrue, splitTags } from './util.js';

export const ORG_TYPES = ['beis_medrash', 'kollel', 'organization'];
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
    if (s && ORG_TYPES.includes(s.type)) state.scope = s;
  } catch { /* מתעלמים */ }
}

export function withFormer() {
  return Boolean(state.scopeFormer);
}

export function setWithFormer(v) {
  state.scopeFormer = Boolean(v);
}

/** כל שמות הארגונים שבהקשר הנוכחי (אחד, או כל הסוג). */
export function scopeOrgs() {
  const s = getScope();
  if (!s) return null;
  if (s.value) return [s.value];
  return [...new Set([...(state.lists[s.type] || []), ...state.contacts.flatMap((c) => splitTags(c[s.type]))])];
}

/** האם איש הקשר שייך להקשר (יוצאים — רק אם ביקשו "מיט יוצאים"). */
export function contactInScope(c, former = withFormer()) {
  const s = getScope();
  if (!s) return true;
  const mine = splitTags(c[s.type]);
  const hit = s.value ? mine.includes(s.value) : mine.length > 0;
  if (!hit) return false;
  return former || !isTrue(c[`${s.type}_former`]);
}

export function isFormerInScope(c) {
  const s = getScope();
  return Boolean(s) && isTrue(c[`${s.type}_former`]);
}

export function campaignOrg(name) {
  return name ? String(state.campaigns.find((c) => c.campaign === name)?.org || '') : '';
}

/** הארגון של הנדבה: של הקאמפיין (אם מוגדר), אחרת מה שנבחר בנדבה. */
export function effectiveOrg(d) {
  return campaignOrg(d.campaign) || String(d.org || '');
}

export function donationInScope(d) {
  const orgs = scopeOrgs();
  return !orgs || orgs.includes(effectiveOrg(d));
}

/** ברירת מחדל לארגון בנדבה / קאמפיין חדש: כשנמצאים בתוך ארגון אחד. */
export function defaultOrg() {
  return getScope()?.value || '';
}
