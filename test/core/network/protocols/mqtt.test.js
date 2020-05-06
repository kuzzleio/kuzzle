'use strict';

const Bluebird = require('bluebird');
const mockrequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const { errors: { BadRequestError } } = require('kuzzle-common-objects');
const errorMatcher = require('../../../util/errorMatcher');

describe('/lib/core/network/protocols/mqtt', () => {
  const moscaOnMock = sinon.stub();
  const moscaMock = function (config) {
    this.config = config;
    this.on = moscaOnMock;
    this.publish = sinon.spy();
  };

  let
    entrypoint,
    kuzzle,
    protocol,
    MqttProtocol;

  before(() => {
    moscaOnMock
      .withArgs('ready')
      .yields();

    mockrequire('mosca', {
      Server: moscaMock
    });

    MqttProtocol = mockrequire.reRequire('../../../../lib/core/network/protocols/mqtt');
  });

  after(() => {
    mockrequire.stopAll();
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
  });

  describe('#init', () => {
    it('should return false if the protocol is disabled', () => {
      entrypoint.config.protocols.mqtt.enabled = false;

      return should(protocol.init(entrypoint)).fulfilledWith(false);
    });

    it('should attach events', () => {
      return protocol.init(entrypoint)
        .then(() => {
          protocol.onConnection = sinon.stub();
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
  });

  describe('#authorizePublish', () => {
    let
      auth;

    beforeEach(() => {
      return protocol.init(entrypoint)
        .then(() => {
          auth = Bluebird.promisify(protocol.server.authorizePublish);
        });
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
      return protocol.init(entrypoint)
        .then(() => {
          auth = Bluebird.promisify(protocol.server.authorizeSubscribe);
        });
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
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

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

      protocol.connectionsById.set('id', connection);

      protocol.disconnect('id');

      should(connection.close)
        .be.calledOnce();
    });
  });

  describe('#notify', () => {
    it('should forward the payload to the matching clients', () => {

      protocol.connectionsById.set('id', {forward: sinon.spy()});
      protocol.connectionsById.set('foo', {forward: sinon.spy()});
      protocol.notify({
        connectionId: 'id',
        payload: 'payload',
        channels: [
          'ch1',
          'ch2'
        ]
      });

      should(protocol.connectionsById.get('id').forward)
        .be.calledTwice()
        .be.calledWith('ch1', '"payload"', {}, 'ch1', 0);

      should(protocol.connectionsById.get('foo').forward)
        .have.callCount(0);
    });
  });

  describe('#onConnection', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should register new connections', () => {
      const client = {
        connection: {
          stream: {
            remoteAddress: 'ip'
          }
        }
      };

      protocol.onConnection(client);

      should(protocol.connections.size).eql(1);
      should(protocol.connectionsById.size).eql(1);

      const connectionId = protocol.connectionsById.entries().next().value[0];
      should(protocol.connections.get(client).id)
        .be.exactly(connectionId);

      should(entrypoint.newConnection)
        .be.calledOnce();
    });
  });

  describe('#onDisconnection', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should do nothing if the connection is unknown', () => {
      protocol.onDisconnection({});

      should(entrypoint.removeConnection)
        .have.callCount(0);
    });

    it('should remove the connection', () => {
      const
        clock = sinon.useFakeTimers(),
        client = {};

      protocol.connections.set(client, {id: 'id'});
      protocol.connectionsById.set('id', client);

      protocol.onDisconnection(client);
      clock.tick(protocol.config.disconnectDelay + 1);

      should(entrypoint.removeConnection)
        .be.calledOnce()
        .be.calledWith('id');

      clock.restore();
    });

  });

  describe('#onMessage', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should do nothing if topic is not the request one of if the payload is not valid', () => {
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

    it('should do nothing if the connection is unknown', () => {
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

      should(entrypoint.execute)
        .be.calledOnce();

      const request = entrypoint.execute.firstCall.args[0];
      should(request.serialize())
        .match({
          data: {
            foo: 'bar'
          },
          options: {
            connection: {
              id: 'id',
              protocol: protocol.name
            }
          }
        });

      const cb = entrypoint.execute.firstCall.args[1];
      cb({content: 'response'});
      should(client.forward)
        .be.calledOnce()
        .be.calledWith(protocol.config.responseTopic, '"response"', {}, protocol.config.responseTopic, 0);
    });

    it('should respond with an error if the payload cannot be parsed', () => {
      const nodeEnv = process.env.NODE_ENV;

      for (const env of ['production', '', 'development']) {
        process.env.NODE_ENV = env;
        protocol._respond = sinon.spy();

        const client = {
          id: 'clientId',
          forward: sinon.spy()
        };
        protocol.connections.set(client, {id: 'id', protocol: 'mqtt'});

        protocol.onMessage({
          topic: protocol.config.requestTopic,
          payload: Buffer.from('invalid')
        }, client);

        const matcher = errorMatcher.fromMessage(
          'network',
          'mqtt',
          'unexpected_error',
          'Unexpected token i in JSON at position 0');

        should(protocol._respond)
          .be.calledOnce()
          .be.calledWith(client, sinon.match(matcher));

        protocol._respond.resetHistory();
      }

      process.env.NODE_ENV = nodeEnv;
    });

    it('should respond with an error if the requestId is not a string', () => {
      protocol._respond = sinon.spy();

      const client = {
        id: 'clientId',
        forward: sinon.spy()
      };
      protocol.connections.set(client, {id: 'id', protocol: 'mqtt'});

      protocol.onMessage({
        topic: protocol.config.requestTopic,
        payload: Buffer.from(JSON.stringify({ requestId: 42 }))
      }, client);

      should(protocol._respond)
        .be.calledOnce()
        .be.calledWith(client);

      const response = protocol._respond.firstCall.args[1];
      should(response.content.error)
        .be.an.instanceOf(BadRequestError);
    });
  });

  describe('#_respond', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should broadcast if in development mode', () => {
      const client = {
        forward: sinon.spy()
      };
      const currentEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      protocol.broadcast = sinon.spy();
      protocol.config.developmentMode = true;

      protocol._respond(client, {content: 'response'});
      process.env.NODE_ENV = currentEnv;

      should(protocol.broadcast)
        .be.calledOnce()
        .be.calledWith({
          channels: [protocol.config.responseTopic],
          payload: 'response'
        });

      should(client.forward)
        .have.callCount(0);
    });
  });
});
