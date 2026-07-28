---
name: core-cycle
description: The RED-GREEN-REFACTOR loop, the mandate to watch each test fail, and the per-cycle checklist
---

## Usage

Run the loop one behavior at a time:

```
RED       Write one failing test for the next behavior.
          Run it. Watch it fail — for the reason you expect.
GREEN     Write the minimum code to make it pass. Nothing more.
          Run it. Watch it pass, with no regressions.
REFACTOR  Clean up with the suite green. Re-run after each step.
```

**RED** — one behavior, a name that states that behavior, real code. Verifying the failure is mandatory, not optional: a test you never watched fail might be green for the wrong reason — asserting nothing, hitting the wrong target, or silently skipped. If you can't explain *why* it failed, you don't yet have a test.

**GREEN** — only enough code to pass *this* test. Don't add features, handle cases no test demands, or "improve" neighbouring code while you're here. Hard-coding a return to get green is allowed; the next test forces it open.

**REFACTOR** — only once green. Candidates: extract duplication, deepen a module (hide complexity behind a smaller interface), rename for clarity. Refactor test code too — duplicated setup, vague names. Never refactor while red; get back to green first.

Per-cycle checklist:

```
[ ] Test names the behavior, not the implementation
[ ] Watched it fail for the expected reason
[ ] Minimal code to pass — nothing speculative
[ ] All tests green, output clean (no stray errors or warnings)
```

## Key Points

- "Minimal" is measured against *this* test, not the whole feature — the next test drives the next code.
- A cycle takes minutes, not hours. If RED drags, the step is too big; shrink the behavior.
- Never refactor while red — mixing a structural change into a failing state hides which one broke things.

<!--
Source references:
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
- https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
-->
