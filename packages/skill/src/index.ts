import { defaultConfig } from "@agent-md/schema";

export const skillMarkdown = `# Agent Markdown Skill

Use Agent Markdown when the user asks for interactive reports, dashboards, visual analysis, charts or tables in Markdown, or local visualization documents.

Do not use Agent Markdown for ordinary README files, simple notes, documents that must render on GitHub without a viewer, or cases where the user asks for plain Markdown.

Rules:
- Use normal Markdown for prose.
- Use directives for interactive primitives.
- Do not emit raw HTML.
- Do not emit JavaScript.
- Prefer named data blocks or local files.
- Add frontmatter with format: agent-md and version: 0.1.
- Run agent-md validate before considering a document complete.

Supported MVP primitives:
- ::metric for KPI cards.
- ::chart for line, bar, area, scatter, and pie charts.
- ::table for sortable/filterable local data tables.
- ::callout for notes, warnings, decisions, risks, and tips.
- ::tabs for grouped alternative views.
- ::diagram, ::timeline, ::query, ::embed, ::form, ::map, and ::component are supported with conservative validation and graceful fallbacks.
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
