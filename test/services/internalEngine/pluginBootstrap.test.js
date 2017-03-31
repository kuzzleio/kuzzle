const
  rewire = require('rewire'),
  sandbox = require('sinon').sandbox.create(),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Bootstrap = rewire('../../../lib/services/internalEngine/pluginBootstrap');

describe('services/internalEngine/pluginBootstrap.js', () => {
  let
    kuzzle,
    bootstrap,
    engine;

  before(() => {
    kuzzle = new KuzzleMock();

    Bootstrap.__set__({
      console: {error: sandbox.spy()}
    });

    engine = {
      updateMapping: sandbox.stub().returns(Promise.resolve()),
      createInternalIndex: sandbox.stub(),
      refresh: sandbox.stub().returns(Promise.resolve()),
      index: '%someIndex'
    };
  });

  beforeEach(() => {
    sandbox.reset();
    bootstrap = new Bootstrap(kuzzle, engine);
  });

  describe('#constructor', () => {
    it('should set the engine to kuzzle internal engine', () => {
      should(bootstrap.engine).be.exactly(engine);
    });
  });

  describe('#all', () => {
    const collections = {
      first: 'collection',
      second: 'collection'
    };

    it('should call the proper submethods in proper order', () => {
      engine.createInternalIndex.returns(Promise.resolve());
      return bootstrap.all(collections)
        .then(() => {
          try {
            should(engine.createInternalIndex)
              .be.calledOnce();

            should(engine.updateMapping)
              .be.calledTwice();

            should(bootstrap.engine.refresh)
              .be.calledOnce();

            should(kuzzle.indexCache.add)
              .be.calledOnce()
              .be.calledWithExactly(engine.index);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should print errors to the console', done => {
      const error = new Error('error message');

      engine.createInternalIndex.returns(Promise.reject(error));

      bootstrap.all()
        .catch(err => {
          const spy = Bootstrap.__get__('console.error');

          should(err).be.exactly(error);

          should(spy)
            .be.calledOnce()
            .be.calledWithExactly(error, error.stack);

          done();
        });

    });
  });
});