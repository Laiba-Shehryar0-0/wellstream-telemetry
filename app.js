// ============================================================
//  app.js  —  Application Entry Point & Event Wiring
//
//  This is the first file that runs. It:
//  1. Initialises the RAG index (rag.js)
//  2. Populates header stats
//  3. Renders the initial sidebar + overview
//  4. Wires the RAG search input
// ============================================================

// ── APP INIT ──────────────────────────────────────────────────
function init() {
  // 1. Build the RAG inverted index from all well documents
  initRAG();

  // 2. Populate header KPIs
  const anomalyCount = RAG_CHUNKS.filter(c => c.metrics.anomaly).length;
  const withPress    = RAG_CHUNKS.filter(c => c.metrics.wh_press_mean > 0);
  const avgPress     = Math.round(
    withPress.reduce((s, c) => s + c.metrics.wh_press_mean, 0) / withPress.length
  );

  document.getElementById('h-wells').textContent     = RAG_CHUNKS.length;
  document.getElementById('h-records').textContent   = '3,000';
  document.getElementById('h-anomalies').textContent = anomalyCount;
  document.getElementById('h-avgpress').textContent  = avgPress;

  // 3. Render sidebar with all wells (no RAG filter yet)
  renderWellList(RAG_CHUNKS);

  // 4. Render overview dashboard
  renderOverview();
}

// ── RAG SEARCH HANDLER ────────────────────────────────────────
// Called on every keystroke in the search box.
// This is where RAG "retrieval" is triggered live.

let searchTimeout = null;   // debounce timer

function handleRAGSearch() {
  const query = document.getElementById('well-search').value.trim();
  const hint  = document.getElementById('rag-hint');

  clearTimeout(searchTimeout);

  // Clear search → reset to all wells
  if (!query || query.length < 2) {
    hint.textContent = '';
    renderWellList(RAG_CHUNKS);
    renderOverview();
    return;
  }

  // Debounce: wait 250ms after user stops typing
  searchTimeout = setTimeout(() => {
    // ── RAG RETRIEVAL ─────────────────────────────────────
    const results = retrieve(query, 10);        // get top 10 relevant chunks
    const answer  = generateAnswer(query, results);  // synthesise natural language answer
    const chunks  = results.map(r => r.chunk);

    // ── UPDATE SIDEBAR ────────────────────────────────────
    if (results.length > 0) {
      hint.textContent = `↑ ${results.length} result(s) retrieved`;
      renderWellList(chunks, results);   // show RAG-ranked list with relevance scores
    } else {
      hint.textContent = 'No matches found';
      renderWellList(RAG_CHUNKS);         // fallback: show all
    }

    // ── SHOW RAG ANSWER IN CONTENT PANEL ─────────────────
    // If no well is currently drilled into, show the RAG answer box
    if (!selectedWell) {
      renderRAGResults(query, results, answer);
    }
  }, 250);
}

// ── RAG RESULTS VIEW ──────────────────────────────────────────
// Renders a special overview showing the RAG answer + filtered charts

