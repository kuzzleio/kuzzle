var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  q = require('q'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError;

describe('Test: dsl.getFormattedFilters method', function () {
  var
    methods,
    getFormattedFilters = Methods.__get__('getFormattedFilters'),
    existsfoo = md5('existsfoo'),
    notexistsfoo = md5('notexistsfoo'),
    existsbar = md5('existsbar'),
    notexistsbar = md5('notexistsbar');

  beforeEach(function () {
    methods = new Methods(new Filters());
  });

  it('should return a rejected promise if the provided filter is empty', function () {
    return should(getFormattedFilters.call(methods, 'roomId', 'index', 'collection', {})).be.rejectedWith(BadRequestError, { message: 'Filters can\'t be empty' });
  });

  it('should return a rejected promise if a filter refers to an unknown method name', function () {
    return should(getFormattedFilters.call(methods, 'roomId', 'index', 'collection', { foo: 'bar'})).be.rejectedWith(BadRequestError, { message: 'Function foo doesn\'t exist' });
  });

  it('should return a resolved promise containing 1 formatted filter', function () {
    var
      filter = {
        exists: {
          field: 'foo'
        }
      };

    return getFormattedFilters.call(methods, 'roomId', 'index', 'collection', filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + existsfoo]);
        should(formattedFilter['index.collection.foo.' + existsfoo]).be.an.Object();
        should.exist(formattedFilter['index.collection.foo.' + existsfoo].ids);
        should(formattedFilter['index.collection.foo.' + existsfoo].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + existsfoo].ids.length).eql(1);
        should.exist(formattedFilter['index.collection.foo.' + existsfoo].args);
      });
  });

  it('should be able to handle an array of filters', function () {
    var
      filters = [
        { exists: { field: 'foo' } },
        { exists: { field: 'bar' } }
      ];

    return getFormattedFilters.call(methods, 'roomId', 'index', 'collection', filters)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + existsfoo]);
        should(formattedFilter['index.collection.foo.' + existsfoo]).be.an.Object();
        should.exist(formattedFilter['index.collection.foo.' + existsfoo].ids);
        should(formattedFilter['index.collection.foo.' + existsfoo].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + existsfoo].ids.length).eql(1);
        should.exist(formattedFilter['index.collection.foo.' + existsfoo].args);

        should.exist(formattedFilter['index.collection.bar.' + existsbar]);
        should(formattedFilter['index.collection.bar.' + existsbar]).be.an.Object();
        should.exist(formattedFilter['index.collection.bar.' + existsbar].ids);
        should(formattedFilter['index.collection.bar.' + existsbar].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.bar.' + existsbar].ids.length).eql(1);
        should.exist(formattedFilter['index.collection.bar.' + existsbar].args);
      });
  });

  it('should ignore empty filters when an array of filters is provided', function () {
    var
      filters = [
        { exists: { field: 'foo' } },
        {},
        { exists: { field: 'bar' } }
      ];

    return getFormattedFilters.call(methods, 'roomId', 'index', 'collection', filters)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + existsfoo]);
        should(formattedFilter['index.collection.foo.' + existsfoo]).be.an.Object();
        should.exist(formattedFilter['index.collection.foo.' + existsfoo].ids);
        should(formattedFilter['index.collection.foo.' + existsfoo].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + existsfoo].ids.length).eql(1);
        should.exist(formattedFilter['index.collection.foo.' + existsfoo].args);

        should.exist(formattedFilter['index.collection.bar.' + existsbar]);
        should(formattedFilter['index.collection.bar.' + existsbar]).be.an.Object();
        should.exist(formattedFilter['index.collection.bar.' + existsbar].ids);
        should(formattedFilter['index.collection.bar.' + existsbar].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.bar.' + existsbar].ids.length).eql(1);
        should.exist(formattedFilter['index.collection.bar.' + existsbar].args);
      });
  });

  it('should invert the filter if the "not" argument is set to true', function () {
    var
      filter = {
        exists: {
          field: 'foo'
        }
      };

    return getFormattedFilters.call(methods, 'roomId', 'index', 'collection', filter, true)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['index.collection.foo.' + notexistsfoo]);
        should(formattedFilter['index.collection.foo.' + notexistsfoo]).be.an.Object();
        should.exist(formattedFilter['index.collection.foo.' + notexistsfoo].ids);
        should(formattedFilter['index.collection.foo.' + notexistsfoo].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter['index.collection.foo.' + notexistsfoo].ids.length).eql(1);
        should.exist(formattedFilter['index.collection.foo.' + notexistsfoo].args);
      });
  });

  it('should return a rejected promise if the called method name fails', function () {
    var
      filter = {
        exists: {
          field: 'foo'
        }
      };

    methods.exists = function () { return q.reject(new Error('rejected')); };

    return should(getFormattedFilters.call(methods, 'roomId', 'index', 'collection', filter)).be.rejectedWith('rejected');
  });
});
