#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import pc from "picocolors";
import fg from "fast-glob";
import chokidar from "chokidar";
import { WebSocketServer } from "ws";
import { parseAgentMarkdown } from "@agent-md/parser";
import { defaultConfig, type AgentMarkdownConfig, type AgentMarkdownDocument, type Diagnostic } from "@agent-md/schema";
import { componentsJson, configJson, exampleAgentMarkdown, schemaJson, skillMarkdown, skillName } from "@agent-md/skill";
import { loadConfig, resolveDocumentData, resolveSafeRealPath, artifactExtensions, dataExtensions } from "@agent-md/resolver";

const program = new Command();
const cliDir = path.dirname(fileURLToPath(import.meta.url));
const extensionId = "AbhinavSwaminathan.agent-md-preview";
const viewerDistCandidates = [
  path.resolve(cliDir, "../viewer-dist"),
  path.resolve(cliDir, "../../viewer/dist")
];
const vsixCandidates = [
  path.resolve(cliDir, "../agent-md-preview.vsix"),
  path.resolve(cliDir, "../../vscode-extension/dist/agent-md-preview.vsix")
];

program.name("agent-md").description("Local-first Agent Markdown runtime").version("0.1.0");

program.command("init")
  .option("--agent <agent>", "agent skill flavor", "generic")
  .action(async (options) => {
    const root = process.cwd();
    const agent = normalizeAgent(String(options.agent));
    await writeIfMissing(path.join(root, "agent-md.config.json"), configJson());
    await fs.mkdir(path.join(root, ".agent-md"), { recursive: true });
    await fs.mkdir(path.join(root, "examples"), { recursive: true });
    await writeIfMissing(path.join(root, ".agent-md", "skill.md"), skillMarkdown);
    const installedSkillPaths = await installAgentSkill(root, agent);
    await writeIfMissing(path.join(root, ".agent-md", "schema.json"), schemaJson());
    await writeIfMissing(path.join(root, ".agent-md", "components.json"), componentsJson());
    await writeIfMissing(path.join(root, "examples", "example.agent.md"), exampleAgentMarkdown);
    if (["cursor", "vscode"].includes(agent)) await mergeVsCodeRecommendation(root);
    console.log(pc.green("Agent Markdown project initialized."));
    for (const installedPath of installedSkillPaths) console.log(pc.gray(`Agent skill installed: ${path.relative(root, installedPath)}`));
    if (["cursor", "vscode"].includes(agent)) {
      console.log(pc.gray(`Recommended extension added: ${extensionId}`));
      console.log(pc.gray("Open an .agent.md file and run: Agent Markdown: Open Preview"));
      console.log(pc.gray("Browser fallback: npx agent-md serve"));
    }
  });

program.command("validate")
  .option("--file <file>", "validate a single file")
  .option("--json", "print JSON diagnostics")
  .option("--strict", "treat warnings as failures")
  .option("--root <root>", "project root", ".")
  .option("--config <config>", "config path", "agent-md.config.json")
  .action(async (options) => {
    const root = path.resolve(options.root);
    const config = await loadConfig(root, options.config);
    const files = options.file ? [path.resolve(root, options.file)] : await scanMarkdownFiles(root, config, false);
    const results = await Promise.all(files.map((file) => parseAndResolve(file, root, config)));
    const diagnostics = results.flatMap((result) => result.diagnostics);
    if (options.json) {
      console.log(JSON.stringify({ files: results, diagnostics }, null, 2));
    } else {
      printDiagnostics(results);
    }
    const hasFailure = diagnostics.some((diagnostic) => diagnostic.severity === "error" || (options.strict && diagnostic.severity === "warning"));
    process.exitCode = hasFailure ? 1 : 0;
  });

