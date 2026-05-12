# Agent Markdown

Agent Markdown is a local-first Markdown format for building interactive, data-rich documents without asking agents to emit full HTML, custom JavaScript, or bulky application code.

It gives coding agents a small, opinionated set of Markdown primitives for charts, metrics, tables, maps, diagrams, timelines, tabs, callouts, forms, queries, and local embeds. The goal is simple: keep the authoring surface compact enough for agent context windows while giving humans a richer way to inspect and navigate data-heavy work.

Instead of generating an entire web app to explain a pipeline, forecast, research summary, incident review, or product analysis, an agent can write one `.agent.md` file. Agent Markdown validates that file, resolves only local data, and renders it in a browser viewer or directly inside VSCode/Cursor.

## Why Agent Markdown

Agents are good at producing structured Markdown, but Markdown alone is often too flat for analytical work. HTML, React, notebooks, and dashboards can solve that problem, but they are expensive from a context standpoint: lots of boilerplate, large dependency surfaces, security concerns, and too many ways for generated output to drift from the user's intent.

Agent Markdown is a middle path:

- **Lightweight syntax:** Authors use normal Markdown plus a small directive vocabulary.
- **Opinionated primitives:** Common analytical UI patterns are built in instead of reinvented per document.
- **Local-first security:** Data and artifacts are loaded from the local workspace. Remote fetching, arbitrary JavaScript, and raw HTML execution are blocked by default.
- **Agent-friendly context:** A compact `.agent.md` file is easier for agents to create, inspect, revise, and validate than a generated web app.
- **Human-friendly review:** Charts, sortable tables, maps, diagrams, tabs, and diagnostics make dense context easier to explore.
- **Browser and editor previews:** Use the local web viewer or the VSCode/Cursor preview extension.
- **Skill-guided generation:** `agent-md init` installs an agent skill file that teaches coding agents when and how to produce valid Agent Markdown.

## How This Differs From MDX

MDX is excellent when you want Markdown and React components in a controlled publishing environment: documentation sites, design systems, component demos, and content that is built by an application pipeline. It is intentionally powerful because it lets authors import components, compose JSX, and run inside a broader JavaScript toolchain.

Agent Markdown optimizes for a different moment: an agent quickly creating a local, interactive analytical document inside a workspace. It is better than MDX when the priority is compact generated syntax, predictable validation, local data access, and low context overhead rather than arbitrary component composition. Agents do not need to emit imports, JSX, state management, build configuration, or custom runtime code just to show a chart, map, table, or metric.

Use MDX when you are building a long-lived content product with hand-maintained components and a trusted build system. Use Agent Markdown when you want agents to produce data-rich local reports that are easy to validate, safe to preview, and cheap to revise in context.

## What It Includes

This repository is a TypeScript monorepo with the following packages:

- `packages/cli`: the `agent-md` command line interface.
- `packages/parser`: Markdown and directive parsing.
- `packages/schema`: shared document types and primitive schemas.
- `packages/resolver`: local data and artifact resolution with safety checks.
- `packages/renderer-react`: React renderer for Agent Markdown primitives.
- `packages/viewer`: local browser viewer with hot reload.
- `packages/vscode-extension`: VSCode/Cursor extension for in-editor preview.
- `packages/skill`: generated skill, config, schema, and starter example content.
- `packages/examples`: example dashboards, data files, diagrams, and artifacts.

## Supported Primitives

Agent Markdown supports the MVP primitives below:

- `::metric` for KPI cards.
- `::chart` for line, bar, area, scatter, and pie charts.
- `::table` for sortable and filterable local data tables.
- `::callout` for notes, warnings, risks, decisions, and tips.
- `::tabs` for grouped views.
- `::diagram` for Mermaid diagrams.
- `::map` for GeoJSON and latitude/longitude point maps.
- `::timeline` for event sequences.
- `::query` for local in-document data filtering.
- `::embed` for safe local artifact references.
- `::form` for lightweight local input UI.
- `::component` for registered component placeholders and conservative fallback behavior.

