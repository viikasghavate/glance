// RAG retrieval for the Glance assistant.
// Loads the prebuilt index (rag-index.json), embeds a query, and returns the
// most relevant context chunks via cosine similarity. Used to ground the local
// tiny model so it answers ONLY from Glance's own docs/schema.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLLAMA = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'nomic-embed-text';
const INDEX_PATH = process.env.RAG_INDEX_PATH || path.join(__dirname, 'rag-index.json');

let cache = null;

function loadIndex() {
  if (cache) return cache;
  if (!fs.existsSync(INDEX_PATH)) {
    throw new Error(`RAG index not found at ${INDEX_PATH}. Run: node backend/ai/rag-index.js`);
  }
  cache = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  return cache;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedQuery(text) {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  });
  if (!res.ok) throw new Error(`embed error ${res.status}`);
  return (await res.json()).embedding;
}

// Retrieve top-k chunks for a query. Returns [{source, text, score}].
export async function retrieve(query, k = 4) {
  const index = loadIndex();
  const qvec = await embedQuery(query);
  const scored = index.chunks
    .map(c => ({ source: c.source, text: c.text, score: cosine(qvec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return scored;
}

// Build a compact context string from retrieved chunks, with source labels.
export function formatContext(chunks) {
  return chunks
    .map((c, i) => {
      const label = path.basename(c.source);
      return `[Source ${i + 1}: ${label}]\n${c.text}`;
    })
    .join('\n\n---\n\n');
}

// True if the index exists (so callers can degrade gracefully).
export function indexExists() {
  return fs.existsSync(INDEX_PATH);
}
