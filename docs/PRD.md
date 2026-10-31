# Product Requirements Document (PRD)
## Parakeet Desktop AI — Windows Local AI Assistant

**Document version:** 1.0  
**Status:** Implementation baseline  
**Platform:** Windows 10/11 x64  
**Product type:** Desktop application  
**Primary stack:** Electron, React, Vite, Node.js, Whisper.cpp, Ollama

---

## 1. Product overview

Parakeet Desktop AI is a lightweight Windows desktop prototype inspired by Parakeet AI. It listens to microphone audio, converts spoken questions into text using a local speech recognition model, and generates a suggested response using a locally hosted language model. The answer is rendered progressively as tokens/chunks arrive.

The core experience must work without sending audio or prompts to a cloud AI provider. All speech recognition and LLM inference must run on the user's computer.

### 1.1 Problem statement

A user may need help understanding a spoken question and quickly forming a clear response. Switching between a recorder, transcription website, and AI chat adds friction and may expose private audio to third-party services.

### 1.2 Product goal

Provide one simple desktop workflow:

**Start → Speak → Stop → Transcribe locally → Suggest Answer → Read streamed answer.**

### 1.3 Success criteria

The prototype is successful when a user can:
1. Launch the Windows desktop application.
2. Start and stop microphone recording.
3. See a transcription produced by Whisper.cpp.
4. Click Suggest Answer.
5. See the Ollama-generated answer appear progressively.
6. Complete the workflow without a cloud speech or LLM API.

---

## 2. Goals and non-goals

### Goals
- Native-feeling Windows desktop window.
- Premium dark UI with clear visual hierarchy.
- Microphone capture using standard Windows audio input devices.
- Local speech-to-text using Whisper.cpp.
- Local LLM inference using Ollama.
- Progressive answer rendering.
- Clear status and actionable errors for missing runtimes/models.
- Secure renderer/main-process separation.
- Simple manual setup and installer packaging.

### Non-goals for this assignment
- User accounts, authentication, or cloud sync.
- Persistent conversation database or account history.
- Live partial transcription while recording.
- Speaker identification or diarization.
- Automatic detection of questions without user action.
- Browser extension or mobile application.
- Cloud AI fallback.
- Meeting recording in the background.
- Automated answer insertion into other applications.

---

## 3. Target user and primary use case

### Primary user
A Windows user who wants to capture a spoken question and receive a concise, useful answer without using cloud AI services.

### Primary use case
1. User opens the app.
2. User clicks **Start recording**.
3. User speaks a question into the microphone.
4. User clicks **Stop & transcribe**.
5. App converts the captured audio to text locally.
6. The transcript appears in the Transcription panel.
7. User clicks **Suggest answer**.
8. Ollama generates a response locally.
9. The response streams into the Suggested answer panel.
10. User copies the answer or resets the session.

---

## 4. UX and visual direction

### Design principles
- Premium, restrained dark interface.
- Near-black/navy background with subtle violet and blue accents.
- Strong typography and generous spacing.
- Recording state must be unmistakable.
- Transcription and answer panels must remain visually distinct.
- Avoid unnecessary charts, settings, menus, or decorative complexity.
- Use status labels and actionable errors rather than silent failures.

### Main screen layout

**A. Navigation rail**
- Product mark.
- Assistant navigation state.
- Settings/status refresh affordance.
- User-neutral profile placeholder.

**B. Header**
- Product name.
- Local/private status indicator.
- Refresh local runtime status.

**C. Intro area**
- Short product headline.
- Brief explanation of local processing.

**D. Audio capture card**
- Recording state: Standby, Recording, Processing.
- Elapsed recording timer.
- Start recording button.
- Stop & transcribe button.
- Reset action.
- Microphone visual indicator.

**E. Transcription panel**
- Recognized speech.
- Empty state before recording.
- Processing state during Whisper execution.
- Word count and engine label.

**F. Suggested answer panel**
- Suggest answer action.
- Progressive answer text.
- Generating state.
- Stop generation action.
- Copy answer action.

