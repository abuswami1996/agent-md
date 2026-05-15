import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Braces, FileCode, FileText, FolderOpen, Table2 } from "lucide-react";
import { AgentMarkdownRenderer } from "@agent-md/renderer-react";
import type { StaticArtifact } from "@agent-md/renderer-react";
import type { AgentMarkdownDocument, Diagnostic } from "@agent-md/schema";
import "./style.css";

type FileItem = { path: string; diagnostics: Diagnostic[] };
type FileGroup = { folder: string; files: FileItem[] };
type StaticPayload = { document: AgentMarkdownDocument; source?: string; artifacts?: Record<string, StaticArtifact>; sourcePathLabel?: string; title?: string };

declare global {
  interface Window {
    __AGENT_MD_STATIC__?: StaticPayload;
  }
}

function App() {
  const staticPayload = window.__AGENT_MD_STATIC__;
  if (staticPayload) return <StaticApp payload={staticPayload} />;
  return <ServerApp />;
}

function ServerApp() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<string>();
  const [document, setDocument] = useState<AgentMarkdownDocument>();
  const [source, setSource] = useState<string>();
  const [mode, setMode] = useState<"rendered" | "source">("rendered");
  const [filesLoading, setFilesLoading] = useState(true);
  const [documentLoading, setDocumentLoading] = useState(false);
  const groups = useMemo(() => groupFiles(files), [files]);
  useEffect(() => { loadFiles(); const ws = new WebSocket(`ws://${location.host}/ws`); ws.onmessage = () => { loadFiles(); if (selected) loadDocument(selected); }; return () => ws.close(); }, [selected]);
  async function loadFiles() {
    setFilesLoading(true);
    const response = await fetch("/api/files").then((res) => res.json());
    setFiles(response.files);
    setFilesLoading(false);
    if (!selected && response.files[0]) loadDocument(response.files[0].path);
    if (selected && !response.files.some((file: FileItem) => file.path === selected) && response.files[0]) loadDocument(response.files[0].path);
  }
  async function loadDocument(file: string) {
    setSelected(file); setMode("rendered");
    setDocumentLoading(true);
    setDocument(undefined);
    setSource(undefined);
    const [nextDocument, nextSource] = await Promise.all([
      fetch(`/api/document?file=${encodeURIComponent(file)}`).then((res) => res.json()),
      fetch(`/api/source?file=${encodeURIComponent(file)}`).then((res) => res.json()).then((data) => data.source)
    ]);
    setDocument(nextDocument);
    setSource(nextSource);
    setDocumentLoading(false);
  }
  return <div className="app-frame"><div className="browser-shell"><aside className="file-sidebar" aria-label="Project files"><div className="sidebar-strip">{filesLoading ? "Loading files..." : `Files (${files.length})`}</div><div className="file-tree">{filesLoading && files.length === 0 ? <p className="empty-state">Scanning Agent Markdown files...</p> : groups.map((group) => <section className="folder-group" key={group.folder}><div className="folder-row"><FolderOpen aria-hidden className="tree-icon folder-icon" /><div><div className="folder-name">{group.folder}</div><div className="folder-count">{group.files.length} files</div></div></div><ul>{group.files.map((file) => <li key={file.path}><button type="button" title={file.path} className={file.path === selected ? "file-row active" : "file-row"} onClick={() => loadDocument(file.path)}><FileIcon path={file.path} /><span>{displayFileName(file.path)}</span><Status diagnostics={file.diagnostics} /></button></li>)}</ul></section>)}</div></aside><main className="preview-pane"><div className="preview-header"><div><h3>{selected ?? "Select a file"}</h3>{document ? <p>{diagnosticSummary(document)}</p> : <p>{documentLoading ? "Loading document..." : "Agent Markdown preview"}</p>}</div><button className="mode-button" type="button" onClick={() => setMode(mode === "rendered" ? "source" : "rendered")} disabled={!document && !source}>{mode === "rendered" ? "Source" : "Rendered"}</button></div><div className="preview-body">{documentLoading ? <p className="empty-state">Loading document...</p> : mode === "source" ? <pre>{source}</pre> : document ? <AgentMarkdownRenderer document={document} /> : <p className="empty-state">Choose a file from the tree.</p>}</div>{document?.diagnostics.length ? <DiagnosticsPanel diagnostics={document.diagnostics} /> : null}</main></div></div>;
}

