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
      kuzzle,
      kuzzle.internalIndex,
      42);

    bootstrap._bootstrapSequence = sinon.stub().resolvesArg(0);
  });

  describe('#startOrWait', () => {
    beforeEach(() => {
      bootstrap.indexEngine.exists.resolves(false);
      bootstrap._isLocked = sinon.stub().resolves(false);
      bootstrap._waitTillUnlocked = sinon.stub().resolves();
      bootstrap._playBootstrap = sinon.stub().resolves();
    });

    it('should play the bootstrap sequence if it\'s the first node to start', async () => {
      await bootstrap.startOrWait('liia');

      should(bootstrap._playBootstrap)
        .be.calledOnce()
        .be.calledWith('liia');
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

      await bootstrap.startOrWait('liia');

      should(bootstrap._waitTillUnlocked).be.calledOnce();
      should(bootstrap._playBootstrap).not.be.called();
    });

    it('should throw if bootstrap on another node takes too long', async () => {
      bootstrap._isLocked.resolves(true);
      bootstrap._waitTillUnlocked.rejects(new Error('timeout'));

      const promise = bootstrap.startOrWait('liia');

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
      await bootstrap._playBootstrap('liia');

      sinon.assert.callOrder(
        bootstrap._bootstrapSequence,
        bootstrap.indexEngine.create,
        bootstrap._unlock
      );

      should(bootstrap._bootstrapSequence).be.calledWith('liia');
    });
  });

  describe('#_waitTillUnlocked', () => {
    it('should resolve if there is no active lock', () => {
      bootstrap.indexEngine.exists.resolves(false);

      const promise = bootstrap._waitTillUnlocked(42);

      return should(promise).be.resolved();
    });

    it('should reject after 10 attempts', async () => {
      bootstrap.indexEngine.exists.resolves(true);
      bootstrap.attemptDelay = 2;

      const promise = bootstrap._waitTillUnlocked();

      return should(promise).be.rejectedWith({ message: 'To be implemented.' });
    });

    it('should make recurse call and resolve when the lock is not active', async () => {
      bootstrap.attemptDelay = 2;
      bootstrap.indexEngine.exists
        .onCall(0).resolves(true)
        .onCall(1).resolves(true)
        .onCall(2).resolves(false);

      await bootstrap._waitTillUnlocked();

      should(bootstrap.indexEngine.exists.callCount).be.eql(3);
    });
  });

  describe('#_unlock', () => {
    it('should delete the lock', async () => {
      await bootstrap._unlock();

      should(bootstrap.indexEngine.delete)
        .be.calledWith('config', bootstrap._LOCK_ID);
    });
  });

  describe('#_isLocked', () => {
    it('should return true if the lock already exists', async () => {
      bootstrap.indexEngine.get.resolves({ _source: { timestamp: Date.now() - 42 } });

      const isLocked = await bootstrap._isLocked();

      should(isLocked).be.true();
      should(bootstrap.indexEngine.create).not.be.called();
      should(bootstrap.indexEngine.createOrReplace).not.be.called();
    });

    it('should acquire the lock and return false if the lock does not exists', async () => {
      bootstrap.indexEngine.get.rejects({ status: 404 });

      const isLocked = await bootstrap._isLocked();

      should(isLocked).be.false();
      should(bootstrap.indexEngine.create).be.called();
    });

    it('should acquire lock and return false if an old lock is present', async () => {
      bootstrap.indexEngine.get.resolves({ _source: { timestamp: 42 } });

      const isLocked = await bootstrap._isLocked();

      should(isLocked).be.false();
      should(bootstrap.indexEngine.createOrReplace).be.called();
    });

    it('should reject if the engine.get call is rejected with an unknown error', async () => {
      bootstrap.indexEngine.get.rejects({ errorName: 'ender.game.xenocide' });

      const promise = bootstrap._isLocked();

      return should(promise).be.rejectedWith({ errorName: 'ender.game.xenocide' });
    });
  });

});