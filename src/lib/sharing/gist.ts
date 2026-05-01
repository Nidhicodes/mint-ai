/**
 * GitHub Gist integration for sharing apps.
 * Creates public Gists containing the app's HTML.
 */

export interface GistResult {
  gistUrl: string;
  rawUrl: string;
}

/**
 * Creates a public GitHub Gist with the app HTML as a single file.
 *
 * @param html - The app HTML content
 * @param title - The app title (used as filename and description)
 * @param token - GitHub personal access token with `gist` scope
 * @returns The Gist URL and raw content URL
 * @throws Descriptive error on API failure (401, 403, 422, network)
 */
export async function createGist(
  html: string,
  title: string,
  token: string,
): Promise<GistResult> {
  const filename = `${title}.html`;

  let response: Response;
  try {
    response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({
        description: `Mint AI: ${title}`,
        public: true,
        files: {
          [filename]: { content: html },
        },
      }),
    });
  } catch {
    throw new Error('Network error. Check your internet connection.');
  }

  if (response.status === 401) {
    throw new Error('Invalid GitHub token. Check your personal access token.');
  }

  if (response.status === 403) {
    throw new Error("Access denied. Your token may lack the 'gist' scope.");
  }

  if (response.status === 422) {
    throw new Error('Invalid request. The app content may be too large.');
  }

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}). Please try again.`);
  }

  const data = await response.json();
  const gistUrl: string = data.html_url;
  const fileData = data.files?.[filename];
  const rawUrl: string = fileData?.raw_url ?? '';

  return { gistUrl, rawUrl };
}
