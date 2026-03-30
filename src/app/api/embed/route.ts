import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { embedOpenAI } from "@/lib/embeddings/providers/openai";
import { embedVoyage } from "@/lib/embeddings/providers/voyage";
import { embedGoogle } from "@/lib/embeddings/providers/google";
import { embedCohere } from "@/lib/embeddings/providers/cohere";
import { embedOllama } from "@/lib/embeddings/providers/ollama";
import { embedHuggingFace } from "@/lib/embeddings/providers/huggingface";

const EmbedRequestSchema = z.object({
  provider: z.enum(["openai", "voyage", "google", "cohere", "huggingface", "ollama", "openai-compatible"]),
  model: z.string().min(1),
  texts: z.array(z.string().min(1)).min(1).max(500),
  baseUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EmbedRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid request: ${parsed.error.issues.map(i => i.message).join(", ")}` },
        { status: 400 }
      );
    }

    const { provider, model, texts, baseUrl } = parsed.data;
    const apiKey = request.headers.get("X-Embed-API-Key") || "";

    let vectors: number[][];

    switch (provider) {
      case "openai":
        if (!apiKey) return NextResponse.json({ error: "OpenAI API key required" }, { status: 401 });
        vectors = await embedOpenAI(texts, model, apiKey);
        break;

      case "voyage":
        if (!apiKey) return NextResponse.json({ error: "Voyage AI API key required" }, { status: 401 });
        vectors = await embedVoyage(texts, model, apiKey);
        break;

      case "google":
        if (!apiKey) return NextResponse.json({ error: "Google API key required" }, { status: 401 });
        vectors = await embedGoogle(texts, model, apiKey);
        break;

      case "cohere":
        if (!apiKey) return NextResponse.json({ error: "Cohere API key required" }, { status: 401 });
        vectors = await embedCohere(texts, model, apiKey);
        break;

      case "huggingface":
        if (!apiKey) return NextResponse.json({ error: "Hugging Face token required" }, { status: 401 });
        vectors = await embedHuggingFace(texts, model, apiKey);
        break;

      case "ollama":
        vectors = await embedOllama(texts, model, baseUrl || "http://localhost:11434");
        break;

      case "openai-compatible":
        if (!apiKey || !baseUrl) {
          return NextResponse.json(
            { error: "API key and base URL required for OpenAI-compatible provider" },
            { status: 401 }
          );
        }
        // Use OpenAI format with custom base URL
        vectors = await embedOpenAI(texts, model, apiKey);
        break;

      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json({
      vectors,
      model,
      dimensions: vectors[0]?.length || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[embed] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
