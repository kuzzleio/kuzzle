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

    // we need a deep copy here
    this.config = _.merge({}, config);

    // emit + pipe mocks
    sinon.stub(this, 'pipe').callsFake(
      (...args) => Bluebird.resolve(args[1]));

    sinon.spy(this, 'emit');

    this.log = {
      error: sinon.stub(),
      warn: sinon.stub(),
      info: sinon.stub(),
      silly: sinon.stub(),
      debug: sinon.stub(),
      verbose: sinon.stub()
    };

    this.koncorde = {
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
      controllers: {},
      pluginsControllers: {},
      init: sinon.spy(),
      loadPluginControllers: sinon.spy(),
      getRequestSlot: sinon.stub().returns(true),
      handleErrorDump: sinon.spy(),
      execute: sinon.stub(),
      mExecute: sinon.stub(),
      processRequest: sinon.stub().resolves(),
      checkRights: sinon.stub(),
      getEventName: sinon.spy(),
      executePluginRequest: sinon.stub().resolves()
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
        get: sinon.stub().resolves(),
        del: sinon.stub().resolves(),
        exists: sinon.stub().resolves(),
        expire: sinon.stub().resolves(),
        flushdb: sinon.stub().resolves(),
        info: sinon.stub().resolves(),
        mget: sinon.stub().resolves(),
        persist: sinon.stub().resolves(),
        pexpire: sinon.stub().resolves(),
        psetex: sinon.stub().resolves(),
        searchKeys: sinon.stub().resolves(),
        set: sinon.stub().resolves(),
        setex: sinon.stub().resolves(),
        setnx: sinon.stub().resolves(),
      },
      public: {
        flushdb: sinon.stub().resolves(),
        info: sinon.stub().resolves()
      }
    };

    this.internalIndex = new IndexStorageMock(
      'kuzzle',
      this.storageEngine.internal);

    this.internalIndex._bootstrap = {
      startOrWait: sinon.stub().resolves(),
      createInitialSecurities: sinon.stub().resolves()
    };

    this.once = sinon.stub();

    this.notifier = {
      init: sinon.spy(),
      notifyUser: sinon.stub().resolves(),
      notifyServer: sinon.stub().resolves(),
      notifyDocument: sinon.stub().resolves(),
      notifyDocumentCreate: sinon.stub().resolves(),
      notifyDocumentMDelete: sinon.stub().resolves(),
      notifyDocumentReplace: sinon.stub().resolves(),
      notifyDocumentUpdate: sinon.stub().resolves(),
      publish: sinon.stub().resolves(foo),
      notifyDocumentMCreate: sinon.stub().resolves(),
      notifyDocumentMChanges: sinon.stub().resolves()
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
      pipe: sinon.stub().callsFake((...args) => Bluebird.resolve(args[1])),
      listStrategies: sinon.stub().returns([]),
      getStrategyFields: sinon.stub().resolves(),
      getStrategyMethod: sinon.stub().returns(sinon.stub()),
      hasStrategyMethod: sinon.stub().returns(false),
      strategies: {},
      registerStrategy: sinon.stub(),
      unregisterStrategy: sinon.stub()
    };

    this.repositories = {
      init: sinon.stub().resolves(),
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
        anonymous: sinon.stub().resolves({
          _id: '-1',
          name: 'Anonymous',
          profileIds: ['anonymous']
        }),
        delete: sinon.stub().usingPromise(Bluebird).resolves(),
        fromDTO: sinon.stub().resolves(),
        load: sinon.stub().resolves(foo),
        ObjectConstructor: sinon.stub().returns({}),
        hydrate: sinon.stub().resolves(),
        persist: sinon.stub().resolves({}),
        search: sinon.stub().resolves(),
        scroll: sinon.stub().resolves(),
        toDTO: sinon.stub(),
        truncate: sinon.stub().resolves()
      },
      token: {
        anonymous: sinon.stub().returns({_id: 'anonymous'}),
        verifyToken: sinon.stub().resolves(),
        generateToken: sinon.stub().resolves({}),
        expire: sinon.stub().resolves(),
        deleteByUserId: sinon.stub().resolves(),
        truncate: sinon.stub().resolves(),
        persistToCache: sinon.stub().resolves(),
        persistForUser: sinon.stub().resolves()
      }
    };

    this.rootPath = '/kuzzle';

    this.router = {
      connections: new Map(),
      execute: sinon.stub().resolves(foo),
      isConnectionAlive: sinon.stub().returns(true),
      init: sinon.spy(),
      newConnection: sinon.stub().resolves(foo),
      removeConnection: sinon.spy(),
      http: {
        route: sinon.stub()
      }
    };

    this.start = sinon.stub().resolves();

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
      expire: sinon.stub(),
      getConnectedUserToken: sinon.stub(),
      link: sinon.stub(),
      refresh: sinon.stub(),
      unlink: sinon.stub()
    };

    this.validation = {
      addType: sinon.spy(),
      curateSpecification: sinon.stub().resolves(),
      init: sinon.spy(),
      validateFormat: sinon.stub().resolves({isValid: false}),
      validate: sinon.stub().callsFake((...args) => Bluebird.resolve(args[0]))
    };

    this.vault = {
      init: sinon.stub(),
      prepareCrypto: sinon.stub(),
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

module.exports = KuzzleMock;
