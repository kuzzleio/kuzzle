'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  IndexEngineMock = require('../../../../mocks/indexEngine.mock'),
  IndexEngine = require('../../../../../lib/api/core/storage/indexEngine'),
  SafeBootstrap = require('../../../../../lib/api/core/storage/bootstrap/safeBootstrap'),
  InternalIndexBootstrap = require('../../../../../lib/api/core/storage/bootstrap/internalIndexBootstrap');

describe('InternalIndexBootstrap', () => {
  let
    internalIndexName,
    internalIndexEngine,
    internalIndexBootstrap,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    internalIndexEngine = new IndexEngineMock(
      kuzzle,
      internalIndexName,
      kuzzle.services.internalStorage);

    kuzzle.indexCache.exists.resolves(false);
    kuzzle.config.services.internalEngine.bootstrapLockTimeout = 42000;

    internalIndexBootstrap = new InternalIndexBootstrap(
      kuzzle,
      internalIndexEngine);
  });

  describe('#startOrWait', () => {
    let jwtSecret;

    beforeEach(() => {
      jwtSecret = 'i-am-the-secret-now';

      internalIndexBootstrap.createInternalIndex = sinon.stub().resolves();
      internalIndexBootstrap._getJWTSecret = sinon.stub().resolves(jwtSecret);

      SafeBootstrap.prototype.startOrWait = sinon.stub().resolves();
    });

    it('create internal index, call parent method and set JWT secret', async () => {
      await internalIndexBootstrap.startOrWait();

      sinon.assert.callOrder(
        internalIndexBootstrap.createInternalIndex,
        SafeBootstrap.prototype.startOrWait,
        internalIndexBootstrap._getJWTSecret
      );

      should(internalIndexBootstrap.kuzzle.config.security.jwt.secret)
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
        internalIndexEngine.create
      );
    });
  });

  describe('#createInternalIndex', () => {
    it('should create internal collections', async () => {
      await internalIndexBootstrap.createInternalIndex();

      should(internalIndexEngine.createCollection.callCount).be.eql(5);
      should(internalIndexEngine.createCollection.getCall(0).args[0])
        .be.eql('users');
      should(internalIndexEngine.createCollection.getCall(4).args).be.eql([
        'config',
        { dynamic: false, properties: {} }]);
    });
  });

  describe('#createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await internalIndexBootstrap.createInitialSecurities();

      should(internalIndexEngine.createOrReplace.callCount).be.eql(6);
      should(internalIndexEngine.createOrReplace.getCall(0).args[0])
        .be.eql('roles');
      should(internalIndexEngine.createOrReplace.getCall(3).args[0])
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

      should(internalIndexEngine.createOrReplace.callCount).be.eql(2);
      should(internalIndexEngine.createOrReplace.getCall(0).args).be.eql([
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
      should(internalIndexEngine.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalIndexEngine.get.resolves({ _source: { seed: 'i-am-another-secret' } });

      const jwt = await internalIndexBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
      should(internalIndexEngine.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
    });

    it('should reject if the JWT does not exists', () => {
      internalIndexEngine.get.rejects({ status: 404 });

      const promise = internalIndexBootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
          should(internalIndexEngine.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalIndexBootstrap._persistJWTSecret();

      should(internalIndexEngine.create).be.calledWith(
        'config',
        internalIndexBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await internalIndexBootstrap._persistJWTSecret();

      should(internalIndexEngine.create).be.called();
    });
  });
});