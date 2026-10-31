import { useEffect, useRef, useState } from "react";
import {
  AudioLines, Mic, MicOff, Sparkles, Copy, RotateCcw, ShieldCheck,
  Cpu, CircleStop, Check, AlertCircle, LoaderCircle, Waves, Command,
  Settings2, ChevronDown, Zap, Globe
} from "lucide-react";

const emptyStatus = {
  whisper: { ready: false, message: "Checking Whisper..." },
  ollama: { ready: false, message: "Checking Ollama..." }
};

export default function App() {
  const [status, setStatus] = useState(emptyStatus);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const mediaRecorder = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const abortControllerRef = useRef(null);

  const isDesktop = typeof window !== "undefined" && Boolean(window.desktopAPI);

  async function refreshStatus() {
    if (isDesktop) {
      try {
        const result = await window.desktopAPI.getSystemStatus();
        if (result) setStatus(result);
      } catch {
        setNotice("Could not read local AI runtime status.");
      }
      return;
    }

    // Web mode status check
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setStatus({
          whisper: data.whisper || { ready: true, message: "In-browser Speech Recognition" },
          ollama: data.ollama || { ready: false, message: "Checking Ollama..." }
        });
      } else {
        setStatus({
          whisper: { ready: true, message: "In-browser Speech Recognition" },
          ollama: { ready: false, message: "Could not reach web backend." }
        });
      }
    } catch {
      setStatus({
        whisper: { ready: true, message: "In-browser Speech Recognition" },
        ollama: { ready: false, message: "Backend offline. Check server status." }
      });
    }
  }

  useEffect(() => {
    refreshStatus();
    if (!isDesktop) return;

    const removeChunk = window.desktopAPI.onAnswerChunk?.((chunk) => {
      setAnswer((current) => current + chunk);
    });
    const removeComplete = window.desktopAPI.onAnswerComplete?.(() => setGenerating(false));
    const removeError = window.desktopAPI.onAnswerError?.((message) => {
      setGenerating(false);
      setNotice(message);
    });
    const removeProgress = window.desktopAPI.onTranscriptionProgress?.((message) => setNotice(message));
    return () => {
      removeChunk?.();
      removeComplete?.();
      removeError?.();
      removeProgress?.();
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  async function startRecording() {
    setNotice("");
    setAnswer("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // In browser mode, optionally start Web Speech Recognition for instantaneous live transcription
      if (!isDesktop) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = "en-US";
            recognition.onresult = (event) => {
              let full = "";
              for (let i = 0; i < event.results.length; i++) {
                full += event.results[i][0].transcript;
              }
              setTranscript(full);
            };
            recognitionRef.current = recognition;
            recognition.start();
          } catch (e) {
            console.warn("Browser SpeechRecognition failed to initialize:", e);
          }
        }
      }

      const preferred = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: preferred });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recognitionRef.current?.stop();

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size && !transcript) {
          setNotice("No audio was captured. Check your microphone and try again.");
          return;
        }

        // Desktop mode: use local Whisper
        if (isDesktop) {
          setProcessing(true);
          setNotice("Preparing local transcription...");
          try {
            const buffer = await blob.arrayBuffer();
            const result = await window.desktopAPI.transcribeAudio(buffer);
            setTranscript(result.transcript);
            setNotice("Transcription complete.");
          } catch (error) {
            setNotice(error.message || "Transcription failed.");
          } finally {
            setProcessing(false);
          }
          return;
        }

        // Web mode: if transcript was already set by Web Speech API, we are done
        if (transcript.trim()) {
          setNotice("Transcription complete.");
          return;
        }

        // Otherwise try cloud backend transcription
        setProcessing(true);
        setNotice("Transcribing audio on server...");
        try {
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": blob.type || "audio/webm" },
            body: blob
          });
          const data = await res.json();
          if (data.transcript) {
            setTranscript(data.transcript);
            setNotice("Transcription complete.");
          } else {
            setNotice(data.error || "Speech recognized was empty.");
          }
        } catch (error) {
          setNotice(error.message || "Web transcription failed.");
        } finally {
          setProcessing(false);
        }
      };
      recorder.start(250);
      setElapsed(0);
      setRecording(true);
    } catch (error) {
      setNotice(error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access in your browser/system settings."
        : `Could not access microphone: ${error.message}`);
    }
  }

  function stopRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function suggestAnswer() {
    if (!transcript.trim()) {
      setNotice("Record and transcribe a question before suggesting an answer.");
      return;
    }

    setAnswer("");
    setNotice("");
    setGenerating(true);

    if (isDesktop) {
      try {
        await window.desktopAPI.generateAnswer(transcript);
      } catch (error) {
        setGenerating(false);
        setNotice(error.message || "Answer generation failed.");
      }
      return;
    }

    // Web mode: stream from Express server /api/answer
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ question: transcript })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned HTTP ${response.status}`);
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
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.chunk) {
                setAnswer((current) => current + parsed.chunk);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (err) {
              if (err.message && !err.message.includes("JSON")) throw err;
            }
          }
        }
        if (done) break;
      }
      setGenerating(false);
    } catch (error) {
      setGenerating(false);
      if (error.name !== "AbortError") {
        setNotice(error.message || "Answer generation failed.");
      }
    } finally {
      abortControllerRef.current = null;
    }
  }

  async function cancelGeneration() {
    if (isDesktop) {
      if (window.desktopAPI?.cancelAnswer) {
        await window.desktopAPI.cancelAnswer();
      }
    } else {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
    setNotice("Answer generation stopped.");
  }

  async function copyAnswer() {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function resetSession() {
    if (recording) stopRecording();
    setTranscript("");
    setAnswer("");
    setNotice("Session cleared.");
    setElapsed(0);
  }

  const runtimeReady = status.whisper?.ready && status.ollama?.ready;

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand-mark"><AudioLines size={21} /></div>
        <div className="rail-divider" />
        <button className="rail-button active" title="Assistant"><Sparkles size={19} /></button>
        <button className="rail-button" title="Settings" onClick={refreshStatus}><Settings2 size={19} /></button>
        <div className="rail-bottom"><div className="avatar">PA</div></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-icon"><AudioLines size={19} /></div>
            <div><div className="brand-name">parakeet<span>.</span></div><div className="brand-caption">DESKTOP AI ASSISTANT</div></div>
          </div>
          <div className="topbar-right">
            <div className={`privacy-pill ${runtimeReady ? "good" : "warn"}`}>
              <ShieldCheck size={14} /> <span>{runtimeReady ? "LOCAL & PRIVATE" : "SETUP REQUIRED"}</span>
            </div>
            <button className="icon-button" onClick={refreshStatus} title="Refresh runtime status"><RotateCcw size={16} /></button>
          </div>
        </header>

        <section className="workspace">
          {!isDesktop && (
            <div className={`browser-banner ${status.ollama?.ready ? "connected" : ""}`}>
              {status.ollama?.ready ? (
                <ShieldCheck size={18} className="browser-banner-icon good" />
              ) : (
                <Globe size={18} className="browser-banner-icon" />
              )}
              <div>
                <strong>Web Deployment Mode:</strong>{" "}
                {status.ollama?.ready
                  ? `Connected to remote Ollama backend (${status.ollama.model})`
                  : status.ollama?.message || "Connecting to remote Ollama backend..."}
                <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "2px" }}>
                  Speech recognition uses in-browser Web Speech API. AI responses stream from your remote Ollama host.
                </div>
              </div>
            </div>
          )}

          <div className="welcome">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR REAL-TIME THINKING PARTNER</div>
            <h1>Listen closely.<br /><span>Respond brilliantly.</span></h1>
            <p>Capture a question, understand it locally, and shape a clear answer with your private AI assistant.</p>
          </div>

          <div className="control-card">
            <div className="control-card-top">
              <div><div className="section-kicker">SESSION CONTROL</div><div className="control-title">Audio capture</div></div>
              <div className={`recording-state ${recording ? "live" : ""}`}><span className="state-dot" />{recording ? "RECORDING" : processing ? "PROCESSING" : "STANDBY"}</div>
            </div>
            <div className={`orb-wrap ${recording ? "is-recording" : ""}`}>
              <div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
              <div className="orb"><Waves size={30} /></div>
            </div>
            <div className="timer">{formatTime(elapsed)}</div>
            <div className="capture-caption">{recording ? "Listening to your microphone…" : processing ? "Converting speech to text…" : "Ready when you are"}</div>
            <div className="control-actions">
              {!recording ? (
                <button className="primary-button" onClick={startRecording} disabled={processing}>
                  <Mic size={17} /> Start recording
                </button>
              ) : (
                <button className="stop-button" onClick={stopRecording}><CircleStop size={17} /> Stop & transcribe</button>
              )}
              <button className="secondary-button" onClick={resetSession} disabled={recording || processing}>Reset</button>
            </div>
            <div className="hotkey-hint"><Command size={12} /> Local processing · No cloud transcription</div>
          </div>

          <div className="panels-grid">
            <section className="content-panel">
              <div className="panel-heading">
                <div className="panel-icon blue"><AudioLines size={17} /></div>
                <div className="panel-heading-text"><h2>Transcription</h2><span>RECOGNIZED SPEECH</span></div>
                <div className="panel-count">{transcript ? "READY" : "AWAITING AUDIO"}</div>
              </div>
              <div className={`transcript-body ${!transcript ? "empty" : ""}`}>
                {processing ? <div className="inline-loading"><LoaderCircle className="spin" size={17} /> Transcribing with Whisper…</div> :
                  transcript || "Your transcribed question will appear here after you stop recording."}
              </div>
              <div className="panel-footer"><span><span className="mini-dot" /> WHISPER LOCAL ENGINE</span><span>{transcript ? `${transcript.trim().split(/\s+/).length} WORDS` : "—"}</span></div>
            </section>

            <section className="content-panel answer-panel">
              <div className="panel-heading">
                <div className="panel-icon purple"><Sparkles size={17} /></div>
                <div className="panel-heading-text"><h2>Suggested answer</h2><span>GENERATED LOCALLY</span></div>
                {generating && <div className="generating-label"><span className="pulse-dot" /> GENERATING</div>}
              </div>
              <div className={`answer-body ${!answer ? "empty" : ""}`}>
                {generating && !answer ? <div className="inline-loading"><LoaderCircle className="spin" size={17} /> Thinking through your question…</div> :
                  answer ? <>{answer}{generating && <span className="typing-cursor" />}</> :
                  "Your AI-generated response will appear here progressively, as the model produces it."}
              </div>
              <div className="answer-actions">
                <button className="suggest-button" onClick={suggestAnswer} disabled={!transcript || generating || processing}>
                  <Sparkles size={15} /> Suggest answer
                </button>
                {generating && <button className="small-action" onClick={cancelGeneration}>Stop</button>}
                {answer && <button className="small-action" onClick={copyAnswer}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>}
              </div>
            </section>
          </div>

          {notice && <div className="notice"><AlertCircle size={15} /><span>{notice}</span><button onClick={() => setNotice("")}>Dismiss</button></div>}

          <section className="runtime-section">
            <div className="runtime-title"><div><div className="section-kicker">ON-DEVICE INTELLIGENCE</div><h3>Local runtime status</h3></div><span className="runtime-note"><ShieldCheck size={13} /> Your audio stays on this device</span></div>
            <div className="runtime-grid">
              <RuntimeCard icon={<AudioLines size={16} />} name="Whisper.cpp" detail={status.whisper?.message || "Checking…"} ready={!!status.whisper?.ready} />
              <RuntimeCard icon={<Cpu size={16} />} name="Ollama · Qwen 2.5" detail={status.ollama?.message || "Checking…"} ready={!!status.ollama?.ready} />
            </div>
          </section>

          <footer className="footer"><span>PARAKEET DESKTOP AI <span className="footer-sep">/</span> BUILD 1.0.0</span><span><Zap size={12} /> POWERED BY LOCAL MODELS</span></footer>
        </section>
      </main>
    </div>
  );
}

function RuntimeCard({ icon, name, detail, ready }) {
  return <div className="runtime-card"><div className="runtime-card-icon">{icon}</div><div className="runtime-copy"><strong>{name}</strong><span>{detail}</span></div><div className={`runtime-badge ${ready ? "ready" : "missing"}`}><span />{ready ? "READY" : "NOT READY"}</div></div>;
}
