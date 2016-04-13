/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject');

describe('Test: notifier.publish', function () {
  var
    kuzzle,
    notification,
    rooms,
    cached,
    expired,
    request;

  before(() => {
    kuzzle = new Kuzzle();
    
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.services.list.notificationCache = {
          add: function () { cached = true; return q({}); },
          expire: function () { expired = true; }
        };
      });
  });

  beforeEach(function () {
    request = {
      controller: 'write',
      action: 'publish',
      requestId: 'foo',
      collection: 'bar',
      _id: 'I am fabulous',
      body: { youAre: 'fabulous too' },
      metadata: {}
    };

    kuzzle.notifier.notify = (r, rq, n) => {
      notification = n;
    };

    kuzzle.dsl.testFilters = () => q(rooms);

    notification = null;
    cached = false;
    expired = false;
    rooms = ['foo'];
  });

  it('should publish messages', () => {
    return kuzzle.notifier.publish(new RequestObject(request))
      .then(result => {
        should(result).match({published: true});
        should(notification.state).be.eql('done');
        should(notification.scope).be.eql('in');
        should(notification._id).be.eql(request._id);
        should(notification._source).be.eql(request.body);
        should(cached).be.false();
        should(expired).be.false();
      });
  });

  it('should cache the document in case of a create document request', (done) => {
    this.timeout(50);
    request.action = 'create';

    kuzzle.notifier.publish(new RequestObject(request));

    setTimeout(() => {
      should(notification.state).be.eql('pending');
      should(notification.scope).be.undefined();
      should(notification._id).be.eql(request._id);
      should(notification._source).be.eql(request.body);
      should(cached).be.true();
      should(expired).be.true();
      done();
    }, 20);
  });

  it('should cache the document in case of a createOrReplace document request', function (done) {
    this.timeout(50);
    request.action = 'createOrReplace';

    kuzzle.notifier.publish(new RequestObject(request));

    setTimeout(() => {
      should(notification.state).be.eql('pending');
      should(notification.scope).be.undefined();
      should(notification._id).be.eql(request._id);
      should(notification._source).be.eql(request.body);
      should(cached).be.true();
      should(expired).be.true();
      done();
    }, 20);
  });

  it('should cache the document in case of a replace document request', function (done) {
    this.timeout(50);
    request.action = 'replace';

    kuzzle.notifier.publish(new RequestObject(request));

    setTimeout(() => {
      should(notification.state).be.eql('pending');
      should(notification.scope).be.undefined();
      should(notification._id).be.eql(request._id);
      should(notification._source).be.eql(request.body);
      should(cached).be.true();
      should(expired).be.true();
      done();
    }, 20);
  });

  it('should do nothing if there is no room to notify', () => {
    rooms = [];

    return kuzzle.notifier.publish(new RequestObject(request))
      .then(result => {
        should(result).match({published: true});
        should(notification).be.null();
        should(cached).be.false();
        should(expired).be.false();
      });
  });

  it('should return a rejected promise if testFilters fails', () => {
    kuzzle.dsl.testFilters = () => q.reject(new Error(''));
    return should(kuzzle.notifier.publish(new RequestObject(request))).be.rejected();
  });
});
