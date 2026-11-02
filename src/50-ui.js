/* =====================================================================
   18. Dynamic-Island status pill (clip-path morph driven by springs)
   ===================================================================== */
const Island = {
  W: 300, H: 38, sticky: null, t: 0, genT: 0, genStart: 0,
  init() {
    this.bg = $('#is-bg'); this.c = $('#is-c'); this.live = $('#island-live');
    this.w = new Spring(96, { ...SPR.bouncy, stiffness: 380, damping: 21, precision: 0.2 }, () => this.apply());
    this.o = new Spring(0, { ...SPR.snappy, precision: 0.002 }, () => this.apply());
    this.apply();
  },
  apply() {
    const w = clamp(this.w.value, 20, this.W + 30), o = clamp(this.o.value, 0, 1.2);
    const h = lerp(14, this.H, clamp(o, 0, 1));
    const ix = (this.W - w) / 2, iy = (this.H - h) / 2;
    this.bg.style.clipPath = `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${h / 2}px)`;
    this.bg.style.opacity = clamp(o * 2.2, 0, 1);
    this.c.style.opacity = clamp((o - 0.4) * 2, 0, 1);
  },
  render(icon, text, extra = '') {
    this.c.innerHTML = `<span class="is-in">${icon}<span>${esc(text)}</span>${extra}</span>`;
    const inn = this.c.firstElementChild;
    const w = Math.min(this.W, inn.scrollWidth + 4);
    this.live.textContent = text;
    return w;
  },
  show(icon, text, extra) { const w = this.render(icon, text, extra); this.o.to(1); this.w.to(w); },
  hide() { this.o.to(0); this.w.to(96); },
  flash(kind, text, ms = 1500) {
    const icons = { copied: ICON.check, saved: ICON.check, error: ICON.alert, online: ICON.wifi, info: ICON.info };
    const color = kind === 'error' ? 'color:#FF6B5E' : kind === 'online' || kind === 'copied' || kind === 'saved' ? 'color:#4CD964' : '';
    this.show(`<span style="${color}">${icons[kind] || ICON.info}</span>`, text);
    clearTimeout(this.t);
    this.t = setTimeout(() => this.restore(), ms);
  },
  restore() {
    if (this.sticky === 'offline') this.show(`<span style="color:#FF9F0A">${ICON.wifiOff}</span>`, 'Offline');
    else if (this.sticky === 'gen') this.generating(true);
    else this.hide();
  },
  generating(resume) {
    this.sticky = 'gen';
    if (!resume) this.genStart = performance.now();
    clearTimeout(this.t);
    this.show('<span class="is-orb"></span>', 'Generating', '<span class="is-t">0.0s</span>');
    clearInterval(this.genT);
    this.genT = setInterval(() => { const t = $('.is-t', this.c); if (t) t.textContent = ((performance.now() - this.genStart) / 1000).toFixed(1) + 's'; }, 100);
  },
  done(stopped) {
    clearInterval(this.genT);
    this.sticky = navigator.onLine === false ? 'offline' : null;
    this.flash(stopped ? 'info' : 'saved', stopped ? 'Stopped' : 'Done', 900);
  },
  offline(on) {
    this.sticky = on ? 'offline' : (streaming ? 'gen' : null);
    if (on) { clearTimeout(this.t); this.restore(); haptic(); }
    else this.flash('online', 'Back online', 1600);
  },
};

/* =====================================================================
   19. Toasts
   ===================================================================== */
function toast(text, o = {}) {
  const t = el(`<div class="toast glass" role="status">${o.icon ? `<span class="t-ic">${o.icon}</span>` : ''}<span>${esc(text)}</span>${o.action ? `<button class="t-act">${esc(o.action)}</button>` : ''}</div>`);
  D.toasts.appendChild(t);
  const sp = new Spring(1, SPR.bouncy, (v) => { t.style.transform = `translate3d(0,${v * 60}px,0) scale(${1 - v * 0.15})`; t.style.opacity = 1 - v; });
  sp.to(0);
  let gone = false;
  const kill = async () => { if (gone) return; gone = true; Object.assign(sp, SPR.snappy); await sp.to(1); t.remove(); };
  if (o.action) $('.t-act', t).addEventListener('click', () => { haptic(); o.onAction && o.onAction(); kill(); });
  setTimeout(kill, o.ms || (o.action ? 4200 : 2400));
  return kill;
}

/* =====================================================================
   20. Stage (scales back when a sheet is presented, like iOS)
   ===================================================================== */
const Stage = {
  update() {
    const top = Sheets.stack[Sheets.stack.length - 1];
    const p = top && top.detents.includes('large') ? clamp(top.p || 0, 0, 1) : 0;
    const k = top ? (top.det === 'large' || p > 0.6 ? p : p * 0.5) : 0;
    const s = 1 - 0.075 * k;
    D.stage.style.transform = k > 0.001 ? `translate3d(0,${k * (safeTop() * 0.55 + 4)}px,0) scale(${s})` : '';
    D.stage.classList.toggle('carded', k > 0.001);
  },
};

/* =====================================================================
   21. Bottom sheet with detents, velocity, rubber-banding
   ===================================================================== */
