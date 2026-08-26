const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.AI_MODEL || 'deepseek-v4-flash:cloud';
const API_KEY = process.env.OLLAMA_API_KEY || '';

export async function chat(messages, tools) {
  const body = {
    model: MODEL,
    messages,
    stream: false
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}
