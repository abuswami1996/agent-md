# Publishing Guide

This guide explains how to publish Agent Markdown professionally to npm and the Visual Studio Code Marketplace.

It assumes the repository keeps the current monorepo shape:

- npm CLI package: `packages/cli`, published as `agent-md`
- VSCode/Cursor extension package: `packages/vscode-extension`, published as `AbhinavSwaminathan.agent-md-preview`
- Root package: private workspace orchestrator, not published

Use this as a release runbook. Do not publish from a dirty working tree, an unreviewed branch, or a package whose metadata has not been finalized.

## Release Principles

Publish the extension and npm package as a single product release, but treat them as separate artifacts:

- The **VSCode extension** gives users the in-editor preview experience.
- The **npm package** gives users the `agent-md` CLI, project initialization, validation, browser viewer, generated agent skill, and optional bundled VSIX helper.

The recommended release order is:

1. Finalize metadata and package identity.
2. Run all verification locally.
3. Package and smoke test the VSCode extension.
4. Publish the VSCode extension.
5. Confirm the final extension ID.
6. Publish the npm CLI package.
7. Test the fresh user flow from a clean project.
8. Create a GitHub release with release notes and artifacts.

## One-Time Account Setup

### npm

Create or use an npm account with permission to publish `agent-md`.

Recommended account posture:

- Enable two-factor authentication.
- Prefer `auth-and-writes` 2FA for packages you publish manually.
- Use an npm organization if more than one maintainer will publish.
- Add trusted maintainers explicitly rather than sharing credentials.

Commands:

```bash
npm login
npm whoami
npm profile enable-2fa auth-and-writes
```

If you plan to publish from CI later, use npm trusted publishing or an automation token. For the first manual release, interactive publishing is simpler and easier to audit.

### Visual Studio Marketplace

Create a publisher in the Visual Studio Marketplace publisher portal:

```text
https://marketplace.visualstudio.com/manage/publishers/
```

You will need:

- A Microsoft account.
- A publisher ID.
- An Azure DevOps Personal Access Token with Marketplace publishing permissions.

The extension ID is derived from:

```text
<publisher>.<extension-name>
```

With the current manifest:

```text
AbhinavSwaminathan.agent-md-preview
```

If you change the publisher ID, update every place that recommends or references the extension ID, especially the CLI code that writes `.vscode/extensions.json`.

Login with `vsce`:

```bash
npx vsce login AbhinavSwaminathan
```

When prompted, paste the Personal Access Token.

## Pre-Release Metadata Checklist

Before publishing, make the packages look like public packages rather than local prototypes.

### Root `package.json`

The root package should remain private:

```json
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

Do not publish the root package.

### npm CLI Package

Review `packages/cli/package.json`.

Current package:

```text
name: agent-md
version: 0.1.0
bin: agent-md -> dist/index.js
```

Before first publish, confirm or add:

- `description`
- `license`
- `repository`
- `homepage`
- `bugs`
- `keywords`
- `author` or `contributors`
- `files`
- `bin`
- `engines`, if you want to declare supported Node versions

The `files` field should include only what users need:

```json
["dist", "viewer-dist", "agent-md-preview.vsix", "package.json", "README.md", "LICENSE"]
```

The package currently includes the built browser viewer and, when built after extension packaging, the bundled VSIX.

### VSCode Extension Package

Review `packages/vscode-extension/package.json`.

Current extension:

```text
name: agent-md-preview
publisher: AbhinavSwaminathan
displayName: Agent Markdown Preview
main: dist/extension.js
```

Before first publish, confirm or add:

- `description`
- `publisher`
- `version`
- `license`
- `repository`
- `homepage`
- `bugs`
- `categories`
- `keywords`
- `galleryBanner`, optional
- `icon`, strongly recommended
- `README.md`, strongly recommended for Marketplace listing
- `CHANGELOG.md`, strongly recommended

The Marketplace will warn if there is no license or repository. Treat those warnings as release blockers for a professional public release.

### README and Marketplace Content

The VSCode Marketplace listing is driven by the extension package content. The extension package should have its own README or include the root README in the packaged extension.

For a professional listing, include:

- Product summary.
- Screenshots or GIFs.
- Installation steps.
- Usage instructions.
- Keybindings.
- Security/local-first note.
- Known limitations.
- Links to repository, issues, and documentation.

## Versioning Strategy

Use semantic versioning.

For an initial MVP:

```text
0.1.0
```

Recommended version policy:

- Patch release: bug fixes, packaging fixes, documentation fixes.
- Minor release: new primitives, new CLI commands, new renderer features.
- Major release: syntax-breaking changes, config-breaking changes, or incompatible document model changes.

Keep the npm CLI and VSCode extension versions aligned when they ship together. For example:

```text
agent-md npm package: 0.1.0
agent-md-preview extension: 0.1.0
git tag: v0.1.0
```

## Local Release Verification

Run this from the repository root:

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Package the extension:

```bash
npm run package -w agent-md-preview
```

Rebuild the CLI after packaging the extension so the latest VSIX is copied into `packages/cli`:

```bash
npm run build -w agent-md
```

Confirm the expected artifacts exist:

```bash
test -f packages/vscode-extension/dist/agent-md-preview.vsix
test -f packages/cli/agent-md-preview.vsix
test -f packages/cli/dist/index.js
test -d packages/cli/viewer-dist
```

Inspect the npm package contents:

```bash
npm pack --dry-run -w agent-md
```

Inspect the VSCode extension package contents:

```bash
npm run ls:vsix -w agent-md-preview
```

You should only see the extension manifest, Marketplace docs/assets, license, changelog, and built `dist` runtime assets. You should not see source-only files, `.env` files, local secrets, large unrelated folders, `node_modules`, `.git`, tests, root lockfiles, nested VSIX files, or monorepo internals.

## Manual Smoke Tests Before Publishing

Use a clean temporary project. Do not test only inside this repository.

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
npm init -y
npm install /Users/abuswami/Desktop/test-news-openai/packages/cli
npx agent-md init --agent cursor
npx agent-md validate
npx agent-md vscode-extension
```

