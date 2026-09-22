import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClientConnection from "../../../lib/core/network/clientConnection";
import { KuzzleRequest } from "../../../lib/api/request";
import { InternalError } from "../../../lib/kerror/errors/internalError";
import type { ServerConfiguration } from "../../../lib/types";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

/**
 * The two module substitutions this spec needs, and the state they record.
 *
 * `vi.hoisted` because a `vi.mock` factory is lifted above every import: the
 * bindings it closes over have to be lifted with it.
 *
 * ⚠️ The Mocha spec registered **two** worker-thread stubs, `worker_threads`
 * and `node:worker_threads`, because `mock-require` keys on the literal
 * specifier and the subject was believed to reach for both. It imports only
 * the `node:`-prefixed name, so one is enough here.
 */
const threads = vi.hoisted(() => {
  const postMessage = vi.fn();
  const onMessage = vi.fn();

  return {
    postMessage,
    onMessage,
    /** Every `new Worker(...)`, in order, as the subject called it. */
    workerCalls: [] as unknown[][],
    parentPort: { on: onMessage },
  };
});

const pinoStub = vi.hoisted(() => {
  const info = vi.fn();

  return {
    info,
    logger: { info },
    pino: vi.fn(),
    transport: vi.fn(),
  };
});

vi.mock("node:worker_threads", () => ({
  isMainThread: true,
  parentPort: threads.parentPort,
  Worker: class {
    public postMessage = threads.postMessage;

    constructor(...args: unknown[]) {
      threads.workerCalls.push(args);
    }
  },
  workerData: {},
}));

/**
 * One stub, where the Mocha spec registered two.
 *
 * Its outer `before` mocked `pino` with a `transport` alone, and the
 * `AccessLoggerWorker` block re-mocked it with `transport` *and* `pino` before
 * re-requiring the subject. That reads as a conditional substitution — the
 * thing L4 was carved out for — and it is not one: the second registration is
 * the first plus a key. Providing both from the start is the same stub, and no
 * swap is needed. Same shape as [L4a]'s finding, one slice later.
 */
vi.mock("pino", () => ({
  pino: pinoStub.pino,
  transport: pinoStub.transport,
}));

/** The subject caches a transport on the instance, and runs code at import. */
async function loadSubject() {
  vi.resetModules();

  return import("../../../lib/core/network/accessLogger");
}

/**
 * The slice of `config.server` the subject reads. Cast once here rather than at
 * each assignment: the real `ServerConfiguration` carries six more branches
 * that neither `AccessLogger` nor its worker looks at.
 */
const transportsConfig = (
  ...transports: Record<string, unknown>[]
): ServerConfiguration =>
  ({
    logs: {
      accessLogFormat: "combined",
      accessLogIpOffset: 0,
      transports,
    },
  }) as unknown as ServerConfiguration;

const console_ = (silent: boolean) => ({
  level: "info",
  silent,
  stderrLevels: [],
  transport: "console",
});

