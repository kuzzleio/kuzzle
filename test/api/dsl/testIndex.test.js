'use strict';

/**
 * These test cases are dedicated to check that subscriptions indexation,
 * removal and re-indexation are well-performed
 *
 * Indexes, stored in dsl.storage.testTables, are vital to track
 * how many conditions a subfilter has validated and, if a subfilter
 * validated all its conditions, what filters should be notified with
 * the tested document/message.
 */

const
  should = require('should'),
  sinon = require('sinon'),
  Promise = require('bluebird'),
  DSL = require('../../../lib/api/dsl');

describe('#TestTables (== DSL filter indexes)', () => {
  let dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#indexing', () => {
    it('should index new filters properly', () => {
      return dsl.register('i', 'c', {exists: {field: 'foo'}})
        .then(subscription => {
          let filter = dsl.storage.filters[subscription.id];

          should(filter.fidx).be.eql(0);
          should(filter.subfilters[0].cidx).be.eql(0);
          should(dsl.storage.testTables.i.c.conditions[0]).be.eql(1);
          should(dsl.storage.testTables.i.c.clength).be.eql(1);

          return dsl.register('i', 'c', {exists: {field: 'bar'}});
        })
        .then(subscription => {
          let filter = dsl.storage.filters[subscription.id];
          should(filter.fidx).be.eql(1);
          should(filter.subfilters[0].cidx).be.eql(1);
          should(dsl.storage.testTables.i.c.conditions[1]).be.eql(1);
          should(dsl.storage.testTables.i.c.clength).be.eql(2);

          return dsl.register('i', 'c', {and: [{exists: {field: 'baz'}}, {exists: {field: 'qux'}}]});
        })
        .then(subscription => {
          let filter = dsl.storage.filters[subscription.id];
          should(filter.fidx).be.eql(2);
          should(filter.subfilters[0].cidx).be.eql(2);
          should(dsl.storage.testTables.i.c.conditions[2]).be.eql(2);
          should(dsl.storage.testTables.i.c.clength).be.eql(3);
        });
    });

    it('should reallocate the condition index table when full', () => {
      return dsl.register('i', 'c', {exists: {field: 'foo'}})
        .then(() => {
          let promises = [];

          should(dsl.storage.testTables.i.c.clength).be.eql(1);
          should(dsl.storage.testTables.i.c.conditions.length).be.eql(10);

          for(let i = 0; i < 10; ++i) {
            promises.push(dsl.register('i', 'c', {exists: {field: `${i}`}}));
          }

          return Promise.all(promises);
        })
        .then(() => {
          let promises = [];

          should(dsl.storage.testTables.i.c.clength).be.eql(11);
          should(dsl.storage.testTables.i.c.conditions.length).be.eql(15);

          for(let i = 0; i < 20; ++i) {
            promises.push(dsl.register('i', 'c', {exists: {field: `secondPass_${i}`}}));
          }

          return Promise.all(promises);
        })
        .then(() => {
          should(dsl.storage.testTables.i.c.clength).be.eql(31);
          should(dsl.storage.testTables.i.c.conditions.length).be.eql(33);
        });
    });

    it('should not re-index an already indexed filter', () => {
      let filter;

      return dsl.register('i', 'c', {exists: {field: 'foo'}})
        .then(subscription => {
          filter = dsl.storage.filters[subscription.id];
          should(filter.fidx).be.eql(0);

          return dsl.register('i', 'c', {or: [{exists: {field: 'foo'}}, {equals: {bar: 'foo'}}]});
        })
        .then(() => {
          should(filter.fidx).be.eql(0);
          should(filter.subfilters[0].filters[0]).be.eql(filter);
          should(filter.subfilters[0].filters[1].fidx).be.eql(1);
        });
    });
  });

  describe('#subfilter removal', () => {
    it('should delete the test table if the last filter is removed', () => {
      return dsl.register('i', 'c', {exists: {field: 'foo'}})
        .then(subscription => dsl.remove(subscription.id))
        .then(() => {
          should(dsl.storage.testTables).be.an.Object().and.be.empty();
        });
    });

    it('should track removed filters and re-index', () => {
      let
        clock = sinon.useFakeTimers(),
        id1,
        id2;

      return dsl.register('i', 'c', {exists: {field: 'foo'}})
        .then(subscription => {
          id1 = subscription.id;
          return dsl.register('i', 'c', {exists: {field: 'bar'}});
        })
        .then(subscription => {
          id2 = subscription.id;
          return dsl.remove(id1);
        })
        .then(() => {
          let filter = dsl.storage.filters[id2];

          should(filter.fidx).be.eql(1);
          should(filter.subfilters[0].cidx).be.eql(1);
          should(dsl.storage.testTables.i.c.clength).be.eql(2);
          should(dsl.storage.testTables.i.c.removedFilters)
            .match({ [id1]: true });
          should(dsl.storage.testTables.i.c.removedFiltersCount)
            .be.eql(1);
          should(dsl.storage.testTables.i.c.removedConditions.array.length).be.eql(1);
          should(dsl.storage.testTables.i.c.reindexing).be.true();

          clock.tick(5000);

          should(filter.fidx).be.eql(0);
          should(filter.subfilters[0].cidx).be.eql(0);
          should(dsl.storage.testTables.i.c.clength).be.eql(1);
          should(dsl.storage.testTables.i.c.removedFilters)
            .be.empty();
          should(dsl.storage.testTables.i.c.removedFiltersCount)
            .be.eql(0);
          should(dsl.storage.testTables.i.c.removedConditions.array).be.empty();
          should(dsl.storage.testTables.i.c.reindexing).be.false();

          clock.restore();
        });
    });

    it('should not trigger a re-index if less than 10% of registered filters are removed', () => {
      let promises = [];

      for(let i = 0; i < 10; i++) {
        promises.push(dsl.register('i', 'c', {exists: {field: `${i}`}}));
      }

      return Promise.all(promises)
        .then(() => dsl.remove(Object.keys(dsl.storage.filters)[0]))
        .then(() => {
          should(dsl.storage.testTables.i.c.reindexing).be.false();
        });
    });

    // https://github.com/kuzzleio/kuzzle/issues/740
    it('issue #740 Unhandled Exception on room removal', () => {
      let
        room1,
        room2;

      return dsl.register('index', 'collection', {
        or: [
          {equals: {foo: 'bar'}},
          {exists: {field: 'foo'}}
        ]
      })
        .then(response => {
          room1 = response.id;
          return dsl.register('index', 'collection', {equals: {foo: 'bar'}});
        })
        .then(response => {
          room2 = response.id;
          return dsl.remove(room1);
        })
        .then(() => {
          return dsl.remove(room2);
        });
    });

    // https://github.com/kuzzleio/kuzzle/issues/824
    it('should remove a filter on which several conditions are set for the same field', () => {
      const filter = {
        and: [
          {
            not: {
              range: {
                foo: {lt: 42}
              }
            }
          },
          {
            not: {
              range: {
                foo: {lt: 50}
              }
            }
          },
          {
            not: {
              range: {
                foo: {lt: 2}
              }
            }
          }
        ]
      };

      let roomId;

      return dsl.register('i', 'c', filter)
        .then(response => {
          roomId = response.id;

          return dsl.remove(roomId);
        });
    });

  });
});
