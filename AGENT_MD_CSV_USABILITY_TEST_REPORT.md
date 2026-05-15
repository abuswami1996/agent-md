# Agent Markdown CSV Usability Test Report

## Artifacts Tested

- Source data: `ai_workforce_displacement_global_2020_2026.csv`
- Agent Markdown report: `ai_workforce_displacement_exploration.agent.md`
- Converted HTML: `ai_workforce_displacement_exploration.html`
- Static HTML test URL: `http://127.0.0.1:8766/ai_workforce_displacement_exploration.html`
- Live viewer test URL: `http://127.0.0.1:3847/`
- Primitive fixture directory: `primitive-render-tests/`
- Primitive converted HTML directory: `primitive-render-tests/html/`
- Primitive static HTML test URL: `http://127.0.0.1:8767/primitive-render-tests/html/<fixture>.html`
- Primitive live viewer test URL: `http://127.0.0.1:3848/`

## Primitive Coverage

All supported package primitives were tested with one focused `.agent.md` fixture each:

- `::metric`: `primitive-render-tests/01-metric.agent.md`
- `::chart`: `primitive-render-tests/02-chart.agent.md`
- `::table`: `primitive-render-tests/03-table.agent.md`
- `::callout`: `primitive-render-tests/04-callout.agent.md`
- `::tabs`: `primitive-render-tests/05-tabs.agent.md`
- `::diagram`: `primitive-render-tests/06-diagram.agent.md`
- `::map`: `primitive-render-tests/07-map.agent.md`
- `::timeline`: `primitive-render-tests/08-timeline.agent.md`
- `::query`: `primitive-render-tests/09-query.agent.md`
- `::embed`: `primitive-render-tests/10-embed.agent.md`
- `::form`: `primitive-render-tests/11-form.agent.md`
- `::component`: `primitive-render-tests/12-component.agent.md`

Backing data and artifacts were created under `primitive-render-tests/data/`, `primitive-render-tests/artifacts/`, and `primitive-render-tests/diagrams/`.

## Validation Evidence

Final validation passed with one informational diagnostic:

- `table_paginated`: the source CSV table has 20,800 rows, so pagination is expected and useful.

Primitive fixture validation results:

- `metric`, `chart`, `table`, `callout`, `tabs`, `diagram`, `map`, `timeline`, `query`, `embed`, and `form` validated cleanly.
- `component` validated with the expected `custom_component_disabled` warning because custom components are disabled by the default security config.
- All primitive fixtures converted to HTML successfully.

Two authoring failures were observed and fixed before the final conversion:

- A source-table directive was initially drafted with one leading space before `data:`. The validator reported both `directive_yaml_error` and `invalid_field` for missing `data`. Fix: directive properties must begin at column 1 unless they are nested YAML fields.
- A one-line `body:` value containing `data:` caused a YAML parse error. Fix: use a quoted string or a block scalar (`body: >-`) for prose with colons, backticks, or other punctuation.

Skill improvement: the Agent Markdown skill should include a short "common validator failures" section with examples for column-1 directive properties, YAML block scalars for prose, and interpreting paired YAML/schema diagnostics.

## Bugs Found

- Free-form `::callout` bodies render twice. The parser infers `body` from markdown content but also keeps the markdown child node, and the React renderer displays both. Workaround applied in the report: use explicit `body:` fields. Proposed fix: when callout body is inferred, either omit markdown children or have `Callout` render children only when `body` is absent.

- `::diagram` flowchart node labels are invisible in both converted HTML and live viewer rendering. The boxes and arrows render, but text such as `Draft`, `Validate`, and `Inspect` does not appear. Proposed fix: inspect the Mermaid SVG sanitizer and CSS interaction; preserve text-related SVG attributes/classes needed by Mermaid while still removing active content.

- `::diagram` with `src` fails in converted static HTML. Static HTML tries to fetch `/artifact?...src=diagrams/external-flow.mmd`, which returns 404 outside the `agent-md serve` API. The same fixture works in the live viewer. Proposed fix: inline resolved local diagram source into the static payload during conversion, or rewrite static artifact links to embedded blobs/data URLs.

- `::embed` local Markdown and JSON artifacts fail in converted static HTML for the same `/artifact` reason. Both artifacts render correctly in the live viewer, but static HTML shows `Unable to load artifact: 404`. Proposed fix: include safe local artifact contents in the converted static payload for supported preview modes.

- `::form` select fields render as text inputs. In the validation checklist, `next_priority` is declared as `type: select`, but the renderer displays a textbox. Proposed fix: update `FormView` to render `<select>` with options for `fieldType === "select"`.

- `::form` checkbox defaults are not semantically handled. The renderer uses `defaultValue` for all inputs, including checkboxes. The primitive fixture declared `default: true`, but the checkbox appeared unchecked. Proposed fix: use `defaultChecked` for checkbox fields and omit text `defaultValue` there.

- `::form` does not render `submitLabel`; no submit button appeared in the primitive fixture. Proposed fix: render a button using `submitLabel` when present, with clear local-only behavior.

- `::query` ignores `sort.direction` in the browser renderer. The fixture requested `direction: desc` by revenue, but the displayed rows were sorted ascending (`Mar`, `Apr`, `May`) instead of descending (`May`, `Apr`, `Mar`). Proposed fix: reuse the resolver's `compareValues` logic in the renderer or share query execution between resolver and renderer.

- `::timeline` drops supported fields. The fixture provided `description`, `group`, and `layout`, but the renderer only displayed date and title. Proposed fix: render event descriptions/groups and honor layout variants, or remove unsupported fields from the schema until implemented.

