# Manifold Atlas

**Comparative geometry of AI embedding spaces.**

**Author:** David M. Berry
**Version:** 0.3.1
**Date:** 30 March 2026

Manifold Atlas is a vector-native research tool for studying how large language models organise meaning geometrically. It uses embedding APIs from multiple AI providers to collect coordinates from the manifold, then computes distances, clusters, and projections that reveal the geometry's structure.

![Manifold Atlas - Neighbourhood Map](docs/screenshot-neighbourhood.png)

The tool operationalises [Vector Theory](https://stunlaw.blogspot.com/2026/02/vector-theory.html) theorised by David M. Berry. This includes the embedding API as telescope, the manifold as the object of study, and cosine similarity as the primary instrument. Without the framework, the numbers are curiosities. With it, they are evidence for geometric ideology, the negation deficit, and the proprietary encoding of human language.

## Features

### Concept Distance
Measure the geometric relationship between any two concepts. Enter two terms and see their cosine similarity across all configured embedding models, with detailed metrics (angular separation, euclidean distance, vector norms, top contributing dimensions) and interpretive text explaining what the similarity level means.

### Neighbourhood Map
Map the local structure of the manifold around a concept. Enter terms manually, load presets (Philosophy, Carpentry, Critical Theory, Democracy, etc.), or use **Manifold Scan** to auto-generate ~300 related terms and fire them all into the embedding space. Interactive 3D scatter plot with auto-rotation, cluster detection, connection mesh, and cross-domain analysis (border concepts, bridges, inter-manifold distance).

### Negation Gauge
Negation works differently in the manifold than in logic. Where logic treats "A" and "not A" as categorical opposites, the geometry stores them close together, differing in only a few dimensions out of hundreds. The tool embeds both the original statement and its auto-generated negation, measures their cosine similarity, and shows how much space the manifold actually gives to negation. Includes a similarity meter, detailed metrics, and theoretical context on the negation deficit.

### Negation Battery
Run a battery of 10-40 negation tests automatically against pre-built sets (political claims, ethical statements, factual assertions, epistemological claims) or custom statements. Produces a report card with collapse rate, average similarity, per-statement results table, and CSV export.

### Semantic Sectioning
Interpolate between two anchor concepts in the embedding space to discover what lies between them. The tool walks from concept A to concept B in 20 steps, finding the nearest real concept at each point. The resulting sequence (e.g. solidarity -> cooperation -> agreement -> conformity -> compliance) reveals where one domain shades into another in the manifold's geometry.

### Concept Drift
Measure how much context warps the manifold's positioning of a concept. Embed the same term with different contextual framings ("justice", "justice in the context of punishment", "justice in the context of mercy") and watch it move through the geometry. Three visualisations per model: a 3D drift cloud showing all positions simultaneously with connecting lines back to the bare concept; sorted displacement bars showing which contexts are most geometrically powerful; and a pairwise pathway heatmap revealing which contextual framings converge (similar routes through the manifold) and which diverge.

### Hegemony Compass
Place a contested concept ("freedom", "democracy", "intelligence") between two competing ideological clusters and measure which side the manifold pulls it toward. Pre-loaded tests for Freedom (market liberalism vs emancipatory politics), Democracy (liberal proceduralism vs radical democracy), Intelligence (techno-rationalism vs embodied cognition), Security, and Progress. The result reveals which ideological framing the geometry has naturalised as the default meaning.

### Real Abstraction Test
Measure how far the manifold has performed the real abstraction (after Sohn-Rethel). Each pair contrasts a concrete use-value description ("a warm coat that keeps the rain off") with its abstract exchange-value equivalent ("a commodity worth twenty yards of linen"). If the distance is small, the abstraction is already complete in the geometry. If large, the use-value has partially resisted encoding. 12 pre-loaded pairs across domains from clothing to care work.

### Silence Detector
Measure the local density of the manifold around different domains. Dense regions mean the model compresses diverse realities into few coordinates (low resolution). Sparse regions mean it preserves fine-grained distinctions (high resolution). Pre-loaded comparisons: financial derivatives vs subsistence farming, Silicon Valley vs indigenous ecological knowledge, corporate management vs care work. The density differential reveals where capital has invested in encoding and where it has not.

## Supported Embedding Providers

### Embedding Models vs Chat Models

Manifold Atlas uses two kinds of AI model, and it helps to understand the difference:

A **chat model** (GPT-4o, Claude, Llama) takes text in and produces **text** out. You give it a prompt, it generates a response. The output is language.

An **embedding model** (text-embedding-3-small, nomic-embed-text) takes text in and produces a **vector** out: a list of numbers (e.g. 768 or 3,072 floating-point values). No language comes back, just coordinates in a high-dimensional space. Those coordinates are the model's geometric encoding of what the text "means", where meaning is reduced to position. The embedding model is the telescope: it converts text into a location in the manifold.

Both are built from transformer architectures trained on large corpora. A chat model has an embedding layer internally (it converts tokens to vectors as its first step), but then processes those vectors through many more layers and converts back to language. An embedding model stops earlier: it produces the vector and hands it to you. This is why embedding API calls are cheap (fractions of a penny) while chat API calls are expensive.

In Manifold Atlas, the **embedding models** are the core instrument. Every operation uses them to produce vectors for analysis. The **chat model** is only used for one feature: Manifold Scan, where it generates ~300 related terms from a seed concept. If you are using Ollama locally, you need an embedding model (e.g. `nomic-embed-text`) for all operations, and a chat model (e.g. `llama3.2`) only if you want to use Manifold Scan.

### Supported Providers

You only need to configure the providers you want to use. Enable one or more and ignore the rest.

**Free cloud provider** (free account, no payment required):

| Provider | Models | Sign up |
|----------|--------|---------|
| Hugging Face | MiniLM-L6 (384d), BGE Small (384d), Nomic Embed v1.5 (768d) | [huggingface.co](https://huggingface.co/) |

To use Hugging Face: sign up at [huggingface.co](https://huggingface.co/) (free), go to Settings > Access Tokens, create a token, and paste it in Manifold Atlas Settings. Rate-limited but fully functional for research use.

**Paid cloud providers** (require an API key from the provider):

| Provider | Models | Sign up |
|----------|--------|---------|
| OpenAI | text-embedding-3-small (1536d), text-embedding-3-large (3072d) | [platform.openai.com](https://platform.openai.com/) |
| Voyage AI (Anthropic) | voyage-3, voyage-3-large, voyage-3.5 (1024d) | [voyageai.com](https://www.voyageai.com/) |
| Google Gemini | gemini-embedding-001 (3072d) | [ai.google.dev](https://ai.google.dev/) |
| Cohere | embed-v3.0 (1024d) | [cohere.com](https://cohere.com/) |
| OpenRouter (OpenAI-compatible) | Various | [openrouter.ai](https://openrouter.ai/) |

**Local provider** (no API key, no account, runs entirely on your machine):

| Provider | Models |
|----------|--------|
| Ollama | nomic-embed-text, mxbai-embed-large, all-minilm, or any embedding model you pull |

To use Ollama, install it from [ollama.com](https://ollama.com/), pull an embedding model (`ollama pull nomic-embed-text`), and enable it in Settings. No API key needed. No data leaves your machine.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- At least one of: an embedding provider API key (OpenAI, Voyage, Google, or Cohere), or [Ollama](https://ollama.com/) running locally with an embedding model pulled

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
                     # Negation Battery, Semantic Sectioning, Concept Drift,
                     # Hegemony Compass, Real Abstraction Test, Silence Detector
    viz/             # ScatterPlot, SimilarityBridge, SimilarityMeter,
                     # GaugeArc, AnalysisPanel, PlotlyPlot
    layout/          # Header, TabNav, StatusBar, SettingsPanel
    shared/          # QueryHistory, ResetButton, ErrorDisplay, ConceptPresets
    easter-eggs/     # Clippy, Hackerman, Geoffrey Hinton, Karl Marx
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

- **The embedding API as telescope** -- the embedding API returns processed, averaged representations from a separately-trained model, not a direct window into the frontier model's internal geometry. This makes the telescope metaphor more precise, not less: a telescope does not show you the star itself but light refracted through lenses. You are studying a proprietary geometry through a proprietary aperture. All nine operations use this as their basic research instrument.
- **The negation deficit** -- the manifold's geometric representation of negation is structurally inadequate to the logical and dialectical weight that negation carries. Negation in the geometry is likely a small rotation in a few dimensions, drowned out by overwhelming similarity across all other dimensions. The Negation Gauge and Battery measure this empirically: not that the manifold has zero capacity for negation, but that its capacity is geometrically trivial relative to the conceptual work negation performs.
- **Geometric ideology** -- hegemony that operates through topology (density, sparsity, trajectory) rather than discourse (propositions, narratives, interpellation). The Neighbourhood Map's cluster analysis, connection mesh, and density mapping test this.
- **Manifold sectioning** -- cutting the geometry along critically chosen planes to reveal where one domain shades into another. Semantic Sectioning operationalises this directly.
- **Geometric stress testing** -- embedding the same concept in different contexts to measure how the manifold warps under contextual pressure. Concept Drift operationalises this.
- **Real abstraction** -- the embedding layer performs Sohn-Rethel's real abstraction at the level of meaning. The Real Abstraction Test measures how far the manifold has completed this abstraction across domains, from clothing to care work.
- **Hegemonic defaults** -- the Hegemony Compass measures which ideological framing the geometry has naturalised as the default meaning of contested concepts like "freedom" and "democracy."
- **The taxonomy of silence** -- the Silence Detector measures density differentials between domains, revealing where capital has invested in encoding and where the manifold thins out.
- **The proprietary medium** -- every vector observed through the telescope was computed by a corporation that controls the geometry. The political economy of the method is built into its conditions of possibility. Multi-model comparison reveals whether geometric politics are structural to the medium or contingent on training decisions.

For the full theoretical framework, see:

- Berry, D.M. (2026) [Vector Theory](https://stunlaw.blogspot.com/2026/02/vector-theory.html). *Stunlaw*.
- Berry, D.M. (2026) [What is Vector Space?](https://stunlaw.blogspot.com/2026/03/what-is-vector-space.html). *Stunlaw*.
- Berry, D.M. (2026) [The Vector Medium](https://stunlaw.blogspot.com/). *Stunlaw*.

## Easter Eggs

Type `clippy` anywhere (outside a text input) for the Manifold Atlas Clippy. Type `hacker` for Hackerman mode. Type `hinton` to summon Geoffrey Hinton, who appears with his 1977 quote connecting neural representations to Marx's exchange value. Type `marx` for Karl Marx, who cycles through 30 quotations from Capital, the Manifesto, the 1844 Manuscripts, and more.

## Acknowledgements

Concept and Design by David M. Berry, implemented with Claude Code 4.6. Design system adapted from the [CCS Workbench](https://github.com/dmberry/ccs-wb).

Many thanks to Michael Castelle, Michael Dieter, and others for feedback and comments on the Manifold Atlas.

## Licence

MIT
