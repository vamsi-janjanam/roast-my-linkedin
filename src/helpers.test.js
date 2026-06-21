import { describe, expect, it } from 'vitest'
import { countWords, scoreBand, statusTone, titleCase } from './helpers'

describe('countWords', () => {
  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('counts simple words', () => {
    expect(countWords('hi there')).toBe(2)
  })

  it('ignores leading/trailing whitespace', () => {
    expect(countWords('  hi there  ')).toBe(2)
  })

  it('treats whitespace-only as 0', () => {
    expect(countWords('   ')).toBe(0)
  })

  it('collapses repeated inner whitespace', () => {
    expect(countWords('a    b\tc')).toBe(3)
  })
})

describe('titleCase', () => {
  it('returns "" for empty input', () => {
    expect(titleCase('')).toBe('')
  })

  it('capitalizes the first letter', () => {
    expect(titleCase('skills')).toBe('Skills')
  })
})

describe('scoreBand', () => {
  it('bands low scores as flame (<31)', () => {
    expect(scoreBand(0).text).toBe('text-flame')
    expect(scoreBand(30).text).toBe('text-flame')
  })

  it('bands mid-low scores as orange (<56)', () => {
    expect(scoreBand(31).text).toBe('text-orange-400')
    expect(scoreBand(55).text).toBe('text-orange-400')
  })

  it('bands mid-high scores as amber (<75)', () => {
    expect(scoreBand(56).text).toBe('text-amber-400')
    expect(scoreBand(74).text).toBe('text-amber-400')
  })

  it('bands high scores as cool (>=75)', () => {
    expect(scoreBand(75).text).toBe('text-cool')
    expect(scoreBand(100).text).toBe('text-cool')
  })
})

describe('statusTone', () => {
  it('maps good to cool', () => {
    expect(statusTone('good').text).toBe('text-cool')
    expect(statusTone('good').dot).toBe('bg-cool')
  })

  it('maps warn to amber', () => {
    expect(statusTone('warn').text).toBe('text-amber-400')
    expect(statusTone('warn').dot).toBe('bg-amber-400')
  })

  it('maps bad to flame', () => {
    expect(statusTone('bad').text).toBe('text-flame')
    expect(statusTone('bad').dot).toBe('bg-flame')
  })

  it('falls back to warn for unknown status', () => {
    expect(statusTone('nonsense').text).toBe('text-amber-400')
  })

  it('falls back to warn for undefined status', () => {
    expect(statusTone(undefined).text).toBe('text-amber-400')
  })
})
