/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the documents deletion notifications.
 */
var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: notifier.notifyDocumentDelete', () => {
  var
    kuzzle,
    requestObject,
    notification,
    mockupCacheService = {
      id: undefined,

      remove: function (id) {
        this.id = id;
        return Promise.resolve({});
      },

      search: function (id) {
        if (id === 'errorme') {
          return Promise.reject(new Error());
        }

        return Promise.resolve(['']);
      }
    };

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.services.list.internalCache = mockupCacheService;
        kuzzle.notifier.notify = (rooms, r,n) => {
          should(r).be.exactly(requestObject);
          notification.push(n);
        };
        notification = [];
        requestObject = new RequestObject({
          controller: 'write',
          action: 'delete',
          requestId: 'foo',
          collection: 'bar',
          body: { foo: 'bar' }
        });
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing if no id is provided', () => {
    return kuzzle.notifier.notifyDocumentDelete(requestObject, [])
      .then(() => {
        should(notification.length).be.eql(0);
      });
  });

  it('should notify when a document has been deleted', () => {

    return kuzzle.notifier.notifyDocumentDelete(requestObject, ['foobar'])
      .then(() => {
        should(mockupCacheService.id).be.exactly('notif/foobar');

        should(notification.length).be.eql(1);
        should(notification[0].scope).be.exactly('out');
        should(notification[0].action).be.exactly('delete');
        should(notification[0]._id).be.exactly('foobar');
        should(notification[0].state).be.exactly('done');
      });
  });


  it('should notify for each document when multiple document have been deleted', () => {
    var ids = ['foo', 'bar'];

    return kuzzle.notifier.notifyDocumentDelete(requestObject, ids)
      .then(() => {
        should(notification.length).be.eql(ids.length);
        should(notification.map(n => n._id)).match(ids);
      });
  });
});
