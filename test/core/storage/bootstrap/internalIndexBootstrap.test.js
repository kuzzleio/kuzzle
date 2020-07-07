'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const IndexStorageMock = require('../../../mocks/indexStorage.mock');
const ClientAdapterMock = require('../../../mocks/clientAdapter.mock');
const ApiKey = require('../../../../lib/model/storage/apiKey');
const SafeBootstrap = require('../../../../lib/core/storage/bootstrap/safeBootstrap');
const InternalIndexBootstrap = require('../../../../lib/core/storage/bootstrap/internalIndexBootstrap');

describe('InternalIndexBootstrap', () => {
  let storageEngine;
  let StorageEngine;
  let internalIndexName;
  let internalIndexStorage;
  let internalIndexBootstrap;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    internalIndexStorage = new IndexStorageMock(
      internalIndexName,
      kuzzle.storageEngine.internal);

    kuzzle.config.services.internalIndex.bootstrapLockTimeout = 42000;

    internalIndexBootstrap = new InternalIndexBootstrap(
      kuzzle,
      internalIndexStorage);

    mockrequire('../../../../lib/core/storage/clientAdapter', ClientAdapterMock);

    StorageEngine = mockrequire.reRequire('../../../../lib/core/storage/storageEngine');
    storageEngine = new StorageEngine(kuzzle);

    storageEngine._populateIndexCache = sinon.stub().resolves();

    return storageEngine.init();
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
      const ret = await internalIndexBootstrap.createInitialSecurities();

      should(internalIndexStorage.createOrReplace.callCount).be.eql(6);
      should(internalIndexStorage.createOrReplace.getCall(0).args[0])
        .be.eql('roles');
      should(internalIndexStorage.createOrReplace.getCall(3).args[0])
        .be.eql('profiles');
      should(ret).be.eql({
        profileIds: ['admin', 'anonymous', 'default'],
        roleIds: ['admin', 'anonymous', 'default']
      });
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
  });

  describe('#_persistJWTSecret', () => {
    it('should persist the secret from the memory if it\'s exists', async () => {
      kuzzle.config.security.jwt.secret = 'i-am-the-secret';

      await internalIndexBootstrap._persistJWTSecret();

      should(internalIndexStorage.create).be.calledWith(
        'config',
        internalIndexBootstrap._JWT_SECRET_ID,
        { seed: 'i-am-the-secret' });
    });

    it('should generate and persist a random secret', async () => {
      await internalIndexBootstrap._persistJWTSecret();

      should(internalIndexStorage.create).be.called();
    });
  });

  describe('#_loadApiKeys', () => {
    it('should load API key tokens to Redis cache', async () => {
      const batchExecuteStub = sinon
        .stub(ApiKey, 'batchExecute')
        .callsArgWith(1, [
          { _source: { token: 'encoded-token-1', userId: 'user-id-1', ttl: 42 } },
          { _source: { token: 'encoded-token-2', userId: 'user-id-2', ttl: -1 } }
        ]);

      await internalIndexBootstrap._loadApiKeys();

      should(batchExecuteStub).be.calledWith({ match_all: {} });

      const tokenAssignEvent = 'core:security:token:assign';

      should(kuzzle.ask)
        .be.calledWith(tokenAssignEvent, 'encoded-token-1', 'user-id-1', 42)
        .be.calledWith(tokenAssignEvent, 'encoded-token-2', 'user-id-2', -1);
    });
  });
});
