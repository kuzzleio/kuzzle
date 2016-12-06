var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  Kuzzle = require('../../../../lib/api/kuzzle');

describe('Test: notifier.notifyDocumentReplace', () => {
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
        if (['notif/removeme', 'notif/addme'].indexOf(id) !== -1) {
          return Promise.resolve(['foobar']);
        }
        else if (id === 'notif/errorme') {
          return Promise.reject(new Error('rejected'));
        }

        return Promise.resolve([]);
      }
    },
    kuzzle,
    request,
    notified = 0,
    notification;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        request = new Request({
          controller: 'write',
          action: 'replace',
          requestId: 'foo',
          collection: 'bar',
          _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
          body: {foo: 'bar'}
        });
        kuzzle.services.list.internalCache = mockupCacheService;
        kuzzle.notifier.notify = (rooms, r, n) => {
          if (rooms.length > 0) {
            notified++;
            notification = n;
          }
        };
        mockupCacheService.init();
        notified = 0;
        notification = 0;
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should notify subscribers when a replaced document entered their scope', () => {
    request.id = 'addme';

    return kuzzle.notifier.notifyDocumentReplace(request)
      .then(() => {
        should(notified).be.exactly(1);
        should(mockupCacheService.addId).be.exactly('notif/' + request.input.resource._id);
        should(mockupCacheService.room).be.an.Array();
        should(mockupCacheService.room[0]).be.exactly('foobar');
        should(mockupCacheService.removeId).be.undefined();

        should(notification.scope).be.exactly('in');
        should(notification.action).be.exactly('update');
        should(notification.state).be.eql('done');
        should(notification._id).be.eql(request.input.resource._id);
        should(notification._source).be.eql(request.input.body);
      });
  });

  it('should notify subscribers when an updated document left their scope', () => {
    request.input.resource._id = 'removeme';

    return kuzzle.notifier.notifyDocumentReplace(request)
      .then(() => {
        should(notified).be.exactly(1);
        should(mockupCacheService.addId).be.undefined();
        should(mockupCacheService.room).be.undefined();
        should(mockupCacheService.removeId).be.exactly('notif/' + request.input.resource._id);

        should(notification.scope).be.exactly('out');
        should(notification.action).be.exactly('update');
        should(notification.state).be.eql('done');
        should(notification._id).be.eql(request.input.resource._id);
        should(notification._source).be.undefined();
      });
  });
});
