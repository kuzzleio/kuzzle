'use strict';

const should = require('should');
const sinon = require('sinon');
const mockrequire = require('mock-require');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const ClientAdapterMock = require('../../mocks/clientAdapter.mock');

const BaseModel = require('../../../lib/model/storage/baseModel');
const ApiKey = require('../../../lib/model/storage/apiKey');

describe('ApiKey', () => {
  let StorageEngine;
  let storageEngine;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    mockrequire('../../../lib/core/storage/clientAdapter', ClientAdapterMock);

    StorageEngine = mockrequire.reRequire('../../../lib/core/storage/storageEngine');
    storageEngine = new StorageEngine();

    return storageEngine.init();
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('ApiKey.create', () => {
    const createTokenEvent = 'core:security:token:create';
    let saveStub;
    let user;
    let token;
    let createTokenStub;

    beforeEach(() => {
      user = {
        _id: 'mylehuong'
      };

      token = {
        jwt: 'jwt-token-encrypted',
        ttl: '1y',
        expiresAt: 42
      };

      createTokenStub = kuzzle.ask
        .withArgs(createTokenEvent)
        .resolves(token);

      kuzzle.hash.returns('hashed-jwt-token');

      saveStub = sinon.stub(ApiKey.prototype, 'save').resolves();
    });

    it('should create a new API key and generate a token', async () => {
      const apiKey = await ApiKey.create(
        user,
        'expiresIn',
        'Sigfox API key',
        { creatorId: 'aschen', refresh: 'wait_for' });

      should(createTokenStub).be.calledWith(
        createTokenEvent,
        user,
        { expiresIn: 'expiresIn', bypassMaxTTL: true });

      should(saveStub)
        .be.calledWith({ userId: 'aschen', refresh: 'wait_for' });

      should(apiKey._source).match({
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
      const user = { _id: 'mylehuong' };
      const deleteByQueryStub = sinon.stub(ApiKey, 'deleteByQuery').resolves();

      await ApiKey.deleteByUser(user, { refresh: 'wait_for' });

      should(deleteByQueryStub).be.calledWith(
        { term: { userId: 'mylehuong' } },
        { refresh: 'wait_for' });
    });
  });

  describe('#_afterDelete', () => {
    it('should delete the corresponding token', async () => {
      const token = { _id: 'token-id' };
      const apiKey = new ApiKey({ token: 'encrypted-token', userId: 'userId' });
      const getTokenStub = kuzzle.ask
        .withArgs('core:security:token:get', 'userId', 'encrypted-token')
        .resolves(token);

      await apiKey._afterDelete();

      should(getTokenStub).calledOnce();
      should(kuzzle.ask).be.calledWith('core:security:token:delete', token);
    });
  });

  describe('#serialize', () => {
    it('should return the apiKey without the token if specified', () => {
      const apiKey = new ApiKey(
        { token: 'encrypted-token', userId: 'mylehuong' },
        'api-key-id');
      const apiKey2 = new ApiKey(
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
