/* =====================================================================
   27. Composer
   ===================================================================== */
const PLACEHOLDERS = ['Ask anything…', 'Plan 3 days in Kyoto', 'Type / for commands', 'Mention @Coder for code help', 'Chart our revenue growth', 'Hold the mic to talk'];
const CMDS = [
  { k: 'weather', d: 'Forecast card', ic: ICON.sun, p: "What's the weather in Kyoto this week?" },
  { k: 'map', d: 'Find a place nearby', ic: ICON.mapPin, p: 'Find a quiet coffee spot near Gion' },
  { k: 'chart', d: 'Interactive chart', ic: ICON.chart, p: 'Chart our monthly revenue growth' },
  { k: 'poll', d: 'Create a poll', ic: ICON.poll, p: 'Create a poll for the team offsite' },
  { k: 'gallery', d: 'Image moodboard', ic: ICON.photo, p: 'Show me moodboard images for a calm reading nook' },
  { k: 'code', d: 'Write some code', ic: ICON.code, p: 'Write a React hook for debounced search' },
  { k: 'table', d: 'Compare options', ic: ICON.table, p: 'Compare SQLite vs Postgres vs DynamoDB for a side project' },
  { k: 'research', d: 'Run tools, step by step', ic: ICON.research, p: 'Research the best time to book flights to Tokyo' },
  { k: 'essay', d: 'Long-form answer', ic: ICON.doc, p: 'Explain why glass works in interface design' },
  { k: 'artifact', d: 'Build a runnable mini-app', ic: ICON.canvas, p: 'Build a pomodoro focus timer' },
  { k: 'error', d: 'Simulate a failure', ic: ICON.alert, p: 'Simulate an error' },
  { k: 'new', d: 'Start a new chat', ic: ICON.compose, run: () => newChat() },
  { k: 'theme', d: 'Toggle dark mode', ic: ICON.moon, run: () => { const r = D.primary.getBoundingClientRect(); setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark', { x: r.left + 22, y: r.top + 22 }); } },
  { k: 'settings', d: 'Open settings', ic: ICON.gear, run: () => openSettings() },
];
function fuzzy(q, s) {
  if (!q) return { score: 1, idx: [] };
  q = q.toLowerCase(); const t = s.toLowerCase();
  let qi = 0, score = 0, last = -2; const idx = [];
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { score += (i === last + 1 ? 3 : 1) + (i === 0 ? 4 : 0); idx.push(i); last = i; qi++; }
  }
  return qi === q.length ? { score, idx } : null;
}
const markIdx = (s, idx) => s.split('').map((ch, i) => (idx.includes(i) ? `<mark>${esc(ch)}</mark>` : esc(ch))).join('');

const Pop = {
  open: false, type: null, items: [], idx: 0,
  show(type, items, header) {
    this.type = type; this.items = items; this.idx = 0;
    const p = D.pop;
    const wasOpen = this.open;
    p.innerHTML = `<div class="pop-h">${header}</div>` + (items.length ? items.map((it, i) => `<button class="pop-i" role="option" id="pop-${i}" aria-selected="${i === 0}" data-i="${i}">${it.html}</button>`).join('') : `<div class="pop-empty">No matches</div>`);
    p.hidden = false; this.open = true;
    D.input.setAttribute('aria-activedescendant', items.length ? 'pop-0' : '');
    D.input.setAttribute('aria-expanded', 'true');
    if (!wasOpen) { p.classList.remove('in'); void p.offsetWidth; p.classList.add('in'); haptic('select'); }
  },
  hide() {
    if (!this.open) return;
    this.open = false; D.pop.hidden = true; D.pop.innerHTML = '';
    D.input.removeAttribute('aria-activedescendant'); D.input.setAttribute('aria-expanded', 'false');
  },
  move(d) {
    if (!this.items.length) return;
    this.idx = (this.idx + d + this.items.length) % this.items.length;
    $$('.pop-i', D.pop).forEach((b, i) => b.setAttribute('aria-selected', i === this.idx));
    const cur = $(`#pop-${this.idx}`); cur && cur.scrollIntoView({ block: 'nearest' });
    D.input.setAttribute('aria-activedescendant', 'pop-' + this.idx);
    haptic('select');
  },
  choose(i = this.idx) {
    const it = this.items[i]; if (!it) return;
    this.hide(); it.pick(); haptic();
  },
  slash(q) {
    const res = CMDS.map((c) => ({ c, f: fuzzy(q, c.k) || (q.length > 1 ? fuzzy(q, c.d) : null) })).filter((x) => x.f).sort((a, b) => b.f.score - a.f.score);
    this.show('slash', res.map(({ c, f }) => ({
      html: `<span class="pi-ic">${c.ic}</span><span><b>/${fuzzy(q, c.k) ? markIdx(c.k, f.idx) : esc(c.k)}</b><small>${esc(c.d)}</small></span><span class="pi-k">${c.run ? '↵ run' : '↵'}</span>`,
      pick: () => { if (c.run) { Composer.setText(''); c.run(); } else Composer.setText(c.p); },
    })), 'Commands');
  },
  mention(q) {
    const res = AGENTS.map((a) => ({ a, f: fuzzy(q, a.n) })).filter((x) => x.f).sort((a, b) => b.f.score - a.f.score);
    this.show('mention', res.map(({ a, f }) => ({
      html: `<span class="pi-ic av" style="background:hsl(${a.h} 60% 45%)">${a.n[0]}</span><span><b>@${markIdx(a.n, f.idx)}</b><small>${esc(a.d)}</small></span>`,
      pick: () => {
        const v = D.input.value, c = D.input.selectionStart;
        const before = v.slice(0, c).replace(/@(\w*)$/, '@' + a.n + ' ');
        Composer.setText(before + v.slice(c), before.length);
      },
    })), 'Agents');
  },
};

const Composer = {
  ctx: null, atts: [], state: 'mic', phI: 0,
  init() {
    const ta = D.input;
    this.hSp = new Spring(44, { stiffness: 520, damping: 40, precision: 0.3 }, (v) => { ta.style.height = v + 'px'; });
    ta.addEventListener('input', () => { this.grow(); this.refresh(); this.detect(); });
    ta.addEventListener('keydown', (e) => this.key(e));
    ta.addEventListener('click', () => this.detect());
    ta.addEventListener('focus', () => { if (Drawer.open) Drawer.toggle(false); });
    ta.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== D.input) Pop.hide(); }, 150));
    // popover picking without stealing focus from the textarea
    let ty = 0;
    D.pop.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') e.preventDefault(); });
    D.pop.addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
    D.pop.addEventListener('touchend', (e) => {
      const b = e.target.closest('.pop-i'); if (!b) return;
      if (Math.abs(e.changedTouches[0].clientY - ty) < 8) { e.preventDefault(); Pop.choose(+b.dataset.i); }
    });
    D.pop.addEventListener('click', (e) => { const b = e.target.closest('.pop-i'); if (b) Pop.choose(+b.dataset.i); });
    // primary button: hold = record, tap = send / stop; never steals keyboard focus
    const P = D.primary;
    P.addEventListener('touchstart', (e) => {
      if (this.state !== 'mic') return;
      e.preventDefault(); Rec.press(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    P.addEventListener('touchmove', (e) => { if (Rec.pressing) { e.preventDefault(); Rec.drag(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    P.addEventListener('touchend', (e) => {
      if (Rec.pressing) { e.preventDefault(); Rec.release(); return; }
      if (Rec.lockTouch) { e.preventDefault(); Rec.lockTouch = false; return; } // lifting the finger that locked
      if (Rec.locked) { e.preventDefault(); Rec.finish(); return; }
      if (this.state === 'send' || this.state === 'stop') { e.preventDefault(); this.primaryTap(); }
    });
    P.addEventListener('touchcancel', () => { if (Rec.pressing) Rec.release(); });
    P.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      e.preventDefault();
      if (this.state === 'mic' && !Rec.active) {
        Rec.press(e.clientX, e.clientY);
        const mv = (ev) => Rec.drag(ev.clientX, ev.clientY);
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); Rec.release(); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      }
    });
    P.addEventListener('click', (e) => {
      if (e.detail === 0) { // keyboard activation
        if (this.state === 'mic') { Rec.press(0, 0); Rec.lock(); } else this.primaryTap();
        return;
      }
      if (Rec.locked) { if (performance.now() - Rec.lockedAt > 450) Rec.finish(); return; }
      if (this.state === 'send' || this.state === 'stop') this.primaryTap();
    });
    $('#rec-trash').addEventListener('click', () => Rec.cancel());
    D.plusBtn.addEventListener('click', () => { haptic(); openAttach(); });
    $('#orb-btn').addEventListener('click', () => VoiceMode.show());
    // files
    const onFiles = async (inp) => {
      const files = Array.from(inp.files || []).slice(0, 4); inp.value = '';
      for (const f of files) {
        if (/^image\//.test(f.type)) { const src = await downscale(f); if (src) this.addAtt({ kind: 'img', src, name: f.name }); }
        else this.addAtt({ kind: 'file', name: f.name });
      }
    };
    ['#f-photos', '#f-camera', '#f-files'].forEach((s) => $(s).addEventListener('change', (e) => onFiles(e.target)));
    D.atts.addEventListener('click', (e) => { const x = e.target.closest('.att-x'); if (x) this.removeAtt(x.closest('.att')); });
    // composer height → layout vars
    const ro = new ResizeObserver(() => {
      const h = D.composer.offsetHeight;
      D.main.style.setProperty('--cmp-h', h + 'px');
      document.documentElement.style.setProperty('--cmp-h', h + 'px');
      if (atBottom) stick();
    });
    ro.observe(D.composer);
    // rotating placeholder
    this.renderPh(PLACEHOLDERS[0], false);
    setInterval(() => {
      if (D.input.value || Rec.active || document.hidden) return;
      this.phI = (this.phI + 1) % PLACEHOLDERS.length; this.renderPh(PLACEHOLDERS[this.phI], true);
    }, 3600);
    this.refresh();
  },
  renderPh(text, animate) {
    const ph = D.ph;
    $$('.ph-line', ph).forEach((l) => { if (!animate) l.remove(); else { l.classList.add('out'); setTimeout(() => l.remove(), 520); } });
    const line = document.createElement('div'); line.className = 'ph-line';
    line.innerHTML = text.split('').map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? ' ' : esc(ch)}</span>`).join('');
    if (!animate) $$('span', line).forEach((s) => (s.style.animation = 'none'));
    ph.appendChild(line);
  },
  grow() {
    const ta = D.input;
    const cur = ta.style.height;
    ta.style.height = '0px';
    const sh = ta.scrollHeight;
    ta.style.height = cur;
    const max = 22 * 6 + 22;
    const target = clamp(sh, 44, max);
    ta.style.overflowY = sh > max ? 'auto' : 'hidden';
    if (Math.abs(target - this.hSp.target) > 0.5) this.hSp.to(target);
  },
  refresh() {
    const has = D.input.value.trim().length > 0 || this.atts.some((a) => a.kind !== 'tool');
    const st = streaming ? 'stop' : has ? 'send' : 'mic';
    if (st !== this.state) {
      this.state = st;
      D.primary.dataset.state = st;
      D.primary.setAttribute('aria-label', st === 'stop' ? 'Stop generating' : st === 'send' ? 'Send message' : 'Hold to record a voice message');
      if (st !== 'mic') haptic('select');
    }
    const empty = !D.input.value;
    D.ph.classList.toggle('hide', !empty);
    $('#orb-btn').classList.toggle('hide', !empty);
    $('#cmp-field').classList.toggle('has-orb', empty);
  },
  key(e) {
    if (Pop.open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); Pop.move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); Pop.move(-1); return; }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { if (Pop.items.length) { e.preventDefault(); Pop.choose(); return; } }
      if (e.key === 'Escape') { e.preventDefault(); Pop.hide(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); if (!streaming) this.send(); }
    if (e.key === 'Escape' && this.ctx) this.clearCtx();
  },
  detect() {
    const v = D.input.value, c = D.input.selectionStart; const before = v.slice(0, c);
    let m;
    if ((m = before.match(/^\/(\w*)$/))) return Pop.slash(m[1]);
    if ((m = before.match(/(?:^|\s)@(\w*)$/))) return Pop.mention(m[1]);
    Pop.hide();
  },
  setText(t, caret) {
    D.input.value = t; this.grow(); this.refresh();
    D.input.focus({ preventScroll: true });
    const c = caret != null ? caret : t.length; D.input.setSelectionRange(c, c);
    Pop.hide();
  },
  primaryTap() {
    if (this.state === 'stop') stopStreaming();
    else if (this.state === 'send') this.send();
  },
  textRect() {
    const r = D.input.getBoundingClientRect();
    return { left: r.left + 4, top: r.top + 11 - D.input.scrollTop };
  },
  /* attachments */
  addAtt(a) {
    a.id = uid(); this.atts.push(a);
    const html = a.kind === 'tool'
      ? `<div class="att tool" data-id="${a.id}">${a.icon}<span>${esc(a.name)}</span><button class="att-x" aria-label="Remove ${esc(a.name)}">${ICON.x}</button></div>`
      : `<div class="att" data-id="${a.id}">${a.kind === 'img' ? `<img src="${a.src}" alt="${esc(a.name)}">` : `<div class="att-f">${ICON.file}<br>${esc(a.name.slice(0, 16))}</div>`}<button class="att-x" aria-label="Remove ${esc(a.name)}">${ICON.x}</button></div>`;
    D.atts.insertAdjacentHTML('beforeend', html);
    haptic('select'); this.refresh();
  },
  addTool(k) {
    const T = { web: ['Web search', ICON.globe], research: ['Deep research', ICON.research], image: ['Create image', ICON.sparkle] };
    $$('.att.tool', D.atts).forEach((n) => this.removeAtt(n));
    this.addAtt({ kind: 'tool', tool: k, name: T[k][0], icon: T[k][1] });
    D.input.focus({ preventScroll: true });
  },
  removeAtt(node) {
    const id = node.dataset.id; this.atts = this.atts.filter((a) => a.id !== id);
    node.classList.add('out'); haptic('select');
    setTimeout(() => { node.remove(); this.refresh(); }, 240);
  },
  /* reply / edit banner */
  setCtx(type, m) {
    this.ctx = { type, m };
    const c = D.cmpCtx;
    const label = type === 'reply' ? `Replying to ${m.role === 'user' ? 'yourself' : 'Lumen'}` : 'Editing message';
    c.innerHTML = `<span class="cc-bar"></span>${(type === 'reply' ? ICON.reply : ICON.edit).replace('<svg', '<svg class="cc-ic"')}<span class="cc-txt"><b>${label}</b><span>${esc(plainOf(m).replace(/\s+/g, ' ').slice(0, 120))}</span></span><button class="cc-x" aria-label="Cancel">${ICON.x}</button>`;
    c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    $('.cc-x', c).addEventListener('click', () => { this.clearCtx(); if (type === 'edit') this.setText(''); });
  },
  setReply(m) { this.setCtx('reply', m); D.input.focus({ preventScroll: true }); haptic(); },
  startEdit(m) { this.setCtx('edit', m); this.setText(curV(m).text || ''); },
  clearCtx() { this.ctx = null; D.cmpCtx.hidden = true; D.cmpCtx.innerHTML = ''; },
  clear() {
    D.input.value = ''; this.atts = []; D.atts.innerHTML = '';
    this.hSp.set(44); D.input.style.overflowY = 'hidden';
    this.refresh(); Pop.hide();
  },
  async send() {
    if (streaming || Rec.active) return;
    const text = D.input.value.trim();
    const atts = this.atts.filter((a) => a.kind !== 'tool').map(({ kind, src, name }) => ({ kind, src, name }));
    const tool = this.atts.find((a) => a.kind === 'tool');
    if (!text && !atts.length) return;
    if (/^\/(new|clear)$/.test(text)) { this.clear(); newChat(); return; }
    const from = this.textRect();
    if (this.ctx && this.ctx.type === 'edit') {
      const m = this.ctx.m; this.clear(); this.clearCtx();
      haptic(); Sound.play('send'); commitEdit(m, text); return;
    }
    const m = { id: uid(), role: 'user', t: Date.now(), versions: [{ text, atts }], vi: 0, reactions: [], replyTo: null };
    if (this.ctx && this.ctx.type === 'reply') m.replyTo = { id: this.ctx.m.id, text: plainOf(this.ctx.m).replace(/\s+/g, ' ').slice(0, 160) };
    const kind = tool ? { web: 'tools', research: 'tools', image: 'gallery' }[tool.tool] : undefined;
    this.clear(); this.clearCtx();
    await postUserMessage(m, from, kind);
  },
  async sendVoice({ dur, bars, transcript, blobUrl }) {
    const m = { id: uid(), role: 'user', t: Date.now(), versions: [{ text: transcript, atts: [] }], vi: 0, reactions: [], replyTo: null, voice: { dur: Math.max(1, Math.round(dur)), bars } };
    if (blobUrl) VOICE_BLOBS.set(m.id, blobUrl);
    if (this.ctx && this.ctx.type === 'reply') { m.replyTo = { id: this.ctx.m.id, text: plainOf(this.ctx.m).slice(0, 160) }; this.clearCtx(); }
    await postUserMessage(m, null);
  },
};
function titleFrom(text) {
  const t = text.replace(/^\/\w+\s*/, '').replace(/@\w+\s*/g, '').replace(/[?.!]+$/, '').trim();
  if (!t) return 'New chat';
  const words = t.split(/\s+/).slice(0, 6).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1) + (t.split(/\s+/).length > 6 ? '…' : '');
}
async function postUserMessage(m, from, kind) {
  const wasHome = !current || !current.messages.length;
  if (!current) { current = { id: uid(), title: titleFrom(curV(m).text || 'Photo'), pinned: false, archived: false, updated: Date.now(), messages: [] }; convos.unshift(current); }
  current.messages.push(m); current.updated = Date.now();
  haptic(); Sound.play('send');
  if (wasHome) {
    if (!RM) await Promise.all([D.home, D.chipsWrap].map((n) => n.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translate3d(0,-20px,0) scale(.97)', filter: 'blur(8px)' }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)' }).finished));
    renderThread();
    D.lt.animate([{ opacity: 0, transform: 'translate3d(0,10px,0)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE_SPRING });
  } else {
    const last = current.messages[current.messages.length - 2];
    if (last && m.t - last.t > 45 * 60e3) D.list.appendChild(el(`<div class="sep-time" role="separator"><b>${smartDay(m.t)}</b> ${fmtTime(m.t)}</div>`));
    D.list.appendChild(renderRow(m)); regroup(); updateTitle();
  }
  scrollToBottom(false);
  const row = rowOf(m.id);
  flyIn(row, from);
  save(); Drawer.refreshIfOpen();
  await sleep(RM ? 100 : 420);
  respondTo(current, m, { kind });
}
function flyIn(row, from) {
  if (!row) return;
  const bub = $('.bubble', row);
  const extras = $$('.quote, .u-atts', row);
  extras.forEach((x, i) => x.animate([{ opacity: 0, transform: 'translate3d(0,24px,0) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 40, easing: EASE_SPRING, fill: 'backwards' }));
  if (!bub) return;
  const to = bub.getBoundingClientRect();
  const doBurst = () => burst(to.right - 8, to.top + to.height / 2);
  if (!from || RM) {
    bub.animate([{ opacity: 0, transform: 'translate3d(0,30px,0) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE_SPRING });
    setTimeout(doBurst, 200); return;
  }
  const cs = getComputedStyle(bub);
  const dx = from.left - (to.left + parseFloat(cs.paddingLeft)), dy = from.top - (to.top + parseFloat(cs.paddingTop));
  bub.classList.add('flying', 'pre'); bub.style.setProperty('--bub-a', 0);
  let burstDone = false;
  const sp = new Spring(0, { stiffness: 280, damping: 24, precision: 0.002 }, (p) => {
    const q = 1 - p;
    bub.style.transform = `translate3d(${dx * q}px,${dy * q}px,0) scale(${0.96 + 0.04 * p})`;
    bub.style.setProperty('--bub-a', clamp(p * 1.7, 0, 1));
    if (!burstDone && p > 0.9) { burstDone = true; doBurst(); }
  });
  requestAnimationFrame(() => bub.classList.remove('pre'));
  sp.to(1).then(() => { bub.style.transform = ''; bub.classList.remove('flying'); bub.style.removeProperty('--bub-a'); });
}
function burst(x, y) {
  if (RM) return;
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i'); p.className = 'spark';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    const s = rand(0.5, 1.2); p.style.width = p.style.height = 6 * s + 'px';
    D.fx.appendChild(p);
    const a = rand(-Math.PI * 0.95, Math.PI * 0.45), d = rand(16, 44);
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 },
    ], { duration: rand(480, 760), easing: 'cubic-bezier(.15,.85,.3,1)' }).onfinish = () => p.remove();
  }
}
function downscale(file, max = 640) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL('image/jpeg', 0.78)); } catch (e) { res(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

/* =====================================================================
   28. Keyboard: composer rides on the iOS keyboard via visualViewport
   ===================================================================== */
const KB = {
  init() {
    const vv = window.visualViewport; if (!vv) return;
    this.sp = new Spring(0, { stiffness: 360, damping: 36, precision: 0.3 }, (v) => {
      const t = Math.abs(v) > 0.3 ? `translate3d(0,${v}px,0)` : '';
      D.composer.style.transform = t; D.inner.style.transform = t;
    });
    let lastH = vv.height;
    const on = () => {
      const h = vv.height, top = vv.offsetTop;
      document.documentElement.style.setProperty('--vvh', h + 'px');
      D.app.style.transform = top > 0.5 ? `translate3d(0,${top}px,0)` : '';
      document.documentElement.classList.toggle('kb-open', window.innerHeight - h > 140);
      const dh = lastH - h; lastH = h;
      if (Math.abs(dh) > 60 && !RM) { this.sp.set(this.sp.value + dh); this.sp.to(0); }
      if (atBottom) requestAnimationFrame(stick);
    };
    vv.addEventListener('resize', on); vv.addEventListener('scroll', on);
    on();
  },
};

/* =====================================================================
   29. Hold-to-record voice notes (getUserMedia + AnalyserNode)
   ===================================================================== */
const Rec = {
  active: false, pressing: false, locked: false, pending: false,
  press(x, y) {
    if (this.active || streaming) return;
    Object.assign(this, { active: true, pressing: true, locked: false, px: x, py: y, t0: performance.now(), levels: [], transcript: '', lastPush: 0, fake: null, fakeI: 0 });
    D.composer.classList.add('recording'); D.composer.classList.remove('locked', 'cancel-anim');
    haptic(); Sound.play('tick');
    this.hint = $('#rec-hint'); this.lk = $('#lk-ic'); this.cv = $('#rec-wave'); this.cap = $('#rec-cap');
    this.hint.style.transform = ''; this.hint.style.opacity = '';
    this.cap.innerHTML = '<i>Listening…</i>'; this.cap.classList.add('on');
    const dpr = Math.min(2, devicePixelRatio || 1);
    requestAnimationFrame(() => { const r = this.cv.getBoundingClientRect(); this.cv.width = Math.max(1, r.width * dpr); this.cv.height = Math.max(1, r.height * dpr); });
    this.dpr = dpr; this.g = this.cv.getContext('2d');
    this.color = getComputedStyle(document.documentElement).getPropertyValue('--accent-strong').trim() || '#C9431A';
    this.pending = true;
    this.startAudio().finally(() => { this.pending = false; });
    this.raf = requestAnimationFrame(() => this.loop());
  },
  async startAudio() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no gum');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!this.active) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.stream = stream;
      const C = window.AudioContext || window.webkitAudioContext; this.ac = new C();
      const src = this.ac.createMediaStreamSource(stream); this.an = this.ac.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an);
      this.buf = new Uint8Array(this.an.fftSize);
      if (window.MediaRecorder) { try { this.chunks = []; this.mr = new MediaRecorder(stream); this.mr.ondataavailable = (e) => e.data.size && this.chunks.push(e.data); this.mr.start(); } catch (e) { this.mr = null; } }
    } catch (e) { this.sim = true; }
    this.startSR();
  },
  startSR() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const r = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = true;
      r.onresult = (e) => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; this.transcript = s; this.cap.textContent = s; };
      r.onerror = () => {}; r.start(); this.sr = r;
    } catch (e) {}
  },
  level() {
    if (this.an) {
      this.an.getByteTimeDomainData(this.buf); let s = 0;
      for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; s += v * v; }
      return clamp(Math.sqrt(s / this.buf.length) * 5, 0, 1);
    }
    const t = performance.now() / 1000;
    return clamp(0.18 + 0.55 * Math.abs(Math.sin(t * 5.3) * Math.sin(t * 1.7 + 1)) * rand(0.6, 1), 0, 1);
  },
  loop() {
    if (!this.active) return;
    const now = performance.now(); const el2 = (now - this.t0) / 1000;
    $('#rec-time').textContent = fmtDur(el2);
    if (now - this.lastPush > 60) { this.lastPush = now; this.levels.push(this.level()); }
    // fake live transcription when real recognition is unavailable or silent
    if (!this.transcript && el2 > 0.7) {
      if (!this.fake) this.fake = VOICE_FAKE[Math.floor(Math.random() * VOICE_FAKE.length)].split(' ');
      const want = Math.min(this.fake.length, Math.floor((el2 - 0.7) * 2.6));
      if (want > this.fakeI) { this.fakeI = want; this.cap.textContent = this.fake.slice(0, want).join(' '); }
    }
    const g = this.g, c = this.cv, w = c.width, h = c.height, d = this.dpr;
    g.clearRect(0, 0, w, h); g.fillStyle = this.color;
    const bw = 3 * d, gap = 2 * d, n = Math.floor(w / (bw + gap)); const arr = this.levels.slice(-n);
    for (let i = 0; i < arr.length; i++) {
      const bh = Math.max(3 * d, arr[i] * h); const x = w - (arr.length - i) * (bw + gap); const y = (h - bh) / 2;
      if (g.roundRect) { g.beginPath(); g.roundRect(x, y, bw, bh, bw / 2); g.fill(); } else g.fillRect(x, y, bw, bh);
    }
    this.raf = requestAnimationFrame(() => this.loop());
  },
  drag(x, y) {
    if (!this.pressing || this.locked) return;
    const dx = Math.min(0, x - this.px), dy = Math.min(0, y - this.py);
    this.hint.style.transform = `translate3d(${dx * 0.8}px,0,0)`; this.hint.style.opacity = clamp(1 + dx / 130, 0, 1);
    D.primary.style.transform = `translate3d(${dx * 0.3}px,${dy * 0.4}px,0) scale(1.6)`;
    const lp = clamp(-dy / 90, 0, 1); this.lk.style.transform = `translate3d(0,${-lp * 12}px,0) scale(${1 + lp * 0.2})`;
    if (dx < -120) this.cancel(); else if (dy < -90) this.lock();
  },
  release() {
    if (!this.pressing) return; this.pressing = false;
    if (this.locked) return;
    const held = performance.now() - this.t0;
    if (this.pending && held < 2000) { this.lock(); return; } // permission prompt interrupted the hold
    if (held < 320) { this.cancel(true); toast('Hold to record · slide ← to cancel, ↑ to lock', { icon: ICON.mic }); return; }
    this.finish();
  },
  lock() {
    if (!this.active) return;
    this.lockTouch = this.pressing; this.locked = true; this.pressing = false; this.lockedAt = performance.now();
    D.composer.classList.add('locked'); D.primary.style.transform = ''; this.hint.style.transform = '';
    D.primary.setAttribute('aria-label', 'Send voice message');
    haptic('heavy');
  },
  cleanup() {
    this.active = false; this.pressing = false; this.locked = false;
    cancelAnimationFrame(this.raf);
    try { this.sr && this.sr.stop(); } catch (e) {}
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { this.ac && this.ac.close(); } catch (e) {}
    this.sr = this.stream = this.ac = this.an = null; this.sim = false;
    D.primary.style.transform = ''; this.lk.style.transform = '';
    this.cap.classList.remove('on');
    D.composer.classList.remove('recording', 'locked');
    Composer.state = null; Composer.refresh();
  },
  async cancel(quiet) {
    if (!this.active) return;
    if (this.mr && this.mr.state !== 'inactive') try { this.mr.stop(); } catch (e) {}
    this.mr = null;
    if (!quiet) { haptic('heavy'); D.composer.classList.add('cancel-anim'); Sound.play('tick'); await sleep(380); D.composer.classList.remove('cancel-anim'); }
    this.cleanup();
  },
  async finish() {
    if (!this.active) return;
    const dur = (performance.now() - this.t0) / 1000;
    const lv = this.levels.length ? this.levels : [0.3];
    const bars = Array.from({ length: 28 }, (_, i) => { const a = Math.floor((i / 28) * lv.length), b = Math.max(a + 1, Math.floor(((i + 1) / 28) * lv.length)); return Math.max(...lv.slice(a, b)); });
    const transcript = (this.transcript || (this.fake || VOICE_FAKE[0].split(' ')).join(' ')).trim();
    let blobUrl = null;
    if (this.mr && this.mr.state !== 'inactive') {
      await new Promise((r) => { this.mr.onstop = r; try { this.mr.stop(); } catch (e) { r(); } });
      try { if (this.chunks.length) blobUrl = URL.createObjectURL(new Blob(this.chunks, { type: this.mr.mimeType || 'audio/mp4' })); } catch (e) {}
    }
    this.mr = null;
    this.cleanup();
    Composer.sendVoice({ dur, bars, transcript, blobUrl });
  },
};

/* =====================================================================
   30. Voice mode: full-screen, audio-reactive WebGL orb
   ===================================================================== */
const ORB_FS = `precision highp float;
uniform vec2 r; uniform float t; uniform float lv; uniform vec3 c1; uniform vec3 c2; uniform float mode;
float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * r) / min(r.x, r.y) * 2.0;
  float a = atan(uv.y, uv.x); float d = length(uv);
  float sp = 0.35 + mode * 0.6;
  float n1 = noise(vec3(cos(a) * 1.4 + t * 0.25 * sp, sin(a) * 1.4, t * 0.35 * sp));
  float n2 = noise(vec3(cos(a) * 3.1, sin(a) * 3.1 - t * 0.6 * sp, t * 0.8));
  float rad = 0.56 + (n1 - 0.5) * (0.09 + lv * 0.42) + (n2 - 0.5) * (0.03 + lv * 0.22);
  float inside = smoothstep(rad + 0.008, rad - 0.008, d);
  vec2 q = uv * 1.5;
  float sw = noise(vec3(q * 1.3 + vec2(t * 0.22, -t * 0.17), t * 0.3));
  float sw2 = noise(vec3(q * 2.6 - vec2(t * 0.31), t * 0.5 + 3.0));
  vec3 col = mix(c1, c2, smoothstep(0.25, 0.8, sw));
  col = mix(col, vec3(1.0), smoothstep(0.6, 0.98, sw2) * 0.4);
  float k = clamp(d / max(rad, 0.001), 0.0, 1.0);
  float z = sqrt(max(0.0, 1.0 - k * k));
  vec3 nrm = normalize(vec3(uv / max(rad, 0.001), z));
  float spec = pow(max(0.0, dot(nrm, normalize(vec3(-0.45, 0.6, 0.66)))), 28.0);
  float fres = pow(1.0 - z, 2.2);
  col = col * (0.5 + 0.5 * z) + spec * 0.7 + fres * mix(c2, vec3(1.0), 0.55) * 0.55;
  float glow = exp(-max(d - rad, 0.0) * 5.5) * (0.22 + lv * 0.55) * (1.0 - inside) * smoothstep(1.0, 0.72, d);
  vec3 g = mix(c1, c2, 0.5) * glow;
  float alpha = clamp(inside + glow, 0.0, 1.0);
  gl_FragColor = vec4(col * inside + g, alpha);
}`;
function parseColor(str) {
  const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = str;
  const v = c.fillStyle;
  if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const m = v.match(/[\d.]+/g); return m ? m.slice(0, 3).map((x) => +x / 255) : [1, 0.42, 0.24];
}
const Orb = {
  init(canvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    try {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, ORB_FS));
      gl.linkProgram(p); gl.useProgram(p);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {}; ['r', 't', 'lv', 'c1', 'c2', 'mode'].forEach((n) => (this.u[n] = gl.getUniformLocation(p, n)));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } catch (e) { return false; }
    this.gl = gl; this.cv = canvas;
    const dpr = Math.min(1.5, devicePixelRatio || 1); const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const a = parseColor(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    this.c1 = a; this.c2 = [lerp(a[0], 0.45, 0.6), lerp(a[1], 0.62, 0.6), lerp(a[2], 1, 0.6)];
    return true;
  },
  draw(t, lv, mode) {
    const gl = this.gl; if (!gl) return;
    gl.uniform2f(this.u.r, this.cv.width, this.cv.height); gl.uniform1f(this.u.t, t); gl.uniform1f(this.u.lv, lv); gl.uniform1f(this.u.mode, mode);
    gl.uniform3fv(this.u.c1, this.c1); gl.uniform3fv(this.u.c2, this.c2);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
};
const VoiceMode = {
  open: false,
  async show() {
    if (this.open) return; this.open = true;
    haptic(); Speak.stop();
    if (document.activeElement === D.input) D.input.blur();
    const v = D.voice;
    v.innerHTML = `<div class="v-top"><span class="v-model">${esc(modelOf(settings.model).name)} · Voice</span><button class="ib" data-v="close" aria-label="Close voice chat" style="color:#fff;background:rgba(255,255,255,.12)">${ICON.x}</button></div>
      <div class="v-orb-wrap"><canvas id="orb" role="img" aria-label="Audio-reactive orb"></canvas></div>
      <div class="v-status" id="v-status" aria-live="polite">Connecting…</div>
      <div class="v-cap" id="v-cap" aria-live="polite"></div>
      <div class="v-ctrls"><button class="v-btn" data-v="mute" aria-label="Mute microphone" aria-pressed="false">${ICON.mic}</button><button class="v-btn end" data-v="close" aria-label="End voice chat">${ICON.x}</button></div>`;
    v.hidden = false; v.classList.remove('out'); v.classList.add('in');
    const canvas = $('#orb', v);
    const ok = Orb.init(canvas);
    if (!ok) canvas.replaceWith(el('<div class="v-orb-css" role="img" aria-label="Voice orb"></div>'));
    this.status = $('#v-status', v); this.cap = $('#v-cap', v);
    this.level = 0; this.target = 0; this.mode = 0; this.state = 'idle'; this.muted = false; this.t0 = performance.now();
    this.scale = new Spring(0.3, SPR.bouncy, (s) => { const n = $('#orb, .v-orb-css', v); if (n) n.style.transform = `scale(${s})`; });
    this.scale.to(1);
    v.onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (b && b.dataset.v === 'close') return this.close();
      if (b && b.dataset.v === 'mute') { this.muted = !this.muted; b.classList.toggle('on', this.muted); b.setAttribute('aria-pressed', this.muted); haptic(); if (this.muted) this.setState('muted'); else this.listen(); return; }
      if (e.target.closest('#orb, .v-orb-css') && (this.state === 'listening' || this.state === 'tap')) this.fakeUtterance();
    };
    this.keyH = (e) => { if (e.key === 'Escape') this.close(); };
    addEventListener('keydown', this.keyH);
    this.loop();
    this.mic();      // don't block the UI on the permission prompt
    this.listen();
  },
  async mic() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.open) { s.getTracks().forEach((t) => t.stop()); return; }
      this.stream = s; const C = window.AudioContext || window.webkitAudioContext; this.ac = new C();
      const src = this.ac.createMediaStreamSource(s); this.an = this.ac.createAnalyser(); this.an.fftSize = 512; src.connect(this.an); this.buf = new Uint8Array(512);
    } catch (e) { this.an = null; }
  },
  micLevel() {
    if (!this.an) return 0;
    this.an.getByteTimeDomainData(this.buf); let s = 0;
    for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; s += v * v; }
    return clamp(Math.sqrt(s / this.buf.length) * 6, 0, 1);
  },
  setState(s, text) {
    this.state = s;
    this.status.textContent = text || { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', muted: 'Microphone off', tap: 'Tap the orb and speak' }[s] || '';
  },
  listen() {
    if (!this.open || this.muted) return;
    this.cap.textContent = '';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.setState('tap'); return; }
    try {
      const r = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = false;
      let finalT = '';
      r.onresult = (e) => {
        let s = ''; for (let i = 0; i < e.results.length; i++) { s += e.results[i][0].transcript; if (e.results[i].isFinal) finalT = s; }
        this.cap.textContent = s;
      };
      r.onend = () => { this.sr = null; if (!this.open || this.state !== 'listening') return; if (finalT.trim()) this.answer(finalT); else setTimeout(() => this.listen(), 200); };
      r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { this.noSR = true; this.setState('tap'); } };
      r.start(); this.sr = r; this.setState('listening');
    } catch (e) { this.setState('tap'); }
  },
  async fakeUtterance() {
    const words = VOICE_FAKE[Math.floor(Math.random() * VOICE_FAKE.length)].split(' ');
    this.setState('listening'); this.cap.textContent = ''; haptic();
    for (const w of words) { if (!this.open) return; this.cap.insertAdjacentHTML('beforeend', `<span class="w">${esc(w)} </span>`); this.target = rand(0.4, 0.9); await sleep(rand(160, 280)); }
    this.target = 0; this.answer(words.join(' '));
  },
  async answer(text) {
    this.setState('thinking'); haptic('select');
    await sleep(900);
    if (!this.open) return;
    const r = Engine.respond(text, {});
    const spoken = r.md.replace(/^:::.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/\|.*\|/g, '').replace(/[*_`#>]/g, '').replace(/\n+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') || 'Sure — I can help with that.';
    this.setState('speaking'); this.cap.innerHTML = '';
    const words = spoken.split(/\s+/);
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(spoken); u.rate = 1.04;
      let wi = 0; let got = false;
      u.onboundary = () => { got = true; if (wi < words.length) this.cap.insertAdjacentHTML('beforeend', `<span class="w">${esc(words[wi++])} </span>`); this.target = rand(0.55, 1); };
      const fb = setInterval(() => { if (got || !this.open) return; if (wi < words.length) { this.cap.insertAdjacentHTML('beforeend', `<span class="w">${esc(words[wi++])} </span>`); this.target = rand(0.5, 1); } }, 260);
      await new Promise((res) => { u.onend = res; u.onerror = res; speechSynthesis.cancel(); speechSynthesis.speak(u); setTimeout(res, 15000); });
      clearInterval(fb);
      while (wi < words.length) this.cap.insertAdjacentHTML('beforeend', `<span class="w">${esc(words[wi++])} </span>`);
    } else {
      for (const w of words) { if (!this.open) return; this.cap.insertAdjacentHTML('beforeend', `<span class="w">${esc(w)} </span>`); this.target = rand(0.5, 1); await sleep(220); }
    }
    this.target = 0;
    if (!this.open) return;
    await sleep(500);
    if (this.noSR || !(window.SpeechRecognition || window.webkitSpeechRecognition)) this.setState('tap'); else this.listen();
  },
  loop() {
    if (!this.open) return;
    const t = (performance.now() - this.t0) / 1000;
    let tgt = this.target;
    if (this.state === 'listening' && this.an && !this.muted) tgt = Math.max(tgt, this.micLevel());
    if (this.state === 'thinking') tgt = 0.25 + 0.15 * Math.sin(t * 6);
    if (this.state === 'speaking') this.target *= 0.94;
    if (this.state === 'idle' || this.state === 'tap' || this.state === 'muted') tgt = Math.max(tgt, 0.06 + 0.04 * Math.sin(t * 1.6));
    this.level += (tgt - this.level) * (tgt > this.level ? 0.35 : 0.08);
    const mt = this.state === 'thinking' ? 1 : this.state === 'speaking' ? 0.6 : 0;
    this.mode += (mt - this.mode) * 0.05;
    Orb.draw(t, this.level, this.mode);
    if (!Orb.gl) { const n = $('.v-orb-css', D.voice); if (n) n.style.transform = `scale(${1 + this.level * 0.25})`; }
    this.raf = requestAnimationFrame(() => this.loop());
  },
  async close() {
    if (!this.open) return; this.open = false;
    removeEventListener('keydown', this.keyH);
    cancelAnimationFrame(this.raf);
    try { this.sr && this.sr.abort(); } catch (e) {}
    try { speechSynthesis.cancel(); } catch (e) {}
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); this.ac && this.ac.close(); } catch (e) {}
    this.stream = this.ac = this.an = null; Orb.gl = null;
    haptic();
    D.voice.classList.remove('in'); D.voice.classList.add('out');
    await sleep(RM ? 50 : 300);
    D.voice.hidden = true; D.voice.innerHTML = ''; D.voice.classList.remove('out');
    $('#orb-btn').focus({ preventScroll: true });
  },
};
