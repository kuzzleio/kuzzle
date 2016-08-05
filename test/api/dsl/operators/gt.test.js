var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test gt operator', () => {

  var document = {
    age: 10
  };

  it('should return false when the document field value is lower', () => {
    var result = operators.gt('age', 15, document);
    should(result).be.false();
  });

  it('should return true when the document field value is greater', () => {
    var result = operators.gt('age', 5, document);
    should(result).be.true();
  });

  it('should return false on equality', () => {
    var result = operators.gt('age', 10, document);
    should(result).be.false();
  });

  it('should return false if the searched value cannot be found in the document', () => {
    should(operators.gt('foo', 5, document)).be.false();
  });
});