"use strict";

const should = require("should");
const sinon = require("sinon");

const { IDCardRenewer } = require("../../../lib/cluster/workers/IDCardRenewer");

describe("ClusterIDCardRenewer", () => {
  describe("#init", () => {
    let idCardRenewer;

    beforeEach(() => {
      process.send = sinon.stub();
      idCardRenewer = new IDCardRenewer();
      idCardRenewer.initRedis = sinon.stub().resolves();
      idCardRenewer.renewIDCard = sinon.stub().resolves();
    });

    it("should initialize the redis client", async () => {
      await idCardRenewer.init({
        redis: {
          config: {
            initTimeout: 42,
          },
          name: "foo",
        },
      });

      should(idCardRenewer.initRedis).be.calledOnce().and.be.calledWith(
        {
          initTimeout: 42,
        },
        "foo",
      );
    });

    it("should init variable based on the given config", async () => {
      await idCardRenewer.init({
        redis: {
          config: {
            initTimeout: 42,
          },
          name: "foo",
        },
        nodeIdKey: "nodeIdKey",
        refreshDelay: 666,
      });

      should(idCardRenewer.nodeIdKey).be.eql("nodeIdKey");
      should(idCardRenewer.refreshDelay).be.eql(666);
      should(idCardRenewer.refreshTimer).not.null();
      should(idCardRenewer.disposed).be.false();
    });

    it("should set an interval that will call the method renewIDCard", async () => {
      idCardRenewer.renewIDCard = sinon.stub().resolves();
      const stub = sinon.spy(global, "setInterval");

      await idCardRenewer.init({
        redis: {
          config: {
            initTimeout: 42,
          },
          name: "foo",
        },
        nodeIdKey: "nodeIdKey",
        refreshDelay: 1,
      });

      await new Promise((res) => setTimeout(res, 1));

      should(idCardRenewer.renewIDCard).be.calledTwice();
      should(stub).be.calledOnce().and.be.calledWith(sinon.match.func, 1);
    });

    it("should default the refresh delay to 2s when the parent sent none", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: {},
      });

      should(idCardRenewer.refreshDelay).be.eql(2000);
    });

    it("should do nothing when it has already been initialized", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: {},
      });

      idCardRenewer.initRedis.resetHistory();
      process.send.resetHistory();

      await idCardRenewer.init({
        nodeIdKey: "another-key",
        redis: {},
      });

      should(idCardRenewer.initRedis).not.be.called();
      should(process.send).not.be.called();
      should(idCardRenewer.nodeIdKey).be.eql("nodeIdKey");
    });

    it("should throw on `this.parentPort` instead of reporting a redis failure", async () => {
      /*
       * ⚠️ This pins a DEFECT, not a contract — ADR-0001 TD-63.
       *
       * `this.parentPort` is never assigned anywhere in `lib/`. The worker is
       * spawned with `child_process.fork()` and talks over `process.send`,
       * which every other line of this file does; `parentPort` is the
       * `worker_threads` API, left behind by an earlier implementation.
       *
       * So the one path that exists to say *why* the ID card cannot be renewed
       * raises a TypeError instead of sending `{ error }`. `idCardHandler`
       * turns such a message into `evictSelf(message.error)` and never gets
       * one; the worker dies, and its `close` handler evicts the node with the
       * generic "ID Card renewer worker closed unexpectedly" rather than
       * "Failed to connect to redis". The node still leaves the cluster — it
       * leaves without the reason.
       *
       * Left as found: routing this to `process.send` is a behaviour change,
       * and this is a spec effort.
       */
      const consoleError = sinon.stub(console, "error");

      idCardRenewer.initRedis.rejects(new Error("connection refused"));

      try {
        await should(
          idCardRenewer.init({ nodeIdKey: "nodeIdKey", redis: {} }),
        ).be.rejectedWith(TypeError);

        should(consoleError).be.calledWith(
          "Failed to connect to redis, could not refresh ID card: connection refused",
        );
        should(process.send).not.be.called();
      } finally {
        consoleError.restore();
      }
    });

    it("should notify parent when initialization is finished", async () => {
      await idCardRenewer.init({
        redis: {
          config: {
            initTimeout: 42,
          },
          name: "foo",
        },
        nodeIdKey: "nodeIdKey",
        refreshDelay: 1,
      });

      should(process.send).be.calledWith({
        initialized: true,
      });
    });
  });

  describe("#renewIDCard", () => {
    let idCardRenewer;

    beforeEach(async () => {
      idCardRenewer = new IDCardRenewer();

      idCardRenewer.initRedis = async () => {
        idCardRenewer.redis = {
          commands: {
            pexpire: sinon.stub().resolves(1),
            del: sinon.stub().resolves(),
          },
        };
      };

      process.send = sinon.stub();

      sinon.stub(idCardRenewer, "dispose").resolves();

      await idCardRenewer.init({
        nodeIdKey: "foo",
        redis: {},
        refreshDelay: 100,
        refreshMultiplier: 4,
      });
    });

    it("should call pexpire to refresh the key expiration time", async () => {
      idCardRenewer.redis.commands.pexpire.resetHistory();

      await idCardRenewer.renewIDCard();

      should(idCardRenewer.redis.commands.pexpire)
        .be.calledOnce()
        .and.be.calledWith("foo", 400);

      should(idCardRenewer.dispose).not.be.called();
      should(process.send).be.calledOnce().be.calledWith({ initialized: true });
    });

    it("should call the dispose method and notify the main thread that the node was too slow to refresh the ID Card", async () => {
      idCardRenewer.redis.commands.pexpire.resolves(0); // Failed to renew the ID Card before the key expired
      await idCardRenewer.renewIDCard();

      should(idCardRenewer.redis.commands.pexpire).be.called();

      should(idCardRenewer.dispose).be.called();
      should(process.send)
        .be.called()
        .and.be.calledWith({ error: "Node too slow: ID card expired" });
    });

    it("should dispose and report when redis itself fails", async () => {
      idCardRenewer.redis.commands.pexpire.rejects(new Error("redis is gone"));

      await idCardRenewer.renewIDCard();

      should(idCardRenewer.dispose).be.called();
      should(process.send).be.calledWith({
        error: "Failed to refresh ID Card: redis is gone",
      });
    });

    it("should not do nothing if already disposed", async () => {
      idCardRenewer.redis.commands.pexpire.resetHistory();
      idCardRenewer.disposed = true;
      await idCardRenewer.renewIDCard();

      should(idCardRenewer.redis.commands.pexpire).not.be.called();
      should(idCardRenewer.dispose).not.be.called();
      should(process.send).be.calledOnce().be.calledWith({ initialized: true });
    });
  });

  describe("#dispose", () => {
    let idCardRenewer;

    beforeEach(async () => {
      idCardRenewer = new IDCardRenewer();

      idCardRenewer.initRedis = async () => {
        idCardRenewer.redis = {
          commands: {
            pexpire: sinon.stub().resolves(1),
            del: sinon.stub().resolves(),
          },
        };
      };

      idCardRenewer.parentPort = {
        postMessage: sinon.stub(),
      };

      await idCardRenewer.init({
        nodeIdKey: "foo",
        redis: {},
        refreshDelay: 100,
      });
    });

    it("should set disposed to true and delete the nodeIdKey inside redis when called", async () => {
      await idCardRenewer.dispose();

      should(idCardRenewer.redis.commands.del).be.calledWith("foo");
      should(idCardRenewer.disposed).be.true();
      should(idCardRenewer.refreshTimer).be.null();
    });

    it("should not delete redis key if redis is not init", async () => {
      const redis = idCardRenewer.redis;
      idCardRenewer.redis = null;

      await idCardRenewer.dispose();

      should(redis.commands.del).not.be.called();
    });

    it("should log and return when redis refuses the delete", async () => {
      const consoleError = sinon.stub(console, "error");

      idCardRenewer.redis.commands.del.rejects(new Error("redis is gone"));

      try {
        // Disposal is the last thing this worker does; a redis that is already
        // gone must not turn it into an unhandled rejection.
        await should(idCardRenewer.dispose()).be.fulfilled();

        should(consoleError).be.calledWith(
          "Could not delete key 'foo' from redis: redis is gone",
        );
      } finally {
        consoleError.restore();
      }
    });

    it("should do nothing when already disposed", async () => {
      idCardRenewer.disposed = true;
      await idCardRenewer.dispose();

      should(idCardRenewer.redis.commands.del).not.be.called();
    });

    it("should not do anything if not initialized before calling dispose", async () => {
      const clearIntervalStub = sinon.spy(global, "clearInterval");
      idCardRenewer = new IDCardRenewer();

      idCardRenewer.initRedis = async () => {
        idCardRenewer.redis = {
          commands: {
            pexpire: sinon.stub().resolves(1),
            del: sinon.stub().resolves(),
          },
        };
      };

      should(idCardRenewer.disposed).be.true();

      await idCardRenewer.dispose();

      should(idCardRenewer.disposed).be.true();
      should(clearIntervalStub).not.be.called();
    });
  });
});
