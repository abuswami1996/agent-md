Technical Requirements Specification: Agent Markdown MVP

1. Product summary

The MVP is a local-first Markdown extension system that lets users author compact Markdown files with interactive primitives such as charts, metrics, tables, diagrams, maps, timelines, tabs, forms, queries, embeds, and registered components.

Users install a CLI/runtime package with NPX:

npx agent-md init
npx agent-md serve

The local server scans the project for supported Markdown files, parses them, validates custom directive blocks, resolves local data/artifacts, and renders the output in a browser at:

http://localhost:{port}

The system does not allow arbitrary HTML, arbitrary JavaScript, remote fetching, or unsafe filesystem access in the MVP.

⸻

2. MVP goals

2.1 Primary goals

The MVP must:

1. Render normal Markdown.
2. Support a compact directive syntax for interactive primitives.
3. Support only local files and inline data blocks.
4. Provide a local viewer with hot reload.
5. Validate directives before rendering.
6. Show useful rendering and validation errors.
7. Provide an agent skill/instruction file for coding agents.
8. Keep the syntax small and readable for both humans and agents.
9. Keep rendering deterministic, safe, and portable.

2.2 Non-goals for MVP

The MVP should not support:

1. Remote API fetching.
2. Arbitrary user JavaScript in Markdown.
3. Arbitrary raw HTML rendering.
4. Cloud hosting.
5. Authentication.
6. Multi-user collaboration.
7. Database connections.
8. Plugin marketplace.
9. Full MDX support.
10. Server-side execution of user-defined code.
11. Editing documents inside the viewer.
12. Bidirectional sync with external editors.

⸻

3. Core user flow

3.1 Install/init

cd my-project
npx agent-md init

Creates:

agent-md.config.json
.agent-md/
  skill.md
  schema.json
  components.json
examples/
  example.agent.md

3.2 Serve

npx agent-md serve

Starts a local server:

Agent Markdown running at http://localhost:3847

3.3 View

User opens the browser and sees:

Project files
- examples/example.agent.md
- reports/q4.agent.md
- dashboards/funnel.agent.md

Clicking a file renders the Markdown plus interactive primitives.

3.4 Validate

npx agent-md validate

Validates all matching files and reports errors.

Example:

reports/q4.agent.md
Error: chart.data not found
Block: ::chart
Line: 22
data: revenue_by_month
Known data sources:
- revenue
- segments

⸻

4. File conventions

4.1 Supported Markdown file extensions

Preferred file extensions:

*.agent.md
*.amd.md

Optional fallback:

*.md

The default config should only scan:

{
  "include": ["**/*.agent.md", "**/*.amd.md"],
  "exclude": ["node_modules/**", ".git/**", "dist/**", "build/**"]
}

4.2 Frontmatter format marker

Files may optionally include:

---
format: agent-md
version: 0.1
---

The renderer should treat these files as Agent Markdown even if they use a plain .md extension.

⸻

5. Syntax design

5.1 Directive block syntax

Use Markdown container directives:

::primitive
key: value
key2: value
::

Example:

::chart
type: line
title: Revenue by month
data: revenue
x: month
y: amount
::

5.2 Nested directive syntax

Some primitives need children, especially ::tabs.

::tabs
:::tab
label: Summary
Summary content here.
:::
:::tab
label: Details
Details content here.
:::
::

The MVP parser must support:

::name ... ::
:::name ... :::

Nested directives should be limited to a maximum nesting depth of 5.

5.3 Inline data block syntax

CSV:

```data revenue
month,amount
Jan,100
Feb,120
Mar,160
```

JSON:

```json data=revenue
[
  {"month": "Jan", "amount": 100},
  {"month": "Feb", "amount": 120}
]
```

YAML:

```yaml data=events
- date: 2026-01-01
  label: Launch
- date: 2026-02-01
  label: Expansion
```

5.4 Local file data references

::chart
type: bar
data: ./data/revenue.csv
x: month
y: amount
::

Supported local data formats:

.csv
.tsv
.json
.yaml
.yml
.geojson

5.5 Local artifact references

Artifacts are local project files.

::embed
src: ./artifacts/report.pdf
title: Full report
::

Supported local artifact types:

.pdf
.png
.jpg
.jpeg
.gif
.svg
.webm
.mp4
.html
.txt
.md
.csv
.json

HTML embeds must be sandboxed and disabled by default unless explicitly allowed in config.

⸻

