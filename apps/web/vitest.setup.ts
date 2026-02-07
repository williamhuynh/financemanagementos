import { vi } from 'vitest';

// Mock React's cache function for testing
// In the test environment, cache is not needed and can just return the function as-is
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    cache: (fn: any) => fn,
  };
});
