'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Bootstrap = require('../../../lib/services/internalEngine/bootstrap');

describe('services/internalEngine/bootstrap.js', () => {
  let
    kuzzle,
    bootstrap,
    jwtSecret;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.indexCache.exists.resolves(false);
    kuzzle.config.services.internalEngine.bootstrapLockTimeout = 42000;

    bootstrap = new Bootstrap(kuzzle);

    jwtSecret = 'i-am-the-secret-now';
  });

  describe('#constructor', () => {
    it('should set the engine to kuzzle internal engine', () => {
      should(bootstrap.engine).be.exactly(kuzzle.internalEngine);
    });
  });

  describe('#startOrWait', () => {
    beforeEach(() => {
      bootstrap._bootstrap = sinon.stub().resolves();
      bootstrap._getLock = sinon.stub().resolves(true);
      bootstrap._checkTimeout = sinon.stub().resolves();
      bootstrap._getJWTSecret = sinon.stub().resolves(jwtSecret);
      bootstrap.engine.exists = sinon.stub().resolves(false);
      bootstrap._createInternalIndex = sinon.stub().resolves();
    });

    it('should play the bootstrap sequence if it\'s the first node to start', async () => {
      await bootstrap.startOrWait();

      should(bootstrap._createInternalIndex).be.calledOnce();
      should(bootstrap._bootstrap).be.calledOnce();
      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
    });

    it('should reject if bootstrap on this node takes too long', async () => {
      bootstrap._bootstrap = () => new Promise(() => {});
      bootstrap._checkTimeout = () => {
        return new Promise((_, reject) => setTimeout(
          () => reject(new Error('timeout')), 50));
      };

      const promise = bootstrap.startOrWait()

      return should(promise).be.rejected()
        .then(() => {
          should(kuzzle.config.security.jwt.secret).be.null();
        });
    });

    it('should wait for bootstrap to finish if it\' currently playing on another node', async () => {
      bootstrap._getLock.resolves(false);

      await bootstrap.startOrWait();

      should(bootstrap._checkTimeout).be.calledOnce();
      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
      should(bootstrap._bootstrap).not.be.called();
    });

    it('should throw if bootstrap on another node takes too long', async () => {
      bootstrap._getLock.resolves(false);
      bootstrap._checkTimeout.rejects(new Error('timeout'));

      const promise = bootstrap.startOrWait()

      return should(promise).be.rejected()
        .then(() => {
          should(kuzzle.config.security.jwt.secret).be.null();
          should(bootstrap._bootstrap).not.be.called();
        });
    });

    it('should get JWT secret and return if bootstrap is already done', async () => {
      bootstrap.engine.exists.resolves(true);

      await bootstrap.startOrWait();

      should(bootstrap._getLock).not.be.called();
      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
      should(bootstrap._bootstrap).not.be.called();
    });

  });

  describe('#_bootstrap', () => {
    beforeEach(() => {
      bootstrap._persistJWTSecret = sinon.stub().resolves();
      bootstrap._createInternalIndex = sinon.stub().resolves();
      bootstrap._createInitialSecurities = sinon.stub().resolves();
      bootstrap._createInitialValidations = sinon.stub().resolves();
      bootstrap._unlock = sinon.stub().resolves();
   });

    it('should call the initialization methods and then unlock the lock', async () => {
      await bootstrap._bootstrap();

      sinon.assert.callOrder(
        bootstrap._createInitialSecurities,
        bootstrap._createInitialValidations,
        bootstrap.engine.create,
        bootstrap._persistJWTSecret,
        bootstrap.engine.create,
        bootstrap._unlock
      );
    });
  });

  describe('#_createInternalIndex', () => {
    it('should create internal collections', async () => {
      await bootstrap._createInternalIndex();

      should(bootstrap.engine.createCollection.callCount).be.eql(6);
      should(bootstrap.engine.createCollection.getCall(0).args[0]).be.eql('users');
      should(bootstrap.engine.createCollection.getCall(5).args).be.eql(
        ['config',
        { dynamic: false, properties: {} }]);
    });
  });

  describe('#_createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await bootstrap._createInitialSecurities();

      should(bootstrap.engine.createOrReplace.callCount).be.eql(6);
      should(bootstrap.engine.createOrReplace.getCall(0).args[0]).be.eql('roles');
      should(bootstrap.engine.createOrReplace.getCall(3).args[0]).be.eql('profiles');
    });
  });

  describe('#_createInitialValidations', () => {
    it('should create initial validations from kuzzlerc', async () => {
      kuzzle.config.validation = {
        nepali: {
          liia: {
            index: 'nepali',
            collection: 'liia',
            validations: { some: 'validation' }
          },
          bandipur: {
            index: 'nepali',
            collection: 'bandipur',
            validations: { other: 'validation' }
          }
        }
      };

      await bootstrap._createInitialValidations();

      should(bootstrap.engine.createOrReplace.callCount).be.eql(2);
      should(bootstrap.engine.createOrReplace.getCall(0).args).be.eql([
        'validations',
        'nepali#liia',
        {
          index: 'nepali',
          collection: 'liia',
          validations: { some: 'validation' }
        }
      ]);
    });
  });

  describe('#_getJWTSecret', () => {
    it('should return the secret if it\'s already present in memory', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await bootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-the-secret');
      should(bootstrap.engine.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      bootstrap.engine.get.resolves({ _source: { seed: 'i-am-another-secret' } });

      const jwt = await bootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
      should(bootstrap.engine.get).be.calledWith('config', bootstrap._JWT_SECRET_ID);
    });

    it('should reject if the JWT does not exists', () => {
      bootstrap.engine.get.rejects({ status: 404 });

      const promise = bootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
          errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
          should(bootstrap.engine.get).be.calledWith('config', bootstrap._JWT_SECRET_ID);
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await bootstrap._persistJWTSecret();

      should(bootstrap.engine.create).be.calledWith(
        'config',
        bootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await bootstrap._persistJWTSecret();

      should(bootstrap.engine.create).be.called();
    });
  });

  describe('#_checkTimeout', () => {
    it('should resolve if there is no active lock', () => {
      bootstrap.engine.exists.resolves(false);

      const promise = bootstrap._checkTimeout(42);

      return should(promise).be.resolved();
    });

    it('should reject after 10 attempts', async () => {
      bootstrap.engine.exists.resolves(true);
      bootstrap.attemptDelay = 2;

      const promise = bootstrap._checkTimeout();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.lock_wait_timeout'});
    });

    it('should make recurse call and resolve when the lock is not active', async () => {
      bootstrap.attemptDelay = 2;
      bootstrap.engine.exists
        .onCall(0).resolves(true)
        .onCall(1).resolves(true)
        .onCall(2).resolves(false);

      await bootstrap._checkTimeout();

      should(bootstrap.engine.exists.callCount).be.eql(3);
    });
  });

  describe('#_unlock', () => {
    it('should delete the lock', async () => {
      await bootstrap._unlock();

      should(bootstrap.engine.delete).be.calledWith('config', bootstrap._LOCK_ID);
    });
  });

  describe('#_getLock', () => {
    it('should not acquire lock and return false if the lock already exists', async () => {
      bootstrap.engine.get.resolves({ _source: { timestamp: Date.now() - 42 } });

      const acquired = await bootstrap._getLock();

      should(acquired).be.false();
      should(bootstrap.engine.create).not.be.called();
      should(bootstrap.engine.createOrReplace).not.be.called();
    });

    it('should acquire the lock and return true if the lock does not exists', async () => {
      bootstrap.engine.get.rejects({
        errorName: 'external.elasticsearch.document_not_found' });

      const acquired = await bootstrap._getLock();

      should(acquired).be.true();
      should(bootstrap.engine.create).be.called();
    });

    it('should acquire lock and return true if an old lock is present', async () => {
      bootstrap.engine.get.resolves({ _source: { timestamp: 42 } });

      const acquired = await bootstrap._getLock();

      should(acquired).be.true();
      should(bootstrap.engine.createOrReplace).be.called();
    });

    it('should reject if the engine.get call is rejected with an unknown error', async () => {
      bootstrap.engine.get.rejects({ errorName: 'ender.game.xenocide' });

      const promise = bootstrap._getLock();

      return should(promise).be.rejectedWith({ errorName: 'ender.game.xenocide' });
    });
  });

});