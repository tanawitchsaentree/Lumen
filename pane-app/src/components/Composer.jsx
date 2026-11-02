import { useEffect, useRef, useState } from 'react';
import { Card } from 'pane-react/Card';
import { Textarea } from 'pane-react/Textarea';
import { IconButton } from 'pane-react/IconButton';
import { Banner } from 'pane-react/Banner';
import { Chip } from 'pane-react/Chip';
import { List, ListItem } from 'pane-react/List';
import { Text } from 'pane-react/Text';
import { Image } from 'pane-react/Image';
import { RawGlyph, Glyph } from '../lib/glyph.jsx';
import { S, ST, appCh, useStreaming, emit, sendMessage, stopStreaming, plainOf, curV, openSheet, newChat, notify, settings } from '../lib/store.js';
import { AGENTS, VOICE_FAKE } from '../lib/engine.js';
import { Spring, haptic, Sound, clamp, rand, fmtDur, uid } from '../lib/core.js';
import { stickToBottom, SCROLL } from './Thread.jsx';
import { toggleTheme } from './theme.js';

const PLACEHOLDERS = ['Ask anything…', 'Plan 3 days in Kyoto', 'Type / for commands', 'Mention @Coder for code help', 'Chart our revenue growth', 'Hold the mic to talk'];
export const CMDS = [
  { k: 'weather', d: 'Forecast card', ic: 'sun', p: "What's the weather in Kyoto this week?" },
  { k: 'map', d: 'Find a place nearby', ic: 'mapPin', p: 'Find a quiet coffee spot near Gion' },
  { k: 'chart', d: 'Interactive chart', ic: 'chart', p: 'Chart our monthly revenue growth' },
  { k: 'poll', d: 'Create a poll', ic: 'poll', p: 'Create a poll for the team offsite' },
  { k: 'gallery', d: 'Image moodboard', ic: 'photo', p: 'Show me moodboard images for a calm reading nook' },
  { k: 'code', d: 'Write some code', ic: 'code', p: 'Write a React hook for debounced search' },
  { k: 'table', d: 'Compare options', ic: 'table', p: 'Compare SQLite vs Postgres vs DynamoDB for a side project' },
  { k: 'research', d: 'Run tools, step by step', ic: 'research', p: 'Research the best time to book flights to Tokyo' },
  { k: 'essay', d: 'Long-form answer', ic: 'doc', p: 'Explain why glass works in interface design' },
  { k: 'artifact', d: 'Build a runnable mini-app', ic: 'canvas', p: 'Build a pomodoro focus timer' },
  { k: 'error', d: 'Simulate a failure', ic: 'alert', p: 'Simulate an error' },
  { k: 'new', d: 'Start a new chat', ic: 'compose', run: () => newChat() },
  { k: 'theme', d: 'Toggle dark mode', ic: 'moon', run: () => toggleTheme() },
  { k: 'settings', d: 'Open settings', ic: 'gear', run: () => openSheet('settings') },
];
function fuzzy(q, s) {
  if (!q) return { score: 1, idx: [] };
  q = q.toLowerCase(); const t = s.toLowerCase(); let qi = 0, score = 0, last = -2; const idx = [];
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) { score += (i === last + 1 ? 3 : 1) + (i === 0 ? 4 : 0); idx.push(i); last = i; qi++; }
  return qi === q.length ? { score, idx } : null;
}
const Marked = ({ s, idx }) => <>{s.split('').map((ch, i) => (idx.includes(i) ? <mark key={i}>{ch}</mark> : ch))}</>;
function downscale(file, max = 640) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file); const img = new window.Image();
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); try { res(c.toDataURL('image/jpeg', 0.78)); } catch (e) { res(null); } };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); }; img.src = url;
  });
}
export const ATT = { list: [], add: null, tool: null };

