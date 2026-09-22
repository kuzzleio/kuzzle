import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { asEntryPoint, stubEntryPoint } from "../../../mocks/entryPoint";
import type { EntryPointStub } from "../../../mocks/entryPoint";
import { restoreKuzzle, stubKuzzle } from "../../../mocks/kuzzle";

/**
 * ⚠️ The Mocha spec registered `net` **and** `node:net`, because `mock-require`
 * keys on the literal specifier. The subject imports only the `node:` form.
 */
const net = vi.hoisted(() => ({
  listen: vi.fn((_port: number, done: () => void) => done()),
  createServer: vi.fn(),
}));

vi.mock("node:net", () => {
  net.createServer.mockReturnValue({ listen: net.listen });

  return { createServer: net.createServer };
});

vi.mock("aedes", () => ({
  default: class Aedes {
    public authorizePublish: unknown = null;
    public authorizeSubscribe: unknown = null;
    public handle = vi.fn();
    public on = vi.fn();
    public publish = vi.fn();
  },
}));

/** A connected MQTT client, as aedes hands one to the protocol. */
class FakeClient {
  public conn = { remoteAddress: "ip" };
  public close = vi.fn();
  public publish = vi.fn();

  constructor(public id: string | null) {}
}

/**
 * `aedes`'s authorization hooks are node-style callbacks, and the spec drives
 * them directly. Bluebird's `promisify` did this in the Mocha suite; the vitest
 * tree has no bluebird, and the shape is four lines.
 */
const promisify =
  <T>(
    fn: (
      client: unknown,
      arg: unknown,
      done: (error: Error | null, value?: T) => void,
    ) => void,
  ) =>
  (client: unknown, arg: unknown) =>
    new Promise<T>((resolve, reject) =>
      fn(client, arg, (error, value) =>
        error ? reject(error) : resolve(value as T),
      ),
    );

async function loadSubject() {
  vi.resetModules();

  return (await import("../../../../lib/core/network/protocols/mqttProtocol"))
    .default;
}

