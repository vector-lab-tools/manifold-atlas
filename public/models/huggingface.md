# Hugging Face Embedding Models

Add or remove models by editing this file. One model per line:
`model-id | Display Name | dimensions`

Lines starting with # are comments and are ignored.

sentence-transformers/all-MiniLM-L6-v2 | MiniLM-L6 (384d) | 384
BAAI/bge-small-en-v1.5 | BGE Small (384d) | 384
# BGE Large can be slow to respond (cold-start on free tier)
BAAI/bge-large-en-v1.5 | BGE Large (1024d, slow) | 1024
mixedbread-ai/mxbai-embed-large-v1 | Mixedbread Large (1024d) | 1024
intfloat/multilingual-e5-large | Multilingual E5 Large (1024d) | 1024
# Qwen3-Embedding-0.6B is on the Hub but hf-inference does not serve it. As of
# 12 November 2026 the router returns 404, then 503 with "Provider 'hf-inference'
# is currently failing for model ... and has been paused by the circuit breaker".
# A listed model that always fails reads to the user as a bad token, so it is
# commented out rather than left in. Uncomment if HF serves it again.
# Qwen/Qwen3-Embedding-0.6B | Qwen3 Embedding 0.6B (1024d) | 1024
ibm-granite/granite-embedding-278m-multilingual | Granite Embedding 278M Multilingual (768d) | 768
