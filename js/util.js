// פונקציות עזר טהורות (בלי ממשק), כדי שאפשר יהיה לבדוק אותן לבד.

const GEMATRIA = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200,
  'ש': 300, 'ת': 400,
};

/** מסיר ניקוד, גרשיים וסימנים, ומאחד רווחים. */
export function normalize(text) {
  return String(text ?? '')
    .replace(/[֑-ׇ]/g, '')       // ניקוד וטעמים
    .replace(/["'״׳`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** ערך הגימטריה של האות הראשונה (העברית) במילה, או null. */
export function firstLetterValue(word) {
  for (const ch of normalize(word)) {
    if (GEMATRIA[ch]) return GEMATRIA[ch];
  }
  return null;
}

/** כל הקודים של איש קשר: [משפחה, פרטי] לכל אחד מהשמות הפרטיים. */
export function gematriaCodes(firstNameHe, lastNameHe) {
  const last = firstLetterValue(lastNameHe);
  if (!last) return [];
  return normalize(firstNameHe).split(' ')
    .map(firstLetterValue)
    .filter(Boolean)
    .map((first) => [last, first]);
}

/** הקוד הראשי לתצוגה, למשל "100 10". */
export function primaryCode(firstNameHe, lastNameHe) {
  const codes = gematriaCodes(firstNameHe, lastNameHe);
  return codes.length ? `${codes[0][0]} ${codes[0][1]}` : '';
}

/**
 * מפענח חיפוש לפי קוד: "100 10" או "ק י". מחזיר [משפחה, פרטי] או null.
 */
export function parseCodeQuery(query) {
  const q = normalize(query);
  let m = q.match(/^(\d{1,3})\s+(\d{1,3})$/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = q.match(/^([א-ת])\s+([א-ת])$/);
  if (m) return [GEMATRIA[m[1]], GEMATRIA[m[2]]];
  return null;
}

/** ספרות בלבד. */
export function digits(text) {
  return String(text ?? '').replace(/\D/g, '');
}

/** מעצב מספר אמריקאי ל-(845) 555-1234; כל דבר אחר נשאר כמו שהוקלד. */
export function formatPhone(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  let d = digits(raw);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length === 10 && !raw.startsWith('+') && !raw.startsWith('00')) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

/** האם ערך מסמן "כן" (לחצנים בגליון). */
export function isTrue(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1;
}

/** האם איש קשר בחיים (ריק = בחיים). */
export function isAlive(v) {
  return !(v === false || v === 'FALSE' || v === 'false');
}

export function splitTags(v) {
  return String(v ?? '').split(',').map((t) => t.trim()).filter(Boolean);
}

export function joinTags(list) {
  return [...new Set(list.map((t) => t.trim()).filter(Boolean))].join(', ');
}

const RABBI_TITLES = ['Rabbi', 'Grand Rabbi'];

/**
 * הפנייה בדואר באנגלית, לפי כללי הפנייה שבאפיון.
 * מחזיר null כשאין למי לשלוח (שניהם נפטרו).
 */
export function mailingName(c) {
  if (c?._mailing) return c._mailing; // עטליכע נעמען אויף איין קאנווערט
  const title = (c.title_en || 'Mr.').trim();
  const wifeTitle = isTrue(c.wife_is_rebbetzin) ? 'Rebbetzin' : 'Mrs.';
  const first = (c.first_name_en || '').trim();
  const last = (c.last_name_en || '').trim();
  const husbandAlive = isAlive(c.is_alive);
  const wifeAlive = isAlive(c.wife_is_alive);
  const married = c.marital_status === 'נשוי';
  const join = (...parts) => parts.filter(Boolean).join(' ');
  if (!first && !last) return null; // אין שם באנגלית — אי אפשר לפנות בדואר

  if (married && husbandAlive && wifeAlive) return join(`${title} & ${wifeTitle}`, first, last);
  if (married && !husbandAlive && wifeAlive) return join(wifeTitle, (c.wife_name_en || '').trim(), last);
  if (husbandAlive) return join(title, first, last);
  return null;
}

export { RABBI_TITLES };

/** תאריך ושעה לרישום בגליון. */
export function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

const EUROPE = new Set(['GB', 'UK', 'BE', 'FR', 'DE', 'AT', 'CH', 'NL', 'HU', 'RO', 'SK', 'CZ', 'UA', 'PL',
  'IT', 'ES', 'DK', 'SE', 'NO', 'IE', 'LU', 'LT', 'LV', 'EE', 'PT', 'GR', 'BG', 'HR', 'SI', 'RS']);
const COUNTRY_CODES = { israel: 'IL', 'united kingdom': 'GB', england: 'GB', belgium: 'BE', france: 'FR',
  germany: 'DE', austria: 'AT', switzerland: 'CH', netherlands: 'NL', hungary: 'HU', romania: 'RO',
  slovakia: 'SK', ukraine: 'UA', usa: 'US', 'united states': 'US', canada: 'CA', uk: 'GB' };

/**
 * מזהה את הגעגנט (שכונה/עיר) לפי הכתובת. areas = [{ name, zips[], keywords[] }] מלשונית Lists.
 * סדר: מדינה (ארץ ישראל / אירופה) → ZIP → שם שכונה/עיר. מחזיר '' אם לא זוהה.
 */
export function detectArea(areas, { zip = '', city = '', neighborhood = '', country = '' } = {}) {
  const cc = (COUNTRY_CODES[String(country).trim().toLowerCase()] || String(country).trim().toUpperCase()).slice(0, 2);
  const cityText = `${neighborhood} ${city}`.toLowerCase();
  const cityKeys = (a) => a.keywords.filter((k) => k && !k.toLowerCase().startsWith('country:'));
  if (cc && cc !== 'US') {
    // אין דעם זעלבן לאנד: קודם לויט דער שטאט (טאראנטא / מאנטריאל), דערנאך דער גאנצער לאנד (קאנאדע)
    const inCountry = areas.filter((a) => a.keywords.some((k) => k.toLowerCase() === `country:${cc.toLowerCase()}`));
    const byCity = inCountry.find((a) => cityKeys(a).some((k) => cityText.includes(k.toLowerCase())));
    const byCountry = byCity || inCountry.find((a) => !cityKeys(a).length) || inCountry[0]
      || (EUROPE.has(cc) ? areas.find((a) => a.keywords.some((k) => k.toLowerCase() === 'country:eu')) : null);
    return byCountry ? byCountry.name : '';
  }
  const z = String(zip).trim().slice(0, 5);
  const byZip = z && areas.find((a) => a.zips.includes(z));
  if (byZip) return byZip.name;
  const text = `${neighborhood} ${city}`.toLowerCase();
  const byName = areas.find((a) => a.keywords.some((k) => !k.startsWith('country:') && k && text.includes(k.toLowerCase())));
  return byName ? byName.name : '';
}

/**
 * בילד → קליינע data URL וואס פאסט אריין אין א צעל אין גוגל שיטס (ביז ~45,000 אותיות).
 * פרובירט קודם PNG (האלט די דורכזיכטיגקייט פון א לאגא), דערנאך JPEG.
 */
export function shrinkImage(file, maxPx, limit = 45000, jpegFirst = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const draw = (px, bg) => {
        const scale = Math.min(1, px / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * scale));
        cv.height = Math.max(1, Math.round(img.height * scale));
        const ctx = cv.getContext('2d');
        if (bg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        return cv;
      };
      // פאר גרויסע בילדער (באנערס) — JPEG קודם, כדי עס זאל בלייבן שארף
      if (jpegFirst) {
        for (let px = maxPx; px >= 300; px = Math.round(px * 0.85)) {
          const cv0 = draw(px, true);
          for (let q = 0.9; q > 0.5; q -= 0.1) {
            const url = cv0.toDataURL('image/jpeg', q);
            if (url.length <= limit) { resolve(url); return; }
          }
        }
      }
      for (let px = maxPx; px >= 120; px = Math.round(px * 0.8)) {
        const url = draw(px).toDataURL('image/png');
        if (url.length <= limit) { resolve(url); return; }
      }
      const cv = draw(maxPx, true);
      for (let q = 0.85; q > 0.3; q -= 0.1) {
        const url = cv.toDataURL('image/jpeg', q);
        if (url.length <= limit) { resolve(url); return; }
      }
      reject(new Error('too-big'));
    };
    img.onerror = () => reject(new Error('bad-image'));
    img.src = URL.createObjectURL(file);
  });
}
