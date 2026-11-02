/* =====================================================================
   13. Thread rendering
   ===================================================================== */
let D = {}; // DOM refs, filled at boot
let streaming = null;
let atBottom = true;
let unread = 0;
let touching = false; // finger on the scroller → never auto-stick
const EMOJI = ['❤️', '👍', '👎', '😂', '‼️', '❓'];

const findMsg = (id) => current && current.messages.find((m) => m.id === id);
const rowOf = (id) => D.list.querySelector(`.row[data-id="${id}"]`);
function textHTML(t) {
  return esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)@(Researcher|Coder|Designer|Analyst)\b/g, '$1<span class="mention">@$2</span>');
}
function plainOf(m) {
  if (m.role === 'user') return curV(m).text || '';
  const v = curV(m);
  if (v.html) { const d = document.createElement('div'); d.innerHTML = v.html; return d.textContent; }
  return (v.md || '').replace(/^:::.*$/gm, '').replace(/[*_`#>|]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
function reactsHTML(m) {
  if (!m.reactions || !m.reactions.length) return '';
  return `<div class="reacts">${m.reactions.map((e) => `<span class="react glass" data-e="${e}" role="img" aria-label="Reaction ${e}">${e}</span>`).join('')}</div>`;
}
function quoteHTML(q) {
  return `<button class="quote" data-act="quote-jump" data-id="${q.id}" aria-label="Replying to: ${esc(q.text.slice(0, 80))}"><span>${esc(q.text.slice(0, 140))}</span></button>`;
}
function voiceHTML(m) {
  const bars = m.voice.bars.map((b) => `<i style="height:${Math.round(18 + b * 82)}%"></i>`).join('');
  return `<div class="vb"><button class="vb-play" data-act="voice-play" aria-label="Play voice message">${ICON.play}</button><div class="vb-bars"><div class="bars">${bars}</div><div class="bars fill">${bars}</div></div><span class="vb-dur">${fmtDur(m.voice.dur)}</span></div>${curV(m).text ? `<div class="vb-tx">${esc(curV(m).text)}</div>` : ''}`;
}
function attsHTML(atts) {
  if (!atts || !atts.length) return '';
  const imgs = atts.filter((a) => a.kind === 'img');
  const files = atts.filter((a) => a.kind === 'file');
  return `<div class="u-atts ${imgs.length + files.length === 1 ? 'one' : ''}">${imgs.map((a) => `<img src="${a.src}" alt="Attached photo">`).join('')}${files.map((a) => `<div class="u-file">${ICON.file}<span>${esc(a.name)}</span></div>`).join('')}</div>`;
}
function branchHTML(m) {
  return `<div class="branch" role="group" aria-label="Versions"><button class="ab sm" data-act="br-prev" aria-label="Previous version" ${m.vi === 0 ? 'disabled' : ''}>${ICON.chevL}</button><span class="br-n">${m.vi + 1}/${m.versions.length}</span><button class="ab sm" data-act="br-next" aria-label="Next version" ${m.vi === m.versions.length - 1 ? 'disabled' : ''}>${ICON.chevR}</button></div>`;
}
function actionsHTML(m) {
  const b = (act, ic, label, extra = '') => `<button class="ab" data-act="${act}" aria-label="${label}" ${extra}>${ic}</button>`;
  return `<div class="actions" role="toolbar" aria-label="Message actions">${[
    `<button class="ab" data-act="m-copy" aria-label="Copy"><span class="ic-copy">${ICON.copy}</span><span class="ic-check">${ICON.check}</span></button>`,
    b('m-speak', ICON.speaker, 'Read aloud', 'aria-pressed="false"'),
    b('m-up', ICON.thumbUp, 'Good response', `aria-pressed="${m.rating === 1}"`).replace('class="ab"', `class="ab ${m.rating === 1 ? 'on' : ''}"`),
    b('m-down', ICON.thumbDown, 'Bad response', `aria-pressed="${m.rating === -1}"`).replace('class="ab"', `class="ab ${m.rating === -1 ? 'on' : ''}"`),
    b('m-share', ICON.share, 'Share'),
    b('m-regen', ICON.regen, 'Regenerate'),
  ].map((h, i) => h.replace('<button', `<button style="--i:${i}"`)).join('')}${m.versions.length > 1 ? branchHTML(m) : ''}</div>`;
}
function thinkHTML(th, live) {
  return `<div class="think ${live ? 'live' : ''}" data-open="false"><button class="think-h" data-act="think-toggle" aria-expanded="false">${ICON.brain.replace('<svg', '<svg class="think-ic"')}<span class="think-lbl">${live ? 'Thinking' : 'Thought for'}</span><span class="think-time">${live ? '0.0s' : th.secs + 's'}</span><span class="chev">${ICON.chevR}</span></button><div class="think-b"><div class="think-in">${live ? '' : esc(th.text)}</div></div></div>`;
}
function userRow(m) {
  const v = curV(m);
  return `<div class="row user" data-id="${m.id}"><div class="sw"><div class="reply-ico">${ICON.reply}</div><div class="msg">${m.replyTo ? quoteHTML(m.replyTo) : ''}${attsHTML(v.atts)}${(v.text || m.voice) ? `<div class="bubble${m.voice ? ' voice' : ''}" role="article" aria-label="You said: ${esc((v.text || 'voice message').slice(0, 120))}">${m.voice ? voiceHTML(m) : textHTML(v.text)}</div>` : ''}${reactsHTML(m)}</div>${m.versions.length > 1 ? `<div class="u-branch">${branchHTML(m)}</div>` : ''}</div><time class="ts" datetime="${new Date(m.t).toISOString()}">${fmtTime(m.t)}</time></div>`;
}
function aiRow(m, o = {}) {
  const v = curV(m);
  const body = o.live ? '' : (v.html != null ? v.html : mdToHTML(v.md, { msgId: m.id }));
  return `<div class="row ai" data-id="${m.id}"><div class="sw"><div class="reply-ico">${ICON.reply}</div><div class="msg" role="article" aria-label="Lumen replied"><div class="ai-head">${aiMark()}<span>Lumen</span>${v.agent ? `<span class="ai-agent">@${esc(v.agent)}</span>` : ''}${m.pinned ? ICON.pin.replace('<svg', '<svg class="ai-pin"') : ''}${v.state === 'stopped' ? '<span class="ai-stop">Stopped</span>' : ''}</div>${m.replyTo ? quoteHTML(m.replyTo) : ''}${!o.live && v.think ? thinkHTML(v.think, false) : ''}<div class="ai-body md">${body}</div>${reactsHTML(m)}${o.live ? '' : actionsHTML(m)}</div></div><time class="ts" datetime="${new Date(m.t).toISOString()}">${fmtTime(m.t)}</time></div>`;
}
function renderRow(m, o) { return el(m.role === 'user' ? userRow(m) : aiRow(m, o)); }
function regroup() {
  const rows = Array.from(D.list.children);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; if (!r.classList.contains('user')) continue;
    const pm = rows[i - 1] && rows[i - 1].classList.contains('user');
    const nm = rows[i + 1] && rows[i + 1].classList.contains('user');
    r.classList.toggle('g-start', !pm); r.classList.toggle('g-end', !nm);
    const b = $('.bubble', r); if (b) b.classList.toggle('tail', !nm);
  }
}
function setMode(mode) {
  D.main.dataset.mode = mode;
  D.nav.classList.toggle('collapsed', false);
  D.nav.style.setProperty('--navp', 0);
}
function updateTitle() {
  if (!current) return;
  D.ltTitle.textContent = current.title;
  D.npTitle.textContent = current.title;
  const n = current.messages.length;
  D.ltSub.textContent = `${n} message${n === 1 ? '' : 's'} · ${smartDay(current.messages[0]?.t || Date.now())}`;
}
function renderThread(o = {}) {
  if (!current || !current.messages.length) { D.list.textContent = ''; setMode('home'); showHome(); return; }
  setMode('thread');
  updateTitle();
  const frag = document.createDocumentFragment(); let prevT = 0;
  current.messages.forEach((m, i) => {
    if (m.t - prevT > 45 * 60e3) frag.appendChild(el(`<div class="sep-time" role="separator"><b>${smartDay(m.t)}</b> ${fmtTime(m.t)}</div>`));
    prevT = m.t;
    const r = renderRow(m);
    if (o.stagger) { r.classList.add('enter'); r.style.setProperty('--i', Math.max(0, i - current.messages.length + 10)); }
    frag.appendChild(r);
  });
  D.list.replaceChildren(frag);
  regroup();
  $$('.seg-mini', D.list).forEach((s) => positionSegThumb(s, false));
  if (!o.keepScroll) scrollToBottom(false);
}
function showSkeleton() {
  setMode('thread');
  D.list.innerHTML = `<div class="skel-row r"><div class="skel b" style="width:62%"></div></div>
  <div class="skel-row"><div class="skel" style="width:30%;height:18px"></div><div class="skel" style="width:92%"></div><div class="skel" style="width:84%"></div><div class="skel" style="width:58%"></div></div>
  <div class="skel-row r"><div class="skel b" style="width:44%"></div></div>
  <div class="skel-row"><div class="skel" style="width:30%;height:18px"></div><div class="skel" style="width:88%"></div><div class="skel" style="width:96%"></div><div class="skel" style="width:70%"></div><div class="skel" style="width:40%"></div></div>`;
}
function scrollToBottom(smooth) {
  const s = D.scroller;
  if (smooth && !RM) s.scrollTo({ top: s.scrollHeight, behavior: 'smooth' });
  else s.scrollTop = s.scrollHeight;
  atBottom = true; unread = 0; updateFab();
}
function stick() { if (atBottom && !touching) D.scroller.scrollTop = D.scroller.scrollHeight; }
function updateFab() {
  const far = !atBottom && D.main.dataset.mode === 'thread';
  D.fab.classList.toggle('show', far);
  D.badge.textContent = unread > 99 ? '99+' : unread;
  D.badge.classList.toggle('on', far && unread > 0);
}
function bumpUnread() {
  if (atBottom) return;
  unread++; updateFab();
  D.badge.classList.remove('tick'); void D.badge.offsetWidth; D.badge.classList.add('tick');
}

/* =====================================================================
   14. Streaming
   ===================================================================== */
function prepareUnits(root) {
  const units = [];
  const walk = (node) => {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === 3) {
        if (!ch.data.trim()) continue;
        const frag = document.createDocumentFragment();
        const parts = ch.data.match(/\S+\s*|\s+/g) || [];
        for (const p of parts) {
          if (!p.trim()) { frag.appendChild(document.createTextNode(p)); continue; }
          const s = document.createElement('span'); s.className = 'sx'; s.textContent = p;
          frag.appendChild(s); units.push({ el: s, k: 'w' });
        }
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) {
        ch.classList.add('sx');
        if (ch.classList.contains('code')) { units.push({ el: ch, k: 'code' }); $$('.l', ch).forEach((l) => l.classList.add('sx')); }
        else if (ch.classList.contains('card')) units.push({ el: ch, k: 'card' });
        else if (ch.tagName === 'HR') units.push({ el: ch, k: 'block' });
        else walk(ch);
      }
    }
  };
  walk(root);
  return units;
}
const BLOCK_TAGS = /^(P|LI|H2|H3|H4|TR|BLOCKQUOTE|DIV)$/;
function reveal(u, root) {
  let p = u.el; let newBlock = false;
  while (p && p !== root) {
    if (p.classList.contains('sx')) { p.classList.remove('sx'); if (BLOCK_TAGS.test(p.tagName)) newBlock = true; }
    p = p.parentElement;
  }
  u.el.classList.add('tk');
  return newBlock;
}
function wordDelay(w) {
  const sp = settings.speed;
  let d = rand(16, 46);
  if (/[.!?]["”')]*\s*$/.test(w)) d += rand(120, 260);
  else if (/[,;:—–]\s*$/.test(w)) d += rand(50, 110);
  if (Math.random() < 0.035) d += rand(140, 320); // occasional "thinking" hitch
  return d / sp;
}
async function runTools(card, tok) {
  const steps = $$('.tool-step', card); const t0 = performance.now();
  const tEl = $('[data-role="time"]', card);
  const tick = setInterval(() => { tEl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's'; }, 100);
  for (const s of steps) {
    if (tok.stop) break;
    s.classList.remove('pending'); s.classList.add('run'); stick();
    await sleep(rand(650, 1250) / settings.speed);
    s.classList.remove('run'); s.classList.add('done'); Sound.play('tick');
  }
  clearInterval(tick);
  card.classList.add('done');
  $('[data-role="lbl"]', card).textContent = tok.stop ? 'Stopped' : `Used ${steps.length} tools`;
}
async function streamInto(convo, m, row) {
  const v = curV(m);
  const tok = { stop: false };
  streaming = { convo, m, row, tok };
  Composer.refresh();
  Island.generating();
  row.setAttribute('aria-busy', 'true');
  const body = $('.ai-body', row);
  const msgEl = $('.msg', row);
  body.innerHTML = '<div class="typing" aria-label="Lumen is typing"><i></i><i></i><i></i></div>';
  stick();
  await sleep(rand(380, 650) / Math.sqrt(settings.speed));

  // --- thinking ---
  if (v.think && settings.reasoning && !tok.stop) {
    body.innerHTML = '';
    const th = el(thinkHTML(v.think, true)); body.before(th);
    const tEl = $('.think-time', th), inEl = $('.think-in', th);
    const t0 = performance.now(); const dur = (v.think.secs * 1000) / settings.speed;
    const tick = setInterval(() => { tEl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's'; }, 100);
    const words = v.think.text.split(/(\s+)/);
    const per = dur / Math.max(1, words.length);
    for (const w of words) { if (tok.stop) break; inEl.textContent += w; await sleep(per); }
    while (!tok.stop && performance.now() - t0 < dur) await sleep(50);
    clearInterval(tick);
    th.classList.remove('live');
    $('.think-lbl', th).textContent = 'Thought for';
    tEl.textContent = v.think.secs + 's';
    stick();
  }

  // --- answer ---
  let stopped = tok.stop;
  if (!tok.stop) {
    body.innerHTML = mdToHTML(v.md, { msgId: m.id, live: true });
    const units = prepareUnits(body);
    const caret = el('<span class="caret" aria-hidden="true"></span>');
    body.appendChild(caret);
    for (const u of units) {
      if (tok.stop) break;
      const nb = reveal(u, body);
      if (nb || u.k !== 'w') bumpUnread();
      if (u.k === 'w') {
        u.el.after(caret); stick();
        await sleep(wordDelay(u.el.textContent));
      } else if (u.k === 'code') {
        u.el.after(caret);
        for (const l of $$('.l', u.el)) { if (tok.stop) break; l.classList.remove('sx'); l.classList.add('tk'); stick(); await sleep(rand(22, 50) / settings.speed); }
        await sleep(120);
      } else if (u.k === 'card') {
        u.el.after(caret); stick(); haptic('select');
        if (u.el.dataset.run === 'tools') await runTools(u.el, tok);
        else if (u.el.classList.contains('errc')) { await sleep(60); u.el.classList.add('shake'); haptic('heavy'); Island.flash('error', 'Something went wrong'); }
        else await sleep(320 / settings.speed);
        if (u.el.classList.contains('chart')) positionSegThumb($('.seg-mini', u.el), false);
      } else { stick(); await sleep(80); }
    }
    caret.remove();
    stopped = tok.stop;
    if (stopped) {
      $$('.sx', body).forEach((n) => n.remove());
      $$('.tk', body).forEach((n) => n.classList.remove('tk'));
      v.html = body.innerHTML;
      v.state = 'stopped';
    }
  } else {
    body.innerHTML = '';
  }
  if (stopped && !v.html) { v.html = body.innerHTML || '<p><em>Stopped.</em></p>'; v.state = 'stopped'; }
  if (!stopped) { v.state = 'done'; delete v.html; }
  // --- finish ---
  row.removeAttribute('aria-busy');
  const head = $('.ai-head', row);
  if (stopped && head && !$('.ai-stop', head)) head.insertAdjacentHTML('beforeend', '<span class="ai-stop">Stopped</span>');
  const acts = el(actionsHTML(m)); acts.classList.add('in'); msgEl.appendChild(acts);
  streaming = null;
  Composer.refresh();
  Island.done(stopped);
  Sound.play('pop'); haptic();
  D.srLive.textContent = 'Lumen: ' + body.textContent.slice(0, 280);
  convo.updated = Date.now();
  if (convo === current) updateTitle();
  save(); stick(); Drawer.refreshIfOpen();
}
function stopStreaming() { if (streaming) { streaming.tok.stop = true; haptic(); } }

async function respondTo(convo, userMsg, o = {}) {
  const uv = curV(userMsg);
  const text = uv.text || '';
  const agent = (text.match(/@(Researcher|Coder|Designer|Analyst)\b/) || [])[1] || null;
  const r = Engine.respond(text, { atts: uv.atts, kind: o.kind });
  const m = { id: uid(), role: 'ai', t: Date.now(), versions: [{ md: r.md, think: r.think, agent, state: 'streaming', prompt: text }], vi: 0, reactions: [] };
  convo.messages.push(m);
  if (convo !== current) return;
  const row = renderRow(m, { live: true });
  row.classList.add('enter');
  D.list.appendChild(row); regroup(); stick();
  await streamInto(convo, m, row);
}
function promptFor(m) {
  const i = current.messages.indexOf(m);
  for (let j = i - 1; j >= 0; j--) if (current.messages[j].role === 'user') return current.messages[j];
  return null;
}
async function regenerate(m) {
  if (streaming) return;
  const u = promptFor(m); const text = u ? curV(u).text : (curV(m).prompt || '');
  const r = Engine.respond(text, { seed: m.versions.length, atts: u ? curV(u).atts : [] });
  m.versions.push({ md: r.md, think: r.think, agent: curV(m).agent, state: 'streaming', prompt: text });
  m.vi = m.versions.length - 1;
  const old = rowOf(m.id);
  const row = renderRow(m, { live: true });
  old.replaceWith(row);
  $('.ai-body', row).style.setProperty('--dir', 1); $('.ai-body', row).classList.add('slide-in');
  await streamInto(current, m, row);
}
async function retry(m) {
  if (streaming) return;
  const u = promptFor(m); const text = u ? curV(u).text : '';
  const v = curV(m);
  const r = Engine.respond(text.replace(/error|fail|crash/gi, ''), { forceOk: true, seed: 1 });
  v.md = r.md; v.think = r.think; delete v.html; v.state = 'streaming';
  const old = rowOf(m.id); const row = renderRow(m, { live: true }); old.replaceWith(row);
  await streamInto(current, m, row);
}
function switchAIVersion(m, dir) {
  const nv = m.vi + dir; if (nv < 0 || nv >= m.versions.length || streaming) return;
  const row = rowOf(m.id); const body = $('.ai-body', row);
  body.style.setProperty('--dir', dir);
  body.classList.remove('slide-in'); body.classList.add('slide-out');
  haptic('select');
  setTimeout(() => {
    m.vi = nv; save();
    const n = renderRow(m); row.replaceWith(n);
    const nb = $('.ai-body', n); nb.style.setProperty('--dir', dir); nb.classList.add('slide-in');
    $$('.seg-mini', n).forEach((s) => positionSegThumb(s, false));
  }, RM ? 0 : 170);
}
function switchUserVersion(m, dir) {
  const idx = current.messages.indexOf(m); const nv = m.vi + dir;
  if (nv < 0 || nv >= m.versions.length || streaming) return;
  m.versions[m.vi].tail = current.messages.slice(idx + 1);
  current.messages = current.messages.slice(0, idx + 1).concat(m.versions[nv].tail || []);
  m.versions[nv].tail = null; m.vi = nv; save();
  haptic('select');
  const st = D.scroller.scrollTop;
  renderThread({ keepScroll: true });
  D.scroller.scrollTop = st;
  const after = Array.from(D.list.children).slice(Array.from(D.list.children).indexOf(rowOf(m.id)));
  after.forEach((r, i) => r.animate([{ opacity: 0, transform: `translate3d(${dir * 30}px,0,0)` }, { opacity: 1, transform: 'none' }], { duration: 460, delay: i * 30, easing: EASE_SPRING, fill: 'backwards' }));
}
function commitEdit(m, text) {
  const idx = current.messages.indexOf(m);
  m.versions[m.vi].tail = current.messages.slice(idx + 1);
  m.versions.push({ text, atts: curV(m).atts || [] });
  m.vi = m.versions.length - 1;
  current.messages = current.messages.slice(0, idx + 1);
  renderThread({ keepScroll: true });
  const row = rowOf(m.id);
  if (row) $('.bubble', row)?.animate([{ transform: 'translate3d(30px,0,0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: EASE_SPRING });
  scrollToBottom(true);
  save();
  setTimeout(() => respondTo(current, m), 300);
}
async function deleteMsg(m) {
  const idx = current.messages.indexOf(m); if (idx < 0) return;
  const row = rowOf(m.id);
  current.messages.splice(idx, 1); save();
  if (row) {
    await row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished;
    collapseRemove(row);
  }
  regroup();
  toast('Message deleted', { icon: ICON.trash, action: 'Undo', onAction: () => { current.messages.splice(idx, 0, m); save(); renderThread({ keepScroll: true }); } });
  if (!current.messages.length) renderThread();
}
function collapseRemove(node) {
  const after = []; let n = node.nextElementSibling;
  while (n) { after.push(n); n = n.nextElementSibling; }
  const before = after.map((x) => x.getBoundingClientRect().top);
  node.remove();
  after.forEach((x, i) => {
    const d = before[i] - x.getBoundingClientRect().top;
    if (Math.abs(d) > 0.5) x.animate([{ transform: `translate3d(0,${d}px,0)` }, { transform: 'none' }], { duration: 520, easing: EASE_SPRING });
  });
}

/* =====================================================================
   15. Message interactions (delegated)
   ===================================================================== */
function onListClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const row = b.closest('.row'); const m = row ? findMsg(row.dataset.id) : null;
  const act = b.dataset.act;
  switch (act) {
    case 'copy-code': {
      copyText(codeText(b.closest('.code'))); b.classList.add('done'); haptic(); Island.flash('copied', 'Copied');
      setTimeout(() => b.classList.remove('done'), 1800); break;
    }
    case 'art-open': { const c = b.closest('.code'); openArtifact({ title: LANG_NAMES[c.dataset.lang] ? `${LANG_NAMES[c.dataset.lang]} snippet` : 'Snippet', lang: c.dataset.lang || 'js', code: codeText(c) }); break; }
    case 'art-card': openArtifact(ARTIFACTS[b.dataset.id] || ARTIFACTS.pomodoro); break;
    case 'think-toggle': {
      const t = b.closest('.think'); const open = t.dataset.open !== 'true';
      t.dataset.open = open; b.setAttribute('aria-expanded', open); haptic('select'); break;
    }
    case 'm-copy': copyText(plainOf(m)); b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1600); haptic(); Island.flash('copied', 'Copied'); break;
    case 'm-regen': regenerate(m); break;
    case 'm-up': case 'm-down': {
      const val = act === 'm-up' ? 1 : -1; m.rating = m.rating === val ? 0 : val; save();
      $$('.ab[data-act="m-up"], .ab[data-act="m-down"]', row).forEach((x) => { const on = (x.dataset.act === 'm-up' ? 1 : -1) === m.rating; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      if (m.rating) { b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst'); haptic(); toast(m.rating > 0 ? 'Thanks — glad that helped' : 'Thanks for the feedback', { icon: m.rating > 0 ? ICON.heart : ICON.info }); }
      break;
    }
    case 'm-share': {
      const text = plainOf(m);
      if (navigator.share) navigator.share({ title: 'From Lumen', text }).catch(() => {});
      else { copyText(text); Island.flash('copied', 'Copied to share'); }
      break;
    }
    case 'm-speak': Speak.toggle(m, row); break;
    case 'br-prev': case 'br-next': (m.role === 'ai' ? switchAIVersion : switchUserVersion)(m, act === 'br-prev' ? -1 : 1); break;
    case 'vote': vote(b.closest('.poll'), +b.dataset.i); break;
    case 'chart-s': setChartSeries(b.closest('.chart'), b.dataset.s); haptic('select'); break;
    case 'lightbox': openLightbox(b); break;
    case 'map-dir': haptic(); toast('Opening walking directions…', { icon: ICON.nav }); break;
    case 'retry': retry(m); break;
    case 'voice-play': VoicePlay.toggle(m, row, b); break;
    case 'quote-jump': {
      const r = rowOf(b.dataset.id); if (!r) break;
      r.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      const t = $('.bubble', r) || $('.msg', r); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); break;
    }
  }
}

/* Swipe-right-to-reply + drag-left timestamps + long-press */
function bindListGestures() {
  let mode = null, row = null, sw = null, ico = null, hot = false;
  const tsSpring = new Spring(0, { ...SPR.smooth, precision: 0.2 }, (v) => { D.list.style.transform = v ? `translate3d(${v}px,0,0)` : ''; });
  gesture(D.list, {
    start: (pt) => {
      if (pt.x < 26 || Ctx.open) return false;
      if (pt.target.closest('.no-gesture, input, textarea')) return false;
      row = pt.target.closest('.row'); return true;
    },
    long: (pt) => { const r = pt.target.closest('.row'); if (r) Ctx.show(r); },
    lock: (axis, dx) => {
      if (axis !== 'x') return false;
      if (dx > 0 && row) { mode = 'reply'; sw = $('.sw', row); ico = $('.reply-ico', row); hot = false; row._sp && row._sp.stop(); return true; }
      if (dx < 0) { mode = 'ts'; tsSpring.stop(); return true; }
      return false;
    },
    move: (dx) => {
      if (mode === 'reply') {
        const tx = rubber(Math.max(0, dx), 240, 0.85);
        sw.style.transform = `translate3d(${tx}px,0,0)`;
        const p = clamp(tx / 54, 0, 1);
        ico.style.opacity = p; ico.style.transform = `scale(${0.4 + 0.6 * p + (p >= 1 ? 0.12 : 0)})`;
        const h = p >= 1; if (h !== hot) { hot = h; ico.classList.toggle('hot', h); if (h) { haptic(); Sound.play('tick'); } }
      } else if (mode === 'ts') {
        const raw = Math.max(0, -dx); const tx = raw < 62 ? raw : 62 + rubber(raw - 62, 80);
        tsSpring.set(-tx);
      }
    },
    end: ({ vx }) => {
      if (mode === 'reply') {
        const target = sw, ic = ico, r = row, wasHot = hot;
        const cur = new DOMMatrixReadOnly(getComputedStyle(target).transform).m41 || 0;
        const sp = new Spring(cur, SPR.bouncy, (v) => {
          target.style.transform = v > 0.3 ? `translate3d(${v}px,0,0)` : '';
          const p = clamp(v / 54, 0, 1); ic.style.opacity = p; ic.style.transform = `scale(${0.4 + 0.6 * p})`;
        });
        r._sp = sp; sp.to(0, { velocity: vx * 0.5 });
        ic.classList.remove('hot');
        if (wasHot) { const m = findMsg(r.dataset.id); if (m) Composer.setReply(m); }
      } else if (mode === 'ts') {
        tsSpring.to(0, { velocity: vx });
      }
      mode = null;
    },
  });
  D.list.addEventListener('contextmenu', (e) => {
    const r = e.target.closest('.row'); if (!r || IS_IOS) return;
    e.preventDefault(); Ctx.show(r);
  });
}

/* =====================================================================
   16. Long-press context: lift + reactions + menu (iMessage-style)
   ===================================================================== */
const Ctx = {
  open: false,
  show(row) {
    if (this.open || !current) return;
    const m = findMsg(row.dataset.id); if (!m) return;
    if (document.activeElement === D.input) D.input.blur();
    this.open = true; this.row = row; this.m = m;
    haptic('heavy'); Sound.play('tick');
    const isUser = row.classList.contains('user');
    const target = isUser ? ($('.bubble', row) || $('.msg', row)) : $('.msg', row);
    this.target = target;
    const r = target.getBoundingClientRect();
    const L = D.ctx; L.innerHTML = ''; L.hidden = false; L.className = '';
    const bg = el('<div class="ctx-bg"></div>');
    const lift = el('<div class="ctx-lift"></div>');
    const clone = target.cloneNode(true);
    if (!isUser) clone.classList.add('ai-lift');
    clone.style.margin = '0';
    lift.appendChild(clone);
    const items = [['reply', 'Reply', ICON.reply], ['copy', 'Copy', ICON.copy], isUser && !m.voice && ['edit', 'Edit', ICON.edit], ['select', 'Select Text', ICON.select], ['pin', m.pinned ? 'Unpin' : 'Pin', ICON.pin], ['delete', 'Delete', ICON.trash, 'danger']].filter(Boolean);
    const reacts = el(`<div class="ctx-reacts glass" role="toolbar" aria-label="React">${EMOJI.map((e, i) => `<button class="ctx-emo ${m.reactions.includes(e) ? 'on' : ''}" data-e="${e}" style="--i:${i}" aria-label="React with ${e}">${e}</button>`).join('')}</div>`);
    const menu = el(`<div class="ctx-menu glass" role="menu" aria-label="Message options">${items.map(([k, l, ic, c], i) => `<button role="menuitem" class="ctx-item ${c || ''}" data-k="${k}"><span>${l}</span>${ic}</button>`).join('')}</div>`);
    L.append(bg, lift, reacts, menu);

    const H = D.app.clientHeight, W = innerWidth;
    const top0 = safeTop() + 10, bot0 = H - safeBottom() - 10;
    const menuH = items.length * 46, reactH = 52, gap = 10;
    const pad = isUser ? 0 : 14;
    let w = r.width + pad * 2, h = r.height + pad * 2;
    const maxH = bot0 - top0 - menuH - reactH - gap * 2;
    let scale = 1.03, liftH = h;
    if (h * scale > maxH) { scale = Math.max(0.72, maxH / h); if (h * scale > maxH) { liftH = maxH / scale; lift.classList.add('clip'); } }
    const left0 = isUser ? r.left : r.left - pad, topR = r.top - pad;
    lift.style.cssText = `left:${left0}px;top:${topR}px;width:${w}px;height:${liftH}px;transform-origin:${isUser ? '100%' : '0%'} 0`;
    const visH = liftH * scale;
    let vt = topR;
    vt = Math.max(vt, top0 + reactH + gap);
    vt = Math.min(vt, bot0 - menuH - gap - visH);
    const ty = vt - topR;
    const rw = 6 * 44 + 12, mw = 250;
    const rx = isUser ? clamp(r.right - rw, 8, W - rw - 8) : clamp(r.left, 8, W - rw - 8);
    const mx = isUser ? clamp(r.right - mw, 8, W - mw - 8) : clamp(r.left, 8, W - mw - 8);
    reacts.style.cssText = `left:${rx}px;top:${vt - gap - reactH}px;--ox:${isUser ? '85%' : '15%'}`;
    menu.style.cssText = `left:${mx}px;top:${vt + visH + gap}px;--ox:${isUser ? '90%' : '10%'}`;
    target.style.visibility = 'hidden';
    this.lift = lift; this.ty = ty; this.scale = scale;
    this.sp = new Spring(0, { ...SPR.bouncy, precision: 0.001 }, (p) => {
      lift.style.transform = `translate3d(0,${ty * p}px,0) scale(${1 + (scale - 1) * p})`;
    });
    requestAnimationFrame(() => L.classList.add('on'));
    this.sp.to(1);
    bg.addEventListener('click', () => this.hide());
    reacts.addEventListener('click', (e) => { const b = e.target.closest('.ctx-emo'); if (b) this.react(b); });
    menu.addEventListener('click', (e) => { const b = e.target.closest('.ctx-item'); if (b) this.action(b.dataset.k); });
    this.keyH = (e) => { if (e.key === 'Escape') this.hide(); };
    addEventListener('keydown', this.keyH);
    setTimeout(() => $('.ctx-item', menu)?.focus({ preventScroll: true }), 60);
  },
  async hide() {
    if (!this.open || this.closing) return;
    this.closing = true;
    removeEventListener('keydown', this.keyH);
    D.ctx.classList.add('out'); D.ctx.classList.remove('on');
    Object.assign(this.sp, SPR.snappy);
    await this.sp.to(0);
    if (this.target) this.target.style.visibility = '';
    D.ctx.hidden = true; D.ctx.innerHTML = '';
    this.open = false; this.closing = false;
  },
  async react(b) {
    const e = b.dataset.e; const m = this.m;
    const from = b.getBoundingClientRect();
    const had = m.reactions.includes(e);
    m.reactions = had ? m.reactions.filter((x) => x !== e) : [e];
    save(); haptic(); Sound.play('tick');
    b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 300, easing: EASE_BOUNCE });
    await sleep(120);
    await this.hide();
    const row = rowOf(m.id); if (!row) return;
    $('.reacts', row)?.remove();
    if (!m.reactions.length) return;
    const html = reactsHTML(m);
    if (row.classList.contains('user')) $('.msg', row).insertAdjacentHTML('beforeend', html);
    else { const acts = $('.actions', row); acts ? acts.insertAdjacentHTML('beforebegin', html) : $('.msg', row).insertAdjacentHTML('beforeend', html); }
    const badge = $('.react', row); if (!badge) return;
    badge.style.visibility = 'hidden';
    const to = badge.getBoundingClientRect();
    const fly = el(`<div class="fly-emo">${e}</div>`); D.fx.appendChild(fly);
    const sx = from.left + from.width / 2 - 13, sy = from.top + from.height / 2 - 13;
    const ex = to.left + to.width / 2 - 13 * 0.6, ey = to.top + to.height / 2 - 13 * 0.6;
    const mx = (sx + ex) / 2 + (row.classList.contains('user') ? -40 : 40), my = Math.min(sy, ey) - 50;
    const spr = new Spring(0, { stiffness: 260, damping: 26, precision: 0.002 }, (t) => {
      const u = 1 - t; const x = u * u * sx + 2 * u * t * mx + t * t * ex; const y = u * u * sy + 2 * u * t * my + t * t * ey;
      fly.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 - 0.4 * clamp(t, 0, 1)})`;
    });
    await spr.to(1);
    fly.remove(); badge.style.visibility = ''; badge.classList.add('r-pop');
    haptic('select');
  },
  async action(k) {
    const m = this.m; await this.hide();
    switch (k) {
      case 'reply': Composer.setReply(m); break;
      case 'copy': copyText(plainOf(m)); Island.flash('copied', 'Copied'); break;
      case 'edit': Composer.startEdit(m); break;
      case 'select': openSelectText(m); break;
      case 'pin': m.pinned = !m.pinned; save(); { const r = rowOf(m.id); r.replaceWith(renderRow(m)); regroup(); } Island.flash('saved', m.pinned ? 'Pinned' : 'Unpinned'); break;
      case 'delete': deleteMsg(m); break;
    }
  },
};

