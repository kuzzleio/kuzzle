import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Mock } from "vitest";

import Long from "long";
import protobuf from "protobufjs";
import { Reply, Request } from "zeromq";

import ClusterCommand from "../../lib/cluster/command";
import type { Activity } from "../../lib/cluster/protobuf/commandMessages";
import type { SerializedRoomState } from "../../lib/cluster/state";
import { present } from "../helpers/present";

/**
 * `command.js` reaches for `zeromq` through a CommonJS `require`, which vitest
 * cannot intercept: a `vi.mock("zeromq")` is silently ignored and the real
 * sockets are used anyway. So the peers here are real — a `Reply` socket this
 * spec binds when the remote node is supposed to answer, a `Request` socket
 * when the spec plays the remote node against a real `ClusterCommand` server,
 * and nothing at all when a node is supposed to look dead.
 *
 * That is a deliberate choice rather than a limitation worked around: this
 * file *is* the cluster's request/response boundary, and a spec that replaced
 * the socket would assert the shape of a mock instead of the shape of the
 * protocol. Each test binds its own port so nothing shares state.
 */

/** Distinct per describe block: a lingering socket must not reach the next one. */
const PORT = {
  broadcastHandshake: 24005,
  fullStateClient: 24004,
  getFullState: 24001,
  retransmit: 24006,
  sendSingleHandshake: 24002,
  server: 24003,
};

/** The signature `command.ts` calls back into the node with. */
type AddNode = (
  id: string,
  ip: string,
  lastMessageId: Long,
) => Promise<boolean>;

/**
 * The `ClusterNode` surface `command.js` reaches into. Narrow on purpose: what
 * it touches is the whole of its coupling to the node, and a wider fake would
 * hide a widening.
 */
function fakeNode({
  addNode = vi.fn<AddNode>().mockResolvedValue(true),
  activity = [],
  hasNodeId = true,
  lastMessageId = 12,
  port,
  remoteNodes = new Map(),
  replay = vi.fn(() => null),
  rooms = [],
}: {
  addNode?: Mock<AddNode>;
  activity?: Activity[];
  /**
   * False plays a node whose handshake has not set its id yet: the real
   * `nodeId` getter throws then, and so does this fake's (#3031).
   */
  hasNodeId?: boolean;
  /**
   * Written as a plain number here because that is how a reader thinks about a
   * message counter, and converted below: what the node actually holds is a
   * `Long`, like `publisher.lastMessageId` and every `uint64` on the wire. The
   * fake used to hand over the number itself, which is the one shape the real
   * node never has.
   */
  lastMessageId?: number;
  port: number;
  remoteNodes?: Map<string, { lastMessageId: number }>;
  replay?: Mock<
    (from: Long, to: Long) => Array<{ topic: string; data: Uint8Array }> | null
  >;
  rooms?: SerializedRoomState[];
}) {
  return {
    activity,
    addNode,
    config: {
      ports: { command: port },
      // Long enough not to race a loaded CI runner, short enough that a spec
      // waiting for a node that will never answer stays cheap.
      syncTimeout: 250,
    },
    fullState: { serialize: () => ({ authStrategies: [], rooms }) },
    hasNodeId,
    ip: "127.0.0.1",
    get nodeId(): string {
      // `this`, not the parameter: a spec flips the flag to play the handshake.
      if (!this.hasNodeId) {
        throw new Error("[CLUSTER] No node id yet: the handshake has not run");
      }

      return "knode-local";
    },
    publisher: {
      lastMessageId: Long.fromNumber(lastMessageId, true),
      replay,
    },
    remoteNodes: new Map(
      Array.from(remoteNodes.entries(), ([id, { lastMessageId: id_ }]) => [
        id,
        { lastMessageId: Long.fromNumber(id_, true) },
      ]),
    ),
  };
}

