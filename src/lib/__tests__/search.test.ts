import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { searchApps } from '../search';
import type { App } from '../types';

/**
 * Arbitrary generator for App objects used in property-based tests.
 */
const arbApp: fc.Arbitrary<App> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 0, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  prompt: fc.string({ minLength: 0, maxLength: 100 }),
  html: fc.string({ minLength: 0, maxLength: 50 }),
  thumbnail: fc.constant(null),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  version: fc.nat({ max: 100 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  shareId: fc.constant(null),
  forkedFrom: fc.constant(null),
});

const arbApps = fc.array(arbApp, { minLength: 0, maxLength: 20 });

describe('searchApps — property-based tests', () => {
  /**
   * Property 1: Empty query returns all
   * **Validates: Requirements 1.3, 17.6**
   *
   * When query is empty and tagFilter is null, every app should be returned.
   */
  it('empty query with no tag filter returns all apps', () => {
    fc.assert(
      fc.property(arbApps, (apps) => {
        const result = searchApps(apps, '', null);
        expect(result.length).toBe(apps.length);
      }),
    );
  });

  /**
   * Property 2: Results are a subset of the input
   * **Validates: Requirements 1.3, 17.5**
   *
   * Every element in the result must be present in the original apps array.
   */
  it('results are always a subset of the input apps', () => {
    fc.assert(
      fc.property(
        arbApps,
        fc.string({ minLength: 0, maxLength: 30 }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        (apps, query, tagFilter) => {
          const result = searchApps(apps, query, tagFilter);
          for (const app of result) {
            expect(apps).toContain(app);
          }
        },
      ),
    );
  });

  /**
   * Property 3: Case-insensitive matching
   * **Validates: Requirements 1.3, 17.2**
   *
   * Searching with an uppercased query should yield the same results as
   * searching with a lowercased query.
   */
  it('search is case-insensitive', () => {
    fc.assert(
      fc.property(arbApps, fc.string({ minLength: 0, maxLength: 20 }), (apps, query) => {
        const upper = searchApps(apps, query.toUpperCase(), null);
        const lower = searchApps(apps, query.toLowerCase(), null);
        expect(upper).toEqual(lower);
      }),
    );
  });

  /**
   * Property 4: Tag filter narrows correctly
   * **Validates: Requirements 1.4, 17.5**
   *
   * When a tag filter is applied, every result must contain that tag.
   */
  it('tag filter ensures every result contains the tag', () => {
    fc.assert(
      fc.property(
        arbApps,
        fc.string({ minLength: 1, maxLength: 20 }),
        (apps, tag) => {
          const result = searchApps(apps, '', tag);
          for (const app of result) {
            expect(app.tags).toContain(tag);
          }
        },
      ),
    );
  });

  /**
   * Property 5: AND logic — results with both query and tag filter satisfy both
   * **Validates: Requirements 1.3, 1.4, 17.5**
   *
   * When both a query and a tag filter are provided, every result must match
   * the text query AND contain the tag.
   */
  it('combined query and tag filter applies AND logic', () => {
    fc.assert(
      fc.property(
        arbApps,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (apps, query, tag) => {
          const result = searchApps(apps, query, tag);
          const q = query.toLowerCase().trim();

          for (const app of result) {
            // Must contain the tag
            expect(app.tags).toContain(tag);

            // Must match the text query in at least one field
            const matchesQuery =
              app.title.toLowerCase().includes(q) ||
              app.description.toLowerCase().includes(q) ||
              app.prompt.toLowerCase().includes(q) ||
              app.tags.some((t) => t.toLowerCase().includes(q));
            expect(matchesQuery).toBe(true);
          }
        },
      ),
    );
  });
});
