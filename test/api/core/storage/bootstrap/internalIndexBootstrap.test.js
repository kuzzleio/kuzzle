'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  IndexStorageMock = require('../../../../mocks/indexStorage.mock'),
  SafeBootstrap = require('../../../../../lib/api/core/storage/bootstrap/safeBootstrap'),
  InternalIndexBootstrap = require('../../../../../lib/api/core/storage/bootstrap/internalIndexBootstrap');

describe('InternalIndexBootstrap', () => {
  let
    internalIndexName,
    internalIndexStorage,
    internalIndexBootstrap,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    internalIndexStorage = new IndexStorageMock(
      internalIndexName,
      kuzzle.storageEngine.internal);

    kuzzle.config.services.internalIndex.bootstrapLockTimeout = 42000;

    internalIndexBootstrap = new InternalIndexBootstrap(
      kuzzle,
      internalIndexStorage);
  });

  describe('#startOrWait', () => {
    let
      safeBootstrapStartOrWait,
      jwtSecret;

    beforeEach(() => {
      jwtSecret = 'i-am-the-secret-now';

      internalIndexBootstrap.createInternalCollections = sinon.stub().resolves();
      internalIndexBootstrap._getJWTSecret = sinon.stub().resolves(jwtSecret);

      safeBootstrapStartOrWait = SafeBootstrap.prototype.startOrWait;
      SafeBootstrap.prototype.startOrWait = sinon.stub().resolves();
    });

    afterEach(() => {
      SafeBootstrap.prototype.startOrWait = safeBootstrapStartOrWait;
    });

    it('create internal index, call parent method and set JWT secret', async () => {
      await internalIndexBootstrap.startOrWait();

      sinon.assert.callOrder(
        SafeBootstrap.prototype.startOrWait,
        internalIndexBootstrap._getJWTSecret
      );

      should(kuzzle.config.security.jwt.secret)
        .be.eql('i-am-the-secret-now');
    });
  });

  describe('#_bootstrapSequence', () => {
    beforeEach(() => {
      internalIndexBootstrap._persistJWTSecret = sinon.stub().resolves();
      internalIndexBootstrap.createInitialSecurities = sinon.stub().resolves();
      internalIndexBootstrap.createInitialValidations = sinon.stub().resolves();
    });

    it('should call the initialization methods', async () => {
      await internalIndexBootstrap._bootstrapSequence();

      sinon.assert.callOrder(
        internalIndexBootstrap.createInitialSecurities,
        internalIndexBootstrap.createInitialValidations,
        internalIndexBootstrap._persistJWTSecret,
        internalIndexStorage.create
      );
    });
  });

  describe('#createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await internalIndexBootstrap.createInitialSecurities();

      should(internalIndexStorage.createOrReplace.callCount).be.eql(6);
      should(internalIndexStorage.createOrReplace.getCall(0).args[0])
        .be.eql('roles');
      should(internalIndexStorage.createOrReplace.getCall(3).args[0])
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

      await internalIndexBootstrap.createInitialValidations();

      should(internalIndexStorage.createOrReplace.callCount).be.eql(2);
      should(internalIndexStorage.createOrReplace.getCall(0).args).be.eql([
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

      const jwt = await internalIndexBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-the-secret');
      should(internalIndexStorage.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalIndexStorage.get.resolves({ _source: { seed: 'i-am-another-secret' } });

      const jwt = await internalIndexBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
      should(internalIndexStorage.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
    });

    it('should reject if the JWT does not exists', () => {
      const error = new Error('not found');
      error.status = 404;
      internalIndexStorage.get.rejects(error);

      const promise = internalIndexBootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
          should(internalIndexStorage.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalIndexBootstrap._persistJWTSecret();

      should(internalIndexStorage.create).be.calledWith(
        'config',
        internalIndexBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await internalIndexBootstrap._persistJWTSecret();

      should(internalIndexStorage.create).be.called();
    });
  });
});
