"use strict";

const sinon = require("sinon");
const should = require("should");
const mockRequire = require("mock-require");

const KuzzleMock = require("../mocks/kuzzle.mock");

/**
 * Builds a fake `ExtendedAbortSignal`-like object whose abort state can be
 * driven from the test, without depending on the real redlock-universal
 * implementation.
 */
function createFakeSignal() {
  const target = new EventTarget();
  let aborted = false;
  let error;

  return {
    signal: {
      get aborted() {
        return aborted;
      },
      get error() {
        return error;
      },
      addEventListener: (...args) => target.addEventListener(...args),
      removeEventListener: (...args) => target.removeEventListener(...args),
    },
    abort(err) {
      aborted = true;
      error = err;
      target.dispatchEvent(new Event("abort"));
    },
  };
}

describe("#mutex2 (withLock)", () => {
  let withLock;
  let MutexLockLostError;
  let kuzzle;
  let fakeClient;
  let fakeLockInstance;
  let fakeSignal;
  let createLockStub;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    fakeClient = { fake: true };
    kuzzle.ask.withArgs("core:cache:internal:client:get").resolves(fakeClient);

    fakeSignal = createFakeSignal();

    fakeLockInstance = {
      using: sinon.stub().callsFake((routine) => routine(fakeSignal.signal)),
    };

    createLockStub = sinon.stub().returns(fakeLockInstance);

    mockRequire("redlock-universal", {
      createLock: createLockStub,
      IoredisAdapter: sinon.stub().callsFake((client) => ({ client })),
    });

    ({ withLock, MutexLockLostError } = mockRequire.reRequire(
      "../../lib/util/mutex2",
    ));
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  it("should acquire a lock and execute the callback", async () => {
    const result = await withLock("resource:1", async () => "done");

    should(result).eql("done");
    should(createLockStub).be.calledOnce();
    should(createLockStub.firstCall.args[0]).have.property("key", "resource:1");
  });

  it("should fetch the cache client via the ask event", async () => {
    await withLock("resource:1", async () => "done");

    should(kuzzle.ask).calledWith("core:cache:internal:client:get");
  });

  it("should forward the callback return value", async () => {
    const obj = { nested: [1, 2, 3] };
    const result = await withLock("key", async () => obj);

    should(result).deepEqual(obj);
  });

  it("should apply default config values", async () => {
    await withLock("key", async () => {});

    const config = createLockStub.firstCall.args[0];
    should(config.retryAttempts).eql(10);
    should(config.retryDelay).eql(200);
    should(config.ttl).eql(30000);
  });

  it("should apply custom config values", async () => {
    await withLock("key", async () => {}, {
      retryAttempts: 3,
      retryDelay: 50,
      ttl: 5000,
    });

    const config = createLockStub.firstCall.args[0];
    should(config.retryAttempts).eql(3);
    should(config.retryDelay).eql(50);
    should(config.ttl).eql(5000);
  });

  it("should not deadlock on reentrant lock with the same key", async () => {
    let innerExecuted = false;

    await withLock("same-key", async () => {
      await withLock("same-key", async () => {
        innerExecuted = true;
      });
    });

    should(innerExecuted).be.true();
    should(createLockStub).be.calledOnce();
  });

  it("should skip lock acquisition for deeply nested reentrant calls", async () => {
    let depth3Reached = false;

    await withLock("deep", async () => {
      await withLock("deep", async () => {
        await withLock("deep", async () => {
          depth3Reached = true;
        });
      });
    });

    should(depth3Reached).be.true();
    should(createLockStub.callCount).eql(1);
  });

  it("should acquire separate locks for different keys within a nested call", async () => {
    const order = [];

    await withLock("key-A", async () => {
      order.push("A-outer");

      await withLock("key-B", async () => {
        order.push("B-inner");
      });

      await withLock("key-A", async () => {
        order.push("A-reentrant");
      });
    });

    should(order).deepEqual(["A-outer", "B-inner", "A-reentrant"]);
    should(createLockStub.callCount).eql(2);
  });

  it("should track acquired locks per async context independently", async () => {
    let call1LockCount = 0;
    let call2LockCount = 0;

    const p1 = withLock("independent-1", async () => {
      call1LockCount = createLockStub.callCount;
    });

    const p2 = withLock("independent-2", async () => {
      call2LockCount = createLockStub.callCount;
    });

    await Promise.all([p1, p2]);

    should(createLockStub.callCount).eql(2);
    should(call1LockCount).be.greaterThanOrEqual(1);
    should(call2LockCount).be.greaterThanOrEqual(1);
  });

  it("should propagate errors thrown inside the callback", async () => {
    await should(
      withLock("err-key", async () => {
        throw new Error("callback-boom");
      }),
    ).be.rejectedWith("callback-boom");
  });

  it("should propagate errors from lock acquisition failure", async () => {
    fakeLockInstance.using.rejects(new Error("acquisition-failed"));

    await should(
      withLock("fail-key", async () => "should-not-reach"),
    ).be.rejectedWith("acquisition-failed");
  });

  it("should propagate errors from a reentrant callback without affecting lock state", async () => {
    let outerContinued = false;

    await should(
      withLock("err-reentrant", async () => {
        try {
          await withLock("err-reentrant", async () => {
            throw new Error("inner-boom");
          });
        } catch (e) {
          outerContinued = true;
          throw e;
        }
      }),
    ).be.rejectedWith("inner-boom");

    should(outerContinued).be.true();
  });

  it("should handle a callback returning undefined", async () => {
    const result = await withLock("void-key", async () => {});

    should(result).be.undefined();
  });

  it("should handle a callback returning null", async () => {
    const result = await withLock("null-key", async () => null);

    should(result).be.null();
  });

  it("should handle a callback returning a resolved promise with 0", async () => {
    const result = await withLock("zero-key", async () => 0);

    should(result).eql(0);
  });

  it("should propagate errors when the cache client cannot be retrieved", async () => {
    kuzzle.ask
      .withArgs("core:cache:internal:client:get")
      .rejects(new Error("cache not initialized"));

    await should(withLock("no-cache", async () => "nope")).be.rejectedWith(
      "cache not initialized",
    );
  });

  describe("lock loss handling", () => {
    it("should reject immediately if the lock is already lost when the callback starts", async () => {
      fakeSignal.abort(new Error("extension-failed"));

      await should(
        withLock("already-lost", async () => "should-not-reach"),
      ).be.rejectedWith(MutexLockLostError, {
        message: /extension-failed/,
      });
    });

    it("should reject with MutexLockLostError if the lock is lost while the callback is running", async () => {
      const promise = withLock("lost-mid-flight", () => {
        fakeSignal.abort(new Error("extension-failed"));

        // never resolves on its own: only the abort should settle the
        // returned promise
        return new Promise(() => {});
      });

      await should(promise).be.rejectedWith(MutexLockLostError, {
        message: /extension-failed/,
      });
    });

    it("should not reject if the callback settles before any abort occurs", async () => {
      const result = await withLock("no-abort", async () => "completed");

      should(result).eql("completed");
    });

    it("should ignore a late abort once the callback already resolved", async () => {
      let callbackDone;
      const callbackDonePromise = new Promise((resolve) => {
        callbackDone = resolve;
      });

      const promise = withLock("late-abort", async () => {
        callbackDone();
        return "resolved-first";
      });

      await callbackDonePromise;
      const result = await promise;

      // aborting after the callback already settled must be a no-op
      fakeSignal.abort(new Error("too-late"));

      should(result).eql("resolved-first");
    });
  });
});
