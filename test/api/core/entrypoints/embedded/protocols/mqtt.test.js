const
  Bluebird = require('bluebird'),
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../../../mocks/kuzzle.mock');

describe('/lib/api/core/entrypoints/embedded/protocols/mqtt', () => {
  const moscaOnMock = sinon.stub();
  moscaOnMock
    .withArgs('ready')
    .yields();

  const moscaMock = function (config) {
    this.config = config;
    this.on = moscaOnMock;
    this.publish = sinon.spy();
  };

  mockrequire('mosca', {
    Server: moscaMock
  });
  const MqttProtocol = mockrequire.reRequire('../../../../../../lib/api/core/entrypoints/embedded/protocols/mqtt');

  let
    clock,
    entrypoint,
    kuzzle,
    protocol;

  before(() => {
    clock = sinon.useFakeTimers();
  });

  after(() => {
    clock.restore();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    entrypoint = {
      kuzzle,
      config: {
        maxRequestSize: 42,
        protocols: {
          mqtt: {
            enabled: true,
            foo: 'bar'
          }
        }
      },
      execute: sinon.spy(),
      newConnection: sinon.spy(),
      removeConnection: sinon.spy()
    };

    protocol = new MqttProtocol();
    return protocol.init(entrypoint);
  });

  describe('#init', () => {
    it('should attach events', () => {
      protocol.onConnection = sinon.spy();
      protocol.onDisconnection = sinon.spy();
      protocol.onMessage = sinon.spy();

      should(protocol.server.on)
        .be.calledWith('clientConnected')
        .be.calledWith('clientDisconnecting')
        .be.calledWith('clientDisconnected')
        .be.calledWith('published');

      {
        const cb = protocol.server.on.getCall(1).args[1];
        cb('test');
        should(protocol.onConnection)
          .be.calledOnce()
          .be.calledWith('test');
      }
      {
        const cb = protocol.server.on.getCall(2).args[1];
        cb('test');
        should(protocol.onDisconnection)
          .be.calledOnce()
          .be.calledWith('test');
      }
      {
        const cb = protocol.server.on.getCall(3).args[1];
        cb('test');
        should(protocol.onDisconnection)
          .be.calledTwice();
      }
      {
        const cb = protocol.server.on.getCall(4).args[1];
        cb('packet', 'client');
        should(protocol.onMessage)
          .be.calledOnce()
          .be.calledWith('packet', 'client');
      }

    });
  });

  describe('#authorizePublish', () => {
    let
      auth;

    beforeEach(() => {
      auth = Bluebird.promisify(protocol.server.authorizePublish);
    });

    it('should restrict to the requestTopic if allowPubSub is set to false', () => {
      protocol.config.allowPubSub = false;

      const tests = [];

      tests.push(auth('client', 'topic', 'payload')
        .then(res => should(res).be.false())
      );

      tests.push(auth('client', protocol.config.requestTopic, 'payload')
        .then(res => should(res).be.true())
      );

      return Bluebird.all(tests);
    });

    it('should allow any topic different than the response one, provided it does not contain any wildcard', () => {
      protocol.config.allowPubSub = true;

      const tests = [];

      tests.push(auth('client', 'topic', 'payload')
        .then(res => should(res).be.true())
      );

      tests.push(auth('client', protocol.config.responseTopic, 'payload')
        .then(res => should(res).be.false())
      );

      tests.push(auth('client', 'wildcard#forbidden', 'payload')
        .then(res => should(res).be.false())
      );

      tests.push(auth('client', 'wildcard+forbidden', 'payload')
        .then(res => should(res).be.false())
      );

      return Bluebird.all(tests);
    });
  });

  describe('#authorizeSubscribe', () => {
    let
      auth;

    beforeEach(() => {
      auth = Bluebird.promisify(protocol.server.authorizeSubscribe);
    });

    it('should allow any topic different than the request one, provided it does not contain any wildcard', () => {
      const tests = [];

      tests.push(auth('client', 'topic')
        .then(res => should(res).be.true())
      );

      tests.push(auth('client', protocol.config.requestTopic)
        .then(res => should(res).be.false())
      );

      tests.push(auth('client', 'wildcard#forbidden')
        .then(res => should(res).be.false())
      );

      tests.push(auth('client', 'wilcard+forbidden')
        .then(res => should(res).be.false())
      );

      return Bluebird.all(tests);
    });
  });

  describe('#broadcast', () => {
    it('should dispatch data to all channels', () => {
      protocol.broadcast({
        payload: 'payload',
        channels: [
          'ch1',
          'ch2'
        ]
      });

      should(protocol.server.publish)
        .be.calledTwice()
        .be.calledWith({topic: 'ch1', payload: '"payload"'});
    });
  });

  describe('#disconnect', () => {
    it('should close the matching connection', () => {
      const connection = {
        id: 'id',
        close: sinon.spy()
      };

      protocol.connectionsById.id = connection;

      protocol.disconnect('id');

      should(connection.close)
        .be.calledOnce();
    });
  });

  describe('#notify', () => {
    it('should forward the payload to the matching clients', () => {
      protocol.connectionsById = {
        id: {
          forward: sinon.spy()
        },
        foo: {
          forward: sinon.spy()
        }
      };

      protocol.notify({
        connectionId: 'id',
        payload: 'payload',
        channels: [
          'ch1',
          'ch2'
        ]
      });

      should(protocol.connectionsById.id.forward)
        .be.calledTwice()
        .be.calledWith('ch1', '"payload"', {}, 'ch1', 0);

      should(protocol.connectionsById.foo.forward)
        .have.callCount(0);
    });
  });

});
