import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NativeController } from "../../../lib/api/controllers/baseController";
import RealtimeController from "../../../lib/api/controllers/realtimeController";
import { KuzzleRequest } from "../../../lib/api/request";
import { BadRequestError } from "../../../lib/kerror/errors/badRequestError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/controllers/RealtimeController", () => {
  let controller: RealtimeController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let validate: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;

  beforeEach(() => {
    answers = {};
    ask = vi.fn(async (event: string) => answers[event]);
    /* `validate` answers the request it was handed — `publish` writes the
     * message metadata onto what it returns. */
    validate = vi.fn(async (validated: KuzzleRequest) => validated);

    stubKuzzle({
      ask,
      pipe: async () => undefined,
      validation: { validate },
    });

    controller = new RealtimeController();
    request = new KuzzleRequest(
      {
        index: "test",
        collection: "collection",
        controller: "realtime",
        body: {},
      },
      {
        connection: { id: "connectionId" },
        user: { _id: "42" },
      },
    );
  });

  afterEach(() => {
    restoreKuzzle();
  });

  /** The request handed to an ask event, as the controller forwarded it. */
  const forwarded = (event: string, call = 0) =>
    ask.mock.calls.filter(([name]) => name === event)[call];

  it("should inherit the base constructor", () => {
    expect(controller).toBeInstanceOf(NativeController);
  });

  describe("#subscribe", () => {
    /*
     * ⚠️ The Mocha spec's three assertion tests here were written without
     * `return` in front of `should(...).rejectedWith(...)` — unlike the ones
     * under #join, #unsubscribe and #count, which have it. They asserted
     * nothing.
     */
    it("should reject if no index is provided", async () => {
      request.input.args.index = null;

      const rejection = controller.subscribe(request);

      await expect(rejection).rejects.toBeInstanceOf(BadRequestError);
      await expect(rejection).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if no collection is provided", async () => {
      request.input.args.collection = null;

      await expect(controller.subscribe(request)).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await expect(controller.subscribe(request)).rejects.toMatchObject({
        id: "api.assert.body_required",
      });
    });

    it("should ask for the proper realtime event", async () => {
      answers["core:realtime:subscribe"] = { roomId: "foo", channel: "bar" };

      await expect(controller.subscribe(request)).resolves.toMatchObject({
        roomId: "foo",
        channel: "bar",
      });

      expect(forwarded("core:realtime:subscribe")).toBeDefined();
      expect(request.input.args.propagate).toBe(true);
    });

    it("should honour the propagate flag only on the funnel protocol", async () => {
      request.context.connection.protocol = "funnel";
      request.input.args.propagate = false;
      await controller.subscribe(request);
      expect(
        (forwarded("core:realtime:subscribe", 0)?.[1] as KuzzleRequest).input
          .args.propagate,
      ).toBe(false);

      request.context.connection.protocol = "http";
      request.input.args.propagate = false;
      await controller.subscribe(request);
      expect(
        (forwarded("core:realtime:subscribe", 1)?.[1] as KuzzleRequest).input
          .args.propagate,
      ).toBe(true);
    });

    it("should return nothing if the subscription is not performed", async () => {
      answers["core:realtime:subscribe"] = null;

      await expect(controller.subscribe(request)).resolves.toBeNull();
    });
  });

  describe("#join", () => {
    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await expect(controller.join(request)).rejects.toMatchObject({
        id: "api.assert.body_required",
      });
    });

    it("should reject if no roomId is provided", async () => {
      await expect(controller.join(request)).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should ask for the correct event", async () => {
      answers["core:realtime:join"] = { roomId: "foo", channel: "bar" };
      (request.input.body as Record<string, unknown>).roomId = "foo";

      await expect(controller.join(request)).resolves.toMatchObject({
        roomId: "foo",
        channel: "bar",
      });
      expect(ask).toHaveBeenCalledWith("core:realtime:join", request);
    });
  });

  describe("#unsubscribe", () => {
    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await expect(controller.unsubscribe(request)).rejects.toMatchObject({
        id: "api.assert.body_required",
      });
    });

    it("should reject if no roomId is provided", async () => {
      await expect(controller.unsubscribe(request)).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should ask for the correct event", async () => {
      (request.input.body as Record<string, unknown>).roomId = "foo";

      await expect(controller.unsubscribe(request)).resolves.toMatchObject({
        roomId: "foo",
      });
      expect(ask).toHaveBeenCalledWith(
        "core:realtime:unsubscribe",
        "connectionId",
        "foo",
      );
    });
  });

  describe("#count", () => {
    it("should reject if no body is provided", async () => {
      request.input.body = null;

      await expect(controller.count(request)).rejects.toMatchObject({
        id: "api.assert.body_required",
      });
    });

    it("should reject if no roomId is provided", async () => {
      await expect(controller.count(request)).rejects.toMatchObject({
        id: "api.assert.missing_argument",
      });
    });

    it("should ask the cluster for the room's count", async () => {
      answers["cluster:realtime:room:count"] = 42;
      (request.input.body as Record<string, unknown>).roomId = "foo";

      await expect(controller.count(request)).resolves.toMatchObject({
        count: 42,
      });
      expect(ask).toHaveBeenCalledWith("cluster:realtime:room:count", "foo");
    });
  });

  describe("#list", () => {
    it("should ask for the proper realtime event", async () => {
      await controller.list(request);

      expect(ask).toHaveBeenCalledWith(
        "core:realtime:list",
        request.context.user,
      );
    });
  });

  describe("#publish", () => {
    beforeEach(() => {
      request.input.args.index = "%test";
      request.input.args.collection = "test-collection";
    });

    it("should validate the message and answer a valid response", async () => {
      await expect(controller.publish(request)).resolves.toMatchObject({
        published: true,
      });

      expect(validate).toHaveBeenCalledOnce();
      expect(ask).toHaveBeenCalledWith("core:realtime:publish", request);
    });

    it("should add basic metadata to the body", async () => {
      await controller.publish(request);

      const published = forwarded(
        "core:realtime:publish",
      )?.[1] as KuzzleRequest;
      const metadata = (
        published.input.body as {
          _kuzzle_info: { author: string; createdAt: number };
        }
      )._kuzzle_info;

      expect(metadata.author).toBe("42");
      expect(metadata.createdAt).toBeCloseTo(Date.now(), -3);
    });

    it("should allow publishing with no user in context", async () => {
      request.context.user =
        invalid<KuzzleRequest["context"]["user"]>(undefined);

      await expect(controller.publish(request)).resolves.toMatchObject({
        published: true,
      });
      expect(validate).toHaveBeenCalledOnce();
    });
  });
});
