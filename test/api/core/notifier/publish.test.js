'use strict';

/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  rewire = require('rewire'),
  Kuzzle = require('../../../../lib/api/kuzzle'),
  Redis = rewire('../../../../lib/services/redis'),
  RedisClientMock = require('../../../mocks/services/redisClient.mock'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: notifier.publish', () => {
  var
    dbname = 'unit-tests',
    kuzzle,
    internalCache,
    notification,
    request,
    spyInternalCacheAdd,
    spyInternalCacheExpire,
    rooms = ['foo'];

  before(() => {
    kuzzle = new Kuzzle();
    internalCache = new Redis(kuzzle, {service: dbname}, kuzzle.config.services.internalCache);
    return Redis.__with__('buildClient', () => new RedisClientMock())(() => {
      return internalCache.init();
    });
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => {
        request = {
          controller: 'write',
          action: 'publish',
          requestId: 'foo',
          collection: 'bar',
          _id: 'I am fabulous',
          body: { youAre: 'fabulous too' },
          metadata: {}
        };
        kuzzle.services.list.internalCache = internalCache;
        spyInternalCacheAdd = sandbox.stub(kuzzle.services.list.internalCache, 'add').returns(Promise.resolve({}));
        spyInternalCacheExpire = sandbox.stub(kuzzle.services.list.internalCache, 'expire').returns(Promise.resolve({}));
        sandbox.stub(kuzzle.notifier, 'notify', (r, rq, n) => {notification = n;});

        notification = null;
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should publish messages', (done) => {
    let result;

    sandbox.stub(kuzzle.dsl, 'test').returns(rooms);

    result = kuzzle.notifier.publish(new Request(request));
    should(result).match({published: true});
    should(notification.state).be.eql('done');
    should(notification.scope).be.eql('in');
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);

    setTimeout(() => {
      should(spyInternalCacheAdd.called).be.false();
      should(spyInternalCacheExpire.called).be.false();
      done();
    }, 20);
  });

  it('should cache the document in case of a create document request', (done) => {
    sandbox.stub(kuzzle.dsl, 'test').returns(rooms);

    request.action = 'create';
    kuzzle.notifier.publish(new Request(request));
    should(notification.state).be.eql('pending');
    should(notification.scope).be.undefined();
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);

    setTimeout(() => {
      should(spyInternalCacheAdd.calledOnce).be.true();
      should(spyInternalCacheExpire.calledOnce).be.true();
      done();
    }, 20);
  });

  it('should cache the document in case of a createOrReplace document request', (done) => {
    sandbox.stub(kuzzle.dsl, 'test').returns(rooms);

    request.action = 'createOrReplace';
    kuzzle.notifier.publish(new Request(request));
    should(notification.state).be.eql('pending');
    should(notification.scope).be.undefined();
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);
    setTimeout(() => {
      should(spyInternalCacheAdd.calledOnce).be.true();
      should(spyInternalCacheExpire.calledOnce).be.true();
      done();
    }, 20);
  });

  it('should cache the document in case of a replace document request', (done) => {
    sandbox.stub(kuzzle.dsl, 'test').returns(rooms);

    request.action = 'replace';
    kuzzle.notifier.publish(new Request(request));
    should(notification.state).be.eql('pending');
    should(notification.scope).be.undefined();
    should(notification._id).be.eql(request._id);
    should(notification._source).be.eql(request.body);
    setTimeout(() => {
      should(spyInternalCacheAdd.calledOnce).be.true();
      should(spyInternalCacheExpire.calledOnce).be.true();
      done();
    }, 20);
  });

  it('should do nothing if there is no room to notify', (done) => {
    let result;

    sandbox.stub(kuzzle.dsl, 'test').returns([]);

    result = kuzzle.notifier.publish(new Request(request));
    should(result).match({published: true});
    should(notification).be.null();
    setTimeout(() => {
      should(spyInternalCacheAdd.called).be.false();
      should(spyInternalCacheExpire.called).be.false();
      done();
    }, 20);
  });
});
