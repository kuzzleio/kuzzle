import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Request } from "../../../lib/api/request/kuzzleRequest";
import { RequestContext } from "../../../lib/api/request/requestContext";
import Statistics from "../../../lib/core/statistics/statistics";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../../mocks/kuzzle";

const lastFrame = Date.now();

/** One frame's worth of counters, as the module keeps them: four Maps. */
const fakeStats = () => ({
  connections: new Map([["foo", 42]]),
  ongoingRequests: new Map([["bar", 1337]]),
  completedRequests: new Map([["baz", 666]]),
  failedRequests: new Map([["qux", 667]]),
});

/** The same frame as the cache holds it: plain objects. */
const cachedStats = () =>
  JSON.stringify({
    completedRequests: { baz: 666 },
    connections: { foo: 42 },
    failedRequests: { qux: 667 },
    ongoingRequests: { bar: 1337 },
  });

const counters = [
  "completedRequests",
  "connections",
  "failedRequests",
  "ongoingRequests",
] as const;

describe("#core/statistics", () => {
  let stats: Statistics;
  let request: Request;
  let cache: {
    get: ReturnType<typeof vi.fn>;
    mget: ReturnType<typeof vi.fn>;
    searchKeys: ReturnType<typeof vi.fn>;
    store: ReturnType<typeof vi.fn>;
  };
  let bus: ReturnType<typeof stubAsk>;

  beforeEach(() => {
    request = new Request({
      controller: "server",
      action: "",
      requestId: "foo",
      collection: "",
      body: {},
    });

    cache = {
      get: vi.fn(async () => null),
      mget: vi.fn(async () => []),
      searchKeys: vi.fn(async () => []),
      store: vi.fn(async () => undefined),
    };

    bus = stubAsk((event: string, ...args: unknown[]) => {
      const handler =
        cache[event.replace("core:cache:internal:", "") as keyof typeof cache];

      if (event.startsWith("core:cache:internal:") && handler) {
        return (handler as (...a: unknown[]) => unknown)(...args);
      }

      throw new Error(`unexpected ask("${event}")`);
    });

    /* The three settings the constructor reads, and the cache bus. */
    stubKuzzle({
      ask: bus.ask,
      onAsk: bus.onAsk,
      config: { stats: { enabled: true, ttl: 3600, statsInterval: 10 } },
    });

    stats = new Statistics();
    stats.enabled = true;
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#startRequest", () => {
    it("should register a new request when asked to", () => {
      request.context.protocol = "foobar";

      stats.startRequest(request);
      expect(stats.currentStats.ongoingRequests.get("foobar")).toBe(1);

      stats.startRequest(request);
      expect(stats.currentStats.ongoingRequests.get("foobar")).toBe(2);
    });

    it("should do nothing when called with invalid arguments", () => {
      stats.startRequest(invalid<Request>(undefined));
      expect(stats.currentStats.ongoingRequests.size).toBe(0);

      // A request whose context carries no protocol is the second half of
      // "invalid arguments" the Mocha spec folded into one test.
      stats.startRequest(request);
      expect(stats.currentStats.ongoingRequests.size).toBe(0);
    });

    it("should do nothing if the module is disabled", () => {
      request.context.protocol = "foobar";
      stats.enabled = false;

      stats.startRequest(request);

      expect(stats.currentStats.ongoingRequests.size).toBe(0);
    });
  });

  describe("#completedRequest", () => {
    it("should move a request from ongoing to completed", () => {
      stats.currentStats.ongoingRequests.set("foobar", 2);
      request.context.protocol = "foobar";

      stats.completedRequest(request);
      expect(stats.currentStats.ongoingRequests.get("foobar")).toBe(1);
      expect(stats.currentStats.completedRequests.get("foobar")).toBe(1);

      stats.completedRequest(request);
      expect(stats.currentStats.ongoingRequests.get("foobar")).toBe(0);
      expect(stats.currentStats.completedRequests.get("foobar")).toBe(2);
    });

    it("should do nothing when called with invalid arguments", () => {
      stats.completedRequest(invalid<Request>(undefined));
      expect(stats.currentStats.completedRequests.size).toBe(0);

      stats.completedRequest(request);
      expect(stats.currentStats.completedRequests.size).toBe(0);
    });

    it("should do nothing if the module is disabled", () => {
      stats.currentStats.ongoingRequests.set("foobar", 2);
      request.context.protocol = "foobar";
      stats.enabled = false;

      stats.completedRequest(request);

      expect(stats.currentStats.completedRequests.size).toBe(0);
    });
  });

  describe("#failedRequest", () => {
    it("should move a request from ongoing to failed", () => {
      stats.currentStats.ongoingRequests.set("foobar", 2);
      request.context.protocol = "foobar";

      stats.failedRequest(request);
      expect(stats.currentStats.ongoingRequests.get("foobar")).toBe(1);
      expect(stats.currentStats.failedRequests.get("foobar")).toBe(1);

      stats.failedRequest(request);
      expect(stats.currentStats.ongoingRequests.get("foobar")).toBe(0);
      expect(stats.currentStats.failedRequests.get("foobar")).toBe(2);
    });

    it("should do nothing when called with invalid arguments", () => {
      stats.failedRequest(invalid<Request>(undefined));
      expect(stats.currentStats.failedRequests.size).toBe(0);

      stats.failedRequest(request);
      expect(stats.currentStats.failedRequests.size).toBe(0);
    });

    it("should do nothing if the module is disabled", () => {
      stats.currentStats.ongoingRequests.set("foobar", 2);
      request.context.protocol = "foobar";
      stats.enabled = false;

      stats.failedRequest(request);

      expect(stats.currentStats.failedRequests.size).toBe(0);
    });
  });

  describe("#connections", () => {
    const context = () =>
      new RequestContext({ connection: { protocol: "foobar" } });

    it("should count new connections", () => {
      stats.newConnection(context());
      expect(stats.currentStats.connections.get("foobar")).toBe(1);

      stats.newConnection(context());
      expect(stats.currentStats.connections.get("foobar")).toBe(2);
    });

    it("should not count new connections if the module is disabled", () => {
      stats.enabled = false;

      stats.newConnection(context());

      expect(stats.currentStats.connections.get("foobar")).toBeUndefined();
    });

    it("should be able to unregister a connection", () => {
      stats.currentStats.connections.set("foobar", 2);

      stats.dropConnection(context());
      expect(stats.currentStats.connections.get("foobar")).toBe(1);

      // The last one removes the key rather than leaving a zero.
      stats.dropConnection(context());
      expect(stats.currentStats.connections.get("foobar")).toBeUndefined();
    });

    it("should not unregister a connection if the module is disabled", () => {
      stats.currentStats.connections.set("foobar", 2);
      stats.enabled = false;

      stats.dropConnection(context());

      expect(stats.currentStats.connections.get("foobar")).toBe(2);
    });
  });

  /** Every counter of a frame, as the response carries them. */
  const expectFrame = (frame: Record<string, unknown>) => {
    for (const counter of counters) {
      expect(frame[counter]).toMatchObject(
        Object.fromEntries(fakeStats()[counter]),
      );
    }
    expect(frame.timestamp).toBeTypeOf("number");
  };

  describe("#getStats", () => {
    it("should return the current frame when there is no statistics in cache", async () => {
      stats.currentStats = fakeStats();
      request.input.args.startTime = lastFrame - 10000000;
      request.input.args.stopTime = new Date(Date.now() + 10000);

      const response = await stats.getStats(request);

      expect(response.total).toBe(1);
      expect(response.hits).toHaveLength(1);
      expectFrame(response.hits[0]);
    });

    it("should return the cached frames when snapshots have been taken", async () => {
      stats.lastFrame = lastFrame;
      request.input.args.startTime = lastFrame - 1000;
      request.input.args.stopTime = new Date(Date.now() + 100000);

      cache.searchKeys.mockResolvedValue([
        `{stats/}${lastFrame}`,
        `{stats/}${lastFrame + 100}`,
      ]);
      cache.mget.mockResolvedValue([cachedStats(), cachedStats()]);

      const response = await stats.getStats(request);

      expect(response.total).toBe(2);
      expect(response.hits).toHaveLength(2);
      expectFrame(response.hits[0]);
    });

    it("should return nothing when the asked date is in the future", async () => {
      stats.lastFrame = lastFrame;
      request.input.args.startTime = new Date(Date.now() + 10000);

      const response = await stats.getStats(request);

      expect(response.total).toBe(0);
      expect(response.hits).toEqual([]);
    });

    it("should return every frame when startTime is not defined", async () => {
      stats.lastFrame = lastFrame;
      request.input.args.stopTime = lastFrame + 1000;

      cache.searchKeys.mockResolvedValue([
        `{stats/}${lastFrame}`,
        `{stats/}${lastFrame + 100}`,
      ]);
      cache.mget.mockResolvedValue([cachedStats(), cachedStats()]);

      const response = await stats.getStats(request);

      expect(response.total).toBe(2);
      expect(response.hits).toHaveLength(2);
    });

    it("should reject a start or stop time it cannot read", async () => {
      stats.lastFrame = lastFrame;
      request.input.args.startTime = "a string";
      request.input.args.stopTime = "a string";

      await expect(stats.getStats(request)).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });
  });

  describe("#getLastStats", () => {
    it("should get the last frame from the cache", async () => {
      stats.lastFrame = lastFrame;
      cache.get.mockResolvedValue(cachedStats());

      const response = await stats.getLastStats();

      expectFrame(response);
      expect(response.timestamp).toBeCloseTo(Date.now(), -3);
    });

    it("should reject if the cache returns an error", async () => {
      stats.lastFrame = Date.now();
      cache.get.mockRejectedValue(new Error());

      await expect(stats.getLastStats()).rejects.toBeInstanceOf(Error);
    });
  });

  describe("#getAllStats", () => {
    it("should return the current frame if no cache has been initialized", async () => {
      stats.currentStats = fakeStats();

      const response = await stats.getAllStats();

      expect(response.total).toBe(1);
      expect(response.hits).toHaveLength(1);
      expectFrame(response.hits[0]);
    });

    it("should return all saved statistics", async () => {
      stats.lastFrame = lastFrame;
      cache.searchKeys.mockResolvedValue([
        `{stats/}${lastFrame}`,
        `{stats/}${lastFrame + 100}`,
      ]);
      cache.mget.mockResolvedValue([cachedStats(), cachedStats()]);

      const response = await stats.getAllStats();

      expect(response.total).toBe(2);
      expect(response.hits).toHaveLength(2);
      expectFrame(response.hits[0]);
      expectFrame(response.hits[1]);
    });
  });

  describe("#writeStats", () => {
    it("should write the frame in cache and reset the counters", async () => {
      const frame = fakeStats();
      stats.currentStats = frame;

      await stats.writeStats();

      expect(stats.currentStats.completedRequests.size).toBe(0);
      expect(stats.currentStats.failedRequests.size).toBe(0);
      expect(cache.store).toHaveBeenCalledWith(
        `{stats/}${stats.lastFrame}`,
        JSON.stringify(frame),
        { ttl: stats.ttl },
      );
    });

    it("should not write anything if the module is disabled", async () => {
      stats.currentStats = fakeStats();
      stats.enabled = false;

      await stats.writeStats();

      expect(cache.store).not.toHaveBeenCalled();
    });
  });
});
