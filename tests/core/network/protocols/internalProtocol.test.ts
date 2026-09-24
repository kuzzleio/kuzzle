import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InternalProtocol from "../../../../lib/core/network/protocols/internalProtocol";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";
import { present } from "../../../helpers/present";

/*
 * The Mocha spec lived at `test/core/network/protocols/internal.test.js` while
 * the subject is `internalProtocol.ts`, so under the `tests/` mirror it would
 * have run, passed and counted for nothing — the same mis-filing L1b1 found on
 * `OpenApiManager`. Renamed to match the subject.
 */
describe("#core/network/protocols/InternalProtocol", () => {
  let protocol: InternalProtocol;
  let entryPoint: {
    config: { maxRequestSize: string };
    newConnection: ReturnType<typeof vi.fn>;
    removeConnection: ReturnType<typeof vi.fn>;
  };
  let asked: Map<string, (...args: unknown[]) => unknown>;
  let emit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    /*
     * The Mocha spec built a real `EntryPoint` and stubbed the two methods it
     * uses. The subject only ever calls those two, so they are the double —
     * constructing the real entry point made this spec depend on the entry
     * point's own config, which it never asserted anything about.
     */
    asked = new Map();
    emit = vi.fn();
    entryPoint = {
      /* `Protocol.init` derives its request-size cap from the entry point. */
      config: { maxRequestSize: "1mb" },
      newConnection: vi.fn(),
      removeConnection: vi.fn(),
    };

    stubKuzzle({
      emit,
      onAsk: (event: string, handler: (...args: unknown[]) => unknown) => {
        asked.set(event, handler);
      },
    });

    protocol = new InternalProtocol();
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#init", () => {
    it("registers its own connection with the entry point", async () => {
      await protocol.init(entryPoint as never);

      expect(entryPoint.newConnection).toHaveBeenCalledWith(
        protocol.connection,
      );
    });

    it("answers the connection id event, and only that one", async () => {
      await protocol.init(entryPoint as never);

      expect([...asked.keys()]).toEqual([
        "core:network:internal:connectionId:get",
      ]);
      /*
       * Not asserted by the Mocha spec, which checked the event's name only:
       * the handler has to hand back this protocol's connection id.
       */
      const connectionId = asked.get("core:network:internal:connectionId:get");

      present(
        connectionId,
        "handler for core:network:internal:connectionId:get",
      );
      expect(await connectionId()).toBe(protocol.connection.id);
    });
  });

  /*
   * `joinChannel`/`leaveChannel` take the connection id as a second argument
   * and the Mocha spec passed one (TS2554 x 4). This protocol has exactly one
   * connection, so its own id is what a caller would pass.
   */
  describe("#joinChannel", () => {
    it("adds the channel", () => {
      protocol.joinChannel("channel-id", protocol.connection.id);

      expect([...protocol.channels]).toEqual(["channel-id"]);
    });
  });

  describe("#leaveChannel", () => {
    it("removes only that channel", () => {
      protocol.joinChannel("channel-id1", protocol.connection.id);
      protocol.joinChannel("channel-id2", protocol.connection.id);

      protocol.leaveChannel("channel-id2", protocol.connection.id);

      expect([...protocol.channels]).toEqual(["channel-id1"]);
    });
  });

  describe("#broadcast and #notify", () => {
    const message = { channels: ["c1", "c2"], payload: { hello: "Gordon" } };

    it.each(["broadcast", "notify"] as const)(
      "%s sends the message",
      (method) => {
        const send = vi
          .spyOn(protocol as unknown as { _send: () => void }, "_send")
          .mockImplementation(() => {});

        protocol[method](message as never);

        expect(send).toHaveBeenCalledWith(message);
      },
    );
  });

  describe("#_send", () => {
    it("emits one message per channel, each tagged with its room", () => {
      protocol._send({
        channels: ["c1", "c2"],
        payload: { hello: "Gordon" },
      } as never);

      /*
       * The Mocha spec asserted `room: "c1"` TWICE — a copy-paste, so nothing
       * checked that the second channel was emitted at all, let alone under
       * its own room. Both are pinned, and the call count with them.
       */
      expect(emit).toHaveBeenCalledTimes(2);
      expect(emit).toHaveBeenCalledWith("core:network:internal:message", {
        hello: "Gordon",
        room: "c1",
      });
      expect(emit).toHaveBeenCalledWith("core:network:internal:message", {
        hello: "Gordon",
        room: "c2",
      });
    });
  });
});
