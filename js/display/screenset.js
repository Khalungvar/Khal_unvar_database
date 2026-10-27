// הגדרות פונעם מסך אין בית המדרש — געמיינזאם פאר דער תצוגה (display.js) און דער ניהול ("תצוגת והגדרות המסך").
// געהאלטן אינעם גיליון פון דער תצוגה, לשונית Screen (JSON אין שטיקלעך, ווי Minyanim); יעדע שמירה → א נייע גירסא אין ScreenHistory.

export function screenDefaults() {
  return {
    version: 0,
    // מודעות: library = אלע וואס מ'האט ארויפגעלייגט; ads = וואס ווייזט זיך (מיט טעג)
    library: [], // { id, name, kind: 'image'|'video', driveId, url }
    ads: [], // { id, lib, on, from, to, days: [0..6], sec, fit: 'contain'|'cover' }
    adSec: 15, // ווען עס זענען כמה מודעות — וויפיל סעקונדעס יעדע
    safe: 36, // שוליים פאר א מסך מיט א ראם (פיקסל)
    mzShow: true, mzSec: 15, // שהשמחה במעונם: ווייזן / סעקונדעס פאר יעדן בלאט
    revertMin: 0, // מוצאי שבת/יו"ט: וויפיל מינוט נאך מעריב קומט צוריק דער לוח פון וואכנטאג
    countdown: true, // צייגער ביי "המנין הבא"
    shiurSpeed: 18, // שיעורי תורה: גיכקייט פונעם ארויפפארן (פיקסל פער סעקונדע)
    // טעקסטן וואס האבן נישט קיין אנדער מקור
    texts: {
      title: 'קהל אונגוואר', sub: 'בנשיאות כ"ק מרן אדמו"ר שליט"א', kolText: 'קול אונגוואר', kolPhone: '605-477-4427',
      tWeek: 'זמני התפילות ימות החול', tHoly: 'זמני התפילות', tRebbe: 'מנחה מעריב מנין כ"ק אדמו"ר שליט"א', tNext: 'המנין הבא',
      tZmanim: 'זמני היום', tMitzva: 'מצוה יומית', tDaf: 'דף היומי', tShiurim: 'שיעורי תורה',
      tShDaf: 'שיעורי דף היומי בבית מדרשינו:', tShOth: 'שיעורים הנלמדים בביהמ"ד:',
    },
    logo: '', simchaHead: '', // בילדער (data URL); ליידיג = די געווענליכע
    // באהאלטן משבצות
    hide: { day: false, clock: false, logo: false, next: false, side: false, simchos: false, zmanim: false, mitzva: false, daf: false, shiurim: false, bottom: false },
    notice: { on: false, text: '', from: '', to: '' }, // א הודעה אויבן אויף לוח התפילות
  };
}

export function normScreen(s) {
  const d = screenDefaults();
  const o = { ...d, ...(s || {}) };
  o.notice = { ...d.notice, ...(o.notice || {}) };
  o.texts = { ...d.texts, ...(o.texts || {}) };
  o.hide = { ...d.hide, ...(o.hide || {}) };
  o.library = Array.isArray(o.library) ? o.library : [];
  o.ads = (Array.isArray(o.ads) ? o.ads : []).map((a) => ({ on: true, from: '', to: '', days: [], sec: 0, fit: 'contain', ...a }));
  return o;
}

/** דער URL פון א מודעה (דרייב: א בילד דורך lh3, א ווידעא דורך uc?export=download) */
export function adUrl(item) {
  if (!item) return '';
  if (item.url) return item.url;
  if (!item.driveId) return '';
  return item.kind === 'video' ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.driveId)}` : `https://lh3.googleusercontent.com/d/${encodeURIComponent(item.driveId)}=w1600`;
}

const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** די מודעות וואס ווייזן זיך אין דעם מאמענט (לויט די טעג און דאטעס) */
export function activeAds(S, now) {
  const iso = isoD(now); const dw = now.getDay();
  return (S.ads || []).filter((a) => a.on !== false && (!a.from || a.from <= iso) && (!a.to || a.to >= iso) && (!(a.days || []).length || a.days.includes(dw)))
    .map((a) => ({ ...a, item: (S.library || []).find((x) => x.id === a.lib) })).filter((a) => a.item && adUrl(a.item));
}
/** וועלכע מודעה איצט (ווען כמה — א קרייז) */
export function currentAd(S, now) {
  const list = activeAds(S, now);
  if (!list.length) return null;
  const secs = list.map((a) => Math.max(3, Number(a.sec) || Number(S.adSec) || 15));
  const total = secs.reduce((x, y) => x + y, 0);
  let t = Math.floor(now.getTime() / 1000) % total;
  for (let i = 0; i < list.length; i += 1) { if (t < secs[i]) return list[i]; t -= secs[i]; }
  return list[0];
}
/** הודעה: אויב אקטיוו היינט */
export function activeNotice(S, now) {
  const n = S.notice || {}; const iso = isoD(now);
  return n.on && String(n.text || '').trim() && (!n.from || n.from <= iso) && (!n.to || n.to >= iso) ? String(n.text).trim() : '';
}
