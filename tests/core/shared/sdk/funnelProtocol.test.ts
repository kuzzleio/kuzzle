import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KuzzleRequest } from "../../../../lib/api/request";
import { FunnelProtocol } from "../../../../lib/core/shared/sdk/funnelProtocol";
import { ForbiddenError } from "../../../../lib/kerror/errors/forbiddenError";
import { PluginImplementationError } from "../../../../lib/kerror/errors/pluginImplementationError";
import { User } from "../../../../lib/model/security/user";
import { settle } from "../../../helpers/settle";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";

describe("#core/shared/sdk/FunnelProtocol", () => {
  const request = { action: "bar", controller: "foo" };

  let funnelProtocol: FunnelProtocol;
  let executePluginRequest: ReturnType<typeof vi.fn>;
  let user: User;
  /**
   * The subject listens for `core:network:internal:message` and re-emits it to
   * its own SDK subscribers, so `on` and `emit` have to be a working pair —
   * a recorder cannot test a relay. Nine lines, in the spec that needs them.
   */
  let listeners: Map<string, Array<(payload: unknown) => void>>;

  const emit = (event: string, payload?: unknown) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  };

  beforeEach(() => {
    listeners = new Map();
    executePluginRequest = vi.fn(async () => "sdk result");
    user = new User();
    user._id = "gordon";

    stubKuzzle({
      /*
       * Three things: the funnel it forwards to, the two `ask` events it
       * resolves a connection id and a user from, and the event bus above.
       */
      ask: vi.fn(async (event: string) => {
        if (event === "core:network:internal:connectionId:get") {
          return "connection-id";
        }
        if (event === "core:security:user:get") {
          return user;
        }
        return undefined;
      }),
      emit,
      funnel: { executePluginRequest },
      on: (event: string, listener: (payload: unknown) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
    });

    funnelProtocol = new FunnelProtocol();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#constructor", () => {
    it("relays an internal network message to its SDK subscribers", () =>
      settle<void>((resolve, reject) => {
        const payload = { hello: "Gordon", room: "room-id" };

        /*
         * `on`'s parameter is typed as the SDK's known event names, and a room
         * id is not one of them — which is the whole mechanism here: the room
         * id *is* the event. Cast, because the type describes the other half
         * of the same method.
         */
        funnelProtocol.on("room-id" as never, (received: unknown) => {
          try {
            expect(received).toBe(payload);
            resolve();
          } catch (assertion) {
            reject(assertion);
          }
        });

        emit("core:network:internal:message", payload);
      }));

    it("subscribes to exactly one event", () => {
      expect([...listeners.keys()]).toEqual(["core:network:internal:message"]);
    });
  });

  describe("#query", () => {
    it("hands the funnel a request built from the payload", async () => {
      await funnelProtocol.query(request);

      expect(executePluginRequest).toHaveBeenCalledTimes(1);

      const sent = executePluginRequest.mock.calls[0][0];

      expect(sent).toBeInstanceOf(KuzzleRequest);
      expect(sent.input.controller).toBe("foo");
      expect(sent.input.action).toBe("bar");
      expect(sent.context.connection.protocol).toBe("funnel");
      expect(sent.context.connection.id).toBe("connection-id");
    });

    it("wraps the funnel's answer as a result", async () => {
      expect(await funnelProtocol.query(request)).toMatchObject({
        result: "sdk result",
      });
    });

    it("executes as the user named by __kuid__", async () => {
      user._id = "alyx";
      user.isActionAllowed = vi.fn(async () => true);
      executePluginRequest.mockImplementation(async (sent) => sent);

      const response = await funnelProtocol.query({
        ...request,
        __kuid__: "alyx",
      });

      expect(response.result.context.user._id).toBe("alyx");
    });

    it("refuses a user who may not execute the action", async () => {
      user._id = "leo";
      user.isActionAllowed = vi.fn(async () => false);
      executePluginRequest.mockImplementation(async (sent) => sent);

      const rejection = funnelProtocol.query({
        ...request,
        __checkRights__: true,
        __kuid__: "leo",
      });

      await expect(rejection).rejects.toBeInstanceOf(ForbiddenError);
      await expect(rejection).rejects.toMatchObject({
        id: "security.rights.forbidden",
      });
    });

    /*
     * Not covered by the Mocha spec, and the reason `__checkRights__` exists:
     * without it, a plugin executes as the user and the rights are NOT checked.
     */
    it("skips the rights check when __checkRights__ is not set", async () => {
      user._id = "leo";
      user.isActionAllowed = vi.fn(async () => false);
      executePluginRequest.mockImplementation(async (sent) => sent);

      await expect(
        funnelProtocol.query({ ...request, __kuid__: "leo" }),
      ).resolves.toBeDefined();
      expect(user.isActionAllowed).not.toHaveBeenCalled();
    });

    it("refuses a __kuid__ that is not a string", async () => {
      executePluginRequest.mockImplementation(async (sent) => sent);

      const rejection = funnelProtocol.query({ ...request, __kuid__: 1 });

      await expect(rejection).rejects.toBeInstanceOf(PluginImplementationError);
      await expect(rejection).rejects.toMatchObject({
        id: "plugin.context.invalid_user",
      });
    });
  });
});
