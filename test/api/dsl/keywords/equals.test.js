'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.equals', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({equals: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(dsl.validate({equals: {foo: 'foo', bar: 'bar'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with array argument', () => {
      return should(dsl.validate({equals: {foo: ['bar']}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with number argument', () => {
      return should(dsl.validate({equals: {foo: 42}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with object argument', () => {
      return should(dsl.validate({equals: {foo: {}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with undefined argument', () => {
      return should(dsl.validate({equals: {foo: undefined}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with null argument', () => {
      return should(dsl.validate({equals: {foo: null}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with boolean argument', () => {
      return should(dsl.validate({equals: {foo: true}})).be.rejectedWith(BadRequestError);
    });

    it('should validate filters with a string argument', () => {
      return should(dsl.validate({equals: {foo: 'bar'}})).be.fulfilledWith(true);
    });

    it('should validate filters with an empty string argument', () => {
      return should(dsl.validate({equals: {foo: ''}})).be.fulfilledWith(true);
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      return should(dsl.transformer.standardizer.standardize({equals: {foo: 'bar'}})).be.fulfilledWith({equals: {foo: 'bar'}});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          let subfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.equals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.bar).match([subfilter]);
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {equals: {foo: 'qux'}});
        })
        .then(subscription => {
          let quxSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.equals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.bar).match([barSubfilter]);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.qux).match([quxSubfilter]);
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {and: [{equals: {foo: 'qux'}}, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          let multiSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.equals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.bar).match([barSubfilter, multiSubfilter]);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.qux).match([multiSubfilter]);
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed keyword', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 'bar'});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a document on its provided id', () => {
      return dsl.register('index', 'collection', {equals: {_id: 'foo'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 'bar'}, 'foo');

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document contains the field with another value', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document contains another field with the registered value', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'collection', {qux: 'bar'})).be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {equals: {'foo.bar.baz': 'qux'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {and: [{equals: {foo: 'qux'}}, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          multiSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.equals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.bar).match([multiSubfilter]);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.qux).match([multiSubfilter]);
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      let
        idToRemove,
        barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {and: [{equals: {foo: 'qux'}}, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          idToRemove = subscription.id;
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.equals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.bar).match([barSubfilter]);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.qux).be.undefined();
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      let
        idToRemove,
        barSubfilter;

      return dsl.register('index', 'collection', {equals: {foo: 'bar'}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {equals: {baz: 'qux'}});
        })
        .then(subscription => {
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['baz', 'foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.baz.qux).be.an.Array().and.not.empty();
          idToRemove = subscription.id;
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.equals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.equals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.equals.fields.foo.bar).match([barSubfilter]);
          should(dsl.storage.foPairs.index.collection.equals.fields.baz).be.undefined();
        });
    });
  });
});
