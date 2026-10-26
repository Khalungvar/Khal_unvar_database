// ▶ א טור אויפן מסך: ווייזט שריט נאך שריט וואו יעדער וויכטיגער קנעפל איז, מיט א קורצער ערקלערונג.
// א שריט וואס זיין קנעפל זעט מען נישט (למשל א גבאי וואס האט נישט די הרשאה) ווערט איבערגעשפרונגען.
// די זעלבע טעקסטן ווערן אויך א "title" (טיפ ביים אנרירן מיטן מויז) אויף די קנעפלעך.
import { getLang } from './i18n.js';
import { escapeHtml as h } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);

const S = (sel, he, yi, en) => ({ sel, he, yi, en });

const TOURS = {
  lobby: [
    S('#lobby-q', 'כאן מחפשים אדם: שם, טלפון, מייל או מספר ID.', 'דא זוכט מען א מענטש: נאמען, טעלעפאן, אימעיל אדער ID נומער.', 'Search for a person here: name, phone, email or ID number.'),
    S('[data-quick="contact"]', 'הוספת איש קשר חדש. תמיד חפש קודם שהוא לא קיים כבר.', 'צולייגן א נייעם קאנטאקט. זוכט אלעמאל קודם צי ער איז שוין דא.', 'Add a new contact. Always search first that he isn\'t already there.'),
    S('[data-quick="donation"]', 'הכנסת נדבה מהירה.', 'אריינלייגן א נדבה גיך.', 'Enter a donation quickly.'),
    S('[data-quick="occasion"]', 'הוספת יארצייט או מאורע.', 'צולייגן א יארצייט אדער א מאורע.', 'Add a yahrzeit or an occasion.'),
    S('[data-tile="umbrella"]', 'כל האנשים של כל המוסדות.', 'אלע מענטשן פון אלע מוסדות.', 'Everyone from all the institutions.'),
    S('[data-tile="donations"]', 'נדבות וקמפיינים: כמה נכנס, מי נתן, ומי עוד לא נתן השנה.', 'נדבות און קאמפיינען: וויפיל איז אריין, ווער האט געגעבן, און ווער נאך נישט היי-יאר.', 'Donations and campaigns: how much came in, who gave, and who hasn\'t yet this year.'),
    S('[data-tile="occasions"]', 'יארצייטים ושמחות בימים הקרובים.', 'יארצייטן און שמחות די קומענדיגע טעג.', 'Yahrzeits and simchas in the coming days.'),
    S('[data-tile="lists"]', 'רשימות מוכנות, ובניית רשימה חדשה לפי תגיות.', 'גרייטע רשימות, און מאכן א נייע רשימה לויט טעג\'ס.', 'Ready lists, and building a new list by tags.'),
    S('[data-tile="mailmerge"]', 'מעטפות, מדבקות ומכתבים לרשימה.', 'קאנווערטן, לעיבלס און בריוו פאר א רשימה.', 'Envelopes, labels and letters for a list.'),
    S('[data-tile="calls"]', 'שליחת SMS ושיחות מוקלטות.', 'שיקן SMS און אויפגענומענע רופן.', 'Send SMS and recorded calls.'),
    S('[data-tile="receipts"]', 'קבלות, Invoices וסיכום שנתי.', 'קבלות, Invoices און א יערליכער סיכום.', 'Receipts, invoices and yearly summaries.'),
    S('[data-tile="faces"]', 'סריקת תמונות ווידאו מאירוע, וזיהוי מי היה.', 'סקענען בילדער און ווידעאס פון אן אירוע, און דערקענען ווער ס\'איז געווען.', 'Scan an event\'s photos and videos, and identify who was there.'),
    S('#btn-personal', 'האיזור האישי שלך: הודעות, משימות ובקשות.', 'אייער איזור אישי: מעסעדזשעס, משימות און בקשות.', 'Your personal area: messages, tasks and requests.'),
    S('#hv-fab', 'בכל מסך — לחץ כאן להסבר על המסך הזה.', 'אין יעדן מסך — דריקט דא פאר א הסבר אויף דעם מסך.', 'On every screen — press here for help with that screen.'),
  ],
  contacts: [
    S('#search', 'חיפוש: חלק מהשם, טלפון, מייל או ID.', 'זוכן: א טייל פונעם נאמען, טעלעפאן, אימעיל אדער ID.', 'Search: part of the name, phone, email or ID.'),
    S('#tag-filter', 'צמצום לפי תגית.', 'פארקלענערן לויט א טעג.', 'Narrow by tag.'),
    S('#area-filter', 'צמצום לפי אזור.', 'פארקלענערן לויט א געגנט.', 'Narrow by area.'),
    S('#show-inactive', 'סמן כדי לראות גם מי שסומנו כלא פעילים.', 'צייכנט צו זען אויך די וואס זענען נישט אקטיוו.', 'Check to also see people marked inactive.'),
    S('#btn-xl-contacts', 'הורדת הרשימה שעל המסך ל-Excel.', 'אראפנעמען די רשימה אויפן מסך אין Excel.', 'Download the list on screen to Excel.'),
    S('#btn-new', 'איש קשר חדש — אחרי שחיפשת ולא מצאת.', 'א נייער קאנטאקט — נאכדעם וואס איר האט געזוכט און נישט געטראפן.', 'A new contact — after you searched and didn\'t find him.'),
    S('#list', 'לחץ על שורה כדי לפתוח את הכרטיס של האדם.', 'קליקט אויף א שורה צו עפענען דעם כרטיס.', 'Click a row to open the person\'s card.'),
  ],
  donations: [
    S('#btn-new-donation', 'נדבה חדשה.', 'א נייע נדבה.', 'A new donation.'),
    S('#btn-campaign', 'הרבה נדבות בבת אחת — למשל אחרי דינר.', 'אסאך נדבות אויף איינמאל — למשל נאך א דינער.', 'Many donations at once — e.g. after a dinner.'),
    S('#btn-new-campaign', 'פתיחת קמפיין חדש.', 'עפענען א נייע קאמפיין.', 'Open a new campaign.'),
    S('#btn-xl-don', 'הורדת הנדבות שעל המסך ל-Excel.', 'אראפנעמען די נדבות אויפן מסך אין Excel.', 'Download the donations on screen to Excel.'),
  ],
  occasions: [
    S('#btn-new-occasion', 'יארצייט או מאורע חדש.', 'א נייער יארצייט אדער מאורע.', 'A new yahrzeit or occasion.'),
    S('#btn-print-occ', 'הדפסת הרשימה שעל המסך.', 'דרוקן די רשימה אויפן מסך.', 'Print the list on screen.'),
    S('#btn-xl-occ', 'הורדה ל-Excel.', 'אראפנעמען אין Excel.', 'Download to Excel.'),
  ],
};