**G. Runtime status**
- Whisper.cpp readiness.
- Ollama/model readiness.
- Local privacy reassurance.

### UI states
| State | Expected presentation |
|---|---|
| Idle | Start button enabled; no active recording |
| Recording | Red/live state, timer incrementing, Stop enabled |
| Transcribing | Processing indicator; recording controls disabled |
| Transcript ready | Transcript visible; Suggest Answer enabled |
| Generating | Streaming text; generation indicator; Stop generation enabled |
| Answer ready | Full answer visible; Copy enabled |
| Runtime missing | Not-ready status and setup guidance |
| Microphone denied | Permission error with Windows settings guidance |
| Failed | Human-readable error and retry path |

---

## 5. Functional requirements

### FR-01: Desktop application launch
- The app must launch in a desktop window.
- Initial window target: 1440 × 940.
- Minimum supported window: 1060 × 720.
- Application must not require a browser tab.

**Acceptance criteria**
- `npm run dev` launches the Electron window.
- Packaged Windows installer launches the installed app.
- Main window has a meaningful title and dark background.

### FR-02: Microphone capture
- User can start recording with one click.
- Browser/Electron microphone permission is requested when needed.
- Audio is captured through `getUserMedia`.
- `MediaRecorder` records WebM/Opus where supported.
- User can stop recording explicitly.
- Audio stream tracks are stopped after capture.

**Acceptance criteria**
- Start transitions the UI to Recording.
- Timer increments while recording.
- Stop ends the recorder and releases microphone tracks.
- Empty audio produces an actionable message.

### FR-03: Audio conversion
- Captured WebM is passed to the Electron main process.
- `ffmpeg-static` converts audio to mono, 16 kHz, signed 16-bit PCM WAV.
- Temporary audio files are written to the operating system temp directory.
- Temporary audio files are deleted after transcription.

**Acceptance criteria**
- Whisper receives a WAV file with the expected format.
- Temporary files are cleaned after success or failure.

### FR-04: Local speech transcription
- Whisper.cpp CLI runs locally as a child process.
- Model is loaded from the app's `models` directory.
- Transcription runs after Stop.
- Result is returned to the UI and displayed as text.

**Acceptance criteria**
- With binary and model installed, clear speech returns non-empty text.
- If the binary/model is missing, the app explains the missing setup.
- If no speech is detected, user can record again.

### FR-05: Suggest answer
- Suggest Answer is enabled only when a transcript exists.
- User action sends the transcript to the main process.
- Main process calls Ollama on loopback.
- The prompt requests concise, accurate, natural responses.
- Model inference must not use a cloud endpoint.

**Acceptance criteria**
- A transcript can be submitted to Ollama.
- Missing Ollama/model produces a setup error.
- The UI does not silently fail.

### FR-06: Progressive answer display
- Ollama streaming is enabled.
- Main process parses newline-delimited JSON incrementally.
- Each generated content chunk is sent to renderer over IPC.
- Renderer appends chunks to the current answer.
- Generation can be stopped.

**Acceptance criteria**
- Answer text becomes visible before generation finishes.
- Chunks are appended in order.
- Stop cancels the active request.
- Completion ends the generating state.

### FR-07: Copy and reset
- User can copy the generated answer.
- User can clear the current session.
- Reset clears transcript, answer, timer, and transient notice.
- Reset must not leave microphone capture active.

### FR-08: Local runtime status
- App checks Whisper binary/model availability.
- App checks whether Ollama responds on loopback.
- App checks whether the configured model is installed.
- UI displays readiness separately for Whisper and Ollama.

---

## 6. Non-functional requirements

### NFR-01: Privacy
- Audio must not be uploaded to a cloud speech service.
- Prompt and answer generation must use the local Ollama endpoint.
- No analytics or telemetry is required for the prototype.
- Temporary audio is deleted after processing.
- No audio/transcript history is persisted by default.

### NFR-02: Security
- Electron `contextIsolation` enabled.
- Electron `nodeIntegration` disabled.
- Use a narrow preload bridge.
- Validate IPC inputs.
- Do not expose arbitrary filesystem or shell execution to renderer.
- Keep Ollama bound to loopback.
- Do not load arbitrary remote content in the Electron window.

