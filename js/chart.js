// גראפיקן פאר קאמפיינען: דאס יאר קעגן פאריג יאר (צוזאמגערעכנט לויט טעג פון ראש השנה), און א שורה פון יארן.
// די צייט גייט פון רעכטס צו לינקס (ווי מ'לייענט). קיין ביבליאטעק — פשוט SVG.
import {
  toHebrew, fromHebrew, monthsOf, hebrewNumber, todayIso, daysBetween, yearFromLabel, isoToHebrewText, yearLabel,
} from './hebdate.js';
import { escapeHtml as h } from './util.js';
import { t } from './i18n.js';

const money = (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`;
const short = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `$${Math.round(n)}`);

function rh(y) { return fromHebrew(1, 'Tishri', y); }
function yearLength(y) { return daysBetween(rh(y), rh(y + 1)); }

/** צוזאמגערעכנט פון טאג 0 (ראש השנה) ביז דעם סוף יאר. */
function cumulative(list, y) {
  const len = yearLength(y);
  const start = rh(y);
  const perDay = new Array(len + 1).fill(0);
  list.forEach((d) => {
    const amt = Number(d.amount_usd || 0);
    if (!amt) return;
    let i = d.date ? daysBetween(start, String(d.date).slice(0, 10)) : 0;
    if (!Number.isFinite(i)) i = 0;
    perDay[Math.max(0, Math.min(len, i))] += amt;
  });
  let s = 0;
  return perDay.map((v) => (s += v));
}

/** ביז וועלכן טאג פונעם יאר זענען מיר (פאר א פארגאנגען יאר — דער גאנצער יאר). */
function dayNow(y) {
  const len = yearLength(y);
  const d = daysBetween(rh(y), todayIso());
  return d < 0 ? 0 : Math.min(len, d);
}

/** דאס יאר קעגן פאריג יאר ביז דעם זעלבן טאג: { cur, prev, diff, pct, day } */
export function compareToDate(cur, prev) {
  const y = yearFromLabel(cur.year);
  if (!y || !prev) return null;
  const day = dayNow(y);
  const a = cumulative(cur.list, y);
  const b = cumulative(prev.list, y - 1);
  const c = a[Math.min(day, a.length - 1)];
  const p = b[Math.min(day, b.length - 1)];
  return { cur: c, prev: p, diff: c - p, pct: p ? Math.round(((c - p) / p) * 100) : null, day, full: day >= a.length - 1 };
}

/** א קליינע שורה: ▲ +$1,200 (+12%) */
export function deltaHtml(cmp, { short: isShort = false } = {}) {
  if (!cmp) return '';
  const up = cmp.diff >= 0;
  const pct = cmp.pct == null ? '' : ` (${up ? '+' : ''}${cmp.pct}%)`;
  return `<span class="delta ${up ? 'up' : 'down'}"><span class="delta-icon" aria-hidden="true">${up ? '▲' : '▼'}</span>
    <bdi dir="ltr">${up ? '+' : '-'}${money(Math.abs(cmp.diff))}${pct}</bdi>${isShort ? '' : ` <span class="delta-word">${h(up ? t('cmpMore') : t('cmpLess'))}</span>`}</span>`;
}

// ---------- ליניע גראפיק: דאס יאר קעגן פאריג יאר ----------
const W = 760;
const H = 280;
const PAD = { top: 18, right: 58, bottom: 34, left: 64 };

export function compareChartHtml(cur, prev, { full = false } = {}) {
  const y = yearFromLabel(cur.year);
  if (!y) return '';
  const a = cumulative(cur.list, y);
  const fullLen = Math.max(a.length, prev ? yearLength(y - 1) + 1 : 0) - 1;
  const upto = dayNow(y);
  // ווען דאס יאר לויפט נאך: ווייזט נאר ביז א ביסל נאך היינט (מ'קען דריקן "גאנץ יאר")
  const zoomable = upto < fullLen - 30;
  const len = full || !zoomable ? fullLen : Math.min(fullLen, Math.max(upto + 30, 60));
  const b = prev ? cumulative(prev.list, y - 1).slice(0, len + 1) : [];
  const curPts = a.slice(0, upto + 1);
  const max = Math.max(1, ...curPts, ...b);
  const nice = niceMax(max);
  // רעכטס → לינקס
  const x = (i) => W - PAD.right - (i / len) * (W - PAD.left - PAD.right);
  const yy = (v) => PAD.top + (1 - v / nice) * (H - PAD.top - PAD.bottom);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yy(v).toFixed(1)}`).join('');
  const step = niceStep(max / 4);
  const ticks = [];
  for (let v = 0; v <= nice + 1e-9; v += step) ticks.push(v);
  const months = monthsOf(y).map((m) => ({ he: m.he, i: daysBetween(rh(y), fromHebrew(1, m.key, y)) })).filter((m) => m.i >= 0 && m.i <= len);
  const curLbl = `${cur.year}`;
  const lastCur = curPts.length - 1;
  // די נעמען ביים סוף פון די ליניעס — נישט איינס אויפן צווייטן
  const labels = () => {
    const L = [{ cls: 'cur', text: curLbl, x: x(lastCur) - 9, y: yy(curPts[lastCur]) + 4 }];
    if (b.length) L.push({ cls: 'prev', text: prevLbl, x: x(b.length - 1) - 9, y: yy(b[b.length - 1]) + 4 });
    if (L.length === 2 && Math.abs(L[0].x - L[1].x) < 60 && Math.abs(L[0].y - L[1].y) < 16) {
      const [hi, lo] = L[0].y <= L[1].y ? [L[0], L[1]] : [L[1], L[0]];
      const mid = (hi.y + lo.y) / 2;
      hi.y = mid - 8; lo.y = mid + 8;
    }
    return L.map((l) => `<text class="c-lbl ${l.cls}" x="${l.x}" y="${l.y}" direction="rtl" text-anchor="start">${h(l.text)}</text>`).join('');
  };
  const cmp = prev ? compareToDate(cur, prev) : null;
  
  const prevLbl = prev ? `${prev.year}` : '';
  const svg = `<svg class="cmp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(t('cmpTitle'))}">
    ${ticks.map((v) => `<line class="c-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${yy(v)}" y2="${yy(v)}"/>
      <text class="c-ax" x="${W - PAD.right + 8}" y="${yy(v) + 4}" text-anchor="start">${short(v)}</text>`).join('')}
    ${months.map((m) => `<line class="c-mtick" x1="${x(m.i)}" x2="${x(m.i)}" y1="${H - PAD.bottom}" y2="${H - PAD.bottom + 5}"/>
      <text class="c-ax" x="${x(m.i) - 3}" y="${H - PAD.bottom + 18}" direction="rtl" text-anchor="start">${h(m.he)}</text>`).join('')}
    ${b.length ? `<path class="c-ln prev" d="${path(b)}"/>` : ''}
    <path class="c-ln cur" d="${path(curPts)}"/>
    <circle class="c-dot cur" cx="${x(lastCur)}" cy="${yy(curPts[lastCur])}" r="4.5"/>
    ${labels()}
    <line class="c-xhair" x1="0" x2="0" y1="${PAD.top}" y2="${H - PAD.bottom}" visibility="hidden"/>
    <rect class="c-hit" x="${PAD.left}" y="${PAD.top}" width="${W - PAD.left - PAD.right}" height="${H - PAD.top - PAD.bottom}" fill="transparent"/>
  </svg>`;
  const legend = `<div class="cmp-legend"><span><i class="sw cur"></i>${h(curLbl)}</span>${prev ? `<span><i class="sw prev"></i>${h(prevLbl)}</span>` : ''}</div>`;
  return `<section class="cmp-card" data-year="${y}" data-len="${len}" data-upto="${upto}">
    <div class="cmp-head"><h3>${h(t('cmpTitle'))}</h3>
      ${zoomable ? `<button type="button" class="btn small-btn cmp-zoom" data-full="${full ? '' : '1'}">${h(full ? t('cmpZoomNow') : t('cmpZoomFull'))}</button>` : ''}
      ${cmp ? `<p class="cmp-sum">${h(cmp.full ? t('cmpFull') : t('cmpToDate'))}: <b dir="ltr">${money(cmp.cur)}</b> · ${h(prevLbl)}: <b dir="ltr">${money(cmp.prev)}</b> ${deltaHtml(cmp)}</p>`
        : `<p class="muted small">${h(t('cmpNoPrev'))}</p>`}
    </div>
    ${legend}
    <div class="cmp-plot">${svg}<div class="cmp-tip" hidden></div></div>
    <script type="application/json" class="cmp-data">${JSON.stringify({ a: curPts, b })}</script>
  </section>`;
}

