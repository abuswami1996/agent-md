# Changelog

## 0.2.1

- Fixed bundled viewer rendering for pie charts that use standard `x` and `y` fields instead of pie-specific `label` and `value` fields.
- Added colored pie slices for clearer platform/category breakdowns.

## 0.2.0

- Fixed rendered primitive behavior in the bundled browser viewer, including forms, tabs, timelines, query sorting, and flowchart labels.
- Added safe static artifact bundling for converted HTML so local embeds and diagram source files render without the live `/artifact` endpoint.
- Improved live viewer UX for loading, root-level file grouping, stale document selection, diagnostics, and source/sidebar click stability.
- Expanded the generated Agent Markdown skill with agent-friendly validation, preview, conversion, and repair guidance.

## 0.1.6

- Added `agent-md convert --file_name <file.agent.md> --html` for writing static HTML files.
- Embedded resolved Agent Markdown documents and self-contained viewer assets in generated HTML.
- Added CLI integration coverage and README guidance for static HTML conversion.

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