6. High-level architecture

Markdown file
  ↓
File scanner
  ↓
Markdown parser
  ↓
Directive extractor
  ↓
Data/artifact resolver
  ↓
Schema validator
  ↓
Canonical document AST
  ↓
Renderer
  ↓
Browser viewer

6.1 Package structure

Recommended monorepo:

agent-md/
  packages/
    cli/
    parser/
    schema/
    resolver/
    renderer-react/
    viewer/
    skill/
    examples/

6.2 Runtime responsibilities

The runtime must:

1. Discover eligible Markdown files.
2. Parse Markdown and custom directives.
3. Resolve local data references.
4. Resolve inline data blocks.
5. Validate component props.
6. Produce a canonical document model.
7. Render document model into React components.
8. Report validation/rendering errors.
9. Hot reload on file changes.
10. Prevent unsafe file access.

⸻

7. Canonical document model

The parser should normalize Markdown into a document model.

7.1 Document model shape

type AgentMarkdownDocument = {
  format: "agent-md";
  version: string;
  sourcePath: string;
  frontmatter?: Record<string, unknown>;
  nodes: DocumentNode[];
  dataSources: Record<string, DataSource>;
  diagnostics: Diagnostic[];
};

7.2 Document node

type DocumentNode =
  | MarkdownNode
  | ChartNode
  | MetricNode
  | TableNode
  | DiagramNode
  | MapNode
  | TimelineNode
  | TabsNode
  | CalloutNode
  | EmbedNode
  | FormNode
  | QueryNode
  | ComponentNode
  | ErrorNode;

7.3 Diagnostics

type Diagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  sourcePath: string;
  line?: number;
  column?: number;
  blockType?: string;
  suggestion?: string;
};

The viewer must surface diagnostics both inline and in a side panel.

⸻

8. Parser requirements

8.1 Markdown parser

The parser should use an existing Markdown ecosystem rather than implementing Markdown from scratch.

Recommended stack:

unified
remark-parse
remark-frontmatter
remark-gfm
custom directive plugin

8.2 Supported Markdown

The MVP should support GitHub-flavored Markdown features:

1. Headings.
2. Paragraphs.
3. Links.
4. Images.
5. Lists.
6. Blockquotes.
7. Tables.
8. Inline code.
9. Fenced code blocks.
10. Task lists.
11. Horizontal rules.

8.3 Custom directive parsing

The parser must recognize:

::name
key: value
::

and produce a directive AST node:

type DirectiveAstNode = {
  type: "directive";
  name: string;
  attributes: Record<string, unknown>;
  children?: DirectiveAstNode[] | MarkdownNode[];
  position: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

8.4 YAML-like body parsing

Directive bodies should be parsed as YAML.

Example:

::chart
type: line
x: month
y: revenue
::

Equivalent object:

{
  "type": "line",
  "x": "month",
  "y": "revenue"
}

8.5 Parsing failures

Malformed blocks should not crash the document.

They should become error nodes:

type ErrorNode = {
  type: "error";
  message: string;
  raw: string;
  line?: number;
};

⸻

9. Validation requirements

9.1 Schema system

Use a runtime schema validator.

Recommended options:

Zod
Valibot
JSON Schema + Ajv

For TypeScript implementation, Zod is the most straightforward for MVP.

9.2 Validation behavior

Validation must check:

1. Required fields.
2. Unknown fields.
3. Type correctness.
4. Enum correctness.
5. Referenced data source existence.
6. Referenced local file existence.
7. Column existence for data-backed primitives.
8. Safe path access.
9. Primitive-specific constraints.

9.3 Unknown fields

Unknown fields should produce warnings, not hard errors, unless they create ambiguity.

Example:

::chart
type: line
data: revenue
x: month
y: amount
animation: sparkle
::

Warning:

Unknown field "animation" on ::chart.

9.4 Error handling

If a primitive is invalid, the renderer should display an inline error card instead of failing the whole page.

⸻

10. Local file resolver

10.1 Scope

The resolver may only access files inside the project root.

Allowed:

./data/revenue.csv
reports/q1.json
../project-local-file.csv only if still inside project root

Forbidden:

/etc/passwd
~/.ssh/id_rsa
../../outside-project/file.csv
http://example.com/data.csv
https://example.com/data.csv

10.2 Path normalization

All local paths must be normalized and checked against the project root.

function resolveSafePath(projectRoot: string, sourcePath: string, ref: string): string {
  const base = path.dirname(sourcePath);
  const absolute = path.resolve(base, ref);
  if (!absolute.startsWith(projectRoot)) {
    throw new Error("Path escapes project root");
  }
  return absolute;
}

10.3 Local data formats

CSV / TSV

Use a streaming or robust parser.

Recommended:

papaparse
csv-parse

JSON

Support arrays and objects.

Valid table-like JSON:

[
  { "month": "Jan", "amount": 100 },
  { "month": "Feb", "amount": 120 }
]

YAML

Support YAML arrays and objects.

GeoJSON

Used by ::map.

10.4 Data source model

type DataSource = {
  id: string;
  origin: "inline" | "file" | "derived";
  source?: string;
  format: "csv" | "tsv" | "json" | "yaml" | "geojson";
  rows?: Record<string, unknown>[];
  object?: unknown;
  columns?: DataColumn[];
  diagnostics: Diagnostic[];
};

10.5 Data inference

The resolver should infer:

type DataColumn = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "unknown";
  nullable: boolean;
  sampleValues: unknown[];
};

