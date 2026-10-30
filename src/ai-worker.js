import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Qwen2.5-Coder-0.5B-Instruct";
let generator = null;
let backend = "wasm";

self.addEventListener("message", async event => {
  const data = event.data || {};
  if (data.type === "load") {
    if (generator) {
      self.postMessage({type:"ready",backend});
      return;
    }
    try {
      const hasWebGPU = typeof navigator !== "undefined" && !!navigator.gpu;
      const loadOptions = {
        dtype: "q4",
        progress_callback: progress => {
          const percent = Number.isFinite(progress?.progress) ? progress.progress : null;
          self.postMessage({
            type:"progress",
            progress:percent,
            file:progress?.file || "",
            message:progress?.status === "progress" ? "Downloading model files…" : "Preparing local model…"
          });
        }
      };
      if (hasWebGPU) {
        try {
          generator = await pipeline("text-generation", MODEL_ID, {...loadOptions,device:"webgpu"});
          backend = "webgpu";
        } catch (webgpuError) {
          self.postMessage({type:"progress",progress:0,message:"WebGPU initialization failed; trying WASM/CPU…"});
          generator = await pipeline("text-generation", MODEL_ID, loadOptions);
          backend = "wasm";
        }
      } else {
        generator = await pipeline("text-generation", MODEL_ID, loadOptions);
        backend = "wasm";
      }
      self.postMessage({type:"ready",backend});
    } catch (error) {
      generator = null;
      self.postMessage({type:"error",message:error?.message || "Unable to load local model."});
    }
    return;
  }
  if (data.type === "generate") {
    if (!generator) {
      self.postMessage({type:"error",message:"Model is not loaded."});
      return;
    }
    try {
      self.postMessage({type:"working",message:"Generating response locally…"});
      const messages = [
        {role:"system",content:"You are KoiCode, a careful coding assistant. Explain clearly and concisely. When given code, reason only from the supplied context. Never claim to have run or tested code unless a tool actually did so. If context is insufficient, say what is missing. Prefer small, safe code changes and explain risks. The user may write Indonesian; reply in the user's language."},
        ...(Array.isArray(data.messages) ? data.messages.slice(-8) : [])
      ];
      const output = await generator(messages,{max_new_tokens:256,do_sample:false});
      const generated = output?.[0]?.generated_text;
      const last = Array.isArray(generated) ? generated[generated.length-1] : null;
      const answer = typeof last?.content === "string" ? last.content : (typeof generated === "string" ? generated : "");
      self.postMessage({type:"reply",text:answer.trim() || "Model returned no text."});
    } catch (error) {
      self.postMessage({type:"generation-error",message:error?.message || "Generation failed."});
    }
  }
});
