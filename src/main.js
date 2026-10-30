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
document.querySelector("#mobileMenu").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.toggle("open");
});

function setStatus(id, text, state) {
  const el = document.getElementById(id);
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
  setStatus("memoryStatus",
    memory ? `Browser hint: ${memory} GB` : "Not exposed by browser",
    memory && memory >= 4 ? "good" : "pending");

  const cores = navigator.hardwareConcurrency;
  setStatus("cpuStatus",
    cores ? `${cores} logical cores` : "Not exposed",
    cores && cores >= 4 ? "good" : "pending");

  if (gpuAvailable) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) setStatus("gpuStatus", "API present, no adapter", "bad");
      else setStatus("gpuStatus", "Adapter detected", "good");
    } catch {
      setStatus("gpuStatus", "Adapter check failed", "bad");
    }
  }
}

document.querySelector("#rescan").addEventListener("click", scanCapabilities);
scanCapabilities();