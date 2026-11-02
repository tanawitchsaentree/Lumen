import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card } from 'pane-react/Card';
import { Heading } from 'pane-react/Heading';
import { Text } from 'pane-react/Text';
import { Skeleton } from 'pane-react/Skeleton';
import { IconButton } from 'pane-react/IconButton';
import { Badge } from 'pane-react/Badge';
import { Menu } from 'pane-react/Menu';
import { UserMessage, AIMessage } from './Messages.jsx';
import { Home } from './Home.jsx';
import { RawGlyph } from '../lib/glyph.jsx';
import { S, ST, appCh, streamCh, current, emit, convoAction } from '../lib/store.js';
import { gesture, Spring, SPR, rubber, clamp, haptic, Sound, smartDay, fmtTime, RM, rand } from '../lib/core.js';

/* Shared scroll state the rest of the app reads (composer height, keyboard ride). */
export const SCROLL = { atBottom: true, touching: false, el: null, inner: null, collapse: 0, userT: 0 };
export function stickToBottom() { const s = SCROLL.el; if (s && SCROLL.atBottom && !SCROLL.touching) s.scrollTop = s.scrollHeight; }

function burst(x, y) {
  if (RM) return;
  const fx = document.getElementById('fx');
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i'); p.className = 'spark';
    const sz = 6 * rand(0.5, 1.2); p.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px`;
    fx.appendChild(p);
    const a = rand(-Math.PI * 0.95, Math.PI * 0.45), d = rand(16, 44);
    p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0)`, opacity: 0 }], { duration: rand(480, 760), easing: 'cubic-bezier(.15,.85,.3,1)' }).onfinish = () => p.remove();
  }
}
/* FLIP: the text leaves the composer and lands in its bubble on a spring, then a spark burst. */
function flyIn(id, from) {
  const bub = document.querySelector(`.row[data-id="${id}"] .bubble`);
  if (!bub) return;
  const to = bub.getBoundingClientRect();
  const done = () => burst(to.right - 10, to.top + to.height / 2);
  if (!from || RM) { bub.animate([{ opacity: 0, transform: 'translateY(30px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1.12)' }); setTimeout(done, 200); return; }
  const cs = getComputedStyle(bub);
  const dx = from.left - (to.left + parseFloat(cs.paddingLeft)), dy = from.top - (to.top + parseFloat(cs.paddingTop));
  bub.classList.add('flying');
  let fired = false;
  new Spring(0, { stiffness: 280, damping: 24, precision: 0.002 }, (p) => {
    const q = 1 - p;
    bub.style.transform = `translate3d(${dx * q}px,${dy * q}px,0) scale(${0.96 + 0.04 * p})`;
    bub.style.setProperty('--bub-a', clamp(p * 1.7, 0, 1));
    if (!fired && p > 0.9) { fired = true; done(); }
  }).to(1).then(() => { bub.style.transform = ''; bub.style.removeProperty('--bub-a'); bub.classList.remove('flying'); });
}

function ThreadSkeleton() {
  return (
    <div className="lu-skel" aria-busy="true" aria-label="Loading conversation">
      <div className="sk-r"><Skeleton shape="block" style={{ inlineSize: '62%', blockSize: 44 }} /></div>
      <Card className="lu-ai"><Skeleton shape="circle" style={{ inlineSize: 24, blockSize: 24 }} /><Skeleton lines={4} /></Card>
      <div className="sk-r"><Skeleton shape="block" style={{ inlineSize: '44%', blockSize: 44 }} /></div>
      <Card className="lu-ai"><Skeleton lines={5} /></Card>
    </div>
  );
}

export function Thread() {
  appCh.use();
  const c = current();
  const scRef = useRef(null), innerRef = useRef(null), listRef = useRef(null);
  const [far, setFar] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastBlocks = useRef(0);

  useEffect(() => {
    SCROLL.el = scRef.current; SCROLL.inner = innerRef.current;
    const s = scRef.current; let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dist = s.scrollHeight - s.scrollTop - s.clientHeight;
        // only a scroll the reader made can unpin the bottom; layout growth re-sticks instead
        const byUser = SCROLL.touching || performance.now() - SCROLL.userT < 900;
        if (dist < 70) SCROLL.atBottom = true; else if (byUser) SCROLL.atBottom = false; else if (SCROLL.atBottom) stickToBottom();
        setFar(!SCROLL.atBottom); if (SCROLL.atBottom) setUnread(0);
        const p = clamp((s.scrollTop - 10) / 90, 0, 1);
        SCROLL.collapse = p;
        document.documentElement.style.setProperty('--lu-collapse', p);
        document.documentElement.classList.toggle('lu-collapsed', p > 0.7);
      });
    };
    s.addEventListener('scroll', onScroll, { passive: true });
    const tsOn = () => { SCROLL.touching = true; }, tsOff = () => { SCROLL.touching = false; onScroll(); };
    s.addEventListener('touchstart', tsOn, { passive: true }); s.addEventListener('touchend', tsOff, { passive: true });
    const mark = () => { SCROLL.userT = performance.now(); };
    s.addEventListener('wheel', mark, { passive: true }); s.addEventListener('keydown', mark); s.addEventListener('focusin', mark);
    // content that grows on its own (charts measuring themselves, images) keeps the bottom pinned
    const ro = new ResizeObserver(() => stickToBottom()); ro.observe(innerRef.current);
    const stick = () => requestAnimationFrame(stickToBottom);
    const un1 = appCh.sub(stick);
    const un2 = streamCh.sub(() => {
      stick();
      if (ST.blocks !== lastBlocks.current) { if (ST.blocks > lastBlocks.current && !SCROLL.atBottom) setUnread((u) => u + 1); lastBlocks.current = ST.blocks; }
    });
    return () => { s.removeEventListener('scroll', onScroll); un1(); un2(); ro.disconnect(); };
  }, []);

  // new conversation / opened conversation → jump to the latest message
  useLayoutEffect(() => { const s = scRef.current; s.scrollTop = s.scrollHeight; SCROLL.atBottom = true; setUnread(0); }, [S.currentId, S.loading]);

  // send flight
  useLayoutEffect(() => {
    if (!S.justSent) return;
    const { id, from } = S.justSent; S.justSent = null;
    const s = scRef.current; s.scrollTop = s.scrollHeight; SCROLL.atBottom = true;
    flyIn(id, from);
  });

  // swipe right on a message → reply; drag the list left → timestamps
  useEffect(() => {
    const list = listRef.current; if (!list) return;
    let mode = null, row = null, sw = null, ico = null, hot = false;
    const ts = new Spring(0, { ...SPR.smooth, precision: 0.2 }, (v) => { list.style.transform = v ? `translate3d(${v}px,0,0)` : ''; });
    const g = gesture(list, {
      start: (pt) => { if (pt.x < 26 || pt.target.closest('.no-gesture, input, textarea, [role="slider"]')) return false; row = pt.target.closest('.row'); return true; },
      lock: (axis, dx) => {
        if (axis !== 'x') return false;
        if (dx > 0 && row) { mode = 'reply'; sw = row.querySelector('.sw'); ico = row.querySelector('.reply-ico'); hot = false; return true; }
        if (dx < 0) { mode = 'ts'; ts.stop(); return true; }
        return false;
      },
      move: (dx) => {
        if (mode === 'reply') {
          const tx = rubber(Math.max(0, dx), 240, 0.85);
          sw.style.transform = `translate3d(${tx}px,0,0)`;
          const p = clamp(tx / 54, 0, 1); ico.style.opacity = p; ico.style.transform = `scale(${0.4 + 0.6 * p + (p >= 1 ? 0.12 : 0)})`;
          const h = p >= 1; if (h !== hot) { hot = h; ico.classList.toggle('hot', h); if (h) { haptic(); Sound.play('tick'); } }
        } else if (mode === 'ts') { const raw = Math.max(0, -dx); ts.set(-(raw < 62 ? raw : 62 + rubber(raw - 62, 80))); }
      },
      end: ({ vx }) => {
        if (mode === 'reply') {
          const t = sw, ic = ico, r = row, wasHot = hot;
          const cur = new DOMMatrixReadOnly(getComputedStyle(t).transform).m41 || 0;
          new Spring(cur, SPR.bouncy, (v) => { t.style.transform = v > 0.3 ? `translate3d(${v}px,0,0)` : ''; const p = clamp(v / 54, 0, 1); ic.style.opacity = p; ic.style.transform = `scale(${0.4 + 0.6 * p})`; }).to(0, { velocity: vx * 0.5 });
          ic.classList.remove('hot');
          if (wasHot) { const m = current()?.messages.find((x) => x.id === r.dataset.id); if (m) { S.ctx = { type: 'reply', m }; emit(); document.getElementById('lu-input')?.focus({ preventScroll: true }); } }
        } else if (mode === 'ts') ts.to(0, { velocity: vx });
        mode = null;
      },
    });
    return () => g.cancel();
  }, [S.currentId, S.loading, !!c && c.messages.length > 0]);

  const mode = !c || !c.messages.length ? 'home' : S.loading ? 'loading' : 'thread';
  document.documentElement.dataset.mode = mode;
  let prevT = 0;
  const rows = mode === 'thread' ? c.messages.map((m, i) => {
    const sep = m.t - prevT > 45 * 60e3; prevT = m.t;
    const prev = c.messages[i - 1], next = c.messages[i + 1];
    const gStart = !(prev && prev.role === 'user' && !sep);
    const nextSep = next && next.t - m.t > 45 * 60e3;
    const gEnd = !(next && next.role === 'user' && !nextSep);
    return (
      <Fragment key={m.id}>
        {sep && <div className="sep-time" role="separator"><Text as="span" size="caption" tone="secondary" className="tnum"><b>{smartDay(m.t)}</b> {fmtTime(m.t)}</Text></div>}
        {m.role === 'user' ? <UserMessage m={m} rev={m.rev} gStart={gStart} gEnd={gEnd} /> : <AIMessage m={m} rev={m.rev} />}
      </Fragment>
    );
  }) : null;

  return (
    <>
      <div className="lu-scroller" ref={scRef} id="lu-scroller">
        <div className="lu-inner" ref={innerRef} style={{ viewTransitionName: 'thread' }}>
          {mode === 'home' && <Home />}
          {mode === 'loading' && <ThreadSkeleton />}
          {mode === 'thread' && (
            <>
              <Card as="header" className="lu-lt">
                <div className="lt-row">
                  <div className="lt-txt">
                    <Heading level={1} size="headline">{c.title}</Heading>
                    <Text size="label" tone="secondary" className="tnum">{c.messages.length} messages · {smartDay(c.messages[0].t)}{c.pinned ? ' · Pinned' : ''}</Text>
                  </div>
                  <Menu label="Chat options" align="end" trigger={<IconButton aria-label="Chat options"><RawGlyph name="more" /></IconButton>}
                    items={[
                      { label: c.pinned ? 'Unpin chat' : 'Pin chat', icon: <RawGlyph name="pin" />, onSelect: () => convoAction(c, 'pin') },
                      { label: c.archived ? 'Restore chat' : 'Archive chat', icon: <RawGlyph name="archive" />, onSelect: () => convoAction(c, 'archive') },
                      'separator',
                      { label: 'Delete chat', tone: 'critical', icon: <RawGlyph name="trash" />, onSelect: () => convoAction(c, 'delete') },
                    ]} />
                </div>
              </Card>
              <div className="lu-list" ref={listRef} role="log" aria-label="Messages" aria-live="off">{rows}</div>
            </>
          )}
        </div>
      </div>
      <div className={'lu-fab' + (far && mode === 'thread' ? ' show' : '')}>
        <IconButton aria-label={unread ? `Scroll to latest, ${unread} new` : 'Scroll to latest message'} onClick={() => { haptic(); scRef.current.scrollTo({ top: scRef.current.scrollHeight, behavior: RM ? 'auto' : 'smooth' }); }}><RawGlyph name="down" /></IconButton>
        {unread > 0 && <span className="lu-unread" key={unread}><Badge>{unread > 99 ? '99+' : String(unread)}</Badge></span>}
      </div>
    </>
  );
}
