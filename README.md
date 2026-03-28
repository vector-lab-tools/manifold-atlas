# Manifold Atlas

**Comparative geometry of AI embedding spaces.**

**Author:** David M. Berry
**Version:** 0.1
**Date:** 28 March 2026

Manifold Atlas is a vector-native research tool for studying how large language models organise meaning geometrically. It uses embedding APIs from multiple AI providers to collect coordinates from the manifold, then computes distances, clusters, and projections that reveal the geometry's structure.

The tool operationalises the [vector theory framework](https://stunlaw.blogspot.com/2026/03/what-is-vector-space.html) developed by David M. Berry: the embedding API as telescope, the manifold as the object of study, and cosine similarity as the primary instrument. Without the framework, the numbers are curiosities. With it, they are evidence for geometric ideology, the negation deficit, and the proprietary encoding of human language.

## Features

### Concept Distance
Measure the geometric relationship between any two concepts. Enter two terms and see their cosine similarity across all configured embedding models, with detailed metrics (angular separation, euclidean distance, vector norms, top contributing dimensions) and interpretive text explaining what the similarity level means.

### Neighbourhood Map
Map the local structure of the manifold around a concept. Enter terms manually, load presets (Philosophy, Carpentry, Critical Theory, Democracy, etc.), or use **Manifold Scan** to auto-generate ~300 related terms and fire them all into the embedding space. Interactive 3D scatter plot with auto-rotation, cluster detection, connection mesh, and cross-domain analysis (border concepts, bridges, inter-manifold distance).

### Negation Gauge
Test whether the manifold can distinguish a claim from its negation. The tool embeds both the original statement and its auto-generated negation, measures their cosine similarity, and diagnoses the result on a scale from "clear distinction" to "collapsed: cannot distinguish claim from negation." Includes a similarity meter, detailed metrics, and theoretical context on the negation deficit.

### Negation Battery
Run a battery of 10-40 negation tests automatically against pre-built sets (political claims, ethical statements, factual assertions, epistemological claims) or custom statements. Produces a report card with collapse rate, average similarity, per-statement results table, and CSV export.

### Semantic Sectioning
Interpolate between two anchor concepts in the embedding space to discover what lies between them. The tool walks from concept A to concept B in 20 steps, finding the nearest real concept at each point. The resulting sequence (e.g. solidarity -> cooperation -> agreement -> conformity -> compliance) reveals where one domain shades into another in the manifold's geometry.

### Concept Drift
Measure how much context warps the manifold's positioning of a concept. Embed the same term with different contextual framings ("justice", "justice in the context of punishment", "justice in the context of mercy") and see how far each context displaces it. Large displacement means the manifold is context-sensitive; small displacement means the concept is geometrically rigid.

## Supported Embedding Providers

| Provider | Models | API Key |
|----------|--------|---------|
| OpenAI | text-embedding-3-small (1536d), text-embedding-3-large (3072d) | Required |
| Voyage AI (Anthropic) | voyage-3, voyage-3-large, voyage-3.5 (1024d) | Required |
| Google Gemini | gemini-embedding-001 (3072d) | Required |
| Cohere | embed-v3.0 (1024d) | Required |
| Ollama (local) | nomic-embed-text, mxbai-embed-large, all-minilm | No (local) |
| OpenAI-compatible | Custom | Configurable |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- At least one embedding provider API key, or [Ollama](https://ollama.com/) running locally

### Install and Run

```bash
git clone https://github.com/dmberry/manifold-atlas.git
cd manifold-atlas
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configure Providers

1. Click **Settings** (top right)
2. Enable one or more embedding providers
3. Enter your API key (or for Ollama, ensure it's running with an embedding model pulled: `ollama pull nomic-embed-text`)
4. Select which models to use
5. Close settings and start querying

### Using Ollama (Local, Free)

```bash
# Install Ollama (https://ollama.com/)
ollama pull nomic-embed-text
ollama serve
```

Then enable Ollama in Manifold Atlas settings. No API key needed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3, CCS-WB editorial design system |
| Visualisation | Plotly.js (GL3D), custom SVG |
| Dimensionality Reduction | umap-js (browser-side), custom PCA |
| Caching | IndexedDB via idb |
| Validation | Zod |

## Architecture

```
src/
  app/
    api/embed/       # Proxy to embedding APIs
    api/expand/      # LLM-powered concept expansion for Manifold Scan
    api/ollama/      # Ollama model management (list, pull)
  components/
    operations/      # Concept Distance, Neighbourhood Map, Negation Gauge,
                     # Negation Battery, Semantic Sectioning, Concept Drift
    viz/             # ScatterPlot, SimilarityBridge, SimilarityMeter,
                     # GaugeArc, AnalysisPanel, PlotlyPlot
    layout/          # Header, TabNav, StatusBar, SettingsPanel
    shared/          # QueryHistory, ResetButton, ErrorDisplay, ConceptPresets
    easter-eggs/     # Clippy (type "clippy" or "hacker")
  context/           # SettingsContext, EmbeddingCacheContext
  lib/
    embeddings/      # Client + provider modules (OpenAI, Voyage, Google, Cohere, Ollama)
    geometry/        # cosine, pca, umap-wrapper, clusters
    similarity-scale, negation, history, expand, utils
  types/             # embeddings, settings, type declarations
```

Embedding vectors are cached in IndexedDB (keyed by model + text, deterministic). Settings persist in localStorage. No server-side database, no authentication, no external dependencies beyond the embedding APIs themselves.

## Theoretical Context

Manifold Atlas is a research instrument for the [vector theory](https://stunlaw.blogspot.com/2026/02/vector-theory.html) programme developed by David M. Berry. Vector theory argues that the vectorial turn introduces a new computational regime in which definition is replaced by position, truth by orientation, argument by interpolation, and contradiction by cosine proximity. The embedding layer performs a real abstraction at the level of meaning itself: heterogeneous language is converted into homogeneous geometric coordinates within a proprietary manifold.

The tool operationalises this framework empirically. Key concepts and the features that test them:

- **The embedding API as telescope** -- the one point where the medium exposes its internal vectors to the outside. The telescope sees the stars but does not visit them. All six operations use this as their basic research instrument.
- **The negation deficit** -- the manifold structurally lacks negation in both mathematical and logical-dialectical senses. The Negation Gauge and Negation Battery produce empirical evidence for this, measuring the cosine similarity between claims and their negations across models.
- **Geometric ideology** -- hegemony that operates through topology (density, sparsity, trajectory) rather than discourse (propositions, narratives, interpellation). The Neighbourhood Map's cluster analysis, connection mesh, and density mapping test this.
- **Manifold sectioning** -- cutting the geometry along critically chosen planes to reveal where one domain shades into another. Semantic Sectioning operationalises this directly.
- **Geometric stress testing** -- embedding the same concept in different contexts to measure how the manifold warps under contextual pressure. Concept Drift operationalises this.
- **The proprietary medium** -- every vector observed through the telescope was computed by a corporation that controls the geometry. The political economy of the method is built into its conditions of possibility. Multi-model comparison reveals whether geometric politics are structural to the medium or contingent on training decisions.

For the full theoretical framework, see:

- Berry, D.M. (2026) [Vector Theory](https://stunlaw.blogspot.com/2026/02/vector-theory.html). *Stunlaw*.
- Berry, D.M. (2026) [What is Vector Space?](https://stunlaw.blogspot.com/2026/03/what-is-vector-space.html). *Stunlaw*.
- Berry, D.M. (2026) [The Vector Medium](https://stunlaw.blogspot.com/). *Stunlaw*.

## Easter Eggs

Type `clippy` anywhere (outside a text input) for the Manifold Atlas Clippy. Type `hacker` for Hackerman mode.

## Acknowledgements

Built by David M. Berry with Claude. Design system adapted from the [CCS Workbench](https://github.com/dmberry/ccs-wb).

## Licence

MIT
