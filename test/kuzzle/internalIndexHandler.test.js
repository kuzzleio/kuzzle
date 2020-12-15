'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const { TimeoutError } = require('bluebird');

const { InternalError: KuzzleInternalError } = require('../../index');
const KuzzleMock = require('../mocks/kuzzle.mock');
const MutexMock = require('../mocks/mutex.mock');

const ApiKey = require('../../lib/model/storage/apiKey');

describe('#kuzzle/InternalIndexHandler', () => {
  let InternalIndexHandler;
  let internalIndexHandler;
  let kuzzle;
  let internalIndexName;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    internalIndexHandler = new InternalIndexHandler();
    sinon.stub(ApiKey, 'batchExecute');

    internalIndexName = kuzzle.config.services.storageEngine.internalIndex.name;
  });

  afterEach(() => {
    ApiKey.batchExecute.restore();
  });

  describe('#init', () => {
    before(() => {
      mockrequire('../../lib/util/mutex', MutexMock);

      // the shared object "Store" also uses mutexes that we need to mock
      mockrequire.reRequire('../../lib/core/shared/store');

      InternalIndexHandler = mockrequire.reRequire('../../lib/kuzzle/internalIndexHandler');
    });

    after(() => {
      mockrequire.stopAll();
    });

    it('should initialize internal collections', async () => {
      const collections = {
        foo: { name: 'foo' },
        bar: { name: 'bar' },
        baz: { name: 'baz' },
      };

      kuzzle.config.services.storageEngine.internalIndex = {
        collections,
        name: 'fooindex',
      };

      internalIndexHandler = new InternalIndexHandler();

      await internalIndexHandler.init();

      should(kuzzle.ask).calledWith(
        'core:storage:private:collection:create',
        'fooindex',
        'foo',
        { mappings: collections.foo });

      should(kuzzle.ask).calledWith(
        'core:storage:private:collection:create',
        'fooindex',
        'bar',
        { mappings: collections.bar });

      should(kuzzle.ask).calledWith(
        'core:storage:private:collection:create',
        'fooindex',
        'baz',
        { mappings: collections.baz });
    });

    it('should bootstrap if able to acquire a mutex lock', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:exist').resolves(false);

      sinon.stub(internalIndexHandler, '_bootstrapSequence').resolves();

      await internalIndexHandler.init();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:exist',
        internalIndexName,
        'config',
        internalIndexHandler._BOOTSTRAP_DONE_ID);

      const mutex = MutexMock.__getLastMutex();

      should(mutex.lockId).eql('InternalIndexBootstrap');
      should(mutex.lock).calledOnce();
      should(mutex.unlock).calledOnce();

      should(internalIndexHandler._bootstrapSequence).calledOnce();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match.object,
        { id: internalIndexHandler._BOOTSTRAP_DONE_ID });
    });

    it('should not bootstrap if the bootstrap document is present', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:exist').resolves(true);

      sinon.stub(internalIndexHandler, '_bootstrapSequence').resolves();

      await internalIndexHandler.init();

      should(internalIndexHandler._bootstrapSequence).not.called();

      should(kuzzle.ask).not.calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match.object,
        { id: internalIndexHandler._BOOTSTRAP_DONE_ID });
    });

    it('should not mark the indexes as bootstrapped if a failure occured', async () => {
      const err = new Error();
      sinon.stub(internalIndexHandler, '_bootstrapSequence').rejects(err);

      kuzzle.ask.withArgs('core:storage:private:document:exist').resolves(false);

      await should(internalIndexHandler.init()).rejectedWith(err);

      should(kuzzle.ask).not.calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match.object,
        { id: internalIndexHandler._BOOTSTRAP_DONE_ID });
    });

    it('should wrap bootstrap timeout errors', async () => {
      const err = new TimeoutError();

      sinon.stub(internalIndexHandler, '_bootstrapSequence').rejects(err);

      kuzzle.ask.withArgs('core:storage:private:document:exist').resolves(false);

      await should(internalIndexHandler.init())
        .rejectedWith(KuzzleInternalError, { id: 'services.storage.bootstrap_timeout' });

      should(kuzzle.ask).not.calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match({ timestamp: sinon.match.number }),
        { id: internalIndexHandler._BOOTSTRAP_DONE_ID });
    });
  });

  describe('#_bootstrapSequence', () => {
    it('should trigger a complete bootstrap of the internal structures', async () => {
      sinon.stub(internalIndexHandler, 'createInitialSecurities');
      sinon.stub(internalIndexHandler, 'createInitialValidations');
      sinon.stub(internalIndexHandler, '_persistSecret');
      sinon.stub(internalIndexHandler, '_loadApiKeys');

      await internalIndexHandler._bootstrapSequence();

      should(internalIndexHandler.createInitialSecurities).called();
      should(internalIndexHandler.createInitialValidations).called();
      should(internalIndexHandler._persistSecret).called();
      should(internalIndexHandler._loadApiKeys).called();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match({ version: sinon.match.string }),
        { id: internalIndexHandler._DATAMODEL_VERSION_ID });
    });
  });

  describe('#createInitialSecurities', () => {
    it('should bootstrap default roles', async () => {
      await internalIndexHandler.createInitialSecurities();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'roles',
        'admin',
        {
          controllers: {
            '*': {
              actions: {
                '*': true,
              },
            },
          },
        },
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'roles',
        'default',
        {
          controllers: {
            '*': {
              actions: {
                '*': true,
              },
            },
          },
        },
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'roles',
        'anonymous',
        {
          controllers: {
            '*': {
              actions: {
                '*': true,
              },
            },
          },
        },
        { refresh: 'wait_for' });
    });

    it('should bootstrap default profiles', async () => {
      await internalIndexHandler.createInitialSecurities();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'profiles',
        'admin',
        {
          policies: [ { roleId: 'admin' } ],
          rateLimit: 0,
        },
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'profiles',
        'default',
        {
          policies: [ { roleId: 'default' } ],
        },
        { refresh: 'wait_for' });

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'profiles',
        'anonymous',
        {
          policies: [ { roleId: 'anonymous' } ],
        },
        { refresh: 'wait_for' });
    });
  });

  describe('#createInitialValidations', () => {
    it('should bootstrap default validation rules', async () => {
      kuzzle.config.validation = {
        index: {
          collection: {
            foo: 'bar',
          },
        },
      };

      await internalIndexHandler.createInitialValidations();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:createOrReplace',
        internalIndexName,
        'validations',
        'index#collection',
        kuzzle.config.validation.index.collection);
    });
  });

  describe('#_persistSecret', () => {
    const randomBytesMock = sinon.stub().returns(Buffer.from('12345'));

    before(() => {
      mockrequire('crypto', {
        randomBytes: randomBytesMock,
      });

      InternalIndexHandler = mockrequire.reRequire('../../lib/kuzzle/internalIndexHandler');
    });

    after(() => {
      mockrequire.stop('crypto');
    });

    beforeEach(() => {
      randomBytesMock.resetHistory();
    });

    it('should use the configured seed, if one is present', async () => {
      kuzzle.config.security.jwt.secret = 'foobar';

      await internalIndexHandler._persistSecret();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match({ seed: 'foobar' }),
        { id: internalIndexHandler._JWT_SECRET_ID });

      should(randomBytesMock).not.called();
    });

    it('should auto-generate a new random seed if none is present in the config file', async () => {
      await internalIndexHandler._persistSecret();

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:create',
        internalIndexName,
        'config',
        sinon.match({ seed: randomBytesMock().toString('hex') }),
        { id: internalIndexHandler._JWT_SECRET_ID });

      should(randomBytesMock).calledWith(512);
    });

    it('should forward document creation rejections', () => {
      const err = new Error();

      kuzzle.ask.withArgs('core:storage:private:document:create').rejects(err);

      return should(internalIndexHandler._persistSecret()).rejectedWith(err);
    });
  });

  describe('#getSecret', () => {
    it('should fetch the secret seed from the storage space', async () => {
      kuzzle.ask.withArgs('core:storage:private:document:get').resolves({
        _source: {
          seed: 'foobar',
        },
      });

      await should(internalIndexHandler.getSecret()).fulfilledWith('foobar');

      should(kuzzle.ask).calledWith(
        'core:storage:private:document:get',
        internalIndexName,
        'config',
        internalIndexHandler._JWT_SECRET_ID);
    });
  });

  describe('#_loadApiKeys', () => {
    it('should load API key tokens to Redis cache', async () => {
      ApiKey.batchExecute.callsArgWith(1, [
        { _source: { token: 'encoded-token-1', userId: 'user-id-1', ttl: 42 } },
        { _source: { token: 'encoded-token-2', userId: 'user-id-2', ttl: -1 } },
      ]);

      await internalIndexHandler._loadApiKeys();

      should(ApiKey.batchExecute).be.calledWith({ match_all: {} });

      const tokenAssignEvent = 'core:security:token:assign';

      should(kuzzle.ask)
        .be.calledWith(tokenAssignEvent, 'encoded-token-1', 'user-id-1', 42)
        .be.calledWith(tokenAssignEvent, 'encoded-token-2', 'user-id-2', -1);
    });
  });
});
