"use strict";

const sinon = require("sinon");
const should = require("should");
const mockRequire = require("mock-require");

const { KuzzleRequest } = require("../../../lib/api/request");
const {
  InternalError: KuzzleInternalError,
} = require("../../../lib/kerror/errors/internalError");
const ClientConnection = require("../../../lib/core/network/clientConnection");

const KuzzleMock = require("../../mocks/kuzzle.mock");

describe("#AccessLogger", () => {
  let kuzzle;
  let postMessage;
  let parentPort;
  let parentPortCallback;
  let workerData;
  let workerArgs;

  before(() => {
    postMessage = sinon.stub();
    parentPort = {
      on: sinon.stub().callsFake((ev, fn) => {
        should(ev).eql("message");
        parentPortCallback = fn;
      }),
    };

    mockRequire("worker_threads", {
      Worker: function (...args) {
        workerArgs = args;
        workerData = args[1].workerData;
        return { postMessage };
      },
      isMainThread: true,
      parentPort,
      workerData,
    });

    mockRequire("pino", {
      transport: sinon.stub(),
    });
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.ask.withArgs("core:security:user:anonymous:get").resolves({
      _id: "-1",
    });

    workerData = {};
    workerArgs = null;
    postMessage.resetHistory();
    parentPort.on.resetHistory();
  });

  describe("#AccessLogger", () => {
    let AccessLogger;
    let accessLogger;

    beforeEach(() => {
      ({ AccessLogger } = mockRequire.reRequire(
        "../../../lib/core/network/accessLogger",
      ));
      accessLogger = new AccessLogger();
    });

    it("should create a new worker thread when logs are active", async () => {
      kuzzle.config.server.logs.transports = [
        {
          transport: "console",
          level: "info",
          stderrLevels: [],
          silent: true,
        },
        {
          transport: "file",
          level: "info",
          stderrLevels: [],
          silent: false,
        },
        {
          transport: "elasticsearch",
          level: "info",
          stderrLevels: [],
          silent: true,
        },
      ];

      await accessLogger.init();

      should(accessLogger.isActive).be.true();
      should(workerArgs)
        .be.Array()
        .and.match([
          require.resolve("../../../lib/core/network/accessLogger"),
          { workerData },
        ]);

      should(workerData).match({
        anonymousUserId: "-1",
        config: kuzzle.config.server,
        kuzzleId: global.nodeId,
      });
    });

    it("should print an error log if an unusable transport is found", async () => {
      kuzzle.config.server.logs.transports = [
        {
          transport: "ohnoes",
          level: "info",
          stderrLevels: [],
          silent: false,
        },
      ];

      await accessLogger.init();

      should(accessLogger.isActive).be.false();
      should(workerArgs).be.null();
      should(accessLogger.logger.error).calledWith(
        'Failed to initialize logger transport "ohnoes": unsupported transport. Skipped.',
      );
    });

    it("should disable access logs when no suitable transports are found", async () => {
      kuzzle.config.server.logs.transports = [
        {
          transport: "console",
          level: "info",
          stderrLevels: [],
          silent: true,
        },
        {
          transport: "file",
          level: "info",
          stderrLevels: [],
          silent: true,
        },
        {
          transport: "ohnoes",
          level: "info",
          stderrLevels: [],
          silent: false,
        },
      ];

      await accessLogger.init();

      should(accessLogger.isActive).be.false();
      should(workerArgs).be.null();
    });

    it("should send the log message to the worker when asked to log something", async () => {
      const fakeRequest = {
        response: "response",
        serialize: sinon.stub().returns({
          data: "data",
          options: {
            error: "error",
            result: "result",
            status: "status",
          },
        }),
      };

      kuzzle.config.server.logs.transports = [
        {
          transport: "console",
          level: "info",
          stderrLevels: [],
          silent: false,
        },
      ];

      await accessLogger.init();
      global.nodeId = "test-nodeId";
      accessLogger.log("connection", fakeRequest, { nodeId: "test-nodeId" });

      should(postMessage)
        .calledOnce()
        .calledWithMatch({
          connection: "connection",
          extra: { nodeId: "test-nodeId" },
          request: {
            data: "data",
            options: {
              error: "error",
              result: undefined,
              status: "status",
            },
          },
          size: Buffer.byteLength(JSON.stringify("response")).toString(),
        });
    });

    it("should discard log requests if the logger is inactive", async () => {
      const fakeRequest = {
        serialize: sinon.stub().returns("serialized"),
      };

      kuzzle.config.server.logs.transports = [
        {
          transport: "console",
          level: "info",
          stderrLevels: [],
          silent: true,
        },
      ];

      await accessLogger.init();

      accessLogger.log("connection", fakeRequest, "extra");

      should(postMessage).not.called();
    });
  });

  describe("#AccessLoggerWorker", () => {
    let AccessLoggerWorker;
    let accessLoggerWorker;
    const logger = { info: sinon.stub() };
    const pinoTransportMock = sinon.stub();
    const pinoMock = sinon.stub().returns(logger);

    before(() => {
      mockRequire("pino", {
        transport: pinoTransportMock,
        pino: pinoMock,
      });
      ({ AccessLoggerWorker } = mockRequire.reRequire(
        "../../../lib/core/network/accessLogger",
      ));
    });

    beforeEach(() => {
      accessLoggerWorker = new AccessLoggerWorker(
        {
          logs: {
            transports: [
              {
                transport: "console",
                level: "info",
                stderrLevels: [],
                silent: false,
              },
            ],
            accessLogFormat: "combined",
            accessLogIpOffset: 0,
          },
        },
        "-1",
      );
    });

    afterEach(() => {
      logger.info.reset();
      pinoTransportMock.reset();
      pinoMock.reset();
    });

    describe("#initTransport", () => {
      it("should support all available transports", () => {
        accessLoggerWorker.config.logs.transports = [];

        for (let i = 0; i < 3; i++) {
          accessLoggerWorker.config.logs.transports.push(
            Object.assign({}, accessLoggerWorker.config.logs.access),
          );
        }

        Object.assign(accessLoggerWorker.config.logs.transports[0], {
          transport: "console",
        });

        Object.assign(accessLoggerWorker.config.logs.transports[1], {
          options: {
            append: true,
            destination: "filename",
            mkdir: true,
          },
          transport: "file",
        });

        Object.assign(accessLoggerWorker.config.logs.transports[2], {
          options: {},
          transport: "elasticsearch",
        });

        accessLoggerWorker.initTransport();

        const expectedTransports = {
          targets: [
            {
              level: "info",
              options: {
                destination: 1,
              },
              target: "pino/file",
            },
            {
              level: "info",
              options: {
                append: true,
                destination: "filename",
                mkdir: true,
              },
              target: "pino/file",
            },
            {
              level: "info",
              options: {},
              target: "pino-elasticsearch",
            },
          ],
        };

        should(pinoTransportMock)
          .be.calledOnce()
          .be.calledWithMatch(expectedTransports);
        should(pinoMock).be.calledOnce();
      });
    });

    describe("#logAccess", () => {
      beforeEach(() => {
        accessLoggerWorker.config.logs.transports = [
          {
            transport: "console",
            level: "info",
            stderrLevels: [],
            silent: false,
          },
        ];

        accessLoggerWorker.initTransport();
        accessLoggerWorker.logger = {
          info: sinon.spy(),
        };
      });

      it('should forward the params to the logger when using "logstash" format output', () => {
        const request = new KuzzleRequest({ foo: "bar" });
        const error = new KuzzleInternalError("test");
        const connection = new ClientConnection("protocol", ["1.2.3.4"]);

        error.status = 444;
        request.setError(error);

        accessLoggerWorker.config.logs.accessLogFormat = "logstash";
        accessLoggerWorker.logAccess(connection, request);

        should(accessLoggerWorker.logger.info)
          .be.calledOnce()
          .be.calledWithMatch({
            connection,
            error: error,
            extra: null,
            namespace: "kuzzle:accessLogs",
            nodeId: global.kuzzle.id,
            request: request.input,
            status: 444,
          });
      });

      it("should output combined logs from an http request", () => {
        const connection = new ClientConnection(
          "HTTP/1.1",
          ["1.1.1.1", "2.2.2.2"],
          {
            referer: "http://referer.com",
            "user-agent": "user agent",
          },
        );

        const extra = { method: "METHOD", url: "url" };
        const request = new KuzzleRequest(
          {
            collection: "collection",
            index: "index",
          },
          {
            token: {
              userId: "admin",
            },
          },
        );

        request.status = 444;

        accessLoggerWorker.config.logs.accessLogFormat = "combined";
        accessLoggerWorker.config.logs.accessLogIpOffset = 1;

        accessLoggerWorker.logAccess(connection, request, "327", extra);

        should(accessLoggerWorker.logger.info)
          .be.calledOnce()
          .be.calledWithMatch(
            {
              namespace: "kuzzle:accessLogs",
              nodeId: global.kuzzle.id,
            },
            /^1\.1\.1\.1 - admin \[\d\d\/[A-Z][a-z]{2}\/\d{4}:\d\d:\d\d:\d\d [+-]\d{4}] "METHOD url HTTP\/1\.1" 444 327 "http:\/\/referer.com" "user agent"$/,
          );
      });

      it("should use the already verified user from the request, if available", () => {
        const request = new KuzzleRequest(
          {
            action: "action",
            collection: "collection",
            controller: "controller",
            index: "index",
          },
          {
            token: {
              userId: "foobar",
            },
          },
        );
        const connection = new ClientConnection("websocket", ["ip"]);

        accessLoggerWorker.logAccess(connection, request, "339");

        should(accessLoggerWorker.logger.info)
          .be.calledOnce()
          .be.calledWithMatch(
            {
              namespace: "kuzzle:accessLogs",
              nodeId: global.kuzzle.id,
            },
            /^ip - foobar \[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}] "DO \/controller\/action\/index\/collection WEBSOCKET" 102 339 - -$/,
          );
      });
    });

    describe("#messaging", () => {
      it("should log upon receiving a message from the main thread", () => {
        sinon.stub(accessLoggerWorker, "logAccess");

        accessLoggerWorker.init();

        should(parentPort.on).calledOnce();
        should(parentPortCallback).be.a.Function();

        const request = new KuzzleRequest({ foo: "bar" });

        parentPortCallback({
          connection: "connection",
          request: request.serialize(),
          extra: "extra",
          size: "123",
        });

        should(accessLoggerWorker.logAccess)
          .calledOnce()
          .calledWith(
            "connection",
            sinon.match.instanceOf(KuzzleRequest),
            "123",
            "extra",
          );
      });
    });
  });
});
