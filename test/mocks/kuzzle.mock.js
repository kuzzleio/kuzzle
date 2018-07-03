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

    this.sandbox = sinon.createSandbox();

    // we need a deep copy here
    this.config = _.merge({}, config);
    this.config.server.entryPoints.proxy = true;

    this.realtime = {
      test: this.sandbox.stub().returns([]),
      register: this.sandbox.stub().resolves(),
      remove: this.sandbox.stub().resolves(),
      normalize: this.sandbox.stub().resolves({id: 'foobar'}),
      store: this.sandbox.stub().returns({id: 'foobar'})
    };


    this.entryPoints = {
      dispatch: this.sandbox.spy(),
      entryPoints: [
        {
          dispatch: this.sandbox.spy(),
          init: this.sandbox.stub().resolves(),
          joinChannel: this.sandbox.spy(),
          leaveChannel: this.sandbox.spy(),
          send: this.sandbox.spy()
        },
        {
          dispatch: this.sandbox.spy(),
          init: this.sandbox.stub().resolves(),
          joinChannel: this.sandbox.spy(),
          leaveChannel: this.sandbox.spy(),
          send: this.sandbox.spy()
        }
      ],
      init: this.sandbox.spy(),
      joinChannel: this.sandbox.spy(),
      leaveChannel: this.sandbox.spy()
    };

    this.funnel = {
      controllers: {
        server: {
          adminExists: this.sandbox.stub(),
        },
        security: {
          createFirstAdmin: sinon.spy(),
          deleteUser: sinon.spy(),
          deleteProfile: sinon.spy(),
          deleteRole: sinon.spy()
        }
      },
      pluginsControllers: {
      },
      init: this.sandbox.spy(),
      loadPluginControllers: this.sandbox.spy(),
      getRequestSlot: this.sandbox.stub().returns(true),
      handleErrorDump: this.sandbox.spy(),
      execute: this.sandbox.spy(),
      mExecute: this.sandbox.stub(),
      processRequest: this.sandbox.stub().resolves(),
      checkRights: this.sandbox.stub(),
      getEventName: this.sandbox.spy(),
      executePluginRequest: this.sandbox.stub()
    };

    this.gc = {
      init: this.sandbox.spy(),
      run: this.sandbox.spy()
    };


    this.hooks = {
      init: this.sandbox.spy()
    };

    this.hotelClerk = {
      getRealtimeCollections: this.sandbox.stub(),
      removeCustomerFromAllRooms: this.sandbox.stub(),
      addSubscription: this.sandbox.stub().resolves(foo),
      join: this.sandbox.stub().resolves(foo),
      removeSubscription: this.sandbox.stub().resolves(foo),
      countSubscription: this.sandbox.stub().resolves(foo),
      listSubscriptions: this.sandbox.stub().resolves(foo),
    };

    this.janitor = {
      dump: sinon.stub(),
      shutdown: sinon.stub()
    };

    this.indexCache = {
      indexes: {},
      defaultMappings: {},
      add: this.sandbox.stub(),
      exists: this.sandbox.stub(),
      init: this.sandbox.stub().resolves(),
      initInternal: this.sandbox.stub().resolves(),
      remove: this.sandbox.stub(),
      reset: this.sandbox.stub()
    };

    this.internalEngine = {
      bootstrap: {
        adminExists: this.sandbox.stub().resolves(true),
        all: this.sandbox.stub().resolves(),
        createCollections: this.sandbox.stub().resolves(),
        createRolesCollection: this.sandbox.stub().resolves(),
        createDefaultRoles: this.sandbox.stub().resolves(),
        createProfilesCollection: this.sandbox.stub().resolves(),
        createDefaultProfiles: this.sandbox.stub().resolves(),
        createUsersCollection: this.sandbox.stub().resolves(),
        createPluginsCollection: this.sandbox.stub().resolves(),
        delete: this.sandbox.stub().resolves()
      },
      create: this.sandbox.stub().resolves(),
      createInternalIndex: this.sandbox.stub().resolves(),
      createOrReplace: this.sandbox.stub().resolves(),
      delete: this.sandbox.stub().resolves(),
      deleteIndex: this.sandbox.stub().resolves(),
      exists: this.sandbox.stub().resolves(),
      expire: this.sandbox.stub().resolves(),
      get: this.sandbox.stub().resolves(foo),
      getFieldMapping: this.sandbox.stub().resolves(),
      getMapping: this.sandbox.stub().resolves(),
      mget: this.sandbox.stub().resolves({hits: [foo]}),
      index: 'internalIndex',
      init: this.sandbox.stub().resolves(),
      listCollections: this.sandbox.stub(),
      listIndexes: this.sandbox.stub(),
      persist: this.sandbox.stub().resolves(),
      refresh: this.sandbox.stub().resolves(),
      replace: this.sandbox.stub().resolves(),
      scroll: this.sandbox.stub().resolves(),
      search: this.sandbox.stub().resolves(),
      update: this.sandbox.stub().resolves(),
      updateMapping: this.sandbox.stub().resolves(foo)
    };

    this.once = this.sandbox.stub();

    this.notifier = {
      init: this.sandbox.spy(),
      notifyUser: this.sandbox.spy(),
      notifyServer: this.sandbox.spy(),
      notifyDocument: this.sandbox.spy(),
      notifyDocumentCreate: this.sandbox.spy(),
      notifyDocumentMDelete: this.sandbox.spy(),
      notifyDocumentReplace: this.sandbox.spy(),
      notifyDocumentUpdate: this.sandbox.spy(),
      publish: this.sandbox.stub().resolves(foo),
      notifyDocumentMCreate: this.sandbox.spy(),
      notifyDocumentMChanges: this.sandbox.spy()
    };

    this.passport = {
      use: this.sandbox.stub(),
      unuse: this.sandbox.stub(),
      authenticate: this.sandbox.stub().resolves({}),
      injectAuthenticateOptions: this.sandbox.stub()
    };

    this.pluginsManager = {
      init: this.sandbox.stub().resolves(),
      plugins: {},
      run: this.sandbox.stub().resolves(),
      getPluginsDescription: this.sandbox.stub().returns({}),
      trigger: this.sandbox.stub().callsFake((...args) => Bluebird.resolve(args[1])),
      listStrategies: this.sandbox.stub().returns([]),
      getStrategyFields: this.sandbox.stub().resolves(),
      getStrategyMethod: this.sandbox.stub().returns(this.sandbox.stub()),
      hasStrategyMethod: this.sandbox.stub().returns(false),
      strategies: {},
      registerStrategy: this.sandbox.stub(),
      unregisterStrategy: this.sandbox.stub()
    };

    this.repositories = {
      init: this.sandbox.stub().resolves(),
      profile: {
        fromDTO: sinon.stub().resolves(),
        initialize: sinon.stub().resolves(),
        load: sinon.stub().resolves(),
        loadMultiFromDatabase: sinon.stub().resolves(),
        loadProfiles: sinon.stub().resolves(),
        searchProfiles: sinon.stub().resolves(),
        search: sinon.stub().resolves(),
        scroll: sinon.stub().resolves(),
        validateAndSaveProfile: sinon.stub(),
        delete: sinon.stub(),
        getProfileFromRequest: sinon.stub(),
        truncate: sinon.stub().resolves()
      },
      role: {
        delete: sinon.stub().resolves(),
        fromDTO: sinon.stub().resolves(),
        getRoleFromRequest: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0])),
        load: sinon.stub().resolves(),
        loadMultiFromDatabase: sinon.stub().resolves(),
        loadRoles: sinon.stub().resolves(),
        searchRole: sinon.stub().resolves(),
        search: sinon.stub().resolves(),
        scroll: sinon.stub().resolves(),
        validateAndSaveRole: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0])),
        truncate: sinon.stub().resolves()
      },
      user: {
        anonymous: this.sandbox.stub().returns({_id: '-1'}),
        delete: this.sandbox.stub().usingPromise(Bluebird).resolves(),
        fromDTO: this.sandbox.stub().resolves(),
        load: this.sandbox.stub().resolves(foo),
        ObjectConstructor: this.sandbox.stub().returns({}),
        hydrate: this.sandbox.stub().resolves(),
        persist: this.sandbox.stub().resolves({}),
        search: this.sandbox.stub().resolves(),
        scroll: this.sandbox.stub().resolves(),
        toDTO: this.sandbox.stub(),
        truncate: sinon.stub().resolves()
      },
      token: {
        anonymous: this.sandbox.stub().returns({_id: 'anonymous'}),
        verifyToken: this.sandbox.stub().resolves(),
        generateToken: this.sandbox.stub().resolves({}),
        expire: this.sandbox.stub().resolves(),
        deleteByUserId: this.sandbox.stub().resolves(),
        truncate: sinon.stub().resolves()
      }
    };

    this.rootPath = '/kuzzle';

    this.router = {
      execute: this.sandbox.stub().resolves(foo),
      isConnectionAlive: this.sandbox.stub().returns(true),
      init: this.sandbox.spy(),
      newConnection: this.sandbox.stub().resolves(foo),
      removeConnection: this.sandbox.spy(),
      http: {
        route: this.sandbox.stub()
      }
    };

    this.services = {
      init: this.sandbox.stub().resolves(),
      list: {
        broker: {
          getInfos: this.sandbox.stub().resolves(),
          listen: this.sandbox.spy(),
          send: this.sandbox.stub().resolves()
        },
        gc: {
          init: this.sandbox.spy(),
          run: this.sandbox.stub().resolves({ids: []})
        },
        internalCache: {
          get: this.sandbox.stub().resolves(null),
          del: this.sandbox.stub().resolves(),
          exists: this.sandbox.stub().resolves(),
          expire: this.sandbox.stub().resolves(),
          flushdb: this.sandbox.stub().resolves(),
          getInfos: this.sandbox.stub().resolves(),
          mget: this.sandbox.stub().resolves(),
          persist: this.sandbox.stub().resolves(),
          pexpire: this.sandbox.stub().resolves(),
          psetex: this.sandbox.stub().resolves(),
          searchKeys: this.sandbox.stub().resolves([]),
          set: this.sandbox.stub().resolves(),
          setex: this.sandbox.stub().resolves(),
          setnx: this.sandbox.stub().resolves(),
        },
        memoryStorage: {
          flushdb: this.sandbox.stub().resolves(),
          getInfos: this.sandbox.stub().resolves()
        },
        storageEngine: {
          get: this.sandbox.stub().resolves({_source: {foo}}),
          mget: this.sandbox.stub().resolves({hits: [], total: 0}),
          getInfos: this.sandbox.stub().resolves(),
          getMapping: this.sandbox.stub().resolves(foo),
          listIndexes: this.sandbox.stub().resolves({indexes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']}),
          collectionExists: this.sandbox.stub().resolves(),
          count: this.sandbox.stub().resolves(42),
          create: this.sandbox.stub().resolves(foo),
          createCollection: this.sandbox.stub().resolves(foo),
          createIndex: this.sandbox.stub().resolves(foo),
          createOrReplace: this.sandbox.stub().resolves(foo),
          delete: this.sandbox.stub().resolves(foo),
          deleteByQuery: this.sandbox.stub().resolves(Object.assign({}, foo, {ids: 'responseIds'})),
          deleteByQueryFromTrash: this.sandbox.stub().resolves(Object.assign({}, foo, {ids: 'responseIds'})),
          deleteIndex: this.sandbox.stub().resolves(foo),
          deleteIndexes: this.sandbox.stub().resolves({deleted: ['a', 'e', 'i']}),
          getAutoRefresh: this.sandbox.stub().resolves(false),
          import: this.sandbox.stub().resolves(foo),
          indexExists: this.sandbox.stub().resolves(),
          listCollections: this.sandbox.stub().resolves(),
          refreshIndex: this.sandbox.stub().resolves(foo),
          replace: this.sandbox.stub().resolves(foo),
          search: this.sandbox.stub().resolves(foo),
          scroll: this.sandbox.stub().resolves(foo),
          setAutoRefresh: this.sandbox.stub().resolves(true),
          truncateCollection: this.sandbox.stub().resolves(foo),
          update: this.sandbox.stub().resolves(foo),
          updateMapping: this.sandbox.stub().resolves(foo),
          mcreate: this.sandbox.stub().resolves({result: [], error: []}),
          mupdate: this.sandbox.stub().resolves({result: [], error: []}),
          mcreateOrReplace: this.sandbox.stub().resolves({result: [], error: []}),
          mdelete: this.sandbox.stub().resolves({result: [], error: []}),
          mreplace: this.sandbox.stub().resolves({result: [], error: []})
        }
      }
    };

    this.statistics = {
      completedRequest: this.sandbox.spy(),
      newConnection: this.sandbox.stub(),
      failedRequest: this.sandbox.spy(),
      getAllStats: this.sandbox.stub().resolves(foo),
      getLastStats: this.sandbox.stub().resolves(foo),
      getStats: this.sandbox.stub().resolves(foo),
      init: this.sandbox.spy(),
      dropConnection: this.sandbox.stub(),
      startRequest: this.sandbox.spy()
    };

    this.tokenManager = {
      link: this.sandbox.stub(),
      unlink: this.sandbox.stub(),
      expire: this.sandbox.stub()
    };

    this.validation = {
      init: this.sandbox.spy(),
      curateSpecification: this.sandbox.stub().resolves(),
      isValidSpecification: this.sandbox.stub().resolves({isValid: false}),
      validate: this.sandbox.stub().callsFake((...args) => Bluebird.resolve(args[0])),
      validationPromise: this.sandbox.stub().callsFake((...args) => Bluebird.resolve(args[0])),
      addType: this.sandbox.spy()
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
