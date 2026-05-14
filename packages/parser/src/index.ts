import { normalizePrimitive, type AgentMarkdownDocument, type DataColumn, type DataSource, type Diagnostic, type DocumentNode } from "@agent-md/schema";
import YAML from "yaml";

export type ParseOptions = { source: string; sourcePath: string };

type Block = { name: string; marker: string; startLine: number; raw: string[]; content: string[] };

export function parseAgentMarkdown({ source, sourcePath }: ParseOptions): AgentMarkdownDocument {
  const diagnostics: Diagnostic[] = [];
  const { frontmatter, body } = extractFrontmatter(source, sourcePath, diagnostics);
  if (/<script[\s>]/i.test(body)) diagnostics.push({ severity: "error", code: "script_blocked", message: "Scripts must never execute from Markdown content.", sourcePath, suggestion: "Remove the script tag and use Agent Markdown primitives for interactive content." });
  const { body: withoutData, dataSources } = extractDataBlocks(body, sourcePath, diagnostics);
  const nodes = parseDocumentBlocks(withoutData.split(/\r?\n/), sourcePath, diagnostics, 0, 1);
  return { format: "agent-md", version: String(frontmatter?.version ?? "0.1"), sourcePath, frontmatter, nodes, dataSources, diagnostics };
}

function extractFrontmatter(source: string, sourcePath: string, diagnostics: Diagnostic[]) {
  if (!source.startsWith("---\n")) return { frontmatter: undefined, body: source };
  const end = source.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: undefined, body: source };
  const raw = source.slice(4, end);
  try {
    const parsed = YAML.parse(raw) ?? {};
    return { frontmatter: typeof parsed === "object" ? parsed as Record<string, unknown> : {}, body: source.slice(end + 5).replace(/^\r?\n/, "") };
  } catch (error) {
    diagnostics.push({ severity: "error", code: "frontmatter_parse_error", message: error instanceof Error ? error.message : "Invalid frontmatter", sourcePath, line: 1, suggestion: "Fix the YAML frontmatter or remove the frontmatter block.", example: "---\nformat: agent-md\nversion: 0.1\n---" });
    return { frontmatter: undefined, body: source.slice(end + 5).replace(/^\r?\n/, "") };
  }
}

function extractDataBlocks(source: string, sourcePath: string, diagnostics: Diagnostic[]) {
  const dataSources: Record<string, DataSource> = {};
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(/^```(?:(data)\s+([A-Za-z0-9_-]+)|(?:(json|yaml|yml|csv|tsv)\s+data=([A-Za-z0-9_-]+)))\s*$/);
    if (!match) {
      kept.push(line);
      continue;
    }
    const format = match[3] === "yml" ? "yaml" : (match[3] || "csv");
    const id = match[2] || match[4];
    const startLine = index + 1;
    const content: string[] = [];
    index++;
    while (index < lines.length && !lines[index].startsWith("```")) content.push(lines[index++]);
    try {
      dataSources[id] = parseInlineData(id, format as DataSource["format"], content.join("\n"));
    } catch (error) {
      diagnostics.push({ severity: "error", code: "data_parse_error", message: error instanceof Error ? error.message : `Unable to parse data source ${id}`, sourcePath, line: startLine, blockType: "data", field: id, suggestion: `Fix the inline ${format} data block for "${id}" or replace it with a local data file reference.`, example: "```data revenue\nmonth,amount\nJan,10\n```" });
    }
  }
  return { body: kept.join("\n"), dataSources };
}

function parseInlineData(id: string, format: DataSource["format"], raw: string): DataSource {
  if (format === "json") {
    const object = JSON.parse(raw);
    return { id, origin: "inline", format, rows: Array.isArray(object) && object.every((row) => row && typeof row === "object" && !Array.isArray(row)) ? object as Record<string, unknown>[] : undefined, object, diagnostics: [] };
  }
  if (format === "yaml") {
    const object = YAML.parse(raw);
    return { id, origin: "inline", format, rows: Array.isArray(object) && object.every((row) => row && typeof row === "object" && !Array.isArray(row)) ? object as Record<string, unknown>[] : undefined, object, diagnostics: [] };
  }
  const delimiter = format === "tsv" ? "\t" : ",";
  const [headerLine, ...rowLines] = raw.trim().split(/\r?\n/).filter(Boolean);
  const headers = headerLine.split(delimiter).map((value) => value.trim());
  const rows = rowLines.map((row) => Object.fromEntries(row.split(delimiter).map((value, index) => [headers[index], coerceScalar(value.trim())])));
  return { id, origin: "inline", format, rows, columns: inferInlineColumns(rows), diagnostics: [] };
}

function inferInlineColumns(rows: Record<string, unknown>[]): DataColumn[] {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return names.map((name) => {
    const values = rows.map((row) => row[name]);
    const nonNull = values.filter((value) => value !== null && value !== undefined && value !== "");
    return { name, type: inferInlineType(nonNull), nullable: nonNull.length !== values.length, sampleValues: nonNull.slice(0, 5) };
  });
}

