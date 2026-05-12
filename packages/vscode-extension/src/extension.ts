import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { parseAgentMarkdown } from "@agent-md/parser";
import type { AgentMarkdownDocument, DocumentNode } from "@agent-md/schema";
import { loadConfig, resolveDocumentData, resolveSafeRealPath } from "@agent-md/resolver";

let currentPanel: vscode.WebviewPanel | undefined;
let currentWatcher: vscode.FileSystemWatcher | undefined;
const diagramSourceExtensions = new Set([".mmd", ".mermaid", ".txt", ".md"]);

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand("agentMd.openPreview", async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target || target.scheme !== "file") {
      vscode.window.showWarningMessage("Open an .agent.md or .amd.md file to preview Agent Markdown.");
      return;
    }
    await openPreview(context, target);
  }));
}

export function deactivate() {
  currentWatcher?.dispose();
}

async function openPreview(context: vscode.ExtensionContext, uri: vscode.Uri) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  const projectRoot = workspaceFolder?.uri.fsPath ?? path.dirname(uri.fsPath);
  const config = await loadConfig(projectRoot);
  const source = await fs.readFile(uri.fsPath, "utf8");
  const parsed = parseAgentMarkdown({ source, sourcePath: uri.fsPath });
  const resolved = await resolveDocumentData(parsed, projectRoot, config);
  const document = await inlineDiagramSources(resolved, projectRoot);

  currentPanel ??= vscode.window.createWebviewPanel("agentMarkdownPreview", "Agent Markdown Preview", vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [context.extensionUri]
  });

  currentPanel.title = `Preview: ${path.basename(uri.fsPath)}`;
  currentPanel.webview.html = await webviewHtml(context, currentPanel.webview, document, source);
  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
    currentWatcher?.dispose();
    currentWatcher = undefined;
  });

  currentWatcher?.dispose();
  currentWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectRoot, "**/*.{agent.md,amd.md,csv,tsv,json,yaml,yml,geojson,mmd,md}"));
  const refresh = async () => {
    if (currentPanel) await openPreview(context, uri);
  };
  currentWatcher.onDidChange(refresh);
  currentWatcher.onDidCreate(refresh);
  currentWatcher.onDidDelete(refresh);
}

async function inlineDiagramSources(document: AgentMarkdownDocument, projectRoot: string): Promise<AgentMarkdownDocument> {
  const config = await loadConfig(projectRoot);
  const nodes = await Promise.all(document.nodes.map((node) => inlineDiagramNode(node, document.sourcePath, projectRoot, config.limits.maxEmbedSizeMb)));
  return { ...document, nodes };
}

async function inlineDiagramNode(node: DocumentNode, sourcePath: string, projectRoot: string, maxSizeMb: number): Promise<DocumentNode> {
  if (node.type === "diagram" && node.src && !node.source) {
    try {
      const absolute = await resolveSafeRealPath(projectRoot, sourcePath, node.src);
      const ext = path.extname(absolute).toLowerCase();
      if (!diagramSourceExtensions.has(ext)) return node;
      const stat = await fs.stat(absolute);
      if (stat.size > maxSizeMb * 1024 * 1024) return node;
      return { ...node, source: await fs.readFile(absolute, "utf8") };
    } catch {
      return node;
    }
  }
  if (node.type === "tabs") {
    return { ...node, tabs: await Promise.all(node.tabs.map(async (tab) => ({ ...tab, children: await Promise.all(tab.children.map((child) => inlineDiagramNode(child, sourcePath, projectRoot, maxSizeMb))) }))) };
  }
  if (node.type === "callout" && node.children) {
    return { ...node, children: await Promise.all(node.children.map((child) => inlineDiagramNode(child, sourcePath, projectRoot, maxSizeMb))) };
  }
  return node;
}

async function webviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview, document: AgentMarkdownDocument, source: string) {
  const webviewDir = vscode.Uri.joinPath(context.extensionUri, "dist", "webview");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "webview.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, "webview.css"));
  const nonce = createNonce();
  const documentJson = escapeScriptJson(document);
  const sourceJson = escapeScriptJson(source);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Agent Markdown Preview</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.agentMarkdownDocument = ${documentJson};
    window.agentMarkdownSource = ${sourceJson};
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function createNonce() {
  return randomBytes(16).toString("base64");
}
