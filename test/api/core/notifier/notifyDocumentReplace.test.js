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
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

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

var mockupTestFilters = function (responseObject) {
  if (responseObject.data.body._id === 'errorme') {
    return q.reject(new Error('rejected'));
  } else if (responseObject.data.body._id === 'removeme') {
    return q([]);
  }
  return q(['foobar']);
};

describe('Test: notifier.notifyDocumentReplace', function () {
  var
    kuzzle,
    requestObject = new RequestObject({
      controller: 'write',
      action: 'replace',
      requestId: 'foo',
      collection: 'bar',
      body: { foo: 'bar' }
    }),
    responseObject = new ResponseObject(requestObject, { _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space' }),
    notified = 0,
    savedResponse;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.notificationCache = mockupCacheService;
        kuzzle.dsl.testFilters = mockupTestFilters;
        kuzzle.notifier.notify = function (rooms, response) {
          if (rooms.length > 0) {
            notified++;
          }

          if (rooms.length !== 0) {
            savedResponse = response;
          }
        };
        done();
      });
  });

  it('should return a promise', function () {
    var result = (Notifier.__get__('notifyDocumentReplace')).call(kuzzle, responseObject);

    should(result).be.a.Promise();
    return should(result).be.fulfilled();
  });

  it('should return a rejected promise if the document is not well-formed', function () {
    responseObject.data.body._id = 'errorme';

    return should((Notifier.__get__('notifyDocumentReplace')).call(kuzzle, responseObject)).be.rejected();
  });

  it('should notify subscribers when a replaced document entered their scope', function (done) {
    responseObject.data.body._id = 'addme';

    notified = 0;
    mockupCacheService.init();

    (Notifier.__get__('notifyDocumentReplace')).call(kuzzle, responseObject)
      .then(function () {
        should(notified).be.exactly(1);
        should(mockupCacheService.addId).be.exactly(responseObject.data.body._id);
        should(mockupCacheService.room).be.an.Array();
        should(mockupCacheService.room[0]).be.exactly('foobar');
        should(mockupCacheService.removeId).be.undefined();

        should(savedResponse.scope).be.exactly('in');
        should(savedResponse.action).be.exactly('replace');

        done();
      })
      .catch (function (e) {
        done(e);
      });
  });

  it('should notify subscribers when an updated document left their scope', function (done) {
    responseObject.data.body._id = 'removeme';

    notified = 0;
    mockupCacheService.init();

    (Notifier.__get__('notifyDocumentReplace')).call(kuzzle, responseObject)
      .then(function () {
        should(notified).be.exactly(1);
        should(mockupCacheService.addId).be.undefined();
        should(mockupCacheService.room).be.undefined();
        should(mockupCacheService.removeId).be.exactly(responseObject.data.body._id);

        should(savedResponse.scope).be.exactly('out');
        should(savedResponse.action).be.exactly('replace');

        done();
      })
      .catch (function (e) {
        done(e);
      });
  });
});
