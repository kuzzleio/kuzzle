var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods'),
  InternalError = require('../../../../lib/api/core/errors/internalError');

require('should-promised');

describe('Test: dsl.termFunction method', function () {
  var
    termFunction = methods.__get__('termFunction');

  beforeEach(function () {
    methods.dsl = { filtersTree: {} };
  });

  it('should return a rejected promise if the provided filter is empty', function () {
    return should(termFunction('term', 'roomId', 'collection', {})).be.rejectedWith('A filter can\'t be empty');
  });

  it('should return a rejected promise if the value given for a "terms" filter is not an array', function () {
    var
      filter = {
        foo: 'bar'
      };

    return should(termFunction('terms', 'roomId', 'collection', filter)).be.rejectedWith('Filter terms must contains an array');
  });

  it('should create a valid "term" filter', function (done) {
    var
      filter = {
        foo: 'bar'
      };

    termFunction('term', 'roomId', 'collection', filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.termfoobar']);
        should(formattedFilter['collection.foo.termfoobar'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.termfoobar'].fn).be.a.Function();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should create a valid "terms" filter', function (done) {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    termFunction('terms', 'roomId', 'collection', filter)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.termsfoobar,baz']);
        should(formattedFilter['collection.foo.termsfoobar,baz'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.termsfoobar,baz'].fn).be.a.Function();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should create a valid "not-term" filter', function (done) {
    var
      filter = {
        foo: 'bar'
      };

    termFunction('term', 'roomId', 'collection', filter, true)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.nottermfoobar']);
        should(formattedFilter['collection.foo.nottermfoobar'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.nottermfoobar'].fn).be.a.Function();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should create a valid "not-terms" filter', function (done) {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    termFunction('terms', 'roomId', 'collection', filter, true)
      .then(function (formattedFilter) {
        should.exist(formattedFilter['collection.foo.nottermsfoobar,baz']);
        should(formattedFilter['collection.foo.nottermsfoobar,baz'].rooms).be.an.Array().and.match(['roomId']);
        should(formattedFilter['collection.foo.nottermsfoobar,baz'].fn).be.a.Function();
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('should return a rejected promise if buildCurriedFunction fails', function () {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return methods.__with__({
      buildCurriedFunction: function () { return new InternalError('rejected'); }
    })(function () {
      return should(termFunction('terms', 'roomId', 'collection', filter)).be.rejectedWith('rejected');
    });
  });
});