- `::tabs` accepts `variant` but the renderer does not visibly honor it. The fixture used `variant: pill`, but rendering looked like the default line tabs. Proposed fix: apply variant-specific classes and styles.

- `::component` renders the expected placeholder when custom components are disabled, but the static report shows a full diagnostics panel for the expected warning. Proposed fix: distinguish expected security placeholders from actual document problems, or allow the placeholder itself to carry the warning without making the whole document feel broken.

- Static HTML produced by `agent-md convert` shows absolute local source paths in the header for every primitive fixture. Proposed fix: prefer frontmatter `title` plus relative source path for share-ready output.

- The live viewer sidebar groups root-level files as uppercase folder names based on the whole filename. In the primitive fixture run, every root file appeared as its own folder (`01-METRIC.AGENT.MD`, `02-CHART.AGENT.MD`, etc.). Proposed fix: group root files under `Root` and only derive folder groups from path segments when a slash exists.

- The live viewer briefly shows `Files (0)` and an empty preview while `/api/files` is loading. Proposed fix: show an explicit loading state and avoid rendering an empty file list until the first response returns.

- The live viewer can show stale document content under a newly selected filename. During testing, the header updated to `ai_workforce_displacement_exploration.agent.md` before the prior document body was replaced. Proposed fix: clear `document` and show a loading state when selection changes, or update selected file and document atomically after fetch completion.

- The live viewer Source button and sidebar file buttons were sometimes difficult to activate after nested scroll interactions; the browser reported click targets intercepted by sidebar/text elements. Proposed fix: verify z-index/layout for the preview header/sidebar and add regression coverage for clicking Source and file rows after scrolling.

## Primitive Results

- `::metric`: passed validation, static HTML, and live viewer rendering. Aggregated sum and count rendered as expected.
- `::chart`: passed validation and rendered in static/live views. Line, bar, area, scatter, and pie chart cards appeared with axes/legends where configured.
- `::table`: passed validation and rendered in static/live views. Search and page-size display worked.
- `::callout`: explicit `body:` rendered correctly; free-form body rendered twice.
- `::tabs`: default tab selection worked; nested metric/table content rendered; `variant` styling appeared ignored.
- `::diagram`: inline diagrams rendered, but flowchart labels were invisible; external `src` worked only in live viewer, not converted static HTML.
- `::map`: point map and GeoJSON map rendered in static/live views.
- `::timeline`: events rendered, but descriptions/groups/layout were ignored.
- `::query`: table and JSON query views rendered; `sort.direction` was ignored in browser rendering.
- `::embed`: live viewer loaded Markdown and JSON artifacts; converted static HTML failed with 404 artifact fetches.
- `::form`: rendered text, number, checkbox, date fields; select rendered as text, checkbox default was wrong, and submit label was not rendered.
- `::component`: rendered the default disabled placeholder with the expected security warning.

## Improvements

- Prefer derived summary data for charts when source CSVs exceed chart-row targets. This report references the full CSV for tables/queries and uses inline summaries for chart primitives.
- Consider allowing a `--file` or query-param launch path for `agent-md serve` so the viewer opens the requested document instead of the first scanned file.
- The static HTML header shows an absolute source path. For share-ready reports, a relative path or title would be cleaner and less machine-specific.
- Diagnostics could distinguish "valid with info" from "needs attention" more clearly. The current converted report shows `4 nodes · 1 diagnostics`, which can look like a problem even though the only diagnostic is informational.
- Add generated primitive smoke fixtures to the repository test suite. The fixture set in `primitive-render-tests/` is a good starting point for visual/regression tests.
- Share query execution code between resolver and React renderer so validation/export/server behavior cannot drift.
- Add conversion tests for local artifacts referenced by `::embed` and `::diagram src`.
- Expand the skill guidance to recommend explicit `body:` for callouts until the duplicate-body bug is fixed.

## Fixes Applied

- Created `ai_workforce_displacement_exploration.agent.md` with metrics, charts, tables, queries, tabs, a diagram, timeline, and form controls.
- Converted the report to `ai_workforce_displacement_exploration.html`.
- Revised callouts to use explicit `body:` fields to avoid duplicate rendered text.
- Revalidated after fixes; final result is valid with only the expected `table_paginated` info diagnostic.
- Created `primitive-render-tests/` with one validation/conversion/browser fixture per supported primitive.
- Converted all primitive fixtures into `primitive-render-tests/html/`.

## Implementation Status

The bugs above were fixed and rechecked against the primitive fixtures:

- `::callout` free-form bodies now render once because renderer children are suppressed when `body` is present.
- `::form` now renders text, number, date, select, checkbox defaults, and `submitLabel`.
- `::query` now honors `sort.direction` in the browser renderer.
- `::timeline` now renders `description`, `group`, layout classes, and declared sort order.
- `::tabs` now emits variant and active classes for line, pill, and card styling.
- `::diagram` flowcharts now use a safe built-in fallback for simple flowchart syntax so labels are visible; Mermaid remains in place for sequence/tree and unsupported flowchart forms.
- Converted static HTML now embeds safe local artifacts for `::embed` and `::diagram src`, so Markdown/JSON/text/CSV and Mermaid artifact previews do not rely on `/artifact`.
- Static HTML headers now prefer frontmatter titles plus relative paths.
- The live viewer now shows loading states, clears stale content on selection change, groups root files under `Root`, and allows file/sidebar and Source clicks after scrolling.

Regression coverage was added for renderer primitive behavior, static artifact conversion, and root file grouping. The primitive fixtures were revalidated and reconverted successfully after these changes.
