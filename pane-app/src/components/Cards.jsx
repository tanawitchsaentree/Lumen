import { useState } from 'react';
import { Card } from 'pane-react/Card';
import { Heading } from 'pane-react/Heading';
import { Text } from 'pane-react/Text';
import { Button } from 'pane-react/Button';
import { List, ListItem } from 'pane-react/List';
import { Spinner } from 'pane-react/Spinner';
import { Badge } from 'pane-react/Badge';
import { Banner } from 'pane-react/Banner';
import { LineChart } from 'pane-react/LineChart';
import { SegmentedControl } from 'pane-react/SegmentedControl';
import { Stat } from 'pane-react/Stat';
import { Progress } from 'pane-react/Progress';
import { Mesh } from 'pane-react/Mesh';
import { Icon } from 'pane-react/Icon';
import { RawGlyph, Glyph } from '../lib/glyph.jsx';
import { ARTIFACTS } from '../lib/engine.js';
import { LANG_NAMES } from '../lib/md.js';
import { ST, useStreamFor, LS, S, emit, openSheet, notify, retry, current } from '../lib/store.js';
import { haptic, Sound } from '../lib/core.js';

/* ---------- weather ---------- */
const WX = {
  sun: '<svg viewBox="0 0 64 64"><g class="rays" stroke="#FFD54A" stroke-width="3.5" stroke-linecap="round"><path d="M32 6v6M32 52v6M6 32h6M52 32h6M13.6 13.6l4.2 4.2M46.2 46.2l4.2 4.2M13.6 50.4l4.2-4.2M46.2 17.8l4.2-4.2"/></g><circle cx="32" cy="32" r="12" fill="#FFD54A"/></svg>',
  partly: '<svg viewBox="0 0 64 64"><g class="rays" stroke="#FFD54A" stroke-width="3" stroke-linecap="round"><path d="M26 6v5M8 24h5M13 11l3.5 3.5M39 11l-3.5 3.5"/></g><circle cx="26" cy="24" r="9" fill="#FFD54A"/><path class="cl" d="M20 50h26a9 9 0 0 0 .8-18A12 12 0 0 0 24 34a8 8 0 0 0-4 16Z" fill="#E8EEF6"/></svg>',
  rain: '<svg viewBox="0 0 64 64"><path class="cl" d="M16 40h30a10 10 0 0 0 1-20A14 14 0 0 0 20 22a9 9 0 0 0-4 18Z" fill="#C9D3DF"/><path d="M22 46l-3 7M32 46l-3 7M42 46l-3 7" stroke="#7CC4FF" stroke-width="3" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 64 64"><path d="M44 40A16 16 0 1 1 28 18a13 13 0 0 0 16 22Z" fill="#F5F0D7"/></svg>',
};
const Wx = ({ k, cls }) => <span className={'lu-wx ' + (cls || '')} aria-hidden="true" dangerouslySetInnerHTML={{ __html: WX[k] }} />;
function Weather({ args }) {
  const city = args.city || 'Kyoto'; const hr = new Date().getHours(); const base = 17;
  const hours = Array.from({ length: 8 }, (_, i) => {
    const h = (hr + i) % 24; const night = h < 6 || h > 18;
    return { l: i === 0 ? 'Now' : (h % 12 || 12) + (h < 12 ? 'a' : 'p'), t: Math.round(base + 3 * Math.sin(((h - 9) / 24) * Math.PI * 2)), ic: night ? 'moon' : i === 3 ? 'partly' : 'sun' };
  });
  const days = [['Today', 'sun', 9, 21], ['Fri', 'partly', 10, 19], ['Sat', 'sun', 8, 20], ['Sun', 'rain', 11, 16], ['Mon', 'partly', 9, 18]];
  const lo = 7, hi = 22;
  return (
    <Card as="section" aria-label={`Weather in ${city}`} className="lu-card lu-weather">
      <div className="w-top">
        <div>
          <Text size="label" weight="semibold" className="w-city">{city} <RawGlyph name="nav" /></Text>
          <div className="w-temp" aria-label={`${hours[0].t} degrees`}>{hours[0].t}°</div>
          <Text size="label" weight="semibold">Mostly sunny</Text>
          <Text size="caption" tone="secondary" className="tnum">H:21°  L:9°</Text>
        </div>
        <Wx k="sun" cls="w-big" />
      </div>
      <div className="w-hours no-gesture" role="list" aria-label="Hourly">
        {hours.map((h, i) => <div key={i} className="w-h" role="listitem"><Text size="caption" tone="secondary">{h.l}</Text><Wx k={h.ic} /><Text size="label" weight="semibold" className="tnum">{h.t}°</Text></div>)}
      </div>
      <div className="w-days" role="list" aria-label="Five-day forecast">
        {days.map(([d, ic, a, b]) => (
          <div key={d} className="w-d" role="listitem" aria-label={`${d}: low ${a}, high ${b}`}>
            <Text size="label">{d}</Text><Wx k={ic} /><Text size="label" tone="secondary" className="tnum lo">{a}°</Text>
            <span className="w-bar"><i style={{ left: `${((a - lo) / (hi - lo)) * 100}%`, right: `${100 - ((b - lo) / (hi - lo)) * 100}%` }} /></span>
            <Text size="label" className="tnum">{b}°</Text>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- gallery: Mesh as media ---------- */
export const GALLERY = [
  { t: 'Morning light', c: ['#F6C27A', '#F3E2B3', '#C5653A', '#7A3E22'] },
  { t: 'Linen & oak', c: ['#E8D8C0', '#C9A57A', '#8C6A48', '#4E3A2A'] },
  { t: 'Moss', c: ['#A8D88A', '#5FA36A', '#2E6B45', '#1B3A2A'] },
  { t: 'Clay', c: ['#F08C7A', '#E9B7A0', '#B04A3C', '#5A231E'] },
  { t: 'Dusk', c: ['#A889F2', '#5E7BE0', '#3A2D7A', '#1C1838'] },
  { t: 'Paper lamp', c: ['#FFE3A0', '#F6B860', '#C77A2E', '#5C3A18'] },
];
function Gallery() {
  return (
    <Card as="section" aria-label="Moodboard" className="lu-card lu-gallery">
      <div className="gal">
        {GALLERY.map((g, i) => (
          <figure key={i} className="g-item">
            <button className="g-tile" onClick={() => { haptic(); S.ui.lightbox = i; emit(); }} aria-label={`Open ${g.t}`} style={{ viewTransitionName: S.ui.lightbox === i ? undefined : undefined }}>
              <Mesh colors={g.c} rotate={i * 40} className="g-mesh" data-vt={'g' + i} />
            </button>
            <figcaption><Text size="caption" tone="secondary" truncate>{g.t}</Text></figcaption>
          </figure>
        ))}
      </div>
    </Card>
  );
}

/* ---------- chart: Pane LineChart ---------- */
const CHART = {
  rev: { name: 'Revenue', v: [182, 196, 191, 214, 238, 229, 251, 274, 268, 301, 322, 347], f: (x) => `$${x}k` },
  usr: { name: 'Users', v: [41, 44, 47, 46, 52, 58, 61, 66, 71, 75, 83, 90], f: (x) => `${x}k` },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function Chart() {
  const [k, setK] = useState('rev'); const s = CHART[k];
  const last = s.v[s.v.length - 1], first = s.v[0];
  return (
    <Card as="section" aria-label="Monthly chart" className="lu-card lu-chart">
      <div className="ch-top">
        <Stat label={`${s.name}, December`} value={s.f(last)} change={`${Math.round(((last - first) / first) * 100)}%`} direction="up" sentiment="positive" caption="vs January" />
        <SegmentedControl size="sm" label="Series" value={k} onValueChange={(v) => { setK(v); haptic('select'); }} options={[{ value: 'rev', label: 'Revenue' }, { value: 'usr', label: 'Users' }]} />
      </div>
      <div className="no-gesture"><LineChart key={k} label={`${s.name} by month`} description="Drag or use arrow keys to read each month" points={MONTHS} series={[{ name: s.name, values: s.v }]} area format={s.f} blockSize={190} /></div>
    </Card>
  );
}

/* ---------- poll: Buttons → Progress ---------- */
const POLL = { q: 'Where should we hold the Q1 offsite?', o: ['Lisbon — sun & seafood', 'Kyoto — temples & focus', 'Mexico City — food & art', 'Stay remote, save budget'], base: [7, 11, 5, 2] };
function Poll({ msgId, idx }) {
  const key = `lumen.poll.${msgId}.${idx}`;
  const [mine, setMine] = useState(() => LS.get(key, null));
  const votes = POLL.base.slice(); if (mine != null) votes[mine]++;
  const tot = votes.reduce((a, b) => a + b, 0);
  const vote = (i) => { setMine(i); LS.set(key, i); haptic(); Sound.play('tick'); };
  return (
    <Card as="section" aria-label={`Poll: ${POLL.q}`} className="lu-card lu-poll">
      <Badge dot>Poll</Badge>
      <Heading level={4} size="emphasis">{POLL.q}</Heading>
      {mine == null ? (
        <div className="poll-opts">{POLL.o.map((o, i) => <Button key={i} variant="glass" fullWidth onClick={() => vote(i)}>{o}</Button>)}</div>
      ) : (
        <div className="poll-res">{POLL.o.map((o, i) => <Progress key={i} label={(i === mine ? '✓ ' : '') + o} value={Math.round((votes[i] / tot) * 100)} showValue size="sm" className={'poll-bar' + (i === mine ? ' mine' : '')} />)}</div>
      )}
      <Text size="caption" tone="secondary" className="tnum">{tot} votes · {mine == null ? 'Tap to vote' : 'You voted'}</Text>
    </Card>
  );
}

/* ---------- map ---------- */
function MapCard({ args }) {
  const name = args.name || 'Kōyō Coffee Stand', area = args.area || 'Gion, Higashiyama';
  return (
    <Card as="section" aria-label={`Location: ${name}`} className="lu-card lu-map">
      <div className="map-art" aria-hidden="true">
        <svg viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice">
          <path className="water" d="M-10 118 C60 104 110 130 170 120 S280 98 350 110 V160 H-10Z" />
          <path className="park" d="M222 18c26-8 64 2 72 24s-14 40-46 38-52-12-54-30 6-26 28-32Z" />
          <path className="road" strokeWidth="7" d="M-10 60 H350" /><path className="road" strokeWidth="5" d="M100 -10 V140" />
          <path className="road" strokeWidth="4" d="M170 -10 C176 40 168 80 178 140" /><path className="road major" strokeWidth="8" d="M-10 104 C80 96 150 100 220 70 S320 30 350 26" />
        </svg>
        <span className="pin"><span className="pin-b"><RawGlyph name="sparkle" /></span></span>
      </div>
      <div className="map-info">
        <div><Text weight="semibold">{name}</Text><Text size="caption" tone="secondary">★ 4.8 · {area} · 6 min walk</Text></div>
        <Button size="sm" icon={<RawGlyph name="nav" />} onClick={() => { haptic(); notify({ kind: 'toast', title: 'Opening walking directions', tone: 'info' }); }}>Go</Button>
      </div>
    </Card>
  );
}

/* ---------- tool calls ---------- */
function Tools({ args, idx, live, msgId }) {
  useStreamFor(msgId);
  const steps = args.steps || [];
  const st = live ? ST.tools[idx] || { done: 0, secs: 0 } : { done: steps.length, secs: args.secs || 3.8 };
  const running = live && st.done < steps.length;
  return (
    <Card as="section" aria-label="Tool calls" aria-busy={running} className="lu-card lu-tools">
      <div className="tools-h">
        <Text size="label" weight="semibold">{running ? 'Working…' : `Used ${steps.length} tools`}</Text>
        <Text size="caption" tone="secondary" className="tnum">{(running ? (performance.now() - (st.t0 || performance.now())) / 1000 : st.secs).toFixed(1)}s</Text>
      </div>
      <List variant="plain" label="Steps">
        {steps.map((s, i) => {
          const state = i < st.done ? 'done' : i === st.done && running ? 'run' : 'pending';
          return (
            <ListItem key={i} className={'tool-step ' + state} title={s[0]} description={s[1]}
              leading={state === 'run' ? <Spinner size="sm" label={s[0]} /> : state === 'done' ? <span className="ts-ok"><Glyph name="check" size="sm" label="Done" /></span> : <span className="ts-wait" aria-label="Waiting" />} />
          );
        })}
      </List>
    </Card>
  );
}

function Artifact({ args }) {
  const a = ARTIFACTS[args.id] || ARTIFACTS.pomodoro;
  return (
    <Card as="section" aria-label="Artifact" className="lu-card lu-artifact">
      <List variant="plain" label="Artifact">
        <ListItem title={a.title} description={`${LANG_NAMES[a.lang] || a.lang} · ${a.code.split('\n').length} lines · Tap to preview`} leading={<span className="art-ic"><Glyph name="canvas" /></span>} chevron onClick={() => { haptic(); openSheet('artifact', a); }} />
      </List>
    </Card>
  );
}

function ErrorCard({ args, msgId }) {
  return (
    <Banner tone="critical" live="assertive" title={args.title || 'Response interrupted'} className="lu-error shake"
      action={<Button size="sm" variant="glass" icon={<RawGlyph name="regen" />} onClick={() => { const m = current()?.messages.find((x) => x.id === msgId); if (m) retry(m); }}>Retry</Button>}>
      {args.msg || 'The model is temporarily overloaded. Nothing was lost — try again.'}
    </Banner>
  );
}

export function CardBlock({ name, args, idx, msgId, live }) {
  const inner = (() => {
    switch (name) {
      case 'weather': return <Weather args={args} />;
      case 'gallery': return <Gallery />;
      case 'chart': return <Chart />;
      case 'poll': return <Poll msgId={msgId} idx={idx} />;
      case 'map': return <MapCard args={args} />;
      case 'tools': return <Tools args={args} idx={idx} live={live} msgId={msgId} />;
      case 'artifact': return <Artifact args={args} />;
      case 'error': return <ErrorCard args={args} msgId={msgId} />;
      default: return null;
    }
  })();
  return <div className={'lu-cardwrap' + (live ? ' tk-card' : '')}>{inner}</div>;
}
