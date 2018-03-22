const
  _ = require('lodash'),
  should = require('should'),
  sandbox = require('sinon').sandbox.create(),
  PluginRepository = require('../../../../../lib/api/core/models/repositories/pluginRepository'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock');

describe('models/repositories/pluginRepository', () => {
  const
    someObject = {_id: 'someId', some: {defined: 'object'}},
    someCollection = 'someCollection',
    SomeConstructor = function () {};
  let
    kuzzle,
    /** @type {PluginRepository} */
    pluginRepository;

  beforeEach(() => {
    sandbox.resetHistory();
    kuzzle = new KuzzleMock();
    pluginRepository = new PluginRepository(kuzzle, 'pluginName', someCollection);
    pluginRepository.init({
      databaseEngine: kuzzle.internalEngine,
      ObjectConstructor: SomeConstructor
    });
  });

  describe('#constructor', () => {
    it('should construct and init object properly', () => {
      should(pluginRepository.index).be.equal('pluginName');
      should(pluginRepository.collection).be.equal(someCollection);
      should(pluginRepository.ObjectConstructor).be.exactly(SomeConstructor);
      should(pluginRepository.databaseEngine).be.exactly(kuzzle.internalEngine);
      should(pluginRepository.cacheEngine).be.exactly(null);
    });
  });

  describe('#serializeToDatabase', () => {
    it('should copy the argument and remove _id from the copy serializeToCache', () => {
      let copy = {};
      _.assign(copy, someObject);

      delete copy._id;

      should(pluginRepository.serializeToDatabase(someObject)).be.deepEqual(copy);
    });
  });

  describe('#create', () => {
    it('should proxify persistToDatabase with method create properly', () => {
      const createStub = kuzzle.internalEngine.create;

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
      const createOrReplaceStub = kuzzle.internalEngine.createOrReplace;

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
      const replaceStub = kuzzle.internalEngine.replace;

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
      const updateStub = kuzzle.internalEngine.update;

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
      const deleteStub = kuzzle.internalEngine.delete;

      return pluginRepository.delete('someId', {refresh: 'wait_for'})
        .then(() => {
          should(deleteStub.firstCall.args[0]).be.exactly(someCollection);
          should(deleteStub.firstCall.args[1]).be.exactly('someId');
          should(deleteStub.firstCall.args[2]).be.deepEqual({refresh: 'wait_for'});
        });
    });
  });
});
