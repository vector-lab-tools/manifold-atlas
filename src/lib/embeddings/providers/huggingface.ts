/**
 * Hugging Face Inference API provider.
 * Free tier with HF token. Sign up at huggingface.co.
 * https://huggingface.co/docs/api-inference/
 */

export async function embedHuggingFace(
  texts: string[],
  model: string,
  apiKey: string
): Promise<number[][]> {
  // HF Inference API: POST to the feature-extraction pipeline
  const response = await fetch(
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: texts,
        options: { wait_for_model: true },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Hugging Face API error (${response.status}): ${error?.error || response.statusText}`
    );
  }

  const data = await response.json();

  // The response is an array of embeddings.
  // For sentence-transformers models, each embedding is a 2D array [tokens][dims]
  // and we need to mean-pool, OR it's already a 1D array [dims].
  return data.map((embedding: number[] | number[][]) => {
    if (Array.isArray(embedding[0])) {
      // Token-level embeddings: mean pool across tokens
      const tokens = embedding as number[][];
      const dims = tokens[0].length;
      const pooled = new Array(dims).fill(0);
      for (const token of tokens) {
        for (let d = 0; d < dims; d++) pooled[d] += token[d];
      }
      for (let d = 0; d < dims; d++) pooled[d] /= tokens.length;
      return pooled;
    }
    // Already a 1D embedding
    return embedding as number[];
  });
}
