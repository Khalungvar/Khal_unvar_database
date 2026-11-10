// 🌐 דף קמפיין באתר (ungvar.org/campaign.html?c=...) — אשף פשוט ב-4 שלבים:
//   1 בסיס → 2 טקסט בעברית (+ תרגום אוטומטי ליידיש/אנגלית) → 3 חבילות, אחת-אחת → 4 תצוגה מקדימה והפעלה.
// ההגדרות נשמרות בלשונית WebCampaigns של המאגר הראשי; ברירות המחדל באות מהגדרות הקמפיין (campx.js).
// השומר קורא אותן (webCampaign) ומחשב את הנאסף מ-Donations לפי עמודת campaign.
import { otherSheet, currentToken } from './google.js';
import { CONFIG } from './config.js';
import { state } from './data.js';
import { loadSettings, settingsOf } from './campx.js';

const TAB = 'WebCampaigns';
const HEAD = ['slug', 'campaign', 'active', 'title_he', 'title_yi', 'title_en', 'sub_he', 'sub_yi', 'sub_en', 'desc_he', 'desc_yi', 'desc_en',
  'image', 'goal', 'end_date', 'amounts', 'packages', 'donors_mode', 'monthly', 'fee', 'org', 'updated_at', 'updated_by', 'match', 'event_date'];