function renderRAGResults(query, results, answer) {
  const content = document.getElementById('main-content');

  // Build KPI summaries from the retrieved chunks only
  const chunks = results.map(r => r.chunk);
  const withPress = chunks.filter(c => c.metrics.wh_press_mean > 0);
  const anomalies = chunks.filter(c => c.metrics.anomaly);

  content.innerHTML = `
    <div class="breadcrumb">
      <span class="link" onclick="clearSearch()">Dashboard</span>
      <span class="sep">›</span>
      <span>RAG Search Results</span>
      <span class="sep">›</span>
      <span style="color:var(--accent3)">"${query}"</span>
    </div>

    <!-- RAG GENERATED ANSWER -->
    <div class="rag-answer-box">
      <div class="rag-answer-label">⚡ RAG — Retrieved & Generated Answer</div>
      <div class="rag-answer-text">${answer}</div>
    </div>

    ${chunks.length > 0 ? `
    <div class="kpi-row">
      <div class="kpi-card" style="--kpi-color:var(--accent3)">
        <div class="kpi-label">Wells Retrieved</div>
        <div class="kpi-value">${chunks.length}</div>
        <div class="kpi-unit">matching your query</div>
        <div class="kpi-sub">RAG top-K results</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--accent)">
        <div class="kpi-label">Avg WH Pressure</div>
        <div class="kpi-value">${withPress.length ? Math.round(withPress.reduce((s,c)=>s+c.metrics.wh_press_mean,0)/withPress.length) : 'N/A'}</div>
        <div class="kpi-unit">psig (retrieved set)</div>
        <div class="kpi-sub">Retrieved wells average</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--accent2)">
        <div class="kpi-label">Max WH Pressure</div>
        <div class="kpi-value">${chunks.length ? Math.max(...chunks.map(c=>c.metrics.wh_press_max)).toFixed(0) : 'N/A'}</div>
        <div class="kpi-unit">psig peak</div>
        <div class="kpi-sub">In retrieved set</div>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--warn)">
        <div class="kpi-label">Top Relevance</div>
        <div class="kpi-value">${results[0]?.relevance ?? 0}%</div>
        <div class="kpi-unit">TF-IDF score</div>
        <div class="kpi-sub">${results[0]?.chunk.short ?? ''}</div>
      </div>
      <div class="kpi-card" style="--kpi-color:${anomalies.length ? 'var(--danger)' : 'var(--accent)'}">
        <div class="kpi-label">Anomalies</div>
        <div class="kpi-value">${anomalies.length}</div>
        <div class="kpi-unit">in retrieved set</div>
        <div class="kpi-sub">${anomalies.length ? '<span class="down">Needs attention</span>' : '<span class="up">All stable</span>'}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">WH Pressure — Retrieved Wells <span class="accent">psig</span></div>
        <canvas id="chart-rag-press"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Temperature — Retrieved Wells <span class="accent">°F</span></div>
        <canvas id="chart-rag-temp"></canvas>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        Retrieved Wells — Ranked by Relevance
        <span style="color:var(--accent3);font-size:10px">Click row to drill down</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Well</th>
            <th>Formation</th>
            <th>Relevance</th>
            <th>WH Pressure</th>
            <th>Flow Pressure</th>
            <th>WH Temp</th>
            <th>WHSIP</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${results.map((r, i) => `
            <tr onclick="selectWell('${r.chunk.id}')" style="cursor:pointer">
              <td style="color:var(--muted)">#${i+1}</td>
              <td class="td-well">${r.chunk.short}</td>
              <td style="color:var(--muted)">${r.chunk.formation}</td>
              <td>
                <div class="pressure-bar">
                  <span style="color:var(--accent3)">${r.relevance}%</span>
                  <div class="bar-track"><div class="bar-fill" style="width:${r.relevance}%;background:var(--accent3)"></div></div>
                </div>
              </td>
              <td class="td-press">${r.chunk.metrics.wh_press_mean > 0 ? r.chunk.metrics.wh_press_mean.toFixed(0) + ' psig' : '—'}</td>
              <td class="td-flow">${r.chunk.metrics.flow_press_mean > 0 ? r.chunk.metrics.flow_press_mean.toFixed(0) + ' psig' : '—'}</td>
              <td class="td-temp">${r.chunk.metrics.wh_temp_mean > 0 ? r.chunk.metrics.wh_temp_mean.toFixed(1) + ' °F' : '—'}</td>
              <td style="color:var(--accent)">${r.chunk.metrics.whsip_mean > 0 ? r.chunk.metrics.whsip_mean.toFixed(0) : '—'}</td>
              <td>${r.chunk.metrics.anomaly
                ? '<span style="color:var(--danger);font-size:10px">⚠ ANOMALY</span>'
                : '<span style="color:var(--accent);font-size:10px">● NORMAL</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : '<div style="color:var(--muted);font-family:var(--mono);padding:20px">No wells matched your query.</div>'}
  `;

  setTimeout(() => {
    drawWHPressBar('chart-rag-press', chunks);
    drawTempBar('chart-rag-temp', chunks);
  }, 0);
}

// ── CLEAR SEARCH ──────────────────────────────────────────────
function clearSearch() {
  document.getElementById('well-search').value = '';
  document.getElementById('rag-hint').textContent = '';
  renderWellList(RAG_CHUNKS);
  renderOverview();
}

// ── BOOT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
