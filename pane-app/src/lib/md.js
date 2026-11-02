/* Markdown → block AST, so replies render as React (and Pane components) instead of HTML strings.
   Streaming works on "units": every word, code line, table row and card is one unit, in reading order. */

export function parseInline(s) {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*?\*)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) });
    const x = m[0];
    if (m[1]) out.push({ t: 'code', v: x.slice(1, -1) });
    else if (m[2]) out.push({ t: 'strong', c: parseInline(x.slice(2, -2)) });
    else if (m[3]) out.push({ t: 'del', c: parseInline(x.slice(2, -2)) });
    else if (m[4]) { const mm = x.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/); out.push({ t: 'a', href: /^https?:/.test(mm[2]) ? mm[2] : '#', c: parseInline(mm[1]) }); }
    else if (m[5]) out.push({ t: 'em', c: parseInline(x.slice(1, -1)) });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) });
  return out;
}

export function parseMD(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const n = lines.length; const out = []; let i = 0; let cardN = 0;
  const isBlockStart = (l) => /^(```|:::|#{1,4}\s|>\s?|\s*([-*•]|\d+\.)\s+|---+\s*$|\|)/.test(l);
  while (i < n) {
    const l = lines[i]; let m;
    if (/^```/.test(l)) {
      const lang = l.slice(3).trim(); const buf = []; i++;
      while (i < n && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push({ t: 'code', lang, code: buf.join('\n') }); continue;
    }
    if ((m = l.match(/^:::(\w+)\s*(.*)$/))) {
      let args = {}; try { if (m[2]) args = JSON.parse(m[2]); } catch (e) {}
      out.push({ t: 'card', name: m[1], args, idx: cardN++ }); i++; continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push({ t: 'h', level: m[1].length, c: parseInline(m[2]) }); i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf = []; while (i < n && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push({ t: 'quote', blocks: parseMD(buf.join('\n')) }); continue;
    }
    if (/^\|/.test(l) && i + 1 < n && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < n && /^\|/.test(lines[i])) body.push(row(lines[i++]));
      const isNum = (c) => /^[−\-+]?[$€£¥]?[\d.,]+\s?(%|[kKmMbB]|ms|GB|TB|x|×)?$/.test(c.replace(/\*\*/g, '').trim());
      const numCol = head.map((_, j) => body.length > 0 && body.every((r) => !r[j] || r[j] === '—' || isNum(r[j])));
      out.push({ t: 'table', head, rows: body, numCol }); continue;
    }
    if (/^\s*([-*•]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items = [];
      while (i < n) {
        const mm = lines[i].match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        if (!mm) { if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].raw += ' ' + lines[i].trim(); i++; continue; } break; }
        if (mm[1].length >= 2 && items.length) (items[items.length - 1].sub = items[items.length - 1].sub || []).push(mm[3]);
        else items.push({ raw: mm[3] });
        i++;
      }
      out.push({ t: ordered ? 'ol' : 'ul', items: items.map((it) => ({ c: parseInline(it.raw), sub: it.sub ? it.sub.map(parseInline) : null })) });
      continue;
    }
    if (/^---+\s*$/.test(l)) { out.push({ t: 'hr' }); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [l]; i++;
    while (i < n && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    out.push({ t: 'p', c: parseInline(buf.join(' ')) });
  }
  return out;
}

const words = (s) => s.match(/\S+\s*|\s+/g) || [];
/** Flat, ordered list of streamable units for timing the reveal. */
export function unitsOf(blocks, acc = []) {
  const inl = (c) => c.forEach((x) => (x.t === 'text' ? words(x.v).forEach((w) => w.trim() && acc.push({ k: 'w', w })) : x.t === 'code' ? acc.push({ k: 'w', w: x.v + ' ' }) : inl(x.c)));
  for (const b of blocks) {
    const s0 = acc.length;
    if (b.t === 'p' || b.t === 'h') { inl(b.c); if (acc[s0]) acc[s0].first = true; }
    else if (b.t === 'ul' || b.t === 'ol') b.items.forEach((it) => { const i0 = acc.length; inl(it.c); if (acc[i0]) acc[i0].first = true; it.sub && it.sub.forEach(inl); });
    else if (b.t === 'quote') unitsOf(b.blocks, acc);
    else if (b.t === 'code') b.code.split('\n').forEach(() => acc.push({ k: 'line' }));
    else if (b.t === 'table') b.rows.forEach(() => acc.push({ k: 'row' }));
    else if (b.t === 'card') acc.push({ k: 'card', name: b.name, idx: b.idx, args: b.args });
    else if (b.t === 'hr') acc.push({ k: 'block' });
  }
  return acc;
}
export const plainInline = (c) => c.map((x) => (x.t === 'text' || x.t === 'code' ? x.v : plainInline(x.c))).join('');
export function plainMD(md) {
  const out = [];
  const walk = (bs) => bs.forEach((b) => {
    if (b.t === 'p' || b.t === 'h') out.push(plainInline(b.c));
    else if (b.t === 'ul' || b.t === 'ol') b.items.forEach((it) => out.push('• ' + plainInline(it.c)));
    else if (b.t === 'quote') walk(b.blocks);
    else if (b.t === 'code') out.push(b.code);
    else if (b.t === 'table') { out.push(b.head.join(' | ')); b.rows.forEach((r) => out.push(r.join(' | '))); }
  });
  walk(parseMD(md));
  return out.join('\n');
}

/* Tiny per-family syntax tokeniser */
export const LANG_NAMES = { js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX', py: 'Python', python: 'Python', css: 'CSS', html: 'HTML', json: 'JSON', bash: 'Shell', sh: 'Shell', swift: 'Swift', sql: 'SQL' };
const KW = {
  js: new Set('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of this null undefined true false yield static get set interface type as readonly void'.split(' ')),
  py: new Set('def return if elif else for while in not and or is None True False class import from as with try except finally raise lambda yield pass break continue async await self'.split(' ')),
  bash: new Set('if then else fi for do done echo export cd npm npx git curl'.split(' ')),
};
const RE_SLASH = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$@][\w$]*)|([{}()[\];,.<>=+\-*/!?:&|]+)/g;
const RE_HASH = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$@][\w$]*)|([{}()[\];,.<>=+\-*/!?:&|]+)/g;
const RE_HTML = /(<!--[\s\S]*?-->)|(<\/?[\w-]+|\/?>)|(\s[\w:@-]+)(?==)|("[^"]*"|'[^']*')/g;
/** Returns lines, each an array of [class, text] tokens. */
export function highlight(code, lang) {
  lang = (lang || '').toLowerCase();
  const fam = /^(py|python)$/.test(lang) ? 'py' : /^(sh|bash|shell|zsh)$/.test(lang) ? 'bash' : /^(html|xml|svg)$/.test(lang) ? 'html' : 'js';
  let re, map;
  if (fam === 'html') { re = new RegExp(RE_HTML.source, 'g'); map = ['c', 'k', 'a', 's']; }
  else { re = new RegExp((fam === 'js' ? RE_SLASH : RE_HASH).source, 'g'); map = ['c', 's', 'n', 'f', 'id', 'p']; }
  const kw = KW[fam] || KW.js; const toks = []; let last = 0, mm;
  while ((mm = re.exec(code))) {
    if (mm.index > last) toks.push(['', code.slice(last, mm.index)]);
    let gi = 1; while (gi < mm.length && mm[gi] == null) gi++;
    let cls = map[gi - 1] || ''; const t = mm[0];
    if (cls === 'id') cls = kw.has(t) ? 'k' : /^[A-Z]/.test(t) ? 't' : '';
    else if (cls === 'f' && kw.has(t)) cls = 'k';
    toks.push([cls, t]); last = re.lastIndex;
    if (!mm[0].length) re.lastIndex++;
  }
  if (last < code.length) toks.push(['', code.slice(last)]);
  const lines = [[]];
  for (const [c, t] of toks) t.split('\n').forEach((p, j) => { if (j) lines.push([]); if (p) lines[lines.length - 1].push([c, p]); });
  return lines;
}
