var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test lte operator', () => {

  var document = {
    age: 10
  };

  it('should return true when the document field value is lower', () => {
    var result = operators.lte('age', 15, document);
    should(result).be.true();
  });

  it('should return false when the document field value is greater', () => {
    var result = operators.lte('age', 5, document);
    should(result).be.false();
  });

  it('should return true on equality', () => {
    var result = operators.lte('age', 10, document);
    should(result).be.true();
  });

  it('should return false if the searched value is not in the document', () => {
    should(operators.lte('foo', 10, document)).be.false();
  });
});