import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import mermaid from "mermaid";
import type { AgentMarkdownDocument, ChartNode, DataSource, DiagramNode, DocumentNode, MapNode, MetricNode, QueryNode, TableNode } from "@agent-md/schema";

export function AgentMarkdownRenderer({ document }: { document: AgentMarkdownDocument }) {
  return <div className="agent-md-document">{document.nodes.map((node, index) => <NodeRenderer key={index} node={node} document={document} />)}</div>;
}

export function NodeRenderer({ node, document }: { node: DocumentNode; document: AgentMarkdownDocument }) {
  if (node.type === "markdown") return <ReactMarkdown>{node.value}</ReactMarkdown>;
  if (node.type === "error") return <ErrorCard message={node.message} raw={node.raw} />;
  if (node.type === "metric") return <Metric node={node} dataSources={document.dataSources} />;
  if (node.type === "chart") return <Chart node={node} dataSources={document.dataSources} />;
  if (node.type === "table") return <DataTable node={node} dataSources={document.dataSources} />;
  if (node.type === "callout") return <Callout node={node} document={document} />;
  if (node.type === "tabs") return <Tabs node={node} document={document} />;
  if (node.type === "query") return <QueryView node={node} dataSources={document.dataSources} />;
  if (node.type === "timeline") return <div className="agent-md-card"><h3>Timeline</h3>{(node.events ?? []).map((event) => <p key={`${event.date}-${event.title}`}><strong>{event.date}</strong> {event.title}</p>)}</div>;
  if (node.type === "diagram") return <Diagram node={node} document={document} />;
  if (node.type === "map") return <MapView node={node} dataSources={document.dataSources} />;
  if (node.type === "embed") return <div className="agent-md-card"><strong>{node.title ?? node.src}</strong><p>[Embed: {node.src}]</p></div>;
  if (node.type === "form") return <FormView node={node} />;
  if (node.type === "component") return <div className="agent-md-card">Registered component: {node.name}. Custom rendering disabled in current config.</div>;
  return null;
}

function ErrorCard({ message, raw }: { message: string; raw?: string }) {
  return <div className="agent-md-card agent-md-error"><strong>{message}</strong>{raw ? <pre>{raw}</pre> : null}</div>;
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
  if (rows.length === 0) return <ErrorCard message={`No rows available for ${node.data}`} raw={`[Chart: ${node.chartType}]`} />;
  const common = { data: rows };
  return <div className="agent-md-card"><h3>{node.title ?? fallbackFor(node)}</h3>{node.description ? <p>{node.description}</p> : null}<ResponsiveContainer width="100%" height={height}>{renderChart(node, common)}</ResponsiveContainer></div>;
}

function renderChart(node: ChartNode, common: { data: Record<string, unknown>[] }) {
  const yKeys = Array.isArray(node.y) ? node.y : node.y ? [node.y] : [];
  if (node.chartType === "bar") return <BarChart {...common}><XAxis dataKey={node.x} /><YAxis /><Tooltip />{node.legend !== false ? <Legend /> : null}{yKeys.map((key) => <Bar key={key} dataKey={key} />)}</BarChart>;
  if (node.chartType === "area") return <AreaChart {...common}><XAxis dataKey={node.x} /><YAxis /><Tooltip />{yKeys.map((key) => <Area key={key} dataKey={key} />)}</AreaChart>;
  if (node.chartType === "scatter") return <ScatterChart><XAxis dataKey={node.x} /><YAxis dataKey={typeof node.y === "string" ? node.y : undefined} /><Tooltip /><Scatter data={common.data} /></ScatterChart>;
  if (node.chartType === "pie") return <PieChart><Tooltip /><Pie data={common.data} dataKey={node.value} nameKey={node.label} /></PieChart>;
  return <LineChart {...common}><XAxis dataKey={node.x} /><YAxis /><Tooltip />{node.legend !== false ? <Legend /> : null}{yKeys.map((key) => <Line key={key} dataKey={key} />)}</LineChart>;
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

function Callout({ node, document }: { node: Extract<DocumentNode, { type: "callout" }>; document: AgentMarkdownDocument }) {
  return <div className={`agent-md-card agent-md-callout agent-md-${node.calloutType}`}><strong>{node.title ?? node.calloutType}</strong>{node.body ? <ReactMarkdown>{node.body}</ReactMarkdown> : null}{node.children?.map((child, index) => <NodeRenderer key={index} node={child} document={document} />)}</div>;
}

function Tabs({ node, document }: { node: Extract<DocumentNode, { type: "tabs" }>; document: AgentMarkdownDocument }) {
  const initial = Math.max(0, node.tabs.findIndex((tab) => tab.label === node.default));
  const [active, setActive] = useState(initial);
  const tab = node.tabs[active];
  return <div className="agent-md-card agent-md-tabs"><div>{node.tabs.map((item, index) => <button key={item.label} onClick={() => setActive(index)}>{item.label}</button>)}</div>{tab?.children.map((child, index) => <NodeRenderer key={index} node={child} document={document} />)}</div>;
}

function Diagram({ node, document }: { node: DiagramNode; document: AgentMarkdownDocument }) {
  const [svg, setSvg] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const source = node.source ?? (node.src && hasHttpArtifactEndpoint() ? await fetchArtifactText(document.sourcePath, node.src) : "");
        if (!source.trim()) throw new Error(`No diagram source available for ${node.title ?? node.diagramType}.`);
        const mermaidSource = toMermaidSource(node, source);
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
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
  }, [document.sourcePath, node]);
  if (error) return <ErrorCard message={error} raw={node.source ?? node.src} />;
  return <div className="agent-md-card"><h3>{node.title ?? "Diagram"}</h3>{svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <p>Rendering diagram...</p>}</div>;
}

