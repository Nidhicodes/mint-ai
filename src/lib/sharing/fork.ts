import { saveApp, saveVersion } from '../storage/db';
import type { App, AppVersion } from '../types';

/**
 * Source shape accepted by forkApp — any object with the required fields.
 * Works with App, GalleryApp, or any compatible shape.
 */
interface ForkSource {
  id: string;
  title: string;
  description: string;
  html: string;
  tags: string[];
  prompt: string;
}

/**
 * Pure function that computes the forked App without side effects.
 * Useful for property-based testing without IndexedDB.
 */
export function computeFork(
  source: ForkSource,
  newId: string,
  now: number,
): App {
  return {
    id: newId,
    title: source.title,
    description: source.description,
    prompt: source.prompt,
    html: source.html,
    thumbnail: null,
    tags: [...source.tags],
    version: 1,
    createdAt: now,
    updatedAt: now,
    shareId: null,
    forkedFrom: source.id,
  };
}

/**
 * Forks a source app into the user's library.
 *
 * Postconditions:
 * - Returns a new App with a fresh crypto.randomUUID() id
 * - forkedFrom is set to source.id
 * - version is 1, createdAt and updatedAt are Date.now()
 * - The forked app is saved to IndexedDB via saveApp()
 * - Version 1 is saved to the history store via saveVersion()
 * - Original source app is not mutated
 * - HTML, title, description, tags are copied from source
 */
export async function forkApp(
  source: ForkSource,
  _origin: 'library' | 'gallery' | 'shared-link',
): Promise<App> {
  const newId = crypto.randomUUID();
  const now = Date.now();

  const forkedApp = computeFork(source, newId, now);

  await saveApp(forkedApp);

  const version1: AppVersion = {
    version: 1,
    html: forkedApp.html,
    prompt: forkedApp.prompt,
    timestamp: now,
  };

  await saveVersion(forkedApp.id, version1);

  return forkedApp;
}
