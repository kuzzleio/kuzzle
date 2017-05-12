'use strict';

const
  should = require('should').noConflict(),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  DSL = require('../../../lib/api/dsl');

describe('DSL API', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#prototypes', () => {
    it('should expose the expected methods', () => {
      should(dsl.validate).be.a.Function();
      should(dsl.register).be.a.Function();
      should(dsl.exists).be.a.Function();
      should(dsl.getFilterIds).be.a.Function();
      should(dsl.test).be.a.Function();
      should(dsl.remove).be.a.Function();
    });
  });

  describe('#validate', () => {
    it('should resolve to "true" if a filter is valid', () => {
      return should(dsl.validate({equals: {foo: 'bar'}})).be.fulfilledWith(true);
    });

    it('should resolve to a BadRequestError if a filter is not valid', () => {
      return should(dsl.validate({foo: 'bar'})).be.rejectedWith(BadRequestError);
    });
  });

  describe('#register', () => {
    it('should resolve to a BadRequestError if a filter is not valid', () => {
      return should(dsl.register('i', 'c', {foo: 'bar'})).be.rejectedWith(BadRequestError);
    });

    it('should resolve to a cluster diff object if the registration succeeds', () => {
      return dsl.register('i', 'c', {not: {and: [{exists: {field: 'bar'}}, {equals: {foo: 'bar'}}]}})
        .then(result => {
          should(result).be.an.Object();
          should(result.diff).be.an.Object().and.match({
            ftAdd: { i: 'i',
              c: 'c',
              f: [
                [ { exists: { field: 'bar' }, not: true } ],
                [ { equals: { foo: 'bar' }, not: true } ]
              ]
            }
          });

          should(result.id).be.a.String();
        });
    });

    it('should resolve to a "no diff" object if the room already exists', () => {
      let id;

      return dsl.register('i', 'c', {not: {and: [{exists: {field: 'bar'}}, {equals: {foo: 'bar'}}]}})
        .then(result => {
          id = result.id;

          return dsl.register('i', 'c', {
            or: [
              {not: { exists: { field: 'bar' }}},
              {not: { equals: { foo: 'bar' }}}
            ]
          });
        })
        .then(result => {
          let bool = {
            bool: {
              should_not: [
                {exists: { field: 'bar' }},
                {equals: { foo: 'bar' }}
              ]
            }
          };

          should(result.diff).be.false();
          should(result.id).be.eql(id);

          return dsl.register('i', 'c', bool);
        })
        .then(result => {
          should(result.diff).be.false();
          should(result.id).be.eql(id);
        });
    });

    it('should not recreate an already existing subfilter', () => {
      let ids = [];

      return dsl.register('i', 'c', {or: [{equals: {foo: 'bar'}}, {exists: {field: 'bar'}}]})
        .then(subscription => {
          ids.push(subscription.id);
          return dsl.register('i', 'c', {equals: {foo: 'bar'}});
        })
        .then(subscription => {
          let sfs = dsl.storage.filters[subscription.id].subfilters;

          ids.push(subscription.id);
          should(sfs).be.an.Array();
          should(sfs.length).be.eql(1);
          should(dsl.storage.subfilters.i.c[sfs[0].id].filters.map(f => f.id).sort()).match(ids.sort());
        });
    });
  });

  describe('#exists', () => {
    it('should return true if a filter exists on the provided index and collection', () => {
      return dsl.register('i', 'c', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.exists('i', 'c')).be.true();
        });
    });

    it('should return false if no filter exists on a provided collection', () => {
      return dsl.register('i', 'c', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.exists('i', 'foo')).be.false();
        });
    });

    it('should return false if no filter exists on a provided index', () => {
      return dsl.register('i', 'c', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.exists('foo', 'c')).be.false();
        });
    });
  });

  describe('#getFilterIds', () => {
    it('should return an empty array if no filter exist on the provided index and collection', () => {
      return dsl.register('i', 'c', {equals: {foo: 'bar'}})
        .then(() => {
          should(dsl.getFilterIds('foo', 'bar')).be.an.Array().and.be.empty();
        });
    });

    it('should return the list of registered filter IDs on the provided index and collection', () => {
      let ids = [];
      return dsl.register('i', 'c', {equals: {foo: 'bar'}})
        .then(result => {
          ids.push(result.id);
          return dsl.register('i', 'c', {exists: {field: 'foo'}});
        })
        .then(result => {
          ids.push(result.id);
          should(dsl.getFilterIds('i', 'c').sort()).match(ids.sort());
        });
    });
  });

  describe('#test', () => {
    /*
     we only check the special case of no registered filter on the provided
     index and collection, as all other checks are performed in
     test/api/dsl/keywords unit tests files
     */
    it('should return an empty array if there is no filter registered on an index or collection', () => {
      should(dsl.test('i', 'c', {foo: 'bar'})).be.an.Array().and.be.empty();
    });
  });

  describe('#remove', () => {
    it('should reject if the filter ID does not exist', () => {
      return should(dsl.remove('foo')).be.rejectedWith(NotFoundError);
    });

    it('should unsubscribe a filter from a multi-filter subfilter', () => {
      let
        ids = [],
        sf;

      return dsl.register('i', 'c', {or: [{equals: {foo: 'bar'}}, {exists: {field: 'bar'}}]})
        .then(subscription => {
          ids.push(subscription.id);
          return dsl.register('i', 'c', {equals: {foo: 'bar'}});
        })
        .then(subscription => {
          let sfs = dsl.storage.filters[subscription.id].subfilters;

          ids.push(subscription.id);
          should(sfs).be.an.Array();
          should(sfs.length).be.eql(1);
          should(sfs[0].filters.length).be.eql(2);
          should(sfs[0].filters.map(f => f.id).sort()).match(Array.from(ids).sort());

          sf = sfs[0];
          return dsl.remove(subscription.id);
        })
        .then(() => {
          should(sf.filters.length).be.eql(1);
          should(dsl.storage.subfilters.i.c[sf.id].filters.map(f => f.id)).match([ids[0]]);
        });
    });
  });
});
