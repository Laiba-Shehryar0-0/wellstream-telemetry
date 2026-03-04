// ============================================================
//  rag.js  —  RAG Engine (Retrieval-Augmented Generation)
//
//  HOW RAG WORKS (explained simply):
//  1. INDEX   — Build a searchable index from all well "documents"
//  2. RETRIEVE — When user types a query, find the most relevant chunks
//  3. RANK    — Score each chunk using TF-IDF + keyword overlap
//  4. GENERATE — Compose a human-readable answer from top results
// ============================================================

// ── STEP 1: INDEX ─────────────────────────────────────────────
// Build an inverted index: word → [list of well IDs that contain it]
// This is exactly how search engines work under the hood.

const RAG_INDEX = {};      // word → Set of chunk IDs
const RAG_TF    = {};      // term frequency per chunk

function buildIndex(chunks) {
  chunks.forEach(chunk => {
    const tokens = tokenize(chunk.doc + ' ' + chunk.keywords.join(' '));
    RAG_TF[chunk.id] = {};

    tokens.forEach(token => {
      // Term Frequency: how often does this word appear in this chunk?
      RAG_TF[chunk.id][token] = (RAG_TF[chunk.id][token] || 0) + 1;

      // Inverted Index: which chunks contain this word?
      if (!RAG_INDEX[token]) RAG_INDEX[token] = new Set();
      RAG_INDEX[token].add(chunk.id);
    });
  });

  console.log(`[RAG] Index built: ${Object.keys(RAG_INDEX).length} unique terms across ${chunks.length} well documents`);
}

