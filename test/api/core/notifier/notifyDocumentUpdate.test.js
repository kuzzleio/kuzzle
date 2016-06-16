/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents update notifications.
 */
var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

var mockupCacheService = {
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
    return q({});
  },

  remove: function (id, room) {
    if (room.length > 0) {
      this.removeId = id;
    }
    return q({});
  },

  search: function (id) {
    if (id === 'removeme') {
      return q(['foobar']);
    }

    return q([]);
  }
};

var mockupTestFilters = (index, collection, data, id) => {
  if (id === 'errorme') {
    return q.reject(new Error('rejected'));
  }
  else if (id === 'removeme') {
    return q([]);
  }
  
  return q(['foobar']);
};

describe('Test: notifier.notifyDocumentUpdate', function () {
  var
    kuzzle,
    requestObject,
    notified = 0,
    notification;

  before(() => {
    kuzzle = new Kuzzle();
    
    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.notificationCache = mockupCacheService;
        kuzzle.services.list.readEngine = {
          get: r => q({_id: r.data._id, _source: requestObject.data.body})
        };
        kuzzle.dsl.test = mockupTestFilters;
        kuzzle.notifier.notify = function (rooms, r, n) {
          if (rooms.length > 0) {
            notified++;
            notification = n;
          }
        };
      });
  });
  
  beforeEach(() => {
    requestObject = new RequestObject({
      controller: 'write',
      action: 'update',
      requestId: 'foo',
      collection: 'bar',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: { foo: 'bar' }
    });
    
    notified = 0;
    notification = null;
    mockupCacheService.init();
  });

  it('should notify subscribers when an updated document entered their scope', (done) => {
    this.timeout(50);
    
    requestObject.data._id = 'addme';

    kuzzle.notifier.notifyDocumentUpdate(requestObject);

    setTimeout(() => {
      should(notified).be.exactly(1);
      should(mockupCacheService.addId).be.exactly(requestObject.data._id);
      should(mockupCacheService.room).be.an.Array();
      should(mockupCacheService.room[0]).be.exactly('foobar');
      should(mockupCacheService.removeId).be.eql(undefined);

      should(notification.scope).be.exactly('in');
      should(notification.action).be.exactly('update');
      should(notification.state).be.eql('done');
      should(notification._id).be.eql(requestObject.data._id);
      should(notification._source).be.eql(requestObject.data.body);

      done();
    }, 20);
  });

  it('should notify subscribers when an updated document left their scope', function (done) {
    this.timeout(50);

    requestObject.data._id = 'removeme';

    kuzzle.notifier.notifyDocumentUpdate(requestObject);

    setTimeout(() => {
      should(notified).be.exactly(1);
      should(mockupCacheService.addId).be.eql(undefined);
      should(mockupCacheService.room).be.eql(undefined);
      should(mockupCacheService.removeId).be.exactly(requestObject.data._id);

      should(notification.scope).be.exactly('out');
      should(notification.action).be.exactly('update');
      should(notification.state).be.eql('done');
      should(notification._id).be.eql(requestObject.data._id);
      should(notification._source).be.eql(undefined);

      done();
    }, 20);
  });
});
