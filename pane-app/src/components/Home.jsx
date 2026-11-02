import { Card } from 'pane-react/Card';
import { Heading } from 'pane-react/Heading';
import { Text } from 'pane-react/Text';
import { Button } from 'pane-react/Button';
import { Carousel } from 'pane-react/Carousel';
import { Mesh } from 'pane-react/Mesh';
import { RawGlyph, Glyph } from '../lib/glyph.jsx';
import { sendMessage, settings } from '../lib/store.js';
import { haptic } from '../lib/core.js';

export const CHIPS = [
  { t: 'Plan a weekend in Kyoto', s: 'Weather, cafés and a map', ic: 'mapPin', p: 'What will the weather be like in Kyoto this week?' },
  { t: 'Debug a React hook', s: 'Debounced search that cancels stale requests', ic: 'code', p: 'Write a React hook for debounced search that cancels stale requests' },
  { t: 'Chart our revenue', s: 'An interactive chart you can scrub', ic: 'chart', p: 'Chart our monthly revenue growth and break it down by quarter' },
  { t: 'Research flights', s: 'Watch the tools run step by step', ic: 'research', p: 'Research the best time to book flights to Tokyo' },
];
export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ['Still up?', 'Night owls get the quiet hours. What are we making?'];
  if (h < 12) return ['Good morning', 'Fresh start. What should we tackle first?'];
  if (h < 17) return ['Good afternoon', 'What can I help you move forward?'];
  if (h < 22) return ['Good evening', 'What should we make tonight?'];
  return ['Good night', 'One more idea before bed?'];
}
/** The app mark: a small Mesh object lit in the scene's colours (Mesh as an object, with glow). */
export const LogoMark = ({ className, style }) => (
  <span className={'lu-logo ' + (className || '')} style={style} aria-hidden="true">
    <Mesh preset={settings.scene} glow className="lu-logo-mesh" />
    <span className="lu-logo-ring" />
  </span>
);

export function Home() {
  const [g, s] = greeting();
  return (
    <section className="lu-home" aria-label="New chat">
      <Card as="header" className="lu-hero reveal" style={{ '--i': 0 }}>
        <LogoMark className="home-mark" />
        <Heading level={1} size="display">{g}</Heading>
        <Text size="reading" tone="secondary">{s}</Text>
      </Card>
      <div className="lu-suggest reveal" style={{ '--i': 2 }}>
        <Carousel label="Suggestions">
          {CHIPS.map((c) => (
            <Card key={c.t} className="lu-chip">
              <span className="chip-ic"><Glyph name={c.ic} /></span>
              <Heading level={2} size="emphasis">{c.t}</Heading>
              <Text size="label" tone="secondary">{c.s}</Text>
              <Button variant="glass" size="sm" iconEnd={<RawGlyph name="up" />} onClick={() => { haptic(); sendMessage({ text: c.p }); }}>Ask Lumen</Button>
            </Card>
          ))}
        </Carousel>
      </div>
    </section>
  );
}