describe("AccessLogger", () => {
  let logError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logError = vi.fn();
    threads.workerCalls.length = 0;
    vi.clearAllMocks();
    pinoStub.pino.mockReturnValue(pinoStub.logger);

    const child = { error: logError };

    stubKuzzle({
      ask: vi.fn(async () => ({ _id: "-1" })),
      config: { server: transportsConfig() },
      log: { child: () => child },
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#init", () => {
    it("spawns a worker thread when at least one transport is not silent", async () => {
      global.kuzzle.config.server = transportsConfig(
        console_(true),
        { ...console_(false), transport: "file" },
        { ...console_(true), transport: "elasticsearch" },
      );

      const { AccessLogger } = await loadSubject();
      const accessLogger = new AccessLogger();

      await accessLogger.init();

      expect(accessLogger.isActive).toBe(true);
      expect(threads.workerCalls).toHaveLength(1);

      const [filename, options] = threads.workerCalls[0] as [
        string,
        { workerData: Record<string, unknown> },
      ];

      expect(filename).toMatch(/accessLogger\.ts$/);
      expect(options.workerData).toEqual({
        anonymousUserId: "-1",
        config: global.kuzzle.config.server,
        kuzzleId: global.nodeId,
      });
    });

    it("logs an error and skips an unusable transport", async () => {
      global.kuzzle.config.server = transportsConfig({
        ...console_(false),
        transport: "ohnoes",
      });

      const { AccessLogger } = await loadSubject();
      const accessLogger = new AccessLogger();

      await accessLogger.init();

      expect(accessLogger.isActive).toBe(false);
      expect(threads.workerCalls).toHaveLength(0);
      expect(logError.mock.calls).toEqual([
        [
          'Failed to initialize logger transport "ohnoes": unsupported transport. Skipped.',
        ],
      ]);
    });

    it("stays inactive when every usable transport is silent", async () => {
      global.kuzzle.config.server = transportsConfig(
        console_(true),
        { ...console_(true), transport: "file" },
        { ...console_(false), transport: "ohnoes" },
      );

      const { AccessLogger } = await loadSubject();
      const accessLogger = new AccessLogger();

      await accessLogger.init();

      expect(accessLogger.isActive).toBe(false);
      expect(threads.workerCalls).toHaveLength(0);
    });
  });

  describe("#log", () => {
    it("posts the serialized request to the worker, without its result", async () => {
      global.kuzzle.config.server = transportsConfig(console_(false));

      const { AccessLogger } = await loadSubject();
      const accessLogger = new AccessLogger();

      await accessLogger.init();

      const request = {
        response: "response",
        serialize: vi.fn(() => ({
          data: "data",
          options: { error: "error", result: "result", status: "status" },
        })),
      };

      accessLogger.log(
        "connection" as never,
        request as never,
        "extra" as never,
      );

      expect(threads.postMessage.mock.calls).toEqual([
        [
          {
            connection: "connection",
            extra: "extra",
            request: {
              data: "data",
              // The result is dropped on purpose: anything stringifiable may
              // sit there, and not everything stringifiable survives the
              // structured clone to a worker thread.
              options: { error: "error", result: undefined, status: "status" },
            },
            size: Buffer.byteLength(JSON.stringify("response")).toString(),
          },
        ],
      ]);
    });

    it("discards log requests while inactive", async () => {
      global.kuzzle.config.server = transportsConfig(console_(true));

      const { AccessLogger } = await loadSubject();
      const accessLogger = new AccessLogger();

      await accessLogger.init();

      accessLogger.log(
        "connection" as never,
        { serialize: vi.fn(() => "serialized") } as never,
        "extra" as never,
      );

      expect(threads.postMessage).not.toHaveBeenCalled();
    });
  });
});

