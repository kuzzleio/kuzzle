"use strict";

const sinon = require("sinon");
const should = require("should");
const mockRequire = require("mock-require");

describe("#mutex2 (withLock)", () => {
  let withLock;
  let fakeLockInstance;
  let createLockStub;

  beforeEach(() => {
    fakeLockInstance = {
      using: sinon.stub().callsFake((routine) => routine()),
    };

    createLockStub = sinon.stub().returns(fakeLockInstance);

    mockRequire("redlock-universal", {
      createLock: createLockStub,
      IoredisAdapter: sinon.stub().callsFake((client) => ({ client })),
    });

    global.cacheEngine = {
      internal: { client: { fake: true } },
      public: { client: { fake: true } },
    };

    ({ withLock } = mockRequire.reRequire("../../lib/util/mutex2"));
  });

  afterEach(() => {
    mockRequire.stopAll();
    delete global.cacheEngine;
  });

  it("should acquire a lock and execute the callback", async () => {
    const result = await withLock("resource:1", async () => "done");

    should(result).eql("done");
    should(createLockStub).be.calledOnce();
    should(createLockStub.firstCall.args[0]).have.property("key", "resource:1");
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

  it("should throw if globalThis.cacheEngine is not set", async () => {
    delete global.cacheEngine;

    await should(withLock("no-cache", async () => "nope")).be.rejectedWith(
      TypeError,
    );
  });
});
