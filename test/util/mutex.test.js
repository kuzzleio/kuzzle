'use strict';

const should = require('should');
const sinon = require('sinon');
const mockRequire = require('mock-require');

const { InternalError: KuzzleInternalError } = require('../../index');
const KuzzleMock = require('../mocks/kuzzle.mock');

describe('#mutex', () => {
  let { Mutex } = require('../../lib/util/mutex');
  let kuzzle;
  let clock;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  describe('#lock', () => {
    it('should be able to lock a ressource', async () => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(true);

      const mutex = new Mutex('foo', { timeout: 0, ttl: 123 });

      await should(mutex.lock()).be.fulfilledWith(true);

      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        'foo',
        sinon.match.string,
        { onlyIfNew: true, ttl: 123 });
    });

    it('should use random values for different mutex instances', async () => {
      const mutex1 = new Mutex('foo');
      const mutex2 = new Mutex('foo');

      should(mutex1.mutexId).not.eql(mutex2.mutexId);
    });

    it('should throw if already locking/locked', async () => {
      const mutex = new Mutex('foo', { timeout: 0 });

      kuzzle.ask.withArgs('core:cache:internal:store').resolves(true);

      await mutex.lock();

      return should(mutex.lock()).rejectedWith(KuzzleInternalError, {
        id: 'core.fatal.assertion_failed',
      });
    });

    it('should return immediately if failing to acquire a lock (timeout = 0)', async () => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(false);

      const mutex = new Mutex('foo', { timeout: 0, ttl: 123 });

      await should(mutex.lock()).be.fulfilledWith(false);

      should(kuzzle.ask).calledWith(
        'core:cache:internal:store',
        'foo',
        sinon.match.string,
        { onlyIfNew: true, ttl: 123 });
    });

    it('should wait until timeout if failing to acquire a lock (timeout > 0)', async () => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(false);
      const resolvedPromise = Promise.resolve('pending');

      const mutex = new Mutex('foo', { timeout: 10000 });

      const mutexPromise = mutex.lock();

      for (let seconds = 0; seconds < 10; seconds++) {
        await should(Promise.race([mutexPromise, resolvedPromise]))
          .fulfilledWith('pending');
        clock.tick(1000);
      }

      should(mutexPromise).be.fulfilledWith(false);
    });

    it('should successfully acquire a lock if it becomes available (timeout > 0)', async () => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(false);
      const resolvedPromise = Promise.resolve('pending');

      const mutex = new Mutex('foo', { timeout: 10000 });

      const mutexPromise = mutex.lock();

      for (let seconds = 0; seconds < 5; seconds++) {
        await should(Promise.race([mutexPromise, resolvedPromise]))
          .fulfilledWith('pending');
        clock.tick(1000);
      }

      kuzzle.ask.withArgs('core:cache:internal:store').resolves(true);
      clock.restore();
      await should(mutexPromise).be.fulfilledWith(true);
    });

    it('should wait indefinitely until a lock becomes available (timeout = -1)', async () => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(false);
      const resolvedPromise = Promise.resolve('pending');

      const mutex = new Mutex('foo', { timeout: -1 });

      const mutexPromise = mutex.lock();

      for (let seconds = 0; seconds < 1000; seconds++) {
        await should(Promise.race([mutexPromise, resolvedPromise]))
          .fulfilledWith('pending');

        clock.tick(1000);
      }

      kuzzle.ask.withArgs('core:cache:internal:store').resolves(true);
      clock.restore();

      await should(mutexPromise).fulfilledWith(true);
    });
  });

  describe('#wait', () => {
    beforeEach(() => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(true);
    });

    it ('should wait resolve when the ressource is freed', async () => {
      const mutex = new Mutex('foo', { timeout: 0 });

      await mutex.lock();

      const waitResult = mutex.wait({ timeout: -1 });

      await mutex.unlock();

      const res = await waitResult;

      should(res).be.true();
    });

    it ('should resolved to false if the timeout exceed', async () => {
      const mutex = new Mutex('foo', { timeout: 0 });

      await mutex.lock();

      const waitResult = await mutex.wait({ timeout: 0 });

      await mutex.unlock();

      should(waitResult).be.false();
    });
  });

  describe('#unlock', () => {
    beforeEach(() => {
      kuzzle.ask.withArgs('core:cache:internal:store').resolves(true);
    });

    it('should unlock an acquired lock', async () => {
      const mutex = new Mutex('foo', { timeout: 0 });

      await mutex.lock();

      should(mutex.locked).be.true();

      await mutex.unlock();

      should(mutex.locked).be.false();
      should(kuzzle.ask).calledWith(
        'core:cache:internal:script:execute',
        'delIfValueEqual',
        'foo',
        mutex.mutexId);
    });

    it('should reject if trying to unlock a non-locked ressource', () => {
      const mutex = new Mutex('foo', { timeout: 0 });

      return should(mutex.unlock()).rejectedWith(KuzzleInternalError, {
        id: 'core.fatal.assertion_failed',
      });
    });

    it('should register a dedicated script the 1st time a mutex is unlocked', async () => {
      // clear cached dependency
      ({ Mutex } = mockRequire.reRequire('../../lib/util/mutex'));

      const mutex = new Mutex('foo', { timeout: 0 });

      await mutex.lock();
      await mutex.unlock();

      should(kuzzle.ask).calledWith(
        'core:cache:internal:script:define',
        'delIfValueEqual',
        1,
        sinon.match.string);

      kuzzle.ask.resetHistory();

      const anotherMutex = new Mutex('bar', { timeout: 0 });

      await anotherMutex.lock();
      await anotherMutex.unlock();

      should(kuzzle.ask).not.calledWith('core:cache:internal:script:define');
    });
  });
});
