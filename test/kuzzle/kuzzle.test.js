'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const rewire = require('rewire');
const Kuzzle = rewire('../../lib/kuzzle/kuzzle');
const KuzzleMock = require('../mocks/kuzzle.mock');

describe('/lib/kuzzle/kuzzle.js', () => {
  let kuzzle;

  const mockedProperties = [
    'entryPoints',
    'funnel',
    'router',
    'notifier',
    'gc',
    'pluginsManager',
    'adminController',
    'repositories',
    'services',
    'statistics',
    'validation',
    'emit',
    'vault',
    'log',
    'internalIndex',
    'cacheEngine',
    'storageEngine',
    'dump',
    'shutdown',
    'pipe',
  ];

  function _mockKuzzle (KuzzleConstructor) {
    const mock = new KuzzleMock();
    const k = new KuzzleConstructor();

    mockedProperties.forEach(p => {
      k[p] = mock[p];
    });

    return k;
  }

  beforeEach(() => {
    kuzzle = _mockKuzzle(Kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  it('should build a kuzzle server object with emit and listen event', done => {
    kuzzle.on('event', done);
    kuzzle.emit('event');
  });

  describe('#start', () => {
    it('should init the components in proper order', async () => {
      const params = {
        mappings: {},
        fixtures: {},
        securities: {}
      };

      await kuzzle.start(params);

      sinon.assert.callOrder(
        kuzzle.cacheEngine.init,
        kuzzle.log.info, // cacheEngine init
        kuzzle.storageEngine.init,
        kuzzle.internalIndex.init,
        kuzzle.log.info, // storageEngine init
        kuzzle.validation.init,
        kuzzle.repositories.init,
        kuzzle.funnel.init,
        kuzzle.storageEngine.public.loadMappings,
        kuzzle.storageEngine.public.loadFixtures,
        kuzzle.pluginsManager.init,
        kuzzle.pluginsManager.run,
        kuzzle.log.info, // core components loaded
        kuzzle.log.info, // load default rights
        kuzzle.repositories.loadSecurities,
        kuzzle.log.info, // default rights loaded
        kuzzle.router.init,
        kuzzle.statistics.init,
        kuzzle.validation.curateSpecification,
        kuzzle.repositories.role.sanityCheck,
        kuzzle.pipe, // kuzzle:start
        kuzzle.entryPoint.init,
        kuzzle.emit // core:kuzzleStart
      );
    });

    it('should start all services and register errors handlers if enabled on kuzzle.start', () => {
      let
        processExitSpy = sinon.spy(),
        processOnSpy = sinon.spy(),
        processRemoveAllListenersSpy = sinon.spy();

      return Kuzzle.__with__({
        process: {
          env: {},
          exit: processExitSpy,
          on: processOnSpy,
          emit: sinon.stub(),
          removeAllListeners: processRemoveAllListenersSpy
        }
      })(() => {
        kuzzle = _mockKuzzle(Kuzzle);
        return kuzzle.start();
      })
        .then(() => {
          should(processRemoveAllListenersSpy.getCall(0).args[0]).be.exactly('unhandledRejection');
          should(processOnSpy.getCall(0).args[0]).be.exactly('unhandledRejection');

          should(processRemoveAllListenersSpy.getCall(1).args[0]).be.exactly('uncaughtException');
          should(processOnSpy.getCall(1).args[0]).be.exactly('uncaughtException');

          should(processRemoveAllListenersSpy.getCall(2).args[0]).be.exactly('SIGQUIT');
          should(processOnSpy.getCall(2).args[0]).be.exactly('SIGQUIT');

          should(processRemoveAllListenersSpy.getCall(3).args[0]).be.exactly('SIGABRT');
          should(processOnSpy.getCall(3).args[0]).be.exactly('SIGABRT');

          should(processRemoveAllListenersSpy.getCall(4).args[0]).be.exactly('SIGTRAP');
          should(processOnSpy.getCall(4).args[0]).be.exactly('SIGTRAP');

          should(processRemoveAllListenersSpy.getCall(5).args[0]).be.exactly('SIGINT');
          should(processOnSpy.getCall(5).args[0]).be.exactly('SIGINT');

          should(processRemoveAllListenersSpy.getCall(6).args[0]).be.exactly('SIGTERM');
          should(processOnSpy.getCall(6).args[0]).be.exactly('SIGTERM');
        });
    });
  });

  describe('#adminExists', () => {
    it('should resolves to true if an admin exists', async () => {
      kuzzle.internalIndex.count.resolves(42);

      const exists = await kuzzle.adminExists();

      should(exists).be.true();
      should(kuzzle.internalIndex.count).be.calledWithMatch(
        'users',
        { query: { terms: { profileIds: ['admin'] } } });
    });

    // @deprecated
    it('should instantiate Koncorde with PCRE support if asked to', async () => {
      const Koncorde = sinon.stub();
      const stubbedKuzzle = Kuzzle.__with__({
        Koncorde,
        vault: { load: () => {} }
      });

      await stubbedKuzzle(async () => {
        await _mockKuzzle(Kuzzle).start();

        const kuzzleWithPCRE = _mockKuzzle(Kuzzle);

        kuzzleWithPCRE.config =
          JSON.parse(JSON.stringify(kuzzleWithPCRE.config));

        kuzzleWithPCRE.config.realtime.pcreSupport = true;

        await kuzzleWithPCRE.start();
      });

      should(Koncorde.firstCall).calledWithMatch({ regExpEngine: 're2'});
      should(Koncorde.secondCall).calledWithMatch({ regExpEngine: 'js'});
    });
  });
});
