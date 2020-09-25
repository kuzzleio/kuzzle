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
    it('should proxify persistToDatabase with method create properly', async () => {
      await pluginRepository.create(someObject);

      const args = kuzzle.ask
        .withArgs('core:store:private:document:create')
        .firstCall
        .args;

      should(args[1]).be.exactly(pluginRepository.index);
      should(args[2]).be.exactly(someCollection);
      should(args[3]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
      should(args[4]).match({ id: 'someId' });
    });
  });

  describe('#createOrReplace', () => {
    it('should proxify persistToDatabase with method createOrReplace properly', async () => {
      await pluginRepository.createOrReplace(someObject);

      const args = kuzzle.ask
        .withArgs('core:store:private:document:createOrReplace')
        .firstCall
        .args;

      should(args[1]).be.exactly(pluginRepository.index);
      should(args[2]).be.exactly(someCollection);
      should(args[3]).be.exactly('someId');
      should(args[4]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
    });
  });

  describe('#replace', () => {
    it('should proxify persistToDatabase with method replace properly', async () => {
      await pluginRepository.replace(someObject);

      const args = kuzzle.ask
        .withArgs('core:store:private:document:replace')
        .firstCall
        .args;

      should(args[1]).be.exactly(pluginRepository.index);
      should(args[2]).be.exactly(someCollection);
      should(args[3]).be.exactly('someId');
      should(args[4]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
    });
  });

  describe('#update', () => {
    it('should proxify persistToDatabase with method update properly', async () => {
      await pluginRepository.update(someObject);

      const args = kuzzle.ask
        .withArgs('core:store:private:document:update')
        .firstCall
        .args;

      should(args[1]).be.exactly(pluginRepository.index);
      should(args[2]).be.exactly(someCollection);
      should(args[3]).be.exactly('someId');
      should(args[4]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
    });
  });

  describe('#delete', () => {
    it('should call parent method delete with proper arguments', async () => {
      await pluginRepository.delete('someId', {refresh: 'wait_for'});

      const args = kuzzle.ask
        .withArgs('core:store:private:document:delete')
        .firstCall
        .args;

      should(args[1]).be.exactly(pluginRepository.index);
      should(args[2]).be.exactly(someCollection);
      should(args[3]).be.exactly('someId');
      should(args[4]).be.deepEqual({refresh: 'wait_for'});
    });
  });
});
