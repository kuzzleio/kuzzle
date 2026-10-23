import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RedisMock from "ioredis-mock";
import { LostLockError } from "redis-semaphore";

/**
 * The spec runs redis-semaphore against ioredis-mock, which implements the
 * commands it relies on the way Redis does: `SET ... PX ... NX` with real TTL
 * expiry, and `EVALSHA` (answering NOSCRIPT) / `EVAL` running the actual Lua
 * scripts that check the lock token before extending or deleting the key.
 *
 * ioredis-mock instances sharing host and port share their data: `other`
 * plays another Kuzzle node talking to the same Redis server.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("#distributedLock", () => {
  let client: InstanceType<typeof RedisMock>;
  let other: InstanceType<typeof RedisMock>;
  let kuzzle: { ask: ReturnType<typeof vi.fn> };
  let withLock: typeof import("../../lib/util/distributedLock").withLock;
  let MutexAcquireError: typeof import("../../lib/util/distributedLock").MutexAcquireError;
  let MutexLockLostError: typeof import("../../lib/util/distributedLock").MutexLockLostError;
  let releaseAllLocksBeforeExit: typeof import("../../lib/util/distributedLock").releaseAllLocksBeforeExit;

  beforeEach(async () => {
    client = new RedisMock();
    other = new RedisMock();
    await client.flushall();

    kuzzle = { ask: vi.fn().mockResolvedValue(client) };
    (globalThis as { kuzzle?: unknown }).kuzzle = kuzzle;

    // Force lib/util/distributedLock.ts to re-evaluate so its module-level
    // client cache starts fresh for every test.
    vi.resetModules();
    ({
      withLock,
      MutexAcquireError,
      MutexLockLostError,
      releaseAllLocksBeforeExit,
    } = await import("../../lib/util/distributedLock"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    client.disconnect();
    other.disconnect();
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
      await expect(withLock("foo", async () => "a")).resolves.toBe("a");
      expect(kuzzle.ask).toHaveBeenCalledTimes(2);
    });
  });

  describe("#acquire and release", () => {
    it("holds the resource key itself while the callback runs, and deletes it afterwards", async () => {
      const result = await withLock("foo", async () => {
        // Same key as the deprecated Mutex class, no prefix
        expect(await other.get("foo")).toEqual(expect.any(String));
        expect(await other.pttl("foo")).toBeGreaterThan(29000);
        expect(await other.set("foo", "node-2", "PX", 1000, "NX")).toBeNull();

        return "done";
      });

      expect(result).toBe("done");
      expect(await other.exists("foo")).toBe(0);
    });

    it("releases the lock when the callback rejects, and rejects with its error", async () => {
      await expect(
        withLock("foo", async () => {
          throw new Error("callback failed");
        }),
      ).rejects.toThrow("callback failed");

      expect(await other.exists("foo")).toBe(0);
    });

    it("gives up after retryAttempts + 1 attempts on a key held elsewhere", async () => {
      // e.g. taken by the deprecated Mutex class on another node
      await other.set("busy", "node-2", "PX", 10000);
      const setSpy = vi.spyOn(client, "set");
      const callback = vi.fn(async () => "never");

      await expect(
        withLock("busy", callback, { retryAttempts: 2, retryDelay: 10 }),
      ).rejects.toThrow('Failed to acquire lock "busy" after 3 attempts');

      expect(setSpy).toHaveBeenCalledTimes(3);
      expect(callback).not.toHaveBeenCalled();
      // Never touches a lock it does not own
      expect(await other.get("busy")).toBe("node-2");
    });

    it("fails fast with MutexAcquireError when told not to retry", async () => {
      await other.set("busy", "node-2", "PX", 10000);
      const setSpy = vi.spyOn(client, "set");
      const callback = vi.fn(async () => "never");

      await expect(
        withLock("busy", callback, { retryAttempts: 0 }),
      ).rejects.toBeInstanceOf(MutexAcquireError);

      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(callback).not.toHaveBeenCalled();
    });

    /* redis-semaphore waits `retryInterval` after the last failed attempt
     * too: with no retry, that was a pause before every refusal. */
    it("does not wait retryDelay before failing with no retry", async () => {
      await other.set("busy", "node-2", "PX", 10000);
      const start = Date.now();

      await expect(
        withLock("busy", async () => "never", {
          retryAttempts: 0,
          retryDelay: 60000,
        }),
      ).rejects.toBeInstanceOf(MutexAcquireError);

      expect(Date.now() - start).toBeLessThan(1000);
    });

    it("gets the key once another holder's TTL expires", async () => {
      await other.set("expiring", "node-2", "PX", 100);

      await expect(
        withLock("expiring", async () => "acquired", {
          retryAttempts: 20,
          retryDelay: 20,
        }),
      ).resolves.toBe("acquired");
    });

    it("does not let a failed release replace the callback's result", async () => {
      const evalError = new Error("connection lost");
      vi.spyOn(client, "evalsha").mockRejectedValue(evalError);

      await expect(withLock("foo", async () => "result")).resolves.toBe(
        "result",
      );
    });
  });

  describe("#reentrancy", () => {
    it("does not re-lock a key already held by an ancestor call", async () => {
      const setSpy = vi.spyOn(client, "set");

      const result = await withLock("foo", () =>
        withLock("foo", async () => "nested"),
      );

      expect(result).toBe("nested");
      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it("locks different keys independently, allowing nesting", async () => {
      const result = await withLock("foo", () =>
        withLock("bar", async () => {
          expect(await other.exists("foo", "bar")).toBe(2);
          return "nested-different-key";
        }),
      );

      expect(result).toBe("nested-different-key");
    });

    it("ignores config on a reentrant call for an already-held key", async () => {
      const result = await withLock("foo", () =>
        // retryAttempts: 0 would fail at once if this actually attempted a
        // fresh acquisition -- it must be ignored since "foo" is already held
        withLock("foo", async () => "nested-with-config", {
          retryAttempts: 0,
          ttl: 1,
        }),
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
          await sleep(150);
          order.push("first-end");
          return "first";
        },
        { retryAttempts: 20, retryDelay: 30, ttl: 2000 },
      );

      await sleep(10);

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

  describe("#TTL extension", () => {
    it("keeps the lock past its TTL while the callback runs", async () => {
      const result = await withLock(
        "long",
        async () => {
          await sleep(700);
          expect(
            await other.set("long", "node-2", "PX", 1000, "NX"),
          ).toBeNull();
          return "done";
        },
        { ttl: 300 },
      );

      expect(result).toBe("done");
      expect(await other.exists("long")).toBe(0);
    });
  });

  describe("#lock loss", () => {
    it("rejects with MutexLockLostError as soon as the lock is taken over, while the callback keeps running", async () => {
      let callbackDone = false;
      const callbackFinished = new Promise<void>((resolve) => {
        setTimeout(() => {
          callbackDone = true;
          resolve();
        }, 1500);
      });

      const promise = withLock(
        "lost",
        async () => {
          // Another node took the key over (e.g. after a long event-loop
          // stall let it expire): the next extension finds a foreign token
          await other.set("lost", "node-2", "PX", 10000);
          await callbackFinished;
          return "too late";
        },
        { ttl: 300 },
      );

      const error = await promise.catch((err: unknown) => err);

      expect(error).toBeInstanceOf(MutexLockLostError);
      expect(error).toMatchObject({
        message: 'Lock lost for resource "lost"',
        name: "MutexLockLostError",
      });
      expect((error as Error).cause).toBeInstanceOf(LostLockError);
      expect(callbackDone).toBe(false);

      await callbackFinished;
      // The other node's lock was neither extended nor deleted by us
      expect(await other.get("lost")).toBe("node-2");
    });

    it("treats a failed TTL extension as a lost lock, reporting the Redis error as its cause", async () => {
      const redisError = new Error(
        "READONLY You can't write against a replica",
      );
      vi.spyOn(client, "evalsha").mockRejectedValue(redisError);
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);

      try {
        const error = await withLock(
          "flaky",
          () => new Promise<never>(() => undefined),
          { ttl: 300 },
        ).catch((err: unknown) => err);

        expect(error).toBeInstanceOf(MutexLockLostError);
        expect((error as Error).cause).toBe(redisError);

        await sleep(50);
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    });
  });
  /*
   * F-13: a node evicted while starting its plugins exited holding a lock,
   * and another node timed out waiting on it for the lock's TTL.
   * `process.exit` skips the `finally` that would release it.
   */
  describe("#releaseAllLocksBeforeExit", () => {
    /** Settles to "pending" when `promise` has not settled on its own. */
    const settled = (promise: Promise<unknown>) =>
      Promise.race([
        promise.then(
          () => "settled",
          () => "settled",
        ),
        new Promise((resolve) => setTimeout(() => resolve("pending"), 50)),
      ]);

    it("frees every lock still held, and only those", async () => {
      await other.set("theirs", "node-2", "PX", 10000);
      await withLock("done", async () => "released already");

      let started = 0;
      const never = new Promise<void>(() => undefined);
      const hold = (key: string) =>
        withLock(key, async () => {
          started++;
          await never;
        });

      void hold("foo");
      void hold("bar");
      await vi.waitFor(() => expect(started).toBe(2));

      await releaseAllLocksBeforeExit();

      expect(await other.exists("foo", "bar")).toBe(0);
      expect(await other.get("theirs")).toBe("node-2");
    });

    it("frees the other locks when one cannot be freed", async () => {
      let started = 0;
      const never = new Promise<void>(() => undefined);

      void withLock("foo", async () => {
        started++;
        await never;
      });
      void withLock("bar", async () => {
        started++;
        await never;
      });
      await vi.waitFor(() => expect(started).toBe(2));

      const evalsha = client.evalsha.bind(client);
      vi.spyOn(client, "evalsha").mockImplementation(((
        ...args: Parameters<typeof client.evalsha>
      ) =>
        args[2] === "foo"
          ? Promise.reject(new Error("Redis is gone"))
          : evalsha(...args)) as typeof client.evalsha);

      await expect(releaseAllLocksBeforeExit()).resolves.toBeUndefined();
      expect(await other.exists("bar")).toBe(0);
    });

    it("never settles a lock asked for afterwards, and takes nothing", async () => {
      await releaseAllLocksBeforeExit();
      const setSpy = vi.spyOn(client, "set");
      const callback = vi.fn(async () => "never");

      expect(await settled(withLock("foo", callback))).toBe("pending");
      expect(callback).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();
    });

    it("gives back a lock acquired while it was running", async () => {
      await other.set("foo", "node-2", "PX", 10000);
      const setSpy = vi.spyOn(client, "set");
      const callback = vi.fn(async () => "never");

      const locking = withLock("foo", callback, {
        retryAttempts: 50,
        retryDelay: 20,
      });

      await releaseAllLocksBeforeExit();
      await other.del("foo");

      // It gets the key on a later attempt, then gives it back: waited for
      // rather than assumed done within a fixed delay
      await vi.waitFor(async () => {
        expect(
          await Promise.all(setSpy.mock.results.map(({ value }) => value)),
        ).toContain("OK");
      });
      await vi.waitFor(async () => {
        expect(await other.exists("foo")).toBe(0);
      });

      expect(await settled(locking)).toBe("pending");
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
