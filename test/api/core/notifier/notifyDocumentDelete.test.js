/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents deletion notifications.
 */
var
  should = require('should'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Notifier = rewire('../../../../lib/api/core/notifier');

var mockupCacheService = {
  id: undefined,

  remove: function (id) {
    this.id = id;
    return Promise.resolve({});
  },

  search: function (id) {
    if (id === 'errorme') {
      return Promise.reject(new Error());
    }
    else {
      return Promise.resolve(['']);
    }
  }
};

describe('Test: notifier.notifyDocumentDelete', function () {
  var
    kuzzle,
    requestObject = new RequestObject({
      controller: 'write',
      action: 'delete',
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
        kuzzle.notifier.notify = function (rooms, msg) {
          should(msg).match(responseObject.toJson(['body']));
          notified++;
          savedResponse = msg;
        };
        done();
      });
  });

  it('should return a promise', function () {
    var result = (Notifier.__get__('notifyDocumentDelete')).call(kuzzle, responseObject);

    should(result).be.a.Promise();
    return should(result).be.fulfilled();
  });

  it('should do nothing if no id is provided', function (done) {
    delete responseObject.data.body._id;

    notified = 0;

    (Notifier.__get__('notifyDocumentDelete')).call(kuzzle, responseObject)
      .then(function () {
        should(notified).be.exactly(0);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should do nothing if an empty ids array is provided', function (done) {
    responseObject.action = 'deleteByQuery';
    responseObject.data.ids = [];

    notified = 0;

    (Notifier.__get__('notifyDocumentDelete')).call(kuzzle, responseObject)
      .then(function () {
        should(notified).be.exactly(0);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if the document is not well-formed', function () {
    responseObject.action = 'deleteByQuery';
    responseObject.data.body.ids = ['errorme'];

    return should((Notifier.__get__('notifyDocumentDelete')).call(kuzzle, responseObject)).be.rejected();
  });

  it('should notify when a document has been deleted', function (done) {
    responseObject.action = 'delete';
    responseObject.data.body._id = ['foobar'];

    notified = 0;

    (Notifier.__get__('notifyDocumentDelete')).call(kuzzle, responseObject)
      .then (function () {
        should(notified).be.exactly(1);
        should(mockupCacheService.id).be.exactly(responseObject.data.body._id);

        should(savedResponse.scope).be.exactly('out');
        should(savedResponse.action).be.exactly('delete');

        done();
      })
      .catch (function (e) {
        done(e);
      });
  });


  it('should notify for each document when multiple document have been deleted', function (done) {
    responseObject.action = 'deleteByQuery';
    responseObject.data.body.ids = ['foo', 'bar'];

    notified = 0;

    (Notifier.__get__('notifyDocumentDelete')).call(kuzzle, responseObject)
      .then(function () {
        should(notified).be.exactly(responseObject.data.body.ids.length);
        should(mockupCacheService.id).be.exactly(responseObject.data.body._id);
        done();
      })
      .catch (function (e) {
        done(e);
      });
  });
});