const NAV = {
  he: { next: 'הבא ›', prev: '‹ הקודם', done: 'סיום', of: 'מתוך' },
  yi: { next: 'ווייטער ›', prev: '‹ צוריק', done: 'פארטיג', of: 'פון' },
  en: { next: 'Next ›', prev: '‹ Back', done: 'Done', of: 'of' },
};

const visible = (el) => !!el && el.getClientRects().length > 0 && !el.closest('[hidden]');
const L = (lang) => (NAV[lang] ? lang : 'yi');

export const hasTour = (view) => !!TOURS[view];

/** טיפס ביים אנרירן מיטן מויז — נאר וואו ס'איז נאך נישטא קיין title */
export function applyTips(view) {
  const lang = L(getLang());
  (TOURS[view] || []).forEach((s) => {
    const el = $(s.sel);
    if (!el || el.id === 'hv-fab' || el.id === 'list') return;
    if (!el.title || el.dataset.tip) { el.title = s[lang]; el.dataset.tip = '1'; }
  });
}

let cur = null;

function end() {
  if (!cur) return;
  cur.box.remove(); cur.ring.remove();
  window.removeEventListener('resize', cur.place);
  document.removeEventListener('keydown', cur.key, true);
  cur = null;
}

export function startTour(view, lang = getLang()) {
  end();
  lang = L(lang);
  const steps = (TOURS[view] || []).filter((s) => visible($(s.sel)));
  if (!steps.length) return;
  const nav = NAV[lang];
  const ring = document.createElement('div'); ring.className = 'tour-ring';
  const box = document.createElement('div'); box.className = 'tour-box'; box.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.body.append(ring, box);
  let i = 0;
  const place = () => {
    const el = $(steps[i].sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    Object.assign(ring.style, { top: `${r.top - 6}px`, left: `${r.left - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    const bw = Math.min(320, window.innerWidth - 24);
    const below = r.bottom + 14 + box.offsetHeight < window.innerHeight;
    const top = below ? r.bottom + 14 : Math.max(12, r.top - 14 - box.offsetHeight);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - bw / 2), window.innerWidth - bw - 12);
    Object.assign(box.style, { top: `${top}px`, left: `${left}px`, width: `${bw}px` });
  };
  const show = () => {
    const s = steps[i];
    $(s.sel)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    box.innerHTML = `<p>${h(s[lang])}</p>
      <div class="tour-nav"><span class="muted small">${i + 1} ${nav.of} ${steps.length}</span><span class="spacer"></span>
        ${i ? `<button type="button" class="btn ghost small-btn" data-t="prev">${nav.prev}</button>` : ''}
        <button type="button" class="btn small-btn primary" data-t="${i < steps.length - 1 ? 'next' : 'done'}">${i < steps.length - 1 ? nav.next : nav.done}</button>
        <button type="button" class="tour-x" data-t="done" aria-label="✕">✕</button></div>`;
    box.querySelectorAll('[data-t]').forEach((b) => {
      b.onclick = () => { const a = b.dataset.t; if (a === 'done') end(); else { i += a === 'next' ? 1 : -1; show(); } };
    });
    place();
    setTimeout(place, 350);
  };
  const key = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const fwd = (e.key === 'ArrowLeft') === (box.dir === 'rtl');
      if (fwd && i < steps.length - 1) { i += 1; show(); } else if (!fwd && i) { i -= 1; show(); }
    }
  };
  cur = { box, ring, place, key };
  window.addEventListener('resize', place);
  document.addEventListener('keydown', key, true);
  show();
}