function MapView({ node, dataSources }: { node: MapNode; dataSources: Record<string, DataSource> }) {
  const source = dataSources[node.data];
  const height = node.height ?? 360;
  if (!source) return <ErrorCard message={`No data available for ${node.data}`} raw={`[Map: ${node.title ?? node.data}]`} />;
  if (source.object && isGeoJson(source.object)) return <GeoJsonMap title={node.title} geojson={source.object} height={height} />;
  const rows = source.rows ?? [];
  if (!node.lat || !node.lon || rows.length === 0) return <ErrorCard message="Map requires row data plus lat/lon fields." raw={node.title ?? node.data} />;
  const points = rows.map((row) => ({ row, lat: Number(row[node.lat!]), lon: Number(row[node.lon!]) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (points.length === 0) return <ErrorCard message="Map has no valid numeric coordinates." raw={node.title ?? node.data} />;
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const bounds = padBounds({ minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) });
  return <div className="agent-md-card"><h3>{node.title ?? "Map"}</h3><svg viewBox="0 0 1000 520" width="100%" height={height} role="img" aria-label={node.title ?? "Map"}><rect x="0" y="0" width="1000" height="520" rx="18" fill="#f8fafc" stroke="#dbeafe" /><Grid />{points.map((point, index) => { const { x, y } = project(point.lat, point.lon, bounds); const label = node.label ? String(point.row[node.label] ?? "") : ""; const value = node.value ? Number(point.row[node.value]) : 0; const radius = value > 0 ? Math.max(7, Math.min(24, Math.sqrt(value) / 45)) : 10; return <g key={index}><circle cx={x} cy={y} r={radius} fill="#2563eb" opacity="0.82" stroke="#1e3a8a" strokeWidth="2" /><text x={x + radius + 6} y={y + 4} fontSize="24" fill="#0f172a">{label}</text></g>; })}</svg></div>;
}

function GeoJsonMap({ title, geojson, height }: { title?: string; geojson: GeoJson; height: number }) {
  const coordinates = collectGeoCoordinates(geojson);
  if (coordinates.length === 0) return <ErrorCard message="GeoJSON has no drawable coordinates." raw={title ?? "GeoJSON map"} />;
  const bounds = padBounds({ minLat: Math.min(...coordinates.map((coord) => coord[1])), maxLat: Math.max(...coordinates.map((coord) => coord[1])), minLon: Math.min(...coordinates.map((coord) => coord[0])), maxLon: Math.max(...coordinates.map((coord) => coord[0])) });
  return <div className="agent-md-card"><h3>{title ?? "GeoJSON map"}</h3><svg viewBox="0 0 1000 520" width="100%" height={height} role="img" aria-label={title ?? "GeoJSON map"}><rect x="0" y="0" width="1000" height="520" rx="18" fill="#f8fafc" stroke="#dbeafe" /><Grid />{geojson.features.map((feature, index) => <path key={index} d={featurePath(feature, bounds)} fill="#93c5fd" opacity="0.55" stroke="#1d4ed8" strokeWidth="3" />)}</svg></div>;
}

function Grid() {
  return <g opacity="0.35">{[1, 2, 3, 4].map((item) => <line key={`v-${item}`} x1={item * 200} x2={item * 200} y1="30" y2="490" stroke="#bfdbfe" />)}{[1, 2, 3, 4].map((item) => <line key={`h-${item}`} y1={item * 100} y2={item * 100} x1="30" x2="970" stroke="#bfdbfe" />)}</g>;
}

function FormView({ node }: { node: Extract<DocumentNode, { type: "form" }> }) {
  return <form className="agent-md-card"><h3>{node.title ?? "Form"}</h3>{node.description ? <p>{node.description}</p> : null}{node.fields.map((field) => <label key={field.name}><span>{field.label ?? field.name}</span><input name={field.name} type={field.fieldType === "checkbox" ? "checkbox" : field.fieldType === "date" ? "date" : field.fieldType === "number" ? "number" : "text"} defaultValue={String(field.default ?? "")} /></label>)}</form>;
}

function fallbackFor(node: ChartNode) { return `[Chart: ${node.chartType} chart of ${node.y ?? node.value ?? "value"} by ${node.x ?? node.label ?? "label"}]`; }
function formatValue(value: unknown, format?: string) { return format === "currency" && typeof value === "number" ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value) : String(value); }
function hasHttpArtifactEndpoint() {
  return typeof window !== "undefined" && window.location.protocol.startsWith("http");
}
async function fetchArtifactText(sourcePath: string, src: string) {
  const response = await fetch(`/artifact?file=${encodeURIComponent(sourcePath)}&src=${encodeURIComponent(src)}`);
  if (!response.ok) throw new Error(`Unable to load diagram source: ${response.status}`);
  return response.text();
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
  const blockedElements = new Set(["script", "foreignobject", "iframe", "object", "embed"]);
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
  if (node.sort) next = [...next].sort((a, b) => String(a[node.sort!.by]).localeCompare(String(b[node.sort!.by])));
  return node.limit ? next.slice(0, node.limit) : next;
}
