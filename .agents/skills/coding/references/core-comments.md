---
name: core-comments
description: Require comments for important intent, contracts, sources, and opaque logic; remove narration
---

## Usage

Inspect the project's instructions, adjacent code, and tooling first. Match its comment language, documentation syntax, placement, and tags.

Make the code self-explanatory first, then comment deliberately and conservatively. A comment is required when removing it would likely cause misuse, a mistaken edit, lost attribution, or force a maintainer to reconstruct important intent. Importance is relative to the declaration's own scope: a local variable can be critical, while a global type can be obvious.

Keep two purposes distinct:

- **Inline comments** preserve intent the code cannot express: *why*, constraints, risks, invariants, and non-obvious consequences.
- **Documentation comments** describe an important declaration's meaning, contract, valid uses, and behavioral variants. This is not line-by-line narration.

### Required comments

Add a comment for:

- **External sources.** When code is copied, ported, adapted, or materially based on a website or repository, state the relationship and include the exact page or a stable commit permalink. Use the project's native documentation form (`@see`, Javadoc, KDoc, JSDoc, or equivalent); otherwise use `Adapted from:`, `Ported from:`, `Based on:`, or `See:`. Preserve any required copyright or license notice—a URL is not a substitute for license compliance.
- **Important variables at any scope.** Document variables that carry key state, business rules, invariants, units or encodings, lifecycle boundaries, snapshots, or concurrency semantics. Record the context that naming and types cannot preserve; do not restate either one.
- **Important types and fields.** Document types that define central domain concepts, ownership, state models, protocols, or usage constraints. Comment an individual field only when that field has independently important semantics; do not comment every field merely because its type is important.
- **Critical or multi-meaning methods.** Document key methods, overloads, distinct operating modes, non-obvious side effects or errors, and required call ordering. Distinguish the contract of each meaning without repeating the implementation.
- **Intrinsically opaque logic.** Document difficult algorithms, regular expressions, compatibility paths, workarounds, and performance, security, or concurrency boundaries. Explain the model, reason, or invariant needed to verify the logic—not each step.

A declaration is not important merely because it is global, exported, a type, or a method. Obvious local values, plain data fields, simple accessors, and straightforward control flow need no comment.

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

Before finishing, audit the changed code only:

1. Add any required source, declaration, or reasoning comment that is missing.
2. Remove comments that merely translate the next statement or repeat a name or type.
3. Confirm retained comments still match the code, project conventions, and linked source.

## Key Points

- If a comment only describes *what the next line does*, delete it and let the code stand.
- Good naming, small functions, and types remove most narration, but do not replace important intent or contracts.
- Apply importance contextually and conservatively; neither comment everything nor default to no comments.
- Keep comments that encode *why*, constraints, contracts, and attribution—they survive changes to the *how*.

<!--
Source references:
- https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md
- https://google.github.io/styleguide/docguide/best_practices.html
- https://go.dev/doc/comment
- https://docs.oracle.com/en/java/javase/20/docs/specs/javadoc/doc-comment-spec.html
- https://kotlinlang.org/docs/kotlin-doc.html
-->
