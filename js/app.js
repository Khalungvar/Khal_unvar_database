// מסך אנשי הקשר: התחברות, חיפוש, כרטיס אישי, הוספה ועריכה.
import { initAuth, requestToken, signOut, getUserEmail } from './google.js';
import { state, loadAll, saveContact, addListValue } from './data.js';
import { suggest, details, placesEnabled, placesError } from './places.js';
import { t, setLang, getLang, applyStatic, maritalLabel } from './i18n.js';
import {
  normalize, digits, formatPhone, isTrue, isAlive, splitTags, joinTags,
  gematriaCodes, primaryCode, parseCodeQuery, mailingName, escapeHtml as h,
} from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PHONE_KEYS = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'];
const EMAIL_KEYS = ['email_1', 'email_2'];
// [שדה, תווית בשפת הממשק] — מחושב בכל פעם, כדי שהתווית תתאים לשפה הנוכחית
const phoneFields = () => PHONE_KEYS.map((k) => [k, t(k)]);
const emailFields = () => EMAIL_KEYS.map((k) => [k, t(k)]);

// ---------- הודעות ----------
let toastTimer;
function toast(message, kind = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 8000 : 3500);
}

function friendlyError(err) {
  if (err.status === 403 || err.status === 404) {
    return t('noAccess');
  }
  return t('error', { msg: err.message });
}

/** חלון בחירה עם כמה כפתורים. מחזיר את הערך שנבחר, או null. */
function choose(title, text, options) {
  const dlg = $('#choice-dialog');
  $('#choice-title', dlg).textContent = title;
  $('#choice-text', dlg).textContent = text;
  const box = $('#choice-buttons', dlg);
  box.innerHTML = '';
  return new Promise((resolve) => {
    options.forEach(([value, label, primary]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = primary ? 'btn primary' : 'btn';
      b.textContent = label;
      b.onclick = () => { dlg.close(); resolve(value); };
      box.append(b);
    });
    dlg.onclose = () => resolve(null);
    dlg.showModal();
  });
}

