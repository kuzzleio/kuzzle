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


const
  mockRequire = require('mock-require'),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  NodeMock = require('../mocks/node.mock'),
  RedisMock = require('../mocks/redis.mock'),
  {
    BadRequestError,
    NotFoundError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request,
  should = require('should'),
  sinon = require('sinon');

let
  Cluster;

describe('index', () => {
  let
    cluster,
    context;

  beforeEach(() => {
    mockRequire('ioredis', RedisMock);
    mockRequire('../../lib/node', NodeMock);
    Cluster = mockRequire.reRequire('../../lib');
    cluster = new Cluster();

    context = {
      accessors: {
        kuzzle: new KuzzleMock(),
      },
      errors: {
        BadRequestError,
        NotFoundError
      }
    };

    sinon.stub(cluster, 'log');
  });

  afterEach(() => {
    mockRequire.stopAll();

    // cleaning up to prevent event leak warnings,
    // triggered because of the shutdown listener
    // being registered on global events each time
    // a new cluster is instantiated
    process.removeAllListeners();
  });

  describe('#init', () => {
    it('should init the cluster with given config', () => {
      cluster.constructor._resolveBinding = sinon.stub().returnsArg(0);

      cluster.init({foo: 'bar', redis: { something: 'else' } }, context);
      should(cluster.context).be.exactly(context);
      should(cluster.kuzzle).be.exactly(context.accessors.kuzzle);
      should(cluster.config)
        .eql({
          foo: 'bar',
          bindings: {
            pub: 'tcp://[_site_:ipv4]:7511',
            router: 'tcp://[_site_:ipv4]:7510'
          },
          minimumNodes: 1,
          redis: {
            something: 'else',
          },
          retryJoin: 30,
          timers: {
            discoverTimeout: 3000,
            joinAttemptInterval: 1000,
            heartbeat: 5000,
            waitForMissingRooms: 500
          }
        });

      should(cluster.redis).be.an.instanceof(RedisMock);
      should(cluster.redis.defineCommand)
        .be.calledWith('clusterCleanNode')
        .be.calledWith('clusterState')
        .be.calledWith('clusterSubOn')
        .be.calledWith('clusterSubOff');
    });

  });

  describe('#hooks', () => {
    beforeEach(() => {
      cluster.init({}, context);
      cluster.node.ready = true;
    });

    describe('#beforeJoin', () => {
      it('should create the room in the hotel clerk', done => {
        cluster._rooms.flat.set('roomId', {
          index: 'index',
          collection: 'collection'
        });

        cluster.beforeJoin(new Request({
          controller: 'realtime',
          action: 'join',
          body: {
            roomId: 'roomId'
          }
        }), () => {
          should(cluster.kuzzle.hotelClerk.rooms).have.value('roomId', {
            index: 'index',
            collection: 'collection',
            id: 'roomId',
            customers: new Set(),
            channels: {}
          });

          done();
        });
      });

      it('should retry once if the room is not found', done => {
        const spy = sinon.spy(cluster, 'beforeJoin');
        cluster.config.timers.waitForMissingRooms = 0;

        cluster.beforeJoin(new Request({
          controller: 'realtime',
          action: 'join',
          body: {
            roomId: 'roomId'
          }
        }), () => {
          should(spy)
            .be.calledTwice();

          done();
        });
      });
    });

    describe('#indexCacheAdded', () => {
      it('should broadcast', () => {
        should(cluster.hooks['core:indexCache:add'])
          .eql('indexCacheAdded');

        cluster.indexCacheAdded({
          index: 'index',
          collection: 'collection',
          scope: 'public'
        });

        should(cluster.node.broadcast).be.calledWith('cluster:sync', {
          event: 'indexCache:add',
          index: 'index',
          collection: 'collection',
          scope: 'public'
        });
      });
    });

    describe('#indexCacheRemoved', () => {
      it('should broadcast the change', () => {
        should(cluster.hooks['core:indexCache:remove'])
          .eql('indexCacheRemoved');

        cluster.indexCacheRemoved({
          index: 'index',
          collection: 'collection',
          scope: 'internal'
        });

        should(cluster.node.broadcast).be.calledWith('cluster:sync', {
          event: 'indexCache:remove',
          index: 'index',
          collection: 'collection',
          scope: 'internal'
        });
      });
    });

    describe('#kuzzleStarted', () => {
      it('should init the cluster node', () => {
        should(cluster.hooks['core:kuzzleStart'])
          .eql('kuzzleStarted');

        cluster._realtimeCountOverride = sinon.stub();
        cluster._realtimeListOverride = sinon.stub();

        cluster.kuzzle.pluginsManager.strategies = {
          local: {
            strategy: 'localStrategy',
            methods: 'localMethods',
            owner: 'pluginName'
          },
          anotherAuth: {
            strategy: 'otherStrategy',
            methods: 'otherMethods',
            owner: 'otherPluginName'
          }
        };
        cluster.kuzzle.pluginsManager.listStrategies.returns(Object.keys(cluster.kuzzle.pluginsManager.strategies));

        return cluster.kuzzleStarted()
          .then(() => {
            // overrides
            cluster.kuzzle.funnel.controllers.get('realtime').count('foo');
            should(cluster._realtimeCountOverride)
              .be.calledOnce()
              .be.calledWith('foo');

            cluster.kuzzle.funnel.controllers.get('realtime').list('foo');
            should(cluster._realtimeListOverride)
              .be.calledOnce()
              .be.calledWith('foo');

            should(cluster.redis.hset)
              .be.calledTwice()
              .be.calledWith('cluster:strategies', 'local', JSON.stringify({
                plugin: 'pluginName',
                strategy: 'localStrategy'
              }))
              .be.calledWith('cluster:strategies', 'anotherAuth', JSON.stringify({
                plugin: 'otherPluginName',
                strategy: 'otherStrategy'
              }));

            should(cluster._isKuzzleStarted)
              .be.true();

            should(cluster.node.init).be.calledOnce();
          });
      });
    });

    describe('#notifyDocument', () => {
      it('should broadcast the Document notification', () => {
        should(cluster.hooks['core:notify:document'])
          .eql('notifyDocument');

        cluster.notifyDocument('notification');

        should(cluster.node.broadcast)
          .be.calledWith('cluster:notify:document', 'notification');
      });

    });

    describe('#notifyUser', () => {
      it('should broadcast the User notification', () => {
        should(cluster.hooks['core:notify:user'])
          .eql('notifyUser');

        cluster.notifyUser('notification');

        should(cluster.node.broadcast)
          .be.calledWith('cluster:notify:user', 'notification');
      });

    });

    describe('#profileUpdated', () => {
      it('should broadcast change', () => {
        should(cluster.hooks['core:profileRepository:save'])
          .eql('profileUpdated');
        should(cluster.hooks['core:profileRepository:delete'])
          .eql('profileUpdated');

        cluster.profileUpdated({_id: 'id'});
        should(cluster.node.broadcast)
          .be.calledWith('cluster:sync', {
            event: 'profile',
            id: 'id'
          });
      });
    });

    describe('#roleUpdated', () => {
      it('should broadcast changes', () => {
        should(cluster.hooks['core:roleRepository:save'])
          .eql('roleUpdated');
        should(cluster.hooks['core:roleRepository:delete'])
          .eql('roleUpdated');

        cluster.roleUpdated({_id: 'id'});
        should(cluster.node.broadcast)
          .be.calledWith('cluster:sync', {
            event: 'role',
            id: 'id'
          });

      });
    });

    describe('#strategyAdded', () => {
      it('should persist the strategy to redis and broadcast changes', () => {
        should(cluster.pipes['core:auth:strategyAdded'])
          .eql('strategyAdded');

        return cluster.strategyAdded({
          name: 'name',
          pluginName: 'plugin',
          strategy: 'strategy'
        })
          .then(() => {
            should(cluster.redis.hset)
              .be.calledOnce()
              .be.calledWith('cluster:strategies', 'name', JSON.stringify({
                plugin: 'plugin',
                strategy: 'strategy'
              }));

            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {
                event: 'strategies'
              });
          });

      });
    });

    describe('#strategyRemoved', () => {
      it('should broadcast changes', () => {
        should(cluster.pipes['core:auth:strategyRemoved'])
          .eql('strategyRemoved');

        return cluster.strategyRemoved({
          name: 'name'
        })
          .then(() => {
            should(cluster.redis.hdel)
              .be.calledOnce()
              .be.calledWith('cluster:strategies', 'name');

            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {
                event: 'strategies'
              });
          });
      });
    });

    describe('#subscriptionAdded', () => {
      it('should persist Kuzzle state in redis and broadcast a sync request', () => {
        should(cluster.pipes['core:hotelClerk:addSubscription'])
          .eql('subscriptionAdded');

        cluster.kuzzle.hotelClerk.rooms.set('roomId', {
          customers: new Set(['customer']),
          channels: {},
          index: 'index',
          collection: 'collection'
        });
        cluster._serializeRoom = JSON.stringify;

        return cluster.subscriptionAdded({
          index: 'index',
          collection: 'collection',
          filters: 'filters',
          roomId: 'roomId',
          connectionId: 'connectionId'
        })
          .then(() => {
            should(cluster.redis.clusterSubOn)
              .be.calledWith('{index/collection}',
                cluster.uuid,
                'roomId',
                'connectionId',
                JSON.stringify({
                  index: 'index',
                  collection: 'collection',
                  filters: 'filters'
                })
              );

            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {
                index: 'index',
                collection: 'collection',
                roomId: 'roomId',
                event: 'state',
                post: 'add'
              });
          });
      });
    });

    describe('#subscriptionJoined', () => {
      it('should persist Kuzzle state in redis and broadcast changes', () => {
        should(cluster.pipes['core:hotelClerk:join'])
          .eql('subscriptionJoined');

        cluster.kuzzle.hotelClerk.rooms.set('roomId', {
          customers: new Set(['customer']),
          channels: {},
          index: 'index',
          collection: 'collection'
        });
        cluster._serializeRoom = JSON.stringify;

        return cluster.subscriptionJoined({
          index: 'index',
          collection: 'collection',
          roomId: 'roomId',
          connectionId: 'connectionId'
        })
          .then(() => {
            should(cluster.redis.clusterSubOn)
              .be.calledWith('{index/collection}',
                cluster.uuid,
                'roomId',
                'connectionId',
                'none'
              );

            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {
                index: 'index',
                collection: 'collection',
                roomId: 'roomId',
                event: 'state',
                post: 'join'
              });
          });
      });

    });

    describe('#subscriptionOff', () => {
      it('should persist Kuzzle state in redis and broadcast changes', () => {
        should(cluster.pipes['core:hotelClerk:removeRoomForCustomer'])
          .eql('subscriptionOff');

        cluster.node.state.getVersion.returns(1);
        cluster.kuzzle.hotelClerk.rooms.set('roomId', {
          id: 'roomId',
          customers: new Set(['customer', 'customers2']),
          channels: {},
          index: 'index',
          collection: 'collection'
        });
        cluster.redis.clusterSubOff.resolves([42, '0', 'debug']);

        return cluster.subscriptionOff({
          room: cluster.kuzzle.hotelClerk.rooms.get('roomId'),
          requestContext: {
            connectionId: 'connectionId'
          }
        })
          .then(() => {
            should(cluster.redis.clusterSubOff)
              .be.calledWith(
                '{index/collection}',
                cluster.uuid,
                'roomId',
                'connectionId'
              );

            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {
                index: 'index',
                collection: 'collection',
                roomId: 'roomId',
                event: 'state',
                post: 'off'
              });
          });
      });

    });

    describe('#refreshSpecifications', () => {
      it('should broadcast changes', () => {
        should(cluster.hooks['collection:afterDeleteSpecifications'])
          .eql('refreshSpecifications');
        should(cluster.hooks['collection:afterUpdateSpecifications'])
          .eql('refreshSpecifications');

        cluster.refreshSpecifications();

        should(cluster.node.broadcast)
          .be.calledWith('cluster:sync', {
            event: 'validators'
          });
      });
    });

    describe('#roomCreated', () => {
      it('should flag the room to protect it', () => {
        should(cluster.hooks['room:new'])
          .eql('roomCreated');

        cluster.roomCreated({roomId: 'roomId'});

        should(cluster.node.state.locks.create.has('roomId'))
          .be.true();
      });
    });

    describe('#unlockCreateRoom', () => {
      it('should do nothing if the incoming request does not have a body', () => {
        const request = new Request({});
        cluster.node.state.locks.create = {
          delete: sinon.spy()
        };

        cluster.unlockCreateRoom(request);
        should(cluster.node.state.locks.create.delete)
          .not.be.called();
      });

      it('should do nothing if the incoming request does not have a roomId', () => {
        const request = new Request({ body: { foo: 'bar' }});
        cluster.node.state.locks.create = {
          delete: sinon.spy()
        };

        cluster.unlockCreateRoom(request);
        should(cluster.node.state.locks.create.delete)
          .not.be.called();
      });

      it('should delete the lock for the given roomId', () => {
        const request = new Request({ body: { roomId: 'roomId' }});
        cluster.node.state.locks.create = {
          delete: sinon.spy()
        };

        cluster.unlockCreateRoom(request);
        should(cluster.node.state.locks.create.delete)
          .be.calledOnce()
          .be.calledWith('roomId');
      });
    });

    describe('#unlockDeleteRoom', () => {
      it('should do nothing if the incoming request does not have a body', () => {
        const request = new Request({});
        cluster.node.state.locks.delete = {
          delete: sinon.spy()
        };

        cluster.unlockDeleteRoom(request);
        should(cluster.node.state.locks.delete.delete)
          .not.be.called();
      });

      it('should do nothing if the incoming request does not have a room id', () => {
        const request = new Request({ body: { foo: 'bar' } });
        cluster.node.state.locks.delete = {
          delete: sinon.spy()
        };

        cluster.unlockDeleteRoom(request);
        should(cluster.node.state.locks.delete.delete)
          .not.be.called();
      });

      it('should delete the lock for the given room id', () => {
        const request = new Request({ body: { roomId: 'roomId' } });
        cluster.node.state.locks.delete = {
          delete: sinon.spy()
        };

        cluster.unlockDeleteRoom(request);
        should(cluster.node.state.locks.delete.delete)
          .be.calledOnce()
          .be.calledWith('roomId');
      });
    });

    describe('#dump', () => {
      it('should do nothing if the node is not ready', () => {
        cluster.node.ready = false;

        cluster.dump('request');

        should(cluster.node.broadcast)
          .not.be.called();
      });

      it('should broadcast the event', () => {
        should(cluster.hooks['admin:afterDump'])
          .eql('dump');

        cluster.dump(new Request({
          suffix: 'suffix'
        }));

        should(cluster.node.broadcast)
          .be.calledWith('cluster:admin:dump', {suffix: 'suffix'});
      });
    });

    describe('#shutdown', () => {
      it('should do nothing if the node is not ready', () => {
        cluster.node.ready = false;

        cluster.shutdown();

        should(cluster.node.broadcast)
          .not.be.called();
      });

      it('should broadcast the shutdown event', () => {
        should(cluster.hooks['admin:afterShutdown'])
          .eql('shutdown');

        cluster.shutdown();

        should(cluster.node.broadcast)
          .be.calledWith('cluster:admin:shutdown');
      });
    });
  });

  describe('#controller', () => {
    beforeEach(() => {
      cluster.init({}, context);
      cluster.node.ready = true;
    });

    describe('#clusterHealthAction', () => {
      it('should be properly declared', () => {
        should(cluster.controllers.cluster.health)
          .eql('clusterHealthAction');
        should(cluster.routes)
          .containEql({verb: 'get', url: '/health', controller: 'cluster', action: 'health'});
      });

      it('should return a 404 if the cluster node is not ready', () => {
        cluster.node.ready = false;

        const request = new Request({});

        return cluster.clusterHealthAction(request)
          .catch((response) => {
            should(response.message)
              .eql('ko');
          });
      });

      it('should return ok if the node is ready', () => {
        const request = new Request({});

        return cluster.clusterHealthAction(request)
          .then((response) => {
            should(response).eql('ok');
            should(request.status).eql(102);
          });
      });
    });

    describe('#clusterStatusAction', () => {
      it('should be properly declared', () => {
        should(cluster.controllers.cluster.status)
          .eql('clusterStatusAction');
        should(cluster.routes)
          .containEql({verb: 'get', url: '/status', controller: 'cluster', action: 'status'});
      });

      it('should return a 404 if the cluster is not ready', () => {
        cluster.node.ready = false;

        const request = new Request({});
        return cluster.clusterStatusAction(request)
          .catch((response) => {
            should(response.message).eql('ko');
          });
      });

      it('should return the cluster summary', () => {
        cluster.node.pool = {
          foo: {pub: 'foo-pub', router: 'foo-router', ready: true},
          bar: {pub: 'bar-pub', router: 'bar-router', ready: false}
        };
        cluster.config.bindings = {
          pub: {href: 'current-pub'},
          router: {href: 'current-router'},
          ready: true
        };

        const request = new Request({});
        return cluster.clusterStatusAction(request)
          .then((response) => {
            should(response)
              .eql({
                count: 3,
                current: {
                  pub: 'current-pub',
                  router: 'current-router',
                  ready: true
                },
                pool: [
                  {
                    pub: 'foo-pub',
                    router: 'foo-router',
                    ready: true
                  },
                  {
                    pub: 'bar-pub',
                    router: 'bar-router',
                    ready: false
                  }
                ]
              });
          });
      });
    });

    describe('#clusterResetAction', () => {
      it('should be properly declared', () => {
        should(cluster.controllers.cluster.reset)
          .eql('clusterResetAction');
        should(cluster.routes)
          .containEql({verb: 'post', url: '/reset', controller: 'cluster', action: 'reset'});
      });

      it('should return a 404 if the cluster node is not ready', () => {
        cluster.node.ready = false;

        const request = new Request({});
        return cluster.clusterResetAction(request)
          .catch((response) => {
            should(response.message).eql('ko');
          });
      });

      it('should reset redis state, sync its one and broadcast a sync request', () => {
        const request = new Request({});
        return cluster.clusterResetAction(request)
          .then(() => {
            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {event: 'state:reset'});
          });
      });
    });
  });

  describe('#internal', () => {
    beforeEach(() => {
      cluster.init({}, context);
      cluster.node.ready = true;
    });

    describe('#cleanNode', () => {
      it('should reset if being the last node alive', () => {
        cluster.node.pool = {};

        return cluster.cleanNode(cluster.node)
          .then(() => {
            should(cluster.redis.srem)
              .be.calledWith('cluster:discovery', JSON.stringify({
                pub: cluster.node.pub,
                router: cluster.node.router
              }));

            should(cluster.node.state.reset)
              .be.calledOnce();

            should(cluster.node.broadcast)
              .be.calledWith('cluster:sync', {event: 'state:all'});
          });
      });

      it('should should clean node for each impacted index/collection tuple', () => {
        cluster.node.pool = {foo: 'bar'};
        cluster._rooms.tree.set('i1', new Map([
          [ 'col1', new Set() ],
          [ 'col2', new Set() ]
        ]));
        cluster._rooms.tree.set('i2', new Map([
          [ 'col3', new Set() ]
        ]));

        cluster.redis.clusterCleanNode.onFirstCall().resolves(['version', ['roomId']]);
        cluster.redis.clusterCleanNode.onSecondCall().resolves(['version', []]);
        cluster.redis.clusterCleanNode.onThirdCall().resolves(['version', ['foo', 'bar']]);

        return cluster.cleanNode(cluster.node)
          .then(() => {
            should(cluster.redis.srem)
              .be.calledWith('cluster:discovery', JSON.stringify({
                pub: cluster.node.pub,
                router: cluster.node.router
              }));

            should(cluster.redis.clusterCleanNode)
              .be.calledThrice()
              .be.calledWith('{i1/col1}', cluster.node.uuid)
              .be.calledWith('{i1/col2}', cluster.node.uuid)
              .be.calledWith('{i2/col3}', cluster.node.uuid);
          });

      });
    });

    describe('#deleteRoomCount', () => {
      it('should delete the room from the list', () => {
        cluster._rooms.flat.set('roomId', {
          index: 'index',
          collection: 'collection'
        });
        cluster._rooms.tree.set('index', new Map([
          [ 'collection', new Set(['roomId', 'anotherRoom'])]
        ]));

        cluster.deleteRoomCount('roomId');

        should(cluster._rooms.flat).be.empty();
        should(cluster._rooms.tree.get('index').get('collection'))
          .have.keys('anotherRoom');
      });

      it('should clean up empty room subtrees', () => {
        cluster._rooms.flat.set('roomId', {
          index: 'index',
          collection: 'collection'
        });
        cluster._rooms.tree.set('index', new Map([
          [ 'collection', new Set(['roomId'])]
        ]));

        cluster.deleteRoomCount('roomId');

        should(cluster._rooms.flat).be.empty();
        should(cluster._rooms.tree).be.empty();
      });
    });

    describe('#setRoomCount', () => {
      it('should update both the flat list and the index/collection tree', () => {
        cluster.setRoomCount('index', 'collection', 'roomId', 42);

        should(cluster._rooms.flat).have.value('roomId', {
          index: 'index',
          collection: 'collection',
          count: 42
        });
        should(cluster._rooms.tree.get('index').get('collection'))
          .have.keys('roomId');
      });
    });

    describe('#_onShutDown', () => {
      it('should do nothing if already shutting down', () => {
        cluster._shutdown = true;
        cluster.cleanNode = sinon.stub();

        cluster._onShutDown('event');
        should(cluster.cleanNode)
          .not.be.called();
      });

      it('should clean the current node', () => {
        cluster.cleanNode = sinon.stub();

        cluster._onShutDown('event');

        should(cluster._shutdown)
          .be.true();
        should(cluster.cleanNode)
          .be.calledWith(cluster.node);
      });
    });
  });

  describe('#overrides', () => {
    beforeEach(() => {
      cluster.init({}, context);
      cluster.node.ready = true;
    });

    describe('#_realtimeCountOverride', () => {
      it('should reject if no body is given', () => {
        const request = new Request({});

        return should(cluster._realtimeCountOverride(request))
          .be.rejectedWith('The request must specify a body.');
      });

      it('should reject if no roomId is given', () => {
        const request = new Request({
          body: {}
        });

        return should(cluster._realtimeCountOverride(request))
          .be.rejectedWith('The request must specify a body attribute "roomId".');
      });

      it('should return the room count if available', () => {
        cluster._rooms.flat.set('roomId', {
          index: 'index',
          collection: 'collection',
          count: 42
        });

        const request = new Request({
          body: { roomId: 'roomId' }
        });

        return cluster._realtimeCountOverride(request)
          .then(response => {
            should(response.count).eql(42);
          });
      });

      it('should throw if no matching room is found', () => {
        const request = new Request({
          body: {roomId: 'roomId'}
        });

        return should(cluster._realtimeCountOverride(request, 1))
          .be.rejectedWith(NotFoundError, {message: 'The room Id "roomId" does not exist'});
      });
    });

    describe('#_realtimeListOverride', () => {
      beforeEach(() => {
        cluster._rooms.flat.set('foo', {
          index: 'i1',
          collection: 'c1',
          count: 42
        });
        cluster._rooms.flat.set('bar', {
          index: 'i2',
          collection: 'c2',
          count: 3
        });
        cluster._rooms.tree.set('i1', new Map([ [ 'c1', new Set(['foo']) ] ]));
        cluster._rooms.tree.set('i2', new Map([ [ 'c2', new Set(['bar']) ] ]));
      });

      it('should return an empty object if the user has no permissions', () => {
        const request = new Request({});
        request.context.user = {
          isActionAllowed: sinon.stub().resolves(false)
        };

        return cluster._realtimeListOverride(request)
          .then(response => {
            should(response).eql({});
          });
      });

      it('should return the list', () => {
        const request = new Request({
          sorted: true
        });
        request.context.user = {
          isActionAllowed: sinon.stub().resolves(true)
        };

        return cluster._realtimeListOverride(request)
          .then(response => {
            should(response)
              .eql({
                i1: {
                  c1: {
                    foo: 42
                  }
                },
                i2: {
                  c2: {
                    bar: 3
                  }
                }
              });
          });

      });
    });
  });

});
