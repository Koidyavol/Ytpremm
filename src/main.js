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

// GitHub integration V0.4 — read-only. Token exists only in this page's JS memory.
let githubToken = "";
let githubRepos = [];
let selectedRepo = null;
let selectedRepoFile = null;
let repoFiles = [];
const githubApi = "https://api.github.com";
const githubTextExtensions = new Set(["html","htm","css","scss","js","mjs","cjs","ts","tsx","jsx","json","md","txt","yml","yaml","xml","svg","py","java","kt","kts","gradle","properties","toml","ini","sh","sql","go","rs","php","vue","svelte","dart","c","h","cpp","hpp","cs","rb","env"]);
const githubBlocked = new Set(["node_modules",".git","dist","build",".next",".cache"]);
const gh = id => document.getElementById(id);
function githubMessage(message, state="") {
  const el = gh("githubMessage");
  if (!el) return;
  el.textContent = message;
  el.className = "github-message " + state;
}
function githubHeaders() {
  return { "Accept":"application/vnd.github+json", "Authorization":`Bearer ${githubToken}`, "X-GitHub-Api-Version":"2022-11-28" };
}
async function githubRequest(path) {
  if (!githubToken) throw new Error("Connect GitHub terlebih dahulu.");
  const response = await fetch(githubApi + path, {headers:githubHeaders()});
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Token tidak valid atau sudah kedaluwarsa (401).");
    if (response.status === 403) throw new Error("Akses ditolak atau API rate limit tercapai (403). Periksa izin token.");
    if (response.status === 404) throw new Error("Repository atau file tidak ditemukan, atau token tidak memiliki akses.");
    throw new Error(data.message || `GitHub API error: ${response.status}`);
  }
  return data;
}
function updateGithubUi(connected) {
  gh("connectGithub").disabled = connected;
  gh("disconnectGithub").disabled = !connected;
  gh("refreshRepos").disabled = !connected;
  gh("repoSelect").disabled = !connected;
  gh("githubToken").disabled = connected;
  gh("githubConnectionState").textContent = connected ? "CONNECTED" : "DISCONNECTED";
  gh("githubConnectionTitle").textContent = connected ? "GitHub account connected" : "Connect your GitHub account";
}
async function connectGithub() {
  const token = gh("githubToken").value.trim();
  if (!token) return githubMessage("Paste your GitHub Personal Access Token first.", "error");
  if (!/^(github_pat_|gh[pousr]_|[a-f0-9]{40})/i.test(token)) return githubMessage("Format token tidak dikenali. Pastikan token berasal dari GitHub.", "error");
  githubToken = token;
  gh("connectGithub").disabled = true;
  githubMessage("Checking token and loading repositories…", "pending");
  try {
    const user = await githubRequest("/user");
    const repos = await githubRequest("/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100");
    githubRepos = repos.filter(repo => !repo.archived);
    const select = gh("repoSelect");
    select.replaceChildren();
    if (!githubRepos.length) {
      const option = document.createElement("option"); option.value=""; option.textContent="No accessible repositories"; select.append(option);
    }
    for (const repo of githubRepos) {
      const option = document.createElement("option");
      option.value = repo.full_name;
      option.textContent = `${repo.full_name}${repo.private ? " · private" : ""}`;
      select.append(option);
    }
    updateGithubUi(true);
    gh("githubConnectionTitle").textContent = `Connected as @${user.login}`;
    gh("repoSelect").disabled = !githubRepos.length;
    gh("loadRepo").disabled = !githubRepos.length;
    githubMessage(`Connected as @${user.login}. Loaded ${githubRepos.length} repositories. Token remains in page memory only.`, "success");
  } catch (error) {
    githubToken = "";
    gh("githubToken").value = "";
    updateGithubUi(false);
    gh("connectGithub").disabled = false;
    githubMessage(error.message, "error");
  }
}
function disconnectGithub() {
  githubToken = "";
  githubRepos = [];
  selectedRepo = null;
  selectedRepoFile = null;
  repoFiles = [];
  gh("githubToken").value = "";
  gh("repoSelect").replaceChildren(new Option("Connect GitHub first",""));
  gh("repoSummary").textContent = "No repository selected.";
  gh("repoFileTree").innerHTML = '<div class="tree-empty">Connect GitHub to browse files.</div>';
  gh("repoFileCount").textContent = "0";
  gh("repoPreviewName").textContent = "FILE PREVIEW";
  gh("repoPreviewContent").textContent = "Select a text file from the repository.";
  gh("importRepoFile").disabled = true;
  gh("loadRepo").disabled = true;
  gh("repoFileSearch").disabled = true;
  updateGithubUi(false);
  gh("connectGithub").disabled = false;
  githubMessage("Disconnected. Token cleared from page memory.", "success");
}
async function openGithubRepo() {
  if (!githubToken) return;
  const fullName = gh("repoSelect").value;
  const repo = githubRepos.find(item => item.full_name === fullName);
  if (!repo) return;
  selectedRepo = repo;
  selectedRepoFile = null;
  gh("loadRepo").disabled = true;
  gh("repoFileSearch").disabled = true;
  gh("repoFileTree").innerHTML = '<div class="tree-empty">Loading repository tree…</div>';
  gh("repoPreviewName").textContent = "FILE PREVIEW";
  gh("repoPreviewContent").textContent = "Select a text file from the repository.";
  gh("importRepoFile").disabled = true;
  try {
    const branch = repo.default_branch || "main";
    const tree = await githubRequest(`/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (tree.truncated) githubMessage("Repository tree is large; GitHub returned a partial file list.", "pending");
    repoFiles = (tree.tree || []).filter(item => item.type === "blob" && item.size <= 1048576 && item.path.split("/").every(part => !githubBlocked.has(part)) && githubTextExtensions.has((item.path.split(".").pop() || "").toLowerCase())).slice(0,500);
    gh("repoSummary").textContent = `${repo.full_name} · branch ${branch} · ${repo.private ? "Private" : "Public"} · ${repoFiles.length} text files listed`;
    gh("repoFileSearch").disabled = false;
    renderGithubFiles();
    githubMessage(`Loaded ${repoFiles.length} text files from ${repo.full_name}. Select a file to preview it.`, "success");
  } catch (error) {
    gh("repoFileTree").textContent = error.message;
    githubMessage(error.message, "error");
  } finally { gh("loadRepo").disabled = false; }
}
function renderGithubFiles() {
  const query = gh("repoFileSearch").value.trim().toLowerCase();
  const matches = repoFiles.filter(file => file.path.toLowerCase().includes(query));
  const tree = gh("repoFileTree");
  tree.replaceChildren();
  gh("repoFileCount").textContent = String(matches.length);
  if (!matches.length) {
    const empty=document.createElement("div"); empty.className="tree-empty"; empty.textContent="No matching text files."; tree.append(empty); return;
  }
  for (const file of matches) {
    const button=document.createElement("button");
    button.type="button";
    button.className="file-item" + (selectedRepoFile?.path === file.path ? " selected" : "");
    const icon=document.createElement("span"); icon.className="file-icon"; icon.textContent="◇";
    const label=document.createElement("span"); label.textContent=file.path; label.title=file.path;
    button.append(icon,label);
    button.addEventListener("click",()=>previewGithubFile(file));
    tree.append(button);
  }
}
async function previewGithubFile(file) {
  if (!selectedRepo || !githubToken) return;
  selectedRepoFile = file;
  gh("repoPreviewName").textContent = file.path;
  gh("repoPreviewContent").textContent = "Fetching file contents…";
  gh("importRepoFile").disabled = true;
  renderGithubFiles();
  try {
    const data = await githubRequest(`/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/contents/${file.path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(selectedRepo.default_branch || "main")}`);
    if (data.encoding !== "base64" || !data.content) throw new Error("GitHub returned an unsupported file format.");
    const binary = atob(data.content.replace(/\\s/g,""));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const content = new TextDecoder("utf-8",{fatal:false}).decode(bytes);
    selectedRepoFile = {...file,content};
    gh("repoPreviewContent").textContent = content.length > 60000 ? content.slice(0,60000) + "\n\n… preview truncated at 60,000 characters." : content;
    gh("importRepoFile").disabled = false;
  } catch (error) {
    gh("repoPreviewContent").textContent = error.message;
    githubMessage(error.message, "error");
  }
}
async function importGithubFile() {
  if (!selectedRepoFile?.content || !selectedRepo) return;
  const path = safePath(selectedRepoFile.path);
  if (!path) return githubMessage("File path rejected for safety.", "error");
  try {
    await persistFile({path,content:selectedRepoFile.content,updatedAt:Date.now(),size:new Blob([selectedRepoFile.content]).size,source:`github:${selectedRepo.full_name}`});
    renderTree();
    openFile(path);
    githubMessage(`Imported ${path} into local Workspace. Remote repository was not changed.`, "success");
    showView("editor");
  } catch (error) { githubMessage(error.message, "error"); }
}
gh("connectGithub").addEventListener("click", connectGithub);
gh("disconnectGithub").addEventListener("click", disconnectGithub);
gh("refreshRepos").addEventListener("click", async () => { if (githubToken) { githubRepos=[]; await connectGithubRefresh(); } });
async function connectGithubRefresh() {
  try {
    const repos=await githubRequest("/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100");
    githubRepos=repos.filter(repo=>!repo.archived);
    const select=gh("repoSelect"); select.replaceChildren();
    for(const repo of githubRepos){const option=document.createElement("option");option.value=repo.full_name;option.textContent=`${repo.full_name}${repo.private?" · private":""}`;select.append(option);}
    gh("repoSelect").disabled=!githubRepos.length;gh("loadRepo").disabled=!githubRepos.length;
    githubMessage(`Repository list refreshed: ${githubRepos.length} repositories.`,"success");
  } catch(error){githubMessage(error.message,"error");}
}
gh("loadRepo").addEventListener("click",openGithubRepo);
gh("repoFileSearch").addEventListener("input",renderGithubFiles);
gh("importRepoFile").addEventListener("click",importGithubFile);
gh("toggleToken").addEventListener("click",()=>{const input=gh("githubToken");input.type=input.type==="password"?"text":"password";gh("toggleToken").textContent=input.type==="password"?"Show":"Hide";});
window.addEventListener("pagehide",()=>{githubToken="";});
