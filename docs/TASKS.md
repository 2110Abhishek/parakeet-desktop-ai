# Implementation Tasks

## Milestone 1 — Desktop foundation
- [x] Create Electron + Vite + React scaffold.
- [x] Configure secure BrowserWindow.
- [x] Add preload bridge.
- [x] Configure Windows NSIS packaging.

## Milestone 2 — Premium UI
- [x] Create dark desktop layout.
- [x] Add recording card and state indicator.
- [x] Add transcription panel.
- [x] Add answer panel and progressive cursor.
- [x] Add local runtime status cards.

## Milestone 3 — Audio capture
- [x] Request microphone permission.
- [x] Capture WebM/Opus with MediaRecorder.
- [x] Implement Start and Stop.
- [x] Release microphone tracks.
- [x] Transfer audio bytes through IPC.

## Milestone 4 — Whisper
- [x] Add ffmpeg-static dependency.
- [x] Convert WebM to 16 kHz mono PCM WAV.
- [x] Spawn Whisper.cpp CLI.
- [x] Read transcript output.
- [x] Clean temporary files.
- [x] Detect missing binary/model.

## Milestone 5 — Ollama
- [x] Check local Ollama service.
- [x] Check configured model availability.
- [x] Send transcript to local chat API.
- [x] Parse streamed NDJSON safely.
- [x] Forward chunks to renderer.
- [x] Implement cancellation.

## Milestone 6 — Quality and submission
- [ ] Test on target Windows machine.
- [ ] Test microphone denial and missing dependencies.
- [ ] Test with internet disconnected after setup.
- [ ] Verify packaged app can locate Whisper assets.
- [ ] Capture screenshots.
- [ ] Build and test NSIS installer.
- [ ] Confirm README commands on a clean machine.
