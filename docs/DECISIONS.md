# Decision Log

## 2026-10-30 — Desktop framework
**Decision:** Electron + React + Vite.  
**Reason:** Fast Windows desktop prototype development with a familiar React UI and Node.js process orchestration.

## 2026-10-30 — Speech-to-text
**Decision:** Whisper.cpp CLI, invoked as a local child process.  
**Reason:** Local inference, no cloud API, easy to reason about process boundaries.

## 2026-10-30 — Audio capture format
**Decision:** MediaRecorder WebM/Opus, then ffmpeg conversion to 16 kHz mono PCM WAV.  
**Reason:** Browser media capture is convenient; conversion normalizes the input for Whisper.

## 2026-10-30 — LLM runtime
**Decision:** Ollama on loopback with Qwen 2.5 1.5B as the initial model.  
**Reason:** Local model runtime and simple streaming HTTP API.

## 2026-10-30 — Streaming strategy
**Decision:** Ollama NDJSON stream parsed in Electron main and forwarded to renderer over IPC.  
**Reason:** Keeps network/runtime orchestration out of the UI and allows progressive display.

## 2026-10-30 — Security
**Decision:** Enable context isolation, disable Node integration, and expose a narrow preload API.  
**Reason:** Avoid giving renderer code direct filesystem or shell access.

## 2026-10-30 — Scope
**Decision:** Transcribe after Stop rather than live partial transcription.  
**Reason:** The assignment asks for a simple prototype; push-to-record followed by transcription is smaller, more reliable, and easier to demonstrate.
