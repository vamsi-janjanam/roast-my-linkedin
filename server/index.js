import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8787;

// The SDK reads ANTHROPIC_API_KEY from env automatically. Construct the client
// once. If the key is missing we still start the server, but /api/roast returns
// a 500 with a clear error (handled in the route below).
const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
const client = new Anthropic();

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
    score: { type: 'integer' },
    score_label: { type: 'string' },
    buzzwords_found: { type: 'array', items: { type: 'string' } },
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
  required: ['overall_roast', 'score', 'score_label', 'buzzwords_found', 'sections'],
  additionalProperties: false,
};

// ---- System prompt -----------------------------------------------------------
const TONE = {
  gentle: 'friendly ribbing, constructive and warm',
  medium: 'sharp, sarcastic, brutally honest',
  savage:
    'no mercy, Gordon Ramsay meets LinkedIn — still useful, never slurs or protected-class insults',
};

function SYSTEM_PROMPT_FOR(intensity) {
  return `You are a brutally honest LinkedIn profile critic. Roast the provided profile and provide genuine, specific improvement advice. Cite actual text from the profile; never be vague. Detect clichés/buzzwords (e.g. 'passionate about', 'results-driven', 'synergy', 'leverage', 'thought leader', 'seasoned', 'dynamic', 'self-starter'). Score the profile 0–100 (the score must be an integer between 0 and 100) and give a snarky score_label using these bands: 0–30 'Recruiter repellent', 31–55 'Safely ignored', 56–74 'Almost hireable', 75–89 'Not bad, overachiever', 90–100 'Who are you and why are you here?'. For any section not present in the input, set its roast to a short note that it wasn't provided and give tips on adding it. Return tips as 2–3 concrete, actionable items per section.

Tone for this roast: ${TONE[intensity]}.

Return ONLY a single valid JSON object matching the required schema. No markdown code fences, no commentary before or after the JSON.`;
}

// Tolerant parse: structured outputs should return clean JSON, but if the model
// ever wraps it in ```fences``` or adds stray prose, recover the JSON object.
function parseRoastJSON(text) {
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
      error: {
        code: 'missing_api_key',
        message: 'Server is missing ANTHROPIC_API_KEY.',
      },
    });
  }

  const { profileText } = req.body ?? {};
  let { intensity } = req.body ?? {};

  // Validate profileText.
  if (typeof profileText !== 'string' || profileText.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: 'input_too_short',
        message: 'We need more to work with. Paste at least your About + Experience.',
      },
    });
  }

  const wordCount = profileText.trim().split(/\s+/).length;
  if (wordCount < 100) {
    return res.status(400).json({
      error: {
        code: 'input_too_short',
        message: 'We need more to work with. Paste at least your About + Experience.',
      },
    });
  }

  // Coerce intensity to a valid value; default to medium.
  if (intensity !== 'gentle' && intensity !== 'medium' && intensity !== 'savage') {
    intensity = 'medium';
  }

  try {
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        thinking: { type: 'disabled' }, // keep latency low; spec wants <10s time-to-roast
        system: SYSTEM_PROMPT_FOR(intensity),
        messages: [{ role: 'user', content: profileText }],
        output_config: {
          format: { type: 'json_schema', schema: ROAST_SCHEMA },
        },
      },
      { timeout: 60000 },
    );

    // With output_config.format, the first text block is valid JSON; parseRoastJSON
    // also recovers if the model ever wraps it in fences or stray prose.
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
        error: {
          code: 'api_timeout',
          message: 'Claude got tired of reading. Try again.',
        },
      });
    }

    console.error('Roast request failed:', err);
    return res.status(502).json({
      error: {
        code: 'api_error',
        message: 'Something went wrong roasting your profile. Try again.',
      },
    });
  }
});

// ---- Production static serving ----------------------------------------------
// If a dist/ build exists, serve it so `npm run build && npm start` runs the
// whole app from one process.
if (fs.existsSync('dist')) {
  app.use(express.static('dist'));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile('index.html', { root: 'dist' });
  });
}

app.listen(PORT, () => {
  console.log(`LinkedIn Roaster server listening on http://localhost:${PORT}`);
});