// ---------- התחברות ----------
async function signIn() {
  const btn = $('#btn-login');
  btn.disabled = true;
  try {
    await requestToken('select_account');
    state.email = await getUserEmail();
    await loadAll();
    $('#user-email').textContent = state.email + (state.isAdmin ? ` · ${t('admin')}` : '');
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    fillFilters();
    renderList();
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  signOut();
  state.email = '';
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
}

async function refresh() {
  try {
    await loadAll();
    fillFilters();
    renderList();
    toast(t('refreshed'));
  } catch (err) {
    toast(friendlyError(err), 'error');
  }
}

// ---------- רשימה וחיפוש ----------
function fullNameHe(c) {
  return [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ');
}

function phonesOf(c) {
  return state.phones.get(String(c.contact_id)) || {};
}

function haystack(c) {
  const p = phonesOf(c);
  const text = [
    c.first_name_he, c.last_name_he, c.first_name_en, c.last_name_en, c.legal_first_name,
    c.wife_name_he, c.wife_name_en, c.city, c.address, c.contact_id,
    p.email_1, p.email_2,
  ].map(normalize).join(' ');
  const phoneDigits = phoneFields().map(([k]) => digits(p[k])).join(' ');
  return `${text} ${phoneDigits}`;
}

function matches(c, query) {
  if (!query.trim()) return true;
  const code = parseCodeQuery(query);
  if (code) {
    return gematriaCodes(c.first_name_he, c.last_name_he)
      .some(([last, first]) => last === code[0] && first === code[1]);
  }
  const hay = haystack(c);
  return normalize(query).split(' ').every((token) => {
    const d = digits(token);
    return hay.includes(token) || (d.length >= 3 && d === token && hay.includes(d));
  });
}

function fillFilters() {
  const sel = $('#tag-filter');
  const current = sel.value;
  sel.innerHTML = `<option value="">${h(t('allTags'))}</option>`
    + (state.lists.community_tag || []).map((tag) => `<option>${h(tag)}</option>`).join('');
  sel.value = current;
}

function visibleContacts() {
  const query = $('#search').value;
  const tag = $('#tag-filter').value;
  const showInactive = $('#show-inactive').checked;
  return state.contacts
    .filter((c) => showInactive || isTrue(c.is_active) || c.is_active === '')
    .filter((c) => !tag || splitTags(c.community_tags).includes(tag))
    .filter((c) => matches(c, query))
    .sort((a, b) => String(a.last_name_he).localeCompare(String(b.last_name_he), 'he')
      || String(a.first_name_he).localeCompare(String(b.first_name_he), 'he'));
}

function renderList() {
  const list = visibleContacts();
  $('#count').textContent = t('count', { n: list.length });
  const body = $('#list');
  if (!list.length) {
    body.innerHTML = `<p class="empty">${h(state.contacts.length ? t('noResults') : t('emptyDb'))}</p>`;
    return;
  }
  body.innerHTML = list.map((c) => {
    const missingEn = !String(c.first_name_en ?? '').trim() || !String(c.last_name_en ?? '').trim();
    const badges = [
      !isAlive(c.is_alive) ? `<span class="badge muted">${t('deceased')}</span>` : '',
      c.is_active === false || c.is_active === 'FALSE' ? `<span class="badge muted">${t('inactive')}</span>` : '',
      isTrue(c.wife_in_neshei) ? `<span class="badge">${t('neshei')}</span>` : '',
    ].join('');
    const tags = splitTags(c.community_tags).map((tag) => `<span class="chip">${h(tag)}</span>`).join('');
    const en = [c.first_name_en, c.last_name_en].filter(Boolean).join(' ');
    return `
      <button type="button" class="row${missingEn ? ' missing-en' : ''}" data-id="${h(c.contact_id)}">
        <span class="row-main">
          <span class="row-name">${h(fullNameHe(c))} ${badges}</span>
          <span class="row-en" dir="ltr">${en ? h(en) : `<em>${t('noEnName')}</em>`}</span>
        </span>
        <span class="row-city">${h(c.city)}</span>
        <span class="row-tags">${tags}</span>
      </button>`;
  }).join('');
}

// ---------- כרטיס אישי ----------
function tagChips(value) {
  return splitTags(value).map((tag) => `<span class="chip">${h(tag)}</span>`).join('');
}

function openCard(id) {
  const c = state.contacts.find((x) => String(x.contact_id) === String(id));
  if (!c) return;
  const p = phonesOf(c);
  const mail = mailingName(c);
  const field = (label, value, ltr = false) => (String(value ?? '').trim()
    ? `<div class="kv"><span>${label}</span><span${ltr ? ' dir="ltr"' : ''}>${value}</span></div>` : '');

  const phones = phoneFields().map(([k, label]) => (p[k]
    ? `<div class="kv"><span>${label}</span><span><a dir="ltr" href="tel:${h(digits(p[k]))}">${h(p[k])}</a> ${tagChips(p[`${k}_tags`])}</span></div>` : '')).join('');
  const emails = emailFields().map(([k, label]) => (p[k]
    ? `<div class="kv"><span>${label}</span><span><a dir="ltr" href="mailto:${h(p[k])}">${h(p[k])}</a> ${tagChips(p[`${k}_tags`])}</span></div>` : '')).join('');

  const address = [c.address, [c.city, c.state, c.zip].filter(Boolean).join(', '),
    c.country && c.country !== 'USA' ? c.country : ''].filter(Boolean).map(h).join('<br>');

  const wife = [c.wife_name_he, c.wife_name_en].some((v) => String(v).trim())
    ? `${h(c.wife_name_he)}${c.wife_name_en ? ` · <span dir="ltr">${h(c.wife_name_en)}</span>` : ''}`
      + `${isTrue(c.wife_is_rebbetzin) ? ' · Rebbetzin' : ''}${!isAlive(c.wife_is_alive) ? ` · ${t('deceasedF')}` : ''}`
      + `${isTrue(c.wife_in_neshei) ? ` · ${t('nesheiFull')}` : ''}`
    : '';

  $('#card-body').innerHTML = `
    <h2 dir="auto">${h(fullNameHe(c))}</h2>
    <p class="sub">#${h(c.contact_id)} · ${t('code')} ${h(primaryCode(c.first_name_he, c.last_name_he))}${!isAlive(c.is_alive) ? ` · ${t('deceased')}` : ''}</p>
    <section>
      ${field(t('marital'), h(maritalLabel(c.marital_status)))}
      ${field(t('enName'), h([c.title_en, c.first_name_en, c.last_name_en].filter(Boolean).join(' ')), true)}
      ${field(t('legalName'), h(c.legal_first_name), true)}
      ${field(t('mailingName'), mail ? h(mail) : '', true)}
      ${field(t('wife'), wife)}
      ${field(t('community'), tagChips(c.community_tags))}
    </section>
    ${address ? `<section><h3>${t('address')}</h3><p dir="ltr" class="addr">${address}</p></section>` : ''}
    ${phones || emails || p.comments ? `<section><h3>${t('phonesEmail')}</h3>${phones}${emails}${field(t('comments'), h(p.comments))}</section>` : ''}
    ${c.updated_at ? `<p class="meta">${h(t('updated', { date: c.updated_at, by: c.updated_by }))}</p>` : ''}`;

  $('#card-edit').onclick = () => { $('#card-dialog').close(); openForm(c); };
  $('#card-dialog').showModal();
}

// ---------- טופס הוספה / עריכה ----------
function options(list, current, label = (v) => v) {
  const values = [...new Set([...(list || []), ...(current ? [current] : [])])];
  return '<option value=""></option>' + values.map((v) => `<option value="${h(v)}"${v === current ? ' selected' : ''}>${h(label(v))}</option>`).join('');
}

/** בורר תגיות: לחיצה מסמנת / מבטלת. מנהל יכול להוסיף תגית חדשה לרשימה. */
function tagPicker(name, listName, value) {
  const selected = splitTags(value);
  const all = [...new Set([...(state.lists[listName] || []), ...selected])];
  return `
    <div class="tags" dir="rtl" data-name="${name}" data-list="${listName}">
      ${all.map((tag) => `<button type="button" class="chip toggle${selected.includes(tag) ? ' on' : ''}">${h(tag)}</button>`).join('')}
      ${state.isAdmin ? `<button type="button" class="chip add">${h(t('newTag'))}</button>` : ''}
    </div>`;
}

function readTags(root, name) {
  const box = $(`.tags[data-name="${name}"]`, root);
  return joinTags($$('.chip.toggle.on', box).map((b) => b.textContent));
}

function cityStateDatalists() {
  const uniq = (key) => [...new Set(state.contacts.map((c) => String(c[key] || '').trim()).filter(Boolean))].sort();
  return `
    <datalist id="dl-city">${uniq('city').map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-state">${uniq('state').map((v) => `<option value="${h(v)}">`).join('')}</datalist>
    <datalist id="dl-address">${uniq('address').map((v) => `<option value="${h(v)}">`).join('')}</datalist>`;
}

function openForm(c = {}) {
  const p = c.contact_id ? phonesOf(c) : {};
  const v = (k) => h(c[k] ?? '');
  const isNew = !c.contact_id;
  const form = $('#contact-form');

  form.innerHTML = `
    <h2>${isNew ? t('newTitle') : h(t('editTitle', { name: fullNameHe(c) }))}</h2>
    ${cityStateDatalists()}

    <fieldset><legend>${t('secDetails')}</legend>
      <div class="grid">
        <label>${t('title')}<select name="title_he" dir="rtl">${options(state.lists.title_he, c.title_he)}</select></label>
        <label>${t('firstHe')}<input name="first_name_he" dir="rtl" required value="${v('first_name_he')}" placeholder="יוסף חיים"></label>
        <label>${t('lastHe')}<input name="last_name_he" dir="rtl" required value="${v('last_name_he')}"></label>
        <label>${t('marital')}<select name="marital_status">${options(state.lists.marital_status, c.marital_status || (isNew ? 'נשוי' : ''), maritalLabel)}</select></label>
        <label class="check"><input type="checkbox" name="deceased" ${!isAlive(c.is_alive) ? 'checked' : ''}> ${t('deceased')}</label>
      </div>
    </fieldset>

    <fieldset><legend>${t('secEnglish')}</legend>
      <div class="grid" dir="ltr">
        <label>Title<select name="title_en">${options(state.lists.title_en, c.title_en)}</select></label>
        <label>First name<input name="first_name_en" value="${v('first_name_en')}"></label>
        <label>Last name<input name="last_name_en" value="${v('last_name_en')}"></label>
        <label>Legal first name (receipts)<input name="legal_first_name" value="${v('legal_first_name')}"></label>
      </div>
    </fieldset>

    <fieldset><legend>${t('secWife')}</legend>
      <div class="grid">
        <label class="check"><input type="checkbox" name="wife_is_rebbetzin" ${isTrue(c.wife_is_rebbetzin) ? 'checked' : ''}> Rebbetzin</label>
        <label>${t('wifeNameHe')}<input name="wife_name_he" dir="rtl" value="${v('wife_name_he')}"></label>
        <label>Wife's name<input name="wife_name_en" dir="ltr" value="${v('wife_name_en')}"></label>
        <label class="check"><input type="checkbox" name="wife_deceased" ${!isAlive(c.wife_is_alive) ? 'checked' : ''}> ${t('deceasedF')}</label>
        <label class="check"><input type="checkbox" name="wife_in_neshei" ${isTrue(c.wife_in_neshei) ? 'checked' : ''}> ${t('nesheiFull')}</label>
      </div>
    </fieldset>

    <fieldset><legend>${t('community')}</legend>
      ${tagPicker('community_tags', 'community_tag', c.community_tags)}
    </fieldset>

    <fieldset><legend>${t('secAddress')}</legend>
      <div class="grid" dir="ltr">
        <label class="wide">Address
          <span class="ac-wrap"><input name="address" autocomplete="off" list="${placesEnabled() ? '' : 'dl-address'}" value="${v('address')}" placeholder="${placesEnabled() ? 'Start typing an address…' : ''}">
          <span class="ac-list" hidden></span></span>
        </label>
        <label>City<input name="city" list="dl-city" value="${v('city')}"></label>
        <label>State<input name="state" list="dl-state" value="${v('state')}"></label>
        <label>ZIP<input name="zip" value="${v('zip')}" inputmode="numeric"></label>
        <label>Country<input name="country" value="${v('country') || 'USA'}"></label>
      </div>
    </fieldset>

    <fieldset><legend>${t('phonesEmail')}</legend>
      ${phoneFields().map(([k, label]) => `
        <div class="contact-line">
          <label>${label}<input name="${k}" dir="ltr" inputmode="tel" value="${h(p[k] ?? '')}"></label>
          ${tagPicker(`${k}_tags`, 'phone_tag', p[`${k}_tags`])}
        </div>`).join('')}
      ${emailFields().map(([k, label]) => `
        <div class="contact-line">
          <label>${label}<input name="${k}" type="email" dir="ltr" value="${h(p[k] ?? '')}"></label>
          ${tagPicker(`${k}_tags`, 'email_tag', p[`${k}_tags`])}
        </div>`).join('')}
      <label>${h(t('commentsLabel'))}<textarea name="comments" rows="2">${h(p.comments ?? '')}</textarea></label>
    </fieldset>

    <div class="actions">
      ${!isNew && (isTrue(c.is_active) || c.is_active === '') ? `<button type="button" class="btn danger" id="btn-deactivate">${t('deactivate')}</button>` : ''}
      ${!isNew && c.is_active !== '' && !isTrue(c.is_active) ? `<button type="button" class="btn" id="btn-activate">${t('activate')}</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn" id="btn-cancel">${t('cancel')}</button>
      <button type="submit" class="btn primary" id="btn-save">${t('save')}</button>
    </div>`;

  wireForm(form, c);
  $('#form-dialog').showModal();
}

function wireForm(form, original) {
  const f = (name) => form.elements[name];

  // תגיות
  $$('.tags', form).forEach((box) => {
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      if (b.classList.contains('toggle')) { b.classList.toggle('on'); return; }
      if (b.classList.contains('add')) {
        const value = prompt(t('newTagPrompt'));
        if (!value || !value.trim()) return;
        try {
          await addListValue(box.dataset.list, value.trim());
          const nb = document.createElement('button');
          nb.type = 'button';
          nb.className = 'chip toggle on';
          nb.textContent = value.trim();
          box.insertBefore(nb, b);
          toast(t('tagAdded'));
        } catch (err) { toast(friendlyError(err), 'error'); }
      }
    });
  });

  // השלמת תואר דו-כיוונית — רק כשהשני ריק
  f('title_he').addEventListener('change', () => {
    const en = state.titleHeToEn[f('title_he').value];
    if (en && !f('title_en').value) f('title_en').value = en;
  });
  f('title_en').addEventListener('change', () => {
    const he = state.titleEnToHe[f('title_en').value];
    if (he && !f('title_he').value) f('title_he').value = he;
  });

  // האישה נפטרה → הצעה לשנות מצב משפחתי
  f('wife_deceased').addEventListener('change', async () => {
    if (!f('wife_deceased').checked || f('marital_status').value !== 'נשוי') return;
    const pick = await choose(t('marital'), t('changeMarital'), [
      ['אלמן', maritalLabel('אלמן'), true], ['גרוש', maritalLabel('גרוש')], ['', t('keepMarried')],
    ]);
    if (pick) f('marital_status').value = pick;
  });

  // טלפונים: עיצוב אוטומטי
  phoneFields().forEach(([k]) => f(k).addEventListener('blur', () => { f(k).value = formatPhone(f(k).value); }));

  // ZIP → עיר וסטייט, לפי כתובות שכבר קיימות במאגר
  f('zip').addEventListener('blur', () => {
    const zip = f('zip').value.trim();
    if (!zip || (f('city').value && f('state').value)) return;
    const known = state.contacts.find((c) => String(c.zip).trim() === zip && c.city);
    if (known) {
      if (!f('city').value) f('city').value = known.city;
      if (!f('state').value) f('state').value = known.state;
    }
  });

  wireAddressAutocomplete(form);

  $('#btn-cancel', form).onclick = () => $('#form-dialog').close();
  const setActive = (active) => async () => {
    if (!active && !confirm(t('confirmDeactivate'))) return;
    await submit(form, original, active);
  };
  $('#btn-deactivate', form)?.addEventListener('click', setActive(false));
  $('#btn-activate', form)?.addEventListener('click', setActive(true));
  form.onsubmit = (e) => { e.preventDefault(); submit(form, original); };
}

function wireAddressAutocomplete(form) {
  if (!placesEnabled()) return;
  const input = form.elements.address;
  const listEl = $('.ac-list', form);
  let timer;
  let items = [];
  let warned = false;

  const close = () => { listEl.hidden = true; listEl.innerHTML = ''; };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const result = await suggest(input.value);
      if (result === 'cap' || result === 'error') {
        if (!warned) {
          toast(result === 'cap'
            ? t('capReached')
            : t('acError', { msg: placesError() || t('unknownErr') }), result === 'cap' ? 'info' : 'error');
        }
        warned = true;
        return close();
      }
      items = result;
      if (!items.length) return close();
      listEl.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${h(it.text)}</button>`).join('');
      listEl.hidden = false;
    }, 300);
  });
  listEl.addEventListener('mousedown', (e) => e.preventDefault()); // שהלחיצה לא תסגור את הרשימה לפני הבחירה
  listEl.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const item = items[Number(b.dataset.i)];
    close();
    const d = item ? await details(item.prediction) : null;
    if (!d) { input.value = b.textContent; return; }
    form.elements.address.value = d.address;
    form.elements.city.value = d.city;
    form.elements.state.value = d.state;
    form.elements.zip.value = d.zip;
    form.elements.country.value = d.country || 'USA';
  });
  input.addEventListener('blur', () => setTimeout(close, 200));
}