## Agent Skills

Agent Markdown is designed to be installed into a project as both a runtime and a writing guide for agents.

`agent-md init` creates `.agent-md/skill.md`, a plain Markdown skill that tells coding agents:

- When Agent Markdown is appropriate.
- When plain Markdown is still the better choice.
- Which primitives are available.
- How to structure frontmatter, data blocks, and local file references.
- Which safety rules to follow.
- To run `agent-md validate` before calling a document complete.

The current CLI supports Cursor and VSCode-oriented setup with `--agent cursor` or `--agent vscode`, including editor extension recommendations. Because the skill itself is plain Markdown, the same guidance can be reused by other popular coding-agent workflows that support project instructions, local rules, or skill files.

## Installation

### Published Package Flow

Install the CLI and initialize a project:

```bash
npm install @abuswami1996/agent-md
npx agent-md init --agent cursor
```

`agent-md init` creates:

- `agent-md.config.json`
- `.agent-md/skill.md`
- `.agent-md/schema.json`
- `.agent-md/components.json`
- `examples/example.agent.md`
- `.vscode/extensions.json` recommendations when using `--agent cursor` or `--agent vscode`

The installed skill file gives coding agents guidance for when to use Agent Markdown, which primitives are available, and how to validate generated documents.

Install the published VSCode/Cursor extension from the Marketplace:

```bash
cursor --install-extension AbhinavSwaminathan.agent-md-preview
```