Date inference should support ISO strings first.

⸻

11. Renderer requirements

11.1 Web renderer

The MVP renderer should be React-based.

Recommended stack:

Vite
React
TypeScript
Tailwind optional
Recharts or Vega-Lite for charts
React Markdown rendering
Mermaid for diagrams
Leaflet or MapLibre for maps
TanStack Table for tables

11.2 Rendering modes

The renderer should support:

1. Normal document mode.
2. Inline error mode.
3. Raw source view.
4. Validation panel.

11.3 Fallbacks

Each primitive must have a fallback plain-text representation.

Example:

[Chart: line chart of revenue by month]

This matters for export, terminal previews, and graceful failure.

⸻

12. CLI requirements

12.1 Commands

init

npx agent-md init

Creates config, skill, schema, and example files.

Options:

npx agent-md init --agent cursor
npx agent-md init --agent claude-code
npx agent-md init --agent codex
npx agent-md init --agent generic

serve

npx agent-md serve

Options:

--port 3847
--host localhost
--root .
--open
--all-md
--config agent-md.config.json

validate

npx agent-md validate

Options:

--file reports/q4.agent.md
--json
--strict

export

MVP optional, but useful:

npx agent-md export reports/q4.agent.md --format html

MVP export targets:

html
json
markdown-fallback

PDF export should be post-MVP unless easy through browser print.

⸻

13. Configuration

13.1 Config file

agent-md.config.json

{
  "version": "0.1",
  "include": ["**/*.agent.md", "**/*.amd.md"],
  "exclude": ["node_modules/**", ".git/**", "dist/**", "build/**"],
  "server": {
    "port": 3847,
    "host": "localhost",
    "open": true
  },
  "security": {
    "allowRawHtml": false,
    "allowRemoteData": false,
    "allowHtmlEmbeds": false,
    "projectRootOnly": true
  },
  "components": {
    "registry": ".agent-md/components.json"
  }
}

13.2 Component registry

.agent-md/components.json

{
  "components": {
    "Funnel": {
      "module": "./components/Funnel.js",
      "schema": "./components/Funnel.schema.json",
      "description": "Renders a funnel conversion chart"
    }
  }
}

For MVP, registered custom components can be loaded only from local trusted paths and must be explicitly configured.

⸻

14. Primitive specifications

⸻

14.1 ::chart

Purpose

Render interactive charts:

bar
line
area
scatter
pie

Basic syntax

::chart
type: line
title: Revenue by month
data: revenue
x: month
y: amount
::

Required fields

type: string
data: string

Required depending on chart type:

Chart type	Required fields
line	x, y
bar	x, y
area	x, y
scatter	x, y
pie	label, value

Optional fields

title: string
description: string
series: string
xLabel: string
yLabel: string
height: number
width: number
stacked: boolean
legend: boolean
tooltip: boolean

Schema

type ChartNode = {
  type: "chart";
  chartType: "line" | "bar" | "area" | "scatter" | "pie";
  title?: string;
  description?: string;
  data: string;
  x?: string;
  y?: string | string[];
  label?: string;
  value?: string;
  series?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  width?: number;
  stacked?: boolean;
  legend?: boolean;
  tooltip?: boolean;
};

Validation

The validator must check:

1. data exists.
2. Referenced columns exist.
3. y columns are numeric for quantitative charts.
4. value is numeric for pie charts.
5. type is one of supported chart types.
6. height and width are positive numbers if provided.

