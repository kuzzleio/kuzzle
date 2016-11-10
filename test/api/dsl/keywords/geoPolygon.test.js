'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.geoPolygon', () => {
  let
    dsl,
    standardize,
    polygon = {
      points: [
        {lat: 43.6021299, lon: 3.8989713},
        {lat: 43.6057389, lon: 3.8968173},
        {lat: 43.6092889, lon: 3.8970423},
        {lat: 43.6100359, lon: 3.9040853},
        {lat: 43.6069619, lon: 3.9170343},
        {lat: 43.6076479, lon: 3.9230133},
        {lat: 43.6038779, lon: 3.9239153},
        {lat: 43.6019189, lon: 3.9152403},
        {lat: 43.6036049, lon: 3.9092313}
      ]
    },
    polygonStandardized = {
      geospatial: {
        geoPolygon: {
          foo: [
            [43.6021299, 3.8989713],
            [43.6057389, 3.8968173],
            [43.6092889, 3.8970423],
            [43.6100359, 3.9040853],
            [43.6069619, 3.9170343],
            [43.6076479, 3.9230133],
            [43.6038779, 3.9239153],
            [43.6019189, 3.9152403],
            [43.6036049, 3.9092313]
          ]
        }
      }
    };

  beforeEach(() => {
    dsl = new DSL();
    standardize = dsl.transformer.standardizer.standardize;
  });

  describe('#validation/standardization', () => {
    it('should reject an empty filter', () => {
      return should(standardize({geoPolygon: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with multiple field attributes', () => {
      return should(standardize({geoPolygon: {foo: polygon, bar: polygon}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter without a points field', () => {
      return should(standardize({geoPolygon: {foo: {bar: [[0, 0], [5, 5], [5, 0]]}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a filter with an empty points field', () => {
      return should(standardize({geoPolygon: {foo: {points: []}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a polygon with less than 3 points defined', () => {
      return should(standardize({geoPolygon: {foo: {points: [[0, 0], [5, 5]]}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a polygon with a non-array points field', () => {
      return should(standardize({geoPolygon: {foo: {points: 'foobar'}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject a polygon containing an invalid point format', () => {
      var p = polygon.points.slice();
      p.push('foobar');
      return should(standardize({geoPolygon: {foo: {points: p}}})).be.rejectedWith(BadRequestError);
    });

    it('should standardize all geopoint types in a single points array', (done) => {
      let points = {
        points: [
          {lat: 43.6021299, lon: 3.8989713},
          {latLon: [43.6057389, 3.8968173]},
          {latLon: {lat: 43.6092889, lon: 3.8970423}},
          {latLon: '43.6100359, 3.9040853'},
          {latLon: 'spfb14kkcwbk'},
          {lat_lon: [43.6076479, 3.9230133]},
          {lat_lon: {lat: 43.6038779, lon: 3.9239153}},
          {lat_lon: '43.6019189, 3.9152403'},
          {lat_lon: 'spfb0cy97tn4'}
        ]
      };

      standardize({geoPolygon: {foo: points}})
        .then(result => {
          should(result.geospatial).be.an.Object();
          should(result.geospatial.geoPolygon).be.an.Object();
          should(result.geospatial.geoPolygon.foo).be.an.Object();

          result.geospatial.geoPolygon.foo.forEach((p, i) => {
            should(p[0]).be.approximately(polygonStandardized.geospatial.geoPolygon.foo[i][0], 10e-6);
            should(p[1]).be.approximately(polygonStandardized.geospatial.geoPolygon.foo[i][1], 10e-6);
          });
          done();
        })
        .catch(e => done(e));
    });
  });

  describe('#storage', () => {
    it('should store a single geoPolygon correctly', () => {
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(subscription => {
          let subfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.geospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[subfilter.conditions[0].id]).match([subfilter]);
        });
    });

    it('should add a subfilter to an already existing condition', () => {
      let sf1;
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(subscription => {
          sf1 = dsl.storage.filters[subscription.id].subfilters[0];
          return dsl.register('index', 'collection', {and: [{geoPolygon: {foo: polygon}}, {equals: {foo: 'bar'}}]});
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

      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
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
    it('should match a point inside the polygon', () => {
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {latLon: [43.6073913, 3.9109057]}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a point exactly on a polygon corner', () => {
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {latLon: polygon.points[0]}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if a point is outside the bbox', () => {
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(() => {
          var result = dsl.test('index', 'collection', {foo: {lat: polygon.points[0][0] + 10e-6, lon: polygon.points[0][1] + 10e-6}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document does not contain a geopoint', () => {
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(() => {
          var result = dsl.test('index', 'collection', {bar: {latLon: polygon.points[0]}});

          should(result).be.an.Array().and.be.empty();
        });
    });

    it('should return an empty array if the document contain an invalid geopoint', () => {
      return dsl.register('index', 'collection', {geoPolygon: {foo: polygon}})
        .then(() => {
          var result = dsl.test('index', 'collection', {foo: '43.6331979 / 3.8433703'});

          should(result).be.an.Array().and.be.empty();
        });
    });
  });
});
