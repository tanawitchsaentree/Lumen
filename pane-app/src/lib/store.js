/* App state. Plain mutable data + three subscription channels:
   app (structure), stream (the one message being generated), island (status pill).
   Streaming emits only on the stream channel, so a token re-renders one message, not the thread. */
import { useSyncExternalStore } from 'react';
import { uid, sleep, rand, haptic, Sound } from './core.js';
import { Engine, seedConvos, modelOf } from './engine.js';
import { parseMD, unitsOf, plainMD } from './md.js';

function channel() {
  let v = 0; const subs = new Set();
  const sub = (f) => { subs.add(f); return () => subs.delete(f); };
  return { emit() { v++; subs.forEach((f) => f()); }, use() { return useSyncExternalStore(sub, () => v); }, sub, ver: () => v };
}
export const appCh = channel();
export const streamCh = channel();
export const islandCh = channel();
export const emit = () => appCh.emit();
/** Re-renders only while message `id` is the one streaming (and once when it finishes). */
export const useStreamFor = (id) => useSyncExternalStore(streamCh.sub, () => (ST.id === id ? 'v' + streamCh.ver() : 'idle'));
export const useStreaming = () => useSyncExternalStore(streamCh.sub, () => !!ST.id);

export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const DEFAULTS = { theme: 'dark', scene: 'aurora', haptics: true, sound: false, speed: 1, textSize: 2, model: 'lumen-2', reasoning: true };
export const settings = Object.assign({}, DEFAULTS, LS.get('lumen.settings', {}));
if (!settings.darkScene) { settings.theme = 'dark'; settings.darkScene = true; } // one-time move to the dark look

export const S = {
  convos: [], currentId: null, loading: false,
  ui: { drawer: false, sheet: null, sheetData: null, palette: false, voice: false, reactFor: null, lightbox: null },
  ctx: null,            // { type: 'reply' | 'edit', m }
  justSent: null,       // { id, from } for the send flight
  notices: [],
};
export const ST = { id: null, phase: 'idle', budget: 0, think: '', thinkT: 0, tools: {}, blocks: 0, tok: null };
export const ISL = { kind: null, text: '', sticky: null, t0: 0 };

let saveT = 0;
export function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    LS.set('lumen.convos', S.convos.map((c) => ({ ...c, messages: c.messages.map(({ rev, slide, reactPop, ...m }) => (m.voice ? { ...m, voice: { ...m.voice, url: undefined } } : m)) })));
    LS.set('lumen.settings', settings);
  }, 250);
}
export function initStore() {
  const raw = LS.get('lumen.convos', null);
  const ok = Array.isArray(raw) ? raw.filter((c) => c && Array.isArray(c.messages) && c.messages.every((m) => m && Array.isArray(m.versions) && m.versions.length)) : null;
  S.convos = ok || seedConvos();
  S.convos.forEach((c) => c.messages.forEach((m) => { m.rev = 0; m.reactions = m.reactions || []; m.vi = Math.min(m.vi | 0, m.versions.length - 1); m.versions.forEach((v) => { if (v.state === 'streaming') v.state = 'done'; }); }));
}
export const curV = (m) => m.versions[m.vi];
export const current = () => S.convos.find((c) => c.id === S.currentId) || null;
export const touch = (m) => { m.rev = (m.rev || 0) + 1; };
export const setting = (k, v) => { settings[k] = v; save(); emit(); };
export function plainOf(m) {
  const v = curV(m);
  if (m.role === 'user') return v.text || '';
  return plainMD(v.md);
}

/* ---------- notices (Pane Toast / Snackbar) ---------- */
export function notify(n) {
  const id = uid();
  S.notices = [...S.notices.filter((x) => x.kind !== n.kind || n.kind !== 'snack'), { id, ...n }];
  emit();
  return id;
}
export function dropNotice(id) { S.notices = S.notices.filter((x) => x.id !== id); emit(); }

/* ---------- island ---------- */
let islT = 0;
export const island = {
  flash(kind, text, ms = 1500) { Object.assign(ISL, { kind, text }); islandCh.emit(); clearTimeout(islT); islT = setTimeout(() => island.restore(), ms); },
  restore() {
    if (ISL.sticky === 'offline') Object.assign(ISL, { kind: 'offline', text: 'Offline' });
    else if (ISL.sticky === 'gen') Object.assign(ISL, { kind: 'gen', text: 'Generating' });
    else Object.assign(ISL, { kind: null, text: '' });
    islandCh.emit();
  },
  gen() { ISL.sticky = 'gen'; ISL.t0 = performance.now(); clearTimeout(islT); Object.assign(ISL, { kind: 'gen', text: 'Generating' }); islandCh.emit(); },
  done(stopped) { ISL.sticky = navigator.onLine === false ? 'offline' : null; island.flash(stopped ? 'info' : 'saved', stopped ? 'Stopped' : 'Done', 900); },
  offline(on) { ISL.sticky = on ? 'offline' : ST.id ? 'gen' : null; if (on) { clearTimeout(islT); island.restore(); haptic(); } else island.flash('online', 'Back online', 1600); },
};

