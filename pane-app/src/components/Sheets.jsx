import { useState } from 'react';
import { Sheet } from 'pane-react/Sheet';
import { ActionSheet } from 'pane-react/ActionSheet';
import { Dialog } from 'pane-react/Dialog';
import { SettingsLayout, SettingsGroup, SettingsRow } from 'pane-react/SettingsLayout';
import { SegmentedControl } from 'pane-react/SegmentedControl';
import { Switch } from 'pane-react/Switch';
import { Slider } from 'pane-react/Slider';
import { RadioCards } from 'pane-react/RadioCards';
import { Button } from 'pane-react/Button';
import { List, ListItem } from 'pane-react/List';
import { Text } from 'pane-react/Text';
import { Meter } from 'pane-react/Meter';
import { Mesh } from 'pane-react/Mesh';
import { Card } from 'pane-react/Card';
import { Badge } from 'pane-react/Badge';
import { Glyph, RawGlyph } from '../lib/glyph.jsx';
import { S, appCh, emit, settings, setting, closeSheet, openSheet, setModel, react, save, notify, plainOf } from '../lib/store.js';
import { MODELS, modelOf, seedConvos } from '../lib/engine.js';
import { haptic, Sound, copyText } from '../lib/core.js';
import { setTheme, applyTextSize, TEXT_SIZES } from './theme.js';
import { CodeBlock } from './Markdown.jsx';
import { EMOJI } from './Messages.jsx';
import { GALLERY } from './Cards.jsx';
import { ATT } from './Composer.jsx';
import { island } from '../lib/store.js';

export const SCENES = [
  { value: 'aurora', title: 'Aurora', d: 'Peach and coral over violet' },
  { value: 'ember', title: 'Ember', d: 'Warm, late-afternoon light' },
  { value: 'tide', title: 'Tide', d: 'Cool sea and sky' },
  { value: 'dusk', title: 'Dusk', d: 'Evening blues' },
];
const open = (name) => S.ui.sheet === name;
const onOpen = (o) => { if (!o) closeSheet(); };

function SettingsSheet() {
  const [, force] = useState(0);
  const set = (k, v) => { setting(k, v); force((x) => x + 1); };
  return (
    <Sheet title="Settings" hideTitle open={open('settings')} onOpenChange={onOpen} className="lu-sheet lu-settings">
      <SettingsLayout title="Settings">
        <SettingsGroup title="Appearance">
          <SettingsRow label="Theme" control={<SegmentedControl label="Theme" value={settings.theme} onValueChange={(v) => { haptic('select'); setTheme(v); force((x) => x + 1); }} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />} />
          <SettingsRow label="Scene" description="Pane owns no hue: the colour comes from the scene behind the glass." control={
            <RadioCards label="Scene" columns={2} value={settings.scene} onValueChange={(v) => { set('scene', v); haptic(); Sound.play('tick'); }}
              options={SCENES.map((s) => ({ value: s.value, title: s.title, description: <span className="scene-sw"><span className="scene-mesh"><Mesh preset={s.value} /></span><span>{s.d}</span></span> }))} />} />
          <SettingsRow label="Text size" description="Message text updates live, like Dynamic Type." control={
            <div className="ts-ctl">
              <Slider label="Text size" min={0} max={4} step={1} value={settings.textSize} format={(v) => TEXT_SIZES[v] + ' pt'} onValueChange={(v) => { if (v !== settings.textSize) haptic('select'); settings.textSize = v; applyTextSize(); save(); force((x) => x + 1); }} />
              <Card className="ts-preview" aria-hidden="true"><span className="bubble lu-solid tail">Does this size feel right?</span><span className="pv-ai">Text updates live across the whole app.</span></Card>
            </div>} />
        </SettingsGroup>
        <SettingsGroup title="Responses">
          <SettingsRow label="Streaming speed" control={<Slider label="Streaming speed" min={0.5} max={2} step={0.25} value={settings.speed} format={(v) => v.toFixed(2) + '×'} onValueChange={(v) => set('speed', v)} />} />
          <SettingsRow label="Show reasoning" description="Show the thinking panel before answers." control={<Switch label="Show reasoning" checked={settings.reasoning} onCheckedChange={(v) => { set('reasoning', v); haptic('select'); }} />} />
          <SettingsRow label="Model" description={modelOf(settings.model).name} control={<Button variant="glass" size="sm" onClick={() => openSheet('models')}>Compare</Button>} />
        </SettingsGroup>
        <SettingsGroup title="Feedback" description="Haptics use the system switch tick on iPhone. Sounds are synthesized live, with no audio files.">
          <SettingsRow label="Haptics" control={<Switch label="Haptics" checked={settings.haptics} onCheckedChange={(v) => { set('haptics', v); haptic('select'); }} />} />
          <SettingsRow label="Sound effects" control={<Switch label="Sound effects" checked={settings.sound} onCheckedChange={(v) => { set('sound', v); if (v) { Sound.ensure(); Sound.play('pop'); } }} />} />
        </SettingsGroup>
        <SettingsGroup title="Data">
          <SettingsRow label="Demo conversations" description="Bring back the four seeded chats." control={<Button variant="glass" size="sm" onClick={() => { S.convos = seedConvos(); S.convos.forEach((c) => c.messages.forEach((m) => (m.rev = 0))); S.currentId = null; save(); closeSheet(); island.flash('saved', 'Demo restored'); }}>Restore</Button>} />
          <SettingsRow label="Delete all chats" control={<ClearAll />} />
        </SettingsGroup>
      </SettingsLayout>
      <Text size="caption" tone="secondary" className="about">Lumen 1.0 on Pane 0.7.0 · A UI-craft showcase. The AI is a scripted mock.</Text>
    </Sheet>
  );
}
function ClearAll() {
  return (
    <Dialog title="Delete all chats?" description="Every conversation on this device is removed. You can undo right after." trigger={<Button variant="danger" size="sm">Delete all</Button>}
      actions={<><Dialog.Close asChild><Button variant="glass">Cancel</Button></Dialog.Close><Dialog.Close asChild><Button variant="danger" onClick={() => { const bak = S.convos; S.convos = []; S.currentId = null; save(); closeSheet(); notify({ kind: 'snack', message: 'All chats deleted', action: { label: 'Undo', altText: 'Restore all chats', onClick: () => { S.convos = bak; save(); emit(); } } }); }}>Delete all</Button></Dialog.Close></>} />
  );
}

