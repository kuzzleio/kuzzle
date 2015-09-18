/* The "to" operator is simply an alias to the lte one */
var
  should = require('should'),
  operators = require('root-require')('lib/api/dsl/operators');

describe('Test to operator', function () {
  it('should call the lte() operator', function () {
    var
      called = false,
      saved = operators.lte;

    operators.lte = function () { called = true; };
    operators.to('foo', 0, {});
    operators.lte = saved;

    should(called).be.true();
  });
});
