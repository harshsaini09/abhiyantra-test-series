// ============================================================
// localStorage Persistence Utility
// ============================================================
import type { TestState } from '../types';

const STORAGE_KEY = 'gate-mock-test-state';

export function saveTestState(state: TestState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('Failed to save test state to localStorage');
  }
}

export function loadTestState(): TestState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TestState;
  } catch {
    return null;
  }
}

export function clearTestState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Check if there is an in-progress (non-submitted) test */
export function hasInProgressTest(): boolean {
  const state = loadTestState();
  return state !== null && !state.isSubmitted;
}
