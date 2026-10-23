// 📸 תמונות מאירועים: א ווידעא פון א שמחה → איין בילד פון יעדן מענטש (די בעסטע), אן כפילויות.
// אלעס לויפט אינעם בלעטערער (דער ווידעא בלייבט אויפן קאמפיוטער) — מיט דער פרייער ביבליאטעק Human (vladmandic).
// שלב 1: אירועים + סריקה. די געפינענע פנים ווערן געהאלטן אויפן קאמפיוטער (IndexedDB) ביז מען זיי לייגט ארויף (שלב 2).
// לשונית FaceEvents: event_id, name, date, mode ('normal' | 'fast'), note
import { state, saveRecord, deleteRecord } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h } from './util.js';

const HUMAN_VER = '3.3.6';
const CDN = `https://cdn.jsdelivr.net/npm/@vladmandic/human@${HUMAN_VER}`;
let ui = null;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function initFaces(helpers) { ui = helpers; }

const cur = { eventId: '', tab: 'scan' };
const today = () => new Date().toISOString().slice(0, 10);
export const faceEvents = () => [...(state.faceEvents || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.event_id) - Number(a.event_id));
const eventById = (id) => (state.faceEvents || []).find((e) => String(e.event_id) === String(id));

// ---------- אפגעהיט אויפן קאמפיוטער (IndexedDB) ----------
const DB = 'khal-faces';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('scan');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function loadScan(id) {
  try {
    const db = await idb();
    return await new Promise((res) => { const q = db.transaction('scan').objectStore('scan').get(String(id)); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  } catch { return null; }
}
async function saveScan(id, data) {
  try {
    const db = await idb();
    await new Promise((res) => { const tx = db.transaction('scan', 'readwrite'); tx.objectStore('scan').put(data, String(id)); tx.oncomplete = res; tx.onerror = res; });
  } catch { /* פול / נישט ערלויבט — מ'ארבעט ווייטער נאר אין זכרון */ }
}
const emptyScan = () => ({ v: 1, files: {}, clusters: [], nextId: 1 });

// ---------- דער מאטאר (Human) ----------
let humanP = null;
function loadHuman() {
  if (!humanP) {
    humanP = (async () => {
      const mod = await import(/* @vite-ignore */ `${CDN}/dist/human.esm.js`);
      const Human = mod.Human || mod.default;
      const human = new Human({
        modelBasePath: `${CDN}/models/`,
        backend: 'webgl',
        wasmPath: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/',
        cacheSensitivity: 0,
        filter: { enabled: false },
        face: {
          enabled: true,
          detector: { rotation: true, maxDetected: 60, minConfidence: 0.45, minSize: 0, skipFrames: 0, skipTime: 0, return: false },
          mesh: { enabled: true },
          iris: { enabled: false },
          description: { enabled: true, skipFrames: 0, skipTime: 0 },
          emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false },
        },
        body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false },
      });
      await human.load();
      await human.warmup();
      return human;
    })();
    humanP.catch(() => { humanP = null; });
  }
  return humanP;
}

