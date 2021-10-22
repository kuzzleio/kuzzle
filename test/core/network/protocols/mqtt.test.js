'use strict';

const Bluebird = require('bluebird');
const mockrequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');

const { BadRequestError } = require('../../../../index');
const errorMatcher = require('../../../util/errorMatcher');

const KuzzleMock = require('../../../mocks/kuzzle.mock');
const EntryPointMock = require('../../../mocks/entrypoint.mock');

class AedesMock {
  constructor (config) {
    this.config = config;
    this.authorizePublish = null;
    this.authorizeSubscribe = null;
    this.handle = sinon.spy();
    this.on = sinon.stub();
    this.publish = sinon.spy();
  }
}

class FakeClient {
  constructor (id) {
    this.id = id;
    this.publish = sinon.stub();
    this.conn = { remoteAddress: 'ip' };
    this.close = sinon.stub();
  }
}

describe('/lib/core/network/entryPoint/protocols/mqttProtocol', () => {
  let netMock;
  let entrypoint;
  let protocol;
  let MqttProtocol;
  let fakeClient;

  before(() => {
    netMock = {
      createServer: sinon.stub().returns({
        listen: sinon.stub().callsArg(1)
      })
    };

    mockrequire('net', netMock);
    mockrequire('aedes', {Server: AedesMock});

    MqttProtocol = mockrequire.reRequire('../../../../lib/core/network/protocols/mqttProtocol');
  });

  after(() => {
    mockrequire.stopAll();
  });

  beforeEach(() => {
    new KuzzleMock();

    entrypoint = new EntryPointMock({
      maxRequestSize: 42,
      protocols: {
        mqtt: {
          enabled: true,
          foo: 'bar',
        }
      }
    });

    protocol = new MqttProtocol();
    fakeClient = new FakeClient('foo');
  });

  describe('#init', () => {
    it('should return false if the protocol is disabled', () => {
      entrypoint.config.protocols.mqtt.enabled = false;

      return should(protocol.init(entrypoint)).fulfilledWith(false);
    });

    it('should attach events', async () => {
      protocol.onConnection = sinon.stub();
      protocol.onDisconnection = sinon.stub();
      protocol.onMessage = sinon.stub();

      await protocol.init(entrypoint);

      should(protocol.aedes.on)
        .be.calledWith('client')
        .be.calledWith('clientError')
        .be.calledWith('clientDisconnect')
        .be.calledWith('publish');

      let cb;

      cb = protocol.aedes.on.getCall(0).args[1];
      cb(fakeClient);
      should(protocol.onConnection)
        .be.calledOnce()
        .be.calledWith(fakeClient);

      cb = protocol.aedes.on.getCall(1).args[1];
      cb('test');
      should(protocol.onDisconnection)
        .be.calledOnce()
        .be.calledWith('test');

      protocol.onDisconnection.resetHistory();
      cb = protocol.aedes.on.getCall(1).args[1];
      cb('test');
      should(protocol.onDisconnection)
        .be.calledOnce()
        .be.calledWith('test');

      cb = protocol.aedes.on.getCall(3).args[1];
      cb('packet', 'client');
      should(protocol.onMessage)
        .be.calledOnce()
        .be.calledWith('packet', 'client');
    });
  });

  describe('#authorizePublish', () => {
    let auth;

    beforeEach(async () => {
      await protocol.init(entrypoint);
      auth = Bluebird.promisify(protocol.aedes.authorizePublish);
    });

    it('should restrict to the requestTopic if allowPubSub is set to false', async () => {
      protocol.config.allowPubSub = false;

      const payload = {
        payload: Buffer.from('payload'),
        topic: 'topic',
      };

      await should(auth(fakeClient, payload)).rejectedWith({
        message: 'Cannot publish on this topic: unauthorized'
      });

      payload.topic = protocol.config.requestTopic;
      await should(auth(fakeClient, payload)).fulfilled();
    });

    it('should allow any topic different than the response one, provided it does not contain any wildcard', async () => {
      protocol.config.allowPubSub = true;

      const payload = {
        payload: Buffer.from('payload'),
        topic: 'topic',
      };

      await should(auth(fakeClient, payload)).fulfilled();

      payload.topic = protocol.config.responseTopic;
      await should(auth(fakeClient, payload)).rejectedWith({
        message: 'Cannot publish: this topic is read-only'
      });

      payload.topic = 'wildcard#forbidden';
      await should(auth(fakeClient, payload)).rejectedWith({
        message: 'Cannot publish: wildcards are disabled'
      });

      payload.topic = 'wildcard+forbidden';
      await should(auth(fakeClient, payload)).rejectedWith({
        message: 'Cannot publish: wildcards are disabled'
      });
    });
  });

  describe('#authorizeSubscribe', () => {
    let auth;

    beforeEach(async () => {
      await protocol.init(entrypoint);
      auth = Bluebird.promisify(protocol.aedes.authorizeSubscribe);
    });

    it('should allow any topic different than the request one, provided it does not contain any wildcard', async () => {
      const sub = {topic: 'topic'};

      await should(auth(fakeClient, sub)).fulfilledWith(sub);

      sub.topic = protocol.config.requestTopic;
      await should(auth(fakeClient, sub)).rejectedWith({
        message: 'Cannot subscribe: this topic is write-only'
      });

      sub.topic = 'wildcard#forbidden';
      await should(auth(fakeClient, sub)).rejectedWith({
        message: 'Cannot subscribe: wildcards are disabled'
      });

      sub.topic = 'wildcard+forbidden';
      await should(auth(fakeClient, sub)).rejectedWith({
        message: 'Cannot subscribe: wildcards are disabled'
      });
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

      should(protocol.aedes.publish)
        .be.calledTwice()
        .be.calledWith({topic: 'ch1', payload: '"payload"'});
    });
  });

  describe('#disconnect', () => {
    it('should close the matching connection', () => {
      protocol.connectionsById.set(fakeClient.id, fakeClient);

      protocol.disconnect(fakeClient.id);

      should(fakeClient.close).be.calledOnce();
    });
  });

  describe('#notify', () => {
    it('should forward the payload to the matching clients', () => {

      const client1 = new FakeClient('foo');
      const client2 = new FakeClient('bar');
      protocol.connectionsById.set(client1.id, client1);
      protocol.connectionsById.set(client2.id, client2);
      protocol.notify({
        connectionId: client1.id,
        payload: 'payload',
        channels: ['ch1', 'ch2']
      });

      should(client1.publish)
        .be.calledTwice()
        .be.calledWith({payload: Buffer.from('"payload"'), topic: 'ch1'})
        .be.calledWith({payload: Buffer.from('"payload"'), topic: 'ch2'});

      should(client2.publish).not.called();
    });
  });

  describe('#onConnection', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should register new connections', () => {
      protocol.onConnection(fakeClient);

      should(protocol.connections.size).eql(1);
      should(protocol.connectionsById.size).eql(1);

      const connectionId = protocol.connectionsById.entries().next().value[0];

      should(protocol.connections.get(fakeClient).id).be.exactly(connectionId);
      should(entrypoint.newConnection).be.calledOnce();
    });
  });

  describe('#onDisconnection', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should do nothing if the connection is unknown', () => {
      protocol.onDisconnection(fakeClient);

      should(entrypoint.removeConnection).have.callCount(0);
    });

    it('should remove the connection', () => {
      const clock = sinon.useFakeTimers();

      protocol.connections.set(fakeClient, {id: fakeClient.id});
      protocol.connectionsById.set(fakeClient.id, fakeClient);

      protocol.onDisconnection(fakeClient);
      clock.tick(protocol.config.disconnectDelay + 1);

      should(entrypoint.removeConnection)
        .be.calledOnce()
        .be.calledWith(fakeClient.id);

      clock.restore();
    });

  });

  describe('#onMessage', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should do nothing if topic is not the request one of if the payload is not valid', () => {
      // invalid topic
      protocol.onMessage({payload: 'payload', topic: 'topic'}, fakeClient);

      // invalid payload
      protocol.onMessage({topic: protocol.config.requestTopic}, fakeClient);

      // no client id
      protocol.onMessage(
        {
          topic: protocol.config.requestTopic,
          payload: 'payload'
        },
        new FakeClient(null));

      should(entrypoint.execute).have.callCount(0);
    });

    it('should do nothing if the connection is unknown', () => {
      protocol.onMessage(
        {
          topic: protocol.config.requestTopic,
          payload: 'payload'
        },
        fakeClient);

      should(entrypoint.execute).have.callCount(0);
    });

    it('should forward the client payload to kuzzle and respond the client back', () => {
      entrypoint.execute.yields({ content: 'response' });

      const connection = {
        id: fakeClient.id,
        protocol: 'mqtt',
      };

      protocol.connections.set(fakeClient, connection);

      protocol.onMessage(
        {
          payload: Buffer.from(JSON.stringify({foo: 'bar'})),
          topic: protocol.config.requestTopic,
        },
        fakeClient);

      should(entrypoint.execute).be.calledOnce();

      should(entrypoint.execute.firstCall.args[0]).eql(connection);

      const request = entrypoint.execute.firstCall.args[1];
      should(request.serialize()).match({
        data: {
          foo: 'bar'
        },
        options: {
          connection: {
            id: fakeClient.id,
            protocol: protocol.name
          }
        }
      });

      should(fakeClient.publish)
        .be.calledOnce()
        .be.calledWithMatch({
          payload: Buffer.from('"response"'),
          topic: protocol.config.responseTopic,
        });
    });

    it('should respond with an error if the payload cannot be parsed', () => {
      const nodeEnv = global.NODE_ENV;

      for (const env of ['production', '', 'development']) {
        global.NODE_ENV = env;
        protocol._respond = sinon.spy();

        const client = new FakeClient(env);
        protocol.connections.set(client, {id: client.id, protocol: 'mqtt'});

        protocol.onMessage(
          {
            payload: Buffer.from('invalid'),
            topic: protocol.config.requestTopic,
          },
          client);

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

      global.NODE_ENV = nodeEnv;
    });

    it('should respond with an error if the requestId is not a string', () => {
      protocol._respond = sinon.spy();

      protocol.connections.set(fakeClient, {
        id: fakeClient.id,
        protocol: 'mqtt',
      });

      protocol.onMessage(
        {
          payload: Buffer.from(JSON.stringify({ requestId: 42 })),
          topic: protocol.config.requestTopic,
        },
        fakeClient);

      should(protocol._respond)
        .be.calledOnce()
        .be.calledWith(fakeClient);

      const response = protocol._respond.firstCall.args[1];
      should(response.content.error).be.an.instanceOf(BadRequestError);
    });
  });

  describe('#_respond', () => {
    beforeEach(() => {
      return protocol.init(entrypoint);
    });

    it('should broadcast if in development mode', () => {
      const currentEnv = global.NODE_ENV;
      global.NODE_ENV = 'development';

      protocol.broadcast = sinon.spy();
      protocol.config.developmentMode = true;

      protocol._respond(fakeClient, {content: 'response'});
      global.NODE_ENV = currentEnv;

      should(protocol.broadcast)
        .be.calledOnce()
        .be.calledWith({
          channels: [protocol.config.responseTopic],
          payload: 'response'
        });

      should(fakeClient.publish).have.callCount(0);
    });
  });
});