### NFR-03: Performance
- UI remains responsive during transcription and generation.
- Transcription and LLM calls run outside the renderer thread.
- UI shows processing status during longer operations.
- Actual latency depends on CPU, memory, model size, and audio duration.

### NFR-04: Reliability
- Errors from missing binaries, missing models, inaccessible microphone, and unavailable Ollama must be surfaced.
- Child processes must be checked for non-zero exit status.
- Temporary files must be cleaned after completion/failure.
- Streaming parser must handle partial network chunks.

### NFR-05: Compatibility
- Initial target: Windows 10/11 x64.
- Node.js 20 LTS or newer for development.
- Electron packaged x64 app.
- Whisper binary must match Windows architecture.

### NFR-06: Accessibility/usability
- Controls have visible labels.
- Status is communicated with text as well as color.
- Buttons show disabled states when actions are invalid.
- Main layout remains usable at the minimum supported size.

---

## 7. Technical architecture

### Components
| Component | Responsibility |
|---|---|
| React renderer | UI, microphone capture, transcript and answer rendering |
| Electron main | IPC handlers, temporary files, process orchestration |
| Preload bridge | Explicitly expose approved IPC methods |
| ffmpeg-static | Convert WebM audio to Whisper-compatible WAV |
| Whisper.cpp CLI | Local speech-to-text |
| Ollama | Local LLM inference |
| Qwen 2.5 1.5B | Initial lightweight answer-generation model |

### Data flow
1. Renderer obtains microphone stream.
2. MediaRecorder emits WebM chunks.
3. Stop creates a Blob and ArrayBuffer.
4. ArrayBuffer crosses the preload IPC bridge.
5. Main process writes temporary WebM.
6. ffmpeg converts WebM to 16 kHz mono WAV.
7. Whisper.cpp transcribes WAV.
8. Transcript returns to renderer.
9. User clicks Suggest Answer.
10. Main process calls `http://127.0.0.1:11434/api/chat`.
11. Ollama streams NDJSON.
12. Main process parses chunks and forwards answer fragments through IPC.
13. Renderer appends chunks progressively.

### IPC contract
| Channel/API | Direction | Purpose |
|---|---|---|
| `system:status` | Renderer → Main | Read local runtime readiness |
| `audio:transcribe` | Renderer → Main | Submit recorded audio bytes |
| `audio:transcription-progress` | Main → Renderer | Progress status |
| `answer:generate` | Renderer → Main | Start local LLM generation |
| `answer:chunk` | Main → Renderer | Stream generated text |
| `answer:complete` | Main → Renderer | Signal completion |
| `answer:error` | Main → Renderer | Report generation error |
| `answer:cancel` | Renderer → Main | Cancel generation |

---

## 8. Model and runtime configuration

### Speech-to-text
Initial model: `ggml-base.en.bin`.

- English-only model.
- Suitable for a lightweight prototype.
- Whisper.cpp CLI expected at `bin/whisper-cli.exe`.
- Model expected at `models/ggml-base.en.bin`.

For multilingual use, replace with `ggml-base.bin` and update the expected filename in the service.

### LLM
Initial runtime: Ollama.

Initial model: `qwen2.5:1.5b`.

- Small model to reduce local resource requirements.
- Answer quality and speed will vary by hardware.
- Model can be changed through the configured model name.

### Hardware assumptions
The app should be designed to run on a typical modern Windows PC, but no exact latency guarantee is made. The model's memory footprint and inference speed depend on quantization, CPU/GPU, available RAM, and other running processes.

---

## 9. Error handling

| Failure | User-facing behavior |
|---|---|
| Microphone denied | Explain Windows microphone permission |
| No audio captured | Ask user to retry |
| Whisper binary missing | Show setup guidance |
| Whisper model missing | Show expected model path |
| ffmpeg conversion failure | Show conversion error |
| Whisper returns empty output | Suggest recording more clearly |
| Ollama not running | Explain how to start Ollama |
| Model not installed | Show exact `ollama pull` command |
| Ollama request fails | Display error; allow retry |
| Generation cancelled | Stop spinner and preserve partial answer |
| App reset during recording | Stop tracks before clearing |

