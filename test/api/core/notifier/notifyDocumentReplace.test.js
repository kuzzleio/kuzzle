/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents replace notifications.
 */
var
  should = require('should'),
  Promise = require('bluebird'),
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
    return Promise.resolve({});
  },

  remove: function (id, room) {
    if (room.length > 0) {
      this.removeId = id;
    }
    return Promise.resolve({});
  },

  search: function (id) {
    if (['removeme', 'addme'].indexOf(id) !== -1) {
      return Promise.resolve(['foobar']);
    }
    else if (id === 'errorme') {
      return Promise.reject(new Error('rejected'));
    }

    return Promise.resolve([]);
  }
};

describe('Test: notifier.notifyDocumentReplace', function () {
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
        kuzzle.notifier.notify = (rooms, r, n) => {
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
      action: 'replace',
      requestId: 'foo',
      collection: 'bar',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: { foo: 'bar' }
    });

    mockupCacheService.init();
    notified = 0;
    notification = 0;
  });

  it('should notify subscribers when a replaced document entered their scope', function (done) {
    this.timeout(50);

    requestObject.requestId = 'addme';

    kuzzle.notifier.notifyDocumentReplace(requestObject);

    setTimeout(() => {
      should(notified).be.exactly(1);
      should(mockupCacheService.addId).be.exactly(requestObject.data._id);
      should(mockupCacheService.room).be.an.Array();
      should(mockupCacheService.room[0]).be.exactly('foobar');
      should(mockupCacheService.removeId).be.undefined();

      should(notification.scope).be.exactly('in');
      should(notification.action).be.exactly('update');
      should(notification.state).be.eql('done');
      should(notification._id).be.eql(requestObject.data._id);
      should(notification._source).be.eql(requestObject.data.body);

      done();
    }, 20);
  });

  it('should notify subscribers when an updated document left their scope', (done) => {
    this.timeout(50);

    requestObject.data._id = 'removeme';
    kuzzle.notifier.notifyDocumentReplace(requestObject);

    setTimeout(() => {
      should(notified).be.exactly(1);
      should(mockupCacheService.addId).be.undefined();
      should(mockupCacheService.room).be.undefined();
      should(mockupCacheService.removeId).be.exactly(requestObject.data._id);

      should(notification.scope).be.exactly('out');
      should(notification.action).be.exactly('update');
      should(notification.state).be.eql('done');
      should(notification._id).be.eql(requestObject.data._id);
      should(notification._source).be.undefined();

      done();
    }, 20);
  });
});
