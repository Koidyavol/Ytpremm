# KoiCode AI

Cyberpunk-themed, local-first coding workspace. Current release: **V0.4 — GitHub Read-only Integration**.

## V0.4 features
- Connect a GitHub account using a manually supplied Personal Access Token (PAT).
- Load up to 100 accessible repositories and choose one to browse.
- Browse the default branch's text files, search paths, and preview file contents.
- Import a selected remote file into the local V0.3 Workspace.
- Read-only GitHub API integration: no remote edits, commits, pushes, or settings changes.
- Token is held only in JavaScript memory for the active page session; it is not written to localStorage, IndexedDB, source code, or exported workspace backups.
- Disconnect clears the in-memory token. Reloading or leaving the page also clears it.
- Existing local folder import, editor, IndexedDB save, download, and workspace JSON export remain available.

## GitHub token setup
Create a fine-grained Personal Access Token on GitHub. Grant access only to the repositories you intend to browse:
- Repository permissions: **Contents — Read-only**
- Metadata: **Read-only** (required by GitHub)

Paste the token in GitHub Link. Never share the token in chat, commit it, or paste it into source files. Avoid using a token with write permissions for this read-only milestone.

## Limits and safety
- GitHub integration is read-only. Importing a file copies its content into this browser's local workspace; it does not change GitHub.
- Token is held in page memory only. A browser extension or compromised device can still inspect page memory; use a narrowly scoped token and revoke it from GitHub when no longer needed.
- Browser workspace data is local to the current browser profile and may be removed if site data is cleared.
- Repository tree is capped to 500 supported text files; files larger than 1 MB are skipped.
- The editor is plain text; no syntax highlighting, terminal, or local AI inference yet.
- WebGPU availability does not guarantee a local AI model will fit or run.

## V0.3 workspace
- Import a project folder or individual text files.
- Search and open files in the file explorer.
- Create files, edit text, save locally to IndexedDB, download the selected file, and export a workspace JSON backup.

## Run locally
Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```
