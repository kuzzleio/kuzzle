var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test: dsl.termFunction method', function () {
  var
    methods,
    termFunction = Methods.__get__('termFunction'),
    termfoobar = md5('termfoobar'),
    termsfoobarbaz = md5('termsfoobar,baz'),
    nottermfoobar = md5('nottermfoobar'),
    nottermsfoobarbaz = md5('nottermsfoobar,baz');

  beforeEach(function () {
    methods = new Methods({filtersTree: {}});
    termFunction = termFunction.bind(methods);
  });

  it('should return a rejected promise if the provided filter is empty', function () {
    return should(termFunction('term', 'roomId', 'collection', {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the value given for a "terms" filter is not an array', function () {
    var
      filter = {
        foo: 'bar'
      };

    return should(termFunction('terms', 'roomId', 'index', 'collection', filter)).be.rejectedWith(BadRequestError, { message: 'Filter terms must contains an array' });
  });

  it('should create a valid "term" filter', function () {
    var
      filter = {
        foo: 'bar'
      };

    return termFunction('term', 'roomId', 'index', 'collection', filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + termfoobar]);
        should(formattedFilter['index.collection.foo.' + termfoobar].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + termfoobar].args).match({
          operator: 'term', not: undefined, field: 'foo', value: 'bar'
        });
      });
  });

  it('should create a valid "terms" filter', function () {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return termFunction('terms', 'roomId', 'index', 'collection', filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + termsfoobarbaz]);
        should(formattedFilter['index.collection.foo.' + termsfoobarbaz].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + termsfoobarbaz].args).match({
          operator: 'terms',
          not: undefined,
          field: 'foo',
          value: [ 'bar', 'baz' ]
        });
      });
  });

  it('should create a valid "not-term" filter', function () {
    var
      filter = {
        foo: 'bar'
      };

    return termFunction('term', 'roomId', 'index', 'collection', filter, true)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + nottermfoobar]);
        should(formattedFilter['index.collection.foo.' + nottermfoobar].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + nottermfoobar].args).match({
          operator: 'term', not: true, field: 'foo', value: 'bar'
        });
      });
  });

  it('should create a valid "not-terms" filter', function () {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return termFunction('terms', 'roomId', 'index', 'collection', filter, true)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + nottermsfoobarbaz]);
        should(formattedFilter['index.collection.foo.' + nottermsfoobarbaz].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + nottermsfoobarbaz].args).match({
          operator: 'terms',
          not: true,
          field: 'foo',
          value: [ 'bar', 'baz' ]
        });
      });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return Methods.__with__({
      addToFiltersTree: function () { return new InternalError('rejected'); }
    })(function () {
      return should(termFunction('terms', 'roomId', 'index', 'collection', filter)).be.rejectedWith('rejected');
    });
  });
});