// ---------- א בילד פון פנים, מיט א ביסל ראנד ----------
function cropFace(video, box, size = 260, W = video.videoWidth || video.width, H = video.videoHeight || video.height) {
  const [x, y, w, hh] = box;
  const pad = 0.45;
  const side = Math.max(w, hh) * (1 + pad * 2);
  const cx = x + w / 2; const cy = y + hh / 2 - hh * 0.05;
  const sx = Math.max(0, cx - side / 2); const sy = Math.max(0, cy - side / 2);
  const sw = Math.min(W - sx, side); const sh = Math.min(H - sy, side);
  const c = document.createElement('canvas');
  const k = size / Math.max(sw, sh);
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const g = c.getContext('2d');
  g.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { c, g };
}
/** ווי שארף (Laplacian variance אויף א קליינעם גרויען בילד) */
function sharpness(g, w, hh) {
  const d = g.getImageData(0, 0, w, hh).data;
  const gray = new Float32Array(w * hh);
  for (let i = 0; i < w * hh; i += 1) gray[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  let sum = 0; let sum2 = 0; let n = 0;
  for (let yy = 1; yy < hh - 1; yy += 2) {
    for (let xx = 1; xx < w - 1; xx += 2) {
      const i = yy * w + xx;
      const l = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += l; sum2 += l * l; n += 1;
    }
  }
  return n ? sum2 / n - (sum / n) ** 2 : 0;
}

// ---------- סריקה ----------
const SCAN = { running: false, stop: false };
const SIM_SAME = 0.6; // מער ווי דאס = דער זעלבער מענטש
const KEEP = 3; // וויפל בילדער פון יעדן מענטש
const fmtT = (s) => { const x = Math.max(0, Math.floor(s)); return `${Math.floor(x / 3600) ? `${Math.floor(x / 3600)}:` : ''}${String(Math.floor((x % 3600) / 60)).padStart(Math.floor(x / 3600) ? 2 : 1, '0')}:${String(x % 60).padStart(2, '0')}`; };
const fileKey = (f) => `${f.name}|${f.size}`;

function addFace(scan, human, emb, shot) {
  // צו וועלכן מענטש? (דער בעסטער ענלעכקייט צו איינע פון זיינע בילדער)
  let best = null; let bestSim = 0;
  for (const cl of scan.clusters) {
    for (const e of cl.embs) {
      const s = human.match.similarity(emb, e);
      if (s > bestSim) { bestSim = s; best = cl; }
    }
  }
  if (best && bestSim >= SIM_SAME) {
    best.count += 1;
    if (best.embs.length < 6) best.embs.push(emb);
    best.shots.push(shot);
    best.shots.sort((a, b) => b.q - a.q);
    best.shots = best.shots.slice(0, KEEP);
    return false;
  }
  scan.clusters.push({ id: scan.nextId++, embs: [emb], shots: [shot], count: 1, first: shot.t, file: shot.file });
  return true;
}

const isImage = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(f.name);
/** די פנים פון איין בילד (א פריים פונעם ווידעא אדער א פאטא) → צוגעלייגט צו די מענטשן. מחזיר וויפל נייע */
async function facesFrom(human, scan, src, opts, where) {
  const r = await human.detect(src);
  let added = 0;
  for (const f of r.face || []) {
    if (!f.embedding || !f.embedding.length) continue;
    const [, , w, hh] = f.box;
    if (Math.min(w, hh) < opts.minPx) continue;
    const yaw = Math.abs(f.rotation?.angle?.yaw || 0); const pitch = Math.abs(f.rotation?.angle?.pitch || 0);
    if (yaw > 0.9) continue; // גאר פון דער זייט — נישט צו דערקענען
    const { c, g } = cropFace(src, f.box);
    const sharp = sharpness(g, c.width, c.height);
    const q = Math.sqrt(w * hh) * (f.score || 0.5) * Math.max(0.2, 1 - yaw) * Math.max(0.3, 1 - pitch) * Math.min(2, 0.5 + Math.log10(1 + sharp) / 2);
    const shot = { q, img: c.toDataURL('image/jpeg', 0.85), w: Math.round(w), ...where };
    if (addFace(scan, human, Float32Array.from(f.embedding), shot)) added += 1;
  }
  return added;
}
/** א פאטא → א canvas (מיט דער ריכטיגער ריכטונג; גאר גרויסע ווערן קלענער) */
async function imageCanvas(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

async function runScan(ev, files, opts) {
  if (SCAN.running) return;
  const box = $('#fc-scanbox');
  const say = (msg, kind = '') => { const m = $('#fc-msg', box); if (m) { m.textContent = msg; m.className = `fc-msg ${kind}`; } };
  SCAN.running = true; SCAN.stop = false;
  renderScanButtons();
  let scan = (await loadScan(ev.event_id)) || emptyScan();
  try {
    say(t('fcLoadingEngine'));
    const human = await loadHuman();
    say(t('fcScanning'));
    // קודם די פאטאס (שנעלער), דערנאך די ווידעאס
    const imgs = files.filter(isImage);
    const vids = files.filter((f) => !isImage(f));
    if (imgs.length) {
      const t0 = performance.now(); let n = 0; let bad = 0;
      const todo = imgs.filter((f) => !(scan.files[fileKey(f)]?.done >= 1));
      for (const file of todo) {
        if (SCAN.stop) break;
        const key = fileKey(file);
        scan.files[key] = { name: file.name, size: file.size, done: 0, dur: 1, img: true };
        let cv = null;
        // eslint-disable-next-line no-await-in-loop
        try { cv = await imageCanvas(file); } catch { cv = null; }
        if (!cv) { bad += 1; scan.files[key].bad = true; scan.files[key].done = 1; continue; }
        // eslint-disable-next-line no-await-in-loop
        const added = await facesFrom(human, scan, cv, opts, { file: file.name, t: -1 });
        scan.files[key].done = 1;
        n += 1;
        const per = (performance.now() - t0) / 1000 / n;
        progressImgs(scan, imgs.length - todo.length + n, imgs.length, per * (todo.length - n));
        if (added) liveGrid(scan);
        // eslint-disable-next-line no-await-in-loop
        if (n % 10 === 0) await saveScan(ev.event_id, scan);
      }
      if (bad) say(t('fcBadImgs', { n: bad }), 'err');
      await saveScan(ev.event_id, scan);
    }
    for (const file of vids) {
      if (SCAN.stop) break;
      const key = fileKey(file);
      const rec = scan.files[key] || { name: file.name, size: file.size, done: 0, dur: 0 };
      scan.files[key] = rec;
      const video = document.createElement('video');
      video.muted = true; video.preload = 'auto'; video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;
      const ok = await new Promise((res) => {
        video.onloadeddata = () => res(true);
        video.onerror = () => res(false);
        setTimeout(() => res(video.readyState >= 2), 15000);
      });
      if (!ok || !video.videoWidth) { say(t('fcBadFormat', { name: file.name }), 'err'); URL.revokeObjectURL(url); continue; }
      rec.dur = video.duration || 0;
      const step = opts.step;
      const t0 = performance.now(); const startAt = rec.done;
      let n = 0;
      for (let tt = rec.done; tt < rec.dur; tt += step) {
        if (SCAN.stop) break;
        video.currentTime = tt;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => { const done = () => { video.removeEventListener('seeked', done); res(); }; video.addEventListener('seeked', done); setTimeout(done, 4000); });
        // eslint-disable-next-line no-await-in-loop
        const added = await facesFrom(human, scan, video, opts, { file: file.name, t: tt });
        rec.done = Math.min(rec.dur, tt + step);
        n += 1;
        const elapsed = (performance.now() - t0) / 1000;
        const per = elapsed / Math.max(0.001, rec.done - startAt);
        const left = per * (rec.dur - rec.done);
        progress(scan, rec, left);
        if (added) liveGrid(scan);
        // eslint-disable-next-line no-await-in-loop
        if (n % 15 === 0) await saveScan(ev.event_id, scan);
      }
      await saveScan(ev.event_id, scan);
      URL.revokeObjectURL(url);
    }
    say(SCAN.stop ? t('fcPaused') : t('fcDone', { n: scan.clusters.length }), SCAN.stop ? '' : 'ok');
  } catch (err) {
    say(`${t('fcEngineErr')} ${err?.message || err}`, 'err');
  } finally {
    await saveScan(ev.event_id, scan);
    SCAN.running = false;
    renderScanButtons();
    liveGrid(scan);
    filesList(scan);
  }
}

function progressImgs(scan, done, total, left) {
  const box = $('#fc-scanbox');
  if (!box) return;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#fc-bar > i', box).style.width = `${pct}%`;
  $('#fc-prog', box).textContent = `📷 ${t('fcImgsN', { n: done, total })} (${pct}%)${left > 1 ? ` · ${t('fcLeft', { t: fmtT(left) })}` : ''}`;
  $('#fc-count', box).textContent = t('fcPeopleN', { n: scan.clusters.length });
}
function progress(scan, rec, left) {
  const box = $('#fc-scanbox');
  if (!box) return;
  const pct = rec.dur ? Math.round((rec.done / rec.dur) * 100) : 0;
  $('#fc-bar > i', box).style.width = `${pct}%`;
  $('#fc-prog', box).textContent = `${rec.name} · ${fmtT(rec.done)} / ${fmtT(rec.dur)} (${pct}%)${left > 1 ? ` · ${t('fcLeft', { t: fmtT(left) })}` : ''}`;
  $('#fc-count', box).textContent = t('fcPeopleN', { n: scan.clusters.length });
}
function liveGrid(scan) {
  const g = $('#fc-live');
  if (!g) return;
  const list = [...scan.clusters].sort((a, b) => a.id - b.id);
  $('#fc-count') && ($('#fc-count').textContent = t('fcPeopleN', { n: list.length }));
  g.innerHTML = list.map((cl) => `<button type="button" class="fc-face" data-cl="${cl.id}" title="${h(t('fcSeenN', { n: cl.count }))}">
    <img src="${cl.shots[0].img}" alt=""><span class="fc-n">${cl.count}×</span></button>`).join('');
}
function filesList(scan) {
  const box = $('#fc-files');
  if (!box) return;
  const all = Object.values(scan.files);
  const im = all.filter((f) => f.img);
  const fs = all.filter((f) => !f.img);
  const imLine = im.length ? `<div class="fc-file"><span>📷 ${h(t('fcImgsN', { n: im.filter((f) => f.done >= 1).length, total: im.length }))}</span>${im.some((f) => f.bad) ? `<span class="muted small">⚠ ${h(t('fcBadImgs', { n: im.filter((f) => f.bad).length }))}</span>` : ''}</div>` : '';
  box.innerHTML = imLine + (fs.length ? fs.map((f) => {
    const pct = f.dur ? Math.round((f.done / f.dur) * 100) : 0;
    return `<div class="fc-file"><span>🎬 ${h(f.name)}</span><span class="muted small" dir="ltr">${(f.size / 1048576).toFixed(0)} MB · ${fmtT(f.dur)}</span><span class="fc-fpct ${pct >= 100 ? 'ok' : ''}">${pct >= 100 ? '✓' : `${pct}%`}</span></div>`;
  }).join('') : '');
}
function renderScanButtons() {
  const go = $('#fc-go'); const stop = $('#fc-stop');
  if (go) go.hidden = SCAN.running;
  if (stop) stop.hidden = !SCAN.running;
  const pick = $('#fc-pick'); if (pick) pick.disabled = SCAN.running;
}

// ---------- בלעטער ----------
export function openFaces() { cur.eventId = ''; ui.showView('faces'); }
export function renderFaces() {
  const main = $('#faces-main');
  if (!main) return;
  const ev = cur.eventId ? eventById(cur.eventId) : null;
  if (!ev) { renderEventsPage(main); return; }
  renderEventPage(main, ev);
}

function renderEventsPage(main) {
  const evs = faceEvents();
  main.innerHTML = `<div class="sc-head fc-head"><span class="sc-logo-ph">📸</span>
      <div><h1>${h(t('fcTitle'))}</h1><p class="muted small">${h(t('fcSub'))}</p></div>
      <span class="spacer"></span><button type="button" class="btn" id="fc-back">← ${h(t('lobbyBack'))}</button></div>
    <div class="fc-bar"><button type="button" class="btn primary" id="fc-new">➕ ${h(t('fcNewEvent'))}</button></div>
    ${evs.length ? `<div class="fc-events">${evs.map((e) => `<button type="button" class="fc-ev" data-ev="${h(e.event_id)}">
        <b>${h(e.name)}</b><span class="muted small" dir="ltr">${h(e.date || '')}</span>
        <span class="fc-mode">${e.mode === 'fast' ? `⚡ ${h(t('fcModeFast'))}` : `🔒 ${h(t('fcModeNormal'))}`}</span></button>`).join('')}</div>`
    : `<p class="muted">${h(t('fcNoEvents'))}</p>`}`;
  $('#fc-back').onclick = () => ui.showView('lobby');
  $('#fc-new').onclick = () => eventDialog({});
  main.onclick = (e) => { const b = e.target.closest('[data-ev]'); if (b) { cur.eventId = b.dataset.ev; cur.tab = 'scan'; renderFaces(); } };
}

function eventDialog(e0) {
  const isNew = !e0.event_id;
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet fc-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>📸 ${h(isNew ? t('fcNewEvent') : t('fcEditEvent'))}</h2>
    <form autocomplete="off">
      <label class="wide">${h(t('fcEvName'))} *<input name="name" required dir="rtl" value="${h(e0.name || '')}" placeholder="${h(t('fcEvNamePh'))}"></label>
      <label>${h(t('dateLegend'))}<input name="date" type="date" value="${h(e0.date || today())}"></label>
      <fieldset class="fc-modes"><legend>${h(t('fcModeQ'))}</legend>
        <label class="check"><input type="radio" name="mode" value="normal"${e0.mode !== 'fast' ? ' checked' : ''}> 🔒 <b>${h(t('fcModeNormal'))}</b> — ${h(t('fcModeNormalTxt'))}</label>
        <label class="check"><input type="radio" name="mode" value="fast"${e0.mode === 'fast' ? ' checked' : ''}> ⚡ <b>${h(t('fcModeFast'))}</b> — ${h(t('fcModeFastTxt'))}</label>
      </fieldset>
      <div class="actions">${isNew ? '' : `<button type="button" class="btn danger" id="fc-del">🗑 ${h(t('deleteBtn'))}</button>`}<span class="spacer"></span>
        <button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button>
        <button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form>`;
  const form = $('form', dlg);
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  $('#fc-del', dlg)?.addEventListener('click', async () => {
    if (!confirm(t('fcDelAsk', { name: e0.name }))) return;
    try {
      await deleteRecord('FaceEvents', 'event_id', e0);
      state.faceEvents = state.faceEvents.filter((x) => x !== e0);
      await saveScan(e0.event_id, emptyScan());
      dlg.close(); cur.eventId = ''; renderFaces();
    } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const rec = { ...e0, name: form.elements.name.value.trim(), date: form.elements.date.value, mode: form.elements.mode.value };
    if (!rec.name) return;
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      const id = await saveRecord('FaceEvents', 'event_id', rec);
      const i = state.faceEvents.findIndex((x) => String(x.event_id) === String(id));
      if (i >= 0) state.faceEvents[i] = { ...rec, event_id: id }; else state.faceEvents.push({ ...rec, event_id: id });
      dlg.close(); cur.eventId = String(id); renderFaces();
    } catch (err) { btn.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
  };
  dlg.showModal();
  form.elements.name.focus();
}

function renderEventPage(main, ev) {
  const tabs = [['scan', `① ${t('fcTabScan')}`], ['tag', `② ${t('fcTabTag')}`], ['people', `③ ${t('fcTabPeople')}`]];
  main.innerHTML = `<div class="sc-head fc-head"><span class="sc-logo-ph">📸</span>
      <div><h1>${h(ev.name)}</h1><p class="muted small"><span dir="ltr">${h(ev.date || '')}</span> · ${ev.mode === 'fast' ? `⚡ ${h(t('fcModeFast'))}` : `🔒 ${h(t('fcModeNormal'))}`}
        · <button type="button" class="linkish" id="fc-edit">✎ ${h(t('fcEditEvent'))}</button></p></div>
      <span class="spacer"></span><button type="button" class="btn" id="fc-evback">← ${h(t('fcAllEvents'))}</button></div>
    <nav class="fc-tabs">${tabs.map(([k, l]) => `<button type="button" data-ftab="${k}" class="${cur.tab === k ? 'on' : ''}">${h(l)}</button>`).join('')}</nav>
    <div id="fc-pane"></div>`;
  $('#fc-evback').onclick = () => { if (SCAN.running && !confirm(t('fcLeaveScan'))) return; SCAN.stop = true; cur.eventId = ''; renderFaces(); };
  $('#fc-edit').onclick = () => eventDialog(ev);
  $$('[data-ftab]', main).forEach((b) => { b.onclick = () => { cur.tab = b.dataset.ftab; renderEventPage(main, ev); }; });
  const pane = $('#fc-pane');
  if (cur.tab === 'scan') scanPane(pane, ev);
  else pane.innerHTML = `<div class="fc-soon"><p>🚧 ${h(t('fcSoon'))}</p></div>`;
}

async function scanPane(pane, ev) {
  pane.innerHTML = `<div id="fc-scanbox" class="fc-scan">
      <p class="muted small">${h(t('fcScanHint2'))}</p>
      <div class="fc-row">
        <label class="btn primary" id="fc-pickl">🎬📷 ${h(t('fcPick2'))}<input type="file" id="fc-pick" accept="video/*,image/*,.mp4,.mov,.webm,.m4v,.jpg,.jpeg,.png,.heic" multiple hidden></label>
        <label>${h(t('fcStep'))} <select id="fc-step"><option value="1">${h(t('fcStep1'))}</option><option value="0.5">${h(t('fcStep05'))}</option><option value="2">${h(t('fcStep2'))}</option></select></label>
        <label>${h(t('fcMin'))} <select id="fc-min"><option value="40">${h(t('fcMinN'))}</option><option value="28">${h(t('fcMinS'))}</option><option value="64">${h(t('fcMinL'))}</option></select></label>
      </div>
      <div id="fc-chosen" class="muted small"></div>
      <div class="fc-row">
        <button type="button" class="btn primary" id="fc-go" disabled>▶ ${h(t('fcStart'))}</button>
        <button type="button" class="btn" id="fc-stop" hidden>⏸ ${h(t('fcStop'))}</button>
        <span class="spacer"></span>
        <button type="button" class="linkish" id="fc-reset">🗑 ${h(t('fcReset'))}</button>
      </div>
      <div id="fc-msg" class="fc-msg"></div>
      <div id="fc-bar" class="fc-progress"><i></i></div>
      <div class="fc-row"><span id="fc-prog" class="muted small"></span><span class="spacer"></span><b id="fc-count"></b></div>
      <div id="fc-files"></div>
      <div id="fc-live" class="fc-live"></div>
    </div>`;
  let chosen = [];
  const scan = (await loadScan(ev.event_id)) || emptyScan();
  filesList(scan); liveGrid(scan);
  $('#fc-count').textContent = t('fcPeopleN', { n: scan.clusters.length });
  renderScanButtons();
  $('#fc-pick').onchange = (e) => {
    chosen = [...e.target.files];
    const ni = chosen.filter(isImage).length; const vs = chosen.filter((f) => !isImage(f));
    $('#fc-chosen').textContent = [ni ? `📷 ${t('fcImgsChosen', { n: ni })}` : '', ...vs.map((f) => `🎬 ${f.name} (${(f.size / 1048576).toFixed(0)} MB)`)].filter(Boolean).join(' · ');
    $('#fc-go').disabled = !chosen.length;
  };
  $('#fc-go').onclick = () => {
    if (!chosen.length) { $('#fc-pick').click(); return; }
    runScan(ev, chosen, { step: Number($('#fc-step').value) || 1, minPx: Number($('#fc-min').value) || 40 });
  };
  $('#fc-stop').onclick = () => { SCAN.stop = true; };
  $('#fc-reset').onclick = async () => {
    if (SCAN.running) return;
    if (!confirm(t('fcResetAsk'))) return;
    await saveScan(ev.event_id, emptyScan());
    scanPane(pane, ev);
  };
  $('#fc-live').onclick = (e) => {
    const b = e.target.closest('[data-cl]');
    if (!b) return;
    loadScan(ev.event_id).then((s) => { const cl = (s || scan).clusters.find((x) => String(x.id) === b.dataset.cl); if (cl) clusterDialog(cl); });
  };
}

function clusterDialog(cl) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet fc-cldlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>${h(t('fcSeenN', { n: cl.count }))}</h2>
    <div class="fc-shots">${cl.shots.map((s) => `<figure><img src="${s.img}" alt=""><figcaption class="muted small" dir="ltr">${s.t >= 0 ? '🎬' : '📷'} ${h(s.file)}${s.t >= 0 ? ` · ${fmtT(s.t)}` : ''}</figcaption></figure>`).join('')}</div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('close'))}</button></div>`;
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  dlg.showModal();
}
