/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents update notifications.
 */
var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: notifier.notifyDocumentUpdate', () => {
  var
    mockupCacheService = {
      addId: undefined,
      removeId: undefined,
      room: undefined,

      init: function () {
        this.addId = this.removeId = this.room = undefined;
      },

      add: function (id, room) {
        if (room.length > 0) {
          this.addId = id;
          this.room = room;
        }
        return Promise.resolve({});
      },

      remove: function (id, room) {
        if (room.length > 0) {
          this.removeId = id;
        }
        return Promise.resolve({});
      },

      search: function (id) {
        if (id === 'notification/removeme') {
          return Promise.resolve(['foobar']);
        }

        return Promise.resolve([]);
      }
    },
    kuzzle,
    requestObject,
    notified = 0,
    notification;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        requestObject = new RequestObject({
          controller: 'write',
          action: 'update',
          requestId: 'foo',
          collection: 'bar',
          _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
          body: { foo: 'bar' }
        });

        kuzzle.services.list.internalCache = mockupCacheService;
        kuzzle.notifier.notify = function (rooms, r, n) {
          if (rooms.length > 0) {
            notified++;
            notification = n;
          }
        };

        notified = 0;
        notification = null;
        mockupCacheService.init();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should notify subscribers when an updated document entered their scope', () => {
    requestObject.data._id = 'addme';

    sandbox.stub(kuzzle.dsl, 'test').resolves(['foobar']);
    sandbox.stub(kuzzle.services.list.storageEngine, 'get').resolves({_id: 'addme', _source: requestObject.data.body});

    return kuzzle.notifier.notifyDocumentUpdate(requestObject)
      .then(() => {
        should(notified).be.exactly(1);
        should(mockupCacheService.addId).be.exactly('notification/' + requestObject.data._id);
        should(mockupCacheService.room).be.an.Array();
        should(mockupCacheService.room[0]).be.exactly('foobar');
        should(mockupCacheService.removeId).be.undefined();

        should(notification.scope).be.exactly('in');
        should(notification.action).be.exactly('update');
        should(notification.state).be.eql('done');
        should(notification._id).be.eql(requestObject.data._id);
        should(notification._source).be.eql(requestObject.data.body);
      });
  });

  it('should notify subscribers when an updated document left their scope', () => {
    requestObject.data._id = 'removeme';

    sandbox.stub(kuzzle.dsl, 'test').resolves([]);
    sandbox.stub(kuzzle.services.list.storageEngine, 'get').resolves({_id: 'removeme', _source: requestObject.data.body});

    return kuzzle.notifier.notifyDocumentUpdate(requestObject)
      .then(() => {
        should(notified).be.exactly(1);
        should(mockupCacheService.addId).be.undefined();
        should(mockupCacheService.room).be.undefined();
        should(mockupCacheService.removeId).be.exactly('notification/' + requestObject.data._id);

        should(notification.scope).be.exactly('out');
        should(notification.action).be.exactly('update');
        should(notification.state).be.eql('done');
        should(notification._id).be.eql(requestObject.data._id);
        should(notification._source).be.undefined();
      });
  });
});
