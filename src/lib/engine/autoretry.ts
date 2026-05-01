import type { App, GenerationResult, ProviderConfig } from '../types';
import { generate } from './generate';

export const MAX_RETRIES = 2;

/**
 * Renders HTML in a hidden iframe and captures console.error output
 * for the specified timeout duration.
 *
 * @param html - The HTML string to render
 * @param timeout - How long to listen for errors in ms (default 3000)
 * @returns Array of captured error message strings
 */
export async function renderAndCaptureErrors(
  html: string,
  timeout: number = 3000,
): Promise<string[]> {
  const errors: string[] = [];

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.setAttribute('sandbox', 'allow-scripts');

  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => {
        try {
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow) {
            // Override console.error in the iframe to capture errors
            const script = document.createElement('script');
            script.textContent = `
              (function() {
                var origError = console.error;
                console.error = function() {
                  var msg = Array.prototype.slice.call(arguments).map(function(a) {
                    return typeof a === 'string' ? a : JSON.stringify(a);
                  }).join(' ');
                  window.__capturedErrors = window.__capturedErrors || [];
                  window.__capturedErrors.push(msg);
                  origError.apply(console, arguments);
                };
                window.onerror = function(message) {
                  window.__capturedErrors = window.__capturedErrors || [];
                  window.__capturedErrors.push(String(message));
                };
                window.addEventListener('unhandledrejection', function(e) {
                  window.__capturedErrors = window.__capturedErrors || [];
                  window.__capturedErrors.push('Unhandled rejection: ' + String(e.reason));
                });
              })();
            `;

            // Inject the error capture script before the HTML content
            const htmlWithCapture = html.replace(
              /(<head[^>]*>)/i,
              `$1<script>${script.textContent}<\/script>`,
            );

            iframe.srcdoc = htmlWithCapture;
          }
        } catch {
          // Cross-origin or sandbox restrictions — can't inject
        }
      }, { once: true });

      // Set initial srcdoc to trigger load event, then we'll replace it
      iframe.srcdoc = '<html><head></head><body></body></html>';

      // Wait for the timeout period to collect errors
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow as any;
          if (iframeWindow?.__capturedErrors) {
            errors.push(...iframeWindow.__capturedErrors);
          }
        } catch {
          // Cross-origin access blocked — no errors captured
        }
        resolve();
      }, timeout);
    });
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }

  return errors;
}

/**
 * Builds a fix prompt that includes the errored HTML and error messages
 * for the LLM to fix.
 */
export function buildFixPrompt(html: string, errors: string[]): string {
  return (
    `The following HTML app has JavaScript errors. Fix them.\n\n` +
    `Errors:\n${errors.map((e) => `- ${e}`).join('\n')}\n\n` +
    `HTML:\n\`\`\`html\n${html}\n\`\`\``
  );
}

export interface GenerationResultWithErrors extends GenerationResult {
  hasErrors: boolean;
}

/**
 * Wraps generate() with auto-retry logic. After initial generation,
 * renders the HTML in a hidden iframe to check for JS errors.
 * If errors are found, builds a fix prompt and retries up to MAX_RETRIES times.
 */
export async function generateWithRetry(
  config: ProviderConfig,
  prompt: string,
  existingApp: App | null,
  onStream: (chunk: string) => void,
  themeId?: string,
): Promise<GenerationResultWithErrors> {
  // Step 1: Initial generation
  const result = await generate(config, prompt, existingApp, onStream, themeId);

  // Step 2: Render in hidden iframe, capture console errors
  let currentErrors = await renderAndCaptureErrors(result.html, 3000);

  if (currentErrors.length === 0) {
    return { ...result, hasErrors: false };
  }

  // Step 3: Retry loop
  let currentHtml = result.html;

  for (let retry = 0; retry < MAX_RETRIES && currentErrors.length > 0; retry++) {
    onStream(`\n\n--- Auto-fix attempt ${retry + 1}/${MAX_RETRIES} ---\n`);

    const fixPrompt = buildFixPrompt(currentHtml, currentErrors);
    const fixResult = await generate(config, fixPrompt, null, onStream);

    currentHtml = fixResult.html;
    currentErrors = await renderAndCaptureErrors(currentHtml, 3000);
  }

  return {
    ...result,
    html: currentHtml,
    hasErrors: currentErrors.length > 0,
  };
}
