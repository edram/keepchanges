# gitchangelog

Generate and maintain `CHANGELOG.md` from Conventional Commits.

## Usage

Run the CLI in a Git repository:

```bash
pnpm dlx gitchangelog 1.1.0
```

This reads commits between the latest tag and `HEAD`, or the complete history
for a first release, then writes the new release before existing release
history in `CHANGELOG.md`.

Repository links are inferred from `package.json#repository`, then from the
Git `origin`. When a GitHub repository is found, each entry links to its commit
and the release includes a comparison link to the requested version tag.

Use a different output file:

```bash
pnpm dlx gitchangelog 1.1.0 --output docs/CHANGELOG.md
```

Preview without writing:

```bash
pnpm dlx gitchangelog 1.1.0 --dry
```

The current release recognizes `feat` and `fix` commits, optional scopes,
breaking-change exclamation marks, and `BREAKING CHANGE` or
`BREAKING-CHANGE` trailers. Other commit types are ignored.

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

## License

MIT
