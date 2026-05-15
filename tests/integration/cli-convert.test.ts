import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/src/index.ts");
const fixture = path.join(root, "packages/examples/fixtures/valid-dashboard.agent.md");
const tsx = path.join(root, "node_modules/.bin/tsx");

describe("agent-md convert", () => {
  it("converts a .agent.md file to static HTML with the requested file_name flag", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-convert-"));
    try {
      await fs.copyFile(fixture, path.join(temp, "dashboard.agent.md"));

      const result = await execFileAsync(tsx, [cli, "convert", "--file_name", "dashboard.agent.md", "--html"], { cwd: temp });
      const html = await fs.readFile(path.join(temp, "dashboard.html"), "utf8");

      expect(result.stdout).toContain("Wrote dashboard.html");
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("__AGENT_MD_STATIC__");
      expect(html).toContain("Q4 Revenue Dashboard");
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("supports the file-name alias and explicit output path", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-convert-"));
    try {
      await fs.copyFile(fixture, path.join(temp, "dashboard.agent.md"));

      const result = await execFileAsync(tsx, [cli, "convert", "--file-name", "dashboard.agent.md", "--html", "--output", "dist/report.html"], { cwd: temp });
      const html = await fs.readFile(path.join(temp, "dist/report.html"), "utf8");

      expect(result.stdout).toContain("Wrote dist/report.html");
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("Total revenue");
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("includes diagnostics in static HTML for invalid reports", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-convert-"));
    try {
      await fs.writeFile(path.join(temp, "broken.agent.md"), `::chart\ntype: line\ndata: revenue\nx: month\ny: missing_amount\n:::\n\n\`\`\`data revenue\nmonth,amount\nJan,10\n\`\`\`\n`);

      await execConvertWithDiagnostics([cli, "convert", "--file_name", "broken.agent.md", "--html"], temp);
      const html = await fs.readFile(path.join(temp, "broken.html"), "utf8");

      expect(html).toContain("__AGENT_MD_STATIC__");
      expect(html).toContain("column_not_found");
      expect(html).toContain("missing_amount");
      expect(html).toContain("Use one of the available columns");
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("bundles local embed and diagram artifacts into converted HTML", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-convert-"));
    try {
      await fs.mkdir(path.join(temp, "artifacts"), { recursive: true });
      await fs.mkdir(path.join(temp, "diagrams"), { recursive: true });
      await fs.writeFile(path.join(temp, "artifacts", "summary.md"), "# Embedded Summary\n\nLocal artifact body.\n");
      await fs.writeFile(path.join(temp, "artifacts", "stats.json"), "{\"status\":\"ok\"}\n");
      await fs.writeFile(path.join(temp, "diagrams", "flow.mmd"), "flowchart LR\n  A[Start] --> B[Done]\n");
      await fs.writeFile(path.join(temp, "artifact.agent.md"), `---
format: agent-md
version: 0.1
title: Artifact Report
---

::embed
title: Summary
src: artifacts/summary.md
mode: preview
:::

::embed
title: Stats
src: artifacts/stats.json
mode: preview
:::

::diagram
type: flowchart
title: External flow
src: diagrams/flow.mmd
:::
`);

      const result = await execFileAsync(tsx, [cli, "convert", "--file_name", "artifact.agent.md", "--html"], { cwd: temp });
      const html = await fs.readFile(path.join(temp, "artifact.html"), "utf8");

      expect(result.stdout).toContain("Wrote artifact.html");
      expect(html).toContain("\"artifacts\"");
      expect(html).toContain("artifacts/summary.md");
      expect(html).toContain("Embedded Summary");
      expect(html).toContain("artifacts/stats.json");
      expect(html).toContain("\\\"status\\\":\\\"ok\\\"");
      expect(html).toContain("diagrams/flow.mmd");
      expect(html).toContain("A[Start]");
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});

async function execConvertWithDiagnostics(args: string[], cwd: string) {
  try {
    return await execFileAsync(tsx, args, { cwd });
  } catch (error) {
    return error as { stdout: string; stderr: string };
  }
}
