import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { buildFixPrompt, MAX_RETRIES } from '../engine/autoretry';
import type { GenerationResult, ProviderConfig } from '../types';

/**
 * Pure retry logic extracted for testability.
 * Mirrors the core loop in generateWithRetry() without DOM/iframe dependencies.
 */
async function simulateRetryLogic(
  generateFn: (prompt: string) => Promise<GenerationResult>,
  checkErrorsFn: (html: string) => Promise<string[]>,
  initialPrompt: string,
  maxRetries: number,
  onStream: (chunk: string) => void,
): Promise<{ result: GenerationResult; hasErrors: boolean; retryCount: number }> {
  const result = await generateFn(initialPrompt);
  let currentErrors = await checkErrorsFn(result.html);

  if (currentErrors.length === 0) {
    return { result, hasErrors: false, retryCount: 0 };
  }

  let currentHtml = result.html;
  let retryCount = 0;

  for (let retry = 0; retry < maxRetries && currentErrors.length > 0; retry++) {
    onStream(`\n\n--- Auto-fix attempt ${retry + 1}/${maxRetries} ---\n`);

    const fixPrompt = buildFixPrompt(currentHtml, currentErrors);
    const fixResult = await generateFn(fixPrompt);

    currentHtml = fixResult.html;
    currentErrors = await checkErrorsFn(currentHtml);
    retryCount++;
  }

  return {
    result: { ...result, html: currentHtml },
    hasErrors: currentErrors.length > 0,
    retryCount,
  };
}

describe('buildFixPrompt', () => {
  it('includes error messages in the prompt', () => {
    const html = '<html><body>test</body></html>';
    const errors = ['ReferenceError: foo is not defined', 'TypeError: null is not an object'];

    const prompt = buildFixPrompt(html, errors);

    expect(prompt).toContain('ReferenceError: foo is not defined');
    expect(prompt).toContain('TypeError: null is not an object');
  });

  it('includes the HTML in the prompt', () => {
    const html = '<html><body><script>console.log("hello")</script></body></html>';
    const errors = ['SyntaxError: unexpected token'];

    const prompt = buildFixPrompt(html, errors);

    expect(prompt).toContain(html);
  });

  it('formats errors as a bulleted list', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3'];
    const prompt = buildFixPrompt('<html></html>', errors);

    expect(prompt).toContain('- Error 1');
    expect(prompt).toContain('- Error 2');
    expect(prompt).toContain('- Error 3');
  });

  it('wraps HTML in a code block', () => {
    const html = '<html><body>test</body></html>';
    const prompt = buildFixPrompt(html, ['error']);

    expect(prompt).toContain('```html');
    expect(prompt).toContain('```');
  });
});

describe('MAX_RETRIES', () => {
  it('is set to 2', () => {
    expect(MAX_RETRIES).toBe(2);
  });
});

describe('auto-retry logic — property-based tests', () => {
  /**
   * Property 1: Retry count never exceeds MAX_RETRIES
   * **Validates: Requirements 16.3**
   *
   * No matter how many errors are produced, the retry loop
   * must never exceed MAX_RETRIES additional generation calls.
   */
  it('retry count never exceeds MAX_RETRIES', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random number of errors per attempt (0 = clean, >0 = errored)
        fc.array(fc.nat({ max: 5 }), { minLength: 1, maxLength: 10 }),
        async (errorCounts) => {
          let callIndex = 0;

          const generateFn = async (_prompt: string): Promise<GenerationResult> => {
            return {
              html: `<html>attempt-${callIndex++}</html>`,
              title: 'Test',
              description: 'Test app',
              tags: [],
            };
          };

          let checkIndex = 0;
          const checkErrorsFn = async (_html: string): Promise<string[]> => {
            const count = errorCounts[checkIndex % errorCounts.length];
            checkIndex++;
            return Array.from({ length: count }, (_, i) => `Error ${i}`);
          };

          const streamChunks: string[] = [];
          const onStream = (chunk: string) => streamChunks.push(chunk);

          const { retryCount } = await simulateRetryLogic(
            generateFn,
            checkErrorsFn,
            'test prompt',
            MAX_RETRIES,
            onStream,
          );

          expect(retryCount).toBeLessThanOrEqual(MAX_RETRIES);
        },
      ),
    );
  });

  /**
   * Property 2: buildFixPrompt always contains all error strings and the HTML
   * **Validates: Requirements 16.6**
   *
   * For any combination of HTML and error strings, the fix prompt
   * must contain every error message and the full HTML.
   */
  it('buildFixPrompt always contains all errors and HTML', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (html, errors) => {
          const prompt = buildFixPrompt(html, errors);

          // Every error must appear in the prompt
          for (const error of errors) {
            expect(prompt).toContain(error);
          }

          // The HTML must appear in the prompt
          expect(prompt).toContain(html);
        },
      ),
    );
  });
});

