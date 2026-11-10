// 📱 מסך הגבאי בטאבלט (שלב 5): רישום מהיר של תרומה / הבטחה בזמן האירוע.
//   חיפוש תורם (קודם המוזמנים) → סכום (מקלדת גדולה) → אופן תשלום → ✓ לרשום. נכנס ישר ל-Donations בקמפיין.
import { state, saveDonation, deleteDonation, loadAll } from './data.js';
import { escapeHtml as h, isTrue } from './util.js';
import { todayIso, toHebrew, formatHebrew } from './hebdate.js';
import { money } from './donations.js';
import { campaignOrg } from './scope.js';
import { settingsOf, loadSettings, invitesOf } from './campx.js';

const $ = (s, r = document) => r.querySelector(s);
const nameOf = (c) => [c.title_he, c.first_name_he, c.last_name_he].filter(Boolean).join(' ').trim() || [c.first_name_en, c.last_name_en].filter(Boolean).join(' ');

export async function openTablet(c, { toast = () => {}, after = () => {} } = {}) {
  await loadSettings().catch(() => {});
  const S = settingsOf(c);
  let inv = []; try { inv = await invitesOf(c.name); } catch { inv = []; }
  const invIds = new Set(inv.filter((r) => r.contact_id).map((r) => String(r.contact_id)));
  const methods = (S.methods && S.methods.length ? S.methods : ['מזומן', 'צ\'ק', 'כרטיס אשראי']).concat(['הבטחה']);
  const quick = [36, 54, 100, 180, 360, 500, 1000, 3600];
  const org = campaignOrg(c.name) || c.org || '';
  const st = { who: null, ext: '', amt: '', method: methods[0], ded: '', check: '' };
  const feed = [];
  const el = document.createElement('div'); el.className = 'tb-root'; el.dir = 'rtl';
  document.body.append(el);
  document.body.classList.add('tb-open');
  try { el.requestFullscreen?.().catch(() => {}); } catch { /* */ }
  const totals = () => {
    const list = state.donations.filter((d) => d.campaign === c.name);
    const tot = list.reduce((s, d) => s + Number(d.amount_usd || 0), 0);
    return { tot, donors: new Set(list.map((d) => d.contact_id || d.donor_name)).size };
  };
  const goal = Number(c.goal) || 0;
  const head = () => {
    const t = totals(); const pct = goal ? Math.min(100, Math.round((t.tot / goal) * 100)) : 0;
    return `<h1>${h(S.name_he || c.name)}</h1><span class="tb-tot">${money(t.tot)}</span>${goal ? `<div class="tb-trk"><i style="width:${pct}%"></i></div><small>מתוך ${money(goal)} · ${t.donors} תורמים</small>` : `<small>${t.donors} תורמים</small>`}
      <span class="spacer"></span><button type="button" class="tb-b2" data-x>✕ יציאה</button>`;
  };
  const results = (q) => {
    if (q.length < 2) return [];
    const dg = q.replace(/\D/g, '');
    const hit = state.contacts.filter((x) => {
      if (dg.length >= 4) { const p = state.phones.get(String(x.contact_id)) || {}; return ['mobile', 'home_phone', 'wife_mobile'].some((k) => String(p[k] || '').replace(/\D/g, '').includes(dg)); }
      const n = `${nameOf(x)} ${x.first_name_en || ''} ${x.last_name_en || ''}`;
      return q.split(/\s+/).every((w) => n.includes(w));
    });
    return hit.sort((a, b) => invIds.has(String(b.contact_id)) - invIds.has(String(a.contact_id))).slice(0, 8);
  };
  const draw = () => {
    const amt = Number(st.amt) || 0;
    const who = st.who ? nameOf(st.who) : st.ext;
    const paidNow = feed.filter((d) => isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
    const pledged = feed.filter((d) => !isTrue(d.is_paid)).reduce((s, d) => s + Number(d.amount_usd || 0), 0);
    el.innerHTML = `<div class="tb-head">${head()}</div>
      <div class="tb-main"><div class="tb-card">
        <p class="tb-lbl">1 · מי התורם?</p>
        <input class="tb-search" data-q placeholder="שם או טלפון…" value="${h(st.q || '')}" autocomplete="off">
        <div class="tb-res">${st.who ? `<div class="tb-r on"><b>${h(nameOf(st.who))}</b><small>${h(st.who.address || '')} ${h(st.who.city || '')}</small></div>`
    : results(st.q || '').map((x) => `<button type="button" class="tb-r" data-id="${h(x.contact_id)}"><b>${h(nameOf(x))}${invIds.has(String(x.contact_id)) ? ' ✉' : ''}</b><small>${h(x.address || '')} ${h(x.city || '')}</small></button>`).join('')}</div>
        ${st.who ? '<button type="button" class="tb-new" data-clear>✕ תורם אחר</button>' : `<button type="button" class="tb-new" data-ext>+ לא נמצא? לרשום בשם בלבד${st.q ? `: "${h(st.q)}"` : ''}</button>`}
        ${st.ext && !st.who ? `<div class="tb-r on"><b>${h(st.ext)}</b><small>לא באנשי קשר</small></div>` : ''}
        <div class="tb-split"><div><p class="tb-lbl">2 · סכום</p><div class="tb-amt">${amt ? money(amt) : '$'}</div>
          <div class="tb-quick">${quick.map((v) => `<button type="button" data-qa="${v}">${v.toLocaleString()}</button>`).join('')}</div></div>
          <div class="tb-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '00'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div></div>
        <p class="tb-lbl">3 · אופן התשלום</p>
        <div class="tb-meth">${methods.map((m) => `<button type="button" data-m="${h(m)}" class="${st.method === m ? 'on' : ''}">${h(m)}</button>`).join('')}</div>
        ${st.method === 'צ\'ק' ? `<input class="tb-ded" data-chk placeholder="מספר צ'ק" value="${h(st.check)}" inputmode="numeric">` : ''}
        <input class="tb-ded" data-ded placeholder="הקדשה / הערה (לא חובה)" value="${h(st.ded)}">
        <button type="button" class="tb-go" data-go${amt && who ? '' : ' disabled'}>✓ לרשום ${amt ? money(amt) : ''}${who ? ` — ${h(who)}` : ''}</button>
      </div>
      <div class="tb-card tb-feed"><p class="tb-lbl">נרשם עכשיו בטאבלט</p>
        ${feed.map((d, i) => `<div class="tb-it"><div><b>${h(d._name)}</b><small>${isTrue(d.is_paid) ? h(d.payment_method) : '<span class="tb-pl">הבטחה</span>'}${d.check_number ? ` #${h(d.check_number)}` : ''}${d.dedication_text ? ` · ${h(d.dedication_text)}` : ''}</small></div><div><span class="tb-a">${money(d.amount_usd)}</span><button type="button" class="tb-u" data-undo="${i}">↶ ביטול</button></div></div>`).join('') || '<p class="muted">עדיין לא נרשם כלום</p>'}
        <div class="tb-sum"><div>נגבה בטאבלט<b>${money(paidNow)}</b></div><div>הבטחות<b>${money(pledged)}</b></div></div>
      </div></div>`;
    const q = $('[data-q]', el);
    if (st.focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); st.focusQ = false; }
  };
  const exit = () => { document.body.classList.remove('tb-open'); try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ } el.remove(); after(); };
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) { st.q = e.target.value; st.who = null; st.ext = ''; st.focusQ = true; draw(); }
    if (e.target.matches('[data-ded]')) st.ded = e.target.value;
    if (e.target.matches('[data-chk]')) st.check = e.target.value;
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x !== undefined) { exit(); return; }
    if (b.dataset.id) { st.who = state.contacts.find((x) => String(x.contact_id) === b.dataset.id); st.ext = ''; draw(); return; }
    if (b.dataset.clear !== undefined) { st.who = null; st.q = ''; st.focusQ = true; draw(); return; }
    if (b.dataset.ext !== undefined) { const n = (st.q || '').trim() || prompt('שם התורם:'); if (n) { st.ext = n.trim(); st.who = null; draw(); } return; }
    if (b.dataset.qa) { st.amt = b.dataset.qa; draw(); return; }
    if (b.dataset.k) { const k = b.dataset.k; st.amt = k === '⌫' ? st.amt.slice(0, -1) : (st.amt + k).replace(/^0+/, '').slice(0, 7); draw(); return; }
    if (b.dataset.m) { st.method = b.dataset.m; draw(); return; }
    if (b.dataset.undo !== undefined) {
      const d = feed[Number(b.dataset.undo)];
      if (!confirm(`לבטל ${money(d.amount_usd)} של ${d._name}?`)) return;
      try {
        if (state.isAdmin) await deleteDonation(d);
        else { const { _name, ...rest } = d; await saveDonation({ ...rest, amount_usd: 0, event_note: `${d.event_note || ''} · בוטל בטאבלט (${d.amount_usd})`.trim() }); }
        feed.splice(Number(b.dataset.undo), 1); await loadAll(); draw(); toast('בוטל');
      } catch (err) { toast(`❌ ${err.message || err}`); }
      return;
    }
    if (b.dataset.go !== undefined) {
      const amt = Number(st.amt) || 0; if (!amt || !(st.who || st.ext)) return;
      const pledge = st.method === 'הבטחה'; const today = todayIso();
      const d = {
        contact_id: st.who ? Number(st.who.contact_id) : '', donor_name: st.who ? '' : st.ext, date: today, hebrew_date: formatHebrew(toHebrew(today)),
        event_tags: c.event_tags || '', event_year: c.year || '', event_note: 'טאבלט', campaign: c.name, org,
        amount_usd: amt, is_paid: !pledge, paid_date: pledge ? '' : today, payment_method: pledge ? '' : st.method,
        check_number: st.method === 'צ\'ק' ? st.check.trim() : '', dedication_text: st.ded.trim(),
      };
      b.disabled = true; b.textContent = 'רושם…';
      try {
        d.donation_id = await saveDonation(d);
        d._name = st.who ? nameOf(st.who) : st.ext;
        feed.unshift(d);
        Object.assign(st, { who: null, ext: '', amt: '', ded: '', check: '', q: '', method: methods[0], focusQ: true });
        await loadAll(); draw(); toast(`✅ נרשם ${money(amt)} — ${d._name}`);
      } catch (err) { toast(`❌ ${err.message || err}`); draw(); }
    }
  });
  st.focusQ = true;
  draw();
}
