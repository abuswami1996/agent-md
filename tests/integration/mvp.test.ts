import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { parseAgentMarkdown } from "@agent-md/parser";
import { resolveDocumentData, resolveSafePath, resolveSafeRealPath, runQuery } from "@agent-md/resolver";

const root = path.resolve(__dirname, "../..");
const sourcePath = path.join(root, "packages/examples/fixtures/valid-dashboard.agent.md");

describe("Agent Markdown MVP", () => {
  it("parses directives and inline data", () => {
    const source = `# Hello\n\n::metric\nlabel: Revenue\nvalue: 10\n:::\n\n\`\`\`data revenue\nmonth,amount\nJan,10\n\`\`\``;
    const document = parseAgentMarkdown({ source, sourcePath });
    expect(document.nodes.some((node) => node.type === "metric")).toBe(true);
    expect(document.dataSources.revenue.rows?.[0].amount).toBe(10);
  });

  it("validates unknown fields as warnings", () => {
    const document = parseAgentMarkdown({ source: `::chart\ntype: line\ndata: revenue\nx: month\ny: amount\nanimation: sparkle\n:::`, sourcePath });
    const diagnostic = document.diagnostics.find((item) => item.code === "unknown_field");
    expect(diagnostic).toMatchObject({ severity: "warning", field: "animation", blockType: "chart" });
    expect(diagnostic?.suggestion).toContain("Remove");
  });

  it("adds repair metadata for invalid directive fields and malformed YAML", () => {
    const invalidField = parseAgentMarkdown({ source: `::metric\nlabel: Revenue\naggregate: total\n:::`, sourcePath });
    expect(invalidField.diagnostics.find((diagnostic) => diagnostic.code === "invalid_field")).toMatchObject({ field: "aggregate", blockType: "metric", line: 1 });

    const malformedYaml = parseAgentMarkdown({ source: `::chart\ntype: [line\n:::\n`, sourcePath });
    const diagnostic = malformedYaml.diagnostics.find((item) => item.code === "directive_yaml_error");
    expect(diagnostic?.suggestion).toContain("Fix the YAML fields");
    expect(diagnostic?.example).toContain("data: revenue");
  });

  it("blocks path traversal", () => {
    expect(() => resolveSafePath(root, sourcePath, "../../../../etc/passwd")).toThrow(/escapes project root/);
  });

  it("blocks symlink escapes when resolving files for reading", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-safe-path-"));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-outside-"));
    try {
      await fs.writeFile(path.join(tempRoot, "agent-md.config.json"), "{}");
      await fs.writeFile(path.join(outside, "secret.csv"), "name,value\nsecret,1\n");
      await fs.symlink(path.join(outside, "secret.csv"), path.join(tempRoot, "linked.csv"));
      await expect(resolveSafeRealPath(tempRoot, path.join(tempRoot, "agent-md.config.json"), "linked.csv")).rejects.toThrow(/escapes project root/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("resolves local data references", async () => {
    const source = `::table\ndata: ../data/revenue.csv\ncolumns: [month, amount]\n:::`;
    const file = path.join(root, "packages/examples/fixtures/local-csv.agent.md");
    const document = parseAgentMarkdown({ source, sourcePath: file });
    const resolved = await resolveDocumentData(document, root);
    expect(resolved.dataSources["../data/revenue.csv"].rows?.length).toBeGreaterThan(0);
    expect(resolved.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toHaveLength(0);
  });

  it("validates local embed artifacts", async () => {
    const source = `::embed\ntitle: Executive summary\nsrc: ../artifacts/executive-summary.md\nmode: preview\ncaption: Local Markdown artifact\n:::`;
    const file = path.join(root, "packages/examples/fixtures/full-interactive-dashboard.agent.md");
    const document = parseAgentMarkdown({ source, sourcePath: file });
    const resolved = await resolveDocumentData(document, root);
    expect(resolved.nodes[0]).toMatchObject({ type: "embed", src: "../artifacts/executive-summary.md", mode: "preview" });
    expect(resolved.diagnostics.filter((diagnostic) => diagnostic.blockType === "embed" && diagnostic.severity === "error")).toHaveLength(0);
  });

  it("runs declarative local queries", () => {
    const source = { id: "revenue", origin: "inline" as const, format: "csv" as const, rows: [{ segment: "Enterprise", amount: 5 }, { segment: "SMB", amount: 1 }], diagnostics: [] };
    const derived = runQuery(source, { type: "query", data: "revenue", where: { segment: "Enterprise" }, select: ["amount"] });
    expect(derived.rows).toEqual([{ amount: 5 }]);
  });

  it("blocks unsafe scripts, remote data, and html embeds by default", async () => {
    const file = path.join(root, "packages/examples/fixtures/security.agent.md");
    const source = `<script>alert("x")</script>\n\n::chart\ntype: line\ndata: https://example.com/data.csv\nx: month\ny: amount\n:::\n\n::embed\nsrc: ./unsafe.html\n:::`;
    const document = parseAgentMarkdown({ source, sourcePath: file });
    const resolved = await resolveDocumentData(document, root);
    expect(resolved.diagnostics.map((diagnostic) => diagnostic.code)).toContain("script_blocked");
    const remoteData = resolved.diagnostics.find((diagnostic) => diagnostic.code === "remote_data_blocked");
    const htmlEmbed = resolved.diagnostics.find((diagnostic) => diagnostic.code === "html_embed_blocked");
    expect(remoteData).toMatchObject({ field: "data", blockType: "chart", line: 3 });
    expect(remoteData?.suggestion).toContain("local");
    expect(htmlEmbed).toMatchObject({ field: "src", blockType: "embed", line: 10 });
    expect(htmlEmbed?.message).toContain("safety");
  });

  it("reports missing columns with block context and suggested fixes", async () => {
    const source = `::chart\ntype: line\ndata: revenue\nx: month\ny: missing_amount\n:::\n\n\`\`\`data revenue\nmonth,amount\nJan,10\n\`\`\``;
    const document = parseAgentMarkdown({ source, sourcePath });
    const resolved = await resolveDocumentData(document, root);
    const diagnostic = resolved.diagnostics.find((item) => item.code === "column_not_found");

    expect(diagnostic).toMatchObject({ blockType: "chart", field: "missing_amount", line: 1 });
    expect(diagnostic?.message).toContain("missing_amount");
    expect(diagnostic?.suggestion).toContain("amount");
  });

  it("adds actionable resolver suggestions for missing data and invalid map coordinates", async () => {
    const missingData = parseAgentMarkdown({ source: `::table\ndata: sales\n:::`, sourcePath });
    const missingResolved = await resolveDocumentData(missingData, root);
    expect(missingResolved.diagnostics.find((diagnostic) => diagnostic.code === "data_not_found")).toMatchObject({ field: "data", suggestion: expect.stringContaining("inline data block") });

    const mapSource = `::map\ndata: locations\nlat: latitude\nlon: longitude\n:::\n\n\`\`\`data locations\nname,latitude,longitude\nSF,120,-200\n\`\`\``;
    const mapDocument = parseAgentMarkdown({ source: mapSource, sourcePath });
    const mapResolved = await resolveDocumentData(mapDocument, root);
    expect(mapResolved.diagnostics.find((diagnostic) => diagnostic.code === "lat_out_of_range")).toMatchObject({ field: "latitude", suggestion: expect.stringContaining("-90") });
    expect(mapResolved.diagnostics.find((diagnostic) => diagnostic.code === "lon_out_of_range")).toMatchObject({ field: "longitude", suggestion: expect.stringContaining("-180") });
  });
});
