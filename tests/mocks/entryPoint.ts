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
export function stubEntryPoint(config: Record<string, unknown> = {}) {
  return {
    config,
    execute: vi.fn(),
    logAccess: vi.fn(),
    newConnection: vi.fn(),
    removeConnection: vi.fn(),
  };
}

export type EntryPointStub = ReturnType<typeof stubEntryPoint>;

/** `Protocol.init()` is declared against the real entry point. */
export const asEntryPoint = (stub: EntryPointStub) =>
  stub as unknown as NetworkEntryPoint;
