'use strict';

const
  _ = require('lodash'),
  sinon = require('sinon'),
  Kuzzle = require('../../lib/api/kuzzle'),
  Bluebird = require('bluebird'),
  config = require('../../lib/config'),
  IndexStorageMock = require('./indexStorage.mock'),
  ClientAdapterMock = require('./clientAdapter.mock'),
  foo = { foo: 'bar' };

let _instance;

class KuzzleMock extends Kuzzle {
  constructor () {
    super();

    _instance = this;

    this.sandbox = sinon.createSandbox();

    // we need a deep copy here
    this.config = _.merge({}, config);

    // emit + pipe mocks
    this.sandbox.stub(this, 'pipe').callsFake(
      (...args) => Bluebird.resolve(args[1]));

    this.sandbox.spy(this, 'emit');

    this.log = {
      error: this.sandbox.stub(),
      warn: this.sandbox.stub(),
      info: this.sandbox.stub(),
      silly: this.sandbox.stub(),
      debug: this.sandbox.stub(),
      verbose: this.sandbox.stub()
    };

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
      controllers: {},
      pluginsControllers: {},
      init: this.sandbox.spy(),
      loadPluginControllers: this.sandbox.spy(),
      getRequestSlot: this.sandbox.stub().returns(true),
      handleErrorDump: this.sandbox.spy(),
      execute: this.sandbox.stub(),
      mExecute: this.sandbox.stub(),
      processRequest: this.sandbox.stub().resolves(),
      checkRights: this.sandbox.stub(),
      getEventName: this.sandbox.spy(),
      executePluginRequest: this.sandbox.stub().resolves()
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
      dump: sinon.stub().resolves(),
      shutdown: sinon.stub(),
      loadMappings: sinon.stub().resolves(),
      loadFixtures: sinon.stub().resolves(),
      loadSecurities: sinon.stub().resolves()
    };

    this.storageEngine = {
      init: sinon.stub().resolves(),
      indexCache: {
        add: sinon.stub().resolves(),
        remove: sinon.stub().resolves(),
        exists: sinon.stub().resolves(),
      },
      public: new ClientAdapterMock(),
      internal: new ClientAdapterMock(),
      config: this.config.services.storageEngine
    };

    this.cacheEngine = {
      init: sinon.stub().resolves(),
      internal: {
        get: this.sandbox.stub().resolves(),
        del: this.sandbox.stub().resolves(),
        exists: this.sandbox.stub().resolves(),
        expire: this.sandbox.stub().resolves(),
        flushdb: this.sandbox.stub().resolves(),
        info: this.sandbox.stub().resolves(),
        mget: this.sandbox.stub().resolves(),
        persist: this.sandbox.stub().resolves(),
        pexpire: this.sandbox.stub().resolves(),
        psetex: this.sandbox.stub().resolves(),
        searchKeys: this.sandbox.stub().resolves(),
        set: this.sandbox.stub().resolves(),
        setex: this.sandbox.stub().resolves(),
        setnx: this.sandbox.stub().resolves(),
      },
      public: {
        flushdb: this.sandbox.stub().resolves(),
        info: this.sandbox.stub().resolves()
      }
    };

    this.internalIndex = new IndexStorageMock(
      'kuzzle',
      this.storageEngine.internal);

    this.internalIndex._bootstrap = {
      startOrWait: this.sandbox.stub().resolves(),
      createInitialSecurities: this.sandbox.stub().resolves()
    };

    this.once = this.sandbox.stub();

