"use strict";

const should = require("should");
const mockRequire = require("mock-require");

const KuzzleMock = require("../mocks/kuzzle.mock");

const redlockUniversal = require("redlock-universal");

/**
 * FlakyAdapter simulates lock loss: its extension attempts always fail, as
 * if another node had taken over the key, so we can deterministically
 * exercise the MutexLockLostError path without racing real Redis timing.
 */
class FlakyAdapter extends redlockUniversal.MemoryAdapter {
  async atomicExtend(key, _value, minTTL) {
    return this.interpretAtomicExtensionResult(key, minTTL, [-1, -2]);
  }
}

describe("#distributedLock", () => {
  let kuzzle;
  let withLock;
  let MutexLockLostError;
  let currentAdapter;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    currentAdapter = new redlockUniversal.MemoryAdapter();

    // lib/util/distributedLock.ts does `new IoredisAdapter(client)`. Since
    // this replacement is a plain function that explicitly returns an
    // object, `new IoredisAdapter(...)` yields that object instead of a
    // fresh `this` (standard JS constructor-return semantics) -- letting
    // tests swap in a controllable in-memory adapter instead of a real
    // ioredis client, without touching production code.
    mockRequire("redlock-universal", {
      ...redlockUniversal,
      IoredisAdapter: function fakeIoredisAdapter() {
        return currentAdapter;
      },
    });

    kuzzle.ask.withArgs("core:cache:internal:client:get").resolves({});

    ({ withLock, MutexLockLostError } = mockRequire.reRequire(
      "../../lib/util/distributedLock",
    ));
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  describe("#client bridge", () => {
    it("asks for the raw client only once, no matter how many locks are taken", async () => {
      await withLock("foo", async () => "a");
      await withLock("bar", async () => "b");

      should(kuzzle.ask.callCount).eql(1);
      should(kuzzle.ask).calledWith("core:cache:internal:client:get");
    });

    it("does not permanently cache a failed client lookup", async () => {
      kuzzle.ask
        .withArgs("core:cache:internal:client:get")
        .rejects(new Error("boom"));

      await should(withLock("foo", async () => "a")).be.rejectedWith("boom");

      kuzzle.ask.withArgs("core:cache:internal:client:get").resolves({});

      await should(withLock("foo", async () => "a")).be.fulfilledWith("a");
    });
  });

  describe("#reentrancy", () => {
    it("does not re-lock a key already held by an ancestor call", async () => {
      const result = await withLock("foo", () =>
        withLock("foo", async () => "nested"),
      );

      should(result).eql("nested");
      // Only the 1st, outermost call actually needs the client/adapter
      should(kuzzle.ask.callCount).eql(1);
    });

    it("locks different keys independently, allowing nesting", async () => {
      const result = await withLock("foo", () =>
        withLock("bar", async () => "nested-different-key"),
      );

      should(result).eql("nested-different-key");
    });

    it("ignores config on a reentrant call for an already-held key", async () => {
      const result = await withLock("foo", () =>
        // ttl: 1 would fail fast if this actually attempted a fresh
        // acquisition -- it must be ignored since "foo" is already held
        withLock("foo", async () => "nested-with-config", { ttl: 1 }),
      );

      should(result).eql("nested-with-config");
    });
  });

  describe("#contention", () => {
    it("waits for a held key to be released before proceeding", async () => {
      const order = [];

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

      should(firstResult).eql("first");
      should(secondResult).eql("second");
      should(order).eql(["first-start", "first-end", "second-start"]);
    });
  });

  describe("#lock loss", () => {
    it("rejects with MutexLockLostError as soon as the lock is lost mid-callback", async () => {
      currentAdapter = new FlakyAdapter();

      // ttl must stay above ~1250ms: redlock-universal enforces a 1000ms
      // minimum extension interval, so anything lower makes it attempt
      // (and, here, fail) extension immediately instead of on a schedule.
      await should(
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
      ).be.rejectedWith(MutexLockLostError);
    });
  });
});
