'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  mockrequire = require('mock-require'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  ClientAdapterMock = require('../../../../mocks/clientAdapter.mock'),
  BaseModel = require('../../../../../lib/api/core/storage/models/baseModel'),
  ApiKey = require('../../../../../lib/api/core/storage/models/apiKey');

describe('ApiKey', () => {
  let
    StorageEngine,
    storageEngine,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    mockrequire('../../../../../lib/api/core/storage/clientAdapter', ClientAdapterMock);

    StorageEngine = mockrequire.reRequire('../../../../../lib/api/core/storage/storageEngine');
    storageEngine = new StorageEngine(kuzzle);

    storageEngine._populateIndexCache = sinon.stub().resolves();

    return storageEngine.init();
  });

  describe('ApiKey.create', () => {
    let
      saveStub,
      user,
      token;

    beforeEach(() => {
      user = {
        _id: 'mylehuong'
      };

      token = {
        jwt: 'jwt-token-encrypted',
        ttl: '1y',
        expiresAt: 42
      };

      BaseModel.kuzzle.repositories.token.generateToken.resolves(token);
      BaseModel.kuzzle.constructor.hash =
        sinon.stub().returns('hashed-jwt-token');

      saveStub = sinon.stub(ApiKey.prototype, 'save').resolves();
    });

    it('should create a new API key and generate a token', async () => {
      const apiKey = await ApiKey.create(
        user,
        'connectionId',
        'expiresIn',
        'Sigfox API key',
        { creatorId: 'aschen', refresh: 'wait_for' });

      should(BaseModel.kuzzle.repositories.token.generateToken).be.calledWith(
        user,
        'connectionId',
        { expiresIn: 'expiresIn', bypassMaxTTL: true });

      should(saveStub)
        .be.calledWith({ userId: 'aschen', refresh: 'wait_for' });

      should(apiKey._source).be.eql({
        description: 'Sigfox API key',
        userId: 'mylehuong',
        expiresAt: 42,
        ttl: '1y',
        token: 'jwt-token-encrypted'
      });
    });

    it('should allow to specify the API key ID', async () => {
      const apiKey = await ApiKey.create(
        user,
        'connectionId',
        'expiresIn',
        'Sigfox API key',
        { apiKeyId: 'my-api-key-id' });

      should(apiKey._id).be.eql('my-api-key-id');
    });
  });

  describe('ApiKey.load', () => {
    it('should throw if the key does not belong to the provided user', async () => {
      const loadStub = sinon.stub(BaseModel, 'load').resolves({ userId: 'mylehuong' });

      const promise = ApiKey.load('aschen', 'api-key-id');

      await should(promise).be.rejectedWith({ id: 'services.storage.not_found' });

      should(loadStub).be.calledWith('api-key-id');
    });
  });

  describe('ApiKey.deleteByUser', () => {
    it('should call BaseModel.deleteByQuery with the correct query', async () => {
      const
        user = { _id: 'mylehuong' },
        deleteByQueryStub = sinon.stub(ApiKey, 'deleteByQuery').resolves();

      await ApiKey.deleteByUser(user, { refresh: 'wait_for' });

      should(deleteByQueryStub).be.calledWith(
        { term: { userId: 'mylehuong' } },
        { refresh: 'wait_for' });
    });
  });

  describe('#_afterDelete', () => {
    it('should delete the corresponding token', async () => {
      const
        token = { _id: 'token-id' },
        apiKey = new ApiKey({ token: 'encrypted-token' });
      kuzzle.repositories.token.verifyToken.resolves(token);

      await apiKey._afterDelete();

      should(kuzzle.repositories.token.verifyToken).be.calledWith('encrypted-token');
      should(kuzzle.repositories.token.expire).be.calledWith(token);
    });
  });

  describe('#serialize', () => {
    it('should return the apiKey without the token if specified', () => {
      const
        apiKey = new ApiKey(
          { token: 'encrypted-token', userId: 'mylehuong' },
          'api-key-id'),
        apiKey2 = new ApiKey(
          { token: 'encrypted-token', userId: 'mylehuong' },
          'api-key-id2');

      const serialized = apiKey.serialize();
      const serialized2 = apiKey2.serialize({ includeToken: true });

      should(serialized).be.eql({
        _id: 'api-key-id',
        _source: { userId: 'mylehuong' }
      });

      should(serialized2).be.eql({
        _id: 'api-key-id2',
        _source: { userId: 'mylehuong', token: 'encrypted-token' }
      });
    });
  });
});