    this.notifier = {
      init: this.sandbox.spy(),
      notifyUser: this.sandbox.stub().resolves(),
      notifyServer: this.sandbox.stub().resolves(),
      notifyDocument: this.sandbox.stub().resolves(),
      notifyDocumentCreate: this.sandbox.stub().resolves(),
      notifyDocumentMDelete: this.sandbox.stub().resolves(),
      notifyDocumentReplace: this.sandbox.stub().resolves(),
      notifyDocumentUpdate: this.sandbox.stub().resolves(),
      publish: this.sandbox.stub().resolves(foo),
      notifyDocumentMCreate: this.sandbox.stub().resolves(),
      notifyDocumentMChanges: this.sandbox.stub().resolves()
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
      pipe: this.sandbox.stub().callsFake((...args) => Bluebird.resolve(args[1])),
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
        anonymous: this.sandbox.stub().resolves({
          _id: '-1',
          name: 'Anonymous',
          profileIds: ['anonymous']
        }),
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
        truncate: sinon.stub().resolves(),
        persistToCache: sinon.stub().resolves()
      }
    };

    this.rootPath = '/kuzzle';

    this.router = {
      connections: new Map(),
      execute: this.sandbox.stub().resolves(foo),
      isConnectionAlive: this.sandbox.stub().returns(true),
      init: this.sandbox.spy(),
      newConnection: this.sandbox.stub().resolves(foo),
      removeConnection: this.sandbox.spy(),
      http: {
        route: this.sandbox.stub()
      }
    };

    this.start = sinon.stub().resolves();

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
      expire: this.sandbox.stub(),
      getConnectedUserToken: this.sandbox.stub(),
      link: this.sandbox.stub(),
      refresh: this.sandbox.stub(),
      unlink: this.sandbox.stub()
    };

    this.validation = {
      addType: this.sandbox.spy(),
      curateSpecification: this.sandbox.stub().resolves(),
      init: this.sandbox.spy(),
      validateFormat: this.sandbox.stub().resolves({isValid: false}),
      validate: this.sandbox.stub().callsFake((...args) => Bluebird.resolve(args[0]))
    };

    this.vault = {
      init: this.sandbox.stub(),
      prepareCrypto: this.sandbox.stub(),
      secrets: {
        aws: {
          secretKeyId: 'the cake is a lie'
        },
        kuzzleApi: 'the spoon does not exist'
      }
    };

    this.adminExists = sinon.stub().resolves();

    {
      const
        mockProto = Object.getPrototypeOf(this),
        kuzzleProto = Object.getPrototypeOf(mockProto);

      for (let name of Object.getOwnPropertyNames(kuzzleProto)) {
        if (['constructor', 'adminExists'].includes(name)) {
          continue;
        }

        if (!Object.prototype.hasOwnProperty.call(this, name)) {
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

  static instance () {
    return _instance;
  }
}


function getESMock (kuzzleMock, scope) {
  return {
    scope,
    indexPrefix: scope === 'public'
      ? '&'
      : '%',
    info: kuzzleMock.sandbox.stub().resolves(),
    scroll: kuzzleMock.sandbox.stub().resolves(),
    search: kuzzleMock.sandbox.stub().resolves(),
    get: kuzzleMock.sandbox.stub().resolves(),
    mGet: kuzzleMock.sandbox.stub().resolves(),
    count: kuzzleMock.sandbox.stub().resolves(),
    create: kuzzleMock.sandbox.stub().resolves(),
    createOrReplace: kuzzleMock.sandbox.stub().resolves(),
    update: kuzzleMock.sandbox.stub().resolves(),
    replace: kuzzleMock.sandbox.stub().resolves(),
    delete: kuzzleMock.sandbox.stub().resolves(),
    deleteByQuery: kuzzleMock.sandbox.stub().resolves(),
    createIndex: kuzzleMock.sandbox.stub().resolves(),
    createCollection: kuzzleMock.sandbox.stub().resolves(),
    getMapping: kuzzleMock.sandbox.stub().resolves(),
    truncateCollection: kuzzleMock.sandbox.stub().resolves(),
    import: kuzzleMock.sandbox.stub().resolves(),
    listCollections: kuzzleMock.sandbox.stub().resolves(),
    listIndexes: kuzzleMock.sandbox.stub().resolves(),
    listAliases: kuzzleMock.sandbox.stub().resolves(),
    deleteIndexes: kuzzleMock.sandbox.stub().resolves(),
    deleteIndex: kuzzleMock.sandbox.stub().resolves(),
    refreshCollection: kuzzleMock.sandbox.stub().resolves(),
    exists: kuzzleMock.sandbox.stub().resolves(),
    indexExists: kuzzleMock.sandbox.stub().resolves(),
    collectionExists: kuzzleMock.sandbox.stub().resolves(),
    mCreate: kuzzleMock.sandbox.stub().resolves(),
    mCreateOrReplace: kuzzleMock.sandbox.stub().resolves(),
    mUpdate: kuzzleMock.sandbox.stub().resolves(),
    mReplace: kuzzleMock.sandbox.stub().resolves(),
    mDelete: kuzzleMock.sandbox.stub().resolves()
  };
}
module.exports = KuzzleMock;
