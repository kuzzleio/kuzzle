'use strict';

const should = require('should');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const PluginRepository = require('../../../lib/core/plugin/pluginRepository');
const cacheDbEnum = require('../../../lib/core/cache/cacheDbEnum');
const scopeEnum = require('../../../lib/core/storage/storeScopeEnum');
const Store = require('../../../lib/core/shared/store');

describe('core/plugin/pluginRepository', () => {
  const someObject = {_id: 'someId', some: {defined: 'object'}};
  const someCollection = 'someCollection';
  const SomeConstructor = function () {};
  let kuzzle;
  let store;
  let pluginRepository;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    store = new Store(kuzzle, 'pluginName', scopeEnum.PRIVATE);

    pluginRepository = new PluginRepository(kuzzle, store, someCollection);
    pluginRepository.init({
      ObjectConstructor: SomeConstructor,
    });
  });

  describe('#constructor', () => {
    it('should construct and init object properly', () => {
      should(pluginRepository.index).be.equal('pluginName');
      should(pluginRepository.collection).be.equal(someCollection);
      should(pluginRepository.ObjectConstructor).be.exactly(SomeConstructor);
      should(pluginRepository.store).be.exactly(store);
      should(pluginRepository.cacheDb).be.exactly(cacheDbEnum.NONE);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should copy the argument and remove _id from the copy serializeToCache', () => {
      const copy = Object.assign({}, someObject);

      delete copy._id;

      should(pluginRepository.serializeToDatabase(someObject)).be.deepEqual(copy);
    });
  });

  describe('#create', () => {
    it('should proxify persistToDatabase with method create properly', () => {
      const createStub = kuzzle.internalIndex.create;

      return pluginRepository.create(someObject)
        .then(() => {
          should(createStub.firstCall.args[0]).be.exactly(someCollection);
          should(createStub.firstCall.args[1]).be.exactly('someId');
          should(createStub.firstCall.args[2]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
        });
    });
  });

  describe('#createOrReplace', () => {
    it('should proxify persistToDatabase with method createOrReplace properly', () => {
      const createOrReplaceStub = kuzzle.internalIndex.createOrReplace;

      return pluginRepository.createOrReplace(someObject)
        .then(() => {
          should(createOrReplaceStub.firstCall.args[0]).be.exactly(someCollection);
          should(createOrReplaceStub.firstCall.args[1]).be.exactly('someId');
          should(createOrReplaceStub.firstCall.args[2]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
        });
    });
  });

  describe('#replace', () => {
    it('should proxify persistToDatabase with method replace properly', () => {
      const replaceStub = kuzzle.internalIndex.replace;

      return pluginRepository.replace(someObject)
        .then(() => {
          should(replaceStub.firstCall.args[0]).be.exactly(someCollection);
          should(replaceStub.firstCall.args[1]).be.exactly('someId');
          should(replaceStub.firstCall.args[2]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
        });
    });
  });

  describe('#update', () => {
    it('should proxify persistToDatabase with method update properly', () => {
      const updateStub = kuzzle.internalIndex.update;

      return pluginRepository.update(someObject)
        .then(() => {
          should(updateStub.firstCall.args[0]).be.exactly(someCollection);
          should(updateStub.firstCall.args[1]).be.exactly('someId');
          should(updateStub.firstCall.args[2]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
        });
    });
  });

  describe('#delete', () => {
    it('should call parent method delete with proper arguments', () => {
      const deleteStub = kuzzle.internalIndex.delete;

      return pluginRepository.delete('someId', {refresh: 'wait_for'})
        .then(() => {
          should(deleteStub.firstCall.args[0]).be.exactly(someCollection);
          should(deleteStub.firstCall.args[1]).be.exactly('someId');
          should(deleteStub.firstCall.args[2]).be.deepEqual({refresh: 'wait_for'});
        });
    });
  });
});
