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
    requireSpy;

  before(() => {
    clock = sinon.useFakeTimers(Date.now());
  });

  after(() => {
    clock.restore();
  });

  beforeEach(() => {
    requireSpy = sinon.spy();

    reset = Services.__set__({
      require: sinon.stub().returns(requireSpy)
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

          try {
            should(Object.keys(kuzzle.config.services).length).be.greaterThan(2);

            Object.keys(kuzzle.config.services)
              .filter(key => key !== 'common')
              .forEach(service => {
                should(kuzzle.internalEngine.get).be.calledWith('services', service);
                should(registerService).be.calledWith(service);
              });

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should still return a resolved promise if some services do not have any configuration in db', () => {
      const error = new Error('test');
      error.status = 404;

      kuzzle.internalEngine.get.onCall(0).rejects(error);
      kuzzle.internalEngine.get.returns(Bluebird.resolve({_source: {foo: 'bar'}}));

      return services.init()
        .then(() => {
          try {
            should(Object.keys(kuzzle.config.services).length).be.greaterThan(2);

            Object.keys(kuzzle.config.services)
              .filter(key => key !== 'common')
              .forEach(service => {
                should(kuzzle.internalEngine.get).be.calledWith('services', service);
                should(registerService).be.calledWith(service);
              });

            return Bluebird.resolve();
          }
          catch(err) {
            return Bluebird.reject(err);
          }
        });
    });

    it('should return a rejected promise if something wrong occurred while fetching the configuration from the db', () => {
      const error = new Error('test');
      kuzzle.internalEngine.get.rejects(error);

      return should(services.init()).be.rejectedWith(error);
    });

    it('whitelist', () => {
      kuzzle.config.services = {
        ok: true,
        alsoOk: true,
        notOk: true
      };

      return services.init({whitelist: ['ok', 'alsoOk']})
        .then(() => {
          try {
            should(registerService).be.calledWith('ok', {service: 'ok'}, true);
            should(registerService).be.calledWith('alsoOk', {service: 'alsoOk'}, true);
            should(registerService).be.calledWith('notOk', {service: 'notOk'}, false);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('blacklist', () => {
      kuzzle.config.services = {
        ok: true,
        alsoOk: true,
        notOk: true
      };

      return services.init({blacklist: ['notOk']})
        .then(() => {
          try {
            should(registerService).be.calledWith('ok', {service: 'ok'}, true);
            should(registerService).be.calledWith('alsoOk', {service: 'alsoOk'}, true);
            should(registerService).be.calledWith('notOk', {service: 'notOk'}, false);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

  });

  describe('#registerService', () => {
    let
      context,
      options = {},
      registerService = Services.__get__('registerService');

    beforeEach(() => {
      context = {
        list: {},
        kuzzle
      };
    });

    it('should require the service', () => {
      kuzzle.config.services.serviceName = {};

      return registerService.call(context, 'serviceName', options, false)
        .then(() => {
          try {
            should(Services.__get__('require')).be.calledOnce();
            should(Services.__get__('require')).be.calledWith('./serviceName');

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should require the backend if defined', () => {
      kuzzle.config.services.serviceName = {
        backend: 'backend'
      };

      return registerService.call(context, 'serviceName', options, false)
        .then(() => {
          try {
            should(Services.__get__('require')).be.calledOnce();
            should(Services.__get__('require')).be.calledWith('./backend');

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should define as many aliases as defined', () => {
      kuzzle.config.services.serviceName = {
        aliases: [
          'someAlias',
          'someOtherAlias',
          'andYetAnotherOne'
        ]
      };

      return registerService.call(context, 'serviceName', options, false)
        .then(() => {
          const req = Services.__get__('require');

          try {
            should(req).be.calledThrice();
            should(req).be.calledWith('./serviceName');

            should(context.list).have.properties([
              'someAlias',
              'someOtherAlias',
              'andYetAnotherOne'
            ]);

            return Bluebird.resolve();
          }
          catch(error) {
            return Bluebird.reject(error);
          }
        });
    });

    it('should return a rejected promise if the service did not init in time', () => {
      return Services.__with__({
        require: () => function () {
          this.init = () => Bluebird.resolve(() => {});
        }
      })(() => {
        kuzzle.config.services.serviceName = {};
        const r = registerService.call(context, 'serviceName', {timeout: 1000}, true);

        clock.tick(1000);

        return should(r).be.rejectedWith('[FATAL] Service "serviceName[serviceName]" failed to init within 1000ms');
      });
    });

    it('should return a rejected promise if some error was thrown during init', () => {
      const error = new Error('test');

      return Services.__with__({
        require: () => function () {
          this.init = () => Bluebird.reject(error);
        }
      })(() => {
        kuzzle.config.services.serviceName = {};

        return should(registerService.call(context, 'serviceName', options, true))
          .be.rejectedWith(error);
      });
    });

  });

});
