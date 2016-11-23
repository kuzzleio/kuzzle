var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Promise = require('bluebird'),
  KuzzleMock = require('../mocks/kuzzle.mock'),
  Services = rewire('../../lib/services');

describe('Test: lib/services/', () => {
  var
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
    var
      r,
      registerService;

    beforeEach(() => {
      r = Services.__set__({
        registerService: sinon.stub().returns(Promise.resolve())
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

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should still return a resolved promise if some services do not have any configuration in db', () => {
      var error = new Error('test');
      error.status = 404;

      kuzzle.internalEngine.get.onCall(0).returns(Promise.reject(error));
      kuzzle.internalEngine.get.returns(Promise.resolve({_source: {foo: 'bar'}}));

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

            return Promise.resolve();
          }
          catch(err) {
            return Promise.reject(err);
          }
        });
    });

    it('should return a rejected promise if something wrong occurred while fetching the configuration from the db', () => {
      var error = new Error('test');
      kuzzle.internalEngine.get.returns(Promise.reject(error));

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

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
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

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

  });

  describe('#registerService', () => {
    var
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

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
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

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
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
          var req = Services.__get__('require');

          try {
            should(req).be.calledThrice();
            should(req).be.calledWith('./serviceName');

            should(context.list).have.properties([
              'someAlias',
              'someOtherAlias',
              'andYetAnotherOne'
            ]);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });

    it('should return a rejected promise if the service did not init in time', () => {
      return Services.__with__({
        require: () => function () {
          this.init = () => new Promise(() => {});
        }
      })(() => {
        var r;

        kuzzle.config.services.serviceName = {};
        r = registerService.call(context, 'serviceName', {timeout: 1000}, true);

        clock.tick(1000);

        return should(r).be.rejectedWith('[FATAL] Service "serviceName[serviceName]" failed to init within 1000ms');
      });
    });

    it('should return a rejected promise if some error was thrown during init', () => {
      var error = new Error('test');

      return Services.__with__({
        require: () => function () {
          this.init = () => Promise.reject(error);
        }
      })(() => {
        kuzzle.config.services.serviceName = {};

        return should(registerService.call(context, 'serviceName', options, true))
          .be.rejectedWith(error);
      });
    });

  });

});
