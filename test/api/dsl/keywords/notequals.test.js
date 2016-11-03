var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  NotEqualsCondition = require('../../../../lib/api/dsl/storage/objects/notEqualsCondition'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.notequals', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({not: {equals: {}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(dsl.validate({not: {equals: {foo: 'foo', bar: 'bar'}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with array argument', () => {
      return should(dsl.validate({not: {equals: {foo: ['bar']}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with number argument', () => {
      return should(dsl.validate({not: {equals: {foo: 42}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with object argument', () => {
      return should(dsl.validate({not: {equals: {foo: {}}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with undefined argument', () => {
      return should(dsl.validate({not: {equals: {foo: undefined}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with null argument', () => {
      return should(dsl.validate({not: {equals: {foo: null}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with boolean argument', () => {
      return should(dsl.validate({not: {equals: {foo: true}}})).be.rejectedWith(BadRequestError);
    });

    it('should validate filters with a string argument', () => {
      return should(dsl.validate({not: {equals: {foo: 'bar'}}})).be.fulfilledWith(true);
    });

    it('should validate filters with an empty string argument', () => {
      return should(dsl.validate({not: {equals: {foo: ''}}})).be.fulfilledWith(true);
    });

    it('should reject not operand with more than 1 keyword', () => {
      return should(dsl.validate({not: {equals: {foo: 'bar'}}, foo: 'bar'})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      return should(dsl.transformer.standardizer.standardize({not: {equals: {foo: 'bar'}}})).be.fulfilledWith({not: {equals: {foo: 'bar'}}});
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          let condition = new NotEqualsCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]);

          should(dsl.storage.foPairs.index.collection.notequals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array[0]).instanceOf(NotEqualsCondition);
          should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array[0]).match(condition);
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let barCondition;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          barCondition = new NotEqualsCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]);

          return dsl.register('index', 'collection', {not: {equals: {foo: 'qux'}}});
        })
        .then(subscription => {
          let quxCondition = new NotEqualsCondition('qux', dsl.storage.filters[subscription.id].subfilters[0]);

          should(dsl.storage.foPairs.index.collection.notequals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['foo']);

          for(let i = 0; i < dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array.length; i++) {
            should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array[i]).match([barCondition, quxCondition][i]);
          }
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let barCondition;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          barCondition = new NotEqualsCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]);

          return dsl.register('index', 'collection', {and: [{not: {equals: {foo: 'qux'}}}, {not: {equals: {foo: 'bar'}}}]});
        })
        .then(subscription => {
          let quxCondition = new NotEqualsCondition('qux', dsl.storage.filters[subscription.id].subfilters[0]);
          barCondition.subfilters.push(dsl.storage.filters[subscription.id].subfilters[0]);

          should(dsl.storage.foPairs.index.collection.notequals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['foo']);

          for(let i = 0; i < dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array.length; i++) {
            should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array[i]).match([barCondition, quxCondition][i]);
          }
        });
    });
  });

  describe('#matching', () => {
    it('should not match a document with the subscribed keyword', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'bar'})).be.an.Array().and.be.empty();
        });
    });

    it('should match if the document contains the field with another value', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          let result = dsl.test('index', 'collection', {foo: 'qux'});
          should(result).be.an.Array().and.not.empty();
          should(result).match([subscription.id]);
        });
    });

    it('should match if the document do not contain the registered field', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          let result = dsl.test('index', 'collection', {qux: 'bar'});
          should(result).be.an.Array().and.not.empty();
          should(result).match([subscription.id]);
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {not: {equals: {'foo.bar.baz': 'qux'}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'foobar'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        idToRemove,
        barCondition,
        quxCondition;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          idToRemove = subscription.id;
          return dsl.register('index', 'collection', {and: [{not: {equals: {foo: 'qux'}}}, {not: {equals: {foo: 'bar'}}}]});
        })
        .then(subscription => {
          barCondition = new NotEqualsCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]);
          quxCondition = new NotEqualsCondition('qux', dsl.storage.filters[subscription.id].subfilters[0]);
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.notequals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['foo']);

          for(let i = 0; i < dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array.length; i++) {
            should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array[i]).match([barCondition, quxCondition][i]);
          }
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      let
        idToRemove,
        barCondition;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          barCondition = new NotEqualsCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]);

          return dsl.register('index', 'collection', {and: [{not: {equals: {foo: 'qux'}}}, {not: {equals: {foo: 'bar'}}}]});
        })
        .then(subscription => {
          idToRemove = subscription.id;
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.notequals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array).match([barCondition]);
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      let
        barCondition;

      return dsl.register('index', 'collection', {not: {equals: {foo: 'bar'}}})
        .then(subscription => {
          barCondition = new NotEqualsCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]);

          return dsl.register('index', 'collection', {not: {equals: {baz: 'qux'}}});
        })
        .then(subscription => {
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['baz', 'foo']);
          should(dsl.storage.foPairs.index.collection.notequals.fields.baz.values.array).be.an.Array().and.not.empty();
          return dsl.remove(subscription.id);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.notequals).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notequals.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notequals.fields.foo.values.array).match([barCondition]);
          should(dsl.storage.foPairs.index.collection.notequals.fields.baz).be.undefined();
        });
    });
  });
});
