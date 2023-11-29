"use strict";

const should = require("should");
const sinon = require("sinon");
const mockrequire = require("mock-require");

const { EmbeddedSDK } = require("../../../lib/core/shared/sdk/embeddedSdk");
const KuzzleMock = require("../../mocks/kuzzle.mock");

describe("Backend", () => {
  let application;
  let Backend;

  beforeEach(() => {
    mockrequire("../../../lib/kuzzle", KuzzleMock);

    ({ Backend } = mockrequire.reRequire("../../../lib/core/backend/backend"));

    application = new Backend("black-mesa");
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe("#_instanceProxy", () => {
    it("should return plugin definition and an init function", () => {
      application._pipes = "pipes";
      application._hooks = "hooks";
      application._controllers = "controllers";

      const instance = application._instanceProxy;
      instance.init(null, "context");

      should(instance.pipes).be.eql("pipes");
      should(instance.hooks).be.eql("hooks");
      should(instance.api).be.eql("controllers");
    });
  });

  describe("#sdk", () => {
    it("should return the embedded sdk", async () => {
      await application.start();

      should(application.sdk).be.instanceOf(EmbeddedSDK);
    });

    it("should throw an error if the application is not started", () => {
      should(() => {
        /* eslint-disable-next-line no-unused-expressions */
        application.sdk;
      }).throwError({ id: "plugin.runtime.unavailable_before_start" });
    });
  });

  describe("#nodeId", () => {
    it("should return the node ID", async () => {
      await application.start();

      should(application.nodeId).be.a.String();
    });

    it("should throw an error if the application is not started", () => {
      should(() => {
        /* eslint-disable-next-line no-unused-expressions */
        application.nodeId;
      }).throwError({ id: "plugin.runtime.unavailable_before_start" });
    });
  });

  describe("#start", () => {
    it("should call kuzzle.start with an instantiated plugin and options", async () => {
      application.version = "42.21.84";
      application._vaultKey = "vaultKey";
      application._secretsFile = "secretsFile";
      application._installationsWaitingList = [
        { id: "foo", handler: () => {} },
      ];
      application._plugins = {};
      application._support = {
        mappings: "mappings",
        fixtures: "fixtures",
        securities: "securities",
      };
      application._pipes["kuzzle:state:ready"] = [
        ...application._pipes["kuzzle:state:ready"],
        async () => should(application.started).be.true(),
      ];
      application._import = {
        mappings: {
          index1: { collection1: { mappings: { fieldA: { type: "text" } } } },
        },
        onExistingUsers: "overwrite",
        profiles: { profileA: { policies: [{ roleId: "roleA" }] } },
        roles: { roleA: { controllers: { "*": { actions: { "*": true } } } } },
        userMappings: { properties: { fieldA: { type: "text" } } },
        user: { content: { profileIds: ["profileA"], name: "bar" } },
      };

      await application.start();

      should(global.kuzzle.start).be.calledOnce();

      const [plugin, options] = global.kuzzle.start.getCall(0).args;

      should(plugin.application).be.true();
      should(plugin.name).be.eql("black-mesa");
      should(plugin.version).be.eql("42.21.84");
      should(plugin.instance).be.eql(application._instanceProxy);

      should(options.secretsFile).be.eql(application._secretsFile);
      should(options.vaultKey).be.eql(application._vaultKey);
      should(options.plugins).have.keys(
        "kuzzle-plugin-logger",
        "kuzzle-plugin-auth-passport-local",
      );
      should(options.installations).be.eql(
        application._installationsWaitingList,
      );
      should(options.import).be.eql(application._import);
      should(options.support).be.eql(application._support);
    });

    it("should only submit the configured embedded plugins", async () => {
      application.config.content.plugins.common.include = ["foo"];

      await should(application.start()).rejectedWith(
        /Cannot find module 'foo'.*/,
      );

      application.config.content.plugins.common.include = [
        "kuzzle-plugin-logger",
      ];

      await application.start();

      should(global.kuzzle.start).be.calledOnce();

      const [, options] = global.kuzzle.start.getCall(0).args;

      should(options.plugins).have.keys("kuzzle-plugin-logger");
      should(options.plugins).not.have.keys(
        "kuzzle-plugin-auth-passport-local",
      );
    });
  });

  describe("#properties", () => {
    it("should exposes kerror", () => {
      should(application.kerror.get).be.a.Function();
      should(application.kerror.reject).be.a.Function();
      should(application.kerror.getFrom).be.a.Function();
      should(application.kerror.wrap).be.a.Function();
    });
  });

  describe("#trigger", () => {
    it("should exposes the trigger method", async () => {
      await application.start();

      global.kuzzle.pipe.resolves("resonance cascade");

      const result = await application.trigger("xen:crystal", "payload");

      should(global.kuzzle.pipe).be.calledWith("xen:crystal", "payload");
      should(result).be.eql("resonance cascade");
    });

    it("should throw an error if the application is not started", () => {
      return should(() => {
        application.trigger("xen:crystal", "payload");
      }).throwError({ id: "plugin.runtime.unavailable_before_start" });
    });
  });

  describe("#install", () => {
    let handler;

    beforeEach(async () => {
      handler = sinon.stub().resolves();
    });

    it("should store id, handler and description in the waiting list", () => {
      application.install("id", handler, "description");

      should(application._installationsWaitingList).match([
        { id: "id", handler, description: "description" },
      ]);
      should(handler).not.be.called();
    });

    it("should throws if the app is already running", async () => {
      await application.start();

      should(() => application.install("id", handler)).throwError({
        id: "plugin.runtime.already_started",
      });
    });
  });
});
