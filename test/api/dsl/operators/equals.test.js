var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test equals operator', () => {

  var document = {
    title: 'kuzzle'
  };

  it('should return true when the document field value match', () => {
    var result = operators.equals('title', 'kuzzle', document);
    should(result).be.exactly(true);
  });

  it('should return false when the document field value doesn\'t match', () => {
    var result = operators.equals('title', 'foobar', document);
    should(result).be.exactly(false);
  });

  it('should return false if the searched value doesn\'t exist in the document', () => {
    should(operators.equals('foo', 'kuzzle', document)).be.false();
  });
});