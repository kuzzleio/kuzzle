var
  should = require('should'),
  operators = require.main.require('lib/api/dsl/operators');

describe('Test "geoDistanceRange" operator', function () {
  var
    field = 'location',
    valueOK = {
      lat: 0,
      lon: 1,
      from: 111320,
      to: 111317
    },
    valueNOK = {
      lat: 0,
      lon: 1,
      from: 1,
      to: 10
    },
    valueEqual = {
      lat: 0,
      lon: 1,
      from: 111318,
      to: 111318
    },
    document = {
      name: 'Zero',
      'location.lat': 0,
      'location.lon': 0
    };


  it('should return false if no lat or lon members exists for the location member of the document', function () {
    should(operators.geoDistanceRange(field, valueOK, {
      name: 'Bad',
      'location.lol': 0,
      'location.cat': 0
    })).be.false();

    should(operators.geoDistanceRange(field, valueOK, {
      name: 'Bad',
      'location.lol': 0,
      'location.lat': 0
    })).be.false();

    should(operators.geoDistanceRange(field, valueOK, {
      name: 'Bad',
      'location.lon': 0,
      'location.cat': 0
    })).be.false();
  });

  it('should test distance ranges correctly', function () {
    should(operators.geoDistanceRange(field, valueOK, document)).be.true();
    should(operators.geoDistanceRange(field, valueNOK, document)).be.false();
    should(operators.geoDistanceRange(field, valueEqual, document)).be.true();
  });
});
