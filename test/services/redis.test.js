var
  should = require('should'),
  winston = require('winston'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('should-promised');

describe('Test redis service', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  afterEach(function (done) {
    kuzzle.services.list.notificationCache.remove('foo')
      .then(function () {
        done();
      });
  });


  it('should init a redis client', function () {
    var
      redis,
      redis2;

    redis = kuzzle.services.list.notificationCache.init();
    should(redis).have.property('client');
    should(redis.client).be.an.Object();

    // test if service init a second time
    redis2 = kuzzle.services.list.notificationCache.init();
    should(redis2).have.property('client');
    should(redis2.client).be.an.Object();
  });

  it('should resolve 0 when add a key without value', function () {
    return should(kuzzle.services.list.notificationCache.add('foo')).fulfilledWith(0);
  });

  it('should resolve 0 when add a key with an empty array', function () {
    return should(kuzzle.services.list.notificationCache.add('foo', [])).fulfilledWith(0);
  });

  it('should resolve 1 when add a key with one value', function () {
    return should(kuzzle.services.list.notificationCache.add('foo', 'bar')).fulfilledWith(1);
  });

  it('should resolve 2 when add a key with an array with 2 values', function () {
    return should(kuzzle.services.list.notificationCache.add('foo', ['bar', 'baz'])).fulfilledWith(2);
  });

  it('should remove a specific value for a key', function () {
    return kuzzle.services.list.notificationCache.add('foo', ['bar', 'baz'])
      .then(function () {
        return kuzzle.services.list.notificationCache.remove('foo', 'bar');
      })
      .then(function (nbRemoved) {
        should(nbRemoved).be.exactly(1);
        return should(kuzzle.services.list.notificationCache.search('foo')).fulfilledWith(['baz']);
      });
  });

  it('should remove several values for a key', function () {
    return kuzzle.services.list.notificationCache.add('foo', ['bar', 'baz', 'qux'])
      .then(function () {
        return kuzzle.services.list.notificationCache.remove('foo', ['bar', 'baz']);
      })
      .then(function (nbRemoved) {
        should(nbRemoved).be.exactly(2);
        return should(kuzzle.services.list.notificationCache.search('foo')).fulfilledWith(['qux']);
      });
  });

  it('should remove the key', function () {
    return kuzzle.services.list.notificationCache.add('foo', ['bar', 'baz', 'qux'])
      .then(function () {
        return kuzzle.services.list.notificationCache.remove('foo');
      })
      .then(function (nbRemoved) {
        should(nbRemoved).be.exactly(1);
        return should(kuzzle.services.list.notificationCache.search('foo')).fulfilledWith([]);
      });
  });

  it('should search values for a specific key', function () {
    return kuzzle.services.list.notificationCache.add('foo', 'bar')
      .then(function () {
        return should(kuzzle.services.list.notificationCache.search('foo')).fulfilledWith(['bar']);
      });
  });
});
