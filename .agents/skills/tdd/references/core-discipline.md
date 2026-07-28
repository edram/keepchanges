---
name: core-discipline
description: The Iron Law, the delete-and-restart rule, and the rationalizations and red flags that signal you've drifted off test-first
---

## Usage

**The Iron Law: no production code without a failing test first.**

Wrote the code before the test? Delete it and start over. Not "keep it as reference", not "adapt it while I write the test", not "just look at it" — delete means delete. Code you keep will steer you into writing a test that describes what the code *does* instead of what it *should* do — which is exactly the failure TDD exists to prevent.

**Why order matters.** A test written after the code passes on the first run and proves nothing — you never saw it fail, so you don't know it *can*. Test-first forces you to state the expected behavior before you know how you'll implement it; tests-after only asks "what does this do?".

When the urge to skip strikes, it sounds like one of these:

| Rationalization | Reality |
|---|---|
| "Too simple to test" | Simple code still breaks. The test takes 30 seconds. |
| "I'll test after" | Tests written after pass immediately — they prove nothing. |
| "Tests-after achieve the same thing" | Tests-after ask "what does this do?"; tests-first ask "what should this do?". |
| "I already tested it manually" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting hours of work is wasteful" | Sunk cost. Keeping unverified code *is* the debt. |
| "Keep it as reference, write tests first" | You'll adapt it — that's testing after. Delete means delete. |
| "I need to explore first" | Fine. Throw the spike away, then start with TDD. |
| "It's hard to test" | Listen to the test: hard to test = hard to use. Fix the design. |
| "TDD will slow me down" | TDD is faster than debugging. Pragmatic *is* test-first. |
| "This existing code has no tests" | You're touching it — add the test for the behavior you change. |

**Red flags — stop and start over** the moment you notice:

- Code written before its test, or a test added "later"
- A new test that passes on the very first run
- You can't explain why the test failed
- "Just this once" / "I already tested it manually"
- "Keep it as reference" or "adapt the existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This case is different because…"

## Key Points

- The discipline is the point. "I'm being pragmatic, not dogmatic" is itself the most common red flag — it's the story you tell while abandoning the method.
- The law covers untested *existing* code too: when you change its behavior, write the failing test for that change first.
- Final test: every piece of production code has a test that existed and failed before it. If not, it isn't TDD.

<!--
Source references:
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
- https://github.com/NousResearch/hermes-agent/blob/main/skills/software-development/test-driven-development/SKILL.md
-->
