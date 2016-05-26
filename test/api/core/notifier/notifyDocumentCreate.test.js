/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents creation notifications.
 */
var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

var mockupCacheService = {
  id: undefined,
  room: undefined,

  search: function () { return q(['foobar']); },
  remove: function () { return q({}); },
  add: function (id, room) {
    this.id = id;
    this.room = room;
    return q({});
  }
};

describe('Test: notifier.notifyDocumentCreate', function () {
  var
    kuzzle,
    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: 'bar'
    }),
    newDocument = { _id: 'WhoYouGonnaCall?', _source: {foo: 'bar'}},
    notifiedRooms,
    savedResponse,
    notification;

  before(function () {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.notificationCache = mockupCacheService;
        kuzzle.notifier.notify = (rooms, r, n) => {
          notifiedRooms = rooms;
          savedResponse = r;
          notification = n;
        };
      });
  });

  it('should notify registered users when a document has been created with correct attributes', (done) => {
    this.timeout(50);
    kuzzle.notifier.notifyDocumentCreate(requestObject, newDocument);

    setTimeout(() => {
      should(notifiedRooms).be.an.Array();
      should(notifiedRooms.length).be.exactly(1);
      should(notifiedRooms[0]).be.exactly('foobar');
      should(mockupCacheService.id).be.exactly(newDocument._id);
      should(mockupCacheService.room).be.an.Array();
      should(mockupCacheService.room[0]).be.exactly('foobar');

      should(savedResponse).be.exactly(requestObject);
      should(notification).be.an.Object();
      should(notification._id).be.exactly(newDocument._id);
      should(notification._source).match(newDocument._source);
      should(notification.state).be.exactly('done');
      should(notification.scope).be.exactly('in');
      should(notification.action).be.exactly('create');
      done();
    }, 20);
  });
});
