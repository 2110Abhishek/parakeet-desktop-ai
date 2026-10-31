const OLLAMA_URL = "http://127.0.0.1:11434";
const MODEL = process.env.PARAKEET_OLLAMA_MODEL || "qwen2.5:1.5b";

async function checkOllamaReady() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error("Ollama did not respond successfully.");
    const data = await response.json();
    const models = (data.models || []).map((model) => model.name);
    const modelPresent = models.some((name) => name === MODEL || name.startsWith(`${MODEL}:`));
    return {
      ready: modelPresent,
      serviceReachable: true,
      model: MODEL,
      models,
      message: modelPresent ? "Local model ready." : `Run: ollama pull ${MODEL}`
    };
  } catch {
    return {
      ready: false,
      serviceReachable: false,
      model: MODEL,
      models: [],
      message: "Ollama is unavailable. Start Ollama and try again."
    };
  }
}

async function streamAnswer(question, onChunk, signal) {
  const status = await checkOllamaReady();
  if (!status.serviceReachable) {
    throw new Error("Cannot connect to Ollama at 127.0.0.1:11434. Start the Ollama application.");
  }
  if (!status.ready) throw new Error(`Model ${MODEL} is not installed. Run: ollama pull ${MODEL}`);

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        {
          role: "system",
          content: "You are a helpful interview and meeting assistant. Answer the user's question accurately, naturally, and concisely. Use clear language, explain technical terms when useful, and never invent personal experience or facts."
        },
        { role: "user", content: question }
      ],
      options: { temperature: 0.35 }
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama request failed with HTTP ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      const chunk = data.message?.content;
      if (chunk) onChunk(chunk);
      if (data.error) throw new Error(data.error);
    }
    if (done) break;
  }

  if (pending.trim()) {
    const data = JSON.parse(pending);
    if (data.message?.content) onChunk(data.message.content);
  }
}

module.exports = { streamAnswer, checkOllamaReady };
