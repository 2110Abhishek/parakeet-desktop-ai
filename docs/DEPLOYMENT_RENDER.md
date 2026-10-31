# Deploying Parakeet AI to Render

This guide walks you through deploying Parakeet AI as a fullstack web service on [Render](https://render.com/).

---

## Architecture Overview

- **Frontend:** Built with Vite + React, served by Express as static assets (`dist/`).
- **Backend:** Node.js Express server (`server/index.cjs`) handling:
  - System health checks (`/api/status`)
  - Server-Sent Events (SSE) streaming answers (`/api/answer`)
  - Audio transcription bridge (`/api/transcribe`)
- **Speech Recognition:** Uses the in-browser Web Speech API (zero latency, free) with optional cloud Whisper API fallback (`GROQ_API_KEY` or `OPENAI_API_KEY`).
- **LLM Engine:** Proxies streaming requests to your remote Ollama endpoint (`OLLAMA_URL`).

---

## Step 1: Push Code to GitHub

Make sure your changes are committed and pushed to GitHub:

```bash
git add .
git commit -m "Add fullstack web server and Render deployment configuration"
git push origin main
```

*(Note: `models/*.bin` and `bin/*.exe` are safely excluded by `.gitignore` so your repository stays lightweight).*

---

## Step 2: Make Your Ollama Server Reachable

Since Render runs in the cloud, it must be able to reach your Ollama instance over HTTP/HTTPS:

### Option A: If Ollama is running on your local PC
You can expose your local Ollama port (`11434`) using **Cloudflare Tunnels** or **ngrok**:

```bash
# Using ngrok (quickest):
ngrok http 11434
```
Copy the generated public URL (e.g., `https://abc-123.ngrok-free.app`).

> [!NOTE]
> If using Ollama locally with ngrok, ensure `OLLAMA_ORIGINS="*"` is set in your environment if CORS headers are checked by Ollama.

### Option B: If Ollama is hosted on a cloud VPS / GPU server
Use your server's public IP or domain name:
`http://your-server-ip:11434`

---

## Step 3: Create a Web Service on Render

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`parakeet-desktop-ai`).
4. Configure the service settings:
   - **Name:** `parakeet-ai` (or your preferred name)
   - **Region:** Any (e.g., *Oregon* or *Frankfurt*)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     npm run start:web
     ```
   - **Instance Type:** `Free`

---

## Step 4: Configure Environment Variables

Under the **Environment Variables** section on Render, add:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Production environment flag |
| `OLLAMA_URL` | `https://your-ollama-url` | Public URL of your Ollama instance |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | Model name (must be pulled on the Ollama host) |
| `GROQ_API_KEY` | *(Optional)* | Groq API key for cloud Whisper transcription |
| `OPENAI_API_KEY` | *(Optional)* | OpenAI API key for cloud Whisper transcription |

---

## Step 5: Deploy and Test

1. Click **Deploy Web Service**.
2. Wait 1–2 minutes for the build to finish.
3. Open your generated Render URL (`https://parakeet-ai.onrender.com`).
4. The status badge will show:
   - 🟢 `Connected to remote Ollama backend (qwen2.5:1.5b)`
   - 🟢 `In-browser Web Speech API active`
5. Click **Start recording**, speak a prompt, click **Stop & transcribe**, then click **Suggest answer** to stream the response!
