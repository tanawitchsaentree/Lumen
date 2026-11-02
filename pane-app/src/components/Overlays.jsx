import { useEffect, useRef, useState } from 'react';
import { Toast } from 'pane-react/Toast';
import { Snackbar } from 'pane-react/Snackbar';
import { Spinner } from 'pane-react/Spinner';
import { IconButton } from 'pane-react/IconButton';
import { Card } from 'pane-react/Card';
import { Text } from 'pane-react/Text';
import { Environment } from 'pane-react/Environment';
import { RawGlyph } from '../lib/glyph.jsx';
import { S, ISL, appCh, islandCh, emit, dropNotice, settings } from '../lib/store.js';
import { Engine, VOICE_FAKE, modelOf } from '../lib/engine.js';
import { Spring, SPR, clamp, lerp, rand, sleep, haptic } from '../lib/core.js';

/* ---------- Pane Toast / Snackbar ---------- */
export function Notices() {
  appCh.use();
  return S.notices.map((n) => n.kind === 'snack'
    ? <Snackbar key={n.id} open message={n.message} action={n.action} duration={n.duration || 4200} onOpenChange={(o) => !o && dropNotice(n.id)} />
    : <Toast key={n.id} open title={n.title} description={n.description} tone={n.tone || 'info'} duration={n.duration || 2600} onOpenChange={(o) => !o && dropNotice(n.id)} />);
}

/* ---------- Dynamic-Island status pill: a level-4 pane whose clip-path morphs on springs ---------- */
export function Island() {
  islandCh.use();
  const bg = useRef(null), c = useRef(null), t = useRef(null);
  const sp = useRef(null);
  if (!sp.current) {
    const W = 300, H = 38;
    const apply = () => {
      const w = clamp(sp.current.w.value, 20, W + 30), o = clamp(sp.current.o.value, 0, 1.2);
      const h = lerp(14, H, clamp(o, 0, 1)); const ix = (W - w) / 2, iy = (H - h) / 2;
      if (bg.current) { bg.current.style.clipPath = `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${h / 2}px)`; bg.current.style.opacity = clamp(o * 2.2, 0, 1); }
      if (c.current) c.current.style.opacity = clamp((o - 0.4) * 2, 0, 1);
    };
    sp.current = { w: new Spring(96, { stiffness: 380, damping: 21, precision: 0.2 }, apply), o: new Spring(0, { ...SPR.snappy, precision: 0.002 }, apply) };
  }
  useEffect(() => {
    const s = sp.current;
    if (!ISL.kind) { s.o.to(0); s.w.to(96); return; }
    const inner = c.current.firstElementChild;
    const w = Math.min(300, (inner ? inner.scrollWidth : 120) + 4);
    s.o.to(1); s.w.to(w);
    if (ISL.kind === 'gen') { const id = setInterval(() => { if (t.current) t.current.textContent = ((performance.now() - ISL.t0) / 1000).toFixed(1) + 's'; }, 100); return () => clearInterval(id); }
  });
  const icon = { gen: <Spinner size="sm" label="Generating" />, copied: <RawGlyph name="check" className="ok" />, saved: <RawGlyph name="check" className="ok" />, online: <RawGlyph name="wifi" className="ok" />, offline: <RawGlyph name="wifiOff" className="warn" />, error: <RawGlyph name="alert" className="crit" />, info: <RawGlyph name="info" /> }[ISL.kind];
  return (
    <div className="lu-island" aria-hidden="true">
      <div className="is-bg" ref={bg} />
      <div className="is-c" ref={c}>{ISL.kind && <span className="is-in" key={ISL.kind + ISL.text}>{icon}<span>{ISL.text}</span>{ISL.kind === 'gen' && <span className="is-t tnum" ref={t}>0.0s</span>}</span>}</div>
      <span className="sr-only" role="status">{ISL.text}</span>
    </div>
  );
}

