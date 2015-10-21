/* The "from" operator is simply an alias to the gte one */
var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test from operator', function () {
  it('should call the gte() operator', function () {
    var
      called = false,
      saved = operators.gte;

    operators.gte = function () { called = true; };
    operators.from('foo', 0, {});
    operators.gte = saved;

    should(called).be.true();
  });
});
