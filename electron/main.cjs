const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { transcribeAudio, checkWhisperReady } = require("./services/whisper.cjs");
const { streamAnswer, checkOllamaReady } = require("./services/ollama.cjs");

let mainWindow;
let activeGeneration = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1060,
    minHeight: 720,
    backgroundColor: "#090d16",
    title: "Parakeet Desktop AI",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("system:status", async () => {
  const [whisper, ollama] = await Promise.all([
    checkWhisperReady(),
    checkOllamaReady()
  ]);
  return { whisper, ollama, platform: process.platform };
});

ipcMain.handle("audio:transcribe", async (event, payload) => {
  if (!payload || !payload.audio || !payload.audio.byteLength) {
    throw new Error("No recorded audio was received.");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "parakeet-"));
  const inputPath = path.join(tempDir, "recording.webm");

  try {
    await fs.writeFile(inputPath, Buffer.from(payload.audio));
    const transcript = await transcribeAudio(inputPath, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("audio:transcription-progress", progress);
      }
    });
    return { transcript };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

ipcMain.handle("answer:generate", async (event, question) => {
  if (typeof question !== "string" || !question.trim()) {
    throw new Error("Transcribe a question before requesting an answer.");
  }
  if (activeGeneration) activeGeneration.abort();
  const controller = new AbortController();
  activeGeneration = controller;

  try {
    await streamAnswer(question.trim(), (chunk) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("answer:chunk", chunk);
      }
    }, controller.signal);
    if (!event.sender.isDestroyed()) event.sender.send("answer:complete");
    return { success: true };
  } catch (error) {
    if (error.name === "AbortError") return { success: false, cancelled: true };
    if (!event.sender.isDestroyed()) {
      event.sender.send("answer:error", error.message || "Answer generation failed.");
    }
    throw error;
  } finally {
    if (activeGeneration === controller) activeGeneration = null;
  }
});

ipcMain.handle("answer:cancel", async () => {
  if (activeGeneration) activeGeneration.abort();
  activeGeneration = null;
  return { success: true };
});

ipcMain.handle("app:show-error", async (_event, message) => {
  await dialog.showMessageBox({
    type: "error",
    title: "Parakeet Desktop AI",
    message: String(message || "An unexpected error occurred.")
  });
});