Example: line

::chart
type: line
title: Monthly revenue
data: revenue
x: month
y: amount
::

Example: multiple y series

::chart
type: line
title: Latency
data: latency
x: timestamp
y: [p50, p95, p99]
::

Example: pie

::chart
type: pie
title: Revenue by segment
data: segments
label: segment
value: revenue
::

Rendering requirement

Use Recharts or Vega-Lite.

Recommendation for MVP:

Recharts for simplicity.
Vega-Lite later for portability.

⸻

14.2 ::metric

Purpose

Render KPI cards.

Basic syntax

::metric
label: Revenue
value: $1.2M
delta: +8%
::

Required fields

label: string
value: string | number

Optional fields

delta: string | number
trend: up | down | neutral
description: string
data: string
field: string
format: string

Schema

type MetricNode = {
  type: "metric";
  label: string;
  value: string | number;
  delta?: string | number;
  trend?: "up" | "down" | "neutral";
  description?: string;
  data?: string;
  field?: string;
  format?: string;
};

Data-backed metric

::metric
label: Total revenue
data: revenue
field: amount
aggregate: sum
format: currency
::

Additional optional fields for data-backed metrics:

aggregate: sum | avg | min | max | count

Validation

1. label exists.
2. Either value exists or data + field + aggregate exists.
3. If data-backed, data and field must exist.
4. Aggregation requires compatible data type.

Rendering

Render as a card with:

Label
Value
Delta/trend
Description

⸻

14.3 ::table

Purpose

Render sortable and filterable data tables.

Basic syntax

::table
data: revenue
columns: [month, amount, segment]
sortable: true
filterable: true
::

Required fields

data: string

Optional fields

title: string
columns: string[]
sortable: boolean
filterable: boolean
pagination: boolean
pageSize: number
search: boolean

Schema

type TableNode = {
  type: "table";
  title?: string;
  data: string;
  columns?: string[];
  sortable?: boolean;
  filterable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  search?: boolean;
};

Validation

1. data exists.
2. Listed columns exist.
3. pageSize is positive.
4. Data must be row-like.

Rendering requirement

Use TanStack Table or a lightweight custom table.

MVP features:

1. Sort by column.
2. Global search.
3. Optional pagination.
4. Optional column filtering.

⸻

14.4 ::diagram

Purpose

Render flowcharts, sequence diagrams, and trees.

Supported types

flowchart
sequence
tree

Basic syntax

::diagram
type: flowchart
source: |
  A[Start] --> B{Decision}
  B -->|Yes| C[Do thing]
  B -->|No| D[Stop]
::

Alternative local file syntax

::diagram
type: flowchart
src: ./diagrams/onboarding.mmd
::

Required fields

Either:

source: string

or:

src: string

Optional fields

title: string
direction: TB | LR | BT | RL
height: number

Schema

type DiagramNode = {
  type: "diagram";
  diagramType: "flowchart" | "sequence" | "tree";
  title?: string;
  source?: string;
  src?: string;
  direction?: "TB" | "LR" | "BT" | "RL";
  height?: number;
};

Rendering requirement

Use Mermaid for MVP.

Mapping:

Agent Markdown type	Mermaid type
flowchart	flowchart TB or flowchart LR
sequence	sequenceDiagram
tree	graph TD or Mermaid mindmap post-MVP

Validation

1. Either source or src exists.
2. src must be a safe local path.
3. Mermaid syntax errors should be displayed inline.
4. No remote includes.

⸻

14.5 ::map

Purpose

Render geographic or spatial data.

MVP scope

Support:

1. Point maps from latitude/longitude columns.
2. GeoJSON rendering from local .geojson files.
3. Basic marker popups.
4. Optional label field.

Basic point map syntax

::map
title: Customer locations
data: customers
lat: latitude
lon: longitude
label: customer_name
::

GeoJSON syntax

::map
title: Sales regions
data: ./data/regions.geojson
::

Required fields

For tabular point data:

data: string
lat: string
lon: string

For GeoJSON:

data: string

Optional fields

title: string
label: string
value: string
height: number
zoom: number
center: [number, number]

Schema

type MapNode = {
  type: "map";
  title?: string;
  data: string;
  lat?: string;
  lon?: string;
  label?: string;
  value?: string;
  height?: number;
  zoom?: number;
  center?: [number, number];
};

Rendering requirement

