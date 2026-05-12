# Changelog

## 0.1.5

- Added rich local `::embed` previews for Markdown, text, CSV, Mermaid, JSON, images, and videos in the browser viewer.
- Added safe embed cards and link fallbacks for VSCode/Cursor previews without widening webview local file access.
- Improved chart color defaults so extension preview charts remain visible in dark editor themes.

## 0.1.4

- Added GitHub Actions CI for pull request and `main` branch verification.
- Added a manual release workflow for npm, VSCode Marketplace, Open VSX, and GitHub Releases.
- Added release safety checks for changelogs, artifacts, package contents, and published npm versions.

## 0.1.2

- Corrected agent skill installation paths for Cursor, Claude Code, Codex, and OpenCode.
- Added skill-local config, schema, component registry, and example support files.
- Clarified Cursor extension installation behavior and Open VSX requirements.

## 0.1.0

Initial MVP release candidate.

- Added the `agent-md` CLI with `init`, `validate`, `serve`, `export`, and `vscode-extension` commands.
- Added parser, schema, resolver, React renderer, and local browser viewer packages.
- Added VSCode/Cursor preview extension support for `.agent.md` and `.amd.md` files.
- Added local-first validation and safety checks for workspace data, artifacts, embeds, diagrams, and scripts.
- Added generated agent skill, schema, config, examples, and publishing documentation.
