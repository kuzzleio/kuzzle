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
  captainsLog = require('captains-log'),
  rewire = require('rewire'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  ResponseObject = require('root-require')('lib/api/core/models/responseObject'),
  Notifier = rewire('../../../../lib/api/core/notifier');

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

  it('should log an error when one occurs in a notifyDocument* function', function (done) {
    var
      loggedError = false;

    responseObject.action = 'create';
    Notifier.log = { error: function () { loggedError = true; } };

    Notifier.__with__({
      notifyDocumentCreate: function () { return Promise.reject(new Error('')); }
    })(function () {
      (Notifier.__get__('workerNotification')).call(Notifier, responseObject);

      setTimeout(function () {
        should(loggedError).be.true();
        done();
      }, 20);
    });
  });
});
