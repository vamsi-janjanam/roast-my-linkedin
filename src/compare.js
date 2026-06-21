// Pure comparison engine for the "Before & After" feature.
// Diffs two /api/roast result objects with no side effects.

const clampScore = (val) => {
  const n = Number(val)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(100, Math.trunc(n)))
}

const toArray = (val) => (Array.isArray(val) ? val : [])

const normalize = (s) => String(s).trim().toLowerCase()

// Items in `source` whose normalized form is absent from `other`.
// Preserves original text from `source`, deduped by normalized key.
const diffArrays = (source, other) => {
  const otherKeys = new Set(toArray(other).map(normalize))
  const seen = new Set()
  const out = []
  for (const item of toArray(source)) {
    const key = normalize(item)
    if (otherKeys.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export function compareRoasts(before, after) {
  const b = before || {}
  const a = after || {}
  const scoreBefore = clampScore(b.score)
  const scoreAfter = clampScore(a.score)
  return {
    scoreBefore,
    scoreAfter,
    scoreDelta: scoreAfter - scoreBefore,
    buzzwordsFixed: diffArrays(b.buzzwords_found, a.buzzwords_found),
    buzzwordsAdded: diffArrays(a.buzzwords_found, b.buzzwords_found),
    redFlagsFixed: diffArrays(b.red_flags, a.red_flags),
    redFlagsAdded: diffArrays(a.red_flags, b.red_flags)
  }
}
