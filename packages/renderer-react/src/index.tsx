import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import mermaid from "mermaid";
import type { AgentMarkdownDocument, ChartNode, DataSource, DiagramNode, Diagnostic, DocumentNode, EmbedNode, MapNode, MetricNode, QueryNode, TableNode } from "@agent-md/schema";

export type StaticArtifact = { kind: "text"; mime: string; content: string } | { kind: "data"; mime: string; dataUrl: string };
type RendererContext = { staticArtifacts?: Record<string, StaticArtifact> };

export function AgentMarkdownRenderer({ document, staticArtifacts }: { document: AgentMarkdownDocument; staticArtifacts?: Record<string, StaticArtifact> }) {
  return <div className="agent-md-document">{document.nodes.map((node, index) => <NodeRenderer key={index} node={node} document={document} staticArtifacts={staticArtifacts} />)}</div>;
}

export function NodeRenderer({ node, document, staticArtifacts }: { node: DocumentNode; document: AgentMarkdownDocument } & RendererContext) {
  if (node.type === "markdown") return <ReactMarkdown>{node.value}</ReactMarkdown>;
  if (node.type === "error") return <ErrorCard message={node.message} raw={node.raw} diagnostic={diagnosticForNode(document, node)} />;
  if (node.type === "metric") return <Metric node={node} dataSources={document.dataSources} />;
  if (node.type === "chart") return <Chart node={node} dataSources={document.dataSources} />;
  if (node.type === "table") return <DataTable node={node} dataSources={document.dataSources} />;
  if (node.type === "callout") return <Callout node={node} document={document} staticArtifacts={staticArtifacts} />;
  if (node.type === "tabs") return <Tabs node={node} document={document} staticArtifacts={staticArtifacts} />;
  if (node.type === "query") return <QueryView node={node} dataSources={document.dataSources} />;
  if (node.type === "timeline") return <TimelineView node={node} />;
  if (node.type === "diagram") return <Diagram node={node} document={document} staticArtifacts={staticArtifacts} />;
  if (node.type === "map") return <MapView node={node} dataSources={document.dataSources} />;
  if (node.type === "embed") return <Embed node={node} document={document} staticArtifacts={staticArtifacts} />;
  if (node.type === "form") return <FormView node={node} />;
  if (node.type === "component") return <div className="agent-md-card agent-md-component-placeholder"><strong>Registered component: {node.name}</strong><p>Custom rendering is disabled by the current security config, so this safe placeholder is expected.</p></div>;
  return null;
}

function ErrorCard({ message, raw, diagnostic, suggestion }: { message: string; raw?: string; diagnostic?: Diagnostic; suggestion?: string }) {
  const nextAction = suggestion ?? diagnostic?.suggestion ?? "Check this block's fields and data references, then run agent-md validate again.";
  return <div className="agent-md-card agent-md-error"><strong>{message}</strong><p>{nextAction}</p>{diagnostic?.line ? <small>Source line {diagnostic.line}</small> : null}{diagnostic?.field ? <small> Field: {diagnostic.field}</small> : null}{diagnostic?.example ? <pre>{diagnostic.example}</pre> : raw ? <pre>{raw}</pre> : null}</div>;
}

function Metric({ node, dataSources }: { node: MetricNode; dataSources: Record<string, DataSource> }) {
  const value = useMemo(() => {
    if (node.value != null) return node.value;
    const rows = node.data ? dataSources[node.data]?.rows ?? [] : [];
    if (!node.field) return "";
    const values = rows.map((row) => Number(row[node.field!])).filter(Number.isFinite);
    if (node.aggregate === "count") return rows.length;
    if (node.aggregate === "avg") return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
    if (node.aggregate === "min") return Math.min(...values);
    if (node.aggregate === "max") return Math.max(...values);
    return values.reduce((sum, value) => sum + value, 0);
  }, [node, dataSources]);
  return <div className="agent-md-card agent-md-metric"><span>{node.label}</span><strong>{formatValue(value, node.format)}</strong>{node.delta ? <small>{node.delta}</small> : null}{node.description ? <p>{node.description}</p> : null}</div>;
}

