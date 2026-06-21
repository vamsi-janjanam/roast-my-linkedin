import { describe, expect, it } from 'vitest'
import { countWords, scoreBand, titleCase } from './helpers'

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
