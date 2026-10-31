const express = require("express");
const cors = require("cors");
const path = require("node:path");

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = (process.env.OLLAMA_URL || process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || process.env.PARAKEET_OLLAMA_MODEL || "qwen2.5:1.5b";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.raw({ type: "audio/*", limit: "25mb" }));

// System status check endpoint
app.get("/api/status", async (req, res) => {
  let ollamaStatus = {
    ready: false,
    serviceReachable: false,
    url: OLLAMA_URL,
    model: OLLAMA_MODEL,
    message: `Checking connection to Ollama at ${OLLAMA_URL}...`
  };

  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map((m) => m.name);
      const modelPresent = models.some(
        (name) => name === OLLAMA_MODEL || name.startsWith(`${OLLAMA_MODEL}:`)
      );

      ollamaStatus = {
        ready: modelPresent,
        serviceReachable: true,
        url: OLLAMA_URL,
        model: OLLAMA_MODEL,
        models,
        message: modelPresent
          ? `Remote Ollama ready (${OLLAMA_MODEL})`
          : `Ollama connected. Model '${OLLAMA_MODEL}' not found. Run 'ollama pull ${OLLAMA_MODEL}' on your server.`
      };
    } else {
      ollamaStatus.message = `Ollama server returned HTTP ${response.status}.`;
    }
  } catch (error) {
    ollamaStatus.message = `Cannot reach Ollama at ${OLLAMA_URL}. Ensure your Ollama server is running and publicly reachable.`;
  }

  const transcriptionStatus = {
    provider: GROQ_API_KEY ? "groq" : OPENAI_API_KEY ? "openai" : "web-speech",
    ready: true,
    message: GROQ_API_KEY
      ? "Groq Whisper API active"
      : OPENAI_API_KEY
      ? "OpenAI Whisper API active"
      : "In-browser Web Speech API active (Instant & Free)"
  };

  res.json({
    mode: "web",
    ollama: ollamaStatus,
    transcription: transcriptionStatus,
    whisper: {
      ready: transcriptionStatus.ready,
      message: transcriptionStatus.message
    }
  });
});

// Streaming AI answer generation endpoint
app.post("/api/answer", async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "Please provide a valid question." });
  }

  // Set up Server-Sent Events (SSE) with anti-buffering headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful interview and meeting assistant. Answer the user's question accurately, naturally, and concisely. Use clear language, explain technical terms when useful, and never invent personal experience or facts."
          },
          { role: "user", content: question.trim() }
        ],
        options: { temperature: 0.35 }
      })
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      res.write(`data: ${JSON.stringify({ error: `Ollama error: HTTP ${ollamaRes.status}` })}\n\n`);
      return res.end();
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";

    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const chunk = data.message?.content;
          if (chunk) {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }
          if (data.error) {
            res.write(`data: ${JSON.stringify({ error: data.error })}\n\n`);
          }
        } catch {}
      }

      if (done) break;
    }

    if (pending.trim()) {
      try {
        const data = JSON.parse(pending);
        if (data.message?.content) {
          res.write(`data: ${JSON.stringify({ chunk: data.message.content })}\n\n`);
        }
      } catch {}
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    if (err.name !== "AbortError") {
      res.write(`data: ${JSON.stringify({ error: err.message || "Failed to generate answer" })}\n\n`);
    }
    res.end();
  }
});

// Audio transcription endpoint (Groq / OpenAI cloud whisper proxy if keys present)
app.post("/api/transcribe", async (req, res) => {
  const apiKey = GROQ_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    return res.json({
      transcript: "",
      provider: "web-speech",
      message: "Speech recognition handled in browser."
    });
  }

  const audioBuffer = Buffer.isBuffer(req.body)
    ? req.body
    : req.body?.audio
    ? Buffer.from(req.body.audio, "base64")
    : null;

  if (!audioBuffer || audioBuffer.length === 0) {
    return res.status(400).json({ error: "No audio data received." });
  }

  const endpoint = GROQ_API_KEY
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";

  const modelName = GROQ_API_KEY ? "whisper-large-v3" : "whisper-1";

  try {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: "audio/webm" });
    formData.append("file", blob, "audio.webm");
    formData.append("model", modelName);

    const apiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ error: `Transcription API error: ${errText}` });
    }

    const result = await apiRes.json();
    res.json({ transcript: result.text });
  } catch (err) {
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

// Serve static frontend build
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));

app.use((req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Parakeet Web Server listening on port ${PORT}`);
  console.log(`Target Ollama URL: ${OLLAMA_URL}`);
  console.log(`Target Ollama Model: ${OLLAMA_MODEL}`);
});
