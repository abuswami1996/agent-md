import { defaultConfig } from "@agent-md/schema";

export const skillName = "agent-markdown";

export const skillMarkdown = `---
name: agent-markdown
description: Create, validate, and revise local-first Agent Markdown .agent.md documents with charts, tables, maps, diagrams, metrics, tabs, local data, and safe workspace file references.
license: MIT
---

# Agent Markdown Skill

Use Agent Markdown when the user asks for interactive reports, dashboards, visual analysis, charts or tables in Markdown, or local visualization documents.

Do not use Agent Markdown for ordinary README files, simple notes, documents that must render on GitHub without a viewer, or cases where the user asks for plain Markdown.

Rules:
- Use normal Markdown for prose.
- Use directives for interactive primitives.
- Do not emit raw HTML.
- Do not emit JavaScript.
- Prefer named data blocks or local files.
- Add frontmatter with format: agent-md and version: 0.1.
- Run agent-md validate --file <file.agent.md> --json --for-agent before considering a document complete.
- If validation returns errors, repair the document and validate again. Treat warnings as worth reviewing, not necessarily fatal unless the user asked for strict validation.
- When the user wants a shareable rendered artifact, run agent-md convert --file_name <file.agent.md> --html after validation.
- When browser/manual preview is useful, run agent-md serve --root <project> --host 127.0.0.1 --port <port> --no-open and inspect the local viewer.

Supporting files in this skill directory:
- agent-md.config.json: default runtime configuration.
- schema.json: primitive reference schema.
- components.json: registered component reference.
- examples/example.agent.md: starter Agent Markdown document.

Supported MVP primitives:
- ::metric for KPI cards.
- ::chart for line, bar, area, scatter, and pie charts.
- ::table for sortable/filterable local data tables.
- ::callout for notes, warnings, decisions, risks, and tips.
- ::tabs for grouped alternative views.
- ::diagram, ::timeline, ::query, ::embed, ::form, ::map, and ::component are supported with conservative validation and graceful fallbacks.

Authoring workflow for agents:
- Start with a small valid report, then add primitives incrementally.
- Prefer inline summary data for charts when source files are large; use the full local file for tables or queries.
- Keep directive YAML fields aligned to column 1 inside the directive block. Do not indent top-level fields like data:, x:, y:, or fields:.
- Use YAML block scalars for prose containing colons, quotes, or backticks, for example body: >- on callouts.
- For callouts, prefer an explicit body: field when the body is short prose.
- For forms, each field uses type: text, number, select, checkbox, or date. Select fields need options.
- For tabs, each child tab needs a unique label, and default must match one of those labels.
- For diagrams, inline source is safest. src may reference a local .mmd or .mermaid file inside the project.
- For embeds, use local project files. Markdown, text, JSON, CSV, TSV, images, PDFs, and videos are the safest choices. HTML embeds are blocked unless trusted config explicitly allows them.
- Do not reference remote data or artifacts unless the project config explicitly allows it; the default config is local-only.
- Custom components render as safe placeholders unless allowCustomComponents is enabled for a trusted project.

Useful commands:
- agent-md init --agent cursor
- agent-md validate --file <file.agent.md> --json --for-agent
- agent-md validate --file <file.agent.md> --strict
- agent-md validate --root <project-root> --config agent-md.config.json
- agent-md convert --file_name <file.agent.md> --html
- agent-md convert --file-name <file.agent.md> --html --output <output.html>
- agent-md convert --file_name <file.agent.md> --html --root <project-root> --config agent-md.config.json
- agent-md serve --root <project-root> --host 127.0.0.1 --port 3847 --no-open
- agent-md serve --root <project-root> --all-md --no-open
- agent-md export <file.agent.md> --format json
- agent-md export <file.agent.md> --format markdown-fallback
- agent-md vscode-extension --editor cursor

Validation and repair notes:
- --json --for-agent gives compact deterministic diagnostics with sourcePath, line, blockType, field, suggestion, and example.
- Error diagnostics must be fixed before sharing. Info diagnostics, such as table pagination, can be acceptable.
- unknown_field warnings usually mean the field will be ignored; remove the field or replace it with a supported schema field.
- directive_yaml_error usually means malformed YAML inside a directive; check indentation, colons in prose, and unmatched brackets.
- column_not_found and column_not_numeric mean the data loaded, but a primitive points at the wrong column or type.
- data_file_error and artifact_file_error usually mean the referenced local path is missing, escapes the project root, or uses an unsupported extension.
- After a clean validation, convert to HTML. When you're finished, tell the user how they can view the report either in their IDE or in a browser.
`;

export const exampleAgentMarkdown = `---
format: agent-md
version: 0.1
---
# Q4 Revenue Dashboard

::callout
type: decision
title: Local-only MVP
This dashboard uses only local inline data and local files.
:::

::metric
label: Total revenue
data: revenue
field: amount
aggregate: sum
format: currency
:::

::chart
type: line
title: Revenue by month
data: revenue
x: month
y: amount
:::

::tabs
::::tab
label: Table
::table
data: revenue
columns: [month, segment, amount]
sortable: true
filterable: true
:::
::::
::::tab
label: Enterprise only
::query
data: revenue
where:
  segment: Enterprise
select: [month, amount]
sort:
  by: amount
  direction: desc
view: table
:::
::::
:::

\`\`\`data revenue
month,segment,amount
Oct,SMB,100000
Oct,Enterprise,400000
Nov,SMB,120000
Nov,Enterprise,450000
Dec,SMB,140000
Dec,Enterprise,550000
\`\`\`
`;

export function configJson() {
  return JSON.stringify(defaultConfig, null, 2) + "\n";
}

export function componentsJson() {
  return JSON.stringify({ components: { Funnel: { module: "./components/Funnel.js", schema: "./components/Funnel.schema.json", description: "Renders a funnel conversion chart" } } }, null, 2) + "\n";
}

export function schemaJson() {
  return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", title: "Agent Markdown", version: "0.1", primitives: ["chart", "metric", "table", "diagram", "map", "timeline", "tabs", "callout", "embed", "form", "query", "component"] }, null, 2) + "\n";
}
