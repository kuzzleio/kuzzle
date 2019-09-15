'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
<<<<<<< HEAD
  IndexStorageMock = require('../../../../mocks/indexStorage.mock'),
=======
  IndexEngineMock = require('../../../../mocks/indexEngine.mock'),
>>>>>>> 2-dev
  SafeBootstrap = require('../../../../../lib/api/core/storage/bootstrap/safeBootstrap'),
  InternalIndexBootstrap = require('../../../../../lib/api/core/storage/bootstrap/internalIndexBootstrap');

describe('InternalIndexBootstrap', () => {
  let
    internalIndexName,
<<<<<<< HEAD
    internalIndexStorage,
=======
    internalIndexEngine,
>>>>>>> 2-dev
    internalIndexBootstrap,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

<<<<<<< HEAD
    internalIndexStorage = new IndexStorageMock(
      internalIndexName,
      kuzzle.storageEngine.internal);

=======
    internalIndexEngine = new IndexEngineMock(
      kuzzle,
      internalIndexName,
      kuzzle.services.internalStorage);

    kuzzle.indexCache.exists.resolves(false);
>>>>>>> 2-dev
    kuzzle.config.services.internalIndex.bootstrapLockTimeout = 42000;

    internalIndexBootstrap = new InternalIndexBootstrap(
      kuzzle,
<<<<<<< HEAD
      internalIndexStorage);
=======
      internalIndexEngine);
>>>>>>> 2-dev
  });

  describe('#startOrWait', () => {
    let
      safeBootstrapStartOrWait,
      jwtSecret;

    beforeEach(() => {
      jwtSecret = 'i-am-the-secret-now';

<<<<<<< HEAD
      internalIndexBootstrap.createInternalCollections = sinon.stub().resolves();
=======
      internalIndexBootstrap.createInternalIndex = sinon.stub().resolves();
>>>>>>> 2-dev
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
<<<<<<< HEAD
=======
        internalIndexBootstrap.createInternalIndex,
>>>>>>> 2-dev
        SafeBootstrap.prototype.startOrWait,
        internalIndexBootstrap._getJWTSecret
      );

<<<<<<< HEAD
      should(kuzzle.config.security.jwt.secret)
=======
      should(internalIndexBootstrap.kuzzle.config.security.jwt.secret)
>>>>>>> 2-dev
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
<<<<<<< HEAD
        internalIndexStorage.create
=======
        internalIndexEngine.create
>>>>>>> 2-dev
      );
    });
  });

<<<<<<< HEAD
=======
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

>>>>>>> 2-dev
  describe('#createInitialSecurities', () => {
    it('should create initial roles and profiles', async () => {
      await internalIndexBootstrap.createInitialSecurities();

<<<<<<< HEAD
      should(internalIndexStorage.createOrReplace.callCount).be.eql(6);
      should(internalIndexStorage.createOrReplace.getCall(0).args[0])
        .be.eql('roles');
      should(internalIndexStorage.createOrReplace.getCall(3).args[0])
=======
      should(internalIndexEngine.createOrReplace.callCount).be.eql(6);
      should(internalIndexEngine.createOrReplace.getCall(0).args[0])
        .be.eql('roles');
      should(internalIndexEngine.createOrReplace.getCall(3).args[0])
>>>>>>> 2-dev
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

<<<<<<< HEAD
      should(internalIndexStorage.createOrReplace.callCount).be.eql(2);
      should(internalIndexStorage.createOrReplace.getCall(0).args).be.eql([
=======
      should(internalIndexEngine.createOrReplace.callCount).be.eql(2);
      should(internalIndexEngine.createOrReplace.getCall(0).args).be.eql([
>>>>>>> 2-dev
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
<<<<<<< HEAD
      should(internalIndexStorage.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalIndexStorage.get.resolves({ _source: { seed: 'i-am-another-secret' } });
=======
      should(internalIndexEngine.get).not.be.called();
    });

    it('should get the secret from storage if it exists', async () => {
      internalIndexEngine.get.resolves({ _source: { seed: 'i-am-another-secret' } });
>>>>>>> 2-dev

      const jwt = await internalIndexBootstrap._getJWTSecret();

      should(jwt).be.eql('i-am-another-secret');
<<<<<<< HEAD
      should(internalIndexStorage.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
=======
      should(internalIndexEngine.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
>>>>>>> 2-dev
    });

    it('should reject if the JWT does not exists', () => {
      const error = new Error('not found');
      error.status = 404;
<<<<<<< HEAD
      internalIndexStorage.get.rejects(error);
=======
      internalIndexEngine.get.rejects(error);
>>>>>>> 2-dev

      const promise = internalIndexBootstrap._getJWTSecret();

      return should(promise).be.rejectedWith({
        errorName: 'external.internal_engine.no_jwt_secret_available'
      })
        .then(() => {
<<<<<<< HEAD
          should(internalIndexStorage.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
=======
          should(internalIndexEngine.get).be.calledWith('config', internalIndexBootstrap._JWT_SECRET_ID);
>>>>>>> 2-dev
        });
    });
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      const jwt = await internalIndexBootstrap._persistJWTSecret();

<<<<<<< HEAD
      should(internalIndexStorage.create).be.calledWith(
=======
      should(internalIndexEngine.create).be.calledWith(
>>>>>>> 2-dev
        'config',
        internalIndexBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
      should(jwt).be.eql('i-am-the-secret');
    });

    it('should generate and persist a random secret', async () => {
      await internalIndexBootstrap._persistJWTSecret();

<<<<<<< HEAD
      should(internalIndexStorage.create).be.called();
    });
  });
});
=======
      should(internalIndexEngine.create).be.called();
    });
  });
});
>>>>>>> 2-dev