const Sheets = { stack: [] };
class Sheet {
  constructor({ title = '', content = '', cls = '', detents = ['medium', 'large'], onClose = null, onOpen = null }) {
    this.detents = detents; this.onClose = onClose; this.p = 0; this.cur = 0;
    this.layer = el(`<div class="sheet-layer ${cls}"><div class="sheet-scrim"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-grab" aria-hidden="true"><i></i></div><header class="sheet-head"><button class="ib sheet-x" aria-label="Close">${ICON.x}</button><h2 class="sheet-title">${esc(title)}</h2><div class="sheet-hr"></div></header><div class="sheet-body"></div></section></div>`);
    this.panel = $('.sheet', this.layer); this.body = $('.sheet-body', this.layer); this.scrim = $('.sheet-scrim', this.layer);
    if (typeof content === 'string') this.body.innerHTML = content; else if (content) this.body.appendChild(content);
    D.sheets.appendChild(this.layer);
    this.y = new Spring(this.H, { ...SPR.smooth, stiffness: 340, damping: 35, precision: 0.15 }, (v) => this.apply(v));
    this.scrim.addEventListener('click', () => this.close());
    $('.sheet-x', this.layer).addEventListener('click', () => this.close());
    this.layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.bindGesture();
    if (onOpen) onOpen(this);
  }
  get H() { return D.app.clientHeight; }
  pos(d) { const H = this.H; return d === 'large' ? safeTop() + 10 : d === 'medium' ? Math.round(H * 0.46) : d === 'small' ? Math.round(H * 0.62) : H; }
  apply(y) {
    this.cur = y;
    this.panel.style.transform = `translate3d(0,${y}px,0)`;
    const H = this.H, L = this.pos(this.detents.includes('large') ? 'large' : this.detents[0]);
    this.p = clamp((H - y) / Math.max(1, H - L), 0, 1.3);
    this.scrim.style.opacity = Math.min(1, this.p * 1.5);
    Stage.update();
  }
  open(d = this.detents[0]) {
    Sheets.stack.push(this);
    this.panel.style.height = this.H - this.pos('large') + 'px';
    this.det = d; this.lockScroll();
    D.stage.setAttribute('inert', '');
    this.prevFocus = document.activeElement;
    if (RM) { this.layer.classList.add('rm-fade'); this.y.set(this.pos(d)); }
    else { this.y.set(this.H); this.y.to(this.pos(d)); }
    haptic();
    setTimeout(() => $('.sheet-x', this.layer).focus({ preventScroll: true }), 40);
    return this;
  }
  lockScroll() { this.body.classList.toggle('locked', this.det !== 'large' && this.detents.includes('large')); }
  snap(d, v = 0) {
    if (d === 'closed') return this.close(v);
    if (d !== this.det) haptic('select');
    this.det = d; this.lockScroll();
    this.y.to(this.pos(d), { velocity: v });
  }
  async close(v = 0) {
    if (this.closing) return; this.closing = true;
    const i = Sheets.stack.indexOf(this); if (i >= 0) Sheets.stack.splice(i, 1);
    if (!Sheets.stack.length) D.stage.removeAttribute('inert');
    if (RM) { this.layer.classList.add('rm-out'); await sleep(200); }
    else { Object.assign(this.y, { stiffness: 380, damping: 40 }); await this.y.to(this.H + 20, { velocity: v }); }
    this.layer.remove(); Stage.update();
    if (this.onClose) this.onClose();
    try { this.prevFocus && this.prevFocus.focus && this.prevFocus !== D.input && this.prevFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  bindGesture() {
    let y0 = 0, fromBody = false;
    gesture(this.panel, {
      start: (pt) => {
        if (pt.target.closest('input[type="range"], .no-gesture, .seg, iframe')) return false;
        y0 = this.cur; fromBody = !!pt.target.closest('.sheet-body');
        return true;
      },
      lock: (axis, dx, dy) => {
        if (axis !== 'y') return false;
        if (!fromBody) { this.y.stop(); y0 = this.cur; return true; }
        if (this.det !== 'large' && this.detents.includes('large')) { this.y.stop(); y0 = this.cur; return true; }
        if (this.body.scrollTop <= 0 && dy > 0) { this.y.stop(); y0 = this.cur; return true; }
        return false;
      },
      move: (dx, dy) => {
        const top = this.pos(this.detents.includes('large') ? 'large' : this.detents[0]);
        let y = y0 + dy;
        if (y < top) y = top - rubber(top - y, this.H * 0.4);
        this.y.set(y);
      },
      end: ({ vy }) => {
        const proj = this.cur + vy * 0.22;
        const cands = this.detents.map((d) => [d, this.pos(d)]).concat([['closed', this.H]]);
        let best = cands[0];
        for (const c of cands) if (Math.abs(c[1] - proj) < Math.abs(best[1] - proj)) best = c;
        if (vy > 1600) best = cands.filter((c) => c[1] > this.cur + 4)[0] || ['closed', this.H];
        this.snap(best[0], vy);
      },
    });
  }
}

/* =====================================================================
   22. Drawer: edge-swipe, parallax card stack, row swipe actions, search
   ===================================================================== */
const Drawer = {
  open: false, showArchived: false,
  init() {
    this.el = D.drawer;
    this.sp = new Spring(0, { ...SPR.smooth, stiffness: 300, damping: 32, precision: 0.0006 }, (p) => this.apply(p));
    // edge swipe on main (closed) / drag on shield (open)
    gesture(D.main, {
      start: (pt) => {
        if (Sheets.stack.length || Ctx.open || Rec.active) return false;
        if (!this.open) return pt.x < 26;
        return true;
      },
      lock: (axis, dx) => axis === 'x' && (this.open ? true : dx > 0),
      grab: () => { this.sp.stop(); this.p0 = this.sp.value; if (!this.open) this.prepare(); },
      move: (dx) => this.drag(dx),
      end: ({ vx }) => this.release(vx),
    });
    gesture(D.drawer, {
      start: (pt) => this.open && !pt.target.closest('.d-row, input'),
      lock: (axis, dx) => axis === 'x' && dx < 0,
      grab: () => { this.sp.stop(); this.p0 = this.sp.value; },
      move: (dx) => this.drag(dx),
      end: ({ vx }) => this.release(vx),
    });
    D.shield.addEventListener('click', () => this.toggle(false));
    this.bindRows();
    const q = $('#d-q');
    q.addEventListener('input', () => { $('#d-clear').hidden = !q.value; this.render(); });
    $('#d-clear').addEventListener('click', (e) => { e.preventDefault(); q.value = ''; $('#d-clear').hidden = true; this.render(); q.focus(); });
    $('#d-list').addEventListener('click', (e) => this.onClick(e));
  },
  get off() { return Math.min(innerWidth * 0.84, 340); },
  prepare() { this.render(); },
  drag(dx) {
    const raw = this.p0 + dx / this.off;
    const p = raw > 1 ? 1 + rubber(raw - 1, 0.25, 0.5) : raw < 0 ? -rubber(-raw, 0.05, 0.5) : raw;
    this.sp.set(p);
  },
  release(vx) {
    const v = vx / this.off;
    const proj = this.sp.value + v * 0.25;
    this.toggle(proj > 0.5, vx);
  },
  apply(p) {
    const off = this.off;
    const s = 1 - 0.08 * clamp(p, 0, 1.2);
    D.main.style.transform = p > 0.0005 || p < -0.0005 ? `translate3d(${p * off}px,0,0) scale(${s})` : '';
    D.main.classList.toggle('carded', p > 0.002);
    this.el.style.transform = `translate3d(${(clamp(p, 0, 1.3) - 1) * off * 0.32}px,0,0)`;
    this.el.style.opacity = clamp(0.25 + p * 0.75, 0, 1);
  },
  toggle(open, vx = 0) {
    const was = this.open;
    this.open = open;
    if (open && !was) this.render();
    if (open !== was) haptic();
    D.drawer.toggleAttribute('inert', !open);
    D.menuBtn.setAttribute('aria-expanded', open);
    $$('#scroller, #nav, #composer, #chips-wrap', D.main).forEach((n) => n.toggleAttribute('inert', open));
    if (open && document.activeElement === D.input) D.input.blur();
    this.sp.to(open ? 1 : 0, { velocity: vx / this.off });
    if (!open) this.closeRow();
  },
  refreshIfOpen() { if (this.open) this.render(); },
  hl(t, q) {
    if (!q) return esc(t);
    const lo = t.toLowerCase(); let i = 0, out = '', j;
    while ((j = lo.indexOf(q, i)) !== -1) { out += esc(t.slice(i, j)) + '<mark>' + esc(t.slice(j, j + q.length)) + '</mark>'; i = j + q.length; }
    return out + esc(t.slice(i));
  },
  snippet(c, q) {
    if (q) {
      for (const m of c.messages) {
        const t = plainOf(m).replace(/\s+/g, ' '); const k = t.toLowerCase().indexOf(q);
        if (k >= 0) { const s = Math.max(0, k - 30); return (s ? '…' : '') + t.slice(s, s + 110); }
      }
    }
    const last = c.messages[c.messages.length - 1];
    return last ? plainOf(last).replace(/\s+/g, ' ').slice(0, 120) : '';
  },
  rowHTML(c, q) {
    return `<div class="d-row ${current && c.id === current.id ? 'active' : ''}" role="listitem" data-id="${c.id}">
      <div class="d-acts" aria-hidden="true">
        <button class="d-act d-pin" data-a="pin" tabindex="-1"><span class="ai">${ICON.pin}<span>${c.pinned ? 'Unpin' : 'Pin'}</span></span></button>
        <button class="d-act d-arch" data-a="archive" tabindex="-1"><span class="ai">${ICON.archive}<span>${c.archived ? 'Restore' : 'Archive'}</span></span></button>
        <button class="d-act d-del" data-a="delete" tabindex="-1"><span class="ai">${ICON.trash}<span>Delete</span></span></button>
      </div>
      <button class="d-content" data-open="${c.id}" aria-label="${esc(c.title)}${c.pinned ? ', pinned' : ''}"><div class="d-l1"><span class="d-t">${c.pinned ? ICON.pin : ''}<span>${this.hl(c.title, q)}</span></span><time>${relTime(c.updated)}</time></div><div class="d-l2">${this.hl(this.snippet(c, q), q)}</div></button>
    </div>`;
  },
  render() {
    const q = $('#d-q').value.trim().toLowerCase();
    const list = $('#d-list');
    let items = convos.filter((c) => c.messages.length);
    if (q) items = items.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => plainOf(m).toLowerCase().includes(q)));
    items.sort((a, b) => b.updated - a.updated);
    const live = items.filter((c) => !c.archived), arch = items.filter((c) => c.archived);
    const groups = [];
    const pinned = live.filter((c) => c.pinned); if (pinned.length) groups.push([`${ICON.pin} Pinned`, pinned]);
    const rest = live.filter((c) => !c.pinned);
    const by = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
    rest.forEach((c) => { const d = dayDiff(c.updated); (d <= 0 ? by.Today : d === 1 ? by.Yesterday : d < 7 ? by['Previous 7 days'] : by.Older).push(c); });
    Object.entries(by).forEach(([k, v]) => v.length && groups.push([k, v]));
    let html = groups.map(([t, cs]) => `<div class="d-sec">${t}</div>${cs.map((c) => this.rowHTML(c, q)).join('')}`).join('');
    if (arch.length) {
      if (this.showArchived || q) html += `<div class="d-sec">${ICON.archive} Archived</div>${arch.map((c) => this.rowHTML(c, q)).join('')}`;
      if (!q) html += `<button class="d-arch-toggle" data-a="toggle-arch">${ICON.archive}${this.showArchived ? 'Hide archived' : `Archived chats (${arch.length})`}</button>`;
    }
    if (!items.length) html = q ? `<div class="d-empty"><b>No results</b>Nothing matches “${esc(q)}”.</div>` : `<div class="d-empty"><b>No chats yet</b>Start a conversation and it will show up here.</div>`;
    list.innerHTML = html;
    this.openRowEl = null;
  },
  flipRender() {
    const list = $('#d-list');
    const before = new Map($$('.d-row', list).map((r) => [r.dataset.id, r.getBoundingClientRect().top]));
    this.render();
    $$('.d-row', list).forEach((r) => {
      const b = before.get(r.dataset.id);
      if (b == null) { r.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE_SPRING }); return; }
      const d = b - r.getBoundingClientRect().top;
      if (Math.abs(d) > 0.5) r.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'none' }], { duration: 560, easing: EASE_SPRING });
    });
  },
  /* row swipe */
  rowState(row) {
    if (!row._st) {
      const content = $('.d-content', row), acts = $$('.d-act', row);
      row._st = { content, acts, full: 0, x: 0 };
      row._st.sp = new Spring(0, { ...SPR.smooth, stiffness: 400, damping: 38, precision: 0.2 }, (x) => this.applyRow(row, x));
      row._st.fs = new Spring(0, { ...SPR.snappy, precision: 0.002 }, () => this.applyRow(row, row._st.x));
    }
    return row._st;
  },
  applyRow(row, x) {
    const st = row._st; st.x = x;
    const W = row.clientWidth, n = st.acts.length, f = st.fs.value, nx = Math.min(0, x);
    st.content.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    // each action's left edge spreads proportionally (iOS-style); in full-swipe
    // they all converge on the content edge and Delete (top layer) covers the row
    st.acts.forEach((a, i) => {
      const normal = W + (nx * (n - i)) / n;
      a.style.transform = `translate3d(${lerp(normal, W + nx, f)}px,0,0)`;
    });
  },
  closeRow(except) {
    const r = this.openRowEl; if (r && r !== except && r.isConnected) this.rowState(r).sp.to(0);
    if (r !== except) this.openRowEl = null;
  },
  bindRows() {
    const list = $('#d-list'); let row = null, st = null, x0 = 0;
    const A = 76;
    gesture(list, {
      start: (pt) => { row = pt.target.closest('.d-row'); return !!row; },
      lock: (axis, dx) => {
        if (axis !== 'x') return false;
        st = this.rowState(row);
        if (dx > 0 && st.x >= 0) return false;  // let drawer handle? (no: drawer only closes on left drag)
        this.closeRow(row); st.sp.stop(); x0 = st.x; return true;
      },
      move: (dx) => {
        const W = row.clientWidth; let x = x0 + dx;
        if (x > 0) x = rubber(x, 50);
        if (x < -W) x = -W - rubber(-W - x, 40);
        st.sp.set(x);
        const full = x < -W * 0.6 ? 1 : 0;
        if (full !== st.full) { st.full = full; st.fs.to(full); haptic(full ? 'heavy' : 'select'); }
      },
      end: ({ vx }) => {
        const O = A * 3, W = row.clientWidth;
        if (st.full) { this.rowAction(row, 'delete', vx); return; }
        const proj = st.x + vx * 0.2;
        if (proj < -O / 2) { st.sp.to(-O, { velocity: vx }); this.openRowEl = row; }
        else { st.sp.to(0, { velocity: vx }); if (this.openRowEl === row) this.openRowEl = null; }
      },
    });
  },
  onClick(e) {
    const a = e.target.closest('[data-a]');
    if (a) {
      if (a.dataset.a === 'toggle-arch') { this.showArchived = !this.showArchived; haptic('select'); this.flipRender(); return; }
      this.rowAction(a.closest('.d-row'), a.dataset.a); return;
    }
    const o = e.target.closest('[data-open]'); if (!o) return;
    if (this.openRowEl) { this.closeRow(); return; }
    openConvo(o.dataset.open);
  },
  async rowAction(row, act, vx = 0) {
    const c = convos.find((x) => x.id === row.dataset.id); if (!c) return;
    const st = this.rowState(row);
    if (act === 'delete') {
      haptic('heavy');
      st.fs.to(1);
      await st.sp.to(-row.clientWidth - 10, { velocity: Math.min(vx, -800) });
      const i = convos.indexOf(c); convos.splice(i, 1); save();
      collapseRemove(row);
      setTimeout(() => this.flipRender(), 540);
      if (current && current.id === c.id) { current = null; renderThread(); }
      toast('Chat deleted', { icon: ICON.trash, action: 'Undo', onAction: () => { convos.splice(i, 0, c); save(); this.flipRender(); } });
      this.openRowEl = null;
      return;
    }
    await st.sp.to(0);
    this.openRowEl = null;
    if (act === 'pin') { c.pinned = !c.pinned; Island.flash('saved', c.pinned ? 'Pinned' : 'Unpinned'); }
    if (act === 'archive') { c.archived = !c.archived; Island.flash('saved', c.archived ? 'Archived' : 'Restored'); }
    haptic(); save(); this.flipRender();
  },
};

