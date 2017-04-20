'use strict';
//
// const
//   should = require('should'),
//   sinon = require('sinon'),
//   sandbox = sinon.sandbox.create(),
//   Promise = require('bluebird'),
//   Request = require('kuzzle-common-objects').Request,
//   Kuzzle = require('../../../mocks/kuzzle.mock'),
//   Notifier = require.main.require('lib/api/core/notifier');
//
// describe('Test: notifier.notifyDocumentDelete', () => {
//   let
//     mockupCacheService = {
//       id: undefined,
//       addId: undefined,
//
//       init: function () {
//         this.addId = this.removeId = this.room = undefined;
//       },
//
//       remove: function (id) {
//         this.id = id;
//         return Promise.resolve({});
//       },
//
//       search: function (id) {
//         if (id === 'errorme') {
//           return Promise.reject(new Error());
//         }
//
//         return Promise.resolve(['']);
//       }
//     },
//     // mockupCacheService = {
//     //   addId: undefined,
//     //   removeId: undefined,
//     //   room: undefined,
//     //
//     //   init: function () {
//     //     this.addId = this.removeId = this.room = undefined;
//     //   },
//     //
//     //   add: function (id, room) {
//     //     if (room.length > 0) {
//     //       this.addId = id;
//     //       this.room = room;
//     //     }
//     //     return Promise.resolve({});
//     //   },
//     //
//     //   remove: function (id, room) {
//     //     if (room.length > 0) {
//     //       this.removeId = id;
//     //     }
//     //     return Promise.resolve({});
//     //   },
//     //
//     //   search: function (id) {
//     //     if (id === 'notif/removeme') {
//     //       return Promise.resolve(['foobar']);
//     //     }
//     //
//     //     return Promise.resolve([]);
//     //   }
//     // },
//     kuzzle,
//     notifier,
//     request,
//     notified = 0,
//     notification;
//
//   before(() => {
//     kuzzle = new Kuzzle();
//     notifier = new Notifier(kuzzle);
//   });
//
//   beforeEach(() => {
//     kuzzle.internalEngine.get.returns(Promise.resolve({}));
//     return kuzzle.services.init({whitelist: []})
//       .then(() => {
//         request = new Request({
//           controller: 'document',
//           action: 'delete',
//           requestId: 'foo',
//           collection: 'bar',
//           body: { foo: 'bar' }
//         });
//
//         kuzzle.services.list.internalCache = mockupCacheService;
//         notifier.notify = function (rooms, r, n) {
//           if (rooms.length > 0) {
//             notified++;
//             notification = n;
//           }
//         };
//
//         notified = 0;
//         notification = null;
//         mockupCacheService.init();
//       });
//   });
//
//   afterEach(() => {
//     sandbox.restore();
//   });
//
//   it('should do nothing if no id is provided', () => {
//     return notifier.notifyDocumentDelete(request, [])
//       .then(() => {
//         should(notification).be.null();
//       });
//   });
//
//   it('should notify when a document has been deleted', () => {
//     return notifier.notifyDocumentDelete(request, ['foobar'])
//       .then(() => {
//         should(mockupCacheService.id).be.exactly('notif/foobar');
//
//         should(notification.length).be.eql(1);
//         should(notification[0].scope).be.exactly('out');
//         should(notification[0].action).be.exactly('delete');
//         should(notification[0]._id).be.exactly('foobar');
//         should(notification[0].state).be.exactly('done');
//       });
//   });
//
//   it('should notify subscribers when a deleted document left their scope', () => {
//     request.input.resource._id = 'removeme';
//
//     kuzzle.dsl.test.returns(Promise.resolve([]));
//     kuzzle.services.list.storageEngine.get.returns(Promise.resolve({_id: 'removeme', _source: request.input.body}));
//
//     return notifier.notifyDocumentDelete(request, ['foobar'])
//       .then(() => {
//         should(notified).be.exactly(1);
//         should(mockupCacheService.addId).be.undefined();
//         should(mockupCacheService.room).be.undefined();
//         should(mockupCacheService.removeId).be.exactly('notif/' + request.input.resource._id);
//
//         should(notification.scope).be.exactly('out');
//         should(notification.action).be.exactly('delete');
//         should(notification.state).be.eql('done');
//         should(notification._id).be.eql(request.input.resource._id);
//         should(notification._source).be.undefined();
//       });
//   });
// });
//

var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require.main.require('lib/api/core/notifier');


  describe('Test: notifier.notifyDocumentDelete', () => {
  var
    kuzzle,
    request,
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
    },
    notifier;

  before(() => {
    kuzzle = new Kuzzle();
    notifier = new Notifier(kuzzle);
  });

  beforeEach(() => {
    kuzzle.internalEngine.get.returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        kuzzle.services.list.internalCache = mockupCacheService;
        kuzzle.notifier.notify = (rooms, r,n) => {
          should(r).be.exactly(request);
          notification.push(n);
        };
        notification = [];
        request = new Request({
          controller: 'document',
          action: 'delete',
          requestId: 'foo',
          collection: 'bar',
          body: { foo: 'bar' }
        });
      });
    kuzzle.services.list.storageEngine.get.returns(Promise.resolve({_id: 'addme', _source: request.input.body}));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing if no id is provided', () => {
    return notifier.notifyDocumentDelete(request, [])
      .then(() => {
        should(notification.length).be.eql(0);
      });
  });

  it('should notify when a document has been deleted', () => {
    return notifier.notifyDocumentDelete(request, ['foobar'])
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

    return notifier.notifyDocumentDelete(request, ids)
      .then(() => {
        should(notification.length).be.eql(ids.length);
        should(notification.map(n => n._id)).match(ids);
      });
  });
});
