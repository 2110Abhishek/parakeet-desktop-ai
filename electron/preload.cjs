const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getSystemStatus: () => ipcRenderer.invoke("system:status"),
  transcribeAudio: (audio) => ipcRenderer.invoke("audio:transcribe", { audio }),
  generateAnswer: (question) => ipcRenderer.invoke("answer:generate", question),
  cancelAnswer: () => ipcRenderer.invoke("answer:cancel"),
  showError: (message) => ipcRenderer.invoke("app:show-error", message),
  onTranscriptionProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("audio:transcription-progress", listener);
    return () => ipcRenderer.removeListener("audio:transcription-progress", listener);
  },
  onAnswerChunk: (callback) => {
    const listener = (_event, chunk) => callback(chunk);
    ipcRenderer.on("answer:chunk", listener);
    return () => ipcRenderer.removeListener("answer:chunk", listener);
  },
  onAnswerComplete: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("answer:complete", listener);
    return () => ipcRenderer.removeListener("answer:complete", listener);
  },
  onAnswerError: (callback) => {
    const listener = (_event, error) => callback(error);
    ipcRenderer.on("answer:error", listener);
    return () => ipcRenderer.removeListener("answer:error", listener);
  }
});
