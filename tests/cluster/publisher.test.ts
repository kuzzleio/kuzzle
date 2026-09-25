import { NormalizedFilter } from "koncorde";
import Long from "long";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The 0mq publisher socket. The subject imports `{ Publisher }` from `zeromq`
 * and never touches anything else in the package.
 */
const socket = vi.hoisted(() => ({
  bind: vi.fn(async () => undefined),
  send: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
}));

vi.mock("zeromq", () => ({
  Publisher: class {
    public bind = socket.bind;
    public send = socket.send;
    public close = socket.close;
  },
}));

async function loadSubject() {
  vi.resetModules();

  return (await import("../../lib/cluster/publisher")).default;
}

const node = {
  config: {
    ports: { sync: 7511 },
    retransmitBuffer: { bytes: 16777216, messages: 1000 },
  },
} as never;

describe("ClusterPublisher", () => {
  let publisher: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const ClusterPublisher = await loadSubject();

    publisher = new ClusterPublisher(node);
  });

  describe("#init", () => {
    it("binds the socket to the sync port and loads the protobuf schema", async () => {
      await publisher.init();

      expect(socket.bind.mock.calls).toEqual([["tcp://*:7511"]]);
      expect(publisher.protoroot).not.toBeNull();
    });
  });

  describe("#send", () => {
    beforeEach(async () => {
      publisher.bufferSend = vi.fn();
      await publisher.init();
    });

    it("encodes the payload with protobuf and hands it to bufferSend", () => {
      const before = publisher.lastMessageId;
      const messageId = publisher.send("DumpRequest", { suffix: "suffix" });

      expect(publisher.bufferSend.mock.calls).toEqual([
        ["DumpRequest", Buffer.from("08011206737566666978", "hex")],
      ]);
      expect(messageId).toEqual(publisher.lastMessageId);
      expect(messageId.greaterThan(before)).toBe(true);
    });

    it("answers -1 and sends nothing once disposed", async () => {
      await publisher.dispose();

      expect(publisher.send("DumpRequest", {}).toNumber()).toBe(-1);
      expect(publisher.bufferSend).not.toHaveBeenCalled();
    });
  });

  /**
   * What a peer that missed messages asks for again (#2785): the last ones
   * sent, bounded by `cluster.retransmitBuffer`.
   */
  describe("#replay", () => {
    let ClusterPublisher: any;

    const publisherKeeping = async (messages: number, bytes: number) => {
      const subject = new ClusterPublisher({
        config: {
          ports: { sync: 7511 },
          retransmitBuffer: { bytes, messages },
        },
      });

      subject.bufferSend = vi.fn();
      await subject.init();

      return subject;
    };

    /** Sends `count` heartbeats, and answers what bufferSend was handed. */
    const sendHeartbeats = (subject: any, count: number) => {
      for (let i = 0; i < count; i++) {
        subject.sendHeartbeat(`address-${i}`);
      }

      return subject.bufferSend.mock.calls.map(
        ([topic, data]: [string, Uint8Array]) => ({ data, topic }),
      );
    };

    const id = (n: number) => Long.fromNumber(n, true);

    beforeEach(async () => {
      ClusterPublisher = await loadSubject();
    });

    it("answers the messages sent, in order, exactly as they were sent", async () => {
      const subject = await publisherKeeping(1000, 16777216);
      const sent = sendHeartbeats(subject, 5);

      expect(subject.replay(id(2), id(4))).toEqual(sent.slice(1, 4));
      expect(subject.replay(id(5), id(5))).toEqual(sent.slice(4));
    });

    it("answers null for anything outside what it still keeps", async () => {
      const subject = await publisherKeeping(3, 16777216);

      sendHeartbeats(subject, 5);

      // ids 3 to 5 are kept
      expect(subject.replay(id(3), id(5))).toHaveLength(3);
      expect(subject.replay(id(2), id(5))).toBeNull();
      expect(subject.replay(id(3), id(6))).toBeNull();
      expect(subject.replay(id(5), id(4))).toBeNull();
    });

    it("drops the oldest messages once the byte bound is exceeded", async () => {
      const subject = await publisherKeeping(1000, 1);

      sendHeartbeats(subject, 3);

      // every heartbeat is larger than one byte: nothing can be kept
      expect(subject.replay(id(3), id(3))).toBeNull();
    });

    it("keeps nothing when either bound is 0", async () => {
      for (const [messages, bytes] of [
        [0, 16777216],
        [1000, 0],
      ]) {
        const subject = await publisherKeeping(messages, bytes);

        sendHeartbeats(subject, 2);

        expect(subject.replay(id(1), id(2))).toBeNull();
      }
    });

    describe(`with ${"KUZZLE_TEST_CLUSTER_DROP_HEARTBEAT_EVERY"} set`, () => {
      beforeEach(() => {
        vi.stubEnv("KUZZLE_TEST_CLUSTER_DROP_HEARTBEAT_EVERY", "3");
      });

      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it("does not send every Nth heartbeat, and still replays it", async () => {
        const subject = await publisherKeeping(1000, 16777216);

        sendHeartbeats(subject, 7);

        expect(subject.bufferSend).toHaveBeenCalledTimes(5);
        expect(subject.replay(id(3), id(3))).toHaveLength(1);
        expect(subject.replay(id(6), id(6))).toHaveLength(1);
      });

      it("never drops anything but a heartbeat", async () => {
        const subject = await publisherKeeping(1000, 16777216);

        for (let i = 0; i < 6; i++) {
          subject.sendSubscription(`room-${i}`);
        }

        expect(subject.bufferSend).toHaveBeenCalledTimes(6);
      });
    });
  });

  describe("#bufferSend", () => {
    it("flushes the pending buffer in order, then returns to READY", async () => {
      await publisher.init();
      publisher.buffer.push({ data: "data1", topic: "topic1" });

      await publisher.bufferSend("topic2", "data2");

      expect(publisher.state).toBe(1); // READY
      expect(publisher.buffer).toEqual([]);
      expect(socket.send.mock.calls).toEqual([
        [["topic1", "data1"]],
        [["topic2", "data2"]],
      ]);
    });
  });

  describe("#dispose", () => {
    it("closes the socket and forgets it", async () => {
      await publisher.init();

      await publisher.dispose();

      expect(socket.close).toHaveBeenCalledTimes(1);
      expect(publisher.socket).toBeNull();
    });
  });

  describe("commands", () => {
    beforeEach(() => {
      publisher.send = vi.fn(() => "response");
    });

    /**
     * Sixteen `describe`/`it` pairs in the Mocha spec, each 8 to 20 lines and
     * all saying the same thing: the method calls `send` with one topic and
     * one payload, and answers whatever `send` answered. Stated once, with the
     * table as the actual content — which is what makes the two rows that
     * *are* different (the JSON-stringified fields) visible at a glance.
     */
    const documentNotification = {
      action: "action",
      collection: "collection",
      controller: "controller",
      index: "index",
      protocol: "protocol",
      requestId: "requestId",
      result: ["result"],
      scope: "scope",
      status: "status",
      timestamp: "timestamp",
      volatile: ["volatile"],
    };

    const userNotification = {
      action: "action",
      collection: "collection",
      controller: "controller",
      index: "index",
      protocol: "protocol",
      result: ["result"],
      status: "status",
      timestamp: "timestamp",
      user: "user",
      volatile: ["volatile"],
    };

    it.each([
      [
        "sendNewRealtimeRoom",
        [new NormalizedFilter(["filters"], "roomId", "index/collection")],
        "NewRealtimeRoom",
        {
          filter: '["filters"]',
          id: "roomId",
          index: "index/collection",
        },
      ],
      [
        "sendRemoveRealtimeRoom",
        ["roomId"],
        "RemoveRealtimeRoom",
        { roomId: "roomId" },
      ],
      [
        "sendUnsubscription",
        ["roomId"],
        "Unsubscription",
        { roomId: "roomId" },
      ],
      ["sendSubscription", ["roomId"], "Subscription", { roomId: "roomId" }],
      [
        "sendDocumentNotification",
        [["rooms"], documentNotification],
        "DocumentNotification",
        {
          ...documentNotification,
          rooms: ["rooms"],
          result: '["result"]',
          volatile: '["volatile"]',
        },
      ],
      [
        "sendUserNotification",
        ["room", userNotification],
        "UserNotification",
        {
          ...userNotification,
          room: "room",
          result: '["result"]',
          volatile: '["volatile"]',
        },
      ],
      [
        "sendNewAuthStrategy",
        ["strategyName", "pluginName", "strategy"],
        "NewAuthStrategy",
        {
          pluginName: "pluginName",
          strategy: "strategy",
          strategyName: "strategyName",
        },
      ],
      [
        "sendRemoveAuthStrategy",
        ["strategyName", "pluginName"],
        "RemoveAuthStrategy",
        { pluginName: "pluginName", strategyName: "strategyName" },
      ],
      ["sendDumpRequest", ["suffix"], "DumpRequest", { suffix: "suffix" }],
      [
        "sendAddIndex",
        ["scope", "index"],
        "AddIndex",
        { index: "index", scope: "scope" },
      ],
      [
        "sendAddCollection",
        ["scope", "index", "collection"],
        "AddCollection",
        { collection: "collection", index: "index", scope: "scope" },
      ],
      [
        "sendRemoveIndexes",
        ["scope", "indexes"],
        "RemoveIndexes",
        { indexes: "indexes", scope: "scope" },
      ],
      [
        "sendRemoveCollection",
        ["scope", "index", "collection"],
        "RemoveCollection",
        { collection: "collection", index: "index", scope: "scope" },
      ],
      [
        "sendClusterWideEvent",
        ["event", ["payload"]],
        "ClusterWideEvent",
        { event: "event", payload: '["payload"]' },
      ],
      ["sendNodeShutdown", ["nodeId"], "NodeShutdown", { nodeId: "nodeId" }],
      [
        // No test at all in the Mocha spec: the only one of the seventeen
        // commands the suite never exercised.
        "sendNodePreventEviction",
        [true],
        "NodePreventEviction",
        { evictionPrevented: true },
      ],
      [
        "sendNodeEvicted",
        ["evictor", "nodeId", "reason"],
        "NodeEvicted",
        { evictor: "evictor", nodeId: "nodeId", reason: "reason" },
      ],
      ["sendHeartbeat", ["address"], "Heartbeat", { address: "address" }],
    ])("#%s sends its topic and payload", (method, args, topic, payload) => {
      const result = publisher[method](...(args as unknown[]));

      expect(publisher.send.mock.calls).toEqual([[topic, payload]]);
      expect(result).toBe("response");
    });
  });
});
