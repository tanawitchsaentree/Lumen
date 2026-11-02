import { memo, useMemo, useState } from 'react';
import { Heading } from 'pane-react/Heading';
import { Divider } from 'pane-react/Divider';
import { Table } from 'pane-react/Table';
import { IconButton } from 'pane-react/IconButton';
import { Tag } from 'pane-react/Tag';
import { parseMD, parseInline, plainInline, highlight, LANG_NAMES } from '../lib/md.js';
import { copyText, haptic } from '../lib/core.js';
import { island, openSheet } from '../lib/store.js';
import { RawGlyph } from '../lib/glyph.jsx';
import { CardBlock } from './Cards.jsx';

/* Budget counter: each word / code line / table row / card spends one unit.
   While streaming, newly revealed words mount with .tk (fade + blur in) and the caret follows the last one. */
const Caret = () => <span className="lu-caret" aria-hidden="true" />;

function renderInline(c, ctr, kp = 'i') {
  const out = [];
  for (let i = 0; i < c.length; i++) {
    if (ctr.left <= 0) break;
    const x = c[i]; const k = kp + i;
    if (x.t === 'text') {
      if (!ctr.split) { out.push(x.v); continue; }
      const ws = x.v.match(/\S+\s*|\s+/g) || [];
      for (let j = 0; j < ws.length; j++) {
        const w = ws[j];
        if (!w.trim()) { out.push(w); continue; }
        if (ctr.left <= 0) break;
        ctr.left--;
        out.push(<span key={k + '-' + j} className={ctr.live ? 'tk' : undefined}>{w}</span>);
        if (ctr.left === 0 && ctr.live && !ctr.caret) { ctr.caret = true; out.push(<Caret key="caret" />); }
      }
    } else if (x.t === 'code') {
      if (ctr.split) ctr.left--;
      out.push(<code key={k} className={ctr.live ? 'tk' : undefined}>{x.v}</code>);
      if (ctr.split && ctr.left === 0 && ctr.live && !ctr.caret) { ctr.caret = true; out.push(<Caret key="caret" />); }
    } else {
      const kids = renderInline(x.c, ctr, k + '.');
      if (x.t === 'strong') out.push(<strong key={k}>{kids}</strong>);
      else if (x.t === 'em') out.push(<em key={k}>{kids}</em>);
      else if (x.t === 'del') out.push(<del key={k}>{kids}</del>);
      else if (x.t === 'a') out.push(<a key={k} href={x.href} target="_blank" rel="noopener">{kids}</a>);
    }
  }
  return out;
}

export function CodeBlock({ code, lang, visible = Infinity, live, onOpen }) {
  const lines = useMemo(() => highlight(code, lang), [code, lang]);
  const [done, setDone] = useState(false);
  const shown = Math.min(lines.length, visible);
  const copy = () => { copyText(code); setDone(true); haptic(); island.flash('copied', 'Copied'); setTimeout(() => setDone(false), 1800); };
  return (
    <div className={'lu-code' + (live ? ' tk-block' : '')} data-lang={lang}>
      <div className="lu-code-head">
        <Tag>{LANG_NAMES[(lang || '').toLowerCase()] || lang || 'Code'}</Tag>
        <span className="lu-sp" />
        {onOpen !== false && <IconButton variant="ghost" size="sm" aria-label="Open in artifact viewer" onClick={() => openSheet('artifact', { title: (LANG_NAMES[lang] || 'Code') + ' snippet', lang, code })}><RawGlyph name="expand" /></IconButton>}
        <IconButton variant="ghost" size="sm" aria-label={done ? 'Copied' : 'Copy code'} onClick={copy} className={'lu-copy' + (done ? ' done' : '')}>
          <RawGlyph name="copy" className="ic-copy" /><RawGlyph name="check" className="ic-check" />
        </IconButton>
      </div>
      <pre className="lu-code-pre no-gesture" tabIndex={0}><code>
        {lines.slice(0, shown).map((l, i) => (
          <span key={i} className={'l' + (live ? ' tk-line' : '')}>{l.map(([c, t], j) => (c ? <span key={j} className={'t-' + c}>{t}</span> : t))}{i < shown - 1 ? '\n' : ''}</span>
        ))}
      </code></pre>
    </div>
  );
}

function MdTable({ head, rows, numCol }) {
  const columns = head.map((h, j) => ({ key: 'c' + j, header: plainInline(parseInline(h)) || ' ', align: numCol[j] ? 'end' : 'start', render: (r) => renderInline(parseInline(r['c' + j] || ''), { left: Infinity, split: false }) }));
  const data = rows.map((r, i) => Object.fromEntries([['id', i], ...head.map((_, j) => ['c' + j, r[j] || ''])]));
  return <div className="lu-table no-gesture"><Table caption="Comparison" columns={columns} rows={data} density="compact" /></div>;
}

function renderBlocks(blocks, ctr, msgId, kp = 'b') {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    if (ctr.left <= 0) break;
    const b = blocks[i]; const k = kp + i;
    switch (b.t) {
      case 'p': out.push(<p key={k} className="md-p">{renderInline(b.c, ctr, k)}</p>); break;
      case 'h': out.push(<Heading key={k} level={b.level <= 1 ? 3 : 4} size={b.level <= 1 ? 'title' : 'emphasis'} className="md-h">{renderInline(b.c, ctr, k)}</Heading>); break;
      case 'ul': case 'ol': {
        const T = b.t; const items = [];
        for (let j = 0; j < b.items.length && ctr.left > 0; j++) {
          const it = b.items[j];
          items.push(<li key={j}>{renderInline(it.c, ctr, k + 'l' + j)}{it.sub && ctr.left > 0 && <ul>{it.sub.map((s, si) => <li key={si}>{renderInline(s, ctr, k + 's' + j + si)}</li>)}</ul>}</li>);
        }
        out.push(<T key={k} className="md-list">{items}</T>); break;
      }
      case 'quote': out.push(<blockquote key={k} className="md-quote">{renderBlocks(b.blocks, ctr, msgId, k + 'q')}</blockquote>); break;
      case 'hr': if (ctr.split) ctr.left--; out.push(<Divider key={k} decorative className="md-hr" />); break;
      case 'code': {
        const n = b.code.split('\n').length; const vis = ctr.split ? Math.min(n, ctr.left) : n;
        if (ctr.split) ctr.left -= vis;
        out.push(<CodeBlock key={k} code={b.code} lang={b.lang} visible={vis} live={ctr.live} />);
        if (ctr.split && ctr.left === 0 && ctr.live && !ctr.caret) { ctr.caret = true; out.push(<Caret key="caret" />); }
        break;
      }
      case 'table': {
        const vis = ctr.split ? Math.min(b.rows.length, ctr.left) : b.rows.length;
        if (ctr.split) ctr.left -= vis;
        out.push(<MdTable key={k} head={b.head} rows={b.rows.slice(0, vis)} numCol={b.numCol} />);
        break;
      }
      case 'card':
        if (ctr.split) ctr.left--;
        out.push(<CardBlock key={k} name={b.name} args={b.args} idx={b.idx} msgId={msgId} live={ctr.live} />);
        break;
    }
  }
  return out;
}

/** Renders a reply. `budget` = units revealed so far (Infinity when complete). */
export const Markdown = memo(function Markdown({ md, budget = Infinity, live = false, msgId }) {
  const blocks = useMemo(() => parseMD(md), [md]);
  const ctr = { left: budget, split: budget !== Infinity, live, caret: false };
  const out = renderBlocks(blocks, ctr, msgId);
  return <div className="lu-md">{out}{live && !ctr.caret && <Caret />}</div>;
});
