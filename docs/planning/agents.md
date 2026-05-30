# Agent Architecture Plan

This document defines the AI agents we plan to run, where their harness logic should live, and how they should share DGX Spark inference.

## Core decision

Decouple agent harness/orchestration from model inference.

```text
Dev server = agent/control plane
DGX Spark  = inference/data acceleration plane
```

The agent code should live on the dev server with the frontend/backend stack. The DGX Spark should run model serving and GPU data services.

```text
Dev server
  - WhatsApp frontend / OpenClaw or NemoClaw harness
  - LangGraph orchestration logic
  - HITL planning/chat agent logic
  - backend tools
  - SQLite
  - Redis
  - vector DB metadata / orchestration
  - conversation state and approval state

DGX Spark
  - shared vLLM server for the main agent LLM
  - embedding model service for 311 retrieval
  - GPU vector search/index service, if available
```

## Shared model serving plan

Run one shared OpenAI-compatible vLLM endpoint on the DGX Spark for the main LLM used by all agents.

```text
WhatsApp/OpenClaw or NemoClaw agent  ┐
LangGraph low-urgency agent          ├──> DGX Spark vLLM endpoint
HITL planning/advising chat agent    ┘
```

This avoids loading three copies of the same model. The agents share model weights but keep separate prompts, memory, tool state, conversation state, permissions, and approval state.

Important: embeddings should still use a dedicated embedding model/service. The three agents can share one LLM, but the 311 embedding pipeline should not depend on the chat model unless forced by time.

## Agent types

| Agent | Runtime / harness | Primary interface | Primary job | DGX usage |
|---|---|---|---|---|
| **WhatsApp intake agent** | OpenClaw and potentially NemoClaw/OpenShell | WhatsApp | Collect user service request details, ask clarifying questions, normalize request handoff to backend. | Calls shared vLLM through routed inference; may call embedding/search backend tools indirectly. |
| **Low-urgency indexing/scheduling proposal agent** | LangGraph on dev server | Backend/internal workflow | Handle low-risk 311 tasks after deterministic ranking: call tools, retrieve similar records, propose rough queue insertion/scheduling. | Calls shared vLLM only for planning/explanation; retrieval uses DGX embedding/vector services. |
| **HITL high-priority planning/advising agent** | NemoClaw/OpenShell preferred for safety, or dashboard agent harness | Web dashboard/operator chat | Help human operators reason about high-priority/high-liability requests, summarize evidence, ask for approvals, advise scheduling. | Calls shared vLLM for chat/advising over audited evidence. |

## Component integration

```text
WhatsApp
  -> OpenClaw/NemoClaw agent harness on dev server
  -> backend request tools
  -> DGX Spark vLLM via inference route

Web dashboard
  -> HITL planning/advising agent on dev server
  -> backend evidence/schedule tools
  -> DGX Spark vLLM

Backend scheduler/ranking
  -> LangGraph low-urgency agent on dev server
  -> tools: SQLite, Redis, vector search, scoring, audit logs
  -> DGX Spark vLLM only when reasoning/explanation is needed
```

## NemoClaw fit

NemoClaw is useful for sandboxed, always-on agents because it provides:

```text
sandboxing
egress policy
inference routing
messaging channel integration
agent lifecycle management
```

For WhatsApp/OpenClaw, the preferred shape is:

```text
WhatsApp channel
  -> OpenShell/NemoClaw sandbox
  -> agent calls inference.local
  -> OpenShell gateway routes to DGX Spark vLLM endpoint
```

This keeps the agent sandboxed while model inference runs on the Spark. Credentials and upstream model routing stay outside the sandbox.

## KV cache / session state stance

Do not pitch the architecture as "three agents with three KV caches." That is an implementation detail.

Better framing:

```text
The three agents share one resident model on DGX Spark through vLLM. Their prompts, histories, tools, and approval states remain separate on the dev server. vLLM manages request-level KV cache and batching internally.
```

Each active generation has separate request context/KV state inside vLLM. If prefix caching is enabled, repeated shared prompt prefixes may be reused, but this should not be central to the product story.

## Tool boundary rules

The LLM should not be the authority for priority, duplicate status, or schedule validity.

Agents may:

```text
collect and normalize request details
call 311 embedding/search tools
call deterministic ranking/scoring tools
call rough scheduling/queue insertion tools
summarize evidence
ask for human approval
explain decisions using audit logs
```

Agents must not:

```text
invent priority scores
invent duplicate matches
invent permit/constraint evidence
silently approve high-risk work
write schedules without backend tool output
claim global optimization without optimizer evidence
```

## Minimal implementation path

Build in this order:

1. Stand up DGX Spark vLLM OpenAI-compatible endpoint.
2. Make a tiny dev-server client that all agents can call.
3. Build the 311 embedding/vector-search path separately on DGX Spark.
4. Implement backend tools for dedupe/ranking/evidence retrieval.
5. Wire the LangGraph low-urgency agent to those tools.
6. Wire WhatsApp/OpenClaw or NemoClaw intake to request submission.
7. Wire dashboard/HITL chat to audited decisions and schedule proposals.

## Judging pitch

Lead with:

> The DGX Spark runs the shared local LLM, embedding service, and 311 vector index. The agent harnesses stay on the dev server where the tools, DBs, WhatsApp integration, and dashboard live. This lets multiple agents share one resident model while keeping city/citizen data local and every decision grounded in deterministic backend evidence.

Do not lead with:

> We run three separate chatbots on the GPU.
