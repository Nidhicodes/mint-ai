/**
 * Gallery loader — fetches and parses the static gallery.json manifest.
 */

export interface GalleryApp {
  id: string;
  title: string;
  description: string;
  tags: string[];
  author: string;
  html: string;
  thumbnailUrl: string;
  featured: boolean;
  createdAt: number;
}

export interface GalleryManifest {
  version: number;
  apps: GalleryApp[];
  categories: string[];
  updatedAt: number;
}

const EXPECTED_VERSION = 1;

/**
 * Fetches `/gallery.json`, parses it, and returns the manifest with apps
 * sorted: featured first, then by createdAt descending.
 *
 * Throws if:
 * - Fetch fails (network error, 404, etc.)
 * - JSON is malformed
 * - Manifest version is unexpected
 */
export async function loadGallery(): Promise<GalleryManifest> {
  const response = await fetch('/gallery.json');

  if (!response.ok) {
    throw new Error(`Failed to load gallery: ${response.status} ${response.statusText}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Gallery JSON is malformed');
  }

  const manifest = data as GalleryManifest;

  if (!manifest || typeof manifest.version !== 'number') {
    throw new Error('Gallery JSON is malformed');
  }

  if (manifest.version !== EXPECTED_VERSION) {
    throw new Error(
      `Unexpected gallery version: ${manifest.version} (expected ${EXPECTED_VERSION})`,
    );
  }

  if (!Array.isArray(manifest.apps)) {
    throw new Error('Gallery JSON is malformed');
  }

  // Sort: featured first, then by createdAt descending
  manifest.apps.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  return manifest;
}
