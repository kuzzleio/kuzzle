var
  should = require('should'),
  sinon = require('sinon'),
  params = require('rc')('kuzzle'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError;

require('sinon-as-promised');

describe('InternalEngine', () => {
  var
    kuzzle,
    sandbox;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
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
        filters = { 'some': 'filters' },
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('search')
        .once()
        .resolves({hits: { hits: [ 'foo', 'bar']}, total: 123});

      return kuzzle.internalEngine.search(collection, filters)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            body: filters
          });

          should(result).be.an.Object().and.not.be.empty();
          should(result.total).be.eql(123);
          should(result.hits).be.an.Array().and.match(['foo', 'bar']);
        });
    });

    it('should perform a search on an empty filter if the filters argument is missing', () => {
      var
        collection = 'collection',
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('search')
        .once()
        .resolves({hits: { hits: [ 'foo', 'bar']}, total: 123});

      return kuzzle.internalEngine.search(collection)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            body: {}
          });

          should(result).be.an.Object().and.not.be.empty();
          should(result.total).be.eql(123);
          should(result.hits).be.an.Array().and.match(['foo', 'bar']);
        });
    });

    it('should rejects the promise if the search fails', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'search').rejects();
      return should(kuzzle.internalEngine.search('foo')).be.rejected();
    });
  });

  describe('#get', () => {
    it('should return elasticsearch response', () => {
      var
        collection = 'foo',
        id = 'bar',
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('get')
        .once()
        .resolves({'foo': 'bar'});

      return kuzzle.internalEngine.get(collection, id)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            id
          });

          should(result).be.an.Object().and.match({'foo': 'bar'});
        });
    });

    it('should reject the promise if getting the document fails', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'get').rejects();
      return should(kuzzle.internalEngine.get('foo', 'bar')).be.rejected();
    });
  });

  describe('#mget', () => {
    it('should return elasticsearch response', () => {
      var
        collection = 'foo',
        ids = ['bar', 'qux'],
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('mget')
        .once()
        .resolves({docs: ['foo', 'bar']});

      return kuzzle.internalEngine.mget(collection, ids)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
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
      sandbox.stub(kuzzle.internalEngine.client, 'mget').rejects();
      return should(kuzzle.internalEngine.mget('foo', ['bar'])).be.rejected();
    });
  });

  describe('#create', () => {
    it('should return a properly constructed response', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'},
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('create')
        .once()
        .resolves({id});

      return kuzzle.internalEngine.create(collection, id, content)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            id,
            body: content
          });

          should(result).be.an.Object().and.not.be.empty();
          should(result).match({id, _source: content});
        });
    });

    it('should reject the promise if creating the document fails', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'create').rejects();
      return should(kuzzle.internalEngine.create('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#createOrReplace', () => {
    it('should return a properly constructed response', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'},
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('index')
        .once()
        .resolves({id});

      return kuzzle.internalEngine.createOrReplace(collection, id, content)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            id,
            body: content
          });

          should(result).be.an.Object().and.not.be.empty();
          should(result).match({id, _source: content});
        });
    });

    it('should reject the promise if creating the document fails', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'index').rejects();
      return should(kuzzle.internalEngine.createOrReplace('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#update', () => {
    it('should return a properly constructed response', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'},
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('update')
        .once()
        .resolves({id});

      return kuzzle.internalEngine.update(collection, id, content)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
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
      sandbox.stub(kuzzle.internalEngine.client, 'update').rejects();
      return should(kuzzle.internalEngine.update('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#replace', () => {
    it('should replace the document content if it exists', () => {
      var
        collection = 'foo',
        id = 'bar',
        content = {'foo': 'bar'},
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('index')
        .once()
        .resolves({id});

      sandbox.stub(kuzzle.internalEngine.client, 'exists').resolves(true);

      return kuzzle.internalEngine.replace(collection, id, content)
        .then(result => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            id,
            body: content
          });

          should(result).be.an.Object().and.not.be.empty();
          should(result).match({id, _source: content});
        });
    });

    it('should rejects the promise if the document does not exist', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'exists').resolves(false);

      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejectedWith(NotFoundError);
    });

    it('should rejects the promise if the replace action fails', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'exists').resolves(true);
      sandbox.stub(kuzzle.internalEngine.client, 'index').rejects();
      return should(kuzzle.internalEngine.replace('foo', 'bar', {'baz': 'qux'})).be.rejected();
    });
  });

  describe('#delete', () => {
    it('should forward the delete action to elasticsearch', () => {
      var
        collection = 'foo',
        id = 'bar',
        mock;

      mock = sandbox.mock(kuzzle.internalEngine.client)
        .expects('delete')
        .once()
        .resolves();

      return kuzzle.internalEngine.delete(collection, id)
        .then(() => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({
            index: kuzzle.config.internalIndex,
            type: collection,
            id
          });
        });
    });

    it('should reject the promise if deleting the document fails', () => {
      sandbox.stub(kuzzle.internalEngine.client, 'delete').rejects();
      return should(kuzzle.internalEngine.delete('foo', 'bar')).be.rejected();
    });
  });

  describe('#createInternalIndex', () => {
    it('should forward the request to elasticsearch', () => {
      var mock = sandbox.mock(kuzzle.internalEngine.client.indices)
        .expects('create')
        .once()
        .resolves();

      return kuzzle.internalEngine.createInternalIndex()
        .then(() => {
          mock.verify();
          should(mock.args[0].length).be.eql(1);
          should(mock.args[0][0]).match({index: kuzzle.config.internalIndex});
        });
    });

    it('should reject the promise if creating the internal index fails', () => {
      sandbox.stub(kuzzle.internalEngine.client.indices, 'create').rejects();
      return should(kuzzle.internalEngine.createInternalIndex()).be.rejected();
    });
  });
});