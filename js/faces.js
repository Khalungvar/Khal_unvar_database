// 📸 תמונות מאירועים: א ווידעא פון א שמחה → איין בילד פון יעדן מענטש (די בעסטע), אן כפילויות.
// אלעס לויפט אינעם בלעטערער (דער ווידעא בלייבט אויפן קאמפיוטער) — מיט דער פרייער ביבליאטעק Human (vladmandic).
// שלב 1: אירועים + סריקה. די געפינענע פנים ווערן געהאלטן אויפן קאמפיוטער (IndexedDB) ביז מען זיי לייגט ארויף (שלב 2).
// לשונית FaceEvents: event_id, name, date, mode ('normal' | 'fast'), note
import { state, saveRecord, deleteRecord, loadAll, loadFaceShots, appendFaceShots, updateFaceShot, clearFaceShots, loadAllPhotos, savePhoto, saveContact, loadFaceLearn, saveFaceLearn } from './data.js';
import { t } from './i18n.js';
import { escapeHtml as h, nowStamp } from './util.js';
import { storeImage, fetchImages, imageOf, isDrv } from './images.js';
import { downloadXlsx } from './excel.js';
import { toHebrew, hebrewNumber, isoToHebrewText } from './hebdate.js';
import { submitRequest } from './requests.js';
import { hasSavedSession } from './google.js';

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
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => { ['scan', 'cardemb'].forEach((n) => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); }); };
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
const emptyScan = () => ({ v: 1, files: {}, clusters: [], nextId: 1, sid: Date.now().toString(36) });
// די סריקה וואס לויפט יעצט (דאס ארויפלייגן ניצט די זעלבע, אז מ'זאל זיך נישט איבערשרייבן)
const LIVE = { eventId: '', scan: null };

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
  PILL.ev = ev;
  renderScanButtons();
  let scan = (await loadScan(ev.event_id)) || emptyScan();
  if (!scan.sid) scan.sid = Date.now().toString(36);
  LIVE.eventId = String(ev.event_id); LIVE.scan = scan;
  // בשעת'ן סקענען: די נייע פנים גייען שוין ארויף (מ'קען אנהייבן דערקענען פאר'ן ענדע)
  const quiet = () => {};
  const bgUpload = () => { if (!uploading) uploadScan(ev, quiet, { bg: true }); };
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
        if (n % 10 === 0) { await saveScan(ev.event_id, scan); bgUpload(); }
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
        if (n % 60 === 0) bgUpload();
      }
      await saveScan(ev.event_id, scan);
      URL.revokeObjectURL(url);
    }
    say(SCAN.stop ? t('fcPaused') : t('fcDone', { n: scan.clusters.length }), SCAN.stop ? '' : 'ok');
    await saveScan(ev.event_id, scan);
    // ארויפלייגן וואס איז נאך געבליבן (אויך ביי אפשטעלן — אזוי קען מען שוין דערקענען)
    while (uploading) await new Promise((r) => setTimeout(r, 300)); // eslint-disable-line no-await-in-loop
    const ok = await uploadScan(ev, say, { final: true });
    // נישט ארויף (למשל די כניסה צו גוגל איז אויסגעלאפן ביינאכט) — ס'וועט פרובירן אליין ווען מ'קומט צוריק
    if (!ok) { pendingUp = ev; say(t('fcUpLater'), 'err'); }
    // גלייך צום דערקענען
    if (ok && !SCAN.stop && String(cur.eventId) === String(ev.event_id) && cur.tab === 'scan') {
      cur.tab = 'tag';
      const main = $('#faces-main');
      if (main) renderEventPage(main, ev);
    }
  } catch (err) {
    say(`${t('fcEngineErr')} ${err?.message || err}`, 'err');
  } finally {
    await saveScan(ev.event_id, scan);
    SCAN.running = false;
    LIVE.eventId = ''; LIVE.scan = null;
    pillUpdate(100, '');
    renderScanButtons();
    liveGrid(scan);
    filesList(scan);
  }
}

// ---------- א קליין פענצטערל אויף יעדן בלאט בשעת'ן סקענען ----------
const PILL = { ev: null, pct: 0, text: '' };
function pillUpdate(pct, text) {
  PILL.pct = pct; PILL.text = text;
  let el = document.getElementById('fc-pill');
  if (!SCAN.running) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.id = 'fc-pill'; el.type = 'button'; el.className = 'fc-pill';
    el.onclick = () => { if (!PILL.ev) return; cur.eventId = String(PILL.ev.event_id); cur.tab = 'scan'; ui.showView('faces'); };
    document.body.append(el);
  }
  el.innerHTML = `📸 <b>${pct}%</b> <span>${h(text)}</span><i style="width:${pct}%"></i>`;
  // אויפן בלאט פון דער סריקה אליין — נישט נויטיג
  el.hidden = !document.querySelector('.view[data-view="faces"]')?.hidden && String(cur.eventId) === String(PILL.ev?.event_id) && cur.tab === 'scan';
}
window.addEventListener('beforeunload', (e) => { if (SCAN.running) { e.preventDefault(); e.returnValue = ''; } });

