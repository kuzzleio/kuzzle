var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.deepExtend method', function () {
  var
    deepExtend = methods.__get__('deepExtend');

  it('should return the other filter if one is empty', function () {
    var filter = { foo: 'bar' };

    should(deepExtend({}, filter)).be.exactly(filter);
    should(deepExtend(filter, {})).be.exactly(filter);
  });

  it('should be able to merge two simple filters', function () {
    var
      f1 = { term: { foo: 'bar' }},
      f2 = { exists: { field: 'foobar'}},
      result = deepExtend(f1, f2);

    should.exist(result.term);
    should(result.term.foo).not.be.undefined().and.be.exactly('bar');
    should.exist(result.exists);
    should(result.exists.field).not.be.undefined().and.be.exactly('foobar');
  });

  it('should ignore duplicate values', function () {
    var filter = { foo: 'bar' };

    should(deepExtend(filter, filter)).match(filter);
  });

  it('should merge "and" sub-filters', function () {
    var
      f1 = {
        and: {
          term: { foo: 'bar' }
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
    should.exist(result.and.term);
    should(result.and.term.foo).not.be.undefined().and.be.exactly('bar');
    should.exist(result.and.exists);
    should(result.and.exists.field).not.be.undefined().and.be.exactly('foobar');
  });

  it('should merge "or" sub-filters', function () {
    var
      f1 = {
        or: {
          term: { foo: 'bar' }
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
    should.exist(result.or.term);
    should(result.or.term.foo).not.be.undefined().and.be.exactly('bar');
    should.exist(result.or.exists);
    should(result.or.exists.field).not.be.undefined().and.be.exactly('foobar');
  });
});