async function openConvo(id) {
  const c = convos.find((x) => x.id === id); if (!c) return;
  Speak.stop(); VoicePlay.stop();
  Drawer.toggle(false);
  if (current && current.id === id) return;
  current = c;
  Composer.clearCtx();
  showSkeleton();
  await sleep(RM ? 120 : 420);
  if (current !== c) return;
  renderThread({ stagger: true });
}
function newChat() {
  Speak.stop(); VoicePlay.stop();
  if (streaming) stopStreaming();
  const go = () => { current = null; Composer.clearCtx(); renderThread(); };
  if (D.main.dataset.mode === 'home') { Drawer.toggle(false); return; }
  Drawer.toggle(false);
  if (document.startViewTransition && !RM) {
    D.inner.style.viewTransitionName = 'thread';
    document.documentElement.classList.add('vt-thread');
    try {
      const vt = document.startViewTransition(go);
      vt.finished.finally(() => { D.inner.style.viewTransitionName = ''; document.documentElement.classList.remove('vt-thread'); });
    } catch (e) { go(); }
  } else go();
  haptic();
}

/* =====================================================================
   23. Home: greeting + suggestion chips
   ===================================================================== */
const CHIPS = [
  { t: 'Plan a weekend in Kyoto', s: 'Weather, cafés and a map', ic: ICON.mapPin, p: 'What will the weather be like in Kyoto this week?' },
  { t: 'Debug a React hook', s: 'Debounced search with abort', ic: ICON.code, p: 'Write a React hook for debounced search that cancels stale requests' },
  { t: 'Chart our revenue', s: 'Interactive, scrubbable', ic: ICON.chart, p: 'Chart our monthly revenue growth and break it down by quarter' },
  { t: 'Research flights', s: 'Watch the tools run', ic: ICON.research, p: 'Research the best time to book flights to Tokyo' },
];
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ['Still up?', 'Night owls get the quiet hours. What are we making?'];
  if (h < 12) return ['Good morning', 'Fresh start. What should we tackle first?'];
  if (h < 17) return ['Good afternoon', 'What can I help you move forward?'];
  if (h < 22) return ['Good evening', 'What should we make tonight?'];
  return ['Good night', 'One more idea before bed?'];
}
function showHome() {
  const [g, s] = greeting();
  D.greet.innerHTML = `${esc(g)}<span class="g-acc">.</span>`;
  D.greetSub.textContent = s;
  D.chips.innerHTML = CHIPS.map((c, i) => `<button class="chip glass" role="listitem" style="--i:${i}" data-p="${esc(c.p)}"><span class="chip-ic">${c.ic}</span><b>${esc(c.t)}</b><small>${esc(c.s)}</small></button>`).join('');
  D.home.classList.remove('in'); D.chips.classList.remove('in');
  void D.home.offsetWidth;
  D.home.classList.add('in'); D.chips.classList.add('in');
  updateFab();
}

