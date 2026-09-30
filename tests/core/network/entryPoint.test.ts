import fs from "node:fs";
import path from "node:path";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import EntryPoint from "../../../lib/core/network/entryPoint";
import { KuzzleRequest, RequestContext } from "../../../lib/api/request";
import { InternalError as KuzzleInternalError } from "../../../lib/kerror/errors/internalError";
import { ServiceUnavailableError } from "../../../lib/kerror/errors/serviceUnavailableError";
import { invalid } from "../../helpers/invalid";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../mocks/kuzzle";

vi.mock("../../../lib/core/network/protocols/httpwsProtocol", async () => {
  const { FakeHttpWsProtocol } = await import("./entryPointFixture");

  return { default: FakeHttpWsProtocol };
});

vi.mock("../../../lib/core/network/protocols/mqttProtocol", async () => {
  const { FakeMqttProtocol } = await import("./entryPointFixture");

  return { default: FakeMqttProtocol };
});

vi.mock("../../../lib/core/network/protocols/internalProtocol", async () => {
  const { FakeInternalProtocol } = await import("./entryPointFixture");

  return { default: FakeInternalProtocol };
});

type Internals = {
  _broadcast: (data: unknown) => void;
  _clients: Map<string, unknown>;
  _notify: (data: unknown) => void;
  logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
};

const internalsOf = (entryPoint: EntryPoint) => invalid<Internals>(entryPoint);

/**
 * ⚠️ `loadMoreProtocols` reads `protocols/enabled/` and `require`s every
 * directory in it, at a path it computes from `__dirname` and nothing else.
 * The Mocha spec replaced `fs` **and** the module's own `require`
 * (`Rewired.__with__({ require: requireStub })`), which is the one thing in
 * this step `vi.mock` genuinely cannot do — and also the reason that spec
 * proved nothing about loading a protocol: both halves of the operation were
 * stand-ins.
 *
 * So the fixtures below are real directories, written into the very place the
 * subject looks and removed afterwards. The subject runs unmodified, `require`
 * resolves a real module, and the manifest is read off disk — the same answer
 * [L6b](../../../docs/adr-001/steps/13-sprint-10-test-closure.md#what-l6b-found)
 * found for `Plugin.loadFromDirectory`.
 */
const enabledDir = path.resolve(__dirname, "../../../protocols/enabled");

const writeProtocol = (
  name: string,
  { manifest = true, init = "  init() { return Promise.resolve(true); }" } = {},
) => {
  const dir = path.join(enabledDir, name);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "index.cjs"),
    `"use strict";\n\nclass Protocol {\n  constructor() {\n    this.name = "${name}";\n  }\n${init}\n}\n\nmodule.exports = Protocol;\n`,
  );
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ main: "index.cjs", name, version: "1.0.0" }, null, 2),
  );

  if (manifest) {
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify({ kuzzleVersion: ">=2.x", name }, null, 2),
    );
  }

  return dir;
};

const written: string[] = [];

