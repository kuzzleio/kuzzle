var
  should = require('should'),
  operators = require('root-require')('lib/api/models/operators');

describe('Test gte operator', function () {

  var document = {
    age: 10
  };

  it('should return false when the document field value is lower', function () {
    var result = operators.gte('age', 15, document);
    should(result).be.exactly(false);
  });

  it('should return true when the document field value is greater', function () {
    var result = operators.gte('age', 5, document);
    should(result).be.exactly(true);
  });

  it('should return true on equality', function () {
    var result = operators.gte('age', 10, document);
    should(result).be.exactly(true);
  });

});