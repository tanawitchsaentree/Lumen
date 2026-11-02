/* 24px stroke icon set (same glyphs as the vanilla build), drawn through Pane's Icon sizing. */
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICON = {
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
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
export function logoSVG() {
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
export const aiMark = () => `<svg class="ai-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" style="fill:var(--accent-strong)"/><circle cx="13.2" cy="13.2" r="4.4" fill="none" stroke="#fff" stroke-width="2.2"/><ellipse cx="9" cy="6.2" rx="5" ry="2.6" fill="#fff" opacity=".35"/></svg>`;

