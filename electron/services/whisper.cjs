const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { app } = require("electron");
const ffmpegPath = require("ffmpeg-static");

function appRoot() {
  return (app && app.isPackaged)
    ? process.resourcesPath
    : path.join(__dirname, "..", "..");
}

function resolveWhisperPaths() {
  const root = appRoot();
  const binaryName = process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
  return {
    binary: path.join(root, "bin", binaryName),
    model: path.join(root, "models", "ggml-base.en.bin")
  };
}

function runProcess(command, args, onStdout) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stdout.on("data", (data) => onStdout?.(data.toString()));
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function checkWhisperReady() {
  const paths = resolveWhisperPaths();
  const ready = fs.existsSync(paths.binary) && fs.existsSync(paths.model) && !!ffmpegPath;
  return {
    ready,
    binaryFound: fs.existsSync(paths.binary),
    modelFound: fs.existsSync(paths.model),
    ffmpegFound: !!ffmpegPath,
    message: ready
      ? "Local Whisper.cpp engine ready."
      : "Place whisper-cli.exe in the bin folder and ggml-base.en.bin in models."
  };
}

async function transcribeAudio(webmPath, onProgress) {
  const paths = resolveWhisperPaths();
  const status = await checkWhisperReady();
  if (!status.ready) {
    throw new Error("Whisper is not configured. Follow the README setup steps to add whisper-cli.exe and the model file.");
  }

  const wavPath = path.join(os.tmpdir(), `parakeet-${Date.now()}.wav`);
  const outputBase = path.join(os.tmpdir(), `parakeet-transcript-${Date.now()}`);
  const outputText = `${outputBase}.txt`;

  try {
    onProgress?.("Converting microphone audio...");
    await runProcess(ffmpegPath, [
      "-y", "-i", webmPath, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath
    ]);

    onProgress?.("Running local Whisper transcription...");
    await runProcess(paths.binary, [
      "-m", paths.model,
      "-f", wavPath,
      "-otxt",
      "-of", outputBase,
      "-nt"
    ]);

    const transcript = await fs.promises.readFile(outputText, "utf8");
    if (!transcript.trim()) throw new Error("Whisper did not detect any speech. Try recording again.");
    return transcript.trim();
  } finally {
    await Promise.all([wavPath, outputText].map((file) =>
      fs.promises.rm(file, { force: true }).catch(() => {})
    ));
  }
}

module.exports = { transcribeAudio, checkWhisperReady };
