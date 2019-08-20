'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  BaseBootstrap = require('../../../lib/services/bootstrap/baseBootstrap'),
  Bootstrap = require('../../../lib/services/bootstrap/internalBootstrap');

describe('InternalBootstrap', () => {
  let
    internalBootstrap,
    kuzzle,
    jwtSecret;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.indexCache.exists.resolves(false);
    kuzzle.config.services.internalEngine.bootstrapLockTimeout = 42000;

    internalBootstrap = new Bootstrap(kuzzle);

    jwtSecret = 'i-am-the-secret-now';
  });

  describe('#startOrWait', () => {
    beforeEach(() => {
      BaseBootstrap.prototype.startOrWait = sinon.stub().resolves();
      internalBootstrap._createInternalIndex = sinon.stub().resolves();
      internalBootstrap._getJWTSecret = sinon.stub().resolves(jwtSecret);
    });

    it('should create internal index and set JWT secret', async () => {
      await internalBootstrap.startOrWait();

      should(internalBootstrap._createInternalIndex).be.calledOnce();
      should(kuzzle.config.security.jwt.secret).be.eql('i-am-the-secret-now');
    });
  });

  describe('#_bootstrapSequence', () => {
    beforeEach(() => {
      internalBootstrap._persistJWTSecret = sinon.stub().resolves();
      internalBootstrap._createInitialSecurities = sinon.stub().resolves();
      internalBootstrap._createInitialValidations = sinon.stub().resolves();
    });

    it('should call the initialization methods', async () => {
      await internalBootstrap._bootstrapSequence();

      sinon.assert.callOrder(
        internalBootstrap._createInitialSecurities,
        internalBootstrap._createInitialValidations,
        internalBootstrap._persistJWTSecret,
        internalBootstrap.engine.create
      );
    });
  });

  describe('#_createInternalIndex', () => {
    it('should create internal collections', async () => {
      await internalBootstrap._createInternalIndex();

      should(internalBootstrap.engine.createCollection.callCount).be.eql(6);
      should(internalBootstrap.engine.createCollection.getCall(0).args[0]).be.eql('users');
      should(internalBootstrap.engine.createCollection.getCall(5).args).be.eql([
        'config',
        { dynamic: false, properties: {} }]);
    });
  });

  describe('#_createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await internalBootstrap._createInitialSecurities();

      should(internalBootstrap.engine.createOrReplace.callCount).be.eql(6);
      should(internalBootstrap.engine.createOrReplace.getCall(0).args[0]).be.eql('roles');
      should(internalBootstrap.engine.createOrReplace.getCall(3).args[0]).be.eql('profiles');
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

      await internalBootstrap._createInitialValidations();

      should(internalBootstrap.engine.createOrReplace.callCount).be.eql(2);
      should(internalBootstrap.engine.createOrReplace.getCall(0).args).be.eql([
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

      const jwt = await internalBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-the-secret');
      should(internalBootstrap.engine.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalBootstrap.engine.get.resolves({ _source: { seed: 'i-am-another-secret' } });

      const jwt = await internalBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
      should(internalBootstrap.engine.get).be.calledWith('config', internalBootstrap._JWT_SECRET_ID);
    });

    it('should reject if the JWT does not exists', () => {
      internalBootstrap.engine.get.rejects({ status: 404 });

      const promise = internalBootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
          should(internalBootstrap.engine.get).be.calledWith('config', internalBootstrap._JWT_SECRET_ID);
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalBootstrap._persistJWTSecret();

      should(internalBootstrap.engine.create).be.calledWith(
        'config',
        internalBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await internalBootstrap._persistJWTSecret();

      should(internalBootstrap.engine.create).be.called();
    });
  });

  describe('#_checkTimeout', () => {
    it('should resolve if there is no active lock', () => {
      internalBootstrap.engine.exists.resolves(false);

      const promise = internalBootstrap._checkTimeout(42);

      return should(promise).be.resolved();
    });

    it('should reject after 10 attempts', async () => {
      internalBootstrap.engine.exists.resolves(true);
      internalBootstrap.attemptDelay = 2;

      const promise = internalBootstrap._checkTimeout();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.lock_wait_timeout'});
    });

    it('should make recurse call and resolve when the lock is not active', async () => {
      internalBootstrap.attemptDelay = 2;
      internalBootstrap.engine.exists
        .onCall(0).resolves(true)
        .onCall(1).resolves(true)
        .onCall(2).resolves(false);

      await internalBootstrap._checkTimeout();

      should(internalBootstrap.engine.exists.callCount).be.eql(3);
    });
  });

  describe('#_unlock', () => {
    it('should delete the lock', async () => {
      await internalBootstrap._unlock();

      should(internalBootstrap.engine.delete).be.calledWith('config', internalBootstrap._LOCK_ID);
    });
  });

  describe('#_getLock', () => {
    it('should not acquire lock and return false if the lock already exists', async () => {
      internalBootstrap.engine.get.resolves({ _source: { timestamp: Date.now() - 42 } });

      const acquired = await internalBootstrap._getLock();

      should(acquired).be.false();
      should(internalBootstrap.engine.create).not.be.called();
      should(internalBootstrap.engine.createOrReplace).not.be.called();
    });

    it('should acquire the lock and return true if the lock does not exists', async () => {
      internalBootstrap.engine.get.rejects({
        errorName: 'external.elasticsearch.document_not_found' });

      const acquired = await internalBootstrap._getLock();

      should(acquired).be.true();
      should(internalBootstrap.engine.create).be.called();
    });

    it('should acquire lock and return true if an old lock is present', async () => {
      internalBootstrap.engine.get.resolves({ _source: { timestamp: 42 } });

      const acquired = await internalBootstrap._getLock();

      should(acquired).be.true();
      should(internalBootstrap.engine.createOrReplace).be.called();
    });

    it('should reject if the engine.get call is rejected with an unknown error', async () => {
      internalBootstrap.engine.get.rejects({ errorName: 'ender.game.xenocide' });

      const promise = internalBootstrap._getLock();

      return should(promise).be.rejectedWith({ errorName: 'ender.game.xenocide' });
    });
  });

});