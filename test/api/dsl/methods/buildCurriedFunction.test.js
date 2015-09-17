var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.buildCurriedFunction method', function () {
  var
    buildCurriedFunction = methods.__get__('buildCurriedFunction');

  beforeEach(function () {
    methods.dsl = { filtersTree: {} };
  });

  it('should return an error if the provided operator is not supported', function () {
    var result = buildCurriedFunction('', '', 'foobar', '', '', '', false, false);

    should(result).be.an.Object().and.match({ error: 'Operator foobar doesn\'t exist'});
  });

  it('should initializes the filter tree using the provided arguments', function () {
    var result = buildCurriedFunction.call(methods, 'collection', 'field', 'gte', 42, 'filter', 'roomId');

    should.not.exist(result.error);
    should(result.path).be.exactly('collection.field.filter');
    should.exist(result.filter);
    should(result.filter.rooms).be.an.Array().and.match(['roomId']);
    should(result.filter.rooms.length).be.eql(1);
    should(result.filter.fn).be.a.Function();

    should.exist(methods.dsl.filtersTree.collection);
    should.exist(methods.dsl.filtersTree.collection.fields);
    should.exist(methods.dsl.filtersTree.collection.fields.field);
    should.exist(methods.dsl.filtersTree.collection.fields.field.filter);
    should(methods.dsl.filtersTree.collection.fields.field.filter.rooms).be.an.Array().and.match(['roomId']);
    should(result.filter.rooms.length).be.eql(1);
    should(methods.dsl.filtersTree.collection.fields.field.filter.fn).be.a.Function();

    should.not.exist(methods.dsl.filtersTree.collection.rooms);
  });

  it('should not add a room to the same filter if it is already assigned to it', function () {
    buildCurriedFunction.call(methods, 'collection', 'field', 'gte', 42, 'filter', 'roomId');
    buildCurriedFunction.call(methods, 'collection', 'field', 'gte', 42, 'filter', 'roomId');

    should(methods.dsl.filtersTree.collection.fields.field.filter.rooms).be.an.Array().and.match(['roomId']);
    should(methods.dsl.filtersTree.collection.fields.field.filter.rooms.length).be.eql(1);
  });

  it('should also add the room to the global rooms list if the filter is global', function () {
    buildCurriedFunction.call(methods, 'collection', 'field', 'gte', 42, 'filter', 'roomId', false, true);
    buildCurriedFunction.call(methods, 'collection', 'field', 'gte', 42, 'filter', 'roomId', false, true);

    should.exist(methods.dsl.filtersTree.collection.rooms);
    should(methods.dsl.filtersTree.collection.rooms).be.an.Array().and.match(['roomId']);
    should(methods.dsl.filtersTree.collection.rooms.length).be.eql(1);
  });
});