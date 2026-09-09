import { beforeEach, describe, expect, it, vi } from "vitest";

import MemoryStorageController from "../../../lib/api/controllers/memoryStorageController";
import { KuzzleRequest } from "../../../lib/api/request";

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

    expect(call, `${command} was not executed`).toBeDefined();

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
      ).rejects.toThrow();
    });

    it("rejects a non-numeric coordinate", async () => {
      await expect(
        run("geoadd", {
          _id: "key",
          body: { points: [{ lon: "here", lat: 43.6, name: "palais" }] },
        }),
      ).rejects.toThrow();
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
      ).rejects.toThrow();
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
      ).rejects.toThrow();
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
      await expect(run("scan", { cursor: 0, match: 42 })).rejects.toThrow();
    });

    it("rejects a non-integer count", async () => {
      await expect(run("scan", { cursor: 0, count: "many" })).rejects.toThrow();
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
      ).rejects.toThrow();
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
      ).rejects.toThrow();
    });
  });

  describe("a command that takes no argument", () => {
    it("executes with no extra argument", async () => {
      await run("dbsize", {});

      expect(executed("dbsize")).toEqual([]);
    });
  });
});
