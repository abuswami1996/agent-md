import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import Papa from "papaparse";
import { collectNodeDataRefs, defaultConfig, getReferencedColumns, type AgentMarkdownConfig, type AgentMarkdownDocument, type DataColumn, type DataSource, type Diagnostic, type DocumentNode, type QueryNode } from "@agent-md/schema";

export const dataExtensions = new Set([".csv", ".tsv", ".json", ".yaml", ".yml", ".geojson"]);
export const artifactExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webm", ".mp4", ".html", ".txt", ".md", ".mmd", ".mermaid", ".csv", ".json"]);

export function isRemoteRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

export function resolveSafePath(projectRoot: string, sourcePath: string, ref: string): string {
  if (isRemoteRef(ref)) throw new Error("Remote references are disabled in the MVP");
  if (ref.startsWith("~")) throw new Error("Home-directory references are not allowed");
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(path.dirname(sourcePath), ref);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Path escapes project root");
  return absolute;
}

export async function resolveSafeRealPath(projectRoot: string, sourcePath: string, ref: string): Promise<string> {
  const absolute = resolveSafePath(projectRoot, sourcePath, ref);
  const [realRoot, realAbsolute] = await Promise.all([fs.realpath(projectRoot), fs.realpath(absolute)]);
  const relative = path.relative(realRoot, realAbsolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Path escapes project root");
  return realAbsolute;
}

export async function loadConfig(projectRoot: string, configPath = "agent-md.config.json"): Promise<AgentMarkdownConfig> {
  const absolute = path.resolve(projectRoot, configPath);
  try {
    const raw = await fs.readFile(absolute, "utf8");
    const parsed = JSON.parse(raw) as Partial<AgentMarkdownConfig>;
    return {
      ...defaultConfig,
      ...parsed,
      server: { ...defaultConfig.server, ...parsed.server },
      security: { ...defaultConfig.security, ...parsed.security },
      components: { ...defaultConfig.components, ...parsed.components },
      limits: { ...defaultConfig.limits, ...parsed.limits }
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultConfig;
    throw error;
  }
}

export async function loadDataFile(projectRoot: string, sourcePath: string, ref: string, limits = defaultConfig.limits): Promise<DataSource> {
  const absolute = await resolveSafeRealPath(projectRoot, sourcePath, ref);
  const ext = path.extname(absolute).toLowerCase();
  if (!dataExtensions.has(ext)) throw new Error(`Unsupported data file extension: ${ext}`);
  const stat = await fs.stat(absolute);
  if (stat.size > limits.maxDataSizeMb * 1024 * 1024) throw new Error(`Data file exceeds ${limits.maxDataSizeMb} MB limit`);
  const raw = await fs.readFile(absolute, "utf8");
  const format = ext === ".yml" ? "yaml" : ext.slice(1) as DataSource["format"];
  let rows: Record<string, unknown>[] | undefined;
  let object: unknown;
  if (format === "csv" || format === "tsv") {
    const parsed = Papa.parse<Record<string, unknown>>(raw, { header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: format === "tsv" ? "\t" : undefined });
    rows = parsed.data;
    object = parsed.data;
  } else if (format === "json" || format === "geojson") {
    object = JSON.parse(raw);
    rows = Array.isArray(object) && object.every(isRecord) ? object : undefined;
  } else {
    object = YAML.parse(raw);
    rows = Array.isArray(object) && object.every(isRecord) ? object : undefined;
  }
  return { id: ref, origin: "file", source: absolute, format, rows, object, columns: rows ? inferColumns(rows) : undefined, diagnostics: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function inferColumns(rows: Record<string, unknown>[]): DataColumn[] {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return names.map((name) => {
    const values = rows.map((row) => row[name]);
    const nonNull = values.filter((value) => value !== null && value !== undefined && value !== "");
    return { name, type: inferType(nonNull), nullable: nonNull.length !== values.length, sampleValues: nonNull.slice(0, 5) };
  });
}

function inferType(values: unknown[]): DataColumn["type"] {
  if (values.length === 0) return "unknown";
  if (values.every((value) => typeof value === "number")) return "number";
  if (values.every((value) => typeof value === "boolean")) return "boolean";
  if (values.every((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)))) return "date";
  if (values.every((value) => typeof value === "string")) return "string";
  return "unknown";
}

export async function resolveDocumentData(document: AgentMarkdownDocument, projectRoot: string, config: AgentMarkdownConfig = defaultConfig): Promise<AgentMarkdownDocument> {
  const diagnostics: Diagnostic[] = [...document.diagnostics];
  const dataSources = { ...document.dataSources };
  for (const source of Object.values(dataSources)) if (source.rows && !source.columns) source.columns = inferColumns(source.rows);
  const refs = [...new Set(document.nodes.flatMap(collectNodeDataRefs))];
  for (const ref of refs) {
    if (dataSources[ref]) continue;
    if (isRemoteRef(ref)) {
      diagnostics.push({ severity: "error", code: "remote_data_blocked", message: `Remote data reference is blocked: ${ref}`, sourcePath: document.sourcePath });
      continue;
    }
    if (dataExtensions.has(path.extname(ref).toLowerCase())) {
      try {
        const loaded = await loadDataFile(projectRoot, document.sourcePath, ref, config.limits);
        dataSources[ref] = loaded;
      } catch (error) {
        diagnostics.push({ severity: "error", code: "data_file_error", message: error instanceof Error ? error.message : `Unable to load data source ${ref}`, sourcePath: document.sourcePath });
      }
    }
  }
  diagnostics.push(...validateReferences(document.nodes, dataSources, document.sourcePath, config));
  diagnostics.push(...await validateLocalArtifacts(document.nodes, projectRoot, document.sourcePath, config));
  return { ...document, dataSources, diagnostics };
}

export function validateReferences(nodes: DocumentNode[], dataSources: Record<string, DataSource>, sourcePath: string, config: AgentMarkdownConfig = defaultConfig): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const visit = (node: DocumentNode) => {
    const refs = collectNodeDataRefs(node);
    for (const ref of refs) if (!dataSources[ref] && !dataExtensions.has(path.extname(ref).toLowerCase())) diagnostics.push({ severity: "error", code: "data_not_found", message: `Data source "${ref}" was not found.`, sourcePath, blockType: node.type });
    const columnsByData = getReferencedColumns(node);
    for (const [data, columns] of Object.entries(columnsByData)) {
      const source = dataSources[data];
      if (!source?.columns || columns.length === 0) continue;
      const known = new Set(source.columns.map((column) => column.name));
      for (const column of columns) if (!known.has(column)) diagnostics.push({ severity: "error", code: "column_not_found", message: `Column "${column}" was not found in data source "${data}".`, sourcePath, blockType: node.type });
    }
    if (node.type === "chart") {
      const rows = dataSources[node.data]?.rows?.length ?? 0;
      if (rows > config.limits.maxChartRows) diagnostics.push({ severity: "warning", code: "chart_row_limit", message: `Chart uses ${rows} rows, above the ${config.limits.maxChartRows} row target.`, sourcePath, blockType: "chart" });
    }
    if (node.type === "table") {
      const rows = dataSources[node.data]?.rows?.length ?? 0;
      if (rows > 500 && node.pagination !== false) diagnostics.push({ severity: "info", code: "table_paginated", message: "Tables over 500 rows are paginated by default.", sourcePath, blockType: "table" });
    }
    if (node.type === "component" && !config.security.allowCustomComponents) diagnostics.push({ severity: "warning", code: "custom_component_disabled", message: `Registered component "${node.name}" will render as a placeholder because custom components are disabled.`, sourcePath, blockType: "component" });
    diagnostics.push(...validatePrimitiveSemantics(node, dataSources, sourcePath));
    if (node.type === "tabs") node.tabs.forEach((tab) => tab.children.forEach(visit));
    if (node.type === "callout") node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return diagnostics;
}

async function validateLocalArtifacts(nodes: DocumentNode[], projectRoot: string, sourcePath: string, config: AgentMarkdownConfig): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const visit = async (node: DocumentNode): Promise<void> => {
    if (node.type === "embed") await validateArtifactRef(node.src, "embed", projectRoot, sourcePath, config, diagnostics);
    if (node.type === "diagram" && node.src) await validateArtifactRef(node.src, "diagram", projectRoot, sourcePath, config, diagnostics);
    if (node.type === "tabs") for (const tab of node.tabs) for (const child of tab.children) await visit(child);
    if (node.type === "callout") for (const child of node.children ?? []) await visit(child);
  };
  for (const node of nodes) await visit(node);
  return diagnostics;
}

async function validateArtifactRef(ref: string, blockType: string, projectRoot: string, sourcePath: string, config: AgentMarkdownConfig, diagnostics: Diagnostic[]) {
  if (isRemoteRef(ref)) {
    diagnostics.push({ severity: "error", code: "remote_artifact_blocked", message: `Remote artifact reference is blocked: ${ref}`, sourcePath, blockType });
    return;
  }
  try {
    const absolute = await resolveSafeRealPath(projectRoot, sourcePath, ref);
    const ext = path.extname(absolute).toLowerCase();
    if (!artifactExtensions.has(ext) && blockType === "embed") diagnostics.push({ severity: "error", code: "unsupported_artifact", message: `Unsupported artifact extension: ${ext}`, sourcePath, blockType });
    if (ext === ".html" && !config.security.allowHtmlEmbeds) diagnostics.push({ severity: "error", code: "html_embed_blocked", message: "HTML embeds are blocked by default.", sourcePath, blockType });
    const stat = await fs.stat(absolute);
    if (stat.size > config.limits.maxEmbedSizeMb * 1024 * 1024) diagnostics.push({ severity: "error", code: "embed_size_limit", message: `Artifact exceeds ${config.limits.maxEmbedSizeMb} MB limit.`, sourcePath, blockType });
  } catch (error) {
    diagnostics.push({ severity: "error", code: "artifact_file_error", message: error instanceof Error ? error.message : `Unable to access artifact ${ref}`, sourcePath, blockType });
  }
}

function validatePrimitiveSemantics(node: DocumentNode, dataSources: Record<string, DataSource>, sourcePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (node.type === "chart") {
    const source = dataSources[node.data];
    const numericColumns = Array.isArray(node.y) ? node.y : node.y ? [node.y] : [];
    if (node.chartType === "pie" && node.value) numericColumns.push(node.value);
    for (const column of numericColumns) {
      if (columnType(source, column) && columnType(source, column) !== "number") diagnostics.push({ severity: "error", code: "column_not_numeric", message: `Column "${column}" must be numeric for ::chart.`, sourcePath, blockType: "chart" });
    }
  }
  if (node.type === "metric" && node.data && node.field && node.aggregate && node.aggregate !== "count") {
    if (columnType(dataSources[node.data], node.field) && columnType(dataSources[node.data], node.field) !== "number") diagnostics.push({ severity: "error", code: "column_not_numeric", message: `Column "${node.field}" must be numeric for metric aggregation.`, sourcePath, blockType: "metric" });
  }
  if (node.type === "map") {
    const rows = dataSources[node.data]?.rows ?? [];
    if (node.lat && columnType(dataSources[node.data], node.lat) !== "number") diagnostics.push({ severity: "error", code: "lat_not_numeric", message: `Latitude column "${node.lat}" must be numeric.`, sourcePath, blockType: "map" });
    if (node.lon && columnType(dataSources[node.data], node.lon) !== "number") diagnostics.push({ severity: "error", code: "lon_not_numeric", message: `Longitude column "${node.lon}" must be numeric.`, sourcePath, blockType: "map" });
    for (const row of rows) {
      const lat = node.lat ? Number(row[node.lat]) : undefined;
      const lon = node.lon ? Number(row[node.lon]) : undefined;
      if (lat != null && Number.isFinite(lat) && (lat < -90 || lat > 90)) diagnostics.push({ severity: "error", code: "lat_out_of_range", message: "Latitude values must be between -90 and 90.", sourcePath, blockType: "map" });
      if (lon != null && Number.isFinite(lon) && (lon < -180 || lon > 180)) diagnostics.push({ severity: "error", code: "lon_out_of_range", message: "Longitude values must be between -180 and 180.", sourcePath, blockType: "map" });
    }
  }
  if (node.type === "timeline") {
    for (const event of node.events ?? []) if (Number.isNaN(Date.parse(event.date))) diagnostics.push({ severity: "error", code: "invalid_date", message: `Timeline event date "${event.date}" is invalid.`, sourcePath, blockType: "timeline" });
  }
  if (node.type === "form") {
    const names = new Set<string>();
    for (const field of node.fields) {
      if (names.has(field.name)) diagnostics.push({ severity: "error", code: "duplicate_field", message: `Duplicate form field "${field.name}".`, sourcePath, blockType: "form" });
      names.add(field.name);
      if (field.fieldType === "select" && (!field.options || field.options.length === 0)) diagnostics.push({ severity: "error", code: "select_options_required", message: `Select field "${field.name}" requires options.`, sourcePath, blockType: "form" });
      if (field.fieldType === "number" && field.default != null && typeof field.default !== "number") diagnostics.push({ severity: "error", code: "default_type_mismatch", message: `Default for "${field.name}" must be a number.`, sourcePath, blockType: "form" });
    }
  }
  return diagnostics;
}

function columnType(source: DataSource | undefined, column: string) {
  return source?.columns?.find((item) => item.name === column)?.type;
}

export function runQuery(source: DataSource, query: QueryNode): DataSource {
  const rows = [...(source.rows ?? [])].filter((row) => matchesWhere(row, query.where));
  const selected = query.select?.length ? rows.map((row) => Object.fromEntries(query.select!.map((key) => [key, row[key]]))) : rows;
  const sorted = query.sort ? selected.sort((a, b) => compareValues(a[query.sort!.by], b[query.sort!.by], query.sort!.direction ?? "asc")) : selected;
  const limited = query.limit ? sorted.slice(0, query.limit) : sorted;
  return { id: `${source.id}::query`, origin: "derived", format: source.format, rows: limited, columns: inferColumns(limited), diagnostics: [], object: limited };
}

function matchesWhere(row: Record<string, unknown>, where?: QueryNode["where"]): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, predicate]) => {
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
  });
}

function compareValues(a: unknown, b: unknown, direction: "asc" | "desc") {
  const result = a === b ? 0 : a == null ? -1 : b == null ? 1 : a > b ? 1 : -1;
  return direction === "asc" ? result : -result;
}