// ── STEP 2: TOKENIZE ──────────────────────────────────────────
// Split text into clean lowercase words, remove stop words
function tokenize(text) {
  const STOP_WORDS = new Set([
    'the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could',
    'should','may','might','shall','and','or','but','in','on',
    'at','to','for','of','with','by','from','up','about','into',
    'through','during','before','after','above','below','between'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9.\-\/]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

// ── STEP 3: RETRIEVE & RANK ───────────────────────────────────
// Score each chunk using TF-IDF similarity to the query
// TF-IDF = Term Frequency × Inverse Document Frequency
// Higher score = more relevant to the query

function retrieve(query, topK = 5) {
  if (!query || query.trim().length < 2) return [];

  const queryTokens = tokenize(query);
  const scores = {};   // chunkId → relevance score
  const N = RAG_CHUNKS.length;

  queryTokens.forEach(qToken => {
    // Find all chunks containing this query word
    const matchingChunks = RAG_INDEX[qToken] || new Set();

    // IDF: rare words score higher than common words
    const idf = Math.log((N + 1) / (matchingChunks.size + 1)) + 1;

    matchingChunks.forEach(chunkId => {
      const tf = (RAG_TF[chunkId]?.[qToken] || 0);
      scores[chunkId] = (scores[chunkId] || 0) + (tf * idf);
    });
  });

  // Boost scores for exact keyword matches in the keyword tags
  RAG_CHUNKS.forEach(chunk => {
    const kw = chunk.keywords.join(' ').toLowerCase();
    queryTokens.forEach(qt => {
      if (kw.includes(qt)) {
        scores[chunk.id] = (scores[chunk.id] || 0) + 3;
      }
    });
  });

  // Boost for metric-based queries (e.g. "high pressure", "anomaly")
  applyMetricBoosts(query.toLowerCase(), scores);

  // Sort by score descending, return top K
  const ranked = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);

  return ranked.map(([id, score]) => ({
    chunk: RAG_CHUNKS.find(c => c.id === id),
    score: score,
    relevance: Math.min(100, Math.round((score / (ranked[0]?.[1] || 1)) * 100))
  }));
}

// ── METRIC BOOSTS ─────────────────────────────────────────────
// Boost chunks based on numeric filters in the query
function applyMetricBoosts(query, scores) {
  const rules = [
    { pattern: /high.?press|highest.?press|max.?press/,   fn: c => c.metrics.wh_press_mean > 1500, boost: 5 },
    { pattern: /low.?press|lowest.?press|min.?press/,     fn: c => c.metrics.wh_press_mean < 200 && c.metrics.wh_press_mean > 0, boost: 5 },
    { pattern: /anomal|unstable|variab|fluctuat/,         fn: c => c.metrics.anomaly, boost: 6 },
    { pattern: /normal|stable|consistent/,                fn: c => !c.metrics.anomaly, boost: 4 },
    { pattern: /hot|high.?temp|warm/,                     fn: c => c.metrics.wh_temp_mean > 150, boost: 4 },
    { pattern: /cool|low.?temp|cold/,                     fn: c => c.metrics.wh_temp_mean > 0 && c.metrics.wh_temp_mean < 100, boost: 4 },
    { pattern: /shut.?in|whsip|reservoir/,                fn: c => c.metrics.whsip_mean > 0, boost: 5 },
    { pattern: /separator|sep/,                           fn: c => c.metrics.sep_press_mean > 0, boost: 4 },
    { pattern: /goru|mari/,                               fn: c => c.formation.toLowerCase().includes('goru') || c.short.toLowerCase().includes('mari'), boost: 4 },
    { pattern: /ghazij/,                                  fn: c => c.formation.toLowerCase().includes('ghazij'), boost: 5 },
    { pattern: /togh|lumshiwal|hangu/,                    fn: c => c.short.toLowerCase().includes('togh'), boost: 5 },
  ];

  rules.forEach(({ pattern, fn, boost }) => {
    if (pattern.test(query)) {
      RAG_CHUNKS.forEach(chunk => {
        if (fn(chunk)) {
          scores[chunk.id] = (scores[chunk.id] || 0) + boost;
        }
      });
    }
  });
}

// ── STEP 4: GENERATE ANSWER ───────────────────────────────────
// Take retrieved chunks and generate a human-readable response
// This is the "G" in RAG — synthesising retrieved info into an answer

function generateAnswer(query, results) {
  if (!results || results.length === 0) {
    return `No matching wells found for <strong>"${query}"</strong>. Try: "high pressure", "anomaly", "Goru-B", or a well name.`;
  }

  const q = query.toLowerCase();
  const top = results[0].chunk;
  const count = results.length;

  // ── Intent detection ──────────────────────────────────────
  if (/anomal|unstable|variab|fluctuat/.test(q)) {
    const anomalies = results.filter(r => r.chunk.metrics.anomaly);
    if (anomalies.length === 0) return `No anomalies detected among the top ${count} results for <strong>"${query}"</strong>.`;
    return `Found <strong>${anomalies.length} anomalous well(s)</strong> matching your query. 
      Top result: <strong>${top.short}</strong> (${top.formation}) — pressure variability of <strong>${top.metrics.wh_press_std} psig</strong>. 
      These wells show high pressure fluctuation and may need attention.`;
  }

  if (/high.?press|highest.?press/.test(q)) {
    const sorted = [...results].sort((a,b) => b.chunk.metrics.wh_press_mean - a.chunk.metrics.wh_press_mean);
    const best = sorted[0].chunk;
    return `Highest wellhead pressure: <strong>${best.short}</strong> (${best.formation}) 
      averaging <strong>${best.metrics.wh_press_mean} psig</strong> with a peak of <strong>${best.metrics.wh_press_max} psig</strong>.`;
  }

  if (/low.?press|lowest.?press/.test(q)) {
    const sorted = results.filter(r => r.chunk.metrics.wh_press_mean > 0)
                          .sort((a,b) => a.chunk.metrics.wh_press_mean - b.chunk.metrics.wh_press_mean);
    if (!sorted.length) return `No valid low-pressure results found.`;
    const best = sorted[0].chunk;
    return `Lowest wellhead pressure: <strong>${best.short}</strong> (${best.formation}) 
      averaging only <strong>${best.metrics.wh_press_mean} psig</strong>.`;
  }

  if (/hot|high.?temp/.test(q)) {
    const sorted = results.filter(r => r.chunk.metrics.wh_temp_mean > 0)
                          .sort((a,b) => b.chunk.metrics.wh_temp_mean - a.chunk.metrics.wh_temp_mean);
    if (!sorted.length) return `No temperature data available for that query.`;
    const best = sorted[0].chunk;
    return `Hottest well: <strong>${best.short}</strong> (${best.formation}) 
      with an average WH temperature of <strong>${best.metrics.wh_temp_mean}°F</strong>.`;
  }

  if (/shut.?in|whsip/.test(q)) {
    const withSip = results.filter(r => r.chunk.metrics.whsip_mean > 0);
    if (!withSip.length) return `No WHSIP data found for <strong>"${query}"</strong>.`;
    const best = withSip.sort((a,b) => b.chunk.metrics.whsip_mean - a.chunk.metrics.whsip_mean)[0].chunk;
    return `Highest WHSIP: <strong>${best.short}</strong> with <strong>${best.metrics.whsip_mean} psig</strong> shut-in pressure, 
      indicating strong reservoir energy.`;
  }

  // ── Generic answer ────────────────────────────────────────
  return `Found <strong>${count} well(s)</strong> matching <strong>"${query}"</strong>. 
    Top result: <strong>${top.short}</strong> (${top.formation}) — 
    WH Pressure avg <strong>${top.metrics.wh_press_mean} psig</strong>, 
    temp <strong>${top.metrics.wh_temp_mean > 0 ? top.metrics.wh_temp_mean + '°F' : 'N/A'}</strong>, 
    status: <strong>${top.metrics.anomaly ? '⚠ ANOMALY' : '✓ NORMAL'}</strong>.`;
}

// ── INIT ──────────────────────────────────────────────────────
// Called once on app load — indexes all well documents
function initRAG() {
  buildIndex(RAG_CHUNKS);
}
