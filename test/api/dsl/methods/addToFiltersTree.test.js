var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5');
  methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.addToFiltersTree method', function () {
  var
    addToFiltersTree = methods.__get__('addToFiltersTree'),
    hashedFilter = md5('filter');

  beforeEach(function () {
    methods.dsl = { filtersTree: {} };
  });

  it('should return an error if the provided operator is not supported', function () {
    var result = addToFiltersTree('', '', '', 'foobar', '', '', '', false, false);
    should(result).be.an.Object();
    should(result.status).be.exactly(400);
    should(result.message).not.be.empty();
    should(result.message).be.exactly('Operator foobar doesn\'t exist');
  });

  it('should initializes the filter tree using the provided arguments', function () {
    var result = addToFiltersTree.call(methods, 'index', 'collection', 'field', 'gte', 42, 'filter', 'roomId');

    should.not.exist(result.error);
    should(result.path).be.exactly('index.collection.field.' + md5('filter'));
    should.exist(result.filter);
    should(result.filter.rooms).be.an.Array().and.match(['roomId']);
    should(result.filter.rooms.length).be.eql(1);
    should(result.filter.args).be.an.Object().and.match({
      operator: 'gte',
      not: undefined,
      field: 'field',
      value: 42
    });

    should.exist(methods.dsl.filtersTree.index.collection);
    should.exist(methods.dsl.filtersTree.index.collection.fields);
    should.exist(methods.dsl.filtersTree.index.collection.fields.field);
    should.exist(methods.dsl.filtersTree.index.collection.fields.field[hashedFilter]);
    should(methods.dsl.filtersTree.index.collection.fields.field[hashedFilter].rooms).be.an.Array().and.match(['roomId']);
    should(result.filter.rooms.length).be.eql(1);
    should(methods.dsl.filtersTree.index.collection.fields.field[hashedFilter].args).be.an.Object().and.match({
      operator: 'gte',
      not: undefined,
      field: 'field',
      value: 42
    });

    should.not.exist(methods.dsl.filtersTree.index.collection.rooms);
  });

  it('should not add a room to the same filter if it is already assigned to it', function () {
    addToFiltersTree.call(methods, 'index', 'collection', 'field', 'gte', 42, 'filter', 'roomId');
    addToFiltersTree.call(methods, 'index', 'collection', 'field', 'gte', 42, 'filter', 'roomId');

    should(methods.dsl.filtersTree.index.collection.fields.field[hashedFilter].rooms).be.an.Array().and.match(['roomId']);
    should(methods.dsl.filtersTree.index.collection.fields.field[hashedFilter].rooms.length).be.eql(1);
  });

  it('should also add the room to the global rooms list if the filter is global', function () {
    addToFiltersTree.call(methods, 'index', 'collection', 'field', 'gte', 42, 'filter', 'roomId', false, true);
    addToFiltersTree.call(methods, 'index', 'collection', 'field', 'gte', 42, 'filter', 'roomId', false, true);

    should.exist(methods.dsl.filtersTree.index.collection.rooms);
    should(methods.dsl.filtersTree.index.collection.rooms).be.an.Array().and.match(['roomId']);
    should(methods.dsl.filtersTree.index.collection.rooms.length).be.eql(1);
  });
});