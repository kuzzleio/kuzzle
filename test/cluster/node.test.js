'use strict';

const sinon = require('sinon');
const should = require('should');
const mockRequire = require('mock-require');
const Long = require('long');
const { NormalizedFilter } = require('koncorde');

const { IdCard } = require('../../lib/cluster/idCardHandler');
const kuzzleStateEnum = require('../../lib/kuzzle/kuzzleStateEnum');

const KuzzleMock = require('../mocks/kuzzle.mock');
const MutexMock = require('../mocks/mutex.mock');

class ClusterPublisherMock {
  constructor () {
    this.init = sinon.stub().resolves();
    this.dispose = sinon.stub().resolves();

    this.sendAddCollection = sinon.stub();
    this.sendAddIndex = sinon.stub();
    this.sendClusterWideEvent = sinon.stub().resolves(Long.fromInt(12, true));
    this.sendDocumentNotification = sinon.stub();
    this.sendDumpRequest = sinon.stub();
    this.sendHeartbeat = sinon.stub();
    this.sendNewAuthStrategy = sinon.stub();
    this.sendNewRealtimeRoom = sinon.stub();
    this.sendNodeEvicted = sinon.stub();
    this.sendNodeShutdown = sinon.stub();
    this.sendRemoveAuthStrategy = sinon.stub();
    this.sendRemoveCollection = sinon.stub();
    this.sendRemoveIndexes = sinon.stub();
    this.sendRemoveRealtimeRoom = sinon.stub().resolves(Long.fromInt(12, true));
    this.send = sinon.stub();
    this.sendSubscription = sinon.stub();
    this.sendUnsubscription = sinon.stub().resolves(Long.fromInt(12, true));
    this.sendUserNotification = sinon.stub();
  }
}

class ClusterSubscriberMock {
  constructor (node, id, ip) {
    this.__node = node;
    this.__id = id;
    this.__ip = ip;

    this.init = sinon.stub().resolves();
    this.dispose = sinon.stub();
    this.sync = sinon.stub().resolves();

    this.remoteNodeIP = '1.2.3.4';
  }
}

class ClusterCommandMock {
  constructor () {
    this.broadcastHandshake = sinon.stub().resolves({});
    this.init = sinon.stub().resolves();
    this.dispose = sinon.stub();
    this.getFullState = sinon.stub().resolves({});
  }
}

class ClusterStateMock {
  constructor () {
    this.addAuthStrategy = sinon.stub();
    this.addRealtimeRoom = sinon.stub();
    this.addRealtimeSubscription = sinon.stub();
    this.countRealtimeSubscriptions = sinon.stub().resolves(12);
    this.getNormalizedFilters = sinon.stub();
    this.loadFullState = sinon.stub().resolves();
    this.listRealtimeRooms = sinon.stub();
    this.removeAuthStrategy = sinon.stub();
    this.removeNode = sinon.stub();
    this.removeRealtimeRoom = sinon.stub();
    this.removeRealtimeSubscription = sinon.stub();
    this.serialize = sinon.stub();
  }
}

class IdCardHandlerMock {
  constructor () {
    this.nodeId = 'foonode';

    this.idCard = new IdCard({
      birthdate: 120,
      id: 'foonode',
      ip: '2.3.4.1',
      topology: [],
    });

    this.addNode = sinon.stub().resolves();
    this.createIdCard = sinon.stub().resolves();
    this.dispose = sinon.stub().resolves();
    this.getRemoteIdCards = sinon.stub().resolves([]);
    this.removeNode = sinon.stub().resolves();
  }
}

