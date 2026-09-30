import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IDCardRenewer } from "../../../lib/cluster/workers/IDCardRenewer";
import type { IDCardRenewerConfig } from "../../../lib/cluster/workers/IDCardRenewer";

/**
 * Ported from `test/cluster/workers/IDCardRenewer.test.js` when J3 converted the
 * worker: the rename is what makes `import` usable here, which is why J0 had to
 * extend the mocha spec in place instead (step 11).
 */

/**
 * A complete redis service config rather than a `{ initTimeout }` stub: the
 * worker hands this straight to `new Redis(...)`, so writing the real shape is
 * what keeps the fixture honest about what crosses the IPC boundary. Only
 * `initTimeout` is ever asserted on.
 */
const redisConfig: NonNullable<IDCardRenewerConfig["redis"]>["config"] = {
  backend: "redis",
  clusterOptions: { enableReadyCheck: true },
  database: 5,
  initTimeout: 42,
  node: { host: "localhost", port: 6379 },
  overrideDnsLookup: false,
};

/** The redis double this worker is expected to drive. */
function fakeRedis() {
  return {
    commands: {
      del: vi.fn().mockResolvedValue(undefined),
      pexpire: vi.fn().mockResolvedValue(1),
    },
  };
}

describe("ClusterIDCardRenewer", () => {
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    send = vi.fn();
    // `process.send` is optional on the Node type: this worker only ever runs
    // as a `fork()` child, where it is always there.
    process.send = send as unknown as typeof process.send;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("#init", () => {
    let idCardRenewer: IDCardRenewer;

    beforeEach(() => {
      idCardRenewer = new IDCardRenewer();
      idCardRenewer.initRedis = vi.fn().mockResolvedValue(undefined);
      idCardRenewer.renewIDCard = vi.fn().mockResolvedValue(undefined);
    });

    it("should initialize the redis client", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: { config: redisConfig, name: "foo" },
        refreshMultiplier: 4,
      });

      expect(idCardRenewer.initRedis).toHaveBeenCalledTimes(1);
      expect(idCardRenewer.initRedis).toHaveBeenCalledWith(redisConfig, "foo");
    });

    it("should init variable based on the given config", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: { config: redisConfig, name: "foo" },
        refreshDelay: 666,
        refreshMultiplier: 4,
      });

      expect(idCardRenewer.nodeIdKey).toEqual("nodeIdKey");
      expect(idCardRenewer.refreshDelay).toEqual(666);
      expect(idCardRenewer.refreshTimer).not.toBeNull();
      expect(idCardRenewer.disposed).toBe(false);
    });

    it("should renew once eagerly, then on every interval tick", async () => {
      // Fake timers rather than a real `setTimeout` race: the JS spec armed a
      // 1ms interval and waited 1ms for "exactly two" calls, which is a coin
      // toss on a loaded runner. The eager renew is deliberate — the ID card
      // would otherwise be allowed to expire during the first delay.
      vi.useFakeTimers();

      try {
        const setIntervalSpy = vi.spyOn(global, "setInterval");

        await idCardRenewer.init({
          nodeIdKey: "nodeIdKey",
          redis: { config: redisConfig, name: "foo" },
          refreshDelay: 1000,
          refreshMultiplier: 4,
        });

        expect(idCardRenewer.renewIDCard).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

        await vi.advanceTimersByTimeAsync(3000);

        expect(idCardRenewer.renewIDCard).toHaveBeenCalledTimes(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should default the refresh delay to 2s when the parent sent none", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: undefined,
        refreshMultiplier: 4,
      });

      expect(idCardRenewer.refreshDelay).toEqual(2000);
    });

    it("should do nothing when it has already been initialized", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: undefined,
        refreshMultiplier: 4,
      });

      vi.mocked(idCardRenewer.initRedis).mockClear();
      send.mockClear();

      await idCardRenewer.init({
        nodeIdKey: "another-key",
        redis: undefined,
        refreshMultiplier: 4,
      });

      expect(idCardRenewer.initRedis).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
      expect(idCardRenewer.nodeIdKey).toEqual("nodeIdKey");
    });

    it("should report WHY the ID card cannot be renewed when redis refuses", async () => {
      /*
       * TD-63 (#2770), fixed by the J3 conversion.
       *
       * This path used to call `this.parentPort.postMessage(...)`, and
       * `parentPort` is never assigned anywhere in `lib/`: it is the
       * `worker_threads` API, left behind by an earlier implementation, while
       * this worker is a `child_process.fork()` child that talks over
       * `process.send` like every other line of the file. So the one path that
       * exists to say *why* the ID card cannot be renewed raised a TypeError
       * instead of sending `{ error }` — `idCardHandler` never got the message
       * it turns into `evictSelf(message.error)`, and the node was evicted by
       * the `close` handler with the generic "ID Card renewer worker closed
       * unexpectedly". The node left the cluster either way; it left without
       * the reason.
       *
       * The conversion could not compile the property away silently, so this
       * spec pins the contract instead of the defect it used to pin.
       */
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      vi.mocked(idCardRenewer.initRedis).mockRejectedValue(
        new Error("connection refused"),
      );

      await expect(
        idCardRenewer.init({
          nodeIdKey: "nodeIdKey",
          redis: undefined,
          refreshMultiplier: 4,
        }),
      ).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalledWith(
        "Failed to connect to redis, could not refresh ID card: connection refused",
      );
      expect(send).toHaveBeenCalledWith({
        error:
          "Failed to connect to redis, could not refresh ID card: connection refused",
      });
      // and it stops there: no interval armed, nothing reported as initialized
      expect(send).not.toHaveBeenCalledWith({ initialized: true });
      expect(idCardRenewer.renewIDCard).not.toHaveBeenCalled();
    });

    it("should notify parent when initialization is finished", async () => {
      await idCardRenewer.init({
        nodeIdKey: "nodeIdKey",
        redis: { config: redisConfig, name: "foo" },
        refreshDelay: 1,
        refreshMultiplier: 4,
      });

      expect(send).toHaveBeenCalledWith({ initialized: true });
    });
  });

  describe("#renewIDCard", () => {
    let idCardRenewer: IDCardRenewer;
    let redis: ReturnType<typeof fakeRedis>;

    beforeEach(async () => {
      idCardRenewer = new IDCardRenewer();
      redis = fakeRedis();

      idCardRenewer.initRedis = vi.fn().mockImplementation(async () => {
        idCardRenewer.redis = redis;
      });

      vi.spyOn(idCardRenewer, "dispose").mockResolvedValue(undefined);

      await idCardRenewer.init({
        nodeIdKey: "foo",
        redis: undefined,
        refreshDelay: 100,
        refreshMultiplier: 4,
      });
    });

    it("should call pexpire to refresh the key expiration time", async () => {
      redis.commands.pexpire.mockClear();

      await idCardRenewer.renewIDCard();

      expect(redis.commands.pexpire).toHaveBeenCalledTimes(1);
      expect(redis.commands.pexpire).toHaveBeenCalledWith("foo", 400);
      expect(idCardRenewer.dispose).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ initialized: true });
    });

    it("should dispose and report when the node was too slow", async () => {
      // Failed to renew the ID Card before the key expired
      redis.commands.pexpire.mockResolvedValue(0);

      await idCardRenewer.renewIDCard();

      expect(redis.commands.pexpire).toHaveBeenCalled();
      expect(idCardRenewer.dispose).toHaveBeenCalled();
      expect(send).toHaveBeenCalledWith({
        error: "Node too slow: ID card expired",
      });
    });

    it("should dispose and report when redis itself fails", async () => {
      redis.commands.pexpire.mockRejectedValue(new Error("redis is gone"));

      await idCardRenewer.renewIDCard();

      expect(idCardRenewer.dispose).toHaveBeenCalled();
      expect(send).toHaveBeenCalledWith({
        error: "Failed to refresh ID Card: redis is gone",
      });
    });

    it("should do nothing if already disposed", async () => {
      redis.commands.pexpire.mockClear();
      idCardRenewer.disposed = true;

      await idCardRenewer.renewIDCard();

      expect(redis.commands.pexpire).not.toHaveBeenCalled();
      expect(idCardRenewer.dispose).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({ initialized: true });
    });
  });

  describe("#dispose", () => {
    let idCardRenewer: IDCardRenewer;
    let redis: ReturnType<typeof fakeRedis>;

    beforeEach(async () => {
      idCardRenewer = new IDCardRenewer();
      redis = fakeRedis();

      idCardRenewer.initRedis = vi.fn().mockImplementation(async () => {
        idCardRenewer.redis = redis;
      });

      await idCardRenewer.init({
        nodeIdKey: "foo",
        redis: undefined,
        refreshDelay: 100,
        refreshMultiplier: 4,
      });
    });

    it("should set disposed to true and delete the nodeIdKey inside redis", async () => {
      await idCardRenewer.dispose();

      expect(redis.commands.del).toHaveBeenCalledWith("foo");
      expect(idCardRenewer.disposed).toBe(true);
      expect(idCardRenewer.refreshTimer).toBeNull();
    });

    it("should not delete the redis key if redis is not init", async () => {
      idCardRenewer.redis = null;

      await idCardRenewer.dispose();

      expect(redis.commands.del).not.toHaveBeenCalled();
    });

    it("should log and return when redis refuses the delete", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      redis.commands.del.mockRejectedValue(new Error("redis is gone"));

      // Disposal is the last thing this worker does; a redis that is already
      // gone must not turn it into an unhandled rejection.
      await expect(idCardRenewer.dispose()).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalledWith(
        "Could not delete key 'foo' from redis: redis is gone",
      );
    });

    it("should do nothing when already disposed", async () => {
      idCardRenewer.disposed = true;

      await idCardRenewer.dispose();

      expect(redis.commands.del).not.toHaveBeenCalled();
    });

    it("should not do anything if it was never initialized", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const pristine = new IDCardRenewer();

      expect(pristine.disposed).toBe(true);

      await pristine.dispose();

      expect(pristine.disposed).toBe(true);
      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
  });
});