Verify:

- `agent-md.config.json` exists.
- `.agent-md/skill.md` exists.
- `.vscode/extensions.json` recommends the extension ID.
- `examples/example.agent.md` exists.
- `npx agent-md validate` succeeds.
- `npx agent-md serve --no-open` starts the browser viewer.
- `npx agent-md vscode-extension` points to a bundled VSIX.

Install the local VSIX:

```bash
cursor --install-extension "/Users/abuswami/Desktop/test-news-openai/packages/cli/agent-md-preview.vsix" --force
```

Reload Cursor or VSCode and verify:

- `Agent Markdown: Open Preview` appears in the command palette.
- `Cmd+Shift+V` opens the Agent Markdown preview on macOS for `.agent.md` files.
- `Ctrl+Shift+V` opens it on Windows/Linux for `.agent.md` files.
- The preview opens in the active editor group.
- Charts, maps, diagrams, tabs, tables, callouts, metrics, embeds, and diagnostics render.

Use the comprehensive example:

```text
packages/examples/fixtures/full-interactive-dashboard.agent.md
```

## Publish the VSCode Extension

Publish the extension first so the npm package can recommend a real Marketplace extension ID.

From the repository root:

```bash
npm run package -w agent-md-preview
```

Optionally install and smoke test the generated VSIX one more time:

```bash
cursor --install-extension "packages/vscode-extension/dist/agent-md-preview.vsix" --force
```

Publish with the safe package script. The script uses `--no-dependencies`; do not publish with raw `npx vsce publish`, because raw VSCE workspace dependency traversal can include monorepo internals.

```bash
npm run publish:marketplace -w agent-md-preview
```

If you prefer passing a token explicitly:

```bash
npm run build -w agent-md-preview
cd packages/vscode-extension
node scripts/remove-local-vsix.mjs
npx vsce publish --no-dependencies -p <AZURE_DEVOPS_PAT>
cd ../..
```

After publishing:

1. Open the Marketplace listing.
2. Confirm the extension ID.
3. Confirm the README renders correctly.
4. Confirm the command, keybinding, and categories appear as expected.
5. Install from the Marketplace in a clean VSCode or Cursor profile.

If the final extension ID is not `AbhinavSwaminathan.agent-md-preview`, update the CLI recommendation before publishing npm.

## Publish to Open VSX, Optional

The Visual Studio Marketplace is the standard path for VSCode. Some editor distributions use Open VSX.

If you want broader compatibility, publish the same VSIX to Open VSX:

```bash
npx ovsx publish packages/vscode-extension/dist/agent-md-preview.vsix -p <OPEN_VSX_TOKEN>
```

