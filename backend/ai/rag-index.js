// RAG index builder for Glance.
// Reads the app's context sources (SPEC files + db schema + routes), chunks them,
// embeds each chunk with nomic-embed-text, and writes a JSON index to disk.
//
// Usage: node rag-index.js [--rebuild]
//   - Writes backend/ai/rag-index.json (or RAG_INDEX_PATH env)
//   - Idempotent: skips files whose mtime+size hash is unchanged unless --rebuild

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OLLAMA = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'nomic-embed-text';
const INDEX_PATH = process.env.RAG_INDEX_PATH || path.join(__dirname, 'rag-index.json');
const CHUNK_SIZE = 800;   // chars per chunk
const CHUNK_OVERLAP = 120;

async function embed(text) {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  });
  if (!res.ok) throw new Error(`embed error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  return d.embedding;
}

function chunkText(text, source, fileHash) {
  const chunks = [];
  const clean = text.replace(/\r\n/g, '\n');
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    // try to break at a newline near the boundary
    if (end < clean.length) {
      const nl = clean.lastIndexOf('\n', end);
      if (nl > start + CHUNK_SIZE * 0.5) end = nl;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push({ source: relLabel(source), fileHash, text: piece });
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// Store a portable relative label (e.g. "SPEC_EMPLOYEE_SKILLS.md" or "backend/db.js")
// instead of an absolute path, so the index works in the container too.
function relLabel(p) {
  const rel = path.relative(REPO_ROOT, p);
  return rel.startsWith('..') ? path.basename(p) : rel;
}

function collectSources() {
  const sources = [];
  // SPEC files
  const specDir = REPO_ROOT;
  for (const f of fs.readdirSync(specDir)) {
    if (/^SPEC_.*\.md$/.test(f)) {
      sources.push({ path: path.join(specDir, f), label: f });
    }
  }
  // db.js schema (the CREATE TABLE block) — extract for schema Q&A
  const dbPath = path.join(REPO_ROOT, 'backend', 'db.js');
  if (fs.existsSync(dbPath)) {
    const dbSrc = fs.readFileSync(dbPath, 'utf8');
    // grab the CREATE TABLE block
    const m = dbSrc.match(/db\.exec\(`([\s\S]*?)`\);/);
    if (m) {
      sources.push({ path: dbPath, label: 'db.js (schema)', content: 'Glance database schema:\n' + m[1] });
    }
  }
  // routes list (endpoint map)
  const routesDir = path.join(REPO_ROOT, 'backend', 'routes');
  if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    const routeMap = routeFiles.map(f => `Route file: ${f}`).join('\n');
    sources.push({ path: routesDir, label: 'routes (index)', content: 'Glance backend route files:\n' + routeMap });
  }
  return sources;
}

function fileHash(p) {
  const st = fs.statSync(p);
  return crypto.createHash('md5').update(`${st.mtimeMs}:${st.size}`).digest('hex');
}

async function main() {
  const rebuild = process.argv.includes('--rebuild');
  const sources = collectSources();

  // Load existing index to skip unchanged files
  let existing = { chunks: [], fileHashes: {} };
  if (!rebuild && fs.existsSync(INDEX_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8')); } catch {}
  }

  const newChunks = [];
  const fileHashes = { ...(existing.fileHashes || {}) };
  let changed = false;

  for (const src of sources) {
    const content = src.content || fs.readFileSync(src.path, 'utf8');
    const hash = fileHash(src.path);
    if (!rebuild && existing.fileHashes && existing.fileHashes[src.path] === hash) {
      // unchanged — keep existing chunks for this source
      newChunks.push(...(existing.chunks.filter(c => c.source === src.path)));
      continue;
    }
    changed = true;
    fileHashes[src.path] = hash;
    const chunks = chunkText(content, src.path, hash);
    console.log(`  chunking ${src.label}: ${chunks.length} chunks`);
    newChunks.push(...chunks);
  }

  if (!changed && !rebuild) {
    console.log('No source files changed. Index is up to date.');
    return;
  }

  console.log(`Embedding ${newChunks.length} chunks with ${EMBED_MODEL}...`);
  const embedded = [];
  for (let i = 0; i < newChunks.length; i++) {
    const c = newChunks[i];
    const vec = await embed(c.text);
    embedded.push({ ...c, embedding: vec });
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${newChunks.length}`);
  }

  const index = { model: EMBED_MODEL, builtAt: new Date().toISOString(), fileHashes, chunks: embedded };
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  console.log(`Wrote ${INDEX_PATH} (${embedded.length} chunks)`);
}

main().catch(e => { console.error('RAG index build failed:', e.message); process.exit(1); });
