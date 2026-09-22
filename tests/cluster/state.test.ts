import { NormalizedFilter } from "koncorde";
import Long from "long";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import State from "../../lib/cluster/state";
import type { FullStateAuthStrategy } from "../../lib/cluster/protobuf/commandMessages";
import { InternalError } from "../../lib/kerror/errors/internalError";
import { invalid } from "../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../mocks/kuzzle";

/** A node's view of a room, as the fullstate records it. */
const nodeState = (
  nodeId: string,
  messageId: number | Long,
  subscribers: number,
) => ({ messageId: messageId as Long, nodeId, subscribers });

describe("#cluster/State", () => {
  let state: State;
  let koncorde: {
    hasFilterId: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    store: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    koncorde = {
      hasFilterId: vi.fn(() => false),
      remove: vi.fn(),
      store: vi.fn(),
    };

    /* The fullstate keeps the realtime filters in Koncorde, and registers the
     * authentication strategies it loads with the plugins manager. */
    stubKuzzle({
      koncorde,
      pluginsManager: { registerStrategy: vi.fn() },
    });

    state = new State();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const addRoom = (
    roomId: string,
    index: string,
    collection: string,
    node: ReturnType<typeof nodeState>,
    filters: Record<string, unknown> = {},
  ) => state.addRealtimeRoom(roomId, index, collection, filters, node);

  describe("#realtime rooms", () => {
    it("should store a new room's filters once per room", () => {
      const filters = { oh: { hai: { can: { I: "haz cheezburgers?" } } } };
      const node = nodeState("nodeid", 456, 123);
      const node2 = nodeState("nodeid2", 789, 42);

      addRoom("roomid", "index", "collection", node, filters);
      expect(koncorde.store).toHaveBeenCalledWith(
        new NormalizedFilter(filters, "roomid", "index/collection"),
      );

      koncorde.store.mockClear();
      addRoom("roomid2", "index", "collection", node, filters);
      expect(koncorde.store).toHaveBeenCalledWith(
        new NormalizedFilter(filters, "roomid2", "index/collection"),
      );

      // A room Koncorde already knows is not stored a second time.
      koncorde.store.mockClear();
      koncorde.hasFilterId.mockImplementation(
        (roomId: string, kindex: string) =>
          roomId === "roomid2" && kindex === "index/collection",
      );
      addRoom("roomid2", "index", "collection", node2, filters);
      expect(koncorde.store).not.toHaveBeenCalled();

      expect(state.serialize().rooms).toMatchObject([
        {
          collection: "collection",
          filters: JSON.stringify(filters),
          index: "index",
          nodes: [{ nodeId: "nodeid", messageId: 456, subscribers: 123 }],
          roomId: "roomid",
        },
        {
          collection: "collection",
          filters: JSON.stringify(filters),
          index: "index",
          nodes: [
            { nodeId: "nodeid", messageId: 456, subscribers: 123 },
            { nodeId: "nodeid2", messageId: 789, subscribers: 42 },
          ],
          roomId: "roomid2",
        },
      ]);
    });

    it("should throw if a node is added twice to the same room", () => {
      const node = nodeState("nodeid", 456, 123);

      addRoom("roomid", "index", "collection", node);

      expect(() => addRoom("roomid", "index", "collection", node)).toThrow(
        expect.objectContaining({ id: "cluster.fatal.desync" }),
      );
      expect(() => addRoom("roomid", "index", "collection", node)).toThrow(
        /duplicate node/,
      );
    });

    it("should remove the entire room when its last node removes it", () => {
      addRoom("roomid", "index", "collection", nodeState("nodeid", 456, 123));
      addRoom("roomid", "index", "collection", nodeState("nodeid2", 456, 123));

      state.removeRealtimeRoom("roomid", "nodeid");
      state.removeRealtimeRoom("roomid", "nodeid2");

      expect(state.serialize().rooms).toEqual([]);
      // The Koncorde index too: sinon's `calledWith` matched a prefix, so the
      // Mocha spec named only the room.
      expect(koncorde.remove).toHaveBeenCalledWith(
        "roomid",
        "index/collection",
      );
    });

    it("should ignore a non-existing room when attempting to remove it", () => {
      expect(() => state.removeRealtimeRoom("foobar", "nodeid")).not.toThrow();
    });

    it("should remove only the node it is given", () => {
      addRoom("roomid", "index", "collection", nodeState("nodeid", 12, 23));
      addRoom("roomid", "index", "collection", nodeState("nodeid2", 45, 56));
      addRoom("roomid", "index", "collection", nodeState("nodeid3", 67, 78));

      state.removeRealtimeRoom("roomid", "nodeid2");

      expect(state.serialize().rooms).toMatchObject([
        {
          roomId: "roomid",
          nodes: [
            { nodeId: "nodeid", messageId: 12, subscribers: 23 },
            { nodeId: "nodeid3", messageId: 67, subscribers: 78 },
          ],
        },
      ]);
    });

    it("should return normalized filters on demand", () => {
      const filters = { foo: "bar" };

      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", 12, 23),
        filters,
      );

      expect(state.getNormalizedFilters("roomid")).toMatchObject(
        new NormalizedFilter(filters, "roomid", "index/collection"),
      );
      expect(state.getNormalizedFilters("ohnoes")).toBeNull();
    });

    it("should count the subscriptions of a room across every node", () => {
      addRoom("roomid", "index", "collection", nodeState("nodeid", 12, 23));
      addRoom("roomid", "index", "collection", nodeState("nodeid2", 12, 23));
      addRoom("roomid2", "index", "collection", nodeState("nodeid2", 12, 23));
      addRoom("roomid", "index", "collection", nodeState("nodeid3", 12, 23));

      expect(state.countRealtimeSubscriptions("roomid")).toBe(3 * 23);
      expect(state.countRealtimeSubscriptions("roomid2")).toBe(23);
      expect(state.countRealtimeSubscriptions("ohnoes")).toBe(0);
    });

    it("should list the rooms by index and collection", () => {
      addRoom("roomid", "index", "collection", nodeState("nodeid", 12, 23));
      addRoom("roomid", "index", "collection", nodeState("nodeid2", 12, 23));
      addRoom("roomid2", "index", "collection", nodeState("nodeid2", 12, 23));
      addRoom("roomid", "index", "collection", nodeState("nodeid3", 12, 23));
      addRoom("roomid3", "index2", "collection", nodeState("nodeid3", 12, 23));

      expect(state.listRealtimeRooms()).toMatchObject({
        index: { collection: { roomid: 3 * 23, roomid2: 23 } },
        index2: { collection: { roomid3: 23 } },
      });
    });
  });

  describe("#realtime subscriptions", () => {
    const messageId = Long.fromInt(12, true);

    it("should add a subscription to an existing room", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 23),
      );

      const newMessageId = Long.fromInt(14, true);
      state.addRealtimeSubscription("roomid", "nodeid", newMessageId);

      expect(state.serialize().rooms).toMatchObject([
        {
          roomId: "roomid",
          nodes: [
            { nodeId: "nodeid", messageId: newMessageId, subscribers: 24 },
          ],
        },
      ]);
    });

    it("should throw when subscribing to a non-existing room", () => {
      expect(() =>
        state.addRealtimeSubscription("roomid", "nodeid", Long.fromInt(1)),
      ).toThrow(InternalError);
      expect(() =>
        state.addRealtimeSubscription("roomid", "nodeid", Long.fromInt(1)),
      ).toThrow(/room doesn't exist/);
    });

    it("should throw when subscribing from a node the room does not know", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 23),
      );

      expect(() =>
        state.addRealtimeSubscription("roomid", "ohnoes", Long.fromInt(1)),
      ).toThrow(/unknown node ohnoes/);
    });

    it("should ignore a subscription coming from an older message", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 23),
      );

      state.addRealtimeSubscription("roomid", "nodeid", Long.fromInt(11, true));

      expect(state.serialize().rooms).toMatchObject([
        { nodes: [{ nodeId: "nodeid", messageId, subscribers: 23 }] },
      ]);
    });

    it("should remove a subscription from an existing room", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 23),
      );
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid2", messageId, 42),
      );

      const newMessageId = Long.fromInt(14, true);
      state.removeRealtimeSubscription("roomid", "nodeid", newMessageId);

      expect(state.serialize().rooms).toMatchObject([
        {
          roomId: "roomid",
          nodes: [
            { nodeId: "nodeid", messageId: newMessageId, subscribers: 22 },
            { nodeId: "nodeid2", messageId, subscribers: 42 },
          ],
        },
      ]);
    });

    it("should throw when unsubscribing from an unknown room", () => {
      expect(() =>
        state.removeRealtimeSubscription(
          "roomid",
          "nodeid",
          Long.fromInt(14, true),
        ),
      ).toThrow(/room doesn't exist/);
    });

    it("should throw if the number of subscribers would become negative", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 1),
      );

      let newMessageId = Long.fromInt(14, true);
      state.removeRealtimeSubscription("roomid", "nodeid", newMessageId);

      expect(state.serialize().rooms).toMatchObject([
        {
          nodes: [
            { nodeId: "nodeid", messageId: newMessageId, subscribers: 0 },
          ],
        },
      ]);

      newMessageId = newMessageId.add(1);

      expect(() =>
        state.removeRealtimeSubscription("roomid", "nodeid", newMessageId),
      ).toThrow(/negative subscribers count/);
    });

    it("should throw if the unsubscribing node is unknown for that room", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 1),
      );

      expect(() =>
        state.removeRealtimeSubscription(
          "roomid",
          "ohnoes",
          Long.fromInt(14, true),
        ),
      ).toThrow(/unknown node ohnoes/);
    });

    it("should ignore an unsubscription coming from an older message", () => {
      addRoom(
        "roomid",
        "index",
        "collection",
        nodeState("nodeid", messageId, 23),
      );

      state.removeRealtimeSubscription(
        "roomid",
        "nodeid",
        Long.fromInt(11, true),
      );

      expect(state.serialize().rooms).toMatchObject([
        { nodes: [{ nodeId: "nodeid", messageId, subscribers: 23 }] },
      ]);
    });

    it("should remove an entire node from the realtime fullstate", () => {
      for (const [roomId, index, collection] of [
        ["roomid", "index", "collection"],
        ["roomid2", "index", "collection"],
        ["roomid3", "index2", "collection"],
        ["roomid4", "index2", "collection2"],
      ] as const) {
        addRoom(roomId, index, collection, nodeState("nodeid", messageId, 23));
      }

      state.removeNode("nodeid");

      expect(state.serialize().rooms).toEqual([]);
    });
  });

  describe("#auth strategies", () => {
    it("should add an authentication strategy to the fullstate", () => {
      // `FullStateAuthStrategy` also declares `strategy` and `pluginName`;
      // what the fullstate keys on is the name, which is what these assert.
      const strategy = invalid<FullStateAuthStrategy>({
        strategyName: "foo",
        foo: "bar",
      });

      state.addAuthStrategy(strategy);

      expect(state.serialize().authStrategies).toMatchObject([strategy]);
    });

    it("should remove an authentication strategy from the fullstate", () => {
      // `FullStateAuthStrategy` also declares `strategy` and `pluginName`;
      // what the fullstate keys on is the name, which is what these assert.
      const strategy = invalid<FullStateAuthStrategy>({
        strategyName: "foo",
        foo: "bar",
      });

      state.addAuthStrategy(strategy);
      state.addAuthStrategy(
        invalid<FullStateAuthStrategy>({ strategyName: "bar", foo: "bar" }),
      );

      state.removeAuthStrategy("bar");
      expect(state.serialize().authStrategies).toMatchObject([strategy]);

      state.removeAuthStrategy("foo");
      expect(state.serialize().authStrategies).toEqual([]);
    });
  });

  describe("#loadFullState", () => {
    it("should round-trip a serialized fullstate", () => {
      const messageId = Long.fromInt(12, true);

      for (const [roomId, index, collection] of [
        ["roomid", "index", "collection"],
        ["roomid2", "index", "collection"],
        ["roomid3", "index2", "collection"],
        ["roomid4", "index2", "collection2"],
      ] as const) {
        addRoom(roomId, index, collection, nodeState("nodeid", messageId, 23));
      }

      state.addAuthStrategy(
        invalid<FullStateAuthStrategy>({ strategyName: "foo", foo: "bar" }),
      );
      state.addAuthStrategy(
        invalid<FullStateAuthStrategy>({ strategyName: "bar", foo: "bar" }),
      );

      const loaded = new State();
      loaded.loadFullState(state.serialize());

      expect(loaded.serialize()).toMatchObject(state.serialize());
    });
  });
});
