var
  Bluebird = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  ServerController = require('../../../lib/api/controllers/serverController'),
  Request = require('kuzzle-common-objects').Request,
  ExternalServiceError = require('kuzzle-common-objects').errors.ExternalServiceError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  sandbox = sinon.sandbox.create();

describe('Test: server controller', () => {
  var
    serverController,
    kuzzle,
    foo = {foo: 'bar'},
    index = '%text',
    collection = 'unit-test-serverController',
    request;

  beforeEach(() => {
    var data = {
      controller: 'server',
      index,
      collection
    };
    kuzzle = new KuzzleMock();
    serverController = new ServerController(kuzzle);
    request = new Request(data);
  });

  afterEach(() => {
    sandbox.restore();
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
      kuzzle.internalEngine.bootstrap.adminExists.returns(Bluebird.resolve(false));

      return serverController.adminExists()
        .then((response) => {
          should(response).match({ exists: false });
        });
    });

    it('should return true if there is result', () => {
      kuzzle.internalEngine.bootstrap.adminExists.returns(Bluebird.resolve(true));

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
      kuzzle.services.list.storageEngine.getInfos.returns(Bluebird.resolve({status: 'green'}));
    });

    it('should return "ok" if storageEngine status is "green" and Redis is OK', () => {
      return serverController.healthCheck(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.status).be.exactly('ok');
        });
    });

    it('should return "ok" if storageEngine status is "yellow" and Redis is OK', () => {
      kuzzle.services.list.storageEngine.getInfos.returns(Bluebird.resolve({status: 'yellow'}));

      return serverController.healthCheck(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.status).be.exactly('ok');
        });
    });

    it('should throw an ExternalServiceError if storageEngine status is "red"', () => {
      kuzzle.services.list.storageEngine.getInfos.returns(Bluebird.resolve({status: 'red'}));

      return should(serverController.healthCheck(request)).be.rejectedWith(ExternalServiceError);
    });

    it('should throw an ExternalServiceError if storageEngine is KO', () => {
      kuzzle.services.list.storageEngine.getInfos.returns(Bluebird.reject(new Error()));

      return should(serverController.healthCheck(request)).be.rejectedWith(ExternalServiceError);
    });

    it('should throw an ExternalServiceError if memoryStorage is KO', () => {
      kuzzle.services.list.memoryStorage.getInfos.returns(Bluebird.reject(new Error()));

      return should(serverController.healthCheck(request)).be.rejectedWith(ExternalServiceError);
    });

    it('should throw an ExternalServiceError if internalCache is KO', () => {
      kuzzle.services.list.internalCache.getInfos.returns(Bluebird.reject(new Error()));

      return should(serverController.healthCheck(request)).be.rejectedWith(ExternalServiceError);
    });
  });

  describe('#info', () => {
    it('should return a properly formatted server information object', () => {
      return serverController.info()
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).not.be.null();
          should(response.serverInfo).be.an.Object();
          should(response.serverInfo.kuzzle).be.and.Object();
          should(response.serverInfo.kuzzle.version).be.a.String();
          should(response.serverInfo.kuzzle.api).be.an.Object();
          should(response.serverInfo.kuzzle.api.routes).be.an.Object();
          should(response.serverInfo.kuzzle.plugins).be.an.Object();
          should(response.serverInfo.kuzzle.system).be.an.Object();
          should(response.serverInfo.services).be.an.Object();
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.broker.getInfos.returns(Bluebird.reject(new Error('foobar')));
      return should(serverController.info()).be.rejected();
    });
  });
});