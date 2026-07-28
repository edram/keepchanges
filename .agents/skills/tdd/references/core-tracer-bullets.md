---
name: core-tracer-bullets
description: Work in vertical slices (one behavior end-to-end) instead of horizontal slicing, and plan which behaviors to test first
---

## Usage

Work in vertical slices, not horizontal ones:

```
WRONG (horizontal)   all the tests, then all the code
  RED:   test1 test2 test3 test4
  GREEN: impl1 impl2 impl3 impl4

RIGHT (vertical)     one behavior end-to-end, then the next
  test1 → impl1 → test2 → impl2 → test3 → impl3
```

Writing every test up front tests *imagined* behavior. You commit to interfaces and data shapes before the implementation teaches you what actually matters, so the tests end up pinning down the *shape* of things rather than what the system *does* — and they pass when behavior breaks, break when it's fine.

The first vertical slice is a **tracer bullet**: one test through one minimal implementation that proves the whole path works end-to-end — test harness, wiring, and interface — before you build the rest out. Each later test then responds to what the previous cycle taught you.

Plan before the first test:

- Agree on the **public interface** — what a caller sees and calls.
- List the **behaviors** to test and prioritize them. You can't test everything; spend effort on critical paths and complex logic, not every trivial accessor.
- For anything non-trivial, confirm the interface and the priorities with the user before diving in.

## Key Points

- One-at-a-time beats batch precisely because each test is informed by code you just wrote — you know what matters and how to verify it.
- "List the behaviors" is not "list the implementation steps". Behaviors are observable from outside; steps are how you get there.
- A tracer bullet is minimal but real — it goes all the way through, it just does the simplest version.

<!--
Source references:
- https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
- https://github.com/NousResearch/hermes-agent/blob/main/skills/software-development/test-driven-development/SKILL.md
-->
