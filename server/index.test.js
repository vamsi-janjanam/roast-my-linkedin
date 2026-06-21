import { describe, it, expect } from 'vitest';
import { parseRoastJSON, wordCount, isTooShort, ROAST_SCHEMA } from './index.js';

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

describe('ROAST_SCHEMA — projects/activity sections', () => {
  const sections = ROAST_SCHEMA.properties.sections;

  it('declares projects and activity sections', () => {
    expect(sections.properties.projects).toBeDefined();
    expect(sections.properties.activity).toBeDefined();
  });

  it('requires projects and activity', () => {
    expect(sections.required).toContain('projects');
    expect(sections.required).toContain('activity');
  });
});

describe('ROAST_SCHEMA — completeness', () => {
  const completeness = ROAST_SCHEMA.properties.completeness;
  const EXPECTED_CHECKS = [
    'custom_url',
    'location',
    'profile_photo',
    'banner',
    'links',
    'contact_info',
    'featured',
    'certifications',
  ];

  it('is declared in top-level properties and required', () => {
    expect(completeness).toBeDefined();
    expect(ROAST_SCHEMA.required).toContain('completeness');
  });

  it('has an integer percent and a checks object', () => {
    expect(completeness.properties.percent.type).toBe('integer');
    expect(completeness.required).toEqual(expect.arrayContaining(['percent', 'checks']));
  });

  it('declares all 8 expected checks, each a good/warn/bad CHECK', () => {
    const checks = completeness.properties.checks;
    expect(Object.keys(checks.properties).sort()).toEqual([...EXPECTED_CHECKS].sort());
    for (const key of EXPECTED_CHECKS) {
      const check = checks.properties[key];
      expect(check.properties.status.enum).toEqual(['good', 'warn', 'bad']);
      expect(check.required).toEqual(['status', 'note']);
      expect(check.additionalProperties).toBe(false);
    }
    expect(checks.required).toEqual(expect.arrayContaining(EXPECTED_CHECKS));
    expect(checks.additionalProperties).toBe(false);
  });

  it('every object in the completeness subtree has additionalProperties:false', () => {
    const walk = (node) => {
      if (node && typeof node === 'object') {
        if (node.type === 'object') expect(node.additionalProperties).toBe(false);
        for (const value of Object.values(node)) walk(value);
      }
    };
    walk(completeness);
  });
});
