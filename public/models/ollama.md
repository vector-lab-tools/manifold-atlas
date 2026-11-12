# Ollama Local Embedding Models

Add or remove models by editing this file. One model per line:
`model-id | Display Name | dimensions`

Add any model you have pulled locally. Run `ollama pull <model>` to install.

nomic-embed-text | Nomic Embed Text (768d) | 768
mxbai-embed-large | mxbai Embed Large (1024d) | 1024
all-minilm | All-MiniLM (384d) | 384
granite-embedding | Granite Embedding (IBM, 384d) | 384
bge-large | BGE Large (1024d) | 1024
bge-m3 | BGE-M3 (multilingual, 1024d) | 1024
snowflake-arctic-embed | Snowflake Arctic Embed (1024d) | 1024
paraphrase-multilingual | Paraphrase Multilingual (768d) | 768
embeddinggemma | EmbeddingGemma (Google, 768d) | 768
# Chat models do not work here. Gemma 4 was listed until 12 November 2026 on the
# basis that Ollama would mean-pool a chat model's hidden state for /api/embed.
# It does not: on Ollama 0.35.1 a gemma4 embed call returns "This server does not
# support embeddings". Use embeddinggemma above for a Gemma-family embedding model.
