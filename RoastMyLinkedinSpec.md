# LinkedIn Profile Roaster — Product Specification

## Overview

**Product Name:** LinkedIn Roaster  
**Tagline:** "We read your LinkedIn so you don't have to pretend it's good."  
**One-liner:** Paste your LinkedIn profile URL or raw text, get a brutally honest roast with actionable improvement suggestions powered by Claude AI.

---

## Problem Statement

LinkedIn profiles are full of corporate jargon, vague buzzwords, and missed opportunities. Most people have no honest external feedback on how their profile reads to recruiters or peers. This tool gives them that feedback in an entertaining, memorable way — while also being genuinely useful.

---

## Core User Flow

```
User lands on page
        ↓
Inputs LinkedIn profile (URL or pasted text)
        ↓
Optionally selects "Roast Intensity" (Gentle / Medium / Savage)
        ↓
Clicks "Roast Me"
        ↓
Claude AI analyzes the profile
        ↓
Results page renders:
   → Brutal Roast (entertaining, punchy callouts)
   → Section-by-section breakdown
   → Actionable improvement tips per section
        ↓
User can copy/share the roast or export tips
```

---

## Features

### 1. Profile Input
- **Option A — Paste text:** Textarea where user pastes their LinkedIn About, Experience, Skills, Headline, etc.
- **Option B — LinkedIn URL:** Input a LinkedIn profile URL; the app fetches publicly available profile text via a scraping proxy or user-pasted HTML.
- **Validation:** Warn if input is too short (< 100 words) or looks like it's not a LinkedIn profile.

### 2. Roast Intensity Selector
Three modes that adjust the Claude system prompt tone:

| Mode | Description |
|------|-------------|
| 🔥 Gentle | Friendly ribbing, constructive tone |
| 🔥🔥 Medium | Sharp, sarcastic, brutally honest |
| 🔥🔥🔥 Savage | No mercy. Gordon Ramsay meets LinkedIn. |

### 3. AI Roast Output (Claude-powered)
The response is structured into:

#### a) The Roast (Top Section)
- A punchy, comedic paragraph-style roast of the overall profile
- Calls out clichés, hollow buzzwords, vague claims, and formatting sins
- Tone matches selected intensity

#### b) Section-by-Section Breakdown
Analyzed sections (if present):
- **Headline** — Is it a job title copy-paste? Does it communicate value?
- **About / Summary** — Wall of text? Starts with "I am a…"? Buzzword density score?
- **Experience** — Responsibilities vs. accomplishments. Bullet quality. Vague verbs ("responsible for", "helped with").
- **Skills** — Are they real? Endorsed by randos? Missing key ones?
- **Education** — Nothing to roast usually, but check for irrelevant details.
- **Recommendations** — Missing? Generic? Sounds like they wrote it themselves?
- **Activity / Posts** — If provided: Are they posting thought leadership bait?

Each section gets:
- 🔥 A roast line or two
- ✅ 2–3 concrete improvement tips

#### c) Buzzword Bingo
Highlight detected buzzwords/clichés with a count:
- "Passionate about", "results-driven", "synergy", "leverage", "thought leader", "seasoned", "dynamic", "self-starter", etc.
- Display as a visual badge/tag cloud

#### d) Profile Score (Optional, Gamification)
- Overall score out of 100 with a snarky label:
  - 0–30: "Recruiter repellent"
  - 31–55: "Safely ignored"
  - 56–74: "Almost hireable"
  - 75–89: "Not bad, overachiever"
  - 90–100: "Who are you and why are you here?"

### 4. Export / Share
- **Copy Roast** button — copies just the roast text to clipboard
- **Copy Tips** button — copies improvement suggestions
- **Share on X/Twitter** — pre-filled tweet: "I got my LinkedIn profile roasted 🔥 — score: XX/100. 'Recruiter repellent.' Try yours at [URL]"

---

## Technical Architecture

### Frontend
- **Framework:** React (single-page app)
- **Styling:** Tailwind CSS
- **State:** React hooks (useState, useEffect)
- **Artifact type:** `.jsx` React component

### AI Backend
- **Provider:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Integration:** Direct API call from frontend (API key injected via proxy or environment)
- **Structured output:** Claude prompted to return JSON with defined schema

### Claude Prompt Strategy

**System prompt** (varies by intensity):

```
You are a brutally honest LinkedIn profile critic. Your job is to roast the 
provided LinkedIn profile [with {intensity} intensity] and provide genuine 
improvement advice. Be specific, cite actual text from the profile, and 
never be vague. Return ONLY valid JSON, no markdown fences.
```

**Response JSON schema:**

```json
{
  "overall_roast": "string — punchy paragraph roast",
  "score": 0-100,
  "score_label": "string",
  "buzzwords_found": ["array", "of", "strings"],
  "sections": {
    "headline": {
      "roast": "string",
      "tips": ["tip1", "tip2", "tip3"]
    },
    "about": { ... },
    "experience": { ... },
    "skills": { ... },
    "recommendations": { ... }
  }
}
```

---

## UI Design Direction

### Aesthetic
- **Vibe:** Dark, irreverent, editorial. Like a satirical tech magazine.
- **Background:** Near-black (`#0D0D0D`) with off-white text
- **Accent:** Flame orange (`#FF5C1A`) for roast elements; cool blue (`#3B82F6`) for tips/improvements
- **Typography:** Punchy display font (e.g., Syne or Space Grotesk) for roast text; clean monospace for structured output
- **Tone signals:** 🔥 emoji used sparingly, fire motif as a visual divider

### Key UI Components
- `<IntensitySelector />` — toggle group with 3 flame levels
- `<RoastCard />` — dark card with the main roast paragraph, styled dramatically
- `<SectionBreakdown />` — accordion or card list per LinkedIn section
- `<BuzzwordBadges />` — tag cloud of detected clichés, highlighted in orange
- `<ScoreMeter />` — circular or bar progress indicator with snarky label
- `<ActionableTips />` — clean checklist-style cards in blue tones
- `<ShareBar />` — sticky bottom bar with copy/share buttons

### Loading State
- Show animated fire/roasting metaphor while Claude processes
- Witty loading messages: "Counting your buzzwords…", "Judging your photo…", "Consulting the rejection pile…"

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Input too short | "We need more to work with. Paste at least your About + Experience." |
| API timeout | "Claude got tired of reading. Try again." |
| No sections detected | "This doesn't look like a LinkedIn profile. Unless you work in abstract art." |
| API error | Generic retry with error code shown |

---

## Constraints & Scope

### In Scope (v1)
- Paste-text input only (URL scraping is v2)
- Single-page React artifact
- Three intensity modes
- Structured roast output with tips
- Share/copy functionality
- Mobile-responsive

### Out of Scope (v1)
- LinkedIn OAuth / live profile fetching
- User accounts or saved history
- PDF export
- Side-by-side before/after editor
- Multi-language support

---

## Success Metrics
- Time-to-roast < 10 seconds
- Users share or copy output (engagement signal)
- Improvement tips are specific enough to act on (qualitative)
- The roast is entertaining enough to be shared publicly

---

## Future Enhancements (v2+)
- LinkedIn URL scraping via proxy
- "Before & After" mode — paste improved version and see score delta
- Industry-specific roasting (SaaS vs. Finance vs. Academia)
- Resume roaster (PDF upload)
- Leaderboard of worst buzzword offenders (anonymized, opt-in)

---

*Spec version: 1.0 | Author: Vamsi J | Date: June 2026*
