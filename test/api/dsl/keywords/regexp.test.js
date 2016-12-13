'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  RegexpCondition = require('../../../../lib/api/dsl/storage/objects/regexpCondition'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.regexp', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({regexp: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with more than 1 field', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo'}, bar: {value: 'foo'}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with an empty field object', () => {
      return should(dsl.validate({regexp: {foo: {}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with other fields defined other than the accepted ones', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo', flags: 'ig', bar: 'qux'}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters if the "value" attribute is not defined', () => {
      return should(dsl.validate({regexp: {foo: {flags: 'ig'}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with a non-string "flags" attribute', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo', flags: 42}}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with an invalid regular expression value', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo(', flags: 'i'}}})).be.rejectedWith(BadRequestError);
    });

    it('should validate a well-formed regular expression filter w/ flags', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo', flags: 'i'}}})).be.fulfilledWith(true);
    });

    it('should validate a well-formed regular expression filter without flags', () => {
      return should(dsl.validate({regexp: {foo: {value: 'foo'}}})).be.fulfilledWith(true);
    });
  });

  describe('#standardization', () => {
    it('should return the same content, unchanged', () => {
      let filter = {regexp: {foo: {value: 'foo', flags: 'i'}}};
      return should(dsl.transformer.standardizer.standardize(filter)).be.fulfilledWith(filter);
    });
  });

  describe('#storage', () => {
    it('should store a single condition correctly', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: 'foo', flags: 'i'}}})
        .then(subscription => {
          let subfilter = new RegexpCondition('foo', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          should(dsl.storage.foPairs.index.collection.regexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array[0]).be.instanceOf(RegexpCondition);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array).match([subfilter]);
        });
    });

    it('should store multiple conditions on the same field correctly', () => {
      let cond1;

      return dsl.register('index', 'collection', {regexp: {foo: {value: 'foo', flags: 'i'}}})
        .then(subscription => {
          cond1 = new RegexpCondition('foo', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          return dsl.register('index', 'collection', {regexp: {foo: {value: 'bar'}}});
        })
        .then(subscription => {
          let
            cond2 = new RegexpCondition('bar', dsl.storage.filters[subscription.id].subfilters[0]),
            conditions = cond1.stringValue < cond2.stringValue ? [cond1, cond2] : [cond2, cond1];

          should(dsl.storage.foPairs.index.collection.regexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array).match(conditions);
        });
    });

    it('should store multiple subfilters on the same condition correctly', () => {
      let
        cond,
        filter = {regexp: {foo: {value: 'foo', flags: 'i'}}};

      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          cond = new RegexpCondition('foo', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          return dsl.register('index', 'collection', {and: [filter, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          cond.subfilters.push(dsl.storage.filters[subscription.id].subfilters[0]);

          should(dsl.storage.foPairs.index.collection.regexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array).match([cond]);
        });
    });
  });

  describe('#matching', () => {
    it('should match a document if its registered field matches the regexp', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 'FOOBAR'});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match a document if its registered field does not match the regexp', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'Saskatchewan'})).be.an.Array().and.be.empty();
        });
    });

    it('should not match if the document does not contain the registered field', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('index', 'collection', {bar: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {regexp: {'foo.bar.baz': {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'FOOBAR'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy the whole structure when removing the last item', () => {
      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });

    it('should remove a single subfilter from a multi-filter condition', () => {
      let
        filter = {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}},
        idToRemove,
        cond;

      return dsl.register('index', 'collection', filter)
        .then(subscription => {
          idToRemove = subscription.id;

          return dsl.register('index', 'collection', {and: [filter, {equals: {foo: 'bar'}}]});
        })
        .then(subscription => {
          cond = new RegexpCondition('^\\w{2}oba\\w$', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.regexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array).match([cond]);
        });
    });

    it('should remove a value from the list if its last subfilter is removed', () => {
      let
        idToRemove,
        cond;

      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          cond = new RegexpCondition('^\\w{2}oba\\w$', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          return dsl.register('index', 'collection', {regexp: {foo: {value: '^$'}}});
        })
        .then(subscription => {
          idToRemove = subscription.id;
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.regexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array).match([cond]);
        });
    });

    it('should remove a field from the list if its last value to test is removed', () => {
      let
        idToRemove,
        cond;

      return dsl.register('index', 'collection', {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}})
        .then(subscription => {
          cond = new RegexpCondition('^\\w{2}oba\\w$', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          return dsl.register('index', 'collection', {regexp: {bar: {value: '^\\w{2}oba\\w$', flags: 'i'}}});
        })
        .then(subscription => {
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['bar', 'foo']);
          idToRemove = subscription.id;
          return dsl.remove(idToRemove);
        })
        .then(() => {
          should(dsl.storage.foPairs.index.collection.regexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.regexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.regexp.fields.foo.expressions.array).match([cond]);
          should(dsl.storage.foPairs.index.collection.regexp.fields.bar).be.undefined();
        });
    });
  });
});
