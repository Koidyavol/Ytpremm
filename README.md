# KoiCode AI

Cyberpunk-themed, local-first coding workspace. Current release: **V0.3 — Local Code Editor & Workspace**.

## V0.3 features
- Responsive cyberpunk UI for desktop and Android browsers.
- Import a project folder using the browser folder picker, or add individual text files.
- File explorer with search and file selection.
- Plain-text code editor with line numbers and cursor position.
- Create new files, save edits to browser IndexedDB, and download the selected file.
- Export the local workspace as a JSON backup.
- Import filtering skips common generated folders, unsupported file types, and files larger than 1 MB.
- Browser capability scan for WebGPU, WebAssembly, memory hint, and hardware concurrency.
- No fake AI responses, fake repository sync, or pretend agent execution.

## Important V0.3 limitations
- This is a local browser workspace, not a full IDE. The editor is plain text; syntax highlighting and terminal execution are not included.
- Files are stored in the current browser profile on this device. Clearing browser site data may remove the local workspace.
- Changes are **not** pushed to GitHub. GitHub integration remains a separate planned milestone.
- Folder import depends on browser support for the directory picker. Individual file import is also available.

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

## Security and device notes
- Never commit GitHub tokens, API keys, or credentials.
- V0.3 does not request GitHub credentials and does not upload imported files.
- Keep projects modest in size on low-memory Android devices. Import is limited to 180 files, 1 MB per file, and skips common generated folders such as `node_modules`, `.git`, and `dist`.
- WebGPU availability does not guarantee that a specific local AI model can fit or run.
