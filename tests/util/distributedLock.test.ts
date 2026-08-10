import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as redlockUniversal from "redlock-universal";
import type { RedisAdapter } from "redlock-universal";

/**
 * FlakyAdapter simulates lock loss: its extension attempts always fail, as
 * if another node had taken over the key, so we can deterministically
 * exercise the MutexLockLostError path without racing real Redis timing.
 */
class FlakyAdapter extends redlockUniversal.MemoryAdapter {
  async atomicExtend(key: string, _value: string, minTTL: number) {
    return this.interpretAtomicExtensionResult(key, minTTL, [-1, -2]);
  }
}

const mocks = vi.hoisted(() => {
  return { currentAdapter: undefined as RedisAdapter | undefined };
});

// lib/util/distributedLock.ts does `new IoredisAdapter(client)`. Since this
// replacement is a plain function that explicitly returns an object, `new
// IoredisAdapter(...)` yields that object instead of a fresh `this`
// (standard JS constructor-return semantics) -- letting tests swap in a
// controllable in-memory adapter instead of a real ioredis client, without
// touching production code.
vi.mock(import("redlock-universal"), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    IoredisAdapter: function fakeIoredisAdapter() {
      return mocks.currentAdapter;
    } as unknown as typeof actual.IoredisAdapter,
  };
});

describe("#distributedLock", () => {
  let kuzzle: { ask: ReturnType<typeof vi.fn> };
  let withLock: typeof import("../../lib/util/distributedLock").withLock;
  let MutexLockLostError: typeof import("../../lib/util/distributedLock").MutexLockLostError;

  beforeEach(async () => {
    kuzzle = { ask: vi.fn().mockResolvedValue({}) };
    (globalThis as { kuzzle?: unknown }).kuzzle = kuzzle;

    mocks.currentAdapter = new redlockUniversal.MemoryAdapter();

    // Force lib/util/distributedLock.ts to re-evaluate so its module-level
    // adapter cache starts fresh for every test.
    vi.resetModules();
    ({ withLock, MutexLockLostError } =
      await import("../../lib/util/distributedLock"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#client bridge", () => {
    it("asks for the raw client only once, no matter how many locks are taken", async () => {
      await withLock("foo", async () => "a");
      await withLock("bar", async () => "b");

      expect(kuzzle.ask).toHaveBeenCalledTimes(1);
      expect(kuzzle.ask).toHaveBeenCalledWith("core:cache:internal:client:get");
    });

    it("does not permanently cache a failed client lookup", async () => {
      kuzzle.ask.mockRejectedValueOnce(new Error("boom"));

      await expect(withLock("foo", async () => "a")).rejects.toThrow("boom");

      kuzzle.ask.mockResolvedValueOnce({});

      await expect(withLock("foo", async () => "a")).resolves.toBe("a");
    });
  });

  describe("#reentrancy", () => {
    it("does not re-lock a key already held by an ancestor call", async () => {
      const result = await withLock("foo", () =>
        withLock("foo", async () => "nested"),
      );

      expect(result).toBe("nested");
      // Only the 1st, outermost call actually needs the client/adapter
      expect(kuzzle.ask).toHaveBeenCalledTimes(1);
    });

    it("locks different keys independently, allowing nesting", async () => {
      const result = await withLock("foo", () =>
        withLock("bar", async () => "nested-different-key"),
      );

      expect(result).toBe("nested-different-key");
    });

    it("ignores config on a reentrant call for an already-held key", async () => {
      const result = await withLock("foo", () =>
        // ttl: 1 would fail fast if this actually attempted a fresh
        // acquisition -- it must be ignored since "foo" is already held
        withLock("foo", async () => "nested-with-config", { ttl: 1 }),
      );

      expect(result).toBe("nested-with-config");
    });
  });

  describe("#contention", () => {
    it("waits for a held key to be released before proceeding", async () => {
      const order: string[] = [];

      const first = withLock(
        "contended",
        async () => {
          order.push("first-start");
          await new Promise((resolve) => setTimeout(resolve, 150));
          order.push("first-end");
          return "first";
        },
        { retryAttempts: 20, retryDelay: 30, ttl: 2000 },
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = withLock(
        "contended",
        async () => {
          order.push("second-start");
          return "second";
        },
        { retryAttempts: 20, retryDelay: 30, ttl: 2000 },
      );

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toBe("first");
      expect(secondResult).toBe("second");
      expect(order).toEqual(["first-start", "first-end", "second-start"]);
    });
  });

  describe("#lock loss", () => {
    it("rejects with MutexLockLostError as soon as the lock is lost mid-callback", async () => {
      mocks.currentAdapter = new FlakyAdapter();

      // ttl must stay above ~1250ms: redlock-universal enforces a 1000ms
      // minimum extension interval, so anything lower makes it attempt (and,
      // here, fail) extension immediately instead of on a schedule.
      await expect(
        withLock(
          "loss-test",
          () =>
            new Promise((_resolve, reject) => {
              setTimeout(
                () => reject(new Error("callback should have been outraced")),
                3000,
              );
            }),
          { retryAttempts: 1, retryDelay: 30, ttl: 1500 },
        ),
      ).rejects.toThrow(MutexLockLostError);
    });
  });
});
