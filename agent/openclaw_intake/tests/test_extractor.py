"""Light tests for the fact-merger.

We don't hit Ollama in tests — that's covered by the integration smoke test
in the runbook. Here we just confirm the merge logic refuses to coerce
`unknown` and accepts well-formed updates.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from extractor import merge_updated_facts  # noqa: E402
from state import ConversationFacts  # noqa: E402


def test_merge_sets_description():
    f = ConversationFacts(sender_id_hash="sha256:test")
    merge_updated_facts(f, {"description": "Pothole at Bay and King"})
    assert f.description == "Pothole at Bay and King"


def test_merge_preserves_unknown_safety():
    f = ConversationFacts(sender_id_hash="sha256:test")
    # Model omits the safety block — we must not coerce existing values.
    merge_updated_facts(f, {"description": "x"})
    assert all(v == "unknown" for v in f.safety_answers.values())


def test_merge_accepts_explicit_yes_no():
    f = ConversationFacts(sender_id_hash="sha256:test")
    merge_updated_facts(
        f,
        {
            "safety_answers": {
                "injury": "yes",
                "blocking_road": "no",
                "traffic_signal_issue": "unknown",
            }
        },
    )
    assert f.safety_answers["injury"] == "yes"
    assert f.safety_answers["blocking_road"] == "no"
    assert f.safety_answers["traffic_signal_issue"] == "unknown"
    # Untouched keys remain unknown
    assert f.safety_answers["flooding"] == "unknown"


def test_merge_rejects_garbage_safety_value():
    f = ConversationFacts(sender_id_hash="sha256:test")
    merge_updated_facts(f, {"safety_answers": {"injury": "maybe"}})
    assert f.safety_answers["injury"] == "unknown"


def test_merge_sets_intersection():
    f = ConversationFacts(sender_id_hash="sha256:test")
    merge_updated_facts(
        f,
        {
            "location": {
                "raw_text": "Bay and King",
                "intersection_street_1": "Bay St",
                "intersection_street_2": "King St W",
                "postal_code_or_fsa": "M5H",
            }
        },
    )
    assert f.location.raw_text == "Bay and King"
    assert f.location.intersection_street_1 == "Bay St"
    assert f.location.intersection_street_2 == "King St W"
    assert f.location.postal_code_or_fsa == "M5H"
