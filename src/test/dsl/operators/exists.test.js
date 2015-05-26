var
  should = require('should'),
  operators = require('root-require')('lib/api/models/operators');

describe('Test exists operator', function () {

  var document = {
    title: 'kuzzle',
    age: 10
  };

  it('should return true when the document has the given field', function () {
    var result = operators.exists('title', null, document);
    should(result).be.exactly(true);
  });

  it('should return false when the document has not the given field', function () {
    var result = operators.exists('toto', null, document);
    should(result).be.exactly(false);
  });


});