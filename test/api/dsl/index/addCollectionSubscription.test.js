var
  should = require('should'),
  Dsl = require.main.require('lib/api/dsl/index');

require('should-promised');

describe('Test: dsl.addCollectionSubscription', function () {
  var dsl,
    index = 'test';

  beforeEach(function () {
    dsl = new Dsl();
  });

  it('should return a resolved promise when adding a new collection', function () {
    return should(dsl.addCollectionSubscription('foo', index, 'bar')).be.fulfilled();
  });

  it('should initialize the filtersTree object correctly when adding a new collection', function () {
    return dsl.addCollectionSubscription('foo', index, 'bar')
      .then(function () {
        should(dsl.filtersTree[index]).be.an.Object();
        should(dsl.filtersTree[index].bar).be.an.Object();
        should(dsl.filtersTree[index].bar.rooms).be.an.Array();
        should(dsl.filtersTree[index].bar.rooms.length).be.exactly(1);
        should(dsl.filtersTree[index].bar.rooms[0]).be.exactly('foo');
      });
  });

  it('should not add the same room multiple times in the same collection', function () {
    return dsl.addCollectionSubscription('foo', index, 'bar')
      .then(function () {
        return dsl.addCollectionSubscription('foo', index, 'bar');
      })
      .then(function () {
        should(dsl.filtersTree[index]).be.an.Object();
        should(dsl.filtersTree[index].bar).be.an.Object();
        should(dsl.filtersTree[index].bar.rooms).be.an.Array();
        should(dsl.filtersTree[index].bar.rooms.length).be.exactly(1);
        should(dsl.filtersTree[index].bar.rooms[0]).be.exactly('foo');
      });
  });
});
