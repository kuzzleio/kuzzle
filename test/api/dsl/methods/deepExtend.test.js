var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.deepExtend method', () => {
  var
    deepExtend = methods.__get__('deepExtend');

  it('should return the other filter if one is empty', () => {
    var filter = { foo: 'bar' };

    should(deepExtend({}, filter)).be.exactly(filter);
    should(deepExtend(filter, {})).be.exactly(filter);
  });

  it('should be able to merge two simple filters', () => {
    var
      f1 = { equals: { foo: 'bar' }},
      f2 = { exists: { field: 'foobar'}},
      result = deepExtend(f1, f2);

    should.exist(result.equals);
    should(result.equals.foo).not.be.undefined().and.be.exactly('bar');
    should.exist(result.exists);
    should(result.exists.field).not.be.undefined().and.be.exactly('foobar');
  });

  it('should ignore duplicate values', () => {
    var filter = { foo: 'bar' };

    should(deepExtend(filter, filter)).match(filter);
  });

  it('should merge "and" sub-filters', () => {
    var
      f1 = {
        and: {
          equals: { foo: 'bar' }
        }
      },
      f2 = {
        and: {
          exists: { field: 'foobar'}
        }
      },
      result = deepExtend(f1, f2);

    should.exist(result.and);
    should(Object.keys(result).length).be.exactly(1);
    should.exist(result.and.equals);
    should(result.and.equals.foo).not.be.undefined().and.be.exactly('bar');
    should.exist(result.and.exists);
    should(result.and.exists.field).not.be.undefined().and.be.exactly('foobar');
  });

  it('should merge "or" sub-filters', () => {
    var
      f1 = {
        or: {
          equals: { foo: 'bar' }
        }
      },
      f2 = {
        or: {
          exists: { field: 'foobar'}
        }
      },
      result = deepExtend(f1, f2);

    should.exist(result.or);
    should(Object.keys(result).length).be.exactly(1);
    should.exist(result.or.equals);
    should(result.or.equals.foo).not.be.undefined().and.be.exactly('bar');
    should.exist(result.or.exists);
    should(result.or.exists.field).not.be.undefined().and.be.exactly('foobar');
  });
});