describe("#core/network/EntryPoint", () => {
  let entryPoint: EntryPoint;
  let config: Record<string, any>;
  let funnelExecute: ReturnType<typeof vi.fn>;
  let emit: ReturnType<typeof vi.fn>;
  let router: Record<string, ReturnType<typeof vi.fn>>;

  /** Whatever the checkout ships there — `.gitignore` and `.keep`. */
  const housekeeping = (entries: string[]) =>
    entries.filter((entry) => !entry.startsWith("."));

  beforeAll(() => {
    /* The directory is the operator's, and it holds no protocol in a
     * checkout. A test that wrote into a populated one would be loading
     * someone else's protocol. */
    expect(housekeeping(fs.readdirSync(enabledDir))).toEqual([]);
  });

  afterEach(() => {
    for (const dir of written.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  afterAll(() => {
    expect(housekeeping(fs.readdirSync(enabledDir))).toEqual([]);
  });

  const protocolFixture = (...args: Parameters<typeof writeProtocol>) => {
    const dir = writeProtocol(...args);

    written.push(dir);

    return dir;
  };

  beforeEach(() => {
    funnelExecute = vi.fn();
    emit = vi.fn();
    router = { newConnection: vi.fn(), removeConnection: vi.fn() };

    config = {
      server: {
        logs: { accessLogFormat: "combined", transports: [] },
        port: 7512,
      },
      services: { common: { defaultInitTimeout: 120000 } },
      /* A protocol's manifest is checked against the running version, the
       * same way a plugin's is. */
      version: "2.56.0",
    };

    stubKuzzle({
      config,
      emit,
      funnel: { execute: funnelExecute },
      log: stubLogger(),
      router,
    });

    entryPoint = new EntryPoint();
    internalsOf(entryPoint).logger = invalid(stubLogger());
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  describe("#dispatch", () => {
    it("should notify one connection", () => {
      const notify = vi.fn();

      internalsOf(entryPoint)._notify = notify;
      entryPoint.dispatch("notify", { foo: "bar" });

      expect(notify).toHaveBeenCalledExactlyOnceWith({ foo: "bar" });
    });

    it("should broadcast to every connection", () => {
      const broadcast = vi.fn();

      internalsOf(entryPoint)._broadcast = broadcast;
      entryPoint.dispatch("broadcast", { foo: "bar" });

      expect(broadcast).toHaveBeenCalledExactlyOnceWith({ foo: "bar" });
    });

    it("should refuse an event it does not know", () => {
      expect(() => entryPoint.dispatch("foo", {})).toThrow(KuzzleInternalError);
    });
  });

  describe("#execute", () => {
    const answer = (request: KuzzleRequest) =>
      new Promise<Record<string, any>>((resolve) => {
        entryPoint.execute(invalid({}), request, (response) =>
          resolve(invalid(response)),
        );
      });

    it("should funnel the request and log what came back", async () => {
      const request = new KuzzleRequest({}, {});

      request.response.configure({ headers: { foo: "bar" } });
      funnelExecute.mockImplementation((req, cb) => cb(null, req));

      const logAccess = vi
        .spyOn(entryPoint, "logAccess")
        .mockImplementation(() => {});

      await expect(answer(request)).resolves.toEqual(request.response.toJSON());

      expect(logAccess).toHaveBeenCalledExactlyOnceWith({}, request);
    });

    it("should answer an error the funnel reported on a bare request", async () => {
      const error = new KuzzleInternalError("test");

      funnelExecute.mockImplementation((req, cb) => cb(error, req));

      const response = await answer(new KuzzleRequest({}, {}));

      expect(response.content.error).toMatchObject({ message: "test" });
    });

    /* ⚠️ The response goes to a client, so the stack trace must not: the
     * subject strips it on the way out and nothing asserted that. */
    it("should strip the stack trace from the error it answers", async () => {
      funnelExecute.mockImplementation((req, cb) =>
        cb(new KuzzleInternalError("test"), req),
      );

      const response = await answer(new KuzzleRequest({}, {}));

      expect(response.content.error.stack).toBeUndefined();
    });

    it("should refuse a request once shutting down", async () => {
      entryPoint.dispatch("shutdown", {});

      const response = await answer(new KuzzleRequest({}, {}));

      expect(response.status).toBe(503);
      expect(response.content.error).toBeInstanceOf(ServiceUnavailableError);
      expect(funnelExecute).not.toHaveBeenCalled();
    });
  });

  describe("#init", () => {
    it("should build the default protocols and start the internal one", async () => {
      await entryPoint.init();

      expect([...entryPoint.protocols.keys()]).toEqual([
        "websocket",
        "mqtt",
        "internal",
      ]);
      expect(entryPoint.protocols.get("internal")?.init).toHaveBeenCalledOnce();
      /* The other two wait for `startListening()`: a protocol that listened
       * here would accept traffic before the API is up. */
      expect(
        entryPoint.protocols.get("websocket")?.init,
      ).not.toHaveBeenCalled();
    });
  });

  describe("#startListening", () => {
    beforeEach(() => entryPoint.init());

    it("should start every protocol that is not up yet", async () => {
      const loadMore = vi
        .spyOn(entryPoint, "loadMoreProtocols")
        .mockResolvedValue();

      await entryPoint.startListening();

      expect(
        entryPoint.protocols.get("websocket")?.init,
      ).toHaveBeenCalledOnce();
      expect(entryPoint.protocols.get("mqtt")?.init).toHaveBeenCalledOnce();
      /* The internal protocol was started by `init()` and is not started
       * twice — `initCalled` is what says so. */
      expect(entryPoint.protocols.get("internal")?.init).toHaveBeenCalledOnce();
      expect(loadMore).toHaveBeenCalledOnce();
      expect(entryPoint.protocols.size).toBe(3);
    });

    it("should drop a protocol that reports itself disabled", async () => {
      vi.spyOn(entryPoint, "loadMoreProtocols").mockResolvedValue();
      vi.mocked(entryPoint.protocols.get("mqtt")!.init).mockResolvedValue(
        false,
      );

      await entryPoint.startListening();

      expect(entryPoint.protocols.get("mqtt")).toBeUndefined();
      expect(entryPoint.protocols.size).toBe(2);
    });

    it("should refuse a port that is not an integer", async () => {
      config.server.port = "foobar";

      await expect(entryPoint.startListening()).rejects.toMatchObject({
        id: "network.entrypoint.invalid_port",
        message: "Invalid network port number: foobar.",
      });
    });

    it("should forward an error raised while loading protocols", async () => {
      const error = new Error("test");

      vi.spyOn(entryPoint, "loadMoreProtocols").mockRejectedValue(error);

      await expect(entryPoint.startListening()).rejects.toBe(error);
    });
  });

  describe("#loadMoreProtocols", () => {
    it("should load every protocol of the enabled directory", async () => {
      protocolFixture("fake-one");
      protocolFixture("fake-two");

      await entryPoint.loadMoreProtocols();

      expect([...entryPoint.protocols.keys()].sort()).toEqual([
        "fake-one",
        "fake-two",
      ]);
      /* A loaded protocol is the instance the module exported, with its
       * `init` having run against this entry point. */
      expect(entryPoint.protocols.get("fake-one")).toMatchObject({
        name: "fake-one",
      });
    });

    it("should do nothing when there is no protocol to load", async () => {
      await expect(entryPoint.loadMoreProtocols()).resolves.toBeUndefined();

      expect(entryPoint.protocols.size).toBe(0);
    });

    it("should refuse a protocol with no manifest.json", async () => {
      protocolFixture("no-manifest", { manifest: false });

      await expect(entryPoint.loadMoreProtocols()).rejects.toMatchObject({
        id: "plugin.manifest.cannot_load",
      });
    });

    it("should report a protocol whose init fails, by name", async () => {
      protocolFixture("failing", {
        init: '  init() { return Promise.reject(new Error("test")); }',
      });

      await expect(entryPoint.loadMoreProtocols()).rejects.toThrow("test");

      expect(internalsOf(entryPoint).logger.error).toHaveBeenCalledWith(
        'Error during "failing" protocol init:',
      );
    });

    /* ⚠️ Two protocols answering the same name is a configuration mistake an
     * operator can make by copying a directory, and the refusal names it.
     * Unreachable to the Mocha spec, whose `require` stub answered a fresh
     * anonymous class every time. */
    it("should refuse two protocols claiming the same name", async () => {
      protocolFixture("duplicate-one");
      const second = protocolFixture("duplicate-two");

      fs.writeFileSync(
        path.join(second, "manifest.json"),
        JSON.stringify({ kuzzleVersion: ">=2.x", name: "duplicate-one" }),
      );

      await expect(entryPoint.loadMoreProtocols()).rejects.toMatchObject({
        id: "protocol.runtime.already_exists",
      });
    });
  });

  describe("#newConnection", () => {
    const connection = {
      headers: "headers",
      id: "connectionId",
      protocol: "protocol",
    };

    it("should store the connection and tell the router", () => {
      entryPoint.newConnection(invalid(connection));

      expect(internalsOf(entryPoint)._clients.get("connectionId")).toBe(
        connection,
      );
      expect(router.newConnection).toHaveBeenCalledExactlyOnceWith(
        new RequestContext({ connection }),
      );
    });

    it("should announce the new connection", () => {
      entryPoint.newConnection(invalid(connection));

      expect(emit).toHaveBeenCalledWith("connection:new", connection);
    });
  });

  describe("#removeConnection", () => {
    const connection = {
      headers: "headers",
      id: "connectionId",
      protocol: "protocol",
    };

    beforeEach(() => {
      internalsOf(entryPoint)._clients.set(connection.id, connection);
    });

    it("should forget the connection and tell the router", () => {
      entryPoint.removeConnection(connection.id);

      expect(router.removeConnection).toHaveBeenCalledExactlyOnceWith(
        new RequestContext({ connection }),
      );
      expect(internalsOf(entryPoint)._clients.has(connection.id)).toBe(false);
    });

    it("should announce the removed connection", () => {
      entryPoint.removeConnection(connection.id);

      expect(emit).toHaveBeenCalledWith("connection:remove", connection);
    });

    it("should do nothing for a connection it does not know", () => {
      entryPoint.removeConnection("unknown");

      expect(router.removeConnection).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalledWith(
        "connection:remove",
        expect.anything(),
      );
    });
  });

  describe("#joinChannel / #leaveChannel", () => {
    it.each(["joinChannel", "leaveChannel"] as const)(
      "should do nothing on %s when the client is unknown",
      async (method) => {
        await entryPoint.init();

        entryPoint[method]("channel", "connectionId");

        for (const protocol of entryPoint.protocols.values()) {
          expect(protocol[method]).not.toHaveBeenCalled();
        }
      },
    );

    it.each(["joinChannel", "leaveChannel"] as const)(
      "should forward %s to the client's own protocol",
      (method) => {
        const protocol = { [method]: vi.fn() };

        internalsOf(entryPoint)._clients.set("connectionId", {
          protocol: "protocol",
        });
        entryPoint.protocols.set("protocol", invalid(protocol));

        entryPoint[method]("channel", "connectionId");

        expect(protocol[method]).toHaveBeenCalledExactlyOnceWith(
          "channel",
          "connectionId",
        );
      },
    );

    it.each([
      ["joinChannel", "[join] protocol protocol failed: test"],
      ["leaveChannel", "[leave channel] protocol protocol failed: test"],
    ] as const)(
      "should log an error raised by %s and carry on",
      (method, message) => {
        const protocol = {
          [method]: vi.fn(() => {
            throw new Error("test");
          }),
        };

        internalsOf(entryPoint)._clients.set("connectionId", {
          protocol: "protocol",
        });
        entryPoint.protocols.set("protocol", invalid(protocol));

        expect(() =>
          entryPoint[method]("channel", "connectionId"),
        ).not.toThrow();
        expect(internalsOf(entryPoint).logger.error).toHaveBeenCalledWith(
          message,
        );
      },
    );
  });

  describe("#_broadcast / #_notify", () => {
    it("should broadcast through every protocol, logging the ones that fail", () => {
      const protocols = {
        one: { broadcast: vi.fn() },
        three: {
          broadcast: vi.fn(() => {
            throw new KuzzleInternalError("test");
          }),
        },
        two: { broadcast: vi.fn() },
      };

      entryPoint.protocols = invalid(new Map(Object.entries(protocols)));

      internalsOf(entryPoint)._broadcast("data");

      expect(protocols.one.broadcast).toHaveBeenCalledExactlyOnceWith("data");
      expect(protocols.two.broadcast).toHaveBeenCalledExactlyOnceWith("data");
      expect(internalsOf(entryPoint).logger.error).toHaveBeenCalledOnce();
    });

    it("should notify the connection's protocol, logging a failure", () => {
      const protocol = {
        notify: vi.fn(() => {
          throw new KuzzleInternalError("test");
        }),
      };

      internalsOf(entryPoint)._clients.set("connectionId", {
        protocol: "protocol",
      });
      entryPoint.protocols.set("protocol", invalid(protocol));

      internalsOf(entryPoint)._notify({
        connectionId: "connectionId",
        content: "data",
      });

      expect(protocol.notify).toHaveBeenCalledOnce();
      expect(internalsOf(entryPoint).logger.error).toHaveBeenCalledOnce();
    });
  });
});
