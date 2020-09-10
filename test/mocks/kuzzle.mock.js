'use strict';

const _ = require('lodash');
const sinon = require('sinon');
const Bluebird = require('bluebird');

const IndexStorageMock = require('./indexStorage.mock');
const ClientAdapterMock = require('./clientAdapter.mock');

const Kuzzle = require('../../lib/kuzzle');
const config = require('../../lib/config');

const foo = { foo: 'bar' };

let _instance;

class KuzzleMock extends Kuzzle {
  constructor () {
    super(config);

    _instance = this;

    // we need a deep copy here
    this.config = _.merge({}, config);

    // ========== EVENTS ==========

    // emit + pipe mocks
    sinon.stub(this, 'pipe').callsFake((...args) => {
      if (typeof args[args.length - 1] !== 'function') {
        return Bluebird.resolve(...args.slice(1));
      }

      const cb = args.pop();
      cb(null, ...args.slice(1));
    });

    sinon.stub(this, 'ask').resolves();
    sinon.stub(this, 'once');
    sinon.spy(this, 'emit');
    sinon.spy(this, 'registerPluginHook');
    sinon.spy(this, 'registerPluginPipe');

    sinon.spy(this, 'onAsk');
    sinon.spy(this, 'on');
    // ============================


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
      store: sinon.stub().returns({id: 'foobar'}),
      getCollections: sinon.stub().returns([]),
      getIndexes: sinon.stub().returns([]),
      getFilterIds: sinon.stub().returns([])
    };

    this.entryPoint = {
      dispatch: sinon.spy(),
      init: sinon.stub(),
      startListening: sinon.spy(),
      joinChannel: sinon.spy(),
      leaveChannel: sinon.spy()
    };

    this.funnel = {
      controllers: new Map(),
      init: sinon.spy(),
      loadPluginControllers: sinon.spy(),
      getRequestSlot: sinon.stub().returns(true),
      handleErrorDump: sinon.spy(),
      execute: sinon.stub(),
      mExecute: sinon.stub(),
      processRequest: sinon.stub().resolves(),
      checkRights: sinon.stub(),
      getEventName: sinon.spy(),
      executePluginRequest: sinon.stub().resolves(),
      isNativeController : sinon.stub()
    };

    this.dumpGenerator = {
      dump: sinon.stub().resolves()
    };

    this.shutdown = sinon.stub();

    this.storageEngine = {
      init: sinon.stub().resolves(),
      indexCache: {
        add: sinon.stub().resolves(),
        remove: sinon.stub().resolves(),
        exists: sinon.stub().resolves(),
        listIndexes: sinon.stub().resolves(),
        listCollections: sinon.stub().resolves()
      },
      public: new ClientAdapterMock(),
      internal: new ClientAdapterMock(),
      config: this.config.services.storageEngine
    };

    this.internalIndex = new IndexStorageMock(
      'kuzzle',
      this.storageEngine.internal);

    this.internalIndex._bootstrap = {
      startOrWait: sinon.stub().resolves(),
      createInitialSecurities: sinon.stub().resolves()
    };

    this.passport = {
      use: sinon.stub(),
      unuse: sinon.stub(),
      authenticate: sinon.stub().resolves({}),
      injectAuthenticateOptions: sinon.stub()
    };

    this.pluginsManager = {
      controllers: new Map(),
      init: sinon.stub().resolves(),
      plugins: [],
      run: sinon.stub().resolves(),
      getPluginsDescription: sinon.stub().returns({}),
      listStrategies: sinon.stub().returns([]),
      getActions: sinon.stub(),
      getControllerNames: sinon.stub(),
      isController: sinon.stub(),
      isAction: sinon.stub(),
      exists: sinon.stub(),
      getStrategyFields: sinon.stub().resolves(),
      getStrategyMethod: sinon.stub().returns(sinon.stub()),
      hasStrategyMethod: sinon.stub().returns(false),
      strategies: {},
      registerStrategy: sinon.stub(),
      unregisterStrategy: sinon.stub(),
      application: {
        info: sinon.stub()
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
      init: sinon.stub().resolves(),
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

    this.dump = sinon.stub().resolves();

    this.asyncStore = {
      run: sinon.stub().yields(),
      set: sinon.stub()
    };

    {
      const mockProto = Object.getPrototypeOf(this);
      const kuzzleProto = Object.getPrototypeOf(mockProto);

      for (const name of Object.getOwnPropertyNames(kuzzleProto)) {
        if (['constructor', 'hash'].includes(name)) {
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

  static instance () {
    return _instance;
  }
}

module.exports = KuzzleMock;
