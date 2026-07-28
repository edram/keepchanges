---
name: features-verify
description: Define verifiable success criteria and loop until proven, not just written
---

## Usage

Turn the task into something you can *check*, then don't claim done until it's checked.

1. **Define success criteria** up front — concrete and observable (`GET /users/:id` returns 404 for a missing id, not "handle missing users").
2. **State a brief plan** with the verification step baked in.
3. **Loop until verified** — run the code, run the tests, exercise the path; fix and re-run until the criteria pass.

```
Goal: parseDuration("1h30m") → 5400 seconds

Plan:
1. implement parseDuration
2. verify: run it on "1h30m", "45s", "" (expect 5400, 45, error)
3. loop until all three match
```

Report honestly: if a check fails, say so with the output; if a step was skipped, say that. "Done" means *verified*, not *written*.

## Key Points

- Observable criteria (exact output, status code, exit code) beat vague ones — they let you self-check without asking.
- Prefer the cheapest real signal: run the function, hit the endpoint, run the test — not "looks right."
- No way to verify? That's a sign the goal is underspecified — go back to [features-think-first](features-think-first.md).

<!--
Source references:
- https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
-->
