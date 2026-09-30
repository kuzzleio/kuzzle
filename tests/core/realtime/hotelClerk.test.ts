import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleRequest } from "../../../lib/api/request";
import { Channel } from "../../../lib/core/realtime/channel";
import { ConnectionRooms } from "../../../lib/core/realtime/connectionRooms";
import { HotelClerk } from "../../../lib/core/realtime/hotelClerk";
import { Room } from "../../../lib/core/realtime/room";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PreconditionError } from "../../../lib/kerror/errors/preconditionError";
import { SizeLimitError } from "../../../lib/kerror/errors/sizeLimitError";
import { present } from "../../helpers/present";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/*
 * One file for one subject, where Mocha had seven — `hotelClerk.test.js`,
 * `listCollections`, `list`, `join`, `disconnect`, `subscribe`,
 * `unsubscribe`. The `tests/` mirror convention is what assigns
 * `lib/core/realtime/hotelClerk.ts` its owning coverage report
 * (`prepare-coverage.ts` › `specTarget`), and it cannot express seven specs
 * for one file: each would resolve to a `lib/core/realtime/hotelClerk/*.ts`
 * that does not exist, and the subject would stay attributed to the mocha
 * report with nothing left in it. Merging is what closes the mirror, so all
 * seven are ported here rather than five now and two with L2.
 *
 * That coverage reason expired with step 13's L7b: with one runner there is no
 * report to be attributed to the wrong one, and `specTarget` is gone. The
 * merge still stands on its own — one subject, one spec — which is why this
 * file is left as it is.
 *
 * The `describe` blocks below are the seven former files, in that order.
 */

/** The events the subject registers, captured instead of dispatched. */
/**
 * `Room.connections` is `private`, and three assertions below are about
 * exactly who is left in a room. Named once, like the subject's own internals.
 */
const connectionsOf = (room: Room) =>
  (room as unknown as { connections: Set<string> }).connections;

type Handlers = Map<string, (...args: unknown[]) => unknown>;

