/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents creation notifications.
 */
var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: notifier.notifyDocumentCreate', () => {
  var
    kuzzle,
    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: 'bar'
    }),
    mockupCacheService = {
      id: undefined,
      room: undefined,

      search: () => { return Promise.resolve(['foobar']); },
      remove: () => { return Promise.resolve({}); },
      add: function(id, room) {
        this.id = id;
        this.room = room;
        return Promise.resolve({});
      }
    },
    newDocument = { _id: 'WhoYouGonnaCall?', _source: {foo: 'bar'}},
    notifiedRooms,
    savedResponse,
    notification;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.services.list.internalCache = mockupCacheService;
        kuzzle.notifier.notify = (rooms, r, n) => {
          notifiedRooms = rooms;
          savedResponse = r;
          notification = n;
        };
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should notify registered users when a document has been created with correct attributes', () => {
    return kuzzle.notifier.notifyDocumentCreate(requestObject, newDocument)
      .then(() => {
        should(notifiedRooms).be.an.Array();
        should(notifiedRooms.length).be.exactly(1);
        should(notifiedRooms[0]).be.exactly('foobar');
        should(mockupCacheService.id).be.exactly('notif/' + newDocument._id);
        should(mockupCacheService.room).be.an.Array();
        should(mockupCacheService.room[0]).be.exactly('foobar');

        should(savedResponse).be.exactly(requestObject);
        should(notification).be.an.Object();
        should(notification._id).be.exactly(newDocument._id);
        should(notification._source).match(newDocument._source);
        should(notification.state).be.exactly('done');
        should(notification.scope).be.exactly('in');
        should(notification.action).be.exactly('create');
      });
  });
});
