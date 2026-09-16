---
name: features-markdown
description: Structure and formatting rules for README and Markdown documents
---

## Usage

### README

A README is a project entry point. It should help a developer quickly determine:

1. What the project is and whether it fits their need.
2. What it can do and what it requires.
3. How to install it and reach the first useful result.
4. Where to find deeper usage, support, and contributor information.

Choose sections from the project evidence and reader needs; do not copy this reference
mechanically:

| Common section | Purpose |
|----------------|---------|
| Opening | Project, audience, outcome; optionally a useful logo, screenshot, badge, or demo |
| Contents / Navigation | Major section links for a long README; omit when headings already scan well |
| Why / Features | Problem solved and user-visible capabilities |
| Requirements | Runtime, platform, account, permission, or compatibility constraints |
| Install | Shortest supported installation path |
| Quick start | One copyable example with a recognizable result |
| Usage / Configuration | Common next tasks, defaults, and safety or output behavior |
| Documentation / Support | Links to focused guides, reference, troubleshooting, and project files |
| Related | Complementary tools, sibling projects, integrations, or alternatives |
| Thanks / Credits | Acknowledgements for contributors, inspirations, assets, or support |

Keep the README concise. Link existing `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`, security
policies, and full references instead of restating them. Route maintainer setup, architecture,
testing, and release procedures outside the adoption path.

### Other Markdown documents

Use the Core reader contract, then choose the progression that fits the document:

- **Task guide:** prerequisites → procedure → expected result → troubleshooting or next step.
- **Reference:** scope → defaults → options or API → example → constraints and edge cases.
- **Troubleshooting:** symptom → likely causes → diagnosis → fix → verification.

### Markdown formatting

Use GitHub Flavored Markdown for GitHub-hosted documents and preserve established project
extensions. Use admonitions only when information must stand apart from the normal flow.

- Use one H1, meaningful headings, and sequential heading levels.
- Put blank lines around headings, lists, fences, tables, and block quotes.
- Use numbered lists for procedures, bullets for unordered items, and tables for exact mappings.
- Use inline code for commands, options, identifiers, paths, environment variables, and literals.
- Give fenced code blocks the correct language identifier.
- Use descriptive link text and relative links for files in the same repository.
- Give informative images useful alt text rather than repeating the caption.
- Add a table of contents only when headings no longer provide enough navigation.

## Key Points

- Treat the README section list as a gap check, not a required structure.
- Follow the target renderer and repository conventions over generic Markdown preferences.

<!--
Source references:
- https://raw.githubusercontent.com/github/awesome-copilot/refs/heads/main/skills/create-readme/SKILL.md
- https://github.com/onmax/nuxt-skills/blob/main/skills/document-writer/SKILL.md
- https://github.com/getsentry/skills/blob/main/skills/doc-coauthoring/SKILL.md
-->
