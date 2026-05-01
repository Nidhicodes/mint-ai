# 🌿 Mint AI

**Your personal AI app store.** Describe any app you want. Get it instantly.

Mint AI generates complete, working web applications from natural language descriptions. Everything runs locally in your browser — no server, no API key required, no cost.

## Features

- **AI-Powered Generation** — Describe any app in plain English, get a working app in seconds
- **100% Local** — Runs entirely in your browser via WebLLM. No data leaves your device
- **Version History** — Every modification is versioned. Roll back to any previous version
- **Share Anywhere** — Share via URL, GitHub Gist, or file download
- **Fork & Remix** — Fork any app from the gallery into your personal library
- **Multi-Provider** — Supports WebLLM (free), DeepSeek, OpenAI, Anthropic, Ollama

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:4321` and start creating.

## Tech Stack

- **Frontend**: Astro + Svelte 5 + Tailwind CSS v4
- **AI**: WebLLM (in-browser), DeepSeek, OpenAI, Anthropic, Ollama
- **Storage**: IndexedDB (apps + versions), localStorage (config)
- **Sharing**: URL fragment encoding (pako), GitHub Gist API

## Architecture

Mint AI is a static site with zero backend. All AI inference happens either in the browser (WebLLM) or via the user's own API keys. Apps are stored in IndexedDB and never leave the device.

## License

MIT
