/* NDU site — main interactive logic.
   Multi-page hash routing (Home / Gas / Supported / Methods / Refs).
   Theme-aware: reads CSS custom properties at render time, re-renders plots
   when [data-theme] changes on <html>. */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function getPalette() {
  return {
    bg:      cssVar("--bg")        || "#0a0a1f",
    panel:   cssVar("--panel")     || "#14122e",
    card:    cssVar("--card")      || "#1d1a3f",
    cardHi:  cssVar("--card-hi")   || "#2a2554",
    accent:  cssVar("--accent")    || "#22D3EE",
    accent2: cssVar("--accent2")   || "#8B5CF6",
    text:    cssVar("--text")      || "#E8EAF8",
    subtext: cssVar("--subtext")   || "#8B86B8",
    grid:    cssVar("--grid")      || "#26244a",
    border:  cssVar("--border")    || "#332f5c",
  };
}
function sizeGradient() {
  const dark = document.documentElement.getAttribute("data-theme") !== "bright";
  return dark
    ? ["#22D3EE", "#5BAEEC", "#8B5CF6", "#5B21B6", "#1E1B4B"]
    : ["#0891B2", "#5B7DC0", "#7C3AED", "#5B21B6", "#1E1B4B"];
}
let PALETTE = getPalette();

let DATA = null;

const VALID_PAGES = ["home", "gas", "supported", "methods", "refs"];
const STATE = {
  page:           pageFromHash(),
  eah_pair:       null,
  eah_metric:     "E_form",
  eah_sizes:      null,
  fes_gas_pair:   null,
  fes_sup_track:  "graphene",
  fes_sup_pair:   null,
  md_sup_filter:  "graphene",
};

// ─── boot ────────────────────────────────────────────────────────────────
fetch("data.json")
  .then(r => r.json())
  .then(d => { DATA = d; main(); })
  .catch(err => {
    const stats = document.querySelector("#hero-stats");
    if (stats) stats.innerHTML =
      `<div class="stat" style="grid-column:1/-1"><div class="v">⚠</div><div class="k">data.json failed to load — run python build_data.py</div></div>`;
    console.error(err);
  });

function main() {
  STATE.eah_pair      = DATA.meta.pairs[0];
  STATE.fes_gas_pair  = DATA.meta.pairs[0];
  STATE.fes_sup_pair  = DATA.meta.pairs[0];
  STATE.eah_sizes     = new Set(DATA.meta.sizes);

  initTheme();
  initMeta();
  initHeroStats();
  initEah();
  initFesGas();
  initFesSup();
  initMdGas();
  initMdSup();
  initRouter();
  showPage(STATE.page);
}

