const
  should = require('should'),
  ServerController = require('../../../lib/api/controllers/serverController'),
  Request = require('kuzzle-common-objects').Request,
  ServiceUnavailableError = require('kuzzle-common-objects').errors.ServiceUnavailableError,
  KuzzleMock = require('../../mocks/kuzzle.mock');

describe('Test: server controller', () => {
  let
    serverController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
    collection = 'unit-test-serverController',
    request;

  beforeEach(() => {
    const data = {
      controller: 'server',
      index,
      collection
    };
    kuzzle = new KuzzleMock();
    serverController = new ServerController(kuzzle);
    request = new Request(data);
  });

  describe('#getStats', () => {
    it('should trigger the plugin manager and return a proper response', () => {
      return serverController.getStats(request)
        .then(response => {
          should(kuzzle.statistics.getStats).be.calledOnce();
          should(kuzzle.statistics.getStats).be.calledWith(request);
          should(response).be.instanceof(Object);
          should(response).match(foo);
        });

    });
  });

  describe('#getLastStats', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return serverController.getLastStats(request)
        .then(response => {
          should(kuzzle.statistics.getLastStats).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#getAllStats', () => {
    it('should trigger the proper methods and return a valid response', () => {
      return serverController.getAllStats(request)
        .then(response => {
          should(kuzzle.statistics.getAllStats).be.calledOnce();

          should(response).be.instanceof(Object);
          should(response).match(foo);
        });
    });
  });

  describe('#adminExists', () => {
    it('should call search with right query', () => {
      return serverController.adminExists()
        .then(() => {
          should(kuzzle.internalEngine.bootstrap.adminExists).be.calledOnce();
        });
    });

    it('should return false if there is no result', () => {
      kuzzle.internalEngine.bootstrap.adminExists.resolves(false);

      return serverController.adminExists()
        .then((response) => {
          should(response).match({ exists: false });
        });
    });

    it('should return true if there is result', () => {
      kuzzle.internalEngine.bootstrap.adminExists.resolves(true);

      return serverController.adminExists()
        .then((response) => {
          should(response).match({ exists: true });
        });
    });
  });

  describe('#now', () => {
    it('should resolve to a number', () => {
      return serverController.now(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).not.be.undefined();
          should(response.now).not.be.undefined().and.be.a.Number();
        });
    });
  });

  describe('#healthCheck', () => {
    beforeEach(() => {
      kuzzle.services.list.storageEngine.getInfos.resolves({status: 'green'});
    });

    it('should return a 200 response with status "green" if storageEngine status is "green" and Redis is OK', () => {
      return serverController.healthCheck(request)
        .then(response => {
          should(request.response.error).be.null();
          should(response.status).be.exactly('green');
          should(response.services.internalCache).be.exactly('green');
          should(response.services.memoryStorage).be.exactly('green');
          should(response.services.storageEngine).be.exactly('green');
        });
    });

    it('should return a 200 response with status "green" if storageEngine status is "yellow" and Redis is OK', () => {
      kuzzle.services.list.storageEngine.getInfos.resolves({status: 'yellow'});

      return serverController.healthCheck(request)
        .then(response => {
          should(request.response.error).be.null();
          should(response.status).be.exactly('green');
          should(response.services.internalCache).be.exactly('green');
          should(response.services.memoryStorage).be.exactly('green');
          should(response.services.storageEngine).be.exactly('green');
        });
    });

    it('should return a 503 response with status "red" if storageEngine status is "red"', () => {
      kuzzle.services.list.storageEngine.getInfos.resolves({status: 'red'});

      return serverController.healthCheck(request)
        .then(response => {
          should(request.response.error).be.instanceOf(ServiceUnavailableError);
          should(request.response.status).be.exactly(503);
          should(response.status).be.exactly('red');
          should(response.services.internalCache).be.exactly('green');
          should(response.services.memoryStorage).be.exactly('green');
          should(response.services.storageEngine).be.exactly('red');
        });
    });

    it('should return a 503 response with status "red" if storageEngine is KO', () => {
      kuzzle.services.list.storageEngine.getInfos.rejects(new Error());

      return serverController.healthCheck(request)
        .then(response => {
          should(request.response.error).be.instanceOf(ServiceUnavailableError);
          should(request.response.status).be.exactly(503);
          should(response.status).be.exactly('red');
          should(response.services.internalCache).be.exactly('green');
          should(response.services.memoryStorage).be.exactly('green');
          should(response.services.storageEngine).be.exactly('red');
        });
    });

    it('should return a 503 response with status "red" if memoryStorage is KO', () => {
      kuzzle.services.list.memoryStorage.getInfos.rejects(new Error());

      return serverController.healthCheck(request)
        .then(response => {
          should(request.response.error).be.instanceOf(ServiceUnavailableError);
          should(request.response.status).be.exactly(503);
          should(response.status).be.exactly('red');
          should(response.services.internalCache).be.exactly('green');
          should(response.services.memoryStorage).be.exactly('red');
          should(response.services.storageEngine).be.exactly('green');
        });
    });

    it('should return a 503 response with status "red" if internalCache is KO', () => {
      kuzzle.services.list.internalCache.getInfos.rejects(new Error());

      return serverController.healthCheck(request)
        .then(response => {
          should(request.response.error).be.instanceOf(ServiceUnavailableError);
          should(request.response.status).be.exactly(503);
          should(response.status).be.exactly('red');
          should(response.services.internalCache).be.exactly('red');
          should(response.services.memoryStorage).be.exactly('green');
          should(response.services.storageEngine).be.exactly('green');
        });
    });
  });

  describe('#info', () => {
    it('should return a properly formatted server information object', () => {
      class Foo {
        constructor() {
          this.qux = 'not a function';
          this.baz = function () {};
        }
        _privateMethod() {}
        publicMethod() {}
      }

      kuzzle.funnel.controllers = {
        foo: new Foo()
      };

      kuzzle.funnel.pluginsControllers = {
        foobar: {
          _privateMethod: function () {},
          publicMethod: function () {},
          anotherMethod: function () {},
          notAnAction: 3.14
        }
      };

      kuzzle.config.http.routes.push({verb: 'foo', action: 'publicMethod', controller: 'foo', url: '/u/r/l'});
      kuzzle.config.http.routes.push({verb: 'foo', action: 'publicMethod', controller: 'foo', url: '/u/r/l/:foobar'});
      kuzzle.pluginsManager.routes = [{verb: 'bar', action: 'publicMethod', controller: 'foobar', url: '/foobar'}];

      return serverController.info()
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).not.be.null();
          should(response.serverInfo).be.an.Object();
          should(response.serverInfo.kuzzle).be.and.Object();
          should(response.serverInfo.kuzzle.version).be.a.String();
          should(response.serverInfo.kuzzle.api).be.an.Object();
          should(response.serverInfo.kuzzle.api.routes).match({
            foo: {
              publicMethod: {
                action: 'publicMethod',
                controller: 'foo',
                http: [
                  {url: '/u/r/l', verb: 'FOO'},
                  {url: '/u/r/l/:foobar', verb: 'FOO'}
                ]
              },
              baz: {
                action: 'baz',
                controller: 'foo'
              }
            },
            foobar: {
              publicMethod: {
                action: 'publicMethod',
                controller: 'foobar',
                http: [{
                  url: '_plugin/foobar',
                  verb: 'BAR'
                }]
              },
              anotherMethod: {
                action: 'anotherMethod',
                controller: 'foobar'
              }
            }
          });
          should(response.serverInfo.kuzzle.plugins).be.an.Object();
          should(response.serverInfo.kuzzle.system).be.an.Object();
          should(response.serverInfo.services).be.an.Object();
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.broker.getInfos.rejects(new Error('foobar'));
      return should(serverController.info()).be.rejected();
    });
  });
});
