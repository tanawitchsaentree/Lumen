import { memo, useEffect, useRef, useState } from 'react';
import { Card } from 'pane-react/Card';
import { Text } from 'pane-react/Text';
import { Badge } from 'pane-react/Badge';
import { IconButton } from 'pane-react/IconButton';
import { ContextMenu } from 'pane-react/ContextMenu';
import { Accordion } from 'pane-react/Accordion';
import { RawGlyph } from '../lib/glyph.jsx';
import { aiMark } from '../lib/icons.js';
import { Markdown } from './Markdown.jsx';
import { SCROLL } from './Thread.jsx';
import { fmtTime, fmtDur, copyText, haptic, clamp } from '../lib/core.js';
import { S, ST, useStreamFor, emit, curV, plainOf, island, notify, regenerate, switchVersion, setRating, deleteMsg, togglePinMsg, openSheet } from '../lib/store.js';

export const EMOJI = [['❤️', 'Love'], ['👍', 'Like'], ['👎', 'Dislike'], ['😂', 'Haha'], ['‼️', 'Emphasise'], ['❓', 'Question']];

function menuFor(m) {
  const isUser = m.role === 'user';
  return [
    { label: 'Reply', icon: <RawGlyph name="reply" />, onSelect: () => { S.ctx = { type: 'reply', m }; emit(); haptic(); } },
    { label: 'React…', icon: <RawGlyph name="heart" />, onSelect: () => { S.ui.reactFor = m; emit(); } },
    { label: 'Copy', icon: <RawGlyph name="copy" />, onSelect: () => { copyText(plainOf(m)); island.flash('copied', 'Copied'); } },
    ...(isUser && !m.voice ? [{ label: 'Edit', icon: <RawGlyph name="edit" />, onSelect: () => { S.ctx = { type: 'edit', m }; emit(); } }] : []),
    { label: 'Select Text', icon: <RawGlyph name="select" />, onSelect: () => openSheet('select', m) },
    { label: m.pinned ? 'Unpin' : 'Pin', icon: <RawGlyph name="pin" />, onSelect: () => togglePinMsg(m) },
    'separator',
    { label: 'Delete', tone: 'critical', icon: <RawGlyph name="trash" />, onSelect: () => deleteMsg(m) },
  ];
}

function Reacts({ m }) {
  if (!m.reactions || !m.reactions.length) return null;
  return <div className="lu-reacts">{m.reactions.map((e) => <span key={e} className={'lu-react' + (m.reactPop === e ? ' pop' : '')} role="img" aria-label={`Reaction ${e}`}>{e}</span>)}</div>;
}
function Branch({ m }) {
  if (m.versions.length < 2) return null;
  return (
    <div className="lu-branch" role="group" aria-label="Versions">
      <IconButton variant="ghost" size="sm" aria-label="Previous version" disabled={m.vi === 0} onClick={() => switchVersion(m, -1)}><RawGlyph name="chevL" /></IconButton>
      <Text size="caption" tone="secondary" className="tnum">{m.vi + 1}/{m.versions.length}</Text>
      <IconButton variant="ghost" size="sm" aria-label="Next version" disabled={m.vi === m.versions.length - 1} onClick={() => switchVersion(m, 1)}><RawGlyph name="chevR" /></IconButton>
    </div>
  );
}
const Quote = ({ q }) => (
  <button className="lu-quote" onClick={() => { const r = document.querySelector(`[data-id="${q.id}"]`); if (!r) return; SCROLL.userT = performance.now(); r.scrollIntoView({ behavior: 'smooth', block: 'center' }); r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }} aria-label={`Replying to: ${q.text.slice(0, 80)}`}>
    <Text size="caption" tone="secondary">{q.text}</Text>
  </button>
);

/* ---------- voice note playback ---------- */
export const VOICE_BLOBS = new Map();
function VoiceNote({ m }) {
  const [p, setP] = useState(-1); const st = useRef(null);
  useEffect(() => () => stop(), []);
  const stop = () => { const s = st.current; if (!s) return; cancelAnimationFrame(s.raf); s.audio && s.audio.pause(); try { s.utt && speechSynthesis.cancel(); } catch (e) {} st.current = null; setP(-1); };
  const play = () => {
    if (st.current) return stop();
    const url = m.voice.url || VOICE_BLOBS.get(m.id); let audio = null, utt = null;
    if (url) { audio = new Audio(url); audio.play().catch(() => {}); } else if ('speechSynthesis' in window) { utt = new SpeechSynthesisUtterance(curV(m).text); speechSynthesis.cancel(); speechSynthesis.speak(utt); }
    const t0 = performance.now(); const dur = m.voice.dur * 1000;
    const step = () => { const s = st.current; if (!s) return; const v = audio && isFinite(audio.duration) && audio.duration ? audio.currentTime / audio.duration : (performance.now() - t0) / dur; setP(clamp(v, 0, 1)); if (v >= 1 || (audio && audio.ended)) return stop(); s.raf = requestAnimationFrame(step); };
    st.current = { audio, utt }; step();
  };
  const bars = m.voice.bars.map((b, i) => <i key={i} style={{ height: `${Math.round(18 + b * 82)}%` }} />);
  return (
    <div className="vb">
      <button className="vb-play" onClick={play} aria-label={p >= 0 ? 'Pause voice message' : 'Play voice message'}><RawGlyph name={p >= 0 ? 'pause' : 'play'} /></button>
      <div className="vb-bars" aria-hidden="true"><div className="bars">{bars}</div><div className="bars fill" style={{ clipPath: `inset(0 ${100 - Math.max(0, p) * 100}% 0 0)` }}>{bars}</div></div>
      <span className="vb-dur tnum">{fmtDur(m.voice.dur)}</span>
    </div>
  );
}

