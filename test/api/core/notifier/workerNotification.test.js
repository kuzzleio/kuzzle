/**
 * The notifier core component can be directly invoked using the notify() function, but it also listens
 * to messages coming from workers.
 * And in particular, messages from the write worker(s), that need to be forwarded to the right listeners.
 *
 * This file tests the function called each time a response has been received from a worker. This listening
 * function then dispatches the response to the right notifyDocument* function
 */
var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  Notifier = rewire('../../../../lib/api/core/notifier'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('should-promised');

describe('Test: notifier.workerNotification', function () {
  var
    requestObject = new RequestObject({
      controller: 'write',
      action: '',
      requestId: 'foo',
      collection: 'bar',
      body: { foo: 'bar' }
    }),
    responseObject = new ResponseObject(requestObject, {});

  it('should call notifyDocumentCreate on a "create" event', function () {
    var
      created = false,
      anyOtherAction = false;

    responseObject.action = 'create';

    Notifier.__with__({
      notifyDocumentCreate: function () { created = true; return Promise.resolve({}); },
      notifyDocumentUpdate: function () { anyOtherAction = true; return Promise.resolve({}); },
      notifyDocumentDelete: function () { anyOtherAction = true; return Promise.resolve({}); }
    })(function () {
      (Notifier.__get__('workerNotification'))(responseObject);
      should(created).be.true();
      should(anyOtherAction).be.false();
    });
  });

  it('should call notifyDocumentUpdate on a "update" event', function () {
    var
      updated = false,
      anyOtherAction = false;

    responseObject.action = 'update';

    Notifier.__with__({
      notifyDocumentCreate: function () { anyOtherAction = true; return Promise.resolve({}); },
      notifyDocumentUpdate: function () { updated = true; return Promise.resolve({}); },
      notifyDocumentDelete: function () { anyOtherAction = true; return Promise.resolve({}); }
    })(function () {
      (Notifier.__get__('workerNotification'))(responseObject);
      should(updated).be.true();
      should(anyOtherAction).be.false();
    });
  });

  it('should call notifyDocumentDelete on a "delete" event', function () {
    var
      deleted = false,
      anyOtherAction = false;

    responseObject.action = 'delete';

    Notifier.__with__({
      notifyDocumentCreate: function () { anyOtherAction = true; return Promise.resolve({}); },
      notifyDocumentUpdate: function () { anyOtherAction = true; return Promise.resolve({}); },
      notifyDocumentDelete: function () { deleted = true; return Promise.resolve({}); }
    })(function () {
      (Notifier.__get__('workerNotification'))(responseObject);
      should(deleted).be.true();
      should(anyOtherAction).be.false();
    });
  });

  it('should call notifyDocumentDelete on a "deleteByQuery" event', function () {
    var
      deleted = false,
      anyOtherAction = false;

    responseObject.action = 'deleteByQuery';

    Notifier.__with__({
      notifyDocumentCreate: function () { anyOtherAction = true; return Promise.resolve({}); },
      notifyDocumentUpdate: function () { anyOtherAction = true; return Promise.resolve({}); },
      notifyDocumentDelete: function () { deleted = true; return Promise.resolve({}); }
    })(function () {
      (Notifier.__get__('workerNotification'))(responseObject);
      should(deleted).be.true();
      should(anyOtherAction).be.false();
    });
  });

  it('should do nothing on an unknown event', function () {
    var
      tookAction = false;

    responseObject.action = 'foo';

    Notifier.__with__({
      notifyDocumentCreate: function () { tookAction = true; return Promise.resolve({}); },
      notifyDocumentUpdate: function () { tookAction = true; return Promise.resolve({}); },
      notifyDocumentDelete: function () { tookAction = true; return Promise.resolve({}); }
    })(function () {
      (Notifier.__get__('workerNotification'))(responseObject);
      should(tookAction).be.false();
    });
  });

  it('should log an error when a notification fails', function (done) {
    var kuzzle = new Kuzzle();

    this.timeout(1000);

    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true}).then(function () {
      responseObject.action = 'create';
      responseObject.collection = false;

      kuzzle.once('log:error', function () {
        done();
      });

      Notifier.__with__({
        notifyDocumentCreate: function () { return Promise.reject(new Error('rejected')); }
      })(function () {
        (Notifier.__get__('workerNotification')).call(kuzzle, responseObject);
      });
    });
  });
});
