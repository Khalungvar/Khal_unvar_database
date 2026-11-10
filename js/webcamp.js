// 🌐 דף קמפיין באתר (ungvar.org/campaign.html?c=...) — הגדרות בלשונית WebCampaigns של המאגר הראשי.
// השומר קורא אותן (webCampaign) ומחשב את הנאסף מ-Donations לפי עמודת campaign.
import { otherSheet } from './google.js';
import { CONFIG } from './config.js';
import { state } from './data.js';

const TAB = 'WebCampaigns';
const HEAD = ['slug', 'campaign', 'active', 'title_he', 'title_yi', 'title_en', 'sub_he', 'sub_yi', 'sub_en', 'desc_he', 'desc_yi', 'desc_en',
  'image', 'goal', 'end_date', 'amounts', 'packages', 'donors_mode', 'monthly', 'fee', 'org', 'updated_at', 'updated_by'];
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const on = (v) => v === true || /^(true|1|yes)$/i.test(String(v ?? ''));
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const sheet = () => otherSheet(CONFIG.SPREADSHEET_ID);
const SITE = 'https://ungvar.org/campaign.html?c=';

async function readAll() {
  let rows;
  try { rows = await sheet().read(`${TAB}!A1:W200`); } catch { await sheet().addTab(TAB); await sheet().write(`${TAB}!A1:W1`, [HEAD]); rows = [HEAD]; }
  const hd = (rows[0] || HEAD).map(String);
  return rows.slice(1).filter((r) => r[0]).map((r) => Object.fromEntries(hd.map((k, i) => [k, r[i] ?? ''])));
}
async function writeAll(list) {
  await sheet().clear(`${TAB}!A2:W200`);
  await sheet().write(`${TAB}!A1:W${list.length + 1}`, [HEAD, ...list.map((o) => HEAD.map((k) => (o[k] === undefined || o[k] === null ? '' : typeof o[k] === 'boolean' ? (o[k] ? 'TRUE' : 'FALSE') : String(o[k]))))]);
}
async function guardInfo(slug) {
  try {
    const r = await fetch(CONFIG.MOSAD_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'webCampaign', c: slug, preview: '1' }) });
    return await r.json();
  } catch { return {}; }
}
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** פותח את הגדרות דף האתר של קמפיין (c = אובייקט קמפיין מ-campaigns.js: name, org, goal...) */
export async function openWebCampaign(c, toast = () => {}) {
  const dlg = document.createElement('dialog'); dlg.className = 'sheet lx-dlg wc-dlg'; dlg.dir = 'rtl';
  dlg.innerHTML = '<p class="muted">טוען…</p>';
  document.body.append(dlg); dlg.showModal();
  const close = () => { dlg.close(); dlg.remove(); };
  let all = [];
  try { all = await readAll(); } catch (err) { dlg.innerHTML = `<button type="button" class="x-close">✕</button><p>❌ ${h(err.message || err)}</p>`; dlg.querySelector('.x-close').onclick = close; return; }
  const cur = all.find((x) => x.campaign === c.name) || {
    slug: '', campaign: c.name, active: false, title_he: c.name, title_yi: c.name, title_en: '', sub_he: c.org || '', sub_yi: c.org || '', sub_en: '',
    desc_he: '', desc_yi: '', desc_en: '', image: '', goal: c.goal || '', end_date: '', amounts: '36,54,100,180,360,500,1000', packages: '[]',
    donors_mode: 'all', monthly: true, fee: true, org: c.org || '',
  };
  let pk = []; try { pk = JSON.parse(cur.packages || '[]'); } catch { pk = []; }
  const isNew = !cur.slug;
  const pkRow = (p = {}) => `<tr><td><input data-k="name_he" value="${h(p.name_he)}" placeholder="יום אחד"></td><td><input data-k="name_yi" value="${h(p.name_yi)}"></td><td><input data-k="name_en" value="${h(p.name_en)}" dir="ltr" placeholder="One day"></td>
    <td><input data-k="amount" type="number" min="1" value="${h(p.amount)}" style="width:90px"></td><td><input data-k="note_he" value="${h(p.note_he)}"></td><td><input data-k="note_en" value="${h(p.note_en)}" dir="ltr"></td>
    <td><input data-k="limit" type="number" min="0" value="${h(p.limit)}" style="width:60px" title="0 = בלי הגבלה"></td><td><button type="button" class="btn ghost" data-del>✕</button></td></tr>`;
  const tx = (k, lab, ltr = false, area = false) => `<label>${h(lab)}${area ? `<textarea name="${k}" rows="3"${ltr ? ' dir="ltr"' : ''}>${h(cur[k])}</textarea>` : `<input name="${k}" value="${h(cur[k])}"${ltr ? ' dir="ltr"' : ''}>`}</label>`;
  dlg.innerHTML = `<button type="button" class="x-close">✕</button>
    <h3>🌐 דף באתר — ${h(c.name)}</h3>
    <p class="muted small">הדף מציג את הסכום שנאסף בקמפיין הזה (מכל הדרכים — אתר, גבאים, מזומן, צ'קים), את התורמים האחרונים, וטופס תרומה בכרטיס דרך Sola. כל תרומה מהאתר נרשמת כאן בקמפיין אוטומטית.</p>
    <form class="wc-form">
      <div class="wc-grid">
        <label>כתובת הדף (באנגלית, למשל pas-shacharis)<input name="slug" dir="ltr" value="${h(cur.slug)}" required pattern="[a-z0-9-]+"></label>
        <label class="wc-chk"><input type="checkbox" name="active"${on(cur.active) ? ' checked' : ''}> פעיל באתר</label>
        ${tx('title_he', 'כותרת — עברית')}${tx('title_yi', 'כותרת — אידיש')}${tx('title_en', 'Title — English', true)}
        ${tx('sub_he', 'שורה קטנה מעל הכותרת — עברית')}${tx('sub_yi', '— אידיש')}${tx('sub_en', '— English', true)}
        ${tx('desc_he', 'הסבר — עברית', false, true)}${tx('desc_yi', 'הסבר — אידיש', false, true)}${tx('desc_en', 'Description — English', true, true)}
        ${tx('image', 'תמונה (קישור, לא חובה)', true)}
        <label>יעד ($)<input name="goal" type="number" min="0" value="${h(cur.goal)}"></label>
        <label>תאריך סיום<input name="end_date" type="date" value="${h(String(cur.end_date || '').slice(0, 10))}"></label>
        ${tx('amounts', 'סכומים מוכנים (מופרדים בפסיק)', true)}
        <label>תורמים אחרונים בדף<select name="donors_mode"><option value="all"${cur.donors_mode === 'all' ? ' selected' : ''}>שמות וסכומים</option><option value="names"${cur.donors_mode === 'names' ? ' selected' : ''}>רק שמות</option><option value="none"${cur.donors_mode === 'none' ? ' selected' : ''}>לא להציג</option></select></label>
        <label class="wc-chk"><input type="checkbox" name="monthly"${on(cur.monthly) ? ' checked' : ''}> לאפשר הוראת קבע חודשית</label>
        <label class="wc-chk"><input type="checkbox" name="fee"${on(cur.fee) ? ' checked' : ''}> להציע לתורם לכסות עמלה (3%)</label>
      </div>
      <h4>חבילות הקדשה <small class="muted">(לא חובה · "הגבלה" = כמה פעמים אפשר לקחת; 0 = בלי הגבלה)</small></h4>
      <div class="wc-pk-wrap"><table class="ms-table wc-pk"><thead><tr><th>שם — עברית</th><th>אידיש</th><th>English</th><th>$</th><th>הערה</th><th>Note</th><th>הגבלה</th><th></th></tr></thead>
        <tbody>${(pk.length ? pk : []).map(pkRow).join('')}</tbody></table></div>
      <p><button type="button" class="btn" data-addpk>+ חבילה</button></p>
      <p id="wc-msg" class="muted"></p>
      <p class="wc-acts"><button type="submit" class="btn primary">שמירה</button>
        ${isNew ? '' : `<a class="btn" target="_blank" rel="noopener" href="${h(SITE + cur.slug)}${on(cur.active) ? '' : '&preview=1'}">${on(cur.active) ? 'פתיחת הדף ↗' : 'תצוגה מקדימה ↗'}</a><button type="button" class="btn" data-copy>העתקת קישור</button>`}
        <button type="button" class="btn ghost" data-close>סגירה</button></p>
    </form>`;
  dlg.querySelector('.x-close').onclick = close; dlg.querySelector('[data-close]').onclick = close;
  const form = dlg.querySelector('form'); const msg = dlg.querySelector('#wc-msg'); const tb = dlg.querySelector('.wc-pk tbody');
  if (isNew && !form.slug.value) form.slug.value = slugify(form.title_en.value);
  form.title_en.addEventListener('input', () => { if (isNew) form.slug.value = slugify(form.title_en.value); });
  dlg.querySelector('[data-addpk]').onclick = () => tb.insertAdjacentHTML('beforeend', pkRow());
  tb.addEventListener('click', (e) => { if (e.target.closest('[data-del]')) e.target.closest('tr').remove(); });
  dlg.querySelector('[data-copy]')?.addEventListener('click', () => { navigator.clipboard?.writeText(SITE + cur.slug); toast('הקישור הועתק'); });
  if (!isNew) {
    guardInfo(cur.slug).then((j) => {
      if (!dlg.isConnected) return;
      msg.innerHTML = j.campaign ? `באתר עכשיו: נאספו <b>$${Number(j.raised || 0).toLocaleString()}</b> · ${j.donors} תורמים · סליקה: ${j.pay && j.ifields ? '✅ מוכנה' : '⏳ ממתינה למפתחות Sola בשומר'}` : (j.error === 'not-found' ? 'הדף לא פעיל באתר כרגע.' : '');
    });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const slug = slugify(form.slug.value);
    if (!slug) { msg.textContent = '❌ צריך כתובת באנגלית'; return; }
    if (all.some((x) => x.slug === slug && x.campaign !== c.name)) { msg.textContent = '❌ הכתובת כבר בשימוש בקמפיין אחר'; return; }
    const packages = [...tb.querySelectorAll('tr')].map((tr, i) => {
      const o = { id: '' }; tr.querySelectorAll('[data-k]').forEach((x) => { o[x.dataset.k] = x.type === 'number' ? Number(x.value) || 0 : x.value.trim(); });
      o.id = slugify(o.name_en || o.name_he) || `p${i + 1}`; return o;
    }).filter((o) => (o.name_he || o.name_en || o.name_yi) && o.amount > 0);
    const ids = new Set(); packages.forEach((p, i) => { while (ids.has(p.id)) p.id = `${p.id}-${i + 1}`; ids.add(p.id); });
    const o = { ...cur };
    ['title_he', 'title_yi', 'title_en', 'sub_he', 'sub_yi', 'sub_en', 'desc_he', 'desc_yi', 'desc_en', 'image', 'goal', 'end_date', 'amounts', 'donors_mode'].forEach((k) => { o[k] = form[k].value.trim(); });
    Object.assign(o, { slug, campaign: c.name, active: form.active.checked, monthly: form.monthly.checked, fee: form.fee.checked, packages: JSON.stringify(packages), org: c.org || cur.org || '', updated_at: stamp(), updated_by: state.email || '' });
    msg.textContent = 'שומר…';
    try {
      const fresh = await readAll();
      const rest = fresh.filter((x) => x.campaign !== c.name && x.slug !== slug);
      await writeAll([...rest, o]);
      all = [...rest, o];
      msg.innerHTML = `✅ נשמר. ${o.active ? `הדף: <a href="${h(SITE + slug)}" target="_blank" rel="noopener" dir="ltr">${h(SITE + slug)}</a> (מתעדכן תוך דקה)` : `הדף כבוי באתר. <a href="${h(SITE + slug)}&preview=1" target="_blank" rel="noopener">תצוגה מקדימה ↗</a>`}`;
      toast('✅ דף הקמפיין נשמר');
    } catch (err) { msg.textContent = `❌ ${err.message || err}`; }
  };
}
