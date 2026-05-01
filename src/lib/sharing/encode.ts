import pako from 'pako';

/** Compress HTML and encode into a URL-safe fragment */
export function encodeApp(html: string): string {
  const compressed = pako.deflate(new TextEncoder().encode(html));
  // Convert to base64url (URL-safe)
  const b64 = btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return b64;
}

/** Decode a URL fragment back to HTML */
export function decodeApp(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(pako.inflate(bytes));
}

/** Default fallback OG image path */
const OG_DEFAULT_IMAGE = '/og-default.svg';

/**
 * Inject Open Graph meta tags into HTML for rich link previews.
 * Removes any existing OG meta tags first to avoid duplicates,
 * then injects og:title, og:description, og:image, and og:type after <head>.
 *
 * @param html - The app HTML string
 * @param app - Object with title, description, and optional thumbnail
 * @returns HTML string with OG meta tags injected
 */
export function injectOgMeta(
  html: string,
  app: { title: string; description: string; thumbnail: string | null },
): string {
  // Remove any existing OG meta tags to avoid duplicates
  let result = html.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '');

  const ogImage = app.thumbnail ?? OG_DEFAULT_IMAGE;

  // Escape HTML attribute values to prevent injection
  const escapeAttr = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const ogTags = [
    `<meta property="og:title" content="${escapeAttr(app.title)}">`,
    `<meta property="og:description" content="${escapeAttr(app.description)}">`,
    `<meta property="og:image" content="${escapeAttr(ogImage)}">`,
    `<meta property="og:type" content="website">`,
  ].join('\n    ');

  // Inject after <head> tag
  const headMatch = result.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertPos = headMatch.index! + headMatch[0].length;
    result = result.slice(0, insertPos) + '\n    ' + ogTags + result.slice(insertPos);
  }

  return result;
}

/** Download app as standalone .html file */
export function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
