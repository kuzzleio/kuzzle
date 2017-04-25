'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  FieldOperand = require('../../../../lib/api/dsl/storage/objects/fieldOperand'),
  RegexpCondition = require('../../../../lib/api/dsl/storage/objects/regexpCondition'),
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.notregexp', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#storage', () => {
    it('should invoke regexp storage function', () => {
      let spy = sinon.spy(dsl.storage.storeOperand, 'regexp');

      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(subscription => {
          let subfilter = new RegexpCondition('^\\w{2}oba\\w$', dsl.storage.filters[subscription.id].subfilters[0], 'i');

          should(spy.called).be.true();

          should(dsl.storage.foPairs.index.collection.notregexp).be.instanceOf(FieldOperand);
          should(dsl.storage.foPairs.index.collection.notregexp.keys.array).match(['foo']);
          should(dsl.storage.foPairs.index.collection.notregexp.fields.foo.expressions.array[0]).be.instanceOf(RegexpCondition);
          should(dsl.storage.foPairs.index.collection.notregexp.fields.foo.expressions.array).match([subfilter]);
        });
    });
  });

  describe('#matching', () => {
    it('should not match a document if its registered field matches the regexp', () => {
      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'foobar'})).be.an.Array().and.be.empty();
        });
    });

    it('should match a document if its registered field does not match the regexp', () => {
      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(subscription => {
          const result = dsl.test('index', 'collection', {foo: 'bar'});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should match if the document does not contain the registered field', () => {
      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(() => {
          should(dsl.test('index', 'collection', {bar: 'qux'}))
            .be.an.Array()
            .and.have.length(1);
        });
    });

    it('should match a document with the subscribed nested keyword', () => {
      return dsl.register('index', 'collection', {not: {regexp: {'foo.bar.baz': {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: {bar: {baz: 'bar'}}});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document is in another index', () => {
      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(() => {
          should(dsl.test('foobar', 'collection', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });

    it('should not match if the document is in another collection', () => {
      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(() => {
          should(dsl.test('index', 'foobar', {foo: 'qux'})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should invoke regexp removal function', () => {
      let spy = sinon.spy(dsl.storage.removeOperand, 'regexp');

      return dsl.register('index', 'collection', {not: {regexp: {foo: {value: '^\\w{2}oba\\w$', flags: 'i'}}}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(spy.called).be.true();

          should(dsl.storage.foPairs).be.an.Object().and.be.empty();
        });
    });
  });
});
