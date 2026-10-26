"""US-47: one auction in, one JSON response out; diagnostics stay on stderr."""
import contextlib
import json
import os
import re
import sys


def main():
    checkout, cards, calls, dealer = sys.argv[1:]
    sys.path.insert(0, os.path.join(checkout, "src"))
    with contextlib.redirect_stdout(sys.stderr):
        from core.hand import Hand
        from core.callhistory import CallHistory
        from factory import BidderFactory

        hand = Hand.from_cdhs_string(cards)
        history = CallHistory.from_string(calls, dealer_char=dealer, vulnerability_string="None")
        selection = BidderFactory.default_bidder().call_selection_for(hand, history)
        if selection is None:
            result = dict(call=None, ruleId=None, explanation=None, provenance="not-covered")
        else:
            rule = getattr(selection, "rule", None)
            name = getattr(rule, "name", None)
            if callable(name):
                name = name()
            if not isinstance(name, str) or not name.strip():
                name = None
            rule_id = (name or repr(rule)) if rule is not None else None
            if rule_id:
                rule_id = re.sub(r" at 0x[0-9a-fA-F]+(?=>)", "", rule_id)
            # US-47.1: the rule's own explanation for this call; null when it has none.
            explain = getattr(rule, "explanation_for_bid", None)
            explanation = explain(selection.call) if callable(explain) else None
            if not isinstance(explanation, str) or not explanation.strip():
                explanation = None
            if name == "DefaultPass":
                # VAL-11: saycbridge's fallback when no rule applies is a marked abstention, not a rule.
                result = dict(call=selection.call.name, ruleId=None,
                              explanation="DefaultPass: no rule applies (engine fallback)", provenance="not-covered")
            else:
                result = dict(call=selection.call.name, ruleId=rule_id, explanation=explanation,
                              provenance="rule" if rule_id else "no-provenance")
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"saycbridge bridge failed: {error}", file=sys.stderr)
        sys.exit(1)
