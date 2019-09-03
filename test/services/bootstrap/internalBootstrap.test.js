'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  SafeBootstrap = require('../../../lib/services/bootstrap/safeBootstrap'),
  Bootstrap = require('../../../lib/services/bootstrap/internalBootstrap');

xdescribe('InternalBootstrap', () => {
  let
    internalBootstrap,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    kuzzle.indexCache.exists.resolves(false);
    kuzzle.config.services.internalEngine.bootstrapLockTimeout = 42000;

    internalBootstrap = new Bootstrap(kuzzle, kuzzle.internalEngine);
  });

  describe('#startOrWait', () => {
    let jwtSecret;

    beforeEach(() => {
      jwtSecret = 'i-am-the-secret-now';

      internalBootstrap.createInternalIndex = sinon.stub().resolves();
      internalBootstrap._getJWTSecret = sinon.stub().resolves(jwtSecret);
      SafeBootstrap.prototype.startOrWait = sinon.stub().resolves();
    });

    it('create internal index, call parent method and set JWT secret', async () => {
      await internalBootstrap.startOrWait();

      sinon.assert.callOrder(
        internalBootstrap.createInternalIndex,
        SafeBootstrap.prototype.startOrWait,
        internalBootstrap._getJWTSecret
      );

      should(internalBootstrap.kuzzle.config.security.jwt.secret)
        .be.eql('i-am-the-secret-now');
    });
  });

  describe('#_bootstrapSequence', () => {
    beforeEach(() => {
      internalBootstrap._persistJWTSecret = sinon.stub().resolves();
      internalBootstrap.createInitialSecurities = sinon.stub().resolves();
      internalBootstrap.createInitialValidations = sinon.stub().resolves();
    });

    it('should call the initialization methods', async () => {
      await internalBootstrap._bootstrapSequence();

      sinon.assert.callOrder(
        internalBootstrap.createInitialSecurities,
        internalBootstrap.createInitialValidations,
        internalBootstrap._persistJWTSecret,
        internalBootstrap.storage.create
      );
    });
  });

  describe('#createInternalIndex', () => {
    it('should create internal collections', async () => {
      await internalBootstrap.createInternalIndex();

      should(internalBootstrap.storage.createCollection.callCount).be.eql(6);
      should(internalBootstrap.storage.createCollection.getCall(0).args[0])
        .be.eql('users');
      should(internalBootstrap.storage.createCollection.getCall(5).args).be.eql([
        'config',
        { dynamic: false, properties: {} }]);
    });
  });

  describe('#createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await internalBootstrap.createInitialSecurities();

      should(internalBootstrap.storage.createOrReplace.callCount).be.eql(6);
      should(internalBootstrap.storage.createOrReplace.getCall(0).args[0])
        .be.eql('roles');
      should(internalBootstrap.storage.createOrReplace.getCall(3).args[0])
        .be.eql('profiles');
    });
  });

  describe('#createInitialValidations', () => {
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

      await internalBootstrap.createInitialValidations();

      should(internalBootstrap.storage.createOrReplace.callCount).be.eql(2);
      should(internalBootstrap.storage.createOrReplace.getCall(0).args).be.eql([
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
      should(internalBootstrap.storage.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalBootstrap.storage.get.resolves({ _source: { seed: 'i-am-another-secret' } });

      const jwt = await internalBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
      should(internalBootstrap.storage.get).be.calledWith('config', internalBootstrap._JWT_SECRET_ID);
    });

    it('should reject if the JWT does not exists', () => {
      internalBootstrap.storage.get.rejects({ status: 404 });

      const promise = internalBootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
          should(internalBootstrap.storage.get).be.calledWith('config', internalBootstrap._JWT_SECRET_ID);
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalBootstrap._persistJWTSecret();

      should(internalBootstrap.storage.create).be.calledWith(
        'config',
        internalBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await internalBootstrap._persistJWTSecret();

      should(internalBootstrap.storage.create).be.called();
    });
  });
});