function collect(form, original) {
  const val = (n) => String(form.elements[n].value ?? '').trim();
  const contact = {
    ...original,
    title_he: val('title_he'),
    first_name_he: val('first_name_he').replace(/\s+/g, ' '),
    last_name_he: val('last_name_he').replace(/\s+/g, ' '),
    is_alive: !form.elements.deceased.checked,
    marital_status: val('marital_status'),
    title_en: val('title_en'),
    first_name_en: val('first_name_en'),
    last_name_en: val('last_name_en'),
    legal_first_name: val('legal_first_name'),
    wife_name_he: val('wife_name_he'),
    wife_name_en: val('wife_name_en'),
    wife_is_rebbetzin: form.elements.wife_is_rebbetzin.checked,
    wife_is_alive: !form.elements.wife_deceased.checked,
    wife_in_neshei: form.elements.wife_in_neshei.checked,
    community_tags: readTags(form, 'community_tags'),
    address: val('address'),
    city: val('city'),
    state: val('state').toUpperCase(),
    zip: val('zip'),
    country: val('country') || 'USA',
  };
  delete contact._row;

  const phones = { comments: val('comments') };
  phoneFields().forEach(([k]) => {
    phones[k] = formatPhone(val(k));
    phones[`${k}_tags`] = readTags(form, `${k}_tags`);
  });
  emailFields().forEach(([k]) => {
    phones[k] = val(k);
    phones[`${k}_tags`] = readTags(form, `${k}_tags`);
  });
  return { contact, phones };
}

