# Contributing to Awareness Local

Thanks for your interest in contributing! Awareness Local is a local-first MCP memory server for AI coding agents (Claude Code, Cursor, Windsurf, Cline, Copilot, and 13+ IDEs).

## Ways to contribute

- **Bug reports** — open an issue with: what you expected, what happened, your OS/Node version, and the daemon log (`daemon.log` in the project's `.awareness/` directory).
- **Feature ideas** — open an issue describing the user problem first; PRs solving a well-described problem get reviewed faster.
- **Code** — pick an issue labeled [`good first issue`](https://github.com/everest-an/Awareness-Market/labels/good%20first%20issue), fork, and open a PR.
- **Docs / README** — corrections welcome. Note: this repo receives automated code syncs from the main development repo; `README.md`, `README.zh-CN.md`, `LICENSE`, and `assets/` are repo-owned and never overwritten.

## Development setup

```bash
git clone https://github.com/everest-an/Awareness-Market.git
cd Awareness-Market
npm install
```

Requirements: Node.js 18+ (20+ recommended).

## Running tests

```bash
npm test              # unit + integration tests (node:test)
npm run test:e2e      # end-to-end user journeys (Playwright)
```

Run the daemon locally:

```bash
npm start             # or: npx @awareness.market/local start
```

The dashboard is at `http://localhost:37800/`. For a sandboxed data directory, set `AWARENESS_HOME` to a temp path.

## Pull request checklist

- [ ] Tests added/updated (`npm test` passes)
- [ ] New external calls have happy-path + failure-mode coverage
- [ ] New buttons/endpoints pass the surface checks (`scripts/verify-*.mjs` where applicable)
- [ ] No secrets, internal codenames, or cloud-specific details in public-facing files

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
