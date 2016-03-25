/* The "to" operator is simply an alias to the lte one */
var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test to operator', function () {
  it('should call the lte() operator with same arguments', function () {
    var
      argumentsMatch = false,
      called = false,
      saved = operators.lte;

    operators.lte = function (field, value, document) {
      if (field === 'foo' && value === 0 && document.toString() === {}.toString()) {
        argumentsMatch = true;
      }
      called = true; };
    operators.to('foo', 0, {});
    operators.lte = saved;

    should(argumentsMatch).be.true();
    should(called).be.true();
  });
});
