'use strict';

const sinon = require('sinon');
const should = require('should');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const RedisClientMock = require('../../mocks/service/redisClient.mock');

const CacheEngine = require('../../../lib/core/cache/cacheEngine');

describe('CacheEngine', () => {
  let cacheEngine;
  let kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    cacheEngine = new CacheEngine(kuzzle);
    sinon.stub(cacheEngine.public);
    sinon.stub(cacheEngine.internal);
    cacheEngine.public.commands = new RedisClientMock();
    cacheEngine.internal.commands = new RedisClientMock();

    cacheEngine.internal.client = {
      defineCommand: sinon.stub().callsFake(name => {
        cacheEngine.internal.client[name] = sinon.stub().resolves();
      }),
    };
  });

  describe('#init', () => {
    it('should call cache client init method', async () => {
      await cacheEngine.init();

      should(cacheEngine.public.init).be.called();
      should(cacheEngine.internal.init).be.called();
    });

    it('should register "cache:internal" events', async () => {
      kuzzle.ask.restore();

      await cacheEngine.init();

      await kuzzle.ask('core:cache:internal:del', 'key');
      should(cacheEngine.internal.commands.del).calledWith('key');

      await kuzzle.ask('core:cache:internal:expire', 'key', 'ttl');
      should(cacheEngine.internal.commands.expire).calledWith('key', 'ttl');

      await kuzzle.ask('core:cache:internal:flushdb');
      should(cacheEngine.internal.commands.flushdb).called();

      await kuzzle.ask('core:cache:internal:info:get');
      should(cacheEngine.internal.info).called();

      await kuzzle.ask('core:cache:internal:get', 'key');
      should(cacheEngine.internal.commands.get).calledWith('key');

      await kuzzle.ask('core:cache:internal:mget', 'array');
      should(cacheEngine.internal.commands.mget).calledWith('array');

      await kuzzle.ask('core:cache:internal:persist', 'key');
      should(cacheEngine.internal.commands.persist).calledWith('key');

      await kuzzle.ask('core:cache:internal:searchKeys', 'pattern');
      should(cacheEngine.internal.searchKeys).calledWith('pattern');

      await kuzzle.ask('core:cache:internal:store', 'key', 'value', 'ttl');
      should(cacheEngine.internal.store).calledWith('key', 'value', 'ttl');

      // /!\ the "script:*" event tests below must be executed in order
      await kuzzle.ask('core:cache:internal:script:define', 'name', 'keys', 'script');
      should(cacheEngine.internal.client.defineCommand).calledWith('name', {
        lua: 'script',
        numberOfKeys: 'keys',
      });
      should(cacheEngine.internal.client.name).be.a.Function();

      await kuzzle.ask('core:cache:internal:script:execute', 'name', 'foo', 'bar');
      should(cacheEngine.internal.client.name).calledWith('foo', 'bar');
    });

    it('should register "cache:public" events', async () => {
      kuzzle.ask.restore();

      await cacheEngine.init();

      await kuzzle.ask('core:cache:public:del', 'key');
      should(cacheEngine.public.commands.del).calledWith('key');

      await kuzzle.ask('core:cache:public:execute', 'cmd', 'foo', 'bar', 'baz');
      should(cacheEngine.public.exec).calledWith('cmd', 'foo', 'bar', 'baz');

      await kuzzle.ask('core:cache:public:expire', 'key', 'ttl');
      should(cacheEngine.public.commands.expire).calledWith('key', 'ttl');

      await kuzzle.ask('core:cache:public:flushdb');
      should(cacheEngine.public.commands.flushdb).called();

      await kuzzle.ask('core:cache:public:info:get');
      should(cacheEngine.public.info).called();

      await kuzzle.ask('core:cache:public:get', 'key');
      should(cacheEngine.public.commands.get).calledWith('key');

      await kuzzle.ask('core:cache:public:mExecute', 'commands');
      should(cacheEngine.public.mExecute).calledWith('commands');

      await kuzzle.ask('core:cache:public:persist', 'key');
      should(cacheEngine.public.commands.persist).calledWith('key');

      await kuzzle.ask('core:cache:public:store', 'key', 'value', 'ttl');
      should(cacheEngine.public.store).calledWith('key', 'value', 'ttl');
    });
  });

  describe('#internal events', () => {
    beforeEach(() => {
      kuzzle.ask.restore();
      return cacheEngine.init();
    });

    describe('#mget', () => {
      it('should not invoke ioredis if an empty keys list is provided', async () => {
        const result = await kuzzle.ask('core:cache:internal:mget', []);

        should(cacheEngine.internal.commands.mget).not.called();
        should(result).be.an.Array().and.be.empty();
      });
    });
  });
});
