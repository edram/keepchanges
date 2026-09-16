---
name: core-style
description: Voice, sentence, terminology, and evidence rules for consistent technical prose
---

## Usage

Match the repository's language and terminology. When no clear convention exists:

- Use active voice and present tense; use imperative verbs for instructions.
- Put the subject and action early, with conditions beside the action they govern.
- Address readers consistently as "you" in user-facing instructions.
- Use `can` for capability, `should` for recommendation, and `must` for requirements.
- Prefer complete sentences and concrete words; fragments are acceptable in parallel lists.

Use one term for one concept and preserve exact names for products, commands, options,
environment variables, and APIs. Qualify claims to match the available evidence:

```text
Verified:  Supports JSON output through --json.
Qualified: Designed to reduce repeated configuration.
Avoid:     The fastest and easiest tool available.
```

When revising, preserve the project's recognizable voice unless inconsistency is the problem.

## Key Points

- Clarity outranks brevity, but each paragraph needs one reader purpose.
- Explain why when it affects a choice, constraint, risk, or non-obvious behavior.
- Remove filler, repetition, unsupported superlatives, and prose that restates nearby code.

<!--
Source references:
- https://github.com/onmax/nuxt-skills/blob/main/skills/document-writer/SKILL.md
-->
