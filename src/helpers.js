// Pure UI helpers extracted from App.jsx for testability.
// Behavior must stay identical to the inline copies they replaced.

export const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

export const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

// Mirrors the ScoreMeter banding thresholds: <31, <56, <75, else.
export const scoreBand = (score) => {
  const safe = Math.max(0, Math.min(100, Number(score) || 0))
  if (safe < 31) return { color: '#FF5C1A', text: 'text-flame' }
  if (safe < 56) return { color: '#FB923C', text: 'text-orange-400' }
  if (safe < 75) return { color: '#FBBF24', text: 'text-amber-400' }
  return { color: '#3B82F6', text: 'text-cool' }
}

// Maps a completeness check status to Tailwind classes for a status dot/badge.
// Unknown/missing statuses fall back to 'warn' (amber).
export const statusTone = (status) => {
  const tones = {
    good: { dot: 'bg-cool', text: 'text-cool', border: 'border-cool/50' },
    warn: { dot: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-400/50' },
    bad: { dot: 'bg-flame', text: 'text-flame', border: 'border-flame/50' },
  }
  return tones[status] || tones.warn
}
