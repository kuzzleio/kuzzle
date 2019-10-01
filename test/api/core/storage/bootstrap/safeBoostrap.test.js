'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  SafeBootstrap = require('../../../../../lib/api/core/storage/bootstrap/safeBootstrap');

describe('SafeBootstrap', () => {
  let
    kuzzle,
    bootstrap;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    bootstrap = new SafeBootstrap(
      kuzzle.internalIndex,
      42);

    bootstrap._bootstrapSequence = sinon.stub().resolvesArg(0);
  });

  describe('#startOrWait', () => {
    beforeEach(() => {
      bootstrap._indexStorage.exists.resolves(false);
      bootstrap._isLocked = sinon.stub().resolves(false);
      bootstrap._waitTillUnlocked = sinon.stub().resolves();
      bootstrap._playBootstrap = sinon.stub().resolves();
    });

    it('should play the bootstrap sequence if it\'s the first node to start', async () => {
      await bootstrap.startOrWait();

      should(bootstrap._playBootstrap)
        .be.calledOnce();
    });

    it('should reject if bootstrap on this node takes too long', async () => {
      bootstrap._playBootstrap = () => new Promise(() => {});
      bootstrap._waitTillUnlocked = () => {
        return new Promise((_, reject) => setTimeout(
          () => reject(new Error('timeout')), 50));
      };

      const promise = bootstrap.startOrWait('liia');

      return should(promise).be.rejected();
    });

    it('should wait for bootstrap to finish if it\' currently playing on another node', async () => {
      bootstrap._isLocked.resolves(true);

      await bootstrap.startOrWait();

      should(bootstrap._waitTillUnlocked).be.calledOnce();
      should(bootstrap._playBootstrap).not.be.called();
    });

    it('should throw if bootstrap on another node takes too long', async () => {
      bootstrap._isLocked.resolves(true);
      bootstrap._waitTillUnlocked.rejects(new Error('timeout'));

      const promise = bootstrap.startOrWait();

      return should(promise).be.rejected()
        .then(() => {
          should(bootstrap._playBootstrap).not.be.called();
        });
    });
  });

  describe('#_playBootstrap', () => {
    beforeEach(() => {
      bootstrap._bootstrapSequence = sinon.stub().resolves();
      bootstrap._unlock = sinon.stub().resolves();
    });

    it('should call the _playSequence methods and then unlock the lock', async () => {
      await bootstrap._playBootstrap();

      sinon.assert.callOrder(
        bootstrap._bootstrapSequence,
        bootstrap._indexStorage.create,
        bootstrap._unlock
      );

      should(bootstrap._bootstrapSequence).be.calledWith();
    });
  });

  describe('#_waitTillUnlocked', () => {
    it('should resolve if there is no active lock', () => {
      bootstrap._indexStorage.exists.resolves(false);

      const promise = bootstrap._waitTillUnlocked(42);

      return should(promise).be.resolved();
    });

    it('should reject after 10 attempts', async () => {
      bootstrap._indexStorage.exists.resolves(true);
      bootstrap.attemptDelay = 2;

      const promise = bootstrap._waitTillUnlocked();

      return should(promise).be.rejectedWith({ message: 'To be implemented.' });
    });

    it('should make recurse call and resolve when the lock is not active', async () => {
      bootstrap.attemptDelay = 2;
      bootstrap._indexStorage.exists
        .onCall(0).resolves(true)
        .onCall(1).resolves(true)
        .onCall(2).resolves(false);

      await bootstrap._waitTillUnlocked();

      should(bootstrap._indexStorage.exists.callCount).be.eql(3);
    });
  });

  describe('#_unlock', () => {
    it('should delete the lock', async () => {
      await bootstrap._unlock();

      should(bootstrap._indexStorage.delete)
        .be.calledWith('config', bootstrap._LOCK_ID);
    });
  });

  describe('#_isLocked', () => {
    it('should return true if the lock already exists', async () => {
      bootstrap._indexStorage.get.resolves({ _source: { timestamp: Date.now() - 42 } });

      const isLocked = await bootstrap._isLocked();

      should(isLocked).be.true();
      should(bootstrap._indexStorage.create).not.be.called();
      should(bootstrap._indexStorage.createOrReplace).not.be.called();
    });

    it('should acquire the lock and return false if the lock does not exists', async () => {
      const error = new Error('not found');
      error.status = 404;
      bootstrap._indexStorage.get.rejects(error);

      const isLocked = await bootstrap._isLocked();

      should(isLocked).be.false();
      should(bootstrap._indexStorage.create).be.called();
    });

    it('should acquire lock and return false if an old lock is present', async () => {
      bootstrap._indexStorage.get.resolves({ _source: { timestamp: 42 } });

      const isLocked = await bootstrap._isLocked();

      should(isLocked).be.false();
      should(bootstrap._indexStorage.createOrReplace).be.called();
    });

    it('should reject if the engine.get call is rejected with an unknown error', async () => {
      const error = new Error('not found');
      error.id = 'ender.game.xenocide';
      bootstrap._indexStorage.get.rejects(error);

      const promise = bootstrap._isLocked();

      return should(promise).be.rejectedWith({ id: 'ender.game.xenocide' });
    });
  });

});