/* =====================================================================
   17. Read aloud with live word highlight (CSS Custom Highlight API)
   ===================================================================== */
const Speak = {
  cur: null, fallbackT: 0,
  toggle(m, row) {
    if (this.cur) { const same = this.cur.id === m.id; this.stop(); if (same) return; }
    if (!('speechSynthesis' in window)) { toast('Read aloud isn’t supported here', { icon: ICON.info }); return; }
    const body = $('.ai-body', row);
    const map = []; let text = '';
    const tw = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.code, .card') || !n.data.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = tw.nextNode())) { map.push({ n, s: text.length }); text += n.data + ' '; }
    if (!text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.lang = 'en-US';
    let gotBoundary = false;
    u.onboundary = (e) => { if (e.name && e.name !== 'word') return; gotBoundary = true; this.mark(map, text, e.charIndex); };
    u.onend = () => { if (this.cur && this.cur.u === u) this.stop(); };
    u.onerror = () => { if (this.cur && this.cur.u === u) this.stop(); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    this.cur = { id: m.id, row, u };
    row.classList.add('speaking');
    $('.ab[data-act="m-speak"]', row)?.setAttribute('aria-pressed', 'true');
    // fallback: estimate word timing if the engine never reports boundaries
    const words = [...text.matchAll(/\S+/g)]; let wi = 0;
    this.fallbackT = setInterval(() => { if (gotBoundary || !this.cur) return; if (wi < words.length) this.mark(map, text, words[wi++].index); }, 340);
  },
  mark(map, text, idx) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    let e = map[0]; for (const x of map) { if (x.s <= idx) e = x; else break; }
    const off = idx - e.s; if (off < 0 || off >= e.n.data.length) return;
    const rest = e.n.data.slice(off); const len = (rest.match(/^\S+/) || [''])[0].length; if (!len) return;
    const r = new Range(); r.setStart(e.n, off); r.setEnd(e.n, off + len);
    CSS.highlights.set('speak', new Highlight(r));
  },
  stop() {
    clearInterval(this.fallbackT);
    try { speechSynthesis.cancel(); } catch (e) {}
    if (window.CSS && CSS.highlights) CSS.highlights.delete('speak');
    if (this.cur) { this.cur.row.classList.remove('speaking'); $('.ab[data-act="m-speak"]', this.cur.row)?.setAttribute('aria-pressed', 'false'); }
    this.cur = null;
  },
};
const VoicePlay = {
  cur: null,
  toggle(m, row, btn) {
    if (this.cur) { const same = this.cur.id === m.id; this.stop(); if (same) return; }
    const fill = $('.bars.fill', row); const dur = m.voice.dur * 1000;
    const url = VOICE_BLOBS.get(m.id);
    let audio = null, utt = null;
    if (url) { audio = new Audio(url); audio.play().catch(() => {}); }
    else if ('speechSynthesis' in window && curV(m).text) { utt = new SpeechSynthesisUtterance(curV(m).text); speechSynthesis.cancel(); speechSynthesis.speak(utt); }
    const t0 = performance.now();
    btn.innerHTML = ICON.pause;
    const step = () => {
      if (!this.cur) return;
      const p = audio && audio.duration && isFinite(audio.duration) ? audio.currentTime / audio.duration : (performance.now() - t0) / dur;
      fill.style.clipPath = `inset(0 ${100 - clamp(p, 0, 1) * 100}% 0 0)`;
      if (p >= 1 || (audio && audio.ended)) { this.stop(); return; }
      this.cur.raf = requestAnimationFrame(step);
    };
    this.cur = { id: m.id, audio, utt, btn, fill };
    step();
  },
  stop() {
    if (!this.cur) return;
    const c = this.cur; this.cur = null;
    cancelAnimationFrame(c.raf);
    if (c.audio) c.audio.pause();
    if (c.utt) try { speechSynthesis.cancel(); } catch (e) {}
    c.btn.innerHTML = ICON.play; c.fill.style.clipPath = '';
  },
};
const VOICE_BLOBS = new Map();
