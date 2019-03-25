const
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  Kuzzle = rewire('../../lib/api/kuzzle'),
  KuzzleMock = require('../mocks/kuzzle.mock');

describe('/lib/api/kuzzle.js', () => {
  let kuzzle;

  beforeEach(() => {
    const mock = new KuzzleMock();
    kuzzle = new Kuzzle();

    [
      'entryPoints',
      'funnel',
      'router',
      'indexCache',
      'internalEngine',
      'notifier',
      'gc',
      'pluginsManager',
      'adminController',
      'repositories',
      'services',
      'statistics',
      'validation'
    ].forEach(k => {
      kuzzle[k] = mock[k];
    });
  });

  it('should construct a kuzzle server object with emit and listen event', (done) => {
    kuzzle.on('event', () => {
      done();
    });

    kuzzle.emit('event', {});
  });

  describe('#start', () => {
    it('should init the components in proper order', () => {
      kuzzle.janitor.loadMappings = sinon.spy();
      kuzzle.janitor.loadFixtures = sinon.spy();
      kuzzle.janitor.loadSecurities = sinon.spy();
      const params = {
        mappings: {},
        fixtures: {},
        securities: {}
      };

      return kuzzle.start(params)
        .then(() => {
          sinon.assert.callOrder(
            kuzzle.internalEngine.init,
            kuzzle.internalEngine.bootstrap.all,
            kuzzle.services.init,
            kuzzle.validation.init,
            kuzzle.indexCache.init,
            kuzzle.repositories.init,
            kuzzle.funnel.init,
            kuzzle.janitor.loadMappings,
            kuzzle.janitor.loadFixtures,
            kuzzle.pluginsManager.init,
            kuzzle.pluginsManager.run,
            kuzzle.pluginsManager.trigger, // log:info, services init
            kuzzle.pluginsManager.trigger, // log:info, load securities
            kuzzle.janitor.loadSecurities,
            kuzzle.funnel.loadPluginControllers,
            kuzzle.router.init,
            kuzzle.statistics.init,
            kuzzle.validation.curateSpecification,
            kuzzle.entryPoints.init,
            kuzzle.pluginsManager.trigger // core:kuzzleStart
          );
        });
    });

    it('should start all services and register errors handlers if enabled on kuzzle.start', () => {
      let
        mock,
        processExitSpy = sinon.spy(),
        processOnSpy = sinon.spy(),
        processRemoveAllListenersSpy = sinon.spy();

      Kuzzle.__with__({
        console: {
          error: sinon.spy()
        },
        process: {
          exit: processExitSpy,
          on: processOnSpy,
          emit: sinon.stub(),
          removeAllListeners: processRemoveAllListenersSpy
        }
      })(() => {
        mock = new KuzzleMock();
        kuzzle = new Kuzzle();

        [
          'entryPoints',
          'funnel',
          'router',
          'indexCache',
          'internalEngine',
          'notifier',
          'gc',
          'pluginsManager',
          'remoteActionsController',
          'repositories',
          'services',
          'statistics'
        ].forEach(k => {
          kuzzle[k] = mock[k];
        });

        kuzzle.config.dump.enabled = true;

        kuzzle.start();

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

    it('should not start if it fails initializing its internal storage', () => {
      const error = new Error('error');

      kuzzle.internalEngine.init.rejects(error);

      return should(kuzzle.start()).be.rejectedWith(error)
        .then(() => {
          should(kuzzle.internalEngine.bootstrap.all).not.be.called();
          should(kuzzle.validation.init).not.be.called();
          should(kuzzle.pluginsManager.init).not.be.called();
          should(kuzzle.pluginsManager.run).not.be.called();
          should(kuzzle.services.init).not.be.called();
          should(kuzzle.indexCache.init).not.be.called();
          should(kuzzle.pluginsManager.trigger).be.called();
          should(kuzzle.funnel.init).not.be.called();
          should(kuzzle.router.init).not.be.called();
          should(kuzzle.statistics.init).not.be.called();
          should(kuzzle.entryPoints.init).not.be.called();
          should(kuzzle.repositories.init).not.be.called();
        });
    });
  });
});
