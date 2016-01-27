/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  Notifier = rewire('../../../../lib/api/core/notifier');

describe('Test: notifier.publish', function () {
  var
    kuzzle,
    notifier,
    notified,
    rooms,
    cached,
    expired,
    request;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.services.list.notificationCache = {
          add: function () { cached = true; return q({}); },
          expire: function () { expired = true; }
        };

        done();
      });
  });

  beforeEach(function () {
    request = {
      controller: 'write',
      action: 'publish',
      requestId: 'foo',
      collection: 'bar',
      body: {},
      metadata: {}
    };

    notifier = new Notifier(kuzzle);
    notifier.notify = function () { notified = true; };
    kuzzle.dsl.testFilters = function () { return q(rooms); };
    notified = false;
    cached = false;
    expired = false;
    rooms = ['foo'];
  });

  it('should publish messages', function (done) {
    var
      published;

    request.action = 'foo';
    request.state = 'bar';
    published = notifier.publish(new RequestObject(request));
    should(published).be.a.Promise();

    published
      .then(result => {
        should(result).be.instanceof(ResponseObject);
        should(result.state).be.exactly('bar');
        should(notified).be.true();
        should(cached).be.false();
        should(expired).be.false();

        request.controller = 'qux';
        return published
          .then(result => {
            should(result).be.instanceof(ResponseObject);
            should(result.state).be.exactly('bar');
            should(notified).be.true();
            should(cached).be.false();
            should(expired).be.false();
          });
      })
      .then(() => done())
      .catch(error => done(error));
  });

  it('should publish volatile messages with the right state', function (done) {
    var
      published;

    request.state = 'foobar';
    published = notifier.publish(new RequestObject(request));
    should(published).be.a.Promise();

    published
      .then(result => {
        should(result).be.instanceof(ResponseObject);
        should(result.state).be.exactly('done');
        should(notified).be.true();
        should(cached).be.false();
        should(expired).be.false();
        done();
      })
      .catch(error => done(error));
  });

  it('should cache the document in case of a create document request', function (done) {
    request.action = 'create';

    notifier.publish(new RequestObject(request)).then(result => {
      setTimeout(() => {
        should(result).be.instanceof(ResponseObject);
        should(notified).be.true();
        should(cached).be.true();
        should(expired).be.true();
        done();
      }, 20);
    })
    .catch(error => done(error));
  });

  it('should cache the document in case of a createOrReplace document request', function (done) {
    request.action = 'createOrReplace';

    notifier.publish(new RequestObject(request)).then(result => {
      setTimeout(() => {
        should(result).be.instanceof(ResponseObject);
        should(notified).be.true();
        should(cached).be.true();
        should(expired).be.true();
        done();
      }, 20);
    })
      .catch(error => done(error));
  });

  it('should cache the document in case of a replace document request', function (done) {
    request.action = 'replace';

    notifier.publish(new RequestObject(request)).then(result => {
      setTimeout(() => {
        should(result).be.instanceof(ResponseObject);
        should(notified).be.true();
        should(cached).be.true();
        should(expired).be.true();
        done();
      }, 20);
    })
    .catch(error => done(error));
  });

  it('should do nothing if there is no room to notify', function (done) {
    var
      published;

    rooms = [];
    published = notifier.publish(new RequestObject(request));
    should(published).be.a.Promise();

    published
      .then(result => {
        setTimeout(() => {
          should(result).be.instanceof(ResponseObject);
          should(notified).be.false();
          should(cached).be.false();
          should(expired).be.false();
          done();
        });
      })
      .catch(error => done(error));
  });

  it('should return a rejected promise if testFilters fails', function () {
    kuzzle.dsl.testFilters = function () { return q.reject(new Error('')); };
    return should(notifier.publish(new RequestObject(request))).be.rejected();
  });
});
