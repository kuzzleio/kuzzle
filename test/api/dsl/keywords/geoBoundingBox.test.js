'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.geoBoundingBox', () => {
  let
    dsl,
    standardize,
    bbox = {
      topLeft: { lat: 43.6331979, lon: 3.8433703 },
      bottomRight: { lat: 43.5810609, lon: 3.9282093 }
    },
    bboxStandardized = {
      geospatial: {
        geoBoundingBox: {
          foo: {
            bottom: 43.5810609,
            left: 3.8433703,
            top: 43.6331979,
            right: 3.9282093
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
      return should(standardize({geoBoundingBox: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with multiple field attributes', () => {
      return should(standardize({geoBoundingBox: {foo: bbox, bar: bbox}})).be.rejectedWith(BadRequestError);
    });

    it('should validate a {top, left, bottom, right} bbox', () => {
      let box = {
        bottom: 43.5810609,
        left: 3.8433703,
        top: 43.6331979,
        right: 3.9282093
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {topLeft: {lat, lon}, bottomRight: {lat, lon}} bbox', () => {
      return should(standardize({geoBoundingBox: {foo: bbox}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {top_left: {lat, lon}, bottom_right: {lat, lon}} bbox', () => {
      let box = {
        top_left: { lat: 43.6331979, lon: 3.8433703 },
        bottom_right: { lat: 43.5810609, lon: 3.9282093 }
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {topLeft: [lat, lon], bottomRight: [lat, lon]} bbox', () => {
      let box = {
        topLeft: [43.6331979, 3.8433703],
        bottomRight: [43.5810609, 3.9282093]
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {top_left: [lat, lon], bottom_right: [lat, lon]} bbox', () => {
      let box = {
        top_left: [43.6331979, 3.8433703],
        bottom_right: [43.5810609, 3.9282093]
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {topLeft: "lat, lon", bottomRight: "lat, lon" bbox', () => {
      let box = {
        topLeft: '43.6331979, 3.8433703',
        bottomRight: '43.5810609, 3.9282093'
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {top_left: "lat, lon", bottom_right: "lat, lon" bbox', () => {
      let box = {
        top_left: '43.6331979, 3.8433703',
        bottom_right: '43.5810609, 3.9282093'
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.fulfilledWith(bboxStandardized);
    });

    it('should validate a {topLeft: "geohash", bottomRight: "geohash"} bbox', (done) => {
      standardize({geoBoundingBox: {foo: {topLeft: 'spf8prntv18e', bottomRight: 'spdzcmsqjft4'}}})
        .then(result => {
          let box = bboxStandardized.geospatial.geoBoundingBox.foo;

          should(result).be.an.Object();
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoBoundingBox).be.an.Object();
          should(result.geospatial.geoBoundingBox.foo).be.an.Object();
          should(result.geospatial.geoBoundingBox.foo.top).be.approximately(box.top, 10e-7);
          should(result.geospatial.geoBoundingBox.foo.bottom).be.approximately(box.bottom, 10e-7);
          should(result.geospatial.geoBoundingBox.foo.left).be.approximately(box.left, 10e-7);
          should(result.geospatial.geoBoundingBox.foo.right).be.approximately(box.right, 10e-7);
          done();
        })
        .catch(e => done(e));
    });

    it('should validate a {top_left: "geohash", bottom_right: "geohash"} bbox', (done) => {
      standardize({geoBoundingBox: {foo: {top_left: 'spf8prntv18e', bottom_right: 'spdzcmsqjft4'}}})
        .then(result => {
          let box = bboxStandardized.geospatial.geoBoundingBox.foo;

          should(result).be.an.Object();
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoBoundingBox).be.an.Object();
          should(result.geospatial.geoBoundingBox.foo).be.an.Object();
          should(result.geospatial.geoBoundingBox.foo.top).be.approximately(box.top, 10e-7);
          should(result.geospatial.geoBoundingBox.foo.bottom).be.approximately(box.bottom, 10e-7);
          should(result.geospatial.geoBoundingBox.foo.left).be.approximately(box.left, 10e-7);
          should(result.geospatial.geoBoundingBox.foo.right).be.approximately(box.right, 10e-7);
          done();
        })
        .catch(e => done(e));
    });

    it('should reject an unrecognized bbox format', () => {
      let box = {
        top_left: '40.73 / -74.1',
        bottom_right: '40.01 / -71.12'
      };

      return should(standardize({geoBoundingBox: {foo: box}})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#storage', () => {
    it('should store a single geoBoundingBox correctly', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(subscription => {
          let subfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.geospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[subfilter.conditions[0].id]).match([subfilter]);
        });
    });

    it('should add a subfilter to an already existing condition', () => {
      let sf1;
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(subscription => {
          sf1 = dsl.storage.filters[subscription.id].subfilters[0];
          return dsl.register('index', 'collection', {and: [{geoBoundingBox: {foo: bbox}}, {equals: {foo: 'bar'}}]});
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

      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(subscription => {
          sf1 = dsl.storage.filters[subscription.id].subfilters[0];
          cond1 = sf1.conditions[0].id;
          return dsl.register('index', 'collection', {geoBoundingBox: {foo: {topLeft: 'dr5r9ydj2y73', bottomRight: 'drj7teegpus6'}}});
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
    it('should match a point inside the bbox', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {latLon: [43.6073913, 3.9109057]}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a point exactly on a bbox corner', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: bbox.topLeft});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a point on one of the bbox border', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {lat: bbox.topLeft.lat, lon: 3.9}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if a point is outside the bbox', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(() => {
          var result = dsl.test('index', 'collection', {foo: {lat: bbox.topLeft.lat + 10e-6, lon: 3.9}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document does not contain a geopoint', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(() => {
          var result = dsl.test('index', 'collection', {bar: {lat: bbox.topLeft.lat + 10e-6, lon: 3.9}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      return dsl.register('index', 'collection', {geoBoundingBox: {foo: bbox}})
        .then(() => {
          var result = dsl.test('index', 'collection', {foo: '43.6331979 / 3.8433703'});

          should(result).be.an.Array().and.be.empty();
        });
    });
  });
});