function Chart({ node, dataSources }: { node: ChartNode; dataSources: Record<string, DataSource> }) {
  const rows = dataSources[node.data]?.rows ?? [];
  const height = node.height ?? 320;
  if (rows.length === 0) return <ErrorCard message={`No rows available for ${node.data}`} raw={`[Chart: ${node.chartType}]`} suggestion="Confirm the chart's data source exists and contains rows before sharing this report." />;
  const common = { data: rows };
  return <div className="agent-md-card"><h3>{node.title ?? fallbackFor(node)}</h3>{node.description ? <p>{node.description}</p> : null}<ResponsiveContainer width="100%" height={height}>{renderChart(node, common)}</ResponsiveContainer></div>;
}

function renderChart(node: ChartNode, common: { data: Record<string, unknown>[] }) {
  const yKeys = Array.isArray(node.y) ? node.y : node.y ? [node.y] : [];
  if (node.chartType === "bar") return <BarChart {...common}><XAxis dataKey={node.x} /><YAxis /><Tooltip />{node.legend !== false ? <Legend /> : null}{yKeys.map((key, index) => <Bar key={key} dataKey={key} fill={chartColor(index)} />)}</BarChart>;
  if (node.chartType === "area") return <AreaChart {...common}><XAxis dataKey={node.x} /><YAxis /><Tooltip />{yKeys.map((key, index) => <Area key={key} dataKey={key} fill={chartColor(index)} stroke={chartColor(index)} />)}</AreaChart>;
  if (node.chartType === "scatter") return <ScatterChart><XAxis dataKey={node.x} /><YAxis dataKey={typeof node.y === "string" ? node.y : undefined} /><Tooltip /><Scatter data={common.data} fill={chartColor(0)} /></ScatterChart>;
  if (node.chartType === "pie") return <PieChart><Tooltip />{node.legend !== false ? <Legend /> : null}<Pie data={common.data} dataKey={pieValueKey(node)} nameKey={pieNameKey(node)}>{common.data.map((_row, index) => <Cell key={`slice-${index}`} fill={chartColor(index)} />)}</Pie></PieChart>;
  return <LineChart {...common}><XAxis dataKey={node.x} /><YAxis /><Tooltip />{node.legend !== false ? <Legend /> : null}{yKeys.map((key, index) => <Line key={key} dataKey={key} stroke={chartColor(index)} />)}</LineChart>;
}

function chartColor(index: number) {
  return `var(--agent-md-chart-${index + 1}, var(--agent-md-chart-1, #2563eb))`;
}

function pieValueKey(node: ChartNode) {
  return node.value ?? (typeof node.y === "string" ? node.y : node.y?.[0]);
}

function pieNameKey(node: ChartNode) {
  return node.label ?? node.x;
}

function DataTable({ node, dataSources }: { node: TableNode; dataSources: Record<string, DataSource> }) {
  return <RowsTable title={node.title} rows={dataSources[node.data]?.rows ?? []} columns={node.columns} pageSize={node.pageSize ?? 25} />;
}

function QueryView({ node, dataSources }: { node: QueryNode; dataSources: Record<string, DataSource> }) {
  const source = dataSources[node.data];
  const rows = source ? runBrowserQuery(source.rows ?? [], node) : [];
  if (node.view === "json") return <pre>{JSON.stringify(rows, null, 2)}</pre>;
  return <RowsTable title="Query" rows={rows} columns={node.select} pageSize={25} />;
}

