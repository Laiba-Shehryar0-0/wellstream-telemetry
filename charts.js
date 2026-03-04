// ============================================================
//  charts.js  —  Chart Rendering Helpers
//  All Chart.js logic lives here, keeping ui.js clean
// ============================================================

// ── SHARED CHART OPTIONS ──────────────────────────────────────
function baseOpts(unit) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2030',
        borderColor: '#1f2a3c',
        borderWidth: 1,
        titleColor: '#e8edf5',
        bodyColor: '#6b7b8d',
        titleFont: { family: 'Space Mono', size: 11 },
        callbacks: {
          label: ctx => `  ${ctx.parsed.y.toFixed(1)} ${unit}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#6b7b8d', font: { family: 'Space Mono', size: 9 }, maxRotation: 45, maxTicksLimit: 12 },
        grid: { color: 'rgba(31,42,60,0.5)' }
      },
      y: {
        ticks: { color: '#6b7b8d', font: { family: 'Space Mono', size: 10 } },
        grid: { color: 'rgba(31,42,60,0.5)' }
      }
    }
  };
}

function lineOpts(unit, color) {
  return {
    ...baseOpts(unit),
    elements: {
      point: { radius: 0, hoverRadius: 4 },
      line: { tension: 0.3 }
    }
  };
}

// Colour scale: blue → orange based on value vs max
function pressureColor(val, max) {
  const t = Math.min(1, val / max);
  const r = Math.round(77  + (255 - 77)  * t);
  const g = Math.round(159 - (159 - 107) * t);
  const b = Math.round(255 - (255 - 53)  * t);
  return `rgba(${r},${g},${b},0.82)`;
}

// ── OVERVIEW CHARTS ───────────────────────────────────────────

function drawWHPressBar(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const active = data.filter(w => w.metrics.wh_press_mean > 0);
  const maxP   = Math.max(...active.map(w => w.metrics.wh_press_mean));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: active.map(w => w.short),
      datasets: [{
        label: 'Mean WH Pressure',
        data: active.map(w => w.metrics.wh_press_mean),
        backgroundColor: active.map(w => pressureColor(w.metrics.wh_press_mean, maxP)),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: baseOpts('psig')
  });
}

function drawTempBar(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const active = data.filter(w => w.metrics.wh_temp_mean > 0);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: active.map(w => w.short),
      datasets: [{
        label: 'Mean WH Temp',
        data: active.map(w => w.metrics.wh_temp_mean),
        backgroundColor: active.map(w =>
          `rgba(255,${Math.round(100 + w.metrics.wh_temp_mean / 2)},53,0.75)`
        ),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: baseOpts('°F')
  });
}

function drawPressureComparison(canvasId, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const active = data.filter(w => w.metrics.wh_press_mean > 0 || w.metrics.flow_press_mean > 0);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: active.map(w => w.short),
      datasets: [
        { label: 'WH Pressure',   data: active.map(w => w.metrics.wh_press_mean),   backgroundColor: 'rgba(77,159,255,0.7)',  borderRadius: 3 },
        { label: 'Flow Pressure',  data: active.map(w => w.metrics.flow_press_mean),  backgroundColor: 'rgba(0,212,170,0.7)',   borderRadius: 3 },
        { label: 'Sep Pressure',   data: active.map(w => w.metrics.sep_press_mean),   backgroundColor: 'rgba(255,107,53,0.7)',  borderRadius: 3 }
      ]
    },
    options: {
      ...baseOpts('psig'),
      plugins: {
        ...baseOpts('psig').plugins,
        legend: {
          display: true,
          labels: { color: '#6b7b8d', font: { family: 'Space Mono', size: 10 } }
        }
      }
    }
  });
}

// ── WELL DETAIL CHARTS ────────────────────────────────────────

function drawPressureTrend(canvasId, ts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = Array.from({ length: ts.n }, (_, i) => `#${i + 1}`);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'WH Pressure',   data: ts.wh_press,   borderColor: '#4d9fff', backgroundColor: 'rgba(77,159,255,0.07)',  fill: true, borderWidth: 1.5 },
        { label: 'Flow Pressure',  data: ts.flow_press,  borderColor: '#00d4aa', backgroundColor: 'rgba(0,212,170,0.05)',   fill: true, borderWidth: 1.5 }
      ]
    },
    options: {
      ...lineOpts('psig'),
      elements: { point: { radius: 0 }, line: { tension: 0.3 } },
      plugins: {
        ...lineOpts('psig').plugins,
        legend: {
          display: true,
          labels: { color: '#6b7b8d', font: { family: 'Space Mono', size: 10 } }
        }
      }
    }
  });
}

function drawTempTrend(canvasId, ts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = Array.from({ length: ts.n }, (_, i) => `#${i + 1}`);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: ts.wh_temp,
        borderColor: '#ff6b35',
        backgroundColor: 'rgba(255,107,53,0.07)',
        fill: true, borderWidth: 1.5
      }]
    },
    options: { ...lineOpts('°F'), elements: { point: { radius: 0 }, line: { tension: 0.3 } } }
  });
}

function drawHistogram(canvasId, values, bins = 12) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const clean = values.filter(v => v > 0);
  if (!clean.length) return;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const width = (max - min) / bins;
  const counts = Array(bins).fill(0);
  clean.forEach(v => { const bi = Math.min(bins - 1, Math.floor((v - min) / width)); counts[bi]++; });
  const binLabels = counts.map((_, i) => Math.round(min + i * width));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: binLabels.map(l => l.toFixed(0)),
      datasets: [{ data: counts, backgroundColor: 'rgba(77,159,255,0.6)', borderRadius: 3, borderSkipped: false }]
    },
    options: {
      ...baseOpts('readings'),
      plugins: { ...baseOpts('readings').plugins, legend: { display: false } }
    }
  });
}

function drawSepPressure(canvasId, ts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = Array.from({ length: ts.n }, (_, i) => `#${i + 1}`);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: ts.sep_press,
        borderColor: '#ffb830',
        backgroundColor: 'rgba(255,184,48,0.07)',
        fill: true, borderWidth: 1.5
      }]
    },
    options: { ...lineOpts('psig'), elements: { point: { radius: 0 }, line: { tension: 0.3 } } }
  });
}

function drawChoke(canvasId, ts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = Array.from({ length: ts.n }, (_, i) => `#${i + 1}`);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: ts.choke,
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(167,139,250,0.07)',
        fill: true, borderWidth: 1.5, stepped: 'before'
      }]
    },
    options: { ...lineOpts('in/64'), elements: { point: { radius: 0 } } }
  });
}
