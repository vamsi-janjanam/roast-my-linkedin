import React, { useEffect, useMemo, useState } from 'react'

const SECTION_ORDER = [
  'headline',
  'about',
  'experience',
  'skills',
  'education',
  'recommendations',
]

const LOADING_MESSAGES = [
  'Pulling your profile…',
  'Feeding it to the ATS…',
  'Counting missing keywords…',
  'Looking for an actual metric…',
  'Laughing at "results-driven"…',
  'Consulting the rejection pile…',
]

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------
function LoadingState() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 1500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="animate-flicker text-7xl" aria-hidden="true">
        🔥
      </div>
      <p className="font-display text-2xl text-flame animate-flame-pulse">
        Roasting…
      </p>
      <p className="font-mono text-sm text-paper/70" aria-live="polite">
        {LOADING_MESSAGES[idx]}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-flame/60 bg-flame/10 px-4 py-3 text-paper">
      <p className="text-sm">
        <span className="font-semibold text-flame">Error: </span>
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md px-2 text-lg leading-none text-paper/70 hover:text-flame"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RoastCard
// ---------------------------------------------------------------------------
function RoastCard({ text }) {
  return (
    <div className="rounded-2xl border border-flame/40 bg-gradient-to-b from-flame/10 to-transparent p-6 sm:p-8">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-flame">
        🔥 The Roast
      </p>
      <p className="font-display text-2xl leading-snug text-paper sm:text-3xl">
        {text || 'No roast returned. Lucky you.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScoreMeter
// ---------------------------------------------------------------------------
function ScoreMeter({ score, label }) {
  const safe = Math.max(0, Math.min(100, Number(score) || 0))
  const band =
    safe < 31
      ? { color: '#FF5C1A', text: 'text-flame' }
      : safe < 56
        ? { color: '#FB923C', text: 'text-orange-400' }
        : safe < 75
          ? { color: '#FBBF24', text: 'text-amber-400' }
          : { color: '#3B82F6', text: 'text-cool' }

  const radius = 52
  const circ = 2 * Math.PI * radius
  const offset = circ - (safe / 100) * circ

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={band.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display text-3xl ${band.text}`}>{safe}</span>
          <span className="font-mono text-[10px] text-paper/50">/ 100</span>
        </div>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-paper/50">
          Recruiter Score
        </p>
        <p className={`font-display text-xl ${band.text}`}>{label || '—'}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KeywordBadges — reused for buzzwords (bad) and missing keywords (gap)
// ---------------------------------------------------------------------------
function KeywordBadges({ title, words, empty, tone }) {
  const list = words ?? []
  const styles =
    tone === 'cool'
      ? 'border-cool/50 bg-cool/15 text-cool'
      : 'border-flame/50 bg-flame/15 text-flame'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-paper/50">
        {title} ({list.length})
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-paper/60">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${styles}`}
            >
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActionableTips
// ---------------------------------------------------------------------------
function ActionableTips({ tips }) {
  const list = tips ?? []
  if (list.length === 0) return null
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {list.map((tip, i) => (
        <li
          key={i}
          className="flex items-start gap-2 rounded-lg border border-cool/30 bg-cool/10 px-3 py-2 text-sm text-paper/90"
        >
          <span className="mt-0.5 shrink-0 text-cool">✓</span>
          <span>{tip}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// SectionBreakdown
// ---------------------------------------------------------------------------
function SectionBreakdown({ sections }) {
  const data = sections ?? {}
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-2xl text-paper">Section breakdown</h2>
      {SECTION_ORDER.map((key) => {
        const section = data[key]
        if (!section) return null
        return (
          <div
            key={key}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6"
          >
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-paper/50">
              {titleCase(key)}
            </p>
            <p className="font-sans text-base leading-relaxed text-flame">
              🔥 {section.roast || 'Nothing to roast here.'}
            </p>
            <ActionableTips tips={section.tips} />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ShareBar
// ---------------------------------------------------------------------------
function ShareBar({ result }) {
  const [copied, setCopied] = useState('')

  const flash = (which) => {
    setCopied(which)
    setTimeout(() => setCopied(''), 1600)
  }

  const copyText = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      flash(which)
    } catch {
      // Fallback for non-secure contexts / older browsers.
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        flash(which)
      } catch {
        /* give up silently */
      }
    }
  }

  const copyRoast = () => copyText(result.overall_roast || '', 'roast')

  const copyTips = () => {
    const lines = []
    const flags = result.red_flags ?? []
    if (flags.length) {
      lines.push('Recruiter red flags:')
      flags.forEach((k) => lines.push(`  - ${k}`))
      lines.push('')
    }
    SECTION_ORDER.forEach((key) => {
      const tips = result.sections?.[key]?.tips ?? []
      if (tips.length) {
        lines.push(`${titleCase(key)}:`)
        tips.forEach((t) => lines.push(`  - ${t}`))
        lines.push('')
      }
    })
    copyText(lines.join('\n').trim(), 'tips')
  }

  const shareUrl = useMemo(() => {
    const text = `A recruiter just dead-brutally roasted my LinkedIn 🔥 — recruiter score: ${
      result.score ?? 0
    }/100. "${result.score_label ?? ''}." Find out what recruiters really think.`
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  }, [result])

  const btn =
    'rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-paper transition hover:border-flame hover:text-flame'

  return (
    <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 bg-ink/90 px-4 py-4 backdrop-blur sm:rounded-2xl sm:border sm:px-6">
      <button type="button" onClick={copyRoast} className={btn}>
        {copied === 'roast' ? 'Copied!' : 'Copy Roast'}
      </button>
      <button type="button" onClick={copyTips} className={btn}>
        {copied === 'tips' ? 'Copied!' : 'Copy Fixes'}
      </button>
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-cool/60 bg-cool/15 px-4 py-2 text-sm font-semibold text-cool transition hover:bg-cool/25"
      >
        Share on X
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function Results({ result, onReset }) {
  return (
    <div className="flex flex-col gap-6">
      <RoastCard text={result.overall_roast} />

      <div className="grid gap-6 md:grid-cols-2">
        <ScoreMeter score={result.score} label={result.score_label} />
        <KeywordBadges
          title="Dead-weight buzzwords"
          words={result.buzzwords_found}
          empty="No fluff buzzwords — rare."
          tone="flame"
        />
      </div>

      <KeywordBadges
        title="Recruiter red flags"
        words={result.red_flags}
        empty="No glaring red flags. Suspicious."
        tone="cool"
      />

      <SectionBreakdown sections={result.sections} />

      <ShareBar result={result} />

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-flame bg-flame px-6 py-3 font-display text-lg text-ink transition hover:bg-flame/90"
        >
          Roast another
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [profileText, setProfileText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const words = countWords(profileText)
  const tooShort = words > 0 && words < 40

  const handleRoast = async () => {
    if (loading || words < 40) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText: profileText.trim() }),
      })

      let data = null
      try {
        data = await res.json()
      } catch {
        data = null
      }

      if (!res.ok) {
        setError(data?.error?.message || 'Something went wrong. Try again.')
        return
      }

      setResult(data)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError('')
  }

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Header / hero */}
        <header className="mb-10 text-center sm:text-left">
          <span className="inline-block rounded-full border border-flame/60 bg-flame/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-flame">
            Dead Brutal Mode 🔥
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-paper sm:text-6xl">
            LinkedIn <span className="text-flame">Recruiter Roaster</span>
          </h1>
          <p className="mt-3 font-sans text-base text-paper/70 sm:text-lg">
            Paste your LinkedIn text. Get the brutal first impression a recruiter
            forms in 10 seconds — no mercy, just fixes.
          </p>
          <p className="mt-1 font-mono text-xs text-paper/40">
            Tip: install the browser extension to roast profiles in-page instead.
          </p>
        </header>

        {loading ? (
          <LoadingState />
        ) : result ? (
          <Results result={result} onReset={handleReset} />
        ) : (
          <main className="flex flex-col gap-6">
            <ErrorBanner message={error} onDismiss={() => setError('')} />

            <div>
              <label
                htmlFor="profile"
                className="mb-2 block font-mono text-xs uppercase tracking-widest text-paper/50"
              >
                Paste your LinkedIn (headline / about / experience / skills)
              </label>
              <textarea
                id="profile"
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                placeholder="Paste your headline, About, Experience and Skills here…"
                rows={12}
                className="w-full resize-y rounded-2xl border border-white/15 bg-white/5 p-4 font-mono text-sm text-paper placeholder:text-paper/30 focus:border-flame focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={tooShort ? 'text-flame' : 'text-paper/50'}>
                  {tooShort
                    ? 'Needs more — paste at least your headline + About + Experience.'
                    : ' '}
                </span>
                <span className="font-mono text-paper/50">
                  {words} word{words === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRoast}
              disabled={loading || words < 40}
              className="rounded-2xl border border-flame bg-flame px-6 py-4 font-display text-xl font-bold text-ink transition hover:bg-flame/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Roast My ATS 🔥
            </button>
          </main>
        )}
      </div>
    </div>
  )
}
