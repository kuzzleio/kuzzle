const
  _ = require('lodash'),
  should = require('should'),
  sandbox = require('sinon').sandbox.create(),
  PluginRepository = require('../../../../../lib/api/core/models/repositories/pluginRepository'),
  Data = require('../../../../../lib/api/core/models/plugin/data'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

describe('models/repositories/pluginRepository', () => {
  const
    someObject = {_id: 'someId', some: {defined: 'object'}},
    someCollection = 'someCollection';
  let
    kuzzle,
    /** @type {PluginRepository} */
    pluginRepository;

  beforeEach(() => {
    sandbox.reset();
    kuzzle = new KuzzleMock();
    pluginRepository = new PluginRepository(kuzzle, 'pluginName');
    pluginRepository.init({
      databaseEngine: kuzzle.internalEngine
    });
  });

  describe('#constructor', () => {
    it('should construct and init object properly', () => {
      should(pluginRepository.index).be.equal('pluginName');
      should(pluginRepository.collection).be.equal(null);
      should(pluginRepository.ObjectConstructor).be.exactly(Data);
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

      return pluginRepository.create(someObject, someCollection)
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

      return pluginRepository.createOrReplace(someObject, someCollection)
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

      return pluginRepository.replace(someObject, someCollection)
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

      return pluginRepository.update(someObject, someCollection)
        .then(() => {
          should(updateStub.firstCall.args[0]).be.exactly(someCollection);
          should(updateStub.firstCall.args[1]).be.exactly('someId');
          should(updateStub.firstCall.args[2]).be.deepEqual(pluginRepository.serializeToDatabase(someObject));
        });
    });
  });

  describe('#error', () => {
    it('should reject an error if collection is not provided', () => {
      return should(pluginRepository.create(someObject)).be.rejectedWith(InternalError);
    });
  });
});
