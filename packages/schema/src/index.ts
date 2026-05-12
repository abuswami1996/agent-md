import { z } from "zod";

export type DiagnosticSeverity = "error" | "warning" | "info";

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  sourcePath: string;
  line?: number;
  column?: number;
  blockType?: string;
  suggestion?: string;
};

export type DataColumn = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "unknown";
  nullable: boolean;
  sampleValues: unknown[];
};

export type DataSource = {
  id: string;
  origin: "inline" | "file" | "derived";
  source?: string;
  format: "csv" | "tsv" | "json" | "yaml" | "geojson";
  rows?: Record<string, unknown>[];
  object?: unknown;
  columns?: DataColumn[];
  diagnostics: Diagnostic[];
};

export type MarkdownNode = { type: "markdown"; value: string; line?: number };
export type ErrorNode = { type: "error"; message: string; raw: string; line?: number };
export type ChartNode = { type: "chart"; chartType: "line" | "bar" | "area" | "scatter" | "pie"; title?: string; description?: string; data: string; x?: string; y?: string | string[]; label?: string; value?: string; series?: string; xLabel?: string; yLabel?: string; height?: number; width?: number; stacked?: boolean; legend?: boolean; tooltip?: boolean };
export type MetricNode = { type: "metric"; label: string; value?: string | number; delta?: string | number; trend?: "up" | "down" | "neutral"; description?: string; data?: string; field?: string; format?: string; aggregate?: "sum" | "avg" | "min" | "max" | "count" };
export type TableNode = { type: "table"; title?: string; data: string; columns?: string[]; sortable?: boolean; filterable?: boolean; pagination?: boolean; pageSize?: number; search?: boolean };
export type DiagramNode = { type: "diagram"; diagramType: "flowchart" | "sequence" | "tree"; title?: string; source?: string; src?: string; direction?: "TB" | "LR" | "BT" | "RL"; height?: number };
export type MapNode = { type: "map"; title?: string; data: string; lat?: string; lon?: string; label?: string; value?: string; height?: number; zoom?: number; center?: [number, number] };
export type TimelineEvent = { date: string; title: string; description?: string; group?: string };
export type TimelineNode = { type: "timeline"; data?: string; date?: string; title?: string; description?: string; group?: string; sort?: "asc" | "desc"; layout?: "vertical" | "horizontal"; events?: TimelineEvent[] };
export type TabNode = { label: string; value?: string; children: DocumentNode[] };
export type TabsNode = { type: "tabs"; default?: string; variant?: "line" | "pill" | "card"; tabs: TabNode[] };
export type CalloutNode = { type: "callout"; calloutType: "note" | "info" | "warning" | "error" | "success" | "decision" | "risk" | "tip"; title?: string; body?: string; children?: DocumentNode[] };
export type EmbedNode = { type: "embed"; src: string; title?: string; height?: number; width?: number; caption?: string; mode?: "preview" | "link" | "inline" };
export type FormField = { name: string; label?: string; fieldType: "text" | "number" | "select" | "checkbox" | "date"; default?: unknown; placeholder?: string; required?: boolean; options?: string[]; min?: number; max?: number; step?: number };
export type FormNode = { type: "form"; title?: string; description?: string; submitLabel?: string; fields: FormField[] };
export type QueryPredicate = string | number | boolean | { eq?: unknown; neq?: unknown; gt?: number; gte?: number; lt?: number; lte?: number; contains?: string; in?: unknown[] };
export type QueryNode = { type: "query"; data: string; where?: Record<string, QueryPredicate>; select?: string[]; sort?: { by: string; direction?: "asc" | "desc" }; limit?: number; view?: "table" | "json" | "cards" };
export type ComponentNode = { type: "component"; name: string; props?: Record<string, unknown> };
export type DocumentNode = MarkdownNode | ChartNode | MetricNode | TableNode | DiagramNode | MapNode | TimelineNode | TabsNode | CalloutNode | EmbedNode | FormNode | QueryNode | ComponentNode | ErrorNode;
export type AgentMarkdownDocument = { format: "agent-md"; version: string; sourcePath: string; frontmatter?: Record<string, unknown>; nodes: DocumentNode[]; dataSources: Record<string, DataSource>; diagnostics: Diagnostic[] };

