'use strict';

const
  should = require('should'),
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.everything', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should validate an empty filter', () => {
      return should(dsl.validate({})).be.fulfilledWith(true);
    });

    it('should validate a null filter', () => {
      return should(dsl.validate(null)).be.fulfilledWith(true);
    });

    it('should validate an undefined filter', () => {
      return should(dsl.validate(null)).be.fulfilledWith(true);
    });
  });

  describe('#storage', () => {
    it('should register an empty filter correctly', () => {
      return dsl.register('index', 'collection', {})
        .then(subscription => {
          const storeEntry = dsl.storage.foPairs.index.collection.everything;

          should(storeEntry)
            .be.instanceof(FieldOperand);
          should(storeEntry.fields.all)
            .eql([dsl.storage.filters[subscription.id].subfilters[0]]);
        });
    });
  });

  describe('#matching', () => {
    it('should match as long as a document is in the right index and collection', () => {
      return dsl.register('index', 'collection', {})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: 'bar'});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'bar'})).be.an.Array().and.be.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'bar'})).be.an.Array().and.be.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should remove the whole f-o pair on delete', () => {
      return dsl.register('index', 'collection', {})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });
  });
});
