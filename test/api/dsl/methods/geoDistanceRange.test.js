var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test geoDistanceRange method', function () {
  var
    methods,
    filterId = 'fakeFilterId',
    index = 'test',
    collection = 'collection',
    filterOK = {
      location: {
        lat: 0,
        lon: 1
      },
      from: 111320,
      to: 111317
    },
    filterNOK = {
      location: {
        lat: 0,
        lon: 1
      },
      from: 1,
      to: 10
    },
    filterOkHumanReadable = {
      location: {
        lat: 0,
        lon: 1
      },
      from: '365 200 Ft',
      to: '365 220 Ft'
    },
    filterEqual = {
      location: {
        lat: 0,
        lon: 1
      },
      from: 111318,
      to: 111318
    },
    locationgeoDistanceRangekpbxyzbpv111320111317 = md5('locationgeoDistanceRangekpbxyzbpv111320111317'),
    locationgeoDistanceRangekpbxyzbpv110 = md5('locationgeoDistanceRangekpbxyzbpv110'),
    locationgeoDistanceRangekpbxyzbpv111318111318 = md5('locationgeoDistanceRangekpbxyzbpv111318111318'),
    fieldLocation = md5('location');

  beforeEach(function () {
    /** @type Methods */
    methods = new Methods(new Filters());
    return methods.geoDistanceRange(filterId, index, collection, filterOK)
      .then(() => methods.geoDistanceRange(filterId, index, collection, filterNOK))
      .then(() => methods.geoDistanceRange(filterId, index, collection, filterOkHumanReadable))
      .then(() => methods.geoDistanceRange(filterId, index, collection, filterEqual));
  });

  it('should construct the filterTree object for the correct attribute', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation]).not.be.empty();
  });
  it('should ', function () {
    should(methods.filters.filtersTree).not.be.empty();
    should(methods.filters.filtersTree[index]).not.be.empty();
    should(methods.filters.filtersTree[index][collection]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation]).not.be.empty();
  });

  it('should construct the filterTree with correct encoded function name', function () {
    // Coordinates are geohashed to encode the function name
    // because we have many times the same coord in filters,
    // we must have only four functions
    
    should(Object.keys(methods.filters.filtersTree[index][collection].fields[fieldLocation])).have.length(4);
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv111320111317]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv110]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv111318111318]).not.be.empty();
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][md5('locationgeoDistanceRangekpbxyzbpv111312.96111319.05600000001')]).not.be.empty();
  });

  it('should construct the filterTree with correct room list', function () {
    var ids;

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv111320111317].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv110].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv111318111318].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);

    ids = methods.filters.filtersTree[index][collection].fields[fieldLocation][md5('locationgeoDistanceRangekpbxyzbpv111312.96111319.05600000001')].ids;
    should(ids).be.an.Array();
    should(ids).have.length(1);
    should(ids[0]).be.exactly(filterId);
  });

  it('should construct the filterTree with correct functions geoDistanceRange', function () {
    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv111320111317].args).match({
      operator: 'geoDistanceRange',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, from: 111320, to: 111317 }
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv110].args).match({
      operator: 'geoDistanceRange',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, from: 1, to: 10 }
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][locationgeoDistanceRangekpbxyzbpv111318111318].args).match({
      operator: 'geoDistanceRange',
      not: undefined,
      field: 'location',
      value: { lat: 0, lon: 1, from: 111318, to: 111318 }
    });

    should(methods.filters.filtersTree[index][collection].fields[fieldLocation][md5('locationgeoDistanceRangekpbxyzbpv111312.96111319.05600000001')].args).match({
      operator: 'geoDistanceRange',
      not: undefined,
      field: 'location',
      value: {lat: 0, lon: 1, from: 111312.96, to: 111319.05600000001}
    });
  });


  it('should return a rejected promise if an empty filter is provided', function () {
    return should(methods.geoDistanceRange('foo', index, 'bar', {})).be.rejectedWith(BadRequestError, { message: 'Missing filter' });
  });

  it('should handle correctly the case when from and to comes first, before the location', function () {
    /* jshint camelcase: false */
    var
      underscoreFilter = {
        from: 123,
        to: 456,
        location: {
          lat_lon: {
            lat: 0,
            lon: 1
          }
        }
      };
    /* jshint camelcase: true */

    return methods.geoDistanceRange(filterId, index, collection, underscoreFilter);
  });

  it('should handle the not parameter', function () {
    var
      notFilter = {
        from: 123,
        to: 456,
        location: {
          lat: 0,
          lon: 1
        }
      };

    return methods.geoDistanceRange(filterId, index, collection, notFilter, true);
  });

  it('should return a rejected promise if the geolocalisation filter is invalid', function () {
    var
      invalidFilter = {
        location: {
          top: -2.939744,
          bottom: 1.180129,
          right: 51.143628
        },
        from: 123,
        to: 133
      };

    return should(methods.geoDistanceRange(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse coordinates' });
  });

  it('should return a rejected promise if the from filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        to: 123
      };

    return should(methods.geoDistanceRange(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No from parameter given' });
  });

  it('should return a rejected promise if the to filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        from: 123
      };

    return should(methods.geoDistanceRange(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No to parameter given' });
  });

  it('should return a rejected promise if the location filter parameter is missing', function () {
    var
      invalidFilter = {
        from: 123,
        to: 456
      };

    return should(methods.geoDistanceRange(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'No location field given' });
  });

  it('should return a rejected promise if the distance filter parameter is missing', function () {
    var
      invalidFilter = {
        location: {
          lon: -2.939744,
          lat: 1.180129
        },
        from: 'bad bad bad',
        to: 'bad bad bad'
      };

    return should(methods.geoDistanceRange(filterId, index, collection, invalidFilter)).be.rejectedWith(BadRequestError, { message: 'Unable to parse the distance filter parameter' });
  });

  it('should return a rejected promise if addToFiltersTree fails', function () {
    methods.filters.add = function () { return new InternalError('rejected'); };
    return should(methods.geoDistanceRange(filterId, index, collection, filterOK)).be.rejectedWith('rejected');
  });
});