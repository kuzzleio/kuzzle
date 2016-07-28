var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test: dsl.termFunction method', () => {
  var
    methods,
    termFunction = Methods.__get__('termFunction'),
    termfoobar = md5('termfoobar'),
    termsfoobarbaz = md5('termsfoobar,baz'),
    nottermfoobar = md5('nottermfoobar'),
    nottermsfoobarbaz = md5('nottermsfoobar,baz'),
    fieldFoo = md5('foo');

  beforeEach(() => {
    methods = new Methods(new Filters());
    termFunction = termFunction.bind(methods);
  });

  it('should return a rejected promise if the provided filter is empty', () => {
    return should(termFunction('term', 'roomId', 'collection', {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the value given for a "terms" filter is not an array', () => {
    var
      filter = {
        foo: 'bar'
      };

    return should(termFunction('terms', 'roomId', 'index', 'collection', filter)).be.rejectedWith(BadRequestError, { message: 'Filter terms must contains an array' });
  });

  it('should create a valid "term" filter', () => {
    var
      filter = {
        foo: 'bar'
      };

    return termFunction('term', 'roomId', 'index', 'collection', filter)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${termfoobar}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${termfoobar}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${termfoobar}`].args).match({
          operator: 'term', not: undefined, field: 'foo', value: 'bar'
        });
      });
  });

  it('should create a valid "terms" filter', () => {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return termFunction('terms', 'roomId', 'index', 'collection', filter)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${termsfoobarbaz}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${termsfoobarbaz}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${termsfoobarbaz}`].args).match({
          operator: 'terms',
          not: undefined,
          field: 'foo',
          value: [ 'bar', 'baz' ]
        });
      });
  });

  it('should create a valid "not-term" filter', () => {
    var
      filter = {
        foo: 'bar'
      };

    return termFunction('term', 'roomId', 'index', 'collection', filter, true)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${nottermfoobar}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${nottermfoobar}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${nottermfoobar}`].args).match({
          operator: 'term', not: true, field: 'foo', value: 'bar'
        });
      });
  });

  it('should create a valid "not-terms" filter', () => {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return termFunction('terms', 'roomId', 'index', 'collection', filter, true)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${nottermsfoobarbaz}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${nottermsfoobarbaz}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${nottermsfoobarbaz}`].args).match({
          operator: 'terms',
          not: true,
          field: 'foo',
          value: [ 'bar', 'baz' ]
        });
      });
  });

  it('should return a rejected promise if filters.add fails', () => {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    methods.filters.add = () => { return new InternalError('rejected'); };

    return should(Methods.__get__('termFunction').call(methods, 'terms', 'roomId', 'index', 'collection', filter)).be.rejectedWith('rejected');
  });
});