Marketplace listing:
[Agent Markdown Preview](https://marketplace.visualstudio.com/items?itemName=AbhinavSwaminathan.agent-md-preview)

### Local Development Flow

From another project, install the local CLI package:

```bash
npm install /Users/abuswami/Desktop/test-news-openai/packages/cli
npx agent-md init --agent cursor
npx agent-md vscode-extension
```

If a bundled VSIX exists, the helper prints the install command:

```bash
cursor --install-extension "/path/to/agent-md-preview.vsix" --force
```

After installing the extension, reload Cursor or VSCode and open a `.agent.md` file.

## Usage

### Create a Project

```bash
npx agent-md init --agent cursor
```

This bootstraps the local Agent Markdown configuration and installs the skill file under `.agent-md/skill.md`.

### Ask an Agent to Create a Document

After initialization, ask your coding agent something like:

> Create an Agent Markdown dashboard summarizing the pipeline data in `data/pipeline.csv`. Include metrics, charts, a table, risks, and a recommended next step. Validate it with `agent-md validate`.

Because the skill file is local to the project, the agent has instructions for producing compact, valid `.agent.md` files instead of generating a full HTML app.

### Validate Documents

```bash
npx agent-md validate
```

Validate one file:

```bash
npx agent-md validate --file examples/example.agent.md
```

Use strict mode to treat warnings as failures:

```bash
npx agent-md validate --strict
```

Print JSON diagnostics:

```bash
npx agent-md validate --json
```

### Run the Browser Viewer

```bash
npx agent-md serve
```

The viewer scans configured Agent Markdown files, renders interactive primitives, shows diagnostics, and reloads when files change.

Common options:

```bash
npx agent-md serve --port 3333
npx agent-md serve --no-open
npx agent-md serve --all-md
```

### Use the VSCode/Cursor Preview Extension

Install the published extension:

```bash
cursor --install-extension AbhinavSwaminathan.agent-md-preview
```

You can also install it from the Marketplace:
[Agent Markdown Preview](https://marketplace.visualstudio.com/items?itemName=AbhinavSwaminathan.agent-md-preview)

For local development, build and package the extension from this repo:

```bash
npm run package -w agent-md-preview
npm run build -w @abuswami1996/agent-md
```

Install the bundled extension:

```bash
cursor --install-extension "/Users/abuswami/Desktop/test-news-openai/packages/cli/agent-md-preview.vsix" --force
```

Then reload the editor.

The extension contributes:

- `Agent Markdown: Open Preview`
- `Cmd+Shift+V` on macOS for `.agent.md` and `.amd.md` files
- `Ctrl+Shift+V` on Windows and Linux for `.agent.md` and `.amd.md` files
- An editor title preview button for Agent Markdown files

The preview opens in the active editor group and renders the same shared React primitives used by the browser viewer.

## Example Document

Agent Markdown uses frontmatter plus directive blocks:

````md
---
format: agent-md
version: 0.1
title: Q4 Revenue Dashboard
---

# Q4 Revenue Dashboard

:::callout
type: decision
title: Local-only MVP
This dashboard uses only inline data and local files.
::::

:::metric
label: Total revenue
data: revenue
field: amount
aggregate: sum
format: currency
::::

:::chart
type: line
title: Revenue by month
data: revenue
x: month
y: amount
::::

:::table
data: revenue
columns: [month, segment, amount]
sortable: true
filterable: true
::::

```data revenue
month,segment,amount
Oct,SMB,100000
Oct,Enterprise,400000
Nov,SMB,120000
Nov,Enterprise,450000
Dec,SMB,140000
Dec,Enterprise,550000
```
````

More complete examples live in `packages/examples/fixtures`, including `full-interactive-dashboard.agent.md`.

## Data and Artifact Model

Agent Markdown can use inline data blocks or local files.

Inline data:

````md
```data revenue
month,segment,amount
Oct,SMB,100000
Nov,Enterprise,450000
```
````

Local CSV:

```md
:::chart
type: bar
title: Pipeline value by stage
data: ../data/pipeline.csv
x: stage
y: value
::::
```

Supported local data formats include CSV, TSV, JSON, YAML, YML, and GeoJSON. Local artifact and data paths are resolved safely inside the project root.

## Security Model

Agent Markdown is designed for local, reviewable documents generated by agents.

The MVP security posture is intentionally conservative:

- No remote data fetching.
- No arbitrary JavaScript execution in documents.
- Raw HTML embeds are blocked by default.
- Local paths must remain inside the workspace root.
- Unsupported artifacts and unknown components fall back safely.
- Parser, resolver, and renderer diagnostics are surfaced to users.
- The VSCode/Cursor webview uses a Content Security Policy and limited local resource roots.

## Repository Development

Install dependencies:

```bash
npm install
```

Build all packages:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

Run linting:

```bash
npm run lint
```

Run the CLI directly from source:

```bash
npm run agent-md -- validate
npm run agent-md -- serve --no-open
```

Package the VSCode/Cursor extension:

```bash
npm run package -w agent-md-preview
```

## Project Status

Agent Markdown is currently an MVP. The core parser, resolver, React renderer, browser viewer, CLI, local skill installation flow, and VSCode/Cursor preview extension are implemented.

Good next areas for contribution include:

- More primitives and richer primitive options.
- Better keyboard and accessibility coverage in rendered primitives.
- Additional agent-specific skill templates.
- Snapshot and browser-based extension smoke tests.
- Renderer performance improvements and code splitting for large diagrams.
- Expanded docs and example galleries.

## Contributing

Contributions should keep Agent Markdown compact, safe, and agent-friendly.

Before opening a pull request:

1. Keep syntax additions small and easy for agents to emit.
2. Prefer local-first behavior over network-dependent behavior.
3. Add schema validation for new primitive fields.
4. Add parser or resolver tests for new syntax and safety behavior.
5. Keep renderer fallbacks graceful when data is missing or invalid.
6. Run `npm test`, `npm run typecheck`, and `npm run lint`.

When proposing a new primitive, include:

- A short motivation.
- Example syntax.
- Validation rules.
- Renderer behavior.
- Fallback behavior.
- Security considerations.

## License

MIT.
