import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGist } from '../sharing/gist';

describe('createGist', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns gistUrl and rawUrl on successful creation (201)', async () => {
    const mockResponse = {
      html_url: 'https://gist.github.com/user/abc123',
      files: {
        'My App.html': {
          raw_url: 'https://gist.githubusercontent.com/user/abc123/raw/My%20App.html',
        },
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await createGist('<h1>Hello</h1>', 'My App', 'ghp_testtoken123');

    expect(result.gistUrl).toBe('https://gist.github.com/user/abc123');
    expect(result.rawUrl).toBe(
      'https://gist.githubusercontent.com/user/abc123/raw/My%20App.html',
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/gists',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ghp_testtoken123',
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({
          description: 'Mint AI: My App',
          public: true,
          files: {
            'My App.html': { content: '<h1>Hello</h1>' },
          },
        }),
      }),
    );
  });

  it('throws descriptive error on 401 (invalid token)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    });

    await expect(
      createGist('<h1>Hello</h1>', 'My App', 'bad_token'),
    ).rejects.toThrow('Invalid GitHub token. Check your personal access token.');
  });

  it('throws descriptive error on 403 (access denied)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Forbidden' }),
    });

    await expect(
      createGist('<h1>Hello</h1>', 'My App', 'limited_token'),
    ).rejects.toThrow("Access denied. Your token may lack the 'gist' scope.");
  });

  it('throws descriptive error on 422 (invalid request)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: 'Validation Failed' }),
    });

    await expect(
      createGist('<h1>Hello</h1>', 'My App', 'ghp_testtoken123'),
    ).rejects.toThrow('Invalid request. The app content may be too large.');
  });

  it('throws network error when fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      createGist('<h1>Hello</h1>', 'My App', 'ghp_testtoken123'),
    ).rejects.toThrow('Network error. Check your internet connection.');
  });

  it('throws generic error for unexpected status codes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error' }),
    });

    await expect(
      createGist('<h1>Hello</h1>', 'My App', 'ghp_testtoken123'),
    ).rejects.toThrow('GitHub API error (500). Please try again.');
  });
});
