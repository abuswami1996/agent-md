import { execFileSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const skipRemote = args.has("--no-remote") || process.env.RELEASE_CHECK_REMOTE === "0";
const releaseTag = getArgValue("--tag") ?? process.env.RELEASE_TAG ?? "";
const publishNpm = boolEnv("PUBLISH_NPM", true);
const publishVscode = boolEnv("PUBLISH_VSCODE", true);
const publishOpenVsx = boolEnv("PUBLISH_OPENVSX", true);

const checks = [];

const rootPackage = readJson("package.json");
const cliPackage = readJson("packages/cli/package.json");
const extensionPackage = readJson("packages/vscode-extension/package.json");

check("root package is private", () => {
  assert(rootPackage.private === true, "Root package must remain private.");
});

check("publishable package metadata", () => {
  assert(cliPackage.name === "@abuswami1996/agent-md", "CLI package name changed unexpectedly.");
  assert(cliPackage.license === "MIT", "CLI package license must be MIT.");
  assert(extensionPackage.publisher === "AbhinavSwaminathan", "Extension publisher changed unexpectedly.");
  assert(extensionPackage.license === "MIT", "Extension package license must be MIT.");
  assert(extensionPackage.repository?.url?.includes("github.com/abuswami1996/agent-md.git"), "Extension repository URL is incorrect.");
  assert(cliPackage.repository?.url?.includes("github.com/abuswami1996/agent-md.git"), "CLI repository URL is incorrect.");
});

check("versions are valid semver", () => {
  assertSemver(cliPackage.version, "CLI package version");
  assertSemver(extensionPackage.version, "VSCode extension version");
});

check("release tag matches selected package versions", () => {
  if (!releaseTag) return;
  const version = releaseTag.replace(/^v/, "");
  assertSemver(version, "Release tag");
  if (publishNpm) assert(cliPackage.version === version, `Release tag ${releaseTag} does not match CLI version ${cliPackage.version}.`);
  if (publishVscode || publishOpenVsx) {
    assert(extensionPackage.version === version, `Release tag ${releaseTag} does not match extension version ${extensionPackage.version}.`);
  }
});

check("changelog entries exist", () => {
  assertChangelog("CHANGELOG.md", cliPackage.version);
  assertChangelog("packages/cli/CHANGELOG.md", cliPackage.version);
  assertChangelog("packages/vscode-extension/CHANGELOG.md", extensionPackage.version);
});

check("required build artifacts exist", () => {
  for (const artifact of [
    "packages/cli/dist/index.js",
    "packages/cli/dist/index.d.ts",
    "packages/cli/viewer-dist/index.html",
    "packages/cli/agent-md-preview.vsix",
    "packages/vscode-extension/dist/extension.js",
    "packages/vscode-extension/dist/agent-md-preview.vsix"
  ]) {
    assert(fs.existsSync(path.join(root, artifact)), `Missing build artifact: ${artifact}`);
  }
});

check("npm package contents are allowlisted", () => {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json", "-w", "@abuswami1996/agent-md"], {
    cwd: root,
    encoding: "utf8"
  });
  const packInfo = JSON.parse(output)[0];
  const files = packInfo.files.map((file) => file.path);
  assert(files.includes("dist/index.js"), "npm package is missing dist/index.js.");
  assert(files.includes("dist/index.d.ts"), "npm package is missing dist/index.d.ts.");
  assert(files.includes("viewer-dist/index.html"), "npm package is missing viewer-dist/index.html.");
  assert(files.includes("agent-md-preview.vsix"), "npm package is missing bundled VSIX.");
  assertNoForbiddenFiles(files, "npm package");
});

check("VSIX package contents are allowlisted", () => {
  const vsixPath = path.join(root, "packages/vscode-extension/dist/agent-md-preview.vsix");
  const output = execFileSync("unzip", ["-Z1", vsixPath], { cwd: root, encoding: "utf8" });
  const files = output.split(/\r?\n/).filter(Boolean);
  assert(files.includes("extension/package.json"), "VSIX is missing extension/package.json.");
  assert(files.includes("extension/dist/extension.js"), "VSIX is missing extension/dist/extension.js.");
  assertNoForbiddenFiles(files, "VSIX package");
});

if (!skipRemote && publishNpm) {
  check("npm version is not already published", async () => {
    const published = await npmVersionExists(cliPackage.name, cliPackage.version);
    assert(!published, `${cliPackage.name}@${cliPackage.version} is already published to npm.`);
  });
}

let failures = 0;
for (const { name, run } of checks) {
  try {
    await run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  process.exitCode = 1;
}

function check(name, run) {
  checks.push({ name, run });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSemver(version, label) {
  assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), `${label} must be a valid semver version.`);
}

function assertChangelog(relativePath, version) {
  const changelog = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert(new RegExp(`^##\\s+\\[?${escapeRegExp(version)}\\]?\\s*$`, "m").test(changelog), `${relativePath} is missing a ${version} entry.`);
}

function assertNoForbiddenFiles(files, label) {
  const forbidden = files.filter((file) => {
    const normalized = file.replaceAll("\\", "/").toLowerCase();
    return (
      normalized.includes(".env") ||
      normalized.includes("node_modules/") ||
      normalized.includes(".git/") ||
      normalized.endsWith(".tgz") ||
      normalized.endsWith(".log") ||
      normalized.endsWith(".map")
    );
  });
  assert(forbidden.length === 0, `${label} includes forbidden files:\n${forbidden.join("\n")}`);
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function boolEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === "") return defaultValue;
  return value === "true" || value === "1";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function npmVersionExists(packageName, version) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(packageName).replace("%40", "@");
    https
      .get(`https://registry.npmjs.org/${encoded}/${version}`, (response) => {
        response.resume();
        if (response.statusCode === 200) resolve(true);
        else if (response.statusCode === 404) resolve(false);
        else reject(new Error(`npm registry returned HTTP ${response.statusCode} for ${packageName}@${version}.`));
      })
      .on("error", reject);
  });
}
