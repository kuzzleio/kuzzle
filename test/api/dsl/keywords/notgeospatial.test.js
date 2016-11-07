var
  should = require('should'),
  SortedArray = require('sorted-array'),
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  NotGeospatialCondition = require('../../../../lib/api/dsl/storage/objects/notGeospatialCondition'),
  DSL = require('../../../../lib/api/dsl');

/**
 * Tests not geoBoundingBox, not geoDistance, not geoDistanceRange
 * and not geoPolygon keywords
 *
 * Does not check filter validation nor standardization as these parts
 * are already tested in the normal keyword unit tests
 */

describe('DSL.keyword.notgeospatial', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should store a single geospatial keyword correctly', () => {
      return dsl.register('index', 'collection', {not: {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1000m'}}})
        .then(subscription => {
          let condition = new NotGeospatialCondition(
            dsl.storage.filters[subscription.id].subfilters[0].conditions[0].id,
            dsl.storage.filters[subscription.id].subfilters[0]
          );

          should(dsl.storage.foPairs.index.collection.notgeospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notgeospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notgeospatial.custom.index).be.an.Object();
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids).be.instanceOf(SortedArray);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array.length).be.eql(1);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array[0]).instanceOf(NotGeospatialCondition);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array[0]).match(condition);
        });
    });

    it('should add another condition to an already tested field', () => {
      let cond1, cond2;

      return dsl.register('index', 'collection', {not: {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1000m'}}})
        .then(subscription => {
          cond1 = new NotGeospatialCondition(
            dsl.storage.filters[subscription.id].subfilters[0].conditions[0].id,
            dsl.storage.filters[subscription.id].subfilters[0]
          );

          return dsl.register('index', 'collection', {not: {geoBoundingBox: {foo: {top: 13, left: 0, right: 42, bottom: -14}}}});
        })
        .then(subscription => {
          let conditions;

          cond2 = new NotGeospatialCondition(
            dsl.storage.filters[subscription.id].subfilters[0].conditions[0].id,
            dsl.storage.filters[subscription.id].subfilters[0]
          );

          conditions = cond1.id < cond2.id ? [cond1, cond2] : [cond2, cond1];

          should(dsl.storage.foPairs.index.collection.notgeospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notgeospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notgeospatial.custom.index).be.an.Object();
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids).be.instanceOf(SortedArray);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array.length).be.eql(2);

          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array[0]).instanceOf(NotGeospatialCondition);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array[1]).instanceOf(NotGeospatialCondition);

          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array).match(conditions);
        });
    });

    it('should add another subfilter to an already tested shape', () => {
      let
        filter = {not: {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1000m'}}},
        condition;

      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          condition = new NotGeospatialCondition(
            dsl.storage.filters[subscription.id].subfilters[0].conditions[0].id,
            dsl.storage.filters[subscription.id].subfilters[0]
          );

          return dsl.register('index', 'collection', {and: [{equals: {bar: 'baz'}}, filter]});
        })
        .then(subscription => {
          condition.subfilters.push(dsl.storage.filters[subscription.id].subfilters[0]);

          should(dsl.storage.foPairs.index.collection.notgeospatial).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notgeospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notgeospatial.custom.index).be.an.Object();
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids).be.instanceOf(SortedArray);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array.length).be.eql(1);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array[0]).instanceOf(NotGeospatialCondition);
          should(dsl.storage.foPairs.index.collection.notgeospatial.fields.foo.ids.array[0]).match(condition);
        });
    });
  });

  describe('#match', () => {
    let
      bboxId,
      distanceId,
      distanceRangeId,
      polygonId;

    beforeEach(() => {
      return dsl.register('index', 'collection', {not: {geoBoundingBox: {foo: {bottom: 43.5810609, left: 3.8433703, top: 43.6331979, right: 3.9282093}}}})
        .then(subscription => {
          bboxId = subscription.id;
          return dsl.register('index', 'collection', {
            not: {
              geoDistance: {
                foo: {
                  lat: 43.5764455,
                  lon: 3.948711
                },
                distance: '2000m'
              }
            }
          });
        })
        .then(subscription => {
          distanceId = subscription.id;
          return dsl.register('index', 'collection', {
            not: {
              geoDistanceRange: {
                foo: {
                  lat: 43.6073913,
                  lon: 3.9109057
                },
                from: '10m',
                to: '1500m'
              }
            }
          });
        })
        .then(subscription => {
          distanceRangeId = subscription.id;
          return dsl.register('index', 'collection', {
            not: {
              geoPolygon: {
                foo: {
                  points: [
                    {latLon: [43.6021299, 3.8989713]},
                    {latLon: [43.6057389, 3.8968173]},
                    {latLon: [43.6092889, 3.8970423]},
                    {latLon: [43.6100359, 3.9040853]},
                    {latLon: [43.6069619, 3.9170343]},
                    {latLon: [43.6076479, 3.9230133]},
                    {latLon: [43.6038779, 3.9239153]},
                    {latLon: [43.6019189, 3.9152403]},
                    {latLon: [43.6036049, 3.9092313]}
                  ]
                }
              }
            }
          });
        })
        .then(subscription => {
          polygonId = subscription.id;
        });
    });

    it('should match shapes not containing the provided point', () => {
      let result = dsl.test('index', 'collection', {foo: {lat: 43.6073913, lon: 3.9109057}});
      should(result.sort()).match([distanceId, distanceRangeId].sort());
    });

    it('should return an empty array if the provided point is invalid', () => {
      should(dsl.test('index', 'collection', {foo: {lat: 'foo', lon: 'bar'}})).be.an.Array().and.be.empty();
    });

    it('should return an empty array if the document does not contain the registered field', () => {
      should(dsl.test('index', 'collection', {bar: {lat: 43.6073913, lon: 3.9109057}})).be.an.Array().and.be.empty();
    });

    it('should reject a shape if the point is right on its border', () => {
      let result = dsl.test('index', 'collection', {foo: {lat: 43.5810609, lon: 3.8433703}});
      should(result.sort()).match([distanceId, distanceRangeId, polygonId].sort());
    });
  });
});
