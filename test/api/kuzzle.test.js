const
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  Kuzzle = rewire('../../lib/api/kuzzle'),
  KuzzleMock = require('../mocks/kuzzle.mock');

describe('/lib/api/kuzzle.js', () => {
  let kuzzle;
  const mockedProperties = [
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
    'validation',
    'emit',
    'vault',
    'janitor',
    'log'
  ];

  function _mockKuzzle (KuzzleConstructor) {
    const
      mock = new KuzzleMock(),
      k = new KuzzleConstructor();

    mockedProperties.forEach(p => {
      k[p] = mock[p];
    });

    return k;
  }

  beforeEach(() => {
    kuzzle = _mockKuzzle(Kuzzle);
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
            kuzzle.log.info, // services init
            kuzzle.log.info, // load securities
            kuzzle.janitor.loadSecurities,
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
          should(kuzzle.vault._vaultKey).be.exactly('the spoon does not exists');
          should(kuzzle.vault._encryptedSecretsFile).be.exactly('config/secrets.json');
        });
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
          should(kuzzle.funnel.init).not.be.called();
          should(kuzzle.router.init).not.be.called();
          should(kuzzle.statistics.init).not.be.called();
          should(kuzzle.entryPoints.init).not.be.called();
          should(kuzzle.repositories.init).not.be.called();
          should(kuzzle.log.error).be.called();
        });
    });

    // @deprecated
    it('should instantiate Koncorde with PCRE support if asked to', () => {
      const Koncorde = sinon.stub();
      let
        kuzzleDefault,
        kuzzleWithPCRE;

      return Kuzzle
        .__with__({ Koncorde })(() => {
          kuzzleDefault = _mockKuzzle(Kuzzle);
          kuzzleWithPCRE = _mockKuzzle(Kuzzle);

          kuzzleWithPCRE.config =
            JSON.parse(JSON.stringify(kuzzleWithPCRE.config));
          kuzzleWithPCRE.config.realtime.pcreSupport = true;

          return kuzzleDefault.start().then(() => kuzzleWithPCRE.start());
        })
        .then(() => {
          should(Koncorde.firstCall).calledWithMatch({ regExpEngine: 're2'});
          should(Koncorde.secondCall).calledWithMatch({ regExpEngine: 'js'});
        });
    });
  });
});
