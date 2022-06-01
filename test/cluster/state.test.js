'use strict';

const should = require('should');
const Long = require('long');
const { NormalizedFilter } = require('koncorde');

const Kuzzle = require('../mocks/kuzzle.mock');

const { InternalError } = require('../../lib/kerror/errors');
const State = require('../../lib/cluster/state');

describe('#Cluster Full State', () => {
  let kuzzle;
  let state;

  beforeEach(() => {
    kuzzle = new Kuzzle();
    state = new State();
  });

  describe('#realtime', () => {
    it('should be able to store new realtime rooms', () => {
      const filters = { oh: { hai: { can: { I: 'haz cheezburgers?' } } } };
      const node = {
        messageId: 456,
        nodeId: 'nodeid',
        subscribers: 123,
      };
      const node2 = {
        messageId: 789,
        nodeId: 'nodeid2',
        subscribers: 42,
      };

      state.addRealtimeRoom('roomid', 'index', 'collection', filters, node);

      should(kuzzle.koncorde.store)
        .calledWithMatch(new NormalizedFilter(filters, 'roomid', 'index/collection'));
      kuzzle.koncorde.store.resetHistory();

      state.addRealtimeRoom('roomid2', 'index', 'collection', filters, node);

      should(kuzzle.koncorde.store)
        .calledWithMatch(new NormalizedFilter(filters, 'roomid2', 'index/collection'));

      kuzzle.koncorde.store.resetHistory();
      kuzzle.koncorde.hasFilterId
        .withArgs('roomid2', 'index/collection')
        .returns(true);

      state.addRealtimeRoom('roomid2', 'index', 'collection', filters, node2);

      should(kuzzle.koncorde.store).not.called();

      state.addRealtimeRoom('roomid3', 'index', 'collection', filters, node);

      should(kuzzle.koncorde.store)
        .calledWithMatch(new NormalizedFilter(filters, 'roomid3', 'index/collection'));

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify(filters),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: 456, subscribers: 123 },
          ],
          roomId: 'roomid',
        },
        {
          collection: 'collection',
          filters: JSON.stringify(filters),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: 456, subscribers: 123 },
            { nodeId: 'nodeid2', messageId: 789, subscribers: 42 },
          ],
          roomId: 'roomid2',
        },
        {
          collection: 'collection',
          filters: JSON.stringify(filters),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: 456, subscribers: 123 },
          ],
          roomId: 'roomid3',
        },
      ]);
    });

    it('should throw if adding a new node when it already exists', () => {
      const filters = { oh: { hai: { can: { I: 'haz cheezburgers?' } } } };
      const node = {
        messageId: 456,
        nodeId: 'nodeid',
        subscribers: 123,
      };

      state.addRealtimeRoom('roomid', 'index', 'collection', filters, node);

      should(() => state.addRealtimeRoom('roomid', 'index', 'collection', filters, node))
        .throw({
          id: 'cluster.fatal.desync',
          message: /duplicate node/,
        });
    });

    it('should remove the entire room when the last node using it removes it', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 456,
        nodeId: 'nodeid',
        subscribers: 123,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 456,
        nodeId: 'nodeid2',
        subscribers: 123,
      });


      state.removeRealtimeRoom('roomid', 'nodeid');
      state.removeRealtimeRoom('roomid', 'nodeid2');

      should(state.serialize().rooms).be.an.Array().and.be.empty();
      should(kuzzle.koncorde.remove).calledWith('roomid');
    });

    it('should ignore a non-existing room when attempting to remove it', () => {
      should(() => state.removeRealtimeRoom('foobar', 'nodeid')).not.throw();
    });

    it('should be able to remove only a room pertaining to a specific node', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 45,
        nodeId: 'nodeid2',
        subscribers: 56,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 67,
        nodeId: 'nodeid3',
        subscribers: 78,
      });

      state.removeRealtimeRoom('roomid', 'nodeid2');

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify({}),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: 12, subscribers: 23 },
            { nodeId: 'nodeid3', messageId: 67, subscribers: 78 },
          ],
          roomId: 'roomid',
        },
      ]);
    });

    it('should be able to return normalized filters on demand', () => {
      const filters = { foo: 'bar' };

      state.addRealtimeRoom('roomid', 'index', 'collection', filters, {
        messageId: 12,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      should(state.getNormalizedFilters('roomid'))
        .match(new NormalizedFilter(filters, 'roomid', 'index/collection'));

      should(state.getNormalizedFilters('ohnoes')).be.null();
    });

    it('should be able to return the global subscription count on a given room', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid2',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid2', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid2',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid3',
        subscribers: 23,
      });

      should(state.countRealtimeSubscriptions('roomid')).be.eql(3 * 23);
      should(state.countRealtimeSubscriptions('roomid2')).be.eql(23);
      should(state.countRealtimeSubscriptions('ohnoes')).be.eql(0);
    });

    it('should be able to return an ordered list of rooms', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid2',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid2', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid2',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid3',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid3', 'index2', 'collection', {}, {
        messageId: 12,
        nodeId: 'nodeid3',
        subscribers: 23,
      });

      should(state.listRealtimeRooms()).match({
        index: {
          collection: {
            roomid: 3 * 23,
            roomid2: 23,
          },
        },
        index2: {
          collection: {
            roomid3: 23,
          },
        },
      });
    });

    it('should be able to add a new subscription on an existing room', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      const newMessageId = Long.fromInt(14, true);
      state.addRealtimeSubscription('roomid', 'nodeid', newMessageId);

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify({}),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: newMessageId, subscribers: 24 },
          ],
          roomId: 'roomid',
        },
      ]);
    });

    it('should throw when attempting to add a new subscription to a non-existing room', () => {
      should(() => state.addRealtimeSubscription('roomid', 'nodeid', Long.fromInt(1)))
        .throw(InternalError, {
          id: 'cluster.fatal.desync',
          message: /room doesn't exist/,
        });
    });

    it('should throw when attempting to add a new subscription to a non-existing node', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      should(() => state.addRealtimeSubscription('roomid', 'ohnoes', Long.fromInt(1)))
        .throw(InternalError, {
          id: 'cluster.fatal.desync',
          message: /unknown node ohnoes/,
        });
    });

    it('should ignore new subscriptions coming from older messages', () => {
      const messageId = Long.fromInt(12, true);

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeSubscription('roomid', 'nodeid', Long.fromInt(11, true));

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify({}),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId, subscribers: 23 },
          ],
          roomId: 'roomid',
        },
      ]);
    });

    it('should be able to remove a subscription from an existing room', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid2',
        subscribers: 42,
      });

      const newMessageId = Long.fromInt(14, true);
      state.removeRealtimeSubscription('roomid', 'nodeid', newMessageId);

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify({}),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: newMessageId, subscribers: 22 },
            { nodeId: 'nodeid2', messageId: Long.fromInt(12, true), subscribers: 42 },
          ],
          roomId: 'roomid',
        }
      ]);
    });

    it('should throw if attempting to unsubscribe from an unknown room', () => {
      const newMessageId = Long.fromInt(14, true);


      should(() => state.removeRealtimeSubscription('roomid', 'nodeid', newMessageId))
        .throw(InternalError, {
          id: 'cluster.fatal.desync',
          message: /room doesn't exist/,
        });
    });

    it('should throw if the number of subscribers becomes negative', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 1,
      });

      let newMessageId = Long.fromInt(14, true);
      state.removeRealtimeSubscription('roomid', 'nodeid', newMessageId);

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify({}),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId: newMessageId, subscribers: 0 },
          ],
          roomId: 'roomid',
        }
      ]);

      newMessageId = newMessageId.add(1);

      should(() => state.removeRealtimeSubscription('roomid', 'nodeid', newMessageId))
        .throw(InternalError, {
          id: 'cluster.fatal.desync',
          message: /negative subscribers count/,
        });
    });

    it('should throw if the unsubscribing node is unknown for that room', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 1,
      });

      const newMessageId = Long.fromInt(14, true);

      should(() => state.removeRealtimeSubscription('roomid', 'ohnoes', newMessageId))
        .throw(InternalError, {
          id: 'cluster.fatal.desync',
          message: /unknown node ohnoes/,
        });
    });

    it('should ignore unsubscriptions coming from older messages', () => {
      const messageId = Long.fromInt(12, true);

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.removeRealtimeSubscription('roomid', 'nodeid', Long.fromInt(11, true));

      should(state.serialize().rooms).match([
        {
          collection: 'collection',
          filters: JSON.stringify({}),
          index: 'index',
          nodes: [
            { nodeId: 'nodeid', messageId, subscribers: 23 },
          ],
          roomId: 'roomid',
        },
      ]);
    });

    it('should be able to remove an entire node from the realtime fullstate', () => {
      const messageId = Long.fromInt(12, true);

      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid2', 'index', 'collection', {}, {
        messageId,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid3', 'index2', 'collection', {}, {
        messageId,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid4', 'index2', 'collection2', {}, {
        messageId,
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.removeNode('nodeid');

      should(state.serialize().rooms).be.Array().and.be.empty();
    });
  });

  describe('#auth strategies', () => {
    it('should be able to add authentication strategies to the fullstate', () => {
      const strategy = {
        strategyName: 'foo',
        foo: 'bar',
      };

      state.addAuthStrategy(strategy);

      should(state.serialize().authStrategies).match([strategy]);
    });

    it('should be able to remove an authentication strategies from the fullstate', () => {
      const strategy = {
        strategyName: 'foo',
        foo: 'bar',
      };

      state.addAuthStrategy(strategy);
      state.addAuthStrategy({ strategyName: 'bar', foo: 'bar' });

      state.removeAuthStrategy('bar');
      should(state.serialize().authStrategies).match([strategy]);

      state.removeAuthStrategy('foo');

      should(state.serialize().authStrategies).be.Array().and.be.empty();
    });
  });

  describe('#loading from a fullstate', () => {
    it('should be able to load a fullstate from a serialized fullstate', () => {
      state.addRealtimeRoom('roomid', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid2', 'index', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid3', 'index2', 'collection', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addRealtimeRoom('roomid4', 'index2', 'collection2', {}, {
        messageId: Long.fromInt(12, true),
        nodeId: 'nodeid',
        subscribers: 23,
      });

      state.addAuthStrategy({ strategyName: 'foo', foo: 'bar' });
      state.addAuthStrategy({ strategyName: 'bar', foo: 'bar' });

      const newState = new State();
      newState.loadFullState(state.serialize());

      should(newState.serialize()).match(state.serialize());
    });
  });
});
