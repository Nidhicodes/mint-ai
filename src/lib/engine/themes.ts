/**
 * Design themes mapped to DaisyUI's built-in themes.
 * Each theme is just a DaisyUI theme name + metadata for the picker UI.
 */

export interface DesignTheme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  daisyTheme: string;  // DaisyUI theme name
}

export const THEMES: DesignTheme[] = [
  { id: 'dark',     name: 'Dark',     emoji: '🌙', description: 'Clean dark mode',           daisyTheme: 'dark' },
  { id: 'night',    name: 'Night',    emoji: '🌃', description: 'Deep navy, Linear-style',    daisyTheme: 'night' },
  { id: 'luxury',   name: 'Luxury',   emoji: '✨', description: 'Gold accent, premium feel',  daisyTheme: 'luxury' },
  { id: 'cyberpunk',name: 'Neon',     emoji: '🎮', description: 'Vibrant neon, high energy',  daisyTheme: 'cyberpunk' },
  { id: 'forest',   name: 'Forest',   emoji: '🌿', description: 'Natural green, wellness',    daisyTheme: 'forest' },
  { id: 'light',    name: 'Light',    emoji: '☀️', description: 'Clean light mode',           daisyTheme: 'light' },
  { id: 'nord',     name: 'Nord',     emoji: '❄️', description: 'Cool arctic palette',        daisyTheme: 'nord' },
  { id: 'business', name: 'Business', emoji: '📊', description: 'Professional, data-dense',   daisyTheme: 'business' },
];

export const DEFAULT_THEME = 'night';

export function getTheme(id: string): DesignTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}