/* =====================================================================
   24. Model switcher menu (spring scale from its origin)
   ===================================================================== */
const ModelMenu = {
  open: false,
  toggle() { this.open ? this.close() : this.show(); },
  show() {
    this.open = true; haptic();
    const r = D.modelBtn.getBoundingClientRect();
    const layer = el(`<div class="menu-layer"><div class="menu-shield"></div><div class="menu-pop glass" role="menu" aria-label="Models">${MODELS.map((m, i) => `<button class="mi" role="menuitemradio" aria-checked="${m.id === settings.model}" data-id="${m.id}" style="--i:${i}"><span class="mi-ic">${i === 2 ? ICON.brain : i === 1 ? ICON.bolt : ICON.sparkle}</span><div><b>${m.name}</b><small>${m.d}</small></div><span class="mi-ck">${ICON.check}</span></button>`).join('')}<div class="mi-sep"></div><button class="mi" role="menuitem" data-id="details" style="--i:3"><span class="mi-ic">${ICON.info}</span><div><b>Compare models</b><small>Speed, reasoning, context</small></div></button></div></div>`);
    D.menuRoot.appendChild(layer); this.layer = layer;
    const pop = $('.menu-pop', layer);
    const W = 288; const left = clamp(r.left + r.width / 2 - W / 2, 10, innerWidth - W - 10);
    pop.style.left = left + 'px'; pop.style.top = r.bottom + 8 + 'px';
    pop.style.transformOrigin = `${r.left + r.width / 2 - left}px -8px`;
    this.sp = new Spring(0, { ...SPR.bouncy, stiffness: 460, damping: 26, precision: 0.001 }, (p) => {
      pop.style.transform = `scale(${lerp(0.3, 1, p)})`; pop.style.opacity = clamp(p * 2.2, 0, 1);
    });
    this.sp.to(1);
    D.modelBtn.setAttribute('aria-expanded', 'true');
    $('.menu-shield', layer).addEventListener('click', () => this.close());
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('.mi'); if (!b) return;
      if (b.dataset.id === 'details') { this.close(); openModelDetails(); return; }
      setModel(b.dataset.id); this.close();
    });
    this.key = (e) => { if (e.key === 'Escape') this.close(); };
    addEventListener('keydown', this.key);
    setTimeout(() => $('.mi[aria-checked="true"]', pop)?.focus({ preventScroll: true }), 30);
  },
  async close() {
    if (!this.open) return; this.open = false;
    removeEventListener('keydown', this.key);
    D.modelBtn.setAttribute('aria-expanded', 'false');
    const layer = this.layer; $('.menu-shield', layer).style.pointerEvents = 'none';
    Object.assign(this.sp, SPR.snappy); await this.sp.to(0); layer.remove();
  },
};
function setModel(id) {
  settings.model = id; save(); haptic();
  const m = modelOf(id);
  $('#np-model-name').textContent = m.name; $('#np-model-small').textContent = m.name;
  Island.flash('info', `Switched to ${m.name}`, 1200);
}
function openModelDetails() {
  const s = new Sheet({
    title: 'Models', detents: ['medium', 'large'],
    content: MODELS.map((m) => `<div class="md-card ${m.id === settings.model ? 'sel' : ''}" data-id="${m.id}"><h3>${m.name} <span class="tag">${m.tag}</span></h3><p>${m.d}</p>
      <div class="stat"><span>Speed</span><span class="bar"><i style="--v:${m.speed}"></i></span></div>
      <div class="stat"><span>Reasoning</span><span class="bar"><i style="--v:${m.iq}"></i></span></div>
      <div class="stat"><span>Context</span><span class="tnum" style="color:var(--fg)">${m.ctx} tokens</span></div>
      <button class="btn-acc" data-use="${m.id}">${m.id === settings.model ? 'Current model' : 'Use ' + m.name}</button></div>`).join(''),
  });
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-use]'); if (!b) return;
    setModel(b.dataset.use);
    $$('.md-card', s.body).forEach((c) => { c.classList.toggle('sel', c.dataset.id === settings.model); $('.btn-acc', c).textContent = c.dataset.id === settings.model ? 'Current model' : 'Use ' + modelOf(c.dataset.id).name; });
  });
  s.open('medium');
}