// ─── theme toggle ─────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem("ndu-theme");
  if (saved === "bright" || saved === "dark") applyTheme(saved, false);
  const btn = document.querySelector("#theme-toggle");
  if (btn) btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "bright" : "dark", true);
  });
}
function applyTheme(theme, rerender) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("ndu-theme", theme);
  PALETTE = getPalette();
  if (rerender && DATA) {
    renderEah();
    renderFesGas();
    renderFesSup();
    renderMdGas();
    renderMdSup();
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────
function fmt(v, d = 4) {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.001 || a >= 100000)) return v.toExponential(2);
  return v.toFixed(d);
}
function fmtSign(v, d = 4) {
  if (v == null || !isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(d);
}
function pairElems(pair) {
  const m = pair.match(/[A-Z][a-z]?/g);
  return m && m.length >= 2 ? [m[0], m[1]] : [pair, ""];
}
function sizeColor(idx, total) {
  if (total <= 1) return sizeGradient()[0];
  const t = idx / (total - 1);
  return interpStops(sizeGradient(), t);
}
function interpStops(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (stops.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  if (i >= stops.length - 1) return stops[stops.length - 1];
  return mix(stops[i], stops[i + 1], f);
}
function mix(a, b, f) {
  const ah = parseHex(a), bh = parseHex(b);
  return `rgb(${Math.round(ah[0] + (bh[0] - ah[0]) * f)},${Math.round(ah[1] + (bh[1] - ah[1]) * f)},${Math.round(ah[2] + (bh[2] - ah[2]) * f)})`;
}
function parseHex(s) {
  if (s.startsWith("rgb")) return s.match(/\d+/g).slice(0, 3).map(Number);
  s = s.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function plotlyLayout(extra = {}) {
  const p = getPalette();
  return Object.assign({
    paper_bgcolor: p.panel,
    plot_bgcolor:  p.panel,
    font: { color: p.text, family: "Inter, sans-serif", size: 12.5 },
    margin: { l: 70, r: 30, t: 30, b: 70 },
    xaxis: {
      gridcolor: p.grid, zerolinecolor: p.border,
      linecolor: p.border, tickcolor: p.border,
      tickfont: { color: p.text },
      title: { font: { size: 13, color: p.text } },
    },
    yaxis: {
      gridcolor: p.grid, zerolinecolor: p.border,
      linecolor: p.border, tickcolor: p.border,
      tickfont: { color: p.text },
      title: { font: { size: 13, color: p.text } },
    },
    legend: { font: { color: p.text, size: 11 }, bgcolor: p.card, bordercolor: p.border, borderwidth: 1 },
    hoverlabel: { bgcolor: p.cardHi, bordercolor: p.accent, font: { color: p.text, family: "JetBrains Mono, monospace", size: 12 } },
  }, extra);
}
const PLOTLY_CFG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"] };

function makeSeg(container, options, current, onChange) {
  container.innerHTML = "";
  options.forEach(opt => {
    const b = document.createElement("button");
    b.innerHTML = opt.label;
    b.dataset.v = opt.value;
    if (String(opt.value) === String(current)) b.classList.add("on");
    b.addEventListener("click", () => {
      container.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      onChange(opt.value);
    });
    container.appendChild(b);
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  Routing
// ════════════════════════════════════════════════════════════════════════════
function pageFromHash() {
  const h = (location.hash || "#home").replace("#", "").split("/")[0];
  return VALID_PAGES.includes(h) ? h : "home";
}
function initRouter() {
  // Hash-based links (nav + cluster cards on home).
  // They use plain href="#X" so let the browser update the hash; we react to hashchange.
  window.addEventListener("hashchange", () => {
    const p = pageFromHash();
    if (p !== STATE.page) showPage(p);
  });
}
function showPage(name) {
  STATE.page = name;
  document.querySelectorAll(".page").forEach(p =>
    p.classList.toggle("page--active", p.id === `page-${name}`));
  document.querySelectorAll(".nav a").forEach(a =>
    a.classList.toggle("active", a.dataset.page === name));
  // Plotly needs a resize after the container becomes visible
  setTimeout(() => {
    document.querySelectorAll(`#page-${name} .plot`).forEach(el => {
      if (el && el._fullData) Plotly.Plots.resize(el);
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, 0);
}

// ─── 0. metadata + hero ───────────────────────────────────────────────────
function initMeta() {
  const dt = DATA.meta.generated_at?.replace("T", " ").replace(/\+.*$/, "").slice(0, 16) || "—";
  const r = document.querySelector("#meta-right");
  if (r) r.innerHTML = `<b>${DATA.meta.n_pairs}</b> pairs · <b>${DATA.meta.n_systems_gas}</b> gas systems<br>${dt} UTC`;
  const f = document.querySelector("#foot-right");
  if (f) f.textContent = `data.json · ${DATA.meta.generated_at?.slice(0, 10) || ""}`;
}

function initHeroStats() {
  const stats = [
    { v: DATA.meta.n_pairs,        k: "Bimetallic pairs" },
    { v: DATA.meta.sizes.length,   k: "Cluster sizes" },
    { v: DATA.meta.n_systems_gas,  k: "Gas-phase systems" },
    { v: DATA.meta.supports.length + 1, k: "Tracks (gas + 2 supports)" },
  ];
  const el = document.querySelector("#hero-stats");
  if (el) el.innerHTML =
    stats.map(s => `<div class="stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`).join("");
}

// ─── 1. EAH (gas page) ────────────────────────────────────────────────────
function initEah() {
  const sel = document.querySelector("#eah-pair");
  sel.innerHTML = DATA.meta.pairs.map(p => {
    const [a, b] = pairElems(p);
    return `<option value="${p}">${a}–${b}</option>`;
  }).join("");
  sel.value = STATE.eah_pair;
  sel.addEventListener("change", () => { STATE.eah_pair = sel.value; renderEah(); });

  document.querySelectorAll("#eah-metric-seg button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#eah-metric-seg button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      STATE.eah_metric = b.dataset.v;
      renderEah();
    });
  });

  const sizeSeg = document.querySelector("#eah-size-seg");
  sizeSeg.innerHTML = "";
  DATA.meta.sizes.forEach(sz => {
    const b = document.createElement("button");
    b.textContent = sz;
    b.dataset.v = sz;
    b.classList.add("on");
    b.addEventListener("click", () => {
      if (STATE.eah_sizes.has(sz)) {
        if (STATE.eah_sizes.size > 1) { STATE.eah_sizes.delete(sz); b.classList.remove("on"); }
      } else {
        STATE.eah_sizes.add(sz); b.classList.add("on");
      }
      renderEah();
    });
    sizeSeg.appendChild(b);
  });

  renderEah();
}

function lowerHull(points) {
  const idx = points.map((p, i) => i).sort((a, b) => points[a].x - points[b].x);
  const stack = [];
  for (const i of idx) {
    while (stack.length >= 2) {
      const a = points[stack[stack.length - 2]];
      const b = points[stack[stack.length - 1]];
      const c = points[i];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 0) stack.pop(); else break;
    }
    stack.push(i);
  }
  return stack;
}

function hullAt(hullPoints, x) {
  if (hullPoints.length === 0) return null;
  if (x <= hullPoints[0].x) return hullPoints[0].y;
  if (x >= hullPoints[hullPoints.length - 1].x) return hullPoints[hullPoints.length - 1].y;
  for (let i = 0; i < hullPoints.length - 1; i++) {
    const a = hullPoints[i], b = hullPoints[i + 1];
    if (a.x <= x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return null;
}

function renderEah() {
  const pair = STATE.eah_pair;
  const metric = STATE.eah_metric;
  const block = DATA.eoh[pair];
  if (!block) return;
  const [a, b] = pairElems(pair);

  document.querySelector("#eah-pair-name").textContent = `${a}–${b}`;
  document.querySelector("#eah-pair-bulk").textContent =
    `bulk ${a}=${block.bulk[a]?.toFixed(3)} eV/atom · ${b}=${block.bulk[b]?.toFixed(3)}`;

  const traces = [];
  const sizesSel = [...DATA.meta.sizes].filter(sz => STATE.eah_sizes.has(sz));

  sizesSel.forEach((sz, k) => {
    const sd = block.sizes[sz];
    if (!sd) return;
    const color = sizeColor(k, sizesSel.length);
    const pts = sd.comps.map(c => ({ x: c.x, y: c.E_form, raw: c }));
    const hullIdx = lowerHull(pts);
    const hullPts = hullIdx.map(i => pts[i]);

    let xs, ys, errs, hovers;
    if (metric === "E_form") {
      xs = pts.map(p => p.x);
      ys = pts.map(p => p.y);
      errs = sd.comps.map(c => c.err);
      hovers = sd.comps.map(c =>
        `<b>${c.comp}</b><br>x=${c.x.toFixed(3)}  n₁=${c.n1}<br>` +
        `E<sub>form</sub> = ${fmtSign(c.E_form, 4)} eV/atom<br>` +
        `E<sub>mix</sub> = ${fmtSign(c.E_mix, 4)} eV/atom<br>` +
        `±${c.err.toFixed(4)}`);
    } else if (metric === "E_mix") {
      xs = pts.map(p => p.x);
      ys = sd.comps.map(c => c.E_mix);
      errs = sd.comps.map(c => c.err);
      hovers = sd.comps.map(c =>
        `<b>${c.comp}</b><br>x=${c.x.toFixed(3)}<br>` +
        `E<sub>mix</sub> = ${fmtSign(c.E_mix, 4)} eV/atom<br>` +
        `(E<sub>form</sub> = ${fmtSign(c.E_form, 4)})`);
    } else {
      xs = pts.map(p => p.x);
      ys = sd.comps.map(c => {
        const yh = hullAt(hullPts, c.x);
        return yh != null ? Math.max(0, c.E_form - yh) : null;
      });
      errs = sd.comps.map(c => c.err);
      hovers = sd.comps.map((c, i) =>
        `<b>${c.comp}</b><br>x=${c.x.toFixed(3)}<br>` +
        `E<sub>above hull</sub> = ${fmt(ys[i], 4)} eV/atom<br>` +
        `(E<sub>form</sub> = ${fmtSign(c.E_form, 4)})`);
    }

    if (metric !== "EAH") {
      const ptsM = sd.comps.map((c, i) => ({ x: c.x, y: ys[i], raw: c }));
      const hullM = lowerHull(ptsM).map(i => ptsM[i]);
      traces.push({
        type: "scatter", mode: "lines", name: `${sz} hull`,
        x: hullM.map(p => p.x),
        y: hullM.map(p => p.y),
        line: { color: color, width: 1.5, dash: "dash" },
        showlegend: false, hoverinfo: "skip",
      });
    }

    traces.push({
      type: "scatter", mode: "lines+markers", name: `n=${sz}`,
      x: xs, y: ys,
      error_y: { type: "data", array: errs, color: color, thickness: 0.6, visible: true, width: 2 },
      line: { color: color, width: 1.5 },
      marker: { color: color, size: 8, line: { color: PALETTE.border, width: 0.5 } },
      hovertemplate: "%{customdata}<extra></extra>",
      customdata: hovers,
    });
  });

  if (metric !== "E_form") {
    traces.push({
      type: "scatter", mode: "lines",
      x: [0, 1], y: [0, 0],
      line: { color: PALETTE.border, width: 1, dash: "dot" },
      showlegend: false, hoverinfo: "skip",
    });
  }

  let yLabel;
  if (metric === "E_form") yLabel = "E<sub>form</sub> (eV/atom)";
  else if (metric === "E_mix") yLabel = "E<sub>mix</sub> (eV/atom)";
  else yLabel = "E<sub>above hull</sub> (eV/atom)";

  Plotly.react("eah-plot", traces, plotlyLayout({
    height: 600,
    xaxis: {
      title: `composition x<sub>${a}</sub>`,
      range: [-0.04, 1.04], gridcolor: PALETTE.grid, color: PALETTE.text,
    },
    yaxis: {
      title: yLabel, gridcolor: PALETTE.grid, color: PALETTE.text,
    },
    legend: { x: 1.02, y: 1, font: { size: 11 } },
    margin: { l: 80, r: 130, t: 20, b: 60 },
  }), PLOTLY_CFG);

  const bestList = document.querySelector("#eah-best-list");
  let html = "";
  DATA.meta.sizes.forEach(sz => {
    const sd = block.sizes[sz];
    if (!sd) return;
    let best = null;
    sd.comps.forEach(c => { if (best == null || c.E_mix < best.E_mix) best = c; });
    const cls = STATE.eah_sizes.has(sz) ? "best" : "";
    html += `<div class="row">
      <span class="k">size ${sz} <span style="color:var(--subtext);font-size:10.5px">(${best.comp})</span></span>
      <span class="v ${cls}">${fmtSign(best.E_mix, 4)}</span>
    </div>`;
  });
  bestList.innerHTML = html;

  const bulkList = document.querySelector("#eah-bulk-list");
  bulkList.innerHTML = Object.entries(block.bulk).map(([el, e]) =>
    `<div class="row"><span class="k">${el}</span><span class="v">${e.toFixed(4)} eV/atom</span></div>`
  ).join("");
}

// ─── 2a. FES — Gas page ───────────────────────────────────────────────────
function initFesGas() {
  const seg = document.querySelector("#fes-gas-pair-seg");
  if (!seg) return;
  makeSeg(seg, DATA.meta.pairs.map(p => {
    const [a, b] = pairElems(p);
    return { value: p, label: `${a}${b}` };
  }), STATE.fes_gas_pair, v => { STATE.fes_gas_pair = v; renderFesGas(); });
  renderFesGas();
}
function renderFesGas() {
  renderFesInto({
    grid: document.querySelector("#fes-gas-grid"),
    track: "gas",
    pair: STATE.fes_gas_pair,
  });
}

// ─── 2b. FES — Supported page ─────────────────────────────────────────────
function initFesSup() {
  document.querySelectorAll("#fes-sup-track-seg button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#fes-sup-track-seg button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      STATE.fes_sup_track = b.dataset.v;
      renderFesSup();
    });
  });
  const seg = document.querySelector("#fes-sup-pair-seg");
  if (!seg) return;
  makeSeg(seg, DATA.meta.pairs.map(p => {
    const [a, b] = pairElems(p);
    return { value: p, label: `${a}${b}` };
  }), STATE.fes_sup_pair, v => { STATE.fes_sup_pair = v; renderFesSup(); });
  renderFesSup();
}
function renderFesSup() {
  renderFesInto({
    grid: document.querySelector("#fes-sup-grid"),
    track: STATE.fes_sup_track,
    pair: STATE.fes_sup_pair,
  });
}

// shared FES grid renderer
function renderFesInto({ grid, track, pair }) {
  if (!grid) return;
  const pairs = DATA.fes[track] || {};
  const cells = [];
  Object.keys(pairs).forEach(p => {
    if (p !== pair) return;
    const sizes = pairs[p];
    Object.keys(sizes).sort((a, b) => +a - +b).forEach(sz => {
      cells.push({ pair: p, size: +sz, ...sizes[sz] });
    });
  });
  if (cells.length === 0) {
    grid.innerHTML = `<div class="gal-cell"><div class="thumb empty">No FES data for this filter.</div></div>`;
    return;
  }
  grid.innerHTML = cells.map(c => {
    const [a, b] = pairElems(c.pair);
    const thumb =
      c.files.find(f => f === "fes_3d_fes.png" || f === "fes_3d_energy.png") ||
      c.files.find(f => f.includes("3d")) ||
      c.files.find(f => f.includes("extracted")) ||
      c.files[0];
    const compTxt = c.comp ? `<span class="sub">${c.comp}</span>` : `<span class="sub">1:1</span>`;
    return `<div class="gal-cell" data-pair="${c.pair}" data-size="${c.size}" data-track="${track}" data-comp="${c.comp || ''}" data-dir="${c.dir}" data-files="${c.files.join('|')}">
      <div class="thumb"><img src="${c.dir}/${thumb}" alt="${c.pair} ${c.size}" loading="lazy"></div>
      <div class="meta">
        <span class="nm">${a}–${b} · n=${c.size}</span>
        ${compTxt}
      </div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".gal-cell").forEach(el => {
    el.addEventListener("click", () => openLightbox({
      pair: el.dataset.pair, size: el.dataset.size, track: el.dataset.track,
      comp: el.dataset.comp, dir: el.dataset.dir, files: el.dataset.files.split("|"),
    }));
  });
}

// ─── Lightbox (shared) ────────────────────────────────────────────────────
function openLightbox({ pair, size, track, comp, dir, files }) {
  const [a, b] = pairElems(pair);
  document.querySelector("#lb-title").textContent =
    `${a}–${b} · n=${size} · ${track === "Al2O3" ? "Al₂O₃" : track}` + (comp ? ` · ${comp}` : "");
  document.querySelector("#lb-sub").textContent = dir;

  const labels = {
    "fes_q4q6.png":     "Q4 vs Q6 (CV projection)",
    "fes_q4co.png":     "Q4 vs c_n",
    "fes_q6co.png":     "Q6 vs c_n",
    "fes_3d_fes.png":   "3D FES isosurface",
    "fes_3d_scatter.png": "3D scatter (CV trajectory)",
    "fes_extracted.png":  "Extracted low-FES frames",
    "fes_2d_q4q6.png":  "Q4 vs Q6 (CV projection)",
    "fes_2d_q4co.png":  "Q4 vs c_n",
    "fes_2d_q6co.png":  "Q6 vs c_n",
    "fes_3d_energy.png":  "3D energy surface",
    "fes_3d_time.png":    "3D time-evolution",
  };
  const order = [
    "fes_3d_fes.png", "fes_3d_energy.png",
    "fes_3d_scatter.png", "fes_3d_time.png",
    "fes_extracted.png",
    "fes_q4q6.png", "fes_2d_q4q6.png",
    "fes_q4co.png", "fes_2d_q4co.png",
    "fes_q6co.png", "fes_2d_q6co.png",
  ];
  const sortedFiles = files.slice().sort((x, y) => {
    const ix = order.indexOf(x); const iy = order.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });

  document.querySelector("#lb-grid").innerHTML = sortedFiles.map(f =>
    `<div class="item">
      <img src="${dir}/${f}" alt="${f}" loading="lazy">
      <div class="lbl">${labels[f] || f}</div>
    </div>`).join("");

  document.querySelector("#lb").classList.add("open");
}

document.querySelector("#lb-close").addEventListener("click", () => {
  document.querySelector("#lb").classList.remove("open");
});
document.querySelector("#lb").addEventListener("click", e => {
  if (e.target.id === "lb") document.querySelector("#lb").classList.remove("open");
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelector("#lb").classList.remove("open");
});

// ─── 3a. MD — Gas page ────────────────────────────────────────────────────
function initMdGas() { renderMdGas(); }
function renderMdGas() {
  const grid = document.querySelector("#md-gas-grid");
  if (!grid) return;
  const items = DATA.gifs.filter(g => g.support === "gas");
  renderMdGrid(grid, items);
}

// ─── 3b. MD — Supported page ──────────────────────────────────────────────
function initMdSup() {
  const fbox = document.querySelector("#md-sup-filters");
  if (!fbox) return;
  const observed = [...new Set(DATA.gifs.map(g => g.support).filter(t => t && t !== "gas"))];
  const canonical = ["graphene", "Al2O3", "freetop", "sup"];
  const ordered = canonical.filter(t => observed.includes(t))
    .concat(observed.filter(t => !canonical.includes(t)));
  const tags = [...ordered, "all"];
  if (!tags.includes(STATE.md_sup_filter)) STATE.md_sup_filter = tags[0];

  fbox.innerHTML = tags.map(t => {
    const label = t === "Al2O3" ? "Al₂O₃" : t;
    const cls = t === STATE.md_sup_filter ? ' class="on"' : "";
    return `<button data-v="${t}"${cls}>${label}</button>`;
  }).join("");
  fbox.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      fbox.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      STATE.md_sup_filter = b.dataset.v;
      renderMdSup();
    });
  });
  renderMdSup();
}
function renderMdSup() {
  const grid = document.querySelector("#md-sup-grid");
  if (!grid) return;
  const filt = STATE.md_sup_filter;
  const items = DATA.gifs.filter(g => {
    if (g.support === "gas") return false;
    if (filt === "all") return true;
    return g.support === filt;
  });
  renderMdGrid(grid, items);
}

// shared MD card renderer
function renderMdGrid(grid, items) {
  if (!items.length) {
    grid.innerHTML = `<div class="md-card"><div class="info"><span class="nm">No matching trajectories.</span></div></div>`;
    return;
  }
  grid.innerHTML = items.map(g => {
    const pair = g.pair || "?";
    const [a, b] = pairElems(pair);
    const support = g.support || "—";
    const supLabel = support === "Al2O3" ? "Al₂O₃" : support;
    const supCls = (support || "").toLowerCase();
    return `<div class="md-card">
      <img src="assets/gif/${g.file}" alt="${pair} ${g.size}" loading="lazy">
      <div class="info">
        <span class="nm">${a}–${b}<sub>${g.size || ""}</sub></span>
        <span class="badge ${supCls}">${supLabel}</span>
      </div>
    </div>`;
  }).join("");
}
