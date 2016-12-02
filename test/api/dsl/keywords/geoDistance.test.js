'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.geoDistance', () => {
  let
    dsl,
    standardize,
    point = { lat: 43.6331979, lon: 3.8433703 },
    distanceStandardized = {
      geospatial: {
        geoDistance: {
          foo: {
            lat: 43.6331979,
            lon: 3.8433703,
            distance: 1000
          }
        }
      }
    };

  beforeEach(() => {
    dsl = new DSL();
    standardize = dsl.transformer.standardizer.standardize;
  });

  describe('#validation/standardization', () => {
    it('should reject an empty filter', () => {
      return should(standardize({geoDistance: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with multiple field attributes', () => {
      return should(standardize({geoDistance: {foo: point, bar: point, distance: '1km'}})).be.rejectedWith(BadRequestError);
    });

    it('should validate a {lat, lon} point', () => {
      return should(standardize({geoDistance: {foo: point, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: [lat, lon]} point', () => {
      let p = {latLon: [point.lat, point.lon]};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {lat_lon: [lat, lon]} point', () => {
      let p = {lat_lon: [point.lat, point.lon]};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: {lat: lat, lon: lon}} point', () => {
      let p = {latLon: {lat: point.lat, lon: point.lon}};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {lat_lon: {lat: lat, lon: lon}} point', () => {
      let p = {lat_lon: {lat: point.lat, lon: point.lon}};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: "lat, lon"} point', () => {
      let p = {latLon: `${point.lat}, ${point.lon}`};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {lat_lon: "lat, lon"} point', () => {
      let p = {lat_lon: `${point.lat}, ${point.lon}`};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.fulfilledWith(distanceStandardized);
    });

    it('should validate a {latLon: "geohash"} point', (done) => {
      let p = {latLon: 'spf8prntv18e'};

      standardize({geoDistance: {foo: p, distance: '1km'}})
        .then(result => {
          should(result).be.an.Object();
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoDistance).be.an.Object();
          should(result.geospatial.geoDistance.foo).be.an.Object();
          should(result.geospatial.geoDistance.foo.distance).be.eql(1000);
          should(result.geospatial.geoDistance.foo.lat).be.approximately(point.lat, 10e-7);
          should(result.geospatial.geoDistance.foo.lon).be.approximately(point.lon, 10e-7);
          done();
        })
        .catch(e => done(e));
    });

    it('should validate a {lat_lon: "geohash"} point', (done) => {
      let p = {lat_lon: 'spf8prntv18e'};

      standardize({geoDistance: {foo: p, distance: '1km'}})
        .then(result => {
          should(result).be.an.Object();
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoDistance).be.an.Object();
          should(result.geospatial.geoDistance.foo).be.an.Object();
          should(result.geospatial.geoDistance.foo.distance).be.eql(1000);
          should(result.geospatial.geoDistance.foo.lat).be.approximately(point.lat, 10e-7);
          should(result.geospatial.geoDistance.foo.lon).be.approximately(point.lon, 10e-7);
          done();
        })
        .catch(e => done(e));
    });

    it('should reject an unrecognized point format', () => {
      let p = {foo: 'bar'};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject an invalid latLon argument type', () => {
      let p = {latLon: 42};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject an invalid latLon argument string', () => {
      let p = {latLon: '[10, 10]'};
      return should(standardize({geoDistance: {foo: p, distance: '1km'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with a non-string distance value', () => {
      return should(standardize({geoDistance: {foo: point, distance: 42}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with incorrect distance value', () => {
      return should(standardize({geoDistance: {foo: point, distance: '1 ly'}})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#storage', () => {
    it('should store a single geoDistance correctly', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          let subfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.geospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[subfilter.conditions[0].id]).match([subfilter]);
        });
    });

    it('should add a subfilter to an already existing condition', () => {
      let sf1;
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          sf1 = dsl.storage.filters[subscription.id].subfilters[0];
          return dsl.register('index', 'collection', {and: [{geoDistance: {foo: point, distance: '1km'}}, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          let sf2 = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.geospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[sf1.conditions[0].id]).match([sf1, sf2]);
        });
    });

    it('should add another condition to an already existing field', () => {
      let cond1, sf1;

      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          sf1 = dsl.storage.filters[subscription.id].subfilters[0];
          cond1 = sf1.conditions[0].id;
          return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '10km'}});
        })
        .then(subscription => {
          let sf2 = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.geospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[cond1]).match([sf1]);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[sf2.conditions[0].id]).match([sf2]);
        });
    });
  });

  describe('#matching', () => {
    it('should match a point inside the circle', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {lat: 43.634, lon: 3.8432 }});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if a point is outside the circle', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(() => {
          var result = dsl.test('index', 'collection', {foo: {lat: point.lat, lon: 3.9}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document does not contain the searched geopoint', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(() => {
          var result = dsl.test('index', 'collection', {bar: point});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      return dsl.register('index', 'collection', {geoDistance: {foo: point, distance: '1km'}})
        .then(() => {
          var result = dsl.test('index', 'collection', {foo: '43.6331979 / 3.8433703'});

          should(result).be.an.Array().and.be.empty();
        });
    });
  });
});
