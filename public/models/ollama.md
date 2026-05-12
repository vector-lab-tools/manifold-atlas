# Ollama Local Embedding Models

Add or remove models by editing this file. One model per line:
`model-id | Display Name | dimensions`

Add any model you have pulled locally. Run `ollama pull <model>` to install.

nomic-embed-text | Nomic Embed Text (768d) | 768
mxbai-embed-large | mxbai Embed Large (1024d) | 1024
all-minilm | All-MiniLM (384d) | 384
embeddinggemma | EmbeddingGemma (Google, 768d) | 768
# Gemma 4 is a chat model. Ollama 0.1.40+ accepts chat models via /api/embed
# (mean-pooled hidden state). Older Ollama versions reject with "model does not
# support embeddings" — pull embeddinggemma above for a guaranteed-working
# Gemma-family embedding model.
gemma4 | Gemma 4 (Google chat, embed via Ollama 0.1.40+) | 0