Use Leaflet or MapLibre.

For MVP, Leaflet is easier.

Tile policy

Since the MVP is local-files-only, maps should avoid remote tile dependencies by default.

Options:

1. Render markers on a blank coordinate plane.
2. Use a lightweight local/offline map background if configured.
3. Allow remote tiles only if explicitly enabled post-MVP.

Recommended MVP default:

Coordinate canvas + optional GeoJSON shapes.
No remote tile server by default.

Validation

1. data exists.
2. For tabular maps, lat and lon columns exist.
3. Lat/lon values are numeric.
4. Lat is between -90 and 90.
5. Lon is between -180 and 180.
6. GeoJSON must be valid GeoJSON.

⸻

14.6 ::timeline

Purpose

Render dated events.

Basic syntax

::timeline
data: launch_events
date: date
title: event
description: details
::

Inline syntax

::timeline
events:
  - date: 2026-01-01
    title: Alpha
    description: Internal alpha begins
  - date: 2026-02-01
    title: Beta
    description: Customer beta begins
::

Required fields

Either:

data: string
date: string
title: string

or:

events: array

Optional fields

description: string
group: string
sort: asc | desc
layout: vertical | horizontal

Schema

type TimelineNode = {
  type: "timeline";
  data?: string;
  date?: string;
  title?: string;
  description?: string;
  group?: string;
  sort?: "asc" | "desc";
  layout?: "vertical" | "horizontal";
  events?: TimelineEvent[];
};
type TimelineEvent = {
  date: string;
  title: string;
  description?: string;
  group?: string;
};

Validation

1. Dates parse as valid dates.
2. data exists if provided.
3. Referenced columns exist.
4. layout is supported.
5. Events are sorted by date unless sort is omitted.

Rendering

MVP should render vertical timeline first.

Horizontal timeline can be a simple variant, not a complex zoomable timeline.

⸻

14.7 ::tabs

Purpose

Render alternate views or grouped content.

Basic syntax

::tabs
:::tab
label: Summary
This is the summary.
:::
:::tab
label: Data
::table
data: revenue
::
:::
::

Required child nodes

At least one :::tab.

Each tab requires:

label: string

Optional fields

default: string
variant: line | pill | card

Schema

type TabsNode = {
  type: "tabs";
  default?: string;
  variant?: "line" | "pill" | "card";
  tabs: TabNode[];
};
type TabNode = {
  label: string;
  value?: string;
  children: DocumentNode[];
};

Validation

1. At least one tab.
2. Each tab has a label.
3. Labels are unique.
4. Default tab exists if specified.

Rendering

Render tab controls and only show the selected tab content.

No persistence required in MVP.

⸻

14.8 ::callout

Purpose

Render notes, warnings, decisions, risks, and tips.

Basic syntax

::callout
type: warning
title: Data is incomplete
body: This report is missing February data.
::

Body-as-Markdown syntax

::callout
type: decision
title: Use local files only
For the MVP, remote data fetching is intentionally excluded.
::

Supported types

note
info
warning
error
success
decision
risk
tip

Required fields

None strictly required, but at least one of:

title
body
children

Optional fields

type: string
title: string
body: string

Schema

type CalloutNode = {
  type: "callout";
  calloutType: "note" | "info" | "warning" | "error" | "success" | "decision" | "risk" | "tip";
  title?: string;
  body?: string;
  children?: DocumentNode[];
};

Validation

1. type must be supported.
2. Empty callouts should warn.
3. Markdown body is allowed.

Rendering

Render as a styled block with icon, title, and content.

⸻

14.9 ::embed

Purpose

Embed controlled local artifacts.

Basic syntax

::embed
src: ./artifacts/report.pdf
title: Full report
::

Supported local types

Type	Render behavior
.pdf	iframe or object viewer
.png, .jpg, .jpeg, .gif, .svg	image
.mp4, .webm	video
.txt, .md	text preview
.csv, .json	data preview
.html	blocked by default unless enabled

Required fields

src: string

Optional fields

title: string
height: number
width: number
caption: string
mode: preview | link | inline

Schema

type EmbedNode = {
  type: "embed";
  src: string;
  title?: string;
  height?: number;
  width?: number;
  caption?: string;
  mode?: "preview" | "link" | "inline";
};

Validation

1. src exists.
2. Path is local and safe.
3. File extension is supported.
4. HTML embeds blocked unless allowed.
5. File size must be under configured limit.

Config

