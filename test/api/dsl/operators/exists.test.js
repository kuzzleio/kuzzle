var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test exists operator', function () {

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

  it('should return true when the document has the given field', function () {
    should(operators.exists('title', null, document)).be.exactly(true);
    should(operators.exists('hobbies', null, document)).be.exactly(true);
    should(operators.exists('achievements', null, document)).be.exactly(true);
  });

  it('should return false when the document has not the given field', function () {
    should(operators.exists('foo', null, document)).be.exactly(false);
  });

  it('should return false if the document values is null', function () {
    should(operators.exists('city', null, document)).be.false();
  });

  it('should return false if the document value is an empty object', function () {
    should(operators.exists('country', null, document)).be.false();
  });

  it('should return false if the document value is an empty array', function () {
    should(operators.exists('street', null, document)).be.false();
    should(operators.exists('postalCode', null, document)).be.false();
  });
});