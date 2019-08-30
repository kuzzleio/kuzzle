const
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  Kuzzle = rewire('../../lib/api/kuzzle'),
  InternalIndexBootstrap = require('../../lib/api/core/storage/bootstrap/internalIndexBootstrap'),
  KuzzleMock = require('../mocks/kuzzle.mock');

describe('/lib/api/kuzzle.js', () => {
  let kuzzle;
  const mockedProperties = [
    'entryPoints',
    'funnel',
    'router',
    'indexCache',
    'internalIndex',
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
    'janitor',
    'log'
  ];

  beforeEach(() => {
    const mock = new KuzzleMock();
    kuzzle = new Kuzzle();

    mockedProperties.forEach(k => {
      kuzzle[k] = mock[k];
    });
  });

  it('should build a kuzzle server object with emit and listen event', done => {
    kuzzle.on('event', done);
    kuzzle.emit('event');
  });

  describe('#start', () => {
    it('should init the components in proper order', () => {
      const params = {
        mappings: {},
        fixtures: {},
        securities: {}
      };

      return kuzzle.start(params)
        .then(() => {
          sinon.assert.callOrder(
            kuzzle.services.init,
            kuzzle.log.info, // services init
            kuzzle.internalIndex.init,
            kuzzle.vault.prepareCrypto,
            kuzzle.vault.init,
            kuzzle.indexCache.init,
            kuzzle.validation.init,
            kuzzle.repositories.init,
            kuzzle.funnel.init,
            kuzzle.janitor.loadMappings,
            kuzzle.janitor.loadFixtures,
            kuzzle.pluginsManager.init,
            kuzzle.pluginsManager.run,
            kuzzle.log.info, // load securities
            kuzzle.janitor.loadSecurities,
            kuzzle.funnel.loadPluginControllers,
            kuzzle.router.init,
            kuzzle.statistics.init,
            kuzzle.validation.curateSpecification,
            kuzzle.entryPoints.init,
            kuzzle.emit // core:kuzzleStart
          );
        });
    });

    it('should call vault with params from the CLI', () => {
      const params = {
        vaultKey: 'the spoon does not exists',
        secretsFile: 'config/secrets.json'
      };

      return kuzzle.start(params)
        .then(() => {
          should(kuzzle.vault.prepareCrypto).be.calledWith('the spoon does not exists');
          should(kuzzle.vault.init).be.calledWith('config/secrets.json');
        });
    });

    it('should start all services and register errors handlers if enabled on kuzzle.start', () => {
      let
        mock,
        processExitSpy = sinon.spy(),
        processOnSpy = sinon.spy(),
        processRemoveAllListenersSpy = sinon.spy();

      return Kuzzle.__with__({
        process: {
          exit: processExitSpy,
          on: processOnSpy,
          emit: sinon.stub(),
          removeAllListeners: processRemoveAllListenersSpy
        }
      })(() => {
        mock = new KuzzleMock();
        kuzzle = new Kuzzle();

        mockedProperties.forEach(k => {
          kuzzle[k] = mock[k];
        });

        kuzzle.config.dump.enabled = true;

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
