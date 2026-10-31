# Parakeet Desktop AI

A Windows-first, local-first desktop prototype inspired by Parakeet AI. It records microphone audio, transcribes it with Whisper.cpp, and generates a progressively streamed answer using a local Ollama model.

## Privacy and network behavior

- Microphone audio is captured by the Electron renderer using the browser MediaRecorder API.
- The recorded WebM audio is passed through a restricted preload IPC bridge to Electron's main process.
- The main process converts audio to 16 kHz mono WAV using the `ffmpeg-static` binary and runs Whisper.cpp locally.
- The transcript is sent to Ollama at `127.0.0.1:11434`.
- No cloud speech-to-text or cloud LLM API is used.
- The interface uses system fonts and does not require a remote font request.

## Requirements

- Windows 10 or 11, 64-bit
- Node.js 20 LTS or newer
- npm
- Ollama for Windows
- Whisper.cpp Windows CLI binary and a Whisper model
- Microphone

## 1. Install Node.js

Install the current Node.js LTS from https://nodejs.org/. Open a new PowerShell window and verify:

```powershell
node --version
npm --version
```

## 2. Install Ollama and download the model

Install Ollama from https://ollama.com/download/windows.

In PowerShell:

```powershell
ollama pull qwen2.5:1.5b
ollama run qwen2.5:1.5b
```

You can exit the interactive prompt after confirming the model starts. Ollama normally runs as a background application and exposes its local API at `http://127.0.0.1:11434`.

To confirm the model is available:

```powershell
ollama list
```

## 3. Install Whisper.cpp

Get a Windows x64 release/build from https://github.com/ggml-org/whisper.cpp. The application expects the CLI binary named `whisper-cli.exe`.

Create the `bin` folder if it does not exist, then copy the binary:

```powershell
New-Item -ItemType Directory -Force .\bin | Out-Null
Copy-Item "C:\path\to\whisper-cli.exe" ".\bin\whisper-cli.exe"
```

Download the English base model from the Whisper.cpp model repository/documentation. The expected file name is `ggml-base.en.bin`.

```powershell
New-Item -ItemType Directory -Force .\models | Out-Null
Copy-Item "C:\path\to\ggml-base.en.bin" ".\models\ggml-base.en.bin"
```

If you want multilingual transcription, use `ggml-base.bin` instead and update the model filename in `electron/services/whisper.cjs`.

## 4. Install dependencies and run

Open PowerShell in the project root:

```powershell
npm install
npm run dev
```

The Electron window should open. Make sure Ollama is running and both local model assets are present. The runtime status area reports whether Whisper and Ollama are ready.

## 5. Build a Windows installer

```powershell
npm run dist:win
```

The installer is written to `release/`.

The `bin/whisper-cli.exe` and `models/ggml-base.en.bin` files are included as extra resources by the Electron Builder configuration. Ensure they exist before building. `ffmpeg-static` supplies the ffmpeg executable as an npm dependency.

## Project structure

```text
parakeet-desktop-ai/
├── electron/
│   ├── main.cjs
│   ├── preload.cjs
│   └── services/
│       ├── whisper.cjs
│       └── ollama.cjs
├── src/
│   ├── components/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── models/                 # Add ggml-base.en.bin locally
├── bin/                    # Add whisper-cli.exe locally
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── TASKS.md
│   └── DECISIONS.md
├── package.json
└── README.md
```

## Troubleshooting

### Whisper is NOT READY
- Confirm `bin/whisper-cli.exe` exists.
- Confirm `models/ggml-base.en.bin` exists.
- Check the binary can run directly in PowerShell.
- Confirm the binary release is compatible with your Windows architecture.

### Ollama is NOT READY
- Start the Ollama desktop application.
- Run `ollama list`.
- Run `ollama pull qwen2.5:1.5b`.
- Check `http://127.0.0.1:11434/api/tags` in a browser.

### Microphone permission
- Check Windows Settings → Privacy & security → Microphone.
- Ensure desktop apps are allowed to access the microphone.
- Close other applications that may exclusively hold the microphone.

### No transcript
- Record a clear, audible question.
- Check the selected Windows input device.
- Avoid very short recordings; allow a brief pause before pressing Stop.

## Current prototype limitations

- Transcription starts after Stop; it is not live partial transcription.
- The initial model configuration is English-only (`ggml-base.en.bin`).
- The UI uses a fixed Ollama model name (`qwen2.5:1.5b`), configurable through `PARAKEET_OLLAMA_MODEL` in the process environment.
- The app is a prototype, not a production-grade meeting recorder. It does not implement persistent history, speaker diarization, automatic question detection, or background recording.

## Security notes

The app uses `contextIsolation: true`, `nodeIntegration: false`, a preload bridge, and explicit IPC handlers. Do not expose `ipcRenderer`, `require`, or arbitrary filesystem methods to the renderer. Keep local model endpoints bound to loopback unless there is a specific, reviewed reason to change them.
