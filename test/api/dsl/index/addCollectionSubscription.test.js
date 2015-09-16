var
  should = require('should'),
  Dsl = require('root-require')('lib/api/dsl/index');

require('should-promised');

describe('Test: dsl.addCollectionSubscription', function () {
  var dsl;

  beforeEach(function () {
    dsl = new Dsl();
  });

  it('should return a resolved promise when adding a new collection', function () {
    return should(dsl.addCollectionSubscription('foo', 'bar')).be.fulfilled();
  });

  it('should initialize the filtersTree object correctly when adding a new collection', function () {
    return dsl.addCollectionSubscription('foo', 'bar')
      .then(function () {
        should(dsl.filtersTree.bar).be.an.Object();
        should(dsl.filtersTree.bar.rooms).be.an.Array();
        should(dsl.filtersTree.bar.rooms.length).be.exactly(1);
        should(dsl.filtersTree.bar.rooms[0]).be.exactly('foo');
      });
  });

  it('should not add the same room multiple times in the same collection', function () {
    return dsl.addCollectionSubscription('foo', 'bar')
      .then(function () {
        return dsl.addCollectionSubscription('foo', 'bar');
      })
      .then(function () {
        should(dsl.filtersTree.bar).be.an.Object();
        should(dsl.filtersTree.bar.rooms).be.an.Array();
        should(dsl.filtersTree.bar.rooms.length).be.exactly(1);
        should(dsl.filtersTree.bar.rooms[0]).be.exactly('foo');
      });
  });
});
