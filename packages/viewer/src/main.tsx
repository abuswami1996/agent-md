import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Braces, FileCode, FileText, FolderOpen, Table2 } from "lucide-react";
import { AgentMarkdownRenderer } from "@agent-md/renderer-react";
import type { AgentMarkdownDocument, Diagnostic } from "@agent-md/schema";
import "./style.css";

type FileItem = { path: string; diagnostics: Diagnostic[] };
type FileGroup = { folder: string; files: FileItem[] };

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<string>();
  const [document, setDocument] = useState<AgentMarkdownDocument>();
  const [source, setSource] = useState<string>();
  const [mode, setMode] = useState<"rendered" | "source">("rendered");
  const groups = useMemo(() => groupFiles(files), [files]);
  useEffect(() => { loadFiles(); const ws = new WebSocket(`ws://${location.host}/ws`); ws.onmessage = () => { loadFiles(); if (selected) loadDocument(selected); }; return () => ws.close(); }, [selected]);
  async function loadFiles() {
    const response = await fetch("/api/files").then((res) => res.json());
    setFiles(response.files);
    if (!selected && response.files[0]) loadDocument(response.files[0].path);
    if (selected && !response.files.some((file: FileItem) => file.path === selected) && response.files[0]) loadDocument(response.files[0].path);
  }
  async function loadDocument(file: string) {
    setSelected(file); setMode("rendered");
    setDocument(await fetch(`/api/document?file=${encodeURIComponent(file)}`).then((res) => res.json()));
    setSource(await fetch(`/api/source?file=${encodeURIComponent(file)}`).then((res) => res.json()).then((data) => data.source));
  }
  return <div className="app-frame"><div className="browser-shell"><aside className="file-sidebar" aria-label="Project files"><div className="sidebar-strip">Files ({files.length})</div><div className="file-tree">{groups.map((group) => <section className="folder-group" key={group.folder}><div className="folder-row"><FolderOpen aria-hidden className="tree-icon folder-icon" /><div><div className="folder-name">{group.folder}</div><div className="folder-count">{group.files.length} files</div></div></div><ul>{group.files.map((file) => <li key={file.path}><button type="button" title={file.path} className={file.path === selected ? "file-row active" : "file-row"} onClick={() => loadDocument(file.path)}><FileIcon path={file.path} /><span>{file.path.split("/").slice(1).join("/") || file.path}</span><Status diagnostics={file.diagnostics} /></button></li>)}</ul></section>)}</div></aside><main className="preview-pane"><div className="preview-header"><div><h3>{selected ?? "Select a file"}</h3>{document ? <p>{document.nodes.length} nodes · {document.diagnostics.length} diagnostics</p> : <p>Agent Markdown preview</p>}</div><button className="mode-button" type="button" onClick={() => setMode(mode === "rendered" ? "source" : "rendered")}>{mode === "rendered" ? "Source" : "Rendered"}</button></div><div className="preview-body">{mode === "source" ? <pre>{source}</pre> : document ? <AgentMarkdownRenderer document={document} /> : <p className="empty-state">Choose a file from the tree.</p>}</div>{document?.diagnostics.length ? <div className="diagnostics-panel" aria-label="Diagnostics">{document.diagnostics.map((diagnostic, index) => <p key={index} className={diagnostic.severity}>{diagnostic.severity}: {diagnostic.message}</p>)}</div> : null}</main></div></div>;
}

function groupFiles(files: FileItem[]): FileGroup[] {
  const groups = new Map<string, FileItem[]>();
  for (const file of files) {
    const folder = file.path.split("/")[0] || ".";
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  }
  return [...groups.entries()].map(([folder, groupFiles]) => ({ folder, files: groupFiles }));
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

createRoot(document.getElementById("root")!).render(<App />);
