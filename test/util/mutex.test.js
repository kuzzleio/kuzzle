'use strict';

const should = require('should');
const sinon = require('sinon');
const Bluebird = require('bluebird');
const mockRequire = require('mock-require');
const {
  errors: {
    InternalError: KuzzleInternalError
  }
} = require('kuzzle-common-objects');

const KuzzleMock = require('../mocks/kuzzle.mock');

describe('#mutex', () => {
  let Mutex = require('../../lib/util/mutex');
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
  });

  describe('#lock', () => {
    it('should be able to lock a ressource', () => {
      kuzzle.services.list.internalCache.set.resolves(true);

      const mutex = new Mutex(kuzzle, 'foo', { timeout: 0, ttl: 123 });

      return mutex.lock()
        .then(result => {
          should(result).be.true();
          should(kuzzle.services.list.internalCache.set).calledWith(
            'foo',
            sinon.match.string,
            'NX',
            'PX',
            123);
        });
    });

    it('should use random values for different mutex instances', () => {
      const mutex1 = new Mutex(kuzzle, 'foo');
      const mutex2 = new Mutex(kuzzle, 'foo');

      should(mutex1.mutexId).not.eql(mutex2.mutexId);
    });

    it('should reject if already locking/locked', () => {
      const mutex = new Mutex(kuzzle, 'foo', { timeout: 0 });

      kuzzle.services.list.internalCache.set.resolves(true);

      return mutex.lock()
        .then(() => should(mutex.lock()).rejectedWith(KuzzleInternalError, {
          id: 'core.fatal.assertion_failed',
        }));
    });

    it('should return immediately if failing to acquire a lock (timeout = 0)', () => {
      kuzzle.services.list.internalCache.set.resolves(false);

      const mutex = new Mutex(kuzzle, 'foo', { timeout: 0, ttl: 123 });

      return mutex.lock()
        .then(result => {
          should(result).be.false();

          should(kuzzle.services.list.internalCache.set).calledWith(
            'foo',
            sinon.match.string,
            'NX',
            'PX',
            123);
        });
    });

    it('should wait until timeout if failing to acquire a lock (timeout > 0)', () => {
      kuzzle.services.list.internalCache.set.resolves(false);
      const start = Date.now();
      const mutex = new Mutex(kuzzle, 'foo', { timeout: 1000 });

      return mutex.lock()
        .then(result => {
          should(result).be.false();
          should(Date.now() - start).approximately(1000, 200);
        });
    });

    it('should successfully acquire a lock if it becomes available (timeout > 0)', () => {
      kuzzle.services.list.internalCache.set.resolves(false);

      const mutex = new Mutex(kuzzle, 'foo', { timeout: 1000 });
      const start = Date.now();

      return mutex.lock()
        .then(result => {
          should(result).be.false();
          should(Date.now() - start).approximately(1000, 200);
          kuzzle.services.list.internalCache.set.resolves(true);
          return mutex.lock();
        })
        .then(result => {
          should(result).be.true();
        });
    });

    it('should wait indefinitely until a lock becomes available (timeout = -1)', () => {
      kuzzle.services.list.internalCache.set.resolves(false);

      const mutex = new Mutex(kuzzle, 'foo', { timeout: -1 });

      const mutexPromise = mutex.lock();
      const start = Date.now();

      return Bluebird.delay(2000)
        .then(() => {
          should(mutex.locked).be.false();
          kuzzle.services.list.internalCache.set.resolves(true);
          return mutexPromise;
        })
        .then(result => {
          should(mutex.locked).be.true();
          should(result).be.true();
          should(Date.now() - start).approximately(2000, 200);
        });
    });
  });

  describe('#unlock', () => {
    beforeEach(() => {
      kuzzle.services.list.internalCache.set.resolves(true);
      kuzzle.services.list.internalCache._client.delIfValueEqual = sinon.stub().resolves();
    });

    it('should unlock an acquired lock', () => {
      const mutex = new Mutex(kuzzle, 'foo', { timeout: 0 });

      return mutex.lock()
        .then(() => {
          should(mutex.locked).be.true();
          return mutex.unlock();
        })
        .then(() => {
          should(mutex.locked).be.false();
          should(kuzzle.services.list.internalCache._client.delIfValueEqual)
            .calledWith('foo', mutex.mutexId);
        });
    });

    it('should reject if trying to unlock a non-locked ressource', () => {
      const mutex = new Mutex(kuzzle, 'foo', { timeout: 0 });

      return should(mutex.unlock()).rejectedWith(KuzzleInternalError, {
        id: 'core.fatal.assertion_failed',
      });
    });

    it('should register a dedicated script the 1st time a mutex is unlocked', () => {
      // clear cached dependency
      Mutex = mockRequire.reRequire('../../lib/util/mutex');

      const mutex = new Mutex(kuzzle, 'foo', { timeout: 0 });
      let anotherMutex;

      return mutex.lock()
        .then(() => mutex.unlock())
        .then(() => {
          should(kuzzle.services.list.internalCache._client.defineCommand)
            .calledWith('delIfValueEqual', {
              numberOfKeys: 1,
              lua: sinon.match.string
            });

          kuzzle.services.list.internalCache._client.defineCommand.resetHistory();
          anotherMutex = new Mutex(kuzzle, 'bar', { timeout: 0 });

          return anotherMutex.lock();
        })
        .then(() => anotherMutex.unlock())
        .then(() => {
          should(kuzzle.services.list.internalCache._client.defineCommand)
            .not.called();
        });
    });
  });
});
