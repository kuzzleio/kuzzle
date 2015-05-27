var
  should = require('should'),
  operators = require('root-require')('lib/api/dsl/operators');

describe('Test term operator', function () {

  var document = {
    title: 'kuzzle'
  };

  it('should return true when the document field value correspond', function () {
    var result = operators.term('title', 'kuzzle', document);
    should(result).be.exactly(true);
  });

  it('should return false when the document field value doesn\'t correspond', function () {
    var result = operators.term('title', 'toto', document);
    should(result).be.exactly(false);
  });

});