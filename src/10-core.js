'use strict';
/* =====================================================================
   1. Utilities
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
/* UIScrollView rubber-band: f(x) = (1 - 1/(x·c/d + 1))·d */
const rubber = (x, d, c = 0.55) => (1 - 1 / ((x * c) / d + 1)) * d;
const rubberClamp = (x, min, max, d) => (x < min ? min - rubber(min - x, d) : x > max ? max + rubber(x - max, d) : x);
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
let RM = mqReduce.matches;
mqReduce.addEventListener?.('change', (e) => { RM = e.matches; });
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let _safe = null;
function safe() {
  if (!_safe) {
    const p = el('<div style="position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"></div>');
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    _safe = { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
    p.remove();
  }
  return _safe;
}
addEventListener('resize', () => { _safe = null; });
const safeTop = () => safe().t;
const safeBottom = () => safe().b;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtTime = (t) => timeFmt.format(new Date(t));
function dayDiff(t) { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(t); b.setHours(0, 0, 0, 0); return Math.round((a - b) / 864e5); }
function smartDay(t) {
  const d = dayDiff(t);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return new Date(t).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function relTime(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (dayDiff(t) === 0) return fmtTime(t);
  if (dayDiff(t) === 1) return 'Yesterday';
  if (dayDiff(t) < 7) return new Date(t).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    try {
      const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;top:-100px;opacity:0'; document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch (e2) { return false; }
  }
}

/* =====================================================================
   2. Icons (24px stroke set)
   ===================================================================== */
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  menu: sv('<path d="M4 7h16M4 12h10M4 17h16"/>'),
  compose: sv('<path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12"/><path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8l-3.6.8.8-3.6z"/>'),
  chevDown: sv('<path d="m6 9 6 6 6-6"/>', 'stroke-width="2.4"'),
  chevR: sv('<path d="m9 6 6 6-6 6"/>', 'stroke-width="2.2"'),
  chevL: sv('<path d="m15 6-6 6 6 6"/>', 'stroke-width="2.2"'),
  chevUp: sv('<path d="m6 15 6-6 6 6"/>', 'stroke-width="2.4"'),
  down: sv('<path d="M12 5v14M5 12l7 7 7-7"/>', 'stroke-width="2.3"'),
  plus: sv('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.2"'),
  mic: sv('<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 'stroke-width="2"'),
  up: sv('<path d="M12 19V5.5M5.5 11.5 12 5l6.5 6.5"/>', 'stroke-width="2.6"'),
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.6" fill="currentColor"/></svg>',
  copy: sv('<rect x="9" y="9" width="11" height="11" rx="2.6"/><path d="M5 15V6.6A2.6 2.6 0 0 1 7.6 4H15"/>'),
  check: sv('<path class="ck" d="m5 12.5 4.5 4.5L19 7"/>', 'stroke-width="2.6"'),
  regen: sv('<path d="M20 11.5A8 8 0 1 0 17.7 17"/><path d="M20.5 5v6.5H14"/>'),
  thumbUp: sv('<path d="M7.5 10.5 11 3.6a2.3 2.3 0 0 1 2.6 2.6L13 9.5h5.2a2 2 0 0 1 2 2.4l-1.3 6.4a2 2 0 0 1-2 1.7H7.5Z"/><path d="M7.5 10.5H4.5v9.1h3"/>'),
  thumbDown: sv('<path d="M7.5 13.5 11 20.4a2.3 2.3 0 0 0 2.6-2.6L13 14.5h5.2a2 2 0 0 0 2-2.4l-1.3-6.4a2 2 0 0 0-2-1.7H7.5Z"/><path d="M7.5 13.5H4.5V4.4h3"/>'),
  share: sv('<path d="M12 3.5V15M7.5 8 12 3.5 16.5 8"/><path d="M8 11H6.5A2.5 2.5 0 0 0 4 13.5v5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5H16"/>'),
  speaker: sv('<path d="M11 5 6.5 9H4v6h2.5L11 19z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.3 6.2a8.5 8.5 0 0 1 0 11.6"/>'),
  reply: sv('<path d="M9.5 14.5 4.5 9.5l5-5"/><path d="M4.5 9.5h9.5a6 6 0 0 1 6 6v4"/>'),
  edit: sv('<path d="M15.6 4.4a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M13.5 6.5l3 3"/>'),
  select: sv('<path d="M6 4.5h3M6 19.5h3M7.5 4.5v15M12.5 8h7M12.5 12h7M12.5 16h4.5"/>'),
  pin: sv('<path d="M12 16.5V21.5M8.5 3.5h7L14.6 9l3.4 4.2V15H6v-1.8L9.4 9z"/>'),
  trash: sv('<path d="M4 6.5h16M10 11v6M14 11v6M5.8 6.5l.9 12.1a2 2 0 0 0 2 1.9h6.6a2 2 0 0 0 2-1.9l.9-12.1M9 6.5V4h6v2.5"/>'),
  archive: sv('<rect x="3" y="4" width="18" height="5" rx="1.6"/><path d="M5 9v8.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V9M10 13h4"/>'),
  search: sv('<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.1-4.1"/>', 'stroke-width="2.2"'),
  x: sv('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 'stroke-width="2.3"'),
  xCircle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".35"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round"/></svg>',
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>', 'stroke-width="1.7"'),
  sun: sv('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  moon: sv('<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6Z"/>'),
  photo: sv('<rect x="3" y="4" width="18" height="16" rx="3.2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 15.5-4.8-4.8L7 20"/>'),
  camera: sv('<path d="M4 8h2.8l1.9-2.8h6.6L17.2 8H20a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.2" r="3.6"/>'),
  file: sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  sparkle: sv('<path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
  code: sv('<path d="m8 8-4.5 4L8 16M16 8l4.5 4-4.5 4M13.5 5l-3 14"/>'),
  lock: sv('<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/></svg>',
  expand: sv('<path d="M14.5 3.5h6v6M9.5 20.5h-6v-6M20.5 3.5l-7 7M3.5 20.5l7-7"/>'),
  chart: sv('<path d="M4 4v16h16"/><path d="m8 14 3.5-4 3 2.5L20 6"/>'),
  table: sv('<rect x="3" y="4" width="18" height="16" rx="2.6"/><path d="M3 9.5h18M3 15h18M9.5 9.5V20"/>'),
  poll: sv('<path d="M5 20V11M12 20V4M19 20v-6"/>', 'stroke-width="2.4"'),
  mapPin: sv('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  cloudSun: sv('<path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 11.5 3.25 3.25 0 0 0 7 18Z"/>'),
  research: sv('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M8 10.5h5M10.5 8v5"/>'),
  wave: sv('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>', 'stroke-width="2.2"'),
  wifiOff: sv('<path d="M2 8.8a15 15 0 0 1 4.2-2.5M10.7 5.1A15 15 0 0 1 22 8.8M5 12.5a10 10 0 0 1 3.3-2M16.4 10.9A10 10 0 0 1 19 12.5M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/>'),
  wifi: sv('<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>'),
  alert: sv('<path d="M12 8v5M12 16.5h.01"/><path d="M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>', 'stroke-width="2.2"'),
  bolt: sv('<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>'),
  brain: sv('<path d="M12 5a3 3 0 0 0-5.8-1A3 3 0 0 0 4 9a3.5 3.5 0 0 0 .5 6.5A3 3 0 0 0 9 19a3 3 0 0 0 3 1.5M12 5a3 3 0 0 1 5.8-1A3 3 0 0 1 20 9a3.5 3.5 0 0 1-.5 6.5A3 3 0 0 1 15 19a3 3 0 0 1-3 1.5M12 5v15.5"/>', 'stroke-width="1.7"'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor"/></svg>',
  nav: sv('<path d="M3.5 11 21 3.5 13.5 21l-2-7.5z"/>'),
  at: sv('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>'),
  slash: sv('<path d="M15 4 9 20"/>', 'stroke-width="2.3"'),
  canvas: sv('<rect x="3" y="3.5" width="18" height="17" rx="3"/><path d="M3 9h18M8.5 20.5V9"/>'),
  doc: sv('<path d="M6.5 3h8L19 7.5V19a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/>'),
  heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>'),
  palette: sv('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/>'),
  textSize: sv('<path d="M4 7V5h10v2M9 5v14M7 19h4M14 12v-1.5h6V12M17 10.5V19M15.5 19h3"/>'),
  vibrate: sv('<rect x="7.5" y="3" width="9" height="18" rx="2.5"/><path d="M3.5 9v6M20.5 9v6"/>'),
  info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>', 'stroke-width="2.2"'),
  timer: sv('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>'),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
};
let _lgId = 0;
function logoSVG() {
  const i = 'lg' + _lgId++;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" style="width:100%;height:100%;overflow:visible">
  <defs>
    <radialGradient id="${i}a" cx="34%" cy="26%" r="82%"><stop offset="0" style="stop-color:#fff;stop-opacity:.95"/><stop offset=".22" style="stop-color:var(--accent)"/><stop offset=".78" style="stop-color:var(--accent-strong)"/><stop offset="1" style="stop-color:color-mix(in oklab,var(--accent-strong) 70%,black)"/></radialGradient>
    <linearGradient id="${i}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${i}c"><circle cx="32" cy="32" r="28"/></clipPath>
    <filter id="${i}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <circle cx="32" cy="36" r="24" style="fill:var(--accent)" opacity=".45" filter="url(#${i}f)"/>
  <circle cx="32" cy="32" r="28" fill="url(#${i}a)"/>
  <g clip-path="url(#${i}c)">
    <ellipse cx="25" cy="16" rx="17" ry="9" fill="url(#${i}b)" opacity=".75"/>
    <circle cx="35.5" cy="35.5" r="11.5" fill="none" stroke="#fff" stroke-width="5.5" opacity=".95"/>
    <rect class="lm-shine" x="10" y="-20" width="12" height="110" fill="#fff" opacity=".35"/>
  </g>
  <circle cx="32" cy="32" r="27.6" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>
</svg>`;
}
const aiMark = () => `<svg class="ai-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" style="fill:var(--accent-strong)"/><circle cx="13.2" cy="13.2" r="4.4" fill="none" stroke="#fff" stroke-width="2.2"/><ellipse cx="9" cy="6.2" rx="5" ry="2.6" fill="#fff" opacity=".35"/></svg>`;

/* =====================================================================
   3. Persistent store (localStorage, guarded)
   ===================================================================== */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota / private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const DEFAULTS = { theme: 'system', accent: 'ember', haptics: true, sound: false, speed: 1, textSize: 2, model: 'lumen-2', reasoning: true };
const settings = Object.assign({}, DEFAULTS, LS.get('lumen.settings', {}));
let convos = [];
let current = null;
let _saveT = 0;
function save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => { LS.set('lumen.convos', convos); LS.set('lumen.settings', settings); }, 250);
}
const curV = (m) => m.versions[m.vi];

/* =====================================================================
   4. Spring physics engine
   Semi-implicit Euler at 240Hz sub-steps, driven by one shared rAF ticker.
   Every spring is interruptible: calling .to() mid-flight keeps velocity.
   ===================================================================== */
const Ticker = {
  set: new Set(), id: 0, last: 0,
  add(sp) { this.set.add(sp); if (!this.id) { this.last = performance.now(); this.id = requestAnimationFrame(Ticker.tick); } },
  tick(t) {
    const T = Ticker;
    const dt = Math.min(0.05, Math.max(0.001, (t - T.last) / 1000));
    T.last = t;
    for (const sp of T.set) sp._step(dt);
    T.id = T.set.size ? requestAnimationFrame(T.tick) : 0;
  },
};
const SPR = {
  snappy: { stiffness: 560, damping: 44 },
  smooth: { stiffness: 320, damping: 34 },
  bouncy: { stiffness: 420, damping: 22 },
  gentle: { stiffness: 170, damping: 24 },
  wobbly: { stiffness: 640, damping: 17 },
};
class Spring {
  constructor(value = 0, cfg = SPR.smooth, onUpdate = null) {
    this.x = value; this.target = value; this.v = 0;
    this.stiffness = 320; this.damping = 34; this.mass = 1; this.precision = 0.05;
    Object.assign(this, cfg);
    this.onUpdate = onUpdate; this._res = null;
  }
  get value() { return this.x; }
  get moving() { return Ticker.set.has(this); }
  set(v) {
    this.x = this.target = v; this.v = 0;
    Ticker.set.delete(this); this._done(false);
    if (this.onUpdate) this.onUpdate(v, this);
    return this;
  }
  to(target, o = {}) {
    if (o.velocity != null) this.v = o.velocity;
    if (o.config) Object.assign(this, o.config);
    this.target = target;
    this._done(false);
    if (Math.abs(this.x - target) < this.precision && Math.abs(this.v) < this.precision * 10) {
      this.x = target; this.v = 0; Ticker.set.delete(this);
      if (this.onUpdate) this.onUpdate(target, this);
      return Promise.resolve(true);
    }
    const p = new Promise((r) => { this._res = r; });
    Ticker.add(this);
    return p;
  }
  stop() { Ticker.set.delete(this); this.v = 0; this._done(false); }
  _done(ok) { const r = this._res; this._res = null; if (r) r(ok); }
  _step(dt) {
    let k = this.stiffness, c = this.damping;
    const m = this.mass;
    if (RM) { k = 700; c = 2 * Math.sqrt(700 * m); } // reduced motion: critically damped, no overshoot
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = (-k * (this.x - this.target) - c * this.v) / m;
      this.v += a * h; this.x += this.v * h;
    }
    if (Math.abs(this.v) < this.precision * 10 && Math.abs(this.x - this.target) < this.precision) {
      this.x = this.target; this.v = 0; Ticker.set.delete(this);
      if (this.onUpdate) this.onUpdate(this.x, this);
      this._done(true);
      return;
    }
    if (this.onUpdate) this.onUpdate(this.x, this);
  }
}
/* Generate a CSS linear() easing from the same physics so CSS + JS motion match. */
function springEasing(cfg) {
  const k = cfg.stiffness, c = cfg.damping, dt = 1 / 240;
  let x = 0, v = 0, t = 0; const pts = [];
  while (t < 2.5) {
    for (let i = 0; i < 4; i++) { const a = -k * (x - 1) - c * v; v += a * dt; x += v * dt; }
    t += 4 * dt; pts.push(x);
    if (Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
  }
  const step = Math.max(1, Math.floor(pts.length / 40));
  const out = ['0'];
  for (let i = step; i < pts.length - 1; i += step) out.push(pts[i].toFixed(3));
  out.push('1');
  return { css: `linear(${out.join(', ')})`, ms: Math.round(t * 1000) };
}
let EASE_SPRING = 'cubic-bezier(.2,.9,.25,1.12)';
let EASE_BOUNCE = 'cubic-bezier(.2,.9,.25,1.25)';
function installSpringEasings() {
  try {
    if (!CSS.supports('transition-timing-function', 'linear(0, 1)')) return;
    const a = springEasing({ stiffness: 260, damping: 24 });
    const b = springEasing({ stiffness: 300, damping: 17 });
    EASE_SPRING = a.css; EASE_BOUNCE = b.css;
    document.documentElement.style.setProperty('--ease-spring', a.css);
    document.documentElement.style.setProperty('--ease-bounce', b.css);
  } catch (e) {}
}

/* =====================================================================
   5. Gesture recogniser
   Touch events (non-passive move) so each recogniser can decide, per gesture,
   whether to claim it (preventDefault → native scroll never starts) or let
   the browser scroll. Mouse is mapped onto the same path for desktop.
   ===================================================================== */
let G_ACTIVE = null;
let suppressClickUntil = 0;
document.addEventListener('click', (e) => {
  if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
}, true);
function velocityOf(s) {
  const now = performance.now();
  const arr = s.samples.filter((p) => now - p[0] < 90);
  if (arr.length < 2) return { vx: 0, vy: 0 };
  const a = arr[0], b = arr[arr.length - 1];
  const dt = Math.max(0.008, (b[0] - a[0]) / 1000);
  return { vx: (b[1] - a[1]) / dt, vy: (b[2] - a[2]) / dt };
}
function gesture(node, o) {
  let s = null;
  const begin = (x, y, target, mouse) => {
    if (s) return;
    if (o.start && o.start({ x, y, target }) === false) return;
    s = { x0: x, y0: y, x, y, target, locked: null, claimed: false, dead: false, long: false, samples: [[performance.now(), x, y]], lt: 0, mouse };
    if (o.long) {
      s.lt = setTimeout(() => {
        if (s && !s.locked && !G_ACTIVE) { s.long = true; G_ACTIVE = s; o.long({ x: s.x, y: s.y, target: s.target }); }
      }, o.longMs || 440);
    }
  };
  const moveTo = (x, y, e) => {
    if (!s) return;
    s.x = x; s.y = y;
    s.samples.push([performance.now(), x, y]);
    if (s.samples.length > 14) s.samples.shift();
    const dx = x - s.x0, dy = y - s.y0;
    if (s.long) { if (e && e.cancelable) e.preventDefault(); return; }
    if (s.dead) return;
    if (!s.locked) {
      const slop = o.slop || 7;
      if (Math.abs(dx) < slop && Math.abs(dy) < slop) return;
      clearTimeout(s.lt);
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if ((G_ACTIVE && G_ACTIVE !== s) || !o.lock || !o.lock(s.locked, dx, dy, s)) { s.dead = true; return; }
      s.claimed = true; G_ACTIVE = s;
      if (o.grab) o.grab(s);
    }
    if (e && e.cancelable) e.preventDefault();
    if (o.move) o.move(dx, dy, s);
  };
  const finish = (cancel) => {
    if (!s) return;
    const c = s; s = null;
    clearTimeout(c.lt);
    if (G_ACTIVE === c) G_ACTIVE = null;
    if (c.long) { suppressClickUntil = performance.now() + 350; if (o.longEnd) o.longEnd(c); return; }
    if (!c.claimed) return;
    suppressClickUntil = performance.now() + 120;
    const v = velocityOf(c);
    if (o.end) o.end({ dx: c.x - c.x0, dy: c.y - c.y0, vx: v.vx, vy: v.vy, cancel }, c);
  };
  node.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) { finish(true); return; }
    const t = e.touches[0]; begin(t.clientX, t.clientY, e.target, false);
  }, { passive: true });
  node.addEventListener('touchmove', (e) => { if (!s) return; const t = e.touches[0]; moveTo(t.clientX, t.clientY, e); }, { passive: false });
  node.addEventListener('touchend', () => finish(false));
  node.addEventListener('touchcancel', () => finish(true));
  node.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    begin(e.clientX, e.clientY, e.target, true);
    if (!s) return;
    const mv = (ev) => moveTo(ev.clientX, ev.clientY, ev);
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); finish(false); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  return { cancel: () => finish(true) };
}

/* =====================================================================
   6. Haptics — iOS 18 <input switch> trick, Vibration API elsewhere
   ===================================================================== */
let _hapticLabel = null;
function haptic(kind = 'light') {
  if (!settings.haptics) return;
  try {
    if (!IS_IOS && navigator.vibrate) { navigator.vibrate(kind === 'heavy' ? 16 : kind === 'select' ? 4 : 8); return; }
    if (!_hapticLabel) {
      _hapticLabel = document.createElement('label');
      _hapticLabel.setAttribute('aria-hidden', 'true');
      _hapticLabel.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      _hapticLabel.appendChild(i); document.body.appendChild(_hapticLabel);
    }
    _hapticLabel.click();
  } catch (e) { /* silent */ }
}

/* =====================================================================
   7. Sound design — synthesized with Web Audio, no files
   ===================================================================== */
const Sound = {
  ctx: null, noise: null,
  ensure() {
    try {
      if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; this.ctx = new C(); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  play(name) {
    if (!settings.sound) return;
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + 0.005;
    const g = c.createGain(); g.connect(c.destination);
    if (name === 'send') {
      if (!this.noise) {
        this.noise = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(3400, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      src.connect(f).connect(g); src.start(t); src.stop(t + 0.34);
    } else if (name === 'pop') {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(920, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.08);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); o.start(t); o.stop(t + 0.16);
    } else if (name === 'tick') {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1900, t);
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g); o.start(t); o.stop(t + 0.04);
    }
  },
};

/* =====================================================================
   8. Theme + accent
   ===================================================================== */
const ACCENTS = {
  ember: { c: '#FF6B3D', s: '#C9431A', n: 'Ember' },
  ocean: { c: '#0A84FF', s: '#0062CC', n: 'Ocean' },
  jade:  { c: '#22C384', s: '#0B7A55', n: 'Jade' },
  rose:  { c: '#FF3B6B', s: '#C81E4E', n: 'Rose' },
  amber: { c: '#FFB020', s: '#9A5B00', n: 'Amber' },
  iris:  { c: '#7C6CFF', s: '#5340E0', n: 'Iris' },
};
const mqDark = matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = () => (settings.theme === 'system' ? (mqDark.matches ? 'dark' : 'light') : settings.theme);
function applyTheme() {
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  $$('meta[name="theme-color"]').forEach((m) => { m.content = t === 'dark' ? '#0A0A0C' : '#F3F1EC'; });
  const tb = $('#theme-btn'); if (tb) { tb.innerHTML = t === 'dark' ? ICON.sun : ICON.moon; tb.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); }
}
mqDark.addEventListener?.('change', () => { if (settings.theme === 'system') setTheme('system'); });
function setTheme(mode, origin) {
  const before = document.documentElement.dataset.theme;
  settings.theme = mode; save();
  const after = resolvedTheme();
  if (before === after || !document.startViewTransition || RM) { applyTheme(); return; }
  const x = origin ? origin.x : innerWidth / 2, y = origin ? origin.y : 0;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.documentElement.classList.add('vt-theme');
  let vt;
  try { vt = document.startViewTransition(() => applyTheme()); } catch (e) { applyTheme(); document.documentElement.classList.remove('vt-theme'); return; }
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 680, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
  vt.finished.finally(() => document.documentElement.classList.remove('vt-theme'));
}
function setAccent(key) {
  const a = ACCENTS[key] || ACCENTS.ember;
  settings.accent = key; save();
  const s = document.documentElement.style;
  s.setProperty('--accent', a.c); s.setProperty('--accent-strong', a.s);
}
const TEXT_SIZES = [15, 16, 17, 19, 21];
function applyTextSize() { document.documentElement.style.setProperty('--fs', TEXT_SIZES[settings.textSize] + 'px'); }
