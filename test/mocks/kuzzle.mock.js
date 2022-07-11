'use strict';

const sinon = require('sinon');
const Bluebird = require('bluebird');

const KuzzleEventEmitter = require('../../lib/kuzzle/event/kuzzleEventEmitter');
const kuzzleStateEnum = require('../../lib/kuzzle/kuzzleStateEnum');
const configLoader = require('../../lib/config');

const foo = { foo: 'bar' };

class KuzzleMock extends KuzzleEventEmitter {
  constructor () {
    const config = configLoader.loadConfig();

    super(
      config.plugins.common.maxConcurrentPipes,
      config.plugins.common.pipesBufferSize);

    Reflect.defineProperty(global, 'kuzzle', {
      value: this,
      writable: true,
    });

    this.id = 'knode-nasty-author-4242';
    this.state = kuzzleStateEnum.RUNNING;

    // we need a deep copy here
    this.config = JSON.parse(JSON.stringify(config));

    // ========== EVENTS ==========

    // emit + pipe mocks
    sinon.stub(this, 'pipe').callsFake(async (...args) => {
      if (typeof args[0] === 'string' && this.pluginPipes.get(args[0])) {
        let pipeArgs = [...args.slice(1)];

        try {
          for (const handler of this.pluginPipes.get(args[0])) {
            pipeArgs = [await handler(...pipeArgs)].slice(0, 1);
          }
          return pipeArgs[0];
        }
        catch (e) {
          return args[1];
        }
      }

      if (typeof args[args.length - 1] !== 'function') {
        return Bluebird.resolve(...args.slice(1));
      }

      const cb = args.pop();
      cb(null, ...args.slice(1));
    });

    sinon.stub(this, 'ask').resolves();
    sinon.stub(this, 'call');
    sinon.stub(this, 'once');
    sinon.spy(this, 'emit');
    sinon.spy(this, 'registerPluginHook');
    sinon.spy(this, 'registerPluginPipe');

    sinon.spy(this, 'onCall');
    sinon.spy(this, 'onAsk');
    sinon.spy(this, 'on');
    sinon.spy(this, 'onPipe');

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
      getFilterIds: sinon.stub().returns([]),
      getIndexes: sinon.stub().returns([]),
      hasFilterId: sinon.stub().returns(false),
      normalize: sinon.stub().returns({ id: 'foobar' }),
      register: sinon.stub().returns('foobar'),
      remove: sinon.stub(),
      store: sinon.stub().returns('foobar'),
      test: sinon.stub().returns([]),
      validate: sinon.stub(),
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
      isNativeController: sinon.stub()
    };

    this.dumpGenerator = {
      dump: sinon.stub().resolves()
    };

    this.shutdown = sinon.stub();

    const InternalIndexHandlerMock = require('./internalIndexHandler.mock');
    this.internalIndex = new InternalIndexHandlerMock();

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
        info: sinon.stub(),
        name: 'my-app',
      },
      routes: [],
      loadedPlugins: []
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
      unlink: sinon.stub(),
      getKuidFromConnection: sinon.stub(),
      removeConnection: sinon.stub().resolves(),
    };

    this.validation = {
      addType: sinon.spy(),
      curateSpecification: sinon.stub().resolves(),
      init: sinon.spy(),
      validateFormat: sinon.stub().resolves({ isValid: false }),
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
      set: sinon.stub(),
      exists: sinon.stub(),
      has: sinon.stub(),
      get: sinon.stub(),
    };

    this.start = sinon.stub().resolves();
    this.hash = sinon.stub().callsFake(obj => JSON.stringify(obj));
    this.running = sinon.stub().returns(false);
  }
}

module.exports = KuzzleMock;
