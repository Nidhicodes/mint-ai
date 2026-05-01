import type { App } from './types';

/**
 * Filters apps by text query and/or tag.
 *
 * - If query is empty and tagFilter is null, returns all apps.
 * - Search is case-insensitive across title, description, prompt, and tags.
 * - If tagFilter is provided, results are further filtered to apps containing that tag.
 * - Original array is not mutated; returns a new array.
 * - Order is preserved from input.
 */
export function searchApps(
  apps: App[],
  query: string,
  tagFilter: string | null,
): App[] {
  const q = query.toLowerCase().trim();

  return apps.filter((app) => {
    // Tag filter (if active)
    if (tagFilter && !app.tags.includes(tagFilter)) return false;

    // Text search (if query present)
    if (q.length === 0) return true;

    return (
      app.title.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q) ||
      app.prompt.toLowerCase().includes(q) ||
      app.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}