function AttachSheet() {
  const pick = (k) => {
    haptic();
    if (k === 'photos' || k === 'camera' || k === 'files') document.getElementById('f-' + k).click();
    else ATT.add({ kind: 'tool', tool: k, name: { web: 'Web search', research: 'Deep research', image: 'Create image' }[k] });
    closeSheet();
  };
  const rows = [['photos', 'Photos', 'photo', 'Choose from your library'], ['camera', 'Camera', 'camera', 'Take a photo'], ['files', 'Files', 'file', 'Attach a document'], ['web', 'Web search', 'globe', 'Answer with live sources'], ['research', 'Deep research', 'research', 'Run tools step by step'], ['image', 'Create image', 'sparkle', 'Generate a moodboard']];
  return (
    <Sheet title="Add to message" open={open('attach')} onOpenChange={onOpen} className="lu-sheet">
      <List label="Attach">{rows.map(([k, l, ic, d]) => <ListItem key={k} title={l} description={d} leading={<span className="att-ic"><Glyph name={ic} /></span>} chevron onClick={() => pick(k)} />)}</List>
    </Sheet>
  );
}

function ArtifactSheet() {
  const a = S.ui.sheet === 'artifact' ? S.ui.sheetData : null;
  const [tab, setTab] = useState('preview');
  const isHTML = a && /^(html|svg)$/i.test(a.lang);
  return (
    <Sheet title={a ? a.title : 'Artifact'} open={!!a} onOpenChange={onOpen} className="lu-sheet lu-artifact-sheet"
      actions={a && <Button variant="glass" icon={<RawGlyph name="copy" />} onClick={() => { copyText(a.code); island.flash('copied', 'Copied'); haptic(); }}>Copy code</Button>}>
      {a && isHTML && <SegmentedControl label="View" value={tab} onValueChange={(v) => { setTab(v); haptic('select'); }} options={[{ value: 'preview', label: 'Preview' }, { value: 'code', label: 'Code' }]} />}
      {a && isHTML && tab === 'preview' && <iframe className="av-frame" title="Artifact preview" sandbox="allow-scripts" srcDoc={a.code} />}
      {a && (!isHTML || tab === 'code') && <CodeBlock code={a.code} lang={a.lang} onOpen={false} />}
    </Sheet>
  );
}

function ModelsSheet() {
  return (
    <Sheet title="Models" description="Pick how Lumen thinks. You can switch any time." open={open('models')} onOpenChange={onOpen} className="lu-sheet">
      <RadioCards label="Model" value={settings.model} onValueChange={(v) => { setModel(v); }}
        options={MODELS.map((m) => ({ value: m.id, title: m.name, description: (
          <span className="md-desc">
            <span>{m.d} · {m.ctx} context</span>
            <Meter label="Speed" value={Math.round(m.speed * 100)} valueText={m.speed > 0.9 ? 'Fastest' : m.speed > 0.6 ? 'Fast' : 'Patient'} />
            <Meter label="Reasoning" value={Math.round(m.iq * 100)} valueText={m.iq > 0.95 ? 'Deepest' : m.iq > 0.7 ? 'Strong' : 'Light'} />
          </span>) }))} />
    </Sheet>
  );
}

function SelectSheet() {
  const m = S.ui.sheet === 'select' ? S.ui.sheetData : null;
  return (
    <Sheet title="Select Text" open={!!m} onOpenChange={onOpen} className="lu-sheet"
      actions={m && <Button icon={<RawGlyph name="copy" />} onClick={() => { copyText(plainOf(m)); island.flash('copied', 'Copied'); }}>Copy all</Button>}>
      {m && <Text size="reading" className="sel-text selectable">{plainOf(m)}</Text>}
    </Sheet>
  );
}

function ReactSheet() {
  const m = S.ui.reactFor;
  return (
    <ActionSheet title="React to message" open={!!m} onOpenChange={(o) => { if (!o) { S.ui.reactFor = null; emit(); } }}
      actions={EMOJI.map(([e, l]) => ({ label: `${l}${m && m.reactions.includes(e) ? ' (remove)' : ''}`, icon: <span className="emo">{e}</span>, onSelect: () => { react(m, e); S.ui.reactFor = null; } }))} />
  );
}

function Lightbox() {
  const i = S.ui.lightbox; const g = i != null ? GALLERY[i] : null;
  return (
    <Dialog title={g ? g.t : ''} description={g ? `Moodboard · ${i + 1} of ${GALLERY.length}` : ''} size="lg" open={!!g} onOpenChange={(o) => { if (!o) { S.ui.lightbox = null; emit(); } }} className="lu-lightbox">
      {g && <Mesh colors={g.c} rotate={i * 40} label={g.t} className="lb-mesh" />}
    </Dialog>
  );
}

export function Sheets() {
  appCh.use();
  return (<><SettingsSheet /><AttachSheet /><ArtifactSheet /><ModelsSheet /><SelectSheet /><ReactSheet /><Lightbox /></>);
}
