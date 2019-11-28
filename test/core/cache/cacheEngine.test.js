'use strict';

const
  sinon = require('sinon'),
  should = require('should'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  CacheEngine = require('../../../lib/core/cache/cacheEngine');

describe('CacheEngine', () => {
  let
    cacheEngine,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    cacheEngine = new CacheEngine(kuzzle);
  });

  describe('#init', () => {
    it('should call cache client init method', async () => {
      cacheEngine.public.init = sinon.stub().resolves();
      cacheEngine.internal.init = sinon.stub().resolves();

      await cacheEngine.init();

      should(cacheEngine.public.init).be.called();
      should(cacheEngine.internal.init).be.called();
    });
  });
});
