/* NDU site — main interactive logic. */

const PALETTE = {
  bg:      "#080c14",
  panel:   "#0d1525",
  card:    "#131e30",
  cardHi:  "#1a2740",
  orange:  "#FF6B35",
  navy:    "#1A3A6E",
  text:    "#E8EAF0",
  subtext: "#7A8FAA",
  grid:    "#192840",
  border:  "#253550",
};
const SIZE_GRADIENT = ["#FF6B35", "#FF9560", "#D4A870", "#7A9EC8", "#1A3A6E"];

let DATA = null;

const STATE = {
  eah_pair:   null,
  eah_metric: "E_form",
  eah_sizes:  null,   // Set of selected sizes
  fes_track:  "gas",
  fes_pair:   null,
  md_filter:  "all",
};

// ─── boot ────────────────────────────────────────────────────────────────
fetch("data.json")
  .then(r => r.json())
  .then(d => { DATA = d; main(); })
  .catch(err => {
    document.querySelector("#hero-stats").innerHTML =
      `<div class="stat" style="grid-column:1/-1"><div class="v">⚠</div><div class="k">data.json failed to load — run python build_data.py</div></div>`;
    console.error(err);
  });

function main() {
  STATE.eah_pair  = DATA.meta.pairs[0];
  STATE.fes_pair  = DATA.meta.pairs[0];
  STATE.eah_sizes = new Set(DATA.meta.sizes);

  initMeta();
  initHeroStats();
  initPairGrid();
  initEah();
  initFes();
  initMd();
  initNav();
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
  // Pair name like "PtPd" → [Pt, Pd]. Two capital-letter chunks.
  const m = pair.match(/[A-Z][a-z]?/g);
  return m && m.length >= 2 ? [m[0], m[1]] : [pair, ""];
}
function sizeColor(idx, total) {
  if (total <= 1) return SIZE_GRADIENT[0];
  const t = idx / (total - 1);
  return interpStops(SIZE_GRADIENT, t);
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
  return Object.assign({
    paper_bgcolor: PALETTE.panel,
    plot_bgcolor:  PALETTE.panel,
    font: { color: PALETTE.text, family: "Inter, sans-serif", size: 12.5 },
    margin: { l: 70, r: 30, t: 30, b: 70 },
    xaxis: {
      gridcolor: PALETTE.grid, zerolinecolor: PALETTE.border,
      linecolor: PALETTE.border, tickcolor: PALETTE.border,
      title: { font: { size: 13, color: PALETTE.text } },
    },
    yaxis: {
      gridcolor: PALETTE.grid, zerolinecolor: PALETTE.border,
      linecolor: PALETTE.border, tickcolor: PALETTE.border,
      title: { font: { size: 13, color: PALETTE.text } },
    },
    legend: { font: { color: PALETTE.text, size: 11 }, bgcolor: "rgba(19,30,48,0.8)", bordercolor: PALETTE.border, borderwidth: 1 },
    hoverlabel: { bgcolor: PALETTE.cardHi, bordercolor: PALETTE.orange, font: { color: PALETTE.text, family: "JetBrains Mono, monospace", size: 12 } },
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
  document.querySelector("#hero-stats").innerHTML =
    stats.map(s => `<div class="stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`).join("");
}

function initPairGrid() {
  const grid = document.querySelector("#pair-grid");
  grid.innerHTML = "";
  DATA.meta.pairs.forEach(p => {
    const [a, b] = pairElems(p);
    const sizes = Object.keys(DATA.eoh[p].sizes).length;
    const cell = document.createElement("div");
    cell.className = "pair-tile";
    cell.innerHTML = `<div class="nm">${a}–${b}</div><div class="sub">${sizes} sizes · 14 comp</div>`;
    cell.addEventListener("click", () => {
      STATE.eah_pair = p;
      document.querySelector("#eah-pair").value = p;
      renderEah();
      document.querySelector("#eah").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    grid.appendChild(cell);
  });
}

// ─── 1. EAH (main feature) ────────────────────────────────────────────────
function initEah() {
  const sel = document.querySelector("#eah-pair");
  sel.innerHTML = DATA.meta.pairs.map(p => {
    const [a, b] = pairElems(p);
    return `<option value="${p}">${a}–${b}</option>`;
  }).join("");
  sel.value = STATE.eah_pair;
  sel.addEventListener("change", () => { STATE.eah_pair = sel.value; renderEah(); });

  // metric segment
  document.querySelectorAll("#eah-metric-seg button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#eah-metric-seg button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      STATE.eah_metric = b.dataset.v;
      renderEah();
    });
  });

  // size segment — multi-select toggles
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

// ── compute lower convex hull of (x, y) points; returns indices on hull, sorted by x
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

// linear interpolation on hull at given x
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

    let xs, ys, errs, hovers, ylabel;
    if (metric === "E_form") {
      xs = pts.map(p => p.x);
      ys = pts.map(p => p.y);
      errs = sd.comps.map(c => c.err);
      hovers = sd.comps.map(c =>
        `<b>${c.comp}</b><br>x=${c.x.toFixed(3)}  n₁=${c.n1}<br>` +
        `E<sub>form</sub> = ${fmtSign(c.E_form, 4)} eV/atom<br>` +
        `E<sub>mix</sub> = ${fmtSign(c.E_mix, 4)} eV/atom<br>` +
        `±${c.err.toFixed(4)}`);
      ylabel = "E<sub>form</sub> (eV/atom)";
    } else if (metric === "E_mix") {
      xs = pts.map(p => p.x);
      ys = sd.comps.map(c => c.E_mix);
      errs = sd.comps.map(c => c.err);
      hovers = sd.comps.map(c =>
        `<b>${c.comp}</b><br>x=${c.x.toFixed(3)}<br>` +
        `E<sub>mix</sub> = ${fmtSign(c.E_mix, 4)} eV/atom<br>` +
        `(E<sub>form</sub> = ${fmtSign(c.E_form, 4)})`);
      ylabel = "E<sub>mix</sub> (eV/atom)";
    } else { // EAH
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
      ylabel = "E<sub>above hull</sub> (eV/atom)";
    }

    // hull dashed line — only for E_form (otherwise it's flat or zero)
    if (metric === "E_form") {
      traces.push({
        type: "scatter", mode: "lines", name: `${sz} hull`,
        x: hullPts.map(p => p.x),
        y: hullPts.map(p => p.y),
        line: { color: color, width: 1.5, dash: "dash" },
        showlegend: false, hoverinfo: "skip",
      });
    }
    if (metric === "E_mix") {
      // baseline 0 reference per size only once
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

  // y-zero line for E_mix and EAH
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

  // side panel — best E_mix per size + bulk refs
  const bestList = document.querySelector("#eah-best-list");
  let html = "";
  DATA.meta.sizes.forEach(sz => {
    const sd = block.sizes[sz];
    if (!sd) return;
    let best = null;
    sd.comps.forEach(c => {
      if (best == null || c.E_mix < best.E_mix) best = c;
    });
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

// ─── 2. FES Gallery ───────────────────────────────────────────────────────
function initFes() {
  document.querySelectorAll("#fes-track-seg button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#fes-track-seg button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      STATE.fes_track = b.dataset.v;
      renderFes();
    });
  });

  const seg = document.querySelector("#fes-pair-seg");
  makeSeg(seg, [{ value: "all", label: "all" }, ...DATA.meta.pairs.map(p => {
    const [a, b] = pairElems(p);
    return { value: p, label: `${a}${b}` };
  })], "all", v => { STATE.fes_pair = v; renderFes(); });

  STATE.fes_pair = "all";
  renderFes();
}

function renderFes() {
  const grid = document.querySelector("#fes-grid");
  const track = STATE.fes_track;
  const pairFilter = STATE.fes_pair;
  const pairs = DATA.fes[track] || {};

  let cells = [];
  Object.keys(pairs).forEach(pair => {
    if (pairFilter !== "all" && pair !== pairFilter) return;
    const sizes = pairs[pair];
    Object.keys(sizes).sort((a, b) => +a - +b).forEach(sz => {
      const entry = sizes[sz];
      cells.push({ pair, size: +sz, ...entry });
    });
  });

  if (cells.length === 0) {
    grid.innerHTML = `<div class="gal-cell"><div class="thumb empty">No FES data for this filter.</div></div>`;
    return;
  }

  grid.innerHTML = cells.map(c => {
    const [a, b] = pairElems(c.pair);
    // pick a representative thumb (extracted preferred)
    const thumb = c.files.find(f => f.includes("extracted")) || c.files.find(f => f.includes("3d")) || c.files[0];
    const thumbPath = `${c.dir}/${thumb}`;
    const compTxt = c.comp ? `<span class="sub">${c.comp}</span>` : `<span class="sub">1:1</span>`;
    return `<div class="gal-cell" data-pair="${c.pair}" data-size="${c.size}" data-track="${track}" data-comp="${c.comp || ''}" data-dir="${c.dir}" data-files="${c.files.join('|')}">
      <div class="thumb"><img src="${thumbPath}" alt="${c.pair} ${c.size}" loading="lazy"></div>
      <div class="meta">
        <span class="nm">${a}–${b} · n=${c.size}</span>
        ${compTxt}
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".gal-cell").forEach(el => {
    el.addEventListener("click", () => openLightbox({
      pair: el.dataset.pair,
      size: el.dataset.size,
      track: el.dataset.track,
      comp: el.dataset.comp,
      dir: el.dataset.dir,
      files: el.dataset.files.split("|"),
    }));
  });
}

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
    "fes_extracted.png",
    "fes_q4q6.png", "fes_2d_q4q6.png",
    "fes_q4co.png", "fes_2d_q4co.png",
    "fes_q6co.png", "fes_2d_q6co.png",
    "fes_3d_fes.png", "fes_3d_energy.png",
    "fes_3d_scatter.png", "fes_3d_time.png",
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

// ─── 3. MD Gallery ────────────────────────────────────────────────────────
function initMd() {
  // build filter buttons from observed support tags
  const tags = ["all", ...new Set(DATA.gifs.map(g => g.support).filter(Boolean))];
  const fbox = document.querySelector("#md-filters");
  fbox.innerHTML = tags.map(t =>
    `<button data-v="${t}"${t === "all" ? ' class="on"' : ""}>${t === "Al2O3" ? "Al₂O₃" : t}</button>`
  ).join("");
  fbox.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      fbox.querySelectorAll("button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      STATE.md_filter = b.dataset.v;
      renderMd();
    });
  });
  renderMd();
}

function renderMd() {
  const grid = document.querySelector("#md-grid");
  const filt = STATE.md_filter;
  const items = DATA.gifs.filter(g => filt === "all" || g.support === filt);
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

// ─── 4. Sticky nav active state ───────────────────────────────────────────
function initNav() {
  const links = document.querySelectorAll(".nav a");
  const sections = [...links].map(a => document.querySelector(a.getAttribute("href")));
  function update() {
    let active = 0;
    const y = window.scrollY + 140;
    sections.forEach((s, i) => { if (s && s.offsetTop <= y) active = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === active));
  }
  window.addEventListener("scroll", update, { passive: true });
  update();
  links.forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    document.querySelector(a.getAttribute("href")).scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}
