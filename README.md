# LinkedIn Recruiter Roaster 🔥

> _The brutal first impression a recruiter forms in 10 seconds — scrawled onto the profile._

A browser extension that marks up a live LinkedIn profile in **red pen, like a recruiter
who's seen it all**: handwritten burns, arrows pointing at the exact problem, circled
headings, scratch-outs over the buzzword soup, and a sticky "recruiter's notes" card.
Because it reads the profile straight from the page you're already viewing, there's
**no scraping API, no LinkedIn OAuth, no paid lookups** — and it works on any profile
you can see while logged in.

A small Express server holds the Anthropic key and does the Claude call; the extension
(and an optional paste-text web app) talk to it.

There is exactly **one mode: Dead Brutal.**

## How it works

```
LinkedIn profile page
        │  (extension reads the visible DOM)
        ▼
Express proxy  ──►  Claude (claude-sonnet-4-6)  ──►  structured recruiter roast
        │
        ▼
Red-pen markup (callouts, arrows, scribbles) + notes card painted onto the page
```

The Anthropic key lives only in the server's environment — it never reaches the
browser.

## Features

- **In-page red-pen markup** — a floating "Roast this profile 🔥" button on `linkedin.com/in/*`; click it and the profile gets handwritten burns, arrows pointing at each spot, circled headings, and scratch-outs over the cringe.
- **Reads the page DOM** — no scraping service, no OAuth, no extra API keys.
- **Recruiter's-eye & dead brutal** — every burn is the gut reaction a real recruiter has; cites the profile's actual words.
- **Structured output**: an overall recruiter verdict, per-section margin-note burns (headline, about, experience, skills, education, recommendations), recruiter red flags, dead-weight buzzwords, and a callback-likelihood score with a snarky label.
- **Paste-text web app** — an optional fallback at `localhost:8787` for roasting text you paste in.

## Repository layout

```
.
├── server/
│   └── index.js          # Express proxy + Claude integration (POST /api/roast)
├── extension/            # Chrome/Edge extension (Manifest V3)
│   ├── manifest.json
│   ├── content.js        # DOM extraction + API call + on-page overlay
│   └── overlay.css       # red-marker callout + score-panel styles
├── src/                  # Optional paste-text web-app fallback
│   ├── main.jsx
│   ├── App.jsx
│   └── index.css
├── index.html
└── vite.config.js
```

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Run the backend

```bash
npm install

cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...

npm start          # builds the web fallback and serves the API on :8787
```

The extension calls `http://localhost:8787` by default, so the server must be running
for roasts to work. (For development with hot reload, use `npm run dev` instead.)

### 2. Load the browser extension

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Go to any `https://www.linkedin.com/in/...` profile and click the floating
   **Roast this profile 🔥** button (bottom-right).

> The default backend URL is `http://localhost:8787`. If you deploy the server
> elsewhere, change `API_BASE` at the top of `extension/content.js` and add that
> origin to `host_permissions` in `extension/manifest.json`.

### 3. (Optional) Use the paste-text web app

Open **http://localhost:8787**, paste your headline/About/Experience/Skills, and roast.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key. Read only by the server. |
| `PORT` | No | Port the Express proxy listens on (default `8787`). |

## API

### `POST /api/roast`

**Request**
```json
{ "profileText": "string (the visible profile text)" }
```

**Response `200`**
```json
{
  "overall_roast": "string",
  "score": 0,
  "score_label": "string",
  "buzzwords_found": ["string"],
  "red_flags": ["string"],
  "sections": {
    "headline":        { "roast": "string", "tips": ["string"] },
    "about":           { "roast": "string", "tips": ["string"] },
    "experience":      { "roast": "string", "tips": ["string"] },
    "projects":        { "roast": "string", "tips": ["string"] },
    "activity":        { "roast": "string", "tips": ["string"] },
    "skills":          { "roast": "string", "tips": ["string"] },
    "education":       { "roast": "string", "tips": ["string"] },
    "recommendations": { "roast": "string", "tips": ["string"] }
  },
  "completeness": {
    "percent": 0,
    "checks": {
      "custom_url":     { "status": "good|warn|bad", "note": "string" },
      "location":       { "status": "good|warn|bad", "note": "string" },
      "profile_photo":  { "status": "good|warn|bad", "note": "string" },
      "banner":         { "status": "good|warn|bad", "note": "string" },
      "links":          { "status": "good|warn|bad", "note": "string" },
      "contact_info":   { "status": "good|warn|bad", "note": "string" },
      "featured":       { "status": "good|warn|bad", "note": "string" },
      "certifications": { "status": "good|warn|bad", "note": "string" }
    }
  }
}
```

`score` is the recruiter callback-likelihood (0–100); `score_label` is its snarky band.
`completeness.percent` is a separate 0–100 estimate of how finished the profile looks;
each of the eight `completeness.checks` is a `good`/`warn`/`bad` status with a short note.
When the request is plain pasted text (no extension "Profile signals" block), the
presence-only checks come back as `warn` ("Can't see this in pasted text").
Each `sections[*].roast` is a short, punchy margin-note burn; the extension scrawls it
next to the matching section with an arrow.

**Errors** — non-2xx with `{ "error": { "code": "string", "message": "string" } }`.
Codes: `input_too_short`, `missing_api_key`, `api_timeout`, `api_error`.

### `GET /api/health`

Returns `{ "ok": true }`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Build the web fallback and serve it + the API on `:8787`. |
| `npm run dev` | Development mode: Vite dev server + Express proxy (hot reload). |
| `npm run build` | Build the web fallback into `dist/`. |
| `npm run serve` | Serve an existing build + the API (no rebuild). |

## Notes & limitations

- **DOM extraction is heuristic.** LinkedIn's markup changes often; if a section
  isn't found, its callout is skipped (the overall panel still appears). Selectors
  live in `extension/content.js`.
- **You must be able to see the profile.** The extension reads what's rendered, so
  log in and open the full profile before roasting.
- **Each roast is one Claude call** — costs apply per roast on your Anthropic key.

## Scope

**In scope:** in-page extension roast (DOM read), single dead-brutal ATS mode,
structured ATS roast (missing keywords, buzzwords, section callouts, ATS score),
paste-text web fallback.

**Out of scope:** LinkedIn OAuth / official API (can't return profile content),
third-party scraping services, user accounts or saved history, PDF export,
multi-language.

## License

See [LICENSE](./LICENSE).
