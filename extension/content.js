// LinkedIn Recruiter Roaster — content script.
// Reads the visible profile from the page DOM, sends it to the local backend
// (which holds the Anthropic key), and scrawls a recruiter's red-pen markup over
// the page: handwritten burns, arrows pointing at each spot, circled headings,
// scratch-outs, and scattered ?! doodles — plus a sticky "recruiter's notes" card.
//
// Markers live on a FIXED viewport layer and are re-positioned from each target's
// live getBoundingClientRect() on every scroll/resize, so they track the page.
(function () {
  'use strict';

  const API_BASE = 'http://localhost:8787';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CALLOUT_W = 230;
  const STAGGER = 300; // ms between each section's markup animating in

  const SECTIONS = {
    about: { ids: ['about'], headings: ['about'] },
    experience: { ids: ['experience'], headings: ['experience'] },
    skills: { ids: ['skills'], headings: ['skills'] },
    education: { ids: ['education'], headings: ['education'] },
    recommendations: { ids: ['recommendations'], headings: ['recommendations'] },
  };
  const EXTRA = {
    featured: { ids: ['featured'], headings: ['featured'] },
    licenses: { ids: ['licenses_and_certifications'], headings: ['licenses'] },
    activity: { ids: ['content_collections', 'activity'], headings: ['activity'] },
  };
  const ORDER = ['headline', 'about', 'experience', 'skills', 'education', 'recommendations'];
  const DOODLES = ['?!', '!?', '??', '!!'];

  let noteEl = null;
  let annotations = []; // [{ head, section, callout, doodle, e1, e2, shaft, ah1, ah2, scribble, seed, delays }]
  let rafId = null;

  // ---- helpers --------------------------------------------------------------
  const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const wordCount = (t) => (t ? t.split(/\s+/).filter(Boolean).length : 0);
  // deterministic pseudo-random in [-0.5, 0.5] — stable across re-position frames
  const srand = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x) - 0.5;
  };

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );

  function clean(text) {
    const lines = String(text || '')
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const out = [];
    for (const l of lines) if (l !== out[out.length - 1]) out.push(l);
    return out.join('\n').trim();
  }

  function getMain() {
    return (
      document.querySelector('main') ||
      document.querySelector('.scaffold-layout__main') ||
      document.body
    );
  }

  function sectionByHeading(headings) {
    const secs = Array.from(getMain().querySelectorAll('section'));
    for (const sec of secs) {
      const t = (sec.querySelector('h2')?.innerText || '').trim().toLowerCase();
      if (t && headings.some((n) => t.startsWith(n))) return sec;
    }
    return null;
  }

  function resolveSection({ ids, headings }) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el.closest('section') || el;
    }
    return sectionByHeading(headings);
  }

  function getTopCard() {
    const h1 = getMain().querySelector('h1');
    if (h1) return h1.closest('section') || h1.closest('.artdeco-card') || h1.parentElement;
    return getMain().querySelector('section');
  }

  // ---- extraction -----------------------------------------------------------
  function extractProfile() {
    const nodes = {};
    const parts = [];

    const name = clean(getMain().querySelector('h1')?.innerText || '');
    if (name) parts.push(`Name: ${name}`);

    const topCard = getTopCard();
    if (topCard) {
      nodes.headline = topCard;
      const hb =
        topCard.querySelector('.text-body-medium') ||
        topCard.querySelector('h1')?.nextElementSibling;
      const headline = clean(hb?.innerText || '');
      if (headline) parts.push(`Headline: ${headline}`);
    }

    for (const [key, def] of Object.entries(SECTIONS)) {
      const node = resolveSection(def);
      if (node) {
        nodes[key] = node;
        parts.push(`\n${titleCase(key)}:\n${clean(node.innerText)}`);
      }
    }

    for (const def of Object.values(EXTRA)) {
      const node = resolveSection(def);
      if (node) parts.push(`\n${clean(node.innerText)}`);
    }

    let profileText = parts.join('\n').trim();
    if (wordCount(profileText) < 60) {
      const mainText = clean(getMain().innerText || '');
      if (wordCount(mainText) > wordCount(profileText)) profileText = mainText;
    }

    return { profileText, nodes };
  }

  // ---- svg / layer ----------------------------------------------------------
  function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    return el;
  }

  function ensureLayer() {
    let layer = document.getElementById('ats-roast-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'ats-roast-layer';
      layer.appendChild(svgEl('svg', { class: 'ats-roast-svg' }));
      document.body.appendChild(layer);
    }
    sizeLayer(layer);
    return { layer, svg: layer.querySelector('svg.ats-roast-svg') };
  }

  function sizeLayer(layer) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    layer.style.width = `${vw}px`;
    layer.style.height = `${vh}px`;
    const svg = layer.querySelector('svg.ats-roast-svg');
    if (svg) {
      svg.setAttribute('width', vw);
      svg.setAttribute('height', vh);
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    }
  }

  function clearLayer() {
    document.getElementById('ats-roast-layer')?.remove();
    annotations = [];
  }

  function clearAnnotations() {
    clearLayer();
    if (noteEl) {
      noteEl.remove();
      noteEl = null;
    }
  }

  // "draw on" a stroke via dash-offset, then clear the dash so later geometry
  // updates (on scroll) always render the full stroke.
  function animateStroke(el, delay, duration) {
    let len = 0;
    try {
      len = el.getTotalLength();
    } catch {
      len = 0;
    }
    if (!len) return;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.style.transition = `stroke-dashoffset ${duration}ms ease ${delay}ms`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.strokeDashoffset = '0';
      }),
    );
    setTimeout(() => {
      el.style.strokeDasharray = 'none';
      el.style.transition = '';
      el.style.strokeDashoffset = '0';
    }, delay + duration + 80);
  }

  // ---- geometry builders (deterministic via srand(seed)) --------------------
  function arrowPaths(x1, y1, x2, y2, seed) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const cx = mx + srand(seed) * 30;
    const cy = my - 10 - Math.abs(x2 - x1) * 0.1;
    const ang = Math.atan2(y2 - cy, x2 - cx);
    const len = 13;
    return {
      shaft: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
      h1: `M ${x2} ${y2} L ${x2 + len * Math.cos(ang + 2.6)} ${y2 + len * Math.sin(ang + 2.6)}`,
      h2: `M ${x2} ${y2} L ${x2 + len * Math.cos(ang - 2.6)} ${y2 + len * Math.sin(ang - 2.6)}`,
    };
  }

  function scribblePath(x, y, w, h, seed) {
    const rows = Math.max(3, Math.floor(h / 16));
    const rowH = h / rows;
    let d = '';
    let k = 0;
    for (let i = 0; i < rows; i++) {
      const yy = y + (i + 0.5) * rowH;
      d += `${i === 0 ? 'M' : 'L'} ${x} ${yy}`;
      for (let xx = x; xx < x + w; xx += 22) {
        d += ` L ${xx + 11} ${yy - 6 + srand(seed + k++) * 10} L ${xx + 22} ${yy + 6 + srand(seed + k++) * 10}`;
      }
      d += ` L ${x + w} ${yy} L ${x} ${y + (i + 1.5) * rowH} `;
    }
    return d;
  }

  function setHidden(d, hide) {
    const v = hide ? 'none' : '';
    [d.callout, d.doodle, d.e1, d.e2, d.shaft, d.ah1, d.ah2, d.scribble].forEach((el) => {
      if (el) el.style.display = v;
    });
  }

  // recompute one section's markup from its target's CURRENT viewport position
  function repositionDesc(d) {
    if (!d.head || !d.head.isConnected) return setHidden(d, true);
    const r = d.head.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return setHidden(d, true);
    setHidden(d, false);

    const vw = window.innerWidth;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const rx = r.width / 2 + 14;
    const ry = r.height / 2 + 12;

    [d.e1, d.e2].forEach((e, k) => {
      e.setAttribute('cx', cx + srand(d.seed + 1 + k) * 6);
      e.setAttribute('cy', cy + srand(d.seed + 3 + k) * 6);
      e.setAttribute('rx', rx + srand(d.seed + 5 + k) * 6);
      e.setAttribute('ry', ry + srand(d.seed + 7 + k) * 6);
      e.setAttribute('transform', `rotate(${-5 + srand(d.seed + 9 + k) * 8} ${cx} ${cy})`);
    });

    let side = 'right';
    let x = r.right + 34;
    if (x + CALLOUT_W > vw - 14) {
      side = 'left';
      x = r.left - CALLOUT_W - 34;
    }
    x = Math.max(14, Math.min(x, vw - CALLOUT_W - 14));
    const y = Math.max(8, r.top - 6);
    d.callout.style.left = `${x}px`;
    d.callout.style.top = `${y}px`;
    d.doodle.style.left = `${side === 'right' ? Math.min(x + CALLOUT_W - 4, vw - 44) : Math.max(x - 30, 8)}px`;
    d.doodle.style.top = `${y - 22}px`;

    const ax1 = side === 'right' ? x + 8 : x + CALLOUT_W - 8;
    const ay1 = y + 28;
    const ax2 = side === 'right' ? r.right + 10 : r.left - 10;
    const ay2 = r.top + r.height / 2;
    const ap = arrowPaths(ax1, ay1, ax2, ay2, d.seed + 20);
    d.shaft.setAttribute('d', ap.shaft);
    d.ah1.setAttribute('d', ap.h1);
    d.ah2.setAttribute('d', ap.h2);

    if (d.scribble) {
      const sec = d.section?.getBoundingClientRect();
      const sy = r.bottom + 10;
      const sh = sec ? Math.min(120, sec.bottom - sy - 10) : 0;
      if (sec && sh > 18) {
        d.scribble.style.display = '';
        d.scribble.setAttribute('d', scribblePath(sec.left + 14, sy, Math.min(sec.width - 28, 520), sh, d.seed + 50));
      } else {
        d.scribble.style.display = 'none';
      }
    }
  }

  function repositionAll() {
    const layer = document.getElementById('ats-roast-layer');
    if (!layer || !annotations.length) return;
    sizeLayer(layer);
    annotations.forEach(repositionDesc);
  }

  function onReposition() {
    if (!annotations.length || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      repositionAll();
    });
  }

  // ---- build the markup (geometry set by repositionAll) ---------------------
  function renderAnnotations(data, nodes) {
    const { layer, svg } = ensureLayer();
    annotations = [];
    let shown = 0;

    ORDER.forEach((key, idx) => {
      const node = nodes[key];
      const roastText = data.sections?.[key]?.roast;
      if (!node || !roastText) return;
      const head = key === 'headline' ? node.querySelector('h1') || node : node.querySelector('h2') || node;
      if (!head) return;

      const base = shown * STAGGER;
      shown += 1;
      const seed = (idx + 1) * 97.3;

      const e1 = svgEl('ellipse', { class: 'ats-stroke' });
      const e2 = svgEl('ellipse', { class: 'ats-stroke' });
      const shaft = svgEl('path', { class: 'ats-stroke' });
      const ah1 = svgEl('path', { class: 'ats-stroke' });
      const ah2 = svgEl('path', { class: 'ats-stroke' });
      svg.append(e1, e2, shaft, ah1, ah2);
      let scribble = null;
      if (key === 'about' || key === 'experience') {
        scribble = svgEl('path', { class: 'ats-stroke ats-scribble' });
        svg.append(scribble);
      }

      const callout = document.createElement('div');
      callout.className = 'ats-hand-callout';
      callout.style.width = `${CALLOUT_W}px`;
      callout.style.setProperty('--rot', `${-3 + (idx % 3) * 2.5}deg`);
      callout.style.animationDelay = `${base + 340}ms`;
      callout.textContent = String(roastText).toUpperCase();
      layer.appendChild(callout);

      const doodle = document.createElement('div');
      doodle.className = 'ats-hand-doodle';
      doodle.style.setProperty('--rot', `${srand(seed + 3) * 28}deg`);
      doodle.style.animationDelay = `${base + 520}ms`;
      doodle.textContent = DOODLES[idx % DOODLES.length];
      layer.appendChild(doodle);

      annotations.push({
        head,
        section: node,
        callout,
        doodle,
        e1,
        e2,
        shaft,
        ah1,
        ah2,
        scribble,
        seed,
        delays: { circle: base, arrow: base + 200, scribble: base + 120 },
      });
    });

    repositionAll(); // set initial geometry before measuring stroke lengths

    annotations.forEach((d) => {
      animateStroke(d.e1, d.delays.circle, 380);
      animateStroke(d.e2, d.delays.circle + 120, 380);
      animateStroke(d.shaft, d.delays.arrow, 320);
      animateStroke(d.ah1, d.delays.arrow + 280, 140);
      animateStroke(d.ah2, d.delays.arrow + 280, 140);
      if (d.scribble) animateStroke(d.scribble, d.delays.scribble, 520);
    });

    return shown;
  }

  // ---- recruiter's-notes card ----------------------------------------------
  function bandClass(score) {
    if (score < 31) return 'band-bad';
    if (score < 56) return 'band-warn';
    if (score < 75) return 'band-mid';
    return 'band-good';
  }

  function chips(words, cls) {
    if (!words || !words.length) return '<span class="ats-note-empty">—</span>';
    return words.map((w) => `<span class="ats-note-chip ${cls}">${escapeHtml(w)}</span>`).join('');
  }

  function renderNote(data, delay = 0) {
    const score = Math.max(0, Math.min(100, Number(data.score) || 0));
    const band = bandClass(score);
    noteEl = document.createElement('div');
    noteEl.className = 'ats-note';
    noteEl.style.animationDelay = `${delay}ms`;
    noteEl.innerHTML = `
      <div class="ats-note-head">
        <span class="ats-note-title">Recruiter's notes</span>
        <button class="ats-note-close" title="Close">✕</button>
      </div>
      <div class="ats-note-score ${band}">${score}<small>/100</small>
        <span class="ats-note-label ${band}">${escapeHtml(data.score_label || '')}</span>
      </div>
      <p class="ats-note-verdict">${escapeHtml(data.overall_roast || '')}</p>
      <div class="ats-note-block">
        <h4>🚩 Red flags</h4>
        <div class="ats-note-chips">${chips(data.red_flags, 'chip-flag')}</div>
      </div>
      <div class="ats-note-block">
        <h4>🗯️ Buzzwords</h4>
        <div class="ats-note-chips">${chips(data.buzzwords_found, 'chip-buzz')}</div>
      </div>
      <button class="ats-note-clear">Clear markup</button>
    `;
    document.body.appendChild(noteEl);
    noteEl.querySelector('.ats-note-close').addEventListener('click', () => {
      noteEl.remove();
      noteEl = null;
    });
    noteEl.querySelector('.ats-note-clear').addEventListener('click', clearAnnotations);
  }

  // ---- main action ----------------------------------------------------------
  async function roast(btn) {
    clearAnnotations();
    const { profileText, nodes } = extractProfile();

    if (wordCount(profileText) < 40) {
      setButton(btn, 'idle', "Couldn't read this profile");
      setTimeout(() => setButton(btn, 'idle'), 2400);
      return;
    }

    setButton(btn, 'loading');
    try {
      const res = await fetch(`${API_BASE}/api/roast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        const msg = data?.error?.message || 'Roast failed. Is the backend running?';
        setButton(btn, 'idle', msg);
        setTimeout(() => setButton(btn, 'idle'), 3500);
        return;
      }

      const shown = renderAnnotations(data, nodes);
      renderNote(data, shown * STAGGER + 200);
      setButton(btn, 'idle', 'Re-roast 🔥');
    } catch (err) {
      setButton(btn, 'idle', 'Backend unreachable — start the server');
      setTimeout(() => setButton(btn, 'idle'), 3500);
    }
  }

  function setButton(btn, state, labelOverride) {
    btn.disabled = state === 'loading';
    btn.classList.toggle('is-loading', state === 'loading');
    btn.textContent = state === 'loading' ? 'Roasting…' : labelOverride || 'Roast this profile 🔥';
  }

  // ---- trigger button + lifecycle ------------------------------------------
  function injectButton() {
    if (document.getElementById('ats-roast-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'ats-roast-fab';
    btn.className = 'ats-roast-fab';
    btn.textContent = 'Roast this profile 🔥';
    btn.addEventListener('click', () => roast(btn));
    document.body.appendChild(btn);
  }

  // capture:true catches scroll from LinkedIn's inner scroll containers too
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);

  injectButton();
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      clearAnnotations();
      injectButton();
    }
  }, 1500);
})();