describe("#cluster/ClusterCommand", () => {
  /**
   * The spec's own copy of the wire schema, loaded from the same `.proto` the
   * subject loads. Reading `command.protoroot` was the alternative, and it is a
   * private member: what these tests need is the *format*, which is a file, not
   * a field of the subject (step 13's L6 — change the test, not the
   * visibility).
   */
  let protoroot: protobuf.Root;

  beforeAll(async () => {
    protoroot = await protobuf.load(
      `${process.cwd()}/lib/cluster/protobuf/command.proto`,
    );
  });

  let command: ClusterCommand;
  let logger: {
    child: Mock;
    error: Mock;
    info: Mock;
    warn: Mock;
  };
  let peer: Reply | null;
  let client: Request | null;

  beforeEach(() => {
    peer = null;
    client = null;

    logger = { child: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    logger.child.mockReturnValue(logger);

    (globalThis as { kuzzle?: unknown }).kuzzle = { log: logger };

    command = new ClusterCommand(fakeNode({ port: PORT.getFullState }));
  });

  afterEach(async () => {
    peer?.close();
    client?.close();

    // `dispose()` is what stops `listen()`'s loop; without it the unresolved
    // `receive()` keeps the socket — and the port — for the next test.
    if (command && command.running) {
      command.dispose();
    }
  });

  describe("#init", () => {
    it("loads the protobuf root, binds the command port and starts listening", async () => {
      command = new ClusterCommand(fakeNode({ port: PORT.server }));

      await command.init();

      // `listen()` is deliberately not awaited by `init()`, so "is it
      // listening" is the question, and the subject answers it. That the
      // protobuf root loaded and the port bound is what every test below
      // exercises for real, by sending a request to it.
      expect(command.running).toBe(true);
    });

    // Not awaited, and `listen()` rethrows a failed receive or reply: that
    // used to be an unhandled rejection.
    it("logs it when listening fails", async () => {
      command = new ClusterCommand(fakeNode({ port: PORT.server }));
      vi.spyOn(command, "listen").mockRejectedValue(new Error("socket gone"));

      try {
        await command.init();

        await vi.waitFor(() =>
          expect(logger.error).toHaveBeenCalledWith(
            "[CLUSTER] Command layer stopped listening: socket gone",
          ),
        );
      } finally {
        // Not running, so `afterEach` leaves the bound port alone
        command.dispose();
      }
    });
  });

  describe("#dispose", () => {
    it("marks the server closed and stops the listen loop", async () => {
      command = new ClusterCommand(fakeNode({ port: PORT.server }));
      await command.init();

      command.dispose();

      // The loop reads this between two `receive()` calls, and swallows the
      // error the closed socket raises in the meantime.
      expect(command.running).toBe(false);
    });
  });

  describe("#listen", () => {
    /** Drives a real request against a real server, and returns its reply. */
    async function ask(topic: string, payload: Buffer | null) {
      client = new Request();
      client.receiveTimeout = 2000;
      client.connect(`tcp://127.0.0.1:${PORT.server}`);

      await client.send([topic, payload]);

      return client.receive();
    }

    it("answers a fullstate request with the node's serialized state", async () => {
      const remoteNodes = new Map([["knode-2", { lastMessageId: 7 }]]);

      command = new ClusterCommand(
        fakeNode({
          activity: [],
          lastMessageId: 12,
          port: PORT.server,
          remoteNodes,
        }),
      );
      await command.init();

      const [topic, payload] = await ask("fullstate", null);

      expect(topic.toString()).toBe("fullstate");

      const decoder = protoroot.lookupType("FullStateResponse");
      const state = decoder.toObject(decoder.decode(payload));

      // Every remote node, plus this one — the requesting node uses this list
      // to know how far behind it is per peer.
      expect(
        state.nodesState.map(({ id }: { id: string }) => id).sort(),
      ).toEqual(["knode-2", "knode-local"]);
    });

    it("answers a handshake request with what addNode decided", async () => {
      const addNode = vi.fn().mockResolvedValue(true);

      command = new ClusterCommand(
        fakeNode({ addNode, lastMessageId: 12, port: PORT.server }),
      );
      await command.init();

      const root = await protobuf.load(
        `${process.cwd()}/lib/cluster/protobuf/command.proto`,
      );
      const encoder = root.lookupType("HandshakeRequest");
      const request = encoder
        .encode(
          encoder.create({
            ip: "127.0.0.2",
            lastMessageId: 3,
            nodeId: "knode-2",
          }),
        )
        .finish();

      const [topic, payload] = await ask("handshake", Buffer.from(request));

      expect(topic.toString()).toBe("handshake");

      // `lastMessageId` is a protobuf `uint64`, so what reaches `addNode` is a
      // `Long`, not a number — worth pinning, because the node compares it
      // against its own counters.
      const [nodeId, ip, lastMessageId] = addNode.mock.calls[0];

      expect([nodeId, ip]).toEqual(["knode-2", "127.0.0.2"]);
      expect(lastMessageId.toString()).toBe("3");

      const decoder = protoroot.lookupType("HandshakeResponse");

      expect(decoder.toObject(decoder.decode(payload))).toMatchObject({
        added: true,
      });
    });

    it("discards an unknown topic rather than leaving the REQ socket hanging", async () => {
      command = new ClusterCommand(fakeNode({ port: PORT.server }));
      await command.init();

      const [topic] = await ask("not-a-topic", null);

      // REP/REQ is strictly alternating: a request with no reply would wedge
      // the remote node's socket for good, so an invalid topic still answers.
      expect(topic.toString()).toBe("discarded");
    });

    /*
     * #3031: the socket is bound before the handshake sets the node id, and a
     * node restarted on a dead node's IP is reached by peers still talking to
     * that dead node. Answering used to read `nodeId`, which throws then.
     */
    describe("before the handshake has set the node id (#3031)", () => {
      it("discards a fullstate request, and keeps serving", async () => {
        const node = fakeNode({ hasNodeId: false, port: PORT.server });
        command = new ClusterCommand(node);
        await command.init();

        const [topic] = await ask("fullstate", null);

        expect(topic.toString()).toBe("discarded");

        // The loop did not die on it: once the id is set, it answers again.
        node.hasNodeId = true;
        client?.close();

        const [next] = await ask("fullstate", null);

        expect(next.toString()).toBe("fullstate");
        expect(command.running).toBe(true);
      });

      it("discards a handshake request without adding the peer", async () => {
        const addNode = vi.fn<AddNode>().mockResolvedValue(true);
        command = new ClusterCommand(
          fakeNode({ addNode, hasNodeId: false, port: PORT.server }),
        );
        await command.init();

        const encoder = protoroot.lookupType("HandshakeRequest");
        const request = encoder
          .encode(
            encoder.create({
              ip: "127.0.0.2",
              lastMessageId: 3,
              nodeId: "knode-2",
            }),
          )
          .finish();

        const [topic] = await ask("handshake", Buffer.from(request));

        expect(topic.toString()).toBe("discarded");
        expect(addNode).not.toHaveBeenCalled();
      });
    });
  });

  /*
   * #2785, end to end: a real server answering from `publisher.replay`, and a
   * real client asking it.
   */
  describe("#requestRetransmit / #handleRetransmit", () => {
    const frame = (topic: string, hex: string) => ({
      data: Buffer.from(hex, "hex"),
      topic,
    });
    const id = (n: number) => Long.fromNumber(n, true);

    async function retransmit(
      replay: Mock<
        (
          from: Long,
          to: Long,
        ) => Array<{ topic: string; data: Uint8Array }> | null
      >,
      from: number,
      to: number,
    ) {
      const server = new ClusterCommand(
        fakeNode({ port: PORT.retransmit, replay }),
      );
      await server.init();

      try {
        command = new ClusterCommand(fakeNode({ port: PORT.retransmit }));
        await command.loadProtobuf();

        return await command.requestRetransmit("127.0.0.1", id(from), id(to));
      } finally {
        server.dispose();
      }
    }

    it("answers the frames the publisher replays, in order", async () => {
      const replay = vi.fn<
        (from: Long, to: Long) => Array<{ topic: string; data: Uint8Array }>
      >(() => [frame("Heartbeat", "0802"), frame("Subscription", "0803")]);

      const frames = await retransmit(replay, 2, 3);

      expect(frames).toEqual([
        ["Heartbeat", Buffer.from("0802", "hex")],
        ["Subscription", Buffer.from("0803", "hex")],
      ]);

      const [[from, to]] = replay.mock.calls;
      expect([from.toNumber(), to.toNumber()]).toEqual([2, 3]);
    });

    it("answers null when the publisher no longer keeps them", async () => {
      await expect(
        retransmit(
          vi.fn(() => null),
          2,
          3,
        ),
      ).resolves.toBeNull();
    });

    it("answers null on a partial answer, which cannot close the gap", async () => {
      const replay = vi.fn(() => [frame("Heartbeat", "0802")]);

      await expect(retransmit(replay, 2, 3)).resolves.toBeNull();
    });

    it("answers null when nothing answers within syncTimeout", async () => {
      command = new ClusterCommand(fakeNode({ port: PORT.retransmit }));
      await command.loadProtobuf();

      await expect(
        command.requestRetransmit("127.0.0.1", id(2), id(3)),
      ).resolves.toBeNull();
    });
  });

  describe("#getFullState", () => {
    it("returns the state of the first node that answers", async () => {
      const server = new ClusterCommand(
        fakeNode({ port: PORT.fullStateClient, rooms: [] }),
      );
      await server.init();

      try {
        command = new ClusterCommand(
          fakeNode({ port: PORT.fullStateClient, remoteNodes: new Map() }),
        );
        // `loadProtobuf()`, not `init()`: this command is used as a *client*
        // here, and the port in its config is the one it dials — the server
        // above already holds it. The subject now separates the two, which is
        // what the spec was reaching into `protoroot` to do.
        await command.loadProtobuf();

        const fullState = await command.getFullState([
          { id: "knode-1", ip: "127.0.0.1" },
        ]);

        present(fullState, "the full state");
        expect(fullState.nodesState).toHaveLength(1);
        expect(logger.warn).not.toHaveBeenCalled();
      } finally {
        server.dispose();
      }
    });

    it("skips a node that discards the request instead of decoding its empty answer (#3031)", async () => {
      const server = new ClusterCommand(
        fakeNode({ hasNodeId: false, port: PORT.fullStateClient }),
      );
      await server.init();

      try {
        command = new ClusterCommand(fakeNode({ port: PORT.fullStateClient }));
        await command.loadProtobuf();

        // An empty DISCARDED frame decodes as an empty full state: taken as
        // one, it would have loaded nothing and gone on with the handshake.
        const fullState = await command.getFullState([
          { id: "knode-1", ip: "127.0.0.1" },
        ]);

        expect(fullState).toBeNull();
        expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
          "Unable to fetch a full state from node knode-1 (request discarded)",
        );
      } finally {
        server.dispose();
      }
    });

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

  describe("#broadcastHandshake", () => {
    it("decodes each answer and maps a silent node to null", async () => {
      const server = new ClusterCommand(
        fakeNode({ lastMessageId: 42, port: PORT.broadcastHandshake }),
      );
      await server.init();

      try {
        command = new ClusterCommand(
          fakeNode({ lastMessageId: 12, port: PORT.broadcastHandshake }),
        );
        // `loadProtobuf()`, not `init()`: this command is used as a *client*
        // here, and the port in its config is the one it dials — the server
        // above already holds it. The subject now separates the two, which is
        // what the spec was reaching into `protoroot` to do.
        await command.loadProtobuf();

        // TEST-NET-1 (RFC 5737): guaranteed not to route anywhere, which is
        // how a node that died between two heartbeats looks from here. Another
        // loopback address would not do — the server binds `tcp://*`, so it
        // would answer on that one too.
        const result = await command.broadcastHandshake([
          { id: "knode-1", ip: "127.0.0.1" },
          { id: "knode-dead", ip: "192.0.2.1" },
        ]);

        expect(result["knode-1"]).toMatchObject({ added: true });
        expect(result["knode-dead"]).toBeNull();
      } finally {
        server.dispose();
      }
    });
  });

  describe("#_sendSingleHandshake", () => {
    it("returns the response the remote node sends back", async () => {
      const encoded = Buffer.from("handshake response");

      peer = new Reply();
      await peer.bind(`tcp://127.0.0.1:${PORT.sendSingleHandshake}`);

      // Captured: `peer` is nulled in the next `beforeEach`, and the closure
      // below outlives the statement that created it.
      const answeringPeer = peer;
      const answering = answeringPeer.receive().then(([topic, payload]) => {
        expect(topic.toString()).toBe("handshake");
        expect(payload.toString()).toBe("handshake request");

        return answeringPeer.send(["handshake", encoded]);
      });

      command = new ClusterCommand(
        fakeNode({ port: PORT.sendSingleHandshake }),
      );

      const response = await command._sendSingleHandshake(
        "knode-1",
        "127.0.0.1",
        Buffer.from("handshake request"),
      );
      await answering;

      present(response, "the handshake response");
      expect(Buffer.from(response).toString()).toBe(encoded.toString());
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("returns null when the remote node discards the handshake (#3031)", async () => {
      peer = new Reply();
      await peer.bind(`tcp://127.0.0.1:${PORT.sendSingleHandshake}`);

      const answeringPeer = peer;
      const answering = answeringPeer
        .receive()
        .then(() => answeringPeer.send(["discarded", null]));

      command = new ClusterCommand(
        fakeNode({ port: PORT.sendSingleHandshake }),
      );

      const response = await command._sendSingleHandshake(
        "knode-1",
        "127.0.0.1",
        Buffer.from("handshake request"),
      );
      await answering;

      // Not an empty buffer: decoded, it read as an answer with nothing in it.
      expect(response).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Couldn't complete handshake with node knode-1: request discarded",
      );
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
