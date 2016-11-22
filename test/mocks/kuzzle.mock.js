var
  _ = require('lodash'),
  sinon = require('sinon'),
  Kuzzle = require('../../lib/api/kuzzle'),
  Promise = require('bluebird'),
  config = require('../../lib/config'),
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

  // we need a deep copy here
  this.config = _.merge({}, config);

  this.dsl = {
    register: sinon.stub().returns(Promise.resolve())
  };

  this.entryPoints = {
    http: {
      init: sinon.spy()
    },
    init: sinon.spy(),
    proxy: {
      dispatch: sinon.spy(),
      joinChannel: sinon.spy(),
      leaveChannel: sinon.spy()
    }
  };

  this.funnel = {
    controllers: {
      admin: {
        adminExists: sinon.spy(),
        createFirstAdmin: sinon.spy()
      }
    },
    init: sinon.spy()
  };

  this.hooks = {
    init: sinon.spy()
  };

  this.hotelClerk = {
    addToChannels: sinon.stub(),
    getRealtimeCollections: sinon.stub()
  };

  this.indexCache = {
    add: sinon.stub(),
    exists: sinon.stub(),
    init: sinon.stub().resolves(),
    initInternal: sinon.stub().resolves(),
    remove: sinon.stub(),
    reset: sinon.stub()
  };

  this.internalEngine = {
    bootstrap: {
      adminExists: sinon.stub().resolves(true),
      all: sinon.stub().resolves(),
      createCollections: sinon.stub().resolves(),
      createRolesCollection: sinon.stub().resolves(),
      createProfilesCollection: sinon.stub().resolves(),
      createUsersCollection: sinon.stub().resolves(),
      createPluginsCollection: sinon.stub().resolves()
    },
    createInternalIndex: sinon.stub().resolves(),
    createOrReplace: sinon.stub().resolves(),
    deleteIndex: sinon.stub().resolves(),
    get: sinon.stub().resolves(foo),
    index: 'internalIndex',
    init: sinon.stub().resolves(),
    refresh: sinon.stub().resolves(),
    search: sinon.stub().resolves(),
    updateMapping: sinon.stub().resolves()
  };

  this.once = sinon.stub();

  this.notifier = {
    init: sinon.spy(),
    notify: sinon.spy(),
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
    init: sinon.stub().resolves(),
    packages: {
      bootstrap: sinon.stub().resolves(),
      definitions: sinon.stub().resolves([]),
      getPackage: sinon.stub().resolves(),
    },
    plugins: {},
    run: sinon.stub().resolves(),
    getPluginsConfig: sinon.stub().returns({}),
    trigger: sinon.spy(function () {return Promise.resolve(arguments[1]);})
  };

  this.cliController = {
    init: sinon.stub().resolves(),
    actions: {
      adminExists: sinon.stub().resolves(),
      createFirstAdmin: sinon.stub().resolves(),
      cleanAndPrepare: sinon.stub().resolves(),
      cleanDb: sinon.stub().resolves(),
      managePlugins: sinon.stub().resolves(),
      data: sinon.stub().resolves()
    }
  };

  this.repositories = {
    init: sinon.stub().resolves(),
    user: {
      load: sinon.stub().resolves(foo)
    }
  };

  this.validation = {
    init: sinon.spy(),
    curateSpecification: sinon.spy(function () {return Promise.resolve();}),
    validate: sinon.spy(function () {return Promise.resolve(arguments[0]);}),
    validationPromise: sinon.spy(function () {return Promise.resolve(arguments[0]);}),
    addType: sinon.spy()
  };

  this.resetStorage = sinon.stub().resolves();

  this.rootPath = '/kuzzle';

  this.router = {
    execute: sinon.stub().resolves(foo),
    init: sinon.spy(),
    newConnection: sinon.stub().resolves(foo),
    removeConnection: sinon.spy(),
  };

  this.services = {
    init: sinon.stub().resolves(),
    list: {
      broker: {
        getInfos: sinon.stub().resolves(),
        listen: sinon.spy(),
        send: sinon.spy()
      },
      internalCache: {
        flushdb: sinon.stub().resolves(),
        getInfos: sinon.stub().resolves()
      },
      memoryStorage: {
        flushdb: sinon.stub().resolves(),
        getInfos: sinon.stub().resolves()
      },
      storageEngine: {
        get: sinon.stub().resolves({
          _source: foo
        }),
        getInfos: sinon.stub().resolves(),
        getMapping: sinon.stub().resolves(foo),
        listIndexes: sinon.stub().resolves({indexes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']}),
        collectionExists: sinon.stub().resolves(),
        count: sinon.stub().resolves(42),
        create: sinon.stub().resolves(foo),
        createCollection: sinon.stub().resolves(foo),
        createIndex: sinon.stub().resolves(foo),
        createOrReplace: sinon.stub().resolves(foo),
        delete: sinon.stub().resolves(foo),
        deleteByQuery: sinon.stub().resolves(Object.assign({}, foo, {ids: 'responseIds'})),
        deleteIndex: sinon.stub().resolves(foo),
        deleteIndexes: sinon.stub().resolves({deleted: ['a', 'e', 'i']}),
        getAutoRefresh: sinon.stub().resolves(false),
        import: sinon.stub().resolves(foo),
        indexExists: sinon.stub().resolves(),
        listCollections: sinon.stub().resolves(),
        refreshIndex: sinon.stub().resolves(foo),
        replace: sinon.stub().resolves(foo),
        search: sinon.stub().resolves(),
        scroll: sinon.stub().resolves(),
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
    getStats: sinon.stub().resolves(foo),
    init: sinon.spy()
  };
}

KuzzleMock.prototype = new Kuzzle();
KuzzleMock.prototype.constructor = Kuzzle;

module.exports = KuzzleMock;


