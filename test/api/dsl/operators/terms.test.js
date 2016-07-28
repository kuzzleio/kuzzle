var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test terms operator', () => {

  var document = {
    title: 'kuzzle'
  };

  it('should return true when the document field value correspond to minimum one of given value', () => {
    var result = operators.terms('title', ['kuzzle', 'foo'], document);
    should(result).be.exactly(true);
  });

  it('should return false when given array is empty', () => {
    var result = operators.terms('title', [], document);
    should(result).be.exactly(false);
  });

  it('should return false when no array is provided', () => {
    var result = operators.terms('title', null, document);
    should(result).be.exactly(false);
  });

  it('should return false when the document field value doesn\'t correspond to any value in given array', () => {
    var result = operators.terms('title', ['foo', 'bar'], document);
    should(result).be.exactly(false);
  });

});