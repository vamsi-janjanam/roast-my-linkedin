import { describe, it, expect } from 'vitest';
import { parseRoastJSON, wordCount, isTooShort } from './index.js';

describe('parseRoastJSON', () => {
  it('parses clean JSON', () => {
    const text = '{"overall_roast": "brutal", "score": 12}';
    expect(parseRoastJSON(text)).toEqual({ overall_roast: 'brutal', score: 12 });
  });

  it('parses ```json fenced``` JSON', () => {
    const text = '```json\n{"score": 42, "score_label": "Maybe, on a slow day"}\n```';
    expect(parseRoastJSON(text)).toEqual({ score: 42, score_label: 'Maybe, on a slow day' });
  });

  it('parses JSON embedded in surrounding prose', () => {
    const text = 'Sure, here is your roast: {"score": 7, "red_flags": ["no impact"]} — enjoy!';
    expect(parseRoastJSON(text)).toEqual({ score: 7, red_flags: ['no impact'] });
  });

  it('throws on unparseable garbage', () => {
    expect(() => parseRoastJSON('this is not json at all')).toThrow();
  });
});

describe('wordCount', () => {
  it('returns 0 for empty / whitespace-only input', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   \n\t  ')).toBe(0);
    expect(wordCount(null)).toBe(0);
    expect(wordCount(undefined)).toBe(0);
  });

  it('counts whitespace-delimited words, collapsing runs', () => {
    expect(wordCount('one')).toBe(1);
    expect(wordCount('one   two\tthree\nfour')).toBe(4);
    expect(wordCount('  leading and trailing  ')).toBe(3);
  });
});

describe('isTooShort (40-word threshold)', () => {
  const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  it('is true for empty input', () => {
    expect(isTooShort('')).toBe(true);
  });

  it('is true at 39 words (boundary, just under)', () => {
    expect(wordCount(words(39))).toBe(39);
    expect(isTooShort(words(39))).toBe(true);
  });

  it('is false at 40 words (boundary, exactly the threshold)', () => {
    expect(wordCount(words(40))).toBe(40);
    expect(isTooShort(words(40))).toBe(false);
  });
});
