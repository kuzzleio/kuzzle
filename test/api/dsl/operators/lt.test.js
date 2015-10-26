var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test lt operator', function () {

  var document = {
    age: 10
  };

  it('should return true when the document field value is lower', function () {
    var result = operators.lt('age', 15, document);
    should(result).be.exactly(true);
  });

  it('should return false when the document field value is greater', function () {
    var result = operators.lt('age', 5, document);
    should(result).be.exactly(false);
  });

  it('should return false on equality', function () {
    var result = operators.lt('age', 10, document);
    should(result).be.exactly(false);
  });

  it('should return false if the searched value is not in the document', function () {
    should(operators.lt('foo', 15, document)).be.false();
  });
});