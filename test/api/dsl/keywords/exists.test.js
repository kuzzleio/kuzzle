var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.exists', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({exists: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(dsl.validate({exists: {field: 'foo', bar: 'bar'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with array argument', () => {
      return should(dsl.validate({exists: {field: ['bar']}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with number argument', () => {
      return should(dsl.validate({exists: {field: 42}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with object argument', () => {
      return should(dsl.validate({exists: {field: {}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with undefined argument', () => {
      return should(dsl.validate({exists: {field: undefined}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with null argument', () => {
      return should(dsl.validate({exists: {field: null}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with boolean argument', () => {
      return should(dsl.validate({exists: {field: true}})).be.rejectedWith(BadRequestError);
    });

    it('should validate filters with a string argument', () => {
      return should(dsl.validate({exists: {field: 'bar'}})).be.fulfilledWith(true);
    });

    it('should reject filters with an empty string argument', () => {
      return should(dsl.validate({exists: {field: ''}})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      return should(dsl.transformer.standardizer.standardize({exists: {field: 'bar'}})).be.fulfilledWith({exists: {field: 'bar'}});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => {
          let subfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.exists).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.exists.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.exists.fields.foo).match([subfilter]);
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let barSubfilter;

      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => {
          barSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {and: [{equals: {foo: 'qux'}}, {exists: {field: 'foo'}}]});
        })
        .then(subscription => {
          let quxSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          should(dsl.storage.foPairs.index.collection.exists).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.exists.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.exists.fields.foo).match([barSubfilter, quxSubfilter]);
        });
    });
  });

  describe('#matching', () => {
    it('should match a document with the subscribed field', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 'bar'});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document does not contain the searched field', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(() => {
          should(dsl.test('index', 'collection', {fo: 'bar'})).be.an.Array().and.empty();
          should(dsl.test('index', 'collection', {fooo: 'baz'})).be.an.Array().and.empty();
        });
    });

    it('should match if the document contains an explicitly undefined field', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: undefined});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo.bar.baz'}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'qux'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        multiSubfilter;

      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {and: [{equals: {foo: 'qux'}}, {exists: {field: 'foo'}}]});
        })
        .then(subscription => {
          multiSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.exists).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.exists.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.exists.fields.foo).match([multiSubfilter]);
        });
    });

    it('should remove a field from the list if its last subfilter is removed', () => {
      let
        fooSubfilter;

      return dsl.register('index', 'collection', {exists: {field: 'foo'}})
        .then(subscription => {
          fooSubfilter = dsl.storage.filters[subscription.id].subfilters[0];

          return dsl.register('index', 'collection', {exists: {field: 'bar'}});
        })
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs.index.collection.exists).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.exists.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.exists.fields.foo).match([fooSubfilter]);
          should(dsl.storage.foPairs.index.collection.exists.fields.bar).be.undefined();
        });
    });
  });
});
