var
  should = require('should'),
  q = require('q'),
  params = require('rc')('kuzzle'),
  Redis = require.main.require('lib/services/redis'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('should-promised');

describe('Test redis service', function () {
  var
    kuzzle,
    dbname = 'unit-tests',
    redis;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.config.cache.databases.push(dbname);
        redis = new Redis(kuzzle, {service: dbname});
        done();
      })
      .catch(error => done(error));
  });

  afterEach(function (done) {
    redis.client.flushdb(() => done());
  });


  it('should init a redis client', function (done) {
    var r;

    r = redis.init();
    should(r).be.a.Promise();

    r.then(instance => {
      var redis2;

      redis = instance;
      should(redis).have.property('client');
      should(redis.client).be.an.Object();

      // test if service init a second time
      redis2 = (new Redis(kuzzle, {service: dbname})).init();

      should(redis2).be.a.Promise();

      redis2.then(instance => {
        should(instance).have.property('client');
        should(instance.client).be.an.Object();
        done();
      });
    });
  });

  it('should stop initialization if an unknown database identifier is provided', function () {
    var testredis = new Redis(kuzzle, {service: 'foobar'});

    return should(testredis.init()).be.rejected();
  });

  it('should raise an error if unable to connect', function (done) {
    var
      testredis,
      savePort = kuzzle.config.cache.port;

    kuzzle.config.cache.port = 1337;
    testredis = new Redis(kuzzle, {service: kuzzle.config.cache.databases[0]});

    testredis.init()
      .then(() => done('should have failed connecting to redis'))
      .catch(() => done())
      .finally(() => kuzzle.config.cache.port = savePort);
  });

  it('should resolve 0 when add a key without value', function () {
    return should(redis.add('foo')).fulfilledWith(0);
  });

  it('should resolve 0 when add a key with an empty array', function () {
    return should(redis.add('foo', [])).fulfilledWith(0);
  });

  it('should resolve 1 when add a key with one value', function () {
    return should(redis.add('foo', 'bar')).fulfilledWith(1);
  });

  it('should resolve 2 when add a key with an array with 2 values', function () {
    return should(redis.add('foo', ['bar', 'baz'])).fulfilledWith(2);
  });

  it('should remove a specific value for a key', function () {
    return redis.add('foo', ['bar', 'baz'])
      .then(function () {
        return redis.remove('foo', 'bar');
      })
      .then(function (nbRemoved) {
        should(nbRemoved).be.exactly(1);
        return should(redis.search('foo')).fulfilledWith(['baz']);
      });
  });

  it('should remove several values for a key', function () {
    return redis.add('foo', ['bar', 'baz', 'qux'])
      .then(function () {
        return redis.remove('foo', ['bar', 'baz']);
      })
      .then(function (nbRemoved) {
        should(nbRemoved).be.exactly(2);
        return should(redis.search('foo')).fulfilledWith(['qux']);
      });
  });

  it('should remove the key', function () {
    return redis.add('foo', ['bar', 'baz', 'qux'])
      .then(function () {
        return redis.remove('foo');
      })
      .then(function (nbRemoved) {
        should(nbRemoved).be.exactly(1);
        return should(redis.search('foo')).fulfilledWith([]);
      });
  });

  it('should search values for a specific key', function () {
    return redis.add('foo', 'bar')
      .then(function () {
        return should(redis.search('foo')).fulfilledWith(['bar']);
      });
  });

  it('should add a volatile key', function (done) {
    redis.volatileSet('foo', 'bar', 10)
      .then(result => {
        should(result).be.exactly('OK');
        redis.client.ttl('foo', (e, r) => {
          should(e).be.null();
          should(r).be.a.Number().and.be.exactly(10);
          done();
        });
      })
      .catch(error => done(error));
  });

  it('should allow getting a single key value', function (done) {
    redis.volatileSet('foo', 'bar', 10)
      .then(() => { return redis.get('foo'); })
      .then(r => {
        should(r).be.exactly('bar');
        done();
      })
      .catch(e => done(e));
  });

  it('should retrieve values from multiple keys', function (done) {
    redis.volatileSet('foo', 'bar', 10)
      .then(() => { return redis.volatileSet('baz', 'qux', 10); })
      .then(() => { return redis.mget(['foo', 'baz']); })
      .then(r => {
        should(r.length).be.exactly(2);
        should(r.sort()).match(['bar', 'qux']);
        done();
      })
      .catch(e => done(e));
  });

  it('should do nothing when attempting to retrieve values from an empty list of keys', function () {
    return should(redis.mget([])).be.fulfilledWith([]);
  });

  it('should allow listing keys using pattern matching', function (done) {
    var keys = ['solvet', 'saeclum', 'in', 'favilla', 'teste', 'david', 'cum', 'sybilla'];

    keys.reduce((previous, current) => { return previous.then(redis.volatileSet(current, 'foobar', 10)); }, q())
      .then(() => { return redis.searchKeys('s*'); })
      .then(result => {
        should(result.length).be.exactly(3);
        should(result.sort()).match(['saeclum', 'solvet', 'sybilla']);
        done();
      })
      .catch(error => done(error));
  });

  it('should retrieve all stored keys of a database', function (done) {
    var keys = 'My name is Ozymandias, king of kings: Look on my works, ye Mighty, and despair!'.split(' ');

    keys.reduce((previous, current) => { return previous.then(redis.volatileSet(current, 'foobar', 10)); }, q())
      .then(() => { return redis.getAllKeys(); })
      .then(result => {
        should(result.length).be.exactly(keys.length);
        should(result.sort()).match(keys.sort());
        done();
      })
      .catch(error => done(error));
  });

  it('i#set should set a single value', done => {
    redis.set('foo', 'bar')
      .then(result => {
        should(result).be.exactly('OK');
        redis.client.get('foo', (e, r) => {
          should(e).be.null();
          should(r).be.exactly('bar');
          done();
        });
      });
  });

  it('#expire should allow to modify an entry ttl', done => {
    redis.volatileSet('foo', 'bar', 100)
      .then(() => {
        return redis.expire('foo', 200);
      })
      .then(result => {
        should(result).be.exactly(1);
        redis.client.ttl('foo', (e, r) => {
          should(e).be.null();
          should(r).be.exactly(200);
          done();
        });
      })
      .catch(error => {
        done(error);
      });
  });

  it('#expireAt should allow to set a ttl based on a timestamp', done => {
    var whenSet;

    redis.volatileSet('foo', 'bar', 100)
      .then(() => {
        return redis.expireAt('foo', Math.round((whenSet = Date.now()) / 1000) + 50);
      })
      .then(result => {
        should(result).be.exactly(1);
        redis.client.ttl('foo', (e, r) => {
          should(e).be.null();
          should(r).be.exactly(50 - Math.round((Date.now() - whenSet)/1000));
          done();
        });
      })
      .catch(error => {
        done(error);
      });
  });

  it('#persist should allow to set an infinite ttl', done => {
    redis.volatileSet('foo', 'bar', 100)
      .then(() => {
        return redis.persist('foo');
      })
      .then(result => {
        should(result).be.exactly(1);
        redis.client.ttl('foo', (e, r) => {
          should(e).be.null();
          should(r).be.exactly(-1);
          done();
        });
      })
      .catch(error => {
        done(error);
      });
  });

  it('#getInfos should return a properly formatted response', () => {
    return should(redis.getInfos()).be.fulfilled();
  });
});
