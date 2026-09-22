import { NormalizedFilter } from "koncorde";
import Long from "long";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdCard } from "../../lib/cluster/idCardHandler";
import kuzzleStateEnum from "../../lib/kuzzle/kuzzleStateEnum";
import { restoreKuzzle, stubBus, stubKuzzle } from "../mocks/kuzzle";

/**
 * The network interfaces `getIP()` chooses from.
 *
 * ⚠️ `lib/cluster/node.ts` imports `os` with a **bare** specifier and says why:
 * `mock-require` keys on the literal specifier and would not see
 * `require("node:os")`. `vi.mock` has the same constraint, so the import stays
 * bare and this mock matches it — but the *reason* written in `lib/` is now a
 * Mocha-era one. Once L7 removes `mock-require`, `os`, `net`, `assert` and
 * `util` there can go back to their `node:` prefixes; filed, not done here.
 */
const networkInterfaces = {
  lo: [{ internal: true }],
  private: [
    { address: "10.1.1.1", family: "IPv4", mac: "welp", internal: false },
    {
      address: "fe80::b468:a254:bb56:ea68",
      family: "IPv6",
      mac: "welp",
      internal: false,
    },
  ],
  public: [
    { address: "11.1.1.1", family: "IPv4", mac: "welp2", internal: false },
    {
      address: "fe81::b468:a254:bb56:ea68",
      family: "IPv6",
      mac: "welp2",
      internal: false,
    },
  ],
  apipa: [
    { address: "169.254.2.3", family: "IPv4", mac: "ohnoes", internal: false },
  ],
};

vi.mock("os", () => ({
  default: { networkInterfaces: () => networkInterfaces },
  networkInterfaces: () => networkInterfaces,
}));

vi.mock("../../lib/cluster/publisher", async () => {
  const { ClusterPublisherStub } = await import("./nodeFixture");

  return { default: ClusterPublisherStub };
});

vi.mock("../../lib/cluster/subscriber", async () => {
  const { ClusterSubscriberStub } = await import("./nodeFixture");

  return { default: ClusterSubscriberStub };
});

vi.mock("../../lib/cluster/command", async () => {
  const { ClusterCommandStub } = await import("./nodeFixture");

  return { default: ClusterCommandStub };
});

vi.mock("../../lib/cluster/state", async () => {
  const { ClusterStateStub } = await import("./nodeFixture");

  return { default: ClusterStateStub };
});

vi.mock("../../lib/cluster/idCardHandler", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/cluster/idCardHandler")
  >("../../lib/cluster/idCardHandler");
  const { IdCardHandlerStub } = await import("./nodeFixture");

  // `IdCard` is a value the subject constructs and compares: it stays real.
  return { ClusterIdCardHandler: IdCardHandlerStub, IdCard: actual.IdCard };
});

vi.mock("../../lib/util/mutex", async () => {
  const { MutexStub } = await import("./nodeFixture");

  return { Mutex: MutexStub };
});

async function loadSubject() {
  vi.resetModules();

  return (await import("../../lib/cluster/node")).default;
}

/**
 * An `IdCard` filled in.
 *
 * `SerializedIdCard` declares all four fields required, and the Mocha spec
 * constructed partial ones throughout — each test naming only what it is
 * about. That is harmless at runtime (the constructor defaults what is
 * missing) and `tsc` is what asks; the defaults live here rather than at
 * nineteen call sites.
 */
const idCard = (fields: {
  id: string;
  topology?: string[];
  birthdate?: number;
  ip?: string;
}) => new IdCard({ birthdate: 0, ip: "0.0.0.0", topology: [], ...fields });

