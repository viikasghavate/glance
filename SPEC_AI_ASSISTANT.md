# Glance AI Assistant — Plan & Spec (SPEC_AI_ASSISTANT.md)

**Goal:** Add an AI assistant to Glance that (1) answers questions **only about Glance data**, and (2) [V2] performs **CRUD operations only inside Glance**, scoped to the logged-in user's permissions. No general knowledge, no access outside the app.

**Status:** Scope approved. **V1 = read-only Q&A.** Not yet implemented.

**Locked decisions (2026-08-26):**
1. Provider = **local Ollama** (cloud models, existing key/config — no new key)
2. **Read-only V1** — Q&A only. **No CRUD tools in V1.** CRUD deferred to V2.
3. Available to **all members**.
4. UI = **bottom-right slide-out chat panel**.
5. Model = existing Ollama cloud, default **`deepseek-v4-flash:cloud`** (free/cheap, already the OpenClaw default). Fallback `qwen3.5:397b-cloud`.

---

## 1. What "trained on this app only" really means

Do **not** fine-tune a model. Fine-tuning is expensive, slow to update, and wrong for a personal/small app. Instead use **grounding + strict tool whitelist**, which gives the same "only knows this app" behavior with zero training cost and instant updates:

- **System prompt** declares the assistant is *"Glance Assistant — you only know about this Glance workspace. Answer only from the data and tools provided. If a question is unrelated to Glance (recipes, weather, general knowledge), reply that you can only help with Glance projects/tasks and stop."* This makes it refuse off-topic queries by construction.
- **RAG-lite context:** before answering, the backend fetches the *relevant* Glance records (via search + tool results) so answers are grounded in real data — never hallucinated.
- **Strict tool schema:** the model can only call a whitelist of functions that map 1:1 to existing Glance read routes. There is no way for the model to reach anything outside that whitelist. This is the real "scoped to the app" guarantee.

Result: answers are factual to *your* data, off-topic prompts are refused, and nothing outside Glance is ever touched.

---

## 2. Architecture

```
┌─────────────┐   prompt    ┌────────────────────────────────────────────┐
│  Frontend   │ ──────────▶ │  POST /api/ai/chat   (requireAuth)         │
│  chat panel │ ◀────────── │  ┌──────────────────────────────────────┐  │
└─────────────┘   reply     │  │ AI router (backend/routes/ai.js)     │  │
                            │  │ 1. call LLM with system prompt +     │  │
                            │  │    conversation + tool definitions    │  │
                            │  │ 2. LLM returns tool_calls or text     │  │
                            │  │ 3. execute tool(s) via ToolRegistry   │  │
                            │  │    (V1: read-only, reuses db.js +     │  │
                            │  │     requireAuth + activity_log)       │  │
                            │  │ 4. feed tool results back, loop until │  │
                            │  │    final answer; return answer         │  │
                            │  └──────────────────────────────────────┘  │
                            └────────────────────────────────────────────┘
```

### New files
- `backend/ai/llm.js` — Ollama client. One function: `chat(messages, tools)` → `http://127.0.0.1:11434/api/chat`.
- `backend/ai/tools.js` — **ToolRegistry**: whitelist of `{ name, description, parameters(schema), handler(user, args) }`. V1 = read-only handlers over `db.js`. Every query logged to `activity_log` (audit).
- `backend/ai/system.js` — the system prompt (scope lock + guardrails).
- `backend/ai/index.js` — orchestrator: runs the tool-call loop, returns final text.
- `backend/routes/ai.js` — Express route, mounted under `requireAuth`.
- `frontend/src/components/AIChatPanel.jsx` + `AIChatPanel.css` — bottom-right slide-out chat UI.
- `backend/package.json` — add Ollama HTTP usage (native `fetch`, no new dep needed).

### The tool loop (agent pattern)
1. Post `{ messages }` → router builds system prompt + user messages.
2. Call LLM with tool schemas. LLM returns text or `tool_calls`.
3. For each tool call: find handler, run it (V1 read-only; auth already enforced by `requireAuth` on the route), get result JSON.
4. Append tool results as new messages; call LLM again. Repeat (max ~6 iterations, loop guard).
5. Return `{ reply }` to the UI.

---

## 3. LLM provider — DECIDED: local Ollama (cloud models)

Glance backend calls the same local Ollama gateway OpenClaw uses: `http://127.0.0.1:11434`, auth via `OLLAMA_API_KEY` env (already configured on the VPS). The Ollama gateway proxies **cloud** models, so we get cloud quality with the existing Ollama API — no separate/extra key.

