'use strict';

const
  _ = require('lodash'),
  sinon = require('sinon'),
  Kuzzle = require('../../lib/api/kuzzle'),
  Bluebird = require('bluebird'),
  config = require('../../lib/config'),
  foo = {foo: 'bar'};

class KuzzleMock extends Kuzzle {
  constructor () {
    super();

    // we need a deep copy here
    this.config = _.merge({}, config);
    this.config.server.entryPoints.proxy = true;

    this.cliController = {
      init: sinon.stub().resolves(),
      actions: {
        adminExists: sinon.stub().resolves(),
        createFirstAdmin: sinon.stub().resolves(),
        cleanAndPrepare: sinon.stub().resolves(),
        cleanDb: sinon.stub().resolves(),
        managePlugins: sinon.stub().resolves(),
        data: sinon.stub().resolves(),
        dump: sinon.stub().usingPromise(Bluebird).resolves()
      }
    };

    this.realtime = {
      test: sinon.stub().returns([]),
      register: sinon.stub().resolves(),
      remove: sinon.stub().resolves(),
      normalize: sinon.stub().resolves({id: 'foobar'}),
      store: sinon.stub().returns({id: 'foobar'})
    };


    this.entryPoints = {
      dispatch: sinon.spy(),
      entryPoints: [
        {
          dispatch: sinon.spy(),
          init: sinon.stub().resolves(),
          joinChannel: sinon.spy(),
          leaveChannel: sinon.spy(),
          send: sinon.spy()
        },
        {
          dispatch: sinon.spy(),
          init: sinon.stub().resolves(),
          joinChannel: sinon.spy(),
          leaveChannel: sinon.spy(),
          send: sinon.spy()
        }
      ],
      init: sinon.spy(),
      joinChannel: sinon.spy(),
      leaveChannel: sinon.spy()
    };

    this.funnel = {
      controllers: {
        server: {
          adminExists: sinon.stub(),
        },
        security: {
          createFirstAdmin: sinon.spy(),
          deleteUser: sinon.spy()
        }
      },
      pluginsControllers: {
      },
      init: sinon.spy(),
      loadPluginControllers: sinon.spy(),
      getRequestSlot: sinon.stub().returns(true),
      handleErrorDump: sinon.spy(),
      execute: sinon.spy(),
      mExecute: sinon.stub(),
      processRequest: sinon.stub().resolves(),
      checkRights: sinon.stub(),
      getEventName: sinon.spy(),
      executePluginRequest: sinon.stub()
    };

    this.gc = {
      init: sinon.spy(),
      run: sinon.spy()
    };


    this.hooks = {
      init: sinon.spy()
    };

    this.hotelClerk = {
      getRealtimeCollections: sinon.stub(),
      removeCustomerFromAllRooms: sinon.stub(),
      addSubscription: sinon.stub().resolves(foo),
      join: sinon.stub().resolves(foo),
      removeSubscription: sinon.stub().resolves(foo),
      countSubscription: sinon.stub().resolves(foo),
      listSubscriptions: sinon.stub().resolves(foo),
    };

    this.indexCache = {
      indexes: {},
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
        createPluginsCollection: sinon.stub().resolves(),
        delete: sinon.stub().resolves()
      },
      create: sinon.stub().resolves(),
      createInternalIndex: sinon.stub().resolves(),
      createOrReplace: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
      deleteIndex: sinon.stub().resolves(),
      exists: sinon.stub().resolves(),
      expire: sinon.stub().resolves(),
      get: sinon.stub().resolves(foo),
      mget: sinon.stub().resolves({hits: [foo]}),
      index: 'internalIndex',
      init: sinon.stub().resolves(),
      listCollections: sinon.stub(),
      listIndexes: sinon.stub(),
      persist: sinon.stub().resolves(),
      refresh: sinon.stub().resolves(),
      replace: sinon.stub().resolves(),
      search: sinon.stub().resolves(),
      update: sinon.stub().resolves(),
      updateMapping: sinon.stub().resolves(foo),
      getMapping: sinon.stub()
    };

    this.once = sinon.stub();

    this.notifier = {
      init: sinon.spy(),
      notifyUser: sinon.spy(),
      notifyServer: sinon.spy(),
      notifyDocument: sinon.spy(),
      notifyDocumentCreate: sinon.spy(),
      notifyDocumentDelete: sinon.spy(),
      notifyDocumentReplace: sinon.spy(),
      notifyDocumentUpdate: sinon.spy(),
      publish: sinon.stub().resolves(foo)
    };

    this.passport = {
      use: sinon.stub(),
      unuse: sinon.stub(),
      authenticate: sinon.stub().resolves({}),
      injectAuthenticateOptions: sinon.stub()
    };

    this.pluginsManager = {
      init: sinon.stub().resolves(),
      plugins: {},
      run: sinon.stub().resolves(),
      getPluginsDescription: sinon.stub().returns({}),
      trigger: sinon.stub().callsFake((...args) => Bluebird.resolve(args[1])),
      listStrategies: sinon.stub().returns([]),
      getStrategyMethod: sinon.stub().returns(sinon.stub()),
      strategies: {},
      registerStrategy: sinon.stub(),
      unregisterStrategy: sinon.stub()
    };

