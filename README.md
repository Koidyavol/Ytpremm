# KoiCode AI

Cyberpunk-themed, local-first coding workspace. Current release: **V0.5 — Local AI Assistant**.

## V0.5 local AI
- Runs `onnx-community/Qwen2.5-Coder-0.5B-Instruct` through Transformers.js in a dedicated browser worker.
- Uses 4-bit quantization (`q4`). Attempts WebGPU when exposed by the browser; falls back to the WASM/CPU runtime if WebGPU is unavailable or initialization fails.
- First model load downloads model files from Hugging Face. Model inference and prompts run in the browser; prompts and project code are not sent to an AI cloud service.
- Optional context includes only the currently open workspace file, limited to 10,000 characters. Unsaved editor text is used when available.
- Chat history stays in memory for the current page session.
- No cloud fallback, automatic file modification, terminal execution, or remote commit.

### Device notes
- This is an experimental small-model path, not a guarantee of useful performance on every phone.
- 0.5B parameters with q4 reduces model size but does not equal total runtime memory. Browser, ONNX runtime, context, and GPU allocations need additional memory.
- A device with 4 GB RAM may load slowly, run slowly, or have the browser terminate the tab. The model is not loaded automatically; the user must confirm the first download.
- The first download requires internet and may use hundreds of megabytes of data. Actual download size depends on model files and selected backend.
- WebGPU availability is browser/device dependent. WASM fallback is slower and can still exceed memory limits.
- The model may produce incorrect code. Review every suggestion before using it.

## V0.4 GitHub read-only integration
- Connect GitHub with a manually supplied fine-grained Personal Access Token.
- Read accessible repositories, list text files, preview and import files to local workspace.
- Token exists only in page memory; it is not persisted.
- No remote write or push permissions are used by the app.

## V0.3 local workspace
- Import a project folder or individual text files.
- Search and open files, create files, edit text, save to IndexedDB, download files, and export a JSON backup.

## Security and privacy
- Never paste a GitHub token into chat or source files. Use the least privilege read-only token.
- Imported code is processed in the browser. GitHub file reads require the connected GitHub token.
- Model weights are fetched from Hugging Face on first use. Chat prompts and local code context are not uploaded by this app.
- Browser extensions or a compromised device can still inspect page memory.
- Clearing browser site data may remove the local workspace and cached model files.

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
