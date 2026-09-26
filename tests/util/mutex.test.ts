import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InternalError } from "../../lib/kerror/errors/internalError";
import type { Mutex as MutexClass } from "../../lib/util/mutex";
import { restoreKuzzle, stubKuzzle } from "../mocks/kuzzle";

/**
 * The subject keeps a module-level `delScriptRegistered`, so "the LUA script
 * is defined once" is a question about the *module*, not about an instance.
 * The Mocha spec answered it with `mockRequire.reRequire` in the middle of a
 * test; here every test imports the module fresh, which is the same thing
 * said once, at the top.
 */
async function freshModules(): Promise<{
  InternalError: typeof InternalError;
  Mutex: typeof MutexClass;
}> {
  vi.resetModules();

  /*
   * ⚠️ The error class comes from the same re-evaluated graph as the subject.
   * A statically imported `InternalError` is a *different class object* after
   * `vi.resetModules()`, so `toBeInstanceOf` fails against an error the
   * re-imported module raised — the fifth occurrence of that lesson in this
   * step, after L4a's and L4b's.
   */
  return {
    InternalError: (await import("../../lib/kerror/errors/internalError"))
      .InternalError,
    Mutex: (await import("../../lib/util/mutex")).Mutex,
  };
}

describe("#util/Mutex", () => {
  let Mutex: typeof MutexClass;
  let KuzzleInternalError: typeof InternalError;
  let ask: ReturnType<typeof vi.fn>;
  let stored: boolean[];
  let cached: boolean[];

  /** The arguments of every `ask` for one event, in order. */
  const asked = (event: string) =>
    ask.mock.calls
      .filter(([name]) => name === event)
      .map(([, ...args]) => args);

  beforeEach(async () => {
    /*
     * `stored` and `cached` are answer *queues*: a lock that has to retry is
     * the whole point of this class, so what a test arranges is the sequence
     * of answers the cache gives, not a single value. The last answer repeats.
     */
    stored = [true];
    cached = [false];

    ask = vi.fn(async (event: string) => {
      if (event === "core:cache:internal:store") {
        return stored.length > 1 ? stored.shift() : stored[0];
      }

      if (event === "core:cache:internal:get") {
        return cached.length > 1 ? cached.shift() : cached[0];
      }

      return undefined;
    });

    stubKuzzle({ ask, id: "knode-test" });

    ({ InternalError: KuzzleInternalError, Mutex } = await freshModules());
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#lock", () => {
    it("stores the resource under its own id, with the configured ttl", async () => {
      const mutex = new Mutex("foo", { timeout: 0, ttl: 123 });

      expect(await mutex.lock()).toBe(true);
      expect(asked("core:cache:internal:store")).toEqual([
        ["foo", mutex.mutexId, { onlyIfNew: true, ttl: 123 }],
      ]);
    });

    it("gives every instance a distinct id", () => {
      expect(new Mutex("foo").mutexId).not.toBe(new Mutex("foo").mutexId);
    });

    /*
     * Not covered by the Mocha spec, which only asserted that two ids differ:
     * the id is `<node>/<random>`, and the node half is what makes a lock
     * traceable to the node holding it when a cluster deadlocks.
     */
    it("names the node it was taken on", () => {
      expect(new Mutex("foo").mutexId).toMatch(/^knode-test\/[0-9a-f]{32}$/);
    });

    it("refuses to lock twice with the same instance", async () => {
      const mutex = new Mutex("foo", { timeout: 0 });

      await mutex.lock();

      await expect(mutex.lock()).rejects.toBeInstanceOf(KuzzleInternalError);
      await expect(mutex.lock()).rejects.toMatchObject({
        id: "core.fatal.assertion_failed",
      });
    });

    it("gives up immediately when the resource is taken and timeout is 0", async () => {
      stored = [false];

      const mutex = new Mutex("foo", { timeout: 0, ttl: 123 });

      expect(await mutex.lock()).toBe(false);
      expect(asked("core:cache:internal:store")).toEqual([
        ["foo", mutex.mutexId, { onlyIfNew: true, ttl: 123 }],
      ]);
    });

    /*
     * Real timers, a 1 ms attempt delay and a 5 ms budget, rather than the
     * Mocha spec's fake clock ticked in a loop: what is under test is that it
     * retries and then gives up, and the assertion that says so is the number
     * of attempts. The fake clock made the same point in twelve lines, and
     * its last assertion — `should(mutexPromise).be.fulfilledWith(false)` —
     * was never awaited.
     */
    it("retries until the timeout, then gives up", async () => {
      stored = [false];

      const mutex = new Mutex("foo", { attemptDelay: 1, timeout: 5 });

      expect(await mutex.lock()).toBe(false);
      expect(asked("core:cache:internal:store").length).toBeGreaterThan(1);
    });

    it("takes the lock as soon as the resource is freed", async () => {
      stored = [false, false, true];

      const mutex = new Mutex("foo", { attemptDelay: 1, timeout: 1000 });

      expect(await mutex.lock()).toBe(true);
      expect(asked("core:cache:internal:store")).toHaveLength(3);
      expect(mutex.locked).toBe(true);
    });

    it("waits indefinitely when the timeout is -1", async () => {
      stored = [false, false, false, false, false, true];

      const mutex = new Mutex("foo", { attemptDelay: 1, timeout: -1 });

      expect(await mutex.lock()).toBe(true);
      expect(asked("core:cache:internal:store")).toHaveLength(6);
    });
  });

  describe("#wait", () => {
    it("resolves true once the resource is free", async () => {
      cached = [true, true, false];

      const mutex = new Mutex("foo", { attemptDelay: 1 });

      expect(await mutex.wait({ timeout: -1 })).toBe(true);
    });

    it("resolves false when the resource is still held at the timeout", async () => {
      cached = [true];

      const mutex = new Mutex("foo", { attemptDelay: 1 });

      expect(await mutex.wait({ timeout: 0 })).toBe(false);
    });

    /*
     * Not covered by the Mocha spec: `wait` reads the cache, it does not
     * write it. A `wait` that stored anything would be taking the lock it is
     * only supposed to be watching.
     */
    it("never stores anything", async () => {
      cached = [false];

      await new Mutex("foo", { attemptDelay: 1 }).wait({ timeout: 0 });

      expect(asked("core:cache:internal:store")).toEqual([]);
    });
  });

  describe("#unlock", () => {
    it("deletes the lock through the id-checking script", async () => {
      const mutex = new Mutex("foo", { timeout: 0 });

      await mutex.lock();
      expect(mutex.locked).toBe(true);

      await mutex.unlock();

      expect(mutex.locked).toBe(false);
      expect(asked("core:cache:internal:script:execute")).toEqual([
        ["delIfValueEqual", "foo", mutex.mutexId],
      ]);
    });

    it("refuses to unlock a resource it does not hold", async () => {
      const mutex = new Mutex("foo", { timeout: 0 });

      await expect(mutex.unlock()).rejects.toBeInstanceOf(KuzzleInternalError);
      await expect(mutex.unlock()).rejects.toMatchObject({
        id: "core.fatal.assertion_failed",
      });
    });

    it("defines the LUA script once per process, not once per mutex", async () => {
      const mutex = new Mutex("foo", { timeout: 0 });

      await mutex.lock();
      await mutex.unlock();

      expect(asked("core:cache:internal:script:define")).toEqual([
        ["delIfValueEqual", 1, expect.any(String)],
      ]);

      const another = new Mutex("bar", { timeout: 0 });

      await another.lock();
      await another.unlock();

      /* Still one: the flag is module-level, and that is what it is for. */
      expect(asked("core:cache:internal:script:define")).toHaveLength(1);
    });

    /*
     * Not covered by the Mocha spec, and the reason the script exists: the
     * delete is conditional on the value, so a lock whose TTL expired and
     * was re-taken by another node is not deleted by this one's `unlock`.
     */
    it("passes its own id to the script, so it can only delete its own lock", async () => {
      const mine = new Mutex("foo", { timeout: 0 });
      const theirs = new Mutex("foo", { timeout: 0 });

      await mine.lock();
      await mine.unlock();

      const [[, , id]] = asked("core:cache:internal:script:execute");

      expect(id).toBe(mine.mutexId);
      expect(id).not.toBe(theirs.mutexId);
    });
  });

  /*
   * F-13: a node evicted while starting its plugins exited holding
   * `Store.init(...)`, and another node timed out waiting on it for the
   * lock's 30 s ttl.
   */
  describe(".releaseAllBeforeExit", () => {
    /** Settles to "pending" when `promise` has not settled on its own. */
    const settled = (promise: Promise<unknown>) =>
      Promise.race([
        promise.then(() => "settled"),
        new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
      ]);

    it("frees every lock still held, and only those", async () => {
      const foo = new Mutex("foo", { timeout: 0 });
      const bar = new Mutex("bar", { timeout: 0 });
      const done = new Mutex("done", { timeout: 0 });

      await foo.lock();
      await bar.lock();
      await done.lock();
      await done.unlock();
      ask.mockClear();

      await Mutex.releaseAllBeforeExit();

      expect(foo.locked).toBe(false);
      expect(bar.locked).toBe(false);
      expect(asked("core:cache:internal:script:execute")).toEqual([
        ["delIfValueEqual", "foo", foo.mutexId],
        ["delIfValueEqual", "bar", bar.mutexId],
      ]);
    });

    it("frees the other locks when one cannot be freed", async () => {
      const foo = new Mutex("foo", { timeout: 0 });
      const bar = new Mutex("bar", { timeout: 0 });

      await foo.lock();
      await bar.lock();

      ask.mockImplementation(async (event: string, ...args: unknown[]) => {
        if (
          event === "core:cache:internal:script:execute" &&
          args[1] === "foo"
        ) {
          throw new Error("Redis is gone");
        }
      });

      await expect(Mutex.releaseAllBeforeExit()).resolves.toBeUndefined();
      expect(bar.locked).toBe(false);
    });

    it("never resolves a lock asked for afterwards, and takes nothing", async () => {
      await Mutex.releaseAllBeforeExit();
      ask.mockClear();

      const mutex = new Mutex("foo", { timeout: 0 });

      expect(await settled(mutex.lock())).toBe("pending");
      expect(asked("core:cache:internal:store")).toEqual([]);
    });

    it("gives back a lock acquired while it was running", async () => {
      let answer: (locked: boolean) => void = () => undefined;

      ask.mockImplementation(async (event: string) =>
        event === "core:cache:internal:store"
          ? new Promise((resolve) => {
              answer = resolve;
            })
          : undefined,
      );

      const mutex = new Mutex("foo", { timeout: 0 });
      const locking = mutex.lock();

      await Mutex.releaseAllBeforeExit();
      answer(true);

      expect(await settled(locking)).toBe("pending");
      expect(mutex.locked).toBe(false);
      expect(asked("core:cache:internal:script:execute")).toEqual([
        ["delIfValueEqual", "foo", mutex.mutexId],
      ]);
    });
  });
});