{
  "security": {
    "allowHtmlEmbeds": false,
    "maxEmbedSizeMb": 25
  }
}

⸻

14.10 ::form

Purpose

Render light local interaction/input.

MVP forms are client-side only. They do not submit to a server and do not mutate files.

Basic syntax

::form
title: Scenario inputs
fields:
  - name: growth_rate
    label: Growth rate
    type: number
    default: 0.1
  - name: segment
    label: Segment
    type: select
    options: [SMB, Mid-market, Enterprise]
::

Supported field types

text
number
select
checkbox
date

Required fields

fields: array

Each field requires:

name: string
type: string

Optional fields

title: string
description: string
submitLabel: string

Field options:

label: string
default: unknown
placeholder: string
required: boolean
options: string[]
min: number
max: number
step: number

Schema

type FormNode = {
  type: "form";
  title?: string;
  description?: string;
  submitLabel?: string;
  fields: FormField[];
};
type FormField = {
  name: string;
  label?: string;
  fieldType: "text" | "number" | "select" | "checkbox" | "date";
  default?: unknown;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
};

MVP behavior

Forms should:

1. Render inputs.
2. Store state in browser memory.
3. Optionally expose values to local page-level expressions post-MVP.
4. Not write files.
5. Not submit anywhere.

Validation

1. Field names unique.
2. Field types supported.
3. Select fields must include options.
4. Defaults must match field type.
5. Number fields validate min/max.

⸻

14.11 ::query

Purpose

Render a filtered or transformed view of a local dataset.

MVP should support simple declarative filtering and selection, not arbitrary SQL or JavaScript.

Basic syntax

::query
data: revenue
where:
  segment: Enterprise
select: [month, amount]
sort:
  by: amount
  direction: desc
limit: 10
view: table
::

Required fields

data: string

Optional fields

where: object
select: string[]
sort:
  by: string
  direction: asc | desc
limit: number
view: table | json | cards

Schema

type QueryNode = {
  type: "query";
  data: string;
  where?: Record<string, QueryPredicate>;
  select?: string[];
  sort?: {
    by: string;
    direction?: "asc" | "desc";
  };
  limit?: number;
  view?: "table" | "json" | "cards";
};
type QueryPredicate =
  | string
  | number
  | boolean
  | {
      eq?: unknown;
      neq?: unknown;
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
      contains?: string;
      in?: unknown[];
    };

Advanced predicate example

::query
data: accounts
where:
  revenue:
    gte: 100000
  segment:
    in: [Enterprise, Strategic]
select: [name, segment, revenue]
sort:
  by: revenue
  direction: desc
limit: 20
view: table
::

Validation

1. data exists.
2. select columns exist.
3. where columns exist.
4. Predicate operators are supported.
5. Numeric comparisons only apply to numeric columns.
6. limit is positive.

Rendering

Default render is a table.

The query should produce a derived data source internally:

type DerivedDataSource = {
  id: string;
  origin: "derived";
  rows: Record<string, unknown>[];
  sourceQuery: QueryNode;
};

⸻

14.12 ::component

Purpose

Escape hatch for registered custom components.

This is intentionally constrained in MVP.

Basic syntax

::component
name: Funnel
props:
  data: funnel
  stage: stage
  value: users
::

Required fields

name: string

Optional fields

props: object

Schema

type ComponentNode = {
  type: "component";
  name: string;
  props?: Record<string, unknown>;
};

Registry lookup

The renderer looks up name in .agent-md/components.json.

If missing:

Unknown component: Funnel

MVP behavior

Custom components may only be loaded if:

1. They are registered.
2. Their path is local.
3. Their path is inside project root.
4. The user has enabled custom components in config.

Config:

{
  "security": {
    "allowCustomComponents": false
  }
}

For MVP, default should be:

"allowCustomComponents": false

But the syntax and validation should exist.

Recommendation

For the first MVP release, ::component can render as a registry-resolved placeholder, not dynamically execute arbitrary component code.

Example:

Registered component: Funnel
Props validated.
Custom rendering disabled in current config.

This avoids shipping an unsafe plugin model too early.

⸻

15. Agent skill requirements

15.1 Skill file

Generated at:

.agent-md/skill.md

15.2 Skill contents

The skill should teach agents:

1. When to use Agent Markdown.
2. When not to use it.
3. Supported primitives.
4. Syntax examples.
5. Data block conventions.
6. Validation expectations.
7. Security rules.
8. Style guidelines.

