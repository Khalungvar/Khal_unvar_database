// מערדזשן: צוויי כרטיסן פון דעם זעלבן מענטש → איינס. ביי יעדן פעלד וואס איז אנדערש קלייבט מען וועלכעס;
// טעג'ס, ארגונים, טעלעפאנען און אימעילס ווערן צוזאמענגעלייגט; נדבות, מאורעות, קשרים, ישיבה אא"וו ווערן
// אריבערגעפירט, און דער צווייטער כרטיס גייט אין "מיסט". א גבאי — א בקשה צו א מנהל.
import { state, loadAll, mergeContactPair } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, splitTags, joinTags, digits, isTrue } from './util.js';
import { mergeOrgTags } from './orgtags.js';
import { submitRequest } from './requests.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function initMerge(helpers) { ui = helpers; }

// פעלדער מיט איין ווערט — מ'קלייבט
const SINGLE = ['title_he', 'first_name_he', 'last_name_he', 'title_en', 'first_name_en', 'last_name_en', 'legal_first_name',
  'marital_status', 'wife_name_he', 'wife_name_en', 'address', 'city', 'state', 'zip', 'country', 'area', 'kvitel'];
// פעלדער מיט א סך ווערטן — צוזאמען
const MULTI = ['community_tags', 'beis_medrash', 'kollel', 'organization'];
const PHONES = ['mobile', 'home_phone', 'wife_mobile', 'other_phone'];
const EMAILS = ['email_1', 'email_2'];

const byId = (id) => state.contacts.find((c) => String(c.contact_id) === String(id));
const ph = (id) => ({ ...(state.phones.get(String(id)) || {}) });
const blank = (v) => !String(v ?? '').trim();

