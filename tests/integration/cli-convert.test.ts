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
});
