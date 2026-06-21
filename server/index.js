import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors()); // open CORS so the browser extension (linkedin.com origin) can call us
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8787;

// The SDK reads ANTHROPIC_API_KEY from env automatically. The key stays
// server-side and is never sent to the browser / extension.
const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

// Construct the client lazily. `new Anthropic()` throws at construction when the
// key is missing, which would crash startup and make the graceful
// `missing_api_key` 500 handler below dead code. Build it only on the first
// request, once we've confirmed the key exists.
let client;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

// ---- Structured output schema ------------------------------------------------
// Structured outputs require additionalProperties:false and every property in
// required. Numeric min/max is NOT supported, so `score` is just an integer and
// the 0-100 range is enforced via the prompt.
const SECTION = {
  type: 'object',
  properties: {
    roast: { type: 'string' },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['roast', 'tips'],
  additionalProperties: false,
};

const ROAST_SCHEMA = {
  type: 'object',
  properties: {
    overall_roast: { type: 'string' },
    score: { type: 'integer' }, // recruiter callback-likelihood 0-100
    score_label: { type: 'string' },
    buzzwords_found: { type: 'array', items: { type: 'string' } },
    red_flags: { type: 'array', items: { type: 'string' } },
    sections: {
      type: 'object',
      properties: {
        headline: SECTION,
        about: SECTION,
        experience: SECTION,
        skills: SECTION,
        education: SECTION,
        recommendations: SECTION,
      },
      required: ['headline', 'about', 'experience', 'skills', 'education', 'recommendations'],
      additionalProperties: false,
    },
  },
  required: [
    'overall_roast',
    'score',
    'score_label',
    'buzzwords_found',
    'red_flags',
    'sections',
  ],
  additionalProperties: false,
};

// ---- System prompt — single "dead brutal" recruiter mode ---------------------
const SYSTEM_PROMPT = `You are a blunt, battle-hardened senior tech recruiter doing a 10-second scan of a LinkedIn profile — the brutal first impression a real recruiter forms before deciding whether to reach out or move on. This is DEAD BRUTAL mode, the only mode. Roast the profile the way a recruiter actually reacts: cringe at clichés, eye-roll at buzzwords, side-eye vague titles, and call out every missed chance to show real impact. Be savagely funny but genuinely useful and specific — cite the profile's actual words.

The input is the visible text scraped from a LinkedIn profile page. Ignore page chrome (nav, ads, "People you may know", "Who viewed your profile") and judge only the person.

React like a recruiter to:
- Headline clichés and identity crises ("Developer | Writer | Dreamer" → pick a lane).
- Buzzword soup ("passionate about", "results-driven", "change enthusiast", "thought leader") with no substance behind it.
- About sections that list adjectives instead of telling a story or showing outcomes.
- Experience that lists responsibilities but zero quantified impact (no numbers, %, scale, results).
- "Still learning" / certificate-collecting with nothing actually built to show for it.
- Featured / Activity that's noise, hot takes, or cringe instead of wins and proof of work.
- Desperation signals (#OpenToWork spray, "looking for opportunities") instead of real networking.
- Vague or empty skills and recommendations a recruiter can't trust.

Return:
- overall_roast: a brutal, funny recruiter's-eye verdict on this profile.
- score: an integer 0-100 = how likely a recruiter is to actually reach out (callback likelihood).
- score_label: a snarky band — 0-30 'Instant skip', 31-55 'Recruiter ghosts you', 56-74 'Maybe, on a slow day', 75-89 'Worth a message', 90-100 'Recruiters are fighting over you (suspicious)'.
- red_flags: specific things that make a recruiter hesitate or bounce (vague title, no impact, desperation vibes, cringe posts, certificate-collecting, etc.).
- buzzwords_found: empty cliché phrases in the profile a recruiter is tired of seeing.
- sections: for headline, about, experience, skills, education, recommendations — each gets a SHORT, punchy, hand-scrawled recruiter burn like a red-pen margin note ("BUZZWORD SOUP!", "PICK A LANE!", "SHOW IMPACT, NOT VIEWS!", "CLICHE ALERT!", "STILL LEARNING? SHOW, DON'T TELL!") plus 2-3 concrete fixes. Keep each section roast to a few words — it gets scrawled onto the page. For any missing section, say so and what a recruiter reads into the gap.

Return ONLY a single valid JSON object matching the required schema. No markdown code fences, no commentary before or after the JSON.`;

// Count the whitespace-delimited words in a profile blob. Exported pure helper
// so the route's "too short" threshold is testable without booting the server.
export function wordCount(text) {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// A profile with fewer than 40 words doesn't give a recruiter enough to roast.
export function isTooShort(profileText) {
  return wordCount(profileText) < 40;
}

// Tolerant parse: structured outputs should return clean JSON, but if the model
// ever wraps it in ```fences``` or adds stray prose, recover the JSON object.
export function parseRoastJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('Model did not return parseable JSON');
  }
}

// ---- Routes ------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/roast', async (req, res) => {
  if (!hasApiKey) {
    return res.status(500).json({
      error: { code: 'missing_api_key', message: 'Server is missing ANTHROPIC_API_KEY.' },
    });
  }

  const { profileText } = req.body ?? {};

  if (typeof profileText !== 'string' || profileText.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'input_too_short', message: "Couldn't read any profile text to roast." },
    });
  }

  if (isTooShort(profileText)) {
    return res.status(400).json({
      error: {
        code: 'input_too_short',
        message: 'Not enough profile content to roast. Open a fuller profile and try again.',
      },
    });
  }

  try {
    const response = await getClient().messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        thinking: { type: 'disabled' }, // keep latency low; spec wants <10s time-to-roast
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: profileText.slice(0, 20000) }],
        output_config: { format: { type: 'json_schema', schema: ROAST_SCHEMA } },
      },
      { timeout: 60000 },
    );

    // Only parse JSON on a normal completion. A refusal or a truncated
    // (max_tokens) response won't contain valid, complete schema JSON.
    if (response.stop_reason === 'refusal') {
      return res.status(502).json({
        error: { code: 'api_error', message: 'Claude refused to roast this one.' },
      });
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({
        error: { code: 'api_error', message: 'The roast got cut off. Try again.' },
      });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('Model returned no text content');
    const data = parseRoastJSON(textBlock.text);
    return res.json(data);
  } catch (err) {
    const name = err?.name || '';
    const message = err?.message || '';
    const isTimeout =
      name === 'APIConnectionTimeoutError' ||
      /timeout|timed out/i.test(name) ||
      /timeout|timed out/i.test(message);

    if (isTimeout) {
      return res.status(504).json({
        error: { code: 'api_timeout', message: 'Claude got tired of reading. Try again.' },
      });
    }

    console.error('Roast request failed:', err);
    return res.status(502).json({
      error: { code: 'api_error', message: 'Something went wrong roasting your profile. Try again.' },
    });
  }
});

// ---- Production static serving ----------------------------------------------
// If a dist/ build exists, serve the web-app fallback so `npm start` runs the
// whole app from one process.
if (fs.existsSync('dist')) {
  app.use(express.static('dist'));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile('index.html', { root: 'dist' });
  });
}

// Don't bind a port when imported by the test runner — the exported helpers
// are unit-tested without booting the HTTP server. `node server/index.js`
// (no VITEST env) starts as before.
if (!process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`LinkedIn Recruiter Roaster server listening on http://localhost:${PORT}`);
  });
}