describe("MqttProtocol", () => {
  let entryPoint: EntryPointStub;
  let protocol: any;
  let fakeClient: FakeClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    net.createServer.mockReturnValue({ listen: net.listen });

    // The subject first, the global second: `loadSubject` re-evaluates the
    // module graph, and `lib/kuzzle/kuzzle.ts` re-installs `global.kuzzle`'s
    // accessor when it does — overwriting whatever was stubbed before it.
    const MqttProtocol = await loadSubject();

    stubKuzzle();

    entryPoint = stubEntryPoint({
      maxRequestSize: 42,
      protocols: { mqtt: { enabled: true, foo: "bar" } },
    });
    protocol = new MqttProtocol();
    fakeClient = new FakeClient("foo");
  });

  afterEach(() => {
    restoreKuzzle();
  });

  const init = () => protocol.init(asEntryPoint(entryPoint));

  describe("#init", () => {
    it("answers false when the protocol is disabled", async () => {
      entryPoint.config.protocols.mqtt.enabled = false;

      await expect(init()).resolves.toBe(false);
    });

    it("listens on the configured port and answers true", async () => {
      await expect(init()).resolves.toBe(true);

      expect(net.createServer.mock.calls).toEqual([[protocol.aedes.handle]]);
      expect(net.listen.mock.calls[0][0]).toBe(1883);
    });

    it("routes each aedes event to its handler", async () => {
      protocol.onConnection = vi.fn();
      protocol.onDisconnection = vi.fn();
      protocol.onMessage = vi.fn();

      await init();

      expect(protocol.aedes.on.mock.calls.map((c) => c[0])).toEqual([
        "client",
        "clientError",
        "clientDisconnect",
        "publish",
      ]);

      const handlerOf = (event: string) =>
        protocol.aedes.on.mock.calls.find((c) => c[0] === event)[1];

      handlerOf("client")(fakeClient);
      expect(protocol.onConnection.mock.calls).toEqual([[fakeClient]]);

      // ⚠️ The Mocha spec read `getCall(1)` twice — `clientError`, then
      // `clientError` again with the history reset in between — so
      // `clientDisconnect`, which is `getCall(2)`, was never exercised. Both
      // are named here rather than indexed.
      handlerOf("clientError")("test");
      expect(protocol.onDisconnection.mock.calls).toEqual([["test"]]);

      protocol.onDisconnection.mockClear();
      handlerOf("clientDisconnect")("test");
      expect(protocol.onDisconnection.mock.calls).toEqual([["test"]]);

      handlerOf("publish")("packet", "client");
      expect(protocol.onMessage.mock.calls).toEqual([["packet", "client"]]);
    });
  });

  describe("#authorizePublish", () => {
    let auth: (client: unknown, packet: unknown) => Promise<unknown>;

    beforeEach(async () => {
      await init();
      auth = promisify(protocol.aedes.authorizePublish);
    });

    it("restricts publishing to the request topic when allowPubSub is false", async () => {
      protocol.config.allowPubSub = false;

      const packet = { payload: Buffer.from("payload"), topic: "topic" };

      await expect(auth(fakeClient, packet)).rejects.toThrow(
        "Cannot publish on this topic: unauthorized",
      );

      packet.topic = protocol.config.requestTopic;
      await expect(auth(fakeClient, packet)).resolves.toBeUndefined();
    });

    it("allows any wildcard-free topic but the response one when allowPubSub is true", async () => {
      protocol.config.allowPubSub = true;

      const packet = { payload: Buffer.from("payload"), topic: "topic" };

      await expect(auth(fakeClient, packet)).resolves.toBeUndefined();

      packet.topic = protocol.config.responseTopic;
      await expect(auth(fakeClient, packet)).rejects.toThrow(
        "Cannot publish: this topic is read-only",
      );

      packet.topic = "wildcard#forbidden";
      await expect(auth(fakeClient, packet)).rejects.toThrow(
        "Cannot publish: wildcards are disabled",
      );

      packet.topic = "wildcard+forbidden";
      await expect(auth(fakeClient, packet)).rejects.toThrow(
        "Cannot publish: wildcards are disabled",
      );
    });
  });

  describe("#authorizeSubscribe", () => {
    let auth: (client: unknown, sub: unknown) => Promise<unknown>;

    beforeEach(async () => {
      await init();
      auth = promisify(protocol.aedes.authorizeSubscribe);
    });

    it("allows any wildcard-free topic but the request one", async () => {
      const sub = { topic: "topic" };

      await expect(auth(fakeClient, sub)).resolves.toBe(sub);

      sub.topic = protocol.config.requestTopic;
      await expect(auth(fakeClient, sub)).rejects.toThrow(
        "Cannot subscribe: this topic is write-only",
      );

      sub.topic = "wildcard#forbidden";
      await expect(auth(fakeClient, sub)).rejects.toThrow(
        "Cannot subscribe: wildcards are disabled",
      );

      sub.topic = "wildcard+forbidden";
      await expect(auth(fakeClient, sub)).rejects.toThrow(
        "Cannot subscribe: wildcards are disabled",
      );
    });
  });

  describe("#broadcast", () => {
    it("publishes the payload on every channel", async () => {
      await init();

      protocol.broadcast({ payload: "payload", channels: ["ch1", "ch2"] });

      // Both channels: the Mocha spec counted two calls and named only `ch1`.
      expect(protocol.aedes.publish.mock.calls.map((c) => c[0])).toEqual([
        { topic: "ch1", payload: '"payload"' },
        { topic: "ch2", payload: '"payload"' },
      ]);
    });
  });

  describe("#disconnect", () => {
    it("closes the matching connection", () => {
      protocol.connectionsById.set(fakeClient.id, fakeClient);

      protocol.disconnect(fakeClient.id);

      expect(fakeClient.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("#notify", () => {
    it("forwards the payload to the matching client only", () => {
      const client1 = new FakeClient("foo");
      const client2 = new FakeClient("bar");

      protocol.connectionsById.set(client1.id, client1);
      protocol.connectionsById.set(client2.id, client2);

      protocol.notify({
        connectionId: client1.id,
        payload: "payload",
        channels: ["ch1", "ch2"],
      });

      expect(client1.publish.mock.calls.map((c) => c[0])).toEqual([
        { payload: Buffer.from('"payload"'), topic: "ch1" },
        { payload: Buffer.from('"payload"'), topic: "ch2" },
      ]);
      expect(client2.publish).not.toHaveBeenCalled();
    });
  });

  describe("#onConnection", () => {
    it("registers the new connection under both indexes", async () => {
      await init();

      protocol.onConnection(fakeClient);

      expect(protocol.connections.size).toBe(1);
      expect(protocol.connectionsById.size).toBe(1);

      const [connectionId] = protocol.connectionsById.keys();

      expect(protocol.connections.get(fakeClient).id).toBe(connectionId);
      expect(entryPoint.newConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe("#onDisconnection", () => {
    beforeEach(() => init());

    it("does nothing when the connection is unknown", () => {
      protocol.onDisconnection(fakeClient);

      expect(entryPoint.removeConnection).not.toHaveBeenCalled();
    });

    it("removes the connection after the disconnect delay", () => {
      vi.useFakeTimers();

      try {
        protocol.connections.set(fakeClient, { id: fakeClient.id });
        protocol.connectionsById.set(fakeClient.id, fakeClient);

        protocol.onDisconnection(fakeClient);

        expect(entryPoint.removeConnection).not.toHaveBeenCalled();

        vi.advanceTimersByTime(protocol.config.disconnectDelay + 1);

        expect(entryPoint.removeConnection.mock.calls).toEqual([
          [fakeClient.id],
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("#onMessage", () => {
    beforeEach(() => init());

    it("ignores a packet on a topic other than the request one", () => {
      protocol.onMessage({ payload: "payload", topic: "topic" }, fakeClient);

      expect(entryPoint.execute).not.toHaveBeenCalled();
    });

    it("ignores a packet with no payload", () => {
      protocol.onMessage({ topic: protocol.config.requestTopic }, fakeClient);

      expect(entryPoint.execute).not.toHaveBeenCalled();
    });

    it("ignores a packet from a client with no id", () => {
      protocol.onMessage(
        { payload: "payload", topic: protocol.config.requestTopic },
        new FakeClient(null),
      );

      expect(entryPoint.execute).not.toHaveBeenCalled();
    });

    it("ignores a packet from an unknown connection", () => {
      protocol.onMessage(
        { payload: "payload", topic: protocol.config.requestTopic },
        fakeClient,
      );

      expect(entryPoint.execute).not.toHaveBeenCalled();
    });

    it("forwards the payload to kuzzle and answers the client", () => {
      entryPoint.execute.mockImplementation((_connection, _request, cb) =>
        cb({ content: "response" }),
      );

      const connection = { id: fakeClient.id, protocol: "mqtt" };

      protocol.connections.set(fakeClient, connection);

      protocol.onMessage(
        {
          payload: Buffer.from(JSON.stringify({ foo: "bar" })),
          topic: protocol.config.requestTopic,
        },
        fakeClient,
      );

      expect(entryPoint.execute).toHaveBeenCalledTimes(1);
      expect(entryPoint.execute.mock.calls[0][0]).toBe(connection);

      const request = entryPoint.execute.mock.calls[0][1] as {
        serialize(): Record<string, any>;
      };

      expect(request.serialize()).toMatchObject({
        data: { foo: "bar" },
        options: {
          connection: { id: fakeClient.id, protocol: protocol.name },
        },
      });

      // `publish` takes a completion callback as its second argument, which
      // the Mocha spec's `calledWithMatch` never mentioned.
      expect(fakeClient.publish).toHaveBeenCalledTimes(1);
      expect(fakeClient.publish.mock.calls[0][0]).toEqual({
        payload: Buffer.from('"response"'),
        topic: protocol.config.responseTopic,
      });
      expect(fakeClient.publish.mock.calls[0][1]).toBeTypeOf("function");
    });

    it.each(["production", "", "development"])(
      "answers an error when the payload cannot be parsed (NODE_ENV=%s)",
      (env) => {
        const nodeEnv = global.NODE_ENV;
        global.NODE_ENV = env;

        try {
          protocol._respond = vi.fn();

          const client = new FakeClient(env);
          protocol.connections.set(client, { id: client.id, protocol: "mqtt" });

          protocol.onMessage(
            {
              payload: Buffer.from("invalid"),
              topic: protocol.config.requestTopic,
            },
            client,
          );

          expect(protocol._respond).toHaveBeenCalledTimes(1);
          expect(protocol._respond.mock.calls[0][0]).toBe(client);
          expect(protocol._respond.mock.calls[0][1].content.error.id).toBe(
            "network.mqtt.unexpected_error",
          );
        } finally {
          global.NODE_ENV = nodeEnv;
        }
      },
    );

    it("answers an error when the requestId is not a string", async () => {
      protocol._respond = vi.fn();

      protocol.connections.set(fakeClient, {
        id: fakeClient.id,
        protocol: "mqtt",
      });

      protocol.onMessage(
        {
          payload: Buffer.from(JSON.stringify({ requestId: 42 })),
          topic: protocol.config.requestTopic,
        },
        fakeClient,
      );

      // After the reset, the subject's `BadRequestError` is not the statically
      // imported one.
      const { BadRequestError: Fresh } = await import("../../../../index");

      expect(protocol._respond).toHaveBeenCalledTimes(1);
      expect(protocol._respond.mock.calls[0][0]).toBe(fakeClient);
      expect(protocol._respond.mock.calls[0][1].content.error).toBeInstanceOf(
        Fresh,
      );
    });
  });

  describe("#_respond", () => {
    beforeEach(() => init());

    it("broadcasts instead of answering the client in development mode", () => {
      const nodeEnv = global.NODE_ENV;
      global.NODE_ENV = "development";

      try {
        protocol.broadcast = vi.fn();
        protocol.config.developmentMode = true;

        protocol._respond(fakeClient, { content: "response" });

        expect(protocol.broadcast.mock.calls).toEqual([
          [
            {
              channels: [protocol.config.responseTopic],
              payload: "response",
            },
          ],
        ]);
        expect(fakeClient.publish).not.toHaveBeenCalled();
      } finally {
        global.NODE_ENV = nodeEnv;
      }
    });

    it("answers the client directly outside development mode", () => {
      protocol.broadcast = vi.fn();
      protocol.config.developmentMode = false;

      protocol._respond(fakeClient, { content: "response" });

      expect(protocol.broadcast).not.toHaveBeenCalled();
      expect(fakeClient.publish).toHaveBeenCalledTimes(1);
      expect(fakeClient.publish.mock.calls[0][0]).toEqual({
        payload: Buffer.from('"response"'),
        topic: protocol.config.responseTopic,
      });
    });
  });
});
