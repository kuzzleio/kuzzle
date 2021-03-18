'use strict';

const sinon = require('sinon');
const uWS = require('uWebSockets.js');

class MockSocket {
  constructor () {
    this.subscribe = sinon.stub();
    this.unsubscribe = sinon.stub();
    this.end = sinon.stub();
    this.getRemoteAddressAsText = sinon.stub().returns(Buffer.from('1.2.3.4'));
    this.cork = sinon.stub().yields();
    this.getBufferedAmount = sinon.stub().returns(0);
    this.send = sinon.stub();
  }
}

class App {
  constructor () {
    this._wsConfig = null;
    this._mockSocket = new MockSocket();

    this.listen = sinon.stub().yields('not null');
    this.ws = sinon.stub().callsFake((path, opts) => {
      this._wsConfig = opts;
    });

    this.any = sinon.stub();
    this.publish = sinon.stub();
  }

  _mockCreateNewSocket () {
    this._mockSocket = new MockSocket();
  }

  _mockTriggerOnOpen () {
    if (!this._wsConfig || !this._wsConfig.open) {
      throw new Error('Missing "open" handler');
    }

    this._wsConfig.open(this._mockSocket);
  }

  _mockTriggerOnClose (code, message) {
    if (!this._wsConfig || !this._wsConfig.close) {
      throw new Error('Missing "close" handler');
    }

    this._wsConfig.close(this._mockSocket, code, message);
  }

  _mockTriggerOnMessage (data) {
    if (!this._wsConfig || !this._wsConfig.message) {
      throw new Error('Missing "message" handler');
    }

    this._wsConfig.message(this._mockSocket, data);
  }

  _mockTriggerOnDrain () {
    if (!this._wsConfig || !this._wsConfig.drain) {
      throw new Error('Missing "drain" handler');
    }

    this._wsConfig.drain(this._mockSocket);
  }
}

module.exports = {
  App: () => new App(),
  MockSocket,
  SHARED_COMPRESSOR: uWS.SHARED_COMPRESSOR,
  DISABLED: uWS.DISABLED,
};
