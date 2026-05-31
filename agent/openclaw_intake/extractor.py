"""Fact extraction + next-step decision via Ollama JSON mode.

Calls `gemma4:26b` (or whatever INFERENCE_MODEL is) through inference.local
inside the NemoClaw sandbox. The model is asked to:

  1. update the running fact set from the new user message,
  2. decide whether to submit or ask one follow-up question.

`unknown` safety answers MUST stay `unknown` unless the user explicitly
answered. The prompt is explicit about this and refuses to invent locations
the user did not provide.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict
from typing import Any

import httpx

from state import ConversationFacts, SAFETY_KEYS

SYSTEM_PROMPT = """\
You are the 311 Toronto WhatsApp intake assistant. Your job is to collect
FACTS from a citizen describing a city issue. You do NOT classify the issue
category, urgency, or duplicate status — the backend does that.

REQUIRED FACTS:
- description: what the user is reporting (their own words, cleaned up)
- location: at least raw_text OR an intersection / FSA / address
- safety_answers: seven keys, each yes / no / unknown. NEVER guess. If the
  user didn't say, the value is "unknown".

OPTIONAL FACTS:
- observed_at (ISO-8601 if the user gave a time)
- media_refs (server media IDs we already received)

You have at most 3 follow-up questions per conversation. After that, submit
with whatever you have.

You MUST output a single JSON object with this shape, and nothing else:

{
  "updated_facts": {
    "description": "...",
    "location": {
      "raw_text": "...",
      "intersection_street_1": "...",
      "intersection_street_2": "...",
      "postal_code_or_fsa": "...",
      "ward": null,
      "latitude": null,
      "longitude": null
    },
    "observed_at": null,
    "safety_answers": {
      "injury": "unknown", "active_danger": "unknown",
      "blocking_road": "unknown", "blocking_sidewalk": "unknown",
      "flooding": "unknown", "sewage_or_water_issue": "unknown",
      "traffic_signal_issue": "unknown"
    }
  },
  "next_action": "ask" | "submit",
  "follow_up": "the next question, or null if next_action is submit"
}
"""


async def extract_and_decide(
    *,
    inference_base_url: str,
    inference_model: str,
    facts: ConversationFacts,
    new_user_message: str,
) -> dict[str, Any]:
    """Run one extraction turn. Returns the parsed JSON object.

    The caller (main.py) merges `updated_facts` back into ConversationFacts
    and acts on `next_action`.
    """
    user_block = json.dumps(
        {
            "current_facts": {
                "description": facts.description,
                "location": asdict(facts.location),
                "observed_at": facts.observed_at,
                "safety_answers": dict(facts.safety_answers),
            },
            "follow_ups_remaining": max(0, 3 - facts.follow_ups_sent),
            "new_user_message": new_user_message,
        },
        ensure_ascii=False,
    )

    payload = {
        "model": inference_model,
        "stream": False,
        # OpenAI-compatible JSON mode. Ollama honors this on /v1, and the
        # NemoClaw gateway only forwards /v1/** paths.
        "response_format": {"type": "json_object"},
        # gemma4 emits a `reasoning` block before `content`; budget for both
        # or the extracted JSON will come back empty (finish_reason=length).
        "max_tokens": 3000,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_block},
        ],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        # OpenAI-compatible chat completions. Works both inside the sandbox
        # (http://host.openshell.internal:11434/v1/chat/completions, routed
        # through the local-inference preset) and outside against Ollama
        # directly (http://<gx10-tailscale-ip>:11434/v1/chat/completions).
        r = await client.post(
            f"{inference_base_url}/v1/chat/completions", json=payload
        )
        r.raise_for_status()
        data = r.json()

    # OpenAI shape: choices[0].message.content. With JSON mode the content is
    # a JSON string.
    content = (data.get("choices", [{}])[0].get("message", {}).get("content") or "{}").strip()
    if content.startswith("```"):
        content = re.sub(r"^```[a-zA-Z]*\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # The LLM violated the schema. Fail-soft: return a no-op update and a
        # generic ask. Real implementations should log this and consider a
        # second-shot retry with a stricter prompt.
        return {
            "updated_facts": None,
            "next_action": "ask",
            "follow_up": "Could you tell me a bit more about what you're seeing and where?",
        }


def merge_updated_facts(facts: ConversationFacts, updated: dict[str, Any]) -> None:
    """Mutate `facts` in place with the LLM's updated_facts block.

    Defensive: silently skips fields whose types don't match, never coerces
    `unknown` → anything else for safety answers.
    """
    if not isinstance(updated, dict):
        return

    desc = updated.get("description")
    if isinstance(desc, str) and desc.strip():
        facts.description = desc.strip()

    loc = updated.get("location")
    if isinstance(loc, dict):
        for attr in (
            "raw_text",
            "intersection_street_1",
            "intersection_street_2",
            "postal_code_or_fsa",
            "ward",
        ):
            v = loc.get(attr)
            if isinstance(v, str) and v.strip():
                setattr(facts.location, attr, v.strip())
        for attr in ("latitude", "longitude"):
            v = loc.get(attr)
            if isinstance(v, (int, float)):
                setattr(facts.location, attr, float(v))

    obs = updated.get("observed_at")
    if isinstance(obs, str) and obs.strip():
        facts.observed_at = obs.strip()

    sa = updated.get("safety_answers")
    if isinstance(sa, dict):
        for k in SAFETY_KEYS:
            v = sa.get(k)
            if v in ("yes", "no", "unknown"):
                facts.safety_answers[k] = v  # type: ignore[assignment]
