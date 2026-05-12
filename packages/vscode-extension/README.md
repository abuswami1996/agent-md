# Agent Markdown Preview

Agent Markdown Preview adds an in-editor preview for `.agent.md` and `.amd.md` files in VSCode and Cursor.

Agent Markdown is a local-first Markdown format for interactive documents with charts, metrics, tables, maps, diagrams, tabs, callouts, queries, forms, and local artifact references. It gives coding agents a compact syntax for data-rich context without requiring generated HTML, arbitrary JavaScript, or a full web app.

## Features

- `Agent Markdown: Open Preview` command.
- `Cmd+Shift+V` on macOS for `.agent.md` and `.amd.md` files.
- `Ctrl+Shift+V` on Windows and Linux for `.agent.md` and `.amd.md` files.
- Preview opens in the active editor group.
- Uses the shared Agent Markdown parser, resolver, and React renderer.
- Displays parser and resolver diagnostics inside the preview.
- Watches local document and referenced file changes.

## Security

The extension is designed for local workspace preview:

- Remote data references are blocked by the runtime.
- File reads are restricted to the current workspace root and checked with realpath resolution.
- Diagram source files are extension- and size-limited.
- Webview resources are limited to extension assets.
- The webview uses a Content Security Policy.
- Raw HTML execution and arbitrary document JavaScript are not supported.

## Usage

Open a `.agent.md` or `.amd.md` file, then run:

```text
Agent Markdown: Open Preview
```

You can also use the preview keybinding while an Agent Markdown file is focused.

## CLI Pairing

Install and initialize the CLI in a project:

```bash
npm install agent-md
npx agent-md init --agent cursor
```

The CLI installs the project-local agent skill, schema, config, examples, and editor recommendations.

## Known Limitations

- This MVP does not replace VSCode's built-in Markdown preview provider.
- Custom components render as placeholders unless explicitly enabled by future runtime support.
- Diagram rendering uses Mermaid and is intentionally conservative.
