/* =====================================================================
   31. Boot
   ===================================================================== */
function loadConvos() {
  const raw = LS.get('lumen.convos', null);
  if (!Array.isArray(raw)) return seedConvos();
  const ok = raw.filter((c) => c && Array.isArray(c.messages) && c.messages.every((m) => m && Array.isArray(m.versions) && m.versions.length));
  ok.forEach((c) => c.messages.forEach((m) => {
    m.vi = clamp(m.vi | 0, 0, m.versions.length - 1); m.reactions = m.reactions || [];
    m.versions.forEach((v) => { if (v.state === 'streaming') v.state = 'done'; });
  }));
  return ok;
}
function makeIcons() {
  try {
    const draw = (size) => {
      const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
      const a = ACCENTS[settings.accent] || ACCENTS.ember; const s = size / 64;
      g.fillStyle = '#F3F1EC'; g.fillRect(0, 0, size, size);
      const rg = g.createRadialGradient(22 * s, 17 * s, 2 * s, 32 * s, 32 * s, 30 * s);
      rg.addColorStop(0, '#fff'); rg.addColorStop(0.25, a.c); rg.addColorStop(1, a.s);
      g.fillStyle = rg; g.beginPath(); g.arc(32 * s, 32 * s, 21 * s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4.2 * s; g.beginPath(); g.arc(34.5 * s, 34.5 * s, 8.6 * s, 0, Math.PI * 2); g.stroke();
      return c.toDataURL('image/png');
    };
    const icon = el(`<link rel="apple-touch-icon" href="${draw(180)}">`); document.head.appendChild(icon);
    const big = draw(512);
    const man = { name: 'Lumen', short_name: 'Lumen', display: 'standalone', background_color: '#F3F1EC', theme_color: '#F3F1EC', start_url: location.href.split('#')[0], icons: [{ src: big, sizes: '512x512', type: 'image/png' }] };
    const link = document.createElement('link'); link.rel = 'manifest';
    link.href = URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' }));
    document.head.appendChild(link);
  } catch (e) {}
}
let scrollRaf = 0;
function onScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const s = D.scroller, st = s.scrollTop;
    const dist = s.scrollHeight - st - s.clientHeight;
    atBottom = dist < 70;
    if (atBottom) unread = 0;
    updateFab();
    if (D.main.dataset.mode !== 'thread') return;
    const h = D.lt.offsetHeight || 60;
    const p = clamp((st - 4) / (h * 0.75), 0, 1);
    D.nav.style.setProperty('--navp', p);
    D.nav.classList.toggle('collapsed', p > 0.65);
    if (st < 0) { D.lt.style.transform = `scale(${1 + Math.min(0.1, -st / 800)})`; D.lt.style.opacity = ''; }
    else { D.lt.style.transform = p ? `translate3d(0,${p * 6}px,0) scale(${1 - p * 0.04})` : ''; D.lt.style.opacity = 1 - p * 0.9; }
  });
}
async function launch() {
  const L = $('#launch'); const lm = $('#l-mark');
  lm.innerHTML = logoSVG(); D.homeMark.innerHTML = logoSVG();
  D.homeMark.classList.add('static');
  await sleep(RM ? 150 : 1150);
  const finish = () => { L.remove(); showHome(); };
  if (document.startViewTransition && !RM) {
    lm.style.viewTransitionName = 'logo';
    try {
      const vt = document.startViewTransition(() => { finish(); D.homeMark.style.viewTransitionName = 'logo'; });
      vt.finished.finally(() => { D.homeMark.style.viewTransitionName = ''; });
      return;
    } catch (e) { /* fall through */ }
  }
  // Fallback shared-element morph (FLIP)
  const a = lm.getBoundingClientRect(); const b = D.homeMark.getBoundingClientRect();
  if (RM) { L.classList.add('out'); setTimeout(finish, 300); return; }
  lm.animate([{ transform: 'none' }, { transform: `translate(${b.left - a.left + (b.width - a.width) / 2}px, ${b.top - a.top + (b.height - a.height) / 2}px) scale(${b.width / a.width})` }], { duration: 700, easing: EASE_SPRING, fill: 'forwards' });
  L.animate([{ backgroundColor: getComputedStyle(L).backgroundColor }, { backgroundColor: 'transparent' }], { duration: 500, fill: 'forwards' });
  $('.l-word', L).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  showHome();
  setTimeout(() => L.remove(), 720);
}
function boot() {
  installSpringEasings();
  applyTheme(); setAccent(settings.accent); applyTextSize();
  convos = loadConvos();
  const ids = { app: '#app', stage: '#stage', drawer: '#drawer', main: '#main', scroller: '#scroller', inner: '#inner', home: '#home', homeMark: '#home-mark', greet: '#greet', greetSub: '#greet-sub', lt: '#lt', ltTitle: '#lt-title', ltSub: '#lt-sub', list: '#messages', chips: '#chips', chipsWrap: '#chips-wrap', nav: '#nav', menuBtn: '#menu-btn', modelBtn: '#model-btn', newBtn: '#new-btn', npTitle: '#np-title', fab: '#fab', badge: '#badge', pop: '#pop', composer: '#composer', cmpCtx: '#cmp-ctx', atts: '#cmp-atts', input: '#input', ph: '#ph', primary: '#primary', plusBtn: '#plus-btn', shield: '#shield', ctx: '#ctx', lightbox: '#lightbox', voice: '#voice', fx: '#fx', srLive: '#sr-live', sheets: '#sheets', menuRoot: '#menu-root', toasts: '#toasts' };
  for (const [k, s] of Object.entries(ids)) D[k] = $(s);

  // static icons
  const put = (s, h) => { const n = $(s); if (n) n.innerHTML = h; };
  put('#menu-btn', ICON.menu); put('#new-btn', ICON.compose); put('#d-new', ICON.compose);
  put('#np-chev', ICON.chevDown); put('#np-chev2', ICON.chevDown); put('#fab-ic', ICON.down);
  put('#d-search-ic', ICON.search); put('#d-clear', ICON.xCircle); put('#gear-ic', ICON.gear);
  put('#plus-btn', ICON.plus); put('.pi-mic', ICON.mic); put('.pi-send', ICON.up); put('.pi-stop', ICON.stop);
  put('#rec-trash', ICON.trash); put('#lk-ic', ICON.lock); put('#lk-chev', ICON.chevUp);
  applyTheme();
  const m = modelOf(settings.model); $('#np-model-name').textContent = m.name; $('#np-model-small').textContent = m.name;

  Island.init(); Drawer.init(); Composer.init(); KB.init();
  bindListGestures(); chartBind(D.list);
  D.list.addEventListener('click', onListClick);
  D.scroller.addEventListener('scroll', onScroll, { passive: true });
  D.scroller.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  D.scroller.addEventListener('touchend', () => { touching = false; onScroll(); }, { passive: true });

  D.menuBtn.addEventListener('click', () => Drawer.toggle(!Drawer.open));
  D.newBtn.addEventListener('click', () => newChat());
  $('#d-new').addEventListener('click', () => newChat());
  D.modelBtn.addEventListener('click', () => ModelMenu.toggle());
  $('#theme-btn').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark', { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 });
    haptic();
  });
  $('#open-settings').addEventListener('click', () => openSettings());
  D.fab.addEventListener('click', () => { haptic(); scrollToBottom(true); });
  D.chips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    haptic(); D.input.value = c.dataset.p; Composer.grow(); Composer.refresh(); Composer.send();
  });
  addEventListener('online', () => Island.offline(false));
  addEventListener('offline', () => Island.offline(true));
  if (navigator.onLine === false) setTimeout(() => Island.offline(true), 1600);
  addEventListener('pagehide', () => { LS.set('lumen.convos', convos); LS.set('lumen.settings', settings); });
  addEventListener('resize', () => {
    Drawer.apply(Drawer.sp.value);
    Sheets.stack.forEach((s) => { s.panel.style.height = s.H - s.pos('large') + 'px'; s.y.set(s.pos(s.det)); });
  });
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Drawer.toggle(true); setTimeout(() => $('#d-q').focus(), 200); }
    if (e.key === 'Escape' && Drawer.open && !Sheets.stack.length) Drawer.toggle(false);
  });

  setMode('home');
  makeIcons();
  launch();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