    this.repositories = {
      init: sinon.stub().resolves(),
      profile: {
        load: sinon.stub().resolves(),
        loadProfiles: sinon.stub().resolves(),
        searchProfiles: sinon.stub().resolves()
      },
      role: {
        getRoleFromRequest: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0])),
        loadRole: sinon.stub().resolves(),
        loadRoles: sinon.stub().resolves(),
        validateAndSaveRole: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0]))
      },
      user: {
        load: sinon.stub().resolves(foo),
        search: sinon.stub().resolves(),
        scroll: sinon.stub().resolves(),
        ObjectConstructor: sinon.stub().returns({}),
        hydrate: sinon.stub().resolves(),
        persist: sinon.stub().resolves({}),
        anonymous: sinon.stub().returns({_id: '-1'}),
        delete: sinon.stub().usingPromise(Bluebird).resolves()
      },
      token: {
        anonymous: sinon.stub().returns({_id: 'anonymous'}),
        verifyToken: sinon.stub().resolves(),
        generateToken: sinon.stub().resolves({}),
        expire: sinon.stub().resolves(),
        deleteByUserId: sinon.stub().resolves()
      }
    };

    this.rootPath = '/kuzzle';

    this.router = {
      execute: sinon.stub().resolves(foo),
      isConnectionAlive: sinon.stub().returns(true),
      init: sinon.spy(),
      newConnection: sinon.stub().resolves(foo),
      removeConnection: sinon.spy(),
      http: {
        route: sinon.stub()
      }
    };

    this.services = {
      init: sinon.stub().resolves(),
      list: {
        broker: {
          getInfos: sinon.stub().resolves(),
          listen: sinon.spy(),
          send: sinon.stub().resolves()
        },
        gc: {
          init: sinon.spy(),
          run: sinon.stub().resolves({ids: []})
        },
        internalCache: {
          add: sinon.stub().resolves(),
          del: sinon.stub().resolves(),
          exists: sinon.stub().resolves(),
          expire: sinon.stub().resolves(),
          flushdb: sinon.stub().resolves(),
          get: sinon.stub().resolves(null),
          getInfos: sinon.stub().resolves(),
          persist: sinon.stub().resolves(),
          pexpire: sinon.stub().resolves(),
          psetex: sinon.stub().resolves(),
          remove: sinon.stub().resolves(),
          search: sinon.stub().resolves(),
          searchKeys: sinon.stub().resolves([]),
          set: sinon.stub().resolves(),
          setnx: sinon.stub().resolves(),
          volatileSet: sinon.stub().resolves()
        },
        memoryStorage: {
          flushdb: sinon.stub().resolves(),
          getInfos: sinon.stub().resolves()
        },
        storageEngine: {
          get: sinon.stub().resolves({_source: {foo}}),
          mget: sinon.stub(),
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
          deleteByQueryFromTrash: sinon.stub().resolves(Object.assign({}, foo, {ids: 'responseIds'})),
          deleteIndex: sinon.stub().resolves(foo),
          deleteIndexes: sinon.stub().resolves({deleted: ['a', 'e', 'i']}),
          getAutoRefresh: sinon.stub().resolves(false),
          import: sinon.stub().resolves(foo),
          indexExists: sinon.stub().resolves(),
          listCollections: sinon.stub().resolves(),
          refreshIndex: sinon.stub().resolves(foo),
          replace: sinon.stub().resolves(foo),
          search: sinon.stub().resolves(foo),
          scroll: sinon.stub().resolves(foo),
          setAutoRefresh: sinon.stub().resolves(true),
          truncateCollection: sinon.stub().resolves(foo),
          update: sinon.stub().resolves(foo),
          updateMapping: sinon.stub().resolves(foo)
        }
      }
    };

    this.statistics = {
      completedRequest: sinon.spy(),
      newConnection: sinon.stub(),
      failedRequest: sinon.spy(),
      getAllStats: sinon.stub().resolves(foo),
      getLastStats: sinon.stub().resolves(foo),
      getStats: sinon.stub().resolves(foo),
      init: sinon.spy(),
      dropConnection: sinon.stub(),
      startRequest: sinon.spy()
    };

    this.tokenManager = {
      add: sinon.stub(),
      expire: sinon.stub().resolves()
    };

    this.validation = {
      init: sinon.spy(),
      curateSpecification: sinon.stub().resolves(),
      validate: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0])),
      validationPromise: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0])),
      addType: sinon.spy()
    };

    {
      const
        mockProto = Object.getPrototypeOf(this),
        kuzzleProto = Object.getPrototypeOf(mockProto);

      for (let name of Object.getOwnPropertyNames(kuzzleProto)) {
        if (name === 'constructor') {
          continue;
        }
        if (!this.hasOwnProperty(name)) {
          this[name] = function() {
            throw new Error(`Kuzzle original property ${name} is not mocked`);
          };
        }
      }
    }

  }

  static hash (input) {
    return Kuzzle.hash(input);
  }
}

module.exports = KuzzleMock;


