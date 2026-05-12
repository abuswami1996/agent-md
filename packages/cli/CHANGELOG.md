# Changelog

## 0.1.5

- Added controlled local artifact preview support to the bundled browser viewer.
- Added content types for text, JSON, CSV, images, PDFs, and videos served through the local artifact endpoint.
- Bundled the updated Agent Markdown Preview extension for richer embed cards and theme-visible chart colors.

## 0.1.4

- Added release workflow support for npm trusted publishing with provenance.
- Added release safety checks for CLI package contents and changelog/version alignment.
- Bundled the latest Agent Markdown Preview VSIX in the CLI publish artifact.

## 0.1.2

- Installed agent skills into each tool's documented `SKILL.md` directory.
- Made Cursor skill installs self-contained under `.cursor/skills/agent-markdown/`.
- Clarified Cursor extension installation via bundled VSIX until Open VSX publishing is complete.

## 0.1.0

Initial MVP release candidate for the `agent-md` CLI.

- Added project initialization with generated config, schema, examples, and agent skill.
- Added validation, local browser serving, export, and VSCode extension helper commands.
- Added bundled viewer assets and optional bundled VSIX support.
