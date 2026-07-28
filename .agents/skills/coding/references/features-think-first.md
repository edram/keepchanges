---
name: features-think-first
description: Surface assumptions, interpretations, and the simpler option before writing code
---

## Usage

Before writing code, make the goal and your reading of it explicit.

- **State assumptions; ask when uncertain.** Don't silently fill gaps in a request — name the gap.
- **Present interpretations, don't guess.** If a request has multiple readings, lay them out instead of committing to one silently.
- **Offer the simpler path.** If there's a smaller solution than what was asked, say so and push back before building the larger one.
- **Name confusion early.** If something doesn't add up, stop and surface it rather than coding around it.

```
# Request: "add caching to the API client"

Surface before coding:
- Assumption: an in-memory per-process cache is enough (no Redis)?
- Interpretation A: cache GET responses by URL.  B: memoize the auth token only.
- Simpler option: the only repeated call is the token — memoizing just that may be all you need.

→ confirm scope, then implement.
```

Tradeoff: this favors a short pause over charging ahead. Strong, explicit success criteria let you proceed without re-checking; weak ones mean you ask first.

## Key Points

- A 20-second clarification beats reverting a 200-line wrong guess.
- Multiple plausible interpretations → present them; don't pick one silently.
- Pushing back on overcomplication is part of the job, not overstepping.

<!--
Source references:
- https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
-->
