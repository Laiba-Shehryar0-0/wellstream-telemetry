# Wellstream Telemetry 

A multi-file interactive RAG dashboard for oil well production & pressure data,
built with a client-side **RAG (Retrieval-Augmented Generation)** engine.

---

## 📁 Project Structure

```
WellDashboard/
│
├── index.html          ← Entry point — links all CSS/JS files
│
├── css/
│   └── style.css       ← All styling (dark industrial theme)
│
├── js/
│   ├── data.js         ← RAG chunks: well documents + timeseries data
│   ├── rag.js          ← RAG Engine: index → retrieve → rank → generate
│   ├── charts.js       ← Chart.js rendering helpers
│   ├── ui.js           ← DOM rendering (overview + well detail views)
│   └── app.js          ← App entry point & event wiring
│
└── data/
    └── rag_chunks.json ← Source RAG chunks (JSON, used to build data.js)
```

---

## 🚀 How to Run in VS Code

### Option A — Live Server (recommended)
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Browser opens at `http://127.0.0.1:5500`

### Option B — Direct open
1. Double-click `index.html` in File Explorer
2. Opens directly in your browser — no server needed!

> ⚠️ Use Live Server if you see CORS errors loading local JS files.

---

## 🧠 What is RAG? (Explain Like I'm 5)

**RAG = Retrieval-Augmented Generation**

Normal dashboards show fixed charts. RAG makes the dashboard *intelligent*:

```
User types query
      ↓
[RETRIEVE] Search the index → find relevant well "documents"
      ↓
[RANK]     Score them with TF-IDF → most relevant wells float to top
      ↓
[GENERATE] Write a human-readable answer from the top results
      ↓
Show filtered sidebar + ranked table + generated answer
```

### Where each step lives in this project:

| Step | File | What it does |
|------|------|-------------|
| **Index**    | `rag.js → buildIndex()`    | Builds word→well inverted index on load |
| **Tokenize** | `rag.js → tokenize()`      | Cleans query text, removes stop words |
| **Retrieve** | `rag.js → retrieve()`      | TF-IDF scoring against the index |
| **Boost**    | `rag.js → applyMetricBoosts()` | Extra score for metric-based queries |
| **Generate** | `rag.js → generateAnswer()` | Writes a natural-language answer |
| **Render**   | `app.js → renderRAGResults()` | Shows RAG answer box + ranked table |

---

## 🔍 RAG Technique Used: TF-IDF

**TF-IDF (Term Frequency — Inverse Document Frequency)**

```
Score = TF × IDF

TF  = how often the query word appears in a well's document
IDF = log(total wells / wells containing the word)
    → rare words get higher weight than common ones
```

Each well has a "document" like:
```
Well: Mari-Tipu-1:Goru-B
Formation: Goru-B
Avg WH Pressure: 2410.65 psig
Status: NORMAL
Keywords: goru-b mari-tipu-1 normal high-pressure hot
```

When you search "high pressure Goru", the engine:
1. Tokenizes → ["high", "pressure", "goru"]
2. Looks up each token in the inverted index
3. Scores each well using TF-IDF
4. Boosts wells where `wh_press_mean > 1500`
5. Returns top results ranked by score

---

## 💡 Example RAG Queries to Try

| Query | What RAG retrieves |
|-------|-------------------|
| `anomaly` | All wells with high pressure variability |
| `high pressure` | Wells with WH pressure > 1500 psig |
| `Goru-B` | All Goru-B formation wells |
| `hot wells` | Wells with temperature > 150°F |
| `shut in` | Wells with WHSIP data |
| `separator` | Wells with separator pressure readings |
| `Mari` | All Mari field wells |
| `stable low pressure` | Normal wells with low WH pressure |

---

## 📊 Data Summary

- **Source**: VT_WELL_READ CSV files (3 parts)
- **Records**: 3,000 total
- **Wells**: 20 unique wells
- **Key metrics**: WH Pressure, Flow Pressure, WH Temperature,
  WHSIP, Separator Pressure, Choke Setting, Flow Time
- **Anomaly flag**: Triggered when WH pressure std dev > 200 psig

---

## 🛠️ Technologies Used

| Technology | Purpose |
|-----------|---------|
| HTML5 | Structure & layout |
| CSS3 (custom properties) | Dark theme, animations |
| Vanilla JavaScript (ES6+) | RAG engine, UI logic |
| Chart.js 4.4 | All charts and visualizations |
| Python + Pandas | Data preprocessing & chunk generation |
| Google Fonts | Space Mono + DM Sans typography |
