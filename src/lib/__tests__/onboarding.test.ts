import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shouldShowOnboarding, getOnboardingState, saveOnboardingState } from '../onboarding';
import type { OnboardingState } from '../onboarding';

/**
 * Unit tests for onboarding state logic.
 * **Validates: Requirements 14.1, 14.5, 14.6**
 */

describe('shouldShowOnboarding', () => {
  it('returns true when state is null (first visit)', () => {
    expect(shouldShowOnboarding(null)).toBe(true);
  });

  it('returns false when completed is true', () => {
    const state: OnboardingState = {
      completed: true,
      completedAt: Date.now(),
      skipped: false,
      providerConfigured: true,
    };
    expect(shouldShowOnboarding(state)).toBe(false);
  });

  it('returns false when skipped is true', () => {
    const state: OnboardingState = {
      completed: false,
      completedAt: null,
      skipped: true,
      providerConfigured: false,
    };
    expect(shouldShowOnboarding(state)).toBe(false);
  });

  it('returns true when state exists but neither completed nor skipped', () => {
    const state: OnboardingState = {
      completed: false,
      completedAt: null,
      skipped: false,
      providerConfigured: false,
    };
    expect(shouldShowOnboarding(state)).toBe(true);
  });
});

describe('getOnboardingState / saveOnboardingState', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    };
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('returns null when no state exists in localStorage', () => {
    expect(getOnboardingState()).toBeNull();
  });

  it('returns saved state after saveOnboardingState is called', () => {
    const state: OnboardingState = {
      completed: true,
      completedAt: 1700000000000,
      skipped: false,
      providerConfigured: true,
    };
    saveOnboardingState(state);
    expect(getOnboardingState()).toEqual(state);
  });

  it('returns null when localStorage contains invalid JSON', () => {
    store['mint-ai-onboarding'] = 'not-json';
    expect(getOnboardingState()).toBeNull();
  });

  it('persists skipped state correctly', () => {
    const state: OnboardingState = {
      completed: false,
      completedAt: null,
      skipped: true,
      providerConfigured: false,
    };
    saveOnboardingState(state);
    const retrieved = getOnboardingState();
    expect(retrieved).toEqual(state);
    expect(shouldShowOnboarding(retrieved)).toBe(false);
  });

  it('persists completed state correctly', () => {
    const state: OnboardingState = {
      completed: true,
      completedAt: 1700000000000,
      skipped: false,
      providerConfigured: true,
    };
    saveOnboardingState(state);
    const retrieved = getOnboardingState();
    expect(retrieved).toEqual(state);
    expect(shouldShowOnboarding(retrieved)).toBe(false);
  });
});