15.3 Skill excerpt

# Agent Markdown Skill
Use Agent Markdown when the user asks for:
- interactive reports
- dashboards
- visual analysis
- charts or tables in Markdown
- local visualization documents
Do not use Agent Markdown for:
- ordinary README files
- simple notes
- documents that must render on GitHub without a viewer
- cases where the user asks for plain Markdown
Rules:
- Use normal Markdown for prose.
- Use directives for interactive primitives.
- Do not emit raw HTML.
- Do not emit JavaScript.
- Prefer named data blocks or local files.
- Add frontmatter:
  format: agent-md
  version: 0.1

⸻

16. Viewer requirements

16.1 Layout

The local viewer should include:

┌─────────────────────────────────────────────┐
│ Top bar: project name, selected file         │
├───────────────┬─────────────────────────────┤
│ File browser  │ Rendered document            │
│ Diagnostics   │                             │
└───────────────┴─────────────────────────────┘

16.2 File browser

Must show:

1. Matching Markdown files.
2. Current selected file.
3. Validation status per file.

16.3 Document view

Must show:

1. Rendered Markdown.
2. Rendered primitives.
3. Inline errors.
4. Loading states for local data.

16.4 Diagnostics panel

Must show:

1. Errors.
2. Warnings.
3. Line numbers when available.
4. Suggestions when available.

16.5 Source mode

MVP should support toggling between:

Rendered
Source
AST/debug optional

AST/debug can be hidden behind a dev flag.

⸻

17. Hot reload requirements

The server must watch:

1. Markdown files.
2. Referenced local data files.
3. Referenced local artifacts.
4. Config files.
5. Component registry.

Recommended library:

chokidar

On change:

1. Re-parse affected Markdown file.
2. Re-resolve changed data source.
3. Re-run validation.
4. Push update to browser via WebSocket or Vite HMR.

⸻

18. Security requirements

18.1 Default security posture

Default:

{
  "allowRawHtml": false,
  "allowRemoteData": false,
  "allowHtmlEmbeds": false,
  "allowCustomComponents": false,
  "projectRootOnly": true
}

18.2 Raw HTML

Raw HTML in Markdown should be escaped or rendered as text by default.

18.3 JavaScript

Scripts must never execute from Markdown content.

Blocked:

<script>alert("x")</script>

Blocked:

::embed
src: ./thing.html
::

unless explicitly enabled.

18.4 Remote URLs

Blocked in data fields:

::chart
data: https://example.com/data.csv
::

Allowed as ordinary Markdown links:

