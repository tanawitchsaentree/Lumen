/* Shared runtime: utilities, spring physics, gestures, haptics, sound. Ported from the vanilla build. */
import { settings } from './store.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
/* UIScrollView rubber-band: f(x) = (1 - 1/(x·c/d + 1))·d */
export const rubber = (x, d, c = 0.55) => (1 - 1 / ((x * c) / d + 1)) * d;
export const rubberClamp = (x, min, max, d) => (x < min ? min - rubber(min - x, d) : x > max ? max + rubber(x - max, d) : x);
export const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
export let RM = mqReduce.matches;
mqReduce.addEventListener?.('change', (e) => { RM = e.matches; });
export const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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
export const safeTop = () => safe().t;
export const safeBottom = () => safe().b;

export const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
export const fmtTime = (t) => timeFmt.format(new Date(t));
export function dayDiff(t) { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(t); b.setHours(0, 0, 0, 0); return Math.round((a - b) / 864e5); }
export function smartDay(t) {
  const d = dayDiff(t);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return new Date(t).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
export function relTime(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (dayDiff(t) === 0) return fmtTime(t);
  if (dayDiff(t) === 1) return 'Yesterday';
  if (dayDiff(t) < 7) return new Date(t).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export async function copyText(text) {
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
   4. Spring physics engine
   Semi-implicit Euler at 240Hz sub-steps, driven by one shared rAF ticker.
   Every spring is interruptible: calling .to() mid-flight keeps velocity.
   ===================================================================== */
export const Ticker = {
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
export const SPR = {
  snappy: { stiffness: 560, damping: 44 },
  smooth: { stiffness: 320, damping: 34 },
  bouncy: { stiffness: 420, damping: 22 },
  gentle: { stiffness: 170, damping: 24 },
  wobbly: { stiffness: 640, damping: 17 },
};
export class Spring {
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
export function springEasing(cfg) {
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
export let EASE_SPRING = 'cubic-bezier(.2,.9,.25,1.12)';
export let EASE_BOUNCE = 'cubic-bezier(.2,.9,.25,1.25)';
export function installSpringEasings() {
  try {
    if (!CSS.supports('transition-timing-function', 'linear(0, 1)')) return;
    const a = springEasing({ stiffness: 260, damping: 24 });
    const b = springEasing({ stiffness: 300, damping: 17 });
    EASE_SPRING = a.css; EASE_BOUNCE = b.css;
    document.documentElement.style.setProperty('--lu-spring', a.css);
    document.documentElement.style.setProperty('--lu-bounce', b.css);
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
export function gesture(node, o) {
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
export function haptic(kind = 'light') {
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
export const Sound = {
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