const LAST = 'Y';
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const on = (v) => v === true || /^(true|1|yes)$/i.test(String(v ?? ''));
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const sheet = () => otherSheet(CONFIG.SPREADSHEET_ID);
const SITE = 'https://ungvar.org/campaign.html?c=';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function readAll() {
  let rows;
  try { rows = await sheet().read(`${TAB}!A1:${LAST}200`); } catch { await sheet().addTab(TAB); rows = []; }
  if (!rows.length || (rows[0] || []).length < HEAD.length) await sheet().write(`${TAB}!A1:${LAST}1`, [HEAD]);
  const hd = rows.length ? rows[0].map(String) : HEAD;
  return rows.slice(1).filter((r) => r[0]).map((r) => Object.fromEntries(hd.map((k, i) => [k, r[i] ?? ''])));
}
async function writeAll(list) {
  await sheet().clear(`${TAB}!A2:${LAST}200`);
  await sheet().write(`${TAB}!A1:${LAST}${list.length + 1}`, [HEAD, ...list.map((o) => HEAD.map((k) => (o[k] === undefined || o[k] === null ? '' : typeof o[k] === 'boolean' ? (o[k] ? 'TRUE' : 'FALSE') : String(o[k]))))]);
}
async function guard(body) {
  const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
const guardInfo = (slug) => guard({ action: 'webCampaign', c: slug, preview: '1' }).catch(() => ({}));
/** תרגום אוטומטי (Google, דרך השומר): texts = ['...'] → { yi: [...], en: [...] } */
async function translate(texts) {
  const r = await guard({ action: 'wcTranslate', token: currentToken(), texts, from: 'iw', to: ['yi', 'en'] });
  if (r.error) throw new Error(r.error);
  return r;
}
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** פותח את האשף (c = אובייקט קמפיין מ-campaigns.js: name, org, goal...) */
export async function openWebCampaign(c, toast = () => {}) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg wc-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = '<p class="muted">טוען…</p>';
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  let all = [];
  try { [all] = await Promise.all([readAll(), loadSettings().catch(() => null)]); } catch (err) { dlg.innerHTML = `<button type="button" class="x-close">✕</button><p>❌ ${h(err.message || err)}</p>`; $('.x-close', dlg).onclick = close; return; }
  const S = settingsOf(c);
  const found = all.find((x) => x.campaign === c.name);
  const cur = found ? { ...found } : {
    slug: slugify(S.name_en), campaign: c.name, active: false, title_he: S.name_he || c.name, title_yi: S.name_yi || '', title_en: S.name_en || '',
    sub_he: c.org || '', sub_yi: c.org || '', sub_en: '', desc_he: '', desc_yi: '', desc_en: '', image: '', goal: c.goal || '', end_date: S.end_date || '',
    amounts: '36,54,100,180,360,500,1000', packages: '[]', donors_mode: 'all', monthly: S.recurring, fee: S.fee, org: c.org || '', match: '', event_date: S.event_date || '',
  };
  // ההכפלה (Matching) תמיד לפי הגדרות הקמפיין
  cur.match = S.match?.on ? JSON.stringify({ mult: Number(S.match.mult) || 2, sponsor: S.match.sponsor || '', cap: Number(S.match.cap) || 0 }) : '';
  if (!cur.event_date && S.event_date) cur.event_date = S.event_date;
  let pk = []; try { pk = JSON.parse(cur.packages || '[]'); } catch { pk = []; }
  let step = found ? 4 : 1;
  const isNew = !found;
  let maxStep = step;
  const STEPS = ['בסיס', 'טקסט', 'חבילות', 'תצוגה והפעלה'];
  const ok = (s) => (s === 1 ? !!slugify(cur.slug) : s === 2 ? !!String(cur.title_he).trim() : true);
  const inp = (k, lab, type = 'text', ltr = false, extra = '') => `<label>${h(lab)}<input name="${k}" type="${type}" value="${h(type === 'date' ? String(cur[k] || '').slice(0, 10) : cur[k])}"${ltr ? ' dir="ltr"' : ''}${extra}></label>`;
  const area = (k, lab, ltr = false) => `<label>${h(lab)}<textarea name="${k}" rows="4"${ltr ? ' dir="ltr"' : ''}>${h(cur[k])}</textarea></label>`;

  const body = () => {
    if (step === 1) {
      return `<p class="muted">הכתובת באנגלית היא מה שיופיע בקישור: <b dir="ltr">ungvar.org/campaign.html?c=<span data-slugv>${h(cur.slug || '…')}</span></b></p>
        <div class="wc-grid">${inp('slug', 'כתובת הדף (אותיות אנגליות ומקפים)', 'text', true, ' placeholder="pas-shacharis"')}
        ${inp('goal', 'יעד ($) — לא חובה', 'number')}${inp('end_date', 'תאריך סיום — לא חובה', 'date')}
        ${inp('image', 'תמונה ראשית (קישור) — לא חובה', 'text', true)}</div>`;
    }
    if (step === 2) {
      const hasTr = cur.title_yi || cur.title_en || cur.desc_yi || cur.desc_en;
      return `<p class="muted">כותבים רק בעברית. אחר כך לוחצים "תרגום" — והמערכת ממלאת אידיש ואנגלית (אפשר לתקן).</p>
        <div class="wc-grid wc-one">${inp('title_he', 'כותרת')}${inp('sub_he', 'שורה קטנה מעל הכותרת (למשל שם המוסד)')}${area('desc_he', 'הסבר על הקמפיין')}</div>
        <p><button type="button" class="btn" data-tr>🌐 תרגום אוטומטי ליידיש ואנגלית</button> <span class="muted small" data-trmsg></span></p>
        <details${hasTr ? ' open' : ''}><summary>אידיש ואנגלית</summary><div class="wc-grid">
          ${inp('title_yi', 'כותרת — אידיש')}${inp('sub_yi', 'שורה קטנה — אידיש')}${area('desc_yi', 'הסבר — אידיש')}
          ${inp('title_en', 'Title — English', 'text', true)}${inp('sub_en', 'Subtitle — English', 'text', true)}${area('desc_en', 'Description — English', true)}</div></details>`;
    }
    if (step === 3) {
      return `<p class="muted">חבילות הן אפשרויות מוכנות (למשל "יום אחד — $180"). לא חובה. "מוגבל" = כמה פעמים אפשר לקחת (למשל חודש מסוים — פעם אחת).</p>
        <div class="wc-pkl">${pk.map((p, i) => `<div class="wc-pkc"><b>${h(p.name_he || p.name_en)}</b><span dir="ltr">$${Number(p.amount).toLocaleString()}</span>
          <small>${h(p.note_he || '')}${p.limit ? ` · מוגבל ל-${p.limit}` : ''}${p.name_en ? ` · <i dir="ltr">${h(p.name_en)}</i>` : ' · <i>ללא תרגום</i>'}</small>
          <span><button type="button" class="btn small-btn" data-pe="${i}">✎</button><button type="button" class="btn small-btn" data-pu="${i}"${i ? '' : ' disabled'}>↑</button><button type="button" class="btn ghost small-btn" data-pd="${i}">✕</button></span></div>`).join('') || '<p class="muted">עדיין אין חבילות.</p>'}</div>
        <fieldset class="wc-pkf"><legend data-pkleg>+ חבילה חדשה</legend><div class="wc-grid">
          <label>שם<input data-p="name_he" placeholder="יום אחד"></label><label>סכום ($)<input data-p="amount" type="number" min="1"></label>
          <label>הסבר קצר<input data-p="note_he" placeholder="עם הקדשה בבית המדרש"></label><label>מוגבל ל־ (0 = בלי הגבלה)<input data-p="limit" type="number" min="0" value="0"></label></div>
          <p><button type="button" class="btn primary" data-padd>הוספה</button> <span class="muted small">התרגום ליידיש ואנגלית נעשה אוטומטית.</span></p></fieldset>`;
    }
    const m = (() => { try { return JSON.parse(cur.match || 'null'); } catch { return null; } })();
    return `<div class="wc-sum">
        <p><b>${h(cur.title_he)}</b> · <span dir="ltr">${h(SITE + cur.slug)}</span></p>
        <p class="muted small">${pk.length} חבילות${cur.goal ? ` · יעד $${Number(cur.goal).toLocaleString()}` : ''}${cur.end_date ? ` · עד ${h(String(cur.end_date).slice(0, 10))}` : ''}${m ? ` · ✖${m.mult} הכפלה${m.sponsor ? ` (${h(m.sponsor)})` : ''}` : ''}</p>
        <p data-live class="muted small"></p></div>
      <details><summary>מתקדם (בדרך כלל לא צריך לשנות)</summary><div class="wc-grid">
        ${inp('amounts', 'סכומים מוכנים בטופס (בפסיקים)', 'text', true)}
        <label>תורמים אחרונים בדף<select name="donors_mode"><option value="all"${cur.donors_mode === 'all' ? ' selected' : ''}>שמות וסכומים</option><option value="names"${cur.donors_mode === 'names' ? ' selected' : ''}>רק שמות</option><option value="none"${cur.donors_mode === 'none' ? ' selected' : ''}>לא להציג</option></select></label>
        <label class="wc-chk"><input type="checkbox" name="monthly"${on(cur.monthly) ? ' checked' : ''}> לאפשר הוראת קבע חודשית</label>
        <label class="wc-chk"><input type="checkbox" name="fee"${on(cur.fee) ? ' checked' : ''}> להציע לכסות עמלה</label>
        ${inp('event_date', 'תאריך האירוע (לספירה לאחור במסך)', 'date')}</div></details>
      <p class="wc-pub"><label class="wc-chk big"><input type="checkbox" name="active"${on(cur.active) ? ' checked' : ''}> <b>הדף פעיל באתר</b> (כבוי = רק תצוגה מקדימה)</label></p>
      <div class="wc-prev"><iframe title="preview" data-if></iframe></div>`;
  };
  const read = () => {
    $$('form [name]', dlg).forEach((x) => { cur[x.name] = x.type === 'checkbox' ? x.checked : x.value.trim(); });
    cur.slug = slugify(cur.slug);
  };
  const save = async () => {
    read();
    if (!cur.slug) throw new Error('צריך כתובת באנגלית');
    if (all.some((x) => x.slug === cur.slug && x.campaign !== c.name)) throw new Error('הכתובת כבר בשימוש בקמפיין אחר');
    // מזהה קבוע לכל חבילה (נשמר גם כשמשנים שם — כדי שספירת "כבר נלקח" לא תתאפס)
    const ids = new Set(); pk.forEach((p, i) => { if (!p.id || ids.has(p.id)) { p.id = slugify(p.name_en) || `p${i + 1}`; while (ids.has(p.id)) p.id = `${p.id}-${i + 1}`; } ids.add(p.id); });
    Object.assign(cur, { campaign: c.name, packages: JSON.stringify(pk), org: c.org || cur.org || '', updated_at: stamp(), updated_by: state.email || '' });
    const fresh = await readAll();
    const rest = fresh.filter((x) => x.campaign !== c.name && x.slug !== cur.slug);
    await writeAll([...rest, cur]);
    all = [...rest, cur];
  };
  let editIdx = -1;
  const draw = () => {
    maxStep = Math.max(maxStep, step);
    dlg.innerHTML = `<button type="button" class="x-close">✕</button>
      <h3>🌐 דף באתר — ${h(c.name)}</h3>
      <ol class="wc-steps">${STEPS.map((s, i) => `<li class="${step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}"><button type="button" data-go="${i + 1}"${isNew && i + 1 > maxStep ? ' disabled' : ''}>${i + 1}. ${h(s)}</button></li>`).join('')}</ol>
      <form class="wc-form" onsubmit="return false">${body()}</form>
      <p id="wc-msg" class="muted"></p>
      <p class="wc-acts">${step > 1 ? '<button type="button" class="btn" data-back>→ הקודם</button>' : ''}<span class="spacer"></span>
        ${step < 4 ? '<button type="button" class="btn primary" data-next>הבא ←</button>' : `<button type="button" class="btn primary" data-save>💾 שמירה</button><a class="btn" target="_blank" rel="noopener" href="${h(SITE + cur.slug)}&preview=1">פתיחה בחלון ↗</a><a class="btn" target="_blank" rel="noopener" href="${h(SITE + cur.slug)}&screen=1&preview=1">📺 מסך ציבורי ↗</a><button type="button" class="btn" data-copy>העתקת קישור</button>`}
        <button type="button" class="btn ghost" data-close>סגירה</button></p>`;
    wire();
  };
  const msg = (t) => { const m = $('#wc-msg', dlg); if (m) m.innerHTML = t; };
  const wire = () => {
    $('.x-close', dlg).onclick = close; $('[data-close]', dlg).onclick = close;
    $$('[data-go]', dlg).forEach((b) => { b.onclick = async () => { read(); const to = Number(b.dataset.go); if (to === 4 && step !== 4) { try { msg('שומר טיוטה…'); await save(); } catch (err) { msg(`❌ ${h(err.message || err)}`); return; } } step = to; draw(); }; });
    $('[data-back]', dlg)?.addEventListener('click', () => { read(); step -= 1; draw(); });
    $('[data-next]', dlg)?.addEventListener('click', async () => {
      read();
      if (!ok(step)) { msg(step === 1 ? '❌ צריך כתובת באנגלית' : '❌ צריך כותרת'); return; }
      if (step === 1 && all.some((x) => x.slug === cur.slug && x.campaign !== c.name)) { msg('❌ הכתובת כבר בשימוש בקמפיין אחר'); return; }
      if (step === 3) { try { msg('שומר טיוטה…'); await save(); } catch (err) { msg(`❌ ${h(err.message || err)}`); return; } }
      step += 1; draw();
    });
    const sl = $('[name=slug]', dlg); if (sl) sl.oninput = () => { $('[data-slugv]', dlg).textContent = slugify(sl.value) || '…'; };
    $('[data-tr]', dlg)?.addEventListener('click', async (e) => {
      read(); const b = e.currentTarget; const tm = $('[data-trmsg]', dlg);
      const src = [cur.title_he, cur.sub_he, cur.desc_he];
      if (!src.some(Boolean)) { tm.textContent = 'קודם לכתוב בעברית'; return; }
      b.disabled = true; tm.textContent = 'מתרגם…';
      try {
        const r = await translate(src);
        ['title', 'sub', 'desc'].forEach((k, i) => { if (src[i]) { cur[`${k}_yi`] = r.yi[i] || cur[`${k}_yi`]; cur[`${k}_en`] = r.en[i] || cur[`${k}_en`]; } });
        draw(); $('details', dlg).open = true; $('[data-trmsg]', dlg).textContent = '✅ תורגם — כדאי לעבור ולתקן';
      } catch (err) { tm.textContent = `❌ ${err.message || err}`; b.disabled = false; }
    });
    // חבילות
    const pf = (k) => $(`[data-p="${k}"]`, dlg);
    $('[data-padd]', dlg)?.addEventListener('click', async (e) => {
      const p = { name_he: pf('name_he').value.trim(), amount: Number(pf('amount').value) || 0, note_he: pf('note_he').value.trim(), limit: Number(pf('limit').value) || 0 };
      if (!p.name_he || !p.amount) { msg('❌ צריך שם וסכום'); return; }
      const b = e.currentTarget; b.disabled = true; msg('מתרגם…');
      const prev = editIdx >= 0 ? pk[editIdx] : {};
      try {
        const r = await translate([p.name_he, p.note_he || '']);
        Object.assign(p, { name_yi: r.yi[0] || '', name_en: r.en[0] || '', note_yi: p.note_he ? r.yi[1] || '' : '', note_en: p.note_he ? r.en[1] || '' : '' });
      } catch { Object.assign(p, { name_yi: prev.name_yi || '', name_en: prev.name_en || '', note_yi: prev.note_yi || '', note_en: prev.note_en || '' }); }
      if (editIdx >= 0) pk[editIdx] = { ...prev, ...p }; else pk.push(p);
      editIdx = -1; draw(); msg('✅ נשמר ברשימה');
    });
    $('.wc-pkl', dlg)?.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pd !== undefined) { pk.splice(Number(b.dataset.pd), 1); draw(); }
      if (b.dataset.pu !== undefined) { const i = Number(b.dataset.pu); [pk[i - 1], pk[i]] = [pk[i], pk[i - 1]]; draw(); }
      if (b.dataset.pe !== undefined) {
        editIdx = Number(b.dataset.pe); const p = pk[editIdx];
        pf('name_he').value = p.name_he || ''; pf('amount').value = p.amount || ''; pf('note_he').value = p.note_he || ''; pf('limit').value = p.limit || 0;
        $('[data-pkleg]', dlg).textContent = `עריכת "${p.name_he}"`; $('[data-padd]', dlg).textContent = 'עדכון'; pf('name_he').focus();
      }
    });
    // שלב 4
    const ifr = $('[data-if]', dlg);
    if (ifr) {
      ifr.src = `${SITE}${cur.slug}&preview=1&t=${Date.now()}`;
      guardInfo(cur.slug).then((j) => {
        const live = $('[data-live]', dlg); if (!live) return;
        live.innerHTML = j.campaign ? `נאספו <b>$${Number(j.raised || 0).toLocaleString()}</b> · ${j.donors} תורמים · סליקה: ${j.pay && j.ifields ? '✅ מוכנה' : '⏳ ממתינה למפתחות Sola בשומר'} · <span class="muted">(שינויים מופיעים באתר תוך דקה)</span>` : '<span class="muted">התצוגה מתעדכנת תוך דקה מהשמירה.</span>';
      });
    }
    $('[data-save]', dlg)?.addEventListener('click', async () => {
      msg('שומר…');
      try { await save(); msg(`✅ נשמר. ${on(cur.active) ? `הדף פעיל: <a href="${h(SITE + cur.slug)}" target="_blank" rel="noopener" dir="ltr">${h(SITE + cur.slug)}</a>` : 'הדף כבוי באתר (תצוגה מקדימה בלבד).'}`); toast('✅ דף הקמפיין נשמר'); setTimeout(() => { if (ifr?.isConnected) ifr.src = `${SITE}${cur.slug}&preview=1&t=${Date.now()}`; }, 61000); } catch (err) { msg(`❌ ${h(err.message || err)}`); }
    });
    $('[data-copy]', dlg)?.addEventListener('click', () => { navigator.clipboard?.writeText(SITE + cur.slug); toast('הקישור הועתק'); });
  };
  draw();
}
