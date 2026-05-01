import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadGallery } from '../gallery/loader';
import type { GalleryManifest } from '../gallery/loader';

/**
 * Unit tests for loadGallery().
 * **Validates: Requirements 11.1, 11.5**
 */

const validManifest: GalleryManifest = {
  version: 1,
  categories: ['utility', 'fun'],
  updatedAt: 1719849600000,
  apps: [
    {
      id: 'app-a',
      title: 'App A',
      description: 'Non-featured older app',
      tags: ['utility'],
      author: 'Test',
      html: '<!DOCTYPE html><html><body>A</body></html>',
      thumbnailUrl: '',
      featured: false,
      createdAt: 1000,
    },
    {
      id: 'app-b',
      title: 'App B',
      description: 'Featured newer app',
      tags: ['fun'],
      author: 'Test',
      html: '<!DOCTYPE html><html><body>B</body></html>',
      thumbnailUrl: '',
      featured: true,
      createdAt: 3000,
    },
    {
      id: 'app-c',
      title: 'App C',
      description: 'Non-featured newer app',
      tags: ['utility'],
      author: 'Test',
      html: '<!DOCTYPE html><html><body>C</body></html>',
      thumbnailUrl: '',
      featured: false,
      createdAt: 2000,
    },
    {
      id: 'app-d',
      title: 'App D',
      description: 'Featured older app',
      tags: ['fun'],
      author: 'Test',
      html: '<!DOCTYPE html><html><body>D</body></html>',
      thumbnailUrl: '',
      featured: true,
      createdAt: 1500,
    },
  ],
};

function mockFetchJson(data: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    json: () => Promise.resolve(data),
  });
}

function mockFetchMalformed() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  });
}

function mockFetchNetworkError() {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('loadGallery', () => {
  it('returns sorted apps — featured first, then by createdAt descending', async () => {
    mockFetchJson(structuredClone(validManifest));

    const result = await loadGallery();

    expect(result.apps).toHaveLength(4);

    // Featured apps come first (B at 3000, D at 1500)
    expect(result.apps[0].id).toBe('app-b');
    expect(result.apps[0].featured).toBe(true);
    expect(result.apps[1].id).toBe('app-d');
    expect(result.apps[1].featured).toBe(true);

    // Non-featured apps next, sorted by createdAt desc (C at 2000, A at 1000)
    expect(result.apps[2].id).toBe('app-c');
    expect(result.apps[2].featured).toBe(false);
    expect(result.apps[3].id).toBe('app-a');
    expect(result.apps[3].featured).toBe(false);
  });

  it('preserves manifest metadata', async () => {
    mockFetchJson(structuredClone(validManifest));

    const result = await loadGallery();

    expect(result.version).toBe(1);
    expect(result.categories).toEqual(['utility', 'fun']);
    expect(result.updatedAt).toBe(1719849600000);
  });

  it('throws on malformed JSON', async () => {
    mockFetchMalformed();

    await expect(loadGallery()).rejects.toThrow('Gallery JSON is malformed');
  });

  it('returns manifest with empty apps array', async () => {
    const emptyManifest: GalleryManifest = {
      version: 1,
      categories: [],
      updatedAt: 1719849600000,
      apps: [],
    };
    mockFetchJson(emptyManifest);

    const result = await loadGallery();

    expect(result.apps).toEqual([]);
    expect(result.version).toBe(1);
  });

  it('throws on fetch failure (network error)', async () => {
    mockFetchNetworkError();

    await expect(loadGallery()).rejects.toThrow('Failed to fetch');
  });

  it('throws on non-OK HTTP response', async () => {
    mockFetchJson({}, false, 404);

    await expect(loadGallery()).rejects.toThrow('Failed to load gallery: 404 Not Found');
  });

  it('throws on unexpected manifest version', async () => {
    const badVersion = { ...structuredClone(validManifest), version: 99 };
    mockFetchJson(badVersion);

    await expect(loadGallery()).rejects.toThrow(
      'Unexpected gallery version: 99 (expected 1)',
    );
  });

  it('throws when manifest has no version field', async () => {
    mockFetchJson({ apps: [], categories: [] });

    await expect(loadGallery()).rejects.toThrow('Gallery JSON is malformed');
  });
});
