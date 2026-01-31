# Running Hub Web

AI Image Generator dengan dukungan RunningHub API dan ComfyUI.

## Setup

```bash
npm install
```

## Configuration

1. Copy file contoh:
```bash
cp .env.example .env.local
cp storage/token.example.json storage/token.json
```

2. Edit `.env.local`:
```
COMFYUI_API_URL=https://your-comfyui-server.com
```

3. Edit `storage/token.json` dengan token RunningHub kamu (untuk fitur Home)

4. Pastikan `storage/comfyui.json` dan `storage/imageWorkflow.json` sudah ada

## Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Features

- **Home** (`/`) - Generate via RunningHub API
- **ComfyUI** (`/comfyui`) - Generate via ComfyUI API langsung
- **Gallery** (`/gallery`) - Lihat hasil generate

## Folder Structure

```
web/
├── app/
│   ├── api/
│   │   ├── comfyui/     # ComfyUI API endpoint
│   │   ├── gallery/     # Gallery API
│   │   └── generate/    # RunningHub API endpoint
│   ├── comfyui/         # ComfyUI page
│   ├── gallery/         # Gallery page
│   └── page.jsx         # Home page
├── storage/
│   ├── comfyui.json     # ComfyUI workflow
│   ├── imageWorkflow.json # RunningHub workflow
│   ├── token.json       # RunningHub token (gitignored)
│   ├── gallery.json     # Gallery data (gitignored)
│   └── generated/       # Generated images (gitignored)
└── .env.local           # Environment variables (gitignored)
```
