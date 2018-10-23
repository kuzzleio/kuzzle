const
  Bluebird = require('bluebird'),
  mockrequire = require('mock-require'),
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Bootstrap = require('../../../lib/services/internalEngine/pluginBootstrap');

describe('services/internalEngine/pluginBootstrap.js', () => {
  let
    kuzzle,
    bootstrap,
    engine;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    engine = kuzzle.internalEngine;
    engine.index = '%someIndex';

    bootstrap = new Bootstrap('pluginName', kuzzle, engine);
  });

  describe('#constructor', () => {
    it('should set the engine', () => {
      should(bootstrap.db).be.exactly(engine);
    });
  });

  describe('#all', () => {
    const collections = {
      first: 'collection',
      second: 'collection'
    };

    it('should call the proper submethods in proper order', () => {
      engine.createInternalIndex.returns(Bluebird.resolve());
      return bootstrap.all(collections)
        .then(() => {
          try {
            should(engine.createInternalIndex)
              .be.calledOnce();

            should(engine.updateMapping)
              .be.calledTwice();

            should(bootstrap.db.refresh)
              .be.calledOnce();

            should(kuzzle.indexCache.add)
              .be.calledOnce()
              .be.calledWithExactly(engine.index);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should throw if locked for too long', () => {
      mockrequire('bluebird', Object.assign(Bluebird, {delay: sinon.stub().returns(Bluebird.resolve())}));
      mockrequire.reRequire('../../../lib/services/internalEngine/pluginBootstrap');

      bootstrap.lock = sinon.stub().returns(Bluebird.resolve(true));
      kuzzle.internalEngine.exists.returns(Bluebird.resolve(true));

      return bootstrap.all()
        .then(() => { throw new Error('should not happen'); })
        .catch(error => {
          should(error.message).match(/^Plugin pluginName bootstrap - lock wait timeout exceeded/);
        })
        .finally(() => {
          mockrequire.stop('bluebird');
          mockrequire.reRequire('../../../lib/services/internalEngine/pluginBootstrap');
        });
    });

  });

  describe('#lock', () => {
    it('should create a new lock if some old one is found', () => {
      kuzzle.internalEngine.create.rejects();
      kuzzle.internalEngine.get.returns(Bluebird.resolve({_source: {timestamp: 0}}));

      return bootstrap.lock()
        .then(isLocked => {
          should(isLocked).be.false();

          should(kuzzle.internalEngine.createOrReplace)
            .be.calledOnce()
            .be.calledWith('config', 'bootstrap-lock-bba3dedad8ca21312221410b7cdef353');
        });
    });

    it('should create a new lock if the previous one is in the future', () => {
      kuzzle.internalEngine.create.rejects();
      kuzzle.internalEngine.get.returns(Bluebird.resolve({_source: {timestamp: Number.MAX_SAFE_INTEGER}}));

      return bootstrap.lock()
        .then(isLocked => {
          should(isLocked).be.false();

          should(kuzzle.internalEngine.createOrReplace)
            .be.calledOnce()
            .be.calledWith('config', 'bootstrap-lock-bba3dedad8ca21312221410b7cdef353');
        });
    });
  });
});
