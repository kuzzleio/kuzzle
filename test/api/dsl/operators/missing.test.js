var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test missing operator', () => {

  var document = {
    title: 'kuzzle',
    hobbies: { killing: 'cute animals'},
    achievements: [ null, null, 'killed a small animal', null ],
    age: 10,
    city: null,
    country: {},
    street: [],
    postalCode: [ null ]
  };

  it('should return true when the document is missing the given field', () => {
    should(operators.missing('foo', null, document)).be.exactly(true);
  });

  it('should return false when the document has not the given field', () => {
    should(operators.missing('title', null, document)).be.false();
    should(operators.missing('hobbies', null, document)).be.false();
    should(operators.missing('achievements', null, document)).be.false();
  });

  it('should return true if the document values is null', () => {
    should(operators.missing('city', null, document)).be.exactly(true);
  });

  it('should return true if the document value is an empty object', () => {
    should(operators.missing('country', null, document)).be.exactly(true);
  });

  it('should return true if the document value is an array containing only null values', () => {
    should(operators.missing('postalCode', null, document)).be.exactly(true);
  });
});