// הגדרות פונעם מסך אין בית המדרש — געמיינזאם פאר דער תצוגה (display.js) און דער ניהול ("תצוגת והגדרות המסך").
// געהאלטן אינעם גיליון פון דער תצוגה, לשונית Screen (JSON אין שטיקלעך, ווי Minyanim); יעדע שמירה → א נייע גירסא אין ScreenHistory.

export function screenDefaults() {
  return {
    version: 0,
    // מודעות: library = אלע וואס מ'האט ארויפגעלייגט; ads = וואס ווייזט זיך (מיט טעג)
    // מאגר: { id, name, kind: 'image'|'video', driveId, url, at }
    library: [],
    // פריטים אויפן מסך: { id, on, type: 'media'|'text'|'system'|'notice', lib, sys: 'weekday'|'shabbos', text, size, color, bg, bold,
    //   place: 'right'|'main'|'next'|'side'|'simchos'|'zmanim'|'mitzva'|'daf'|'shiurim'|'full'|'free'|'notice', box: {x,y,w,h}, frame,
    //   from, to, days: [0..6], sec, fit: 'contain'|'cover', name }
    items: [],
    adSec: 15, // ווען עס זענען כמה אויף איין ארט — וויפיל סעקונדעס יעדער
    safe: 36, // שוליים פאר א מסך מיט א ראם (פיקסל)
    mzShow: true, mzSec: 15, // שהשמחה במעונם: ווייזן / סעקונדעס פאר יעדן בלאט
    revertMin: 30, // מוצאי שבת/יו"ט: וויפיל מינוט נאך מעריב קומט צוריק דער לוח פון וואכנטאג
    countdown: true, // צייגער ביי "המנין הבא"
    shiurSpeed: 18, // שיעורי תורה: גיכקייט פונעם ארויפפארן (פיקסל פער סעקונדע)
    // טעקסטן וואס האבן נישט קיין אנדער מקור
    texts: {
      title: 'קהל אונגוואר', sub2: 'נתייסד ע"י כ"ק מרן אדמו"ר זצוקללה"ה', sub: 'בנשיאות כ"ק מרן אדמו"ר שליט"א', kolText: 'קול אונגוואר', kolPhone: '605-477-4427',
      tWeek: 'זמני התפילה לימות החול', tHoly: 'זמני התפילות', tRebbe: 'מנחה מעריב מנין כ"ק אדמו"ר שליט"א', tNext: 'המנין הבא',
      tZmanim: 'זמני היום', tMitzva: 'מצוה יומית', tDaf: 'דף היומי', tShiurim: 'שיעורי תורה',
      tShDaf: 'שיעורי דף היומי בבית מדרשינו:', tShOth: 'שיעורים הנלמדים בביהמ"ד:',
    },
    logo: '', simchaHead: '', // בילדער (data URL); ליידיג = די געווענליכע
    // באהאלטן משבצות
    hide: { day: false, clock: false, logo: false, next: false, side: false, simchos: false, zmanim: false, mitzva: false, daf: false, shiurim: false, bottom: false },
    notice: { on: false, text: '', from: '', to: '' }, // א הודעה אויבן אויף לוח התפילות
    // שינוי אין די זמני ימות החול: before = וויפיל טעג פאראויס ווייזן "מיום ... במקום ..."; after = וויפיל טעג "חדש"; shift = אויך א שעה וואס רוקט זיך לויט דער שקיעה
    chg: { on: true, before: 7, after: 7, shift: false },
    // פארבן: theme = פארן גאנצן מסך (ליידיג = די געווענליכע); boxes = פאר א געוויסער משבצת { bg, text, title }
    theme: {}, boxes: {},
  };
}

export function normScreen(s) {
  const d = screenDefaults();
  const o = { ...d, ...(s || {}) };
  o.notice = { ...d.notice, ...(o.notice || {}) };
  o.texts = { ...d.texts, ...(o.texts || {}) };
  if (o.texts.tWeek === 'זמני התפילות ימות החול') o.texts.tWeek = d.texts.tWeek; // דער אלטער נוסח → דער נייער
  o.hide = { ...d.hide, ...(o.hide || {}) };
  o.chg = { ...d.chg, ...(o.chg || {}) };
  o.theme = { ...(o.theme || {}) }; o.boxes = { ...(o.boxes || {}) };
  o.library = Array.isArray(o.library) ? o.library : [];
  o.items = (Array.isArray(o.items) ? o.items : []).map((a) => ({ on: true, from: '', to: '', days: [], sec: 0, fit: 'contain', frame: a.place !== 'free', ...a }));
  return o;
}

/** דער URL פון א מודעה (דרייב: א בילד דורך lh3, א ווידעא דורך uc?export=download) */
export function adUrl(item) {
  if (!item) return '';
  if (item.url) return item.url;
  if (!item.driveId) return '';
  return item.kind === 'video' ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.driveId)}` : `https://lh3.googleusercontent.com/d/${encodeURIComponent(item.driveId)}${item.png || /\.png$/i.test(item.name || '') ? '=s0' : '=w1600'}`; // PNG: דער אריגינאל (מיט דער שקיפות)
}

