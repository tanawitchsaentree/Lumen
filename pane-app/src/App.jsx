import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PaneProvider } from 'pane-react/PaneProvider';
import { Environment } from 'pane-react/Environment';
import { Mesh } from 'pane-react/Mesh';
import { Navbar } from 'pane-react/Navbar';
import { IconButton } from 'pane-react/IconButton';
import { Button } from 'pane-react/Button';
import { Menu } from 'pane-react/Menu';
import { Text } from 'pane-react/Text';
import { CommandPalette } from 'pane-react/CommandPalette';
import { Thread, SCROLL, stickToBottom } from './components/Thread.jsx';
import { Composer, CMDS } from './components/Composer.jsx';
import { ConvoDrawer } from './components/ConvoDrawer.jsx';
import { Sheets } from './components/Sheets.jsx';
import { Notices, Island, VoiceMode } from './components/Overlays.jsx';
import { LogoMark } from './components/Home.jsx';
import { applyTheme, applyTextSize, toggleTheme } from './components/theme.js';
import { RawGlyph } from './lib/glyph.jsx';
import { S, appCh, emit, settings, current, newChat, openSheet, setModel, island, convoAction, sendMessage } from './lib/store.js';
import { MODELS, modelOf } from './lib/engine.js';
import { gesture, Spring, haptic, RM, installSpringEasings } from './lib/core.js';

/* The scene behind the glass: a Mesh, crossfading when the reader picks another one. */
function Scene() {
  appCh.use();
  const [layers, setLayers] = useState([settings.scene]);
  useEffect(() => {
    if (layers[layers.length - 1] === settings.scene) return;
    setLayers((l) => [...l.slice(-1), settings.scene]);
    const t = setTimeout(() => setLayers([settings.scene]), 1000);
    return () => clearTimeout(t);
  }, [settings.scene]);
  return <div className="lu-scene" aria-hidden="true">{layers.map((p, i) => <Mesh key={p + i} preset={p} className={'scene-layer' + (i === layers.length - 1 && layers.length > 1 ? ' in' : '')} />)}</div>;
}

function Header() {
  appCh.use();
  const c = current();
  const m = modelOf(settings.model);
  return (
    <Navbar sticky={false} label="Chat" className="lu-nav"
      brand={
        <span className="nav-brand">
          <IconButton aria-label="Open conversations" aria-expanded={S.ui.drawer} onClick={() => { S.ui.drawer = true; emit(); haptic(); }}><RawGlyph name="menu" /></IconButton>
          {c && c.messages.length > 0 && <Text as="span" size="label" weight="semibold" truncate className="nav-title" aria-hidden="true">{c.title}</Text>}
        </span>
      }
      actions={
        <span className="nav-acts">
          <Menu label="Model" align="end" trigger={<Button variant="glass" size="sm" iconEnd={<RawGlyph name="chevDown" />} aria-label={`Model: ${m.name}. Change model`}>{m.name}</Button>}
            items={[
              ...MODELS.map((x) => ({ label: x.name + (x.id === settings.model ? '  ✓' : ''), icon: <RawGlyph name={x.id === 'lumen-deep' ? 'brain' : x.id === 'lumen-2-mini' ? 'bolt' : 'sparkle'} />, onSelect: () => setModel(x.id) })),
              'separator',
              { label: 'Compare models', icon: <RawGlyph name="info" />, onSelect: () => openSheet('models') },
            ]} />
          <IconButton aria-label="New chat" onClick={() => newChat()}><RawGlyph name="compose" /></IconButton>
        </span>
      } />
  );
}

function Palette() {
  appCh.use();
  const commands = [
    { id: 'new', label: 'Start a new chat', group: 'Chat', icon: <RawGlyph name="compose" />, keywords: ['clear'], onSelect: () => newChat() },
    { id: 'chats', label: 'Open conversations', group: 'Chat', icon: <RawGlyph name="menu" />, onSelect: () => { S.ui.drawer = true; emit(); } },
    { id: 'voice', label: 'Start voice chat', group: 'Chat', icon: <RawGlyph name="mic" />, onSelect: () => { S.ui.voice = true; emit(); } },
    { id: 'settings', label: 'Open settings', group: 'App', keywords: ['preferences'], icon: <RawGlyph name="gear" />, shortcut: ['⌘', ','], onSelect: () => openSheet('settings') },
    { id: 'theme', label: 'Toggle dark mode', group: 'App', icon: <RawGlyph name="moon" />, onSelect: () => toggleTheme() },
    ...CMDS.filter((c) => c.p).map((c) => ({ id: 'ask-' + c.k, label: c.p, group: 'Ask Lumen', keywords: [c.k, c.d], icon: <RawGlyph name={c.ic} />, onSelect: () => sendMessage({ text: c.p }) })),
  ];
  return <CommandPalette commands={commands} open={S.ui.palette} onOpenChange={(o) => { S.ui.palette = o; emit(); }} placeholder="Search commands or ask Lumen" />;
}