function RowsTable({ title, rows, columns, pageSize }: { title?: string; rows: Record<string, unknown>[]; columns?: string[]; pageSize: number }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<string | undefined>();
  const cols = columns?.length ? columns : Object.keys(rows[0] ?? {});
  const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const sorted = sort ? [...filtered].sort((a, b) => String(a[sort]).localeCompare(String(b[sort]))) : filtered;
  return <div className="agent-md-card"><h3>{title ?? "Table"}</h3><input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /><table><thead><tr>{cols.map((column) => <th key={column} onClick={() => setSort(column)}>{column}</th>)}</tr></thead><tbody>{sorted.slice(0, pageSize).map((row, index) => <tr key={index}>{cols.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table>{sorted.length > pageSize ? <small>Showing {pageSize} of {sorted.length} rows</small> : null}</div>;
}

function Callout({ node, document, staticArtifacts }: { node: Extract<DocumentNode, { type: "callout" }>; document: AgentMarkdownDocument } & RendererContext) {
  const children = node.body ? [] : node.children ?? [];
  return <div className={`agent-md-card agent-md-callout agent-md-${node.calloutType}`}><strong>{node.title ?? node.calloutType}</strong>{node.body ? <ReactMarkdown>{node.body}</ReactMarkdown> : null}{children.map((child, index) => <NodeRenderer key={index} node={child} document={document} staticArtifacts={staticArtifacts} />)}</div>;
}

function Tabs({ node, document, staticArtifacts }: { node: Extract<DocumentNode, { type: "tabs" }>; document: AgentMarkdownDocument } & RendererContext) {
  const initial = Math.max(0, node.tabs.findIndex((tab) => tab.label === node.default));
  const [active, setActive] = useState(initial);
  const tab = node.tabs[active];
  const variant = node.variant ?? "line";
  return <div className={`agent-md-card agent-md-tabs agent-md-tabs-${variant}`}><div>{node.tabs.map((item, index) => <button key={item.label} className={index === active ? "active" : undefined} aria-selected={index === active} onClick={() => setActive(index)}>{item.label}</button>)}</div>{tab?.children.map((child, index) => <NodeRenderer key={index} node={child} document={document} staticArtifacts={staticArtifacts} />)}</div>;
}

function TimelineView({ node }: { node: Extract<DocumentNode, { type: "timeline" }> }) {
  const events = [...(node.events ?? [])].sort((left, right) => {
    const result = Date.parse(left.date) - Date.parse(right.date);
    return node.sort === "desc" ? -result : result;
  });
  return <div className={`agent-md-card agent-md-timeline agent-md-timeline-${node.layout ?? "vertical"}`}><h3>Timeline</h3>{events.map((event) => <article key={`${event.date}-${event.title}`} className="agent-md-timeline-event">{event.group ? <small className="agent-md-timeline-group">{event.group}</small> : null}<p><strong>{event.date}</strong> {event.title}</p>{event.description ? <p className="agent-md-timeline-description">{event.description}</p> : null}</article>)}</div>;
}

function Diagram({ node, document, staticArtifacts }: { node: DiagramNode; document: AgentMarkdownDocument } & RendererContext) {
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const source = node.source ?? staticTextArtifact(staticArtifacts, node.src) ?? (node.src && hasHttpArtifactEndpoint() ? await fetchArtifactText(document.sourcePath, node.src, "diagram source") : "");
        if (!source.trim()) throw new Error(`No diagram source available for ${node.title ?? node.diagramType}.`);
        const mermaidSource = toMermaidSource(node, source);
        const simpleFlowchart = node.diagramType === "flowchart" ? renderSimpleFlowchartSvg(mermaidSource, node.direction ?? "TB") : undefined;
        if (simpleFlowchart) {
          if (!cancelled) setSvg(simpleFlowchart);
          return;
        }
        mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default" });
        const result = await mermaid.render(`agent-md-diagram-${hashString(mermaidSource)}`, mermaidSource);
        const sanitized = sanitizeSvg(result.svg);
        if (!sanitized) throw new Error("Unable to safely render diagram SVG.");
        if (!cancelled) setSvg(sanitized);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to render diagram");
      }
    }
    render();
    return () => { cancelled = true; };
  }, [document.sourcePath, node, staticArtifacts]);
  if (error) return <ErrorCard message={error} raw={node.source ?? node.src} suggestion="Fix the diagram source or open the report in the local viewer if it references a local file." />;
  return <div className="agent-md-card"><h3>{node.title ?? "Diagram"}</h3>{svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <p>Rendering diagram...</p>}</div>;
}

function Embed({ node, document, staticArtifacts }: { node: EmbedNode; document: AgentMarkdownDocument } & RendererContext) {
  const mode = node.mode ?? "preview";
  const artifact = staticArtifacts?.[node.src];
  const url = artifactUrl(document.sourcePath, node.src);
  const kind = artifactKind(node.src);
  const artifactHref = artifact?.kind === "data" ? artifact.dataUrl : url;
  const canPreview = Boolean(artifact || url) && mode !== "link";
  return <div className="agent-md-card agent-md-embed"><div className="agent-md-embed-header"><div><h3>{node.title ?? node.src}</h3><small>{node.src}</small></div>{artifactHref ? <a href={artifactHref} target="_blank" rel="noreferrer">{mode === "link" ? "Open artifact" : "Open"}</a> : null}</div>{node.caption ? <p className="agent-md-embed-caption">{node.caption}</p> : null}{canPreview ? <EmbedPreview node={node} url={url} artifact={artifact} kind={kind} /> : <EmbedFallback mode={mode} hasUrl={Boolean(artifactHref)} kind={kind} />}</div>;
}

