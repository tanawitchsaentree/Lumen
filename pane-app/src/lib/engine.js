import { uid, rand } from './core.js';
import { settings } from './store.js';
/* =====================================================================
   12. Mock AI engine
   ===================================================================== */
export const MODELS = [
  { id: 'lumen-2', name: 'Lumen 2', d: 'Great for everyday tasks', speed: 0.8, iq: 0.82, ctx: '200K', tag: 'Default', think: 1 },
  { id: 'lumen-2-mini', name: 'Lumen 2 Mini', d: 'Fastest for quick answers', speed: 1, iq: 0.6, ctx: '128K', tag: 'Fast', think: 0.5 },
  { id: 'lumen-deep', name: 'Lumen Deep Think', d: 'Reasons longer on hard problems', speed: 0.38, iq: 1, ctx: '400K', tag: 'Reasoning', think: 2.2 },
];
export const modelOf = (id) => MODELS.find((m) => m.id === id) || MODELS[0];
export const AGENTS = [
  { n: 'Researcher', d: 'Finds and cites sources', h: 210 },
  { n: 'Coder', d: 'Writes and reviews code', h: 150 },
  { n: 'Designer', d: 'Critiques UI and visuals', h: 330 },
  { n: 'Analyst', d: 'Crunches numbers into charts', h: 30 },
];
export const ARTIFACTS = {
  pomodoro: {
    title: 'Focus Timer', lang: 'html',
    code: `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center;
         font-family: -apple-system, system-ui; background: #F3F1EC; }
  .ring { width: 220px; height: 220px; border-radius: 50%; display: grid;
          place-items: center; background: conic-gradient(#FF6B3D var(--p), #e6e1d8 0); }
  .face { width: 190px; height: 190px; border-radius: 50%; background: #fff;
          display: grid; place-items: center; font-size: 44px; font-weight: 200;
          font-variant-numeric: tabular-nums; }
  button { margin-top: 28px; border: 0; padding: 14px 28px; border-radius: 99px;
           background: #C9431A; color: #fff; font: 600 17px system-ui; }
</style>
</head>
<body>
  <div>
    <div class="ring" id="ring" style="--p: 100%">
      <div class="face" id="face">25:00</div>
    </div>
    <center><button id="go">Start focus</button></center>
  </div>
  <script>
    const total = 25 * 60;
    let left = total, timer = null;
    const face = document.getElementById('face');
    const ring = document.getElementById('ring');
    function draw() {
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      face.textContent = m + ':' + s;
      ring.style.setProperty('--p', (left / total) * 100 + '%');
    }
    document.getElementById('go').onclick = (e) => {
      if (timer) { clearInterval(timer); timer = null; e.target.textContent = 'Resume'; return; }
      e.target.textContent = 'Pause';
      timer = setInterval(() => { left = Math.max(0, left - 1); draw(); }, 1000);
    };
  <\/script>
</body>
</html>`,
  },
};

