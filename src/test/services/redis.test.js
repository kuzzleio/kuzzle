var
  should = require('should'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test cache capabilities', function () {
  var
    kuzzle,
    cache;
  
  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.start({}, {workers: false, servers: false});
    cache = kuzzle.services.list.cache;
  });

  beforeEach(function () {
    cache.remove('foo');
    cache.remove('newobject');
    cache.remove('doesnotexist');
    cache.add('foo', ['bar', 'baz', 'foobar']);
  });

  describe('Adding values', function () {
    it('should add a new Key<=>Value link', function () {
      return should(cache.add('newobject', 'foo')).be.fulfilledWith(1);
    });

    it('should add multiple values to a key', function () {
      return should(cache.add('newobject', ['baz', 'bar', 'foobar'])).be.fulfilledWith(3);
    });

    it('should do nothing if adding nothing to a key', function () {
      return should(cache.add('doesnotexist', null)).be.fulfilledWith(0);
    });

    it('should be able to add a new value to an already existing key', function () {
      return should(cache.add('foo', ['new', 'room', 'bar'])).be.fulfilledWith(2);
    });
  });

  describe('Removing values', function () {
    it('should remove 1 value from a given key', function () {
      return should(cache.remove('foo', 'bar')).be.fulfilledWith(1);
    });

    it('should remove multiple values from a given key', function () {
      return should(cache.remove('foo', ['bar', 'baz'])).be.fulfilledWith(2);
    });

    it('should remove the entire key if no value argument is given', function () {
      return should(cache.remove('foo')).be.fulfilledWith(1);
    });

    it('should do nothing if trying to remove a non-existant key<=>value pair', function () {
      return should(cache.remove('doesnotexist')).be.fulfilledWith(0);
    });
  });

  describe('Retrieving values', function () {
    it('should return an empty array if looking for a non-existant key', function () {
      return should(cache.search('doesnotexist')).eventually.be.an.Array.and.be.empty;
    });

    it('should return the complete list of values linked to a key', function () {
      return should(cache.search('foo')).eventually.be.an.Array.and.have.length(3);
    });
  });
});
