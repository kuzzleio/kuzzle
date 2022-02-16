'use strict';

const root = '../../../';

const path = require('path');

const rewire = require('rewire');
const should = require('should');
const sinon = require('sinon');
const Bluebird = require('bluebird');
const mockrequire = require('mock-require');

const {
  Request,
  RequestContext,
  InternalError: KuzzleInternalError,
  ServiceUnavailableError,
  PluginImplementationError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const EventEmitter = require('eventemitter3');

class FakeProtocol {
  constructor (name) {
    this.name = name;
    this.joinChannel = sinon.stub();
    this.leaveChannel = sinon.stub();
  }
}

class FakeWebSocketProtocol extends FakeProtocol {
  constructor () {
    super('websocket'); 
  }
}

class FakeMqttProtocol extends FakeProtocol {
  constructor () {
    super('mqtt'); 
  }
}

class FakeInternalProtocol extends FakeProtocol {
  constructor () {
    super('internal'); 
  }
}

describe('lib/core/core/network/entryPoint', () => {
  let kuzzle;
  let HttpWebSocketMock;
  let MqttMock;
  let InternalMock;
  let httpEventEmitter;
  let EntryPoint;
  let entrypoint;

  before(() => {
    sinon.usingPromise(Bluebird);
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    HttpWebSocketMock = FakeWebSocketProtocol;
    MqttMock = FakeMqttProtocol;
    InternalMock = FakeInternalProtocol;

    httpEventEmitter = new EventEmitter();
    sinon.spy(httpEventEmitter, 'on');
    httpEventEmitter.listen = sinon.spy();

    const network = `${root}/lib/core/network`;
    mockrequire(`${network}/protocols/httpwsProtocol`, HttpWebSocketMock);
    mockrequire(`${network}/protocols/mqttProtocol`, MqttMock);
    mockrequire(`${network}/protocols/internalProtocol`, InternalMock);

    // Bluebird.map forces a different context, preventing rewire to mock
    // "require"
    mockrequire('bluebird', {
      map: (arr, fn) => Promise.all(arr.map(e => {
        let result;
        try {
          result = fn(e);
        }
        catch (err) {
          return Promise.reject(err);
        }
        return result;
      })),
      resolve: sinon.stub().resolves(),
      timeout: sinon.stub().resolves(),
      catch: sinon.stub().resolves(),
      then: sinon.stub().resolves(),
      all: Bluebird.all
    });

    EntryPoint = mockrequire.reRequire(`${network}/entryPoint`);

    entrypoint = new EntryPoint();

    for (const Class of [HttpWebSocketMock, MqttMock, InternalMock]) {
      Class.prototype.init = sinon.stub().resolves(true);
    }
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#dispatch', () => {
    it('should call _notify', () => {
      const data = { foo: 'bar' };

      entrypoint._notify = sinon.spy();
      entrypoint.dispatch('notify', data);

      should(entrypoint._notify)
        .be.calledOnce()
        .be.calledWith(data);
    });

    it('should call _broadcast', () => {
      const data = { foo: 'bar' };

      entrypoint._broadcast = sinon.spy();
      entrypoint.dispatch('broadcast', data);

      should(entrypoint._broadcast)
        .be.calledOnce()
        .be.calledWith(data);
    });

    it('should throw if the event is unknown', () => {
      return should(() => entrypoint.dispatch('foo', {}))
        .throw(KuzzleInternalError);
    });
  });

  describe('#execute', () => {
    it('should call the funnel and log the response', (done) => {
      kuzzle.funnel.execute.callsFake((request, cb) => cb(null, request));
      entrypoint.logAccess = sinon.spy();

      const request = new Request({});
      request.setResult({
        foo: 'bar'
      });

      entrypoint.execute({}, request, response => {
        should(entrypoint.logAccess)
          .be.calledOnce()
          .be.calledWith({}, request);

        should(response)
          .be.eql(request.response.toJSON());

        done();
      });
    });

    it('should try to return an error if one received without any response', (done) => {
      const error = new KuzzleInternalError('test');
      kuzzle.funnel.execute.callsFake((request, cb) => cb(error, request));

      const request = new Request({});
      entrypoint.execute({}, request, response => {
        should(response.content.error)
          .be.eql(error);

        done();
      });
    });

    it('should refuse incoming requests if shutting down', (done) => {
      entrypoint.dispatch('shutdown');

      const request = new Request({});
      entrypoint.execute({}, request, response => {
        should(response.status).eql(503);
        should(response.content.error)
          .be.an.instanceof(ServiceUnavailableError);

        done();
      });
    });
  });

  describe('#init', () => {
    it('should init the internal protocol', async () => {
      await entrypoint.init();

      should(entrypoint.protocols.get('internal').init).be.calledOnce();
    });
  });

  describe('#startListening', () => {
    beforeEach(async () => {
      await entrypoint.init();
      process.nextTick(() => httpEventEmitter.emit('listening'));
    });

    it('should call proper methods in order', async () => {
      entrypoint.loadMoreProtocols = sinon.stub().resolves();
      kuzzle.config.server.port = -42;

      await entrypoint.startListening();

      should(entrypoint.protocols.get('websocket').init).be.calledOnce();
      should(entrypoint.protocols.get('mqtt').init).be.calledOnce();
      should(entrypoint.loadMoreProtocols).be.calledOnce();
      should(Array.from(entrypoint.protocols.keys())).be.length(3);
    });

    it('should not load disabled protocols', () => {
      MqttMock.prototype.init = sinon.stub().resolves(false);

      return entrypoint.startListening()
        .then(() => {
          should(entrypoint.protocols.get('websocket').init).be.calledOnce();
          should(entrypoint.protocols.get('internal').init).be.calledTwice();
          should(Array.from(entrypoint.protocols.keys())).be.length(2);
          should(entrypoint.protocols.get('mqtt')).be.undefined();
        });
    });

    it('should reject if the provided port is not an integer', () => {
      kuzzle.config.server.port = 'foobar';
      return should(entrypoint.startListening())
        .rejectedWith(KuzzleInternalError, {
          id: 'network.entrypoint.invalid_port',
          message: 'Invalid network port number: foobar.',
        });
    });

    it('should reject if an error occurs when loading protocols', () => {
      const error = new Error('test');

      sinon.stub(entrypoint, 'loadMoreProtocols').throws(error);

      return should(entrypoint.startListening()).rejectedWith(error);
    });
  });

  describe('#joinChannel', () => {
    it('should do nothing if the client is unknown', () => {
      entrypoint.joinChannel('channel', 'connectionId');

      for (const protocol of entrypoint.protocols.values()) {
        should(protocol.joinChannel).not.be.called();
      }
    });

    it('should call the connection protocol joinChannel method', () => {
      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        joinChannel: sinon.spy()
      });

      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.protocols.get('protocol').joinChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
    });

    it('should log errors and continue', () => {
      const error = new Error('test');

      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        joinChannel: sinon.stub().throws(error)
      });

      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.protocols.get('protocol').joinChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
      should(kuzzle.log.error)
        .be.calledWith('[join] protocol protocol failed: test');
    });
  });

  describe('#leaveChannel', () => {
    it('should do nothing if the client is unknown', () => {
      entrypoint.leaveChannel('channel', 'connectionId');

      for (const protocol of entrypoint.protocols.values()) {
        should(protocol.leaveChannel).not.be.called();
      }
    });

    it('should call the connection protocol leaveChannel method', () => {
      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        leaveChannel: sinon.spy()
      });

      entrypoint.leaveChannel('channel', 'connectionId');

      should(entrypoint.protocols.get('protocol').leaveChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
    });

    it('should log errors and continue', () => {
      const error = new Error('test');

      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      entrypoint.protocols.set('protocol', {
        leaveChannel: sinon.stub().throws(error)
      });

      entrypoint.leaveChannel('channel', 'connectionId');

      should(entrypoint.protocols.get('protocol').leaveChannel)
        .be.calledOnce()
        .be.calledWith('channel', 'connectionId');
      should(kuzzle.log.error)
        .be.calledWith('[leave channel] protocol protocol failed: test');
    });

  });

  describe('#loadMoreProtocols', () => {
    const protocolDir = path.join(__dirname, `${root}/protocols/enabled`);
    const entryPointDir = `${root}/lib/core/network/entryPoint`;

    it('should load plugins as Node.js modules', () => {
      mockrequire('fs', {
        readdirSync: sinon.stub().returns(['one', 'two']),
        statSync: sinon.stub().returns({ isDirectory: () => true })
      });

      mockrequire(path.join(protocolDir, 'one/manifest.json'), { name: 'foo', kuzzleVersion: '>=2.0.0 <3.0.0' });
      mockrequire(path.join(protocolDir, 'two/manifest.json'), { name: 'bar', kuzzleVersion: '>=2.0.0 <3.0.0' });
      mockrequire.reRequire(entryPointDir);
      const Rewired = rewire(entryPointDir);

      const requireStub = sinon.stub().returns(function () {
        this.init = sinon.spy();
      });

      return Rewired.__with__({ require: requireStub })(() => {
        const ep = new Rewired();
        return ep.loadMoreProtocols();
      })
        .then(() => should(requireStub).be.calledTwice());
    });

    it('should throw if there is no manifest.json file', () => {
      mockrequire('fs', {
        readdirSync: sinon.stub().returns(['protocol']),
        statSync: sinon.stub().returns({ isDirectory: () => true })
      });

      mockrequire.reRequire(entryPointDir);
      const Rewired = rewire(entryPointDir);

      const
        requireStub = sinon.stub().returns(function () {
          this.init = sinon.spy();
        });

      return should(Rewired.__with__({ require: requireStub })(() => {
        const ep = new Rewired();
        return ep.loadMoreProtocols();
      })).rejectedWith(PluginImplementationError, {
        id: 'plugin.manifest.cannot_load'
      });
    });

    it('should log and reject if an error occured', () => {
      mockrequire('fs', {
        readdirSync: sinon.stub().returns(['protocol']),
        statSync: sinon.stub().returns({ isDirectory: () => true })
      });

      mockrequire(
        path.join(protocolDir, 'protocol/manifest.json'),
        { name: 'foo', kuzzleVersion: '>=2.0.0 <3.0.0' });
      mockrequire.reRequire(entryPointDir);
      const Rewired = rewire(entryPointDir);

      const requireStub = sinon.stub().returns(function () {
        this.init = sinon.stub().throws(Error('test'));
      });

      return Rewired.__with__({
        require: requireStub
      })(() => {
        const ep = new Rewired();

        return should(ep.loadMoreProtocols()).be.rejectedWith('test');
      });
    });
  });

  describe('#newConnection', () => {
    let connection;

    beforeEach(() => {
      connection = {
        id: 'connectionId',
        protocol: 'protocol',
        headers: 'headers'
      };
    });

    it('should add the connection to the store and call kuzzle router', () => {
      entrypoint.newConnection(connection);

      should(entrypoint._clients).have.value('connectionId', connection);

      should(kuzzle.router.newConnection)
        .be.calledOnce()
        .be.calledWithMatch(new RequestContext({ connection }));
    });

    it('should dispatch connection:new event', () => {
      entrypoint.newConnection(connection);

      should(kuzzle.emit).be.calledWithMatch('connection:new', connection);
    });
  });

  describe('#removeConnection', () => {
    let connection;

    beforeEach(() => {
      connection = {
        id: 'connectionId',
        protocol: 'protocol',
        headers: 'headers'
      };

      entrypoint._clients.set(connection.id, connection);
    });

    it('should remove the connection from the store and call kuzzle router', () => {
      entrypoint.removeConnection(connection.id);

      should(kuzzle.router.removeConnection)
        .be.calledOnce()
        .be.calledWithMatch(new RequestContext({ connection }));
      should(entrypoint._clients).not.have.keys(connection.id);
    });

    it('should dispatch connection:remove event', () => {
      entrypoint.removeConnection(connection.id);

      should(kuzzle.emit).be.calledWithMatch(
        'connection:remove',
        {
          id: 'connectionId',
          protocol: 'protocol',
          headers: 'headers'
        });
    });
  });

  describe('#_broadcast', () => {
    it('should call underlying protocols and log errors', () => {
      const error = new KuzzleInternalError('test');

      entrypoint.protocols = new Map([
        ['one', {
          broadcast: sinon.spy()
        }],
        ['two', {
          broadcast: sinon.spy()
        }],
        ['three', {
          broadcast: sinon.stub().throws(error)
        }]
      ]);

      entrypoint._broadcast('data');

      should(entrypoint.protocols.get('one').broadcast)
        .be.calledOnce()
        .be.calledWith('data');

      should(entrypoint.protocols.get('two').broadcast)
        .be.calledOnce()
        .be.calledWith('data');

      should(kuzzle.log.error).be.calledOnce();
    });
  });

  describe('#_notify', () => {
    it('should call underlying protocols and log errors', () => {
      entrypoint._clients.set('connectionId', { protocol: 'protocol' });
      const error = new KuzzleInternalError('test');

      entrypoint.protocols = new Map([
        ['protocol', {
          notify: sinon.stub()
        }]
      ]);

      entrypoint._notify({
        connectionId: 'connectionId',
        content: 'data'
      });

      should(entrypoint.protocols.get('protocol').notify)
        .be.calledOnce()
        .be.calledWith({
          connectionId: 'connectionId',
          content: 'data'
        });

      entrypoint.protocols.get('protocol').notify.throws(error);
      entrypoint._notify({
        connectionId: 'connectionId',
        content: 'data'
      });

      should(kuzzle.log.error).be.calledOnce();
    });
  });
});
