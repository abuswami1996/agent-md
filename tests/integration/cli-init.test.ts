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
      await expectSkill(temp, ".cursor/skills/agent-markdown/SKILL.md");
      await fs.access(path.join(temp, ".cursor/skills/agent-markdown/agent-md.config.json"));
      await fs.access(path.join(temp, ".cursor/skills/agent-markdown/schema.json"));
      await fs.access(path.join(temp, ".cursor/skills/agent-markdown/components.json"));
      await fs.access(path.join(temp, ".cursor/skills/agent-markdown/examples/example.agent.md"));
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

  it.each([
    ["claude-code", ".claude/skills/agent-markdown/SKILL.md"],
    ["codex", ".agents/skills/agent-markdown/SKILL.md"],
    ["opencode", ".opencode/skills/agent-markdown/SKILL.md"],
    ["generic", ".agents/skills/agent-markdown/SKILL.md"]
  ])("installs %s skill in the documented SKILL.md location", async (agent, skillPath) => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-init-"));
    try {
      await execFileAsync(tsx, [cli, "init", "--agent", agent], { cwd: temp });
      await expectSkill(temp, skillPath);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("can install all supported project skill locations", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-init-"));
    try {
      await execFileAsync(tsx, [cli, "init", "--agent", "all"], { cwd: temp });
      await expectSkill(temp, ".cursor/skills/agent-markdown/SKILL.md");
      await expectSkill(temp, ".claude/skills/agent-markdown/SKILL.md");
      await expectSkill(temp, ".agents/skills/agent-markdown/SKILL.md");
      await expectSkill(temp, ".opencode/skills/agent-markdown/SKILL.md");
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});

async function expectSkill(root: string, relativePath: string) {
  const content = await fs.readFile(path.join(root, relativePath), "utf8");
  expect(content).toContain("name: agent-markdown");
  expect(content).toContain("description:");
  expect(content).toContain("# Agent Markdown Skill");
  const skillDir = path.dirname(path.join(root, relativePath));
  await fs.access(path.join(skillDir, "agent-md.config.json"));
  await fs.access(path.join(skillDir, "schema.json"));
  await fs.access(path.join(skillDir, "components.json"));
  await fs.access(path.join(skillDir, "examples/example.agent.md"));
}
