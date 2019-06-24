const
  sinon = require('sinon'),
  should = require('should'),
  rewire = require('rewire'),
  { throw: throwError } = require('../../lib/config/error-codes/throw'),
  Kuzzle = rewire('../../lib/api/kuzzle'),
  {
    errors: { 
      InternalError,
      ExternalServiceError,
      NotFoundError,
      PreconditionError,
      PartialError,
      UnauthorizedError
    }
  } = require('kuzzle-common-objects'),
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
      'validation',
      'emit',
      'vault',
      'janitor'
    ].forEach(k => {
      kuzzle[k] = mock[k];
    });
  });

  it('should build a kuzzle server object with emit and listen event', done => {
    kuzzle.on('event', done);
    kuzzle.emit('event');
  });

  describe('#throw', () => {
    
    it('should throw an ExternalServiceError with right name, msg and code', () => {
    
      should(() => throwError('api', 'server', 'elasticsearch_down', '{"status":"red"}'))
        .throw(
          ExternalServiceError,
          {
            errorName: 'api-server-elasticsearch_down',
            code: 1,
            message: 'ElasticSearch is down: {"status":"red"}'
          }
        );
    });

    it('should throw an InternalError with default name, msg and code', () => {

      should(() => throwError('api', 'server', 'fake_error', '{"status":"error"}'))
        .throw(
          InternalError,
          {
            errorName: 'internal-unexpected-unknown_error',
            code: 1,
            message: 'Unknown error: {"status":"error"}'
          }
        );
    });

    it('should throw an NotFoundError with default name, msg and code', () => {
      should(() => throwError('api', 'admin', 'database_not_found', 'fake_database'))
        .throw(
          NotFoundError,
          {
            errorName: 'api-admin-database_not_found',
            code: 1,
            message: 'Database fake_database not found'
          }
        );
    });

    it('should throw a PreconditionError with default name, msg and code', () => {
      should(() => throwError('api', 'admin', 'precondition', 'Kuzzle is already shutting down.'))
        .throw(
          PreconditionError,
          {
            errorName: 'api-admin-precondition',
            code: 2,
            message: 'Kuzzle is already shutting down.'
          }
        );
    });

    it('should throw an UnauthorizedError with default name, msg and code', () => {
      should(() => throwError('api', 'auth', 'invalid_token'))
        .throw(
          UnauthorizedError,
          {
            errorName: 'api-auth-invalid_token',
            code: 2,
            message: 'Invalid token.'
          }
        );
    });

    it('should throw a PartialError with default name, msg and code', () => {
      should(() => throwError('api', 'bulk', 'document_creations_failed', ['foo', 'bar']))
        .throw(
          PartialError,
          {
            errorName: 'api-bulk-document_creations_failed',
            errors: ['foo', 'bar'],
            code: 1,
            message: 'Some document creations failed: foo,bar'
          }
        );
    });
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
            kuzzle.vault.prepareCrypto,
            kuzzle.vault.init,
            kuzzle.services.init,
            kuzzle.validation.init,
            kuzzle.indexCache.init,
            kuzzle.repositories.init,
            kuzzle.funnel.init,
            kuzzle.janitor.loadMappings,
            kuzzle.janitor.loadFixtures,
            kuzzle.pluginsManager.init,
            kuzzle.pluginsManager.run,
            kuzzle.emit, // log:info, services init
            kuzzle.emit, // log:info, load securities
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
          'statistics',
          'vault'
        ].forEach(k => {
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
          should(kuzzle.emit).be.called();
          should(kuzzle.funnel.init).not.be.called();
          should(kuzzle.router.init).not.be.called();
          should(kuzzle.statistics.init).not.be.called();
          should(kuzzle.entryPoints.init).not.be.called();
          should(kuzzle.repositories.init).not.be.called();
        });
    });
  });
});