/* ---------- conversation actions ---------- */
function titleFrom(text) {
  const t = text.replace(/^\/\w+\s*/, '').replace(/@\w+\s*/g, '').replace(/[?.!]+$/, '').trim();
  if (!t) return 'New chat';
  const w = t.split(/\s+/);
  const s = w.slice(0, 6).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + (w.length > 6 ? '…' : '');
}
export async function sendMessage({ text = '', atts = [], tool = null, voice = null, from = null }) {
  if (ST.id) return;
  if (!text && !atts.length && !voice) return;
  if (S.ctx && S.ctx.type === 'edit') { const m = S.ctx.m; S.ctx = null; commitEdit(m, text); return; }
  let c = current();
  if (!c) { c = { id: uid(), title: titleFrom(text || 'Photo'), pinned: false, archived: false, updated: Date.now(), messages: [] }; S.convos.unshift(c); S.currentId = c.id; }
  const m = { id: uid(), role: 'user', t: Date.now(), versions: [{ text, atts }], vi: 0, reactions: [], rev: 0, replyTo: null, voice };
  if (S.ctx && S.ctx.type === 'reply') m.replyTo = { id: S.ctx.m.id, text: plainOf(S.ctx.m).replace(/\s+/g, ' ').slice(0, 160) };
  S.ctx = null;
  c.messages.push(m); c.updated = Date.now();
  S.justSent = { id: m.id, from };
  haptic(); Sound.play('send');
  emit(); save();
  await sleep(420);
  const kind = tool ? { web: 'tools', research: 'tools', image: 'gallery' }[tool] : undefined;
  respondTo(c, m, kind);
}
export async function respondTo(c, userMsg, kind) {
  const uv = curV(userMsg); const text = uv.text || '';
  const agent = (text.match(/@(Researcher|Coder|Designer|Analyst)\b/) || [])[1] || null;
  const r = Engine.respond(text, { atts: uv.atts, kind });
  const m = { id: uid(), role: 'ai', t: Date.now(), versions: [{ md: r.md, think: r.think, agent, state: 'streaming' }], vi: 0, reactions: [], rev: 0 };
  c.messages.push(m); emit();
  await runStream(c, m);
}
const wordDelay = (w) => {
  let d = rand(16, 46);
  if (/[.!?]["”')]*\s*$/.test(w)) d += rand(120, 260);
  else if (/[,;:—–]\s*$/.test(w)) d += rand(50, 110);
  if (Math.random() < 0.035) d += rand(140, 320);
  return d / settings.speed;
};
export async function runStream(c, m) {
  const v = curV(m); const tok = { stop: false };
  Object.assign(ST, { id: m.id, phase: 'typing', budget: 0, think: '', thinkT: 0, tools: {}, blocks: 0, tok });
  v.state = 'streaming'; delete v.stopAt;
  touch(m); emit(); streamCh.emit(); island.gen();
  await sleep(rand(380, 650) / Math.sqrt(settings.speed));
  if (v.think && settings.reasoning && !tok.stop) {
    ST.phase = 'thinking'; streamCh.emit();
    const t0 = performance.now(); const dur = (v.think.secs * 1000) / settings.speed;
    const ws = v.think.text.split(/(\s+)/); const per = dur / Math.max(1, ws.length);
    for (const w of ws) { if (tok.stop) break; ST.think += w; ST.thinkT = (performance.now() - t0) / 1000; streamCh.emit(); await sleep(per); }
    while (!tok.stop && performance.now() - t0 < dur) { ST.thinkT = (performance.now() - t0) / 1000; streamCh.emit(); await sleep(100); }
  }
  if (!tok.stop) {
    ST.phase = 'answer'; streamCh.emit();
    const units = unitsOf(parseMD(v.md));
    for (const u of units) {
      if (tok.stop) break;
      ST.budget++;
      if (u.k !== 'w' || u.first) ST.blocks++;
      streamCh.emit();
      if (u.k === 'w') await sleep(wordDelay(u.w));
      else if (u.k === 'line') await sleep(rand(22, 50) / settings.speed);
      else if (u.k === 'row') await sleep(110 / settings.speed);
      else if (u.k === 'card') {
        haptic('select');
        if (u.name === 'tools') {
          const steps = (u.args.steps || []).length; const t0 = performance.now();
          ST.tools[u.idx] = { done: 0, t0, secs: 0 };
          for (let s = 0; s < steps; s++) {
            if (tok.stop) break;
            await sleep(rand(650, 1250) / settings.speed);
            ST.tools[u.idx] = { done: s + 1, t0, secs: (performance.now() - t0) / 1000 };
            Sound.play('tick'); streamCh.emit();
          }
        } else if (u.name === 'error') { haptic('heavy'); island.flash('error', 'Something went wrong'); await sleep(200); }
        else await sleep(320 / settings.speed);
      } else await sleep(80);
    }
  }
  const stopped = tok.stop;
  if (stopped) { v.stopAt = ST.budget; v.thinkStopped = ST.phase !== 'answer'; v.state = 'stopped'; } else v.state = 'done';
  Object.assign(ST, { id: null, phase: 'idle', tok: null });
  c.updated = Date.now();
  touch(m); emit(); streamCh.emit();
  island.done(stopped); Sound.play('pop'); haptic();
  save();
}
export function stopStreaming() { if (ST.tok) { ST.tok.stop = true; haptic(); } }

export function promptFor(c, m) {
  const i = c.messages.indexOf(m);
  for (let j = i - 1; j >= 0; j--) if (c.messages[j].role === 'user') return c.messages[j];
  return null;
}
export async function regenerate(m) {
  const c = current(); if (ST.id || !c) return;
  const u = promptFor(c, m); const text = u ? curV(u).text : '';
  const r = Engine.respond(text, { seed: m.versions.length, atts: u ? curV(u).atts : [] });
  m.versions.push({ md: r.md, think: r.think, agent: curV(m).agent, state: 'streaming' });
  m.vi = m.versions.length - 1; m.slide = 1;
  await runStream(c, m);
}
export async function retry(m) {
  const c = current(); if (ST.id || !c) return;
  const u = promptFor(c, m); const text = u ? curV(u).text : '';
  const r = Engine.respond(text.replace(/error|fail|crash/gi, ''), { forceOk: true, seed: 1 });
  Object.assign(curV(m), { md: r.md, think: r.think });
  await runStream(c, m);
}
export function switchVersion(m, dir) {
  const c = current(); const nv = m.vi + dir;
  if (!c || ST.id || nv < 0 || nv >= m.versions.length) return;
  haptic('select');
  if (m.role === 'ai') { m.vi = nv; m.slide = dir; touch(m); emit(); save(); return; }
  const idx = c.messages.indexOf(m);
  m.versions[m.vi].tail = c.messages.slice(idx + 1);
  c.messages = c.messages.slice(0, idx + 1).concat(m.versions[nv].tail || []);
  m.versions[nv].tail = null; m.vi = nv; m.slide = dir; touch(m); emit(); save();
}
export function commitEdit(m, text) {
  const c = current(); const idx = c.messages.indexOf(m);
  m.versions[m.vi].tail = c.messages.slice(idx + 1);
  m.versions.push({ text, atts: curV(m).atts || [] });
  m.vi = m.versions.length - 1; m.slide = 1;
  c.messages = c.messages.slice(0, idx + 1);
  touch(m); haptic(); Sound.play('send'); emit(); save();
  setTimeout(() => respondTo(c, m), 300);
}
export function deleteMsg(m) {
  const c = current(); const idx = c.messages.indexOf(m); if (idx < 0) return;
  c.messages.splice(idx, 1); emit(); save();
  notify({ kind: 'snack', message: 'Message deleted', action: { label: 'Undo', altText: 'Restore the deleted message', onClick: () => { c.messages.splice(idx, 0, m); emit(); save(); } } });
}
export function react(m, e) {
  m.reactions = m.reactions.includes(e) ? m.reactions.filter((x) => x !== e) : [e];
  m.reactPop = e; touch(m); haptic(); Sound.play('tick'); emit(); save();
}
export function togglePinMsg(m) { m.pinned = !m.pinned; touch(m); emit(); save(); island.flash('saved', m.pinned ? 'Pinned' : 'Unpinned'); }
export function setRating(m, val) { m.rating = m.rating === val ? 0 : val; touch(m); emit(); save(); }

export async function openConvo(id) {
  S.ui.drawer = false;
  if (S.currentId === id) { emit(); return; }
  S.currentId = id; S.ctx = null; S.loading = true; emit();
  await sleep(420); S.loading = false; emit();
}
export function newChat() {
  if (ST.id) stopStreaming();
  S.ui.drawer = false; S.ctx = null;
  const go = () => { S.currentId = null; emit(); };
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && current()) {
    document.documentElement.classList.add('vt-thread');
    try { document.startViewTransition(go).finished.finally(() => document.documentElement.classList.remove('vt-thread')); } catch (e) { go(); }
  } else go();
  haptic();
}
export function convoAction(c, act) {
  if (act === 'pin') { c.pinned = !c.pinned; island.flash('saved', c.pinned ? 'Pinned' : 'Unpinned'); }
  if (act === 'archive') { c.archived = !c.archived; island.flash('saved', c.archived ? 'Archived' : 'Restored'); }
  if (act === 'delete') {
    const i = S.convos.indexOf(c); S.convos.splice(i, 1);
    if (S.currentId === c.id) S.currentId = null;
    notify({ kind: 'snack', message: 'Chat deleted', action: { label: 'Undo', altText: 'Restore the deleted chat', onClick: () => { S.convos.splice(i, 0, c); emit(); save(); } } });
  }
  haptic(); emit(); save();
}
export function setModel(id) { settings.model = id; save(); emit(); island.flash('info', `Switched to ${modelOf(id).name}`, 1200); haptic(); }
export function openSheet(name, data = null) { S.ui.sheet = name; S.ui.sheetData = data; S.ui.drawer = false; emit(); }
export function closeSheet() { S.ui.sheet = null; emit(); }
