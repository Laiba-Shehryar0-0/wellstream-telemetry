// ============================================================
//  ui.js  —  DOM Rendering (Overview + Well Detail views)
//  Depends on: rag.js, charts.js, data.js
// ============================================================

let selectedWell = null;
let sortCol = 'wh_press_mean';
let sortAsc  = false;

// ── SIDEBAR ───────────────────────────────────────────────────

function renderWellList(chunks, ragResults = null) {
  const container = document.getElementById('well-list');
  container.innerHTML = '';
  document.getElementById('visible-count').textContent = chunks.length;

  const isRag = ragResults !== null;

  chunks.forEach(chunk => {
    const ragResult = isRag ? ragResults.find(r => r.chunk.id === chunk.id) : null;
    const div = document.createElement('div');
    div.className = 'well-item' +
      (selectedWell === chunk.id ? ' active' : '') +
      (isRag && ragResult ? ' rag-result' : '');
    div.onclick = () => selectWell(chunk.id);

    const pressColor = chunk.metrics.wh_press_mean > 2000 ? '#4d9fff' :
                       chunk.metrics.wh_press_mean > 500  ? '#00d4aa' : '#6b7b8d';

    div.innerHTML = `
      ${isRag && ragResult ? `<span class="rag-score">${ragResult.relevance}% match</span>` : ''}
      <div class="well-name">${chunk.short}</div>
      <div class="well-formation">${chunk.formation || 'Unknown Formation'}</div>
      <div class="well-meta">
        <span class="well-press" style="color:${pressColor}">
          ${chunk.metrics.wh_press_mean.toFixed(0)} psig
        </span>
        ${chunk.metrics.anomaly ? '<span class="anomaly-badge">⚠ ANOM</span>' : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

// ── OVERVIEW ──────────────────────────────────────────────────

function renderOverview() {
  selectedWell = null;
  document.querySelectorAll('.well-item').forEach(el => el.classList.remove('active'));

  const anomalies   = RAG_CHUNKS.filter(c => c.metrics.anomaly);
  const withPress   = RAG_CHUNKS.filter(c => c.metrics.wh_press_mean > 0);
  const withTemp    = RAG_CHUNKS.filter(c => c.metrics.wh_temp_mean  > 0);
  const avgPress    = Math.round(withPress.reduce((s,c) => s + c.metrics.wh_press_mean, 0) / withPress.length);
  const maxPress    = Math.max(...RAG_CHUNKS.map(c => c.metrics.wh_press_max));
  const avgFP       = Math.round(RAG_CHUNKS.filter(c => c.metrics.flow_press_mean > 0)
                        .reduce((s,c) => s + c.metrics.flow_press_mean, 0) /
                        RAG_CHUNKS.filter(c => c.metrics.flow_press_mean > 0).length);
  const avgTemp     = Math.round(withTemp.reduce((s,c) => s + c.metrics.wh_temp_mean, 0) / withTemp.length);

  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="breadcrumb">
      <span>Dashboard</span>
      <span class="sep">›</span>
      <span>Overview — All ${RAG_CHUNKS.length} Wells</span>
    </div>

    ${anomalies.length ? `
    <div class="section-label">⚠ Active Anomaly Flags</div>
    <div class="alerts-row">
      ${anomalies.map(c => `
        <div class="alert-chip" onclick="selectWell('${c.id}')">
          <div class="alert-dot"></div>
          ${c.short} — σ ${c.metrics.wh_press_std} psig
        </div>
      `).join('')}
    </div>` : ''}

    <div class="kpi-row">
      <div class="kpi-card" style="--kpi-color:var(--accent)">
        <div class="kpi-label">Avg WH Pressure</div>
        <div class="kpi-value">${avgPress}</div>
        <div class="kpi-unit">psig · ${withPress.length} wells reporting</div>
        <div class="kpi-sub">Wellhead Pressure</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--accent2)">
        <div class="kpi-label">Peak WH Pressure</div>
        <div class="kpi-value">${maxPress.toFixed(0)}</div>
        <div class="kpi-unit">psig maximum recorded</div>
        <div class="kpi-sub">Across all wells</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--accent3)">
        <div class="kpi-label">Avg Flow Pressure</div>
        <div class="kpi-value">${avgFP}</div>
        <div class="kpi-unit">psig flowing</div>
        <div class="kpi-sub">Flowing Wellhead</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--warn)">
        <div class="kpi-label">Avg WH Temp</div>
        <div class="kpi-value">${avgTemp}</div>
        <div class="kpi-unit">°F · ${withTemp.length} wells reporting</div>
        <div class="kpi-sub">Wellhead Temperature</div>
      </div>
      <div class="kpi-card" style="--kpi-color:${anomalies.length > 0 ? 'var(--danger)' : 'var(--accent)'}">
        <div class="kpi-label">Anomaly Flags</div>
        <div class="kpi-value">${anomalies.length}</div>
        <div class="kpi-unit">of ${RAG_CHUNKS.length} wells</div>
        <div class="kpi-sub">${anomalies.length > 0 ? '<span class="down">High pressure variability</span>' : '<span class="up">All stable</span>'}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">WH Pressure by Well <span class="accent">psig avg</span></div>
        <canvas id="chart-whpress"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">WH Temperature by Well <span class="accent">°F avg</span></div>
        <canvas id="chart-temp"></canvas>
      </div>
      <div class="chart-card wide">
        <div class="chart-title">Pressure Profile Comparison <span class="accent">WH vs Flow vs Sep (psig)</span></div>
        <canvas id="chart-compare" style="max-height:185px"></canvas>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        All Wells Summary
        <span style="color:var(--accent3);font-size:10px">Click column to sort · Click row to drill down</span>
      </div>
      <table>
        <thead>
          <tr>
            <th onclick="sortTable('short')">Well</th>
            <th onclick="sortTable('formation')">Formation</th>
            <th onclick="sortTable('wh_press_mean')">WH Press (avg)</th>
            <th onclick="sortTable('wh_press_max')">WH Press (max)</th>
            <th onclick="sortTable('flow_press_mean')">Flow Press</th>
            <th onclick="sortTable('wh_temp_mean')">WH Temp</th>
            <th onclick="sortTable('sep_press_mean')">Sep Press</th>
            <th onclick="sortTable('whsip_mean')">WHSIP</th>
            <th onclick="sortTable('choke_mean')">Choke</th>
            <th onclick="sortTable('n')">Records</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="summary-table"></tbody>
      </table>
    </div>
  `;

  renderSummaryTable();

  // Render charts (nextTick so canvases are in DOM)
  setTimeout(() => {
    drawWHPressBar('chart-whpress', RAG_CHUNKS);
    drawTempBar('chart-temp', RAG_CHUNKS);
    drawPressureComparison('chart-compare', RAG_CHUNKS);
  }, 0);
}

// ── SORT TABLE ────────────────────────────────────────────────

function sortTable(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  renderSummaryTable();
}

function renderSummaryTable() {
  const tbody = document.getElementById('summary-table');
  if (!tbody) return;

  const colMap = { short:'short', formation:'formation', n:'n',
    wh_press_mean:'wh_press_mean', wh_press_max:'wh_press_max',
    flow_press_mean:'flow_press_mean', wh_temp_mean:'wh_temp_mean',
    sep_press_mean:'sep_press_mean', whsip_mean:'whsip_mean', choke_mean:'choke_mean' };

  const getValue = (chunk, col) => {
    if (col === 'short') return chunk.short.toLowerCase();
    if (col === 'formation') return chunk.formation.toLowerCase();
    if (col === 'n') return chunk.n;
    return chunk.metrics[colMap[col]] ?? 0;
  };

  const sorted = [...RAG_CHUNKS].sort((a, b) => {
    const av = getValue(a, sortCol), bv = getValue(b, sortCol);
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const maxPress = Math.max(...RAG_CHUNKS.map(c => c.metrics.wh_press_mean));

  tbody.innerHTML = sorted.map(c => `
    <tr class="${selectedWell === c.id ? 'tr-active' : ''}" onclick="selectWell('${c.id}')" style="cursor:pointer">
      <td class="td-well">${c.short}</td>
      <td style="color:var(--muted)">${c.formation}</td>
      <td class="td-press">
        <div class="pressure-bar">
          ${c.metrics.wh_press_mean.toFixed(0)}
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, c.metrics.wh_press_mean/maxPress*100)}%"></div></div>
        </div>
      </td>
      <td class="td-press">${c.metrics.wh_press_max > 0 ? c.metrics.wh_press_max.toFixed(0) : '—'}</td>
      <td class="td-flow">${c.metrics.flow_press_mean > 0 ? c.metrics.flow_press_mean.toFixed(0) : '—'}</td>
      <td class="td-temp">${c.metrics.wh_temp_mean > 0 ? c.metrics.wh_temp_mean.toFixed(1) + ' °F' : '—'}</td>
      <td style="color:var(--muted)">${c.metrics.sep_press_mean > 0 ? c.metrics.sep_press_mean.toFixed(0) : '—'}</td>
      <td style="color:var(--accent)">${c.metrics.whsip_mean > 0 ? c.metrics.whsip_mean.toFixed(0) : '—'}</td>
      <td style="color:var(--muted)">${c.metrics.choke_mean > 0 ? c.metrics.choke_mean.toFixed(1) : '—'}</td>
      <td style="color:var(--muted)">${c.n}</td>
      <td>${c.metrics.anomaly
        ? '<span style="color:var(--danger);font-size:10px">⚠ ANOMALY</span>'
        : '<span style="color:var(--accent);font-size:10px">● NORMAL</span>'}</td>
    </tr>
  `).join('');
}

// ── WELL DETAIL VIEW ──────────────────────────────────────────

function selectWell(wellId) {
  selectedWell = wellId;
  document.querySelectorAll('.well-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.well-item').forEach(el => {
    if (el.querySelector('.well-name')?.textContent.trim() ===
        RAG_CHUNKS.find(c => c.id === wellId)?.short) {
      el.classList.add('active');
    }
  });

  const chunk = RAG_CHUNKS.find(c => c.id === wellId);
  if (!chunk) return;
  const m = chunk.metrics;
  const ts = chunk.timeseries;

  const content = document.getElementById('main-content');
  content.innerHTML = `
    <div class="breadcrumb">
      <span class="link" onclick="renderOverview()">Dashboard</span>
      <span class="sep">›</span>
      <span>Well Detail</span>
      <span class="sep">›</span>
      <span style="color:var(--text)">${chunk.short}</span>
    </div>

    <div class="detail-header">
      <div>
        <div class="detail-well-name">${chunk.short}</div>
        <div class="detail-formation">Formation: ${chunk.formation || 'Unknown'}</div>
      </div>
      <div>
        ${m.anomaly
          ? '<div class="badge-anomaly">⚠ Pressure Anomaly Detected</div>'
          : '<div class="badge-normal">● Normal Operations</div>'}
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi-card" style="--kpi-color:var(--accent3)">
        <div class="kpi-label">WH Pressure (avg)</div>
        <div class="kpi-value">${m.wh_press_mean.toFixed(0)}</div>
        <div class="kpi-unit">psig</div>
        <div class="kpi-sub">Max ${m.wh_press_max} | Min ${m.wh_press_min}</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--accent)">
        <div class="kpi-label">Flow Pressure (avg)</div>
        <div class="kpi-value">${m.flow_press_mean > 0 ? m.flow_press_mean.toFixed(0) : 'N/A'}</div>
        <div class="kpi-unit">psig flowing</div>
        <div class="kpi-sub">Flowing wellhead</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--accent2)">
        <div class="kpi-label">WH Temperature (avg)</div>
        <div class="kpi-value">${m.wh_temp_mean > 0 ? m.wh_temp_mean.toFixed(1) : 'N/A'}</div>
        <div class="kpi-unit">°F</div>
        <div class="kpi-sub">Wellhead temperature</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--warn)">
        <div class="kpi-label">WHSIP</div>
        <div class="kpi-value">${m.whsip_mean > 0 ? m.whsip_mean.toFixed(0) : 'N/A'}</div>
        <div class="kpi-unit">psig shut-in</div>
        <div class="kpi-sub">Reservoir pressure signal</div>
      </div>
      <div class="kpi-card" style="--kpi-color:${m.anomaly ? 'var(--danger)' : 'var(--accent)'}">
        <div class="kpi-label">Press Std Dev</div>
        <div class="kpi-value">${m.wh_press_std.toFixed(0)}</div>
        <div class="kpi-unit">psig variability</div>
        <div class="kpi-sub">${m.anomaly ? '<span class="down">⚠ High variability</span>' : '<span class="up">✓ Stable</span>'}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card wide">
        <div class="chart-title">Pressure Trend <span class="accent">WH &amp; Flow — reading by reading</span></div>
        <canvas id="chart-ts-press" style="max-height:175px"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">WH Temperature Trend <span class="accent">°F</span></div>
        <canvas id="chart-ts-temp"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Pressure Distribution <span class="accent">histogram</span></div>
        <canvas id="chart-hist"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Separator Pressure <span class="accent">psig</span></div>
        <canvas id="chart-sep"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Choke Setting <span class="accent">in/64</span></div>
        <canvas id="chart-choke"></canvas>
      </div>
    </div>
  `;

  setTimeout(() => {
    drawPressureTrend('chart-ts-press', ts);
    drawTempTrend('chart-ts-temp', ts);
    drawHistogram('chart-hist', ts.wh_press);
    drawSepPressure('chart-sep', ts);
    drawChoke('chart-choke', ts);
  }, 0);
}