/* ---------- Voice mode: full-screen audio-reactive WebGL orb ---------- */
const ORB_FS = `precision highp float;
uniform vec2 r; uniform float t; uniform float lv; uniform vec3 c1; uniform vec3 c2; uniform float mode;
float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * r) / min(r.x, r.y) * 2.0;
  float a = atan(uv.y, uv.x); float d = length(uv); float sp = 0.35 + mode * 0.6;
  float n1 = noise(vec3(cos(a) * 1.4 + t * 0.25 * sp, sin(a) * 1.4, t * 0.35 * sp));
  float n2 = noise(vec3(cos(a) * 3.1, sin(a) * 3.1 - t * 0.6 * sp, t * 0.8));
  float rad = 0.56 + (n1 - 0.5) * (0.09 + lv * 0.42) + (n2 - 0.5) * (0.03 + lv * 0.22);
  float inside = smoothstep(rad + 0.008, rad - 0.008, d);
  vec2 q = uv * 1.5;
  float sw = noise(vec3(q * 1.3 + vec2(t * 0.22, -t * 0.17), t * 0.3));
  float sw2 = noise(vec3(q * 2.6 - vec2(t * 0.31), t * 0.5 + 3.0));
  vec3 col = mix(c1, c2, smoothstep(0.25, 0.8, sw)); col = mix(col, vec3(1.0), smoothstep(0.6, 0.98, sw2) * 0.4);
  float k = clamp(d / max(rad, 0.001), 0.0, 1.0); float z = sqrt(max(0.0, 1.0 - k * k));
  vec3 nrm = normalize(vec3(uv / max(rad, 0.001), z));
  float spec = pow(max(0.0, dot(nrm, normalize(vec3(-0.45, 0.6, 0.66)))), 28.0); float fres = pow(1.0 - z, 2.2);
  col = col * (0.5 + 0.5 * z) + spec * 0.7 + fres * mix(c2, vec3(1.0), 0.55) * 0.55;
  float glow = exp(-max(d - rad, 0.0) * 5.5) * (0.22 + lv * 0.55) * (1.0 - inside) * smoothstep(1.0, 0.72, d);
  gl_FragColor = vec4(col * inside + mix(c1, c2, 0.5) * glow, clamp(inside + glow, 0.0, 1.0));
}`;
const SCENE_RGB = { aurora: [[1, 0.55, 0.45], [0.55, 0.42, 1]], ember: [[1, 0.5, 0.25], [1, 0.78, 0.4]], tide: [[0.25, 0.7, 1], [0.35, 0.95, 0.85]], dusk: [[0.45, 0.4, 1], [0.95, 0.5, 0.75]] };
function initOrb(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  try {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }')); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, ORB_FS));
    gl.linkProgram(p); gl.useProgram(p);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {}; ['r', 't', 'lv', 'c1', 'c2', 'mode'].forEach((n) => (u[n] = gl.getUniformLocation(p, n)));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const dpr = Math.min(1.5, devicePixelRatio || 1); const rc = canvas.getBoundingClientRect();
    canvas.width = Math.round(rc.width * dpr); canvas.height = Math.round(rc.height * dpr); gl.viewport(0, 0, canvas.width, canvas.height);
    const [c1, c2] = SCENE_RGB[settings.scene] || SCENE_RGB.aurora;
    return (t, lv, mode) => { gl.uniform2f(u.r, canvas.width, canvas.height); gl.uniform1f(u.t, t); gl.uniform1f(u.lv, lv); gl.uniform1f(u.mode, mode); gl.uniform3fv(u.c1, c1); gl.uniform3fv(u.c2, c2); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  } catch (e) { return null; }
}
export function VoiceMode() {
  appCh.use();
  const open = S.ui.voice;
  return open ? <VoiceScreen /> : null;
}
function VoiceScreen() {
  const cv = useRef(null); const st = useRef({ level: 0, target: 0, mode: 0, state: 'idle', muted: false });
  const [status, setStatus] = useState('Connecting…'); const [cap, setCap] = useState(''); const [muted, setMuted] = useState(false); const [noGL, setNoGL] = useState(false);
  const close = () => { haptic(); S.ui.voice = false; emit(); };
  useEffect(() => {
    const s = st.current; let alive = true; let raf = 0, stream, ac, an, buf, sr;
    const draw = initOrb(cv.current); if (!draw) setNoGL(true);
    const scale = new Spring(0.3, SPR.bouncy, (v) => { if (cv.current) cv.current.style.transform = `scale(${v})`; }); scale.to(1);
    const set = (k, txt) => { s.state = k; setStatus(txt || { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', muted: 'Microphone off', tap: 'Tap the orb and speak' }[k]); };
    const SRC = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micLevel = () => { if (!an) return 0; an.getByteTimeDomainData(buf); let x = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; x += v * v; } return clamp(Math.sqrt(x / buf.length) * 6, 0, 1); };
    const answer = async (text) => {
      set('thinking'); haptic('select'); await sleep(900); if (!alive) return;
      const r = Engine.respond(text, {});
      const spoken = r.md.replace(/^:::.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/\|.*\|/g, '').replace(/[*_`#>]/g, '').replace(/\n+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') || 'Sure — I can help with that.';
      set('speaking'); const words = spoken.split(/\s+/); let wi = 0; setCap('');
      const push = () => { if (wi < words.length) { const w = words[wi++]; setCap((c) => c + w + ' '); s.target = rand(0.5, 1); } };
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(spoken); u.rate = 1.04; let got = false;
        u.onboundary = () => { got = true; push(); };
        const fb = setInterval(() => { if (!got) push(); }, 260);
        await new Promise((res) => { u.onend = res; u.onerror = res; speechSynthesis.cancel(); speechSynthesis.speak(u); setTimeout(res, 15000); });
        clearInterval(fb); while (wi < words.length) push();
      } else for (const _ of words) { if (!alive) return; push(); await sleep(220); }
      s.target = 0; if (!alive) return; await sleep(500); listen();
    };
    const listen = () => {
      if (!alive || s.muted) return; setCap('');
      if (!SRC || s.noSR) return set('tap');
      try {
        const r = new SRC(); r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = false; let fin = '';
        r.onresult = (e) => { let x = ''; for (let i = 0; i < e.results.length; i++) { x += e.results[i][0].transcript; if (e.results[i].isFinal) fin = x; } setCap(x); };
        r.onend = () => { sr = null; if (!alive || s.state !== 'listening') return; if (fin.trim()) answer(fin); else setTimeout(listen, 200); };
        r.onerror = (e) => { if (/not-allowed|service-not-allowed|audio-capture/.test(e.error)) { s.noSR = true; set('tap'); } };
        r.start(); sr = r; set('listening');
      } catch (e) { set('tap'); }
    };
    s.fake = async () => {
      const words = VOICE_FAKE[Math.floor(Math.random() * VOICE_FAKE.length)].split(' ');
      set('listening'); setCap(''); haptic();
      for (const w of words) { if (!alive) return; setCap((c) => c + w + ' '); s.target = rand(0.4, 0.9); await sleep(rand(160, 280)); }
      s.target = 0; answer(words.join(' '));
    };
    s.toggleMute = (m) => { s.muted = m; if (m) { try { sr && sr.abort(); } catch (e) {} set('muted'); } else listen(); };
    (async () => { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); if (!alive) return stream.getTracks().forEach((t) => t.stop()); const C = window.AudioContext || window.webkitAudioContext; ac = new C(); an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); buf = new Uint8Array(512); } catch (e) {} })();
    listen();
    const t0 = performance.now();
    const loop = () => {
      if (!alive) return; const t = (performance.now() - t0) / 1000; let tgt = s.target;
      if (s.state === 'listening' && an && !s.muted) tgt = Math.max(tgt, micLevel());
      if (s.state === 'thinking') tgt = 0.25 + 0.15 * Math.sin(t * 6);
      if (s.state === 'speaking') s.target *= 0.94;
      if (['idle', 'tap', 'muted'].includes(s.state)) tgt = Math.max(tgt, 0.06 + 0.04 * Math.sin(t * 1.6));
      s.level += (tgt - s.level) * (tgt > s.level ? 0.35 : 0.08);
      s.mode += ((s.state === 'thinking' ? 1 : s.state === 'speaking' ? 0.6 : 0) - s.mode) * 0.05;
      if (draw) draw(t, s.level, s.mode); else if (cv.current) cv.current.style.transform = `scale(${1 + s.level * 0.25})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    const key = (e) => { if (e.key === 'Escape') close(); }; addEventListener('keydown', key);
    return () => { alive = false; cancelAnimationFrame(raf); removeEventListener('keydown', key); try { sr && sr.abort(); speechSynthesis.cancel(); } catch (e) {} try { stream && stream.getTracks().forEach((t) => t.stop()); ac && ac.close(); } catch (e) {} };
  }, []);
  return (
    <div className="lu-voice" role="dialog" aria-modal="true" aria-label="Voice chat">
      <Environment brightness="dim" material="solid" className="v-env">
        <div className="v-top"><Text size="label" weight="semibold" tone="secondary">{modelOf(settings.model).name} · Voice</Text><IconButton aria-label="Close voice chat" onClick={close}><RawGlyph name="x" /></IconButton></div>
        <button className="v-orb-wrap" onClick={() => { const s = st.current; if (s.state === 'listening' || s.state === 'tap') s.fake(); }} aria-label="Orb. Tap to speak a sample question.">
          <canvas ref={cv} className={'v-orb' + (noGL ? ' css' : '')} />
        </button>
        <Card level={3} className="v-panel">
          <Text size="caption" tone="secondary" weight="semibold" className="v-status" aria-live="polite">{status}</Text>
          <p className="v-cap" aria-live="polite">{cap}</p>
        </Card>
        <div className="v-ctrls">
          <IconButton aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted} className={'v-btn' + (muted ? ' on' : '')} onClick={() => { const m = !muted; setMuted(m); st.current.toggleMute(m); haptic(); }}><RawGlyph name="mic" /></IconButton>
          <IconButton variant="loud" aria-label="End voice chat" className="v-btn end" onClick={close}><RawGlyph name="x" /></IconButton>
        </div>
      </Environment>
    </div>
  );
}
