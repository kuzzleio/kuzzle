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
    fieldFoo = md5('foo'),
    fieldBar = md5('bar');

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
      .then(response => response.filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`]).be.an.Object();
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids.length).eql(1);
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].args);
      });
  });

  it('should be able to handle an array of filters', function () {
    var
      filters = [
        { exists: { field: 'foo' } },
        { exists: { field: 'bar' } }
      ];

    return getFormattedFilters.call(methods, 'roomId', 'index', 'collection', filters)
      .then(response => response.filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`]).be.an.Object();
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids.length).eql(1);
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].args);

        should.exist(formattedFilter[`index.collection.${fieldBar}.${existsbar}`]);
        should(formattedFilter[`index.collection.${fieldBar}.${existsbar}`]).be.an.Object();
        should.exist(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].ids);
        should(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].ids.length).eql(1);
        should.exist(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].args);
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
      .then(response => response.filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`]).be.an.Object();
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].ids.length).eql(1);
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${existsfoo}`].args);

        should.exist(formattedFilter[`index.collection.${fieldBar}.${existsbar}`]);
        should(formattedFilter[`index.collection.${fieldBar}.${existsbar}`]).be.an.Object();
        should.exist(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].ids);
        should(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].ids.length).eql(1);
        should.exist(formattedFilter[`index.collection.${fieldBar}.${existsbar}`].args);
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
      .then(response => response.filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${notexistsfoo}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${notexistsfoo}`]).be.an.Object();
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${notexistsfoo}`].ids);
        should(formattedFilter[`index.collection.${fieldFoo}.${notexistsfoo}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${notexistsfoo}`].ids.length).eql(1);
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${notexistsfoo}`].args);
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
