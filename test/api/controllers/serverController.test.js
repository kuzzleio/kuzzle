const
  should = require('should'),
  sinon = require('sinon'),
  ServerController = require('../../../lib/api/controllers/serverController'),
  {
    Request,
    errors: { ServiceUnavailableError }
  } = require('kuzzle-common-objects'),
  BaseController = require('../../../lib/api/controllers/baseController'),
  KuzzleMock = require('../../mocks/kuzzle.mock');

xdescribe('Test: server controller', () => {
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

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(serverController).instanceOf(BaseController);
    });
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
          should(kuzzle.internalIndex.adminExists).be.calledOnce();
        });
    });

    it('should return false if there is no result', () => {
      kuzzle.internalIndex.adminExists.resolves(false);

      return serverController.adminExists()
        .then(response => {
          should(response).match({ exists: false });
        });
    });

    it('should return true if there is result', () => {
      kuzzle.internalIndex.adminExists.resolves(true);

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
      kuzzle.services.publicStorage.getInfos.resolves({status: 'green'});
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
      kuzzle.services.publicStorage.getInfos.resolves({status: 'yellow'});

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
      kuzzle.services.publicStorage.getInfos.resolves({status: 'red'});

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
      kuzzle.services.publicStorage.getInfos.rejects(new Error());

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
      kuzzle.services.publicCache.getInfos.rejects(new Error());

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
      kuzzle.services.internalCache.getInfos.rejects(new Error());

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
      serverController._buildApiDefinition = sinon.stub()
        .onCall(0).returns({
          foo: {
            publicMethod: {
              controller: 'foo',
              action: 'publicMethod',
              http: [
                { url: '/u/r/l', verb: 'FOO' },
                { url: '/u/:foobar', verb: 'FOO' }
              ]
            }
          }
        })
        .onCall(1).returns({
          foobar: {
            publicMethod: {
              action: 'publicMethod',
              controller: 'foobar',
              http: [{ url: '_plugin/foobar', verb: 'BAR' }]
            },
            anotherMethod: {
              action: 'anotherMethod',
              controller: 'foobar'
            }
          }
        });

      return serverController.info()
        .then(response => {
          should(serverController._buildApiDefinition).be.calledTwice();

          should(response).be.instanceof(Object);
          should(response).not.be.null();
          should(response.serverInfo).be.an.Object();
          should(response.serverInfo.kuzzle).be.and.Object();
          should(response.serverInfo.kuzzle.version).be.a.String();
          should(response.serverInfo.kuzzle.api).be.an.Object();
          should(response.serverInfo.kuzzle.api.routes).match({
            foo: {
              publicMethod: {
                controller: 'foo',
                action: 'publicMethod',
                http: [
                  { url: '/u/r/l', verb: 'FOO' },
                  { url: '/u/:foobar', verb: 'FOO' }
                ]
              }
            },
            foobar: {
              publicMethod: {
                action: 'publicMethod',
                controller: 'foobar',
                http: [{ url: '_plugin/foobar', verb: 'BAR' }]
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
      kuzzle.services.publicStorage.getInfos.rejects(new Error('foobar'));
      return should(serverController.info()).be.rejected();
    });
  });

  describe('#publicApi', () => {
    it('should build the api definition', () => {
      class Foo {
        constructor() {
          this.actions = new Set();
          this.actions.add('publicMethod', 'baz');
        }
        publicMethod() {}
        baz() {}
      }

      kuzzle.funnel.controllers = {
        foo: new Foo()
      };

      kuzzle.config.http.routes = [
        { verb: 'foo', action: 'publicMethod', controller: 'foo', url: '/u/r/l' },
        { verb: 'foo', action: 'publicMethod', controller: 'foo', url: '/u/:foobar' }
      ];

      kuzzle.funnel.pluginsControllers = {
        foobar: {
          publicMethod: function () {},
          anotherMethod: function () {},
        }
      };

      kuzzle.pluginsManager.routes = [{
        verb: 'bar', action: 'publicMethod', controller: 'foobar', url: '/foobar'
      }];

      serverController._buildApiDefinition = sinon.stub().returns({});

      return serverController.publicApi()
        .then(() => {
          should(serverController._buildApiDefinition).be.calledTwice();
          should(serverController._buildApiDefinition.getCall(0).args).be.eql([
            kuzzle.funnel.controllers,
            kuzzle.config.http.routes
          ]);
          should(serverController._buildApiDefinition.getCall(1).args).be.eql([
            kuzzle.funnel.pluginsControllers,
            kuzzle.pluginsManager.routes,
            '_plugin/'
          ]);
        });
    });
  });

  describe('#_buildApiDefinition', () => {
    it('should return api definition for the provided controllers', () => {
      class Foo {
        constructor() {
          this.actions = new Set();
          this.actions.add('publicMethod', 'baz');
        }
        publicMethod() {}
        baz() {}
      }

      const controllers = {
        foo: new Foo()
      };

      const routes = [
        { verb: 'foo', action: 'publicMethod', controller: 'foo', url: '/u/r/l' },
        { verb: 'foo', action: 'publicMethod', controller: 'foo', url: '/u/:foobar' }
      ];

      const pluginsControllers = {
        foobar: {
          publicMethod: function () {},
          anotherMethod: function () {},
        }
      };

      const pluginsRoutes = [{
        verb: 'bar', action: 'publicMethod', controller: 'foobar', url: '/foobar'
      }];


      const apiDefinition = serverController._buildApiDefinition(
        controllers,
        routes
      );

      const pluginApiDefinition = serverController._buildApiDefinition(
        pluginsControllers,
        pluginsRoutes,
        '_plugin/'
      );

      should(apiDefinition).match({
        foo: {
          publicMethod: {
            controller: 'foo',
            action: 'publicMethod',
            http: [
              { url: '/u/r/l', verb: 'FOO' },
              { url: '/u/:foobar', verb: 'FOO' }
            ]
          }
        }
      });

      should(pluginApiDefinition).match({
        foobar: {
          publicMethod: {
            action: 'publicMethod',
            controller: 'foobar',
            http: [{ url: '_plugin/foobar', verb: 'BAR' }]
          },
          anotherMethod: {
            action: 'anotherMethod',
            controller: 'foobar'
          }
        }
      });
    });
  });
});
