import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Redis from "../../../lib/service/cache/redis";
import { loadConfig } from "../../../lib/config";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";
import {
  built,
  failNextConnection,
  resetRedisMock,
  type FakeRedis,
} from "../../mocks/redis";

vi.mock("ioredis", async () => {
  const { FakeCluster, FakeRedis } = await import("../../mocks/redis");

  return { Cluster: FakeCluster, default: FakeRedis };
});

/**
 * The factories, the keep-alive and its interval handle are `private` on the
 * subject. The spec drives the client the factories build — not the factories
 * — so the only ones named here are the two the keep-alive tests are about.
 */
type Internals = {
  _ping: () => Promise<void>;
  _setupKeepAlive: (delay: number) => void;
  pingIntervalID: ReturnType<typeof setInterval> | null;
};

const internalsOf = (redis: Redis) => invalid<Internals>(redis);

/** The client the subject built, as the fake it really is. */
const clientOf = (redis: Redis) => invalid<FakeRedis>(redis.client);

describe("#service/cache/Redis", () => {
  let redis: Redis;
  let config: Record<string, unknown>;
  let logger: ReturnType<typeof stubLogger>;

  beforeEach(() => {
    resetRedisMock();

    logger = stubLogger();

    stubKuzzle({
      config: JSON.parse(JSON.stringify(loadConfig())),
      id: "knode-test",
      log: logger,
    });

    config = {
      node: { host: "redis", port: 6379 },
      pingKeepAlive: 60000,
    };

    redis = new Redis(invalid(config), "internalCache");
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("#init", () => {
    it("should connect a client and name it after the adapter", async () => {
      await redis.init();

      expect(redis.client).toBe(built[0]);
      /* ⚠️ The Mocha spec called `new Redis(config)` — one argument where the
       * signature takes two — so `adapterName` was `undefined` throughout it
       * and this line went unasserted. It is how a Redis server reports which
       * Kuzzle adapter holds a connection. */
      expect(clientOf(redis).client).toHaveBeenCalledWith(
        "SETNAME",
        "internalCache/knode-test",
      );
      expect(clientOf(redis).select).not.toHaveBeenCalled();
    });

    it("should reject if unable to connect", async () => {
      const error = new Error("connection error");

      failNextConnection(error);

      await expect(
        new Redis(invalid(config), "internalCache").init(),
      ).rejects.toBe(error);
    });

    it("should build a single client when one node is configured", async () => {
      await redis.init();

      expect(built).toHaveLength(1);
      expect(clientOf(redis).options).toMatchObject({
        host: "redis",
        port: 6379,
      });
    });

    it("should pass the redis options to a single client", async () => {
      config.options = { password: "bar", username: "foo" };
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      expect(clientOf(redis).options).toMatchObject({
        password: "bar",
        username: "foo",
      });
    });

    it("should build a cluster client when several nodes are configured", async () => {
      config = { nodes: [{ host: "foobar", port: 6379 }] };
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      expect(invalid<{ nodeList: unknown[] }>(redis.client).nodeList).toEqual([
        { host: "foobar", port: 6379 },
      ]);
    });

    it("should pass the redis and cluster options to a cluster client", async () => {
      config = {
        clusterOptions: { enableReadyCheck: false },
        nodes: [{ host: "foobar", port: 6379 }],
        options: { password: "bar", username: "foo" },
      };
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      expect(clientOf(redis).options).toMatchObject({
        enableReadyCheck: false,
        redisOptions: { password: "bar", username: "foo" },
      });
    });

    it("should override the DNS lookup of a cluster client when asked to", async () => {
      config = {
        clusterOptions: { enableReadyCheck: true },
        nodes: [{ host: "foobar", port: 6379 }],
        overrideDnsLookup: true,
      };
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      const { dnsLookup } = clientOf(redis).options as {
        dnsLookup: (address: string, cb: unknown) => void;
      };

      expect(dnsLookup).toBeTypeOf("function");

      /* What the override is for: answering the address it was given, rather
       * than resolving it — the AWS ElastiCache workaround. */
      const answer = vi.fn();

      dnsLookup("an.address", answer);

      expect(answer).toHaveBeenCalledWith(null, "an.address");
      // The override goes to the client, not into the service configuration.
      expect(config.clusterOptions).toEqual({ enableReadyCheck: true });
    });

    it("should hand the client a function set in the options from code", async () => {
      const retryStrategy = () => 1000;

      config.options = { retryStrategy };
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      expect(clientOf(redis).options).toMatchObject({ retryStrategy });
    });
  });

  describe("#_setupKeepAlive", () => {
    it("should ping on connection and then on an interval", async () => {
      const ping = vi
        .spyOn(internalsOf(redis), "_ping")
        .mockResolvedValue(undefined);

      expect(internalsOf(redis).pingIntervalID).toBeNull();

      await redis.init();

      expect(ping).toHaveBeenCalledTimes(1);
      expect(internalsOf(redis).pingIntervalID).not.toBeNull();
    });

    it("should clear the interval when the connection errors", async () => {
      await redis.init();

      expect(internalsOf(redis).pingIntervalID).not.toBeNull();

      clientOf(redis).emit("error", new Error("foobar"));

      expect(internalsOf(redis).pingIntervalID).toBeNull();
    });

    it("should not set up a keep alive when the delay is not configured", async () => {
      config.pingKeepAlive = 0;
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      expect(internalsOf(redis).pingIntervalID).toBeNull();
    });
  });

  describe("#_ping", () => {
    it("should ping the client", async () => {
      await redis.init();

      await internalsOf(redis)._ping();

      expect(clientOf(redis).ping).toHaveBeenCalled();
    });

    /* A failed keep-alive must not reject: it runs from a `setInterval`, where
     * nothing would catch it. The Mocha spec asserted the happy half only. */
    it("should log a failed ping rather than throw", async () => {
      await redis.init();

      invalid<{ ping: ReturnType<typeof vi.fn> }>(redis.client).ping = vi
        .fn()
        .mockRejectedValue(new Error("no pong"));

      await expect(internalsOf(redis)._ping()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("no pong"),
      );
    });
  });

  describe("#searchKeys", () => {
    it("should list the keys matching a pattern", async () => {
      await redis.init();

      await expect(redis.searchKeys("s*")).resolves.toEqual([
        "s0",
        "s1",
        "s2",
        "s3",
        "s4",
        "s5",
        "s6",
        "s7",
        "s8",
        "s9",
      ]);
    });

    /**
     * ⚠️ Never reached before: `searchKeys` scans every master of a cluster and
     * merges the results, and the branch is chosen by `instanceof Cluster` —
     * which the Mocha spec's stand-in client was not.
     */
    it("should scan every master of a cluster and merge their keys", async () => {
      config = { nodes: [{ host: "foobar", port: 6379 }] };
      redis = new Redis(invalid(config), "internalCache");

      await redis.init();

      await expect(redis.searchKeys("s*")).resolves.toEqual([
        "s0",
        "s1",
        "s2",
        "s3",
        "s4",
        "s5",
        "s6",
        "s7",
        "s8",
        "s9",
      ]);
    });
  });

  describe("#mExecute", () => {
    it("should execute the commands in a single transaction", async () => {
      await redis.init();

      const commands = [
        ["set", "a", 1],
        ["get", "a"],
        ["del", "a"],
      ];
      const answers = [
        [null, "OK"],
        [null, "1"],
        [null, 1],
      ];

      invalid<{ multi: ReturnType<typeof vi.fn> }>(redis.client).multi = vi
        .fn()
        /* `exec()` answers a promise — the Mocha fixture returned the array
         * itself, which `mExecute`'s signature says it never does. */
        .mockReturnValue({ exec: async () => answers });

      await expect(redis.mExecute(commands)).resolves.toEqual(answers);

      expect(clientOf(redis).multi).toHaveBeenCalledWith(commands);
    });

    it("should do nothing when handed no command at all", async () => {
      await expect(redis.mExecute([])).resolves.toEqual([]);
    });
  });

  describe("#info", () => {
    it("should answer the subset of the server report Kuzzle exposes", async () => {
      await redis.init();

      invalid<{ info: ReturnType<typeof vi.fn> }>(redis.commands).info = vi
        .fn()
        .mockResolvedValue(
          [
            "# Server",
            "redis_version:3.0.7",
            "redis_mode:standalone",
            "config_file:",
            "",
            "# Memory",
            "used_memory_human:919.52K",
            "used_memory_peak_human:19.33M",
            "",
            "# Keyspace",
            "db1:keys=5,expires=5,avg_ttl=3584283",
          ].join("\r\n"),
        );

      await expect(redis.info()).resolves.toEqual({
        memoryPeak: "19.33M",
        memoryUsed: "919.52K",
        mode: "standalone",
        type: "redis",
        version: "3.0.7",
      });
    });
  });

  describe("#store", () => {
    beforeEach(async () => {
      await redis.init();

      invalid<{ set: ReturnType<typeof vi.fn> }>(redis.commands).set = vi
        .fn()
        .mockResolvedValue("OK");
    });

    const set = () =>
      invalid<{ set: ReturnType<typeof vi.fn> }>(redis.commands).set;

    it("should create a key/value pair with default options", async () => {
      await expect(redis.store("foo", "bar")).resolves.toBe(true);

      expect(set()).toHaveBeenCalledWith("foo", "bar");
    });

    it('should send an NX option if the "onlyIfNew" option is set', async () => {
      await redis.store("foo", "bar", { onlyIfNew: true });

      expect(set()).toHaveBeenCalledWith("foo", "bar", "NX");
    });

    it('should send a PX option if the "ttl" option is set', async () => {
      await redis.store("foo", "bar", { ttl: 123 });

      expect(set()).toHaveBeenCalledWith("foo", "bar", "PX", 123);
    });

    it("should mix NX and PX options if needed", async () => {
      await redis.store("foo", "bar", { onlyIfNew: true, ttl: 456 });

      expect(set()).toHaveBeenCalledWith("foo", "bar", "NX", "PX", 456);
    });

    /* `store` answers whether the key was written, and `SET … NX` on an
     * existing key answers `null`. Nothing asserted the false half. */
    it("should answer false when the server declined the write", async () => {
      set().mockResolvedValue(null);

      await expect(
        redis.store("foo", "bar", { onlyIfNew: true }),
      ).resolves.toBe(false);
    });
  });

  describe("#exec", () => {
    beforeEach(() => redis.init());

    it("should execute a command by name", async () => {
      await expect(redis.exec("get", "foo")).resolves.toBeUndefined();

      expect(clientOf(redis).get).toHaveBeenCalledWith("foo");
    });

    it("should reject a command the client does not have", () => {
      expect(() => redis.exec("nosuchcommand")).toThrow(
        /has no command "nosuchcommand"/,
      );
    });

    /**
     * The guard `setCommands()` wires around every command, and the reason its
     * error code is spelled `not_connected`: a command issued while the
     * adapter is down must say the cache is unreachable, not raise an
     * unexpected error.
     */
    it("should reject any command while the adapter is disconnected", async () => {
      redis.connected = false;

      await expect(redis.exec("get", "foo")).rejects.toMatchObject({
        id: "services.cache.not_connected",
      });
    });
  });

  describe("#connectedClient", () => {
    it("should refuse to answer a client before init()", async () => {
      await expect(redis.searchKeys("s*")).rejects.toMatchObject({
        id: "core.fatal.assertion_failed",
        message: expect.stringContaining(
          'redis adapter "internalCache" is not connected',
        ),
      });
    });
  });
});