/* ---------- hold-to-record (getUserMedia + AnalyserNode) ---------- */
const Rec = {
  active: false, pressing: false, locked: false, lockTouch: false,
  press(x, y, ui) {
    if (this.active || ST.id) return;
    Object.assign(this, { ui, active: true, pressing: true, locked: false, lockTouch: false, px: x, py: y, t0: performance.now(), levels: [], transcript: '', fake: null, fakeI: 0, lastPush: 0, pending: true });
    ui.setRec('rec'); haptic(); Sound.play('tick');
    const dpr = Math.min(2, devicePixelRatio || 1); this.dpr = dpr;
    requestAnimationFrame(() => { const cv = ui.cv.current; if (!cv) return; const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); this.g = cv.getContext('2d'); });
    this.color = getComputedStyle(document.documentElement).getPropertyValue('--ds-text-primary').trim() || '#fff';
    this.audio().finally(() => { this.pending = false; });
    this.raf = requestAnimationFrame(() => this.loop());
  },
  async audio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!this.active) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.stream = stream; const C = window.AudioContext || window.webkitAudioContext; this.ac = new C();
      const src = this.ac.createMediaStreamSource(stream); this.an = this.ac.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an); this.buf = new Uint8Array(1024);
      if (window.MediaRecorder) { try { this.chunks = []; this.mr = new MediaRecorder(stream); this.mr.ondataavailable = (e) => e.data.size && this.chunks.push(e.data); this.mr.start(); } catch (e) { this.mr = null; } }
    } catch (e) { this.an = null; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) try { const r = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = true; r.onresult = (e) => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; this.transcript = s; this.ui.setCap(s); }; r.onerror = () => {}; r.start(); this.sr = r; } catch (e) {}
  },
  level() {
    if (this.an) { this.an.getByteTimeDomainData(this.buf); let s = 0; for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; s += v * v; } return clamp(Math.sqrt(s / this.buf.length) * 5, 0, 1); }
    const t = performance.now() / 1000; return clamp(0.18 + 0.55 * Math.abs(Math.sin(t * 5.3) * Math.sin(t * 1.7 + 1)) * rand(0.6, 1), 0, 1);
  },
  loop() {
    if (!this.active) return;
    const now = performance.now(), el = (now - this.t0) / 1000;
    if (this.ui.time.current) this.ui.time.current.textContent = fmtDur(el);
    if (now - this.lastPush > 60) { this.lastPush = now; this.levels.push(this.level()); }
    if (!this.transcript && el > 0.7) {
      if (!this.fake) this.fake = VOICE_FAKE[Math.floor(Math.random() * VOICE_FAKE.length)].split(' ');
      const want = Math.min(this.fake.length, Math.floor((el - 0.7) * 2.6));
      if (want > this.fakeI) { this.fakeI = want; this.ui.setCap(this.fake.slice(0, want).join(' ')); }
    }
    const g = this.g, c = this.ui.cv.current;
    if (g && c) {
      const w = c.width, h = c.height, d = this.dpr; g.clearRect(0, 0, w, h); g.fillStyle = this.color;
      const bw = 3 * d, gap = 2 * d, n = Math.floor(w / (bw + gap)); const arr = this.levels.slice(-n);
      for (let i = 0; i < arr.length; i++) { const bh = Math.max(3 * d, arr[i] * h); const x = w - (arr.length - i) * (bw + gap); g.beginPath(); g.roundRect ? g.roundRect(x, (h - bh) / 2, bw, bh, bw / 2) : g.rect(x, (h - bh) / 2, bw, bh); g.fill(); }
    }
    this.raf = requestAnimationFrame(() => this.loop());
  },
  drag(x, y) {
    if (!this.pressing || this.locked) return;
    const dx = Math.min(0, x - this.px), dy = Math.min(0, y - this.py);
    const { hint, prim, lk } = this.ui;
    if (hint.current) { hint.current.style.transform = `translate3d(${dx * 0.8}px,0,0)`; hint.current.style.opacity = clamp(1 + dx / 130, 0, 1); }
    if (prim.current) prim.current.style.transform = `translate3d(${dx * 0.3}px,${dy * 0.4}px,0) scale(1.5)`;
    if (lk.current) { const lp = clamp(-dy / 90, 0, 1); lk.current.style.transform = `translate3d(0,${-lp * 12}px,0) scale(${1 + lp * 0.2})`; }
    if (dx < -120) this.cancel(); else if (dy < -90) this.lock();
  },
  release() {
    if (!this.pressing) return; this.pressing = false;
    if (this.locked) return;
    const held = performance.now() - this.t0;
    if (held >= 320 && this.pending) return this.lock(); // the permission prompt cut the hold short: keep recording, hands-free
    if (held < 320) { this.cancel(true); notify({ kind: 'toast', title: 'Hold to record', description: 'Slide left to cancel, up to lock.', duration: 2600 }); return; }
    this.finish();
  },
  lock() { if (!this.active) return; this.lockTouch = this.pressing; this.locked = true; this.pressing = false; this.lockedAt = performance.now(); this.ui.setRec('locked'); this.resetUI(); haptic('heavy'); },
  resetUI() { const { hint, prim, lk } = this.ui; if (hint.current) { hint.current.style.transform = ''; hint.current.style.opacity = ''; } if (prim.current) prim.current.style.transform = ''; if (lk.current) lk.current.style.transform = ''; },
  cleanup() {
    this.active = this.pressing = this.locked = false; cancelAnimationFrame(this.raf);
    try { this.sr && this.sr.stop(); } catch (e) {}
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); this.ac && this.ac.close(); } catch (e) {}
    this.sr = this.stream = this.ac = this.an = null; this.resetUI(); this.ui.setRec(null); this.ui.setCap('');
  },
  async cancel(quiet) {
    if (!this.active) return;
    if (this.mr && this.mr.state !== 'inactive') try { this.mr.stop(); } catch (e) {}
    this.mr = null;
    if (!quiet) { haptic('heavy'); Sound.play('tick'); this.ui.setRec('cancel'); await new Promise((r) => setTimeout(r, 380)); }
    this.cleanup();
  },
  async finish() {
    if (!this.active) return;
    const dur = (performance.now() - this.t0) / 1000; const lv = this.levels.length ? this.levels : [0.3];
    const bars = Array.from({ length: 28 }, (_, i) => { const a = Math.floor((i / 28) * lv.length), b = Math.max(a + 1, Math.floor(((i + 1) / 28) * lv.length)); return Math.max(...lv.slice(a, b)); });
    const transcript = (this.transcript || (this.fake || VOICE_FAKE[0].split(' ')).join(' ')).trim();
    let url = null;
    if (this.mr && this.mr.state !== 'inactive') {
      await new Promise((r) => { this.mr.onstop = r; try { this.mr.stop(); } catch (e) { r(); } });
      try { if (this.chunks.length) url = URL.createObjectURL(new Blob(this.chunks, { type: this.mr.mimeType || 'audio/mp4' })); } catch (e) {}
    }
    this.mr = null; this.cleanup();
    sendMessage({ text: transcript, voice: { dur: Math.max(1, Math.round(dur)), bars, url } });
  },
};