describe('#Cluster Node', () => {
  let ClusterNode;
  let kuzzle;
  let node;
  const networkInterfaces = {
    lo: [ { internal: true } ],
    private: [
      {
        address: '10.1.1.1',
        family: 'IPv4',
        mac: 'welp',
        internal: false,
      },
      {
        address: 'fe80::b468:a254:bb56:ea68',
        family: 'IPv6',
        mac: 'welp',
        internal: false,
      },
    ],
    public: [
      {
        address: '11.1.1.1',
        family: 'IPv4',
        mac: 'welp2',
        internal: false,
      },
      {
        address: 'fe81::b468:a254:bb56:ea68',
        family: 'IPv6',
        mac: 'welp2',
        internal: false,
      },
    ],
    apipa: [
      {
        address: '169.254.2.3',
        family: 'IPv4',
        mac: 'ohnoes',
        internal: false,
      },
    ],
  };

  before(() => {
    mockRequire('../../lib/cluster/publisher', ClusterPublisherMock);
    mockRequire('../../lib/cluster/subscriber', ClusterSubscriberMock);
    mockRequire('../../lib/cluster/command', ClusterCommandMock);
    mockRequire('../../lib/cluster/state', ClusterStateMock);
    mockRequire('../../lib/cluster/idCardHandler', {
      ClusterIdCardHandler: IdCardHandlerMock,
      IdCard
    });
    mockRequire('../../lib/util/mutex', { Mutex: MutexMock });
    mockRequire('os', { networkInterfaces: () => networkInterfaces });

    ClusterNode = mockRequire.reRequire('../../lib/cluster/node');
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.config.cluster.minimumNodes = 1;
    node = new ClusterNode();
  });

  describe('#constructor', () => {
    it('should select the correct IP address according to the configuration', () => {
      kuzzle.config.cluster.ip = 'private';
      kuzzle.config.cluster.ipv6 = false;
      kuzzle.config.interface = null;
      node = new ClusterNode();
      should(node.ip).be.eql('10.1.1.1');

      kuzzle.config.cluster.ip = 'private';
      kuzzle.config.cluster.ipv6 = true;
      kuzzle.config.cluster.interface = null;
      node = new ClusterNode();
      should(node.ip).be.eql('fe80::b468:a254:bb56:ea68');

      kuzzle.config.cluster.ip = 'public';
      kuzzle.config.cluster.ipv6 = false;
      kuzzle.config.cluster.interface = null;
      node = new ClusterNode();
      should(node.ip).be.eql('11.1.1.1');

      kuzzle.config.cluster.ip = 'public';
      kuzzle.config.cluster.ipv6 = true;
      kuzzle.config.cluster.interface = null;
      node = new ClusterNode();
      should(node.ip).be.eql('fe81::b468:a254:bb56:ea68');

      kuzzle.config.cluster.ip = null;
      kuzzle.config.cluster.ipv6 = false;
      kuzzle.config.cluster.interface = 'welp2';
      node = new ClusterNode();
      should(node.ip).be.eql('11.1.1.1');

      kuzzle.config.cluster.ip = null;
      kuzzle.config.cluster.ipv6 = true;
      kuzzle.config.cluster.interface = 'welp2';
      node = new ClusterNode();
      should(node.ip).be.eql('fe81::b468:a254:bb56:ea68');

      kuzzle.config.cluster.ip = null;
      kuzzle.config.cluster.ipv6 = false;
      kuzzle.config.cluster.interface = null;
      node = new ClusterNode();
      should(node.ip).be.eql('10.1.1.1');

      kuzzle.config.cluster.ip = null;
      kuzzle.config.cluster.ipv6 = true;
      kuzzle.config.cluster.interface = null;
      node = new ClusterNode();
      should(node.ip).be.eql('fe80::b468:a254:bb56:ea68');
    });

    it('should throw if no valid IP address can be found', () => {
      kuzzle.config.cluster.interface = 'foobar';

      should(() => new ClusterNode()).throw(/^\[CLUSTER\] No suitable IP address found with the provided configuration/);
    });

    it('should throw if the only available address is an APIPA', () => {
      kuzzle.config.cluster.interface = 'apipa';
      should(() => new ClusterNode()).throw(/^\[CLUSTER\] No suitable IP address found with the provided configuration/);
    });
  });

  describe('#init', () => {
    beforeEach(() => {
      sinon.stub(node, 'handshake').resolves();
      sinon.stub(node, 'countActiveNodes').returns(1);
      node.nodeId = 'foonode';
    });

    it('should start a publisher and open a command socket', async () => {
      await node.init();

      should(node.publisher).instanceOf(ClusterPublisherMock);
      should(node.publisher.init).calledOnce();

      should(node.command).instanceOf(ClusterCommandMock);
      should(node.command.init).calledOnce();
    });

    it('should register a kuzzle shutdown handler', async () => {
      const fakeSubscriber = {
        dispose: sinon.stub(),
      };

      await node.init();

      node.remoteNodes.set('foo', fakeSubscriber);
      node.remoteNodes.set('bar', fakeSubscriber);
      node.remoteNodes.set('baz', fakeSubscriber);

      kuzzle.pipe.restore();
      await kuzzle.pipe('kuzzle:shutdown');

      should(node.idCardHandler.dispose).calledOnce();
      should(fakeSubscriber.dispose).calledThrice();
      should(node.publisher.dispose).calledOnce();
      should(node.command.dispose).calledOnce();
    });

    it('should start a handshake after opening command/publish sockets', async () => {
      await node.init();

      should(node.handshake).calledOnce();

      should(node.handshake.calledAfter(node.publisher.init)).be.true();
      should(node.handshake.calledAfter(node.command.init)).be.true();
    });

    it('should not resolve its promise until the quorum is reached', async () => {
      const resolved = Promise.resolve('init_waiting');

      kuzzle.config.cluster.minimumNodes = 3;

      const initPromise = node.init();

      await new Promise(resolve => setTimeout(resolve, 300));
      await should(Promise.race([initPromise, resolved])).fulfilledWith('init_waiting');

      node.countActiveNodes.returns(3);
      await new Promise(resolve => setTimeout(resolve, 100));
      await should(Promise.race([initPromise, resolved])).fulfilledWith('foonode');
    });
  });

  describe('#ask events', () => {
    beforeEach(() => {
      kuzzle.ask.restore();

      sinon.stub(node, 'handshake').resolves();
      sinon.stub(node, 'countActiveNodes').returns(1);
      node.nodeId = 'foonode';

      return node.init();
    });

    it('should expose a method to remove a realtime room', async () => {
      node.publisher.sendRemoveRealtimeRoom.resolves('msgid');

      await kuzzle.ask('cluster:realtime:room:remove', 'roomId');

      should(node.publisher.sendRemoveRealtimeRoom)
        .calledOnce()
        .calledWith('roomId');

      should(node.fullState.removeRealtimeRoom)
        .calledOnce()
        .calledWith('roomId', node.nodeId);
    });

    it('should expose a method to count subscriptions in a realtime room', async () => {
      await kuzzle.ask('cluster:realtime:room:count', 'roomId');

      should(node.fullState.countRealtimeSubscriptions)
        .calledOnce()
        .calledWith('roomId');
    });

    it('should expose a method to get a realtime rooms list', async () => {
      await kuzzle.ask('cluster:realtime:room:list');

      should(node.fullState.listRealtimeRooms).calledOnce();
    });

    it('should expose a method to get realtime filters', async () => {
      await kuzzle.ask('cluster:realtime:filters:get', 'roomId');

      should(node.fullState.getNormalizedFilters)
        .calledOnce()
        .calledWith('roomId');
    });

    it('should expose a method to broadcast cluster event payloads', async () => {
      await kuzzle.ask('cluster:event:broadcast', 'event', 'payload');

      should(node.publisher.sendClusterWideEvent)
        .calledOnce()
        .calledWith('event', 'payload');
    });

    it('should expose a method to add a cluster event listener', async () => {
      sinon.stub(node.eventEmitter, 'on');

      await kuzzle.ask('cluster:event:on', 'event', 'function');

      should(node.eventEmitter.on).calledOnce().calledWith('event', 'function');
    });

    it('should expose a method to add a one-time cluster event listener', async () => {
      sinon.stub(node.eventEmitter, 'once');

      await kuzzle.ask('cluster:event:once', 'event', 'function');

      should(node.eventEmitter.once).calledOnce().calledWith('event', 'function');
    });

    it('should expose a method to remove a cluster event listener', async () => {
      sinon.stub(node.eventEmitter, 'removeListener');

      await kuzzle.ask('cluster:event:off', 'event', 'function');

      should(node.eventEmitter.removeListener)
        .calledOnce()
        .calledWith('event', 'function');
    });

    it('should expose a method to remove all cluster event listeners', async () => {
      sinon.stub(node.eventEmitter, 'removeAllListeners');

      await kuzzle.ask('cluster:event:removeAllListeners', 'event');

      should(node.eventEmitter.removeAllListeners)
        .calledOnce()
        .calledWith('event');
    });

    it('should expose a method to get the cluster status', async () => {
      node.trackActivity('id', '1.2.3.4', 1);
      node.trackActivity('id', '1.2.3.4', 2, 'because');
      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({
          birthdate: 123,
          id: 'id2',
          ip: '2.3.4.5',
        }),
        new IdCard({
          birthdate: 124,
          id: 'id3',
          ip: '2.3.4.6',
        }),
      ]);

      should(await kuzzle.ask('cluster:status:get')).match({
        activeNodes: 3,
        activity: [
          {
            address: '1.2.3.4',
            event: 'joined',
            id: 'id',
          },
          {
            address: '1.2.3.4',
            event: 'evicted',
            id: 'id',
            reason: 'because',
          },
        ],
        nodes: [
          { address: '2.3.4.5', birthdate: '1970-01-01T00:00:00.123Z', id: 'id2' },
          { address: '2.3.4.6', birthdate: '1970-01-01T00:00:00.124Z', id: 'id3' },
          { address: '2.3.4.1', birthdate: '1970-01-01T00:00:00.120Z', id: 'foonode' },
        ],
      });
    });
  });

  describe('#event listeners', () => {
    beforeEach(() => {
      kuzzle.emit.restore();

      sinon.stub(node, 'handshake').resolves();
      sinon.stub(node, 'countActiveNodes').returns(3);
      node.nodeId = 'foonode';

      return node.init();
    });

    it('should synchronize realtime room creations', () => {
      node.publisher.sendNewRealtimeRoom.returns('msgid');

      const normalized = new NormalizedFilter([], 'roomId', 'index/collection');

      kuzzle.emit('core:realtime:room:create:after', normalized);

      should(node.publisher.sendNewRealtimeRoom)
        .calledOnce()
        .calledWith(normalized);

      should(node.fullState.addRealtimeRoom)
        .calledOnce()
        .calledWithMatch('roomId', 'index', 'collection', [], {
          messageId: 'msgid',
          nodeId: 'foonode',
          subscribers: 0,
        });
    });

    it('should synchronize realtime subscriptions', () => {
      node.publisher.sendSubscription.returns('msgid');

      kuzzle.emit('core:realtime:subscribe:after', 'roomId');

      should(node.publisher.sendSubscription).calledOnce().calledWith('roomId');

      should(node.fullState.addRealtimeSubscription)
        .calledOnce()
        .calledWith('roomId', 'foonode', 'msgid');
    });

    it('should synchronize realtime unsubscriptions', () => {
      node.publisher.sendUnsubscription.returns('msgid');

      kuzzle.emit('core:realtime:unsubscribe:after', 'roomId');

      should(node.publisher.sendUnsubscription)
        .calledOnce()
        .calledWith('roomId');

      should(node.fullState.removeRealtimeSubscription)
        .calledOnce()
        .calledWith('roomId', 'foonode', 'msgid');
    });

    it('should synchronize document notifications', () => {
      kuzzle.emit('core:notify:document', {
        notification: 'notification',
        rooms: 'rooms',
      });

      should(node.publisher.sendDocumentNotification)
        .calledOnce()
        .calledWith('rooms', 'notification');
    });

    it('should synchronize user notifications', () => {
      kuzzle.emit('core:notify:user', {
        notification: 'notification',
        room: 'room',
      });

      should(node.publisher.sendUserNotification)
        .calledOnce()
        .calledWith('room', 'notification');
    });

    it('should synchronize new authentication strategies', () => {
      kuzzle.emit('core:auth:strategyAdded', {
        name: 'name',
        pluginName: 'pluginName',
        strategy: 'strategy',
      });

      should(node.publisher.sendNewAuthStrategy)
        .calledOnce()
        .calledWith('name', 'pluginName', 'strategy');

      should(node.fullState.addAuthStrategy).calledOnce().calledWithMatch({
        pluginName: 'pluginName',
        strategy: 'strategy',
        strategyName: 'name',
      });
    });

    it('should synchronize authentication strategies removal', () => {
      kuzzle.emit('core:auth:strategyRemoved', {
        name: 'name',
        pluginName: 'pluginName',
      });

      should(node.publisher.sendRemoveAuthStrategy)
        .calledOnce()
        .calledWith('name', 'pluginName');

      should(node.fullState.removeAuthStrategy)
        .calledOnce()
        .calledWith('name');
    });

    it('should synchronize successful dump requests', () => {
      kuzzle.emit('admin:afterDump', 'suffix');

      should(node.publisher.sendDumpRequest).calledOnce().calledWith('suffix');
    });

    it('should synchronize security resets', () => {
      kuzzle.emit('admin:afterResetSecurity');

      should(node.publisher.send)
        .calledOnce()
        .calledWith('ResetSecurity', {});
    });

    it('should propagate cluster-wide shutdowns', () => {
      kuzzle.emit('admin:afterShutdown');

      should(node.publisher.send)
        .calledOnce()
        .calledWith('Shutdown', {});
    });

    it('should synchronize validators removal', () => {
      kuzzle.emit('collection:afterDeleteSpecifications');

      should(node.publisher.send)
        .calledOnce()
        .calledWith('RefreshValidators', {});
    });

    it('should synchronize validators update', () => {
      kuzzle.emit('collection:afterUpdateSpecifications');

      should(node.publisher.send)
        .calledOnce()
        .calledWith('RefreshValidators', {});
    });

    it('should synchronize profiles creation', () => {
      kuzzle.emit('core:security:profile:create', { args: [ 'profileId' ] });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateProfile', { profileId: 'profileId' });
    });

    it('should synchronize profiles creation or replacement', () => {
      kuzzle.emit('core:security:profile:createOrReplace', {
        args: [ 'profileId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateProfile', { profileId: 'profileId' });
    });

    it('should synchronize profiles update', () => {
      kuzzle.emit('core:security:profile:update', {
        args: [ 'profileId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateProfile', { profileId: 'profileId' });
    });

    it('should synchronize profiles removal', () => {
      kuzzle.emit('core:security:profile:delete', {
        args: [ 'profileId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateProfile', { profileId: 'profileId' });
    });

    it('should synchronize roles creation', () => {
      kuzzle.emit('core:security:role:create', {
        args: [ 'roleId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateRole', { roleId: 'roleId' });
    });

    it('should synchronize roles creation or replacement', () => {
      kuzzle.emit('core:security:role:createOrReplace', {
        args: [ 'roleId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateRole', { roleId: 'roleId' });
    });

    it('should synchronize roles update', () => {
      kuzzle.emit('core:security:role:update', {
        args: [ 'roleId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateRole', { roleId: 'roleId' });
    });

    it('should synchronize roles removal', () => {
      kuzzle.emit('core:security:role:delete', {
        args: [ 'roleId' ],
      });

      should(node.publisher.send)
        .calledOnce()
        .calledWith('InvalidateRole', { roleId: 'roleId' });
    });

    it('should synchronize new indexes', () => {
      kuzzle.emit('core:storage:index:create:after', {
        index: 'index',
        scope: 'scope',
      });

      should(node.publisher.sendAddIndex)
        .calledOnce()
        .calledWith('scope', 'index');
    });

    it('should synchronize a single index removal', () => {
      kuzzle.emit('core:storage:index:delete:after', {
        index: 'index',
        scope: 'scope',
      });

      should(node.publisher.sendRemoveIndexes)
        .calledOnce()
        .calledWithMatch('scope', [ 'index' ]);
    });

    it('should synchronize multiple indexes removal', () => {
      kuzzle.emit('core:storage:index:mDelete:after', {
        indexes: [ 'index', 'index2' ],
        scope: 'scope',
      });

      should(node.publisher.sendRemoveIndexes)
        .calledOnce()
        .calledWithMatch('scope', [ 'index', 'index2' ]);
    });

    it('should synchronize new collections', () => {
      kuzzle.emit('core:storage:collection:create:after', {
        collection: 'collection',
        index: 'index',
        scope: 'scope',
      });

      should(node.publisher.sendAddCollection)
        .calledOnce()
        .calledWith('scope', 'index', 'collection');
    });

    it('should synchronize collections removal', () => {
      kuzzle.emit('core:storage:collection:delete:after', {
        collection: 'collection',
        index: 'index',
        scope: 'scope',
      });

      should(node.publisher.sendRemoveCollection)
        .calledOnce()
        .calledWith('scope', 'index', 'collection');
    });
  });

  describe('#handshake', () => {
    afterEach(() => {
      clearInterval(node.heartbeatTimer);
    });

    it('should return immediately if there are no other nodes to connect to', async () => {
      kuzzle.config.cluster.joinTimeout = 12345;
      node.idCardHandler.getRemoteIdCards.resolves([]);

      await node.handshake();

      should(MutexMock.__getLastMutex().timeout).eql(12345);
      should(MutexMock.__getLastMutex().lock).calledOnce();
      should(MutexMock.__getLastMutex().unlock).calledOnce();

      should(node.idCardHandler.createIdCard).calledOnce();
      should(node.idCardHandler.getRemoteIdCards).calledOnce();
      should(node.remoteNodes).be.empty();
      should(node.command.getFullState).not.called();
      should(node.fullState.loadFullState).not.called();
      should(node.heartbeatTimer).not.be.null();
      should(node.idCardHandler.addNode).not.called();
    });

    it('should abort if another node has the same IP as this one', async () => {
      const nodes = [
        new IdCard({ id: 'bar', ip: '2.3.4.1'}),
        new IdCard({ id: 'baz', ip: '2.3.4.2'}),
        new IdCard({ id: 'qux', ip: '2.3.4.3'}),
      ];

      node.idCardHandler.getRemoteIdCards.resolves(nodes);
      node.ip = '2.3.4.2';

      await node.handshake();

      should(node.idCardHandler.createIdCard).calledOnce();
      should(node.idCardHandler.getRemoteIdCards).calledOnce();

      should(node.command.getFullState).not.called();
      should(node.command.broadcastHandshake).not.called();
      should(node.fullState.loadFullState).not.called();

      should(kuzzle.log.error).calledWithMatch(/Another node share the same IP address as this one \(2.3.4.2\): baz/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should be able to connect to existing nodes and get a fullstate', async () => {
      const fullstate = { full: 'state', activity: [], nodesState: [] };
      const nodes = [
        new IdCard({ id: 'bar', ip: '2.3.4.1'}),
        new IdCard({ id: 'baz', ip: '2.3.4.2'}),
        new IdCard({ id: 'qux', ip: '2.3.4.3'}),
      ];

      node.command.getFullState.resolves(fullstate);
      node.idCardHandler.getRemoteIdCards.resolves(nodes);
      node.command.broadcastHandshake.resolves({
        bar: {},
        baz: {},
        qux: {},
      });

      await node.handshake();

      should(node.idCardHandler.createIdCard).calledOnce();
      should(node.idCardHandler.getRemoteIdCards).calledOnce();
      should(node.remoteNodes).have.size(3);

      for (const subscriber of node.remoteNodes.values()) {
        should(subscriber).instanceOf(ClusterSubscriberMock);
        should(subscriber.init).calledOnce();
        should(subscriber.__node).eql(node);
        should(subscriber.__id).oneOf('bar', 'baz', 'qux');
        should(subscriber.__ip).oneOf('2.3.4.1', '2.3.4.2', '2.3.4.3');
      }

      should(node.command.getFullState).calledOnce();
      should(node.command.broadcastHandshake).calledOnce().calledWith(nodes);
      should(node.fullState.loadFullState).calledOnce().calledWith(fullstate);
      should(node.heartbeatTimer).not.be.null();

      should(node.idCardHandler.addNode).calledThrice();
      should(node.idCardHandler.addNode).calledWith('bar');
      should(node.idCardHandler.addNode).calledWith('baz');
      should(node.idCardHandler.addNode).calledWith('qux');
    });

    it('should retry getting a fullstate if unable to get one the first time', async () => {
      const fullstate = { full: 'state', activity: [], nodesState: [] };
      const nodes = [
        new IdCard({ id: 'bar', ip: '2.3.4.1'}),
        new IdCard({ id: 'baz', ip: '2.3.4.2'}),
        new IdCard({ id: 'qux', ip: '2.3.4.3'}),
      ];

      node.heartbeatDelay = 10;

      node.command.getFullState.onFirstCall().resolves(null);
      node.command.getFullState.onSecondCall().resolves(fullstate);
      node.command.broadcastHandshake.resolves({
        bar: {},
        baz: {},
        qux: {},
      });

      node.idCardHandler.getRemoteIdCards.resolves(nodes);

      await node.handshake();

      should(node.idCardHandler.createIdCard).calledOnce();
      should(node.idCardHandler.getRemoteIdCards).calledTwice();
      should(node.remoteNodes).have.size(3);

      for (const subscriber of node.remoteNodes.values()) {
        should(subscriber).instanceOf(ClusterSubscriberMock);
        should(subscriber.init).calledOnce();
        should(subscriber.__node).eql(node);
        should(subscriber.__id).oneOf('bar', 'baz', 'qux');
        should(subscriber.__ip).oneOf('2.3.4.1', '2.3.4.2', '2.3.4.3');
      }

      should(node.command.getFullState).calledTwice();
      should(node.fullState.loadFullState).calledOnce().calledWith(fullstate);
      should(node.command.broadcastHandshake).calledOnce().calledWith(nodes);
      should(node.heartbeatTimer).not.be.null();

      should(node.idCardHandler.addNode).calledThrice();
      should(node.idCardHandler.addNode).calledWith('bar');
      should(node.idCardHandler.addNode).calledWith('baz');
      should(node.idCardHandler.addNode).calledWith('qux');

      should(kuzzle.log.warn).calledWithMatch(/Retrying/);
    });

    it('should abort and shutdown if unable to get a fullstate', async () => {
      node.heartbeatDelay = 10;

      node.command.getFullState.resolves(null);

      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'bar', ip: '2.3.4.1'}),
        new IdCard({ id: 'baz', ip: '2.3.4.2'}),
        new IdCard({ id: 'qux', ip: '2.3.4.3'}),
      ]);

      await node.handshake();

      should(node.idCardHandler.createIdCard).calledOnce();
      should(node.idCardHandler.getRemoteIdCards).calledTwice();
      should(node.idCardHandler.addNode).not.called();

      should(node.command.getFullState).calledTwice();
      should(node.command.broadcastHandshake).not.called();
      should(node.fullState.loadFullState).not.called();

      should(kuzzle.log.warn).calledWithMatch(/Retrying/);
      should(kuzzle.log.error).calledWithMatch(/network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should sync with nodes that answered the handshake, and discard the rest', async () => {
      const fullstate = { full: 'state', activity: [], nodesState: [{id: 'qux', lastMessageId: 'quxLastMessageId'}] };
      const nodes = [
        new IdCard({ id: 'bar', ip: '2.3.4.1'}),
        new IdCard({ id: 'baz', ip: '2.3.4.2'}),
        new IdCard({ id: 'qux', ip: '2.3.4.3'}),
      ];

      node.command.getFullState.resolves(fullstate);
      node.command.broadcastHandshake.resolves({
        bar: { lastMessageId: 'barmsgid' },
        baz: null,
        qux: { lastMessageId: 'quxmsgid' },
      });
      node.idCardHandler.getRemoteIdCards.resolves(nodes);

      await node.handshake();

      should(node.idCardHandler.createIdCard).calledOnce();
      should(node.idCardHandler.getRemoteIdCards).calledOnce();
      should(node.remoteNodes).have.size(2);

      for (const subscriber of node.remoteNodes.values()) {
        should(subscriber).instanceOf(ClusterSubscriberMock);
        should(subscriber.init).calledOnce();
        should(subscriber.__node).eql(node);
        should(subscriber.__id).oneOf('bar', 'qux');
        should(subscriber.__ip).oneOf('2.3.4.1', '2.3.4.3');
        should(subscriber.sync).calledOnce();
        should(subscriber.sync.firstCall.args[0]).oneOf('barmsgid', 'quxLastMessageId');
      }

      should(node.command.getFullState).calledOnce();
      should(node.command.broadcastHandshake).calledOnce().calledWith(nodes);
      should(node.fullState.loadFullState).calledOnce().calledWith(fullstate);
      should(node.heartbeatTimer).not.be.null();

      should(node.idCardHandler.addNode).calledTwice();
      should(node.idCardHandler.addNode).calledWith('bar');
      should(node.idCardHandler.addNode).calledWith('qux');
    });

    it('should shutdown if unable to complete handshake before a timeout', async () => {
      kuzzle.config.cluster.joinTimeout = 10;
      node.idCardHandler.createIdCard
        .returns(new Promise(resolve => setTimeout(resolve, 100)));

      node.handshake();

      await new Promise(resolve => setTimeout(resolve, 50));

      should(kuzzle.log.error).calledWithMatch(/timed out/);
      should(kuzzle.shutdown).calledOnce();
    });
  });

  describe('#node addition', () => {
    it('should add the new node to the list and subscribe to it', async () => {
      await should(node.addNode('foo', '1.2.3.4', Long.fromInt(23, true)))
        .be.fulfilledWith(true);

      should(node.idCardHandler.addNode).calledOnce().calledWith('foo');
      should(node.activity[0]).match({
        address: '1.2.3.4',
        event: 1,
        id: 'foo',
      });
    });

    it('should lift the "not enough nodes" state if the quorum is reached', async () => {
      kuzzle.state = kuzzleStateEnum.NOT_ENOUGH_NODES;
      kuzzle.config.cluster.minimumNodes = 2;

      await should(node.addNode('foo', '1.2.3.4', Long.fromInt(23, true)))
        .be.fulfilledWith(true);

      should(kuzzle.state).eql(kuzzleStateEnum.RUNNING);
      should(kuzzle.log.warn).calledWithMatch(/Minimum number of nodes reached/);
    });

    it('should do nothing if the node already known', async () => {
      node.remoteNodes.set('foo', {});

      await should(node.addNode('foo', '1.2.3.4', Long.fromInt(23, true)))
        .be.fulfilledWith(false);

      should(node.idCardHandler.addNode).not.called();
    });
  });

  describe('#self eviction', () => {
    it('should send an eviction message to other nodes', async () => {
      const error = new Error('bar');
      node.nodeId = 'qux';

      await node.evictSelf('foo', error);

      should(kuzzle.log.error).calledWithMatch(/foo/);
      should(kuzzle.log.error).calledWith(error.stack);
      should(kuzzle.shutdown).calledOnce();

      should(node.publisher.sendNodeEvicted)
        .calledOnce()
        .calledWith('qux', 'qux', 'foo');
    });
  });

  describe('#remote node eviction', () => {
    const fakeSubscriber = {
      dispose: sinon.stub(),
      remoteNodeIP: '1.2.3.4',
    };

    beforeEach(() => {
      fakeSubscriber.dispose.resetHistory();

      node.nodeId = 'thisnode';
      node.remoteNodes.set('foo', fakeSubscriber);
      node.remoteNodes.set('bar', fakeSubscriber);
      node.remoteNodes.set('baz', fakeSubscriber);
      sinon.stub(node, 'enforceClusterConsistency');
    });

    it('should broadcast a node eviction to all other nodes', async () => {
      await node.evictNode('bar', { broadcast: true, reason: 'because' });

      should(kuzzle.log.warn).calledWith('[CLUSTER] Node "bar" evicted. Reason: because');
      should(node.activity[0]).match({
        address: '1.2.3.4',
        event: 2,
        id: 'bar',
      });

      should(node.idCardHandler.removeNode).calledOnce().calledWith('bar');
      should(node.remoteNodes).have.size(2);
      should(node.remoteNodes).not.have.key('bar');
      should(node.publisher.sendNodeEvicted)
        .calledOnce()
        .calledWith('thisnode', 'bar', 'because');
      should(fakeSubscriber.dispose).calledOnce();
      should(kuzzle.state).eql(kuzzleStateEnum.RUNNING);
      should(node.enforceClusterConsistency).calledOnce();
    });

    it('should evict a node without broadcasting if not asked to', async () => {
      await node.evictNode('bar', { reason: 'because' });

      should(kuzzle.log.warn).calledWith('[CLUSTER] Node "bar" evicted. Reason: because');
      should(node.activity[0]).match({
        address: '1.2.3.4',
        event: 2,
        id: 'bar',
      });

      should(node.idCardHandler.removeNode).calledOnce().calledWith('bar');
      should(node.remoteNodes).have.size(2);
      should(node.remoteNodes).not.have.key('bar');
      should(node.publisher.sendNodeEvicted).not.called();
      should(kuzzle.state).eql(kuzzleStateEnum.RUNNING);
      should(node.enforceClusterConsistency).calledOnce();
    });

    it('should change the kuzzle state if there are not enough nodes active', async () => {
      kuzzle.config.cluster.minimumNodes = 4;

      await node.evictNode('bar', { reason: 'because' });

      should(kuzzle.log.warn).calledWith('[CLUSTER] Node "bar" evicted. Reason: because');
      should(node.activity[0]).match({
        address: '1.2.3.4',
        event: 2,
        id: 'bar',
      });

      should(node.idCardHandler.removeNode).calledOnce().calledWith('bar');
      should(node.remoteNodes).have.size(2);
      should(node.remoteNodes).not.have.key('bar');
      should(node.publisher.sendNodeEvicted).not.called();
      should(kuzzle.state).eql(kuzzleStateEnum.NOT_ENOUGH_NODES);
      should(kuzzle.log.warn).calledWithMatch(/Not enough nodes active/);
      should(node.enforceClusterConsistency).calledOnce();
    });

    it('should do nothing if the node is unknown', async () => {
      await node.evictNode('nope', { broadcast: true, reason: 'because' });

      should(node.activity).be.empty();

      should(node.idCardHandler.removeNode).not.called();
      should(node.remoteNodes).have.size(3);
      should(node.publisher.sendNodeEvicted).not.called();
      should(fakeSubscriber.dispose).not.called();
      should(kuzzle.state).eql(kuzzleStateEnum.RUNNING);
      should(node.enforceClusterConsistency).not.called();
    });
  });

  describe('#topology check', () => {
    beforeEach(() => {
      node.heartbeatDelay = 0;
      node.nodeId = 'A';
      node.idCardHandler.idCard.id = 'A';
    });

    it('should do nothing if the cluster is consistent', async () => {
      node.idCardHandler.idCard.topology = new Set(['B', 'C']);
      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['A', 'C']}),
        new IdCard({ id: 'C', topology: ['A', 'B']}),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.shutdown).not.called();
    });

    it('should shutdown if separated from the cluster (full split)', async () => {
      node.idCardHandler.idCard.topology = new Set([]);
      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['C']}),
        new IdCard({ id: 'C', topology: ['B']}),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.log.error).calledWithMatch(/Network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should shutdown if separated from the cluster (partial split)', async () => {
      node.idCardHandler.idCard.topology = new Set(['B']);
      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['A', 'C', 'D']}),
        new IdCard({ id: 'C', topology: ['B', 'D']}),
        new IdCard({ id: 'D', topology: ['B', 'C']}),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.log.error).calledWithMatch(/Network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should shutdown if part of a smaller split', async () => {
      node.idCardHandler.idCard.topology = new Set(['B']);
      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['A'] }),
        new IdCard({ id: 'C', topology: ['D', 'E'] }),
        new IdCard({ id: 'D', topology: ['C', 'E'] }),
        new IdCard({ id: 'E', topology: ['C', 'D'] }),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.log.error).calledWithMatch(/Network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should shutdown if part of one of the smaller splits', async () => {
      node.idCardHandler.idCard.topology = new Set(['B']);
      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['A'] }),
        new IdCard({ id: 'C', topology: ['D', 'E'] }),
        new IdCard({ id: 'D', topology: ['C', 'E'] }),
        new IdCard({ id: 'E', topology: ['C', 'D'] }),
        new IdCard({ id: 'F', topology: ['G'] }),
        new IdCard({ id: 'G', topology: ['F'] }),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.log.error).calledWithMatch(/Network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should shutdown if multiple splits have the same size, and if the youngest node', async () => {
      node.idCardHandler.idCard.topology = new Set(['B']);
      node.idCardHandler.idCard.birthdate = 900;

      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['A'], birthdate: 100 }),
        new IdCard({ id: 'C', topology: ['D'], birthdate: 500 }),
        new IdCard({ id: 'D', topology: ['C'], birthdate: 200 }),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.log.error).calledWithMatch(/Network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should shutdown if multiple splits have the same size, and if the youngest node is in the same split', async () => {
      node.idCardHandler.idCard.topology = new Set(['B']);
      node.idCardHandler.idCard.birthdate = 100;

      node.idCardHandler.getRemoteIdCards.resolves([
        new IdCard({ id: 'B', topology: ['A'], birthdate: 900 }),
        new IdCard({ id: 'C', topology: ['D'], birthdate: 500 }),
        new IdCard({ id: 'D', topology: ['C'], birthdate: 200 }),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.log.error).calledWithMatch(/Network split detected/);
      should(kuzzle.shutdown).calledOnce();
    });

    it('should not shut itself down if part of a bigger split', async () => {
      node.idCardHandler.idCard.topology = new Set(['B', 'C']);
      node.idCardHandler.getRemoteIdCards.onFirstCall().resolves([
        new IdCard({ id: 'B', topology: ['A', 'C'] }),
        new IdCard({ id: 'C', topology: ['A', 'B'] }),
        new IdCard({ id: 'D', topology: ['E'] }),
        new IdCard({ id: 'E', topology: ['D'] }),
        new IdCard({ id: 'F', topology: ['G'] }),
        new IdCard({ id: 'G', topology: ['F'] }),
      ]);
      node.idCardHandler.getRemoteIdCards.onSecondCall().resolves([
        new IdCard({ id: 'B', topology: ['A', 'C'] }),
        new IdCard({ id: 'C', topology: ['A', 'B'] })
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.shutdown).not.called();
    });

    it('should not shut itself down if not in the same split as the youngest node', async () => {
      node.idCardHandler.idCard.birthdate = 900;
      node.idCardHandler.idCard.topology = new Set(['B', 'C']);
      node.idCardHandler.getRemoteIdCards.onFirstCall().resolves([
        new IdCard({ id: 'B', topology: ['A', 'C'], birthdate: 800 }),
        new IdCard({ id: 'C', topology: ['A', 'B'], birthdate: 850 }),
        new IdCard({ id: 'D', topology: ['E'], birthdate: 1200 }),
        new IdCard({ id: 'E', topology: ['D'], birthdate: 100 }),
        new IdCard({ id: 'F', topology: ['G'], birthdate: 3000 }),
        new IdCard({ id: 'G', topology: ['F'], birthdate: 4000 }),
      ]);
      node.idCardHandler.getRemoteIdCards.onSecondCall().resolves([
        new IdCard({ id: 'B', topology: ['A', 'C'], birthdate: 800 }),
        new IdCard({ id: 'C', topology: ['A', 'B'], birthdate: 850 }),
        new IdCard({ id: 'D', topology: ['E'], birthdate: 1200 }),
        new IdCard({ id: 'E', topology: ['D'], birthdate: 100 }),
      ]);
      node.idCardHandler.getRemoteIdCards.onThirdCall().resolves([
        new IdCard({ id: 'B', topology: ['A', 'C'], birthdate: 800 }),
        new IdCard({ id: 'C', topology: ['A', 'B'], birthdate: 850 }),
      ]);

      await node.enforceClusterConsistency();

      should(kuzzle.shutdown).not.called();
    });

    it('should not shut itself down if part of an elected split, but if it also sees other nodes', async () => {
      node.idCardHandler.idCard.topology = new Set(['B', 'C', 'D']);
      node.idCardHandler.getRemoteIdCards.onFirstCall().resolves([
        new IdCard({ id: 'B', topology: ['A'], birthdate: 800 }),
        new IdCard({ id: 'C', topology: ['A'], birthdate: 850 }),
        new IdCard({ id: 'D', topology: ['A'], birthdate: 1200 }),
      ]);
      node.idCardHandler.getRemoteIdCards.onSecondCall().callsFake(() => {
        node.idCardHandler.idCard.topology = new Set([]);
        return [];
      });

      await node.enforceClusterConsistency();

      should(kuzzle.shutdown).not.called();
    });
  });
});
