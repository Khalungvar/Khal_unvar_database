// אימעילס: שיקן דורך Gmail פונעם אקאונט וואס איז אריין (בעסער: "דאטאבייס").
// א שיינער אימעיל מיטן באנער / לאגא פונעם ארגון, בילדער, צוגעלייגטע טעקעס (למשל גליונות פרשת השבוע),
// צו איינעם (פון כרטיס) אדער צו א רשימה. אלעס ווערט פארשריבן אין לשונית EmailLog.
import { state, orgDetailsOf, orgLogo } from './data.js';
import { gmailSend, ensureGmailScope, hasGmailScope, appendRows, readTabs } from './google.js';
import { t } from './i18n.js';
import { escapeHtml as h, mailingName, shrinkImage, nowStamp } from './util.js';
import { umbrellaName } from './scope.js';
import { savedInScope, parseSaved, evaluate, templates } from './lists.js';

let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function initMail(helpers) { ui = helpers; }

// ---------- קליינע הילף-פונקציעס ----------
const enc = new TextEncoder();
function b64utf8(str) {
  const bytes = enc.encode(String(str));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64bytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const wrap76 = (b64) => b64.replace(/.{1,76}/g, '$&\r\n').trimEnd();
/** א "Subject" / נאמען מיט אידיש — אזוי ווי אימעיל פארלאנגט (RFC 2047) */
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`);
function dataUrlParts(url) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(url || ''));
  if (!m) return null;
  return { mime: m[1], b64: m[2] ? m[3] : b64utf8(decodeURIComponent(m[3])) };
}

/** אן אימעיל אדרעס פון א קאנטאקט (דער ערשטער וואס איז דא). */
export function emailOf(c) {
  const p = state.phones.get(String(c?.contact_id)) || {};
  const e = String(p.email_1 || p.email_2 || '').trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : '';
}

/**
 * בויט א פולשטענדיגן אימעיל (MIME).
 * m = { from, fromName, to, subject, html, text, inline: [{cid, dataUrl}], attachments: [{name, mime, b64}] }
 */
export function buildMime(m) {
  const B = () => `=_khal_${Math.random().toString(36).slice(2)}`;
  const alt = B(); const rel = B(); const mix = B();
  const altPart = [
    `Content-Type: multipart/alternative; boundary="${alt}"`, '',
    `--${alt}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64utf8(m.text || '')),
    `--${alt}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64utf8(m.html || '')),
    `--${alt}--`,
  ].join('\r\n');
  const inline = (m.inline || []).map((x) => ({ ...x, p: dataUrlParts(x.dataUrl) })).filter((x) => x.p);
  const relPart = inline.length ? [
    `Content-Type: multipart/related; boundary="${rel}"`, '',
    `--${rel}`, altPart,
    ...inline.flatMap((x) => [`--${rel}`, `Content-Type: ${x.p.mime}`, 'Content-Transfer-Encoding: base64',
      `Content-ID: <${x.cid}>`, `Content-Disposition: inline; filename="${x.cid}.${x.p.mime.split('/')[1] || 'img'}"`, '', wrap76(x.p.b64)]),
    `--${rel}--`,
  ].join('\r\n') : altPart;
  const att = m.attachments || [];
  const body = att.length ? [
    `Content-Type: multipart/mixed; boundary="${mix}"`, '',
    `--${mix}`, relPart,
    ...att.flatMap((a) => [`--${mix}`, `Content-Type: ${a.mime || 'application/octet-stream'}; name="${word(a.name)}"`,
      'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${word(a.name)}"`, '', wrap76(a.b64)]),
    `--${mix}--`,
  ].join('\r\n') : relPart;
  const head = [
    `From: ${m.fromName ? `${word(m.fromName)} ` : ''}<${m.from}>`,
    `To: <${m.to}>`,
    m.replyTo ? `Reply-To: <${m.replyTo}>` : '',
    // א "אפשרייבן" קנעפל אין Gmail — העלפט שטארק נישט צו פאלן אין ספאם
    `List-Unsubscribe: <mailto:${m.replyTo || m.from}?subject=unsubscribe>`,
    `Subject: ${word(m.subject || '')}`,
    'MIME-Version: 1.0',
  ].filter(Boolean).join('\r\n');
  return `${head}\r\n${body}\r\n`;
}

