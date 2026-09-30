/**
 * The replacement for Mocha's `done`, for a subject that reports through a
 * callback rather than a promise.
 *
 * vitest has no `done`: a test that needs one returns a promise instead. The
 * property `done` gave for free, and that a bare `new Promise` gives up, is
 * that a callback which **never fires** fails the test — a promise that is
 * never settled is a timeout, not a success. `settle` is that shape, named,
 * so a spec asserting from inside a callback reads as one.
 *
 * Assert inside the callback and `reject` the assertion error, so a failed
 * expectation is reported as a failure rather than as a timeout:
 *
 * ```ts
 * it("calls back", () =>
 *   settle<void>((resolve, reject) => {
 *     subject.run((error) => {
 *       try {
 *         expect(error).toBeNull();
 *         resolve();
 *       } catch (assertion) {
 *         reject(assertion);
 *       }
 *     });
 *   }));
 * ```
 */
export const settle = <T>(
  run: (resolve: (value: T) => void, reject: (error: unknown) => void) => void,
) => new Promise<T>(run);
