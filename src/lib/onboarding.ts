export interface OnboardingState {
  completed: boolean;
  completedAt: number | null;
  skipped: boolean;
  providerConfigured: boolean;
}

const STORAGE_KEY = 'mint-ai-onboarding';

/**
 * Determines whether the onboarding wizard should be shown.
 * Returns true when state is null (first visit) or when state exists
 * but neither completed nor skipped.
 */
export function shouldShowOnboarding(state: OnboardingState | null): boolean {
  if (state === null) return true;
  if (state.completed) return false;
  if (state.skipped) return false;
  return true;
}

/**
 * Reads the onboarding state from localStorage.
 * Returns null if no state exists (first visit).
 */
export function getOnboardingState(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

/**
 * Persists the onboarding state to localStorage.
 */
export function saveOnboardingState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable — silently ignore
  }
}