describe('auto-retry logic — example tests', () => {
  /**
   * Clean HTML (no errors) → no retries, hasErrors false
   * **Validates: Requirements 16.1, 16.3**
   */
  it('clean HTML triggers no retries', async () => {
    const generateFn = async (_prompt: string): Promise<GenerationResult> => ({
      html: '<!DOCTYPE html><html><body>Clean app</body></html>',
      title: 'Clean App',
      description: 'A clean app',
      tags: ['utility'],
    });

    const checkErrorsFn = async (_html: string): Promise<string[]> => [];

    const streamChunks: string[] = [];
    const onStream = (chunk: string) => streamChunks.push(chunk);

    const { result, hasErrors, retryCount } = await simulateRetryLogic(
      generateFn,
      checkErrorsFn,
      'build a clean app',
      MAX_RETRIES,
      onStream,
    );

    expect(retryCount).toBe(0);
    expect(hasErrors).toBe(false);
    expect(result.html).toContain('Clean app');
    expect(streamChunks).toHaveLength(0); // No retry status messages
  });

  /**
   * Errored HTML → retries with error context in prompt
   * **Validates: Requirements 16.2, 16.4, 16.6**
   */
  it('errored HTML triggers retries with error context in prompt', async () => {
    const prompts: string[] = [];
    let callCount = 0;

    const generateFn = async (prompt: string): Promise<GenerationResult> => {
      prompts.push(prompt);
      callCount++;
      return {
        html: callCount === 1
          ? '<html><script>undefinedVar()</script></html>'
          : '<!DOCTYPE html><html><body>Fixed app</body></html>',
        title: 'Test App',
        description: 'A test app',
        tags: [],
      };
    };

    let checkCount = 0;
    const checkErrorsFn = async (_html: string): Promise<string[]> => {
      checkCount++;
      // First check returns errors, second check returns clean
      return checkCount === 1 ? ['ReferenceError: undefinedVar is not defined'] : [];
    };

    const streamChunks: string[] = [];
    const onStream = (chunk: string) => streamChunks.push(chunk);

    const { result, hasErrors, retryCount } = await simulateRetryLogic(
      generateFn,
      checkErrorsFn,
      'build an app',
      MAX_RETRIES,
      onStream,
    );

    expect(retryCount).toBe(1);
    expect(hasErrors).toBe(false);
    expect(result.html).toContain('Fixed app');

    // The retry prompt should contain the error context
    expect(prompts[1]).toContain('ReferenceError: undefinedVar is not defined');
    expect(prompts[1]).toContain('undefinedVar()');

    // Stream should contain retry status indicator
    expect(streamChunks[0]).toContain('Auto-fix attempt 1/2');
  });

  /**
   * Persistent errors → retries exhaust, hasErrors true
   * **Validates: Requirements 16.3, 16.5**
   */
  it('persistent errors exhaust retries and set hasErrors true', async () => {
    const generateFn = async (_prompt: string): Promise<GenerationResult> => ({
      html: '<html><script>throw new Error("always broken")</script></html>',
      title: 'Broken App',
      description: 'Always broken',
      tags: [],
    });

    const checkErrorsFn = async (_html: string): Promise<string[]> => [
      'Error: always broken',
    ];

    const streamChunks: string[] = [];
    const onStream = (chunk: string) => streamChunks.push(chunk);

    const { hasErrors, retryCount } = await simulateRetryLogic(
      generateFn,
      checkErrorsFn,
      'build a broken app',
      MAX_RETRIES,
      onStream,
    );

    expect(retryCount).toBe(MAX_RETRIES);
    expect(hasErrors).toBe(true);

    // Should have status indicators for both retry attempts
    expect(streamChunks).toHaveLength(2);
    expect(streamChunks[0]).toContain('Auto-fix attempt 1/2');
    expect(streamChunks[1]).toContain('Auto-fix attempt 2/2');
  });
});