async function submit(form, original, setActive) {
  const { contact, phones } = collect(form, original);
  if (setActive !== undefined) contact.is_active = setActive;

  if (!contact.first_name_he || !contact.last_name_he) {
    toast(t('required'), 'error');
    return;
  }

  // אזהרת כפילות שם
  const sameName = state.contacts.find((c) => String(c.contact_id) !== String(original.contact_id ?? '')
    && normalize(c.first_name_he) === normalize(contact.first_name_he)
    && normalize(c.last_name_he) === normalize(contact.last_name_he));
  if (sameName && !confirm(t('dupName', { id: sameName.contact_id }))) return;

  // אזהרת טלפון שכבר שייך למישהו אחר
  for (const [k, label] of phoneFields()) {
    const d = digits(phones[k]);
    if (d.length < 7) continue;
    for (const [id, other] of state.phones) {
      if (id === String(original.contact_id ?? '')) continue;
      if (phoneFields().some(([ok]) => digits(other[ok]) === d)) {
        const owner = state.contacts.find((c) => String(c.contact_id) === id);
        if (!confirm(t('dupPhone', { label, phone: phones[k], owner: owner ? fullNameHe(owner) : `#${id}` }))) return;
      }
    }
  }

  const btn = $('#btn-save', form);
  btn.disabled = true;
  btn.textContent = t('saving');
  try {
    const id = await saveContact(contact, phones);
    await loadAll();
    renderList();
    $('#form-dialog').close();
    toast(original.contact_id ? t('saved') : t('added', { id }));
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('save');
  }
}

// ---------- הפעלה ----------
function switchLang(lang) {
  setLang(lang);
  if (!$('#app-view').hidden) { fillFilters(); renderList(); }
}

function start() {
  applyStatic();
  $$('.lang-switch button').forEach((b) => { b.onclick = () => switchLang(b.dataset.lang); });
  $('#btn-login').onclick = signIn;
  $('#btn-logout').onclick = logout;
  $('#btn-refresh').onclick = refresh;
  $('#btn-new').onclick = () => openForm();
  $('#search').addEventListener('input', renderList);
  $('#tag-filter').addEventListener('change', renderList);
  $('#show-inactive').addEventListener('change', renderList);
  $('#list').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openCard(row.dataset.id);
  });
  $$('dialog [data-close]').forEach((b) => { b.onclick = () => b.closest('dialog').close(); });

  initAuth().then(() => { $('#btn-login').disabled = false; })
    .catch(() => toast(t('gisFail'), 'error'));
}

start();
