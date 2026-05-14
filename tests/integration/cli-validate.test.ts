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

describe("agent-md validate", () => {
  it("prints compact deterministic JSON for agents for valid files", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-validate-"));
    try {
      await fs.copyFile(fixture, path.join(temp, "dashboard.agent.md"));
      const result = await execFileAsync(tsx, [cli, "validate", "--file", "dashboard.agent.md", "--json", "--for-agent"], { cwd: temp });
      const output = JSON.parse(result.stdout) as AgentValidationOutput;

      expect(output).toMatchObject({ version: 1, ok: true });
      expect(output.files).toHaveLength(1);
      expect(output.files[0]).toMatchObject({ ok: true, diagnostics: [] });
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  it("prints repair diagnostics for agents for invalid files without changing normal JSON shape", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "agent-md-validate-"));
    try {
      await fs.writeFile(path.join(temp, "broken.agent.md"), `::chart\ntype: line\ndata: revenue\nx: month\ny: missing_amount\n:::\n\n\`\`\`data revenue\nmonth,amount\nJan,10\n\`\`\`\n`);

      const agentResult = await execInvalid([cli, "validate", "--file", "broken.agent.md", "--json", "--for-agent"], temp);
      const agentOutput = JSON.parse(agentResult.stdout) as AgentValidationOutput;
      const diagnostic = agentOutput.diagnostics.find((item) => item.code === "column_not_found");

      expect(agentOutput.ok).toBe(false);
      expect(diagnostic).toMatchObject({
        severity: "error",
        blockType: "chart",
        field: "missing_amount",
        line: 1,
        suggestion: expect.stringContaining("amount")
      });

      const normalResult = await execInvalid([cli, "validate", "--file", "broken.agent.md", "--json"], temp);
      const normalOutput = JSON.parse(normalResult.stdout) as { files: unknown[]; diagnostics: unknown[] };
      expect(normalOutput.files[0]).toHaveProperty("nodes");
      expect(normalOutput.files[0]).toHaveProperty("dataSources");
      expect(normalOutput.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: "column_not_found" })]));
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});

async function execInvalid(args: string[], cwd: string) {
  try {
    return await execFileAsync(tsx, args, { cwd });
  } catch (error) {
    return error as { stdout: string; stderr: string };
  }
}

type AgentValidationOutput = {
  version: number;
  ok: boolean;
  files: Array<{ sourcePath: string; ok: boolean; diagnostics: DiagnosticOutput[] }>;
  diagnostics: DiagnosticOutput[];
};

type DiagnosticOutput = {
  severity: string;
  code: string;
  message: string;
  sourcePath: string;
  line?: number;
  blockType?: string;
  field?: string;
  suggestion?: string;
  example?: string;
};
