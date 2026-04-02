/**
 * API Keys persistence — reads/writes API keys to .env.local
 * so they survive dev server restarts and browser storage clears.
 * .env.local is in .gitignore, so keys never reach GitHub.
 */

import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const ENV_PATH = join(process.cwd(), ".env.local");

interface KeysPayload {
  [key: string]: string; // e.g. OPENAI_API_KEY: "sk-..."
}

// Map from provider ID to env var name
const KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  voyage: "VOYAGE_API_KEY",
  google: "GOOGLE_API_KEY",
  cohere: "COHERE_API_KEY",
  huggingface: "HUGGINGFACE_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
  "openai-compatible-baseurl": "OPENAI_COMPATIBLE_BASE_URL",
};

async function readEnvFile(): Promise<Map<string, string>> {
  const vars = new Map<string, string>();
  try {
    const content = await readFile(ENV_PATH, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars.set(key, val);
    }
  } catch {
    // File doesn't exist yet — that's fine
  }
  return vars;
}

async function writeEnvFile(vars: Map<string, string>): Promise<void> {
  const lines = ["# Manifold Atlas — API Keys (auto-generated, do not commit)"];
  for (const [key, val] of vars) {
    lines.push(`${key}="${val}"`);
  }
  await writeFile(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

// GET: return all saved keys
export async function GET() {
  const vars = await readEnvFile();
  const keys: KeysPayload = {};
  for (const [providerId, envVar] of Object.entries(KEY_MAP)) {
    const val = vars.get(envVar);
    if (val) keys[providerId] = val;
  }
  return NextResponse.json(keys);
}

// POST: save keys
export async function POST(req: Request) {
  const body: KeysPayload = await req.json();
  const vars = await readEnvFile();

  for (const [providerId, value] of Object.entries(body)) {
    const envVar = KEY_MAP[providerId];
    if (envVar && value) {
      vars.set(envVar, value);
    } else if (envVar && !value) {
      vars.delete(envVar);
    }
  }

  await writeEnvFile(vars);
  return NextResponse.json({ ok: true });
}
