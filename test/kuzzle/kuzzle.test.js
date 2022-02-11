'use strict';

const sinon = require('sinon');
const should = require('should');
const mockrequire = require('mock-require');
const rewire = require('rewire');
const Bluebird = require('bluebird');

const KuzzleMock = require('../mocks/kuzzle.mock');
const MutexMock = require('../mocks/mutex.mock.js');
const Plugin = require('../../lib/core/plugin/plugin');
const kuzzleStateEnum = require('../../lib/kuzzle/kuzzleStateEnum');

const config = require('../../lib/config').loadConfig();

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
    'pipe',
    'ask',
    'tokenManager',
  ];

  function _mockKuzzle (KuzzleConstructor) {
    Reflect.deleteProperty(global, 'kuzzle');
    const k = new KuzzleConstructor(config);
    const mock = new KuzzleMock();

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
    mockrequire('../../lib/cluster', coreModuleStub);
    mockrequire('../../lib/util/mutex', { Mutex: MutexMock });

    mockrequire.reRequire('../../lib/kuzzle/kuzzle');
    Kuzzle = rewire('../../lib/kuzzle/kuzzle');
    Kuzzle.__set__('console', { log: () => {} });

    kuzzle = _mockKuzzle(Kuzzle);
    application = new Plugin(
      { init: sinon.stub() },
      { name: 'application', application: true, openApi: 'openApi' });
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
      const Koncorde = sinon.stub();
      const stubbedKuzzle = Kuzzle.__with__({
        koncorde_1: { Koncorde },
        vault_1: { default: { load: () => {} } }
      });

      await stubbedKuzzle(async () => {
        kuzzle = await _mockKuzzle(Kuzzle);

        kuzzle.install = sinon.stub().resolves();
        kuzzle.import = sinon.stub().resolves();
        const options = {
          import: { something: 'here' },
          installations: [{ id: 'foo', handler: () => {} }],
          support: { something: 'here' }
        };

        kuzzle._waitForImportToFinish = sinon.stub().resolves();

        should(kuzzle.state).be.eql(kuzzleStateEnum.STARTING);

        await kuzzle.start(application, options);

        sinon.assert.callOrder(
          kuzzle.pipe, // kuzzle:state:start
          kuzzle.internalIndex.init,
          kuzzle.validation.init,
          kuzzle.tokenManager.init,
          kuzzle.funnel.init,
          kuzzle.statistics.init,
          kuzzle.validation.curateSpecification,
          kuzzle.entryPoint.init,
          kuzzle.pluginsManager.init,
          kuzzle.import.withArgs(options.import, options.support),
          kuzzle.ask.withArgs('core:security:verify'),
          kuzzle.router.init,
          kuzzle.install.withArgs(options.installations),
          kuzzle.pipe.withArgs('kuzzle:start'),
          kuzzle.pipe.withArgs('kuzzle:state:live'),
          kuzzle.entryPoint.startListening,
          kuzzle.pipe.withArgs('kuzzle:state:ready'),
          kuzzle.emit.withArgs('core:kuzzleStart')
        );

        should(kuzzle.state).be.eql(kuzzleStateEnum.RUNNING);
      });
    });

    // @deprecated
    it('should instantiate Koncorde with PCRE support if asked to', async () => {
      const Koncorde = sinon.stub();
      const stubbedKuzzle = Kuzzle.__with__({
        koncorde_1: { Koncorde },
        vault_1: { default: { load: () => {} } }
      });

      await stubbedKuzzle(async () => {
        const baseKuzzle = _mockKuzzle(Kuzzle);

        baseKuzzle._waitForImportToFinish = sinon.stub().resolves();

        await baseKuzzle.start(application);

        const kuzzleWithPCRE = _mockKuzzle(Kuzzle);

        kuzzleWithPCRE.ask = sinon.stub().resolves();
        kuzzleWithPCRE.ask.withArgs('core:cache:internal:get').resolves(1);

        kuzzleWithPCRE.config =
          JSON.parse(JSON.stringify(kuzzleWithPCRE.config));

        kuzzleWithPCRE.config.realtime.pcreSupport = true;

        await kuzzleWithPCRE.start();
      });

      should(Koncorde.firstCall).calledWithMatch({ regExpEngine: 're2' });
      should(Koncorde.secondCall).calledWithMatch({ regExpEngine: 'js' });
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
        kuzzle._waitForImportToFinish = sinon.stub().resolves();

        return kuzzle.start(application);
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

  describe('#shutdown', () => {
    it('should exit only when there is no request left in the funnel', async () => {
      sinon.stub(process, 'exit');

      // We cannot use sinon's fake timers: they do not work with async
      // functions
      sinon.stub(Bluebird, 'delay').callsFake(() => {
        // we must wait a bit: if we replace with stub.resolves(), V8 converts
        // that into a direct function call, and the event loop never rotates
        return new Promise(resolve => setTimeout(resolve, 10));
      });

      kuzzle.funnel.remainingRequests = 1;

      setTimeout(
        () => {
          kuzzle.funnel.remainingRequests = 0;
        },
        50);

      try {
        await kuzzle.shutdown();

        should(kuzzle.entryPoint.dispatch).calledOnce().calledWith('shutdown');
        should(kuzzle.pipe).calledWith('kuzzle:shutdown');
        should(Bluebird.delay.callCount).approximately(5, 1);

        // @deprecated
        should(kuzzle.emit).calledWith('core:shutdown');

        should(process.exit).calledOnce().calledWith(0);
      }
      finally {
        process.exit.restore();
        Bluebird.delay.restore();
      }
    });
  });

  describe('#install', () => {
    let handler;

    beforeEach(() => {
      handler = sinon.stub().resolves();
      sinon.stub(Date, 'now').returns(Date.now());

      kuzzle.ask = sinon.stub().withArgs(['core:storage:private:document:exist']).resolves(false);
      kuzzle.ask = sinon.stub().withArgs(['core:storage:private:document:create']).resolves();
    });

    afterEach(() => {
      Date.now.restore();
    });

    it('should call the handler and work properly', async () => {
      await kuzzle.install([{ id: 'id', handler, description: 'description' }]);

      should(kuzzle.ask).be.calledTwice();
      should(kuzzle.ask).be.calledWith(
        'core:storage:private:document:exist',
        'kuzzle',
        'installations',
        'id');
      should(kuzzle.ask).be.calledWith(
        'core:storage:private:document:create',
        'kuzzle',
        'installations',
        { description: 'description', handler: handler.toString(), installedAt: Date.now() },
        { id: 'id' });
      should(handler).be.calledOnce();
      should(kuzzle.log.info).be.calledOnce();
    });

    it('should handle situation when handler has already been executed', async () => {
      kuzzle.ask = sinon.stub().withArgs(['core:storage:private:document:exist']).resolves(true);

      await kuzzle.install([{ id: 'id', handler }]);

      should(kuzzle.ask).be.calledWith(
        'core:storage:private:document:exist',
        'kuzzle',
        'installations',
        'id');
      should(kuzzle.ask).be.neverCalledWith(
        'core:storage:private:document:create',
        'kuzzle',
        'installations',
        { handler: handler.toString(), installedAt: Date.now() },
        { id: 'id' });
      should(handler).not.be.called();
      should(kuzzle.log.info).not.be.called();
    });
  });

  describe('#import', () => {
    let toImport;
    let toSupport;

    beforeEach(() => {
      toImport = {
        mappings: { something: 'here' },
        onExistingUsers: 'skip',
        profiles: { something: 'here' },
        roles: { something: 'here' },
        userMappings: { something: 'here' },
        user: { something: 'here' },
      };
      toSupport = {
        mappings: { something: 'here' },
        fixtures: { something: 'here' },
        securities: {
          profiles: { something: 'here' },
          roles: { something: 'here' },
          user: { something: 'here' }
        }
      };

      kuzzle.internalIndex.updateMapping = sinon.stub().resolves();
      kuzzle.internalIndex.refreshCollection = sinon.stub().resolves();
    });

    it('should load correctly toImport mappings and permissions', async () => {
      kuzzle._waitForImportToFinish = sinon.stub().resolves();
      await kuzzle.import(toImport, {});

      should(kuzzle.internalIndex.updateMapping).be.calledWith('users', toImport.userMappings);
      should(kuzzle.internalIndex.refreshCollection).be.calledWith('users');
      should(kuzzle.ask).calledWith('core:storage:public:mappings:import', toImport.mappings,
        {
          indexCacheOnly: false,
          propagate: false,
          refresh: true,
        });
      should(kuzzle.ask).calledWith('core:security:load',
        {
          profiles: toImport.profiles,
          roles: toImport.roles,
          users: toImport.users,
        },
        {
          onExistingUsers: toImport.onExistingUsers,
          onExistingUsersWarning: true,
          refresh: 'wait_for',
        });
    });

    it('should load correctly toSupport mappings, fixtures and securities', async () => {
      kuzzle._waitForImportToFinish = sinon.stub().resolves();
      await kuzzle.import({}, toSupport);

      should(kuzzle.ask).calledWith('core:storage:public:mappings:import', toSupport.mappings, {
        indexCacheOnly: false,
        propagate: false,
        rawMappings: true,
        refresh: true,
      });
      should(kuzzle.ask).calledWith('core:storage:public:document:import', toSupport.fixtures);
      should(kuzzle.ask).calledWith('core:security:load', toSupport.securities, {
        force: true,
        refresh: 'wait_for'
      });
    });

    it('should prevent mappings to be loaded from import and support simultaneously', () => {
      return should(kuzzle.import(toImport, { mappings: { something: 'here' } }))
        .be.rejectedWith({ id: 'plugin.runtime.incompatible' });
    });

    it('should prevent permissions to be loaded from import and support simultaneously', () => {
      return should(
        kuzzle.import(
          { profiles: { something: 'here' } },
          { securities: { roles: { something: 'here' } } }))
        .be.rejectedWith({ id: 'plugin.runtime.incompatible' });
    });
  });
});