export const UserMessage = memo(function UserMessage({ m, gStart, gEnd }) {
  const v = curV(m);
  return (
    <div className={'row user' + (gStart ? ' g-start' : '') + (gEnd ? ' g-end' : '') + (m.slide ? ' slide' : '')} data-id={m.id} style={{ '--dir': m.slide || 1 }}>
      <div className="sw">
        <span className="reply-ico" aria-hidden="true"><RawGlyph name="reply" /></span>
        <div className="u-msg">
          {m.replyTo && <Quote q={m.replyTo} />}
          {v.atts && v.atts.length > 0 && <div className={'u-atts' + (v.atts.length === 1 ? ' one' : '')}>{v.atts.map((a, i) => a.kind === 'img' ? <img key={i} src={a.src} alt="Attached photo" /> : <span key={i} className="u-file"><RawGlyph name="file" />{a.name}</span>)}</div>}
          {(v.text || m.voice) && (
            <ContextMenu label="Message actions" items={menuFor(m)}>
              <div className={'bubble lu-solid' + (gEnd ? ' tail' : '') + (m.voice ? ' voice' : '')} tabIndex={0} role="article" aria-label={`You said: ${(v.text || 'voice message').slice(0, 120)}`}>
                {m.voice && <VoiceNote m={m} />}
                {m.voice ? <span className="vb-tx">{v.text}</span> : <span>{v.text}</span>}
                {m.pinned && <span className="u-pin"><RawGlyph name="pin" /></span>}
              </div>
            </ContextMenu>
          )}
          <Reacts m={m} />
        </div>
        <Branch m={m} />
      </div>
      <time className="ts tnum" dateTime={new Date(m.t).toISOString()}>{fmtTime(m.t)}</time>
    </div>
  );
}, (a, b) => a.m === b.m && a.rev === b.rev && a.gStart === b.gStart && a.gEnd === b.gEnd);

