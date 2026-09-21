/**
 * A fixture whose whole point is that the type system forbids it.
 *
 * A validator's spec has to feed it the shapes it must reject, and those
 * shapes do not type-check by construction — `{ values: "foobar" }` where the
 * signature says `string[]` is the test, not a mistake in it. Written inline,
 * each one needs a cast, and a bare `as unknown as T` reads like every other
 * cast in the repo: a claim the author could not back up.
 *
 * This says the opposite, once and by name: *this value is deliberately wrong
 * and the assertion below is that the subject notices*. Reach for it only
 * where the rejection is the thing under test — never to make a legitimate
 * fixture compile.
 */
export function invalid<T>(value: unknown): T {
  return value as T;
}
