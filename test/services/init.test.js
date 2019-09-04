const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  Services = rewire('../../lib/services');

describe('Test: lib/services/', () => {
  let
    clock,
    kuzzle,
    reset,
    services,
    requiredModuleStub;

  before(() => {
    clock = sinon.useFakeTimers(Date.now());
  });

  after(() => {
    clock.restore();
  });

  beforeEach(() => {
    requiredModuleStub = sinon.stub();

    reset = Services.__set__({
      require: sinon.stub().returns(requiredModuleStub)
    });
    kuzzle = new KuzzleMock();
    services = new Services(kuzzle);
  });

  afterEach(() => {
    reset();
  });

  describe('#init', () => {
    let
      r,
      registerService;

    beforeEach(() => {
      r = Services.__set__({
        registerService: sinon.stub().returns(Bluebird.resolve())
      });
      registerService = Services.__get__('registerService');
    });

    afterEach(() => {
      r();
    });

    it('should register the services', () => {
      return services.init()
        .then(() => {
          should(Object.keys(kuzzle.config.services).length).be.greaterThan(2);

          Object.keys(kuzzle.config.services)
            .filter(key => key !== 'common')
            .forEach(service => {
              should(kuzzle.internalEngine.get).be.calledWith(
                'services',
                service);
              should(registerService).be.calledWith(service);
            });
        });
    });

    it('should still return a resolved promise if some services do not have any configuration in db', () => {
      const error = new Error('test');
      error.status = 404;

      kuzzle.internalEngine.get.onCall(0).rejects(error);
      kuzzle.internalEngine.get.resolves({_source: {foo: 'bar'}});

      return services.init()
        .then(() => {
          should(Object.keys(kuzzle.config.services).length).be.greaterThan(2);

          Object.keys(kuzzle.config.services)
            .filter(key => key !== 'common')
            .forEach(service => {
              should(kuzzle.internalEngine.get).be.calledWith(
                'services',
                service);
              should(registerService).be.calledWith(service);
            });
        });
    });

    it('should return a rejected promise if something wrong occurred while fetching the configuration from the db', () => {
      const error = new Error('test');
      kuzzle.internalEngine.get.rejects(error);

      return should(services.init()).be.rejectedWith(error);
    });
  });

  describe('#registerService', () => {
    let
      context,
      options = {},
      fakeService,
      registerService = Services.__get__('registerService');

    beforeEach(() => {
      fakeService = {
        init: sinon.stub().usingPromise(Bluebird).resolves()
      };

      requiredModuleStub.returns(fakeService);

      context = {
        list: {},
        kuzzle
      };
    });

    it('should require the service', () => {
      kuzzle.config.services.fakeService = {};

      return registerService.call(context, 'fakeService', options)
        .then(() => {
          should(Services.__get__('require')).be.calledOnce();
          should(Services.__get__('require')).be.calledWith('./fakeService');
        });
    });

    it('should require the backend if defined', () => {
      kuzzle.config.services.fakeService = {
        backend: 'backend'
      };

      return registerService.call(context, 'fakeService', options)
        .then(() => {
          should(Services.__get__('require')).be.calledOnce();
          should(Services.__get__('require')).be.calledWith('./backend');
        });
    });

    it('should define as many aliases as defined', () => {
      kuzzle.config.services.fakeService = {
        aliases: [
          'someAlias',
          'someOtherAlias',
          'andYetAnotherOne'
        ]
      };

      return registerService.call(context, 'fakeService', options)
        .then(() => {
          const req = Services.__get__('require');

          should(req).be.calledThrice();
          should(req).be.calledWith('./fakeService');

          should(context.list).have.properties([
            'someAlias',
            'someOtherAlias',
            'andYetAnotherOne'
          ]);
        });
    });

    it('should return a rejected promise if the service did not init in time', () => {
      return Services.__with__({
        require: () => function () {
          this.init = () => new Promise(() => {});
        }
      })(() => {
        kuzzle.config.services.fakeService = {};
        const r = registerService.call(
          context,
          'fakeService',
          { timeout: 1000 });

        clock.tick(1000);

        return should(r).be.rejectedWith('[FATAL] Service "fakeService[fakeService]" failed to initialize within 1000ms.');
      });
    });

    it('should return a rejected promise if some error was thrown during init', () => {
      const error = new Error('test');

      return Services.__with__({
        require: () => function () {
          this.init = () => Bluebird.reject(error);
        }
      })(() => {
        kuzzle.config.services.fakeService = {};

        const promise = registerService.call(
          context,
          'fakeService',
          options);

        return should(promise).be.rejectedWith(error);
      });
    });

  });

});