/* ---------- AI ---------- */
function LiveThink({ id }) {
  useStreamFor(id);
  const [open, setOpen] = useState(false);
  return (
    <div className="lu-think live">
      <button className="think-h" aria-expanded={open} onClick={() => { setOpen(!open); haptic('select'); }}>
        <RawGlyph name="brain" className="think-ic" /><span className="think-lbl">Thinking</span><span className="tnum">{ST.thinkT.toFixed(1)}s</span><RawGlyph name="chevR" className="think-chev" />
      </button>
      {open && <Text size="label" tone="secondary" className="think-in">{ST.think}</Text>}
    </div>
  );
}
function ActionsBar({ m, bodyRef }) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { if (Speak.cur === m.id) Speak.stop(); }, []);
  const share = () => { const t = plainOf(m); if (navigator.share) navigator.share({ title: 'From Lumen', text: t }).catch(() => {}); else { copyText(t); island.flash('copied', 'Copied to share'); } };
  const rate = (val) => { setRating(m, val); if (m.rating) { haptic(); notify({ kind: 'toast', title: m.rating > 0 ? 'Glad that helped' : 'Thanks for the feedback', tone: m.rating > 0 ? 'positive' : 'info', duration: 2500 }); } };
  return (
    <div className="lu-actions" role="toolbar" aria-label="Message actions">
      <IconButton variant="ghost" size="sm" aria-label={copied ? 'Copied' : 'Copy'} className={'lu-copy' + (copied ? ' done' : '')} onClick={() => { copyText(plainOf(m)); setCopied(true); haptic(); island.flash('copied', 'Copied'); setTimeout(() => setCopied(false), 1600); }}><RawGlyph name="copy" className="ic-copy" /><RawGlyph name="check" className="ic-check" /></IconButton>
      <IconButton variant="ghost" size="sm" aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'} aria-pressed={speaking} className={speaking ? 'on' : ''} onClick={() => Speak.toggle(m, bodyRef.current, setSpeaking)}><RawGlyph name="speaker" /></IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Good response" aria-pressed={m.rating === 1} className={m.rating === 1 ? 'on burst' : ''} onClick={() => rate(1)}><RawGlyph name="thumbUp" /></IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Bad response" aria-pressed={m.rating === -1} className={m.rating === -1 ? 'on burst' : ''} onClick={() => rate(-1)}><RawGlyph name="thumbDown" /></IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Share" onClick={share}><RawGlyph name="share" /></IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Regenerate" onClick={() => regenerate(m)}><RawGlyph name="regen" /></IconButton>
      <span className="lu-sp" />
      <Branch m={m} />
    </div>
  );
}
function AIBody({ m, v, live }) {
  useStreamFor(m.id);
  const isLive = live && ST.id === m.id;
  if (isLive && ST.phase === 'typing') return <div className="typing" aria-label="Lumen is typing"><i /><i /><i /></div>;
  if (isLive && ST.phase === 'thinking') return null;
  const budget = isLive ? ST.budget : v.state === 'stopped' ? (v.stopAt || 0) : Infinity;
  if (!isLive && v.state === 'stopped' && !v.stopAt) return <Text size="label" tone="secondary"><em>Stopped before answering.</em></Text>;
  return <Markdown md={v.md} budget={budget} live={isLive} msgId={m.id} />;
}
function ThinkBlock({ m, v }) {
  useStreamFor(m.id);
  if (ST.id === m.id && ST.phase === 'thinking') return <LiveThink id={m.id} />;
  if (ST.id === m.id && ST.phase === 'typing') return null;
  if (!v.think || v.thinkStopped) return null;
  return <Accordion className="lu-think" headingLevel={4} items={[{ value: 't', title: `Thought for ${v.think.secs}s`, content: <Text size="label" tone="secondary" className="think-in">{v.think.text}</Text> }]} />;
}
export const AIMessage = memo(function AIMessage({ m }) {
  const v = curV(m);
  useStreamFor(m.id);
  const live = ST.id === m.id;
  const bodyRef = useRef(null);
  return (
    <div className={'row ai' + (m.slide ? ' slide' : '')} data-id={m.id} style={{ '--dir': m.slide || 1 }}>
      <div className="sw">
        <span className="reply-ico" aria-hidden="true"><RawGlyph name="reply" /></span>
        <Card as="article" aria-label="Lumen replied" aria-busy={live} className="lu-ai">
          <div className="ai-head">
            <span className="ai-mark" dangerouslySetInnerHTML={{ __html: aiMark() }} />
            <Text size="label" weight="semibold">Lumen</Text>
            {v.agent && <Badge>@{v.agent}</Badge>}
            {v.state === 'stopped' && !live && <Badge dot>Stopped</Badge>}
            {m.pinned && <span className="ai-pin"><RawGlyph name="pin" /></span>}
          </div>
          <ThinkBlock m={m} v={v} />
          <ContextMenu label="Message actions" items={menuFor(m)}>
            <div className="ai-body" ref={bodyRef} key={m.vi}><AIBody m={m} v={v} live={live} /></div>
          </ContextMenu>
          <Reacts m={m} />
          {!live && <ActionsBar m={m} bodyRef={bodyRef} />}
        </Card>
      </div>
      <time className="ts tnum" dateTime={new Date(m.t).toISOString()}>{fmtTime(m.t)}</time>
    </div>
  );
}, (a, b) => a.m === b.m && a.rev === b.rev);

/* ---------- read aloud with a live word highlight (CSS Custom Highlight API) ---------- */
export const Speak = {
  cur: null, set: null, fb: 0,
  toggle(m, body, set) {
    if (this.cur) { const same = this.cur === m.id; this.stop(); if (same) return; }
    if (!('speechSynthesis' in window) || !body) { notify({ kind: 'toast', title: 'Read aloud isn’t supported here' }); return; }
    const map = []; let text = '';
    const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.lu-code, .lu-cardwrap') || !n.data.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = tw.nextNode())) { map.push({ n, s: text.length }); text += n.data + ' '; }
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text); u.rate = 1.02;
    let got = false;
    u.onboundary = (e) => { if (e.name && e.name !== 'word') return; got = true; this.mark(map, e.charIndex); };
    u.onend = u.onerror = () => { if (this.cur === m.id) this.stop(); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    this.cur = m.id; this.set = set; set(true);
    const ws = [...text.matchAll(/\S+/g)]; let wi = 0;
    this.fb = setInterval(() => { if (got || !this.cur) return; if (wi < ws.length) this.mark(map, ws[wi++].index); }, 340);
  },
  mark(map, idx) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    let e = map[0]; for (const x of map) { if (x.s <= idx) e = x; else break; }
    const off = idx - e.s; if (off < 0 || off >= e.n.data.length) return;
    const len = (e.n.data.slice(off).match(/^\S+/) || [''])[0].length; if (!len) return;
    const r = new Range(); r.setStart(e.n, off); r.setEnd(e.n, off + len);
    CSS.highlights.set('speak', new Highlight(r));
  },
  stop() {
    clearInterval(this.fb); try { speechSynthesis.cancel(); } catch (e) {}
    if (window.CSS && CSS.highlights) CSS.highlights.delete('speak');
    if (this.set) this.set(false);
    this.cur = null; this.set = null;
  },
};
