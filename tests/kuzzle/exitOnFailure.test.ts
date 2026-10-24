import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exitOnFailure } from "../../lib/kuzzle/exitOnFailure";
import type { Kuzzle } from "../../lib/kuzzle/kuzzle";

/* #3022: the start scripts called `process.exit(1)` themselves, which cut
 * the graceful shutdown of a failed start short. */
describe("exitOnFailure", () => {
  let exit: ReturnType<typeof vi.spyOn>;

  const setKuzzle = (get: () => unknown) => {
    Reflect.defineProperty(global, "kuzzle", { configurable: true, get });
  };

  beforeEach(() => {
    exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    Reflect.deleteProperty(global, "kuzzle");
    vi.restoreAllMocks();
  });

  it("exits 1 at once when no Kuzzle instance was built", async () => {
    // What `lib/kuzzle/kuzzle.ts` answers until the first instance
    setKuzzle(() => {
      throw new Error("Kuzzle instance not found");
    });

    await exitOnFailure();

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("leaves the exit to the shutdown of the Kuzzle instance, with code 1", async () => {
    const kuzzle = { shutdown: vi.fn(async () => {}) };
    setKuzzle(() => kuzzle as unknown as Kuzzle);

    await exitOnFailure();

    expect(kuzzle.shutdown).toHaveBeenCalledExactlyOnceWith(1);
    expect(exit).not.toHaveBeenCalled();
  });

  it("logs a failing shutdown and still exits 1", async () => {
    const kuzzle = {
      log: { error: vi.fn() },
      shutdown: vi.fn(async () => {
        throw new Error("redis is gone");
      }),
    };
    setKuzzle(() => kuzzle as unknown as Kuzzle);

    await exitOnFailure();

    expect(kuzzle.log.error).toHaveBeenCalledExactlyOnceWith(
      "Unable to shut down: redis is gone",
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
