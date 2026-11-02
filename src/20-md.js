/* =====================================================================
   9. Markdown → HTML (headings, lists, tables, quotes, code, cards)
   ===================================================================== */
function inlineMD(s) {
  const codes = [];
  s = String(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${/^https?:/.test(u) ? u : '#'}" target="_blank" rel="noopener">${t}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}
function mdToHTML(src, ctx = {}) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const n = lines.length; const out = []; let i = 0; let cardN = 0;
  const isBlockStart = (l) => /^(```|:::|#{1,4}\s|>\s?|\s*([-*•]|\d+\.)\s+|---+\s*$|\|)/.test(l);
  while (i < n) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const lang = l.slice(3).trim(); const buf = []; i++;
      while (i < n && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push(codeHTML(buf.join('\n'), lang)); continue;
    }
    let m;
    if ((m = l.match(/^:::(\w+)\s*(.*)$/))) {
      let args = {}; try { if (m[2]) args = JSON.parse(m[2]); } catch (e) {}
      out.push(cardHTML(m[1], args, { ...ctx, key: (ctx.msgId || 'x') + '-' + cardN++ })); i++; continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const lv = Math.min(4, m[1].length + 1); out.push(`<h${lv}>${inlineMD(m[2])}</h${lv}>`); i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf = []; while (i < n && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${mdToHTML(buf.join('\n'), ctx)}</blockquote>`); continue;
    }
    if (/^\|/.test(l) && i + 1 < n && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(l); i += 2; const body = [];
      while (i < n && /^\|/.test(lines[i])) body.push(row(lines[i++]));
      const isNum = (c) => /^[−\-+]?[$€£¥]?[\d.,]+\s?(%|[kKmMbB]|ms|GB|TB|x|×)?$/.test(c.replace(/\*\*/g, '').trim());
      const numCol = head.map((_, j) => body.length && body.every((r) => !r[j] || isNum(r[j])));
      out.push(`<div class="tbl-wrap no-gesture" role="region" aria-label="Table" tabindex="0"><table><thead><tr>${head.map((c, j) => `<th class="${numCol[j] ? 'num' : ''}">${inlineMD(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${head.map((_, j) => `<td class="${numCol[j] ? 'num' : ''}">${inlineMD(r[j] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*•]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items = [];
      while (i < n) {
        const mm = lines[i].match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        if (!mm) { if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1].t += ' ' + lines[i].trim(); i++; continue; } break; }
        if (mm[1].length >= 2 && items.length) (items[items.length - 1].sub = items[items.length - 1].sub || []).push(mm[3]);
        else items.push({ t: mm[3] });
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inlineMD(it.t)}${it.sub ? `<ul>${it.sub.map((x) => `<li>${inlineMD(x)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = [l]; i++;
    while (i < n && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inlineMD(buf.join(' '))}</p>`);
  }
  return out.join('');
}

/* =====================================================================
   10. Syntax highlighter (tiny, per-family regex tokeniser)
   ===================================================================== */
const LANG_NAMES = { js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX', py: 'Python', python: 'Python', css: 'CSS', html: 'HTML', json: 'JSON', bash: 'Shell', sh: 'Shell', shell: 'Shell', swift: 'Swift', sql: 'SQL' };
const KW = {
  js: new Set('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of this null undefined true false yield static get set interface type as readonly void'.split(' ')),
  py: new Set('def return if elif else for while in not and or is None True False class import from as with try except finally raise lambda yield pass break continue async await self global print'.split(' ')),
  bash: new Set('if then else fi for do done echo export cd npm npx git curl sudo brew pnpm yarn run install'.split(' ')),
  swift: new Set('let var func return if else guard struct class import some View private public static self in for while switch case enum protocol extension init true false nil async await'.split(' ')),
  sql: new Set('select from where group by order having join left right inner on as and or not null insert into values update set delete create table limit count sum avg distinct'.split(' ')),
};
const RE_SLASH = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$@][\w$]*)|([{}()[\];,.<>=+\-*/!?:&|]+)/g;
const RE_HASH = /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$@][\w$]*)|([{}()[\];,.<>=+\-*/!?:&|]+)/g;
const RE_SQL = /(--[^\n]*)|('(?:''|[^'])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w]*)(?=\s*\()|([A-Za-z_][\w]*)|([(),;*=<>]+)/g;
const RE_HTML = /(<!--[\s\S]*?-->)|(<\/?[\w-]+|\/?>)|(\s[\w:@-]+)(?==)|("[^"]*"|'[^']*')/g;
const RE_CSS = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[0-9a-fA-F]{3,8}\b|-?\b\d+\.?\d*(?:px|rem|em|%|s|ms|vh|vw|deg|fr)?\b)|([\w-]+)(?=\s*:[^{}]*;)|(@[\w-]+|[.#:]?[\w-]+(?=[^{};]*\{))/g;
function highlightLines(code, lang) {
  lang = (lang || '').toLowerCase();
  const fam = /^(js|jsx|ts|tsx|javascript|typescript|json)$/.test(lang) ? 'js' : /^(py|python)$/.test(lang) ? 'py' : /^(sh|bash|shell|zsh)$/.test(lang) ? 'bash' : /^css$/.test(lang) ? 'css' : /^(html|xml|svg)$/.test(lang) ? 'html' : lang === 'swift' ? 'swift' : lang === 'sql' ? 'sql' : 'js';
  const toks = []; let last = 0, mm;
  const push = (cls, t) => { if (t) toks.push([cls, t]); };
  let re, map;
  if (fam === 'html') { re = new RegExp(RE_HTML.source, 'g'); map = ['c', 'tag', 'attr', 's']; }
  else if (fam === 'css') { re = new RegExp(RE_CSS.source, 'g'); map = ['c', 's', 'n', 'attr', 'k']; }
  else if (fam === 'sql') { re = new RegExp(RE_SQL.source, 'gi'); map = ['c', 's', 'n', 'f', 'id', 'p']; }
  else { re = new RegExp((fam === 'py' || fam === 'bash' ? RE_HASH : RE_SLASH).source, 'g'); map = ['c', 's', 'n', 'f', 'id', 'p']; }
  const kw = KW[fam] || KW.js;
  while ((mm = re.exec(code))) {
    push('', code.slice(last, mm.index));
    let gi = 1; while (gi < mm.length && mm[gi] == null) gi++;
    let cls = map[gi - 1] || '';
    const t = mm[0];
    if (cls === 'id') cls = kw.has(fam === 'sql' ? t.toLowerCase() : t) ? 'k' : /^[A-Z]/.test(t) && fam !== 'sql' ? 't' : /^@/.test(t) ? 'k' : '';
    else if (cls === 'f' && kw.has(t)) cls = 'k';
    push(cls, t); last = re.lastIndex;
    if (mm[0].length === 0) re.lastIndex++;
  }
  push('', code.slice(last));
  const lines = [[]];
  for (const [c, t] of toks) {
    const parts = t.split('\n');
    parts.forEach((p, j) => {
      if (j > 0) lines.push([]);
      if (p) lines[lines.length - 1].push(c ? `<span class="t-${c}">${esc(p)}</span>` : esc(p));
    });
  }
  return lines.map((l) => l.join(''));
}
function codeHTML(code, lang) {
  const L = highlightLines(code, lang);
  const label = LANG_NAMES[(lang || '').toLowerCase()] || lang || 'Code';
  return `<div class="code" data-lang="${esc(lang)}"><div class="code-head"><span class="code-lang">${esc(label)}</span><span class="sp"></span><button class="code-btn" data-act="art-open" aria-label="Open in artifact viewer">${ICON.expand}</button><button class="code-btn" data-act="copy-code" aria-label="Copy code"><span class="ic-copy">${ICON.copy}</span><span class="ic-check">${ICON.check}</span></button></div><pre class="code-pre no-gesture" tabindex="0"><code>${L.map((x, i) => `<span class="l">${x}${i < L.length - 1 ? '\n' : ''}</span>`).join('')}</code></pre></div>`;
}
const codeText = (codeEl) => $('code', codeEl).textContent;

/* =====================================================================
   11. Inline cards
   ===================================================================== */
const WX = {
  sun: '<svg viewBox="0 0 64 64"><g class="rays" stroke="#FFD54A" stroke-width="3.5" stroke-linecap="round"><path d="M32 6v6M32 52v6M6 32h6M52 32h6M13.6 13.6l4.2 4.2M46.2 46.2l4.2 4.2M13.6 50.4l4.2-4.2M46.2 17.8l4.2-4.2"/></g><circle cx="32" cy="32" r="12" fill="#FFD54A"/></svg>',
  partly: '<svg viewBox="0 0 64 64"><g class="rays" stroke="#FFD54A" stroke-width="3" stroke-linecap="round"><path d="M26 6v5M8 24h5M13 11l3.5 3.5M39 11l-3.5 3.5"/></g><circle cx="26" cy="24" r="9" fill="#FFD54A"/><path class="cl" d="M20 50h26a9 9 0 0 0 .8-18A12 12 0 0 0 24 34a8 8 0 0 0-4 16Z" fill="#fff"/></svg>',
  cloud: '<svg viewBox="0 0 64 64"><path class="cl" d="M16 48h30a10 10 0 0 0 1-20A14 14 0 0 0 20 30a9 9 0 0 0-4 18Z" fill="#E8EEF6"/></svg>',
  rain: '<svg viewBox="0 0 64 64"><path class="cl" d="M16 40h30a10 10 0 0 0 1-20A14 14 0 0 0 20 22a9 9 0 0 0-4 18Z" fill="#E8EEF6"/><path d="M22 46l-3 7M32 46l-3 7M42 46l-3 7" stroke="#7CC4FF" stroke-width="3" stroke-linecap="round"/></svg>',
  moon: '<svg viewBox="0 0 64 64"><path d="M44 40A16 16 0 1 1 28 18a13 13 0 0 0 16 22Z" fill="#F5F0D7"/></svg>',
};
const WX_SMALL = (k) => WX[k].replace('<svg ', '<svg aria-hidden="true" ');
function weatherCard(a) {
  const city = a.city || 'Kyoto';
  const now = new Date(); const hr = now.getHours();
  const base = a.temp ?? 17;
  const hours = Array.from({ length: 8 }, (_, i) => {
    const h = (hr + i) % 24; const night = h < 6 || h > 18;
    const t = Math.round(base + 3 * Math.sin(((h - 9) / 24) * Math.PI * 2) - (i > 5 ? 1 : 0));
    return { l: i === 0 ? 'Now' : (h % 12 || 12) + (h < 12 ? 'a' : 'p'), t, ic: night ? 'moon' : i === 3 ? 'partly' : 'sun' };
  });
  const days = [['Today', 'sun', 9, 21], ['Fri', 'partly', 10, 19], ['Sat', 'sun', 8, 20], ['Sun', 'rain', 11, 16], ['Mon', 'partly', 9, 18]];
  const lo = 7, hi = 22;
  return `<div class="card weather" data-cond="sun" role="group" aria-label="Weather in ${esc(city)}">
  <div class="w-top"><div><div class="w-city">${esc(city)} ${ICON.nav}</div><div class="w-temp">${hours[0].t}°</div><div class="w-cond">Mostly Sunny</div><div class="w-hl">H:21°  L:9°</div></div><div class="w-ico">${WX.sun}</div></div>
  <div class="w-hours no-gesture">${hours.map((h) => `<div class="w-h"><span>${h.l}</span>${WX_SMALL(h.ic)}<b>${h.t}°</b></div>`).join('')}</div>
  <div class="w-days">${days.map(([d, ic, a1, b1]) => `<div class="w-d"><span>${d}</span>${WX_SMALL(ic)}<span class="lo">${a1}°</span><span class="w-bar"><i style="left:${((a1 - lo) / (hi - lo)) * 100}%;right:${100 - ((b1 - lo) / (hi - lo)) * 100}%"></i></span><span>${b1}°</span></div>`).join('')}</div>
</div>`;
}
const GALLERY = [
  { t: 'Morning light', h: [32, 18, 48] }, { t: 'Linen & oak', h: [36, 24, 30] }, { t: 'Moss', h: [110, 140, 70] },
  { t: 'Clay', h: [14, 350, 30] }, { t: 'Dusk', h: [260, 220, 300] }, { t: 'Paper lamp', h: [44, 20, 55] },
];
function artStyle(g, i) {
  const x1 = 20 + ((i * 37) % 50), y1 = 20 + ((i * 23) % 40);
  return `--h1:${g.h[0]};--h2:${g.h[1]};--h3:${g.h[2]};--x1:${x1}%;--y1:${y1}%;--x2:${90 - x1}%;--y2:${95 - y1}%`;
}
function galleryCard(a, ctx) {
  return `<div class="card gallery" role="group" aria-label="Image gallery"><div class="gal">${GALLERY.map((g, i) => `<button class="g-tile" data-act="lightbox" data-i="${i}" aria-label="Open ${g.t}"><div class="art" style="${artStyle(g, i)}"></div><span>${g.t}</span></button>`).join('')}</div></div>`;
}
const CHART_DATA = {
  rev: { label: 'Revenue', unit: '$', suffix: 'k', v: [182, 196, 191, 214, 238, 229, 251, 274, 268, 301, 322, 347] },
  usr: { label: 'Users', unit: '', suffix: 'k', v: [41, 44, 47, 46, 52, 58, 61, 66, 71, 75, 83, 90] },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function chartPath(vals, W, H, pad) {
  const min = Math.min(...vals) * 0.9, max = Math.max(...vals) * 1.04;
  const pts = vals.map((v, i) => [pad + (i * (W - pad * 2)) / (vals.length - 1), H - 22 - ((v - min) / (max - min)) * (H - 40)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return { d, pts };
}
function chartSVG(series, uid) {
  const W = 340, H = 170, pad = 16; const s = CHART_DATA[series];
  const { d, pts } = chartPath(s.v, W, H, pad);
  const area = `${d} L${pts[pts.length - 1][0]},${H - 22} L${pts[0][0]},${H - 22} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="cg${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
    <g class="ch-grid">${[0.25, 0.5, 0.75].map((f) => `<line x1="${pad}" x2="${W - pad}" y1="${(H - 22) * f + 6}" y2="${(H - 22) * f + 6}"/>`).join('')}</g>
    <path class="ch-area draw" d="${area}" fill="url(#cg${uid})"/>
    <path class="ch-line draw" d="${d}" style="--len:900;stroke-dasharray:900"/>
    ${MONTHS.map((m, i) => (i % 2 === 0 ? `<text class="ch-x" x="${pts[i][0]}" y="${H - 4}" text-anchor="middle">${m}</text>` : '')).join('')}
    <g class="ch-cursor"><line x1="0" x2="0" y1="4" y2="${H - 22}"/><circle class="ch-dot" r="5.5" cx="0" cy="0"/></g>
  </svg>`;
}
function chartCard(a, ctx) {
  const id = ctx.key.replace(/\W/g, '');
  const s = CHART_DATA.rev;
  const last = s.v[s.v.length - 1], first = s.v[0];
  return `<div class="card chart" data-series="rev" data-uid="${id}" role="group" aria-label="Interactive chart: monthly revenue">
  <div class="ch-top"><div><div class="ch-val" data-role="val">$${last}k</div><div class="ch-sub" data-role="sub">Dec · <b>+${Math.round(((last - first) / first) * 100)}%</b> YoY</div></div>
  <div class="seg-mini" role="group" aria-label="Series"><span class="seg-thumb"></span><button data-act="chart-s" data-s="rev" aria-pressed="true">Revenue</button><button data-act="chart-s" data-s="usr" aria-pressed="false">Users</button></div></div>
  <div class="chart-plot no-gesture" aria-label="Drag to scrub values">${chartSVG('rev', id)}<div class="ch-tip"></div></div>
</div>`;
}
const POLLS = {
  offsite: { q: 'Where should we hold the Q1 offsite?', o: ['Lisbon — sun & seafood', 'Kyoto — temples & focus', 'Mexico City — food & art', 'Stay remote, save budget'], base: [7, 11, 5, 2] },
};
function pollCard(a, ctx) {
  const p = POLLS[a.id] || POLLS.offsite; const key = 'lumen.poll.' + (a.id || 'offsite') + '.' + ctx.key;
  const mine = LS.get(key, null);
  const votes = p.base.slice(); if (mine != null) votes[mine]++;
  const tot = votes.reduce((x, y) => x + y, 0);
  return `<div class="card poll ${mine != null ? 'voted' : ''}" data-key="${esc(key)}" data-base="${p.base.join(',')}" role="group" aria-label="Poll: ${esc(p.q)}">
  <div class="card-h">${ICON.poll} Poll</div><div class="poll-q">${esc(p.q)}</div>
  ${p.o.map((o, i) => `<button class="poll-o ${mine === i ? 'mine' : ''}" data-act="vote" data-i="${i}" aria-pressed="${mine === i}"><span class="pf" style="${mine != null ? `transform:scaleX(${votes[i] / tot})` : ''}"></span><span class="pc">${ICON.check}</span><span class="pt">${esc(o)}</span><span class="pp">${Math.round((votes[i] / tot) * 100)}%</span></button>`).join('')}
  <div class="poll-f"><span data-role="tot">${tot}</span> votes · ${mine != null ? 'You voted' : 'Tap to vote'}</div></div>`;
}
function mapCard(a) {
  const name = a.name || 'Kōyō Coffee Stand', area = a.area || 'Gion, Higashiyama';
  return `<div class="card map" role="group" aria-label="Location: ${esc(name)}">
  <div class="map-art"><svg viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path class="water" d="M-10 118 C60 104 110 130 170 120 S280 98 350 110 V160 H-10Z"/>
    <path class="park" d="M222 18c26-8 64 2 72 24s-14 40-46 38-52-12-54-30 6-26 28-32Z"/>
    <g class="blk"><rect x="30" y="20" width="60" height="34" rx="4"/><rect x="110" y="24" width="48" height="30" rx="4"/><rect x="34" y="66" width="52" height="30" rx="4"/><rect x="186" y="80" width="56" height="22" rx="4"/></g>
    <path class="road" stroke-width="7" d="M-10 60 H350"/><path class="road" stroke-width="5" d="M100 -10 V140"/><path class="road" stroke-width="4" d="M170 -10 C176 40 168 80 178 140"/>
    <path class="road major" stroke-width="8" d="M-10 104 C80 96 150 100 220 70 S320 30 350 26"/>
    <path class="road" stroke-width="3" d="M260 -10 L240 140"/>
  </svg><div class="pin"><div class="pin-b">${ICON.sparkle}</div></div></div>
  <div class="map-info"><div><b>${esc(name)}</b><small><span class="star" aria-label="Rating 4.8">★ 4.8</span>· ${esc(area)} · 6 min walk</small></div><button class="btn-acc" data-act="map-dir">${ICON.nav} Go</button></div>
</div>`;
}
function toolsCard(a, ctx) {
  const steps = a.steps || [];
  const live = !!ctx.live;
  return `<div class="card tools ${live ? '' : 'static done'}" data-run="tools" role="group" aria-label="Tool calls">
  <div class="card-h">${ICON.bolt}<span data-role="lbl">${live ? 'Working…' : `Used ${steps.length} tools`}</span><span class="tc-time" data-role="time">${live ? '' : (a.secs || 3.8) + 's'}</span></div>
  ${steps.map((s) => `<div class="tool-step ${live ? 'pending' : 'done'}"><span class="ts-ic">${ICON.check}</span><span class="ts-t">${esc(s[0])}<small>${esc(s[1] || '')}</small></span></div>`).join('')}
</div>`;
}
function artifactCard(a) {
  const art = ARTIFACTS[a.id] || ARTIFACTS.pomodoro;
  return `<button class="card artifact" data-act="art-card" data-id="${esc(a.id || 'pomodoro')}" aria-label="Open artifact ${esc(art.title)}"><span class="art-ic">${ICON.canvas}</span><div><b>${esc(art.title)}</b><small>${esc(LANG_NAMES[art.lang] || art.lang)} · ${art.code.split('\n').length} lines · Tap to preview</small></div>${ICON.chevR.replace('<svg', '<svg class="chev-r"')}</button>`;
}
function errorCard(a) {
  return `<div class="card errc" role="alert"><span class="e-ic">${ICON.alert}</span><div><b>${esc(a.title || 'Response interrupted')}</b><p>${esc(a.msg || 'The model is temporarily overloaded. Nothing was lost — try again.')}</p><button class="btn-acc" data-act="retry">${ICON.regen} Retry</button></div></div>`;
}
function cardHTML(name, args, ctx) {
  switch (name) {
    case 'weather': return weatherCard(args, ctx);
    case 'gallery': return galleryCard(args, ctx);
    case 'chart': return chartCard(args, ctx);
    case 'poll': return pollCard(args, ctx);
    case 'map': return mapCard(args, ctx);
    case 'tools': return toolsCard(args, ctx);
    case 'artifact': return artifactCard(args, ctx);
    case 'error': return errorCard(args, ctx);
    default: return '';
  }
}

/* Chart interactions (delegated) */
function chartScrub(plot, clientX) {
  const card = plot.closest('.chart'); const s = CHART_DATA[card.dataset.series];
  const r = plot.getBoundingClientRect(); const W = 340, H = 170, pad = 16;
  const fx = clamp((clientX - r.left) / r.width, 0, 1) * W;
  const i = clamp(Math.round(((fx - pad) / (W - pad * 2)) * (s.v.length - 1)), 0, s.v.length - 1);
  if (plot._i === i) return; plot._i = i;
  const { pts } = chartPath(s.v, W, H, pad); const [x, y] = pts[i];
  const cur = $('.ch-cursor', plot);
  $('line', cur).setAttribute('x1', x); $('line', cur).setAttribute('x2', x);
  const dot = $('.ch-dot', cur); dot.setAttribute('cx', x); dot.setAttribute('cy', y);
  const tip = $('.ch-tip', plot); tip.textContent = `${MONTHS[i]} · ${s.unit}${s.v[i]}${s.suffix}`;
  const px = (x / W) * r.width; tip.style.transform = `translate3d(${clamp(px - 50, 0, r.width - 110)}px, ${(y / H) * r.height - 40}px, 0)`;
  $('[data-role="val"]', card).textContent = `${s.unit}${s.v[i]}${s.suffix}`;
  const prev = s.v[i - 1]; const ch = prev ? Math.round(((s.v[i] - prev) / prev) * 1000) / 10 : 0;
  $('[data-role="sub"]', card).innerHTML = `${MONTHS[i]} · <b style="color:${ch < 0 ? 'var(--danger)' : 'var(--ok)'}">${ch >= 0 ? '+' : ''}${ch}%</b> MoM`;
  haptic('select');
}
function chartBind(root) {
  root.addEventListener('pointerdown', (e) => {
    const plot = e.target.closest('.chart-plot'); if (!plot) return;
    plot.classList.add('active'); plot._i = -1; chartScrub(plot, e.clientX);
    try { plot.setPointerCapture(e.pointerId); } catch (_) {}
    const mv = (ev) => chartScrub(plot, ev.clientX);
    const up = () => { plot.classList.remove('active'); plot.removeEventListener('pointermove', mv); plot.removeEventListener('pointerup', up); plot.removeEventListener('pointercancel', up); resetChart(plot.closest('.chart')); };
    plot.addEventListener('pointermove', mv); plot.addEventListener('pointerup', up); plot.addEventListener('pointercancel', up);
  });
}
function resetChart(card) {
  const s = CHART_DATA[card.dataset.series]; const last = s.v[s.v.length - 1], first = s.v[0];
  $('[data-role="val"]', card).textContent = `${s.unit}${last}${s.suffix}`;
  $('[data-role="sub"]', card).innerHTML = `Dec · <b>+${Math.round(((last - first) / first) * 100)}%</b> YoY`;
}
function setChartSeries(card, key) {
  card.dataset.series = key;
  $('.chart-plot', card).innerHTML = chartSVG(key, card.dataset.uid + key) + '<div class="ch-tip"></div>';
  $$('.seg-mini button', card).forEach((b) => b.setAttribute('aria-pressed', b.dataset.s === key));
  positionSegThumb($('.seg-mini', card));
  resetChart(card);
}
function positionSegThumb(seg, animate = true) {
  if (!seg) return;
  const on = $('[aria-pressed="true"]', seg); const th = $('.seg-thumb', seg);
  if (!on || !th) return;
  if (!animate) th.style.transition = 'none';
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft - 2}px)`;
  if (!animate) { th.offsetWidth; th.style.transition = ''; }
}
function vote(card, i) {
  if (card.classList.contains('voted')) return;
  const base = card.dataset.base.split(',').map(Number); base[i]++;
  const tot = base.reduce((a, b) => a + b, 0);
  LS.set(card.dataset.key, i);
  card.classList.add('voted');
  $$('.poll-o', card).forEach((o, j) => {
    o.classList.toggle('mine', j === i); o.setAttribute('aria-pressed', j === i);
    $('.pp', o).textContent = Math.round((base[j] / tot) * 100) + '%';
    requestAnimationFrame(() => { $('.pf', o).style.transform = `scaleX(${base[j] / tot})`; });
  });
  $('.poll-f', card).innerHTML = `<span>${tot}</span> votes · You voted`;
  haptic(); Sound.play('tick');
}
