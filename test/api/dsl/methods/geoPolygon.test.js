var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;


describe('Test "geoPolygon" method', function () {
  var
    methods,
    roomId = 'roomId',
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
    locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0 = md5('locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0');

  before(function () {
    methods = new Methods({filtersTree: {}});

    return methods.geoPolygon(roomId, index, collection, filterExact)
      .then(() => methods.geoPolygon(roomId, index, collection, filterLimit))
      .then(() => methods.geoPolygon(roomId, index, collection, filterOutside));
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.dsl.filtersTree).not.be.empty();
    should(methods.dsl.filtersTree[index]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.location).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', function () {
    // Coordinates are geohashed to build the encoded function name
    // because we have many times the same coord in filters,
    // we must have only four functions
    
    should(Object.keys(methods.dsl.filtersTree[index][collection].fields.location)).have.length(3);
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz]).not.be.empty();
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var rooms;

    rooms = methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

    rooms = methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0].rooms;
    should(rooms).be.an.Array();
    should(rooms).have.length(1);
    should(rooms[0]).be.exactly(roomId);

  });

  it('should construct the filterTree with correct functions geoPolygon', function () {
    // test exact
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygonkpbdqcbnts00twy01mebpm9npc67zz631zyd].args).match({
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
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygonkpbxyzbpvs00twy01mebpvxypcr7zzzzzzzz].args).match({
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
    should(methods.dsl.filtersTree[index][collection].fields.location[locationgeoPolygons1zbfk3yns1zyd63zws1zned3z8s1z0gs3y0].args).match({
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

  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.geoPolygon('foo', index, 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
  });

  it('should return a rejected promise if the geolocalisation filter is invalid', function () {
    var
      invalidFilter = {
        location: {
          top: -2.939744,
          bottom: 1.180129,
          right: 51.143628
        },
        distance: 123
      };

    return should(methods.geoPolygon(roomId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No point list found' });
  });

  it('should return a rejected promise if the location filter parameter is missing', function () {
    var
      invalidFilter = {
        distance: 123
      };

    return should(methods.geoPolygon(roomId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No point list found' });
  });

  it('should handle the not parameter', function () {
    return methods.geoPolygon(roomId, index, collection, filterExact, true);
  });

  it('should return a rejected promise if the location filter parameter does not contain a points member', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        }
      };

    return should(methods.geoPolygon(roomId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No point list found' });
  });

  it('should return a rejected promise if the location filter parameter contain a points filter with less than 3 points', function () {
    var
      invalidFilter = {
        location: {
          points: [
            [-1,1],
            [-1,-1]
          ]
        }
      };

    return should(methods.geoPolygon(roomId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'A polygon must have at least 3 points' });
  });

  it('should return a rejected promise if the location filter parameter contain a points filter wich is not an array', function () {
    var
      invalidFilter = {
        location: {
          points: { foo: 'bar' }
        }
      };

    return should(methods.geoPolygon(roomId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'A polygon must be in array format' });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    return Methods.__with__({
      addToFiltersTree: function () { return new InternalError('rejected'); }
    })(function () {
      return should(methods.geoPolygon(roomId, index, collection, filterExact)).be.rejectedWith('rejected');
    });
  });
});