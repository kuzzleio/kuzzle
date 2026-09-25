import Long from "long";
import * as protobuf from "protobufjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { restoreKuzzle, stubKuzzle } from "../mocks/kuzzle";

/** The 0mq subscriber socket. */
const socket = vi.hoisted(() => ({
  connect: vi.fn(async () => undefined),
  subscribe: vi.fn(async () => undefined),
  receive: vi.fn(async () => undefined as unknown),
}));

vi.mock("zeromq", () => ({
  Subscriber: class {
    public connect = socket.connect;
    public subscribe = socket.subscribe;
    public receive = socket.receive;
  },
}));

async function loadSubject() {
  vi.resetModules();

  return (await import("../../lib/cluster/subscriber")).default;
}

/**
 * The `ClusterNode` a subscriber talks back to: what it evicts through, the
 * full state it applies messages to, and the event emitter it relays cluster
 * events on.
 *
 * ⚠️ `nodeId` is part of it. The Mocha stub had none, and
 * `#handleNodeEviction`'s _"should kill itself if evicted node is itself"_ set
 * `message.nodeId = localNode.nodeId` — `undefined` on both sides of a `===`.
 * The test passed on two absent values and never compared a node id.
 */
const stubLocalNode = () => ({
  bind: vi.fn(async () => undefined),
  // Signatures, not bare `vi.fn()`: `mock.calls` is typed from the function
  // type, and a stub declared with no parameters makes every recorded call an
  // empty tuple — so `calls[0][0]` is a compile error rather than an argument.
  evictNode: vi.fn<
    (
      nodeId: string,
      options: { broadcast: boolean; reason: string },
    ) => Promise<void>
  >(async () => undefined),
  evictSelf: vi.fn<(reason: string) => Promise<void>>(async () => undefined),
  nodeId: "knode-local-1",
  fullState: {
    addRealtimeRoom: vi.fn(),
    addRealtimeSubscription: vi.fn(),
    removeRealtimeRoom: vi.fn(),
    removeRealtimeSubscription: vi.fn(),
    addAuthStrategy: vi.fn(),
    removeAuthStrategy: vi.fn(),
  },
  eventEmitter: { emit: vi.fn() },
  config: { ports: { sync: 7511 } },
  heartbeatDelay: 20,
  // Answers "not available" unless a test says otherwise: the node then
  // evicts itself on a gap, as it did before retransmission existed (#2785).
  command: {
    requestRetransmit: vi.fn<
      (ip: string, from: Long, to: Long) => Promise<[string, Buffer][] | null>
    >(async () => null),
  },
});

