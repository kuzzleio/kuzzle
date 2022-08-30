"use strict";

const sinon = require("sinon");
const should = require("should");
const mockrequire = require("mock-require");
const Bluebird = require("bluebird");
const stringify = require("json-stable-stringify");

const KuzzleMock = require("../mocks/kuzzle.mock");
const MutexMock = require("../mocks/mutex.mock.js");
const Plugin = require("../../lib/core/plugin/plugin");
const kuzzleStateEnum = require("../../lib/kuzzle/kuzzleStateEnum");
const { sha256 } = require("../../lib/util/crypto");
const VirtualIndexMock = require("../mocks/virtualIndex.mock");
const StorageEngineMock = require("../mocks/storageEngine.mock");
let { Kuzzle } = require("../../lib/kuzzle/kuzzle");

const config = require("../../lib/config").loadConfig();

class ProcessMock {
  on() {}
  exit() {}
  //removeAllListeners() {}
  async emit() {}
  constructor() {
    sinon.spy(this, "on");
    sinon.spy(this, "exit");
    this.removeAllListeners = sinon.spy();
    //sinon.spy(this, "removeAllListeners");
    sinon.stub(this, "emit").resolves();
  }
}

describe("/lib/kuzzle/kuzzle.js", () => {
  let kuzzle;
  let application;
  let clusterModuleInitStub;
  let processMock;
  const mockedProperties = [
    "adminController",
    "ask",
    "dumpGenerator",
    "emit",
    "entryPoint",
    "funnel",
    "gc",
    "internalIndex",
    "log",
    "notifier",
    "pipe",
    "pluginsManager",
    "router",
    "services",
    "statistics",
    "tokenManager",
    "validation",
    "vault",
  ];

  function _mockKuzzle(customKuzzle = Kuzzle) {
    Reflect.deleteProperty(global, "kuzzle");
    const k = new customKuzzle(config);
    const mock = new KuzzleMock();

    mockedProperties.forEach((p) => {
      try {
        k[p] = mock[p];
      } catch (e) {
        //probably a getter and not a real property
      }
    });

    return k;
  }

  const FakeKoncorde = new sinon.stub();

  beforeEach(() => {
    clusterModuleInitStub = sinon.stub().resolves();
    const clusterModuleStub = function () {
      return { init: clusterModuleInitStub };
    };

    const coreModuleStub = function () {
      return { init: sinon.stub().resolves() };
    };

    mockrequire("../../lib/core/cache/cacheEngine", coreModuleStub);
    mockrequire("../../lib/core/security", coreModuleStub);
    mockrequire("../../lib/core/realtime", coreModuleStub);
    mockrequire("../../lib/cluster", clusterModuleStub);
    //mockrequire("../../lib/util/mutex", { Mutex: MutexMock });
    Kuzzle.createVirtualIndex = function () {
      return new VirtualIndexMock();
    };

    Kuzzle.createStorageEngine = function () {
      return new StorageEngineMock();
    };

    Kuzzle.initCluster = function () {
      return { init: sinon.stub().resolves() };
    };

    Kuzzle.initCacheEngine = function () {
      return { init: sinon.stub().resolves() };
    };

    Kuzzle.initSecurityModule = function () {
      return { init: sinon.stub().resolves() };
    };

    Kuzzle.loadVault = function () {
      return { default: { load: () => {} } };
    };

    Kuzzle.createKoncorde = function (options) {
      return new FakeKoncorde(options);
    };

    Kuzzle.createMutex = function () {
      return new MutexMock();
    };

    processMock = new ProcessMock();

    Kuzzle.getProcess = function () {
      return processMock;
    };

    kuzzle = _mockKuzzle();
    application = new Plugin(
      { init: sinon.stub() },
      { name: "application", application: true, openApi: "openApi" }
    );
  });

  afterEach(() => {
    mockrequire.stopAll();
    Kuzzle.console = "console";
  });

  it("should build a kuzzle server object with emit and listen event", (done) => {
    kuzzle.on("event", done);
    kuzzle.emit("event");
  });

  describe("#start", () => {
    it("should init the components in proper order", async () => {
      /*
      const stubbedKuzzle = Kuzzle.__with__({
        koncorde_1: { Koncorde },
        vault_1: { default: { load: () => {} } },
      });
      */

      kuzzle = _mockKuzzle();

      kuzzle.install = sinon.stub().resolves();
      kuzzle.loadInitialState = sinon.stub().resolves();
      const options = {
        import: { something: "here" },
        installations: [{ id: "foo", handler: () => {} }],
        support: { something: "here" },
      };
      kuzzle._waitForImportToFinish = sinon.stub().resolves();

      should(kuzzle.state).be.eql(kuzzleStateEnum.STARTING);

      await kuzzle.start(application, options);

      sinon.assert.callOrder(
        kuzzle.pipe, // kuzzle:state:start
        kuzzle.internalIndex.init,
        // clusterModuleInitStub,
        kuzzle.validation.init,
        kuzzle.tokenManager.init,
        kuzzle.funnel.init,
        kuzzle.statistics.init,
        kuzzle.validation.curateSpecification,
        kuzzle.entryPoint.init,
        kuzzle.pluginsManager.init,
        kuzzle.loadInitialState.withArgs(options.import, options.support),
        kuzzle.ask.withArgs("core:security:verify"),
        kuzzle.router.init,
        kuzzle.install.withArgs(options.installations),
        kuzzle.pipe.withArgs("kuzzle:start"),
        kuzzle.pipe.withArgs("kuzzle:state:live"),
        kuzzle.entryPoint.startListening,
        kuzzle.pipe.withArgs("kuzzle:state:ready"),
        kuzzle.emit.withArgs("core:kuzzleStart")
      );

      should(kuzzle.state).be.eql(kuzzleStateEnum.RUNNING);
    });

    // @deprecated
    it("should instantiate Koncorde with PCRE support if asked to", async () => {
      const baseKuzzle = _mockKuzzle();

      //const baseKuzzle = new Kuzzle();

      baseKuzzle._waitForImportToFinish = sinon.stub().resolves();

      await baseKuzzle.start(application);

      const kuzzleWithPCRE = _mockKuzzle();

      kuzzleWithPCRE.ask = sinon.stub().resolves();
      kuzzleWithPCRE.ask.withArgs("core:cache:internal:get").resolves(1);

      kuzzleWithPCRE.config = JSON.parse(JSON.stringify(kuzzleWithPCRE.config));

      kuzzleWithPCRE.config.realtime.pcreSupport = true;

      await kuzzleWithPCRE.start(application);

      should(FakeKoncorde.firstCall).calledWithMatch({ regExpEngine: "re2" });
      should(FakeKoncorde.secondCall).calledWithMatch({ regExpEngine: "js" });
    });

    it("should start all services and register errors handlers if enabled on kuzzle.start", () => {
      kuzzle = _mockKuzzle(Kuzzle);
      kuzzle._waitForImportToFinish = sinon.stub().resolves();

      kuzzle.start(application).then(() => {
        should(processMock.removeAllListeners.getCall(0).args[0]).be.exactly(
          "unhandledRejection"
        );
        should(processMock.on.getCall(0).args[0]).be.exactly(
          "unhandledRejection"
        );

        should(processMock.removeAllListeners.getCall(1).args[0]).be.exactly(
          "uncaughtException"
        );
        should(processMock.on.getCall(1).args[0]).be.exactly(
          "uncaughtException"
        );

        should(processMock.removeAllListeners.getCall(2).args[0]).be.exactly(
          "SIGQUIT"
        );
        should(processMock.on.getCall(2).args[0]).be.exactly("SIGQUIT");

        should(processMock.removeAllListeners.getCall(3).args[0]).be.exactly(
          "SIGABRT"
        );
        should(processMock.on.getCall(3).args[0]).be.exactly("SIGABRT");

        should(processMock.removeAllListeners.getCall(4).args[0]).be.exactly(
          "SIGTRAP"
        );
        should(processMock.on.getCall(4).args[0]).be.exactly("SIGTRAP");

        should(processMock.removeAllListeners.getCall(5).args[0]).be.exactly(
          "SIGINT"
        );
        should(processMock.on.getCall(5).args[0]).be.exactly("SIGINT");

        should(processMock.removeAllListeners.getCall(6).args[0]).be.exactly(
          "SIGTERM"
        );
        should(processMock.on.getCall(6).args[0]).be.exactly("SIGTERM");
      });
    });
  });

  describe("#generateId", () => {
    it("should not initialize the cluster if disabled", async () => {
      kuzzle.config.cluster.enabled = false;

      await kuzzle.start(application, {});

      should(clusterModuleInitStub).not.be.called();
    });
  });

  describe("#dump", () => {
    it("should calls dumpGenerator.dump", async () => {
      await kuzzle.dump();

      should(kuzzle.dumpGenerator.dump).be.calledOnce();
    });
  });

  describe("#shutdown", () => {
    it("should exit only when there is no request left in the funnel", async () => {
      sinon.stub(process, "exit");

      // We cannot use sinon's fake timers: they do not work with async
      // functions
      sinon.stub(Bluebird, "delay").callsFake(() => {
        // we must wait a bit: if we replace with stub.resolves(), V8 converts
        // that into a direct function call, and the event loop never rotates
        return new Promise((resolve) => setTimeout(resolve, 10));
      });

      kuzzle.funnel.remainingRequests = 1;

      setTimeout(() => {
        kuzzle.funnel.remainingRequests = 0;
      }, 50);

      try {
        await kuzzle.shutdown();

        should(kuzzle.entryPoint.dispatch).calledOnce().calledWith("shutdown");
        should(kuzzle.pipe).calledWith("kuzzle:shutdown");
        should(Bluebird.delay.callCount).approximately(5, 1);

        // @deprecated
        should(kuzzle.emit).calledWith("core:shutdown");

        should(process.exit).calledOnce().calledWith(0);
      } finally {
        process.exit.restore();
        Bluebird.delay.restore();
      }
    });
  });

  describe("#install", () => {
    let handler;

    beforeEach(() => {
      handler = sinon.stub().resolves();
      sinon.stub(Date, "now").returns(Date.now());

      kuzzle.ask = sinon
        .stub()
        .withArgs(["core:storage:private:document:exist"])
        .resolves(false);
      kuzzle.ask = sinon
        .stub()
        .withArgs(["core:storage:private:document:create"])
        .resolves();
    });

    afterEach(() => {
      Date.now.restore();
    });

    it("should call the handler and work properly", async () => {
      kuzzle = _mockKuzzle();

      await kuzzle.install([{ id: "id", handler, description: "description" }]);
      should(kuzzle.ask).be.calledTwice();
      should(kuzzle.ask).be.calledWith(
        "core:storage:private:document:exist",
        "kuzzle",
        "installations",
        "id"
      );
      should(kuzzle.ask).be.calledWith(
        "core:storage:private:document:create",
        "kuzzle",
        "installations",
        {
          description: "description",
          handler: handler.toString(),
          installedAt: Date.now(),
        },
        { id: "id" }
      );
      should(handler).be.calledOnce();
      should(kuzzle.log.info).be.calledOnce();
    });

    it("should handle situation when handler has already been executed", async () => {
      kuzzle.ask = sinon
        .stub()
        .withArgs(["core:storage:private:document:exist"])
        .resolves(true);

      await kuzzle.install([{ id: "id", handler }]);

      should(kuzzle.ask).be.calledWith(
        "core:storage:private:document:exist",
        "kuzzle",
        "installations",
        "id"
      );
      should(kuzzle.ask).be.neverCalledWith(
        "core:storage:private:document:create",
        "kuzzle",
        "installations",
        { handler: handler.toString(), installedAt: Date.now() },
        { id: "id" }
      );
      should(handler).not.be.called();
      should(kuzzle.log.info).not.be.called();
    });
  });

  describe("#import", () => {
    let toImport;
    let toSupport;
    let mappingsPayload;
    let permissionsPayload;
    let fixturesPayload;

    beforeEach(() => {
      mappingsPayload = {
        toImport: {
          mappings: { something: "here" },
        },
        toSupport: {
          mappings: { something: "here" },
        },
      };

      permissionsPayload = {
        toImport: {
          profiles: { something: "here" },
          roles: { something: "here" },
          users: { something: "here" },
        },
        toSupport: {
          securities: {
            profiles: { something: "here" },
            roles: { something: "here" },
            user: { something: "here" },
          },
        },
      };

      fixturesPayload = {
        toSupport: {
          fixtures: { something: "here" },
        },
      };

      toImport = {
        mappings: mappingsPayload.toImport.mappings,
        onExistingUsers: "skip",
        profiles: permissionsPayload.toImport.profiles,
        roles: permissionsPayload.toImport.roles,
        userMappings: { something: "here" },
        users: permissionsPayload.toImport.users,
      };

      toSupport = {
        mappings: mappingsPayload.toSupport.mappings,
        fixtures: fixturesPayload.toSupport.fixtures,
        securities: permissionsPayload.toSupport.securities,
      };

      kuzzle.internalIndex.updateMapping = sinon.stub().resolves();
      kuzzle.internalIndex.refreshCollection = sinon.stub().resolves();
    });

    it("should load correctly toImport mappings and permissions", async () => {
      kuzzle._waitForImportToFinish = sinon.stub().resolves();

      await kuzzle.loadInitialState(toImport, {});

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:get",
        "backend:init:import:mappings"
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:store",
        "backend:init:import:mappings",
        sha256(
          stringify({
            toImport: mappingsPayload.toImport,
            toSupport: {},
          })
        )
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:get",
        "backend:init:import:permissions"
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:store",
        "backend:init:import:permissions",
        sha256(
          stringify({
            toImport: permissionsPayload.toImport,
            toSupport: {},
          })
        )
      );

      should(kuzzle.internalIndex.updateMapping).be.calledWith(
        "users",
        toImport.userMappings
      );
      should(kuzzle.internalIndex.refreshCollection).be.calledWith("users");
      should(kuzzle.ask).calledWith(
        "core:storage:public:mappings:import",
        toImport.mappings,
        {
          indexCacheOnly: false,
          propagate: false,
          refresh: true,
        }
      );
      should(kuzzle.ask).calledWith(
        "core:security:load",
        {
          profiles: toImport.profiles,
          roles: toImport.roles,
          users: toImport.users,
        },
        {
          onExistingUsers: toImport.onExistingUsers,
          onExistingUsersWarning: true,
          refresh: "wait_for",
        }
      );
    });

    it("should load correctly toSupport mappings, fixtures and securities", async () => {
      kuzzle._waitForImportToFinish = sinon.stub().resolves();
      await kuzzle.loadInitialState({}, toSupport);

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:get",
        "backend:init:import:mappings"
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:store",
        "backend:init:import:mappings",
        sha256(
          stringify({
            toSupport: mappingsPayload.toSupport,
            toImport: {},
          })
        )
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:get",
        "backend:init:import:permissions"
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:store",
        "backend:init:import:permissions",
        sha256(
          stringify({
            toSupport: permissionsPayload.toSupport,
            toImport: {},
          })
        )
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:get",
        "backend:init:import:fixtures"
      );

      should(kuzzle.ask).be.calledWith(
        "core:cache:internal:store",
        "backend:init:import:fixtures",
        sha256(
          stringify({
            toSupport: fixturesPayload.toSupport,
          })
        )
      );

      should(kuzzle.ask).calledWith(
        "core:storage:public:mappings:import",
        toSupport.mappings,
        {
          indexCacheOnly: false,
          propagate: false,
          rawMappings: true,
          refresh: true,
        }
      );
      should(kuzzle.ask).calledWith(
        "core:storage:public:document:import",
        toSupport.fixtures
      );
      should(kuzzle.ask).calledWith(
        "core:security:load",
        toSupport.securities,
        {
          force: true,
          refresh: "wait_for",
        }
      );
    });

    it("should prevent mappings to be loaded from import and support simultaneously", () => {
      return should(
        kuzzle.loadInitialState(toImport, { mappings: { something: "here" } })
      ).be.rejectedWith({ id: "plugin.runtime.incompatible" });
    });

    it("should prevent permissions to be loaded from import and support simultaneously", () => {
      return should(
        kuzzle.loadInitialState(
          { profiles: { something: "here" } },
          { securities: { roles: { something: "here" } } }
        )
      ).be.rejectedWith({ id: "plugin.runtime.incompatible" });
    });
  });
});