program.command("serve")
  .option("--port <port>", "port", String(defaultConfig.server.port))
  .option("--host <host>", "host", defaultConfig.server.host)
  .option("--root <root>", "project root", ".")
  .option("--open", "open browser")
  .option("--no-open", "do not open browser")
  .option("--all-md", "include all Markdown files")
  .option("--config <config>", "config path", "agent-md.config.json")
  .action(async (options) => {
    const root = path.resolve(options.root);
    const config = await loadConfig(root, options.config);
    const port = Number(options.port ?? config.server.port);
    const host = String(options.host ?? config.server.host);
    const server = http.createServer(async (req, res) => {
      try {
        await handleRequest(req, res, root, config, Boolean(options.allMd));
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
      }
    });
    const wss = new WebSocketServer({ server, path: "/ws" });
    const watcher = chokidar.watch([...(config.include ?? []), "agent-md.config.json", ".agent-md/components.json"], { cwd: root, ignored: config.exclude, ignoreInitial: true });
    watcher.on("all", () => {
      for (const client of wss.clients) client.send(JSON.stringify({ type: "reload" }));
    });
    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      console.log(pc.green(`Agent Markdown running at ${url}`));
      const shouldOpen = options.open === true || (options.open !== false && config.server.open);
      if (shouldOpen) openBrowser(url).catch(() => undefined);
    });
  });

program.command("export")
  .argument("file")
  .option("--format <format>", "html | json | markdown-fallback", "json")
  .option("--root <root>", "project root", ".")
  .action(async (file, options) => {
    const root = path.resolve(options.root);
    const config = await loadConfig(root);
    const document = await parseAndResolve(path.resolve(root, file), root, config);
    if (options.format === "json") console.log(JSON.stringify(document, null, 2));
    else if (options.format === "markdown-fallback") console.log(renderFallback(document));
    else console.log(renderStaticHtml(document));
  });

program.command("vscode-extension")
  .description("Print or run local VSCode/Cursor extension install instructions")
  .option("--editor <editor>", "editor CLI to use: cursor or code", "cursor")
  .option("--install", "install the bundled VSIX with the editor CLI")
  .option("--force", "force reinstall when using --install", true)
  .action(async (options) => {
    const vsix = await findVsix();
    if (!vsix) {
      console.log(pc.yellow("No bundled Agent Markdown VSIX was found."));
      console.log("Build it with: npm run package -w agent-md-preview");
      console.log(`Then install it with: ${options.editor} --install-extension packages/vscode-extension/dist/agent-md-preview.vsix --force`);
      return;
    }
    if (options.install) {
      await installVsix(String(options.editor), vsix, Boolean(options.force));
      return;
    }
    console.log(`Agent Markdown VSIX: ${vsix}`);
    console.log(`Install with: ${options.editor} --install-extension "${vsix}" --force`);
  });

program.parseAsync(process.argv);