export function Composer() {
  appCh.use();
  const streaming = useStreaming();
  const ta = useRef(null), prim = useRef(null), cv = useRef(null), time = useRef(null), hint = useRef(null), lk = useRef(null), popRef = useRef(null), root = useRef(null);
  const [text, setText] = useState('');
  const [atts, setAtts] = useState([]);
  const [pop, setPop] = useState(null);       // { type, items, idx }
  const [rec, setRec] = useState(null);       // null | 'rec' | 'locked' | 'cancel'
  const [cap, setCap] = useState('');
  const [ph, setPh] = useState(0);
  const hSp = useRef(null);
  const ui = { setRec, setCap, cv, time, hint, prim, lk };
  const has = text.trim().length > 0 || atts.some((a) => a.kind !== 'tool');
  const state = streaming ? 'stop' : has ? 'send' : 'mic';

  ATT.add = (a) => setAtts((x) => [...x.filter((y) => !(a.kind === 'tool' && y.kind === 'tool')), { id: uid(), ...a }]);
  ATT.list = atts;

  // edit mode prefills the text
  const ctxKey = S.ctx ? S.ctx.type + S.ctx.m.id : '';
  useEffect(() => { if (S.ctx && S.ctx.type === 'edit') { setText(curV(S.ctx.m).text || ''); setTimeout(() => ta.current?.focus({ preventScroll: true }), 30); } else if (S.ctx) ta.current?.focus({ preventScroll: true }); }, [ctxKey]);

  // auto-grow on a spring (max 6 lines)
  useEffect(() => { hSp.current = new Spring(44, { stiffness: 520, damping: 40, precision: 0.3 }, (v) => { if (ta.current) ta.current.style.height = v + 'px'; }); }, []);
  useEffect(() => {
    const t = ta.current; if (!t || !hSp.current) return;
    const cur = t.style.height; t.style.height = '0px'; const sh = t.scrollHeight; t.style.height = cur;
    const max = 22 * 6 + 22; const target = clamp(sh, 44, max);
    t.style.overflowY = sh > max ? 'auto' : 'hidden';
    if (Math.abs(target - hSp.current.target) > 0.5) hSp.current.to(target);
  }, [text]);

  // rotating placeholder
  useEffect(() => { const i = setInterval(() => { if (!ta.current?.value && !Rec.active && !document.hidden) setPh((p) => (p + 1) % PLACEHOLDERS.length); }, 3600); return () => clearInterval(i); }, []);

  // composer height → layout variable
  useEffect(() => {
    const ro = new ResizeObserver(() => { document.documentElement.style.setProperty('--lu-cmp-h', root.current.offsetHeight + 'px'); stickToBottom(); });
    ro.observe(root.current); return () => ro.disconnect();
  }, []);

  // primary button: native listeners so touchstart can be non-passive (keeps the keyboard up, enables hold)
  const stateRef = useRef(state); stateRef.current = state;
  useEffect(() => {
    const P = prim.current;
    const ts = (e) => { if (stateRef.current !== 'mic') return; e.preventDefault(); Rec.press(e.touches[0].clientX, e.touches[0].clientY, ui); };
    const tm = (e) => { if (Rec.pressing) { e.preventDefault(); Rec.drag(e.touches[0].clientX, e.touches[0].clientY); } };
    const te = (e) => {
      if (Rec.pressing) { e.preventDefault(); Rec.release(); return; }
      if (Rec.lockTouch) { e.preventDefault(); Rec.lockTouch = false; return; }
      if (Rec.locked) { e.preventDefault(); Rec.finish(); return; }
      if (stateRef.current !== 'mic') { e.preventDefault(); act(); }
    };
    const pd = (e) => {
      if (e.pointerType !== 'mouse') return; e.preventDefault();
      if (stateRef.current === 'mic' && !Rec.active) {
        Rec.press(e.clientX, e.clientY, ui);
        const mv = (ev) => Rec.drag(ev.clientX, ev.clientY);
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); Rec.release(); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      }
    };
    const ck = (e) => {
      if (e.detail === 0) { if (stateRef.current === 'mic') { Rec.press(0, 0, ui); Rec.lock(); } else act(); return; }
      if (Rec.locked) { if (performance.now() - Rec.lockedAt > 450) Rec.finish(); return; }
      if (stateRef.current !== 'mic') act();
    };
    P.addEventListener('touchstart', ts, { passive: false }); P.addEventListener('touchmove', tm, { passive: false });
    P.addEventListener('touchend', te); P.addEventListener('pointerdown', pd); P.addEventListener('click', ck);
    return () => { P.removeEventListener('touchstart', ts); P.removeEventListener('touchmove', tm); P.removeEventListener('touchend', te); P.removeEventListener('pointerdown', pd); P.removeEventListener('click', ck); };
  }, []);

  // popover rows: pick on touchend without stealing focus from the textarea
  useEffect(() => {
    const el = popRef.current; if (!el) return; let y0 = 0;
    const s = (e) => { y0 = e.touches[0].clientY; };
    const e2 = (e) => { const li = e.target.closest('[data-i]'); if (li && Math.abs(e.changedTouches[0].clientY - y0) < 8) { e.preventDefault(); choose(+li.dataset.i); } };
    el.addEventListener('touchstart', s, { passive: true }); el.addEventListener('touchend', e2);
    return () => { el.removeEventListener('touchstart', s); el.removeEventListener('touchend', e2); };
  });

  function act() {
    if (stateRef.current === 'stop') return stopStreaming();
    send();
  }
  function send() {
    const t = ta.current; const value = t.value.trim();
    const files = ATT.list.filter((a) => a.kind !== 'tool').map(({ kind, src, name }) => ({ kind, src, name }));
    const tool = ATT.list.find((a) => a.kind === 'tool');
    if (!value && !files.length) return;
    if (/^\/(new|clear)$/.test(value)) { setText(''); newChat(); return; }
    const r = t.getBoundingClientRect();
    sendMessage({ text: value, atts: files, tool: tool && tool.tool, from: { left: r.left + 12, top: r.top + 11 - t.scrollTop } });
    setText(''); setAtts([]); setPop(null); hSp.current.set(44);
  }
  function detect(v, caret) {
    const before = v.slice(0, caret); let m;
    if ((m = before.match(/^\/(\w*)$/))) {
      const q = m[1];
      const items = CMDS.map((c) => ({ c, f: fuzzy(q, c.k) || (q.length > 1 ? fuzzy(q, c.d) : null) })).filter((x) => x.f).sort((a, b) => b.f.score - a.f.score)
        .map(({ c, f }) => ({ key: c.k, title: <>/<Marked s={c.k} idx={fuzzy(q, c.k) ? f.idx : []} /></>, desc: c.d, leading: <span className="pop-ic"><Glyph name={c.ic} /></span>, pick: () => { if (c.run) { setText(''); c.run(); } else setText(c.p); } }));
      if (!pop) haptic('select');
      return setPop({ type: 'Commands', items, idx: 0 });
    }
    if ((m = before.match(/(?:^|\s)@(\w*)$/))) {
      const items = AGENTS.map((a) => ({ a, f: fuzzy(m[1], a.n) })).filter((x) => x.f).sort((a, b) => b.f.score - a.f.score)
        .map(({ a, f }) => ({ key: a.n, title: <>@<Marked s={a.n} idx={f.idx} /></>, desc: a.d, leading: <span className="pop-av" aria-hidden="true">{a.n[0]}</span>, pick: () => { const nb = before.replace(/@(\w*)$/, '@' + a.n + ' '); setText(nb + v.slice(caret)); requestAnimationFrame(() => ta.current.setSelectionRange(nb.length, nb.length)); } }));
      if (!pop) haptic('select');
      return setPop({ type: 'Agents', items, idx: 0 });
    }
    setPop(null);
  }
  function choose(i) { const it = pop && pop.items[i]; if (!it) return; setPop(null); haptic(); it.pick(); ta.current.focus({ preventScroll: true }); }
  function onKey(e) {
    if (pop && pop.items.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const d = e.key === 'ArrowDown' ? 1 : -1; setPop({ ...pop, idx: (pop.idx + d + pop.items.length) % pop.items.length }); haptic('select'); return; }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); choose(pop.idx); return; }
    }
    if (e.key === 'Escape') { if (pop) setPop(null); else if (S.ctx) { S.ctx = null; emit(); } return; }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); if (!ST.id) send(); }
  }
  const onFiles = async (inp) => {
    const files = Array.from(inp.files || []).slice(0, 4); inp.value = '';
    for (const f of files) { if (/^image\//.test(f.type)) { const src = await downscale(f); if (src) ATT.add({ kind: 'img', src, name: f.name }); } else ATT.add({ kind: 'file', name: f.name }); }
    haptic('select');
  };
  useEffect(() => { const el = document.getElementById('f-photos'); const h = (e) => onFiles(e.target); ['f-photos', 'f-camera', 'f-files'].forEach((id) => document.getElementById(id)?.addEventListener('change', h)); return () => ['f-photos', 'f-camera', 'f-files'].forEach((id) => document.getElementById(id)?.removeEventListener('change', h)); }, []);

  const ctx = S.ctx;
  const empty = !text;
  return (
    <div className={'lu-composer' + (rec ? ' recording ' + rec : '')} ref={root}>
      {pop && (
        <Card level={4} className="lu-pop" ref={popRef} onMouseDown={(e) => e.preventDefault()}>
          <Text size="micro" tone="secondary" weight="semibold" className="pop-h">{pop.type}</Text>
          {pop.items.length ? (
            <List variant="plain" label={pop.type} id="lu-pop-list">
              {pop.items.map((it, i) => <ListItem key={it.key} data-i={i} id={'pop-' + i} className={i === pop.idx ? 'active' : ''} aria-selected={i === pop.idx} title={it.title} description={it.desc} leading={it.leading} onClick={() => choose(i)} />)}
            </List>
          ) : <Text size="label" tone="secondary" className="pop-empty">No matches</Text>}
        </Card>
      )}
      {ctx && (
        <Card level={4} className="lu-ctx"><Banner tone="info" title={ctx.type === 'reply' ? `Replying to ${ctx.m.role === 'user' ? 'yourself' : 'Lumen'}` : 'Editing message'} onDismiss={() => { if (ctx.type === 'edit') setText(''); S.ctx = null; emit(); }}>
          <Text size="label" tone="secondary" truncate>{plainOf(ctx.m).replace(/\s+/g, ' ').slice(0, 140)}</Text>
        </Banner></Card>
      )}
      {atts.length > 0 && (
        <div className="lu-atts" aria-label="Attachments">
          {atts.map((a) => a.kind === 'img'
            ? <span key={a.id} className="att"><Image src={a.src} alt={a.name} /><IconButton size="sm" aria-label={`Remove ${a.name}`} className="att-x" onClick={() => setAtts((x) => x.filter((y) => y.id !== a.id))}><RawGlyph name="x" /></IconButton></span>
            : <Chip key={a.id} onRemove={() => setAtts((x) => x.filter((y) => y.id !== a.id))} removeLabel={a.name}>{a.name}</Chip>)}
        </div>
      )}
      <Card as="div" className="lu-bar">
        <div className="bar-row">
          <IconButton aria-label="Add photos, files and tools" aria-haspopup="dialog" className={'plus' + (S.ui.sheet === 'attach' ? ' open' : '')} onClick={() => { haptic(); openSheet('attach'); }}><RawGlyph name="plus" /></IconButton>
          <div className="field">
            {empty && <div className="ph" aria-hidden="true" key={ph}>{PLACEHOLDERS[ph].split('').map((ch, i) => <span key={i} style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>)}</div>}
            <Textarea ref={ta} id="lu-input" rows={1} value={text} enterKeyHint="send" autoComplete="off"
              aria-label="Message Lumen. Type slash for commands, at for agents." aria-expanded={!!pop} aria-controls={pop ? 'lu-pop-list' : undefined} aria-activedescendant={pop && pop.items.length ? 'pop-' + pop.idx : undefined}
              onChange={(e) => { setText(e.target.value); detect(e.target.value, e.target.selectionStart); }}
              onKeyDown={onKey} onClick={(e) => detect(e.target.value, e.target.selectionStart)}
              onBlur={() => setTimeout(() => { if (document.activeElement !== ta.current) setPop(null); }, 150)} />
          </div>
          {empty && !rec && <IconButton variant="ghost" aria-label="Start voice chat" className="orb-btn" onClick={() => { S.ui.voice = true; emit(); }}><span className="mini-orb" /></IconButton>}
          <IconButton ref={prim} variant="loud" className="primary" data-state={state} aria-label={rec === 'locked' ? 'Send voice message' : state === 'stop' ? 'Stop generating' : state === 'send' ? 'Send message' : 'Hold to record a voice message'}>
            <RawGlyph name="mic" className="pi pi-mic" /><RawGlyph name="up" className="pi pi-send" /><RawGlyph name="stop" className="pi pi-stop" />
          </IconButton>
        </div>
        <div className="rec" aria-hidden={!rec}>
          {rec === 'locked' && <IconButton variant="ghost" size="sm" aria-label="Discard recording" onClick={() => Rec.cancel()}><RawGlyph name="trash" /></IconButton>}
          <span className="rec-dot" /><span className="rec-time tnum" ref={time}>0:00</span>
          <canvas className="rec-wave" ref={cv} />
          {rec !== 'locked' && <span className="rec-hint" ref={hint}>‹ Slide to cancel</span>}
        </div>
      </Card>
      {rec && rec !== 'locked' && <Card level={4} className="rec-lock" aria-hidden="true"><span ref={lk}><RawGlyph name="lock" /></span><RawGlyph name="chevUp" className="lk-chev" /></Card>}
      {rec && <Card level={4} className="rec-cap" aria-live="polite"><Text size="label">{cap || 'Listening…'}</Text></Card>}
    </div>
  );
}