This step is optional. If you support it, document both Marketplace and Open VSX install paths.

## Publish the npm Package

Return to the repository root.

Run final verification:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run package -w agent-md-preview
npm run build -w agent-md
npm pack --dry-run -w agent-md
```

Publish the CLI package:

```bash
npm publish -w agent-md --access public
```

If your npm account requires a one-time password:

```bash
npm publish -w agent-md --access public --otp <OTP>
```

For a prerelease or beta:

```bash
npm publish -w agent-md --access public --tag beta
```

For a stable release, use the default `latest` tag or specify it explicitly:

```bash
npm publish -w agent-md --access public --tag latest
```

## Post-Publish npm Smoke Test

Test from a clean directory using the published package, not the local package path:

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
npm init -y
npm install agent-md
npx agent-md init --agent cursor
npx agent-md validate
npx agent-md serve --no-open
```

In another terminal, or after stopping the server, check the extension helper:

```bash
npx agent-md vscode-extension
```

Verify:

- npm installs without workspace dependency errors.
- `npx agent-md` runs.
- Project initialization creates all expected files.
- `.vscode/extensions.json` recommends the published extension ID.
- The browser viewer can start.
- The extension helper behaves as expected.

## GitHub Release

After both registries are live, create a GitHub release.

Recommended release contents:

- Tag: `v0.1.0`
- Title: `Agent Markdown v0.1.0`
- Summary of the CLI package.
- Summary of the VSCode/Cursor extension.
- Installation commands.
- Breaking changes, if any.
- Known limitations.
- Links to npm and VSCode Marketplace.
- Attach `packages/vscode-extension/dist/agent-md-preview.vsix` as a release asset if you want manual installation support.

Suggested commands:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then create the release in GitHub.

## Professional Release Checklist

Before publishing:

- Working tree is clean.
- Release branch is reviewed.
- Package versions are correct and aligned.
- Root package remains private.
- npm package metadata is complete.
- extension package metadata is complete.
- License exists.
- README exists and renders well.
- CHANGELOG exists.
- VSCode extension icon exists.
- No secrets or `.env` files are included.
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` passes.
- VSIX packaging succeeds.
- npm dry run contents are correct.
- VSIX contents are correct.
- Local clean-project smoke test passes.

During publishing:

- Publish VSCode extension first.
- Confirm Marketplace extension ID.
- Publish npm package second.
- Use `latest` only for stable releases.
- Use `beta`, `alpha`, or `next` for prereleases.

After publishing:

- Install from npm in a clean project.
- Install extension from Marketplace.
- Run `agent-md init --agent cursor`.
- Open an `.agent.md` file.
- Run `Agent Markdown: Open Preview`.
- Confirm `Cmd+Shift+V` or `Ctrl+Shift+V` works.
- Confirm browser viewer fallback works.
- Create GitHub release.
- Announce package names and install commands.

## Rollback and Recovery

### npm

npm versions are immutable. You cannot overwrite a published version.

If a release is bad:

1. Publish a patch version with the fix.
2. Optionally deprecate the bad version.

```bash
npm deprecate agent-md@0.1.0 "This release has a packaging issue. Please upgrade to 0.1.1."
```

Avoid unpublishing unless the release contains secrets or legal issues. Unpublishing can break users.

### VSCode Marketplace

If the extension release is bad:

1. Fix the issue.
2. Bump the extension version.
3. Package and publish the new version.
4. Update Marketplace release notes.

Users will receive the update through the normal extension update flow.

## Recommended First Public Release Flow

For this repository's first public release, use this exact order:

```bash
# 1. Verify
npm install
npm test
npm run typecheck
npm run lint
npm run build

# 2. Package extension
npm run package -w agent-md-preview

# 3. Rebuild CLI so the latest VSIX is bundled
npm run build -w agent-md

# 4. Inspect artifacts
npm pack --dry-run -w agent-md
npm run ls:vsix -w agent-md-preview

# 5. Publish extension
npm run publish:marketplace -w agent-md-preview

# 6. Publish npm package
npm publish -w agent-md --access public

# 7. Smoke test published package
tmpdir="$(mktemp -d)"
cd "$tmpdir"
npm init -y
npm install agent-md
npx agent-md init --agent cursor
npx agent-md validate
```

Stop and fix issues at the first failing step. Do not continue a release after a failed verification, unexpected package contents, or a mismatched extension ID.