export type AgentMarkdownConfig = {
  version: string;
  include: string[];
  exclude: string[];
  server: { port: number; host: string; open: boolean };
  security: { allowRawHtml: boolean; allowRemoteData: boolean; allowHtmlEmbeds: boolean; allowCustomComponents: boolean; projectRootOnly: boolean; maxEmbedSizeMb?: number };
  components: { registry: string };
  limits: { maxMarkdownSizeMb: number; maxDataSizeMb: number; maxEmbedSizeMb: number; maxChartRows: number };
};

export const defaultConfig: AgentMarkdownConfig = {
  version: "0.1",
  include: ["**/*.agent.md", "**/*.amd.md"],
  exclude: ["node_modules/**", ".git/**", "dist/**", "build/**"],
  server: { port: 3847, host: "localhost", open: true },
  security: { allowRawHtml: false, allowRemoteData: false, allowHtmlEmbeds: false, allowCustomComponents: false, projectRootOnly: true, maxEmbedSizeMb: 25 },
  components: { registry: ".agent-md/components.json" },
  limits: { maxMarkdownSizeMb: 2, maxDataSizeMb: 10, maxEmbedSizeMb: 25, maxChartRows: 10000 }
};

const positiveNumber = z.number().positive();
const stringArray = z.array(z.string());
const chartBase = z.object({ type: z.enum(["line", "bar", "area", "scatter", "pie"]), title: z.string().optional(), description: z.string().optional(), data: z.string(), x: z.string().optional(), y: z.union([z.string(), stringArray]).optional(), label: z.string().optional(), value: z.string().optional(), series: z.string().optional(), xLabel: z.string().optional(), yLabel: z.string().optional(), height: positiveNumber.optional(), width: positiveNumber.optional(), stacked: z.boolean().optional(), legend: z.boolean().optional(), tooltip: z.boolean().optional() }).strict();
const metricSchema = z.object({ label: z.string(), value: z.union([z.string(), z.number()]).optional(), delta: z.union([z.string(), z.number()]).optional(), trend: z.enum(["up", "down", "neutral"]).optional(), description: z.string().optional(), data: z.string().optional(), field: z.string().optional(), format: z.string().optional(), aggregate: z.enum(["sum", "avg", "min", "max", "count"]).optional() }).strict();
const tableSchema = z.object({ title: z.string().optional(), data: z.string(), columns: stringArray.optional(), sortable: z.boolean().optional(), filterable: z.boolean().optional(), pagination: z.boolean().optional(), pageSize: positiveNumber.optional(), search: z.boolean().optional() }).strict();
const diagramSchema = z.object({ type: z.enum(["flowchart", "sequence", "tree"]), title: z.string().optional(), source: z.string().optional(), src: z.string().optional(), direction: z.enum(["TB", "LR", "BT", "RL"]).optional(), height: positiveNumber.optional() }).strict();
const mapSchema = z.object({ title: z.string().optional(), data: z.string(), lat: z.string().optional(), lon: z.string().optional(), label: z.string().optional(), value: z.string().optional(), height: positiveNumber.optional(), zoom: z.number().optional(), center: z.tuple([z.number(), z.number()]).optional() }).strict();
const timelineSchema = z.object({ data: z.string().optional(), date: z.string().optional(), title: z.string().optional(), description: z.string().optional(), group: z.string().optional(), sort: z.enum(["asc", "desc"]).optional(), layout: z.enum(["vertical", "horizontal"]).optional(), events: z.array(z.object({ date: z.string(), title: z.string(), description: z.string().optional(), group: z.string().optional() })).optional() }).strict();
const tabsSchema = z.object({ default: z.string().optional(), variant: z.enum(["line", "pill", "card"]).optional() }).strict();
const calloutSchema = z.object({ type: z.enum(["note", "info", "warning", "error", "success", "decision", "risk", "tip"]).optional(), title: z.string().optional(), body: z.string().optional() }).strict();
const embedSchema = z.object({ src: z.string(), title: z.string().optional(), height: positiveNumber.optional(), width: positiveNumber.optional(), caption: z.string().optional(), mode: z.enum(["preview", "link", "inline"]).optional() }).strict();
const formFieldSchema = z.object({ name: z.string(), label: z.string().optional(), type: z.enum(["text", "number", "select", "checkbox", "date"]), default: z.unknown().optional(), placeholder: z.string().optional(), required: z.boolean().optional(), options: stringArray.optional(), min: z.number().optional(), max: z.number().optional(), step: z.number().optional() }).strict();
const formSchema = z.object({ title: z.string().optional(), description: z.string().optional(), submitLabel: z.string().optional(), fields: z.array(formFieldSchema) }).strict();
const queryPredicateSchema = z.union([z.string(), z.number(), z.boolean(), z.object({ eq: z.unknown().optional(), neq: z.unknown().optional(), gt: z.number().optional(), gte: z.number().optional(), lt: z.number().optional(), lte: z.number().optional(), contains: z.string().optional(), in: z.array(z.unknown()).optional() }).strict()]);
const querySchema = z.object({ data: z.string(), where: z.record(z.string(), queryPredicateSchema).optional(), select: stringArray.optional(), sort: z.object({ by: z.string(), direction: z.enum(["asc", "desc"]).optional() }).strict().optional(), limit: positiveNumber.optional(), view: z.enum(["table", "json", "cards"]).optional() }).strict();
const componentSchema = z.object({ name: z.string(), props: z.record(z.string(), z.unknown()).optional() }).strict();

