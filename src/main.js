const views = [...document.querySelectorAll(".view")];
const navItems = [...document.querySelectorAll(".nav-item")];
const crumb = document.querySelector("#crumb");

function showView(name) {
  views.forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  navItems.forEach(item => item.classList.toggle("active", item.dataset.view === name));
  crumb.textContent = name.replaceAll("-", " ").toUpperCase();
  document.querySelector("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
navItems.forEach(item => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showView(button.dataset.go)));
document.querySelector("#mobileMenu").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));

function setStatus(id, text, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = state;
}
async function scanCapabilities() {
  setStatus("gpuStatus", "Scanning…", "pending");
  setStatus("wasmStatus", "Scanning…", "pending");
  setStatus("memoryStatus", "Scanning…", "pending");
  setStatus("cpuStatus", "Scanning…", "pending");
  const gpuAvailable = !!navigator.gpu;
  setStatus("gpuStatus", gpuAvailable ? "API available" : "Not available", gpuAvailable ? "good" : "bad");
  const wasmAvailable = typeof WebAssembly === "object";
  setStatus("wasmStatus", wasmAvailable ? "Available" : "Unavailable", wasmAvailable ? "good" : "bad");
  const memory = navigator.deviceMemory;
  setStatus("memoryStatus", memory ? `Browser hint: ${memory} GB` : "Not exposed by browser", memory && memory >= 4 ? "good" : "pending");
  const cores = navigator.hardwareConcurrency;
  setStatus("cpuStatus", cores ? `${cores} logical cores` : "Not exposed", cores && cores >= 4 ? "good" : "pending");
  if (gpuAvailable) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      setStatus("gpuStatus", adapter ? "Adapter detected" : "API present, no adapter", adapter ? "good" : "bad");
    } catch { setStatus("gpuStatus", "Adapter check failed", "bad"); }
  }
}
document.querySelector("#rescan").addEventListener("click", scanCapabilities);
scanCapabilities();

// Local workspace: files remain on this device and are never uploaded automatically.
const DB_NAME = "koicode-workspace";
const DB_VERSION = 1;
const STORE = "files";
const MAX_FILES = 180;
const MAX_FILE_BYTES = 1024 * 1024;
const blockedFolders = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache"]);
const textExtensions = new Set(["html","htm","css","scss","js","mjs","cjs","ts","tsx","jsx","json","md","txt","yml","yaml","xml","svg","py","java","kt","kts","gradle","properties","toml","ini","sh","bat","sql","go","rs","php","vue","svelte","dart","c","h","cpp","hpp","cs","rb","env","gitignore","editorconfig"]);
let db;
let workspace = new Map();
let activePath = "";
let dirty = false;

