var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError');

require('should-promised');

describe('Test: dsl.getFormattedFilters method', function () {
  var
    getFormattedFilters = methods.__get__('getFormattedFilters');

  beforeEach(function () {
    methods.dsl = { filtersTree: {} };
  });

  it('should return a rejected promise if the provided filter is empty', function () {
    return should(getFormattedFilters('roomId', 'collection', {})).be.rejectedWith(BadRequestError, { message: 'Filters can\'t be empty' });
  });

  it('should return a rejected promise if a filter refers to an unknown method name', function () {
    return should(getFormattedFilters('roomId', 'collection', { foo: 'bar'})).be.rejectedWith(BadRequestError, { message: 'Function foo doesn\'t exist' });
  });

  it('should return a resolved promise containing 1 formatted filter', function (done) {
    var
      filter = {
        exists: {
          field: 'foo'
        }
      };

    getFormattedFilters('roomId', 'collection', filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.existsfoo']);
        should(formattedFilter['collection.foo.existsfoo']).be.an.Object();
        should.exist(formattedFilter['collection.foo.existsfoo'].rooms);
        should(formattedFilter['collection.foo.existsfoo'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.existsfoo'].rooms.length).eql(1);
        should.exist(formattedFilter['collection.foo.existsfoo'].fn);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should be able to handle an array of filters', function (done) {
    var
      filters = [
        { exists: { field: 'foo' } },
        { exists: { field: 'bar' } }
      ];

    getFormattedFilters('roomId', 'collection', filters)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.existsfoo']);
        should(formattedFilter['collection.foo.existsfoo']).be.an.Object();
        should.exist(formattedFilter['collection.foo.existsfoo'].rooms);
        should(formattedFilter['collection.foo.existsfoo'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.existsfoo'].rooms.length).eql(1);
        should.exist(formattedFilter['collection.foo.existsfoo'].fn);

        should.exist(formattedFilter['collection.bar.existsbar']);
        should(formattedFilter['collection.bar.existsbar']).be.an.Object();
        should.exist(formattedFilter['collection.bar.existsbar'].rooms);
        should(formattedFilter['collection.bar.existsbar'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.bar.existsbar'].rooms.length).eql(1);
        should.exist(formattedFilter['collection.bar.existsbar'].fn);

        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should ignore empty filters when an array of filters is provided', function (done) {
    var
      filters = [
        { exists: { field: 'foo' } },
        {},
        { exists: { field: 'bar' } }
      ];

    getFormattedFilters('roomId', 'collection', filters)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.existsfoo']);
        should(formattedFilter['collection.foo.existsfoo']).be.an.Object();
        should.exist(formattedFilter['collection.foo.existsfoo'].rooms);
        should(formattedFilter['collection.foo.existsfoo'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.existsfoo'].rooms.length).eql(1);
        should.exist(formattedFilter['collection.foo.existsfoo'].fn);

        should.exist(formattedFilter['collection.bar.existsbar']);
        should(formattedFilter['collection.bar.existsbar']).be.an.Object();
        should.exist(formattedFilter['collection.bar.existsbar'].rooms);
        should(formattedFilter['collection.bar.existsbar'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.bar.existsbar'].rooms.length).eql(1);
        should.exist(formattedFilter['collection.bar.existsbar'].fn);

        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should invert the filter if the "not" argument is set to true', function (done) {
    var
      filter = {
        exists: {
          field: 'foo'
        }
      };

    getFormattedFilters('roomId', 'collection', filter, true)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.notexistsfoo']);
        should(formattedFilter['collection.foo.notexistsfoo']).be.an.Object();
        should.exist(formattedFilter['collection.foo.notexistsfoo'].rooms);
        should(formattedFilter['collection.foo.notexistsfoo'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.notexistsfoo'].rooms.length).eql(1);
        should.exist(formattedFilter['collection.foo.notexistsfoo'].fn);
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if the called method name fails', function () {
    var
      filter = {
        exists: {
          field: 'foo'
        }
      };

    methods.exists = function () { return Promise.reject(new Error('rejected')); };

    return should(getFormattedFilters('roomId', 'collection', filter)).be.rejectedWith('rejected');
  });
});
