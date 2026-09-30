import { vi } from "vitest";

import type { NetworkEntryPoint } from "../../lib/core/network/networkEntryPoint";

/**
 * The four methods a protocol calls on the entry point that owns it, plus the
 * configuration it reads at `init()`.
 *
 * Derived from `test/mocks/entrypoint.mock.js`, which the three protocol specs
 * shared. It is kept as a shared fixture rather than inlined per spec — unlike
 * `KuzzleMock`, it is not an application stub: it is the whole of the surface a
 * protocol sees, and naming it once is what makes that surface visible.
 */
export function stubEntryPoint<T extends Record<string, any>>(
  config: T = {} as T,
) {
  return {
    config,
    // Answers `{}` unless a spec says otherwise, as `entrypoint.mock.js` did:
    // a protocol writes its response from this callback, and a stub that never
    // calls it makes the socket look silent for the wrong reason.
    // `cb` is required, as `NetworkEntryPoint.execute` declares it. It was
    // optional here, which made every `mockImplementation` in the protocol
    // specs cope with a callback the subject always passes — a stub looser
    // than its subject asks its callers to handle cases that cannot happen
    // (step 14, M6).
    execute: vi.fn(
      (_connection: unknown, _request: unknown, cb: (r: unknown) => void) =>
        cb({}),
    ),
    logAccess: vi.fn(),
    newConnection: vi.fn(),
    removeConnection: vi.fn(),
  };
}

export type EntryPointStub = ReturnType<typeof stubEntryPoint>;

/** `Protocol.init()` is declared against the real entry point. */
export const asEntryPoint = (stub: EntryPointStub) =>
  stub as unknown as NetworkEntryPoint;
