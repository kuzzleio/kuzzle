var
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  InternalEngine = rewire('../../../lib/services/internalEngine'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError;

describe('InternalEngine', () => {
  var
    kuzzle,
    reset;

  beforeEach(() => {
    reset = InternalEngine.__set__({
      Elasticsearch: {
        Client: function () {
          this.indices = {
            create: sinon.stub().resolves(),
            delete: sinon.stub().resolves(),
            exists: sinon.stub().resolves(),
            getMapping: sinon.stub().resolves(),
            putMapping: sinon.stub().resolves(),
            refresh: sinon.stub().resolves()
          };

          this.create = sinon.stub().resolves();
          this.delete = sinon.stub().resolves();
          this.exists = sinon.stub().resolves();
          this.get = sinon.stub().resolves();
          this.index = sinon.stub().resolves();
          this.mget = sinon.stub().resolves();
          this.search = sinon.stub().resolves();
          this.update = sinon.stub().resolves();
        }
      }
    });
    kuzzle = new KuzzleMock();
    kuzzle.internalEngine = new InternalEngine(kuzzle);

    return kuzzle.internalEngine.init();
  });

  afterEach(() => {
    reset();
  });

  describe('#init', () => {
    it('should act as a singleton', () => {
      return should(kuzzle.internalEngine.init()).be.fulfilledWith(kuzzle.internalEngine);
    });
  });

  describe('#search', () => {
    it('should harmonize search results', () => {
      var
        collection = 'collection',
        query = { 'some': 'filters' };

      kuzzle.internalEngine.client.search.resolves({hits: { hits: ['foo', 'bar'], total: 123}});

      return kuzzle.internalEngine.search(collection, query)
        .then(result => {
          should(kuzzle.internalEngine.client.search)
            .be.calledOnce()
            .be.calledWithMatch({
              index: kuzzle.internalEngine.index,
              type: collection,
              body: {
                query: query,
                from: 0,
                size: 20
              }
            });

          should(result).be.an.Object().and.not.be.empty();
          should(result.total).be.eql(123);
          should(result.hits).be.an.Array().and.match(['foo', 'bar']);
        });
    });

    it('should perform a search on an empty filter if the filters argument is missing', () => {
      var
        collection = 'collection';

      kuzzle.internalEngine.client.search.resolves({hits: {hits: ['foo', 'bar']}, total: 123});

      return kuzzle.internalEngine.search(collection)
        .then(result => {
          should(kuzzle.internalEngine.client.search)
            .be.calledOnce()
            .be.calledWithMatch({
              index: kuzzle.internalEngine.index,
              type: collection,
              body: {
                from: 0,
                size: 20
              }
            });

          should(result).be.an.Object().and.not.be.empty();
          should(result.total).be.eql(123);
          should(result.hits).be.an.Array().and.match(['foo', 'bar']);
        });
    });

    it('should rejects the promise if the search fails', () => {
      kuzzle.internalEngine.client.search.rejects();

      return should(kuzzle.internalEngine.search('foo')).be.rejected();
    });
  });

  describe('#get', () => {
    it('should return elasticsearch response', () => {
      var
        collection = 'foo',
        id = 'bar';

      kuzzle.internalEngine.client.get.resolves({foo: 'bar'});

      return kuzzle.internalEngine.get(collection, id)
        .then(result => {
          should(kuzzle.internalEngine.client.get)
            .be.calledOnce()
            .be.calledWithMatch({
              index: kuzzle.internalEngine.index,
              type: collection,
              id
            });

          should(result).be.an.Object().and.match({'foo': 'bar'});
        });
    });

    it('should reject the promise if getting the document fails', () => {
      kuzzle.internalEngine.client.get.rejects();
      return should(kuzzle.internalEngine.get('foo', 'bar')).be.rejected();
    });
  });

  describe('#mget', () => {
    it('should return elasticsearch response', () => {
      var
        collection = 'foo',
        ids = ['bar', 'qux'];

      kuzzle.internalEngine.client.mget.resolves({docs: ['foo', 'bar']});

      return kuzzle.internalEngine.mget(collection, ids)
        .then(result => {
          should(kuzzle.internalEngine.client.mget)
            .be.calledOnce()
            .be.calledWithMatch({
              index: '%kuzzle', type: collection,
              body: {
                ids
              }
            });

          should(result).be.an.Object().and.not.be.empty();
          should(result).not.have.property('docs');
          should(result).match({hits: ['foo', 'bar']});
        });
    });

    it('should reject the promise if getting the document fails', () => {
      kuzzle.internalEngine.client.mget.rejects();
      return should(kuzzle.internalEngine.mget('foo', ['bar'])).be.rejected();
    });
  });

  describe('#create', () => {
    it('should return a properly constructed response', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.create.resolves({id});

      return kuzzle.internalEngine.create(collection, id, content)
        .then(result => {
          should(kuzzle.internalEngine.client.create)
            .be.calledOnce()
            .be.calledWithMatch({
              index: '%kuzzle',
              type: collection,
              id,
              body: content
            });

          should(result).be.an.Object().and.not.be.empty();
          should(result).match({id, _source: content});
        });
    });

    it('should reject the promise if creating the document fails', () => {
      kuzzle.internalEngine.client.create.rejects();
      return should(kuzzle.internalEngine.create('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#createOrReplace', () => {
    it('should return a properly constructed response', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.index.resolves({id});

      return kuzzle.internalEngine.createOrReplace(collection, id, content)
        .then(result => {
          should(kuzzle.internalEngine.client.index)
            .be.calledOnce()
            .be.calledWithMatch({
              index: '%kuzzle',
              type: collection,
              id,
              body: content
            });

          should(result).be.an.Object().and.not.be.empty();
          should(result).match({id, _source: content});
        });
    });

    it('should reject the promise if creating the document fails', () => {
      kuzzle.internalEngine.client.index.rejects();
      return should(kuzzle.internalEngine.createOrReplace('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#update', () => {
    it('should return a properly constructed response', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.update.resolves({id});

      return kuzzle.internalEngine.update(collection, id, content)
        .then(result => {
          should(kuzzle.internalEngine.client.update)
            .be.calledOnce()
            .be.calledWithMatch({
              index: '%kuzzle',
              type: collection,
              id,
              body: {
                doc: content
              }
            });


          should(result).be.an.Object().and.not.be.empty();
        });
    });

    it('should reject the promise if creating the document fails', () => {
      kuzzle.internalEngine.client.update.rejects();
      return should(kuzzle.internalEngine.update('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#replace', () => {
    it('should replace the document content if it exists', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'};

      kuzzle.internalEngine.client.index.resolves({id});
      kuzzle.internalEngine.client.exists.resolves(true);

      return kuzzle.internalEngine.replace(collection, id, content)
        .then(result => {
          should(kuzzle.internalEngine.client.index)
            .be.calledOnce()
            .be.calledWithMatch({
              index: '%kuzzle',
              type: collection,
              id,
              body: content
            });

          should(result).be.an.Object().and.not.be.empty();
          should(result).match({id, _source: content});
        });
    });

    it('should rejects the promise if the document does not exist', () => {
      kuzzle.internalEngine.client.exists.resolves(false);
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(NotFoundError);
    });

    it('should rejects the promise if the replace action fails', () => {
      kuzzle.internalEngine.client.exists.resolves(true);
      kuzzle.internalEngine.client.index.rejects();
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#delete', () => {
    it('should forward the delete action to elasticsearch', () => {
      var
        collection = 'foo',
        id = 'bar';

      kuzzle.internalEngine.client.delete.resolves();

      return kuzzle.internalEngine.delete(collection, id)
        .then(() => {
          should(kuzzle.internalEngine.client.delete)
            .be.calledOnce()
            .be.calledWithMatch({
              index: '%kuzzle',
              type: collection,
              id
            });
        });
    });

    it('should reject the promise if deleting the document fails', () => {
      kuzzle.internalEngine.client.delete.rejects();
      return should(kuzzle.internalEngine.delete('foo', 'bar')).be.rejected();
    });
  });

  describe('#createInternalIndex', () => {
    it('should forward the request to elasticsearch', () => {
      var
        createStub = kuzzle.internalEngine.client.indices.create,
        existsStub = kuzzle.internalEngine.client.indices.exists.resolves(false);

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          should(existsStub).be.calledOnce();
          should(existsStub).be.calledWith({index: kuzzle.internalEngine.index});
          should(createStub).be.calledOnce();
          should(createStub).be.calledWith({index: kuzzle.internalEngine.index});
        });
    });

    it('should not try to create an existing index', () => {
      var
        createStub = kuzzle.internalEngine.client.indices.create,
        existsStub = kuzzle.internalEngine.client.indices.exists.resolves(true);

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          should(existsStub).be.calledOnce();
          should(existsStub).be.calledWith({index: kuzzle.internalEngine.index});
          should(createStub).have.callCount(0);
        });
    });

    it('should reject the promise if creating the internal index fails', () => {
      kuzzle.internalEngine.client.indices.exists.resolves(false);
      kuzzle.internalEngine.client.indices.create.rejects();

      return should(kuzzle.internalEngine.createInternalIndex()).be.rejected();
    });
  });

  describe('#listIndexes', () => {
    it('should forward the request to elasticsearch', () => {
      kuzzle.internalEngine.client.indices.getMapping.resolves({
        index1: {foo: 'bar'},
        index2: {foo: 'bar'}
      });

      return kuzzle.internalEngine.listIndexes()
        .then(result => {
          should(kuzzle.internalEngine.client.indices.getMapping)
            .be.calledOnce();
          should(kuzzle.internalEngine.client.indices.getMapping.firstCall.args)
            .have.length(0);


          should(result).match(['index1', 'index2']);
        });

    });
  });

  describe('#getMapping', () => {
    it('should forward the request to elasticseach', () => {
      var data = {foo: 'bar'};

      return kuzzle.internalEngine.getMapping(data)
        .then(() => {
          should(kuzzle.internalEngine.client.indices.getMapping)
            .be.calledOnce()
            .be.calledWithExactly(data);
        });
    });
  });

  describe('#deleteIndex', () => {
    it('should forward the request to elasticsearch', () => {
      return kuzzle.internalEngine.deleteIndex()
        .then(() => {
          should(kuzzle.internalEngine.client.indices.delete)
            .be.calledOnce()
            .be.calledWithMatch({
              index: kuzzle.internalEngine.index
            });
        });
    });
  });

  describe('#updateMapping', () => {
    it('should forward the request to elasticsearch', () => {
      var
        type = 'collection',
        mapping = {foo: 'bar'};

      return kuzzle.internalEngine.updateMapping(type, mapping)
        .then(() => {
          should(kuzzle.internalEngine.client.indices.putMapping)
            .be.calledOnce()
            .be.calledWithMatch({
              index: kuzzle.internalEngine.index,
              type,
              body: mapping
            });
        });
    });
  });

  describe('#refresh', () => {
    it ('should forward the request to elasticsearch', () => {
      return kuzzle.internalEngine.refresh()
        .then(() => {
          should(kuzzle.internalEngine.client.indices.refresh)
            .be.calledOnce()
            .be.calledWithMatch({
              index: kuzzle.internalEngine.index
            });
        });
    });
  });

});
