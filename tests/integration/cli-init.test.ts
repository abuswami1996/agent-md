import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, "../..");
const cli = path.join(root, "packages/cli/src/index.ts");
const tsx = path.join(root, "node_modules/.bin/tsx");

describe("agent-md init", () => {
  it("creates VSCode extension recommendations for Cursor installs", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-init-"));
    try {
      await execFileAsync(tsx, [cli, "init", "--agent", "cursor"], { cwd: temp });
      const extensions = JSON.parse(await fs.readFile(path.join(temp, ".vscode/extensions.json"), "utf8")) as { recommendations: string[] };
      expect(extensions.recommendations).toContain("AbhinavSwaminathan.agent-md-preview");
      await fs.access(path.join(temp, ".agent-md/skill.md"));
      await fs.access(path.join(temp, "examples/example.agent.md"));
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("merges VSCode recommendations without removing existing entries", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-init-"));
    try {
      await fs.mkdir(path.join(temp, ".vscode"), { recursive: true });
      await fs.writeFile(path.join(temp, ".vscode/extensions.json"), JSON.stringify({ recommendations: ["existing.extension"] }, null, 2));
      await execFileAsync(tsx, [cli, "init", "--agent", "cursor"], { cwd: temp });
      const extensions = JSON.parse(await fs.readFile(path.join(temp, ".vscode/extensions.json"), "utf8")) as { recommendations: string[] };
      expect(extensions.recommendations).toEqual(["AbhinavSwaminathan.agent-md-preview", "existing.extension"]);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});
