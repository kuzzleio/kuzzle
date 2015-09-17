var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.removeFilterPath', function () {
  var
    dsl,
    removeFilterPath = Dsl.__get__('removeFilterPath');

  beforeEach(function () {
    dsl = new Dsl();
    dsl.filtersTree = {
      aCollection: {
        rooms: [],
        fields: {
          aField: {
            randomFilter: {
              rooms: [],
              fn: function () { }
            }
          }
        }
      }
    };
  });

  it('should not delete the entire filter if another room use it', function () {
    dsl.filtersTree.aCollection.fields.aField.randomFilter.rooms = [ 'foo', 'bar' ];
    removeFilterPath.call(dsl, {id: 'bar'}, 'aCollection.aField.randomFilter');

    should.exist(dsl.filtersTree.aCollection);
    should.exist(dsl.filtersTree.aCollection.fields);
    should.exist(dsl.filtersTree.aCollection.fields.aField);
    should.exist(dsl.filtersTree.aCollection.fields.aField.randomFilter);
    should(dsl.filtersTree.aCollection.fields.aField.randomFilter.rooms).be.an.Array().and.match(['foo']);
  });

  it('should do nothing if the provided room is not listed in the filter path', function () {
    var rooms = [ 'foo', 'bar' ];

    dsl.filtersTree.aCollection.fields.aField.randomFilter.rooms = rooms;
    removeFilterPath.call(dsl, {id: 'foobar'}, 'aCollection.aField.randomFilter');

    should.exist(dsl.filtersTree.aCollection);
    should.exist(dsl.filtersTree.aCollection.fields);
    should.exist(dsl.filtersTree.aCollection.fields.aField);
    should.exist(dsl.filtersTree.aCollection.fields.aField.randomFilter);
    should(dsl.filtersTree.aCollection.fields.aField.randomFilter.rooms).be.an.Array().and.match(rooms);
  });

  it('should remove the entire filter path if there is no room left', function () {
    dsl.filtersTree.aCollection.fields.aField.randomFilter.rooms = [ 'foo' ];
    removeFilterPath.call(dsl, {id: 'foo'}, 'aCollection.aField.randomFilter');

    should(dsl.filtersTree).be.an.Object().and.be.empty();
  });

  it('should not delete any other filter than the one we provided', function () {
    dsl.filtersTree.aCollection.fields.aField.randomFilter.rooms = [ 'foo' ];
    dsl.filtersTree.aCollection.fields.anotherField = {
      anotherFilter: {
        rooms: [ 'foo' ],
        fn: function () {}
      }
    };

    removeFilterPath.call(dsl, {id: 'foo'}, 'aCollection.aField.randomFilter');

    should.exist(dsl.filtersTree.aCollection);
    should.exist(dsl.filtersTree.aCollection.fields);
    should.not.exist(dsl.filtersTree.aCollection.fields.aField);
    should.exist(dsl.filtersTree.aCollection.fields.anotherField);
    should.exist(dsl.filtersTree.aCollection.fields.anotherField.anotherFilter);
    should.exist(dsl.filtersTree.aCollection.fields.anotherField.anotherFilter.rooms);
    should(dsl.filtersTree.aCollection.fields.anotherField.anotherFilter.rooms).match(['foo']);
  });
});
