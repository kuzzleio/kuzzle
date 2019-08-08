'use strict';

const
  Bluebird = require('bluebird'),
  mockrequire = require('mock-require'),
  should = require('should'),
  sinon = require('sinon');

describe('mqtt', () => {
  const moscaOnMock = sinon.stub();
  moscaOnMock
    .withArgs('ready')
    .yields();
  const moscaMock = function (config) {
    // eslint-disable-next-line no-invalid-this
    this.config = config;
    // eslint-disable-next-line no-invalid-this
    this.on = moscaOnMock;
    // eslint-disable-next-line no-invalid-this
    this.publish = sinon.spy();
  };

  mockrequire('mosca', {
    Server: moscaMock
  });
  const MqttProtocol = mockrequire.reRequire('../lib/index');

  let
    context,
    clock,
    entrypoint,
    protocol;

  before(() => {
    clock = sinon.useFakeTimers();
  });

  after(() => {
    clock.restore();
  });

  beforeEach(() => {
    entrypoint = {
      config: {
        protocols: {
          mqtt: {
            foo: 'bar'
          }
        }
      },
      execute: sinon.spy(),
      newConnection: sinon.spy(),
      removeConnection: sinon.spy()
    };

    context = {
      ClientConnection: function () {
        this.id = 'foo';
      },
      debug: sinon.spy(),
      log: {
        info: sinon.spy(),
        error: sinon.spy()
      },
      Request: sinon.spy()
    };

    protocol = new MqttProtocol();
    return protocol.init(entrypoint, context);
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

      it('should allow allow any topic different than the response one, provided it does not contain any wildcard', () => {
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

        tests.push(auth('client', 'wildcard+forbidden')
          .then(res => should(res).be.false())
        );


        return Bluebird.all(tests);
      });
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

  describe('#onConnection', () => {
    it('should register new connections', () => {
      const client = {
        connection: {
          stream: {
            remoteAddress: 'ip'
          }
        }
      };

      protocol.onConnection(client);

      should(protocol.connections.size)
        .be.eql(1);
      should(Object.keys(protocol.connectionsById))
        .length(1);

      const connectionId = Object.keys(protocol.connectionsById)[0];
      should(protocol.connections.get(client).id)
        .be.exactly(connectionId);

      should(entrypoint.newConnection)
        .be.calledOnce();
    });

  });

  describe('#onDisconnection', () => {
    it('should do nothing if the connection is unknown', () => {
      protocol.onDisconnection({});

      should(entrypoint.removeConnection)
        .have.callCount(0);
    });

    it('should remove the connection', () => {
      const client = {};

      protocol.connections.set(client, {id: 'id'});
      protocol.connectionsById = {
        id: client
      };

      protocol.onDisconnection(client);
      clock.tick(protocol.config.disconnectDelay + 1);

      should(entrypoint.removeConnection)
        .be.calledOnce()
        .be.calledWith('id');
    });
  });

  describe('#onMessage', () => {
    it('should do nothing if topic is not the request one or if the payload is not valid', () => {
      // invalid topic
      protocol.onMessage({
        topic: 'topic',
        payload: 'payload'
      }, {id: 'id'});

      // invalid payload
      protocol.onMessage({
        topic: protocol.config.requestTopic
      }, {id: 'id'});

      // no client id
      protocol.onMessage({
        topic: protocol.config.requestTopic,
        payload: 'payload'
      }, {});

      should(entrypoint.execute)
        .have.callCount(0);
    });

    it('should do nothing if the connnection is unknown', () => {
      protocol.onMessage({
        topic: protocol.config.requestTopic,
        payload: 'payload'
      }, {id: 'foo'});

      should(entrypoint.execute)
        .have.callCount(0);
    });

    it('should forward the client payload to kuzzle and respond the client back', () => {
      const client = {
        id: 'clientId',
        forward: sinon.spy()
      };
      protocol.connections.set(client, {id: 'id', protocol: 'mqtt'});

      protocol.onMessage({
        topic: protocol.config.requestTopic,
        payload: Buffer.from(JSON.stringify({foo: 'bar'}))
      }, client);

      should(context.Request)
        .be.calledOnce()
        .be.calledWith({
          foo: 'bar'
        }, {
          connection: {
            id: 'id',
            protocol: 'mqtt'
          },
          connectionId: 'id',
          protocol: 'mqtt'
        });

      should(entrypoint.execute)
        .be.calledOnce();

      {
        const cb = entrypoint.execute.firstCall.args[1];

        cb({content: 'response'});
        should(client.forward)
          .be.calledOnce()
          .be.calledWith(protocol.config.responseTopic, '"response"', {}, protocol.config.responseTopic, 0);

      }
    });
  });

});

