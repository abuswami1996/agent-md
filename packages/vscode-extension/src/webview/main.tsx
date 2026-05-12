import React from "react";
import { createRoot } from "react-dom/client";
import { AgentMarkdownRenderer } from "@agent-md/renderer-react";
import type { AgentMarkdownDocument } from "@agent-md/schema";
import "./style.css";

declare global {
  interface Window {
    agentMarkdownDocument: AgentMarkdownDocument;
    agentMarkdownSource: string;
  }
}

function App() {
  const document = window.agentMarkdownDocument;
  const diagnostics = document?.diagnostics ?? [];
  return <main className="agent-md-vscode-preview"><header><div><h1>{document?.frontmatter?.title ? String(document.frontmatter.title) : document?.sourcePath}</h1><p>{document?.nodes.length ?? 0} nodes · {diagnostics.length} diagnostics</p></div></header>{diagnostics.length ? <section className="diagnostics" aria-label="Diagnostics">{diagnostics.map((diagnostic, index) => <p key={index} className={diagnostic.severity}><strong>{diagnostic.severity}</strong> {diagnostic.message}</p>)}</section> : null}<AgentMarkdownRenderer document={document} /></main>;
}

createRoot(document.getElementById("root")!).render(<App />);
