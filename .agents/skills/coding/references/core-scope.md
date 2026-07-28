---
name: core-scope
description: Keep changes surgical — touch only what the task requires and preserve existing behavior
---

## Usage

Touch only what the task requires. Every changed line should trace directly to the request.

When editing existing code:

- Don't refactor, reformat, or "improve" code you weren't asked to change — even if it's adjacent.
- Match the file's existing style and conventions (naming, error handling, structure); don't impose your own.
- Preserve behavior: a refactor changes *how*, never *what*. Same inputs → same outputs.

Clean up only your own mess:

- Remove imports, variables, and helpers that *your* edits made unused.
- Leave pre-existing dead code alone — mention it, don't delete it unasked.

```diff
  function priceWithTax(amount, rate) {
-   const t = amount * rate
-   return amount + t
+   return amount + amount * rate
  }

# Bad:  also reformatting the untouched function below "while I'm here"
# Good: stop at the function you were asked to change
```

## Key Points

- Adjacent is not in scope. A messy neighbor is not your task.
- Surface unrelated problems (dead code, a bug, a smell) as a note and let the user decide — don't fix them silently.
- If a change seems to *require* touching unrelated code, treat that as a signal to ask first.

<!--
Source references:
- https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
- https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md
-->
