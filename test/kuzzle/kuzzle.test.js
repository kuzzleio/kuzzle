'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const rewire = require('rewire');

const Kuzzle = rewire('../../lib/kuzzle/kuzzle');
const KuzzleMock = require('../mocks/kuzzle.mock');
const Plugin = require('../../lib/core/plugin/plugin');

describe('/lib/kuzzle/kuzzle.js', () => {
  let kuzzle;
  let application;
  let consoleSave;

  const mockedProperties = [
    'entryPoint',
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
    Kuzzle.__set__('console', { log: () => {} });

    kuzzle = _mockKuzzle(Kuzzle);
    application = new Plugin(
      kuzzle,
      { init: sinon.stub() },
      { name: 'application', application: true });
  });

  afterEach(() => {
    mockrequire.stopAll();
    Kuzzle.__set__('console', console);
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

      should(kuzzle.started).be.false();

      await kuzzle.start(application, params);

      sinon.assert.callOrder(
        kuzzle.pipe, // kuzzle:state:start
        kuzzle.cacheEngine.init,
        kuzzle.storageEngine.init,
        kuzzle.internalIndex.init,
        kuzzle.validation.init,
        kuzzle.repositories.init,
        kuzzle.funnel.init,
        kuzzle.statistics.init,
        kuzzle.validation.curateSpecification,
        kuzzle.storageEngine.public.loadMappings,
        kuzzle.storageEngine.public.loadFixtures,
        kuzzle.repositories.loadSecurities,
        kuzzle.repositories.role.sanityCheck,
        kuzzle.pluginsManager.init,
        kuzzle.entryPoint.init,
        kuzzle.router.init,
        kuzzle.pipe, // kuzzle:start
        kuzzle.pipe, // kuzzle:state:live
        kuzzle.entryPoint.startListening,
        kuzzle.pipe, // kuzzle:state:ready
        kuzzle.emit // core:kuzzleStart
      );

      should(kuzzle.started).be.true();
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

    it('should start all services and register errors handlers if enabled on kuzzle.start', () => {
      let
        processExitSpy = sinon.spy(),
        processOnSpy = sinon.spy(),
        processRemoveAllListenersSpy = sinon.spy();

      return Kuzzle.__with__({
        process: {
          ...process,
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
});
