var
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  Kuzzle = rewire('../../lib/api/kuzzle'),
  KuzzleMock = require('../mocks/kuzzle.mock');

describe('/lib/api/kuzzle.js', () => {
  var kuzzle;

  beforeEach(() => {
    var mock = new KuzzleMock();
    kuzzle = new Kuzzle();

    [
      'entryPoints',
      'funnel',
      'hooks',
      'indexCache',
      'internalEngine',
      'notifier',
      'pluginsManager',
      'cliController',
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

  describe('#resetStorage', () => {
    it('should erase the internal ES & Redis dbs', () => {
      return kuzzle.resetStorage()
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledOnce()
            .be.calledWithExactly('log:warn', 'Kuzzle::resetStorage called');

          should(kuzzle.internalEngine.deleteIndex)
            .be.calledOnce();

          should(kuzzle.services.list.internalCache.flushdb)
            .be.calledOnce();

          should(kuzzle.services.list.memoryStorage.flushdb)
            .be.calledOnce();

          should(kuzzle.indexCache.remove)
            .be.calledOnce()
            .be.calledWithExactly('internalIndex');

          should(kuzzle.internalEngine.bootstrap.all)
            .be.calledOnce();

          should(kuzzle.validation).be.an.Object();

          should(kuzzle.start).be.a.Function();

          sinon.assert.callOrder(
            kuzzle.pluginsManager.trigger,
            kuzzle.internalEngine.deleteIndex,
            kuzzle.services.list.internalCache.flushdb,
            kuzzle.services.list.memoryStorage.flushdb,
            kuzzle.indexCache.remove,
            kuzzle.internalEngine.bootstrap.all
          );
        });
    });
  });

  describe('#start', () => {
    it('should init the components in proper order', () => {
      return kuzzle.start()
        .then(() => {
          should(kuzzle.internalEngine.init)
            .be.calledOnce();

          should(kuzzle.internalEngine.bootstrap.all)
            .be.calledOnce();

          should(kuzzle.pluginsManager.packages.bootstrap)
            .be.calledOnce();

          should(kuzzle.pluginsManager.init)
            .be.calledOnce();

          should(kuzzle.pluginsManager.run)
            .be.calledOnce();

          should(kuzzle.services.init)
            .be.calledOnce();

          should(kuzzle.indexCache.init)
            .be.calledOnce();

          should(kuzzle.pluginsManager.trigger)
            .be.called();

          should(kuzzle.funnel.init)
            .be.calledOnce();

          should(kuzzle.notifier.init)
            .be.calledOnce();

          should(kuzzle.statistics.init)
            .be.calledOnce();

          should(kuzzle.hooks.init)
            .be.calledOnce();

          should(kuzzle.entryPoints.init)
            .be.calledOnce();

          should(kuzzle.repositories.init)
            .be.calledOnce();

          should(kuzzle.cliController.init)
            .be.calledOnce();

          sinon.assert.callOrder(
            kuzzle.internalEngine.init,
            kuzzle.internalEngine.bootstrap.all,
            kuzzle.pluginsManager.packages.bootstrap,
            kuzzle.pluginsManager.init,
            kuzzle.pluginsManager.run,
            kuzzle.services.init,
            kuzzle.indexCache.init,
            kuzzle.pluginsManager.trigger,
            kuzzle.funnel.init,
            kuzzle.notifier.init,
            kuzzle.statistics.init,
            kuzzle.hooks.init,
            kuzzle.entryPoints.init,
            kuzzle.repositories.init,
            kuzzle.pluginsManager.trigger,
            kuzzle.cliController.init,
            kuzzle.pluginsManager.trigger
          );
        });

    });

    it('should start all services and register errors handlers if enabled on kuzzle.start', () => {
      var
        mock,
        processExitSpy = sinon.spy(),
        processOnSpy = sinon.spy(),
        processRemoveAllListenersSpy = sinon.spy();

      Kuzzle.__set__('process', {
        exit: processExitSpy,
        on: processOnSpy,
        emit: sinon.stub(process, 'emit'),
        removeAllListeners: processRemoveAllListenersSpy
      });

      Kuzzle.__set__('console', {
        error: sinon.spy()
      });

      mock = new KuzzleMock();
      kuzzle = new Kuzzle();

      [
        'entryPoints',
        'funnel',
        'hooks',
        'indexCache',
        'internalEngine',
        'notifier',
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

      should(processRemoveAllListenersSpy.getCall(2).args[0]).be.exactly('SIGHUP');
      should(processOnSpy.getCall(2).args[0]).be.exactly('SIGHUP');

      should(processRemoveAllListenersSpy.getCall(3).args[0]).be.exactly('SIGQUIT');
      should(processOnSpy.getCall(3).args[0]).be.exactly('SIGQUIT');

      should(processRemoveAllListenersSpy.getCall(4).args[0]).be.exactly('SIGABRT');
      should(processOnSpy.getCall(4).args[0]).be.exactly('SIGABRT');

      should(processRemoveAllListenersSpy.getCall(5).args[0]).be.exactly('SIGPIPE');
      should(processOnSpy.getCall(5).args[0]).be.exactly('SIGPIPE');

      should(processRemoveAllListenersSpy.getCall(6).args[0]).be.exactly('SIGTERM');
      should(processOnSpy.getCall(6).args[0]).be.exactly('SIGTERM');

      should(processRemoveAllListenersSpy.getCall(7).args[0]).be.exactly('SIGTRAP');
      should(processOnSpy.getCall(7).args[0]).be.exactly('SIGTRAP');
    });

    it('does not really test anything but increases coverage', () => {
      var error = new Error('error');

      kuzzle.internalEngine.init.rejects(error);

      return should(kuzzle.start())
        .be.rejectedWith(error);
    });
  });
});
