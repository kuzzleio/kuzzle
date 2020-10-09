'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const rewire = require('rewire');

const KuzzleMock = require('../mocks/kuzzle.mock');
const Plugin = require('../../lib/core/plugin/plugin');
const config = require('../../lib/config');

describe('/lib/kuzzle/kuzzle.js', () => {
  let kuzzle;
  let Kuzzle;
  let application;

  const mockedProperties = [
    'entryPoint',
    'funnel',
    'router',
    'notifier',
    'gc',
    'pluginsManager',
    'adminController',
    'services',
    'statistics',
    'validation',
    'emit',
    'vault',
    'log',
    'internalIndex',
    'dumpGenerator',
    'shutdown',
    'pipe',
    'ask',
    'tokenManager',
  ];

  function _mockKuzzle (KuzzleConstructor) {
    const mock = new KuzzleMock();
    const k = new KuzzleConstructor(config);

    mockedProperties.forEach(p => {
      k[p] = mock[p];
    });

    return k;
  }

  beforeEach(() => {
    const coreModuleStub = function () {
      return { init: sinon.stub().resolves() };
    };

    mockrequire('../../lib/core/cache/cacheEngine', coreModuleStub);
    mockrequire('../../lib/core/storage/storageEngine', coreModuleStub);
    mockrequire('../../lib/core/security', coreModuleStub);
    mockrequire('../../lib/core/realtime', coreModuleStub);

    mockrequire.reRequire('../../lib/kuzzle/kuzzle');
    Kuzzle = rewire('../../lib/kuzzle/kuzzle');
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
      const options = {
        mappings: {},
        fixtures: {},
        securities: {}
      };

      should(kuzzle.started).be.false();

      await kuzzle.start(application, options);

      sinon.assert.callOrder(
        kuzzle.pipe, // kuzzle:state:start
        kuzzle.internalIndex.init,
        kuzzle.validation.init,
        kuzzle.tokenManager.init,
        kuzzle.funnel.init,
        kuzzle.statistics.init,
        kuzzle.validation.curateSpecification,
        kuzzle.ask.withArgs('core:storage:public:mappings:import'),
        kuzzle.ask.withArgs('core:storage:public:document:import'),
        kuzzle.ask.withArgs('core:security:load'),
        kuzzle.ask.withArgs('core:security:verify'),
        kuzzle.entryPoint.init,
        kuzzle.pluginsManager.init,
        kuzzle.router.init,
        kuzzle.pipe.withArgs('kuzzle:start'),
        kuzzle.pipe.withArgs('kuzzle:state:live'),
        kuzzle.entryPoint.startListening,
        kuzzle.pipe.withArgs('kuzzle:state:ready'),
        kuzzle.emit.withArgs('core:kuzzleStart')
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

  describe('#dump', () => {
    it('should calls dumpGenerator.dump', async () => {
      await kuzzle.dump();

      should(kuzzle.dumpGenerator.dump).be.calledOnce();
    });
  });
});
