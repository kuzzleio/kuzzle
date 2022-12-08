"use strict";

const sinon = require("sinon");
const uWS = require("uWebSockets.js");

class MockSocket {
  constructor() {
    this.subscribe = sinon.stub();
    this.unsubscribe = sinon.stub();
    this.end = sinon.stub();
    this.getRemoteAddressAsText = sinon.stub().returns(Buffer.from("1.2.3.4"));
    this.cork = sinon.stub().yields();
    this.getBufferedAmount = sinon.stub().returns(0);
    this.send = sinon.stub();
  }
}

class MockHttpRequest {
  constructor(method = "", url = "", qs = "", headers = {}) {
    this._method = method.toUpperCase();
    this._url = url;
    this._qs = qs;
    this._headers = headers;
    this.response = {
      setHeader: sinon.stub(),
      status: "200 OK",
    };
  }

  getQuery() {
    return this._qs;
  }

  getMethod() {
    return this._method;
  }

  getUrl() {
    return this._url;
  }

  forEach(cb) {
    for (const [name, value] of Object.entries(this._headers)) {
      cb(name, value);
    }
  }

  getHeader(name) {
    return this._headers[name];
  }
}

class MockHttpResponse {
  constructor() {
    this._onDataHandler = null;
    this._onAbortedHandler = null;
    this._onWritableHandler = null;

    this.cork = sinon.stub().yields();
    this.writeStatus = sinon.stub();
    this.writeHeader = sinon.stub();
    this.end = sinon.stub();
    this.getRemoteAddressAsText = sinon.stub().returns("1.2.3.4");
    this.tryEnd = sinon.stub().returns([true, null]);
    this.getWriteOffset = sinon.stub().returns(0);
    this.write = sinon.stub().returns(false);

    this.upgrade = sinon.stub();

    this.onData = sinon
      .stub()
      .callsFake((handler) => (this._onDataHandler = handler));

    this.onWritable = sinon
      .stub()
      .callsFake((handler) => (this._onWritableHandler = handler));

    this.onAborted = sinon
      .stub()
      .callsFake((handler) => (this._onAbortedHandler = handler));
  }

  _onData(data, isLast) {
    return this._onDataHandler(data, isLast);
  }

  _onAborted() {
    this._onAbortedHandler();
  }

  _onWritable(offset) {
    this._onWritableHandler(offset);
  }
}

class App {
  constructor() {
    this._wsConfig = null;
    this._httpMessageHandler = null;
    this._wsSocket = new MockSocket();
    this._httpResponse = null;

    this.listen = sinon.stub().yields("not null");
    this.ws = sinon.stub().callsFake((path, opts) => {
      this._wsConfig = opts;
    });

    this.any = sinon.stub().callsFake((path, handler) => {
      this._httpMessageHandler = handler;
    });

    this.publish = sinon.stub();
    this.getParts = sinon.stub().returns([]);
  }

  _wsNewSocket() {
    this._wsSocket = new MockSocket();
  }

  _wsOnOpen() {
    if (!this._wsConfig || !this._wsConfig.open) {
      throw new Error('Missing "open" handler');
    }

    this._wsConfig.open(this._wsSocket);
  }

  _wsOnClose(code, message) {
    if (!this._wsConfig || !this._wsConfig.close) {
      throw new Error('Missing "close" handler');
    }

    this._wsConfig.close(this._wsSocket, code, message);
  }

  _wsOnMessage(data) {
    if (!this._wsConfig || !this._wsConfig.message) {
      throw new Error('Missing "message" handler');
    }

    return this._wsConfig.message(this._wsSocket, data);
  }

  _wsOnDrain() {
    if (!this._wsConfig || !this._wsConfig.drain) {
      throw new Error('Missing "drain" handler');
    }

    this._wsConfig.drain(this._wsSocket);
  }

  _wsOnUpgrade(response, request, context) {
    if (!this._wsConfig || !this._wsConfig.upgrade) {
      throw new Error('Missing "upgrade" handler');
    }

    this._wsConfig.upgrade(response, request, context);
  }

  _httpOnMessage(method, url, qs, headers) {
    this._httpResponse = new MockHttpResponse();

    return this._httpMessageHandler(
      this._httpResponse,
      new MockHttpRequest(method, url, qs, headers)
    );
  }
}

module.exports = {
  App: () => new App(),
  DISABLED: uWS.DISABLED,
  getParts: uWS.getParts,
  MockHttpRequest,
  MockHttpResponse,
  MockSocket,
  SHARED_COMPRESSOR: uWS.SHARED_COMPRESSOR,
};