/* =====================================================================
   25. Settings sheet
   ===================================================================== */
function segHTML(name, opts, val) {
  return `<div class="seg" data-seg="${name}" role="radiogroup">${'<span class="seg-thumb"></span>'}${opts.map(([v, l]) => `<button role="radio" data-v="${v}" aria-pressed="${String(v) === String(val)}" aria-checked="${String(v) === String(val)}">${l}</button>`).join('')}</div>`;
}
function bindSeg(seg, onChange) {
  const thumb = $('.seg-thumb', seg);
  const sp = new Spring(0, { ...SPR.bouncy, stiffness: 420, damping: 30, precision: 0.2 }, (x) => { thumb.style.transform = `translate3d(${x}px,0,0)`; });
  const place = (anim) => {
    const on = $('[aria-pressed="true"]', seg); if (!on) return;
    thumb.style.width = on.offsetWidth + 'px';
    const x = on.offsetLeft - 2; anim ? sp.to(x) : sp.set(x);
  };
  requestAnimationFrame(() => place(false));
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
    $$('button', seg).forEach((x) => { x.setAttribute('aria-pressed', x === b); x.setAttribute('aria-checked', x === b); });
    place(true); haptic('select');
    onChange(b.dataset.v, e);
  });
}
function openSettings() {
  Drawer.toggle(false);
  const sw = (k, label, ic, color) => `<label class="cell"><span class="c-ic" style="background:${color}">${ic}</span><span class="c-l">${label}</span><input type="checkbox" class="sw-t" data-k="${k}" ${settings[k] ? 'checked' : ''} aria-label="${label}"></label>`;
  const html = `
  <div class="grp-t">Appearance</div>
  <div class="grp">
    <div class="cell col"><span>Theme</span>${segHTML('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], settings.theme)}</div>
    <div class="cell col"><span>Accent colour</span><div class="swatches" role="radiogroup" aria-label="Accent colour">${Object.entries(ACCENTS).map(([k, a]) => `<button class="swatch" role="radio" aria-checked="${k === settings.accent}" data-acc="${k}" style="--c:${a.c}" aria-label="${a.n}"><i></i></button>`).join('')}</div></div>
    <div class="cell col"><span>Text size</span>
      <div class="range-row"><span class="rr-s">A</span><input type="range" min="0" max="4" step="1" value="${settings.textSize}" data-r="textSize" aria-label="Text size"><span class="rr-b">A</span></div>
      <div class="preview" aria-hidden="true"><div class="bubble tail">Does this size feel right?</div><div class="pv-ai">Text updates live across the whole app — like Dynamic Type.</div></div>
    </div>
  </div>
  <div class="grp-t">Responses</div>
  <div class="grp">
    <div class="cell col"><span style="display:flex;justify-content:space-between">Streaming speed <span class="c-v tnum" id="spd-v">${settings.speed.toFixed(2)}×</span></span>
      <div class="range-row"><span class="rr-s">${ICON.timer.replace('<svg', '<svg style="width:18px;height:18px"')}</span><input type="range" min="0.5" max="2" step="0.25" value="${settings.speed}" data-r="speed" aria-label="Streaming speed"><span class="rr-s">${ICON.bolt.replace('<svg', '<svg style="width:18px;height:18px"')}</span></div></div>
    ${sw('reasoning', 'Show reasoning', ICON.brain, '#5E5CE6')}
    <button class="cell" data-go="models"><span class="c-ic" style="background:#0A84FF">${ICON.sparkle}</span><span class="c-l">Model</span><span class="c-v">${modelOf(settings.model).name}</span>${ICON.chevR.replace('<svg', '<svg class="c-chev"')}</button>
  </div>
  <div class="grp-t">Feedback</div>
  <div class="grp">
    ${sw('haptics', 'Haptics', ICON.vibrate, '#FF9500')}
    ${sw('sound', 'Sound effects', ICON.speaker, '#FF2D55')}
  </div>
  <div class="grp-f">Haptics use the system switch tick on iPhone. Sounds are synthesized live — no audio files.</div>
  <div class="grp-t">Data</div>
  <div class="grp">
    <button class="cell noic" data-go="reset"><span class="c-l">Restore demo conversations</span></button>
    <button class="cell noic danger" data-go="clear"><span class="c-l">Delete all chats</span></button>
  </div>
  <div class="grp-f" style="text-align:center;padding-top:22px">Lumen 1.0 · A UI-craft showcase. The AI is a scripted mock.</div>`;
  const s = new Sheet({ title: 'Settings', content: html, detents: ['large', 'medium'] });
  bindSeg($('[data-seg="theme"]', s.body), (v, e) => setTheme(v, { x: e.clientX || innerWidth / 2, y: e.clientY || 200 }));
  $$('.sw-t', s.body).forEach((i) => i.addEventListener('change', () => {
    settings[i.dataset.k] = i.checked; save();
    if (i.dataset.k === 'sound' && i.checked) { Sound.ensure(); Sound.play('pop'); }
    haptic('select');
  }));
  $$('.swatch', s.body).forEach((b) => b.addEventListener('click', () => {
    $$('.swatch', s.body).forEach((x) => x.setAttribute('aria-checked', x === b));
    setAccent(b.dataset.acc); haptic(); Sound.play('tick');
  }));
  const fillRange = (r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
  $$('input[type="range"]', s.body).forEach((r) => {
    fillRange(r);
    let last = r.value;
    r.addEventListener('input', () => {
      fillRange(r);
      if (r.value !== last) { last = r.value; haptic('select'); }
      if (r.dataset.r === 'textSize') { settings.textSize = +r.value; applyTextSize(); }
      else { settings.speed = +r.value; $('#spd-v', s.body).textContent = settings.speed.toFixed(2) + '×'; }
      save();
    });
  });
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    if (b.dataset.go === 'models') openModelDetails();
    if (b.dataset.go === 'reset') { convos = seedConvos(); current = null; save(); renderThread(); Island.flash('saved', 'Demo restored'); s.close(); }
    if (b.dataset.go === 'clear') { const bak = convos; convos = []; current = null; save(); renderThread(); s.close(); toast('All chats deleted', { icon: ICON.trash, action: 'Undo', onAction: () => { convos = bak; save(); } }); }
  });
  s.open('large');
}

