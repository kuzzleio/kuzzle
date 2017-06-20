'use strict';

const
  should = require('should'),
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.notrange', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 100}}}})
        .then(subscription => {
          let
            subfilter = dsl.storage.filters[subscription.id].subfilters[0],
            store = dsl.storage.foPairs.index.collection.notrange;

          should(store).be.instanceOf(FieldOperand);
          should(store.keys.array).match(['foo']);
          should(store.fields.foo.count).be.eql(1);
          should(store.fields.foo.subfilters)
            .be.an.Object()
            .have.property(subfilter.id);

          const conditionId = Object.keys(store.fields.foo.subfilters[subfilter.id])[0];
          should(store.fields.foo.subfilters[subfilter.id][conditionId].subfilter).match(subfilter);
          should(store.fields.foo.subfilters[subfilter.id][conditionId].low).approximately(42, 1e-9);
          should(store.fields.foo.subfilters[subfilter.id][conditionId].high).approximately(100, 1e-9);
          should(store.fields.foo.tree).be.an.Object();
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let sf1;

      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 100}}}})
        .then(subscription => {
          sf1 = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {
            and: [
              {not: {range: {foo: {gte: 10, lte: 78}}}},
              {not: {range: {foo: {gt: 0, lt: 50}}}}
            ]
          });
        })
        .then(subscription => {
          let
            sf2 = dsl.storage.filters[subscription.id].subfilters[0],
            store = dsl.storage.foPairs.index.collection.notrange;

          should(store).be.instanceOf(FieldOperand);
          should(store.keys.array).match(['foo']);
          should(store.fields.foo.count).be.eql(3);

          let conditionId = Object.keys(store.fields.foo.subfilters[sf1.id])[0];

          should(Object.keys(store.fields.foo.subfilters[sf1.id]).length)
            .eql(1);
          should(store.fields.foo.subfilters[sf1.id][conditionId].subfilter).match(sf1);
          should(store.fields.foo.subfilters[sf1.id][conditionId].low)
            .be.exactly(42);
          should(store.fields.foo.subfilters[sf1.id][conditionId].high)
            .be.exactly(100);

          should(Object.keys(store.fields.foo.subfilters[sf2.id]).length)
            .be.eql(2);

          conditionId = Object.keys(store.fields.foo.subfilters[sf2.id])[0];
          should(store.fields.foo.subfilters[sf2.id][conditionId].subfilter).match(sf2);
          should(store.fields.foo.subfilters[sf2.id][conditionId].low)
            .be.approximately(10, 1e-9);
          should(store.fields.foo.subfilters[sf2.id][conditionId].high)
            .be.approximately(78, 1e-9);

          conditionId = Object.keys(store.fields.foo.subfilters[sf2.id])[1];
          should(store.fields.foo.subfilters[sf2.id][conditionId].subfilter).match(sf2);
          should(store.fields.foo.subfilters[sf2.id][conditionId].low)
            .be.exactly(0);
          should(store.fields.foo.subfilters[sf2.id][conditionId].high)
            .be.exactly(50);

          should(store.fields.foo.tree).be.an.Object();
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with its value outside the range', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: -89});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a document with its value exactly on the lower exclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 42});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a document with its value exactly on the upper exclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 110});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match a document with its value exactly on the lower inclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gte: 42, lt: 110}}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 42})).be.an.Array().and.be.empty();
        });
    });

    it('should not match a document with its value exactly on the upper inclusive boundary', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lte: 110}}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 110})).be.an.Array().and.be.empty();
        });
    });

    it('should match a document with only a lower boundary range', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gt: -10}}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: -25});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a document with only an upper boundary range', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {lt: -10}}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 105});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should return all notrange filters attached to the field if the document does not contain the registered field', () => {
      return dsl.register('i', 'c', {not: {range: {foo: {lt: -10}}}})
        .then(() => dsl.register('i', 'c', {not: {range: {foo: {gt: 42}}}}))
        .then(() => dsl.register('i', 'c', {not: {range: {foo: {gte: -20, lt: 9999999}}}}))
        .then(() => {
          should(dsl.test('i', 'c', {bar: 105}))
            .be.an.Array()
            .length(3);
        });
    });

    it('should return all notrange filters attached to the field if the document searched field is not a number', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {lt: -10}}}})
        .then(response => {
          should(dsl.test('index', 'collection', {bar: 'baz'}))
            .be.eql([response.id]);
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {not: {range: {foo: {gte: 42, lte: 110}}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {not: {range: {foo: {gte: 42, lte: 110}}}})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}});
        })
        .then(subscription => {
          multiSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.notrange).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notrange.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.count).eql(1);

          const conditionId = Object.keys(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id])[0];
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id][conditionId].subfilter).match(multiSubfilter);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id][conditionId].low).eql(42);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id][conditionId].high).eql(110);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[idToRemove]).be.undefined();
        });
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {not: {range: {bar: {gt: 42, lt: 110}}}})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {not: {range: {foo: {gt: 42, lt: 110}}}});
        })
        .then(subscription => {
          multiSubfilter = dsl.storage.filters[subscription.id].subfilters[0];
          should(dsl.storage.foPairs.index.collection.notrange.keys.array).match(['bar', 'foo']);
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.notrange).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notrange.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.count).eql(1);

          const conditionId = Object.keys(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id])[0];
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id][conditionId].subfilter).match(multiSubfilter);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id][conditionId].low).eql(42);
          should(dsl.storage.foPairs.index.collection.notrange.fields.foo.subfilters[multiSubfilter.id][conditionId].high).eql(110);
          should(dsl.storage.foPairs.index.collection.notrange.fields.bar).be.undefined();
        });
    });
  });
});
