---
name: core-comments
description: Make code self-explanatory; reserve comments for why, not how, and delete the rest
---

## Usage

Make the code self-explanatory first; reach for a comment only when the code can't speak for itself.

**Explain *why*, not *how*.** The code already shows *how*. A comment earns its place when it captures intent the code can't:

- the reason behind a non-obvious choice or tradeoff,
- a workaround, with a link to the issue,
- a warning about a non-obvious consequence.

```js
// Bad — restates the code (the "how")
// increment i by 1
i++;
// loop over users and send each an email
for (const u of users) sendEmail(u);

// Good — explains the "why" the code can't show
// Stripe rejects amounts over 999999; clamp before the call.
const amount = Math.min(total, 999999);
// Retry once: the upstream API drops the first request after idle. See JIRA-1421.
await retry(fetchToken, { attempts: 2 });
```

Prefer a better name over a comment:

```js
const d = 86400000; // ms in a day      ← name is vague, comment compensates
const MS_PER_DAY = 86_400_000;          ← name carries the meaning, no comment
```

Delete comments that narrate the code, restate the obvious, or have gone stale. A wrong comment is worse than none.

## Key Points

- If a comment only describes *what the next line does*, delete it and let the code stand.
- Good naming, small functions, and types remove most of the need for comments.
- Keep comments that encode *why* — they stay true across refactors that change the *how*.

<!--
Source references:
- https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md
-->
