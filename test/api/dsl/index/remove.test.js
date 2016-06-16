var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.remove', function () {
  var
    dsl,
    index = 'test',
    collection = 'user',
    filterId = 'foo',
    filter = {
      terms: {
        city: ['NYC', 'London']
      }
    };

  beforeEach(() => {
    dsl = new Dsl();
  });

  it('should return a promise', function () {
    return should(dsl.remove('foo')).be.fulfilled();
  });

  it('should remove a filter containing field filters', () => {
    return dsl.register(filterId, index, collection, filter)
      .then(() => {
        should(dsl.filters.filtersTree).not.be.empty().Object();
        return dsl.remove(filterId);
      })
      .then(() => should(dsl.filters.filtersTree).be.empty().Object());
  });

  it('should remove a room containing global filters', () => {
    return dsl.register(filterId, index, collection, {})
      .then(() => {
        should(dsl.filters.filtersTree).not.be.empty().Object();
        return dsl.remove(filterId);
      })
      .then(() => should(dsl.filters.filtersTree).be.empty().Object());
  });

  it('should return a rejected promise on fail', function () {
    dsl.filters.removeFieldFilter = () => q.reject(new Error('rejected'));

    return dsl.register(filterId, index, collection, {})
      .then(() => {
        should(dsl.filters.filtersTree).not.be.empty().Object();
        return should(dsl.remove(filterId)).be.rejected();
      });
  });

  it('should fail if the provided filter ID is not a string', function () {
    return should(dsl.remove(['foobar'])).be.rejectedWith('Expected a filterId, got a object');
  });
});