const schemas = { chart: chartBase, metric: metricSchema, table: tableSchema, diagram: diagramSchema, map: mapSchema, timeline: timelineSchema, tabs: tabsSchema, callout: calloutSchema, embed: embedSchema, form: formSchema, query: querySchema, component: componentSchema } as const;
export type PrimitiveName = keyof typeof schemas;
export const primitiveNames = Object.keys(schemas) as PrimitiveName[];

function issueToDiagnostic(issue: z.ZodIssue, sourcePath: string, blockType: string, line?: number): Diagnostic {
  const unknown = issue.code === "unrecognized_keys";
  const keys = unknown && "keys" in issue ? issue.keys.join(", ") : issue.path.join(".");
  return { severity: unknown ? "warning" : "error", code: unknown ? "unknown_field" : "invalid_field", message: unknown ? `Unknown field "${keys}" on ::${blockType}.` : `${issue.path.join(".") || blockType}: ${issue.message}`, sourcePath, line, blockType };
}

export function createDiagnostic(input: Omit<Diagnostic, "sourcePath"> & { sourcePath?: string }, sourcePath = ""): Diagnostic {
  return { sourcePath, ...input };
}

export function validatePrimitive(name: string, attrs: Record<string, unknown>, sourcePath: string, line?: number): { attrs?: Record<string, unknown>; diagnostics: Diagnostic[] } {
  if (!primitiveNames.includes(name as PrimitiveName)) {
    return { diagnostics: [{ severity: "error", code: "unknown_primitive", message: `Unknown directive ::${name}.`, sourcePath, line, blockType: name }] };
  }
  const result = schemas[name as PrimitiveName].safeParse(attrs);
  if (result.success) return { attrs: result.data as Record<string, unknown>, diagnostics: [] };
  return { attrs, diagnostics: result.error.issues.map((issue) => issueToDiagnostic(issue, sourcePath, name, line)) };
}

