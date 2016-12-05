var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  ReadController = require('../../../lib/api/controllers/readController'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  foo = {foo: 'bar'};

describe('Test: read controller', () => {
  var
    controller,
    kuzzle,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    controller = new ReadController(kuzzle);
    request = new Request({index: '%test', collection: 'unit-test-readcontroller'});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#search', () => {
    it('should fulfill with an object', () => {
      return controller.search(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match(foo);
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.search.returns(Promise.reject(new Error('foobar')));

      return should(controller.search(request)).be.rejectedWith('foobar');
    });
  });

  describe('#scroll', () => {
    it('should fulfill with an object', () => {
      return controller.scroll(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match(foo);
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.scroll.returns(Promise.reject(new Error('foobar')));

      return should(controller.scroll(request)).be.rejectedWith('foobar');
    });
  });

  describe('#get', () => {
    beforeEach(() => {
      request.input.resource._id = 'an id';
    });

    it('should fulfill with an object', () => {
      return controller.get(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match({_source: {foo}});
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.get.returns(Promise.reject(new Error('foobar')));
      return should(controller.get(request)).be.rejected();
    });
  });

  describe('#count', () => {
    beforeEach(() => {
      request.input.body = {some: 'body'};
    });

    it('should fulfill with an object', () => {
      return controller.count(request)
        .then(response => {
          should(response).be.Number();
          should(response).be.eql(42);
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.count.returns(Promise.reject(new Error('foobar')));
      return should(controller.count(request)).be.rejected();
    });
  });

  describe('#listCollections', () => {
    beforeEach(() => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['foo']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'foo', index: 'index'},
        {name: 'bar', index: 'index'},
        {name: 'baz', index: 'wrong'}
      ]);
    });

    it('should resolve to a full collections list', () => {
      request = new Request({index: 'index'});

      return controller.listCollections(request)
        .then(response => {
          should(kuzzle.hotelClerk.getRealtimeCollections).be.calledOnce();
          should(kuzzle.services.list.storageEngine.listCollections).be.calledOnce();
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('all');
          should(response.collections).not.be.undefined().and.be.an.Array();
          should(response.collections).deepEqual([{name: 'bar', type: 'realtime'}, {name: 'foo', type: 'realtime'}, {name: 'foo', type: 'stored'}]);
        });
    });

    it('should reject the request if an invalid "type" argument is provided', () => {
      request = new Request({index: 'index', type: 'foo'});

      return should(() => {
        controller.listCollections(request);
      }).throw(BadRequestError);
    });

    it('should only return stored collections with type = stored', () => {
      request = new Request({index: 'index', type: 'stored'});

      return controller.listCollections(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('stored');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.false();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should only return realtime collections with type = realtime', () => {
      request = new Request({index: 'index', type: 'realtime'});

      return controller.listCollections(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.type).be.exactly('realtime');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.false();
        });
    });

    it('should return a portion of the collection list if from and size are specified', () => {
      request = new Request({index: 'index', type: 'all', from: 2, size: 3});
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return controller.listCollections(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.collections).be.deepEqual([
            {name: 'brealtime', type: 'realtime'},
            {name: 'bstored', type: 'stored'},
            {name: 'crealtime', type: 'realtime'}
          ]);
          should(response.type).be.exactly('all');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should return a portion of the collection list if from is specified', () => {
      request = new Request({index: 'index', type: 'all', from: 8});
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}}));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'}, {name: 'brealtime', index: 'index'}, {name: 'crealtime', index: 'index'}, {name: 'drealtime', index: 'index'}, {name: 'erealtime', index: 'index'}, {name: 'baz', index: 'wrong'}
      ]);

      return controller.listCollections(request)
        .then(response => {
          should(response.type).be.exactly('all');
          should(response.collections).be.deepEqual([
            {name: 'erealtime', type: 'realtime'},
            {name: 'estored', type: 'stored'}
          ]);
          should(response).be.instanceof(Object);
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });

    it('should return a portion of the collection list if size is specified', () => {
      request = new Request({index: 'index', type: 'all', size: 2});
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.resolve({
        collections: {stored: ['astored', 'bstored', 'cstored', 'dstored', 'estored']}
      }));
      kuzzle.hotelClerk.getRealtimeCollections.returns([
        {name: 'arealtime', index: 'index'},
        {name: 'brealtime', index: 'index'},
        {name: 'crealtime', index: 'index'},
        {name: 'drealtime', index: 'index'},
        {name: 'erealtime', index: 'index'},
        {name: 'baz', index: 'wrong'}
      ]);

      return controller.listCollections(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response.collections).be.deepEqual([
            {name: 'arealtime', type: 'realtime'},
            {name: 'astored', type: 'stored'}
          ]);
          should(response.type).be.exactly('all');
          should(kuzzle.hotelClerk.getRealtimeCollections.called).be.true();
          should(kuzzle.services.list.storageEngine.listCollections.called).be.true();
        });
    });


    it('should reject an error if getting stored collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.reject(new Error('foobar')));
      request = new Request({index: 'index', type: 'stored'});
      return should(controller.listCollections(request)).be.rejected();
    });

    it('should reject an error if getting all collections fails', () => {
      kuzzle.services.list.storageEngine.listCollections.returns(Promise.reject(new Error('foobar')));
      request = new Request({index: 'index', type: 'all'});
      return should(controller.listCollections(request)).be.rejected();
    });

  });

  describe('#now', () => {
    it('should resolve to a number', () => {
      return controller.now(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).not.be.undefined();
          should(response.now).not.be.undefined().and.be.a.Number();
        });
    });
  });

  describe('#listIndexes', () => {
    it('should fulfill with a response object', () => {
      return controller.listIndexes(request)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).be.match({indexes: [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i' ]});
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.storageEngine.listIndexes.returns(Promise.reject(new Error('foobar')));
      return should(controller.listIndexes(request)).be.rejected();
    });
  });

  describe('#serverInfo', () => {
    it('should return a properly formatted server information object', () => {
      return controller.serverInfo()
        .then(response => {
          should(response).be.instanceof(Object);
          should(response).not.be.null();
          should(response.serverInfo).be.an.Object();
          should(response.serverInfo.kuzzle).be.and.Object();
          should(response.serverInfo.kuzzle.version).be.a.String();
          should(response.serverInfo.kuzzle.api).be.an.Object();
          should(response.serverInfo.kuzzle.api.version).be.a.String();
          should(response.serverInfo.kuzzle.api.routes).be.an.Object();
          should(response.serverInfo.kuzzle.plugins).be.an.Object();
          should(response.serverInfo.kuzzle.system).be.an.Object();
          should(response.serverInfo.services).be.an.Object();
        });
    });

    it('should reject an error in case of error', () => {
      kuzzle.services.list.broker.getInfos.returns(Promise.reject(new Error('foobar')));
      return should(controller.serverInfo(request)).be.rejected();
    });
  });

  describe('#collectionExists', () => {
    it('should call the storageEngine', () => {
      kuzzle.services.list.storageEngine.collectionExists.returns(Promise.resolve(foo));
      return controller.collectionExists(request)
        .then(response => {
          should(response).match(foo);
          should(kuzzle.services.list.storageEngine.collectionExists).be.calledOnce();
        });
    });
  });

  describe('#indexExists', () => {
    it('should call the storagEngine', () => {
      kuzzle.services.list.storageEngine.indexExists.returns(Promise.resolve(foo));
      return controller.indexExists(request)
        .then(response => {
          should(response).match(foo);
          should(kuzzle.services.list.storageEngine.indexExists).be.calledOnce();
        });
    });
  });
});
