# Architecture — Parakeet Desktop AI

## Architecture principles
- Local-first inference.
- Renderer is a UI, not a privileged Node.js process.
- Explicit IPC contract.
- Model binaries are external resources, not committed to source control.
- Long-running work runs in Electron main/child processes.

## Process model

```text
┌─────────────────────────────────────────────────────────┐
│ Electron BrowserWindow                                   │
│                                                         │
│  React Renderer                                         │
│  ├─ Start/Stop UI                                       │
│  ├─ navigator.mediaDevices.getUserMedia                 │
│  ├─ MediaRecorder → WebM Blob                           │
│  ├─ Transcript state                                    │
│  └─ Progressive answer state                            │
│               │                                         │
│               ▼                                         │
│  Preload (contextBridge, restricted API)                │
└───────────────┬─────────────────────────────────────────┘
                │ IPC
                ▼
┌─────────────────────────────────────────────────────────┐
│ Electron Main Process                                    │
│  ├─ Validate IPC payload                                 │
│  ├─ Write temporary WebM                                 │
│  ├─ ffmpeg-static → 16 kHz mono WAV                      │
│  ├─ spawn whisper-cli.exe                                │
│  ├─ fetch Ollama /api/chat (stream=true)                 │
│  └─ Forward answer chunks to renderer                    │
└───────────────┬─────────────────────────────────────────┘
                │ local process / loopback HTTP
       ┌────────┴─────────┐
       ▼                  ▼
  Whisper.cpp           Ollama
  ggml-base.en          qwen2.5:1.5b
```

## Why MediaRecorder in renderer?
The browser media APIs provide a straightforward microphone permission flow. The renderer captures audio but does not receive filesystem or shell access. The captured bytes cross a narrow preload bridge to the main process.

## Why Whisper.cpp CLI?
It provides local inference without requiring a Python server. A CLI process is straightforward to package and supervise. The app normalizes input audio before passing it to Whisper.

## Why Ollama?
Ollama provides a local model runtime with a simple HTTP interface and NDJSON streaming. The application uses the loopback URL only.

## Packaging
Electron Builder packages the app. `bin/whisper-cli.exe` and `models/ggml-base.en.bin` are copied using `extraResources`, outside the app's ASAR archive. `ffmpeg-static` is a production dependency and supplies the ffmpeg executable.

## Important implementation note
The Whisper binary and model are intentionally not included in the source ZIP because they are large, platform-specific third-party assets. Download them separately using the README instructions and put them in the documented folders before running or packaging.
