var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5');
  DslFilters = rewire('../../../../lib/api/dsl/filters');

describe('Test: dsl.filters.add', function () {
  var
    filters,
    hashedFilter = md5('filter');

  beforeEach(function () {
    filters = new DslFilters();
  });

  it('should return an error if the provided operator is not supported', function () {
    var result = filters.add('', '', '', 'foobar', '', '', '', false, false);
    should(result).be.an.Object();
    should(result.status).be.exactly(400);
    should(result.message).not.be.empty();
    should(result.message).be.exactly('Operator foobar doesn\'t exist');
  });

  it('should initializes the filter tree using the provided arguments', function () {
    var result = filters.add('index', 'collection', 'field', 'gte', 42, 'filter', 'filterId');

    should.not.exist(result.error);
    should(result.path).be.exactly('index.collection.field.' + md5('filter'));
    should.exist(result.filter);
    should(result.filter.ids).be.an.Array().and.match(['filterId']);
    should(result.filter.ids.length).be.eql(1);
    should(result.filter.args).be.an.Object().and.match({
      operator: 'gte',
      not: undefined,
      field: 'field',
      value: 42
    });

    should.exist(filters.filtersTree.index.collection);
    should.exist(filters.filtersTree.index.collection.fields);
    should.exist(filters.filtersTree.index.collection.fields.field);
    should.exist(filters.filtersTree.index.collection.fields.field[hashedFilter]);
    should(filters.filtersTree.index.collection.fields.field[hashedFilter].ids).be.an.Array().and.match(['filterId']);
    should(result.filter.ids.length).be.eql(1);
    should(filters.filtersTree.index.collection.fields.field[hashedFilter].args).be.an.Object().and.match({
      operator: 'gte',
      not: undefined,
      field: 'field',
      value: 42
    });

    should.not.exist(filters.filtersTree.index.collection.ids);
  });

  it('should not add a room to the same filter if it is already assigned to it', function () {
    filters.add('index', 'collection', 'field', 'gte', 42, 'filter', 'filterId');
    filters.add('index', 'collection', 'field', 'gte', 42, 'filter', 'filterId');

    should(filters.filtersTree.index.collection.fields.field[hashedFilter].ids).be.an.Array().and.match(['filterId']);
    should(filters.filtersTree.index.collection.fields.field[hashedFilter].ids.length).be.eql(1);
  });

  it('should also add the room to the global rooms list if the filter is global', function () {
    filters.add('index', 'collection', 'field', 'gte', 42, 'filter', 'filterId', false, true);
    filters.add('index', 'collection', 'field', 'gte', 42, 'filter', 'filterId', false, true);

    should.exist(filters.filtersTree.index.collection.globalFilterIds);
    should(filters.filtersTree.index.collection.globalFilterIds).be.an.Array().and.match(['filterId']);
    should(filters.filtersTree.index.collection.globalFilterIds.length).be.eql(1);
  });
});