// ---------- דער שיינער אימעיל ----------
/** טעקסט → HTML: פאראגראפן לויט ליידיגע שורות, לינקס ווערן קליקבאר. */
export function textToHtml(text) {
  return String(text || '').split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px">${h(p).replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7a1219">$1</a>')}</p>`).join('');
}

/** די פערזענליכע ווערטער: {נאמען} / {name} */
function personalize(text, c) {
  const he = c ? [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ') : '';
  const en = c ? (mailingName(c) || [c.first_name_en, c.last_name_en].filter(Boolean).join(' ')) : '';
  return String(text || '').replace(/\{נאמען\}/g, he).replace(/\{name\}/gi, en || he);
}

/**
 * דער אימעיל אין א שיינעם ראם: באנער (אדער לאגא + נאמען), דער טעקסט, בילדער, און אונטן די פרטים פונעם ארגון.
 * גיט צוריק { html, inline } — די בילדער גייען מיט אלס "cid" (Gmail ווייזט נישט קיין data: בילדער).
 */
export function emailLayout(org, bodyHtml, photos = [], extraTopHtml = '') {
  const det = orgDetailsOf(org) || {};
  const banner = [det.header_img, det.header_img_2, det.header_img_3].map((x) => String(x || '')).join('');
  const logo = orgLogo(org);
  const he = det.org_name_he || org || '';
  const inline = [];
  if (banner) inline.push({ cid: 'banner', dataUrl: banner });
  else if (logo && logo.startsWith('data:')) inline.push({ cid: 'logo', dataUrl: logo });
  photos.forEach((p, i) => inline.push({ cid: `photo${i + 1}`, dataUrl: p }));
  const head = banner
    ? `<img src="cid:banner" alt="${h(he)}" style="display:block;width:100%;max-width:640px;border-radius:10px 10px 0 0">`
    : `<table role="presentation" width="100%" style="background:#7a1219;border-radius:10px 10px 0 0"><tr>
        ${inline.some((x) => x.cid === 'logo') ? '<td style="padding:12px 16px;width:72px"><img src="cid:logo" width="64" height="64" style="background:#fffaf0;border-radius:8px;padding:3px" alt=""></td>' : ''}
        <td style="padding:14px 16px;color:#f6e7c1;font:bold 22px Arial,sans-serif" dir="rtl">${h(he)}</td></tr></table>`;
  const gallery = photos.length ? `<table role="presentation" width="100%" style="margin-top:6px">${photos.map((p, i) => (i % 2 === 0 ? '<tr>' : '')
    + `<td style="padding:4px;width:50%;vertical-align:top"><img src="cid:photo${i + 1}" style="display:block;width:100%;border-radius:8px" alt=""></td>`
    + (i % 2 === 1 || i === photos.length - 1 ? '</tr>' : '')).join('')}</table>` : '';
  const foot = [det.legal_name, [det.address, det.city_state_zip].filter(Boolean).join(', '), det.phone].filter(Boolean).map(h).join(' · ');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f4ede0">
<div style="background:#f4ede0;padding:18px 8px">
<table role="presentation" align="center" width="100%" style="max-width:640px;background:#ffffff;border:1px solid #e3d3ad;border-radius:10px;border-collapse:separate">
<tr><td style="padding:0">${head}</td></tr>
<tr><td dir="rtl" style="padding:20px 22px;font:16px/1.6 Arial,'Frank Ruhl Libre',David,sans-serif;color:#1f1a17;text-align:right">
${extraTopHtml}${bodyHtml}${gallery}
</td></tr>
<tr><td style="background:#7a1219;color:#f6e7c1;padding:10px 16px;font:12px Arial,sans-serif;text-align:center;border-radius:0 0 10px 10px">
${foot || h(he)}<br><span dir="rtl">${h(t('mailFootStop'))}</span></td></tr>
</table></div></body></html>`;
  return { html, inline };
}

// ---------- שיקן ----------
let logCache = null;
async function sentToday() {
  try {
    if (!logCache) logCache = (await readTabs(['EmailLog'])).EmailLog || [];
    const today = nowStamp().slice(0, 10);
    return logCache.slice(1).filter((r) => String(r[0]).startsWith(today) && String(r[2]).toLowerCase() === state.email).length;
  } catch { return 0; }
}

/**
 * שיקט א ליסטע אימעילס, איינס נאכן צווייטן. jobs = [{ to, contact_id, subject, html, text, inline, attachments, kind, org }]
 * onProgress(done, total, errors) · isCancelled() → stop.
 */
export async function sendJobs(jobs, { onProgress = () => {}, isCancelled = () => false, fromName = '' } = {}) {
  const rows = [];
  let done = 0; let errors = 0;
  const flush = async () => {
    if (!rows.length) return;
    const batch = rows.splice(0);
    try { await appendRows('EmailLog', batch); logCache = null; } catch { /* פארשרייבן איז נישט קריטיש */ }
  };
  for (const j of jobs) {
    if (isCancelled()) break;
    let status = 'sent'; let error = '';
    try {
      await gmailSend(buildMime({ ...j, from: state.email, fromName }));
    } catch (err) {
      status = 'error'; error = String(err.message || err).slice(0, 200); errors += 1;
      if (err.status === 429 || /limit|quota/i.test(error)) { rows.push([nowStamp(), state.email, state.email, j.to, j.contact_id || '', j.kind || '', j.subject, j.org || '', status, error]); break; }
    }
    rows.push([nowStamp(), state.email, state.email, j.to, j.contact_id || '', j.kind || '', j.subject, j.org || '', status, error]);
    done += 1;
    onProgress(done, jobs.length, errors);
    if (rows.length >= 20) await flush();
    await new Promise((r) => setTimeout(r, 250)); // נישט צו שנעל — Gmail האט ליב א ביסל געדולד
  }
  await flush();
  return { done, errors };
}

// ---------- דער פענצטער צו שרייבן ----------
const DAILY_LIMIT = 500;
function allOrgs() {
  const lists = ['beis_medrash', 'kollel', 'organization'].flatMap((n) => state.lists[n] || []);
  return [umbrellaName(), ...lists].filter(Boolean);
}

/**
 * עפנט דעם פענצטער. opts = { contacts: [c...], title, org, subject, body }
 * אן contacts — מ'קלייבט א רשימה אינעם פענצטער.
 */
export function openCompose(opts = {}) {
  const dlg = $('#mail-dialog');
  const form = $('#mail-form');
  const st = {
    org: opts.org || umbrellaName(), photos: [], files: [], sending: false, cancel: false,
    contacts: opts.contacts || null, listKey: opts.contacts ? 'given' : '',
  };
  const listOptions = () => {
    const saved = savedInScope().map((l) => [`s:${l.list_id}`, `📋 ${l.name}`]);
    const tpl = templates().map((x, i) => [`t:${i}`, `✦ ${t(x.key)}`]);
    return [...(opts.contacts ? [['given', opts.title || t('mailGiven', { n: opts.contacts.length })]] : []), ...saved, ...tpl];
  };
  const recipients = () => {
    let list = st.contacts || [];
    if (st.listKey.startsWith('s:')) {
      const l = state.savedLists.find((x) => `s:${x.list_id}` === st.listKey);
      list = l ? evaluate(parseSaved(l).cr).map((x) => x.c) : [];
    } else if (st.listKey.startsWith('t:')) {
      const x = templates()[Number(st.listKey.slice(2))];
      list = x ? evaluate({ ...parseSaved({ criteria: JSON.stringify(x.criteria) }).cr }).map((r) => r.c) : [];
    } else if (st.listKey !== 'given') list = [];
    const seen = new Set();
    const withMail = [];
    let without = 0;
    list.forEach((c) => {
      const e = emailOf(c).toLowerCase();
      if (!e) { without += 1; return; }
      if (seen.has(e)) return; // נישט צוויי מאל צו דער זעלבער אדרעס
      seen.add(e);
      withMail.push({ c, e });
    });
    return { withMail, without };
  };
  form.innerHTML = `<button type="button" class="x-close" data-close aria-label="${h(t('close'))}">✕</button>
    <h2>✉ ${h(t('mailTitle'))}</h2>
    <div class="ml-layout">
      <div class="ml-fields">
        <p class="ml-from">${h(t('mailFrom'))}: <b dir="ltr">${h(state.email)}</b>
          ${state.email !== 'khalungvardatabase@gmail.com' ? `<span class="hint-line">${h(t('mailFromHint'))}</span>` : ''}</p>
        <label>${h(t('mailOrg'))}<select id="ml-org">${allOrgs().map((o) => `<option${o === st.org ? ' selected' : ''}>${h(o)}</option>`).join('')}</select></label>
        <label>${h(t('mailTo'))}<select id="ml-list"><option value="">—</option>${listOptions().map(([k, l]) => `<option value="${h(k)}"${k === st.listKey ? ' selected' : ''}>${h(l)}</option>`).join('')}</select></label>
        <p class="ml-count" id="ml-count"></p>
        <label>${h(t('mailSubject'))}<input id="ml-subject" dir="auto" value="${h(opts.subject || '')}"></label>
        <label>${h(t('mailBody'))}<textarea id="ml-body" rows="9" dir="rtl" placeholder="${h(t('mailBodyPh'))}">${h(opts.body || '')}</textarea></label>
        <p class="hint-line">${h(t('mailTokens'))}</p>
        <div class="ml-files">
          <label class="btn small-btn">🖼 ${h(t('mailAddPhotos'))}<input type="file" id="ml-photos" accept="image/*" multiple hidden></label>
          <label class="btn small-btn">📎 ${h(t('mailAddFiles'))}<input type="file" id="ml-files" multiple hidden></label>
        </div>
        <div id="ml-attached" class="ml-attached"></div>
      </div>
      <aside class="ml-preview"><div class="od-live-head">👁 ${h(t('rcLive'))}</div><iframe id="ml-frame" title="preview"></iframe></aside>
    </div>
    <div class="ml-progress" id="ml-progress" hidden><div class="ml-bar"><span></span></div><span class="ml-ptext"></span></div>
    <div class="actions">
      <button type="button" class="btn" id="ml-test">${h(t('mailTest'))}</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>${h(t('cancelBtn'))}</button>
      <button type="button" class="btn primary" id="ml-send">${h(t('mailSend'))}</button>
    </div>`;
  const close = () => { if (st.sending && !confirm(t('mailStopConfirm'))) return; st.cancel = true; dlg.close(); };
  $$('[data-close]', form).forEach((b) => { b.onclick = close; });

  const build = (c) => {
    const subject = personalize($('#ml-subject', form).value.trim(), c);
    const body = personalize($('#ml-body', form).value, c);
    const { html, inline } = emailLayout(st.org, textToHtml(body), st.photos);
    return { subject, html, text: body, inline, attachments: st.files };
  };
  const refresh = () => {
    const { withMail, without } = recipients();
    const today = st.today ?? 0;
    $('#ml-count', form).innerHTML = `${h(t('mailCount', { n: withMail.length }))}${without ? ` · <span class="warn-text">${h(t('mailNoEmail', { n: without }))}</span>` : ''}
      <br><span class="muted small">${h(t('mailQuota', { n: today, max: DAILY_LIMIT }))}</span>`;
    $('#ml-send', form).textContent = t('mailSendN', { n: withMail.length });
    $('#ml-send', form).disabled = !withMail.length || st.sending;
    const sample = withMail[0]?.c || null;
    const m = build(sample);
    // פאר דער פראבע: די בילדער ווי data (נישט cid)
    let html = m.html;
    m.inline.forEach((x) => { html = html.split(`cid:${x.cid}`).join(x.dataUrl); });
    $('#ml-frame', form).srcdoc = html;
    $('#ml-attached', form).innerHTML = [
      ...st.photos.map((p, i) => `<span class="ml-chip"><img src="${p}" alt=""><button type="button" class="linkish" data-rm-photo="${i}">✕</button></span>`),
      ...st.files.map((f, i) => `<span class="ml-chip">📎 ${h(f.name)} <span class="muted small">${Math.round(f.size / 1024)}KB</span><button type="button" class="linkish" data-rm-file="${i}">✕</button></span>`),
    ].join('');
  };
  let timer = null;
  form.oninput = () => { clearTimeout(timer); timer = setTimeout(refresh, 200); };
  $('#ml-org', form).onchange = (e) => { st.org = e.target.value; refresh(); };
  $('#ml-list', form).onchange = (e) => { st.listKey = e.target.value; refresh(); };
  $('#ml-photos', form).onchange = async (e) => {
    for (const f of e.target.files) {
      try { st.photos.push(await shrinkImage(f, 1200, 400000, true)); } catch { ui.toast(t('mmImageBad'), 'error'); }
    }
    e.target.value = '';
    refresh();
  };
  $('#ml-files', form).onchange = async (e) => {
    for (const f of e.target.files) {
      const total = st.files.reduce((s, x) => s + x.size, 0) + f.size;
      if (total > 18 * 1024 * 1024) { ui.toast(t('mailTooBig'), 'error'); break; }
      const bytes = new Uint8Array(await f.arrayBuffer());
      st.files.push({ name: f.name, mime: f.type || 'application/octet-stream', b64: b64bytes(bytes), size: f.size });
    }
    e.target.value = '';
    refresh();
  };
  $('#ml-attached', form).onclick = (e) => {
    const p = e.target.closest('[data-rm-photo]');
    if (p) { st.photos.splice(Number(p.dataset.rmPhoto), 1); refresh(); }
    const f = e.target.closest('[data-rm-file]');
    if (f) { st.files.splice(Number(f.dataset.rmFile), 1); refresh(); }
  };

  const progress = (done, total, errors) => {
    const box = $('#ml-progress', form);
    box.hidden = false;
    $('.ml-bar span', box).style.width = `${Math.round((done / total) * 100)}%`;
    $('.ml-ptext', box).textContent = t('mailProgress', { done, total }) + (errors ? ` · ${t('mailErrors', { n: errors })}` : '');
  };
  const fromName = () => (orgDetailsOf(st.org) || {}).org_name_he || st.org;
  const ready = () => {
    if (!$('#ml-subject', form).value.trim()) { ui.toast(t('mailNeedSubject'), 'error'); $('#ml-subject', form).focus(); return false; }
    return true;
  };
  // די הרשאה פון Gmail מוז מען בעטן גלייך פונעם קליק
  const withScope = (fn) => () => {
    if (!ready()) return;
    const p = hasGmailScope() ? Promise.resolve() : ensureGmailScope();
    p.then(fn, (err) => ui.toast(ui.friendlyError(err), 'error'));
  };
  $('#ml-test', form).onclick = withScope(async () => {
    const sample = recipients().withMail[0]?.c || null;
    const m = build(sample);
    st.sending = true;
    const r = await sendJobs([{ ...m, to: state.email, kind: 'test', org: st.org, subject: `[TEST] ${m.subject}` }], { fromName: fromName() });
    st.sending = false;
    ui.toast(r.errors ? t('mailFailed') : t('mailTestSent', { to: state.email }), r.errors ? 'error' : '');
  });
  $('#ml-send', form).onclick = withScope(async () => {
    const { withMail } = recipients();
    if (!withMail.length) return;
    const today = await sentToday();
    if (today + withMail.length > DAILY_LIMIT && !confirm(t('mailOverQuota', { n: withMail.length, today, max: DAILY_LIMIT }))) return;
    if (!confirm(t('mailConfirm', { n: withMail.length }))) return;
    st.sending = true; st.cancel = false;
    $('#ml-send', form).disabled = true;
    const jobs = withMail.map(({ c, e }) => ({ ...build(c), to: e, contact_id: c.contact_id, kind: opts.kind || 'list', org: st.org }));
    const r = await sendJobs(jobs, { onProgress: progress, isCancelled: () => st.cancel, fromName: fromName() });
    st.sending = false;
    ui.toast(t('mailDone', { n: r.done - r.errors, errors: r.errors }), r.errors ? 'error' : '');
    if (!r.errors) dlg.close();
  });
  if (!dlg.open) dlg.showModal();
  refresh();
  sentToday().then((n) => { st.today = n; refresh(); });
}
