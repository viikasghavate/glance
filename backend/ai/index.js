import { chat } from './llm.js';
import { getToolDefinitions, executeTool } from './tools.js';
import { SYSTEM_PROMPT } from './system.js';

const MAX_ITERATIONS = 6;

export async function runAssistant(user, userMessage) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
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