**Model (V1): `deepseek-v4-flash:cloud`** — free/cheapest tier, fast, decent tool-calling; already the OpenClaw default. Fallback if refusal/tool-calling quality is weak: `qwen3.5:397b-cloud`.

Container env: `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_API_KEY=<from existing env>`, `AI_MODEL=deepseek-v4-flash:cloud`.

> Note: in V1 (read-only) no write tools exist, so the strongest tool-calling reliability isn't critical — Q&A + query tools only.

---

## 4. Tool registry — V1 = READ-ONLY (Q&A only)

**V1 exposes ONLY query tools. No create/update/delete.** CRUD tools are deferred to V2.

**Query / Q&A tools (V1)**

| Tool | Maps to | Auth |
|---|---|---|
| `list_projects` | `GET /api/projects` | auth |
| `get_project` | `GET /api/projects/:id` | auth |
| `list_tasks(project_id?, status?, assignee?)` | `GET /api/tasks/project/:id` (+filters) | auth |
| `get_task` | task detail (deps, checklist, labels, watchers) | auth |
| `list_sprints`, `list_milestones` | sprint/milestone routes | auth |
| `search` | `GET /api/search?q=` | auth |
| `analytics` | `GET /api/analytics` | auth |
| `get_activity` | `GET /api/activity` | auth |

**CRUD tools — DEFERRED to V2** (create_project, create_task, update_task, add_comment, create_sprint/milestone, add_checklist_item, add_time_entry, update_project). Will be added after V1 Q&A ships and is validated. Deletes + user/role management stay blocked (admin-only) in all versions.

---

## 5. Frontend

- **AIChatPanel** — floating button (bottom-right) opens a slide-out chat drawer. Neon theme (matches existing CSS vars: `--bg-card`, `--border`, `--primary`/cyan, `--violet`).
- Message list (user + assistant bubbles), input box, "thinking" indicator.
- Uses existing `apiFetch` from `AuthContext` (already attaches JWT) → AI calls are authenticated as the current user.
- V1: plain Q&A replies. Action chips deferred to V2 (no writes yet).

---

## 6. Security & correctness checklist

- [ ] `/api/ai/*` behind `requireAuth` (JWT) — same as every route.
- [ ] V1 = **no write tools at all**; only read handlers. (Zero CRUD risk by construction.)
- [ ] Every read query enforces `deleted_at IS NULL` / `archived` filters like the existing routes.
- [ ] No free-form SQL; tool handlers call the same prepared statements as routes.
- [ ] All AI interactions logged to `activity_log` with the calling user as actor.
- [ ] Rate-limit `/api/ai` (in-memory or `express-rate-limit`) to avoid runaway LLM spend/abuse.
- [ ] Max tool-call iterations (loop guard) to prevent infinite loops.
- [ ] Truncate tool outputs before re-sending to LLM (cap tokens) to bound context.
- [ ] Off-topic refusal enforced in system prompt; test with obvious non-Glance queries.

---

## 7. Implementation phases (delegate to OpenCode per phase)

**Phase 1 — Backend core (spec-ready for OpenCode)**
Objective: `/api/ai` endpoint that answers app-scoped questions ONLY (read-only).
- Files: `backend/ai/llm.js`, `backend/ai/tools.js` (read-only registry), `backend/ai/system.js`, `backend/ai/index.js`, `backend/routes/ai.js`.
- Wire to existing `db.js`, `requireAuth`, `activity_log` (log the Q&A prompt for audit).
- Provider: Ollama (`LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `AI_MODEL=deepseek-v4-flash:cloud`).
- Success criteria: smoke — ask "how many tasks are in project X", "what's the status of task Y", "show overdue tasks", off-topic query refused. No write tools present.

**Phase 2 — Frontend chat panel**
- `AIChatPanel.jsx/css`, bottom-right slide-out, neon theme, uses `apiFetch`.
- Success: user can chat and sees app-scoped replies.

**Phase 3 — Hardening & polish**
- Rate limit, token caps, tool-output truncation, loop guard, off-topic refusal tests, empty/error states, settings toggle to enable/disable AI.
- After V1 validated → plan V2 CRUD tools.

---

## 8. Decisions (locked 2026-08-26)

1. Provider: **local Ollama** (cloud models, no new key).
2. **Read-only V1** — Q&A only; no CRUD tools in V1. CRUD deferred to V2.
3. Available to **all members**.
4. UI: **bottom-right slide-out chat panel**.
5. Model: **`deepseek-v4-flash:cloud`** (free/cheap, existing config). Fallback `qwen3.5:397b-cloud`.
