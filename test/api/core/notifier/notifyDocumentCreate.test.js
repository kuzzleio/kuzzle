/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents creation notifications.
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

require('should-promised');

var mockupCacheService = {
  id: undefined,
  room: undefined,

  add: function (id, room) {
    this.id = id;
    this.room = room;
    return Promise.resolve({});
  }
};

var mockupTestFilters = function (responseObject) {
  if (responseObject.data.errorme) {
    return Promise.reject(new Error('rejected'));
  }
  else {
    return Promise.resolve(['foobar']);
  }
};

describe('Test: notifier.notifyDocumentCreate', function () {
  var
    kuzzle,
    requestObject = new RequestObject({
      controller: 'write',
      action: 'create',
      requestId: 'foo',
      collection: 'bar',
      body: { term: { foo: 'bar' } }
    }),
    responseObject = new ResponseObject(requestObject, { _id: 'WhoYouGonnaCall?'}),
    notifiedRooms;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.notificationCache = mockupCacheService;
        kuzzle.dsl.testFilters = mockupTestFilters;
        kuzzle.notifier.notify = function (rooms) { notifiedRooms = rooms; };
        done();
      });
  });

  it('should return a promise', function () {
    var result = (Notifier.__get__('notifyDocumentCreate')).call(kuzzle, responseObject);

    should(result).be.a.Promise();
    return should(result).be.fulfilled();
  });

  it('should return a rejected promise if the document is not well-formed', function () {
    var result;

    responseObject.data.errorme = true;

    result = (Notifier.__get__('notifyDocumentCreate')).call(kuzzle, responseObject);

    should(result).be.a.Promise();
    return should(result).be.rejected();
  });

  it('should notify registered users when a document has been created', function (done) {
    delete responseObject.data.errorme;

    (Notifier.__get__('notifyDocumentCreate')).call(kuzzle, responseObject)
      .then(function () {
        should(notifiedRooms).be.an.Array();
        should(notifiedRooms.length).be.exactly(1);
        should(notifiedRooms[0]).be.exactly('foobar');
        should(mockupCacheService.id).be.exactly(responseObject.data._id);
        should(mockupCacheService.room).be.an.Array();
        should(mockupCacheService.room[0]).be.exactly('foobar');
        done();
      })
      .catch (function (e) {
        done(e);
      });
  });
});
