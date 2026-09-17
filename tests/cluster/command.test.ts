import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reply } from "zeromq";

import ClusterCommand from "../../lib/cluster/command";

/**
 * `command.js` reaches for `zeromq` through a CommonJS `require`, which vitest
 * cannot intercept: a `vi.mock("zeromq")` is silently ignored and the real
 * sockets are used anyway. So the peer is real here — a `Reply` socket this
 * spec binds when the remote node is supposed to answer, and nothing at all
 * otherwise, which is exactly how a dead node looks from the outside.
 */
const COMMAND_PORT = 24001;

describe("#cluster/ClusterCommand", () => {
  let command;
  let logger;
  let peer: Reply | null;

  beforeEach(() => {
    peer = null;

    logger = { child: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    logger.child.mockReturnValue(logger);

    (globalThis as { kuzzle?: unknown }).kuzzle = { log: logger };

    command = new ClusterCommand({
      config: {
        ports: { command: COMMAND_PORT },
        // Long enough not to race a loaded CI runner, short enough that a
        // spec waiting for a node that will never answer stays cheap.
        syncTimeout: 250,
      },
      ip: "127.0.0.1",
      nodeId: "knode-local",
      publisher: { lastMessageId: 12 },
    });
  });

  afterEach(() => {
    peer?.close();
  });

  describe("#getFullState", () => {
    it("tries the next node when one does not answer, and gives up after a full turn", async () => {
      const nodes = [
        { id: "knode-1", ip: "127.0.0.1" },
        { id: "knode-2", ip: "127.0.0.1" },
      ];

      const fullState = await command.getFullState(nodes);

      expect(fullState).toBeNull();
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn.mock.calls.map(([message]) => message).sort()).toEqual(
        [
          "Unable to fetch a full state from node knode-1 (no response received)",
          "Unable to fetch a full state from node knode-2 (no response received)",
        ],
      );
    });
  });

  describe("#_sendSingleHandshake", () => {
    it("returns the response the remote node sends back", async () => {
      const encoded = Buffer.from("handshake response");

      peer = new Reply();
      await peer.bind(`tcp://127.0.0.1:${COMMAND_PORT}`);

      const answering = peer.receive().then(([topic, payload]) => {
        expect(topic.toString()).toBe("handshake");
        expect(payload.toString()).toBe("handshake request");

        return peer.send(["handshake", encoded]);
      });

      const response = await command._sendSingleHandshake(
        "knode-1",
        "127.0.0.1",
        Buffer.from("handshake request"),
      );
      await answering;

      expect(Buffer.from(response).toString()).toBe(encoded.toString());
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("returns null when the remote node does not answer", async () => {
      const response = await command._sendSingleHandshake(
        "knode-1",
        "127.0.0.1",
        Buffer.from("handshake request"),
      );

      expect(response).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Couldn't complete handshake with node knode-1: no response received",
      );
    });
  });
});
