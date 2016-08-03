var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test geoDistance method', () => {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'test',
    collection = 'collection',
    filterExact = {
      location: {
        lat: 0,
        lon: 1
      },
      distance: 111318
    },
    filterOK = {
      location: {
        lat: 0,
        lon: 1
      },
      distance: 111320
    },
    filterTooFar = {
      location: {
        lat: 0,
        lon: 1
      },
      distance: 111317
    },
    filterOkHumanReadable = {
      location: {
        lat: 0,
        lon: 1
      },
      distance: '365 219,816 Ft'
    },
    locationgeoDistancekpbxyzbpv111318 = md5('locationgeoDistancekpbxyzbpv111318'),
    locationgeoDistancekpbxyzbpv111320 = md5('locationgeoDistancekpbxyzbpv111320'),
    locationgeoDistancekpbxyzbpv111317 = md5('locationgeoDistancekpbxyzbpv111317'),
    fieldLocation = md5('location');

  beforeEach(() => {
    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.geoDistance(filterId, index, collection, filterExact)
      .then(() => methods.geoDistance(filterId, index, collection, filterOK))
      .then(() => methods.geoDistance(filterId, index, collection, filterTooFar))
      .then(() => methods.geoDistance(filterId, index, collection, filterOkHumanReadable));
  });

  it('should construct the filterTree object for the correct attribute', () => {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation]).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', () => {
    // Coordinates are geohashed to encode the function name
    // because we have many times the same coord in filters,
    // we must have only four functions

    should(Object.keys(methods.filters.filtersTree[index][collection].fields[fieldLocation])).have.length(4);
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111318]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111320]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111317]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][md5('locationgeoDistancekpbxyzbpv111318.9999168')]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', () => {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111318].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111320].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111317].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][md5('locationgeoDistancekpbxyzbpv111318.9999168')].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct geodistance arguments', () => {
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111318].args).match({
      operator: 'geoDistance',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, distance: 111318 }
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111320].args).match({
      operator: 'geoDistance',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, distance: 111320 }
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistancekpbxyzbpv111317].args).match({
      operator: 'geoDistance',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, distance: 111317 }
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][md5('locationgeoDistancekpbxyzbpv111318.9999168')].args).match({
      operator: 'geoDistance',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, distance: 111318.9999168 }
    });
  });

  it('should return a rejected promise if an empty filter is provided', () => {
    return should(methods.geoDistance('foo', index, 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
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

    return should(methods.geoDistance(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse coordinates' });
  });

  it('should handle correctly the case when distance is the first filter member', () => {
    var
      distanceFirstFilter = {
        distance: 111318,
        location: {
          lat: 0,
          lon: 1
        }
      };

    return methods.geoDistance(filterId, index, collection, distanceFirstFilter);
  });

  it('should handle correctly the case when the location is noted with the underscore notation', () => {
    /* jshint camelcase: false */
    var
      underscoreFilter = {
        distance: 111318,
        location: {
          lat_lon: {
            lat: 0,
            lon: 1
          }
        }
      };
    /* jshint camelcase: true */

    return methods.geoDistance(filterId, index, collection, underscoreFilter);
  });

  it('should return a rejected promise if the distance filter parameter is missing', () => {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        }
      };

    return should(methods.geoDistance(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No distance given' });
  });

  it('should return a rejected promise if the location filter parameter is missing', () => {
    var
      invalidFilter = {
        distance: 123
      };

    return should(methods.geoDistance(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No location field given' });
  });

  it('should handle the not parameter', () => {
    var
      notFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        distance: 123
      };

    return methods.geoDistance(filterId, index, collection, notFilter, true);
  });

  it('should return a rejected promise if the distance filter parameter is missing', () => {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        distance: 'bad bad bad'
      };

    return should(methods.geoDistance(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse the distance filter parameter' });
  });

  it('should return a rejected promise if addToFiltersTree fails', () => {
    methods.filters.add = () => { return new InternalError('rejected'); };
    return should(methods.geoDistance(filterId, index, collection, filterOK)).be.rejectedWith('rejected');
  });
});