function niceStep(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
/** א שיינע העכסטע ליניע (4 גלייכע טיילן מיט רונדע נומערן). */
function niceMax(v) {
  const step = niceStep(v / 4);
  return step * Math.ceil(v / step);
}

/** האווער: א ליניע מיטן טאג, און ביידע סכומים. */
export function wireCompareChart(root, cur, prev) {
  const card = root.querySelector('.cmp-card:not(.bars-card)');
  if (!card) return;
  const zoom = card.querySelector('.cmp-zoom');
  if (zoom) {
    zoom.onclick = () => {
      card.outerHTML = compareChartHtml(cur, prev, { full: Boolean(zoom.dataset.full) });
      wireCompareChart(root, cur, prev);
    };
  }
  const { a, b } = JSON.parse(card.querySelector('.cmp-data').textContent);
  const y = Number(card.dataset.year);
  const len = Number(card.dataset.len);
  const svg = card.querySelector('svg');
  const hair = svg.querySelector('.c-xhair');
  const tip = card.querySelector('.cmp-tip');
  const start = rh(y);
  const prevStart = rh(y - 1);
  const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(len, Math.round(((W - PAD.right - sx) / (W - PAD.left - PAD.right)) * len)));
    const xx = W - PAD.right - (i / len) * (W - PAD.left - PAD.right);
    hair.setAttribute('x1', xx); hair.setAttribute('x2', xx); hair.setAttribute('visibility', 'visible');
    const dCur = addDays(start, i);
    const hd = toHebrew(new Date(`${dCur}T12:00:00Z`));
    const day = `${hebrewNumber(hd.d)} ${isoToHebrewText(dCur).split(' ').slice(1, -1).join(' ')}`;
    const cv = i < a.length ? money(a[i]) : '—';
    const pv = b.length ? money(b[Math.min(i, b.length - 1)]) : '';
    tip.innerHTML = `<b>${h(day)}</b><span><i class="sw cur"></i>${h(card.querySelector('.c-lbl.cur').textContent)}: <b dir="ltr">${cv}</b></span>`
      + (b.length ? `<span><i class="sw prev"></i>${h(card.querySelector('.c-lbl.prev')?.textContent || '')}: <b dir="ltr">${pv}</b> <span class="muted small" dir="ltr">${addDays(prevStart, i)}</span></span>` : '');
    tip.hidden = false;
    const px = (xx / W) * r.width;
    tip.style.left = `${Math.min(r.width - 190, Math.max(0, px - 95))}px`;
  };
  const hit = svg.querySelector('.c-hit');
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { hair.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}

