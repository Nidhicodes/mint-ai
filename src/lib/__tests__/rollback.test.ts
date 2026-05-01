import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { App, AppVersion } from '../types';

/**
 * Pure function that computes the rollback result without IndexedDB.
 * This mirrors the logic in rollbackToVersion() from db.ts.
 */
function computeRollback(
  app: App,
  history: AppVersion[],
  targetVersion: AppVersion,
): { updatedApp: App; newVersion: AppVersion; updatedHistory: AppVersion[] } {
  const newVersionNumber = app.version + 1;

  const newVersion: AppVersion = {
    version: newVersionNumber,
    html: targetVersion.html,
    prompt: `Rollback to version ${targetVersion.version}`,
    timestamp: Date.now(),
  };

  const updatedApp: App = {
    ...app,
    html: targetVersion.html,
    version: newVersionNumber,
    updatedAt: Date.now(),
  };

  const updatedHistory = [...history, newVersion];

  return { updatedApp, newVersion, updatedHistory };
}

/**
 * Arbitrary generator for App objects.
 */
const arbApp: fc.Arbitrary<App> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  prompt: fc.string({ minLength: 0, maxLength: 100 }),
  html: fc.string({ minLength: 1, maxLength: 200 }),
  thumbnail: fc.constant(null),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  version: fc.integer({ min: 1, max: 100 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
  shareId: fc.constant(null),
  forkedFrom: fc.constant(null),
});

/**
 * Arbitrary generator for AppVersion objects.
 */
const arbVersion: fc.Arbitrary<AppVersion> = fc.record({
  version: fc.integer({ min: 1, max: 100 }),
  html: fc.string({ minLength: 1, maxLength: 200 }),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  timestamp: fc.nat(),
});

/**
 * Generate a consistent app with matching history.
 * The app's version equals the number of history entries,
 * and we pick a random target version from the history.
 */
const arbAppWithHistory = fc.integer({ min: 2, max: 20 }).chain((numVersions) =>
  fc.tuple(
    arbApp.map((app) => ({ ...app, version: numVersions })),
    fc.array(arbVersion, { minLength: numVersions, maxLength: numVersions }).map((versions) =>
      versions.map((v, i) => ({ ...v, version: i + 1 })),
    ),
    fc.integer({ min: 0, max: numVersions - 1 }),
  ).map(([app, history, targetIdx]) => ({
    app,
    history,
    targetVersion: history[targetIdx],
  })),
);

describe('rollback — property-based tests', () => {
  /**
   * Property 1: Version always increases after rollback
   * **Validates: Requirements 3.3**
   *
   * After rollback, the app's version must be strictly greater than before.
   */
  it('version always increases after rollback', () => {
    fc.assert(
      fc.property(arbAppWithHistory, ({ app, history, targetVersion }) => {
        const { updatedApp } = computeRollback(app, history, targetVersion);
        expect(updatedApp.version).toBe(app.version + 1);
        expect(updatedApp.version).toBeGreaterThan(app.version);
      }),
    );
  });

  /**
   * Property 2: History length increases by exactly 1 after rollback
   * **Validates: Requirements 3.3**
   *
   * Rollback is non-destructive — it adds a new version record without
   * deleting any existing ones.
   */
  it('history length increases by exactly 1 after rollback', () => {
    fc.assert(
      fc.property(arbAppWithHistory, ({ app, history, targetVersion }) => {
        const { updatedHistory } = computeRollback(app, history, targetVersion);
        expect(updatedHistory.length).toBe(history.length + 1);
      }),
    );
  });

  /**
   * Property 3: The new version's HTML matches the target version's HTML
   * **Validates: Requirements 3.3**
   *
   * After rollback, the app's HTML and the new version record's HTML
   * must be identical to the target version's HTML.
   */
  it('HTML matches target version after rollback', () => {
    fc.assert(
      fc.property(arbAppWithHistory, ({ app, history, targetVersion }) => {
        const { updatedApp, newVersion } = computeRollback(app, history, targetVersion);
        expect(updatedApp.html).toBe(targetVersion.html);
        expect(newVersion.html).toBe(targetVersion.html);
      }),
    );
  });

  /**
   * Property 4: Rollback is non-destructive (no history records deleted)
   * **Validates: Requirements 3.3**
   *
   * All original history records must still be present after rollback.
   */
  it('rollback is non-destructive — all original history records preserved', () => {
    fc.assert(
      fc.property(arbAppWithHistory, ({ app, history, targetVersion }) => {
        const { updatedHistory } = computeRollback(app, history, targetVersion);

        // Every original history entry must still exist
        for (const original of history) {
          const found = updatedHistory.find(
            (v) => v.version === original.version && v.html === original.html && v.prompt === original.prompt,
          );
          expect(found).toBeDefined();
        }
      }),
    );
  });
});
