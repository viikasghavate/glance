import { chat } from './llm.js';
import { getToolDefinitions, executeTool } from './tools.js';
import { SYSTEM_PROMPT } from './system.js';

const MAX_ITERATIONS = 6;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_CONTEXT_CHARS = 40000;

function boundHistory(history) {
  let messages = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: m.content || '' }));

  if (messages.length > MAX_CONTEXT_MESSAGES) {
    messages = messages.slice(messages.length - MAX_CONTEXT_MESSAGES);
  }

  let total = 0;
  const kept = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > MAX_CONTEXT_CHARS && kept.length > 0) break;
    kept.unshift(messages[i]);
  }
  return kept;
}

export async function runAssistant(user, history) {
  const prior = Array.isArray(history) ? history : [];
  const bounded = boundHistory(prior);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...bounded
  ];

  const toolDefs = getToolDefinitions();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await chat(messages, toolDefs);
    const msg = response.message || {};

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args = {};
        const rawArgs = call.function && call.function.arguments;
        if (rawArgs != null) {
          if (typeof rawArgs === 'string') {
            try { args = JSON.parse(rawArgs); } catch { args = {}; }
          } else if (typeof rawArgs === 'object') {
            args = rawArgs;
          }
        }
        const result = executeTool(call.function.name, user, args);
        messages.push({
          role: 'tool',
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }
      continue;
    }

    return msg.content || '';
  }

  return 'I could not complete that request.';
}