const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const PLACES = [
  ['right', 'מודעה — העמודה הימנית (זמני היום עוברים לאמצע)'], ['main', 'במקום לוח זמני התפילות (שמאל)'], ['next', 'במקום "המנין הבא"'],
  ['side', 'במקום המשבצת האמצעית (שבת)'], ['simchos', 'במקום "שהשמחה במעונם"'], ['zmanim', 'במקום "זמני היום"'],
  ['mitzva', 'במקום "מצוה יומית"'], ['daf', 'במקום "דף היומי"'], ['shiurim', 'במקום "שיעורי תורה"'], ['full', 'כל המסך'], ['free', 'מיקום חופשי (גרירה)'],
];
export const SYSTEM = [['weekday', 'דף זמני ימות החול של השבוע (מתעדכן לבד)'], ['shabbos', 'דף זמני שבת של השבוע (מתעדכן לבד)']];
/** די פריטים וואס ווייזן זיך יעצט (לויט טעג און דאטעס) */
export function activeItems(S, now) {
  const iso = isoD(now); const dw = now.getDay();
  return (S.items || []).filter((a) => a.on !== false && (!a.from || a.from <= iso) && (a.forever || !a.to || a.to >= iso) && (!(a.days || []).length || a.days.includes(dw)))
    .map((a) => ({ ...a, item: a.type === 'media' ? (S.library || []).find((x) => x.id === a.lib) : null }))
    .filter((a) => (a.type === 'media' ? a.item && adUrl(a.item) : a.type === 'text' || a.type === 'notice' ? String(a.text || '').trim() : a.type === 'system'));
}
/** פאר יעדן ארט: דער וואס ווייזט זיך יעצט (ווען כמה — א קרייז). גיט { place: item } */
export function currentByPlace(S, now) {
  const by = {};
  for (const a of activeItems(S, now)) { const p = a.type === 'notice' ? 'notice' : a.place || 'right'; (by[p] = by[p] || []).push(a); }
  const out = {};
  for (const [p, list] of Object.entries(by)) {
    if (p === 'free') { out.free = list; continue; } // אלע פרייע — צוזאמען
    const secs = list.map((a) => Math.max(3, Number(a.sec) || Number(S.adSec) || 15));
    const total = secs.reduce((x, y) => x + y, 0);
    let t = Math.floor(now.getTime() / 1000) % total; let pick = list[0];
    for (let i = 0; i < list.length; i += 1) { if (t < secs[i]) { pick = list[i]; break; } t -= secs[i]; }
    out[p] = pick;
  }
  return out;
}
/** הודעה (פס אדום) */
export function activeNotice(S, now) { return currentByPlace(S, now).notice?.text?.trim() || ''; }

// ---------- פארבן ----------
export const THEME = [
  ['navy', 'כחול (רקע וכותרות)', '#0f2140'], ['navy2', 'כחול בהיר (רקע למעלה)', '#17305a'], ['gold', 'זהב (מסגרות)', '#c9a24c'],
  ['gold2', 'זהב בהיר (טקסט למעלה)', '#f3dc9a'], ['gold3', 'זהב כהה (קווים)', '#8a6a2a'], ['paper', 'רקע המשבצות', '#fbf5e6'], ['ink', 'צבע הטקסט', '#1d1a14'],
];
export const BOX_SEL = {
  top: ['למעלה (יום, לוגו, שעון)', '#dyn .top'], main: ['לוח זמני התפילות (שמאל)', '#dyn .pos-main'], next: ['המנין הבא', '#dyn .next'],
  side: ['המשבצת האמצעית (שבת)', '#dyn .pos-side'], simchos: ['שהשמחה במעונם', '#dyn .mzl'], zmanim: ['זמני היום', '#dyn .zm'],
  mitzva: ['מצוה יומית', '#dyn .lrn-m:not(.lrn-d)'], daf: ['דף היומי', '#dyn .lrn-d'], shiurim: ['שיעורי תורה', '#shl .lrn-s'], bottom: ['הפס התחתון', '#dynb .bottom'],
};
/** CSS פאר די פארבן */
export function themeCss(S) {
  const t = S.theme || {}; const out = [];
  const vars = THEME.filter(([k]) => t[k]).map(([k]) => `--${k}: ${t[k]};`).join(' ');
  if (vars) out.push(`#screen { ${vars} }`);
  for (const [k, c] of Object.entries(S.boxes || {})) {
    const sel = BOX_SEL[k]?.[1]; if (!sel || !c) continue;
    if (c.bg) out.push(`${sel} { --paper: ${c.bg}; background: ${c.bg} !important; }`);
    if (c.text) out.push(`${sel}, ${sel} *:not(.ttl):not(.sh-t):not(.sh-t *):not(.cd):not(.chg-note) { --ink: ${c.text}; color: ${c.text} !important; }`);
    if (c.title) out.push(`${sel} .ttl, ${sel} .sh-t { background: ${c.title} !important; }`);
  }
  return out.join('\n');
}
