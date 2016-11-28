var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  ReadController = require('../../../lib/api/controllers/readController');

describe('Test: read controller', () => {
  var
    controller,
    kuzzle,
    requestObject;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    controller = new ReadController(kuzzle);
    requestObject = new RequestObject({index: '%test', collection: 'unit-test-readcontroller'});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#search', () => {
    it('should fulfill with a response object', () => {
      return controller.search(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.services.list.storageEngine.search.returns(Promise.reject(new Error('foobar')));
      return should(controller.search(requestObject, {}))
        .be.rejectedWith('foobar');
    });

    it('should trigger a plugin event', function () {
      return controller.search(requestObject)
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeSearch')
            .be.calledWith('data:afterSearch');
        });
    });
  });

  describe('#scroll', () => {
    it('should fulfill with a response object', () => {
      kuzzle.services.list.storageEngine.scroll.returns(Promise.resolve({}));
      return controller.scroll(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.services.list.storageEngine.scroll.returns(Promise.reject(new Error('foobar')));
      return should(controller.scroll(requestObject), {}).be.rejected();
    });

    it('should trigger a plugin event', function () {
      kuzzle.services.list.storageEngine.scroll.returns(Promise.resolve({}));
      return controller.scroll(requestObject, {})
        .then(() => {
          try {
            should(kuzzle.pluginsManager.trigger)
              .be.calledTwice()
              .be.calledWith('data:beforeScroll')
              .be.calledWith('data:afterScroll');

            return Promise.resolve();
          }
          catch (error) {
            return Promise.reject(error);
          }
        });
    });
  });

  describe('#get', () => {
    it('should fulfill with a response object', () => {
      return controller.get(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.services.list.storageEngine.get.returns(Promise.reject(new Error('foobar')));
      return should(controller.get(requestObject, {})).be.rejected();
    });

    it('should trigger a plugin event', function () {
      return controller.get(requestObject, {})
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeGet')
            .be.calledWith('data:afterGet');
        });
    });
  });

  describe('#count', () => {
    it('should fulfill with a response object', () => {
      return controller.count(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.services.list.storageEngine.count.returns(Promise.reject(new Error('foobar')));
      return should(controller.count(requestObject, {})).be.rejected();
    });

    it('should emit a data:count hook when counting', function () {
      return controller.count(requestObject, {})
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeCount')
            .be.calledWith('data:afterCount');
        });
    });
  });

  describe('#listCollections', () => {
    var
      userContext = {
        connection: {id: 'connectionid'},
        token: null
      };

    beforeEach(() => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['foo']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'foo', index: 'index'},
        {name: 'bar', index: 'index'},
        {name: 'baz', index: 'wrong'}
      ]);
    });

    it('should resolve to a full collections list', () => {
      requestObject = new RequestObject({index: 'index'}, {}, '');

      return controller.listCollections(requestObject, userContext)
        .then(response => {
          should(kuzzle.hotelClerk.getRealtimeCollections).be.calledOnce();
          should(kuzzle.services.list.storageEngine.listCollections).be.calledOnce();
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body.type).be.exactly('all');
          should(response.responseObject.data.body.collections).not.be.undefined().and.be.an.Array();
          should(response.responseObject.data.body.collections).deepEqual([{name: 'bar', type: 'realtime'}, {name: 'foo', type: 'realtime'}, {name: 'foo', type: 'stored'}]);
        });
    });

    it('should trigger a plugin event', function () {
      return controller.listCollections(requestObject, {})
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeListCollections')
            .be.calledWith('data:afterListCollections');
        });
    });

    it('should reject the request if an invalid "type" argument is provided', () => {
      requestObject = new RequestObject({body: {type: 'foo'}}, {}, '');

      return should(controller.listCollections(requestObject, userContext)).be.rejected();
    });

    it('should only return stored collections with type = stored', () => {
      requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');

      return controller.listCollections(requestObject, userContext)
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body.type).be.exactly('stored');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.false();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should only return realtime collections with type = realtime', () => {
      requestObject = new RequestObject({body: {type: 'realtime'}}, {}, '');

      return controller.listCollections(requestObject, userContext)
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data.body.type).be.exactly('realtime');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.false();
        });
    });

    it('should return a portion of the collection list if from and size are specified', () => {
      requestObject = new RequestObject({index: 'index', body: {type: 'all', from: 2, size: 3}}, {}, '');
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return controller.listCollections(requestObject, userContext).then(response => {
        should(response.userContext).be.instanceof(Object);
        should(response.responseObject).be.an.instanceOf(ResponseObject);
        should(response.responseObject.data.body.collections).be.deepEqual([
          {name: 'brealtime', type: 'realtime'},
          {name: 'bstored', type: 'stored'},
          {name: 'crealtime', type: 'realtime'}
        ]);
        should(response.responseObject.data.body.type).be.exactly('all');
        should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
        should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
      });
    });

    it('should return a portion of the collection list if from is specified', () => {
      requestObject = new RequestObject({index: 'index', body: {type: 'all', from: 8}}, {}, '');
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return controller.listCollections(requestObject, userContext).then(response => {
        should(response.responseObject).be.an.instanceOf(ResponseObject);
        should(response.responseObject.data.body.type).be.exactly('all');
        should(response.responseObject.data.body.collections).be.deepEqual([
          {name: 'erealtime', type: 'realtime'},
          {name: 'estored', type: 'stored'}
        ]);
        should(response.userContext).be.instanceof(Object);
        should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
        should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
      });
    });

    it('should return a portion of the collection list if size is specified', () => {
      requestObject = new RequestObject({index: 'index', body: {type: 'all', size: 2}}, {}, '');
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return controller.listCollections(requestObject, userContext).then(response => {
        should(response.userContext).be.instanceof(Object);
        should(response.responseObject).be.an.instanceOf(ResponseObject);
        should(response.responseObject.data.body.collections).be.deepEqual([
          {name: 'arealtime', type: 'realtime'},
          {name: 'astored', type: 'stored'}
        ]);
        should(response.responseObject.data.body.type).be.exactly('all');
        should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
        should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
      });
    });


    it('should reject with a response object if getting stored collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.reject(new Error('foobar')));
      requestObject = new RequestObject({body: {type: 'stored'}}, {}, '');
      return should(controller.listCollections(requestObject, userContext)).be.rejected();
    });

    it('should reject with a response object if getting all collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.reject(new Error('foobar')));
      requestObject = new RequestObject({body: {type: 'all'}}, {}, '');
      return should(controller.listCollections(requestObject, userContext)).be.rejected();
    });

  });

  describe('#now', () => {
    it('should trigger a plugin event', function () {
      return controller.now(requestObject, {})
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeNow')
            .be.calledWith('data:afterNow');
        });
    });

    it('should resolve to a number', () => {
      return controller.now(requestObject)
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject.data).not.be.undefined();
          should(response.responseObject.data.body.now).not.be.undefined().and.be.a.Number();
        });
    });
  });

  describe('#listIndexes', () => {
    it('should fulfill with a response object', () => {
      return controller.listIndexes(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.services.list.storageEngine.listIndexes.returns(Promise.reject(new Error('foobar')));
      return should(controller.listIndexes(requestObject, {})).be.rejected();
    });

    it('should emit a data:listIndexes hook when reading indexes', function () {
      return controller.listIndexes(requestObject, {})
        .then(() => {
          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeListIndexes')
            .be.calledWith('data:afterListIndexes');
        });
    });
  });

  describe('#serverInfo', () => {
    it('should return a properly formatted server information object', () => {
      return controller.serverInfo(requestObject, {})
        .then(response => {
          var jsonResponse = response.responseObject.toJson();

          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(jsonResponse.status).be.exactly(200);
          should(jsonResponse.error).be.null();
          should(jsonResponse.result).not.be.null();
          should(jsonResponse.result.serverInfo).be.an.Object();
          should(jsonResponse.result.serverInfo.kuzzle).be.and.Object();
          should(jsonResponse.result.serverInfo.kuzzle.version).be.a.String();
          should(jsonResponse.result.serverInfo.kuzzle.api).be.an.Object();
          should(jsonResponse.result.serverInfo.kuzzle.api.version).be.a.String();
          should(jsonResponse.result.serverInfo.kuzzle.api.routes).be.an.Object();
          should(jsonResponse.result.serverInfo.kuzzle.plugins).be.an.Object();
          should(jsonResponse.result.serverInfo.kuzzle.system).be.an.Object();
          should(jsonResponse.result.serverInfo.services).be.an.Object();
        });
    });

    it('should reject with a response object in case of error', () => {
      kuzzle.services.list.broker.getInfos.returns(Promise.reject(new Error('foobar')));
      return should(controller.serverInfo(requestObject, {})).be.rejected();
    });
  });

  describe('#collectionExists', () => {
    it('should call the storageEngine', () => {
      kuzzle.services.list.storageEngine.collectionExists.returns(Promise.resolve('result'));
      return controller.collectionExists(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject).match({
            error: null,
            data: {
              body: 'result'
            }
          });

          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeCollectionExists')
            .be.calledWith('data:afterCollectionExists');

          should(kuzzle.services.list.storageEngine.collectionExists)
            .be.calledOnce();
        });
    });
  });

  describe('#indexExists', () => {
    it('should call the storagEngine', () => {
      kuzzle.services.list.storageEngine.indexExists.returns(Promise.resolve('result'));
      return controller.indexExists(requestObject, {})
        .then(response => {
          should(response.userContext).be.instanceof(Object);
          should(response.responseObject).be.an.instanceOf(ResponseObject);
          should(response.responseObject).match({
            error: null,
            data: {
              body: 'result'
            }
          });

          should(kuzzle.pluginsManager.trigger)
            .be.calledTwice()
            .be.calledWith('data:beforeIndexExists')
            .be.calledWith('data:afterIndexExists');

          should(kuzzle.services.list.storageEngine.indexExists)
            .be.calledOnce();
        });
    });

  });

});
