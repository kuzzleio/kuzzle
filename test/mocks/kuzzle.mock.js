var
  sinon = require('sinon'),
  Kuzzle = require('../../lib/api/kuzzle'),
  foo = {foo: 'bar'};

/**
 * @constructor
 */
function KuzzleMock () {
  var k;

  for (k in this) {
    if (!this.hasOwnProperty(k)) {
      this[k] = function () {               // eslint-disable-line no-loop-func
        throw new Error(`Kuzzle original property ${k} is not mocked`);
      };
    }
  }

  this.indexCache = {
    add: sinon.spy(),
    remove: sinon.spy()
  };

  this.notifier = {
    notifyDocumentCreate: sinon.spy(),
    notifyDocumentDelete: sinon.spy(),
    notifyDocumentReplace: sinon.spy(),
    notifyDocumentUpdate: sinon.spy(),
    publish: sinon.stub().resolves(foo)
  };

  this.passport = {
    use: sinon.spy()
  };

  this.pluginsManager = {
    trigger: sinon.spy(function () {return Promise.resolve(arguments[1]);})
  };

  this.repositories = {
    user: {
      load: sinon.stub().resolves(foo)
    }
  };

  this.router = {
    execute: sinon.stub().resolves(foo),
    newConnection: sinon.stub().resolves(foo),
    removeConnection: sinon.spy()
  };

  this.services = {
    list: {
      readEngine: {
        getMapping: sinon.stub().resolves(foo),
        listIndexes: sinon.stub().resolves({indexes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']})
      },
      writeEngine: {
        create: sinon.stub().resolves(foo),
        createCollection: sinon.stub().resolves(foo),
        createIndex: sinon.stub().resolves(foo),
        createOrReplace: sinon.stub().resolves(foo),
        delete: sinon.stub().resolves(foo),
        deleteByQuery: sinon.stub().resolves(Object.assign({}, foo, {ids: 'responseIds'})),
        deleteIndex: sinon.stub().resolves(foo),
        deleteIndexes: sinon.stub().resolves({deleted: ['a', 'e', 'i']}),
        getAutoRefresh: sinon.stub().resolves(false),
        getMapping: sinon.stub().resolves(foo),
        import: sinon.stub().resolves(foo),
        refreshIndex: sinon.stub().resolves(foo),
        replace: sinon.stub().resolves(foo),
        setAutoRefresh: sinon.stub().resolves(true),
        truncateCollection: sinon.stub().resolves(foo),
        update: sinon.stub().resolves(foo),
        updateMapping: sinon.stub().resolves(foo)
      }
    }
  };

  this.statistics = {
    getAllStats: sinon.stub().resolves(foo),
    getLastStats: sinon.stub().resolves(foo),
    getStats: sinon.stub().resolves(foo)
  };
}

KuzzleMock.prototype = new Kuzzle();
KuzzleMock.prototype.constructor = Kuzzle;

module.exports = KuzzleMock;


