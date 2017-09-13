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
      init: sinon.stub().returns(Bluebird.resolve()),
      actions: {
        adminExists: sinon.stub().returns(Bluebird.resolve()),
        createFirstAdmin: sinon.stub().returns(Bluebird.resolve()),
        cleanAndPrepare: sinon.stub().returns(Bluebird.resolve()),
        cleanDb: sinon.stub().returns(Bluebird.resolve()),
        managePlugins: sinon.stub().returns(Bluebird.resolve()),
        data: sinon.stub().returns(Bluebird.resolve()),
        dump: sinon.stub().returns(Bluebird.resolve())
      }
    };

    this.realtime = {
      test: sinon.stub().returns([]),
      register: sinon.stub().returns(Bluebird.resolve()),
      remove: sinon.stub().returns(Bluebird.resolve()),
      normalize: sinon.stub().returns(Bluebird.resolve({id: 'foobar'})),
      store: sinon.stub().returns({id: 'foobar'})
    };


    this.entryPoints = {
      dispatch: sinon.spy(),
      entryPoints: [
        {
          dispatch: sinon.spy(),
          init: sinon.stub().returns(Bluebird.resolve()),
          joinChannel: sinon.spy(),
          leaveChannel: sinon.spy(),
          send: sinon.spy()
        },
        {
          dispatch: sinon.spy(),
          init: sinon.stub().returns(Bluebird.resolve()),
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
      processRequest: sinon.stub().returns(Bluebird.resolve()),
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
      addSubscription: sinon.stub().returns(Bluebird.resolve(foo)),
      join: sinon.stub().returns(Bluebird.resolve(foo)),
      removeSubscription: sinon.stub().returns(Bluebird.resolve(foo)),
      countSubscription: sinon.stub().returns(Bluebird.resolve(foo)),
      listSubscriptions: sinon.stub().returns(Bluebird.resolve(foo)),
    };

    this.indexCache = {
      add: sinon.stub(),
      exists: sinon.stub(),
      init: sinon.stub().returns(Bluebird.resolve()),
      initInternal: sinon.stub().returns(Bluebird.resolve()),
      remove: sinon.stub(),
      reset: sinon.stub()
    };

    this.internalEngine = {
      bootstrap: {
        adminExists: sinon.stub().returns(Bluebird.resolve(true)),
        all: sinon.stub().returns(Bluebird.resolve()),
        createCollections: sinon.stub().returns(Bluebird.resolve()),
        createRolesCollection: sinon.stub().returns(Bluebird.resolve()),
        createProfilesCollection: sinon.stub().returns(Bluebird.resolve()),
        createUsersCollection: sinon.stub().returns(Bluebird.resolve()),
        createPluginsCollection: sinon.stub().returns(Bluebird.resolve()),
        delete: sinon.stub().returns(Bluebird.resolve())
      },
      create: sinon.stub().returns(Bluebird.resolve()),
      createInternalIndex: sinon.stub().returns(Bluebird.resolve()),
      createOrReplace: sinon.stub().returns(Bluebird.resolve()),
      delete: sinon.stub().returns(Bluebird.resolve()),
      deleteIndex: sinon.stub().returns(Bluebird.resolve()),
      expire: sinon.stub().returns(Bluebird.resolve()),
      get: sinon.stub().returns(Bluebird.resolve(foo)),
      mget: sinon.stub().returns(Bluebird.resolve({hits: [foo]})),
      index: 'internalIndex',
      init: sinon.stub().returns(Bluebird.resolve()),
      listCollections: sinon.stub(),
      listIndexes: sinon.stub(),
      persist: sinon.stub().returns(Bluebird.resolve()),
      refresh: sinon.stub().returns(Bluebird.resolve()),
      replace: sinon.stub().returns(Bluebird.resolve()),
      search: sinon.stub().returns(Bluebird.resolve()),
      update: sinon.stub().returns(Bluebird.resolve()),
      updateMapping: sinon.stub().returns(Bluebird.resolve(foo)),
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
      publish: sinon.stub().returns(Bluebird.resolve(foo))
    };

    this.passport = {
      use: sinon.stub(),
      unuse: sinon.stub(),
      authenticate: sinon.stub().returns(Bluebird.resolve({})),
      injectAuthenticateOptions: sinon.stub()
    };

    this.pluginsManager = {
      init: sinon.stub().returns(Bluebird.resolve()),
      plugins: {},
      run: sinon.stub().returns(Bluebird.resolve()),
      getPluginsDescription: sinon.stub().returns({}),
      trigger: sinon.spy((...args) => Bluebird.resolve(args[1])),
      listStrategies: sinon.stub().returns([]),
      getStrategyMethod: sinon.stub().returns(sinon.stub()),
      strategies: {},
      registerStrategy: sinon.stub(),
      unregisterStrategy: sinon.stub()
    };

    this.repositories = {
      init: sinon.stub().returns(Bluebird.resolve()),
      profile: {
        load: sinon.stub().returns(Bluebird.resolve()),
        loadProfiles: sinon.stub().returns(Bluebird.resolve()),
        searchProfiles: sinon.stub().returns(Bluebird.resolve())
      },
      role: {
        getRoleFromRequest: sinon.spy(function () {return Bluebird.resolve(arguments[0]);}),
        loadRole: sinon.stub().returns(Bluebird.resolve()),
        loadRoles: sinon.stub().returns(Bluebird.resolve()),
        validateAndSaveRole: sinon.spy(function () {return Bluebird.resolve(arguments[0]);})
      },
      user: {
        load: sinon.stub().returns(Bluebird.resolve(foo)),
        search: sinon.stub().returns(Bluebird.resolve()),
        scroll: sinon.stub().returns(Bluebird.resolve()),
        ObjectConstructor: sinon.stub().returns({}),
        hydrate: sinon.stub().returns(Bluebird.resolve()),
        persist: sinon.stub().returns(Bluebird.resolve({})),
        anonymous: sinon.stub().returns({_id: '-1'}),
        delete: sinon.stub().returns(Bluebird.resolve())
      },
      token: {
        anonymous: sinon.stub().returns({_id: 'anonymous'}),
        verifyToken: sinon.stub().returns(Bluebird.resolve()),
        generateToken: sinon.stub().returns(Bluebird.resolve({})),
        expire: sinon.stub().returns(Bluebird.resolve()),
        deleteByUserId: sinon.stub().returns(Bluebird.resolve())
      }
    };

    this.rootPath = '/kuzzle';

    this.router = {
      execute: sinon.stub().returns(Bluebird.resolve(foo)),
      isConnectionAlive: sinon.stub().returns(true),
      init: sinon.spy(),
      newConnection: sinon.stub().returns(Bluebird.resolve(foo)),
      removeConnection: sinon.spy(),
      http: {
        route: sinon.stub()
      }
    };

    this.services = {
      init: sinon.stub().returns(Bluebird.resolve()),
      list: {
        broker: {
          getInfos: sinon.stub().returns(Bluebird.resolve()),
          listen: sinon.spy(),
          send: sinon.stub().returns(Bluebird.resolve())
        },
        gc: {
          init: sinon.spy(),
          run: sinon.stub().returns(Bluebird.resolve({ids: []}))
        },
        internalCache: {
          add: sinon.stub().returns(Bluebird.resolve()),
          del: sinon.stub().returns(Bluebird.resolve()),
          exists: sinon.stub().returns(Bluebird.resolve()),
          expire: sinon.stub().returns(Bluebird.resolve()),
          flushdb: sinon.stub().returns(Bluebird.resolve()),
          get: sinon.stub().returns(Bluebird.resolve(null)),
          getInfos: sinon.stub().returns(Bluebird.resolve()),
          persist: sinon.stub().returns(Bluebird.resolve()),
          pexpire: sinon.stub().returns(Bluebird.resolve()),
          psetex: sinon.stub().returns(Bluebird.resolve()),
          remove: sinon.stub().returns(Bluebird.resolve()),
          search: sinon.stub().returns(Bluebird.resolve()),
          searchKeys: sinon.stub().returns(Bluebird.resolve([])),
          set: sinon.stub().returns(Bluebird.resolve()),
          setnx: sinon.stub().returns(Bluebird.resolve()),
          volatileSet: sinon.stub().returns(Bluebird.resolve())
        },
        memoryStorage: {
          flushdb: sinon.stub().returns(Bluebird.resolve()),
          getInfos: sinon.stub().returns(Bluebird.resolve())
        },
        storageEngine: {
          get: sinon.stub().returns(Bluebird.resolve({
            _source: {foo}
          })),
          mget: sinon.stub(),
          getInfos: sinon.stub().returns(Bluebird.resolve()),
          getMapping: sinon.stub().returns(Bluebird.resolve(foo)),
          listIndexes: sinon.stub().returns(Bluebird.resolve({indexes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']})),
          collectionExists: sinon.stub().returns(Bluebird.resolve()),
          count: sinon.stub().returns(Bluebird.resolve(42)),
          create: sinon.stub().returns(Bluebird.resolve(foo)),
          createCollection: sinon.stub().returns(Bluebird.resolve(foo)),
          createIndex: sinon.stub().returns(Bluebird.resolve(foo)),
          createOrReplace: sinon.stub().returns(Bluebird.resolve(foo)),
          delete: sinon.stub().returns(Bluebird.resolve(foo)),
          deleteByQuery: sinon.stub().returns(Bluebird.resolve(Object.assign({}, foo, {ids: 'responseIds'}))),
          deleteByQueryFromTrash: sinon.stub().returns(Bluebird.resolve(Object.assign({}, foo, {ids: 'responseIds'}))),
          deleteIndex: sinon.stub().returns(Bluebird.resolve(foo)),
          deleteIndexes: sinon.stub().returns(Bluebird.resolve({deleted: ['a', 'e', 'i']})),
          getAutoRefresh: sinon.stub().returns(Bluebird.resolve(false)),
          import: sinon.stub().returns(Bluebird.resolve(foo)),
          indexExists: sinon.stub().returns(Bluebird.resolve()),
          listCollections: sinon.stub().returns(Bluebird.resolve()),
          refreshIndex: sinon.stub().returns(Bluebird.resolve(foo)),
          replace: sinon.stub().returns(Bluebird.resolve(foo)),
          search: sinon.stub().returns(Bluebird.resolve(foo)),
          scroll: sinon.stub().returns(Bluebird.resolve(foo)),
          setAutoRefresh: sinon.stub().returns(Bluebird.resolve(true)),
          truncateCollection: sinon.stub().returns(Bluebird.resolve(foo)),
          update: sinon.stub().returns(Bluebird.resolve(foo)),
          updateMapping: sinon.stub().returns(Bluebird.resolve(foo))
        }
      }
    };

    this.statistics = {
      completedRequest: sinon.spy(),
      newConnection: sinon.stub(),
      failedRequest: sinon.spy(),
      getAllStats: sinon.stub().returns(Bluebird.resolve(foo)),
      getLastStats: sinon.stub().returns(Bluebird.resolve(foo)),
      getStats: sinon.stub().returns(Bluebird.resolve(foo)),
      init: sinon.spy(),
      dropConnection: sinon.stub(),
      startRequest: sinon.spy()
    };

    this.tokenManager = {
      add: sinon.stub(),
      expire: sinon.stub().returns(Bluebird.resolve())
    };

    this.validation = {
      init: sinon.spy(),
      curateSpecification: sinon.spy(function () {return Bluebird.resolve();}),
      validate: sinon.spy(function () {return Bluebird.resolve(arguments[0]);}),
      validationPromise: sinon.spy(function () {return Bluebird.resolve(arguments[0]);}),
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