function inferInlineType(values: unknown[]): DataColumn["type"] {
  if (values.length === 0) return "unknown";
  if (values.every((value) => typeof value === "number")) return "number";
  if (values.every((value) => typeof value === "boolean")) return "boolean";
  if (values.every((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)))) return "date";
  if (values.every((value) => typeof value === "string")) return "string";
  return "unknown";
}

function coerceScalar(value: string): unknown {
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric : value;
}

function parseDocumentBlocks(lines: string[], sourcePath: string, diagnostics: Diagnostic[], depth: number, baseLine: number): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  let markdown: string[] = [];
  let markdownStart = baseLine;
  const flushMarkdown = (nextLine: number) => {
    const value = markdown.join("\n").trim();
    if (value) nodes.push({ type: "markdown", value, line: markdownStart });
    markdown = [];
    markdownStart = nextLine;
  };

  for (let index = 0; index < lines.length; index++) {
    const start = lines[index].match(/^(::{1,})([A-Za-z][A-Za-z0-9_-]*)\s*$/);
    if (!start) {
      if (markdown.length === 0) markdownStart = baseLine + index;
      markdown.push(lines[index]);
      continue;
    }
    flushMarkdown(baseLine + index);
    const marker = start[1];
    const name = start[2];
    const block: Block = { name, marker, startLine: baseLine + index, raw: [lines[index]], content: [] };
    index++;
    let nested = 0;
    for (; index < lines.length; index++) {
      const current = lines[index];
      if (current.match(/^(::{1,})[A-Za-z][A-Za-z0-9_-]*\s*$/)) nested++;
      if (isClosingFence(current, marker) && nested === 0) {
        block.raw.push(current);
        break;
      }
      if (current.trim().match(/^::{1,}$/) && nested > 0) nested--;
      block.raw.push(current);
      block.content.push(current);
    }
    if (depth >= 5) {
      diagnostics.push({ severity: "error", code: "max_nesting_depth", message: "Directive nesting depth exceeds 5.", sourcePath, line: block.startLine, blockType: name, suggestion: "Flatten nested directives so no block is nested more than five levels deep." });
      nodes.push({ type: "error", message: "Directive nesting depth exceeds 5.", raw: block.raw.join("\n"), line: block.startLine });
      continue;
    }
    nodes.push(parseDirective(block, sourcePath, diagnostics, depth));
  }
  flushMarkdown(baseLine + lines.length);
  return nodes;
}

function isClosingFence(line: string, marker: string) {
  const trimmed = line.trim();
  return /^::{1,}$/.test(trimmed) && trimmed.length >= marker.length;
}

function parseDirective(block: Block, sourcePath: string, diagnostics: Diagnostic[], depth: number): DocumentNode {
  if (block.name === "tab") {
    const parsed = splitPropsAndBody(block.content, sourcePath, block.startLine, diagnostics);
    const children = parseDocumentBlocks(parsed.body.split(/\r?\n/), sourcePath, diagnostics, depth + 1, block.startLine + parsed.bodyOffset);
    return { type: "component", name: "__tab", props: { ...parsed.attrs, children } };
  }
  const parsed = splitPropsAndBody(block.content, sourcePath, block.startLine, diagnostics);
  const childLines = parsed.body.trim() ? parsed.body.split(/\r?\n/) : [];
  const children = childLines.length ? parseDocumentBlocks(childLines, sourcePath, diagnostics, depth + 1, block.startLine + parsed.bodyOffset) : [];
  if (block.name === "callout" && parsed.body.trim() && parsed.attrs.body == null && children.every((node) => node.type === "markdown")) parsed.attrs.body = parsed.body.trim();
  const normalized = normalizePrimitive(block.name, parsed.attrs, children, block.raw.join("\n"), sourcePath, block.startLine);
  diagnostics.push(...normalized.diagnostics);
  return normalized.node;
}

function splitPropsAndBody(lines: string[], sourcePath: string, startLine: number, diagnostics: Diagnostic[]) {
  let splitAt = 0;
  const propLines: string[] = [];
  for (; splitAt < lines.length; splitAt++) {
    const line = lines[splitAt];
    if (line.trim() === "") { propLines.push(line); continue; }
    if (/^\s+[\w-]+:/.test(line) || /^\s*-\s+/.test(line) || /^[A-Za-z_][\w-]*\s*:/.test(line) || /^\s+/.test(line)) {
      propLines.push(line);
      continue;
    }
    break;
  }
  let attrs: Record<string, unknown> = {};
  const yamlText = propLines.join("\n").trim();
  if (yamlText) {
    try {
      const parsed = YAML.parse(yamlText);
      attrs = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch (error) {
      diagnostics.push({ severity: "error", code: "directive_yaml_error", message: error instanceof Error ? error.message : "Invalid directive YAML", sourcePath, line: startLine, suggestion: "Fix the YAML fields at the top of this directive before the body content.", example: "title: Example\ndata: revenue" });
    }
  }
  return { attrs, body: lines.slice(splitAt).join("\n"), bodyOffset: splitAt + 1 };
}