export const R = {
  short: [
    'Hey! 👋 What are we making today? I can plan trips, write code, chart data, or just think out loud with you.',
    'Anytime. Want me to keep going on that, or switch gears?',
    'Got it. I\'m here whenever you need me — try typing **/** to see what I can do.',
  ],
  weather: (city) => [
    `Late November is one of the best times to visit **${city}** — crisp mornings, clear skies, and peak *momiji* season.\n\n:::weather {"city":"${city}"}\n\nA few tips for the week:\n\n- **Layer up.** Mornings dip to ~9°, afternoons reach the low twenties.\n- Temples like **Eikan-dō** and **Tōfuku-ji** peak around Nov 20–30. Arrive at opening to beat the crowds.\n- Sunday looks damp — keep it for museums and a long kaiseki lunch.`,
    `Here's the outlook for **${city}**. Short version: bring a light jacket and sunglasses.\n\n:::weather {"city":"${city}"}\n\nSunday is the only day with real rain risk (~60%). Everything else is golden-hour material.`,
  ],
  map: [
    `Found a lovely spot tucked off the main lane — quiet, and it has a second-floor counter that looks out over the rooftops.\n\n:::map {"name":"Kōyō Coffee Stand","area":"Gion, Higashiyama"}\n\n**Why this one:**\n\n- Opens at 7:30, so you can go before the temple crowds\n- Pour-overs from a local roaster, plus a seasonal *hōjicha* latte\n- Six minutes on foot from Yasaka Shrine\n\n> Tip: grab the window seat on the left — it catches the morning light over the tiled roofs.`,
    `Here's a calm option within walking distance:\n\n:::map {"name":"Kōyō Coffee Stand","area":"Gion, Higashiyama"}\n\nIt's rarely busy before 9. If it's full, the tea house two doors down is a great backup.`,
  ],
  gallery: [
    `Here's a moodboard leaning **warm, low and tactile** — soft morning light, natural fibres and one deep accent colour to anchor the room.\n\n:::gallery {}\n\n**Palette notes**\n\n1. Keep the walls a warm off-white (think *unbleached linen*)\n2. Mix two wood tones at most — oak plus something darker\n3. Let one saturated object (a clay vase, a dusk-blue throw) do the talking\n\nTap any image to see it full screen.`,
  ],
  chart: [
    `Revenue grew **91% year over year**, with a clear acceleration after the July pricing change. Drag across the chart to scrub month by month.\n\n:::chart {}\n\n| Quarter | Revenue | QoQ | Users |\n|---|---|---|---|\n| Q1 | $569k | — | 47k |\n| Q2 | $681k | +19.7% | 58k |\n| Q3 | $793k | +16.4% | 71k |\n| Q4 | $970k | +22.3% | 90k |\n\nThe dip in **June** was seasonal (it lines up with the previous two years). The real story is net revenue retention: expansion revenue now makes up about a third of new bookings.`,
  ],
  poll: [
    `Done — here's a poll you can share with the team. I added a "stay remote" option so nobody feels boxed in.\n\n:::poll {"id":"offsite"}\n\nOnce everyone has voted, I can draft a budget for the winning city.`,
  ],
  table: [
    `Here's a side-by-side for a typical side project. **Short answer:** start with SQLite, move to Postgres when you need concurrent writers.\n\n| | SQLite | Postgres | DynamoDB |\n|---|---|---|---|\n| Setup | Zero — it's a file | A server, or managed | Fully managed |\n| Writes | Single writer | Excellent | Excellent |\n| Queries | Full SQL | Full SQL + JSONB | Key-value, limited |\n| Cost at idle | $0 | ~$7–15/mo | ~$0 |\n| Best for | Prototypes, edge | Most apps | Huge, simple access patterns |\n\n> Rule of thumb: pick the most boring database that solves today's problem. Migrating later is cheaper than you think.\n\nWant a migration checklist from SQLite → Postgres?`,
  ],
  code: [
    `Here's a small, dependency-free hook that debounces a search query and cancels stale requests with \`AbortController\`.\n\n\`\`\`tsx\nimport { useEffect, useState } from 'react';\n\nexport function useDebouncedSearch<T>(query: string, delay = 300) {\n  const [data, setData] = useState<T[]>([]);\n  const [loading, setLoading] = useState(false);\n\n  useEffect(() => {\n    if (!query.trim()) { setData([]); return; }\n    const ctrl = new AbortController();\n    const id = setTimeout(async () => {\n      setLoading(true);\n      try {\n        const res = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, { signal: ctrl.signal });\n        setData(await res.json());\n      } catch (err) {\n        if ((err as Error).name !== 'AbortError') console.error(err);\n      } finally {\n        setLoading(false);\n      }\n    }, delay);\n    return () => { clearTimeout(id); ctrl.abort(); };\n  }, [query, delay]);\n\n  return { data, loading };\n}\n\`\`\`\n\n**Why it works**\n\n- The cleanup function runs on every keystroke, so only the *last* timeout survives\n- Aborting the fetch means a slow, older response can never overwrite a newer one\n- \`delay\` is a dependency, so you can tune it live\n\nUsage is one line: \`const { data, loading } = useDebouncedSearch(q)\`.`,
    `Sure — here's the same idea in plain JavaScript, no framework:\n\n\`\`\`js\nexport function debounce(fn, ms = 300) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}\n\n// usage\nconst search = debounce((q) => console.log('searching', q), 250);\ninput.addEventListener('input', (e) => search(e.target.value));\n\`\`\`\n\nIt's 8 lines, and that's all most search boxes need.`,
  ],
  tools: [
    `:::tools {"steps":[["Searching flights SFO → HND","14 results across 6 airlines"],["Checking fare history","Last 90 days of prices"],["Comparing travel times","Nonstop vs. one stop"],["Drafting recommendation","Ranking by price × comfort"]],"secs":4.6}\n\n## Best time to book\n\nFares on this route bottom out **6–8 weeks** before departure and climb sharply inside 21 days.\n\n| Option | Price | Duration | Stops |\n|---|---|---|---|\n| **Nonstop, Tue** | $812 | 11h 05m | 0 |\n| One stop via SEA | $694 | 14h 40m | 1 |\n| Nonstop, Sat | $1,034 | 11h 05m | 0 |\n\n**My pick:** the Tuesday nonstop. You save more than 3 hours for about $120 more, and you land in the afternoon, so jet lag is easier.\n\nWant me to set a price alert for under $750?`,
  ],
  essay: [
    `## Why glass works in interfaces\n\nTranslucent materials solve a problem every interface has: **how do you put something on top of something else without losing your place?**\n\nA solid panel cuts you off from the content below it. A translucent one keeps the context visible but blurred, so your eye reads it as *behind*. That's depth you get for free, with no extra shadows or borders.\n\n### Three things good glass does\n\n1. **It shows what's behind it.** Blur and saturation tint the material with the colours underneath, so it always looks like it belongs.\n2. **It catches the light.** A thin, bright edge on the side facing the "light" tells your brain this is a physical sheet, not a flat sticker.\n3. **It moves like it has mass.** Springs, not linear tweens. When you let go of a glass sheet, it should keep going a little, the way real objects do.\n\n> The best material is one you don't notice — you just feel oriented.\n\n### Where it goes wrong\n\n- Too much blur over busy content hurts legibility\n- Stacking three or more translucent layers turns into mud\n- Glass on glass with *no* tint gives you low contrast and fails accessibility\n\n---\n\nThe trick is restraint: use glass for **chrome** (navigation, toolbars, sheets) and keep **content** solid and crisp.`,
  ],
  artifact: [
    `I built a small focus timer you can run right here. It uses a \`conic-gradient\` ring that empties as time passes, with tabular numerals so the digits never jitter.\n\n:::artifact {"id":"pomodoro"}\n\nOpen it to switch between **Preview** and **Code**. Ideas for next steps:\n\n- Add a 5-minute break cycle\n- Play a soft chime at zero\n- Remember the last session in \`localStorage\``,
  ],
  error: [`:::error {"title":"Response interrupted","msg":"The model is temporarily overloaded. Nothing was lost — try again."}`],
  image: [
    `Nice shot! Here's what I'm picking up:\n\n- **Lighting:** soft and directional — looks like late afternoon\n- **Composition:** the subject sits on the left third, which gives it room to breathe\n- **Palette:** warm neutrals with one cool accent\n\nWant me to suggest edits, write a caption, or find similar images?`,
  ],
  fallback: (p) => [
    `Good question. Here's how I'd approach **“${p}”**:\n\n1. **Define what success looks like.** One sentence, measurable if possible.\n2. **Find the smallest version** you could finish this week.\n3. **Ship it, then listen.** The second version is always better informed than the first.\n\nIf you tell me a bit more about your constraints (time, budget, who it's for), I can turn this into a concrete plan.`,
    `Let's break **“${p}”** down:\n\n- **What we know:** the goal and the rough shape of it\n- **What we don't:** the constraints that will decide the trade-offs\n- **What to do next:** pick one assumption and test it quickly\n\nWant me to go deeper on any of these?`,
  ],
};
export const THINK = {
  weather: 'Looking up seasonal climate norms for the city…\nLate November: high ~19–21°C, lows ~8–10°C.\nCross-checking autumn foliage reports — peak tends to be the last 10 days of the month.\nShould mention layering, and keep the rainy day for indoor plans.',
  map: 'User wants quiet + a view, near Gion.\nFilter: opens early, small, upper floor or window seating.\nRank by walking distance from Yasaka Shrine.',
  code: 'Debounce in a hook: use setTimeout inside useEffect, clear it in cleanup.\nAlso race conditions: abort the previous fetch.\nKeep generics so callers get typed results.',
  chart: 'Sum monthly figures per quarter.\nQoQ growth = (Q_n − Q_{n−1}) / Q_{n−1}.\nJune dip — compare against prior years for seasonality.',
  tools: 'Plan: search fares, look at 90-day history, compare durations, recommend.\nWeight comfort (nonstop) against price.',
  essay: 'Structure: the problem glass solves → what makes it work → common failure modes → takeaway.\nKeep it concrete and short.',
  default: 'Clarify the goal first, then propose a simple, actionable structure.',
};
export const VOICE_FAKE = [
  'What\'s the weather like in Kyoto this week?',
  'Find me a quiet coffee spot near Gion',
  'Explain why glass works in interface design',
  'Make a poll for the team offsite',
];

