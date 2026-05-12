import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(extensionRoot, "dist");
const finalVsix = path.join(outDir, "agent-md-preview.vsix");
const tempVsix = path.join(os.tmpdir(), `agent-md-preview-${process.pid}.vsix`);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

fs.rmSync(finalVsix, { force: true });
fs.rmSync(tempVsix, { force: true });
execFileSync(npx, ["vsce", "package", "--no-dependencies", "--out", tempVsix], {
  cwd: extensionRoot,
  stdio: "inherit"
});
fs.copyFileSync(tempVsix, finalVsix);
fs.rmSync(tempVsix, { force: true });