export function openMerge(a) {
  const dlg = $('#merge-dialog'); const form = $('#merge-form');
  const others = state.contacts.filter((x) => String(x.contact_id) !== String(a.contact_id));
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>⇄ ${h(t('mgTitle'))}</h2>
    <p class="muted">${h(t('mgIntro', { name: ui.fullNameHe(a) }))}</p>
    <label class="wide">${h(t('mgPick'))}<input name="other" list="dl-mg" autocomplete="off" placeholder="${h(t('pickContact'))}"></label>
    <datalist id="dl-mg">${others.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
    <div id="mg-body"></div>
    <div class="actions"><span class="spacer"></span>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="submit" class="btn primary" id="mg-go" disabled>⇄ ${h(t('mgGo'))}</button></div>`;
  $$('[data-close]', form).forEach((b) => { b.onclick = () => dlg.close(); });
  const pick = form.elements.other;
  let pair = null; // { keep, drop }
  const render = () => {
    const b = others.find((x) => ui.pickerLabel(x) === pick.value.trim());
    if (!b) { $('#mg-body', form).innerHTML = ''; $('#mg-go', form).disabled = true; pair = null; return; }
    if (!pair || (String(pair.keep.contact_id) !== String(b.contact_id) && String(pair.drop.contact_id) !== String(b.contact_id))) {
      // דער עלטערער (קלענערער נומער) בלייבט — ער האט מסתמא מער געשיכטע
      pair = Number(a.contact_id) <= Number(b.contact_id) ? { keep: a, drop: b } : { keep: b, drop: a };
    }
    renderPair(form, pair, () => { pair = { keep: pair.drop, drop: pair.keep }; renderPair(form, pair, null); });
    $('#mg-go', form).disabled = false;
  };
  pick.oninput = render;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!pair) return;
    const { contact, phones } = combined(form, pair);
    const go = $('#mg-go', form);
    if (!confirm(t('mgConfirm', { drop: ui.fullNameHe(pair.drop), id: pair.drop.contact_id, keep: pair.keep.contact_id }))) return;
    go.disabled = true;
    try {
      if (!state.isAdmin) {
        await submitRequest('merge', { keep: String(pair.keep.contact_id), drop: String(pair.drop.contact_id), contact, phones },
          t('rqSumMerge', { a: ui.fullNameHe(pair.drop), b: ui.fullNameHe(pair.keep) }));
        dlg.close();
        return;
      }
      await mergeContactPair(pair.keep.contact_id, pair.drop.contact_id, contact, phones);
      await loadAll();
      dlg.close();
      ui.refreshAll();
      ui.toast(t('mgDone'));
      ui.openCard(pair.keep.contact_id);
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); go.disabled = false; }
  };
  if (!dlg.open) dlg.showModal();
}

function renderPair(form, pair, onSwap) {
  const { keep: A, drop: B } = pair;
  const pa = ph(A.contact_id); const pb = ph(B.contact_id);
  const rows = SINGLE.filter((k) => !blank(A[k]) || !blank(B[k])).map((k) => {
    const same = String(A[k] ?? '').trim() === String(B[k] ?? '').trim();
    const def = blank(A[k]) ? 'b' : 'a';
    if (same || blank(A[k]) || blank(B[k])) {
      return `<tr class="mg-same"><th>${h(ui.fieldLabel('contact', k))}</th><td colspan="2">${h(blank(A[k]) ? B[k] : A[k])}</td></tr>`;
    }
    return `<tr class="mg-diff"><th>${h(ui.fieldLabel('contact', k))}</th>
      <td><label class="check"><input type="radio" name="f_${k}" value="a"${def === 'a' ? ' checked' : ''}> ${h(A[k])}</label></td>
      <td><label class="check"><input type="radio" name="f_${k}" value="b"${def === 'b' ? ' checked' : ''}> ${h(B[k])}</label></td></tr>`;
  }).join('');
  const multi = MULTI.map((k) => {
    const v = joinTags([...new Set([...splitTags(A[k]), ...splitTags(B[k])])]);
    return v ? `<tr class="mg-same"><th>${h(ui.fieldLabel('contact', k))}</th><td colspan="2">${h(v)} <small class="muted">${h(t('mgBoth'))}</small></td></tr>` : '';
  }).join('');
  const nums = [...new Set([...PHONES.map((k) => pa[k]), ...PHONES.map((k) => pb[k])].filter((x) => !blank(x)))];
  const mails = [...new Set([...EMAILS.map((k) => pa[k]), ...EMAILS.map((k) => pb[k])].filter((x) => !blank(x)).map((x) => String(x).toLowerCase()))];
  const count = (id, list) => list.filter((x) => String(x) === String(id)).length;
  const moving = [
    [t('cardTabMoney'), count(B.contact_id, state.donations.map((d) => d.contact_id))],
    [t('mgOccasions'), count(B.contact_id, state.occasions.map((o) => o.contact_id))],
    [t('family'), state.relations.filter((r) => String(r.contact_id_a) === String(B.contact_id)).length],
    [t('cardTabSchool'), (state.enrollments || []).filter((e) => String(e.contact_id) === String(B.contact_id) || String(e.parent_id) === String(B.contact_id)).length],
  ].filter(([, n]) => n);
  $('#mg-body', form).innerHTML = `<div class="mg-head">
      <div><span class="badge paid">${h(t('mgKeep'))}</span> <b>${h(ui.fullNameHe(A))}</b> <span class="muted">#${h(A.contact_id)}</span></div>
      ${onSwap ? `<button type="button" class="btn small-btn" id="mg-swap">⇄ ${h(t('mgSwap'))}</button>` : ''}
      <div><span class="badge muted">${h(t('mgDrop'))}</span> <b>${h(ui.fullNameHe(B))}</b> <span class="muted">#${h(B.contact_id)}</span></div></div>
    <p class="hint-line">${h(t('mgHint'))}</p>
    <table class="lapsed-table mg-table"><thead><tr><th></th><th>#${h(A.contact_id)}</th><th>#${h(B.contact_id)}</th></tr></thead>
      <tbody>${rows}${multi}
      ${nums.length ? `<tr class="mg-same"><th>${h(t('phonesEmail'))}</th><td colspan="2" dir="ltr">${h([...nums, ...mails].join(' · '))} <small class="muted">${h(t('mgBoth'))}</small></td></tr>` : ''}
      ${!blank(pa.comments) || !blank(pb.comments) ? `<tr class="mg-same"><th>${h(t('comments'))}</th><td colspan="2">${h([pa.comments, pb.comments].filter((x) => !blank(x)).join(' | '))}</td></tr>` : ''}
      </tbody></table>
    ${moving.length ? `<p class="hint-line">↪ ${h(t('mgMoving', { list: moving.map(([l, n]) => `${l} (${n})`).join(', ') }))}</p>` : ''}`;
  const sw = $('#mg-swap', form);
  if (sw) sw.onclick = onSwap;
}

/** די צוזאמענגעלייגטע פרטים: { contact, phones } */
function combined(form, { keep: A, drop: B }) {
  const c = { ...A };
  delete c._row;
  SINGLE.forEach((k) => {
    if (blank(A[k])) c[k] = B[k] ?? '';
    else if (!blank(B[k]) && form.elements[`f_${k}`]) {
      const r = [...form.querySelectorAll(`input[name="f_${k}"]`)].find((x) => x.checked);
      if (r && r.value === 'b') c[k] = B[k];
    }
  });
  MULTI.forEach((k) => { c[k] = joinTags([...new Set([...splitTags(A[k]), ...splitTags(B[k])])]); });
  // "פריער": ווי ביי דעם וואס האט דעם ארגון
  ['beis_medrash', 'kollel', 'organization'].forEach((k) => {
    const f = `${k}_former`;
    if (!splitTags(A[k]).length && splitTags(B[k]).length) c[f] = B[f];
  });
  c.org_tags = mergeOrgTags(A.org_tags, B.org_tags);
  ['wife_in_neshei', 'wife_is_rebbetzin'].forEach((k) => { c[k] = isTrue(A[k]) || isTrue(B[k]); });
  c.unverified_fields = joinTags(splitTags(A.unverified_fields).filter((k) => !SINGLE.includes(k) || c[k] === A[k]));
  // טעלעפאנען: די פון דעם וואס בלייבט; די פונעם צווייטן אין די פרייע פלעצער, דאס איבעריגע — אין די הערות
  const pa = ph(A.contact_id); const pb = ph(B.contact_id);
  const p = { ...pa, contact_id: A.contact_id };
  const have = new Set(PHONES.map((k) => digits(p[k])).filter(Boolean));
  const extra = [];
  PHONES.forEach((k) => {
    const v = pb[k]; const d = digits(v);
    if (blank(v) || have.has(d)) return;
    const slot = blank(p[k]) ? k : PHONES.find((x) => blank(p[x]));
    if (slot) { p[slot] = v; if (pb[`${k}_tags`] && blank(p[`${slot}_tags`])) p[`${slot}_tags`] = pb[`${k}_tags`]; } else extra.push(v);
    have.add(d);
  });
  const mails = new Set(EMAILS.map((k) => String(p[k] || '').toLowerCase()).filter(Boolean));
  EMAILS.forEach((k) => {
    const v = String(pb[k] || '').toLowerCase();
    if (!v || mails.has(v)) return;
    const slot = EMAILS.find((x) => blank(p[x]));
    if (slot) p[slot] = v; else extra.push(v);
    mails.add(v);
  });
  p.comments = [pa.comments, pb.comments, extra.length ? extra.join(', ') : ''].filter((x) => !blank(x)).join(' | ');
  return { contact: c, phones: p };
}
