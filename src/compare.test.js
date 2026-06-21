import { describe, it, expect } from 'vitest'
import { compareRoasts } from './compare.js'

describe('compareRoasts - score', () => {
  it('computes a positive delta', () => {
    const r = compareRoasts({ score: 40 }, { score: 70 })
    expect(r.scoreBefore).toBe(40)
    expect(r.scoreAfter).toBe(70)
    expect(r.scoreDelta).toBe(30)
  })

  it('computes a negative delta', () => {
    const r = compareRoasts({ score: 80 }, { score: 55 })
    expect(r.scoreDelta).toBe(-25)
  })

  it('computes a zero delta', () => {
    const r = compareRoasts({ score: 50 }, { score: 50 })
    expect(r.scoreDelta).toBe(0)
  })

  it('clamps scores above 100 and below 0', () => {
    const r = compareRoasts({ score: 150 }, { score: -5 })
    expect(r.scoreBefore).toBe(100)
    expect(r.scoreAfter).toBe(0)
    expect(r.scoreDelta).toBe(-100)
  })

  it('treats missing/NaN score as 0', () => {
    const r = compareRoasts({}, { score: 'oops' })
    expect(r.scoreBefore).toBe(0)
    expect(r.scoreAfter).toBe(0)
    expect(r.scoreDelta).toBe(0)
  })
})

describe('compareRoasts - buzzwords', () => {
  it('detects fixed and added with some unchanged', () => {
    const before = { buzzwords_found: ['synergy', 'leverage', 'ninja'] }
    const after = { buzzwords_found: ['ninja', 'rockstar'] }
    const r = compareRoasts(before, after)
    expect(r.buzzwordsFixed).toEqual(['synergy', 'leverage'])
    expect(r.buzzwordsAdded).toEqual(['rockstar'])
  })

  it('matches case-insensitively and trims whitespace', () => {
    const r = compareRoasts(
      { buzzwords_found: ['Synergy'] },
      { buzzwords_found: ['synergy '] }
    )
    expect(r.buzzwordsFixed).toEqual([])
    expect(r.buzzwordsAdded).toEqual([])
  })

  it('dedupes duplicate source items', () => {
    const r = compareRoasts(
      { buzzwords_found: ['leverage', 'leverage'] },
      { buzzwords_found: [] }
    )
    expect(r.buzzwordsFixed).toEqual(['leverage'])
  })

  it('preserves original casing from each source array', () => {
    const r = compareRoasts(
      { buzzwords_found: ['Synergy', 'Leverage'] },
      { buzzwords_found: ['Rockstar'] }
    )
    expect(r.buzzwordsFixed).toEqual(['Synergy', 'Leverage'])
    expect(r.buzzwordsAdded).toEqual(['Rockstar'])
  })
})

describe('compareRoasts - red flags', () => {
  it('diffs red_flags symmetrically to buzzwords', () => {
    const before = { red_flags: ['gap', 'typo', 'no photo'] }
    const after = { red_flags: ['no photo', 'overclaim'] }
    const r = compareRoasts(before, after)
    expect(r.redFlagsFixed).toEqual(['gap', 'typo'])
    expect(r.redFlagsAdded).toEqual(['overclaim'])
  })
})

describe('compareRoasts - robustness', () => {
  it('handles empty/missing arrays without throwing', () => {
    const r = compareRoasts({}, {})
    expect(r).toEqual({
      scoreBefore: 0,
      scoreAfter: 0,
      scoreDelta: 0,
      buzzwordsFixed: [],
      buzzwordsAdded: [],
      redFlagsFixed: [],
      redFlagsAdded: []
    })
  })

  it('handles null before/after without throwing', () => {
    const r = compareRoasts(null, undefined)
    expect(r.scoreBefore).toBe(0)
    expect(r.scoreAfter).toBe(0)
    expect(r.scoreDelta).toBe(0)
    expect(r.buzzwordsFixed).toEqual([])
    expect(r.buzzwordsAdded).toEqual([])
    expect(r.redFlagsFixed).toEqual([])
    expect(r.redFlagsAdded).toEqual([])
  })

  it('treats non-array fields as empty', () => {
    const r = compareRoasts(
      { buzzwords_found: 'nope', red_flags: null },
      { buzzwords_found: undefined, red_flags: ['flag'] }
    )
    expect(r.buzzwordsFixed).toEqual([])
    expect(r.buzzwordsAdded).toEqual([])
    expect(r.redFlagsFixed).toEqual([])
    expect(r.redFlagsAdded).toEqual(['flag'])
  })
})
