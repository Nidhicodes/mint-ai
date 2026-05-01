import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { App } from '../types';
import { computeFork } from '../sharing/fork';

/**
 * Arbitrary generator for App objects used as fork sources.
 */
const arbApp: fc.Arbitrary<App> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  prompt: fc.string({ minLength: 0, maxLength: 100 }),
  html: fc.string({ minLength: 1, maxLength: 500 }),
  thumbnail: fc.constant(null),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  version: fc.integer({ min: 1, max: 100 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  shareId: fc.constant(null),
  forkedFrom: fc.constant(null),
});

/**
 * Generate a source app together with a distinct new UUID and a timestamp.
 */
const arbForkInput = fc.tuple(
  arbApp,
  fc.uuid(),
  fc.nat({ max: Number.MAX_SAFE_INTEGER }),
);

describe('forkApp — property-based tests', () => {
  /**
   * Property 1: New ID ≠ source ID
   * **Validates: Requirements 10.1**
   *
   * The forked app must have a different ID from the source.
   */
  it('forked app ID is different from source ID', () => {
    fc.assert(
      fc.property(arbForkInput, ([source, newId, now]) => {
        // Ensure the generated newId differs from source.id (extremely likely with UUIDs)
        fc.pre(newId !== source.id);
        const forked = computeFork(source, newId, now);
        expect(forked.id).not.toBe(source.id);
        expect(forked.id).toBe(newId);
      }),
    );
  });

  /**
   * Property 2: HTML is identical to source
   * **Validates: Requirements 10.2**
   *
   * The forked app's HTML must be an exact copy of the source's HTML.
   */
  it('forked app HTML is identical to source HTML', () => {
    fc.assert(
      fc.property(arbForkInput, ([source, newId, now]) => {
        const forked = computeFork(source, newId, now);
        expect(forked.html).toBe(source.html);
      }),
    );
  });

  /**
   * Property 3: forkedFrom is set to source.id
   * **Validates: Requirements 10.1**
   *
   * The forked app's forkedFrom field must reference the source app's ID.
   */
  it('forkedFrom is set to source ID', () => {
    fc.assert(
      fc.property(arbForkInput, ([source, newId, now]) => {
        const forked = computeFork(source, newId, now);
        expect(forked.forkedFrom).toBe(source.id);
      }),
    );
  });

  /**
   * Property 4: version is always 1
   * **Validates: Requirements 10.1**
   *
   * Regardless of the source app's version, the fork always starts at version 1.
   */
  it('forked app version is always 1', () => {
    fc.assert(
      fc.property(arbForkInput, ([source, newId, now]) => {
        const forked = computeFork(source, newId, now);
        expect(forked.version).toBe(1);
      }),
    );
  });

  /**
   * Property 5: Source app is not mutated
   * **Validates: Requirements 10.1**
   *
   * The original source app object must remain unchanged after forking.
   */
  it('source app is not mutated by fork', () => {
    fc.assert(
      fc.property(arbForkInput, ([source, newId, now]) => {
        // Deep-clone the source to compare after fork
        const originalSnapshot = JSON.parse(JSON.stringify(source));
        computeFork(source, newId, now);
        expect(source).toEqual(originalSnapshot);
      }),
    );
  });
});
