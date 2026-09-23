/**
 * `dumpme` is a native-ish module the subject calls to produce a core file.
 * It lives here, in its own file importing nothing from `lib/`, because a
 * `vi.mock` factory that reaches back into the spec's own graph deadlocks at
 * collection time (step 13, L4b3).
 */
import { vi } from "vitest";

export const dumpme = vi.fn();
