var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.remove', () => {
  var
    dsl,
    index = 'test',
    collection = 'user',
    filterId = 'foo',
    filter = {
      in: {
        city: ['NYC', 'London']
      }
    };

  beforeEach(() => {
    dsl = new Dsl();
  });

  it('should return a promise', () => {
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

  it('should fail if the provided filter ID is not a string', () => {
    return should(dsl.remove(['foobar'])).be.rejectedWith('Expected a filterId, got a object');
  });
});