describe("ClusterSubscriber", () => {
  const remoteNodeId = "knode-happy-remote-4242";
  const remoteNodeIP = "192.168.1.42";

  let ClusterSubscriber: any;
  let subscriber: any;
  let localNode: ReturnType<typeof stubLocalNode>;
  let kuzzle: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    ClusterSubscriber = await loadSubject();

    kuzzle = stubKuzzle({
      ask: vi.fn(async () => undefined),
      dump: vi.fn(),
      pluginsManager: {
        registerStrategy: vi.fn(),
        unregisterStrategy: vi.fn(),
      },
      shutdown: vi.fn(),
      validation: { curateSpecification: vi.fn() },
    });

    localNode = stubLocalNode();
    subscriber = new ClusterSubscriber(localNode, remoteNodeId, remoteNodeIP);
  });

  afterEach(() => {
    clearInterval(subscriber?.heartbeatTimer);
    restoreKuzzle();
  });

  const stateEnum = () => ClusterSubscriber.stateEnum;

  describe("#constructor", () => {
    it("describes the remote node it subscribes to", () => {
      expect(subscriber.localNode).toBe(localNode);
      expect(subscriber.remoteNodeIP).toBe(remoteNodeIP);
      expect(subscriber.remoteNodeId).toBe(remoteNodeId);
      expect(subscriber.remoteNodeAddress).toBe("tcp://192.168.1.42:7511");
      expect(subscriber.state).toBe(stateEnum().BUFFERING);
      expect(subscriber.lastHeartbeat).toBeGreaterThan(Date.now() - 100);
      expect(subscriber.heartbeatDelay).toBe(localNode.heartbeatDelay * 1.5);
    });

    it("routes every topic to a handler of its own", () => {
      expect(subscriber.handlers).toEqual({
        AddCollection: subscriber.handleCollectionAddition,
        AddIndex: subscriber.handleIndexAddition,
        ClusterWideEvent: subscriber.handleClusterWideEvent,
        DocumentNotification: subscriber.handleDocumentNotification,
        DumpRequest: subscriber.handleDumpRequest,
        Heartbeat: subscriber.handleHeartbeat,
        InvalidateProfile: subscriber.handleProfileInvalidation,
        InvalidateRole: subscriber.handleRoleInvalidation,
        NewAuthStrategy: subscriber.handleNewAuthStrategy,
        NewRealtimeRoom: subscriber.handleNewRealtimeRoom,
        NodeEvicted: subscriber.handleNodeEviction,
        NodePreventEviction: subscriber.handleNodePreventEviction,
        NodeShutdown: subscriber.handleNodeShutdown,
        RefreshIndexCache: subscriber.handleRefreshIndexCache,
        RefreshValidators: subscriber.handleRefreshValidators,
        RemoveAuthStrategy: subscriber.handleAuthStrategyRemoval,
        RemoveCollection: subscriber.handleCollectionRemoval,
        RemoveIndexes: subscriber.handleIndexesRemoval,
        RemoveRealtimeRoom: subscriber.handleRealtimeRoomRemoval,
        ResetSecurity: subscriber.handleResetSecurity,
        Shutdown: subscriber.handleShutdown,
        Subscription: subscriber.handleSubscription,
        Unsubscription: subscriber.handleUnsubscription,
        UserNotification: subscriber.handleUserNotification,
      });
    });
  });

  describe("#init", () => {
    it("connects, subscribes, listens and starts the heartbeat timer", async () => {
      subscriber.listen = vi.fn(async () => undefined);
      subscriber.checkHeartbeat = vi.fn();

      await subscriber.init();

      expect(subscriber.protoroot).not.toBeNull();
      expect(socket.connect.mock.calls).toEqual([
        [subscriber.remoteNodeAddress],
      ]);
      expect(socket.subscribe).toHaveBeenCalledTimes(1);
      expect(subscriber.listen).toHaveBeenCalledTimes(1);

      // The timer fires on `heartbeatDelay`, which the fixture keeps at 30ms.
      await vi.waitFor(() =>
        expect(subscriber.checkHeartbeat).toHaveBeenCalledTimes(1),
      );
    });
  });

  describe("after init", () => {
    beforeEach(async () => {
      const listen = subscriber.listen;

      subscriber.listen = vi.fn();
      await subscriber.init();
      subscriber.listen = listen;

      clearInterval(subscriber.heartbeatTimer);
    });

    describe("#listen", () => {
      /** Answers `count` packets, then evicts so the loop terminates. */
      const receiveThenEvict = (count: number) => {
        let sent = 0;

        socket.receive.mockImplementation(async () => {
          sent += 1;

          if (sent === count) {
            subscriber.state = stateEnum().EVICTED;
          }

          return [Buffer.from(`topic${sent}`), `data${sent}`];
        });
      };

      it("dispatches received messages while the node is not evicted", async () => {
        subscriber.processData = vi.fn(async () => undefined);
        subscriber.state = stateEnum().SANE;
        receiveThenEvict(3);

        await subscriber.listen();

        expect(subscriber.processData.mock.calls).toEqual([
          ["topic1", "data1"],
          ["topic2", "data2"],
        ]);
      });

      it("buffers received messages while the subscriber is buffering", async () => {
        subscriber.processData = vi.fn(async () => undefined);
        subscriber.state = stateEnum().BUFFERING;
        receiveThenEvict(2);

        await subscriber.listen();

        expect(subscriber.processData).not.toHaveBeenCalled();
        expect(subscriber.buffer).toEqual([["topic1", "data1"]]);
      });

      it("evicts the remote node when a message cannot be received", async () => {
        socket.receive.mockRejectedValue(
          new Error("you have been a very bad node"),
        );

        await subscriber.listen();

        expect(localNode.evictNode.mock.calls).toEqual([
          [
            remoteNodeId,
            { broadcast: true, reason: "you have been a very bad node" },
          ],
        ]);
      });
    });

    describe("#sync", () => {
      it("replays the buffer and reports success", async () => {
        subscriber.state = stateEnum().BUFFERING;
        subscriber.processData = vi.fn(async () => undefined);
        subscriber.buffer = [
          ["topic1", "data1"],
          ["topic2", "data2"],
        ];

        await expect(subscriber.sync(42)).resolves.toBe(true);

        expect(subscriber.lastMessageId).toBe(42);
        expect(subscriber.state).toBe(stateEnum().SANE);
        expect(subscriber.processData.mock.calls).toEqual([
          ["topic1", "data1"],
          ["topic2", "data2"],
        ]);
      });

      it("stops replaying and reports failure once the replay evicts this node", async () => {
        // A gap found while replaying evicts this node. Before TD-67 (#2776)
        // the loop went on applying the rest of the buffer and then overwrote
        // EVICTED with SANE on the way out, so the handshake announced success
        // for a node that had just left the cluster.
        subscriber.state = stateEnum().BUFFERING;
        subscriber.processData = vi.fn(async () => {
          subscriber.state = stateEnum().EVICTED;
        });
        subscriber.buffer = [
          ["topic1", "data1"],
          ["topic2", "data2"],
        ];

        await expect(subscriber.sync(42)).resolves.toBe(false);

        expect(subscriber.state).toBe(stateEnum().EVICTED);
        expect(subscriber.processData).toHaveBeenCalledTimes(1);
      });
    });

    describe("#waitForSubscription", () => {
      it("resolves true as soon as a message has been received", async () => {
        // Receiving anything is the only observable proof that the subscription
        // has taken effect on the remote PUB socket (TD-65, #2773).
        expect(subscriber.subscriptionConfirmed).toBe(false);

        const waiting = subscriber.waitForSubscription(5000);

        subscriber.subscriptionConfirmed = true;
        subscriber.confirmSubscription();

        await expect(waiting).resolves.toBe(true);
      });

      it("resolves true immediately when already confirmed", async () => {
        subscriber.subscriptionConfirmed = true;

        await expect(subscriber.waitForSubscription(0)).resolves.toBe(true);
      });

      it("resolves false when no message arrives within the timeout", async () => {
        await expect(subscriber.waitForSubscription(10)).resolves.toBe(false);
      });

      it("is confirmed by the listening loop on the first message", async () => {
        socket.receive
          .mockImplementationOnce(async () => ["topic", "data"])
          .mockImplementation(async () => {
            subscriber.state = stateEnum().EVICTED;
            return ["topic", "data"];
          });
        subscriber.state = stateEnum().BUFFERING;

        await subscriber.listen();

        expect(subscriber.subscriptionConfirmed).toBe(true);
        await expect(subscriber.waitForSubscription(0)).resolves.toBe(true);
      });
    });

    describe("#processData", () => {
      const topic = "AddIndex";
      const message = {
        messageId: new Long(0, 0, true),
        scope: "scope",
        index: "sensors",
      };
      const encoded = Buffer.from(
        "0800120573636f70651a0773656e736f7273",
        "hex",
      );
      let handler: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        handler = vi.fn(async () => undefined);
        subscriber.validateMessage = vi.fn(async () => true);
        subscriber.handlers = { [topic]: handler };
        subscriber.localNode.fullState = { serialize: vi.fn() };
      });

      it("validates the message and calls the topic's handler", async () => {
        await subscriber.processData(topic, encoded);

        expect(subscriber.validateMessage.mock.calls).toEqual([[message]]);
        expect(handler.mock.calls).toEqual([[message]]);
      });

      it("refreshes the last heartbeat on every message", async () => {
        const heartbeat = vi.spyOn(subscriber, "handleHeartbeat");

        await subscriber.processData(topic, encoded);

        expect(heartbeat).toHaveBeenCalledTimes(1);
      });

      it("does not call the handler for an invalid message", async () => {
        subscriber.validateMessage = vi.fn(async () => false);

        await subscriber.processData(topic, encoded);

        expect(handler).not.toHaveBeenCalled();
      });

      it("shuts the local node down when the handler throws", async () => {
        handler.mockRejectedValue(new Error("duuuude wtf"));

        await subscriber.processData(topic, encoded);

        expect(localNode.evictSelf).toHaveBeenCalledTimes(1);
      });

      it("evicts the remote node on an unknown topic", async () => {
        await subscriber.processData("AddPokedex", encoded);

        expect(subscriber.validateMessage).not.toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
        expect(localNode.evictNode.mock.calls).toEqual([
          [
            remoteNodeId,
            {
              broadcast: true,
              reason: `received an invalid message from ${remoteNodeId} (unknown topic "AddPokedex")`,
            },
          ],
        ]);
      });

      it("does nothing once the node is evicted", async () => {
        subscriber.state = stateEnum().EVICTED;

        await subscriber.processData(topic, encoded);

        expect(subscriber.validateMessage).not.toHaveBeenCalled();
        expect(handler).not.toHaveBeenCalled();
        expect(localNode.evictNode).not.toHaveBeenCalled();
      });
    });

    describe("#checkHeartbeat", () => {
      it("returns to SANE when a heartbeat arrived in time", async () => {
        subscriber.state = stateEnum().MISSING_HEARTBEAT;
        subscriber.heartbeatDelay = 100;
        subscriber.lastHeartbeat = Date.now() - 50;

        await subscriber.checkHeartbeat();

        expect(subscriber.state).toBe(stateEnum().SANE);
      });

      it("evicts the node on a second missed heartbeat", async () => {
        subscriber.state = stateEnum().MISSING_HEARTBEAT;
        subscriber.heartbeatDelay = 100;
        subscriber.lastHeartbeat = Date.now() - 150;

        await subscriber.checkHeartbeat();

        expect(subscriber.state).toBe(stateEnum().EVICTED);
        expect(localNode.evictNode.mock.calls).toEqual([
          [remoteNodeId, { broadcast: true, reason: "heartbeat timeout" }],
        ]);
      });

      it("flags a first missed heartbeat without evicting", async () => {
        subscriber.heartbeatDelay = 100;
        subscriber.lastHeartbeat = Date.now() - 150;

        await subscriber.checkHeartbeat();

        expect(subscriber.state).toBe(stateEnum().MISSING_HEARTBEAT);
        expect(localNode.evictNode).not.toHaveBeenCalled();
      });
    });

    describe("#dispose", () => {
      it("closes the socket and clears the timer", () => {
        const close = vi.fn();

        subscriber.socket = { close };

        subscriber.dispose();

        expect(subscriber.state).toBe(stateEnum().EVICTED);
        expect(close).toHaveBeenCalledTimes(1);
        expect(subscriber.socket).toBeNull();
        expect(subscriber.heartbeatTimer._destroyed).toBe(true);
      });
    });

    describe("#validateMessage", () => {
      let message: { messageId?: Long };

      beforeEach(() => {
        subscriber.lastMessageId = new Long(0, 0, true);
        message = { messageId: new Long(1, 0, true) };
      });

      it("evicts the node when the messageId is missing", async () => {
        delete message.messageId;

        await expect(subscriber.validateMessage(message)).resolves.toBe(false);

        expect(localNode.evictNode.mock.calls).toEqual([
          [
            remoteNodeId,
            {
              broadcast: true,
              reason: 'invalid message received (missing "messageId" field)',
            },
          ],
        ]);
        expect(subscriber.state).toBe(stateEnum().EVICTED);
      });

      it("rejects an already seen messageId while buffering", async () => {
        subscriber.state = stateEnum().BUFFERING;
        subscriber.lastMessageId = new Long(1, 0, true);

        await expect(subscriber.validateMessage(message)).resolves.toBe(false);
      });

      it("accepts the next messageId and advances the counter", async () => {
        await expect(subscriber.validateMessage(message)).resolves.toBe(true);

        expect(subscriber.lastMessageId.toNumber()).toBe(1);
      });

      it("evicts this node on a gap in the message ids", async () => {
        message.messageId = new Long(3, 0, true);

        await expect(subscriber.validateMessage(message)).resolves.toBe(false);

        expect(localNode.evictSelf).toHaveBeenCalledTimes(1);
      });

      it("reports the number of messages actually lost", async () => {
        // Expected 1, received 3: the messages with ids 1 and 2 are missing.
        message.messageId = new Long(3, 0, true);

        await subscriber.validateMessage(message);

        expect(localNode.evictSelf.mock.calls[0][0]).toMatch(
          /^Node out-of-sync: 2 /,
        );
      });

      it("evicts this subscriber so one drop is reported once", async () => {
        // `lastMessageId` is advanced by one per message and is not resynced
        // here, so a still-running subscriber re-trips this check on every
        // subsequent message: one drop was reported nine times in five seconds
        // in CI. TD-67 (#2776).
        message.messageId = new Long(3, 0, true);

        await subscriber.validateMessage(message);

        expect(subscriber.state).toBe(stateEnum().EVICTED);
        expect(localNode.evictSelf).toHaveBeenCalledTimes(1);
      });

      /*
       * #2785: before evicting itself, the node asks the remote one for what it
       * missed, and applies it in order.
       */
      describe("with a gap the remote node can fill", () => {
        let syncRoot: protobuf.Root;

        const heartbeat = (n: number): [string, Buffer] => {
          const type = syncRoot.lookupType("Heartbeat");

          return [
            "Heartbeat",
            Buffer.from(
              type
                .encode(
                  type.create({
                    address: "tcp://remote",
                    messageId: Long.fromNumber(n, true),
                  }),
                )
                .finish(),
            ),
          ];
        };

        beforeEach(async () => {
          syncRoot = await protobuf.load(
            `${process.cwd()}/lib/cluster/protobuf/sync.proto`,
          );
          subscriber.state = stateEnum().SANE;
        });

        it("applies the missing messages, then accepts this one", async () => {
          localNode.command.requestRetransmit.mockResolvedValueOnce([
            heartbeat(1),
            heartbeat(2),
          ]);
          message.messageId = new Long(3, 0, true);

          await expect(subscriber.validateMessage(message)).resolves.toBe(true);

          const [[ip, from, to]] =
            localNode.command.requestRetransmit.mock.calls;
          expect(ip).toBe(remoteNodeIP);
          expect([from.toNumber(), to.toNumber()]).toEqual([1, 2]);
          expect(subscriber.lastMessageId.toNumber()).toBe(3);
          expect(subscriber.state).toBe(stateEnum().SANE);
          expect(localNode.evictSelf).not.toHaveBeenCalled();
        });

        it("evicts itself, once, when the answer holds other ids", async () => {
          localNode.command.requestRetransmit.mockResolvedValueOnce([
            heartbeat(1),
            heartbeat(5),
          ]);
          message.messageId = new Long(3, 0, true);

          await expect(subscriber.validateMessage(message)).resolves.toBe(
            false,
          );

          expect(localNode.command.requestRetransmit).toHaveBeenCalledTimes(1);
          expect(localNode.evictSelf).toHaveBeenCalledTimes(1);
          expect(subscriber.state).toBe(stateEnum().EVICTED);
        });

        it("evicts itself when the remote node cannot answer", async () => {
          message.messageId = new Long(3, 0, true);

          await expect(subscriber.validateMessage(message)).resolves.toBe(
            false,
          );

          expect(localNode.command.requestRetransmit).toHaveBeenCalledTimes(1);
          expect(localNode.evictSelf.mock.calls[0][0]).toMatch(
            /^Node out-of-sync: 2 /,
          );
        });

        it("asks for nothing on an id older than the expected one", async () => {
          subscriber.lastMessageId = new Long(5, 0, true);
          message.messageId = new Long(3, 0, true);

          await expect(subscriber.validateMessage(message)).resolves.toBe(
            false,
          );

          expect(localNode.command.requestRetransmit).not.toHaveBeenCalled();
          expect(localNode.evictSelf).toHaveBeenCalledTimes(1);
        });
      });

      it("reports a single-message loss as one, not as zero", async () => {
        // The case TD-58 (#2762) got wrong, and the frequent one: expected 1,
        // received 2, so the message with id 1 is missing. It used to print
        // "0 messages lost", which reads as a spurious eviction — and is why
        // five reviews of TD-33 (#2715) dismissed this detector.
        message.messageId = new Long(2, 0, true);

        await subscriber.validateMessage(message);

        expect(localNode.evictSelf.mock.calls[0][0]).toMatch(
          /^Node out-of-sync: 1 /,
        );
      });
    });

    describe("#handleHeartbeat", () => {
      it("resets the last heartbeat date", () => {
        subscriber.lastHeartbeat = 42;

        subscriber.handleHeartbeat();

        expect(subscriber.lastHeartbeat).toBeGreaterThan(Date.now() - 100);
      });
    });

    describe("#handleNodeEviction", () => {
      const message = () => ({
        nodeId: "remote-node-21",
        evictor: "other-node-84",
        reason: "you are a very very bad node",
      });

      it("shuts this node down when it is the one evicted", async () => {
        await subscriber.handleNodeEviction({
          ...message(),
          nodeId: localNode.nodeId,
        });

        expect(localNode.evictNode).not.toHaveBeenCalled();
        // A failure, like `evictSelf`: exit non-zero (#2785).
        expect(kuzzle.shutdown).toHaveBeenCalledExactlyOnceWith(1);
      });

      it("evicts the remote node without rebroadcasting", async () => {
        await subscriber.handleNodeEviction(message());

        expect(localNode.evictNode.mock.calls).toEqual([
          [
            "remote-node-21",
            { broadcast: false, reason: "you are a very very bad node" },
          ],
        ]);
        expect(kuzzle.shutdown).not.toHaveBeenCalled();
      });
    });

    describe("#handleNodeShutdown", () => {
      it("evicts the node that is shutting down", async () => {
        await subscriber.handleNodeShutdown({ nodeId: "remote-node-21" });

        expect(localNode.evictNode.mock.calls).toEqual([
          [
            "remote-node-21",
            { broadcast: false, reason: "Node is shutting down" },
          ],
        ]);
      });
    });

    describe("realtime state", () => {
      it("#handleNewRealtimeRoom adds the room to the full state", async () => {
        await subscriber.handleNewRealtimeRoom({
          id: "roomId",
          index: "index/collection",
          filter: '["filters"]',
          messageId: "messageId",
        });

        expect(localNode.fullState.addRealtimeRoom.mock.calls).toEqual([
          [
            "roomId",
            "index",
            "collection",
            ["filters"],
            {
              messageId: "messageId",
              nodeId: remoteNodeId,
              subscribers: 0,
            },
          ],
        ]);
      });

      it("#handleSubscription adds the subscription to the full state", async () => {
        await subscriber.handleSubscription({
          roomId: "roomId",
          messageId: "messageId",
        });

        expect(localNode.fullState.addRealtimeSubscription.mock.calls).toEqual([
          ["roomId", remoteNodeId, "messageId"],
        ]);
      });

      it("#handleRealtimeRoomRemoval removes the room from the full state", async () => {
        await subscriber.handleRealtimeRoomRemoval({
          roomId: "roomId",
          messageId: "messageId",
        });

        expect(localNode.fullState.removeRealtimeRoom.mock.calls).toEqual([
          ["roomId", remoteNodeId],
        ]);
      });

      it("#handleUnsubscription removes the subscription from the full state", async () => {
        await subscriber.handleUnsubscription({
          roomId: "roomId",
          messageId: "messageId",
        });

        expect(
          localNode.fullState.removeRealtimeSubscription.mock.calls,
        ).toEqual([["roomId", remoteNodeId, "messageId"]]);
      });
    });

    describe("#handleClusterWideEvent", () => {
      it("re-emits the event locally with its parsed payload", async () => {
        await subscriber.handleClusterWideEvent({
          payload: '["payload"]',
          event: "event",
        });

        expect(localNode.eventEmitter.emit.mock.calls).toEqual([
          ["event", ["payload"]],
        ]);
      });
    });

    describe("#handleDocumentNotification", () => {
      // `scope` used to read "scope" here — a value that has never been a member
      // of RealtimeScope. Nothing on either side of the wire checked, so the
      // spec passed while describing a notification the rest of Kuzzle cannot
      // represent. TD-68 (#2779).
      const documentMessage = () => ({
        scope: "in",
        action: "create",
        result: '["result"]',
        status: 200,
        requestId: "requestId",
        timestamp: new Long(0, 0, true),
        index: "index",
        collection: "collection",
        controller: "controller",
        protocol: "protocol",
        volatile: '["volatile"]',
        rooms: ["rooms"],
      });

      it("applies the notification", async () => {
        await subscriber.handleDocumentNotification(documentMessage());

        expect(kuzzle.ask).toHaveBeenCalled();
      });

      it("evicts the sender of an unknown scope rather than apply it", async () => {
        await subscriber.handleDocumentNotification({
          ...documentMessage(),
          scope: "sideways",
        });

        expect(kuzzle.ask).not.toHaveBeenCalled();
        expect(localNode.evictNode).toHaveBeenCalledTimes(1);

        const [nodeId, options] = localNode.evictNode.mock.calls[0];

        expect(nodeId).toBe(remoteNodeId);
        expect(options.broadcast).toBe(true);
        expect(options.reason).toMatch(
          /unknown document notification scope "sideways"/,
        );
      });
    });

    describe("#handleUserNotification", () => {
      // This message used to be a copy of the document one: it carried `scope`,
      // `requestId` and `rooms`, which this handler never reads, and neither
      // `user` nor `room`, which it does. It now describes a user notification.
      const userMessage = () => ({
        user: "in",
        room: "room",
        action: "create",
        result: '["result"]',
        status: 200,
        timestamp: new Long(0, 0, true),
        index: "index",
        collection: "collection",
        controller: "controller",
        protocol: "protocol",
        volatile: '["volatile"]',
      });

      it("applies the notification", async () => {
        await subscriber.handleUserNotification(userMessage());

        expect(kuzzle.ask).toHaveBeenCalled();
      });

      it("evicts the sender of an unknown user scope rather than apply it", async () => {
        await subscriber.handleUserNotification({
          ...userMessage(),
          user: "sideways",
        });

        expect(kuzzle.ask).not.toHaveBeenCalled();
        expect(localNode.evictNode).toHaveBeenCalledTimes(1);

        const [nodeId, options] = localNode.evictNode.mock.calls[0];

        expect(nodeId).toBe(remoteNodeId);
        expect(options.broadcast).toBe(true);
        expect(options.reason).toMatch(
          /unknown user notification scope "sideways"/,
        );
      });
    });

    describe("auth strategies", () => {
      it("#handleNewAuthStrategy registers it locally and in the full state", async () => {
        const message = {
          pluginName: "pluginName",
          strategy: "strategy",
          strategyName: "strategyName",
        };

        await subscriber.handleNewAuthStrategy(message);

        expect(localNode.fullState.addAuthStrategy.mock.calls).toEqual([
          [message],
        ]);
        expect(kuzzle.pluginsManager.registerStrategy.mock.calls).toEqual([
          ["pluginName", "strategyName", "strategy"],
        ]);
      });

      it("#handleAuthStrategyRemoval unregisters it from both", async () => {
        await subscriber.handleAuthStrategyRemoval({
          pluginName: "pluginName",
          strategyName: "strategyName",
        });

        expect(localNode.fullState.removeAuthStrategy.mock.calls).toEqual([
          ["strategyName"],
        ]);
        expect(kuzzle.pluginsManager.unregisterStrategy.mock.calls).toEqual([
          ["pluginName", "strategyName"],
        ]);
      });
    });

    describe("security and maintenance", () => {
      const asked = () => kuzzle.ask.mock.calls;

      it("#handleResetSecurity invalidates both caches", async () => {
        await subscriber.handleResetSecurity();

        expect(asked()).toEqual([
          ["core:security:profile:invalidate"],
          ["core:security:role:invalidate"],
        ]);
      });

      it("#handleProfileInvalidation invalidates one profile", async () => {
        await subscriber.handleProfileInvalidation({ profileId: "profileId" });

        expect(asked()).toEqual([
          ["core:security:profile:invalidate", "profileId"],
        ]);
      });

      it("#handleRoleInvalidation invalidates one role", async () => {
        await subscriber.handleRoleInvalidation({ roleId: "roleId" });

        expect(asked()).toEqual([["core:security:role:invalidate", "roleId"]]);
      });

      it("#handleDumpRequest dumps with the provided suffix", () => {
        subscriber.handleDumpRequest({ suffix: "suffix" });

        expect(kuzzle.dump.mock.calls).toEqual([["suffix"]]);
      });

      it("#handleShutdown shuts kuzzle down", () => {
        subscriber.handleShutdown();

        // A requested cluster shutdown is not a failure: default exit code.
        expect(kuzzle.shutdown).toHaveBeenCalledExactlyOnceWith();
      });

      it("#handleRefreshValidators curates the specification again", () => {
        subscriber.handleRefreshValidators();

        expect(kuzzle.validation.curateSpecification).toHaveBeenCalledTimes(1);
      });
    });

    describe("index cache", () => {
      it("#handleIndexAddition adds the index to the scope's cache", async () => {
        await subscriber.handleIndexAddition({
          index: "index",
          scope: "scope",
        });

        expect(kuzzle.ask.mock.calls).toEqual([
          ["core:storage:scope:cache:addIndex", "index"],
        ]);
      });

      it("#handleCollectionAddition adds the collection to the scope's cache", async () => {
        await subscriber.handleCollectionAddition({
          index: "index",
          collection: "collection",
          scope: "scope",
        });

        expect(kuzzle.ask.mock.calls).toEqual([
          ["core:storage:scope:cache:addCollection", "index", "collection"],
        ]);
      });

      it("#handleCollectionRemoval removes the collection from the scope's cache", async () => {
        await subscriber.handleCollectionRemoval({
          index: "index",
          collection: "collection",
          scope: "scope",
        });

        expect(kuzzle.ask.mock.calls).toEqual([
          ["core:storage:scope:cache:removeCollection", "index", "collection"],
        ]);
      });
    });
  });
});
