/* The "from" operator is simply an alias to the gte one */
var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test from operator', function () {
  it('should call the gte() operator with same arguments', function () {
    var
      argumentsMatch = false,
      called = false,
      saved = operators.gte;

    operators.gte = function (field, value, document) {
      if (field === 'foo' && value === 0 && document.toString() === {}.toString()) {
        argumentsMatch = true;
      }
      called = true;
    };
    operators.from('foo', 0, {});
    operators.gte = saved;

    should(argumentsMatch).be.true();
    should(called).be.true();
  });
});
