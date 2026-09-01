// RAG-powered chat using a small local model.
// Retrieves relevant Glance context (SPEC docs + schema) and answers ONLY from it.
// Uses a tiny local model (default qwen2.5:1.5b) so it runs on this server's CPU.

import { retrieve, formatContext, indexExists } from './rag.js';

const OLLAMA = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const RAG_MODEL = process.env.RAG_MODEL || 'qwen2.5:1.5b';
const TOP_K = 4;

const RAG_SYSTEM = `You are the Glance documentation assistant. You answer questions ONLY about the Glance app (a project management tool with projects, tasks, sprints, milestones, portfolios, programs, an AI assistant, and an employee skills module).

Rules:
- Answer ONLY from the CONTEXT provided below. Never invent, guess, or hallucinate facts, names, counts, or features.
- If the CONTEXT does not contain the answer, reply: "I don't have that information in the Glance docs." and stop.
- If the question is unrelated to Glance (weather, recipes, general knowledge, coding help, etc.), reply that you can only help with questions about the Glance app, and stop.
- Be concise and factual. Use short, direct answers.`;

export async function ragChat(question) {
  if (!indexExists()) {
    return { reply: 'RAG index not built. Run: node backend/ai/rag-index.js', usedRag: false };
  }

  const chunks = await retrieve(question, TOP_K);
  const context = formatContext(chunks);

  const messages = [
    { role: 'system', content: RAG_SYSTEM },
    { role: 'user', content: `CONTEXT:\n${context}\n\n---\n\nQUESTION: ${question}` }
  ];

  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: RAG_MODEL, messages, stream: false })
  });

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json();
  const reply = (data.message && data.message.content || '').trim();

  return { reply, usedRag: true, sources: chunks.map(c => c.source) };
}
