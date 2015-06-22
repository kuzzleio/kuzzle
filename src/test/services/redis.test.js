var
  should = require('should'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

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
    cache.remove("foo");
    cache.remove("newobject");
    cache.remove("doesnotexist");
    cache.add("foo", ["bar", "baz", "foobar"]);
  });

  describe('Adding links', function () {
    it('should add a new Object<=>Room link', function () {
      return should(cache.add("newobject", "foo")).be.fulfilledWith(1);
    });

    it('should link an object to multiple rooms at once', function () {
      return should(cache.add("newobject", ["baz", "bar", "foobar"])).be.fulfilledWith(3);
    });

    it('should do nothing if adding an object to no room', function () {
      return should(cache.add("doesnotexist", null)).be.fulfilledWith(0);
    });

    it('should be able to add a new link to an already linked object', function () {
      return should(cache.add("foo", ["new", "room", "bar"])).be.fulfilledWith(2);
    });
  });

  describe('Removing links', function () {
    it('should remove 1 link to a given object', function () {
      return should(cache.remove("foo", "bar")).be.fulfilledWith(1);
    });

    it('should remove multiple links to a given object', function () {
      return should(cache.remove("foo", ["bar", "baz"])).be.fulfilledWith(2);
    });

    it('should remove the entire object if no room argument is given', function () {
      return should(cache.remove("foo")).be.fulfilledWith(1);
    });

    it('should do nothing if trying to remove a non-existant link', function () {
      return should(cache.remove("doesnotexist")).be.fulfilledWith(0);
    });
  });

  describe('Retrieving links', function () {
    it('should return an empty array if looking for a non-existant object', function () {
      return should(cache.search("doesnotexist")).eventually.be.an.Array.and.be.empty;
    });

    it('should return the complete list of rooms linked to an link', function () {
      return should(cache.search("foo")).eventually.be.an.Array.and.have.length(3);
    });
  });
});
