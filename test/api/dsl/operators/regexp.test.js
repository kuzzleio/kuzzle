var
  should = require('should'),
  operators = require('../../../../lib/api/dsl/operators'),
  regexp = operators.regexp;

describe('Test: operator regexp', () => {


  it('should not validate a entry that is not a string', () => {
    should(regexp('foo', '/.*/', { foo: -1 })).be.false();
  });

  it('should test the doc value against the regex', () => {
    should(regexp('foo', '/.*/', {foo: 'something'})).be.true();
    should(regexp('foo', '/^bar/i', {foo: 'BarTest'})).be.true();
    should(regexp('foo', '/^bar/', {foo: 'noMatch'})).be.false();
  });

});
