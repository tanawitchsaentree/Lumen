/* Theme follows Pane (D-015): dark by default, light via [data-theme="light"], system when unset.
   Switching paints a circular reveal from the tap point with the View Transitions API. */
import { settings, save, emit } from '../lib/store.js';
import { RM } from '../lib/core.js';

const mq = matchMedia('(prefers-color-scheme: dark)');
export const resolved = () => (settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : settings.theme);
export function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'system') root.removeAttribute('data-theme'); else root.dataset.theme = settings.theme;
  root.dataset.resolved = resolved();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { if (settings.theme !== 'system') m.content = resolved() === 'dark' ? '#0B0B10' : '#EDEBF2'; });
}
mq.addEventListener?.('change', () => settings.theme === 'system' && applyTheme());
let lastTap = null;
addEventListener('pointerdown', (e) => { lastTap = { x: e.clientX, y: e.clientY }; }, true);
export function setTheme(mode, origin = lastTap) {
  const before = resolved();
  settings.theme = mode; save();
  if (before === resolved() || !document.startViewTransition || RM) { applyTheme(); emit(); return; }
  const x = origin ? origin.x : innerWidth / 2, y = origin ? origin.y : 0;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.documentElement.classList.add('vt-theme');
  try {
    const vt = document.startViewTransition(() => { applyTheme(); emit(); });
    vt.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 680, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    vt.finished.finally(() => document.documentElement.classList.remove('vt-theme'));
  } catch (e) { applyTheme(); emit(); document.documentElement.classList.remove('vt-theme'); }
}
export const toggleTheme = (origin) => setTheme(resolved() === 'dark' ? 'light' : 'dark', origin);
export const TEXT_SIZES = [14, 15, 16, 18, 20];
export function applyTextSize() { document.documentElement.style.setProperty('--lu-fs', TEXT_SIZES[settings.textSize] + 'px'); }
