import { beforeEach, describe, expect, it, vi } from "vitest";

import MemoryStorageController from "../../../lib/api/controllers/memoryStorageController";
import { KuzzleRequest } from "../../../lib/api/request";
import { present } from "../../helpers/present";

/**
 * The Mocha spec swaps the real command table for a small fixture, so none of
 * the table's own `map` closures ever run there. This spec drives them through
 * the public actions instead: what is asserted is the argument list the
 * controller hands to Redis.
 */
describe("#api/controllers/MemoryStorageController", () => {
  let controller: MemoryStorageController;
  let ask: ReturnType<typeof vi.fn>;

  /** The arguments passed to `core:cache:public:execute` for `command`. */
  const executed = (command: string) => {
    const call = ask.mock.calls.find(
      (args) => args[0] === "core:cache:public:execute" && args[1] === command,
    );

    present(call, `the ${command} call`);

    return call.slice(2);
  };

  const run = (action: string, data: Record<string, unknown>) =>
    (controller as unknown as Record<string, (r: KuzzleRequest) => unknown>)[
      action
    ](new KuzzleRequest({ action, controller: "ms", ...data }, {}));

  beforeEach(() => {
    ask = vi.fn(async () => "OK");
    (globalThis as { kuzzle?: unknown }).kuzzle = {
      ask,
      pipe: vi.fn(async (_event: string, payload: unknown) => payload),
    };
    controller = new MemoryStorageController();
  });

  describe("geoadd", () => {
    it("flattens the points into lon, lat, name triples", async () => {
      await run("geoadd", {
        _id: "key",
        body: {
          points: [
            { lon: 3.9, lat: 43.6, name: "palais" },
            { lon: 3.4, lat: 43.7, name: "esplanade" },
          ],
        },
      });

      expect(executed("geoadd")).toEqual([
        "key",
        3.9,
        43.6,
        "palais",
        3.4,
        43.7,
        "esplanade",
      ]);
    });

    it("rejects an empty list", async () => {
      await expect(
        run("geoadd", { _id: "key", body: { points: [] } }),
      ).rejects.toThrow(/empty/i);
    });

    it("rejects a point that is not a geopoint", async () => {
      await expect(
        run("geoadd", { _id: "key", body: { points: [{ lon: 3.9 }] } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });

    it("rejects a non-numeric coordinate", async () => {
      await expect(
        run("geoadd", {
          _id: "key",
          body: { points: [{ lon: "here", lat: 43.6, name: "palais" }] },
        }),
        // invalid_type, not invalid_argument: the point has all three
        // properties, so it clears the geopoint-shape guard and fails on
        // assertFloat. Untold apart, this test passes on either error.
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });
  });

  describe("hmset", () => {
    it("flattens the entries into field, value pairs", async () => {
      await run("hmset", {
        _id: "key",
        body: {
          entries: [
            { field: "foo", value: "bar" },
            { field: "baz", value: 0 },
          ],
        },
      });

      expect(executed("hmset")).toEqual(["key", "foo", "bar", "baz", 0]);
    });

    it("rejects an entry without a field", async () => {
      await expect(
        run("hmset", { _id: "key", body: { entries: [{ value: "bar" }] } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });
  });

  describe("mset", () => {
    it("flattens the entries into key, value pairs", async () => {
      await run("mset", {
        body: {
          entries: [
            { key: "k1", value: "v1" },
            { key: "k2", value: 0 },
          ],
        },
      });

      expect(ask).toHaveBeenCalledWith("core:cache:public:execute", "mset", [
        "k1",
        "v1",
        "k2",
        0,
      ]);
    });

    it("rejects an entry without a key", async () => {
      await expect(
        run("mset", { body: { entries: [{ value: "v1" }] } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });
  });

  describe("scan", () => {
    it("appends MATCH and COUNT when provided", async () => {
      await run("scan", { cursor: 0, match: "foo*", count: 10 });

      expect(executed("scan")).toEqual([0, "MATCH", "foo*", "COUNT", 10]);
    });

    it("omits both when absent", async () => {
      await run("scan", { cursor: 0 });

      expect(executed("scan")).toEqual([0]);
    });

    it("rejects a non-string match", async () => {
      await expect(run("scan", { cursor: 0, match: 42 })).rejects.toMatchObject(
        { id: "api.assert.invalid_type" },
      );
    });

    it("rejects a non-integer count", async () => {
      await expect(
        run("scan", { cursor: 0, count: "many" }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });
  });

  describe("zrangebyscore", () => {
    it("upper-cases the options and builds the LIMIT argument", async () => {
      await run("zrangebyscore", {
        _id: "key",
        min: 0,
        max: 10,
        options: "withscores",
        limit: "1,2",
      });

      expect(executed("zrangebyscore")).toEqual([
        "key",
        0,
        10,
        "WITHSCORES",
        "LIMIT",
        "1",
        "2",
      ]);
    });

    it("rejects a LIMIT that is not an offset/count pair", async () => {
      await expect(
        run("zrangebyscore", {
          _id: "key",
          min: 0,
          max: 10,
          limit: "1",
        }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });
  });

  describe("zadd", () => {
    it("flattens the elements into score, member pairs", async () => {
      await run("zadd", {
        _id: "key",
        body: {
          elements: [
            { score: 1, member: "one" },
            { score: 2, member: "two" },
          ],
        },
      });

      expect(executed("zadd")).toEqual(["key", 1, "one", 2, "two"]);
    });

    it("rejects an element without a member", async () => {
      await expect(
        run("zadd", { _id: "key", body: { elements: [{ score: 1 }] } }),
      ).rejects.toMatchObject({ id: "api.assert.missing_argument" });
    });
  });

  describe("a command that takes no argument", () => {
    it("executes with no extra argument", async () => {
      await run("dbsize", {});

      expect(executed("dbsize")).toEqual([]);
    });
  });

  // The blocks below came from `test/api/controllers/memoryStorageController.test.js`
  // (step 13, L0). They cover the four remaining special extractors and the
  // three shapes the constructor gives an action; everything above already
  // covered `geoadd`, `hmset`, `mset`, `scan`, `zrangebyscore` and `zadd`.
  describe("set", () => {
    it("appends EX, PX, NX and XX in the order Redis expects", async () => {
      await run("set", {
        _id: "key",
        body: { value: "v", ex: 60, nx: true },
      });

      expect(executed("set")).toEqual(["key", "v", "EX", 60, "NX"]);
    });

    it("appends PX and XX", async () => {
      await run("set", {
        _id: "key",
        body: { value: "v", px: 1000, xx: true },
      });

      expect(executed("set")).toEqual(["key", "v", "PX", 1000, "XX"]);
    });

    // `typeof null` is "object", so a null value is rejected here rather than
    // reaching Redis as the string "null".
    it.each([
      ["a boolean", true],
      ["an object", { a: 1 }],
      ["null", null],
      ["nothing at all", undefined],
    ])("rejects a value that is %s", async (_label, value) => {
      await expect(
        run("set", { _id: "key", body: { value } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });

    it.each([
      ["nx and xx", { value: "v", nx: true, xx: true }],
      ["ex and px", { value: "v", ex: 60, px: 1000 }],
    ])("rejects %s together", async (_label, body) => {
      await expect(run("set", { _id: "key", body })).rejects.toMatchObject({
        id: "api.assert.mutually_exclusive",
      });
    });

    it("rejects a request with no body", async () => {
      await expect(run("set", { _id: "key" })).rejects.toMatchObject({
        id: "api.assert.body_required",
      });
    });
  });

  describe("sort", () => {
    it("takes the key alone when there is no body", async () => {
      await run("sort", { _id: "key" });

      expect(executed("sort")).toEqual(["key"]);
    });

    it("builds every option in the order Redis expects", async () => {
      await run("sort", {
        _id: "key",
        body: {
          alpha: true,
          direction: "desc",
          by: "weight_*",
          limit: [0, 10],
          get: ["a_*", "b_*"],
          store: "dest",
        },
      });

      expect(executed("sort")).toEqual([
        "key",
        "ALPHA",
        "DESC",
        "BY",
        "weight_*",
        "LIMIT",
        0,
        10,
        "GET",
        "a_*",
        "GET",
        "b_*",
        "STORE",
        "dest",
      ]);
    });

    it("rejects a direction that is neither ASC nor DESC", async () => {
      await expect(
        run("sort", { _id: "key", body: { direction: "sideways" } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });

    it.each([
      ["a limit that is not an array", { limit: "0,10" }],
      ["a get that is not an array", { get: "a_*" }],
    ])("rejects %s", async (_label, body) => {
      await expect(run("sort", { _id: "key", body })).rejects.toMatchObject({
        id: "api.assert.invalid_type",
      });
    });

    it("rejects a limit whose bounds are not integers", async () => {
      await expect(
        run("sort", { _id: "key", body: { limit: ["zero", 10] } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });
  });

  describe.each(["zinterstore", "zunionstore"])("%s", (action) => {
    it("counts the keys, then appends WEIGHTS and AGGREGATE", async () => {
      await run(action, {
        _id: "dest",
        body: {
          keys: ["k1", "k2"],
          weights: [2, 3],
          aggregate: "min",
        },
      });

      expect(executed(action)).toEqual([
        "dest",
        2,
        "k1",
        "k2",
        "WEIGHTS",
        2,
        3,
        "AGGREGATE",
        "MIN",
      ]);
    });

    // An empty `weights` is not an error: it simply contributes nothing, which
    // is the one case that distinguishes "present" from "non-empty" here.
    it("omits WEIGHTS when the list is empty", async () => {
      await run(action, { _id: "dest", body: { keys: ["k1"], weights: [] } });

      expect(executed(action)).toEqual(["dest", 1, "k1"]);
    });

    it("rejects an empty key list", async () => {
      await expect(
        run(action, { _id: "dest", body: { keys: [] } }),
      ).rejects.toMatchObject({ id: "api.assert.empty_argument" });
    });

    it("rejects an aggregate that is not SUM, MIN or MAX", async () => {
      await expect(
        run(action, {
          _id: "dest",
          body: { keys: ["k1"], aggregate: "median" },
        }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });

    it("rejects keys that are not an array", async () => {
      await expect(
        run(action, { _id: "dest", body: { keys: "k1" } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });
  });

  describe("mexecute", () => {
    // The only action that goes to `core:cache:public:mExecute`, and the only
    // one whose arguments are a list of [command, ...args] tuples.
    const mExecuted = () => {
      const call = ask.mock.calls.find(
        (args) => args[0] === "core:cache:public:mExecute",
      );

      present(call, "the mexecute call");

      return call[1];
    };

    it("extracts each sub-action through its own extractor", async () => {
      await run("mexecute", {
        body: {
          actions: [
            { action: "set", args: { _id: "k", body: { value: "v" } } },
            { action: "get", args: { _id: "k" } },
          ],
        },
      });

      expect(mExecuted()).toEqual([
        ["set", "k", "v"],
        ["get", "k"],
      ]);
    });

    it.each([
      ["no action", { args: {} }],
      ["no args", { action: "get" }],
    ])("rejects a sub-action with %s", async (_label, action) => {
      await expect(
        run("mexecute", { body: { actions: [action] } }),
      ).rejects.toMatchObject({ id: "api.assert.missing_argument" });
    });

    it("rejects a sub-action whose args are not an object", async () => {
      await expect(
        run("mexecute", {
          body: { actions: [{ action: "get", args: "k" }] },
        }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });

    it.each([
      ["nests mexecute", "mexecute"],
      ["names a command that is not in the table", "notacommand"],
    ])("rejects a sub-action that %s", async (_label, action) => {
      await expect(
        run("mexecute", { body: { actions: [{ action, args: {} }] } }),
      ).rejects.toMatchObject({ id: "api.assert.forbidden_argument" });
    });

    it("rejects actions that are not an array", async () => {
      await expect(
        run("mexecute", { body: { actions: "get" } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });
  });

  describe("the actions the constructor installs", () => {
    it("registers one action per command in the table", () => {
      // `_actions` is what the funnel looks a command up in; a command present
      // as a method but missing from the set is unreachable over the API.
      const actions = (controller as unknown as { _actions: Set<string> })
        ._actions;

      for (const command of ["get", "set", "mset", "mexecute", "dbsize"]) {
        expect(actions.has(command)).toBe(true);
        expect(typeof (controller as unknown as never)[command]).toBe(
          "function",
        );
      }
    });

    // Three shapes, and the difference is not cosmetic: `mset`/`mget`/`msetnx`
    // hand Redis a single array where every other command spreads its
    // arguments, and `mexecute` goes to a different event entirely.
    it("spreads the arguments of an ordinary command", async () => {
      await run("get", { _id: "key" });

      expect(ask).toHaveBeenCalledWith(
        "core:cache:public:execute",
        "get",
        "key",
      );
    });

    it("passes a single array for mget", async () => {
      await run("mget", { keys: ["k1", "k2"] });

      expect(ask).toHaveBeenCalledWith("core:cache:public:execute", "mget", [
        "k1",
        "k2",
      ]);
    });
  });

  // The table's `map` closures are the part the Mocha spec could not reach at
  // all — it swapped the table for a fixture. Each family below is one shared
  // helper reached through a different command; covering one command per family
  // is what exercises the helper's own branches.
  describe("the table's argument mappers", () => {
    describe.each([
      ["hmget", "fields", { _id: "key" }],
      ["geohash", "members", { _id: "key" }],
      ["sdiff", "keys", { _id: "key" }],
      ["sunion", "keys", {}],
    ])("%s splits its %s list", (action, property, extra) => {
      it("accepts a comma-separated string", async () => {
        await run(action, { ...extra, [property]: "a,b,c" });

        expect(executed(action)).toEqual([
          ...Object.values(extra),
          "a",
          "b",
          "c",
        ]);
      });

      it("accepts an array unchanged", async () => {
        await run(action, { ...extra, [property]: ["a", "b"] });

        expect(executed(action)).toEqual([...Object.values(extra), "a", "b"]);
      });
    });

    // `sanitizeArrayArgument` upper-cases the strings it finds and leaves
    // anything else alone — the options Redis expects as keywords.
    it("upper-cases a georadius option list", async () => {
      await run("georadius", {
        _id: "key",
        lon: 3.9,
        lat: 43.6,
        distance: 10,
        unit: "km",
        options: "withcoord,withdist",
      });

      expect(executed("georadius")).toEqual([
        "key",
        3.9,
        43.6,
        10,
        "km",
        "WITHCOORD",
        "WITHDIST",
      ]);
    });

    it("leaves a non-string option alone", async () => {
      await run("zrevrange", {
        _id: "key",
        start: 0,
        stop: 10,
        options: [1],
      });

      expect(executed("zrevrange")).toEqual(["key", 0, 10, 1]);
    });

    it("builds the LIMIT of a zrangebylex", async () => {
      await run("zrangebylex", {
        _id: "key",
        min: "-",
        max: "+",
        limit: "1,2",
      });

      expect(executed("zrangebylex")).toEqual([
        "key",
        "-",
        "+",
        "LIMIT",
        "1",
        "2",
      ]);
    });

    // `skip: true` is what makes an optional argument optional: absent, it is
    // dropped rather than raising `missing_argument`.
    it("drops an optional argument that is absent", async () => {
      await run("zrangebylex", { _id: "key", min: "-", max: "+" });

      expect(executed("zrangebylex")).toEqual(["key", "-", "+"]);
    });

    it("raises missing_argument for a required one", async () => {
      await expect(run("hmget", { _id: "key" })).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    // `assertFloat`/`assertInt` stringify through `scalarToString`, whose
    // fallback is the empty string — so a non-scalar score is NaN, not "[object
    // Object]" parsed as NaN by accident.
    it("rejects a non-scalar where a number is expected", async () => {
      await expect(
        run("zadd", {
          _id: "key",
          body: { elements: [{ score: { a: 1 }, member: "one" }] },
        }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_type" });
    });
  });

  describe("sort, with only some of its options", () => {
    it("omits GET and STORE when they are absent", async () => {
      await run("sort", { _id: "key", body: { alpha: true } });

      expect(executed("sort")).toEqual(["key", "ALPHA"]);
    });
  });

  describe("zadd, with the flags the happy path does not set", () => {
    it("appends XX, CH and INCR", async () => {
      await run("zadd", {
        _id: "key",
        body: {
          xx: true,
          ch: true,
          incr: true,
          elements: [{ score: 1, member: "one" }],
        },
      });

      expect(executed("zadd")).toEqual(["key", "XX", "CH", "INCR", 1, "one"]);
    });

    it("rejects nx and xx together", async () => {
      await expect(
        run("zadd", {
          _id: "key",
          body: { nx: true, xx: true, elements: [{ score: 1, member: "a" }] },
        }),
      ).rejects.toMatchObject({ id: "api.assert.mutually_exclusive" });
    });

    it("rejects INCR with more than one element", async () => {
      await expect(
        run("zadd", {
          _id: "key",
          body: {
            incr: true,
            elements: [
              { score: 1, member: "a" },
              { score: 2, member: "b" },
            ],
          },
        }),
      ).rejects.toMatchObject({ id: "api.assert.too_many_arguments" });
    });

    it("rejects an element that is not an object", async () => {
      await expect(
        run("zadd", { _id: "key", body: { elements: ["one"] } }),
      ).rejects.toMatchObject({ id: "api.assert.invalid_argument" });
    });

    it("rejects an empty element list", async () => {
      await expect(
        run("zadd", { _id: "key", body: { elements: [] } }),
      ).rejects.toMatchObject({ id: "api.assert.empty_argument" });
    });
  });
});