function progressImgs(scan, done, total, left) {
  pillUpdate(total ? Math.round((done / total) * 100) : 0, t('fcImgsN', { n: done, total }));
  const box = $('#fc-scanbox');
  if (!box) return;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#fc-bar > i', box).style.width = `${pct}%`;
  $('#fc-prog', box).textContent = `📷 ${t('fcImgsN', { n: done, total })} (${pct}%)${left > 1 ? ` · ${t('fcLeft', { t: fmtT(left) })}` : ''}`;
  $('#fc-count', box).textContent = t('fcPeopleN', { n: scan.clusters.length });
}
function progress(scan, rec, left) {
  pillUpdate(rec.dur ? Math.round((rec.done / rec.dur) * 100) : 0, `${fmtT(rec.done)} / ${fmtT(rec.dur)}`);
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
    ${evs.length ? yearGroups(evs).map(([y, list]) => `<h3 class="fc-year">${h(y ? hebrewNumber(y % 1000) : t('fcNoDate'))}</h3>
      <div class="fc-events">${list.map((e) => `<button type="button" class="fc-ev" data-ev="${h(e.event_id)}">
        <b>${h(e.name)}</b><span class="muted small">${h(e.date ? isoToHebrewText(e.date) || '' : '')} <span dir="ltr">· ${h(e.date || '')}</span></span>
        <span class="fc-mode">${e.mode === 'fast' ? `⚡ ${h(t('fcModeFast'))}` : `🔒 ${h(t('fcModeNormal'))}`}</span>
        <span class="fc-evbar" data-evbar="${h(e.event_id)}"><span class="muted small">…</span></span></button>`).join('')}</div>`).join('')
    : `<p class="muted">${h(t('fcNoEvents'))}</p>`}`;
  $('#fc-back').onclick = () => ui.showView('lobby');
  $('#fc-new').onclick = () => eventDialog({});
  main.onclick = (e) => { const b = e.target.closest('[data-ev]'); if (b) { cur.eventId = b.dataset.ev; cur.tab = 'scan'; renderFaces(); } };
  // פאר יעדן אירוע: א פאס — וויפל זענען באשטעטיגט, וויפל ווארטן נאך
  evs.forEach(async (e) => {
    const el = () => document.querySelector(`[data-evbar="${CSS.escape(String(e.event_id))}"]`);
    if (Number(e.n_faces)) { el().innerHTML = barHtml(Number(e.n_faces), Number(e.n_ok) || 0, Number(e.n_skip) || 0); return; }
    const sc = await loadScan(e.event_id);
    if (el()) el().innerHTML = statusBar(sc);
  });
}
/** די אירועים לויט די אידישע יארן (די נייסטע פריער) → [[יאר, אירועים]] */
function yearGroups(evs) {
  const m = new Map();
  evs.forEach((e) => { const y = e.date ? toHebrew(e.date)?.y || 0 : 0; if (!m.has(y)) m.set(y, []); m.get(y).push(e); });
  return [...m].sort((a, b) => (b[0] || -1) - (a[0] || -1));
}
function barHtml(total, ok, skip) {
  if (!total) return `<span class="muted small">${h(t('fcNotScanned'))}</span>`;
  const wait = Math.max(0, total - ok - skip);
  const pc = (n) => `${(n / total) * 100}%`;
  return `<span class="fc-sbar"><i class="ok" style="width:${pc(ok)}"></i><i class="skip" style="width:${pc(skip)}"></i></span>
    <span class="fc-stxt small"><b class="ok">✓ ${h(t('fcApprovedN', { n: ok }))}</b> · <b class="wait">⏳ ${h(t('fcWaitN', { n: wait }))}</b>${skip ? ` · <span class="muted">${h(t('fcSkipN', { n: skip }))}</span>` : ''}</span>`;
}
/** ✓ באשטעטיגט · ⏳ ווארטן · ⤼ איבערגעשפרונגען (status פונעם מענטש: 'ok' | 'auto' | 'skip' | '') */
function statusBar(sc) {
  const cls = sc?.clusters || [];
  if (!cls.length) return `<span class="muted small">${h(t('fcNotScanned'))}</span>`;
  const ok = cls.filter((c) => c.status === 'ok' || c.status === 'auto').length;
  const skip = cls.filter((c) => c.status === 'skip').length;
  const wait = cls.length - ok - skip;
  const pc = (n) => `${(n / cls.length) * 100}%`;
  return `<span class="fc-sbar"><i class="ok" style="width:${pc(ok)}"></i><i class="skip" style="width:${pc(skip)}"></i></span>
    <span class="fc-stxt small"><b class="ok">✓ ${h(t('fcApprovedN', { n: ok }))}</b> · <b class="wait">⏳ ${h(t('fcWaitN', { n: wait }))}</b>${skip ? ` · <span class="muted">${h(t('fcSkipN', { n: skip }))}</span>` : ''}</span>`;
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
    const n = Number(e0.n_faces) || 0; const ok = Number(e0.n_ok) || 0;
    if (!confirm(t('fcDelAsk2', { name: e0.name, n, ok }))) return;
    try {
      if (!state.isAdmin) {
        await submitRequest('delete_face_event', { event_id: String(e0.event_id) }, `${t('fcDelReq')}: ${e0.name}`);
        ui.toast(t('bkCancelReq')); dlg.close(); return;
      }
      await deleteFaceEvent(e0.event_id);
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
  // די סריקה לויפט ווייטער אויך ווען מ'גייט צו אנדערע בלעטער (א קליין פענצטערל ווייזט וויפל)
  $('#fc-evback').onclick = () => { cur.eventId = ''; renderFaces(); };
  $('#fc-edit').onclick = () => eventDialog(ev);
  $$('[data-ftab]', main).forEach((b) => { b.onclick = () => { cur.tab = b.dataset.ftab; renderEventPage(main, ev); }; });
  const pane = $('#fc-pane');
  if (cur.tab === 'scan') scanPane(pane, ev);
  else if (cur.tab === 'tag') tagPane(pane, ev);
  else peoplePane(pane, ev);
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
        <button type="button" class="btn" id="fc-up" hidden>📤 <span></span></button>
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
  upButton(scan);
  // נאך א ריענון / ווען דער קאמפיוטער איז אויסגעלאשן: וואס איז נאך נישט פארטיג
  const unfinished = Object.values(scan.files).filter((f) => !f.img && f.dur && f.done < f.dur);
  const imgsLeft = Object.values(scan.files).filter((f) => f.img && !(f.done >= 1)).length;
  if (!SCAN.running && (unfinished.length || imgsLeft)) {
    const m = $('#fc-msg'); m.className = 'fc-msg';
    m.textContent = t('fcResume', { names: [...unfinished.map((f) => f.name), ...(imgsLeft ? [t('fcImgsChosen', { n: imgsLeft })] : [])].join(', ') });
  } else if (SCAN.running && String(LIVE.eventId) === String(ev.event_id)) {
    $('#fc-msg').textContent = t('fcScanning');
  }
  $('#fc-up').onclick = () => uploadScan(ev, (m, k) => { const el = $('#fc-msg'); if (el) { el.textContent = m; el.className = `fc-msg ${k || ''}`; } });
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

// =====================================================================================
// שלב 2: ארויפלייגן → דערקענען → משתתפים
// =====================================================================================
const DIM = 1024;
/** קלענער: יעדע טביעה = 4 בייט (scale) + 1024 בייט (int8) — אזוי פאסן 10 טביעות אין איין צעל */
function q8Encode(arrs) {
  const dim = arrs[0]?.length || DIM;
  const buf = new ArrayBuffer(arrs.length * (4 + dim));
  const dv = new DataView(buf);
  arrs.forEach((a, k) => {
    const off = k * (4 + dim);
    let mx = 0; for (let i = 0; i < a.length; i += 1) mx = Math.max(mx, Math.abs(a[i]));
    const sc = mx / 127 || 1;
    dv.setFloat32(off, sc, true);
    for (let i = 0; i < dim; i += 1) dv.setInt8(off + 4 + i, Math.round((a[i] || 0) / sc));
  });
  const b = new Uint8Array(buf); let str = '';
  for (let i = 0; i < b.length; i += 0x8000) str += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `q8:${dim}:${btoa(str)}`;
}
function decodeEmbs(v) {
  const sv = String(v || '');
  if (!sv) return [];
  try {
    if (sv.startsWith('q8:')) {
      const [, d, b64] = sv.split(':');
      const dim = Number(d) || DIM;
      const bin = atob(b64 || '');
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
      const dv = new DataView(u.buffer);
      const out = [];
      for (let off = 0; off + 4 + dim <= u.length; off += 4 + dim) {
        const sc = dv.getFloat32(off, true);
        const f = new Float32Array(dim);
        for (let i = 0; i < dim; i += 1) f[i] = dv.getInt8(off + 4 + i) * sc;
        out.push(f);
      }
      return out;
    }
  } catch { return []; }
  return null;
}
const embCache = new WeakMap();
function embsOf(face) {
  if (embCache.has(face)) return embCache.get(face);
  const q = decodeEmbs(face.emb);
  if (q) { embCache.set(face, q); return q; }
  let out = [];
  try {
    const [d, b64] = String(face.emb || '').split(':');
    const dim = Number(d) || DIM;
    const bin = atob(b64 || '');
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
    const f = new Float32Array(u.buffer);
    for (let i = 0; i + dim <= f.length; i += dim) out.push(f.slice(i, i + dim));
  } catch { out = []; }
  embCache.set(face, out);
  return out;
}
/** א קלענער בילד פאר'ן ארויפלייגן */
function smallJpeg(dataUrl, size = 200, q = 0.82) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, size / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}
function upButton(scan) {
  const b = $('#fc-up');
  if (!b) return;
  // נאר ווען עפעס איז נישט ארויף (למשל א פראבלעם מיט דער פארבינדונג) — אנדערש גייט עס אליין
  const n = scan.clusters.filter((c) => !c.up).length;
  b.hidden = !n || SCAN.running || uploading;
  $('span', b).textContent = t('fcUpload', { n });
}
let uploading = false;
const faceIdOf = (ev, scan, cl) => `${ev.event_id}-${scan.sid || 's'}-${cl.id}`;
/** די געפינענע פנים → דרייב + לשונית FaceShots, אז אלע גבאים זאלן קענען דערקענען.
 *  bg = בשעת'ן סקענען (שטיל); final = צום סוף: אויך בילדער וואס זענען שפעטער געווארן בעסער ווערן דערהיינטיגט */
async function uploadScan(ev, say, { bg = false, final = false } = {}) {
  if (uploading) return false;
  uploading = true;
  const scan = LIVE.eventId === String(ev.event_id) && LIVE.scan ? LIVE.scan : ((await loadScan(ev.event_id)) || emptyScan());
  if (!scan.sid) scan.sid = Date.now().toString(36);
  const todo = scan.clusters.filter((c) => !c.up);
  let ok = true;
  try {
    let done = 0;
    for (let i = 0; i < todo.length; i += 8) {
      const part = todo.slice(i, i + 8);
      // eslint-disable-next-line no-await-in-loop
      const rows = await Promise.all(part.map(async (cl) => {
        const [a, b] = cl.shots;
        const img = await storeImage(await smallJpeg(a.img), 'face');
        const img2 = b ? await storeImage(await smallJpeg(b.img), 'face') : '';
        return {
          face_id: faceIdOf(ev, scan, cl), event_id: ev.event_id, img, img2, emb: q8Encode(cl.embs.slice(0, 3)),
          status: '', contact_id: '', src: `${a.file}|${a.t}`, count: cl.count, quality: Math.round(a.q),
        };
      }));
      // eslint-disable-next-line no-await-in-loop
      await appendFaceShots(rows);
      part.forEach((cl) => { cl.up = true; cl.upQ = cl.shots[0].q; cl.upN = cl.count; });
      done += part.length;
      if (!bg) say(t('fcUploading', { n: done, total: todo.length }));
      // eslint-disable-next-line no-await-in-loop
      await saveScan(ev.event_id, scan);
    }
    // צום סוף: א בעסערער בילד / מער מאל געזען → די שורה דערהיינטיגן (נאר ווען נאך נישט באשטעטיגט)
    let upd = 0;
    if (final) {
      const better = scan.clusters.filter((c) => c.up && (c.shots[0].q > (c.upQ || 0) * 1.25 || c.count !== c.upN));
      if (better.length) {
        await loadFaceShots();
        for (const cl of better) {
          const row = (state.faceShots || []).find((x) => String(x.face_id) === faceIdOf(ev, scan, cl));
          if (!row || row.status) { cl.upQ = cl.shots[0].q; cl.upN = cl.count; continue; }
          const imgChanged = cl.shots[0].q > (cl.upQ || 0) * 1.25;
          const [a, b] = cl.shots;
          // eslint-disable-next-line no-await-in-loop
          const patch = imgChanged ? { img: await storeImage(await smallJpeg(a.img), 'face'), img2: b ? await storeImage(await smallJpeg(b.img), 'face') : '', src: `${a.file}|${a.t}`, quality: Math.round(a.q), emb: q8Encode(cl.embs.slice(0, 3)) } : {};
          // eslint-disable-next-line no-await-in-loop
          await updateFaceShot({ ...row, ...patch, count: cl.count });
          cl.upQ = cl.shots[0].q; cl.upN = cl.count; upd += 1;
        }
        await saveScan(ev.event_id, scan);
      }
    }
    if (todo.length || upd) {
      await loadFaceShots();
      await syncEvent(ev);
      T.ready = false;
      if (!bg) say(t('fcUploaded', { n: scan.clusters.length }), 'ok');
      newFacesNotice(ev);
    }
  } catch (err) {
    ok = false;
    say(`${t('fcUploadErr')} ${ui.friendlyError(err)}`, 'err');
  } finally {
    uploading = false;
    upButton(scan);
  }
  return ok;
}
// וואס איז נישט ארויף — יעדע מינוט נאכאמאל פרובירן (ווען די כניסה איז ווידער גילטיג)
let pendingUp = null;
setInterval(async () => {
  if (!pendingUp || uploading || SCAN.running || !hasSavedSession()) return;
  const ev = pendingUp;
  const ok = await uploadScan(ev, () => {}, { final: true });
  if (ok) { pendingUp = null; ui?.toast?.(t('fcUpDoneLater', { name: ev.name })); }
}, 60000);

/** ווען מ'איז אינעם "דערקענען" און עס זענען צוגעקומען נייע פנים */
function newFacesNotice(ev) {
  const box = $('#fc-tmsg');
  if (!box || cur.tab !== 'tag' || String(cur.eventId) !== String(ev.event_id)) return;
  box.innerHTML = `<button type="button" class="btn small-btn primary" id="fc-refresh">🔄 ${h(t('fcNewFaces'))}</button>`;
  $('#fc-refresh').onclick = () => { const pane = $('#fc-pane'); if (pane) tagPane(pane, ev); };
}

// ---------- וויפל עס זענען באשטעטיגט — אינעם אירוע (פאר'ן פאס, די רשימות און דער כרטיס) ----------
const shotsOf = (ev) => (state.faceShots || []).filter((s) => String(s.event_id) === String(ev.event_id));
const isOk = (s) => s.status === 'ok' || s.status === 'auto';
async function syncEvent(ev) {
  const shots = shotsOf(ev);
  const per = new Map(); // cid → auto?
  shots.filter((s) => isOk(s) && s.contact_id).forEach((s) => {
    const k = String(s.contact_id);
    per.set(k, (per.get(k) ?? true) && s.status === 'auto');
  });
  const rec = { ...eventById(ev.event_id), participants: [...per].map(([k, a]) => `${k}${a ? 'a' : ''}`).join(','),
    n_faces: shots.length, n_ok: shots.filter(isOk).length, n_skip: shots.filter((s) => s.status === 'skip').length };
  await saveRecord('FaceEvents', 'event_id', rec);
  const i = state.faceEvents.findIndex((x) => String(x.event_id) === String(ev.event_id));
  if (i >= 0) state.faceEvents[i] = rec;
  Object.assign(ev, rec);
}
let syncTimer = null;
function scheduleSync(ev) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncEvent(ev).catch(() => {}); }, 3000);
}
/** די משתתפים פון אן אירוע → [{ id, auto }] (פון FaceEvents.participants) */
export function eventParticipants(ev) {
  return String(ev?.participants || '').split(',').filter(Boolean).map((x) => ({ id: x.replace(/a$/, ''), auto: x.endsWith('a') }));
}
/** אין וועלכע אירועים איז א מענטש געווען */
export function eventsOfContact(cid) {
  return faceEvents().map((e) => ({ e, p: eventParticipants(e).find((x) => x.id === String(cid)) })).filter((x) => x.p);
}

// ---------- פארשלאגן א נאמען ----------
const LV_G = 0.72; // "כמעט זיכער"
const LV_Y = 0.6; // "אפשר"
const T = { ev: null, idx: [], photos: new Map(), sugg: new Map(), filter: 'wait', view: 'grid', size: 170, pos: 0, ready: false };
const sim = (human, a, b) => human.match.similarity(a, b);
async function cardEmbeddings(human, photos, onStep) {
  const out = [];
  let db = null;
  try { db = await idb(); } catch { db = null; }
  const get = (k) => new Promise((res) => { if (!db) { res(null); return; } const q = db.transaction('cardemb').objectStore('cardemb').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  const put = (k, v) => new Promise((res) => { if (!db) { res(); return; } const tx = db.transaction('cardemb', 'readwrite'); tx.objectStore('cardemb').put(v, k); tx.oncomplete = res; tx.onerror = res; });
  let i = 0;
  for (const [cid, data] of photos) {
    i += 1;
    const sig = `${data.length}:${data.slice(-32)}`;
    // eslint-disable-next-line no-await-in-loop
    let c = await get(cid);
    if (!c || c.sig !== sig) {
      // eslint-disable-next-line no-await-in-loop
      const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = data; });
      let emb = null;
      if (img) {
        // eslint-disable-next-line no-await-in-loop
        const r = await human.detect(img);
        const f = (r.face || []).filter((x) => x.embedding?.length).sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
        emb = f ? Float32Array.from(f.embedding) : null;
      }
      c = { sig, emb };
      // eslint-disable-next-line no-await-in-loop
      await put(cid, c);
    }
    if (c.emb) out.push({ cid, emb: c.emb, src: 'card' });
    if (onStep && i % 5 === 0) onStep(i, photos.size);
  }
  return out;
}
async function prepareTagging(ev, say) {
  T.ev = ev; T.ready = false; T.sugg = new Map();
  say(t('fcLoadingFaces'));
  await loadFaceShots();
  const mine = shotsOf(ev);
  const drv = mine.flatMap((s) => [s.img, s.img2]).filter(isDrv).map((x) => String(x).slice(4));
  if (drv.length) { say(t('fcLoadingImgs', { n: drv.length })); await fetchImages(drv); }
  say(t('fcLoadingEngine'));
  const human = await loadHuman();
  say(t('fcLearning'));
  T.photos = await loadAllPhotos();
  const card = await cardEmbeddings(human, T.photos, (i, n) => say(t('fcLearningN', { i, n })));
  T.human = human;
  await loadFaceLearn();
  await migrateLearn();
  const learned = (state.faceLearn || []).flatMap((r) => decodeEmbs(r.embs).map((emb) => ({ cid: String(r.contact_id), emb, src: 'ev' })));
  T.idx = [...card, ...learned];
  const pending = mine.filter((s) => !s.status);
  for (let k = 0; k < pending.length; k += 1) {
    T.sugg.set(pending[k].face_id, suggest(pending[k]));
    // eslint-disable-next-line no-await-in-loop
    if (k % 20 === 19) { say(t('fcSuggesting', { n: k + 1, total: pending.length })); await new Promise((r) => setTimeout(r, 0)); }
  }
  T.ready = true;
  // "שנעל": די "כמעט זיכערע" ווערן באשטעטיגט אליין (🤖) — נאר ווען דער מענטש איז נאך נישט באשטעטיגט באותו אירוע
  if (ev.mode === 'fast') {
    const greens = pending.filter((s) => T.sugg.get(s.face_id)?.lv === 'g');
    let n = 0;
    for (const s of greens) {
      const g = T.sugg.get(s.face_id).top[0];
      if (mine.some((x) => isOk(x) && String(x.contact_id) === g.cid)) continue;
      // eslint-disable-next-line no-await-in-loop
      await decide(ev, s, 'auto', g.cid);
      n += 1;
      if (n % 5 === 0) say(t('fcAutoN', { n }));
    }
    if (n) ui.toast(t('fcAutoDone', { n }));
  }
  say('');
}
function suggest(face) {
  const embs = embsOf(face);
  if (!embs.length || !T.idx.length) return { lv: '', top: [] };
  const best = new Map();
  for (const x of T.idx) {
    let m = 0;
    for (const e of embs) { const v = sim(T.human, e, x.emb); if (v > m) m = v; }
    if (m > (best.get(x.cid) || 0)) best.set(x.cid, m);
  }
  const top = [...best].map(([cid, v]) => ({ cid, v })).filter((x) => x.v >= LV_Y && ui.contactById(x.cid)).sort((a, b) => b.v - a.v).slice(0, 3);
  if (!top.length) return { lv: '', top };
  const lv = top[0].v >= LV_G && (!top[1] || top[0].v - top[1].v >= 0.04) ? 'g' : 'y';
  return { lv, top: lv === 'g' ? top.slice(0, 1) : top };
}
const faceImg = (s, k = 'img') => imageOf(s[k]) || (String(s[k] || '').startsWith('data:') ? s[k] : '');
const nameOf = (cid) => { const c = ui.contactById(cid); return c ? ui.fullNameHe(c) : `#${cid}`; };

async function decide(ev, face, status, cid = '') {
  const was = { status: face.status, cid: String(face.contact_id || '') };
  const embs = embsOf(face);
  // באשטעטיגט דורך א גבאי → צום "לערנען" (ביז 10 פארשידענע פאר א מענטש)
  if (status === 'ok' && cid) await learn(String(cid), embs, String(face.face_id));
  // צוריק פון א באשטעטיגונג → ארויס פונעם "לערנען"
  if (was.status === 'ok' && status !== 'ok' && was.cid) await unlearn(was.cid, String(face.face_id));
  const rec = { ...face, status, contact_id: cid, decided_by: status ? state.email : '', decided_at: status ? nowStamp() : '' };
  // נאך א באשטעטיגונג פון א גבאי איז די טביעה שוין אינעם "לערנען" — די שורה ווערט לייכט (אזוי בלייבט דער גיליון שנעל)
  if (status === 'ok') rec.emb = '';
  await updateFaceShot(rec);
  embCache.delete(face);
  Object.assign(face, rec);
  if (isOk(rec) && cid) {
    // דער כרטיס האט נאך נישט קיין בילד → דאס בילד פון דער שמחה
    if (!T.photos.has(String(cid))) {
      const data = faceImg(face);
      if (data) { try { await savePhoto(cid, data); T.photos.set(String(cid), data); } catch { /* נישט קריטיש */ } }
    }
  }
  scheduleSync(ev);
}

// ---------- דער "לערנען": ביז 10 פארשידענע טביעות פאר א מענטש ----------
const LEARN_MAX = 10;
const LEARN_SAME = 0.88; // אזוי ענלעך = גארנישט נייס, מ'האלט עס נישט
const learnOf = (cid) => (state.faceLearn || []).find((r) => String(r.contact_id) === String(cid));
async function learn(cid, embs, fid) {
  if (!embs.length || !T.human) return;
  const r = learnOf(cid) || { contact_id: cid, embs: '', ids: '' };
  let list = decodeEmbs(r.embs) || [];
  let ids = String(r.ids || '').split(',').filter(Boolean);
  while (ids.length < list.length) ids.push('');
  let changed = false;
  for (const e of embs) {
    const mx = list.reduce((m, x) => Math.max(m, sim(T.human, e, x)), 0);
    if (mx >= LEARN_SAME) continue;
    list.push(e); ids.push(fid); changed = true;
  }
  // מער ווי 10: ארויס דער וואס איז די מערסטע ענלעך צו די אנדערע
  while (list.length > LEARN_MAX) {
    let worst = 0; let wv = -1;
    list.forEach((x, i) => { const v = list.reduce((m, y, j) => (i === j ? m : Math.max(m, sim(T.human, x, y))), 0); if (v > wv) { wv = v; worst = i; } });
    list = list.filter((_, i) => i !== worst); ids = ids.filter((_, i) => i !== worst);
  }
  if (!changed) return;
  const rec = { ...r, embs: q8Encode(list), ids: ids.join(',') };
  await saveFaceLearn(rec);
  const i = (state.faceLearn ||= []).findIndex((x) => String(x.contact_id) === cid);
  if (i >= 0) state.faceLearn[i] = rec; else state.faceLearn.push(rec);
  relearnIdx(cid, rec);
}
function relearnIdx(cid, rec) {
  T.idx = T.idx.filter((x) => !(x.src === 'ev' && x.cid === cid)).concat((decodeEmbs(rec.embs) || []).map((emb) => ({ cid, emb, src: 'ev' })));
}
async function unlearn(cid, fid) {
  const r = learnOf(cid);
  if (!r) return;
  const list = decodeEmbs(r.embs) || [];
  const ids = String(r.ids || '').split(',');
  const keep = list.map((e, i) => [e, ids[i] || '']).filter(([, id]) => id !== fid);
  if (keep.length === list.length) return;
  const rec = { ...r, embs: keep.length ? q8Encode(keep.map(([e]) => e)) : '', ids: keep.map(([, id]) => id).join(',') };
  await saveFaceLearn(rec);
  Object.assign(r, rec);
  relearnIdx(cid, rec);
}
/** איינמאל: וואס גבאים האבן שוין באשטעטיגט פאר'ן נייעם לערנען → אריין אין FaceLearn */
async function migrateLearn() {
  if ((state.faceLearn || []).length) return;
  const ok = (state.faceShots || []).filter((s) => s.status === 'ok' && s.contact_id && s.emb);
  for (const s of ok) {
    // eslint-disable-next-line no-await-in-loop
    await learn(String(s.contact_id), embsOf(s), String(s.face_id));
  }
}

// ---------- ② דערקענען ----------
function tagCounts(ev) {
  const shots = shotsOf(ev);
  return { total: shots.length, ok: shots.filter(isOk).length, skip: shots.filter((s) => s.status === 'skip').length };
}
function filtered(ev) {
  const num = (x) => Number(String(x.face_id).split('-').pop()) || 0;
  const shots = shotsOf(ev).sort((a, b) => num(a) - num(b));
  const f = T.filter;
  return shots.filter((s) => (f === 'all' ? true : f === 'ok' ? isOk(s) : f === 'skip' ? s.status === 'skip' : f === 'green' ? !s.status && T.sugg.get(s.face_id)?.lv === 'g' : !s.status));
}
async function tagPane(pane, ev) {
  pane.innerHTML = `<div class="fc-tag"><div id="fc-tmsg" class="fc-msg"></div><div id="fc-tbody"></div></div>`;
  const say = (m, k = '') => { const el = $('#fc-tmsg'); if (el) { el.textContent = m; el.className = `fc-msg ${k}`; } };
  try {
    if (String(T.ev?.event_id) !== String(ev.event_id) || !T.ready) await prepareTagging(ev, say);
  } catch (err) { say(`${t('fcEngineErr')} ${err?.message || err}`, 'err'); return; }
  renderTag(ev);
}
function renderTag(ev) {
  const box = $('#fc-tbody');
  if (!box) return;
  const c = tagCounts(ev);
  if (!c.total) { box.innerHTML = `<p class="muted">${h(t('fcNoFacesYet'))}</p>`; return; }
  const list = filtered(ev);
  const greens = shotsOf(ev).filter((s) => !s.status && T.sugg.get(s.face_id)?.lv === 'g').length;
  const F = [['wait', `⏳ ${t('fcFWait')}`], ['green', `🟢 ${t('fcFGreen')}`], ['ok', `✓ ${t('fcFOk')}`], ['skip', `⤼ ${t('fcFSkip')}`], ['all', t('fcFAll')]];
  box.innerHTML = `<div class="fc-tagbar">
      <div class="fc-evbar wide">${barHtml(c.total, c.ok, c.skip)}</div>
      <div class="fc-row">
        <div class="seg">${F.map(([k, l]) => `<button type="button" data-tf="${k}" class="${T.filter === k ? 'on' : ''}">${h(l)}</button>`).join('')}</div>
        <span class="spacer"></span>
        <div class="seg"><button type="button" data-tv="grid" class="${T.view === 'grid' ? 'on' : ''}">▦ ${h(t('fcVGrid'))}</button><button type="button" data-tv="one" class="${T.view === 'one' ? 'on' : ''}">🔍 ${h(t('fcVOne'))}</button></div>
        ${T.view === 'grid' ? `<label class="fc-size">🔎 <input type="range" id="fc-size" min="120" max="300" step="10" value="${T.size}"></label>` : ''}
        ${ev.mode !== 'fast' && greens ? `<button type="button" class="btn small-btn" id="fc-allg">✓ ${h(t('fcApproveGreens', { n: greens }))}</button>` : ''}
        ${c.skip ? `<button type="button" class="btn small-btn danger" id="fc-delskip">🗑 ${h(t('fcDelSkipped', { n: c.skip }))}</button>` : ''}
      </div></div>
    <datalist id="fc-dl">${state.contacts.map((x) => `<option value="${h(ui.pickerLabel(x))}">`).join('')}</datalist>
    <div id="fc-tlist"></div>`;
  $$('[data-tf]', box).forEach((b) => { b.onclick = () => { T.filter = b.dataset.tf; T.pos = 0; renderTag(ev); }; });
  $$('[data-tv]', box).forEach((b) => { b.onclick = () => { T.view = b.dataset.tv; renderTag(ev); }; });
  $('#fc-size', box)?.addEventListener('input', (e) => { T.size = Number(e.target.value); $('#fc-tlist').style.setProperty('--fc-size', `${T.size}px`); });
  $('#fc-allg', box)?.addEventListener('click', () => approveGreens(ev));
  $('#fc-delskip', box)?.addEventListener('click', async () => {
    const list = shotsOf(ev).filter((s) => s.status === 'skip');
    if (!confirm(t('fcDelSkippedAsk', { n: list.length }))) return;
    try { await removeFaces(ev, list); renderTag(ev); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
  });
  if (T.view === 'grid') gridView(ev, list); else oneView(ev, list);
}
function controlsHtml(s, big = false) {
  if (isOk(s)) {
    return `<div class="fc-who"><b>✓ ${h(nameOf(s.contact_id))}</b>${s.status === 'auto' ? ' <span title="🤖">🤖</span>' : ''}
      <button type="button" class="linkish" data-undo="${h(s.face_id)}" title="${h(t('fcUndo'))}">↩</button></div>`;
  }
  if (s.status === 'skip') return `<div class="fc-who muted">⤼ ${h(t('fcSkipped'))} <span><button type="button" class="linkish" data-undo="${h(s.face_id)}">↩</button> <button type="button" class="linkish fc-del" data-delf="${h(s.face_id)}" title="${h(t('fcDelFace'))}">🗑</button></span></div>`;
  const sg = T.sugg.get(s.face_id) || { lv: '', top: [] };
  return `${sg.top.map((x) => `<button type="button" class="fc-sug lv-${sg.lv}" data-acc="${h(s.face_id)}|${h(x.cid)}" title="${Math.round(x.v * 100)}%">${sg.lv === 'g' ? '🟢' : '🟡'} ${h(nameOf(x.cid))} ✓</button>`).join('')}
    <div class="fc-inrow"><input class="fc-in" list="fc-dl" data-in="${h(s.face_id)}" placeholder="${h(t('fcWhoPh'))}" autocomplete="off"><button type="button" class="btn small-btn primary" data-ok="${h(s.face_id)}">✓</button></div>
    <div class="fc-acts"><button type="button" class="linkish" data-newp="${h(s.face_id)}">➕ ${h(t('fcNewPerson'))}</button><button type="button" class="linkish" data-skip="${h(s.face_id)}">⤼ ${h(t('fcSkip'))}</button><button type="button" class="linkish fc-del" data-delf="${h(s.face_id)}" title="${h(t('fcDelFace'))}">🗑${big ? ` ${h(t('fcDelFace'))}` : ''}</button></div>`;
}
function gridView(ev, list) {
  const box = $('#fc-tlist');
  box.className = 'fc-grid';
  box.style.setProperty('--fc-size', `${T.size}px`);
  box.innerHTML = list.length ? list.map((s) => `<div class="fc-card st-${s.status || 'wait'} lv-${T.sugg.get(s.face_id)?.lv || ''}" data-fid="${h(s.face_id)}">
      <img src="${h(faceImg(s))}" alt="" loading="lazy" data-zoom="${h(s.face_id)}"><div class="fc-cbody">${controlsHtml(s)}</div></div>`).join('')
    : `<p class="muted">${h(t('fcNothingHere'))}</p>`;
  wireActions(ev, box, () => renderTag(ev));
}
function oneView(ev, list) {
  const box = $('#fc-tlist');
  box.className = 'fc-one';
  if (!list.length) { box.innerHTML = `<p class="muted">${h(t('fcNothingHere'))}</p>`; return; }
  T.pos = Math.max(0, Math.min(T.pos, list.length - 1));
  const s = list[T.pos];
  const sg = T.sugg.get(s.face_id);
  const cmp = sg?.top?.[0] ? T.photos.get(sg.top[0].cid) : '';
  const [file, tt] = String(s.src || '').split('|');
  box.innerHTML = `<div class="fc-onewrap">
      <button type="button" class="btn fc-nav" data-nav="-1" ${T.pos ? '' : 'disabled'}>›</button>
      <div class="fc-onemain">
        <div class="fc-onepics"><img class="fc-big" src="${h(faceImg(s))}" alt="">
          <div class="fc-side">${faceImg(s, 'img2') ? `<figure><img src="${h(faceImg(s, 'img2'))}" alt=""><figcaption class="muted small">${h(t('fcOther'))}</figcaption></figure>` : ''}
            ${cmp ? `<figure><img src="${h(cmp)}" alt=""><figcaption class="muted small">${h(t('fcCardOf', { name: nameOf(sg.top[0].cid) }))}</figcaption></figure>` : ''}</div></div>
        <p class="muted small" dir="ltr">${Number(tt) >= 0 ? '🎬' : '📷'} ${h(file || '')}${Number(tt) >= 0 ? ` · ${fmtT(Number(tt))}` : ''} · ${h(t('fcSeenN', { n: s.count || 1 }))} · ${T.pos + 1}/${list.length}</p>
        <div class="fc-onectl" data-fid="${h(s.face_id)}">${controlsHtml(s, true)}
          ${isOk(s) && T.photos.has(String(s.contact_id)) && T.photos.get(String(s.contact_id)) !== faceImg(s) ? `<button type="button" class="linkish" data-setphoto="${h(s.face_id)}">🖼 ${h(t('fcSetPhoto'))}</button>` : ''}</div>
      </div>
      <button type="button" class="btn fc-nav" data-nav="1" ${T.pos < list.length - 1 ? '' : 'disabled'}>‹</button></div>`;
  $$('[data-nav]', box).forEach((b) => { b.onclick = () => { T.pos += Number(b.dataset.nav); oneView(ev, list); }; });
  // נאך א באשלוס: ביי "ווארטן" פארשווינדט ער פון דער ליסטע (דער זעלבער פלאץ = דער קומענדיגער); אנדערש — ווייטער
  wireActions(ev, box, () => { if (T.filter === 'all' || T.filter === 'ok' || T.filter === 'skip') T.pos += 1; renderTag(ev); });
  const inp = $('.fc-in', box); inp?.focus();
  box.onkeydown = (e) => {
    if (e.target.matches('.fc-in')) return;
    if (e.key === 'ArrowLeft') { $('[data-nav="1"]', box)?.click(); }
    if (e.key === 'ArrowRight') { $('[data-nav="-1"]', box)?.click(); }
  };
}
function wireActions(ev, box, after) {
  const face = (id) => shotsOf(ev).find((x) => String(x.face_id) === String(id));
  const run = async (btn, fn) => {
    if (btn) btn.disabled = true;
    try { await fn(); after(); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); if (btn) btn.disabled = false; }
  };
  const pick = (fid) => {
    const v = $(`[data-in="${CSS.escape(fid)}"]`, box)?.value || '';
    const m = v.match(/\(#(\d+)\)/);
    return m && ui.contactById(m[1]) ? m[1] : '';
  };
  box.onclick = (e) => {
    const b = e.target.closest('button, img[data-zoom]');
    if (!b) return;
    if (b.dataset.acc) { const [fid, cid] = b.dataset.acc.split('|'); run(b, () => decide(ev, face(fid), 'ok', cid)); return; }
    if (b.dataset.ok) { const cid = pick(b.dataset.ok); if (!cid) { ui.toast(t('pickValid'), 'error'); return; } run(b, () => decide(ev, face(b.dataset.ok), 'ok', cid)); return; }
    if (b.dataset.skip) { run(b, () => decide(ev, face(b.dataset.skip), 'skip')); return; }
    if (b.dataset.undo) { run(b, () => decide(ev, face(b.dataset.undo), '')); return; }
    if (b.dataset.delf) {
      if (!confirm(t('fcDelFaceAsk'))) return;
      run(b, () => removeFaces(ev, [face(b.dataset.delf)]));
      return;
    }
    if (b.dataset.newp) { newPersonDialog(ev, face(b.dataset.newp), after); return; }
    if (b.dataset.setphoto) { const f = face(b.dataset.setphoto); run(b, async () => { await savePhoto(f.contact_id, faceImg(f)); T.photos.set(String(f.contact_id), faceImg(f)); ui.toast(t('fcPhotoSet')); }); return; }
    if (b.dataset.zoom) { T.view = 'one'; T.pos = filtered(ev).findIndex((x) => String(x.face_id) === b.dataset.zoom); renderTag(ev); }
  };
  box.onkeydown = box.onkeydown || null;
  $$('.fc-in', box).forEach((inp) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const cid = pick(inp.dataset.in);
      if (!cid) { ui.toast(t('pickValid'), 'error'); return; }
      run(null, () => decide(ev, face(inp.dataset.in), 'ok', cid));
    });
  });
}
function newPersonDialog(ev, f, after) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet fc-dlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>➕ ${h(t('fcNewPerson'))}</h2>
    <div class="fc-newp"><img src="${h(faceImg(f))}" alt="">
    <form autocomplete="off"><div class="grid">
      <label>${h(t('fcFirstHe'))} *<input name="fh" required dir="rtl"></label><label>${h(t('fcLastHe'))} *<input name="lh" required dir="rtl"></label>
      <label>First name<input name="fe" dir="ltr"></label><label>Last name<input name="le" dir="ltr"></label></div>
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button><button type="submit" class="btn primary">${h(t('saveBtn'))}</button></div>
    </form></div>`;
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  const form = $('form', dlg);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const el = (n) => form.elements[n].value.trim();
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      const id = await saveContact({ first_name_he: el('fh'), last_name_he: el('lh'), first_name_en: el('fe'), last_name_en: el('le'), is_alive: true }, {});
      await loadAll();
      await decide(ev, f, 'ok', String(id));
      dlg.close(); after();
    } catch (err) { btn.disabled = false; ui.toast(ui.friendlyError(err), 'error'); }
  };
  dlg.showModal();
  form.elements.fh.focus();
}
function approveGreens(ev) {
  const list = shotsOf(ev).filter((s) => !s.status && T.sugg.get(s.face_id)?.lv === 'g');
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet wide fc-greendlg';
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.innerHTML = `<button type="button" class="x-close" data-x aria-label="${h(t('close'))}">✕</button>
    <h2>🟢 ${h(t('fcApproveGreens', { n: list.length }))}</h2><p class="muted small">${h(t('fcGreensHint'))}</p>
    <div class="fc-greens">${list.map((s) => { const g = T.sugg.get(s.face_id).top[0]; return `<label class="fc-gitem"><input type="checkbox" data-g="${h(s.face_id)}" checked>
      <img src="${h(faceImg(s))}" alt="">${T.photos.get(g.cid) ? `<img src="${h(T.photos.get(g.cid))}" alt="">` : ''}<span>${h(nameOf(g.cid))}</span></label>`; }).join('')}</div>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-x>${h(t('cancelBtn'))}</button><button type="button" class="btn primary" id="fc-gok">✓ ${h(t('fcApproveSel'))}</button></div>`;
  $$('[data-x]', dlg).forEach((x) => { x.onclick = () => dlg.close(); });
  $('#fc-gok', dlg).onclick = async () => {
    const ids = $$('[data-g]:checked', dlg).map((x) => x.dataset.g);
    const btn = $('#fc-gok', dlg); btn.disabled = true;
    let n = 0;
    for (const fid of ids) {
      const s = list.find((x) => x.face_id === fid);
      try {
        // eslint-disable-next-line no-await-in-loop
        await decide(ev, s, 'ok', T.sugg.get(fid).top[0].cid); n += 1; btn.textContent = `${n}/${ids.length}`;
      } catch (err) { ui.toast(ui.friendlyError(err), 'error'); break; }
    }
    dlg.close(); renderTag(ev);
  };
  dlg.showModal();
}

/** אויסמעקן פנים פון אן אירוע (נישט פארבונדן צו קיינעם) — די שורה ווערט ליידיג; זיי ווערן נישט מער גערעכנט */
async function removeFaces(ev, list) {
  const ids = new Set(list.filter(Boolean).filter((s) => !isOk(s)).map((s) => String(s.face_id)));
  if (!ids.size) return;
  await clearFaceShots(list.filter((s) => ids.has(String(s.face_id))));
  state.faceShots = (state.faceShots || []).filter((s) => !ids.has(String(s.face_id)));
  ids.forEach((id) => T.sugg.delete(id));
  await syncEvent(ev);
  ui.toast(t('fcDeletedN', { n: ids.size }));
}

// ---------- ③ משתתפים ----------
async function peoplePane(pane, ev) {
  pane.innerHTML = `<div id="fc-pmsg" class="fc-msg"></div><div id="fc-pbody"></div>`;
  if (!state.faceShots) { try { $('#fc-pmsg').textContent = t('fcLoadingFaces'); await loadFaceShots(); } catch (err) { $('#fc-pmsg').textContent = ui.friendlyError(err); return; } }
  const drv = shotsOf(ev).filter(isOk).map((s) => s.img).filter(isDrv).map((x) => String(x).slice(4));
  if (drv.length) await fetchImages(drv);
  $('#fc-pmsg').textContent = '';
  renderPeople(ev);
}
function renderPeople(ev) {
  const box = $('#fc-pbody');
  if (!box) return;
  const by = new Map();
  shotsOf(ev).filter((s) => isOk(s) && s.contact_id).forEach((s) => { const k = String(s.contact_id); if (!by.has(k)) by.set(k, []); by.get(k).push(s); });
  const rows = [...by].map(([cid, ss]) => ({ cid, ss, c: ui.contactById(cid), auto: ss.every((x) => x.status === 'auto') }))
    .sort((a, b) => String(a.c?.last_name_he || '').localeCompare(String(b.c?.last_name_he || ''), 'he'));
  const c = tagCounts(ev);
  box.innerHTML = `<div class="fc-evbar wide">${barHtml(c.total, c.ok, c.skip)}</div>
    <div class="fc-row"><b>${h(t('fcPeopleN', { n: rows.length }))}</b>${rows.some((r) => r.auto) ? `<span class="muted small">🤖 = ${h(t('fcAutoMark'))}</span>` : ''}<span class="spacer"></span>
      <button type="button" class="btn small-btn" id="fc-xl">⬇ Excel</button></div>
    ${rows.length ? `<div class="fc-people">${rows.map((r) => `<div class="fc-prow"><img src="${h(faceImg(r.ss[0]))}" alt="">
      <span class="fc-pname"><b>${h(r.c ? ui.fullNameHe(r.c) : `#${r.cid}`)}</b>${r.auto ? ' 🤖' : ''}${r.ss.length > 1 ? ` <span class="muted small">(${r.ss.length})</span>` : ''}</span>
      <span class="spacer"></span><button type="button" class="linkish" data-card="${h(r.cid)}">${h(t('clOpen'))}</button>
      <button type="button" class="linkish cl-rm" data-prm="${h(r.cid)}">✕ ${h(t('clRemove'))}</button></div>`).join('')}</div>`
    : `<p class="muted">${h(t('fcNoPeople'))}</p>`}`;
  const phoneOf = (cid) => { const p = state.phones?.get(String(cid)) || {}; return p.mobile || p.home_phone || p.other_phone || ''; };
  $('#fc-xl', box).onclick = () => downloadXlsx(`${ev.name} - ${t('fcTabPeople')}`, ['ID', t('fcNameCol'), 'English', t('address'), t('fcPhone'), t('fcAutoCol')],
    rows.map((r) => [Number(r.cid) || r.cid, r.c ? ui.fullNameHe(r.c) : '', r.c ? [r.c.first_name_en, r.c.last_name_en].filter(Boolean).join(' ') : '', r.c ? [r.c.address, r.c.city, r.c.state, r.c.zip].filter(Boolean).join(' ') : '', phoneOf(r.cid), r.auto ? '🤖' : '']));
  box.onclick = async (e) => {
    const cd = e.target.closest('[data-card]');
    if (cd) { ui.openCard?.(cd.dataset.card); return; }
    const rm = e.target.closest('[data-prm]');
    if (rm) {
      const r = rows.find((x) => x.cid === rm.dataset.prm);
      if (!confirm(t('fcRemoveAsk', { name: r.c ? ui.fullNameHe(r.c) : r.cid }))) return;
      try { for (const s of r.ss) await decide(ev, s, ''); await syncEvent(ev); renderPeople(ev); } catch (err) { ui.toast(ui.friendlyError(err), 'error'); }
    }
  };
}

// ---------- אויסמעקן אן אירוע ----------
/** די פנים ווערן אויסגעמעקט; דאס לערנען (FaceLearn) בלייבט */
export async function deleteFaceEvent(eventId) {
  const ev = eventById(eventId);
  if (!ev) return;
  await loadFaceShots();
  // דאס "לערנען" ליגט באזונדער (FaceLearn) און בלייבט; די פנים פונעם אירוע ווערן אויסגעמעקט
  await clearFaceShots(shotsOf(ev));
  await deleteRecord('FaceEvents', 'event_id', ev);
  state.faceEvents = state.faceEvents.filter((x) => x !== ev);
}