export function normalizePrimitive(name: string, attrs: Record<string, unknown>, children: DocumentNode[], raw: string, sourcePath: string, line?: number): { node: DocumentNode; diagnostics: Diagnostic[] } {
  const validation = validatePrimitive(name, attrs, sourcePath, line);
  const hasError = validation.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  if (hasError || !validation.attrs) return { node: { type: "error", message: `Invalid ::${name} directive`, raw, line }, diagnostics: validation.diagnostics };
  const data = validation.attrs;
  switch (name) {
    case "chart": return { node: { ...data, type: "chart", chartType: data.type } as ChartNode, diagnostics: validation.diagnostics };
    case "metric": return { node: { ...data, type: "metric" } as MetricNode, diagnostics: validation.diagnostics };
    case "table": return { node: { ...data, type: "table" } as TableNode, diagnostics: validation.diagnostics };
    case "diagram": return { node: { ...data, type: "diagram", diagramType: data.type } as DiagramNode, diagnostics: validation.diagnostics };
    case "map": return { node: { ...data, type: "map" } as MapNode, diagnostics: validation.diagnostics };
    case "timeline": return { node: { ...data, type: "timeline" } as TimelineNode, diagnostics: validation.diagnostics };
    case "tabs": {
      const tabs = children.filter((child): child is ComponentNode & { props?: { label?: string; value?: string; children?: DocumentNode[] } } => child.type === "component" && child.name === "__tab");
      const tabNodes = tabs.map((tab) => ({ label: String(tab.props?.label ?? ""), value: tab.props?.value ? String(tab.props.value) : undefined, children: Array.isArray(tab.props?.children) ? tab.props.children : [] }));
      const diagnostics = [...validation.diagnostics];
      if (tabNodes.length === 0) diagnostics.push({ severity: "error", code: "tabs_empty", message: "::tabs requires at least one child ::tab.", sourcePath, line, blockType: "tabs" });
      const labels = new Set<string>();
      for (const tab of tabNodes) {
        if (!tab.label) diagnostics.push({ severity: "error", code: "tab_label_required", message: "Each ::tab requires a label.", sourcePath, line, blockType: "tabs" });
        if (labels.has(tab.label)) diagnostics.push({ severity: "error", code: "tab_label_duplicate", message: `Duplicate tab label "${tab.label}".`, sourcePath, line, blockType: "tabs" });
        labels.add(tab.label);
      }
      if (typeof data.default === "string" && !labels.has(data.default)) diagnostics.push({ severity: "error", code: "tab_default_missing", message: `Default tab "${data.default}" does not exist.`, sourcePath, line, blockType: "tabs" });
      return { node: { type: "tabs", default: data.default as string | undefined, variant: data.variant as TabsNode["variant"], tabs: tabNodes }, diagnostics };
    }
    case "callout": return { node: { type: "callout", calloutType: (data.type ?? "note") as CalloutNode["calloutType"], title: data.title as string | undefined, body: data.body as string | undefined, children }, diagnostics: validation.diagnostics };
    case "embed": return { node: { ...data, type: "embed" } as EmbedNode, diagnostics: validation.diagnostics };
    case "form": return { node: { type: "form", title: data.title as string | undefined, description: data.description as string | undefined, submitLabel: data.submitLabel as string | undefined, fields: (data.fields as Array<Record<string, unknown>>).map((field) => ({ ...field, fieldType: field.type })) as FormField[] }, diagnostics: validation.diagnostics };
    case "query": return { node: { ...data, type: "query" } as QueryNode, diagnostics: validation.diagnostics };
    case "component": return { node: { ...data, type: "component" } as ComponentNode, diagnostics: validation.diagnostics };
    default: return { node: { type: "error", message: `Unsupported directive ::${name}`, raw, line }, diagnostics: validation.diagnostics };
  }
}

export function collectNodeDataRefs(node: DocumentNode): string[] {
  switch (node.type) {
    case "chart": return [node.data];
    case "metric": return node.data ? [node.data] : [];
    case "table": return [node.data];
    case "map": return [node.data];
    case "timeline": return node.data ? [node.data] : [];
    case "query": return [node.data];
    case "tabs": return node.tabs.flatMap((tab) => tab.children.flatMap(collectNodeDataRefs));
    case "callout": return node.children?.flatMap(collectNodeDataRefs) ?? [];
    default: return [];
  }
}

export function getReferencedColumns(node: DocumentNode): Record<string, string[]> {
  if (node.type === "chart") return { [node.data]: [node.x, ...(Array.isArray(node.y) ? node.y : [node.y]), node.label, node.value, node.series].filter(Boolean) as string[] };
  if (node.type === "metric" && node.data) return { [node.data]: [node.field].filter(Boolean) as string[] };
  if (node.type === "table") return { [node.data]: node.columns ?? [] };
  if (node.type === "map") return { [node.data]: [node.lat, node.lon, node.label, node.value].filter(Boolean) as string[] };
  if (node.type === "timeline" && node.data) return { [node.data]: [node.date, node.title, node.description, node.group].filter(Boolean) as string[] };
  if (node.type === "query") return { [node.data]: [...(node.select ?? []), ...Object.keys(node.where ?? {}), node.sort?.by].filter(Boolean) as string[] };
  return {};
}
