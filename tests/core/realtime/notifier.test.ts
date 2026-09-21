import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleRequest } from "../../../lib/api/request";
import actionEnum from "../../../lib/core/realtime/actionEnum";
import { Channel } from "../../../lib/core/realtime/channel";
import { ConnectionRooms } from "../../../lib/core/realtime/connectionRooms";
import { HotelClerk } from "../../../lib/core/realtime/hotelClerk";
/* Both ship `export =`, so a default import is the correct one (L1's trap). */
import DocumentNotification from "../../../lib/core/realtime/notification/document";
import UserNotification from "../../../lib/core/realtime/notification/user";
import Notifier from "../../../lib/core/realtime/notifier";
import { Room } from "../../../lib/core/realtime/room";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import type { RealtimeScope } from "../../../lib/types";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/*
 * One file for one subject, where Mocha had seven — `publish`,
 * `notifyDocumentCreate`, `notifyDocumentDelete`, `notifyDocumentReplace`,
 * `notifyDocumentUpdate`, `notifyDocuments` and `notifyMethods`. The reason is
 * the `tests/` mirror convention, which assigns `lib/core/realtime/notifier.ts`
 * its owning coverage report and cannot express seven specs for one file — see
 * L1b1 and L1b2 in the step file. The `describe` blocks are the former files.
 */

/**
 * `scope: "none"` is a value the subscribe validator accepts
 * (`Channel.SCOPE_ALLOWED_VALUES` is literally `USERS_ALLOWED_VALUES`) and the
 * dispatcher relies on — it is how a channel takes user events and no document
 * event — but `RealtimeScope` is `"in" | "out" | "all"`, so TypeScript refuses
 * it. Four of the six channels below need it. Cast here, once, with the
 * finding filed: type-debt register TD-74.
 */
const scopeNone = "none" as RealtimeScope;

const index = "index";
const collection = "collection";
const nodeId = "knode-test";

