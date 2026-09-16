---
name: core-audience
description: Reader contracts, scope boundaries, and separation of project audiences
---

## Usage

Set one reader contract before outlining:

```text
After reading this, <primary reader> can <specific outcome> without <avoidable obstacle>.
```

Classify content against that contract:

1. **Required now** — needed for the promised outcome.
2. **Useful next** — place after the main path or link to a focused guide.
3. **For another reader** — move to a labeled section or another document.

| Primary reader | Main question | Typical destination |
|----------------|---------------|---------------------|
| Evaluating developer | Does this solve my problem and fit my environment? | README opening and requirements |
| Adopting developer | How do I install it and get the first result? | Quick start or user guide |
| Operator | How do I configure, secure, deploy, and troubleshoot it? | Operations guide |
| Contributor | How do I build, test, and change it safely? | Contributor or development guide |
| Reviewer | Why does this change exist, how was it checked, and what is risky? | Pull request description |
| Future maintainer | Why was this change made? | Commit body or decision record |

Give each section one primary reader. When an artifact serves several audiences, label their
paths or split the content. Set assumed knowledge once and define only terms the primary reader
may not know.

## Key Points

- Organize content by reader task, not source-tree or implementation order.
- Preserve secondary content by moving or linking it rather than silently deleting it.

<!--
Source references:
- https://github.com/getsentry/skills/blob/main/skills/doc-coauthoring/SKILL.md
-->