function EmbedPreview({ node, url, artifact, kind }: { node: EmbedNode; url?: string; artifact?: StaticArtifact; kind: ArtifactKind }) {
  if (kind === "image" && artifact?.kind === "data") return <img className="agent-md-embed-image" src={artifact.dataUrl} alt={node.title ?? node.src} style={{ maxHeight: node.height, maxWidth: node.width }} />;
  if (kind === "image" && url) return <img className="agent-md-embed-image" src={url} alt={node.title ?? node.src} style={{ maxHeight: node.height, maxWidth: node.width }} />;
  if (kind === "markdown" || kind === "text" || kind === "json" || kind === "csv") return <TextEmbed node={node} url={url} artifact={artifact} kind={kind} />;
  if (kind === "video" && artifact?.kind === "data") return <video className="agent-md-embed-media" src={artifact.dataUrl} controls style={{ maxHeight: node.height, maxWidth: node.width }} />;
  if (kind === "video" && url) return <video className="agent-md-embed-media" src={url} controls style={{ maxHeight: node.height, maxWidth: node.width }} />;
  return <EmbedFallback mode={node.mode ?? "preview"} hasUrl={true} kind={kind} />;
}

function TextEmbed({ node, url, artifact, kind }: { node: EmbedNode; url?: string; artifact?: StaticArtifact; kind: Extract<ArtifactKind, "markdown" | "text" | "json" | "csv"> }) {
  const initialText = artifact?.kind === "text" ? kind === "json" ? formatJson(artifact.content) : artifact.content : undefined;
  const [text, setText] = useState<string | undefined>(initialText);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    if (artifact?.kind === "text") {
      setText(kind === "json" ? formatJson(artifact.content) : artifact.content);
      return () => { cancelled = true; };
    }
    if (!url) {
      setError("No artifact URL is available.");
      return () => { cancelled = true; };
    }
    fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load artifact: ${response.status}`);
      return response.text();
    }).then((value) => {
      if (!cancelled) setText(kind === "json" ? formatJson(value) : value);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load artifact");
    });
    return () => { cancelled = true; };
  }, [artifact, kind, url]);
  if (error) return <ErrorCard message={error} raw={node.src} suggestion="Open this report from the local viewer and confirm the artifact exists inside the project." />;
  if (text == null) return <p className="agent-md-embed-loading">Loading artifact...</p>;
  if (kind === "markdown" && (node.mode ?? "preview") === "preview") return <div className="agent-md-embed-markdown"><ReactMarkdown>{text}</ReactMarkdown></div>;
  return <pre className="agent-md-embed-text">{text}</pre>;
}

function EmbedFallback({ mode, hasUrl, kind }: { mode: EmbedNode["mode"]; hasUrl: boolean; kind: ArtifactKind }) {
  if (!hasUrl) return <p className="agent-md-embed-caption">Preview this artifact from the local browser viewer to load project files safely.</p>;
  if (mode === "link") return null;
  return <p className="agent-md-embed-caption">{kind === "html" ? "HTML embeds are opened as links and are not executed inline." : "This artifact type opens as a link."}</p>;
}

function MapView({ node, dataSources }: { node: MapNode; dataSources: Record<string, DataSource> }) {
  const source = dataSources[node.data];
  const height = node.height ?? 360;
  if (!source) return <ErrorCard message={`No data available for ${node.data}`} raw={`[Map: ${node.title ?? node.data}]`} suggestion="Add the referenced map data source or update the map's data field." />;
  if (source.object && isGeoJson(source.object)) return <GeoJsonMap title={node.title} geojson={source.object} height={height} />;
  const rows = source.rows ?? [];
  if (!node.lat || !node.lon || rows.length === 0) return <ErrorCard message="Map requires row data plus lat/lon fields." raw={node.title ?? node.data} suggestion="Provide lat and lon fields that point to numeric coordinate columns." />;
  const points = rows.map((row) => ({ row, lat: Number(row[node.lat!]), lon: Number(row[node.lon!]) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (points.length === 0) return <ErrorCard message="Map has no valid numeric coordinates." raw={node.title ?? node.data} suggestion="Fix the coordinate columns so at least one row has valid numeric latitude and longitude values." />;
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const bounds = padBounds({ minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) });
  return <div className="agent-md-card"><h3>{node.title ?? "Map"}</h3><svg viewBox="0 0 1000 520" width="100%" height={height} role="img" aria-label={node.title ?? "Map"}><rect x="0" y="0" width="1000" height="520" rx="18" fill="#f8fafc" stroke="#dbeafe" /><Grid />{points.map((point, index) => { const { x, y } = project(point.lat, point.lon, bounds); const label = node.label ? String(point.row[node.label] ?? "") : ""; const value = node.value ? Number(point.row[node.value]) : 0; const radius = value > 0 ? Math.max(7, Math.min(24, Math.sqrt(value) / 45)) : 10; return <g key={index}><circle cx={x} cy={y} r={radius} fill="#2563eb" opacity="0.82" stroke="#1e3a8a" strokeWidth="2" /><text x={x + radius + 6} y={y + 4} fontSize="24" fill="#0f172a">{label}</text></g>; })}</svg></div>;
}

function GeoJsonMap({ title, geojson, height }: { title?: string; geojson: GeoJson; height: number }) {
  const coordinates = collectGeoCoordinates(geojson);
  if (coordinates.length === 0) return <ErrorCard message="GeoJSON has no drawable coordinates." raw={title ?? "GeoJSON map"} suggestion="Check the GeoJSON geometry and use a FeatureCollection with drawable coordinates." />;
  const bounds = padBounds({ minLat: Math.min(...coordinates.map((coord) => coord[1])), maxLat: Math.max(...coordinates.map((coord) => coord[1])), minLon: Math.min(...coordinates.map((coord) => coord[0])), maxLon: Math.max(...coordinates.map((coord) => coord[0])) });
  return <div className="agent-md-card"><h3>{title ?? "GeoJSON map"}</h3><svg viewBox="0 0 1000 520" width="100%" height={height} role="img" aria-label={title ?? "GeoJSON map"}><rect x="0" y="0" width="1000" height="520" rx="18" fill="#f8fafc" stroke="#dbeafe" /><Grid />{geojson.features.map((feature, index) => <path key={index} d={featurePath(feature, bounds)} fill="#93c5fd" opacity="0.55" stroke="#1d4ed8" strokeWidth="3" />)}</svg></div>;
}

function Grid() {
  return <g opacity="0.35">{[1, 2, 3, 4].map((item) => <line key={`v-${item}`} x1={item * 200} x2={item * 200} y1="30" y2="490" stroke="#bfdbfe" />)}{[1, 2, 3, 4].map((item) => <line key={`h-${item}`} y1={item * 100} y2={item * 100} x1="30" x2="970" stroke="#bfdbfe" />)}</g>;
}

function FormView({ node }: { node: Extract<DocumentNode, { type: "form" }> }) {
  return <form className="agent-md-card agent-md-form" onSubmit={(event) => event.preventDefault()}><h3>{node.title ?? "Form"}</h3>{node.description ? <p>{node.description}</p> : null}<div className="agent-md-form-fields">{node.fields.map((field) => <label key={field.name} className={`agent-md-form-field agent-md-form-field-${field.fieldType}`}><span>{field.label ?? field.name}</span>{renderFormField(field)}</label>)}</div>{node.submitLabel ? <button type="submit" className="agent-md-form-submit">{node.submitLabel}</button> : null}</form>;
}

function renderFormField(field: Extract<DocumentNode, { type: "form" }>["fields"][number]) {
  if (field.fieldType === "select") return <select name={field.name} defaultValue={String(field.default ?? "")}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.fieldType === "checkbox") return <input name={field.name} type="checkbox" defaultChecked={Boolean(field.default)} />;
  const type = field.fieldType === "date" ? "date" : field.fieldType === "number" ? "number" : "text";
  return <input name={field.name} type={type} defaultValue={String(field.default ?? "")} placeholder={field.placeholder} required={field.required} min={field.min} max={field.max} step={field.step} />;
}

function fallbackFor(node: ChartNode) { return `[Chart: ${node.chartType} chart of ${node.y ?? node.value ?? "value"} by ${node.x ?? node.label ?? "label"}]`; }
function formatValue(value: unknown, format?: string) { return format === "currency" && typeof value === "number" ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value) : String(value); }
function diagnosticForNode(document: AgentMarkdownDocument, node: DocumentNode) {
  return document.diagnostics.find((diagnostic) => diagnostic.line === node.line && diagnostic.severity === "error") ?? document.diagnostics.find((diagnostic) => diagnostic.line === node.line);
}
function hasHttpArtifactEndpoint() {
  return typeof window !== "undefined" && window.location.protocol.startsWith("http");
}
function artifactUrl(sourcePath: string, src: string) {
  if (!hasHttpArtifactEndpoint()) return undefined;
  return `/artifact?file=${encodeURIComponent(sourcePath)}&src=${encodeURIComponent(src)}`;
}
async function fetchArtifactText(sourcePath: string, src: string, label = "artifact") {
  const response = await fetch(`/artifact?file=${encodeURIComponent(sourcePath)}&src=${encodeURIComponent(src)}`);
  if (!response.ok) throw new Error(`Unable to load ${label}: ${response.status}`);
  return response.text();
}

type ArtifactKind = "markdown" | "text" | "json" | "csv" | "image" | "video" | "pdf" | "html" | "unknown";

function staticTextArtifact(artifacts: Record<string, StaticArtifact> | undefined, src: string | undefined) {
  if (!src) return undefined;
  const artifact = artifacts?.[src];
  return artifact?.kind === "text" ? artifact.content : undefined;
}

function artifactKind(src: string): ArtifactKind {
  const ext = src.split(/[?#]/)[0]?.toLowerCase().split(".").pop() ?? "";
  if (["md", "mmd", "mermaid", "txt"].includes(ext)) return ext === "md" ? "markdown" : "text";
  if (["csv", "tsv"].includes(ext)) return "csv";
  if (ext === "json") return "json";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "image";
  if (["webm", "mp4"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (ext === "html") return "html";
  return "unknown";
}

function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function toMermaidSource(node: DiagramNode, source: string) {
  if (node.diagramType === "flowchart" && !source.trim().startsWith("flowchart") && !source.trim().startsWith("graph")) return `flowchart ${node.direction ?? "TD"}\n${source}`;
  if (node.diagramType === "sequence" && !source.trim().startsWith("sequenceDiagram")) return `sequenceDiagram\n${source}`;
  if (node.diagramType === "tree" && !source.trim().startsWith("graph")) return `graph TD\n${source}`;
  return source;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  return Math.abs(hash).toString(36);
}

function renderSimpleFlowchartSvg(source: string, direction: DiagramNode["direction"]) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("flowchart") && !line.startsWith("graph"));
  const nodes = new Map<string, string>();
  const edges: Array<[string, string]> = [];
  const nodePattern = /([A-Za-z0-9_]+)(?:\["([^"]+)"\]|\[([^\]]+)\])?/g;
  for (const line of lines) {
    if (!line.includes("-->")) return undefined;
    const [left, right] = line.split(/-->/).map((part) => part.trim());
    const parsedLeft = parseFlowNode(left, nodePattern);
    const parsedRight = parseFlowNode(right, nodePattern);
    if (!parsedLeft || !parsedRight) return undefined;
    if (!nodes.has(parsedLeft.id) || parsedLeft.label !== parsedLeft.id) nodes.set(parsedLeft.id, parsedLeft.label);
    if (!nodes.has(parsedRight.id) || parsedRight.label !== parsedRight.id) nodes.set(parsedRight.id, parsedRight.label);
    edges.push([parsedLeft.id, parsedRight.id]);
  }
  if (nodes.size === 0 || edges.length === 0) return undefined;
  const horizontal = direction === "LR" || direction === "RL";
  const ids = [...nodes.keys()];
  const ordered = ids.map((id) => `<div class="agent-md-simple-flow-node">${escapeHtmlText(nodes.get(id) ?? id)}</div>`);
  const arrow = `<div class="agent-md-simple-flow-arrow" aria-hidden="true">${horizontal ? "->" : "↓"}</div>`;
  return `<div class="agent-md-simple-flow agent-md-simple-flow-${horizontal ? "horizontal" : "vertical"}" role="img" aria-label="Flowchart">${ordered.map((item, index) => `${index > 0 ? arrow : ""}${item}`).join("")}</div>`;
}

function parseFlowNode(source: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  const match = pattern.exec(source);
  if (!match) return undefined;
  return { id: match[1], label: match[2] ?? match[3] ?? match[1] };
}

function escapeHtmlText(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]!));
}

type GeoJson = { type: "FeatureCollection"; features: GeoFeature[] };
type GeoFeature = { type: "Feature"; geometry?: { type: string; coordinates: unknown } };
type MapBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };

function isGeoJson(value: unknown): value is GeoJson {
  return Boolean(value) && typeof value === "object" && (value as { type?: unknown }).type === "FeatureCollection" && Array.isArray((value as { features?: unknown }).features);
}

function padBounds(bounds: MapBounds): MapBounds {
  const latPad = Math.max((bounds.maxLat - bounds.minLat) * 0.15, 0.5);
  const lonPad = Math.max((bounds.maxLon - bounds.minLon) * 0.15, 0.5);
  return { minLat: bounds.minLat - latPad, maxLat: bounds.maxLat + latPad, minLon: bounds.minLon - lonPad, maxLon: bounds.maxLon + lonPad };
}

function project(lat: number, lon: number, bounds: MapBounds) {
  const x = 50 + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1)) * 900;
  const y = 490 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * 460;
  return { x, y };
}

function collectGeoCoordinates(geojson: GeoJson): [number, number][] {
  return geojson.features.flatMap((feature) => flattenCoordinates(feature.geometry?.coordinates));
}

function flattenCoordinates(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  if (typeof value[0] === "number" && typeof value[1] === "number") return [[value[0], value[1]]];
  return value.flatMap(flattenCoordinates);
}

function featurePath(feature: GeoFeature, bounds: MapBounds) {
  const rings = feature.geometry?.type === "Polygon" ? feature.geometry.coordinates as unknown[] : feature.geometry?.type === "MultiPolygon" ? (feature.geometry.coordinates as unknown[]).flat() : [];
  return rings.map((ring) => flattenCoordinates(ring).map(([lon, lat], index) => { const { x, y } = project(lat, lon, bounds); return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ") + " Z").join(" ");
}

function sanitizeSvg(svg: string) {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return "";
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return "";
  const blockedElements = new Set(["script", "iframe", "object", "embed"]);
  const elements = Array.from(parsed.querySelectorAll("*"));
  for (const element of elements) {
    if (blockedElements.has(element.tagName.toLowerCase())) {
      element.remove();
      continue;
    }
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) element.removeAttribute(attr.name);
      else if ((name === "href" || name === "xlink:href") && !value.startsWith("#")) element.removeAttribute(attr.name);
      else if ((name === "style" || name === "class") && (value.includes("javascript:") || value.includes("expression("))) element.removeAttribute(attr.name);
    }
  }
  return new XMLSerializer().serializeToString(parsed.documentElement);
}

function runBrowserQuery(rows: Record<string, unknown>[], node: QueryNode) {
  let next = rows.filter((row) => Object.entries(node.where ?? {}).every(([key, predicate]) => {
    const value = row[key];
    if (typeof predicate !== "object" || predicate === null || Array.isArray(predicate)) return value === predicate;
    if ("eq" in predicate && value !== predicate.eq) return false;
    if ("neq" in predicate && value === predicate.neq) return false;
    if ("gt" in predicate && !(Number(value) > predicate.gt!)) return false;
    if ("gte" in predicate && !(Number(value) >= predicate.gte!)) return false;
    if ("lt" in predicate && !(Number(value) < predicate.lt!)) return false;
    if ("lte" in predicate && !(Number(value) <= predicate.lte!)) return false;
    if ("contains" in predicate && !String(value).includes(predicate.contains!)) return false;
    if ("in" in predicate && !predicate.in!.includes(value)) return false;
    return true;
  }));
  if (node.select?.length) next = next.map((row) => Object.fromEntries(node.select!.map((key) => [key, row[key]])));
  if (node.sort) next = [...next].sort((a, b) => compareValues(a[node.sort!.by], b[node.sort!.by], node.sort!.direction ?? "asc"));
  return node.limit ? next.slice(0, node.limit) : next;
}

function compareValues(a: unknown, b: unknown, direction: "asc" | "desc") {
  const result = a === b ? 0 : a == null ? -1 : b == null ? 1 : a > b ? 1 : -1;
  return direction === "asc" ? result : -result;
}