const $ = id => document.getElementById(id);
const folderInput = $("folderInput");
const filesInput = $("filesInput");
const codeEditor = $("codeEditor");

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB tidak tersedia di browser ini."));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "path" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Gagal membuka penyimpanan lokal."));
  });
}
function storeTransaction(mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let request;
    try { request = action(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error || new Error("Penyimpanan gagal."));
    tx.onabort = () => reject(tx.error || new Error("Penyimpanan dibatalkan."));
  });
}
async function persistFile(file) {
  await storeTransaction("readwrite", store => store.put(file));
  workspace.set(file.path, file);
}
async function removeStoredFile(path) {
  await storeTransaction("readwrite", store => store.delete(path));
  workspace.delete(path);
}
function notify(message) {
  const status = $("editState");
  if (status) status.textContent = message;
}
function extension(path) {
  const name = path.split("/").pop() || "";
  if (name.startsWith(".") && !name.slice(1).includes(".")) return name.slice(1).toLowerCase();
  return (name.split(".").pop() || "").toLowerCase();
}
function languageName(path) {
  const map = { js:"JAVASCRIPT", mjs:"JAVASCRIPT", ts:"TYPESCRIPT", html:"HTML", htm:"HTML", css:"CSS", json:"JSON", md:"MARKDOWN", py:"PYTHON", java:"JAVA", kt:"KOTLIN", xml:"XML", yml:"YAML", yaml:"YAML", sh:"SHELL", sql:"SQL", svg:"SVG" };
  return map[extension(path)] || "PLAIN TEXT";
}
function safePath(path) {
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = clean.split("/");
  return parts.length && parts.every(part => part && part !== "." && part !== "..") ? clean : "";
}
function updateCounters() {
  $("fileCount").textContent = `${workspace.size} FILES`;
  $("projectCount").textContent = workspace.size;
  $("workspaceName").textContent = workspace.size ? "LOCAL PROJECT" : "NO FOLDER OPENED";
}
function renderTree() {
  const query = $("fileSearch").value.trim().toLowerCase();
  const list = [...workspace.keys()].filter(path => path.toLowerCase().includes(query)).sort((a,b) => a.localeCompare(b));
  const tree = $("fileTree");
  tree.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = workspace.size ? "No matching files." : "Import a folder to see its files.";
    tree.append(empty);
  }
  for (const path of list) {
    const button = document.createElement("button");
    button.className = "file-item" + (path === activePath ? " selected" : "");
    button.type = "button";
    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.textContent = fileIcon(path);
    const label = document.createElement("span");
    label.textContent = path;
    label.title = path;
    button.append(icon, label);
    button.addEventListener("click", () => openFile(path));
    tree.append(button);
  }
  updateCounters();
}
function fileIcon(path) {
  const ext = extension(path);
  if (["html","htm"].includes(ext)) return "◇";
  if (["js","mjs","ts","tsx","jsx"].includes(ext)) return "JS";
  if (["css","scss"].includes(ext)) return "#";
  if (["json","yml","yaml","toml"].includes(ext)) return "{}";
  if (["md","txt"].includes(ext)) return "≡";
  return "·";
}
function renderEditor() {
  const file = workspace.get(activePath);
  const hasFile = !!file;
  $("editorEmpty").hidden = hasFile;
  $("codeArea").hidden = !hasFile;
  codeEditor.disabled = !hasFile;
  $("downloadFile").disabled = !hasFile;
  $("saveFile").disabled = !hasFile || !dirty;
  $("activeTab").textContent = hasFile ? activePath : "NO FILE OPEN";
  $("languageLabel").textContent = hasFile ? languageName(activePath) : "PLAIN TEXT";
  if (!hasFile) {
    codeEditor.value = "";
    $("lineNumbers").textContent = "1";
    notify("READY");
    return;
  }
  codeEditor.value = file.content;
  updateLineNumbers();
  notify(dirty ? "UNSAVED CHANGES" : "SAVED");
  renderTree();
}
function openFile(path) {
  if (!workspace.has(path)) return;
  activePath = path;
  dirty = false;
  renderEditor();
  renderTree();
}
function updateLineNumbers() {
  const count = codeEditor.value.split("\n").length;
  $("lineNumbers").textContent = Array.from({length:count}, (_,i) => i + 1).join("\n");
  $("cursorInfo").textContent = `Ln ${codeEditor.value.slice(0,codeEditor.selectionStart).split("\n").length}, Col ${(codeEditor.selectionStart - codeEditor.value.lastIndexOf("\n", codeEditor.selectionStart - 1))}`;
}
async function saveActiveFile() {
  if (!activePath || !workspace.has(activePath)) return;
  const current = workspace.get(activePath);
  const next = {...current, content:codeEditor.value, updatedAt:Date.now()};
  try {
    await persistFile(next);
    dirty = false;
    notify("SAVED LOCALLY");
    $("saveFile").disabled = true;
  } catch (error) { notify("SAVE FAILED"); alert(error.message); }
}
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.split("/").pop() || "download.txt";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function importFileList(fileList, folderMode) {
  const files = [...fileList];
  if (!files.length) return;
  const accepted = [];
  const skipped = [];
  for (const file of files) {
    const rawPath = folderMode ? (file.webkitRelativePath || file.name) : file.name;
    const path = safePath(rawPath);
    const segments = path.split("/");
    if (!path || segments.some(part => blockedFolders.has(part))) { skipped.push(file.name); continue; }
    const ext = extension(path);
    if (!textExtensions.has(ext) && !path.startsWith(".")) { skipped.push(file.name); continue; }
    if (file.size > MAX_FILE_BYTES) { skipped.push(file.name); continue; }
    accepted.push({file,path});
    if (accepted.length >= MAX_FILES) break;
  }
  (async () => {
    let added = 0;
    for (const item of accepted) {
      try {
        const content = await item.file.text();
        const record = {path:item.path,content,updatedAt:Date.now(),size:item.file.size};
        await persistFile(record);
        added++;
      } catch { skipped.push(item.path); }
    }
    const first = accepted.find(item => workspace.has(item.path));
    if (first) openFile(first.path);
    renderTree();
    notify(`IMPORTED ${added} FILES`);
    if (skipped.length) alert(`Imported ${added} files. Skipped ${skipped.length} unsupported, large, or restricted files.`);
  })();
}
async function createNewFile() {
  const entered = prompt("Nama file baru (contoh: src/app.js):");
  if (!entered) return;
  const path = safePath(entered.trim());
  if (!path) return alert("Path file tidak valid.");
  if (workspace.has(path)) return alert("File tersebut sudah ada.");
  const file = {path,content:"",updatedAt:Date.now(),size:0};
  try { await persistFile(file); openFile(path); renderTree(); codeEditor.focus(); }
  catch (error) { alert(error.message); }
}
async function exportWorkspace() {
  if (!workspace.size) return alert("Workspace masih kosong.");
  if (dirty) await saveActiveFile();
  const payload = {app:"KoiCode AI",formatVersion:1,exportedAt:new Date().toISOString(),files:[...workspace.values()]};
  downloadBlob("koicode-workspace.json", new Blob([JSON.stringify(payload,null,2)], {type:"application/json"}));
}
async function loadWorkspace() {
  try {
    db = await openDatabase();
    const records = await new Promise((resolve,reject) => {
      const request = db.transaction(STORE,"readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    records.forEach(file => workspace.set(file.path,file));
    renderTree();
    if (records.length) openFile(records.sort((a,b) => a.path.localeCompare(b.path))[0].path);
  } catch (error) {
    notify("LOCAL STORAGE UNAVAILABLE");
    $("editorEmpty").querySelector("p").textContent = error.message + " Coba buka melalui browser modern.";
  }
}
$("importFolder").addEventListener("click", () => folderInput.click());
$("emptyImport").addEventListener("click", () => folderInput.click());
$("importFiles").addEventListener("click", () => filesInput.click());
folderInput.addEventListener("change", event => { importFileList(event.target.files,true); event.target.value=""; });
filesInput.addEventListener("change", event => { importFileList(event.target.files,false); event.target.value=""; });
$("newFile").addEventListener("click", createNewFile);
$("fileSearch").addEventListener("input", renderTree);
$("saveFile").addEventListener("click", saveActiveFile);
$("downloadFile").addEventListener("click", () => {
  if (!activePath) return;
  downloadBlob(activePath, new Blob([codeEditor.value],{type:"text/plain;charset=utf-8"}));
});
$("exportWorkspace").addEventListener("click", exportWorkspace);
codeEditor.addEventListener("input", () => {
  dirty = true;
  $("saveFile").disabled = false;
  notify("UNSAVED CHANGES");
  updateLineNumbers();
});
codeEditor.addEventListener("click", updateLineNumbers);
codeEditor.addEventListener("keyup", updateLineNumbers);
codeEditor.addEventListener("scroll", () => { $("lineNumbers").scrollTop = codeEditor.scrollTop; });
loadWorkspace();