/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents deletion notifications.
 */
var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

var mockupCacheService = {
  id: undefined,

  remove: function (id) {
    this.id = id;
    return q({});
  },

  search: function (id) {
    if (id === 'errorme') {
      return q.reject(new Error());
    }

    return q(['']);
  }
};

describe('Test: notifier.notifyDocumentDelete', function () {
  var
    kuzzle,
    requestObject,
    notification;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.services.list.notificationCache = mockupCacheService;
        kuzzle.notifier.notify = (rooms, r,n) => {
          should(r).be.exactly(requestObject);
          notification.push(n);
        };
      });
  });

  beforeEach(() => {
    notification = [];
    requestObject = new RequestObject({
      controller: 'write',
      action: 'delete',
      requestId: 'foo',
      collection: 'bar',
      body: { foo: 'bar' }
    });
  });

  it('should do nothing if no id is provided', function (done) {
    this.timeout(50);
    kuzzle.notifier.notifyDocumentDelete(requestObject, []);

    setTimeout(() => {
      should(notification.length).be.eql(0);
      done();
    }, 20);
  });

  it('should notify when a document has been deleted', function (done) {
    this.timeout(50);

    kuzzle.notifier.notifyDocumentDelete(requestObject, ['foobar']);

    setTimeout(() => {
      should(mockupCacheService.id).be.exactly('foobar');

      should(notification.length).be.eql(1);
      should(notification[0].scope).be.exactly('out');
      should(notification[0].action).be.exactly('delete');
      should(notification[0]._id).be.exactly('foobar');
      should(notification[0].state).be.exactly('done');

      done();
    }, 20);
  });


  it('should notify for each document when multiple document have been deleted', function (done) {
    var ids = ['foo', 'bar'];

    this.timeout(50);

    kuzzle.notifier.notifyDocumentDelete(requestObject, ids);

    setTimeout(() => {
      try {
      should(notification.length).be.eql(ids.length);
      should(notification.map(n => n._id)).match(ids);
      done();
    } catch (err) {
      done(err);
    }
    }, 20);
  });
});