[Website](https://example.com)

18.5 Filesystem

All local references must remain inside project root.

18.6 Custom components

Disabled by default.

When enabled, custom components still need:

1. Explicit registry entry.
2. Local path.
3. Schema validation.
4. No automatic remote imports.

⸻

19. Performance requirements

19.1 MVP target sizes

The MVP should comfortably support:

Markdown file size: up to 2 MB
CSV/JSON data source: up to 10 MB
Rows per table/chart: up to 50,000 rows
Rendered rows in table: virtualized or paginated

19.2 Large data handling

For MVP:

1. Warn for data files over 10 MB.
2. Warn for charts with more than 10,000 points.
3. Tables should paginate by default for more than 500 rows.
4. Avoid loading binary embeds over configured size.

19.3 Configurable limits

{
  "limits": {
    "maxMarkdownSizeMb": 2,
    "maxDataSizeMb": 10,
    "maxEmbedSizeMb": 25,
    "maxChartRows": 10000
  }
}

⸻

20. Testing requirements

20.1 Unit tests

Required coverage:

1. Directive parser.
2. YAML prop parser.
3. Data block parser.
4. Local file resolver.
5. Safe path resolution.
6. Schema validation.
7. Primitive normalization.
8. Query engine.
9. Error generation.

20.2 Integration tests

Test complete files:

valid-dashboard.agent.md
invalid-chart.agent.md
nested-tabs.agent.md
local-csv.agent.md
map-geojson.agent.md

20.3 Snapshot tests

Renderer snapshot tests for:

1. Chart.
2. Metric.
3. Table.
4. Diagram.
5. Map.
6. Timeline.
7. Tabs.
8. Callout.
9. Embed.
10. Form.
11. Query.
12. Component fallback.

20.4 Security tests

Must verify blocking of:

1. Path traversal.
2. Remote data URLs.
3. Raw scripts.
4. HTML embeds by default.
5. Files outside project root.
6. Unknown components.

⸻

21. Recommended implementation stack

21.1 Language

TypeScript

21.2 CLI

commander
picocolors
ora optional

21.3 Markdown

unified
remark-parse
remark-gfm
remark-frontmatter
remark-directive

21.4 Validation

zod

21.5 Data parsing

papaparse or csv-parse
yaml

21.6 Viewer

Vite
React
React Router optional

21.7 Components

Recharts
TanStack Table
Mermaid
Leaflet or custom coordinate map

21.8 File watching

chokidar

⸻

22. MVP implementation phases

Phase 1: Parser and schema

Deliverables:

1. Markdown parser.
2. Directive parser.
3. Data block parser.
4. Zod schemas for all primitives.
5. Canonical document AST.
6. Validation diagnostics.

Acceptance criteria:

Given an .agent.md file,
the parser returns a validated document model with nodes, data sources, and diagnostics.

⸻

Phase 2: CLI and local resolver

Deliverables:

1. agent-md init.
2. agent-md validate.
3. Safe local file resolver.
4. CSV/JSON/YAML loader.
5. Config loader.

Acceptance criteria:

User can initialize a project and validate local Agent Markdown files.

⸻

Phase 3: Viewer shell

Deliverables:

1. agent-md serve.
2. Local web server.
3. File browser.
4. Markdown rendering.
5. Diagnostics panel.
6. Hot reload.

Acceptance criteria:

User can open http://localhost:{port}, select a file, and see rendered Markdown plus validation diagnostics.

⸻

Phase 4: Core primitives

Implement:

1. ::metric
2. ::chart
3. ::table
4. ::callout
5. ::tabs

Acceptance criteria:

User can build a useful interactive report with KPIs, charts, tables, callouts, and tabs.

⸻

Phase 5: Advanced primitives

Implement:

1. ::diagram
2. ::timeline
3. ::query
4. ::embed
5. ::form
6. ::map
7. ::component fallback

Acceptance criteria:

All MVP primitives parse, validate, and render or gracefully fallback.

⸻

Phase 6: Agent skill packaging

Deliverables:

1. .agent-md/skill.md.
2. Agent adapter templates.
3. Example files.
4. Documentation.

Acceptance criteria:

A coding agent can read the installed skill and reliably produce valid Agent Markdown.

⸻

23. Example MVP document

---
format: agent-md
version: 0.1
---
# Q4 Revenue Dashboard
::callout
type: decision
title: Local-only MVP
This dashboard uses only local inline data and local files.
::
::metric
label: Total revenue
data: revenue
field: amount
aggregate: sum
format: currency
::
::chart
type: line
title: Revenue by month
data: revenue
x: month
y: amount
::
::tabs
:::tab
label: Table
::table
data: revenue
columns: [month, segment, amount]
sortable: true
filterable: true
::
:::
:::tab
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
::
:::
::
::timeline
events:
  - date: 2026-10-01
    title: Q4 started
  - date: 2026-12-31
    title: Q4 closed
::
```data revenue
month,segment,amount
Oct,SMB,100000
Oct,Enterprise,400000
Nov,SMB,120000
Nov,Enterprise,450000
Dec,SMB,140000
Dec,Enterprise,550000
```

⸻

24. Acceptance criteria for MVP release

The MVP is ready when:

1. npx agent-md init creates a working local project setup.
2. npx agent-md serve starts a local viewer.
3. The viewer scans and renders .agent.md and .amd.md files.
4. Normal Markdown renders correctly.
5. All listed primitives parse and validate.
6. Core primitives render interactively.
7. Advanced primitives either render or show graceful fallbacks.
8. Local CSV, JSON, YAML, and GeoJSON data can be loaded.
9. Unsafe paths and remote data references are blocked.
10. Inline errors include helpful messages and line numbers where possible.
11. npx agent-md validate works in CI-like environments.
12. The installed agent skill gives agents enough instruction to author valid files.

⸻

25. Strong MVP recommendation

Build the first usable version around this smaller “critical path”:

Markdown + data blocks + metric + chart + table + callout + tabs + validate + serve

Then add:

diagram + timeline + query + embed + form + map + component

The full primitive list is reasonable, but the MVP should avoid trying to make every primitive equally powerful. The real product value is the loop:

agent writes compact markdown
→ runtime validates it
→ local viewer renders it
→ user iterates

That loop should be rock-solid before adding deeper interactivity.