/* =====================================================================
   26. Artifact viewer, select text, attachments sheet, lightbox
   ===================================================================== */
function openArtifact(art) {
  const isHTML = /^(html|svg)$/i.test(art.lang);
  const content = el(`<div>${isHTML ? `<div class="av-tabs">${segHTML('av', [['preview', 'Preview'], ['code', 'Code']], 'preview')}</div>` : ''}<div class="av-preview" ${isHTML ? '' : 'hidden'}></div><div class="av-code" ${isHTML ? 'hidden' : ''}>${codeHTML(art.code, art.lang)}</div></div>`);
  const s = new Sheet({ title: art.title || 'Artifact', content, detents: ['large'] });
  if (isHTML) {
    const f = document.createElement('iframe'); f.className = 'av-frame'; f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('title', 'Artifact preview'); f.srcdoc = art.code;
    $('.av-preview', content).appendChild(f);
    bindSeg($('[data-seg="av"]', content), (v) => { $('.av-preview', content).hidden = v !== 'preview'; $('.av-code', content).hidden = v !== 'code'; });
  }
  content.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="copy-code"]'); if (!b) return;
    copyText(art.code); b.classList.add('done'); haptic(); Island.flash('copied', 'Copied');
    setTimeout(() => b.classList.remove('done'), 1800);
  });
  $$('[data-act="art-open"]', content).forEach((b) => b.remove());
  s.open('large');
}
function openSelectText(m) {
  const s = new Sheet({ title: 'Select Text', content: `<div class="sel-text selectable">${esc(plainOf(m))}</div>`, detents: ['medium', 'large'] });
  s.open('medium');
  setTimeout(() => { const n = $('.sel-text', s.body); const r = document.createRange(); r.selectNodeContents(n); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }, 450);
}
function openAttach() {
  D.plusBtn.classList.add('open');
  const opts = [
    ['photos', 'Photos', ICON.photo, 'linear-gradient(145deg,#34C759,#0B7A55)'],
    ['camera', 'Camera', ICON.camera, 'linear-gradient(145deg,#5E5CE6,#3A36B8)'],
    ['files', 'Files', ICON.file, 'linear-gradient(145deg,#0A84FF,#0062CC)'],
    ['web', 'Web search', ICON.globe, 'linear-gradient(145deg,#64D2FF,#0A84FF)'],
    ['research', 'Deep research', ICON.research, 'linear-gradient(145deg,#FF9F0A,#C9431A)'],
    ['image', 'Create image', ICON.sparkle, 'linear-gradient(145deg,#FF375F,#C81E4E)'],
  ];
  const s = new Sheet({
    title: 'Add to message', detents: ['medium'], onClose: () => D.plusBtn.classList.remove('open'),
    content: `<div class="att-grid">${opts.map(([k, l, ic, bg], i) => `<button class="att-opt" data-k="${k}" style="--i:${i}"><span class="ao-ic" style="background:${bg}">${ic}</span>${l}</button>`).join('')}</div>
    <div class="grp-t">Recent</div><div class="grp">${['Summarize this PDF', 'Turn notes into a table', 'Draft a reply'].map((t) => `<button class="cell noic" data-p="${esc(t)}"><span class="c-l">${t}</span>${ICON.chevR.replace('<svg', '<svg class="c-chev"')}</button>`).join('')}</div>`,
  });
  s.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k],[data-p]'); if (!b) return;
    haptic();
    if (b.dataset.p) { s.close(); Composer.setText(b.dataset.p); return; }
    const k = b.dataset.k;
    if (k === 'photos') $('#f-photos').click();
    else if (k === 'camera') $('#f-camera').click();
    else if (k === 'files') $('#f-files').click();
    else Composer.addTool(k);
    s.close();
  });
  s.open('medium');
}
async function openLightbox(tile) {
  const i = +tile.dataset.i; const g = GALLERY[i];
  const lb = D.lightbox; const art = $('.art', tile);
  const build = () => {
    lb.innerHTML = `<div class="lb-bg"></div><div class="lb-img" style="view-transition-name:hero"><div class="art" style="${artStyle(g, i)}"></div></div><div class="lb-cap"><b>${esc(g.t)}</b>Moodboard · ${i + 1} of ${GALLERY.length}</div><button class="ib lb-x" aria-label="Close">${ICON.x}</button>`;
    lb.hidden = false; art.style.viewTransitionName = '';
  };
  haptic();
  if (document.startViewTransition && !RM) { art.style.viewTransitionName = 'hero'; try { await document.startViewTransition(build).finished; } catch (e) { build(); } }
  else build();
  const img = $('.lb-img', lb), bg = $('.lb-bg', lb);
  const sp = new Spring(0, SPR.bouncy, (y) => { img.style.transform = `translate3d(0,${y}px,0) scale(${1 - Math.min(Math.abs(y), 300) / 1200})`; bg.style.opacity = 1 - Math.min(1, Math.abs(y) / 400); });
  const close = async () => {
    const done = () => { lb.hidden = true; lb.innerHTML = ''; art.style.viewTransitionName = ''; };
    if (document.startViewTransition && !RM) {
      try { await document.startViewTransition(() => { done(); art.style.viewTransitionName = 'hero'; }).finished; } catch (e) { done(); }
      art.style.viewTransitionName = '';
    } else done();
  };
  $('.lb-x', lb).addEventListener('click', close);
  bg.addEventListener('click', close);
  gesture(lb, {
    lock: (axis) => axis === 'y',
    move: (dx, dy) => sp.set(dy),
    end: ({ dy, vy }) => { if (Math.abs(dy + vy * 0.2) > 140) close(); else sp.to(0, { velocity: vy }); },
  });
}
