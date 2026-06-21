# LinkedIn Roaster 🔥

> _We read your LinkedIn so you don't have to pretend it's good._

Paste your LinkedIn profile text, pick a roast intensity, and get a brutally honest
(but genuinely useful) critique powered by Claude — complete with a section-by-section
breakdown, actionable tips, buzzword detection, and a snarky profile score.

## Features

- **Paste-text input** with a live word count and a soft warning under 100 words.
- **Three roast intensities** — 🔥 Gentle / 🔥🔥 Medium / 🔥🔥🔥 Savage — that adjust Claude's tone.
- **Structured roast output**:
  - A punchy overall roast.
  - Section-by-section breakdown (headline, about, experience, skills, education, recommendations), each with a roast line and 2–3 concrete improvement tips.
  - **Buzzword Bingo** — a tag cloud of detected clichés.
  - **Profile score** out of 100 with a snarky label band.
- **Share / copy** — Copy Roast, Copy Tips, and Share on X with a prefilled tweet.
- **Dark, irreverent, editorial UI** — Tailwind v4, flame orange for roasts and cool blue for tips. Mobile-responsive.

## Architecture

| Layer | Stack | Notes |
|-------|-------|-------|
| Frontend | React 18 + Vite + Tailwind v4 | Single self-contained component in `src/App.jsx`. |
| Backend | Express proxy (`server/index.js`) | Holds the Anthropic API key server-side and exposes `POST /api/roast`. |
| AI | Claude `claude-sonnet-4-6` via `@anthropic-ai/sdk` | Structured JSON output via `output_config.format`. |

The API key is **only** read by the server from an environment variable — it is never
shipped to the browser. In development, Vite proxies `/api` to the Express server on
port `8787`.

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup & run

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the whole app with one command
npm start
```

`npm start` builds the frontend and serves the app **and** the API from a single
process. Open **http://localhost:8787**.

### Development (hot reload)

For live-reloading while you work, use:

```bash
npm run dev
```

This runs the Vite dev server (http://localhost:5173) and the Express proxy
(`:8787`) together; Vite proxies `/api` requests to the server.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. Read only by the server. |
| `PORT` | No | Port the Express proxy listens on (default `8787`). |

## API

### `POST /api/roast`

**Request**
```json
{ "profileText": "string", "intensity": "gentle | medium | savage" }
```

**Response `200`**
```json
{
  "overall_roast": "string",
  "score": 0,
  "score_label": "string",
  "buzzwords_found": ["string"],
  "sections": {
    "headline":        { "roast": "string", "tips": ["string"] },
    "about":           { "roast": "string", "tips": ["string"] },
    "experience":      { "roast": "string", "tips": ["string"] },
    "skills":          { "roast": "string", "tips": ["string"] },
    "education":       { "roast": "string", "tips": ["string"] },
    "recommendations": { "roast": "string", "tips": ["string"] }
  }
}
```

**Errors** — non-2xx with `{ "error": { "code": "string", "message": "string" } }`.
Codes: `input_too_short`, `api_timeout`, `api_error`, `missing_api_key`.

### `GET /api/health`

Returns `{ "ok": true }`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | **Run the whole app** — builds the SPA and serves it + the API on `:8787`. |
| `npm run dev` | Development mode: Vite dev server + Express proxy together (hot reload). |
| `npm run build` | Build the production SPA into `dist/`. |
| `npm run serve` | Serve an existing `dist/` build + the API (no rebuild). |
| `npm run preview` | Preview the production build with Vite. |

## Project structure

```
.
├── index.html            # Vite entry, loads fonts
├── vite.config.js        # Vite + Tailwind + /api dev proxy
├── server/
│   └── index.js          # Express proxy + Claude integration
└── src/
    ├── main.jsx          # React entry
    ├── App.jsx           # The entire UI (single artifact)
    └── index.css         # Tailwind theme tokens + animations
```

## Scope

**v1 (this build):** paste-text input, three intensities, structured roast output with
tips, buzzword detection, profile score, copy/share, mobile-responsive.

**Out of scope (v1):** LinkedIn URL scraping / OAuth, user accounts or saved history,
PDF export, before/after editor, multi-language.

## License

See [LICENSE](./LICENSE).