describe("ClusterNode", () => {
  let ClusterNode: any;
  let node: any;
  let kuzzle: any;
  let bus: ReturnType<typeof stubBus>;
  let error: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.fn>;
  let MutexStub: any;

  const clusterConfig = () => ({
    activityDepth: 50,
    heartbeat: 2000,
    interface: null,
    ip: "private",
    ipv6: false,
    joinTimeout: 60000,
    minimumNodes: 1,
    ports: { command: 7510, sync: 7511 },
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    ClusterNode = await loadSubject();

    // ⚠️ Reached through the **mocked specifier**, not through `./nodeFixture`.
    // A `vi.mock` factory's result is cached per registration, not per module
    // registry, so after `vi.resetModules()` a fresh `import("./nodeFixture")`
    // answers a *second copy* of these classes — one the subject never saw.
    // Static state set on that copy (the mutex list, the subscription flag)
    // never reaches the code under test, and three tests failed silently that
    // way: an empty list and an unheeded flag both read as "nothing happened".
    ({ Mutex: MutexStub } = await import("../../lib/util/mutex"));
    MutexStub.instances.length = 0;

    bus = stubBus();
    error = vi.fn();
    warn = vi.fn();

    kuzzle = stubKuzzle({
      ...bus,
      config: { cluster: clusterConfig() },
      log: {
        child: () => ({
          debug: vi.fn(),
          error,
          info: vi.fn(),
          trace: vi.fn(),
          warn,
        }),
      },
      shutdown: vi.fn(),
      state: kuzzleStateEnum.RUNNING,
    });

    node = new ClusterNode();
  });

  afterEach(() => {
    clearInterval(node?.heartbeatTimer);
    restoreKuzzle();
  });

  describe("#constructor", () => {
    it.each([
      ["private IPv4", { ip: "private", ipv6: false }, "10.1.1.1"],
      [
        "private IPv6",
        { ip: "private", ipv6: true },
        "fe80::b468:a254:bb56:ea68",
      ],
      ["public IPv4", { ip: "public", ipv6: false }, "11.1.1.1"],
      [
        "public IPv6",
        { ip: "public", ipv6: true },
        "fe81::b468:a254:bb56:ea68",
      ],
      [
        "an interface, IPv4",
        { ip: null, ipv6: false, interface: "welp2" },
        "11.1.1.1",
      ],
      [
        "an interface, IPv6",
        { ip: null, ipv6: true, interface: "welp2" },
        "fe81::b468:a254:bb56:ea68",
      ],
      ["nothing configured, IPv4", { ip: null, ipv6: false }, "10.1.1.1"],
      [
        "nothing configured, IPv6",
        { ip: null, ipv6: true },
        "fe80::b468:a254:bb56:ea68",
      ],
    ])("selects the address for %s", (_name, config, expected) => {
      Object.assign(kuzzle.config.cluster, { interface: null }, config);

      expect(new ClusterNode().ip).toBe(expected);
    });

    it.each([
      ["no interface matches", "foobar"],
      ["the only address is an APIPA", "apipa"],
    ])("throws when %s", (_name, iface) => {
      kuzzle.config.cluster.interface = iface;

      expect(() => new ClusterNode()).toThrow(
        /^\[CLUSTER\] No suitable IP address found with the provided configuration/,
      );
    });
  });

  describe("#init", () => {
    beforeEach(() => {
      node.handshake = vi.fn(async () => undefined);
      node.countActiveNodes = vi.fn(() => 1);
      node.nodeId = "foonode";
    });

    it("starts the publisher and the command socket before the handshake", async () => {
      await node.init();

      expect(node.publisher.init).toHaveBeenCalledTimes(1);
      expect(node.command.init).toHaveBeenCalledTimes(1);
      expect(node.handshake).toHaveBeenCalledTimes(1);
      expect(node.handshake.mock.invocationCallOrder[0]).toBeGreaterThan(
        node.publisher.init.mock.invocationCallOrder[0],
      );
      expect(node.handshake.mock.invocationCallOrder[0]).toBeGreaterThan(
        node.command.init.mock.invocationCallOrder[0],
      );
    });

    it("disposes of everything on kuzzle:shutdown", async () => {
      const subscriber = { dispose: vi.fn() };

      await node.init();

      node.remoteNodes.set("foo", subscriber);
      node.remoteNodes.set("bar", subscriber);
      node.remoteNodes.set("baz", subscriber);

      await kuzzle.pipe("kuzzle:shutdown");

      expect(node.idCardHandler.dispose).toHaveBeenCalledTimes(1);
      expect(subscriber.dispose).toHaveBeenCalledTimes(3);
      expect(node.publisher.dispose).toHaveBeenCalledTimes(1);
      expect(node.command.dispose).toHaveBeenCalledTimes(1);
    });

    it("does not resolve until the quorum is reached", async () => {
      const pending = Promise.resolve("still waiting");

      kuzzle.config.cluster.minimumNodes = 3;

      const init = node.init();

      await expect(Promise.race([init, pending])).resolves.toBe(
        "still waiting",
      );

      node.countActiveNodes.mockReturnValue(3);

      await expect(init).resolves.toBe("foonode");
    });
  });

  describe("ask events", () => {
    beforeEach(async () => {
      node.handshake = vi.fn(async () => undefined);
      node.countActiveNodes = vi.fn(() => 1);
      node.nodeId = "foonode";

      await node.init();
    });

    it("cluster:realtime:room:remove removes the room locally and remotely", async () => {
      node.publisher.sendRemoveRealtimeRoom.mockResolvedValue("msgid");

      await kuzzle.ask("cluster:realtime:room:remove", "roomId");

      expect(node.publisher.sendRemoveRealtimeRoom.mock.calls).toEqual([
        ["roomId"],
      ]);
      expect(node.fullState.removeRealtimeRoom.mock.calls).toEqual([
        ["roomId", "foonode"],
      ]);
    });

    it.each([
      [
        "cluster:realtime:room:count",
        ["roomId"],
        "countRealtimeSubscriptions",
        ["roomId"],
      ],
      ["cluster:realtime:room:list", [], "listRealtimeRooms", []],
      [
        "cluster:realtime:filters:get",
        ["roomId"],
        "getNormalizedFilters",
        ["roomId"],
      ],
    ])("%s reaches the full state", async (event, args, method, expected) => {
      await kuzzle.ask(event, ...(args as unknown[]));

      expect(node.fullState[method].mock.calls).toEqual([expected]);
    });

    it("cluster:event:broadcast publishes the payload", async () => {
      await kuzzle.ask("cluster:event:broadcast", "event", "payload");

      expect(node.publisher.sendClusterWideEvent.mock.calls).toEqual([
        ["event", "payload"],
      ]);
    });

    it.each([
      ["cluster:event:on", "on", ["event", "function"]],
      ["cluster:event:once", "once", ["event", "function"]],
      ["cluster:event:off", "removeListener", ["event", "function"]],
      ["cluster:event:removeAllListeners", "removeAllListeners", ["event"]],
    ])("%s drives the local emitter", async (event, method, args) => {
      const spy = vi
        .spyOn(node.eventEmitter, method as never)
        .mockImplementation(() => node.eventEmitter);

      await kuzzle.ask(event, ...(args as unknown[]));

      expect(spy.mock.calls).toEqual([args]);
    });

    it("cluster:status:get reports the nodes and the activity", async () => {
      node.trackActivity("id", "1.2.3.4", 1);
      node.trackActivity("id", "1.2.3.4", 2, "because");
      node.idCardHandler.getRemoteIdCards.mockResolvedValue([
        idCard({ birthdate: 123, id: "id2", ip: "2.3.4.5" }),
        idCard({ birthdate: 124, id: "id3", ip: "2.3.4.6" }),
      ]);

      await expect(kuzzle.ask("cluster:status:get")).resolves.toMatchObject({
        activeNodes: 3,
        activity: [
          { address: "1.2.3.4", event: "joined", id: "id" },
          { address: "1.2.3.4", event: "evicted", id: "id", reason: "because" },
        ],
        nodes: [
          {
            address: "2.3.4.5",
            birthdate: "1970-01-01T00:00:00.123Z",
            id: "id2",
          },
          {
            address: "2.3.4.6",
            birthdate: "1970-01-01T00:00:00.124Z",
            id: "id3",
          },
          {
            address: "2.3.4.1",
            birthdate: "1970-01-01T00:00:00.120Z",
            id: "foonode",
          },
        ],
      });
    });
  });

  describe("event listeners", () => {
    beforeEach(async () => {
      node.handshake = vi.fn(async () => undefined);
      node.countActiveNodes = vi.fn(() => 3);
      node.nodeId = "foonode";

      await node.init();
    });

    it("propagates an index cache refresh", () => {
      const refreshed = vi
        .spyOn(node, "onIndexCacheRefreshed")
        .mockImplementation(() => {});

      kuzzle.emit("admin:afterRefreshIndexCache");

      expect(refreshed).toHaveBeenCalledTimes(1);
    });

    it("synchronizes a realtime room creation", () => {
      node.publisher.sendNewRealtimeRoom.mockReturnValue("msgid");

      const normalized = new NormalizedFilter([], "roomId", "index/collection");

      kuzzle.call("core:realtime:room:create:after", normalized);

      expect(node.publisher.sendNewRealtimeRoom.mock.calls).toEqual([
        [normalized],
      ]);
      expect(node.fullState.addRealtimeRoom.mock.calls).toEqual([
        [
          "roomId",
          "index",
          "collection",
          [],
          { messageId: "msgid", nodeId: "foonode", subscribers: 0 },
        ],
      ]);
    });

    it("synchronizes a realtime subscription", () => {
      node.publisher.sendSubscription.mockReturnValue("msgid");

      kuzzle.call("core:realtime:subscribe:after", "roomId");

      expect(node.publisher.sendSubscription.mock.calls).toEqual([["roomId"]]);
      expect(node.fullState.addRealtimeSubscription.mock.calls).toEqual([
        ["roomId", "foonode", "msgid"],
      ]);
    });

    it("synchronizes a realtime unsubscription", () => {
      node.publisher.sendUnsubscription.mockReturnValue("msgid");

      kuzzle.call("core:realtime:unsubscribe:after", "roomId");

      expect(node.publisher.sendUnsubscription.mock.calls).toEqual([
        ["roomId"],
      ]);
      expect(node.fullState.removeRealtimeSubscription.mock.calls).toEqual([
        ["roomId", "foonode", "msgid"],
      ]);
    });

    it.each([
      [
        "core:notify:document",
        { notification: "notification", rooms: "rooms" },
        "sendDocumentNotification",
        ["rooms", "notification"],
      ],
      [
        "core:notify:user",
        { notification: "notification", room: "room" },
        "sendUserNotification",
        ["room", "notification"],
      ],
      [
        "core:storage:index:create:after",
        { index: "index", scope: "scope" },
        "sendAddIndex",
        ["scope", "index"],
      ],
      [
        "core:storage:index:delete:after",
        { index: "index", scope: "scope" },
        "sendRemoveIndexes",
        ["scope", ["index"]],
      ],
      [
        "core:storage:index:mDelete:after",
        { indexes: ["index", "index2"], scope: "scope" },
        "sendRemoveIndexes",
        ["scope", ["index", "index2"]],
      ],
      [
        "core:storage:collection:create:after",
        { collection: "collection", index: "index", scope: "scope" },
        "sendAddCollection",
        ["scope", "index", "collection"],
      ],
      [
        "core:storage:collection:delete:after",
        { collection: "collection", index: "index", scope: "scope" },
        "sendRemoveCollection",
        ["scope", "index", "collection"],
      ],
    ])("%s publishes through %s", (event, payload, method, expected) => {
      kuzzle.emit(event, payload);

      expect(node.publisher[method as string].mock.calls).toEqual([expected]);
    });

    it("synchronizes a new authentication strategy", () => {
      kuzzle.emit("core:auth:strategyAdded", {
        name: "name",
        pluginName: "pluginName",
        strategy: "strategy",
      });

      expect(node.publisher.sendNewAuthStrategy.mock.calls).toEqual([
        ["name", "pluginName", "strategy"],
      ]);
      expect(node.fullState.addAuthStrategy.mock.calls).toEqual([
        [
          {
            pluginName: "pluginName",
            strategy: "strategy",
            strategyName: "name",
          },
        ],
      ]);
    });

    it("synchronizes an authentication strategy removal", () => {
      kuzzle.emit("core:auth:strategyRemoved", {
        name: "name",
        pluginName: "pluginName",
      });

      expect(node.publisher.sendRemoveAuthStrategy.mock.calls).toEqual([
        ["name", "pluginName"],
      ]);
      expect(node.fullState.removeAuthStrategy.mock.calls).toEqual([["name"]]);
    });

    it("synchronizes a successful dump request", () => {
      kuzzle.emit("admin:afterDump", { getString: () => "suffix" });

      expect(node.publisher.sendDumpRequest.mock.calls).toEqual([["suffix"]]);
    });

    /**
     * Eleven `describe`/`it` pairs in the Mocha spec, and the block hash found
     * four of them byte-identical to each other and three more to another —
     * every one is "this kuzzle event becomes that `publisher.send` topic".
     */
    it.each([
      ["admin:afterResetSecurity", undefined, "ResetSecurity", {}],
      ["admin:afterShutdown", undefined, "Shutdown", {}],
      [
        "collection:afterDeleteSpecifications",
        undefined,
        "RefreshValidators",
        {},
      ],
      [
        "collection:afterUpdateSpecifications",
        undefined,
        "RefreshValidators",
        {},
      ],
      [
        "core:security:profile:create",
        { args: ["profileId"] },
        "InvalidateProfile",
        { profileId: "profileId" },
      ],
      [
        "core:security:profile:createOrReplace",
        { args: ["profileId"] },
        "InvalidateProfile",
        { profileId: "profileId" },
      ],
      [
        "core:security:profile:update",
        { args: ["profileId"] },
        "InvalidateProfile",
        { profileId: "profileId" },
      ],
      [
        "core:security:profile:delete",
        { args: ["profileId"] },
        "InvalidateProfile",
        { profileId: "profileId" },
      ],
      [
        "core:security:role:create",
        { args: ["roleId"] },
        "InvalidateRole",
        { roleId: "roleId" },
      ],
      [
        "core:security:role:createOrReplace",
        { args: ["roleId"] },
        "InvalidateRole",
        { roleId: "roleId" },
      ],
      [
        "core:security:role:update",
        { args: ["roleId"] },
        "InvalidateRole",
        { roleId: "roleId" },
      ],
      [
        "core:security:role:delete",
        { args: ["roleId"] },
        "InvalidateRole",
        { roleId: "roleId" },
      ],
    ])("%s sends the %s topic", (event, payload, topic, expected) => {
      kuzzle.emit(event, payload);

      expect(node.publisher.send.mock.calls).toEqual([[topic, expected]]);
    });
  });

  describe("#handshake", () => {
    const idCards = () => [
      idCard({ id: "bar", ip: "2.3.4.1" }),
      idCard({ id: "baz", ip: "2.3.4.2" }),
      idCard({ id: "qux", ip: "2.3.4.3" }),
    ];
    const fullstate = { full: "state", activity: [], nodesState: [] };

    it("returns immediately when there is no other node", async () => {
      kuzzle.config.cluster.joinTimeout = 12345;
      node.idCardHandler.getRemoteIdCards.mockResolvedValue([]);

      await node.handshake();

      const mutex = MutexStub.instances.at(-1);

      expect(mutex.timeout).toBe(12345);
      expect(mutex.lock).toHaveBeenCalledTimes(1);
      expect(mutex.unlock).toHaveBeenCalledTimes(1);

      expect(node.idCardHandler.createIdCard).toHaveBeenCalledTimes(1);
      expect(node.idCardHandler.getRemoteIdCards).toHaveBeenCalledTimes(1);
      expect(node.remoteNodes.size).toBe(0);
      expect(node.command.getFullState).not.toHaveBeenCalled();
      expect(node.fullState.loadFullState).not.toHaveBeenCalled();
      expect(node.heartbeatTimer).not.toBeNull();
      expect(node.idCardHandler.addNode).not.toHaveBeenCalled();
    });

    it("aborts when another node shares this node's IP", async () => {
      node.idCardHandler.getRemoteIdCards.mockResolvedValue(idCards());
      node.ip = "2.3.4.2";

      await node.handshake();

      expect(node.command.getFullState).not.toHaveBeenCalled();
      expect(node.command.broadcastHandshake).not.toHaveBeenCalled();
      expect(node.fullState.loadFullState).not.toHaveBeenCalled();
      expect(error.mock.calls.flat().join("\n")).toMatch(
        /Another node share the same IP address as this one \(2\.3\.4\.2\): baz/,
      );
      expect(kuzzle.shutdown).toHaveBeenCalledTimes(1);
    });

    it("connects to the existing nodes and loads their full state", async () => {
      const nodes = idCards();

      node.command.getFullState.mockResolvedValue(fullstate);
      node.idCardHandler.getRemoteIdCards.mockResolvedValue(nodes);
      node.command.broadcastHandshake.mockResolvedValue({
        bar: {},
        baz: {},
        qux: {},
      });

      await node.handshake();

      expect(node.remoteNodes.size).toBe(3);

      for (const subscriber of node.remoteNodes.values()) {
        expect(subscriber.init).toHaveBeenCalledTimes(1);
        expect(subscriber.__node).toBe(node);
        expect(["bar", "baz", "qux"]).toContain(subscriber.__id);
        expect(["2.3.4.1", "2.3.4.2", "2.3.4.3"]).toContain(subscriber.__ip);

        // TD-65 (#2773): the fullstate snapshots each node's lastMessageId on
        // the command channel and the subscription lives on the sync channel,
        // so the snapshot must not be taken until the subscription is proven
        // live — otherwise whatever the remote publishes in between is dropped
        // and read as a desync.
        expect(subscriber.waitForSubscription).toHaveBeenCalledTimes(1);
        expect(
          subscriber.waitForSubscription.mock.invocationCallOrder[0],
        ).toBeLessThan(node.command.getFullState.mock.invocationCallOrder[0]);
      }

      expect(node.command.getFullState).toHaveBeenCalledTimes(1);
      expect(node.command.broadcastHandshake.mock.calls).toEqual([[nodes]]);
      expect(node.fullState.loadFullState.mock.calls).toEqual([[fullstate]]);
      expect(node.heartbeatTimer).not.toBeNull();
      expect(node.idCardHandler.addNode.mock.calls.flat().sort()).toEqual([
        "bar",
        "baz",
        "qux",
      ]);
    });

    it("warns but carries on when a subscription cannot be proven live", async () => {
      // A node whose ID card outlived it is exactly what the fullstate retry
      // below exists for, so an unproven subscription is not fatal here.
      node.command.getFullState.mockResolvedValue(fullstate);
      node.idCardHandler.getRemoteIdCards.mockResolvedValue([
        idCard({ id: "bar", ip: "2.3.4.1" }),
      ]);
      node.command.broadcastHandshake.mockResolvedValue({ bar: {} });

      const ClusterSubscriberStub = (
        await import("../../lib/cluster/subscriber")
      ).default as unknown as { subscriptionProven: boolean };
      ClusterSubscriberStub.subscriptionProven = false;

      try {
        await node.handshake();

        expect(warn.mock.calls.flat().join("\n")).toMatch(
          /No sync message received from node bar within \d+ms/,
        );
        expect(node.command.getFullState).toHaveBeenCalledTimes(1);
      } finally {
        ClusterSubscriberStub.subscriptionProven = true;
      }
    });

    it("retries once when the first full state request comes back empty", async () => {
      const nodes = idCards();

      node.heartbeatDelay = 10;
      node.command.getFullState
        .mockResolvedValueOnce(null)
        .mockResolvedValue(fullstate);
      node.command.broadcastHandshake.mockResolvedValue({
        bar: {},
        baz: {},
        qux: {},
      });
      node.idCardHandler.getRemoteIdCards.mockResolvedValue(nodes);

      await node.handshake();

      expect(node.idCardHandler.getRemoteIdCards).toHaveBeenCalledTimes(2);
      expect(node.command.getFullState).toHaveBeenCalledTimes(2);
      expect(node.remoteNodes.size).toBe(3);
      expect(node.fullState.loadFullState.mock.calls).toEqual([[fullstate]]);
      expect(node.command.broadcastHandshake.mock.calls).toEqual([[nodes]]);
      expect(node.idCardHandler.addNode.mock.calls.flat().sort()).toEqual([
        "bar",
        "baz",
        "qux",
      ]);
      expect(warn.mock.calls.flat().join("\n")).toMatch(/Retrying/);
    });

    it("shuts down when no full state can be obtained at all", async () => {
      node.heartbeatDelay = 10;
      node.command.getFullState.mockResolvedValue(null);
      node.idCardHandler.getRemoteIdCards.mockResolvedValue(idCards());

      await node.handshake();

      expect(node.idCardHandler.getRemoteIdCards).toHaveBeenCalledTimes(2);
      expect(node.idCardHandler.addNode).not.toHaveBeenCalled();
      expect(node.command.getFullState).toHaveBeenCalledTimes(2);
      expect(node.command.broadcastHandshake).not.toHaveBeenCalled();
      expect(node.fullState.loadFullState).not.toHaveBeenCalled();
      expect(warn.mock.calls.flat().join("\n")).toMatch(/Retrying/);
      expect(error.mock.calls.flat().join("\n")).toMatch(
        /network split detected/,
      );
      expect(kuzzle.shutdown).toHaveBeenCalledTimes(1);
    });

    it("syncs with the nodes that answered and discards the rest", async () => {
      const nodes = idCards();
      const state = {
        full: "state",
        activity: [],
        nodesState: [{ id: "qux", lastMessageId: "quxLastMessageId" }],
      };

      node.command.getFullState.mockResolvedValue(state);
      node.command.broadcastHandshake.mockResolvedValue({
        bar: { lastMessageId: "barmsgid" },
        baz: null,
        qux: { lastMessageId: "quxmsgid" },
      });
      node.idCardHandler.getRemoteIdCards.mockResolvedValue(nodes);

      await node.handshake();

      expect(node.remoteNodes.size).toBe(2);

      for (const subscriber of node.remoteNodes.values()) {
        expect(subscriber.init).toHaveBeenCalledTimes(1);
        expect(["bar", "qux"]).toContain(subscriber.__id);
        expect(subscriber.sync).toHaveBeenCalledTimes(1);
        expect(["barmsgid", "quxLastMessageId"]).toContain(
          subscriber.sync.mock.calls[0][0],
        );
      }

      expect(node.fullState.loadFullState.mock.calls).toEqual([[state]]);
      expect(node.idCardHandler.addNode.mock.calls.flat().sort()).toEqual([
        "bar",
        "qux",
      ]);
    });

    it("shuts down when the handshake does not complete before the timeout", async () => {
      kuzzle.config.cluster.joinTimeout = 10;
      node.idCardHandler.createIdCard.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      node.handshake();

      await vi.waitFor(() =>
        expect(error.mock.calls.flat().join("\n")).toMatch(/timed out/),
      );
      expect(kuzzle.shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe("#addNode", () => {
    it("adds the node, subscribes to it and records the activity", async () => {
      await expect(
        node.addNode("foo", "1.2.3.4", Long.fromInt(23, true)),
      ).resolves.toBe(true);

      expect(node.idCardHandler.addNode.mock.calls).toEqual([["foo"]]);
      expect(node.activity[0]).toMatchObject({
        address: "1.2.3.4",
        event: 1,
        id: "foo",
      });
    });

    it('lifts the "not enough nodes" state once the quorum is reached', async () => {
      kuzzle.state = kuzzleStateEnum.NOT_ENOUGH_NODES;
      kuzzle.config.cluster.minimumNodes = 2;

      await expect(
        node.addNode("foo", "1.2.3.4", Long.fromInt(23, true)),
      ).resolves.toBe(true);

      expect(kuzzle.state).toBe(kuzzleStateEnum.RUNNING);
      expect(warn.mock.calls.flat().join("\n")).toMatch(
        /Minimum number of nodes reached/,
      );
    });

    it("does nothing when the node is already known", async () => {
      node.remoteNodes.set("foo", {});

      await expect(
        node.addNode("foo", "1.2.3.4", Long.fromInt(23, true)),
      ).resolves.toBe(false);

      expect(node.idCardHandler.addNode).not.toHaveBeenCalled();
    });

    it("proves the subscription is live before resuming from a counter", async () => {
      // `lastMessageId` arrives here over the command channel, in the joining
      // node's handshake, while the subscription lives on the sync channel.
      // #2777 fixed this ordering in handshake() and missed this path, which is
      // the one every *existing* node takes when a new node joins — so all of
      // them resumed from a counter their subscription had not started
      // tracking, at the same instant. TD-65 (#2773).
      await node.addNode("foo", "1.2.3.4", Long.fromInt(23, true));

      const subscriber = node.remoteNodes.get("foo");

      expect(subscriber.waitForSubscription).toHaveBeenCalledTimes(1);
      expect(
        subscriber.waitForSubscription.mock.invocationCallOrder[0],
      ).toBeLessThan(subscriber.sync.mock.invocationCallOrder[0]);
    });

    it("warns but carries on when the subscription cannot be proven live", async () => {
      const ClusterSubscriberStub = (
        await import("../../lib/cluster/subscriber")
      ).default as unknown as { subscriptionProven: boolean };
      ClusterSubscriberStub.subscriptionProven = false;

      try {
        await node.addNode("foo", "1.2.3.4", Long.fromInt(23, true));

        expect(warn.mock.calls.flat().join("\n")).toMatch(
          /No sync message received from node foo within \d+ms/,
        );
        expect(node.remoteNodes.get("foo").sync).toHaveBeenCalledTimes(1);
      } finally {
        ClusterSubscriberStub.subscriptionProven = true;
      }
    });
  });

  describe("#evictSelf", () => {
    it("announces the eviction to the other nodes", async () => {
      const cause = new Error("bar");

      node.nodeId = "qux";

      await node.evictSelf("foo", cause);

      expect(error.mock.calls.flat().join("\n")).toMatch(/foo/);
      expect(error.mock.calls.flat()).toContain(cause.stack);
      expect(node.publisher.sendNodeEvicted.mock.calls).toEqual([
        ["qux", "qux", "foo"],
      ]);
    });

    it("shuts this node down, since the broadcast cannot reach it", async () => {
      // A ZeroMQ PUB socket does not deliver to its own process, so
      // `handleNodeEviction`'s shutdown branch is unreachable by the node that
      // needs it. Without this, the node leaves the cluster and keeps answering
      // requests behind the load balancer from state that stopped advancing.
      // TD-67 (#2776).
      node.nodeId = "qux";

      await node.evictSelf("foo");

      expect(kuzzle.shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe("#evictNode", () => {
    let subscriber: { dispose: ReturnType<typeof vi.fn>; remoteNodeIP: string };

    beforeEach(() => {
      subscriber = { dispose: vi.fn(), remoteNodeIP: "1.2.3.4" };

      node.nodeId = "thisnode";
      node.remoteNodes.set("foo", subscriber);
      node.remoteNodes.set("bar", subscriber);
      node.remoteNodes.set("baz", subscriber);
      node.enforceClusterConsistency = vi.fn();
    });

    const expectEvicted = () => {
      expect(warn).toHaveBeenCalledWith(
        '[CLUSTER] Node "bar" evicted. Reason: because',
      );
      expect(node.activity[0]).toMatchObject({
        address: "1.2.3.4",
        event: 2,
        id: "bar",
      });
      expect(node.idCardHandler.removeNode.mock.calls).toEqual([["bar"]]);
      expect(node.remoteNodes.size).toBe(2);
      expect(node.remoteNodes.has("bar")).toBe(false);
    };

    it("broadcasts the eviction when asked to", async () => {
      await node.evictNode("bar", { broadcast: true, reason: "because" });

      expectEvicted();
      expect(node.publisher.sendNodeEvicted.mock.calls).toEqual([
        ["thisnode", "bar", "because"],
      ]);
      expect(subscriber.dispose).toHaveBeenCalledTimes(1);
      expect(kuzzle.state).toBe(kuzzleStateEnum.RUNNING);
    });

    it("evicts without broadcasting by default", async () => {
      await node.evictNode("bar", { reason: "because" });

      expectEvicted();
      expect(node.publisher.sendNodeEvicted).not.toHaveBeenCalled();
      expect(kuzzle.state).toBe(kuzzleStateEnum.RUNNING);
    });

    it("deactivates this node when the quorum is lost", async () => {
      kuzzle.config.cluster.minimumNodes = 4;

      await node.evictNode("bar", { reason: "because" });

      expectEvicted();
      expect(node.publisher.sendNodeEvicted).not.toHaveBeenCalled();
      expect(kuzzle.state).toBe(kuzzleStateEnum.NOT_ENOUGH_NODES);
      expect(warn.mock.calls.flat().join("\n")).toMatch(
        /Not enough nodes active/,
      );
    });

    it("does nothing when the node is unknown", async () => {
      await node.evictNode("nope", { broadcast: true, reason: "because" });

      expect(node.activity).toEqual([]);
      expect(node.idCardHandler.removeNode).not.toHaveBeenCalled();
      expect(node.remoteNodes.size).toBe(3);
      expect(node.publisher.sendNodeEvicted).not.toHaveBeenCalled();
      expect(subscriber.dispose).not.toHaveBeenCalled();
      expect(kuzzle.state).toBe(kuzzleStateEnum.RUNNING);
    });
  });

  describe("#enforceClusterConsistency", () => {
    beforeEach(() => {
      node.heartbeatDelay = 0;
      node.nodeId = "A";
      node.idCardHandler.idCard.id = "A";
    });

    const splitDetected = () => {
      expect(error.mock.calls.flat().join("\n")).toMatch(
        /Network split detected/,
      );
      expect(kuzzle.shutdown).toHaveBeenCalledTimes(1);
    };

    it("does nothing when the cluster is consistent", async () => {
      // ⚠️ The Mocha version of this test never called
      // `enforceClusterConsistency()` — it arranged the topology and asserted
      // `shutdown` had not been called, which is true of a subject that was
      // never asked anything.
      node.idCardHandler.idCard.topology = new Set(["B", "C"]);
      node.idCardHandler.getRemoteIdCards.mockResolvedValue([
        idCard({ id: "B", topology: ["A", "C"] }),
        idCard({ id: "C", topology: ["A", "B"] }),
      ]);

      await node.enforceClusterConsistency();

      expect(kuzzle.shutdown).not.toHaveBeenCalled();
    });

    it.each([
      [
        "a full split",
        new Set<string>([]),
        [
          idCard({ id: "B", topology: ["C"] }),
          idCard({ id: "C", topology: ["B"] }),
        ],
      ],
      [
        "a partial split",
        new Set(["B"]),
        [
          idCard({ id: "B", topology: ["A", "C", "D"] }),
          idCard({ id: "C", topology: ["B", "D"] }),
          idCard({ id: "D", topology: ["B", "C"] }),
        ],
      ],
      [
        "the smaller of two splits",
        new Set(["B"]),
        [
          idCard({ id: "B", topology: ["A"] }),
          idCard({ id: "C", topology: ["D", "E"] }),
          idCard({ id: "D", topology: ["C", "E"] }),
          idCard({ id: "E", topology: ["C", "D"] }),
        ],
      ],
      [
        "one of several smaller splits",
        new Set(["B"]),
        [
          idCard({ id: "B", topology: ["A"] }),
          idCard({ id: "C", topology: ["D", "E"] }),
          idCard({ id: "D", topology: ["C", "E"] }),
          idCard({ id: "E", topology: ["C", "D"] }),
          idCard({ id: "F", topology: ["G"] }),
          idCard({ id: "G", topology: ["F"] }),
        ],
      ],
      [
        "a smaller split, one of whose nodes no longer exists",
        new Set(["I", "B"]),
        [
          idCard({ id: "B", topology: ["A"] }),
          idCard({ id: "C", topology: ["D", "E"] }),
          idCard({ id: "D", topology: ["C", "E"] }),
          idCard({ id: "E", topology: ["C", "D"] }),
        ],
      ],
    ])(
      "shuts down when this node is in %s",
      async (_name, topology, remote) => {
        node.idCardHandler.idCard.topology = topology;
        node.idCardHandler.getRemoteIdCards.mockResolvedValue(remote);

        await node.enforceClusterConsistency();

        splitDetected();
      },
    );

    it.each([
      ["this node is the youngest", 900, 100],
      ["the youngest node is in this split", 100, 900],
    ])(
      "shuts down when two splits are the same size and %s",
      async (_name, own, other) => {
        node.idCardHandler.idCard.topology = new Set(["B"]);
        node.idCardHandler.idCard.birthdate = own;
        node.idCardHandler.getRemoteIdCards.mockResolvedValue([
          idCard({ id: "B", topology: ["A"], birthdate: other }),
          idCard({ id: "C", topology: ["D"], birthdate: 500 }),
          idCard({ id: "D", topology: ["C"], birthdate: 200 }),
        ]);

        await node.enforceClusterConsistency();

        splitDetected();
      },
    );

    it("stays up when this node is in the bigger split", async () => {
      node.idCardHandler.idCard.topology = new Set(["B", "C"]);
      node.idCardHandler.getRemoteIdCards
        .mockResolvedValueOnce([
          idCard({ id: "B", topology: ["A", "C"] }),
          idCard({ id: "C", topology: ["A", "B"] }),
          idCard({ id: "D", topology: ["E"] }),
          idCard({ id: "E", topology: ["D"] }),
          idCard({ id: "F", topology: ["G"] }),
          idCard({ id: "G", topology: ["F"] }),
        ])
        .mockResolvedValue([
          idCard({ id: "B", topology: ["A", "C"] }),
          idCard({ id: "C", topology: ["A", "B"] }),
        ]);

      await node.enforceClusterConsistency();

      expect(kuzzle.shutdown).not.toHaveBeenCalled();
    });

    it("stays up when it is not in the youngest node's split", async () => {
      node.idCardHandler.idCard.birthdate = 900;
      node.idCardHandler.idCard.topology = new Set(["B", "C"]);
      node.idCardHandler.getRemoteIdCards
        .mockResolvedValueOnce([
          idCard({ id: "B", topology: ["A", "C"], birthdate: 800 }),
          idCard({ id: "C", topology: ["A", "B"], birthdate: 850 }),
          idCard({ id: "D", topology: ["E"], birthdate: 1200 }),
          idCard({ id: "E", topology: ["D"], birthdate: 100 }),
          idCard({ id: "F", topology: ["G"], birthdate: 3000 }),
          idCard({ id: "G", topology: ["F"], birthdate: 4000 }),
        ])
        .mockResolvedValueOnce([
          idCard({ id: "B", topology: ["A", "C"], birthdate: 800 }),
          idCard({ id: "C", topology: ["A", "B"], birthdate: 850 }),
          idCard({ id: "D", topology: ["E"], birthdate: 1200 }),
          idCard({ id: "E", topology: ["D"], birthdate: 100 }),
        ])
        .mockResolvedValue([
          idCard({ id: "B", topology: ["A", "C"], birthdate: 800 }),
          idCard({ id: "C", topology: ["A", "B"], birthdate: 850 }),
        ]);

      await node.enforceClusterConsistency();

      expect(kuzzle.shutdown).not.toHaveBeenCalled();
    });

    it("stays up in an elected split even while it still sees other nodes", async () => {
      node.idCardHandler.idCard.topology = new Set(["B", "C", "D"]);
      node.idCardHandler.getRemoteIdCards
        .mockResolvedValueOnce([
          idCard({ id: "B", topology: ["A"], birthdate: 800 }),
          idCard({ id: "C", topology: ["A"], birthdate: 850 }),
          idCard({ id: "D", topology: ["A"], birthdate: 1200 }),
        ])
        .mockImplementation(async () => {
          node.idCardHandler.idCard.topology = new Set([]);
          return [];
        });

      await node.enforceClusterConsistency();

      expect(kuzzle.shutdown).not.toHaveBeenCalled();
    });
  });
});
