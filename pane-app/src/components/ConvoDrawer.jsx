import { useState } from 'react';
import { Drawer } from 'pane-react/Drawer';
import { SearchInput } from 'pane-react/SearchInput';
import { List, ListItem } from 'pane-react/List';
import { Text } from 'pane-react/Text';
import { Button } from 'pane-react/Button';
import { IconButton } from 'pane-react/IconButton';
import { Avatar } from 'pane-react/Avatar';
import { EmptyState } from 'pane-react/EmptyState';
import { ContextMenu } from 'pane-react/ContextMenu';
import { Flex } from 'pane-react/Flex';
import { RawGlyph, Glyph } from '../lib/glyph.jsx';
import { S, appCh, emit, openConvo, newChat, convoAction, openSheet, plainOf } from '../lib/store.js';
import { relTime, dayDiff } from '../lib/core.js';
import { toggleTheme, resolved } from './theme.js';

function Hl({ t, q }) {
  if (!q) return t;
  const lo = t.toLowerCase(); const out = []; let i = 0, j, k = 0;
  while ((j = lo.indexOf(q, i)) !== -1) { out.push(t.slice(i, j), <mark key={k++}>{t.slice(j, j + q.length)}</mark>); i = j + q.length; }
  out.push(t.slice(i)); return out;
}
function snippet(c, q) {
  if (q) for (const m of c.messages) { const t = plainOf(m).replace(/\s+/g, ' '); const k = t.toLowerCase().indexOf(q); if (k >= 0) { const s = Math.max(0, k - 30); return (s ? '…' : '') + t.slice(s, s + 100); } }
  const last = c.messages[c.messages.length - 1];
  return last ? plainOf(last).replace(/\s+/g, ' ').slice(0, 100) : '';
}

function Row({ c, q }) {
  return (
    <ContextMenu label={`Actions for ${c.title}`} items={[
      { label: c.pinned ? 'Unpin' : 'Pin', icon: <RawGlyph name="pin" />, onSelect: () => convoAction(c, 'pin') },
      { label: c.archived ? 'Restore' : 'Archive', icon: <RawGlyph name="archive" />, onSelect: () => convoAction(c, 'archive') },
      'separator',
      { label: 'Delete', tone: 'critical', icon: <RawGlyph name="trash" />, onSelect: () => convoAction(c, 'delete') },
    ]}>
      <ListItem className={'d-row' + (S.currentId === c.id ? ' active' : '')} aria-current={S.currentId === c.id ? 'page' : undefined}
        title={<span className="d-t">{c.pinned && <Glyph name="pin" size="sm" />}<Hl t={c.title} q={q} /></span>}
        description={<span className="d-snip"><Hl t={snippet(c, q)} q={q} /></span>}
        trailing={<Text size="caption" tone="secondary" className="tnum">{relTime(c.updated)}</Text>}
        onClick={() => openConvo(c.id)} />
    </ContextMenu>
  );
}

export function ConvoDrawer() {
  appCh.use();
  const [q0, setQ] = useState('');
  const [showArch, setShowArch] = useState(false);
  const q = q0.trim().toLowerCase();
  let items = S.convos.filter((c) => c.messages.length);
  if (q) items = items.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => plainOf(m).toLowerCase().includes(q)));
  items.sort((a, b) => b.updated - a.updated);
  const live = items.filter((c) => !c.archived), arch = items.filter((c) => c.archived);
  const groups = [];
  const pinned = live.filter((c) => c.pinned); if (pinned.length) groups.push(['Pinned', pinned]);
  const by = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
  live.filter((c) => !c.pinned).forEach((c) => { const d = dayDiff(c.updated); (d <= 0 ? by.Today : d === 1 ? by.Yesterday : d < 7 ? by['Previous 7 days'] : by.Older).push(c); });
  Object.entries(by).forEach(([k, v]) => v.length && groups.push([k, v]));
  if (arch.length && (showArch || q)) groups.push(['Archived', arch]);

  return (
    <Drawer side="start" title="Chats" open={S.ui.drawer} onOpenChange={(o) => { S.ui.drawer = o; emit(); }} className="lu-drawer"
      actions={
        <Flex justify="between" className="d-foot">
          <Button variant="ghost" icon={<Avatar name="Alex Rivera" size="sm" decorative />} onClick={() => openSheet('settings')}>Alex Rivera · Settings</Button>
          <IconButton aria-label={resolved() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}><RawGlyph name={resolved() === 'dark' ? 'sun' : 'moon'} /></IconButton>
        </Flex>
      }>
      <div className="d-body">
        <Flex gap="sm" className="d-top">
          <SearchInput aria-label="Search chats" placeholder="Search chats" value={q0} onValueChange={setQ} className="d-search" />
          <IconButton aria-label="New chat" onClick={() => newChat()}><RawGlyph name="compose" /></IconButton>
        </Flex>
        {groups.length === 0 && (q
          ? <EmptyState size="sm" level={3} title="No results" description={`Nothing matches “${q0.trim()}”.`} icon={<Glyph name="search" />} />
          : <EmptyState size="sm" level={3} title="No chats yet" description="Start a conversation and it will show up here." icon={<Glyph name="compose" />} actions={<Button onClick={() => newChat()}>New chat</Button>} />)}
        {groups.map(([t, cs]) => (
          <section key={t} className="d-sec" aria-label={t}>
            <Text size="caption" tone="secondary" weight="semibold" className="d-sec-t">{t}</Text>
            <List label={t}>{cs.map((c) => <Row key={c.id} c={c} q={q} />)}</List>
          </section>
        ))}
        {arch.length > 0 && !q && <Button variant="glass" fullWidth icon={<RawGlyph name="archive" />} onClick={() => setShowArch(!showArch)}>{showArch ? 'Hide archived' : `Archived chats (${arch.length})`}</Button>}
        <Text size="caption" tone="secondary" className="d-hint">Press and hold a chat to pin, archive or delete it.</Text>
      </div>
    </Drawer>
  );
}