async function writeIfMissing(file: string, content: string) {
  try { await fs.writeFile(file, content, { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
}

async function installAgentSkill(root: string, agent: string) {
  const skillPaths = skillInstallPaths(root, agent);
  for (const skillPath of skillPaths) {
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await writeIfMissing(skillPath, skillMarkdown);
  }
  return skillPaths;
}

function normalizeAgent(agent: string) {
  return agent.toLowerCase().trim().replace(/[\s_]+/g, "-");
}

function skillInstallPaths(root: string, agent: string) {
  const relativeRoots: Record<string, string[]> = {
    cursor: [".cursor/skills"],
    vscode: [".agents/skills"],
    "claude-code": [".claude/skills"],
    claude: [".claude/skills"],
    codex: [".agents/skills"],
    opencode: [".opencode/skills"],
    generic: [".agents/skills"],
    all: [".cursor/skills", ".claude/skills", ".agents/skills", ".opencode/skills"]
  };
  const roots = relativeRoots[agent] ?? relativeRoots.generic;
  return roots.map((relativeRoot) => path.join(root, relativeRoot, skillName, "SKILL.md"));
}

async function mergeVsCodeRecommendation(root: string) {
  const vscodeDir = path.join(root, ".vscode");
  const extensionsPath = path.join(vscodeDir, "extensions.json");
  await fs.mkdir(vscodeDir, { recursive: true });
  let data: { recommendations?: string[]; unwantedRecommendations?: string[] } = {};
  try {
    data = JSON.parse(await fs.readFile(extensionsPath, "utf8")) as typeof data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const recommendations = new Set(data.recommendations ?? []);
  recommendations.add(extensionId);
  await fs.writeFile(extensionsPath, JSON.stringify({ ...data, recommendations: [...recommendations].sort() }, null, 2) + "\n");
}

async function findVsix() {
  for (const candidate of vsixCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next packaged/dev VSIX location.
    }
  }
  return undefined;
}

async function installVsix(editor: string, vsix: string, force: boolean) {
  const { execFile } = await import("node:child_process");
  const args = ["--install-extension", vsix, ...(force ? ["--force"] : [])];
  await new Promise<void>((resolve, reject) => {
    execFile(editor, args, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
  console.log(pc.green(`Installed Agent Markdown extension with ${editor}.`));
}

async function scanMarkdownFiles(root: string, config: AgentMarkdownConfig, allMd: boolean) {
  const include = allMd ? ["**/*.md"] : config.include;
  const files = await fg(include, { cwd: root, ignore: config.exclude, absolute: true, onlyFiles: true });
  const safeFiles: string[] = [];
  for (const file of files) {
    try {
      safeFiles.push(await resolveSafeRealPath(root, path.join(root, "agent-md.config.json"), file));
    } catch {
      // Ignore symlink escapes and inaccessible files during project scans.
    }
  }
  if (!allMd) return safeFiles;
  const matching: string[] = [];
  for (const file of safeFiles) if ((await fs.readFile(file, "utf8")).includes("format: agent-md")) matching.push(file);
  return matching;
}

async function parseAndResolve(file: string, root: string, config: AgentMarkdownConfig) {
  const safeFile = await resolveSafeRealPath(root, path.join(root, "agent-md.config.json"), file);
  const stat = await fs.stat(safeFile);
  const diagnostics: Diagnostic[] = [];
  if (stat.size > config.limits.maxMarkdownSizeMb * 1024 * 1024) diagnostics.push({ severity: "warning", code: "markdown_size", message: `Markdown file exceeds ${config.limits.maxMarkdownSizeMb} MB target.`, sourcePath: safeFile });
  const source = await fs.readFile(safeFile, "utf8");
  const parsed = parseAgentMarkdown({ source, sourcePath: safeFile });
  const resolved = await resolveDocumentData(parsed, root, config);
  return { ...resolved, diagnostics: [...diagnostics, ...resolved.diagnostics] };
}

function printDiagnostics(results: AgentMarkdownDocument[]) {
  for (const result of results) {
    console.log(pc.bold(path.relative(process.cwd(), result.sourcePath)));
    if (result.diagnostics.length === 0) {
      console.log(pc.green("  OK"));
      continue;
    }
    for (const diagnostic of result.diagnostics) {
      const color = diagnostic.severity === "error" ? pc.red : diagnostic.severity === "warning" ? pc.yellow : pc.blue;
      console.log(color(`  ${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`));
      if (diagnostic.line) console.log(`    Line: ${diagnostic.line}`);
      if (diagnostic.blockType) console.log(`    Block: ::${diagnostic.blockType}`);
      if (diagnostic.suggestion) console.log(`    Suggestion: ${diagnostic.suggestion}`);
    }
  }
}

async function resolveRequestedDocument(root: string, config: AgentMarkdownConfig, allMd: boolean, file: string) {
  const requested = await resolveSafeRealPath(root, path.join(root, "agent-md.config.json"), file);
  const allowed = await scanMarkdownFiles(root, config, allMd);
  const allowedRealPaths = new Set(await Promise.all(allowed.map((item) => fs.realpath(item))));
  if (!allowedRealPaths.has(requested)) throw new Error("Requested file is not an Agent Markdown document");
  return requested;
}

function collectArtifactRefs(nodes: AgentMarkdownDocument["nodes"]): Set<string> {
  const refs = new Set<string>();
  const visit = (node: AgentMarkdownDocument["nodes"][number]) => {
    if ((node.type === "embed" || node.type === "diagram") && node.src) refs.add(node.src);
    if (node.type === "tabs") node.tabs.forEach((tab) => tab.children.forEach(visit));
    if (node.type === "callout") node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return refs;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, root: string, config: AgentMarkdownConfig, allMd: boolean) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  if (url.pathname === "/api/files") {
    const files = await scanMarkdownFiles(root, config, allMd);
    const items = await Promise.all(files.map(async (file) => {
      const document = await parseAndResolve(file, root, config).catch((error) => ({ diagnostics: [{ severity: "error", code: "parse_error", message: error instanceof Error ? error.message : "Unable to parse", sourcePath: file }] as Diagnostic[] }));
      return { path: path.relative(root, file), diagnostics: document.diagnostics };
    }));
    return sendJson(res, 200, { files: items });
  }
  if (url.pathname === "/api/document") {
    const file = url.searchParams.get("file");
    if (!file) return sendJson(res, 400, { error: "file is required" });
    const absolute = await resolveRequestedDocument(root, config, allMd, file);
    return sendJson(res, 200, await parseAndResolve(absolute, root, config));
  }
  if (url.pathname === "/api/source") {
    const file = url.searchParams.get("file");
    if (!file) return sendJson(res, 400, { error: "file is required" });
    const absolute = await resolveRequestedDocument(root, config, allMd, file);
    return sendJson(res, 200, { source: await fs.readFile(absolute, "utf8") });
  }
  if (url.pathname === "/artifact") {
    const file = url.searchParams.get("file");
    const src = url.searchParams.get("src");
    if (!file || !src) return sendJson(res, 400, { error: "file and src are required" });
    const sourceFile = await resolveRequestedDocument(root, config, allMd, file);
    const document = await parseAndResolve(sourceFile, root, config);
    if (!collectArtifactRefs(document.nodes).has(src)) return sendJson(res, 403, { error: "artifact is not referenced by document" });
    const artifact = await resolveSafeRealPath(root, sourceFile, src);
    const ext = path.extname(artifact).toLowerCase();
    if (!artifactExtensions.has(ext) && !dataExtensions.has(ext)) return sendJson(res, 400, { error: "unsupported artifact" });
    if (ext === ".html" && !config.security.allowHtmlEmbeds) return sendJson(res, 403, { error: "HTML embeds are blocked" });
    return fs.readFile(artifact).then((buffer) => { res.statusCode = 200; res.setHeader("content-type", contentType(artifact)); res.end(buffer); });
  }
  return serveViewerAsset(url.pathname, res);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
function sendHtml(res: http.ServerResponse, body: string) {
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf8");
  res.end(body);
}

async function serveViewerAsset(pathname: string, res: http.ServerResponse) {
  const viewerDistDir = await findViewerDistDir();
  if (!viewerDistDir) {
    if (pathname === "/") return sendHtml(res, viewerHtml());
    return sendJson(res, 404, { error: "Viewer assets have not been built. Run npm run build." });
  }
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.replace(/^\/+/, ""));
  const absolute = path.resolve(viewerDistDir, relative);
  const insideViewer = !path.relative(viewerDistDir, absolute).startsWith("..") && !path.isAbsolute(path.relative(viewerDistDir, absolute));
  if (!insideViewer) return sendJson(res, 403, { error: "Forbidden" });
  try {
    const body = await fs.readFile(absolute);
    res.statusCode = 200;
    res.setHeader("content-type", contentType(absolute));
    res.end(body);
  } catch (error) {
    if (pathname === "/" && (error as NodeJS.ErrnoException).code === "ENOENT") return sendHtml(res, viewerHtml());
    sendJson(res, 404, { error: "Not found" });
  }
}

async function findViewerDistDir() {
  for (const candidate of viewerDistCandidates) {
    try {
      await fs.access(path.join(candidate, "index.html"));
      return candidate;
    } catch {
      // Try the next packaged/dev asset location.
    }
  }
  return undefined;
}

function contentType(file: string) {
  const ext = path.extname(file);
  if (ext === ".html") return "text/html; charset=utf8";
  if (ext === ".js") return "text/javascript; charset=utf8";
  if (ext === ".css") return "text/css; charset=utf8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

function renderFallback(document: AgentMarkdownDocument) {
  return document.nodes.map((node) => node.type === "markdown" ? node.value : `[${node.type}]`).join("\n\n");
}
function renderStaticHtml(document: AgentMarkdownDocument) {
  return `<!doctype html><meta charset="utf8"><title>Agent Markdown</title><pre>${escapeHtml(JSON.stringify(document, null, 2))}</pre>`;
}
function escapeHtml(value: string) { return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]!)); }
async function openBrowser(url: string) { await import("node:child_process").then(({ execFile }) => execFile(process.platform === "darwin" ? "open" : "xdg-open", [url])); }

function viewerHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Agent Markdown</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111;background:#f8fafc}body{margin:0}.app{display:grid;grid-template-columns:300px 1fr;min-height:100vh}.top{grid-column:1/3;padding:12px 18px;background:#111827;color:white;font-weight:700}.side{border-right:1px solid #e5e7eb;padding:16px;background:white}.main{padding:24px;max-width:1100px}.file{display:block;width:100%;text-align:left;border:1px solid #e5e7eb;background:#fff;padding:8px;margin:6px 0;border-radius:8px;cursor:pointer}.file.active{border-color:#2563eb;background:#eff6ff}.card{border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:16px;margin:12px 0;box-shadow:0 1px 2px #0001}.error{border-color:#ef4444;background:#fef2f2}.warning{border-color:#f59e0b;background:#fffbeb}.grid{display:grid;gap:12px}.tabs button{margin-right:8px}.diag{font-size:13px;margin:8px 0;padding:8px;border-radius:8px;background:#f3f4f6}pre{white-space:pre-wrap;background:#111827;color:#e5e7eb;padding:16px;border-radius:12px;overflow:auto}table{border-collapse:collapse;width:100%;background:white}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f9fafb}input,select{padding:8px;border:1px solid #d1d5db;border-radius:8px}</style>
</head><body><div id="app" class="app"><div class="top">Agent Markdown</div><aside class="side"><h3>Project files</h3><div id="files">Loading...</div><h3>Diagnostics</h3><div id="diagnostics"></div></aside><main class="main"><button id="toggle">Source</button><div id="document"></div></main></div>
<script>
let selected=null, doc=null, showSource=false;
const ws = new WebSocket('ws://' + location.host + '/ws'); ws.onmessage = () => loadFiles().then(()=> selected && loadDoc(selected));
document.getElementById('toggle').onclick=()=>{showSource=!showSource; renderDoc();};
async function loadFiles(){const data=await fetch('/api/files').then(r=>r.json()); const el=document.getElementById('files'); el.innerHTML=''; data.files.forEach(f=>{const b=document.createElement('button'); b.className='file'+(f.path===selected?' active':''); b.textContent=f.path+' '+(f.diagnostics.some(d=>d.severity==='error')?'✕':'✓'); b.onclick=()=>loadDoc(f.path); el.appendChild(b);}); if(!selected && data.files[0]) await loadDoc(data.files[0].path);}
async function loadDoc(file){selected=file; doc=await fetch('/api/document?file='+encodeURIComponent(file)).then(r=>r.json()); showSource=false; await renderDoc(); loadFiles();}
function diagnostics(){const el=document.getElementById('diagnostics'); el.innerHTML=''; (doc?.diagnostics||[]).forEach(d=>{const x=document.createElement('div'); x.className='diag '+d.severity; x.textContent=d.severity.toUpperCase()+': '+d.message+(d.line?' line '+d.line:''); el.appendChild(x);});}
async function renderDoc(){diagnostics(); const el=document.getElementById('document'); if(!doc){el.textContent='Select a file';return;} if(showSource){const src=await fetch('/api/source?file='+encodeURIComponent(selected)).then(r=>r.json()); el.innerHTML='<pre></pre>'; el.querySelector('pre').textContent=src.source; return;} el.innerHTML=''; doc.nodes.forEach(n=>el.appendChild(renderNode(n)));}
function renderNode(n){const d=document.createElement('div'); if(n.type==='markdown'){d.innerHTML=md(n.value); return d;} d.className='card'; if(n.type==='error'){d.className='card error'; d.textContent=n.message; return d;} if(n.type==='metric'){d.innerHTML='<strong>'+esc(n.label)+'</strong><h2>'+esc(metricValue(n))+'</h2>'+(n.delta?'<p>'+esc(n.delta)+'</p>':''); return d;} if(n.type==='chart'){d.innerHTML='<strong>'+esc(n.title||'Chart')+'</strong><pre>'+esc('[Chart: '+n.chartType+' chart of '+(n.y||n.value||'value')+' by '+(n.x||n.label||'label')+']')+'</pre>'; return d;} if(n.type==='table'||n.type==='query'){const rows=rowsFor(n); d.innerHTML='<strong>'+esc(n.title||n.type)+'</strong>'+table(rows,n.columns||n.select); return d;} if(n.type==='callout'){d.className='card '+n.calloutType; d.innerHTML='<strong>'+esc(n.title||n.calloutType)+'</strong><div>'+md(n.body||'')+'</div>'; return d;} if(n.type==='tabs'){d.className='card tabs'; let active=0; const nav=document.createElement('div'), body=document.createElement('div'); const show=i=>{active=i; body.innerHTML=''; n.tabs[i].children.forEach(c=>body.appendChild(renderNode(c)));}; n.tabs.forEach((t,i)=>{const b=document.createElement('button'); b.textContent=t.label; b.onclick=()=>show(i); nav.appendChild(b);}); d.append(nav,body); show(0); return d;} if(n.type==='timeline'){d.innerHTML='<strong>Timeline</strong>'+((n.events||[]).map(e=>'<p><b>'+esc(e.date)+'</b> '+esc(e.title)+'</p>').join('')); return d;} if(n.type==='form'){d.innerHTML='<strong>'+esc(n.title||'Form')+'</strong>'+n.fields.map(f=>'<label><p>'+esc(f.label||f.name)+'</p><input type="'+(f.fieldType==='number'?'number':f.fieldType==='date'?'date':'text')+'" value="'+esc(f.default||'')+'"></label>').join(''); return d;} if(n.type==='embed'){d.innerHTML='<strong>'+esc(n.title||n.src)+'</strong><p><a href="/artifact?file='+encodeURIComponent(selected)+'&src='+encodeURIComponent(n.src)+'">Open artifact</a></p>'; return d;} d.innerHTML='<pre>'+esc('['+n.type+']')+'</pre>'; return d;}
function rowsFor(n){const ds=doc.dataSources[n.data]; if(!ds?.rows)return[]; let rows=[...ds.rows]; if(n.where) rows=rows.filter(r=>Object.entries(n.where).every(([k,v])=>typeof v==='object'?true:r[k]===v)); if(n.sort) rows.sort((a,b)=>a[n.sort.by]>b[n.sort.by]?1:-1); if(n.limit) rows=rows.slice(0,n.limit); return rows;}
function metricValue(n){if(n.value!=null)return n.value; const rows=doc.dataSources[n.data]?.rows||[]; const vals=rows.map(r=>Number(r[n.field])).filter(Number.isFinite); if(n.aggregate==='count')return rows.length; if(n.aggregate==='avg')return vals.reduce((a,b)=>a+b,0)/Math.max(vals.length,1); if(n.aggregate==='min')return Math.min(...vals); if(n.aggregate==='max')return Math.max(...vals); return vals.reduce((a,b)=>a+b,0);}
function table(rows, cols){cols=cols||Object.keys(rows[0]||{}); return '<table><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,500).map(r=>'<tr>'+cols.map(c=>'<td>'+esc(r[c])+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function md(s){return esc(s).replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/\\n/g,'<br>');}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
loadFiles();
</script></body></html>`;
}