export const Engine = {
  route(p, atts) {
    const s = p.toLowerCase().trim();
    const cmd = s.match(/^\/(\w+)/);
    if (cmd) {
      const c = cmd[1];
      const alias = { research: 'tools', search: 'tools', image: 'gallery', moodboard: 'gallery', compare: 'table' };
      if (R[alias[c] || c]) return alias[c] || c;
    }
    if (/\b(error|fail|crash|simulate an error)\b/.test(s)) return 'error';
    if (atts && atts.length && s.length < 40) return 'image';
    if (/^(hi|hey|hello|yo|thanks|thank you|ok|okay|cool|nice|great)\b/.test(s) || s.length < 6) return 'short';
    if (/weather|forecast|rain|temperature|climate/.test(s)) return 'weather';
    if (/\b(map|where|near|cafe|café|coffee|restaurant|location|directions|spot)\b/.test(s)) return 'map';
    if (/(photo|image|gallery|inspo|moodboard|picture|nook)/.test(s)) return 'gallery';
    if (/(chart|graph|revenue|growth|metrics|trend|kpi)/.test(s)) return 'chart';
    if (/(poll|vote|survey|offsite)/.test(s)) return 'poll';
    if (/(table|compare|\bvs\.?\b|versus|comparison|pros and cons|database)/.test(s)) return 'table';
    if (/(timer|artifact|prototype|landing page|build an? app|html page|pomodoro)/.test(s)) return 'artifact';
    if (/(code|function|hook|react|javascript|typescript|python|bug|component|css|api|regex|script|debug|refactor|debounce)/.test(s)) return 'code';
    if (/(search|research|find|book|flight|itinerary|tools?)\b/.test(s)) return 'tools';
    if (/(essay|explain|story|why|history|deep dive|write about|glass)/.test(s)) return 'essay';
    return 'default';
  },
  respond(prompt, o = {}) {
    const kind = o.kind || this.route(prompt, o.atts);
    const seed = o.seed || 0;
    const city = (prompt.match(/\b(?:in|for|to)\s+([A-Z][a-zA-Zō]+)/) || [])[1] || 'Kyoto';
    let pool;
    if (kind === 'weather') pool = R.weather(city);
    else if (kind === 'default') pool = R.fallback(prompt.replace(/^\/\w+\s*/, '').slice(0, 80) || 'this');
    else pool = R[kind] || R.fallback(prompt);
    let md = pool[seed % pool.length];
    if (o.forceOk && kind === 'error') md = R.fallback('that')[0];
    const model = modelOf(o.model || settings.model);
    const thinks = !['short', 'error'].includes(kind) && (model.think >= 1 || kind === 'tools' || kind === 'code');
    const think = thinks ? { secs: +(rand(1.2, 2.4) * model.think).toFixed(1), text: THINK[kind] || THINK.default } : null;
    return { kind, md, think };
  },
};

