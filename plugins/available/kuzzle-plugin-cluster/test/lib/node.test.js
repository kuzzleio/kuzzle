/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const mockRequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const {
  Request,
  errors: {
    InternalError: KuzzleInternalError
  }
} = require('kuzzle-common-objects');

const KuzzleMock = require('../mocks/kuzzle.mock');
const RedisMock = require('../mocks/redis.mock');
const zeromqMock = require('../mocks/zeromq.mock');

describe('node', () => {
  let cluster;
  let node;

  beforeEach(() => {
    cluster = {
      config: {
        bindings: {
          pub: {href: 'pub-href'},
          router: {href: 'router-href'}
        },
        minimumNodes: 0,
        timers: {
          heartbeat: 20000
        }
      },
      kuzzle: new KuzzleMock(),
      log: sinon.spy(),
      redis: new RedisMock(),
      uuid: 'uuid',
      cleanNode: sinon.stub().resolves(),
    };

    mockRequire('zeromq', zeromqMock);
    const Node = mockRequire.reRequire('../../lib/node');
    node = new Node(cluster);
  });

  afterEach(() => {
    clearInterval(node.heartbeatTimer);
  });

  describe('#constructor', () => {
    it('should attach handlers to zeromq sockets', () => {
      {
        node._onRouterMessage = sinon.stub().resolves();
        const routerHandler = node.sockets.router.on.firstCall.args[1];

        routerHandler('foo', 'bar');
        should(node._onRouterMessage)
          .be.calledOnce()
          .be.calledWith('foo', 'bar');
      }

      {
        node._onSubMessage = sinon.spy();
        const subHandler = node.sockets.sub.on.firstCall.args[1];

        subHandler('sub');
        should(node._onSubMessage)
          .be.calledOnce()
          .be.calledWith('sub');
        should(node.sockets.sub.subscribe)
          .be.calledOnce();
      }
    });
  });

  describe('#getters', () => {
    it('should return their context related property', () => {
      should(node.config).be.exactly(cluster.config);
      should(node.redis).be.exactly(cluster.redis);
      should(node.kuzzle).be.exactly(cluster.kuzzle);
    });
  });

  describe('#broadcast', () => {
    it('should publish the message', () => {
      node.broadcast('room', 'message');

      should(node.sockets.pub.send)
        .be.calledOnce()
        .be.calledWith(JSON.stringify([
          'room',
          'message'
        ]));
    });
  });

  describe('#discover', () => {
    it('should add nodes retrieved from redis', () => {
      node._addNode = sinon.spy();

      node.redis.smembers.resolves(['"foo"', '"bar"']);
      node.redis.scan.onFirstCall().resolves([1, ['baz', 'zab']]);
      node.redis.scan.onSecondCall().resolves([0, ['qux']]);

      return node.discover()
        .then(() => {
          should(node._addNode)
            .be.calledTwice()
            .be.calledWith('foo')
            .be.calledWith('bar');

          should(node.redis.del)
            .calledThrice()
            .calledWith('baz')
            .calledWith('zab')
            .calledWith('qux');

          should(node.redis.scan)
            .calledTwice()
            .calledWith(0, 'MATCH', 'cluster*', 'COUNT', 1000)
            .calledWith(1, 'MATCH', 'cluster*', 'COUNT', 1000);
        });
    });
  });

  describe('#init', () => {
    it('should inject the getState script in redis, register itself as a discoverable node, init heartbeat and join the cluster', () => {
      node.join = sinon.spy();

      return node.init()
        .then(() => {
          should(node.sockets.pub.bind)
            .be.calledOnce()
            .be.calledWith(cluster.config.bindings.pub.href);
          should(node.sockets.router.bind)
            .be.calledOnce()
            .be.calledWith(cluster.config.bindings.router.href);

          should(node.join)
            .be.calledOnce();
        });
    });
  });

  describe('#join', () => {
    beforeEach(() => {
      node.broadcast = sinon.stub().resolves();
      node.discover = sinon.stub().resolves();
      node._remoteSub = sinon.stub().resolves();
      node._syncState = sinon.stub().resolves();
      node.state.syncAll = sinon.stub().resolves();

      node.pool = {
        foo: {router: 'foo-router'},
        bar: {router: 'bar-router'}
      };
    });

    it('should do nothing if the cluster is ready', () => {
      node.ready = true;
      node.join();
      should(node.discover).have.callCount(0);
    });

    it('should run the sync sequence on discovered nodes', () => {
      return node.join()
        .then(() => {
          should(node._remoteSub)
            .be.calledTwice()
            .be.calledWith({router: 'foo-router'})
            .be.calledWith({router: 'bar-router'});

          should(node.state.syncAll).be.calledOnce();

          should(node.broadcast)
            .be.calledOnce()
            .be.calledWith('cluster:ready', node);
        });
    });

    it('should keep retrying if the corum is not reached', () => {
      cluster.config.retryJoin = 3;
      cluster.config.minimumNodes = 9;
      cluster.config.timers.joinAttemptInterval = 0;

      return node.join()
        .then(() => {
          should(node.discover)
            .be.calledThrice();
        });
    });
  });

  describe('#_addNode', () => {
    beforeEach(() => {
      sinon.stub(node, '_onHeartbeat');
    });

    it('should do nothing if the node is already registered', () => {
      node.pool.foo = true;
      node._addNode({pub: 'foo'});

      should(node.sockets.sub.connect)
        .have.callCount(0);
    });

    it('should register the node', () => {
      node._addNode({pub: 'foo'});

      should(node.sockets.sub.connect)
        .be.calledWith('foo');
      should(node._onHeartbeat)
        .be.calledWith({pub: 'foo'});
      should(node.pool.foo)
        .eql({pub: 'foo'});
    });
  });

  describe('#_heartbeat', () => {
    it('should broadcast the heartbeat', () => {
      node.broadcast = sinon.stub();

      node.redis.smembers.resolves([
        JSON.stringify({
          router: node.config.bindings.router.href
        })
      ]);

      return node._heartbeat()
        .then(() => {
          should(node.broadcast)
            .be.calledWith('cluster:heartbeat', node);
        });
    });

    it('should check if the node is known from the cluster and if not, register itself', () => {
      node.join = sinon.stub().resolves();
      node.broadcast = sinon.stub();

      node.redis.smembers.resolves([]);

      return node._heartbeat()
        .then(() => {
          should(node.join)
            .be.calledOnce();
        });
    });

  });

  describe('#_onHeartbeat', () => {
    it('should add an unknown node', () => {
      node._remoteJoin = sinon.stub();

      node._onHeartbeat({
        pub: 'unknown'
      });

      should(node._remoteJoin)
        .be.calledOnce();
    });

    it('should remove a remote node after a timeout and attempt to rejoin it', done => {
      node._removeNode = sinon.stub();
      node._remoteJoin = sinon.stub();

      node.pool = {
        remote: {
          pub: 'remote'
        }
      };

      const setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake(fn => {
        fn();

        should(node._removeNode)
          .be.calledOnce()
          .be.calledWith('remote');

        should(node._remoteJoin)
          .be.calledWith({
            pub: 'remote'
          });

        setTimeoutStub.restore();

        done();
      });

      node._onHeartbeat({pub: 'remote'});

    });
  });

  describe('#_onRouterMessage', () => {
    it('remoteSub', () => {
      node._addNode = sinon.spy();

      return node
        ._onRouterMessage(
          'envelope',
          JSON.stringify(['remoteSub', { pub: 'pub'}]))
        .then(() => {
          should(node._addNode)
            .be.calledWith({pub: 'pub'});

          should(node.sockets.router.send)
            .be.calledWith(['envelope', JSON.stringify(['remoteSub', true])]);
        });
    });

    it('remoteJoin', () => {
      node.join = sinon.stub();

      return node
        ._onRouterMessage('envelope', JSON.stringify(['remoteJoin', true]))
        .then(() => {
          should(node.sockets.router.send)
            .be.calledWith([
              'envelope',
              JSON.stringify([
                'remoteJoin',
                true
              ])
            ]);

          should(node.ready).be.false();
          should(node.join).be.calledOnce();
        });
    });

    it('unknown action', () => {
      return should(node._onRouterMessage('envelope', JSON.stringify(['foo'])))
        .rejected();
    });
  });

  describe('#_onSubMessage', () => {
    it('cluster:heartbeat', () => {
      node._onHeartbeat = sinon.spy();
      node._onSubMessage(JSON.stringify(['cluster:heartbeat', 'data']));
      should(node._onHeartbeat)
        .be.calledWith('data');
    });

    it('cluster:notify:document', () => {
      const payload = {
        rooms: ['r1', 'r2', 'r3'],
        request: {
          data: {
            body: {foo: 'bar'},
            index: 'index',
            collection: 'collection'
          },
          options: {
            connectionId: 'connectionId'
          }
        },
        scope: 'scope',
        action: 'action',
        content: 'content'
      };

      node._onSubMessage(JSON.stringify(['cluster:notify:document', payload]));

      should(node.kuzzle.notifier._notifyDocument)
        .be.calledWithMatch(payload.rooms,
          sinon.match.instanceOf(Request),
          payload.scope,
          payload.action,
          payload.content);

      const sentRequest = node.kuzzle.notifier._notifyDocument.firstCall.args[1];

      should(sentRequest.input.resource).match({
        index: payload.request.data.index,
        collection: payload.request.data.collection
      });

      should(sentRequest.input.body).match(payload.request.data.body);
      should(sentRequest.context.connectionId).match(payload.request.options.connectionId);
    });

    it('cluster:notify:user', () => {
      const payload = {
        room: 'room',
        request: {
          data: {
            body: {foo: 'bar'},
            index: 'index',
            collection: 'collection'
          },
          options: {
            connectionId: 'connectionId'
          }
        },
        scope: 'scope',
        content: 'content'
      };

      node._onSubMessage(JSON.stringify(['cluster:notify:user', payload]));

      should(node.kuzzle.notifier._notifyUser)
        .be.calledWithMatch(payload.room,
          sinon.match.instanceOf(Request),
          payload.scope,
          payload.content);

      const sentRequest = node.kuzzle.notifier._notifyUser.firstCall.args[1];

      should(sentRequest.input.resource).match({
        index: payload.request.data.index,
        collection: payload.request.data.collection
      });

      should(sentRequest.input.body).match(payload.request.data.body);
      should(sentRequest.context.connectionId).match(payload.request.options.connectionId);
    });

    it('cluster:ready', () => {
      node.pool.foo = {};
      node._onSubMessage(JSON.stringify(['cluster:ready', {
        pub: 'foo'
      }]));
      should(node.pool.foo.ready)
        .be.true();
    });

    it('cluster:ready unknown node', () => {
      node._addNode = sinon.spy();
      node.join = sinon.spy();

      return node._onSubMessage(JSON.stringify(['cluster:ready', {
        pub: 'foo'
      }]))
        .then(() => {
          should(node.ready)
            .be.false();
          should(node._addNode)
            .be.calledWith({pub: 'foo'});
          should(node.join)
            .be.calledOnce();
        });
    });

    it('cluster:remove', () => {
      node._removeNode = sinon.spy();
      node._onSubMessage(JSON.stringify(['cluster:remove', {pub: 'data'}]));

      should(node._removeNode)
        .be.calledWith('data');
    });

    it('cluster:sync', () => {
      node.sync = sinon.spy();
      node._onSubMessage(JSON.stringify(['cluster:sync', 'data']));

      should(node.sync).be.calledWith('data');
    });

    it('cluster:admin:dump', () => {
      node._onSubMessage(JSON.stringify(['cluster:admin:dump', {suffix: 'suffix'}]));

      should(node.kuzzle.janitor.dump)
        .be.calledWith('suffix');
    });

    it('cluster:admin:shutdown', () => {
      const killStub = sinon.stub(process, 'kill');

      node._onSubMessage(JSON.stringify(['cluster:admin:shutdown', false]));
      should(killStub)
        .be.calledWith(process.pid, 'SIGTERM');

      killStub.restore();
    });

    it('cluster:admin:resetSecurity', async () => {
      await node._onSubMessage(
        JSON.stringify(['cluster:admin:resetSecurity', false]));

      should(node.kuzzle.ask).calledWith('core:security:profile:invalidate');
      should(node.kuzzle.ask).calledWith('core:security:role:invalidate');
    });
  });

  describe('#_remoteJoin', () => {
    it('should ask remote node to rejoin the cluster', () => {
      node.discover = sinon.stub();
      node._remoteJoin({
        router: 'router'
      });

      const socket = zeromqMock.socket.lastCall.returnValue;
      const onMsg = socket.on.firstCall.args[1];

      should(socket.send)
        .be.calledWith(JSON.stringify(['remoteJoin', node]));

      onMsg(JSON.stringify(['remoteJoin', true]));
      should(socket.close)
        .be.calledOnce();
      should(node.discover)
        .be.calledOnce();
    });
  });

  describe('#_remoteSub', () => {
    it('should ask remote node to subscribe to it', () => {
      node._remoteSub('endpoint');

      const socket = zeromqMock.socket.lastCall.returnValue;
      const onMsg = socket.on.firstCall.args[1];

      should(socket.send)
        .be.calledWith(JSON.stringify(['remoteSub', node]));

      onMsg(JSON.stringify(['remoteSub', true]));
      should(socket.close)
        .be.calledOnce();
    });

    it('should remove the node in case of timeout', () => {
      node.config.timers.discoverTimeout = 0;
      node._removeNode = sinon.stub();

      return node._remoteSub({
        pub: 'pub'
      })
        .then(() => {
          should(node._removeNode)
            .be.calledWith('pub');
        });
    });
  });

  describe('#_removeNode', () => {
    beforeEach(() => {
      node.state.syncAll = sinon.stub().resolves();
      sinon.stub(node, 'broadcast');
      sinon.stub(node, 'join');
    });

    it('should remove the given node', () => {
      node.pool = {
        foo: {
          pub: 'bar',
          heartbeat: null
        }
      };

      return node._removeNode('foo')
        .then(() => {
          should(node.sockets.sub.disconnect)
            .calledOnce()
            .calledWith('bar');
          should(node.pool).be.empty();
          should(node.broadcast).not.be.called();
          should(node.join).not.be.called();
        });
    });

    it('should kill itself is the corum is not reached', () => {
      node.config.minimumNodes = 2;
      node.pool = {
        foo: {
          pub: 'bar',
          heartbeat: null
        }
      };

      return node._removeNode('foo')
        .then(() => {
          should(node.pool).be.empty();
          should(node.ready).be.false();
          should(node.broadcast)
            .be.calledOnce()
            .be.calledWith('cluster:remove', node);
          should(node.join).be.calledOnce();
          should(node.sockets.sub.disconnect)
            .calledOnce()
            .calledWith('bar');
        });
    });
  });

  // The "sync" function works asynchronously without returning
  // async handler (promise or callback)
  // Welcome to setTimeout land!
  describe('#sync', () => {
    it('indexCache:add', async () => {
      await node.sync({
        event: 'indexCache:add',
        index: 'index',
        collection: 'collection',
        scope: 'public'
      });

      should(node.kuzzle.storageEngine.indexCache.add).be.calledWith({
        index: 'index',
        collection: 'collection',
        scope: 'public',
        notify: false
      });
    });

    it('indexCache:remove', async () => {
      await node.sync({
        event: 'indexCache:remove',
        index: 'index',
        collection: 'collection',
        scope: 'internal'
      });

      should(node.kuzzle.storageEngine.indexCache.remove).be.calledWith({
        index: 'index',
        collection: 'collection',
        scope: 'internal',
        notify: false
      });
    });

    it('profile', async () => {
      await node.sync({ event: 'profile', id: 'foo' });

      should(node.kuzzle.ask).calledWith(
        'core:security:profile:invalidate',
        'foo');
    });

    it('role', async () => {
      await node.sync({ event: 'role', id: 'foo' });

      should(node.kuzzle.ask).calledWith(
        'core:security:role:invalidate',
        'foo');
    });

    it('strategies', () => {
      const strategyEvent = {
        event: 'strategies'
      };

      node.kuzzle.pluginsManager.listStrategies.returns(['toDelete', 'anotherOne', 'strategyName']);
      node.kuzzle.pluginsManager.strategies = {
        toDelete: {owner: 'foo'},
        anotherOne: {owner: 'bar'}
      };
      node.redis.hgetall.withArgs('cluster:strategies').resolves({
        strategyName: JSON.stringify({
          plugin: 'plugin',
          strategy: 'strategy'
        })
      });

      return node.sync(strategyEvent)
        .then(() => {
          should(node.redis.hgetall)
            .be.calledWith('cluster:strategies');

          should(node.kuzzle.pluginsManager.registerStrategy)
            .be.calledWith('plugin', 'strategyName', 'strategy');

          should(node.kuzzle.pluginsManager.unregisterStrategy)
            .be.calledTwice()
            .be.calledWith('foo', 'toDelete')
            .be.calledWith('bar', 'anotherOne');

        });
    });

    it('state', () => {
      node.state.sync = sinon.stub().resolves();
      const data = {event: 'state'};

      return node.sync(data)
        .then(() => {
          should(node.state.sync).be.calledWith(data);
        });
    });

    it('state:all', () => {
      node.state.syncAll = sinon.stub().resolves();
      const data = {event: 'state:all'};

      return node.sync(data)
        .then(() => {
          should(node.state.syncAll).be.calledWith(data);
        });
    });

    it('state:reset', () => {
      node.context.reset = sinon.stub().resolves();
      const data = {event: 'state:reset'};

      return node.sync(data)
        .then(() => {
          should(node.context.reset).be.calledOnce();
        });
    });

    it('validators', () => {
      return node.sync({event: 'validators'})
        .then(() => {
          should(node.kuzzle.validation.curateSpecification).be.calledOnce();
        });
    });

    it('default', () => {
      return should(node.sync({event: 'unknown'}))
        .be.rejectedWith(KuzzleInternalError);
    });
  });
});