// ---------- באלקנס: אלע יארן ----------
export function yearBarsHtml(years) {
  const list = years.filter((c) => yearFromLabel(c.year)).slice().sort((p, q) => yearFromLabel(p.year) - yearFromLabel(q.year));
  if (list.length < 2) return '';
  const max = niceMax(Math.max(1, ...list.map((c) => c.total)));
  const BW = 760;
  const BH = 230;
  const P = { top: 26, bottom: 46, side: 20 };
  const slot = (BW - P.side * 2) / list.length;
  const bw = Math.min(56, slot * 0.55);
  const yy = (v) => P.top + (1 - v / max) * (BH - P.top - P.bottom);
  const base = BH - P.bottom;
  const now = yearLabelNow();
  return `<section class="cmp-card bars-card">
    <div class="cmp-head"><h3>${h(t('cmpYearsTitle'))}</h3></div>
    <svg class="cmp-svg" viewBox="0 0 ${BW} ${BH}" role="img" aria-label="${h(t('cmpYearsTitle'))}">
      <line class="c-grid" x1="${P.side}" x2="${BW - P.side}" y1="${base}" y2="${base}"/>
      ${list.map((c, i) => {
        // ראַכטס = די עלטסטע, לינקס = די נייסטע
        const cx = BW - P.side - slot * (i + 0.5);
        const top = yy(c.total);
        const prev = list[i - 1];
        // דאס יאר וואס לויפט נאך: פארגלייכן ביז היינט (נישט קעגן א גאנץ יאר)
        const live = c.year === now && prev ? compareToDate(c, prev) : null;
        const pct = live ? live.pct : (prev && prev.total ? Math.round(((c.total - prev.total) / prev.total) * 100) : null);
        const hgt = Math.max(0, base - top);
        const r = Math.min(4, hgt);
        const d = hgt ? `M${cx - bw / 2},${base}V${top + r}Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top}H${cx + bw / 2 - r}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r}V${base}Z` : '';
        return `<g class="c-bar-g${c.year === now ? ' now' : ''}" data-goto-campaign="${h(c.name)}">
          <title>${h(c.year)}: ${money(c.total)}${pct == null ? '' : ` (${pct >= 0 ? '+' : ''}${pct}%)`}</title>
          <rect class="c-bar-hit" x="${cx - slot / 2}" y="${P.top - 20}" width="${slot}" height="${BH - P.top}" fill="transparent"/>
          ${d ? `<path class="c-bar" d="${d}"/>` : ''}
          <text class="c-val" x="${cx}" y="${top - 6}" text-anchor="middle">${short(c.total)}</text>
          <text class="c-ax c-yr" x="${cx}" y="${base + 17}" direction="rtl" text-anchor="middle">${h(c.year)}</text>
          ${pct == null ? '' : `<text class="c-chg ${pct >= 0 ? 'up' : 'down'}" x="${cx}" y="${base + 34}" direction="rtl" text-anchor="middle">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%${live ? ` ${h(t('cmpToDateShort'))}` : ''}</text>`}
        </g>`;
      }).join('')}
    </svg>
  </section>`;
}

function yearLabelNow() {
  return yearLabel(toHebrew(todayIso()).y);
}
