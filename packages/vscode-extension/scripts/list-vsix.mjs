import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localVsix = path.join(extensionRoot, "dist", "agent-md-preview.vsix");
const backupVsix = path.join(os.tmpdir(), `agent-md-preview-list-${process.pid}.vsix`);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

let restored = false;
if (fs.existsSync(localVsix)) {
  fs.renameSync(localVsix, backupVsix);
  restored = true;
}

try {
  execFileSync(npx, ["vsce", "ls", "--tree", "--no-dependencies"], {
    cwd: extensionRoot,
    stdio: "inherit"
  });
} finally {
  if (restored) fs.renameSync(backupVsix, localVsix);
}
