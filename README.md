# gitchangelog

Generate and maintain `CHANGELOG.md` from Conventional Commits.

## Usage

Run the CLI in a Git repository with at least one tag:

```bash
pnpm dlx gitchangelog 1.1.0
```

This reads commits between the latest tag and `HEAD`, then writes the new
release before existing release history in `CHANGELOG.md`.

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