function StaticApp({ payload }: { payload: StaticPayload }) {
  const [mode, setMode] = useState<"rendered" | "source">("rendered");
  const { document, source, artifacts } = payload;
  const title = payload.title ?? (typeof document.frontmatter?.title === "string" ? document.frontmatter.title : "Agent Markdown");
  return <div className="app-frame"><div className="browser-shell static-shell"><main className="preview-pane"><div className="preview-header"><div><h3>{title}</h3><p>{payload.sourcePathLabel ?? document.sourcePath} · {diagnosticSummary(document)}</p></div>{source != null ? <button className="mode-button" type="button" onClick={() => setMode(mode === "rendered" ? "source" : "rendered")}>{mode === "rendered" ? "Source" : "Rendered"}</button> : null}</div><div className="preview-body">{mode === "source" ? <pre>{source}</pre> : <AgentMarkdownRenderer document={document} staticArtifacts={artifacts} />}</div>{document.diagnostics.length ? <DiagnosticsPanel diagnostics={document.diagnostics} /> : null}</main></div></div>;
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  const groups = groupDiagnostics(diagnostics);
  return <div className="diagnostics-panel" aria-label="Diagnostics">{groups.map(([severity, items]) => <section key={severity}><h4>{severity} ({items.length})</h4>{items.map((diagnostic, index) => <article key={`${diagnostic.code}-${diagnostic.line ?? "file"}-${index}`} className={diagnostic.severity}><strong>{diagnostic.message}</strong><p>{diagnostic.code}{diagnostic.line ? ` · line ${diagnostic.line}` : ""}{diagnostic.blockType ? ` · ::${diagnostic.blockType}` : ""}{diagnostic.field ? ` · ${diagnostic.field}` : ""}</p>{diagnostic.suggestion ? <p>Suggestion: {diagnostic.suggestion}</p> : null}{diagnostic.example ? <pre>{diagnostic.example}</pre> : null}</article>)}</section>)}</div>;
}

function groupDiagnostics(diagnostics: Diagnostic[]): Array<[Diagnostic["severity"], Diagnostic[]]> {
  const order: Diagnostic["severity"][] = ["error", "warning", "info"];
  return order.map((severity) => [severity, diagnostics.filter((diagnostic) => diagnostic.severity === severity)] as [Diagnostic["severity"], Diagnostic[]]).filter(([, items]) => items.length > 0);
}

export function groupFiles(files: FileItem[]): FileGroup[] {
  const groups = new Map<string, FileItem[]>();
  for (const file of files) {
    const folder = file.path.includes("/") ? file.path.split("/")[0] || "Root" : "Root";
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups.entries()].map(([folder, groupFiles]) => ({ folder, files: groupFiles }));
}

function displayFileName(filePath: string) {
  return filePath.includes("/") ? filePath.split("/").slice(1).join("/") : filePath;
}

function diagnosticSummary(document: AgentMarkdownDocument) {
  const errors = document.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = document.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  const info = document.diagnostics.filter((diagnostic) => diagnostic.severity === "info").length;
  const problems = [errors ? `${errors} errors` : "", warnings ? `${warnings} warnings` : ""].filter(Boolean).join(" · ");
  return `${document.nodes.length} nodes${problems ? ` · ${problems}` : ""}${info ? ` · ${info} info` : ""}`;
}

function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop();
  const className = "tree-icon file-icon";
  if (ext === "json" || ext === "geojson") return <Braces aria-hidden className={className} />;
  if (ext === "csv" || ext === "tsv") return <Table2 aria-hidden className={className} />;
  if (ext === "md") return <FileText aria-hidden className={className} />;
  return <FileCode aria-hidden className={className} />;
}

function Status({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) return <span className="status error-dot" aria-label="Has errors" />;
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) return <span className="status warning-dot" aria-label="Has warnings" />;
  return <span className="status ok-dot" aria-label="Valid" />;
}

if (typeof document !== "undefined") createRoot(document.getElementById("root")!).render(<App />);
