---
name: coding
description: Constraints for writing and editing code with discipline — favor minimal code, surgical scope, self-explanatory naming, and purposeful comments. Use when implementing a feature, writing or editing code, refactoring, simplifying, cleaning up, adding a function, or reviewing changes for over-engineering and scope creep.
metadata:
  author: edram
  version: 2026.06.25
---

A set of constraints an agent applies *while* producing code, biased toward less code and tighter scope. Distilled from Andrej Karpathy's coding guidelines and Sentry's code-simplifier, plus an explicit comment discipline. The aim is the opposite of most AI failure modes: not more features, more abstraction, more lines — but the smallest change that provably solves what was asked.

- **Think before coding** — surface assumptions and the simpler option before writing a line.
- **Write the minimum** code that solves the *stated* problem; nothing speculative.
- **Keep changes surgical** — every changed line traces directly to the request.
- **Code should be self-explanatory**; comments explain *why*, not *how*.
- **Define success criteria and verify** before claiming done.

## Core

| Topic | Description | Reference |
|-------|-------------|-----------|
| Simplicity | Minimum code, no speculation, no over-simplification into cleverness | [core-simplicity](references/core-simplicity.md) |
| Scope | Surgical edits, match existing conventions, preserve behavior | [core-scope](references/core-scope.md) |
| Comments | Self-explanatory code; explain *why* not *how*; cut noise | [core-comments](references/core-comments.md) |

## Features

| Topic | Description | Reference |
|-------|-------------|-----------|
| Think First | Clarify intent, surface assumptions and tradeoffs before coding | [features-think-first](references/features-think-first.md) |
| Verify | Define verifiable success criteria; loop until proven, not just written | [features-verify](references/features-verify.md) |

<!--
Source references:
- https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md
- https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md
-->