---

## 10. Privacy and data lifecycle

### Audio
- Exists in renderer memory during recording.
- Sent to Electron main process for transcription.
- Temporarily written to OS temp directory.
- Converted to WAV.
- Temporary WebM/WAV/transcript output files are removed after use.

### Transcript
- Stored in React state for the active session.
- Not written to a database or local history file.
- Cleared when the user resets or closes the application.

### Prompt and answer
- Sent only to the local Ollama service.
- Held in process/UI memory for the current session.
- Not stored by this application.

Note: Ollama is a local runtime, but users should review their own runtime configuration and installed model behavior. The prototype does not provide a forensic guarantee about OS-level temporary storage or memory.

---

## 11. Testing and acceptance plan

### Functional tests
- [ ] App opens as a Windows desktop window.
- [ ] Start requests microphone access.
- [ ] Recording timer advances.
- [ ] Stop ends microphone recording.
- [ ] Audio conversion creates valid 16 kHz mono WAV.
- [ ] Whisper returns a transcript.
- [ ] Transcript appears in UI.
- [ ] Suggest Answer sends the transcript to Ollama.
- [ ] Answer streams progressively.
- [ ] Stop generation cancels the response.
- [ ] Copy action copies answer text.
- [ ] Reset clears current session.

### Negative tests
- [ ] Microphone permission denied.
- [ ] No microphone connected.
- [ ] Silent/empty recording.
- [ ] Whisper executable missing.
- [ ] Whisper model missing.
- [ ] Ollama not running.
- [ ] Ollama model not installed.
- [ ] Ollama request fails during streaming.
- [ ] User resets after a completed answer.

### Offline/privacy tests
- [ ] Disconnect external internet after downloading required binaries/models.
- [ ] Keep Ollama running locally.
- [ ] Complete one transcription and one answer.
- [ ] Confirm app does not call a cloud AI endpoint.
- [ ] Remove external Google Fonts import if strict air-gap operation is required.

### Submission acceptance
The assignment is ready to submit when the end-to-end workflow has been demonstrated on a clean Windows environment with local model assets installed, and the README allows a reviewer to set it up without undocumented steps.

---

## 12. Delivery plan

| Phase | Work | Output |
|---|---|---|
| 1 | Electron + Vite scaffold | Desktop window |
| 2 | Premium UI | Main assistant screen |
| 3 | Microphone capture | Start/Stop recording |
| 4 | Whisper integration | Local transcript |
| 5 | Ollama integration | Local answer generation |
| 6 | Streaming IPC | Progressive answer |
| 7 | Error handling | Robust demo workflow |
| 8 | Packaging/docs | Windows installer and README |

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Whisper Windows binary mismatch | Document tested binary source and architecture |
| Large model download | Keep model external during development; document exact placement |
| Slow CPU inference | Start with small models and avoid promising fixed latency |
| Audio format mismatch | Normalize using ffmpeg to 16 kHz mono PCM |
| Ollama not started | Runtime readiness check and clear setup guidance |
| Renderer security exposure | Context isolation and narrow preload API |
| Strict offline expectation conflicts with remote fonts | Use system fonts or bundle fonts locally |

---

## 14. Future enhancements (out of assignment scope)
- Partial/live transcription while recording.
- Language selection and multilingual model support.
- Selectable local Ollama models.
- Adjustable answer style and length.
- Session history with opt-in local persistence.
- Keyboard shortcuts.
- Audio device selector.
- Installer diagnostics for missing models.
- Speaker diarization.
- Model download/setup wizard.

---

## 15. Definition of done

The product is done for this assignment when a reviewer can run the app on Windows, record a spoken question, see a local Whisper transcription, click Suggest Answer, and observe the local Ollama answer streaming into the UI. The README must explain all prerequisites and setup steps, and the app must provide useful errors when local dependencies are missing.
