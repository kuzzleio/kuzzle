import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CacheEngine from "../../../lib/core/cache/cacheEngine";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * A stand-in for the `Redis` service, built from the surface `CacheEngine`
 * actually calls.
 *
 * `test/mocks/service/redisClient.mock.js` is not ported: it models ioredis,
 * and nothing here is about ioredis — every assertion below is "this event
 * reaches this command with these arguments". The `commands` proxy hands back
 * the same `vi.fn` for a given name, so a command needs no declaration to be
 * asserted on.
 */
function stubRedis() {
  const calls = new Map<string, ReturnType<typeof vi.fn>>();
  const commands = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (!calls.has(name)) {
          calls.set(
            name,
            vi.fn(async () => undefined),
          );
        }

        return calls.get(name);
      },
    },
  ) as Record<string, ReturnType<typeof vi.fn>>;

  /** Lua scripts ioredis attaches to the raw client at runtime. */
  const client: Record<string, ReturnType<typeof vi.fn>> = {
    defineCommand: vi.fn((name: string) => {
      client[name] = vi.fn(async () => undefined);
    }),
  };

  return {
    client,
    /*
     * `Redis.connectedClient` is the accessor the subject goes through — it
     * throws when `client` is null, which is the K4/K5 "post-init state is an
     * accessor, not a nullable field" pattern. The stub exposes both, so the
     * spec reads like the subject does.
     */
    connectedClient: client,
    commands,
    exec: vi.fn(async () => undefined),
    info: vi.fn(async () => undefined),
    init: vi.fn(async () => undefined),
    mExecute: vi.fn(async () => undefined),
    searchKeys: vi.fn(async () => undefined),
    store: vi.fn(async () => undefined),
  };
}

type RedisStub = ReturnType<typeof stubRedis>;

describe("#core/cache/CacheEngine", () => {
  let cacheEngine: CacheEngine;
  let asked: Map<string, (...args: unknown[]) => unknown>;
  let internal: RedisStub;
  let publik: RedisStub;

  beforeEach(() => {
    /*
     * The constructor builds two `Redis` services out of the config and takes
     * a child logger; `init()` then registers the events. Both services are
     * replaced right after construction — the subject under test is the
     * routing table, not redis.
     */
    asked = new Map();
    stubKuzzle({
      config: {
        services: {
          /* The base `Service` constructor reads the shared init timeout. */
          common: { defaultInitTimeout: 120000 },
          internalCache: {},
          memoryStorage: {},
        },
      },
      onAsk: (event: string, handler: (...args: unknown[]) => unknown) => {
        asked.set(event, handler);
      },
    });

    cacheEngine = new CacheEngine();
    internal = stubRedis();
    publik = stubRedis();
    cacheEngine.internal = internal as never;
    cacheEngine.public = publik as never;
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const invoke = (event: string, ...args: unknown[]) => {
    const handler = asked.get(event);

    expect(handler, `no handler registered for ${event}`).toBeDefined();

    return handler(...args);
  };

  const spyFor = (redis: RedisStub, target: string, method: string) =>
    target === "commands"
      ? redis.commands[method]
      : (redis as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

  describe("#init", () => {
    it("initializes both clients", async () => {
      await cacheEngine.init();

      expect(publik.init).toHaveBeenCalledTimes(1);
      expect(internal.init).toHaveBeenCalledTimes(1);
    });
  });

  describe("the internal cache events", () => {
    beforeEach(() => cacheEngine.init());

    it.each([
      ["del", "commands", "del", ["key"]],
      ["expire", "commands", "expire", ["key", "ttl"]],
      ["flushdb", "commands", "flushdb", []],
      ["get", "commands", "get", ["key"]],
      ["mget", "commands", "mget", [["array"]]],
      ["persist", "commands", "persist", ["key"]],
      ["info:get", "self", "info", []],
      ["searchKeys", "self", "searchKeys", ["pattern"]],
      ["store", "self", "store", ["key", "value", "ttl"]],
    ] as const)(
      "routes core:cache:internal:%s",
      async (event, target, method, args) => {
        await invoke(`core:cache:internal:${event}`, ...args);

        expect(spyFor(internal, target, method)).toHaveBeenCalledWith(...args);
      },
    );

    it("answers an empty mget without calling redis", async () => {
      expect(await invoke("core:cache:internal:mget", [])).toEqual([]);

      expect(internal.commands.mget).not.toHaveBeenCalled();
    });

    /* `script:define` must run before `script:execute`: it is what creates it. */
    it("defines a Lua script on the raw client, then executes it", async () => {
      await invoke(
        "core:cache:internal:script:define",
        "name",
        "keys",
        "script",
      );

      expect(internal.client.defineCommand).toHaveBeenCalledWith("name", {
        lua: "script",
        numberOfKeys: "keys",
      });
      expect(internal.client.name).toBeTypeOf("function");

      await invoke("core:cache:internal:script:execute", "name", "foo", "bar");

      expect(internal.client.name).toHaveBeenCalledWith("foo", "bar");
    });
  });

  describe("the public cache events", () => {
    beforeEach(() => cacheEngine.init());

    it.each([
      ["del", "commands", "del", ["key"]],
      ["expire", "commands", "expire", ["key", "ttl"]],
      ["flushdb", "commands", "flushdb", []],
      ["get", "commands", "get", ["key"]],
      ["persist", "commands", "persist", ["key"]],
      ["execute", "self", "exec", ["cmd", "foo", "bar", "baz"]],
      ["info:get", "self", "info", []],
      ["mExecute", "self", "mExecute", [["commands"]]],
      ["store", "self", "store", ["key", "value", "ttl"]],
    ] as const)(
      "routes core:cache:public:%s",
      async (event, target, method, args) => {
        await invoke(`core:cache:public:${event}`, ...args);

        expect(spyFor(publik, target, method)).toHaveBeenCalledWith(...args);
      },
    );

    /*
     * Not asserted by the Mocha spec, and the whole point of there being two
     * services: a public event must never reach the internal cache.
     */
    it("never routes a public event to the internal cache", async () => {
      await invoke("core:cache:public:del", "key");

      expect(publik.commands.del).toHaveBeenCalledWith("key");
      expect(internal.commands.del).not.toHaveBeenCalled();
    });
  });
});