function Launch({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, RM ? 150 : 1150); return () => clearTimeout(t); }, []);
  return <div className="lu-launch" aria-hidden="true"><LogoMark className="l-mark" style={{ viewTransitionName: 'logo' }} /><span className="l-word">Lumen</span></div>;
}

export function App() {
  appCh.use();
  const [launched, setLaunched] = useState(false);
  const appRef = useRef(null);

  useEffect(() => {
    installSpringEasings(); applyTheme(); applyTextSize();
    const on = () => island.offline(false), off = () => island.offline(true);
    addEventListener('online', on); addEventListener('offline', off);
    if (navigator.onLine === false) setTimeout(() => island.offline(true), 1600);
    // visualViewport: the shell matches the visible area; composer + content ride the keyboard on a spring
    const vv = window.visualViewport; let lastH = vv ? vv.height : 0;
    const ride = new Spring(0, { stiffness: 360, damping: 36, precision: 0.3 }, (v) => {
      const t = Math.abs(v) > 0.3 ? `translate3d(0,${v}px,0)` : '';
      const cmp = document.querySelector('.lu-composer'); if (cmp) cmp.style.transform = t;
      if (SCROLL.inner) SCROLL.inner.style.transform = t;
    });
    const onVV = () => {
      const h = vv.height, top = vv.offsetTop;
      document.documentElement.style.setProperty('--lu-vvh', h + 'px');
      appRef.current.style.transform = top > 0.5 ? `translate3d(0,${top}px,0)` : '';
      document.documentElement.classList.toggle('kb-open', window.innerHeight - h > 140);
      const dh = lastH - h; lastH = h;
      if (Math.abs(dh) > 60 && !RM) { ride.set(ride.value + dh); ride.to(0); }
      requestAnimationFrame(stickToBottom);
    };
    if (vv) { vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); onVV(); }
    // swipe in from the left edge opens the conversation drawer
    const g = gesture(appRef.current, {
      start: (pt) => pt.x < 24 && !S.ui.drawer && !S.ui.sheet,
      lock: (axis, dx) => axis === 'x' && dx > 0,
      move: (dx) => { if (dx > 44 && !S.ui.drawer) { S.ui.drawer = true; haptic(); emit(); } },
      end: () => {},
    });
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); openSheet('settings'); }
    };
    addEventListener('keydown', key);
    const ph = () => { try { localStorage.setItem('lumen.settings', JSON.stringify(settings)); } catch (e) {} };
    addEventListener('pagehide', ph);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); removeEventListener('keydown', key); removeEventListener('pagehide', ph); g.cancel(); };
  }, []);

  const finishLaunch = () => {
    const go = () => flushSync(() => setLaunched(true));
    if (document.startViewTransition && !RM) { try { document.startViewTransition(go); return; } catch (e) {} }
    go();
  };

  return (
    <PaneProvider locale={navigator.language || 'en-US'}>
      <Environment brightness="dim" className="lu-env">
        <Scene />
        <div className="lu-app" ref={appRef} id="lu-app" data-launched={launched}>
          <Header />
          <Thread />
          <Composer />
        </div>
        <ConvoDrawer />
        <Sheets />
        <Palette />
        <VoiceMode />
        <Notices />
        <Island />
        {!launched && <Launch onDone={finishLaunch} />}
        <div id="fx" aria-hidden="true" />
        <input type="file" id="f-photos" accept="image/*" multiple hidden />
        <input type="file" id="f-camera" accept="image/*" capture="environment" hidden />
        <input type="file" id="f-files" multiple hidden />
      </Environment>
    </PaneProvider>
  );
}
