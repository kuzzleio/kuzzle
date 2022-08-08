"use strict";

const sinon = require("sinon");
const should = require("should");
const mockRequire = require("mock-require");
const uWS = require("uWebSockets.js");

const { KuzzleRequest } = require("../../../../lib/api/request");
const ClientConnection = require("../../../../lib/core/network/clientConnection");

const KuzzleMock = require("../../../mocks/kuzzle.mock");
const uWSMock = require("../../../mocks/uWS.mock");
const EntryPointMock = require("../../../mocks/entrypoint.mock");
const {
  MockHttpResponse,
  MockHttpRequest,
} = require("../../../mocks/uWS.mock");

describe("core/network/protocols/websocket", () => {
  let HttpWs;
  let kuzzle;
  let entryPoint;
  let httpWs;

  before(() => {
    mockRequire("uWebSockets.js", uWSMock);
    HttpWs = mockRequire.reRequire(
      "../../../../lib/core/network/protocols/httpwsProtocol"
    );
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entryPoint = new EntryPointMock({
      maxRequestSize: "1MB",
      port: 7512,
      protocols: {
        http: {
          allowCompression: true,
          enabled: true,
          maxEncodingLayers: 3,
          maxFormFileSize: "1MB",
        },
        websocket: {
          enabled: true,
          idleTimeout: 60000,
          compression: false,
          rateLimit: 0,
        },
      },
    });

    httpWs = new HttpWs();
  });

  afterEach(() => {
    clearInterval(httpWs.nowInterval);
  });

  describe("websocket configuration & initialization", () => {
    it("should disable websocket if no configuration can be found", async () => {
      entryPoint.config.protocols.websocket = undefined;
      kuzzle.log.warn.resetHistory();

      await should(httpWs.init(entryPoint));

      should(httpWs.server.ws).not.called();
      should(kuzzle.log.warn).calledWith(
        "[websocket] no configuration found for websocket: disabling it"
      );
    });

    it('should set a minimum value to "idleTimeout" if set too low', async () => {
      for (const tooLow of [0, 999]) {
        kuzzle.log.warn.resetHistory();

        entryPoint.config.protocols.websocket.idleTimeout = tooLow;
        await httpWs.init(entryPoint);

        should(httpWs.server.ws).calledWithMatch("/*", {
          idleTimeout: 60000,
        });

        should(kuzzle.log.warn).calledWith(
          '[websocket] The "idleTimeout" parameter can neither be deactivated or be set with a value lower than 1000. Defaulted to 60000.'
        );
      }
    });

    /**
     * @deprecated
     */
    it('should warn if the deprecated "heartbeat" argument is set', async () => {
      entryPoint.config.protocols.websocket.heartbeat = "foo";
      kuzzle.log.warn.resetHistory();

      await httpWs.init(entryPoint);

      should(kuzzle.log.warn).calledWith(
        '[websocket] The "heartbeat" parameter has been deprecated and is now ignored. The "idleTimeout" parameter should now be configured instead.'
      );
    });

    it("should not instantiate a websocket server if the protocol is disabled", async () => {
      entryPoint.config.protocols.websocket.enabled = false;
      await httpWs.init(entryPoint);

      should(httpWs.server.ws).not.called();
    });

    it("should start a websocket server according to the provided configuration", async () => {
      entryPoint.config.protocols.websocket = {
        enabled: true,
        idleTimeout: 12345,
        compression: true,
        rateLimit: 123,
      };
      entryPoint.config.maxRequestSize = "1kb";

      await httpWs.init(entryPoint);

      should(httpWs.server.ws).calledWithMatch("/*", {
        compression: uWS.SHARED_COMPRESSOR,
        idleTimeout: 12345,
        maxBackPressure: sinon.match.number,
        maxPayloadLength: 1024,
        upgrade: sinon.match.func,
        open: sinon.match.func,
        message: sinon.match.func,
        close: sinon.match.func,
        drain: sinon.match.func,
      });

      entryPoint.config.protocols.websocket.compression = false;

      await httpWs.init(entryPoint);

      should(httpWs.server.ws).calledWithMatch("/*", {
        compression: uWS.DISABLED,
      });
    });
  });

  describe("upgrade connection", () => {
    beforeEach(() => httpWs.init(entryPoint));

    it("should upgrade the connection and store the headers in the UserData if present", () => {
      const response = new MockHttpResponse();
      const request = new MockHttpRequest("", "", "", {
        cookie: "foo",
        origin: "my-website.com",
        "sec-websocket-key": "websocket-key",
        "sec-websocket-protocol": "websocket-protocol",
        "sec-websocket-extensions": "websocket-extension",
      });
      const context = {}; // context object
      httpWs.server._wsOnUpgrade(response, request, context);

      should(response.upgrade).be.calledWithMatch(
        {
          headers: {
            cookie: "foo",
            origin: "my-website.com",
            "sec-websocket-key": "websocket-key",
            "sec-websocket-protocol": "websocket-protocol",
            "sec-websocket-extensions": "websocket-extension",
          },
        },
        "websocket-key",
        "websocket-protocol",
        "websocket-extension",
        context
      );
    });
  });

  describe("new connection", () => {
    beforeEach(() => httpWs.init(entryPoint));

    it("should declare the connection to the entry point", () => {
      httpWs.server._wsOnOpen();

      should(entryPoint.newConnection).calledWithMatch({
        protocol: "websocket",
        ips: ["1.2.3.4"],
      });
    });

    it("should initialize the structure needed to keep track of the socket", () => {
      httpWs.server._wsOnOpen();

      const clientConnection = entryPoint.newConnection.firstCall.args[0];

      should(httpWs.connectionBySocket).have.value(
        httpWs.server._wsSocket,
        clientConnection
      );

      should(httpWs.socketByConnectionId).have.value(
        clientConnection.id,
        httpWs.server._wsSocket
      );

      should(httpWs.backpressureBuffer).have.value(httpWs.server._wsSocket, []);
    });
  });

  describe("ending a connection", () => {
    beforeEach(() => httpWs.init(entryPoint));

    it("should end gracefully if the socket is unknown", () => {
      should(() => httpWs.wsOnCloseHandler(null, 1001, null)).not.throw();
    });

    it("should clean up the memory associated to the closed connection", () => {
      httpWs.server._wsOnOpen();
      const openedSocket = httpWs.server._wsSocket;
      const openedClientConnection = entryPoint.newConnection.firstCall.args[0];

      httpWs.server._wsNewSocket();
      httpWs.server._wsOnOpen();
      const closedSocket = httpWs.server._wsSocket;
      const closedClientConnection =
        entryPoint.newConnection.secondCall.args[0];

      httpWs.server._wsOnClose();

      should(httpWs.connectionBySocket).have.value(
        openedSocket,
        openedClientConnection
      );
      should(httpWs.connectionBySocket).not.have.value(
        closedSocket,
        closedClientConnection
      );

      should(httpWs.socketByConnectionId).have.value(
        openedClientConnection.id,
        openedSocket
      );
      should(httpWs.socketByConnectionId).not.have.value(
        closedClientConnection.id,
        closedSocket
      );

      should(httpWs.backpressureBuffer).have.value(openedSocket, []);
      should(httpWs.backpressureBuffer).not.have.value(closedSocket, []);
    });
  });

  describe("message handler", () => {
    let socket;

    beforeEach(async () => {
      await httpWs.init(entryPoint);
      httpWs.server._wsOnOpen();
      socket = httpWs.server._wsSocket;
    });

    it("should discard the message if no data is provided", () => {
      httpWs.server._wsOnMessage(null);
      should(entryPoint.execute).not.be.called();

      httpWs.server._wsOnMessage(Buffer.from(""));
      should(entryPoint.execute).not.be.called();
    });

    it("should forward an error immediately if the payload cannot be parsed", () => {
      httpWs.server._wsOnMessage("{ohnoes}");

      should(httpWs.server._wsSocket.send).calledOnce();

      const payload = socket.send.firstCall.args[0];
      should(payload).be.instanceof(Buffer);

      const parsed = JSON.parse(payload.toString());
      should(parsed.error.id).eql("network.websocket.unexpected_error");
      should(parsed.error.message).match(/Unexpected token o in JSON/);

      should(entryPoint.execute).not.be.called();
    });

    it("should execute a standardized Request if a valid payload is provided", () => {
      entryPoint.execute.yields({ requestId: "foobar", content: {} });
      httpWs.server._wsOnMessage('{"controller":"foo","action":"bar"}');

      const clientConnection = entryPoint.newConnection.firstCall.args[0];

      should(entryPoint.execute)
        .calledOnce()
        .calledWithMatch(clientConnection, {
          input: {
            action: "bar",
            controller: "foo",
          },
          context: {
            connection: {
              protocol: "websocket",
              ips: ["1.2.3.4"],
            },
          },
        });

      should(entryPoint.execute.firstCall.args[0]).instanceof(ClientConnection);
      should(entryPoint.execute.firstCall.args[1]).instanceof(KuzzleRequest);

      const payload = socket.send.firstCall.args[0];
      should(payload).be.instanceof(Buffer);

      const parsed = JSON.parse(payload.toString());
      should(parsed).match({ room: "foobar" });
    });

    it("should respond with an error if it cannot cast to a KuzzleRequest object", () => {
      httpWs.server._wsOnMessage('{"controller": 123}');

      should(entryPoint.execute).not.called();

      const payload = socket.send.firstCall.args[0];
      should(payload).be.instanceof(Buffer);

      const parsed = JSON.parse(payload.toString());
      should(parsed).match({
        error: {
          message: 'Attribute controller must be of type "string"',
        },
        status: 400,
      });
    });

    it("should enforce the rate limit if one is set", () => {
      httpWs.wsConfig.rateLimit = 2;

      httpWs.server._wsOnMessage('{"controller":"foo", "action":"bar"}');
      should(socket.count).eql(1);
      should(socket.last).eql(httpWs.now);
      should(entryPoint.execute).calledOnce();

      entryPoint.execute.resetHistory();
      httpWs.server._wsOnMessage('{"controller":"foo", "action":"bar"}');
      should(socket.count).eql(2);
      should(entryPoint.execute).calledOnce();

      entryPoint.execute.resetHistory();
      httpWs.server._wsOnMessage('{"controller":"foo", "action":"bar"}');
      should(socket.count).eql(3);
      should(entryPoint.execute).not.called();

      const payload = socket.send.thirdCall.args[0];
      should(payload).be.instanceof(Buffer);

      const parsed = JSON.parse(payload.toString());
      should(parsed).match({
        error: {
          id: "network.websocket.ratelimit_exceeded",
        },
        status: 429,
      });
    });

    it("should send an applicative PONG response to an applicative PING request", () => {
      httpWs.server._wsOnMessage('{"p":1}');

      should(entryPoint.execute).not.called();

      let payload = socket.send.firstCall.args[0];
      should(payload).be.instanceof(Buffer);
      should(payload.toString()).eql('{"p":2}');

      httpWs.server._wsOnMessage(
        '{"p":1, "controller": "foo", "action":"bar"}'
      );
      should(entryPoint.execute).calledOnce();

      payload = socket.send.secondCall.args[0];
      should(payload).be.instanceof(Buffer);
      should(payload.toString()).not.eql('{"p":2}');
    });
  });

  describe("sending messages", () => {
    let socket;

    beforeEach(async () => {
      await httpWs.init(entryPoint);
      httpWs.server._wsOnOpen();
      socket = httpWs.server._wsSocket;
    });

    it("should discard the response if the socket is unknown (i.e. it no longer exists)", () => {
      httpWs.wsSend({}, Buffer.from("ohnoes"));

      should(socket.cork).not.called();
      should(socket.send).not.called();
      should(socket.end).not.called();
    });

    it("should send the message directly if backpressure allows it", () => {
      const payload = Buffer.from("foo");

      httpWs.wsSend(socket, payload);
      should(socket.cork).calledOnce();
      should(socket.send).calledOnce().calledWith(payload);
      should(socket.send.calledAfter(socket.cork)).be.true();
      should(socket.end).not.called();

      should(httpWs.backpressureBuffer.get(socket))
        .be.an.Array()
        .and.be.empty();
    });

    it("should queue the message if backpressure built up", () => {
      socket.getBufferedAmount.returns(8096);

      const payload = Buffer.from("foo");

      httpWs.wsSend(socket, payload);

      should(socket.cork).not.called();
      should(socket.send).not.called();
      should(socket.end).not.called();

      should(httpWs.backpressureBuffer.get(socket)).match([payload]);
    });

    it("should end the socket if the backpressure buffer is full", () => {
      httpWs.backpressureBuffer.get(socket).length = 51;
      socket.getBufferedAmount.returns(8096);

      httpWs.wsSend(socket, Buffer.from("foo"));

      should(socket.cork).not.called();
      should(socket.send).not.called();
      should(socket.end)
        .calledOnce()
        .calledWithMatch(
          1011,
          Buffer.from("too much backpressure: client is too slow")
        );
    });

    it("should drain the backpressure as much as possible", () => {
      const payload = Buffer.from("payload");

      const backpressure = httpWs.backpressureBuffer.get(socket);
      backpressure.length = 3;
      backpressure.fill(payload, 0);

      socket.getBufferedAmount.returns(0);
      socket.getBufferedAmount.onThirdCall().returns(8096);

      httpWs.server._wsOnDrain();

      should(socket.cork).calledOnce();

      should(socket.send).calledTwice().alwaysCalledWith(payload);

      should(backpressure.length).eql(1);
      should(backpressure[0]).eql(payload);
    });
  });

  describe("#disconnect", () => {
    beforeEach(() => httpWs.init(entryPoint));

    it("should ignore an unknown connection ID", () => {
      should(() => httpWs.disconnect("foo")).not.throw();
    });

    it("should forcibly end the client socket with a default message", () => {
      httpWs.server._wsOnOpen();
      const socket = httpWs.server._wsSocket;
      const clientConnection = entryPoint.newConnection.firstCall.args[0];

      httpWs.disconnect(clientConnection.id);

      should(socket.end).calledWithMatch(
        1011,
        Buffer.from("Connection closed by remote host")
      );
    });

    it("should forcibly end the client socket with the provided message", () => {
      httpWs.server._wsOnOpen();
      const socket = httpWs.server._wsSocket;
      const clientConnection = entryPoint.newConnection.firstCall.args[0];

      httpWs.disconnect(clientConnection.id, "message");

      should(socket.end).calledWithMatch(1011, Buffer.from("message"));
    });
  });

  describe("#joinChannel", () => {
    beforeEach(() => httpWs.init(entryPoint));

    it("should ignore an unknown connection ID", () => {
      should(() => httpWs.joinChannel("foo", "bar")).not.throw();
    });

    it("should make the socket subscribe on the provided channel name", () => {
      httpWs.server._wsOnOpen();
      const socket = httpWs.server._wsSocket;
      const clientConnection = entryPoint.newConnection.firstCall.args[0];

      httpWs.joinChannel("foobar", clientConnection.id);

      should(socket.subscribe).calledWith("realtime/foobar");
    });
  });

  describe("#leaveChannel", () => {
    beforeEach(() => httpWs.init(entryPoint));

    it("should ignore an unknown connection ID", () => {
      should(() => httpWs.leaveChannel("foo", "bar")).not.throw();
    });

    it("should make the socket unsubscribe from the provided channel name", () => {
      httpWs.server._wsOnOpen();
      const socket = httpWs.server._wsSocket;
      const clientConnection = entryPoint.newConnection.firstCall.args[0];

      httpWs.leaveChannel("foobar", clientConnection.id);

      should(socket.unsubscribe).calledWith("realtime/foobar");
    });
  });

  describe("#notify", () => {
    let socket;

    beforeEach(async () => {
      await httpWs.init(entryPoint);
      httpWs.server._wsOnOpen();
      socket = httpWs.server._wsSocket;
    });

    it("should ignore an unknown connection ID", () => {
      should(() => httpWs.notify({ connectionId: "foobar" })).not.throw();
    });

    it("should send as many notifications as there are channels", () => {
      const clientConnection = entryPoint.newConnection.firstCall.args[0];
      const channels = "abc".split("");

      httpWs.notify({
        channels,
        connectionId: clientConnection.id,
        payload: { foo: "bar" },
      });

      should(socket.send).calledThrice();

      for (const channel of channels) {
        should(socket.send).calledWithMatch(
          Buffer.from(JSON.stringify({ foo: "bar", room: channel }))
        );
      }
    });
  });

  describe("#broadcast", () => {
    beforeEach(async () => {
      await httpWs.init(entryPoint);
      httpWs.server._wsOnOpen();
    });

    it("should broadcast a notification for each channel", () => {
      const channels = "abc".split("");

      httpWs.broadcast({
        channels,
        payload: { foo: "bar" },
      });

      should(httpWs.server.publish).calledThrice();

      for (const channel of channels) {
        should(httpWs.server.publish).calledWithMatch(
          `realtime/${channel}`,
          Buffer.from(JSON.stringify({ foo: "bar", room: channel }))
        );
      }
    });
  });
});
