'use strict';

const should = require('should');
const Long = require('long');
const { InternalError } = require('../../lib/kerror/errors');

const Kuzzle = require('../mocks/kuzzle.mock');

const State = require('../../lib/cluster/state');

describe.only('#Cluster Full State', () => {
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

      should(kuzzle.koncorde.store).calledWith({
        collection: 'collection',
        id: 'roomid',
        index: 'index',
        normalized: filters,
      });
      kuzzle.koncorde.store.resetHistory();

      state.addRealtimeRoom('roomid2', 'index', 'collection', filters, node);

      should(kuzzle.koncorde.store).calledWith({
        collection: 'collection',
        id: 'roomid2',
        index: 'index',
        normalized: filters,
      });
      kuzzle.koncorde.store.resetHistory();
      kuzzle.koncorde.hasFilter.withArgs('roomid2').returns(true);

      state.addRealtimeRoom('roomid2', 'index', 'collection', filters, node2);

      should(kuzzle.koncorde.store).not.called();

      state.addRealtimeRoom('roomid3', 'index', 'collection', filters, node);

      should(kuzzle.koncorde.store).calledWith({
        collection: 'collection',
        id: 'roomid3',
        index: 'index',
        normalized: filters,
      });

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

      should(state.getNormalizedFilters('roomid')).match({
        collection: 'collection',
        id: 'roomid',
        index: 'index',
        normalized: filters,
      });

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

      should(state.countRealtimeSubscriptions('roomid')).be.eql(3*23);
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
            roomid: 3*23,
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
        });
    });
  });
});
