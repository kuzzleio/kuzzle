import { expect } from "vitest";

/**
 * Narrows a value the subject declares as nullable, where the spec has just
 * put something there.
 *
 * `request.error` is `KuzzleError | null` and that is correct: a request that
 * has not failed carries no error. A spec that *set* one is in the other case,
 * and it says so here — an assertion function, so the narrowing holds for the
 * rest of the block without a cast, and a real assertion, so a subject that
 * stopped storing the value fails on this line rather than on a confusing
 * `Cannot read properties of null` three lines down.
 */
export function present<T>(
  value: T | null | undefined,
  what: string,
): asserts value is T {
  expect(value, `${what} should be set at this point`).not.toBeNull();
  expect(value, `${what} should be set at this point`).not.toBeUndefined();
}