describe("AccessLoggerWorker", () => {
  let worker: any;
  let AccessLoggerWorker: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    pinoStub.pino.mockReturnValue(pinoStub.logger);
    stubKuzzle({ id: "knode-test" });

    ({ AccessLoggerWorker } = await loadSubject());

    worker = new AccessLoggerWorker(transportsConfig(console_(false)), "-1");
  });

  afterEach(() => {
    restoreKuzzle();
  });

  describe("#initTransport", () => {
    it("builds one pino target per supported transport", () => {
      worker.config.logs.transports = [
        { level: "info", transport: "console" },
        {
          level: "info",
          options: { append: true, destination: "filename", mkdir: true },
          transport: "file",
        },
        { level: "info", options: {}, transport: "elasticsearch" },
      ];

      worker.initTransport();

      expect(pinoStub.transport.mock.calls).toEqual([
        [
          {
            targets: [
              {
                level: "info",
                options: { destination: 1 },
                target: "pino/file",
              },
              {
                level: "info",
                options: { append: true, destination: "filename", mkdir: true },
                target: "pino/file",
              },
              { level: "info", options: {}, target: "pino-elasticsearch" },
            ],
          },
        ],
      ]);
      expect(pinoStub.pino).toHaveBeenCalledTimes(1);
    });
  });

  describe("#logAccess", () => {
    beforeEach(() => {
      worker.initTransport();
      worker.logger = { info: vi.fn() };
    });

    it('forwards the request as an object in "logstash" format', () => {
      const request = new KuzzleRequest({ foo: "bar" });
      const error = new InternalError("test");
      const connection = new ClientConnection("protocol", ["1.2.3.4"]);

      error.status = 444;
      request.setError(error);

      worker.config.logs.accessLogFormat = "logstash";
      worker.logAccess(connection, request);

      expect(worker.logger.info.mock.calls).toEqual([
        [
          {
            connection,
            error,
            extra: null,
            namespace: "kuzzle:accessLogs",
            nodeId: "knode-test",
            request: request.input,
            status: 444,
          },
        ],
      ]);
    });

    it("outputs a combined log line for an http request", () => {
      const connection = new ClientConnection(
        "HTTP/1.1",
        ["1.1.1.1", "2.2.2.2"],
        { referer: "http://referer.com", "user-agent": "user agent" },
      );
      const request = new KuzzleRequest(
        { collection: "collection", index: "index" },
        { token: { userId: "admin" } },
      );

      request.status = 444;
      worker.config.logs.accessLogFormat = "combined";
      worker.config.logs.accessLogIpOffset = 1;

      worker.logAccess(connection, request, "327", {
        method: "METHOD",
        url: "url",
      });

      expect(worker.logger.info).toHaveBeenCalledTimes(1);
      expect(worker.logger.info.mock.calls[0][0]).toEqual({
        namespace: "kuzzle:accessLogs",
        nodeId: "knode-test",
      });
      expect(worker.logger.info.mock.calls[0][1]).toMatch(
        /^1\.1\.1\.1 - admin \[\d\d\/[A-Z][a-z]{2}\/\d{4}:\d\d:\d\d:\d\d [+-]\d{4}] "METHOD url HTTP\/1\.1" 444 327 "http:\/\/referer.com" "user agent"$/,
      );
    });

    it("rebuilds a pseudo url for a non-http protocol, from the request's token", () => {
      const request = new KuzzleRequest(
        {
          action: "action",
          collection: "collection",
          controller: "controller",
          index: "index",
        },
        { token: { userId: "foobar" } },
      );
      const connection = new ClientConnection("websocket", ["ip"]);

      worker.logAccess(connection, request, "339");

      expect(worker.logger.info.mock.calls[0][1]).toMatch(
        /^ip - foobar \[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}] "DO \/controller\/action\/index\/collection WEBSOCKET" 102 339 - -$/,
      );
    });
  });

  describe("#init", () => {
    it("logs whatever the main thread sends over the parent port", async () => {
      const logAccess = vi
        .spyOn(worker, "logAccess")
        .mockImplementation(() => {});

      worker.init();

      expect(threads.onMessage).toHaveBeenCalledTimes(1);
      expect(threads.onMessage.mock.calls[0][0]).toBe("message");

      const onMessage = threads.onMessage.mock.calls[0][1] as (
        message: unknown,
      ) => void;
      const request = new KuzzleRequest({ foo: "bar" });

      onMessage({
        connection: "connection",
        extra: "extra",
        request: request.serialize(),
        size: "123",
      });

      // Imported after the reset, like the subject's own copy: a statically
      // imported class is a different object once `loadSubject` has
      // re-evaluated the graph, and `instanceof` never matches across the two.
      const { KuzzleRequest: FreshRequest } =
        await import("../../../lib/api/request");

      expect(logAccess).toHaveBeenCalledTimes(1);
      expect(logAccess.mock.calls[0][0]).toBe("connection");
      expect(logAccess.mock.calls[0][1]).toBeInstanceOf(FreshRequest);
      expect(logAccess.mock.calls[0][2]).toBe("123");
      expect(logAccess.mock.calls[0][3]).toBe("extra");
    });
  });
});
