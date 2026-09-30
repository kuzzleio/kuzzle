import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClusterIdCardHandler, IdCard } from "../../lib/cluster/idCardHandler";
import { invalid } from "../helpers/invalid";
import { restoreKuzzle, stubAsk, stubKuzzle } from "../mocks/kuzzle";

/** The forked worker, as the handler uses it: an emitter with `send`. */
class WorkerStub extends EventEmitter {
  send = vi.fn();
  connected = true;
  killed = false;
  channel = {};

  constructor(readonly path: string) {
    super();
  }
}

/**
 * The handler keeps everything but `idCard` and `nodeId` `private`, and the
 * behaviours under test are about that state: which worker was forked, whether
 * the refresh timer is still armed, whether the card was disposed. Named once
 * here rather than cast at twenty call sites.
 */
type Internals = {
  constructWorker: (path: string) => WorkerStub;
  disposed: boolean;
  nodeIdKey: string | null;
  refreshDelay: number;
  refreshTimer: NodeJS.Timeout | null;
  refreshWorker: WorkerStub | null;
  save: (options?: { creation?: boolean }) => Promise<boolean>;
  startTemporaryRefresh: (worker: WorkerStub) => void;
};

describe("#cluster/ClusterIdCardHandler", () => {
  const ip = "192.168.42.42";
  const refreshDelay = 20;

  let handler: ClusterIdCardHandler;
  let internals: Internals;
  let evictSelf: ReturnType<typeof vi.fn>;
  let bus: ReturnType<typeof stubAsk>;
  let reserved: boolean[];
  let cardsIndex: string[];
  let cards: (string | null)[];

  beforeEach(() => {
    evictSelf = vi.fn();
    reserved = [];
    cardsIndex = [];
    cards = [];

    bus = stubAsk((event: string, ...args: unknown[]) => {
      switch (event) {
        case "core:cache:internal:store":
          return reserved.length > 0 ? reserved.shift() : true;
        case "core:cache:internal:pexpire":
          return 1;
        case "core:cache:internal:mget":
          return cards;
        case "core:cache:internal:execute":
          return args[0] === "smembers" ? cardsIndex : 1;
        default:
          throw new Error(`unexpected ask("${event}")`);
      }
    });

    stubKuzzle({ ask: bus.ask, onAsk: bus.onAsk });

    handler = new ClusterIdCardHandler(
      invalid<ConstructorParameters<typeof ClusterIdCardHandler>[0]>({
        evictSelf,
        heartbeatDelay: refreshDelay,
        ip,
      }),
    );
    internals = handler as unknown as Internals;

    /* Never fork a real worker from a unit spec. */
    internals.constructWorker = (path: string) => new WorkerStub(path);
  });

  afterEach(() => {
    if (internals.refreshTimer) {
      clearInterval(internals.refreshTimer);
    }

    // `Reflect.deleteProperty`, not `delete`: `nodeId` is declared
    // non-optional on the global (lib/types/Global.ts), which is right for
    // every reader — the teardown is the one place that unsets it.
    Reflect.deleteProperty(global, "nodeId");
    vi.restoreAllMocks();
    restoreKuzzle();
  });

  /** `global.nodeId` is a getter installed by Backend; tests own it here. */
  const setGlobalNodeId = (value: string) => {
    Object.defineProperty(global, "nodeId", {
      configurable: true,
      value,
      writable: true,
    });
  };

  describe("#startTemporaryRefresh", () => {
    beforeEach(() => {
      internals.refreshDelay = 1;
      invalid<ReturnType<typeof vi.fn>>(
        vi.spyOn(handler, "save" as never),
      ).mockResolvedValue(true);
    });

    it("should refresh the ID card on a timer until the worker has started", async () => {
      const worker = new WorkerStub("some/path");

      internals.startTemporaryRefresh(worker);

      await vi.waitFor(() => expect(internals.save).toHaveBeenCalled());
    });

    it("should stop the timer when the worker has started", () => {
      const worker = new WorkerStub("some/path");

      internals.startTemporaryRefresh(worker);
      worker.emit("message", { initialized: true });

      expect(internals.refreshTimer).toBeNull();
    });
  });

  describe("#createIdCard", () => {
    beforeEach(() => {
      vi.spyOn(
        handler as unknown as { startTemporaryRefresh: () => void },
        "startTemporaryRefresh",
      ).mockImplementation(() => {});
    });

    it("should fork a worker file that exists on disk", async () => {
      let forkedPath: string | null = null;

      internals.constructWorker = (path: string) => {
        forkedPath = path;
        return new WorkerStub(path);
      };

      await handler.createIdCard();

      /*
       * This suite runs from source, where the worker is a `.ts` — so unlike
       * its Mocha original (which ran from `dist/`, where everything is a
       * `.js`) it does cover the extension the regression was about: the path
       * was a hard-coded `.js` while the module around it is a `.ts`. See
       * TD-59 / the note in the subject.
       */
      expect(forkedPath).not.toBeNull();
      expect(existsSync(forkedPath as unknown as string)).toBe(true);
    });

    it("should adopt global.nodeId, so a cluster log line names a known process", async () => {
      setGlobalNodeId("knode-wiry-cat-69101");

      await handler.createIdCard();

      expect(handler.nodeId).toBe("knode-wiry-cat-69101");
      expect(internals.nodeIdKey).toBe("{cluster/node}/knode-wiry-cat-69101");
    });

    it("should draw a fresh name when that id is already reserved", async () => {
      setGlobalNodeId("knode-wiry-cat-69101");
      reserved = [false, true];

      await handler.createIdCard();

      expect(handler.nodeId).not.toBe("knode-wiry-cat-69101");
      expect(handler.nodeId).toMatch(/^knode-/);
    });

    it("should draw a name when there is no global.nodeId", async () => {
      await handler.createIdCard();

      expect(handler.nodeId).toMatch(/^knode-/);
    });

    it("should store the card in Redis and add it to the index", async () => {
      await handler.createIdCard();

      expect(handler.idCard).toMatchObject({
        id: handler.nodeId,
        ip: "192.168.42.42",
      });
      expect(handler.idCard?.birthdate).toBeCloseTo(Date.now(), -2);
      expect(bus.ask).toHaveBeenCalledWith(
        "core:cache:internal:store",
        `{cluster/node}/${handler.nodeId}`,
        JSON.stringify(handler.idCard?.serialize()),
        { onlyIfNew: true, ttl: refreshDelay * 2 },
      );
      expect(bus.ask).toHaveBeenCalledWith(
        "core:cache:internal:execute",
        "sadd",
        "{cluster/node}/id-cards-index",
        `{cluster/node}/${handler.nodeId}`,
      );
    });

    it("should retry under another key on a collision", async () => {
      reserved = [false, true];

      await handler.createIdCard();

      const stores = bus.ask.mock.calls.filter(
        ([event]) => event === "core:cache:internal:store",
      );

      expect(stores).toHaveLength(2);
      expect(stores[0]?.[1]).not.toBe(stores[1]?.[1]);
    });

    it("should evict the node when the refresh worker reports an error", async () => {
      await handler.createIdCard();

      expect(internals.refreshWorker).not.toBeNull();
      internals.refreshWorker?.emit("message", { error: "foo bar" });

      expect(evictSelf).toHaveBeenCalledOnce();
      expect(evictSelf).toHaveBeenCalledWith("foo bar");
    });

    it("should evict the node when the refresh worker closes unexpectedly", async () => {
      await handler.createIdCard();

      internals.refreshWorker?.emit("close");

      expect(evictSelf).toHaveBeenCalledWith(
        "ID Card renewer worker closed unexpectedly",
      );
      expect(internals.disposed).toBe(true);
    });
  });

  describe("#dispose", () => {
    it("should tell the refresh worker to dispose", async () => {
      const worker = new WorkerStub("some/path");
      internals.refreshWorker = worker;

      await handler.dispose();

      expect(worker.send).toHaveBeenCalledWith({ action: "dispose" });
      expect(internals.disposed).toBe(true);
    });

    it("should still dispose when the worker died before being notified", async () => {
      // A killed worker whose channel is not torn down yet still looks alive
      // from here, and `send` throws instead of reporting it.
      const worker = new WorkerStub("some/path");
      worker.send.mockImplementation(() => {
        throw new Error("channel closed");
      });
      internals.refreshWorker = worker;

      await handler.dispose();

      expect(worker.send).toHaveBeenCalledOnce();
      expect(internals.disposed).toBe(true);
    });
  });

  describe("#getRemoteIdCards", () => {
    it("should return the other nodes' id cards, and drop the stale keys", async () => {
      const idCard2 = new IdCard({
        id: "id2",
        ip: "ip2",
        birthdate: 1002,
        topology: [],
      });
      const idCard3 = new IdCard({
        id: "id3",
        ip: "ip3",
        birthdate: 1003,
        topology: [],
      });

      handler.idCard = new IdCard({
        id: "id1",
        ip: "ip1",
        birthdate: 1001,
        topology: [],
      });
      internals.nodeIdKey = "redis/id1";
      cardsIndex = ["redis/id1", "redis/id2", "redis/id3", "redis/id4"];
      cards = [
        JSON.stringify(idCard2.serialize()),
        JSON.stringify(idCard3.serialize()),
        null,
      ];

      const remoteCards = await handler.getRemoteIdCards();

      expect(bus.ask).toHaveBeenCalledWith(
        "core:cache:internal:execute",
        "smembers",
        "{cluster/node}/id-cards-index",
      );
      expect(bus.ask).toHaveBeenCalledWith("core:cache:internal:mget", [
        "redis/id2",
        "redis/id3",
        "redis/id4",
      ]);
      // The key with no card behind it is removed from the index.
      expect(bus.ask).toHaveBeenCalledWith(
        "core:cache:internal:execute",
        "srem",
        "{cluster/node}/id-cards-index",
        "redis/id4",
      );
      expect(remoteCards).toEqual([idCard2, idCard3]);
    });
  });

  describe("#addNode / #removeNode", () => {
    let save: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      save = invalid<ReturnType<typeof vi.fn>>(
        vi.spyOn(handler, "save" as never),
      );
      save.mockResolvedValue(true);
      handler.idCard = new IdCard({
        id: "id1",
        ip: "ip1",
        birthdate: 1001,
        topology: [],
      });
    });

    it("should add an unknown node to the topology and save the card", async () => {
      await handler.addNode("remoteNodeId");

      expect(handler.idCard?.topology.has("remoteNodeId")).toBe(true);
      expect(save).toHaveBeenCalled();
    });

    it("should not save when the node is already known", async () => {
      handler.idCard?.topology.add("remoteNodeId");

      await handler.addNode("remoteNodeId");

      expect(save).not.toHaveBeenCalled();
    });

    it("should not add a node once the card is disposed", async () => {
      internals.disposed = true;

      await handler.addNode("remoteNodeId");

      expect(save).not.toHaveBeenCalled();
    });

    it("should remove a known node from the topology and save the card", async () => {
      handler.idCard?.topology.add("remoteNodeId");

      await handler.removeNode("remoteNodeId");

      expect(handler.idCard?.topology.has("remoteNodeId")).toBe(false);
      expect(save).toHaveBeenCalled();
    });

    it("should not save when the node was not in the topology", async () => {
      await handler.removeNode("remoteNodeId");

      expect(save).not.toHaveBeenCalled();
    });

    it("should not remove a node once the card is disposed", async () => {
      internals.disposed = true;

      await handler.removeNode("remoteNodeId");

      expect(save).not.toHaveBeenCalled();
    });
  });
});
