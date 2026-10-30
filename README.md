# KoiCode AI

Cyberpunk-themed, local-first autonomous coding workspace. This repository currently contains **V0.1 UI foundation** only.

## Current V0.1 features
- Responsive cyberpunk dashboard for desktop and Android browsers.
- Navigation shell for Dashboard, Projects, AI Assistant, Agent Tasks, Code Editor, Model Center, GitHub Link, and Settings.
- Browser capability scan for WebGPU, WebAssembly, device-memory hint, and hardware concurrency.
- Honest offline/placeholder states: no simulated AI responses, fake repositories, or pretend agent execution.
- GitHub Pages deployment workflow.

## Not implemented yet
- Local model runtime and adaptive model selection (planned V0.4).
- GitHub token authentication and repository operations (planned V0.2).
- Project file explorer/editor (planned V0.3).
- Autonomous planning, file edits, testing, and review (planned V0.6+).

## Run locally
Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages
1. Push this repository to a GitHub account on branch `main`.
2. Open **Settings → Pages**.
3. Set the build and deployment source to **GitHub Actions**.
4. Run the `Deploy KoiCode to GitHub Pages` workflow or push to `main`.

## Security principles
- Never commit GitHub tokens, API keys, or credentials.
- V0.1 does not request or store GitHub credentials.
- Future GitHub access must use least-privilege permissions and explicit confirmation before writes.
- Future code preview/execution must be isolated from the app origin and credential-bearing context.

## Device note
A WebGPU API presence check is not proof that a specific model will fit or run well. Android browsers may not expose physical RAM. Model loading must wait for runtime-specific compatibility and memory checks.