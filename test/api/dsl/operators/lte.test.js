var
  should = require('should'),
  operators = require('root-require')('lib/api/dsl/operators');

describe('Test lte operator', function () {

  var document = {
    age: 10
  };

  it('should return true when the document field value is lower', function () {
    var result = operators.lte('age', 15, document);
    should(result).be.true();
  });

  it('should return false when the document field value is greater', function () {
    var result = operators.lte('age', 5, document);
    should(result).be.false();
  });

  it('should return true on equality', function () {
    var result = operators.lte('age', 10, document);
    should(result).be.true();
  });

  it('should return false if the searched value is not in the document', function () {
    should(operators.lte('foo', 10, document)).be.false();
  });
});