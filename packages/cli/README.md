# agent-md

`agent-md` is the command line runtime for Agent Markdown, a local-first Markdown format for interactive, data-rich documents authored by humans and coding agents.

## Install

```bash
npm install agent-md
```

## Initialize a Project

```bash
npx agent-md init --agent cursor
```

This creates local configuration, an agent skill file, schema metadata, starter examples, and VSCode/Cursor extension recommendations for `AbhinavSwaminathan.agent-md-preview`.

Install the published editor extension:

```bash
cursor --install-extension AbhinavSwaminathan.agent-md-preview
```

Marketplace listing:
[Agent Markdown Preview](https://marketplace.visualstudio.com/items?itemName=AbhinavSwaminathan.agent-md-preview)

## Commands

```bash
npx agent-md validate
npx agent-md serve
npx agent-md export examples/example.agent.md --format json
npx agent-md vscode-extension
```

`npx agent-md vscode-extension` prints local VSIX install instructions when the CLI package includes a bundled extension. The Marketplace extension is the preferred install path for most users.

## Security

Agent Markdown is local-first. The CLI blocks remote data references, path traversal outside the project root, raw scripts, and HTML embeds by default. The local browser viewer binds to `localhost` by default.

See the project README for full documentation.
