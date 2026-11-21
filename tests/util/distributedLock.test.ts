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
  let kuzzle: {
    ask: ReturnType<typeof vi.fn>;
    log: { warn: ReturnType<typeof vi.fn> };
  };
  let withLock: typeof import("../../lib/util/distributedLock").withLock;
  let MutexAcquireError: typeof import("../../lib/util/distributedLock").MutexAcquireError;
  let MutexLockLostError: typeof import("../../lib/util/distributedLock").MutexLockLostError;
  let releaseAllLocksBeforeExit: typeof import("../../lib/util/distributedLock").releaseAllLocksBeforeExit;
  let trackLockWaits: typeof import("../../lib/util/distributedLock").trackLockWaits;
  let isLockHeldHere: typeof import("../../lib/util/distributedLock").isLockHeldHere;

  beforeEach(async () => {
    client = new RedisMock();
    other = new RedisMock();
    await client.flushall();

    kuzzle = {
      ask: vi.fn().mockResolvedValue(client),
      log: { warn: vi.fn() },
    };
    (globalThis as { kuzzle?: unknown }).kuzzle = kuzzle;

    // Force lib/util/distributedLock.ts to re-evaluate so its module-level
    // client cache starts fresh for every test.
    vi.resetModules();
    ({
      withLock,
      MutexAcquireError,
      MutexLockLostError,
      releaseAllLocksBeforeExit,
      trackLockWaits,
      isLockHeldHere,
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
        // Default TTL: a lock left by a node that died expires within 10 s
        // (#3207)
        expect(await other.pttl("foo")).toBeGreaterThan(9000);
        expect(await other.pttl("foo")).toBeLessThanOrEqual(10000);
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

  describe("#TTL extension interval", () => {
    /*
     * #3207: the TTL is extended every third of it, so that a holder whose
     * event loop or Redis stalls keeps about 2/3 of the TTL before losing
     * the lock (redis-semaphore's own default, 80 %, would leave 1/5).
     */
    it("extends the lock every third of its TTL", async () => {
      const extensions = vi.spyOn(client, "evalsha");

      await withLock(
        "steady",
        async () => {
          await sleep(1000);
        },
        { ttl: 600 },
      );

      // ~200 ms apart: at least 4 in 1 s (80 % of the TTL would give 2)
      const refreshes = extensions.mock.calls.filter((call) =>
        call.includes("steady"),
      ).length;
      expect(refreshes).toBeGreaterThanOrEqual(4);
    });
  });

  describe("#isLockHeldHere", () => {
    it("tells whether this process holds a lock, and only while it does", async () => {
      await other.set("remote", "node-2", "PX", 10000);
      expect(isLockHeldHere("local")).toBe(false);

      await withLock("local", async () => {
        expect(isLockHeldHere("local")).toBe(true);
        expect(isLockHeldHere("remote")).toBe(false);
      });

      expect(isLockHeldHere("local")).toBe(false);
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
      expect(kuzzle.log.warn).toHaveBeenCalledOnce();
      expect(kuzzle.log.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Lock "lost" lost: it expired, or another node holds it\. This node last extended it \d+ ms ago \(TTL: 300 ms\)/,
        ),
      );
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
        expect(kuzzle.log.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "it could not be extended (READONLY You can't write against a replica)",
          ),
        );

        await sleep(50);
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    });
  });
  /*
   * #3212: a node frozen longer than the TTL (event-loop stall, `docker
   * pause`) loses its lock to another node, then resumes and finishes its
   * critical section. withLock may have settled already: the loss must still
   * be logged, once.
   */
  describe("#lock lost during a stall", () => {
    // Blocks the event loop, as a paused or stalled process does
    const freeze = (ms: number) =>
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

    it("logs a warning naming the lock and how long ago it was last extended", async () => {
      const result = await withLock(
        "stalled",
        async () => {
          await sleep(10);
          freeze(500);
          // The lock expired while frozen: another node takes it
          await other.set("stalled", "node-2", "PX", 10000, "NX");
          return "done anyway";
        },
        { ttl: 300 },
      );

      // Not a lock semantics change: the callback's outcome stands
      expect(result).toBe("done anyway");

      await vi.waitFor(() => expect(kuzzle.log.warn).toHaveBeenCalled());
      await sleep(50);

      expect(kuzzle.log.warn).toHaveBeenCalledOnce();
      const [message] = kuzzle.log.warn.mock.calls[0] as [string];
      expect(message).toMatch(/^Lock "stalled" lost: /);
      expect(message).toContain("(TTL: 300 ms)");
      const [, elapsed] = /last extended it (\d+) ms ago/.exec(message) ?? [];
      expect(Number(elapsed)).toBeGreaterThanOrEqual(500);

      // The other node's lock is left alone
      expect(await other.get("stalled")).toBe("node-2");
    });

    it("logs a warning when the release finds the lock owned by another node", async () => {
      await withLock(
        "taken",
        async () => {
          // e.g. expired and taken over between two extensions
          await other.set("taken", "node-2");
        },
        { ttl: 10000 },
      );

      expect(kuzzle.log.warn).toHaveBeenCalledOnce();
      expect(kuzzle.log.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Lock "taken" lost: it had expired, or another node held it, on release\. This node last extended it \d+ ms ago \(TTL: 10000 ms\)/,
        ),
      );
      expect(await other.get("taken")).toBe("node-2");
    });

    it("logs a warning when the release finds the lock expired", async () => {
      await withLock(
        "expired",
        async () => {
          await other.del("expired");
        },
        { ttl: 10000 },
      );

      expect(kuzzle.log.warn).toHaveBeenCalledOnce();
      expect(kuzzle.log.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^Lock "expired" lost: /),
      );
    });

    it("logs nothing when the lock is released normally", async () => {
      await withLock("foo", async () => "a");
      await withLock("bar", async () => sleep(400), { ttl: 300 });

      expect(kuzzle.log.warn).not.toHaveBeenCalled();
      expect(await other.exists("foo")).toBe(0);
      expect(await other.exists("bar")).toBe(0);
    });
  });

  /*
   * #3156: a plugin's `init` that times out says which lock it was waiting
   * for, held by another node or left behind by one that died.
   */
  describe("#trackLockWaits", () => {
    it("lists the locks the tracked work is waiting for, and only while it waits", async () => {
      await other.set("foo", "node-2", "PX", 10000);

      const tracked = trackLockWaits(async () => {
        await withLock("free", async () => undefined);

        return withLock("foo", async () => "done", { retryDelay: 10 });
      });

      await vi.waitFor(() => expect(tracked.waitingFor()).toEqual(["foo"]));

      await other.del("foo");

      await expect(tracked.promise).resolves.toBe("done");
      expect(tracked.waitingFor()).toEqual([]);
    });

    it("forgets a lock that could not be acquired", async () => {
      await other.set("foo", "node-2", "PX", 10000);

      const tracked = trackLockWaits(() =>
        withLock("foo", async () => "never", {
          retryAttempts: 1,
          retryDelay: 10,
        }),
      );

      await expect(tracked.promise).rejects.toBeInstanceOf(MutexAcquireError);
      expect(tracked.waitingFor()).toEqual([]);
    });

    it("does not see the locks other work waits for", async () => {
      await other.set("foo", "node-2", "PX", 10000);
      const tracked = trackLockWaits(() => new Promise<void>(() => undefined));

      const untracked = withLock("foo", async () => "theirs", {
        retryDelay: 10,
      });
      await sleep(50);

      expect(tracked.waitingFor()).toEqual([]);

      await other.del("foo");
      await expect(untracked).resolves.toBe("theirs");
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

    it("lets a callback that finishes afterwards settle with its own outcome", async () => {
      let finish: () => void = () => undefined;
      let started = false;

      const locking = withLock("foo", async () => {
        started = true;
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return "done";
      });
      await vi.waitFor(() => expect(started).toBe(true));

      await releaseAllLocksBeforeExit();
      expect(await other.exists("foo")).toBe(0);

      // Its own release, on a lock already given back, must not reject
      finish();
      await expect(locking).resolves.toBe("done");
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
