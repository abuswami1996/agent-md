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
    expect(document.diagnostics.some((diagnostic) => diagnostic.code === "unknown_field" && diagnostic.severity === "warning")).toBe(true);
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
    expect(resolved.diagnostics.map((diagnostic) => diagnostic.code)).toContain("remote_data_blocked");
    expect(resolved.diagnostics.map((diagnostic) => diagnostic.code)).toContain("html_embed_blocked");
  });
});
