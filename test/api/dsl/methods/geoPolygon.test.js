var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test "geoPolygon" method', () => {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'test',
    collection = 'collection',
    filterExact = {
      location: {
        points: [
          [-1,1],
          [1,1],
          [1,-1],
          [-1,-1]
        ]
      }
    },
    filterLimit = {
      location: {
        points: [
          [0,1],
          [1,1],
          [1,0],
          [0,0]
        ]
      }
    },
    filterOutside = {
      location: {
        points: [
          [10,11],
          [11,11],
          [11,10],
          [10,10]
        ]
      }
    },
    locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd = md5('locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd'),
    locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz = md5('locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz'),
    locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0 = md5('locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0'),
    fieldLocation = md5('location');

  beforeEach(() => {
    /** @type Methods */
    methods = new Methods(new Filters());

    return methods.geoPolygon(filterId, index, collection, filterExact)
      .then(() => methods.geoPolygon(filterId, index, collection, filterLimit))
      .then(() => methods.geoPolygon(filterId, index, collection, filterOutside));
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation]).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', () => {
    // Coordinates are geohashed to build the encoded function name
    // because we have many times the same coord in filters,
    // we must have only four functions

    should(Object.keys(methods.filters.filtersTree[index][collection].fields[fieldLocation])).have.length(3);
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', () => {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

  });

  it('should construct the filterTree with correct functions geoPolygon', () => {
    // test exact
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd].args).match({
      operator: 'geoPolygon',
      not: undefined,
      field: 'location',
      value:
        [ { lat: -1, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 1, lon: -1 },
          { lat: -1, lon: -1 } ]
    });

    // test outside
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz].args).match({
      operator: 'geoPolygon',
      not: undefined,
      field: 'location',
      value:
        [ { lat: 0, lon: 1 },
          { lat: 1, lon: 1 },
          { lat: 1, lon: 0 },
          { lat: 0, lon: 0 } ]
    });

    // test on limit
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0].args).match({
      operator: 'geoPolygon',
      not: undefined,
      field: 'location',
      value:
        [ { lat: 10, lon: 11 },
          { lat: 11, lon: 11 },
          { lat: 11, lon: 10 },
          { lat: 10, lon: 10 } ]
    });
  });

  it('should return a rejected promise if an empty filter is provided', () => {
    return should(methods.geoPolygon('foo', index, 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
  });

  it('should return a rejected promise if the geolocalisation filter is invalid', () => {
    var
      invalidFilter = {
        location: {
          top: -2.939744,
          bottom: 1.180129,
          right: 51.143628
        },
        distance: 123
      };

    return should(methods.geoPolygon(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No point list found' });
  });

  it('should return a rejected promise if the location filter parameter is missing', () => {
    var
      invalidFilter = {
        distance: 123
      };

    return should(methods.geoPolygon(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No point list found' });
  });

  it('should handle the not parameter', () => {
    return methods.geoPolygon(filterId, index, collection, filterExact, true);
  });

  it('should return a rejected promise if the location filter parameter does not contain a points member', () => {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        }
      };

    return should(methods.geoPolygon(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No point list found' });
  });

  it('should return a rejected promise if the location filter parameter contain a points filter with less than 3 points', () => {
    var
      invalidFilter = {
        location: {
          points: [
            [-1,1],
            [-1,-1]
          ]
        }
      };

    return should(methods.geoPolygon(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'A polygon must have at least 3 points' });
  });

  it('should return a rejected promise if the location filter parameter contain a points filter wich is not an array', () => {
    var
      invalidFilter = {
        location: {
          points: { foo: 'bar' }
        }
      };

    return should(methods.geoPolygon(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'A polygon must be in array format' });
  });

  it('should return a rejected promise if addToFiltersTree fails', () => {
    methods.filters.add = () => { return new InternalError('rejected'); };
    return should(methods.geoPolygon(filterId, index, collection, filterExact)).be.rejectedWith('rejected');
  });
});