describe("#core/realtime/Notifier", () => {
  let notifier: Notifier;
  let hotelClerk: HotelClerk;
  /**
   * `rooms` and `subscriptions` are `private` on `HotelClerk`, and the
   * `notifyMethods` spec builds its whole world out of them. Named once, as in
   * `hotelClerk.test.ts`.
   */
  let clerk: {
    rooms: Map<string, Room>;
    subscriptions: Map<string, ConnectionRooms>;
  };
  let asked: Map<string, (...args: unknown[]) => unknown>;
  let ask: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof vi.fn>;
  let emit: ReturnType<typeof vi.fn>;
  let pipe: ReturnType<typeof vi.fn>;
  let koncorde: { test: ReturnType<typeof vi.fn> };
  /**
   * The plugin pipes registered for an event, in registration order.
   *
   * KuzzleMock ships a `registerPluginPipe` and a `pipe` that threads a
   * payload through what was registered; `_dispatch`'s contract is that each
   * of its three pipes sees the previous one's output, so a `pipe` that just
   * returns its argument cannot test it. This is that behaviour, stated in the
   * spec that needs it rather than inherited from a 600-line mock.
   */
  let plugins: Map<string, Array<(payload: unknown) => Promise<unknown>>>;

  const registerPipe = (
    event: string,
    handler: (payload: unknown) => Promise<unknown>,
  ) => {
    const handlers = plugins.get(event) ?? [];
    handlers.push(handler);
    plugins.set(event, handlers);
  };

  beforeEach(async () => {
    asked = new Map();
    plugins = new Map();
    ask = vi.fn(async () => undefined);
    dispatch = vi.fn();
    emit = vi.fn();
    koncorde = { test: vi.fn(() => []) };
    pipe = vi.fn(async (event: string, payload: unknown) => {
      let updated = payload;

      for (const handler of plugins.get(event) ?? []) {
        updated = await handler(updated);
      }

      return updated;
    });

    /*
     * What the subject reads off the global: one config limit, Koncorde's
     * `test`, the entry point's `dispatch`, and the four dispatchers. `id` is
     * here because every notification carries the node's name (K5 made it
     * `global.nodeId`).
     */
    stubKuzzle({
      ask,
      config: { limits: { subscriptionDocumentTTL: 1000 } },
      emit,
      entryPoint: { dispatch },
      id: nodeId,
      koncorde,
      onAsk: (event: string, handler: (...args: unknown[]) => unknown) => {
        asked.set(event, handler);
      },
      pipe,
    });

    hotelClerk = new HotelClerk({} as never);
    clerk = hotelClerk as unknown as typeof clerk;
    notifier = new Notifier({ hotelClerk } as never);

    await notifier.init();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /*
   * The Mocha specs asserted a registration by restoring KuzzleMock's `ask`
   * and firing the event through its own bus. Invoking the captured handler
   * asserts the one thing that matters: this event reaches this method, with
   * these arguments.
   */
  const invokeAsk = (event: string, ...args: unknown[]) => {
    const handler = asked.get(event);

    expect(handler, `no handler registered for ${event}`).toBeDefined();

    return handler(...args);
  };

  const documentRequest = (extra: Record<string, unknown> = {}) =>
    new KuzzleRequest({ collection, index, ...extra });

  describe("#init", () => {
    it("registers a handler for each of its ask events", () => {
      expect([...asked.keys()]).toEqual(
        expect.arrayContaining([
          "core:realtime:document:dispatch",
          "core:realtime:document:mNotify",
          "core:realtime:document:notify",
          "core:realtime:publish",
          "core:realtime:tokenExpired:notify",
          "core:realtime:user:sendMessage",
        ]),
      );
    });
  });

  describe("#publish", () => {
    let notifyDocument: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      notifyDocument = vi
        .spyOn(notifier, "notifyDocument")
        .mockResolvedValue(undefined);
    });

    it("is what the publish event calls", () => {
      const publish = vi
        .spyOn(notifier, "publish")
        .mockResolvedValue(undefined);

      invokeAsk("core:realtime:publish", "request");

      expect(publish).toHaveBeenCalledWith("request");
    });

    it("notifies the rooms the message matches", async () => {
      const rooms = ["foo"];
      const request = documentRequest({
        _id: "I am fabulous",
        action: "publish",
        body: { youAre: "fabulous too" },
        controller: "realtime",
        volatile: {},
      });

      koncorde.test.mockReturnValue(rooms);

      await notifier.publish(request);

      expect(notifyDocument).toHaveBeenCalledTimes(1);
      expect(notifyDocument).toHaveBeenCalledWith(
        rooms,
        request,
        "in",
        "publish",
        { _id: "I am fabulous", _source: { youAre: "fabulous too" } },
      );
    });
  });

  describe("#notifyDocumentCreate", () => {
    it("notifies the matched rooms and returns them", async () => {
      const rooms = ["bar", "baz"];
      const notifyDocument = vi
        .spyOn(notifier, "notifyDocument")
        .mockResolvedValue(undefined);
      const request = documentRequest();

      koncorde.test.mockReturnValue(rooms);

      const result = await notifier.notifyDocumentCreate(request, {
        _id: "foo",
        _source: { foo: "bar" },
      } as never);

      expect(koncorde.test).toHaveBeenCalledWith(
        { _id: "foo", foo: "bar" },
        "index/collection",
      );
      expect(notifyDocument).toHaveBeenCalledWith(
        rooms,
        request,
        "in",
        "create",
        expect.objectContaining({ _id: "foo", _source: { foo: "bar" } }),
      );
      expect(result).toEqual(rooms);
    });
  });

  describe("#notifyDocumentDelete", () => {
    it("notifies the matched rooms and returns none of them", async () => {
      const rooms = ["bar", "baz"];
      const notifyDocument = vi
        .spyOn(notifier, "notifyDocument")
        .mockResolvedValue(undefined);
      const request = documentRequest();

      koncorde.test.mockReturnValue(rooms);

      const result = await notifier.notifyDocumentDelete(request, {
        _id: "foo",
        _source: { foo: "bar" },
      } as never);

      expect(koncorde.test).toHaveBeenCalledWith(
        { _id: "foo", foo: "bar" },
        "index/collection",
      );
      expect(notifyDocument).toHaveBeenCalledWith(
        rooms,
        request,
        "out",
        "delete",
        expect.objectContaining({ _id: "foo", _source: { foo: "bar" } }),
      );
      /* A deleted document is in no room afterwards, whatever it matched. */
      expect(result).toEqual([]);
    });
  });

  describe("#notifyDocumentReplace", () => {
    const _id = "Sir Isaac Newton is the deadliest son-of-a-bitch in space";
    let notifyDocument: ReturnType<typeof vi.spyOn>;
    let request: KuzzleRequest;

    beforeEach(() => {
      notifyDocument = vi
        .spyOn(notifier, "notifyDocument")
        .mockResolvedValue(undefined);
      request = documentRequest({
        _id,
        body: {
          _kuzzle_info: { "can I has": "cheezburgers?" },
          foo: "bar",
        },
      });
    });

    it("notifies the rooms entered and the rooms left", async () => {
      koncorde.test.mockReturnValue(["foo"]);

      const result = await notifier.notifyDocumentReplace(
        request,
        { _id, _source: request.input.body } as never,
        JSON.stringify(["foo", "bar"]),
      );

      expect(notifyDocument).toHaveBeenCalledTimes(2);
      expect(notifyDocument).toHaveBeenNthCalledWith(
        1,
        ["foo"],
        request,
        "in",
        "replace",
        { _id, _source: request.input.body },
      );
      expect(notifyDocument).toHaveBeenNthCalledWith(
        2,
        ["bar"],
        request,
        "out",
        "replace",
        { _id, _source: request.input.body },
      );
      expect(result).toEqual(["foo"]);
    });

    it("returns no room when the replacement matches none", async () => {
      koncorde.test.mockReturnValue([]);

      expect(
        await notifier.notifyDocumentReplace(
          request,
          { _id, _source: request.input.body } as never,
          JSON.stringify(["foo", "bar"]),
        ),
      ).toEqual([]);
    });
  });

  describe("#notifyDocumentUpdate", () => {
    const _id = "Sir Isaac Newton is the deadliest son-of-a-bitch in space";
    let notifyDocument: ReturnType<typeof vi.spyOn>;
    let request: KuzzleRequest;

    beforeEach(() => {
      notifyDocument = vi
        .spyOn(notifier, "notifyDocument")
        .mockResolvedValue(undefined);
      request = documentRequest({
        _id,
        action: "update",
        body: { _kuzzle_info: { canIhas: "cheezburgers?" }, foo: "bar" },
        collection: "bar",
        controller: "document",
        index: "foo",
      });
    });

    it("notifies the rooms entered and the rooms left", async () => {
      koncorde.test.mockReturnValue(["foo"]);

      const change = {
        _id,
        _source: { foo: "bar" },
        _updatedFields: ["foo"],
      };
      const result = await notifier.notifyDocumentUpdate(
        request,
        change as never,
        JSON.stringify(["foo", "bar"]),
      );

      expect(koncorde.test).toHaveBeenCalledTimes(1);
      expect(koncorde.test).toHaveBeenCalledWith(
        { _id, foo: "bar" },
        "foo/bar",
      );
      expect(notifyDocument).toHaveBeenCalledTimes(2);
      expect(notifyDocument).toHaveBeenNthCalledWith(
        1,
        ["foo"],
        request,
        "in",
        "update",
        change,
      );
      expect(notifyDocument).toHaveBeenNthCalledWith(
        2,
        ["bar"],
        request,
        "out",
        "update",
        change,
      );
      expect(result).toEqual(["foo"]);
    });

    it("returns no room when the update matches none", async () => {
      koncorde.test.mockReturnValue([]);

      expect(
        await notifier.notifyDocumentUpdate(
          request,
          { _id, _source: { foo: "bar" } } as never,
          JSON.stringify(["foo", "bar"]),
        ),
      ).toEqual([]);
    });
  });

  describe("#notifyDocuments", () => {
    const ttl = 1000;
    const key = (id: string) => `{notif/${index}/${collection}}/${id}`;

    let request: KuzzleRequest;

    beforeEach(() => {
      request = documentRequest();
    });

    /** The `ask` calls made for one cache event, in order. */
    const cacheCalls = (event: string) =>
      ask.mock.calls.filter(([name]) => name === event);

    it("is what the document:notify event calls, for one document", () => {
      const notify = vi
        .spyOn(notifier, "notifyDocuments")
        .mockResolvedValue(undefined);

      invokeAsk("core:realtime:document:notify", "req", "action", "doc");

      expect(notify).toHaveBeenCalledWith("req", "action", ["doc"]);
    });

    it("is what the document:mNotify event calls, for many", () => {
      const notify = vi
        .spyOn(notifier, "notifyDocuments")
        .mockResolvedValue(undefined);

      invokeAsk("core:realtime:document:mNotify", "req", "action", "doc");

      expect(notify).toHaveBeenCalledWith("req", "action", "doc");
    });

    describe("cache management", () => {
      let notifyDocumentCreate: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        notifyDocumentCreate = vi
          .spyOn(notifier, "notifyDocumentCreate")
          .mockResolvedValue([]);
      });

      it("stores each document's rooms, with the configured TTL", async () => {
        const rooms = ["foo", "bar"];
        notifyDocumentCreate.mockResolvedValue(rooms);

        await notifier.notifyDocuments(request, actionEnum.CREATE, [
          { _id: "foo" },
          { _id: "bar" },
          { _id: "baz" },
        ] as never);

        expect(cacheCalls("core:cache:internal:mget")).toHaveLength(0);
        expect(cacheCalls("core:cache:internal:del")).toHaveLength(0);
        expect(cacheCalls("core:cache:internal:store")).toHaveLength(3);

        for (const id of ["foo", "bar", "baz"]) {
          expect(ask).toHaveBeenCalledWith(
            "core:cache:internal:store",
            key(id),
            JSON.stringify(rooms),
            { ttl },
          );
        }
      });

      /*
       * The Mocha spec claimed this stored "forever (TTL = 0)" by asserting
       * the THREE-argument form — and sinon's `calledWith` matches a prefix,
       * so it passed against the four-argument call the subject really makes.
       * It never tested anything. `{ ttl: 0 }` is always passed, and
       * "forever" is decided one layer down: `Redis.store` appends `PX` only
       * when `ttl > 0`.
       */
      it("still passes a TTL of 0, which the cache reads as no expiry", async () => {
        (notifier as unknown as { ttl: number }).ttl = 0;

        const rooms = ["foo", "bar"];
        notifyDocumentCreate.mockResolvedValue(rooms);

        await notifier.notifyDocuments(request, actionEnum.CREATE, [
          { _id: "foo" },
          { _id: "bar" },
          { _id: "baz" },
        ] as never);

        expect(cacheCalls("core:cache:internal:store")).toHaveLength(3);

        for (const id of ["foo", "bar", "baz"]) {
          expect(ask).toHaveBeenCalledWith(
            "core:cache:internal:store",
            key(id),
            JSON.stringify(rooms),
            { ttl: 0 },
          );
        }
      });

      it("deletes the key of a document that matches no room", async () => {
        notifyDocumentCreate
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(["foo", "bar"])
          .mockResolvedValueOnce([]);

        await notifier.notifyDocuments(request, actionEnum.CREATE, [
          { _id: "foo" },
          { _id: "bar" },
          { _id: "baz" },
        ] as never);

        expect(cacheCalls("core:cache:internal:mget")).toHaveLength(0);
        expect(cacheCalls("core:cache:internal:store")).toHaveLength(1);
        expect(ask).toHaveBeenCalledWith(
          "core:cache:internal:store",
          key("bar"),
          JSON.stringify(["foo", "bar"]),
          { ttl },
        );
        expect(cacheCalls("core:cache:internal:del")).toHaveLength(1);
        expect(ask).toHaveBeenCalledWith("core:cache:internal:del", [
          key("foo"),
          key("baz"),
        ]);
      });
    });

    describe("dispatch per action", () => {
      const document = { _id: "foo", _source: "bar" };

      it.each([
        ["create", actionEnum.CREATE, "notifyDocumentCreate"],
        ["delete", actionEnum.DELETE, "notifyDocumentDelete"],
      ] as const)(
        "routes a %s to its notifier",
        async (_name, action, method) => {
          const spy = vi.spyOn(notifier, method).mockResolvedValue([] as never);

          await notifier.notifyDocuments(request, action, [
            document,
            document,
            document,
          ] as never);

          expect(spy).toHaveBeenCalledTimes(3);
          for (const call of spy.mock.calls) {
            expect(call).toEqual([request, document]);
          }
          /* Neither action reads the cache: there is no previous state to diff. */
          expect(cacheCalls("core:cache:internal:mget")).toHaveLength(0);
        },
      );

      it.each([
        ["update", actionEnum.UPDATE, "notifyDocumentUpdate"],
        ["replace", actionEnum.REPLACE, "notifyDocumentReplace"],
      ] as const)(
        "hands a %s each document's cached rooms",
        async (_name, action, method) => {
          const cached = ["foo", "bar", "baz"];
          ask.mockImplementation(async (event: string) =>
            event === "core:cache:internal:mget" ? cached : undefined,
          );
          const spy = vi.spyOn(notifier, method).mockResolvedValue([] as never);

          await notifier.notifyDocuments(request, action, [
            { _id: "foo" },
            { _id: "bar" },
            { _id: "baz" },
          ] as never);

          expect(spy).toHaveBeenCalledTimes(3);
          expect(spy).toHaveBeenNthCalledWith(
            1,
            request,
            { _id: "foo" },
            "foo",
          );
          expect(spy).toHaveBeenNthCalledWith(
            2,
            request,
            { _id: "bar" },
            "bar",
          );
          expect(spy).toHaveBeenNthCalledWith(
            3,
            request,
            { _id: "baz" },
            "baz",
          );
          expect(ask).toHaveBeenCalledWith("core:cache:internal:mget", [
            key("foo"),
            key("bar"),
            key("baz"),
          ]);
        },
      );

      it.each([
        ["write", actionEnum.WRITE, "notifyDocumentReplace"],
        ["upsert", actionEnum.UPSERT, "notifyDocumentUpdate"],
      ] as const)(
        "splits a %s between created and existing documents",
        async (_name, action, method) => {
          ask.mockImplementation(async (event: string) =>
            event === "core:cache:internal:mget"
              ? [undefined, "bar", undefined]
              : undefined,
          );
          const create = vi
            .spyOn(notifier, "notifyDocumentCreate")
            .mockResolvedValue([]);
          const existing = vi
            .spyOn(notifier, method)
            .mockResolvedValue([] as never);

          const docs = [
            { _id: "foo", created: true },
            { _id: "bar", created: false, _updatedFields: ["toto"] },
            { _id: "baz", created: true },
          ];

          await notifier.notifyDocuments(request, action, docs as never);

          expect(create).toHaveBeenCalledTimes(2);
          expect(create).toHaveBeenNthCalledWith(1, request, docs[0]);
          expect(create).toHaveBeenNthCalledWith(2, request, docs[2]);
          expect(existing).toHaveBeenCalledTimes(1);
          expect(existing).toHaveBeenCalledWith(request, docs[1], "bar");
          expect(ask).toHaveBeenCalledWith("core:cache:internal:mget", [
            key("foo"),
            key("bar"),
            key("baz"),
          ]);
        },
      );

      it.each([
        ["write", actionEnum.WRITE, "notifyDocumentReplace"],
        ["upsert", actionEnum.UPSERT, "notifyDocumentUpdate"],
      ] as const)(
        "reads no cache for a %s where every document is new",
        async (_name, action, method) => {
          const create = vi
            .spyOn(notifier, "notifyDocumentCreate")
            .mockResolvedValue([]);
          const existing = vi
            .spyOn(notifier, method)
            .mockResolvedValue([] as never);

          const docs = [
            { _id: "foo", created: true },
            { _id: "bar", created: true },
            { _id: "baz", created: true },
          ];

          await notifier.notifyDocuments(request, action, docs as never);

          expect(create).toHaveBeenCalledTimes(3);
          expect(existing).not.toHaveBeenCalled();
          expect(cacheCalls("core:cache:internal:mget")).toHaveLength(0);
        },
      );

      it("rejects an action it does not know", async () => {
        const rejection = notifier.notifyDocuments(
          request,
          "ohnoes" as never,
          [document] as never,
        );

        await expect(rejection).rejects.toBeInstanceOf(InternalError);
        await expect(rejection).rejects.toMatchObject({
          id: "core.fatal.assertion_failed",
        });
      });
    });
  });

  describe("notify methods", () => {
    let request: KuzzleRequest;

    beforeEach(() => {
      vi.spyOn(hotelClerk, "removeConnection").mockResolvedValue(undefined);

      request = new KuzzleRequest(
        {
          action: "action",
          collection,
          controller: "controller",
          index,
          volatile: { foo: "bar" },
        },
        { protocol: "protocol" },
      );

      /*
       * Four rooms whose channels cover every scope/users/propagate
       * combination the dispatcher filters on. This is the fixture the
       * `notifyMethods` spec is *about*, which is why it stays explicit.
       */
      clerk.rooms.set(
        "matchingSome",
        new Room(
          "matchingSome",
          index,
          collection,
          new Map([
            [
              "matching_all",
              new Channel("matchingSome", {
                propagate: true,
                scope: "all",
                users: "all",
              }),
            ],
            [
              "matching_in",
              new Channel("matchingSome", {
                propagate: true,
                scope: "in",
                users: "none",
              }),
            ],
            [
              "matching_out",
              new Channel("matchingSome", {
                propagate: true,
                scope: "out",
                users: "none",
              }),
            ],
            [
              "matching_none",
              new Channel("matchingSome", {
                propagate: true,
                scope: scopeNone,
                users: "none",
              }),
            ],
            [
              "matching_userIn",
              new Channel("matchingSome", {
                propagate: true,
                scope: scopeNone,
                users: "in",
              }),
            ],
            [
              "matching_userOut",
              new Channel("matchingSome", {
                propagate: true,
                scope: scopeNone,
                users: "out",
              }),
            ],
          ]),
        ),
      );
      clerk.rooms.set(
        "nonMatching",
        new Room(
          "nonMatching",
          index,
          collection,
          new Map([
            [
              "foobar",
              new Channel("nonMatching", { propagate: true, scope: scopeNone }),
            ],
          ]),
        ),
      );
      clerk.rooms.set(
        "cluster",
        new Room(
          "cluster",
          index,
          collection,
          new Map([
            [
              "clusterOn",
              new Channel("cluster", {
                propagate: true,
                scope: "all",
                users: "all",
              }),
            ],
            [
              "clusterOff",
              new Channel("cluster", {
                propagate: false,
                scope: "all",
                users: "all",
              }),
            ],
          ]),
        ),
      );
      clerk.rooms.set(
        "alwaysMatching",
        new Room(
          "alwaysMatching",
          index,
          collection,
          new Map([
            [
              "always",
              new Channel("alwaysMatching", { propagate: true, scope: "all" }),
            ],
          ]),
        ),
      );
    });

    /** Every room above, plus one that does not exist. */
    const everyRoom = [
      "matchingSome",
      "nonMatching",
      "alwaysMatching",
      "IAMERROR",
      "cluster",
    ];

    describe("#notifyDocument", () => {
      it("does nothing when there is no room to notify", async () => {
        const low = vi
          .spyOn(notifier, "_notifyDocument")
          .mockResolvedValue(undefined);

        await notifier.notifyDocument([], request, "out", "action", {});

        expect(low).not.toHaveBeenCalled();
        expect(emit).not.toHaveBeenCalled();
      });

      it("dispatches locally and emits the cluster sync event", async () => {
        const low = vi
          .spyOn(notifier, "_notifyDocument")
          .mockResolvedValue(undefined);
        const content = { some: "content" };

        await notifier.notifyDocument(
          everyRoom,
          request,
          "out",
          "update",
          content,
        );

        const expected = DocumentNotification.fromRequest(
          request,
          "out",
          "update",
          content,
        );

        expect(low).toHaveBeenCalledWith(everyRoom, expected, {
          fromCluster: false,
        });
        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenCalledWith("core:notify:document", {
          notification: expected,
          rooms: everyRoom,
        });
      });
    });

    describe("#_notifyDocument", () => {
      const content = { some: "content" };

      const notificationFor = (scope: RealtimeScope, action: string) =>
        DocumentNotification.fromRequest(request, scope, action, content);

      it("does nothing when the room list is empty", async () => {
        await notifier._notifyDocument([], notificationFor("out", "update"), {
          fromCluster: false,
        });

        expect(dispatch).not.toHaveBeenCalled();
        expect(emit).not.toHaveBeenCalled();
      });

      it("broadcasts to the channels whose scope matches, called locally", async () => {
        await notifier._notifyDocument(
          everyRoom,
          notificationFor("out", "update"),
          { fromCluster: false },
        );

        expect(dispatch).toHaveBeenCalledTimes(1);

        const [action, payload] = dispatch.mock.calls[0];

        expect(action).toBe("broadcast");
        expect(payload.channels).toEqual([
          "matching_all",
          "matching_out",
          "always",
          "clusterOn",
          "clusterOff",
        ]);
        expect(payload.payload).toBeInstanceOf(DocumentNotification);
        expect(payload.payload).toMatchObject({
          action: "update",
          collection,
          controller: "controller",
          event: "write",
          index,
          node: nodeId,
          protocol: "protocol",
          requestId: request.id,
          result: content,
          scope: "out",
          status: 200,
          timestamp: request.timestamp,
          type: "document",
          volatile: request.input.volatile,
        });

        const events = pipe.mock.calls.map(([event]) => event);

        expect(events).toEqual([
          "notify:document",
          "notify:dispatch",
          "core:realtime:notification:dispatch:before",
        ]);
        expect(pipe.mock.calls[2][1]).toMatchObject({
          channels: payload.channels,
          notification: payload.payload,
        });
      });

      it("omits the non-propagating channels when called from the cluster", async () => {
        await notifier._notifyDocument(
          everyRoom,
          notificationFor("out", "create"),
        );

        expect(dispatch.mock.calls[0][1].channels).toEqual([
          "matching_all",
          "matching_out",
          "always",
          "clusterOn",
        ]);
      });

      it("does not dispatch when no channel matches the scope", async () => {
        await notifier.notifyDocument(
          ["nonMatching", "IAMERROR"],
          request,
          "not a scope" as RealtimeScope,
          "create",
          content,
        );

        expect(dispatch).not.toHaveBeenCalled();
      });
    });

    describe("#notifyUser", () => {
      it("ignores a room that does not exist", async () => {
        await notifier.notifyUser("IAMERROR", request, "all", {});

        expect(dispatch).not.toHaveBeenCalled();
      });

      it("does nothing when no channel matches", async () => {
        await notifier.notifyUser("nonMatching", request, "all", {});

        expect(dispatch).not.toHaveBeenCalled();
      });

      it("broadcasts to the channels whose users filter matches", async () => {
        const content = { some: "content" };

        await notifier.notifyUser("matchingSome", request, "out", content);

        expect(dispatch).toHaveBeenCalledTimes(1);

        const [action, payload] = dispatch.mock.calls[0];

        expect(action).toBe("broadcast");
        expect(payload.channels).toEqual(["matching_all", "matching_userOut"]);
        expect(payload.payload).toBeInstanceOf(UserNotification);
        expect(payload.payload).toMatchObject({
          action: "action",
          collection,
          controller: "controller",
          index,
          node: nodeId,
          protocol: "protocol",
          result: content,
          status: 200,
          timestamp: request.timestamp,
          type: "user",
          user: "out",
          volatile: request.input.volatile,
        });
        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenCalledWith("core:notify:user", {
          notification: payload.payload,
          room: "matchingSome",
        });
        expect(pipe.mock.calls.map(([event]) => event)).toEqual([
          "notify:user",
          "notify:dispatch",
          "core:realtime:notification:dispatch:before",
        ]);
      });
    });

    describe("#notifyTokenExpired", () => {
      it("is what the tokenExpired event calls", () => {
        const notify = vi
          .spyOn(notifier, "notifyTokenExpired")
          .mockResolvedValue(undefined);

        invokeAsk("core:realtime:tokenExpired:notify", "connectionId");

        expect(notify).toHaveBeenCalledWith("connectionId");
      });

      it("notifies the connection on the server channel", async () => {
        clerk.subscriptions.set(
          "foobar",
          new ConnectionRooms(
            new Map([
              ["nonMatching", null],
              ["alwaysMatching", null],
            ]),
          ),
        );

        await notifier.notifyTokenExpired("foobar");

        expect(dispatch).toHaveBeenCalledTimes(1);

        const [action, payload] = dispatch.mock.calls[0];

        expect(action).toBe("notify");
        expect(payload.connectionId).toBe("foobar");
        expect(payload.channels).toEqual(["kuzzle:notification:server"]);
        expect(payload.payload).toMatchObject({
          info: "This is an automated server notification",
          message: "Authentication Token Expired",
          status: 200,
          type: "TokenExpired",
        });
        expect(pipe.mock.calls.map(([event]) => event)).toEqual([
          "notify:server",
          "notify:dispatch",
          "core:realtime:notification:dispatch:before",
        ]);
        expect(pipe).toHaveBeenCalledWith(
          "core:realtime:notification:dispatch:before",
          {
            channels: ["kuzzle:notification:server"],
            connectionId: "foobar",
            notification: payload.payload,
          },
        );
      });
    });

    describe("#_dispatch", () => {
      it("notifies one connection when it is given a connection id", async () => {
        await notifier._dispatch(
          "my-event",
          ["channel-foo"],
          { foo: "bar" },
          "connectionId",
        );

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith("notify", {
          channels: ["channel-foo"],
          connectionId: "connectionId",
          payload: { foo: "bar" },
        });
      });

      it("broadcasts when it is not", async () => {
        await notifier._dispatch("my-event", ["channel-foo"], { foo: "bar" });

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith("broadcast", {
          channels: ["channel-foo"],
          connectionId: undefined,
          payload: { foo: "bar" },
        });
      });

      it("threads the payload through all three pipes, in order", async () => {
        registerPipe("my-event", async (payload) => ({
          ...(payload as object),
          bar: "baz",
        }));
        registerPipe("notify:dispatch", async (payload) => ({
          ...(payload as object),
          baz: "alpha",
        }));
        registerPipe(
          "core:realtime:notification:dispatch:before",
          async (context) => ({
            channels: ["channel-bar"],
            connectionId: undefined,
            notification: {
              ...(context as { notification: object }).notification,
              alpha: "beta",
            },
          }),
        );

        await notifier._dispatch(
          "my-event",
          ["channel-foo"],
          { foo: "bar" },
          "foobar",
        );

        expect(pipe).toHaveBeenCalledWith("my-event", { foo: "bar" });
        expect(pipe).toHaveBeenCalledWith("notify:dispatch", {
          bar: "baz",
          foo: "bar",
        });
        expect(pipe).toHaveBeenCalledWith(
          "core:realtime:notification:dispatch:before",
          {
            channels: ["channel-foo"],
            connectionId: "foobar",
            notification: { bar: "baz", baz: "alpha", foo: "bar" },
          },
        );
        /*
         * The last pipe replaced the channels AND cleared the connection id,
         * so the dispatch becomes a broadcast on the channel it named.
         */
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith("broadcast", {
          channels: ["channel-bar"],
          connectionId: undefined,
          payload: { alpha: "beta", bar: "baz", baz: "alpha", foo: "bar" },
        });
      });

      /*
       * Not covered by the Mocha spec: `_dispatch` swallows every error into
       * the logger, which is why a plugin pipe cannot break a notification.
       */
      it("logs, rather than throws, when a pipe fails", async () => {
        const error = new Error("plugin failed");
        const logged = vi.spyOn(notifier.logger, "error");

        registerPipe("my-event", async () => {
          throw error;
        });

        await notifier._dispatch("my-event", ["channel-foo"], { foo: "bar" });

        expect(logged).toHaveBeenCalledWith(error);
        expect(dispatch).not.toHaveBeenCalled();
      });
    });
  });
});
