---
name: core-simplicity
description: Write the minimum code that solves the stated problem, without over-simplifying into cleverness
---

## Usage

Write the minimum code that solves the *stated* problem — nothing speculative.

Cut before you add:

- No features beyond what was asked.
- No abstraction for a single caller — inline it until a second caller exists.
- No "flexibility", config, or options nobody requested.
- No handling for states or errors that cannot occur.

```js
// Asked: "return the user's full name"

// Over-engineered — speculative options + abstraction for one caller
function formatName(user, opts = { order: "first-last", uppercase: false }) {
  const parts = opts.order === "last-first" ? [user.last, user.first] : [user.first, user.last];
  const joined = parts.filter(Boolean).join(" ");
  return opts.uppercase ? joined.toUpperCase() : joined;
}

// Minimal — solves exactly what was asked
function fullName(user) {
  return `${user.first} ${user.last}`;
}
```

The senior-engineer check: before finishing, ask *"would a senior engineer call this overcomplicated?"* If yes, simplify.

**Balance — don't over-correct.** Simpler is not shorter or cleverer. Avoid:

- Code-golfed one-liners that hide intent.
- Nested ternaries — use `if`/`else` or `switch`.
- Deleting a genuinely helpful abstraction just to cut lines.

```js
// Too clever — optimized for line count, hurts reading
const label = s ? (s === "x" ? a : s === "y" ? b : c) : d;

// Clearer — explicit beats compact
let label = d;
if (s === "x") label = a;
else if (s === "y") label = b;
else if (s) label = c;
```

## Key Points

- "Minimum" is measured against the *stated* problem, not an imagined future one — YAGNI.
- Two callers justify an abstraction; one does not.
- Clarity wins over brevity. Line count is not the goal; the goal is the simplest code a reader can follow.

<!--
Source references:
- https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
- https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md
-->
