'use strict';

const
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
  for (let k in this) {
    if (!this.hasOwnProperty(k)) {
      this[k] = function () {
        throw new Error(`Kuzzle original property ${k} is not mocked`);
      };
    }
  }

  // we need a deep copy here
  this.config = _.merge({}, config);

  this.cliController = {
    init: sinon.stub().returns(Promise.resolve()),
    actions: {
      adminExists: sinon.stub().returns(Promise.resolve()),
      createFirstAdmin: sinon.stub().returns(Promise.resolve()),
      cleanAndPrepare: sinon.stub().returns(Promise.resolve()),
      cleanDb: sinon.stub().returns(Promise.resolve()),
      managePlugins: sinon.stub().returns(Promise.resolve()),
      data: sinon.stub().returns(Promise.resolve())
    }
  };

  this.dsl = {
    register: sinon.stub().returns(Promise.resolve()),
    remove: sinon.stub().returns(Promise.resolve())
  };

  this.gc = {
    init: sinon.spy(),
    run: sinon.spy()
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
      server: {
        adminExists: sinon.stub(),
      },
      security: {
        createFirstAdmin: sinon.spy()
      }
    },
    init: sinon.spy(),
    getRequestSlot: sinon.stub().yields(null),
    handleErrorDump: sinon.spy(),
    execute: sinon.spy(),
    processRequest: sinon.stub().returns(Promise.resolve()),
    checkRights: sinon.stub(),
    getEventName: sinon.spy()
  };

  this.hooks = {
    init: sinon.spy()
  };

  this.hotelClerk = {
    addToChannels: sinon.stub(),
    getRealtimeCollections: sinon.stub(),
    removeCustomerFromAllRooms: sinon.stub(),
    addSubscription: sinon.stub().returns(Promise.resolve(foo)),
    join: sinon.stub().returns(Promise.resolve(foo)),
    removeSubscription: sinon.stub().returns(Promise.resolve(foo)),
    countSubscription: sinon.stub().returns(Promise.resolve(foo)),
    listSubscriptions: sinon.stub().returns(Promise.resolve(foo)),
  };

  this.indexCache = {
    add: sinon.stub(),
    exists: sinon.stub(),
    init: sinon.stub().returns(Promise.resolve()),
    initInternal: sinon.stub().returns(Promise.resolve()),
    remove: sinon.stub(),
    reset: sinon.stub()
  };

  this.internalEngine = {
    bootstrap: {
      adminExists: sinon.stub().returns(Promise.resolve(true)),
      all: sinon.stub().returns(Promise.resolve()),
      createCollections: sinon.stub().returns(Promise.resolve()),
      createRolesCollection: sinon.stub().returns(Promise.resolve()),
      createProfilesCollection: sinon.stub().returns(Promise.resolve()),
      createUsersCollection: sinon.stub().returns(Promise.resolve()),
      createPluginsCollection: sinon.stub().returns(Promise.resolve())
    },
    createInternalIndex: sinon.stub().returns(Promise.resolve()),
    createOrReplace: sinon.stub().returns(Promise.resolve()),
    deleteIndex: sinon.stub().returns(Promise.resolve()),
    get: sinon.stub().returns(Promise.resolve(foo)),
    index: 'internalIndex',
    init: sinon.stub().returns(Promise.resolve()),
    refresh: sinon.stub().returns(Promise.resolve()),
    search: sinon.stub().returns(Promise.resolve()),
    updateMapping: sinon.stub().returns(Promise.resolve(foo))
  };

  this.once = sinon.stub();

  this.notifier = {
    init: sinon.spy(),
    notify: sinon.spy(),
    notifyDocumentCreate: sinon.spy(),
    notifyDocumentDelete: sinon.spy(),
    notifyDocumentReplace: sinon.spy(),
    notifyDocumentUpdate: sinon.spy(),
    publish: sinon.stub().returns(Promise.resolve(foo))
  };

  this.passport = {
    use: sinon.spy()
  };

  this.pluginsManager = {
    init: sinon.stub().returns(Promise.resolve()),
    plugins: {},
    run: sinon.stub().returns(Promise.resolve()),
    getPluginsFeatures: sinon.stub().returns({}),
    trigger: sinon.spy(function () {return Promise.resolve(arguments[1]);})
  };

  this.cliController = {
    init: sinon.stub().returns(Promise.resolve()),
    actions: {
      adminExists: sinon.stub().returns(Promise.resolve()),
      createFirstAdmin: sinon.stub().returns(Promise.resolve()),
      cleanAndPrepare: sinon.stub().returns(Promise.resolve()),
      cleanDb: sinon.stub().returns(Promise.resolve()),
      managePlugins: sinon.stub().returns(Promise.resolve()),
      data: sinon.stub().returns(Promise.resolve()),
      dump: sinon.stub().returns(Promise.resolve())
    }
  };

  this.repositories = {
    init: sinon.stub().returns(Promise.resolve()),
    user: {
      load: sinon.stub().returns(Promise.resolve(foo))
    }
  };

  this.validation = {
    init: sinon.spy(),
    curateSpecification: sinon.spy(function () {return Promise.resolve();}),
    validate: sinon.spy(function () {return Promise.resolve(arguments[0]);}),
    validationPromise: sinon.spy(function () {return Promise.resolve(arguments[0]);}),
    addType: sinon.spy()
  };

  this.repositories = {
    init: sinon.stub().returns(Promise.resolve()),
    profile: {
      load: sinon.stub().returns(Promise.resolve()),
      loadProfiles: sinon.stub().returns(Promise.resolve()),
      searchProfiles: sinon.stub().returns(Promise.resolve())
    },
    role: {
      getRoleFromRequest: sinon.spy(function () {return Promise.resolve(arguments[0]);}),
      loadRole: sinon.stub().returns(Promise.resolve()),
      loadRoles: sinon.stub().returns(Promise.resolve()),
      validateAndSaveRole: sinon.spy(function () {return Promise.resolve(arguments[0]);})
    },
    user: {
      load: sinon.stub().returns(Promise.resolve(foo)),
      search: sinon.stub().returns(Promise.resolve())
    },
    token: {
      anonymous: sinon.stub().returns({_id: 'anonymous'}),
      verifyToken: sinon.stub().returns(Promise.resolve())
    }
  };

  this.resetStorage = sinon.stub().returns(Promise.resolve());

  this.rootPath = '/kuzzle';

  this.router = {
    execute: sinon.stub().returns(Promise.resolve(foo)),
    init: sinon.spy(),
    newConnection: sinon.stub().returns(Promise.resolve(foo)),
    removeConnection: sinon.spy(),
  };

  this.services = {
    init: sinon.stub().returns(Promise.resolve()),
    list: {
      broker: {
        getInfos: sinon.stub().returns(Promise.resolve()),
        listen: sinon.spy(),
        send: sinon.stub().returns(Promise.resolve())
      },
      proxyBroker: {
        listen: sinon.spy(),
        send: sinon.stub().returns(Promise.resolve())
      },
      gc: {
        init: sinon.spy(),
        run: sinon.stub().returns(Promise.resolve({ids: []}))
      },
      internalCache: {
        expire: sinon.stub().returns(Promise.resolve()),
        flushdb: sinon.stub().returns(Promise.resolve()),
        get: sinon.stub().returns(Promise.resolve(null)),
        getInfos: sinon.stub().returns(Promise.resolve()),
        set: sinon.stub().returns(Promise.resolve()),
        volatileSet: sinon.stub().returns(Promise.resolve())
      },
      memoryStorage: {
        flushdb: sinon.stub().returns(Promise.resolve()),
        getInfos: sinon.stub().returns(Promise.resolve())
      },
      storageEngine: {
        get: sinon.stub().returns(Promise.resolve({
          _source: {foo}
        })),
        mget: sinon.stub(),
        getInfos: sinon.stub().returns(Promise.resolve()),
        getMapping: sinon.stub().returns(Promise.resolve(foo)),
        listIndexes: sinon.stub().returns(Promise.resolve({indexes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']})),
        collectionExists: sinon.stub().returns(Promise.resolve()),
        count: sinon.stub().returns(Promise.resolve(42)),
        create: sinon.stub().returns(Promise.resolve(foo)),
        createCollection: sinon.stub().returns(Promise.resolve(foo)),
        createIndex: sinon.stub().returns(Promise.resolve(foo)),
        createOrReplace: sinon.stub().returns(Promise.resolve(foo)),
        delete: sinon.stub().returns(Promise.resolve(foo)),
        deleteByQuery: sinon.stub().returns(Promise.resolve(Object.assign({}, foo, {ids: 'responseIds'}))),
        deleteByQueryFromTrash: sinon.stub().returns(Promise.resolve(Object.assign({}, foo, {ids: 'responseIds'}))),
        deleteIndex: sinon.stub().returns(Promise.resolve(foo)),
        deleteIndexes: sinon.stub().returns(Promise.resolve({deleted: ['a', 'e', 'i']})),
        getAutoRefresh: sinon.stub().returns(Promise.resolve(false)),
        import: sinon.stub().returns(Promise.resolve(foo)),
        indexExists: sinon.stub().returns(Promise.resolve()),
        listCollections: sinon.stub().returns(Promise.resolve()),
        refreshIndex: sinon.stub().returns(Promise.resolve(foo)),
        replace: sinon.stub().returns(Promise.resolve(foo)),
        search: sinon.stub().returns(Promise.resolve(foo)),
        scroll: sinon.stub().returns(Promise.resolve(foo)),
        setAutoRefresh: sinon.stub().returns(Promise.resolve(true)),
        truncateCollection: sinon.stub().returns(Promise.resolve(foo)),
        update: sinon.stub().returns(Promise.resolve(foo)),
        updateMapping: sinon.stub().returns(Promise.resolve(foo))
      }
    }
  };

  this.statistics = {
    completedRequest: sinon.spy(),
    newConnection: sinon.stub(),
    failedRequest: sinon.spy(),
    getAllStats: sinon.stub().returns(Promise.resolve(foo)),
    getLastStats: sinon.stub().returns(Promise.resolve(foo)),
    getStats: sinon.stub().returns(Promise.resolve(foo)),
    init: sinon.spy(),
    dropConnection: sinon.stub(),
    startRequest: sinon.spy()
  };

  this.tokenManager = {
    add: sinon.stub(),
    expire: sinon.stub().returns(Promise.resolve())
  };
}

KuzzleMock.prototype = new Kuzzle();
KuzzleMock.prototype.constructor = Kuzzle;

module.exports = KuzzleMock;