describe("#core/realtime/HotelClerk", () => {
  const connectionId = "connectionid";

  let hotelClerk: HotelClerk;
  /**
   * `roomsCount`, `rooms` and `subscriptions` are `private` on the subject,
   * and all seven Mocha specs drove them directly — JavaScript did not care.
   * The cast is named once, here, rather than at each of its forty uses, and
   * it is the honest form: this spec asserts on internal state because that is
   * what the suite it replaces asserted on. `metrics()` is the public surface
   * over the same two counters, and the `#metrics` block pins that they agree.
   */
  let internals: {
    createRoom: (...args: never[]) => unknown;
    logger: { error: (...args: unknown[]) => void };
    removeRoom: (...args: never[]) => unknown;
    rooms: Map<string, Room>;
    roomsCount: number;
    subscribeToRoom: unknown;
    subscriptions: Map<string, ConnectionRooms>;
  };
  let notifyUser: ReturnType<typeof vi.fn>;
  let realtimeModule: { notifier: { notifyUser: typeof notifyUser } };
  let asked: Handlers;
  let listened: Handlers;
  let ask: ReturnType<typeof vi.fn>;
  let call: ReturnType<typeof vi.fn>;
  let emit: ReturnType<typeof vi.fn>;
  let pipe: ReturnType<typeof vi.fn>;
  let koncorde: {
    getIndexes: ReturnType<typeof vi.fn>;
    normalize: ReturnType<typeof vi.fn>;
    store: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    /*
     * What the subject reads off the global, and nothing more: Koncorde (kept
     * as a field by the constructor), the two event registrars, the four
     * dispatchers, two config limits, and one method each from the router, the
     * token manager and the entry point. Thirteen names — which is what
     * KuzzleMock was standing in for.
     */
    asked = new Map();
    listened = new Map();
    ask = vi.fn(async () => undefined);
    call = vi.fn();
    emit = vi.fn();
    pipe = vi.fn(async (_event, payload) => payload);
    koncorde = {
      getIndexes: vi.fn(() => []),
      normalize: vi.fn(() => ({ filter: [], id: "foobar", index: "foo/bar" })),
      store: vi.fn(),
    };

    stubKuzzle({
      ask,
      call,
      config: {
        limits: { subscriptionMinterms: 0, subscriptionRooms: 100 },
      },
      emit,
      entryPoint: { joinChannel: () => {}, leaveChannel: () => {} },
      koncorde,
      on: (event: string, handler: (...args: unknown[]) => unknown) => {
        listened.set(event, handler);
      },
      onAsk: (event: string, handler: (...args: unknown[]) => unknown) => {
        asked.set(event, handler);
      },
      pipe,
      router: { isConnectionAlive: () => true },
      tokenManager: { getKuidFromConnection: () => null },
    });

    notifyUser = vi.fn();
    realtimeModule = { notifier: { notifyUser } };
    hotelClerk = new HotelClerk(realtimeModule as never);

    await hotelClerk.init();
    internals = hotelClerk as unknown as typeof internals;
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /**
   * A subscribe request on `foo/bar`, the shape every spec below starts from.
   */
  const subscribeRequest = (body: unknown = { equals: { firstName: "Ada" } }) =>
    new KuzzleRequest(
      {
        action: "subscribe",
        body,
        collection: "bar",
        controller: "realtime",
        index: "foo",
        volatile: { bar: ["foo", "bar", "baz", "qux"], foo: "bar" },
      },
      { connectionId, token: null },
    );

  /*
   * The Mocha specs asserted a handler's registration by restoring the mock's
   * `ask` and firing the event through it — which tests KuzzleMock's own event
   * bus as much as the subject. Invoking the captured handler asserts the one
   * thing that matters: this event reaches this method, with these arguments.
   */
  const invokeAsk = (event: string, ...args: unknown[]) => {
    const handler = asked.get(event);

    present(handler, `handler for ${event}`);

    return handler(...args);
  };

  describe("#init", () => {
    it("registers a handler for each of its ask events", () => {
      expect([...asked.keys()]).toEqual(
        expect.arrayContaining([
          "core:realtime:collections:get",
          "core:realtime:connection:remove",
          "core:realtime:hotelClerk:metrics",
          "core:realtime:join",
          "core:realtime:list",
          "core:realtime:room:create",
          "core:realtime:subscribe",
          "core:realtime:unsubscribe",
        ]),
      );
    });

    it("listens for the shutdown and the dropped-connection events", () => {
      expect([...listened.keys()]).toEqual(
        expect.arrayContaining(["connection:remove", "kuzzle:shutdown"]),
      );
    });
  });

  describe("#clearConnections", () => {
    beforeEach(() => {
      internals.subscriptions.set(
        "a",
        new ConnectionRooms(new Map<string, JSONObject>([["foo", {}]])),
      );
      internals.subscriptions.set(
        "b",
        new ConnectionRooms(new Map<string, JSONObject>([["foo", {}]])),
      );
    });

    it("is what the shutdown event runs", async () => {
      const clear = vi
        .spyOn(hotelClerk, "clearConnections")
        .mockResolvedValue(undefined);

      const shutdown = listened.get("kuzzle:shutdown");

      present(shutdown, "handler for kuzzle:shutdown");

      await shutdown();

      expect(clear).toHaveBeenCalledTimes(1);
    });

    it("removes every connection", async () => {
      const remove = vi
        .spyOn(hotelClerk, "removeConnection")
        .mockResolvedValue(undefined);

      await hotelClerk.clearConnections();

      /*
       * `notify: false` is the second argument, and it is the point of
       * clearing on shutdown — nobody is left to notify. sinon's `calledWith`
       * matches a prefix, so the Mocha spec asserted the connection ids and
       * said nothing about it.
       */
      expect(remove).toHaveBeenCalledTimes(2);
      expect(remove).toHaveBeenCalledWith("a", false);
      expect(remove).toHaveBeenCalledWith("b", false);
    });
  });

  describe("#metrics", () => {
    it("reports its room and subscription counts", () => {
      internals.subscriptions.set(
        "a",
        new ConnectionRooms(new Map<string, JSONObject>([["foo", {}]])),
      );
      internals.subscriptions.set(
        "b",
        new ConnectionRooms(new Map<string, JSONObject>([["foo", {}]])),
      );

      expect(hotelClerk.metrics()).toMatchObject({
        rooms: 0,
        subscriptions: 2,
      });
    });

    it("is what the metrics ask event answers", () => {
      expect(invokeAsk("core:realtime:hotelClerk:metrics")).toEqual(
        hotelClerk.metrics(),
      );
    });
  });

  describe("#listCollections", () => {
    it("is what the collections:get event calls", () => {
      const list = vi.spyOn(hotelClerk, "listCollections");

      invokeAsk("core:realtime:collections:get", "index");

      expect(list).toHaveBeenCalledWith("index");
    });

    it("returns nothing when there is no subscription", () => {
      expect(hotelClerk.listCollections("index")).toEqual([]);
    });

    it("returns each collection of the index, once", () => {
      koncorde.getIndexes.mockReturnValue([
        "index/foo",
        "index/bar",
        "anotherIndex/baz",
      ]);

      expect(hotelClerk.listCollections("index")).toEqual(["foo", "bar"]);
    });
  });

  describe("#list", () => {
    let user: { _id: string; isActionAllowed: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      user = { _id: "user", isActionAllowed: vi.fn(async () => true) };
    });

    it("is what the list event calls", () => {
      const list = vi.spyOn(hotelClerk, "list").mockResolvedValue({});

      invokeAsk("core:realtime:list", "user");

      expect(list).toHaveBeenCalledWith("user");
    });

    it("returns nothing when the cluster holds no room", async () => {
      ask.mockResolvedValue({});

      expect(await hotelClerk.list(user as never)).toEqual({});
    });

    it("returns the cluster's rooms the user may subscribe to", async () => {
      ask.mockResolvedValue({
        anotherIndex: { anotherCollection: { baz: 42 } },
        index: { collection: { bar: 24, foo: 12 } },
      });

      expect(await hotelClerk.list(user as never)).toMatchObject({
        anotherIndex: { anotherCollection: { baz: 42 } },
        index: { collection: { bar: 24, foo: 12 } },
      });
    });

    it("drops the collections the user may not subscribe to", async () => {
      ask.mockResolvedValue({
        andAnotherOne: { collection: { foobar: 26 } },
        anotherIndex: { anotherCollection: { baz: 42 } },
        index: { collection: { bar: 24, foo: 12 }, forbidden: { foo: 54 } },
      });

      /* Refused on the second and third pair the subject checks. */
      user.isActionAllowed
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);

      const list = await hotelClerk.list(user as never);

      expect(list).toMatchObject({
        andAnotherOne: { collection: { foobar: 26 } },
        index: { collection: { bar: 24, foo: 12 } },
      });
      /*
       * Not asserted by the Mocha spec, which checked only what remained —
       * `should(...).match()` ignores extra keys, so a pair that should have
       * been dropped was invisible. A refused collection is indeed gone:
       */
      expect(list.index).not.toHaveProperty("forbidden");

      /*
       * ⚠️ But an index whose every collection was refused is left behind as
       * an EMPTY OBJECT rather than removed: `list` deletes collections and
       * never prunes the index that held them. So a user forbidden from every
       * collection of `anotherIndex` still learns that `anotherIndex` exists.
       * Asserted as it behaves, not as it should: a porting slice does not
       * change `lib/`. Reported in the step file.
       */
      expect(list).toHaveProperty("anotherIndex");
      expect(list.anotherIndex).toEqual({});
    });
  });

  describe("#join", () => {
    it("is what the join event calls", () => {
      // `join` answers a room; what this asserts is the wiring, so the value
      // only has to be one.
      const join = vi
        .spyOn(hotelClerk, "join")
        .mockResolvedValue({ channel: "channel", roomId: "roomId" });

      invokeAsk("core:realtime:join", "request");

      expect(join).toHaveBeenCalledWith("request");
    });

    it("lets a second connection join an existing room", async () => {
      const first = await hotelClerk.subscribe(subscribeRequest());
      present(first, "subscribe result");
      const { roomId } = first;

      expect(first).toHaveProperty("channel");
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        roomId,
        expect.anything(),
        "in",
        expect.objectContaining({ count: 1 }),
      );

      const joinRequest = new KuzzleRequest(
        {
          action: "join",
          body: { roomId },
          collection: "bar",
          controller: "realtime",
          index: "foo",
        },
        { connectionId: "connection2", user: null },
      );

      const second = await hotelClerk.join(joinRequest);

      expect(second).toHaveProperty("roomId", roomId);
      expect(second).toHaveProperty("channel");
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        roomId,
        joinRequest,
        "in",
        expect.objectContaining({ count: 2 }),
      );
    });

    it("rejects a room that does not exist", async () => {
      const joinRequest = new KuzzleRequest({
        action: "join",
        body: { roomId: "i-exist" },
        collection: "bar",
        controller: "realtime",
        index: "foo",
      });

      const rejection = hotelClerk.join(joinRequest);

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.realtime.room_not_found",
      });
    });

    it("propagates to the cluster only when the callback says to", async () => {
      const joinRequest = new KuzzleRequest({
        action: "join",
        body: { roomId: "i-exist" },
        collection: "bar",
        controller: "realtime",
        index: "foo",
      });
      const response = { channel: "foobar", cluster: false, subscribed: true };

      internals.rooms.set("i-exist", {} as never);
      internals.subscribeToRoom = (async (
        _id: string,
        _request: KuzzleRequest,
        callback: (subscribed: boolean, cluster: boolean) => Promise<void>,
      ) => {
        await callback(response.subscribed, response.cluster);
        return response;
      }) as never;

      await hotelClerk.join(joinRequest);

      expect(call).not.toHaveBeenCalledWith(
        "core:realtime:subscribe:after",
        expect.anything(),
      );

      response.cluster = true;
      await hotelClerk.join(joinRequest);

      expect(call).toHaveBeenCalledWith(
        "core:realtime:subscribe:after",
        "i-exist",
      );
    });
  });

  describe("#removeConnection", () => {
    const collection = "user";
    const index = "%test";

    beforeEach(() => {
      internals.subscriptions.set(
        connectionId,
        new ConnectionRooms(
          new Map([
            ["foo", { volatile: "room foo" }],
            ["bar", { volatile: "room bar" }],
          ]),
        ),
      );
      internals.subscriptions.set(
        "a",
        new ConnectionRooms(new Map<string, JSONObject>([["foo", {}]])),
      );
      internals.subscriptions.set(
        "b",
        new ConnectionRooms(new Map<string, JSONObject>([["foo", {}]])),
      );

      internals.rooms.set(
        "foo",
        new Room(
          "foo",
          index,
          collection,
          new Map([["foobar", new Channel("foo")]]),
          new Set([connectionId, "a", "b"]),
        ),
      );
      internals.rooms.set(
        "bar",
        new Room(
          "bar",
          index,
          collection,
          new Map([["barfoo", new Channel("bar")]]),
          new Set([connectionId]),
        ),
      );

      internals.roomsCount = 2;
    });

    it("is what the connection:remove event calls", () => {
      const remove = vi
        .spyOn(hotelClerk, "removeConnection")
        .mockResolvedValue(undefined);

      invokeAsk("core:realtime:connection:remove", "connectionId");

      expect(remove).toHaveBeenCalledWith("connectionId");
    });

    it("does nothing for a connection it does not know", async () => {
      const unsubscribe = vi.spyOn(hotelClerk, "unsubscribe");

      await hotelClerk.removeConnection("nope");

      expect(unsubscribe).not.toHaveBeenCalled();
      expect(internals.roomsCount).toBe(2);
    });

    it("drops the connection's rooms and keeps the ones still in use", async () => {
      await hotelClerk.removeConnection(connectionId);

      expect(internals.rooms.has("foo")).toBe(true);
      expect(internals.rooms.has("bar")).toBe(false);
      expect(internals.subscriptions.has("a")).toBe(true);
      expect(internals.subscriptions.has("b")).toBe(true);
      expect(internals.subscriptions.has(connectionId)).toBe(false);
      expect(internals.roomsCount).toBe(1);
    });

    it("notifies each room it left, with that room's volatile data", async () => {
      await hotelClerk.removeConnection(connectionId);

      for (const [room, volatile, count] of [
        ["foo", { volatile: "room foo" }, 2],
        ["bar", { volatile: "room bar" }, 0],
      ] as const) {
        expect(notifyUser).toHaveBeenCalledWith(
          room,
          expect.objectContaining({
            input: expect.objectContaining({
              action: "unsubscribe",
              controller: "realtime",
              volatile,
            }),
          }),
          "out",
          expect.objectContaining({ count }),
        );
      }
    });

    it("logs, rather than throws, when leaving a room fails", async () => {
      const error = new Error("Mocked error");
      const logged = vi.spyOn(internals.logger, "error");

      notifyUser.mockImplementation(() => {
        throw error;
      });

      await hotelClerk.removeConnection(connectionId);

      expect(logged).toHaveBeenCalledWith(error);
    });
  });

  describe("#subscribe", () => {
    it("is what the subscribe event calls", () => {
      const subscribe = vi
        .spyOn(hotelClerk, "subscribe")
        .mockResolvedValue({ channel: "channel", roomId: "roomId" });

      invokeAsk("core:realtime:subscribe", "foo");

      expect(subscribe).toHaveBeenCalledWith("foo");
    });

    it("starts with no room and no subscription", () => {
      expect(internals.rooms.size).toBe(0);
      expect(internals.subscriptions.size).toBe(0);
      expect(internals.roomsCount).toBe(0);
    });

    it("registers a room, its channel and the connection's volatile data", async () => {
      const request = subscribeRequest();

      /*
       * `request.context` is the public getter over the private
       * `context` + U+200B field the Mocha spec assigned through directly —
       * U+200B is a zero-width space KuzzleRequest uses so its internals do
       * not show up in a `console.log`, not a typo.
       */
      request.context.user = { _id: "Umraniye" } as never;
      request.input.args.propagate = false;

      koncorde.normalize
        .mockReturnValueOnce({ filter: [], id: "foobar", index: "foo/bar" })
        .mockReturnValueOnce({ filter: [], id: "barfoo", index: "foo/bar" });

      const first = await hotelClerk.subscribe(request);
      present(first, "subscribe result");

      expect(koncorde.normalize).toHaveBeenCalledTimes(1);
      expect(koncorde.store).toHaveBeenCalledTimes(1);
      expect(first.roomId).toBe("foobar");
      expect(first).toHaveProperty("channel");
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        "foobar",
        request,
        "in",
        expect.objectContaining({ count: 1 }),
      );

      const room = internals.rooms.get(first.roomId);
      present(room, "room first.roomId");
      const channels = [...room.channels.keys()];

      expect(channels).toHaveLength(1);
      expect(room.channels.get(channels[0])).toMatchObject({
        scope: "all",
        users: "none",
      });
      const connectionRooms = internals.subscriptions.get(connectionId);

      present(connectionRooms, `subscriptions for ${connectionId}`);
      expect(connectionRooms.getVolatile(room.id)).toEqual(
        request.input.volatile,
      );

      const second = await hotelClerk.subscribe(request);
      present(second, "subscribe result");

      expect(koncorde.normalize).toHaveBeenCalledTimes(2);
      expect(koncorde.store).toHaveBeenCalledTimes(2);
      expect(second.roomId).toBe("barfoo");
      expect(internals.roomsCount).toBe(2);
      expect(call).toHaveBeenCalledWith(
        "core:realtime:room:create:after",
        expect.objectContaining({ id: "foobar", index: "foo/bar" }),
      );
      expect(emit).toHaveBeenCalledWith(
        "core:realtime:user:subscribe:after",
        expect.objectContaining({
          collection: "bar",
          connectionId,
          filters: request.input.body,
          index: "foo",
          roomId: "foobar",
        }),
      );
    });

    it("answers the same room when the filter is already subscribed", async () => {
      const request = subscribeRequest();
      const first = await hotelClerk.subscribe(request);
      present(first, "subscribe result");

      expect(internals.roomsCount).toBe(1);

      const second = await hotelClerk.subscribe(request);
      present(second, "subscribe result");

      expect(second).toMatchObject(first);
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        second.roomId,
        request,
        "in",
        expect.objectContaining({ count: 1 }),
      );
    });

    it("rejects when Koncorde refuses the filter", async () => {
      koncorde.normalize.mockImplementation(() => {
        throw new Error("test");
      });

      await expect(hotelClerk.subscribe(subscribeRequest())).rejects.toThrow(
        "test",
      );
    });

    it.each(["index", "collection"] as const)(
      "rejects a request with no %s",
      async (argument) => {
        const request = subscribeRequest();
        request.input.args[argument] = null;

        const rejection = hotelClerk.subscribe(request);

        await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
        await expect(rejection).rejects.toMatchObject({
          id: "api.assert.missing_argument",
        });
      },
    );

    it("accepts an empty filter", async () => {
      const request = subscribeRequest({});
      const result = await hotelClerk.subscribe(request);
      present(result, "subscribe result");

      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        result.roomId,
        request,
        "in",
        expect.objectContaining({ count: 1 }),
      );
    });

    it.each([
      ["scope", "core.realtime.invalid_scope"],
      ["users", "core.realtime.invalid_users"],
    ] as const)("rejects an invalid %s argument", async (argument, id) => {
      const request = subscribeRequest();
      request.input.args[argument] = "foo";

      const rejection = hotelClerk.subscribe(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({ id });
    });

    it("refuses to go past the room limit", async () => {
      internals.roomsCount = global.kuzzle.config.limits.subscriptionRooms;

      const rejection = hotelClerk.subscribe(subscribeRequest());

      await expect(rejection).rejects.toBeInstanceOf(SizeLimitError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.realtime.too_many_rooms",
      });
    });

    it("treats a room limit of 0 as no limit", async () => {
      global.kuzzle.config.limits.subscriptionRooms = 0;
      internals.roomsCount = Number.MAX_SAFE_INTEGER - 1;

      await expect(
        hotelClerk.subscribe(subscribeRequest()),
      ).resolves.toBeDefined();
    });

    it("discards a request whose connection is gone", async () => {
      global.kuzzle.router.isConnectionAlive = () => false;
      const createRoom = vi.spyOn(internals, "createRoom");

      await hotelClerk.subscribe(subscribeRequest());

      expect(createRoom).not.toHaveBeenCalled();
    });
  });

  describe("#unsubscribe", () => {
    const roomId = "roomId";

    beforeEach(() => {
      internals.subscriptions.clear();
      internals.rooms.set(
        roomId,
        new Room(
          roomId,
          "index",
          "collection",
          new Map([
            ["ch1", new Channel(roomId, { propagate: true })],
            ["ch2", new Channel(roomId, { propagate: true })],
          ]),
          new Set([connectionId]),
        ),
      );
      internals.roomsCount = 1;
    });

    it("is what the unsubscribe event calls", () => {
      const unsubscribe = vi
        .spyOn(hotelClerk, "unsubscribe")
        .mockResolvedValue(undefined);

      invokeAsk("core:realtime:unsubscribe", "cnx", "room", "notify");

      expect(unsubscribe).toHaveBeenCalledWith("cnx", "room", "notify");
    });

    it("rejects a connection it does not know", async () => {
      const rejection = hotelClerk.unsubscribe(connectionId, "idontexist");

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.realtime.not_subscribed",
      });
    });

    it("rejects a room the connection did not subscribe to", async () => {
      internals.subscriptions.set(connectionId, new ConnectionRooms());

      const rejection = hotelClerk.unsubscribe(connectionId, roomId);

      await expect(rejection).rejects.toBeInstanceOf(PreconditionError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.realtime.not_subscribed",
      });
      expect(internals.rooms.has(roomId)).toBe(true);
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).not.toHaveBeenCalled();
    });

    it("rejects a subscribed room that no longer exists", async () => {
      internals.subscriptions.set(
        connectionId,
        new ConnectionRooms(new Map<string, JSONObject>([["nowhere", {}]])),
      );

      const rejection = hotelClerk.unsubscribe(connectionId, "nowhere");

      await expect(rejection).rejects.toBeInstanceOf(NotFoundError);
      await expect(rejection).rejects.toMatchObject({
        id: "core.realtime.room_not_found",
      });
    });

    /*
     * `room:remove` is a deprecated pipe: a plugin listening on it must not be
     * able to keep a room alive by failing.
     */
    it("removes the room even when the deprecated room:remove pipe throws", async () => {
      global.kuzzle.tokenManager.getKuidFromConnection = () => "Umraniye";
      pipe.mockImplementation(async (event, payload) => {
        if (event === "room:remove") {
          throw new Error("plugin failed");
        }
        return payload;
      });
      internals.subscriptions.set(
        connectionId,
        new ConnectionRooms(new Map<string, JSONObject>([[roomId, {}]])),
      );

      await hotelClerk.unsubscribe(connectionId, roomId);

      expect(internals.roomsCount).toBe(0);
      expect(internals.rooms.size).toBe(0);
    });

    it("drops the connection entry once its last room is gone", async () => {
      global.kuzzle.tokenManager.getKuidFromConnection = () => "Umraniye";
      const removeRoom = vi.spyOn(internals, "removeRoom");

      internals.subscriptions.set(
        connectionId,
        new ConnectionRooms(new Map<string, JSONObject>([[roomId, {}]])),
      );

      await hotelClerk.unsubscribe(connectionId, roomId);

      expect(internals.subscriptions.size).toBe(0);
      expect(removeRoom).toHaveBeenCalledTimes(1);
      expect(removeRoom).toHaveBeenCalledWith(roomId);
      expect(internals.roomsCount).toBe(0);
      expect(internals.rooms.size).toBe(0);

      /* Notified even with nobody listening for cluster mode. */
      // `volatile: {}`, not `null`: the only writer is
      // `registerSubscription(…, request.input.volatile ?? {})`, so a stored
      // subscription always carries an object. The `null` this asserted came
      // from the fixture writing straight into `ConnectionRooms`, which is a
      // state the subject cannot produce.
      expect(notifyUser).toHaveBeenCalledWith(
        roomId,
        expect.objectContaining({
          input: expect.objectContaining({
            action: "unsubscribe",
            controller: "realtime",
            volatile: {},
          }),
        }),
        "out",
        expect.objectContaining({ count: 0 }),
      );
      expect(emit).toHaveBeenCalledWith(
        "core:realtime:user:unsubscribe:after",
        expect.objectContaining({
          room: { collection: "collection", id: roomId, index: "index" },
          subscription: expect.objectContaining({
            collection: "collection",
            connectionId,
            index: "index",
            kuid: "Umraniye",
            roomId,
          }),
        }),
      );
    });

    it("keeps the connection's other rooms", async () => {
      internals.subscriptions.set(
        connectionId,
        new ConnectionRooms(
          new Map<string, JSONObject>([
            [roomId, {}],
            ["anotherRoom", {}],
          ]),
        ),
      );
      internals.rooms.set("anotherRoom", {} as never);
      internals.roomsCount = 2;

      await hotelClerk.unsubscribe(connectionId, roomId);

      const remaining = internals.subscriptions.get(connectionId);

      present(remaining, `subscriptions for ${connectionId}`);
      // Same fixture correction as above: what a kept room carries is the
      // object it was registered with.
      expect(remaining.getVolatile("anotherRoom")).toEqual({});
      expect(internals.rooms.has(roomId)).toBe(false);
      expect(internals.rooms.has("anotherRoom")).toBe(true);
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        roomId,
        expect.anything(),
        "out",
        expect.objectContaining({ count: 0 }),
      );
    });

    it("keeps a room another connection still holds, and notifies it", async () => {
      internals.subscriptions.set(
        connectionId,
        new ConnectionRooms(new Map<string, JSONObject>([[roomId, {}]])),
      );
      internals.subscriptions.set(
        "foobar",
        new ConnectionRooms(new Map<string, JSONObject>([[roomId, {}]])),
      );
      const sharedRoom = internals.rooms.get(roomId);

      present(sharedRoom, `room ${roomId}`);
      connectionsOf(sharedRoom).add("foobar");

      await hotelClerk.unsubscribe(connectionId, roomId);

      const room = internals.rooms.get(roomId);
      present(room, "room roomId");

      expect(connectionsOf(room).size).toBe(1);
      expect(connectionsOf(room).has("foobar")).toBe(true);
      expect(connectionsOf(room).has(connectionId)).toBe(false);
      expect(internals.roomsCount).toBe(1);
      expect(notifyUser).toHaveBeenCalledWith(
        roomId,
        expect.any(KuzzleRequest),
        "out",
        expect.objectContaining({ count: 1 }),
      );
      expect(call).toHaveBeenCalledWith(
        "core:realtime:unsubscribe:after",
        roomId,
      );
    });
  });
});