/* Seed data so the app feels lived-in */
export function seedConvos() {
  const now = Date.now(), M = 60e3, H = 60 * M, D = 24 * H;
  const U = (text, t, extra = {}) => ({ id: uid(), role: 'user', t, versions: [{ text, atts: [] }], vi: 0, reactions: [], ...extra });
  const A = (md, t, think = null, extra = {}) => ({ id: uid(), role: 'ai', t, versions: [{ md, think, state: 'done' }], vi: 0, reactions: [], ...extra });
  const kyoto1 = A(R.weather('Kyoto')[0], now - 19.5 * M, { secs: 2.1, text: THINK.weather });
  kyoto1.reactions = ['❤️'];
  const regen = A(R.code[0], now - 3 * H + 40e3, { secs: 1.8, text: THINK.code });
  regen.versions.push({ md: R.code[1], think: { secs: 1.2, text: THINK.code }, state: 'done' });
  regen.vi = 0;
  return [
    {
      id: uid(), title: 'Kyoto in late November', pinned: true, archived: false, updated: now - 14 * M,
      messages: [
        U('Planning 3 days in Kyoto in late November. What will the weather be like?', now - 20 * M),
        kyoto1,
        U('Perfect. Any quiet coffee spot near Gion?', now - 15.5 * M),
        U('Somewhere with a view would be ideal ☕️', now - 15.3 * M),
        A(R.map[0], now - 15 * M, { secs: 1.4, text: THINK.map }),
      ],
    },
    {
      id: uid(), title: 'Debounced search hook', pinned: false, archived: false, updated: now - 3 * H,
      messages: [U('Write me a React hook for debounced search that cancels stale requests', now - 3 * H), regen],
    },
    {
      id: uid(), title: 'Revenue breakdown 2026', pinned: true, archived: false, updated: now - 26 * H,
      messages: [U('Chart our monthly revenue growth and break it down by quarter', now - 26 * H), A(R.chart[0], now - 26 * H + 30e3, { secs: 2.6, text: THINK.chart })],
    },
    {
      id: uid(), title: 'Team offsite — where?', pinned: false, archived: false, updated: now - 4 * D,
      messages: [U('Make a poll for the Q1 team offsite. Lisbon, Kyoto, Mexico City?', now - 4 * D), A(R.poll[0], now - 4 * D + 20e3)],
    },
    {
      id: uid(), title: 'Reading nook moodboard', pinned: false, archived: true, updated: now - 9 * D,
      messages: [U('Show me moodboard images for a calm reading nook', now - 9 * D), A(R.gallery[0], now - 9 * D + 20e3)],
    },
  ];
}
