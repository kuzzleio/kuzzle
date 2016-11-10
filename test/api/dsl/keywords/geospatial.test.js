'use strict';

var
  should = require('should'),
  DSL = require('../../../../lib/api/dsl');

/**
 * Mutualizes filter removal for all 4 geospatial keywords
 */
describe('DSL.keyword.geospatial', () => {
  let
    dsl,
    geoFilter = {
      geoBoundingBox: {
        foo: {
          bottom: 43.5810609,
          left: 3.8433703,
          top: 43.6331979,
          right: 3.9282093
        }
      }
    };

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', geoFilter)
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove the entire field if its last condition is removed', () => {
      return dsl.register('index', 'collection', {geoDistance: {bar: {lat: 13, lon: 42}, distance: '1km'}})
        .then(() => dsl.register('index', 'collection', geoFilter))
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['bar']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.bar).be.an.Object();
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo).be.undefined();
        });
    });

    it('should remove a single condition from a field if other conditions exist', () => {
      let cond, sf;

      return dsl.register('index', 'collection', {geoDistance: {foo: {lat: 13, lon: 42}, distance: '1km'}})
        .then(subscription => {
          sf = dsl.storage.filters[subscription.id].subfilters[0];
          cond = sf.conditions[0].id;
          return dsl.register('index', 'collection', geoFilter);
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[cond]).match([sf]);
        });
    });

    it('should remove a subfilter from a condition if other subfilters exist', () => {
      let cond, sf;

      return dsl.register('index', 'collection', geoFilter)
        .then(subscription => {
          sf = dsl.storage.filters[subscription.id].subfilters[0];
          cond = sf.conditions[0].id;

          return dsl.register('index', 'collection', {and: [geoFilter, {exists: {field: 'bar'}}]});
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs.index.collection.geospatial.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.geospatial.fields.foo[cond]).match([sf]);
        });
    });
  });
});