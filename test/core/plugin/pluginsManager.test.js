"use strict";

const should = require("should");
const mockrequire = require("mock-require");
const sinon = require("sinon");

const {
  KuzzleError,
  NotFoundError,
  PluginImplementationError,
} = require("../../../index");
const Plugin = require("../../../lib/core/plugin/plugin");
const KuzzleMock = require("../../mocks/kuzzle.mock");
const {
  BaseController,
} = require("../../../lib/api/controllers/baseController");

describe("Plugin", () => {
  let kuzzle;
  let plugin;
  let application;
  let PluginsManager;
  let pluginsManager;

  const createPlugin = (name, app = false) => {
    const instance = {
      init: sinon.stub().resolves(),
      config: {},
    };

    return new Plugin(instance, { name, application: app });
  };
  const createApplication = (name) => createPlugin(name, true);

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    plugin = createPlugin("test-plugin");
    application = createApplication("lambda-core");

    mockrequire.reRequire("../../../lib/core/plugin/pluginContext");
    mockrequire.reRequire("../../../lib/core/plugin/privilegedContext");
    PluginsManager = mockrequire.reRequire(
      "../../../lib/core/plugin/pluginsManager",
    );

    pluginsManager = new PluginsManager();
  });

  describe("#set application", () => {
    it("should adds the application to plugins", () => {
      pluginsManager.application = application;
      pluginsManager._plugins.set(plugin.name, plugin);

      should(pluginsManager._plugins.get(application.name)).be.eql(application);
      should(pluginsManager.application).be.eql(application);
    });

    it("should throws error if there is already application", () => {
      pluginsManager.application = application;

      should(() => {
        pluginsManager.application = application;
      }).throw();
    });

    it("should throws error if there is already plugins", () => {
      pluginsManager._plugins.set(plugin.name, plugin);

      should(() => {
        pluginsManager.application = application;
      }).throw();
    });
  });

  describe("#get plugins", () => {
    it("should returns plugins", () => {
      pluginsManager.application = application;
      pluginsManager._plugins.set(plugin.name, plugin);

      should(Array.from(pluginsManager.plugins.keys())).be.length(1);
      should(pluginsManager._plugins.get(plugin.name)).be.eql(plugin);
    });
  });

  describe("#getPluginsDescription", () => {
    it("should returns plugins descriptions", () => {
      const otherPlugin = createPlugin("other-plugin");
      otherPlugin.info = sinon.stub().returns("other-plugin");
      plugin.info = sinon.stub().returns("plugin");
      pluginsManager._plugins.set(plugin.name, plugin);
      pluginsManager._plugins.set(otherPlugin.name, otherPlugin);

      const description = pluginsManager.getPluginsDescription();

      should(description).match({
        "test-plugin": "plugin",
        "other-plugin": "other-plugin",
      });
    });
  });

  describe("#init", () => {
    beforeEach(() => {
      pluginsManager._initControllers = sinon.stub();
      pluginsManager._initApi = sinon.stub().resolves();
      pluginsManager._initAuthenticators = sinon.stub();
      pluginsManager._initStrategies = sinon.stub();
      pluginsManager._initHooks = sinon.stub();
      pluginsManager._initPipes = sinon.stub();
      pluginsManager.loadPlugins = sinon.stub().returns(new Map());
    });

    it("should only load core plugins in failsafe mode", async () => {
      const localPlugin = createPlugin("kuzzle-plugin-auth-passport-local");
      pluginsManager.loadPlugins.returns(
        new Map([[localPlugin.name, localPlugin]]),
      );
      pluginsManager._plugins.set(plugin.name, plugin);
      pluginsManager.config.common.failsafeMode = true;

      await pluginsManager.init();

      should(pluginsManager.loadedPlugins).be.eql([
        "kuzzle-plugin-auth-passport-local",
      ]);
    });

    it("should loads plugins with existing plugins", async () => {
      const otherPlugin = createPlugin("other-plugin");
      pluginsManager.loadPlugins.returns(
        new Map([
          [otherPlugin.name, otherPlugin],
          [application.name, application],
        ]),
      );
      pluginsManager._plugins.set(plugin.name, plugin);

      await pluginsManager.init("additional plugins");

      should(pluginsManager._plugins.get(plugin.name)).be.eql(plugin);
      should(pluginsManager._plugins.get(otherPlugin.name)).be.eql(otherPlugin);
      should(pluginsManager.loadedPlugins).be.eql([
        "other-plugin",
        "test-plugin",
      ]);
    });

    it("should registers handlers on hook events ", async () => {
      await pluginsManager.init();

      should(kuzzle.on).be.calledTwice();
      should(kuzzle.on.getCall(0).args[0]).be.eql("plugin:hook:loop-error");
      should(kuzzle.on.getCall(1).args[0]).be.eql("hook:onError");
    });

    it("should calls the application init function", async () => {
      application.init = sinon.stub();
      pluginsManager.application = application;

      await pluginsManager.init();

      should(pluginsManager.application.init).be.calledWith(application.name);
    });

    it("should calls each plugin instance init function", async () => {
      pluginsManager.application = application;
      pluginsManager._plugins.set(plugin.name, plugin);

      await pluginsManager.init();

      should(plugin.instance.init).be.calledWith(plugin.config, plugin.context);
      should(application.instance.init).be.calledWith(
        application.config,
        application.context,
      );
      should(plugin.initCalled).be.true();
      should(application.initCalled).be.true();
    });

    it("should registers plugins features", async () => {
      pluginsManager.config.common = {
        pipeWarnTime: 42,
        initTimeout: 100,
      };
      application.instance.api = "api";
      application.instance.hooks = "hooks";
      application.instance.pipes = "pipe";
      plugin.instance.controllers = "controllers";
      plugin.instance.authenticators = "authenticators";
      plugin.instance.strategies = "strategies";
      pluginsManager.application = application;
      pluginsManager._plugins.set(plugin.name, plugin);

      await pluginsManager.init();

      should(pluginsManager._initApi).be.calledWith(application);
      should(pluginsManager._initHooks).be.calledWith(application);
      should(pluginsManager._initPipes).be.calledWith(application);
      should(pluginsManager._initControllers).be.calledWith(plugin);
      should(pluginsManager._initAuthenticators).be.calledWith(plugin);
      should(pluginsManager._initStrategies).be.calledWith(plugin);
    });

    it("should throws an error if a plugin init method take too long", () => {
      pluginsManager.config.common = {
        initTimeout: 10,
      };
      pluginsManager.application = application;
      application.instance.init = () =>
        new Promise((resolve) => setTimeout(resolve, 15));

      return should(pluginsManager.init()).be.rejected();
    });
  });

  describe("#_initApi", () => {
    beforeEach(() => {
      plugin.instance.api = {
        email: {
          actions: {
            send: {
              handler: sinon.stub().resolves(),
            },
            receive: {
              handler: sinon.stub().resolves(),
              http: [
                { verb: "get", path: "/path-from-root" },
                { verb: "post", path: "path-with-leading-underscore" },
              ],
            },
          },
        },
      };
    });

    it("should create a BaseController and add corresponding actions", async () => {
      await pluginsManager._initApi(plugin);

      const emailController = pluginsManager.controllers.get("email");
      should(emailController).be.instanceOf(BaseController);
      should(emailController.__actions).be.eql(new Set(["send", "receive"]));
      should(emailController.send).be.a.Function();
      should(emailController.receive).be.a.Function();
    });

    it("should add http routes and generate default routes", async () => {
      await pluginsManager._initApi(plugin);

      should(pluginsManager.routes).match([
        {
          // generated route
          action: "send",
          controller: "email",
          openapi: undefined,
          path: "/_/email/send",
          verb: "get",
        },
        {
          action: "receive",
          controller: "email",
          openapi: undefined,
          path: "/path-from-root",
          verb: "get",
        },
        {
          action: "receive",
          controller: "email",
          openapi: undefined,
          path: "/_/path-with-leading-underscore",
          verb: "post",
        },
      ]);
    });

    it("should register openapi when defined", async () => {
      const openapi = {
        description: "Example",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      };

      // HTTP route level
      plugin.instance.api.email.actions.receive.http[0].openapi = openapi;

      await pluginsManager._initApi(plugin);

      should(pluginsManager.routes).match([
        {
          // generated route
          action: "send",
          controller: "email",
          openapi: undefined,
          path: "/_/email/send",
          verb: "get",
        },
        {
          action: "receive",
          controller: "email",
          openapi,
          path: "/path-from-root",
          verb: "get",
        },
        {
          action: "receive",
          controller: "email",
          openapi: undefined,
          path: "/_/path-with-leading-underscore",
          verb: "post",
        },
      ]);
    });

    it("should throw an error if the openAPI specification is invalid", () => {
      plugin.instance.api.email.actions.receive.http[0].openapi = {
        invalid: "specification",
      };

      should(pluginsManager._initApi(plugin)).be.rejectedWith({
        id: "plugin.controller.invalid_openapi_schema",
      });
    });

    it("should throw an error if the openAPI specification is not an object", () => {
      plugin.instance.api.email.actions.receive.http[0].openapi = true;

      should(pluginsManager._initApi(plugin)).be.rejectedWith({
        id: "plugin.assert.invalid_controller_definition",
      });
    });

    it("should throw an error if the controller definition is invalid", () => {
      plugin.instance.api = {
        email: {
          actions: {
            handelr: sinon.stub().resolves(),
          },
        },
      };

      should(pluginsManager._initApi(plugin)).be.rejectedWith({
        id: "plugin.assert.invalid_controller_definition",
      });
    });

    it("should throw an error when trying to override a native controller", () => {
      plugin.instance.api = {
        document: {
          actions: {
            handler: sinon.stub().resolves(),
          },
        },
      };

      should(pluginsManager._initApi(plugin)).be.rejectedWith({
        id: "plugin.assert.invalid_controller_definition",
      });
    });
  });

  describe("#_initControllers", () => {
    it("should attach controller actions with method name", () => {
      plugin.instance.controllers = {
        foo: {
          actionName: "functionName",
        },
      };

      plugin.instance.functionName = () => {};

      pluginsManager._initControllers(plugin);

      should(pluginsManager.controllers.get("test-plugin/foo")).be.instanceof(
        BaseController,
      );
      should(
        pluginsManager.controllers.get("test-plugin/foo").actionName,
      ).be.eql(plugin.instance.functionName.bind(plugin.instance));
    });

    it("should attach controller actions with function", () => {
      const action = sinon.spy();

      plugin.instance.controllers = {
        foo: {
          actionName: action,
        },
      };

      plugin.instance.functionName = () => {};

      pluginsManager._initControllers(plugin);

      should(pluginsManager.controllers.get("test-plugin/foo")).be.instanceof(
        BaseController,
      );
      should(
        pluginsManager.controllers.get("test-plugin/foo").actionName,
      ).be.eql(action);
    });

    it("should attach controller routes on kuzzle object", () => {
      plugin.instance.routes = [
        { verb: "get", url: "/bar/:name", controller: "foo", action: "bar" },
        { verb: "head", url: "/bar/:name", controller: "foo", action: "bar" },
        { verb: "post", url: "/bar", controller: "foo", action: "bar" },
        { verb: "put", url: "/bar", controller: "foo", action: "bar" },
        { verb: "delete", url: "/bar", controller: "foo", action: "bar" },
        { verb: "patch", url: "/bar", controller: "foo", action: "bar" },
      ];

      plugin.instance.controllers = {
        foo: {
          bar: "functionName",
        },
      };

      plugin.instance.functionName = () => {};

      pluginsManager._initControllers(plugin);

      should(pluginsManager.routes).be.an.Array().and.length(12);

      should(pluginsManager.routes[0].verb).be.equal("get");
      should(pluginsManager.routes[0].path).be.equal(
        "/_plugin/test-plugin/bar/:name",
      );
      should(pluginsManager.routes[0].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[0].action).be.equal("bar");

      should(pluginsManager.routes[1].verb).be.equal("get");
      should(pluginsManager.routes[1].path).be.equal("/_/bar/:name");
      should(pluginsManager.routes[1].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[1].action).be.equal("bar");

      should(pluginsManager.routes[2].verb).be.equal("head");
      should(pluginsManager.routes[2].path).be.equal(
        "/_plugin/test-plugin/bar/:name",
      );
      should(pluginsManager.routes[2].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[2].action).be.equal("bar");

      should(pluginsManager.routes[3].verb).be.equal("head");
      should(pluginsManager.routes[3].path).be.equal("/_/bar/:name");
      should(pluginsManager.routes[3].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[3].action).be.equal("bar");

      should(pluginsManager.routes[4].verb).be.equal("post");
      should(pluginsManager.routes[4].path).be.equal(
        "/_plugin/test-plugin/bar",
      );
      should(pluginsManager.routes[4].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[4].action).be.equal("bar");

      should(pluginsManager.routes[5].verb).be.equal("post");
      should(pluginsManager.routes[5].path).be.equal("/_/bar");
      should(pluginsManager.routes[5].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[5].action).be.equal("bar");

      should(pluginsManager.routes[6].verb).be.equal("put");
      should(pluginsManager.routes[6].path).be.equal(
        "/_plugin/test-plugin/bar",
      );
      should(pluginsManager.routes[6].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[6].action).be.equal("bar");

      should(pluginsManager.routes[7].verb).be.equal("put");
      should(pluginsManager.routes[7].path).be.equal("/_/bar");
      should(pluginsManager.routes[7].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[7].action).be.equal("bar");

      should(pluginsManager.routes[8].verb).be.equal("delete");
      should(pluginsManager.routes[8].path).be.equal(
        "/_plugin/test-plugin/bar",
      );
      should(pluginsManager.routes[8].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[8].action).be.equal("bar");

      should(pluginsManager.routes[9].verb).be.equal("delete");
      should(pluginsManager.routes[9].path).be.equal("/_/bar");
      should(pluginsManager.routes[9].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[9].action).be.equal("bar");

      should(pluginsManager.routes[10].verb).be.equal("patch");
      should(pluginsManager.routes[10].path).be.equal(
        "/_plugin/test-plugin/bar",
      );
      should(pluginsManager.routes[10].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[10].action).be.equal("bar");

      should(pluginsManager.routes[11].verb).be.equal("patch");
      should(pluginsManager.routes[11].path).be.equal("/_/bar");
      should(pluginsManager.routes[11].controller).be.equal("test-plugin/foo");
      should(pluginsManager.routes[11].action).be.equal("bar");
    });

    it("should abort the plugin initialization if the controller object is incorrectly defined", () => {
      plugin.instance.controllers = {
        foo: "bar",
      };

      should(() => {
        pluginsManager._initControllers(plugin);
      }).throw();
    });

    it("should abort the plugin initialization if one of the controller action is not correctly defined", () => {
      plugin.instance.controllers = {
        foo: {
          actionName: [],
        },
      };

      should(() => {
        pluginsManager._initControllers(plugin);
      }).throw();
    });

    it("should abort the controller initialization if one of the controller action target does not exist", () => {
      plugin.instance.controllers = {
        foo: {
          actionName: "functionName",
          anotherActionName: "fou",
        },
      };

      plugin.instance.functionName = () => {};
      plugin.instance.foo = () => {};

      global.NODE_ENV = "development";

      should(() => pluginsManager._initControllers(plugin)).throw({
        id: "plugin.controller.invalid_action",
        message: /Did you mean "foo"/,
      });
    });

    it("should not add an invalid route to the API", () => {
      plugin.instance.controllers = {
        foo: {
          bar: "functionName",
        },
      };

      global.NODE_ENV = "development";

      plugin.instance.functionName = () => {};

      plugin.instance.routes = [
        { vert: "get", url: "/bar/:name", controller: "foo", action: "bar" },
      ];

      should(() => pluginsManager._initControllers(plugin)).throw({
        id: "plugin.controller.unexpected_route_property",
        message: /Did you mean "verb"/,
      });

      plugin.instance.routes = [
        { verb: "post", url: ["/bar"], controller: "foo", action: "bar" },
      ];

      should(() => pluginsManager._initControllers(plugin)).throw({
        id: "plugin.controller.invalid_route_property",
      });

      plugin.instance.routes = [
        { verb: "posk", url: "/bar", controller: "foo", action: "bar" },
      ];

      should(() => pluginsManager._initControllers(plugin)).throw({
        id: "plugin.controller.unsupported_verb",
        message: /Did you mean "post"/,
      });

      plugin.instance.routes = [
        { verb: "get", url: "/bar/:name", controller: "foo", action: "baz" },
      ];

      should(() => pluginsManager._initControllers(plugin)).throw({
        id: "plugin.controller.undefined_action",
        message: /Did you mean "bar"/,
      });

      plugin.instance.routes = [
        { verb: "get", url: "/bar/:name", controller: "fou", action: "bar" },
      ];

      should(() => pluginsManager._initControllers(plugin)).throw({
        id: "plugin.controller.undefined_controller",
        message: /Did you mean "foo"/,
      });

      plugin.instance.routes = [
        { verb: "get", url: "/bar/:name", controler: "foo", action: "bar" },
      ];

      should(() => {
        pluginsManager._initControllers(plugin);
      });
    });
  });

  describe("strategy management", () => {
    let pluginsManagerStrategy;

    beforeEach(() => {
      plugin._instance = {
        ...plugin.instance,
        afterRegisterFunction: sinon.stub(),
        createFunction: sinon.stub(),
        existsFunction: sinon.stub(),
        deleteFunction: sinon.stub(),
        getByIdFunction: sinon.stub(),
        getInfoFunction: sinon.stub(),
        updateFunction: sinon.stub(),
        validateFunction: sinon.stub(),
        verifyFunction: sinon.stub(),
      };

      plugin.instance.authenticators = {
        SomeStrategy: sinon.stub(),
      };

      plugin.instance.strategies = {
        someStrategy: {
          config: {
            authenticator: "SomeStrategy",
            strategyOptions: {
              someStrategy: "options",
            },
            authenticateOptions: {
              someAuthenticate: "options",
            },
            fields: ["aField", "anotherField"],
          },
          methods: {
            afterRegister: "afterRegisterFunction",
            create: "createFunction",
            delete: "deleteFunction",
            exists: "existsFunction",
            getById: "getByIdFunction",
            getInfo: "getInfoFunction",
            update: "updateFunction",
            validate: "validateFunction",
            verify: "verifyFunction",
          },
        },
      };

      pluginsManagerStrategy = {
        strategy: plugin.instance.strategies.someStrategy,
        methods: {
          exists: plugin.instance.existsFunction,
          create: plugin.instance.createFunction,
          update: plugin.instance.updateFunction,
          delete: plugin.instance.deleteFunction,
          getById: plugin.instance.getByIdFunction,
          getInfo: plugin.instance.getInfoFunction,
          validate: plugin.instance.validateFunction,
          afterRegister: plugin.instance.afterRegisterFunction,
        },
        owner: plugin.name,
      };

      pluginsManager.strategies.someStrategy = pluginsManagerStrategy;
      pluginsManager._plugins.set(plugin.name, plugin);
      sinon.resetHistory();
    });

    describe("#getStrategyFields", () => {
      it("should return fields from configuration", () => {
        should(pluginsManager.getStrategyFields("someStrategy")).be.deepEqual([
          "aField",
          "anotherField",
        ]);
      });
    });

    describe("#hasStrategyMethod", () => {
      it("should return true if a method exists", () => {
        should(
          pluginsManager.hasStrategyMethod("someStrategy", "exists"),
        ).be.true();
      });

      it("should false true if a method does not exist", () => {
        should(
          pluginsManager.hasStrategyMethod("someStrategy", "notExists"),
        ).be.false();
      });
    });

    describe("#getStrategyMethod", () => {
      it("should return a method", () => {
        should(
          pluginsManager.getStrategyMethod("someStrategy", "exists"),
        ).be.a.Function();
      });
    });

    describe("#initAuthenticators", () => {
      it("should throw if the provided authenticators property is not an object", () => {
        [[], "foobar", 123, true].forEach((authenticators) => {
          plugin.instance.authenticators = authenticators;
          should(() => pluginsManager._initAuthenticators(plugin)).throw(
            PluginImplementationError,
            { id: "plugin.authenticators.not_an_object" },
          );
        });
      });

      it("should throw if one of the provided authenticators is not a constructor", () => {
        [() => {}, "foobar", true, 123].forEach((ctor) => {
          plugin.instance.authenticators.foo = ctor;
          should(() => pluginsManager._initAuthenticators(plugin)).throw(
            PluginImplementationError,
            { id: "plugin.authenticators.invalid_authenticator" },
          );
        });
      });
    });

    describe("#initStrategies", () => {
      let foo = { foo: "bar" };

      beforeEach(() => {
        pluginsManager.strategies = {};
        pluginsManager.authenticators[plugin.name] = {
          SomeStrategy: plugin.instance.authenticators.SomeStrategy,
        };
        pluginsManager._plugins.get(plugin.name).initCalled = true;
      });

      it("should add the strategy in strategies if it is well-formed", (done) => {
        plugin.instance.existsFunction = sinon.stub().returns(foo);
        plugin.instance.verifyFunction = sinon.stub().resolves({ kuid: "foo" });

        pluginsManager._initStrategies(plugin);

        should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(
          plugin.instance.strategies.someStrategy,
        );
        should(
          pluginsManager.strategies.someStrategy.methods.afterRegister,
        ).be.Function();
        should(plugin.instance.afterRegisterFunction).be.calledOnce();
        should(
          plugin.instance.afterRegisterFunction.firstCall.args[0],
        ).be.instanceOf(plugin.instance.authenticators.SomeStrategy);
        should(
          pluginsManager.strategies.someStrategy.methods.exists,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.create,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.update,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.delete,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.getById,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.getInfo,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.validate,
        ).be.Function();
        should(plugin.instance.authenticators.SomeStrategy)
          .calledOnce()
          .calledWithNew();

        pluginsManager.strategies.someStrategy.methods
          .exists(foo)
          .then((result) => {
            should(result).be.deepEqual(foo);
            should(plugin.instance.existsFunction).be.calledOnce();

            const verifyAdapter =
              plugin.instance.authenticators.SomeStrategy.firstCall.args[1];
            verifyAdapter({}, (error) => done(error));
          });
      });

      it("should handle plugin names using uppercases", () => {
        // plugin names are stored lowercased
        pluginsManager._plugins.set(plugin.name, plugin);

        plugin.name = plugin.name.toUpperCase();

        pluginsManager.authenticators = {
          [plugin.name]: {
            SomeStrategy: plugin.instance.authenticators.SomeStrategy,
          },
        };

        plugin.instance.existsFunction = sinon.stub().returns(foo);
        plugin.instance.verifyFunction = sinon.stub().resolves({ kuid: "foo" });

        pluginsManager._initStrategies(plugin);
        should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(
          plugin.instance.strategies.someStrategy,
        );
        should(plugin.instance.afterRegisterFunction).be.calledOnce();
      });

      it("method invocation should intercept a thrown error to transform it into PluginImplementationError", () => {
        plugin.instance.existsFunction = sinon
          .stub()
          .throws(new Error("some error"));

        pluginsManager._initStrategies(plugin);
        should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(
          plugin.instance.strategies.someStrategy,
        );
        should(
          pluginsManager.strategies.someStrategy.methods.exists,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.create,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.update,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.delete,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.getInfo,
        ).be.Function();
        should(
          pluginsManager.strategies.someStrategy.methods.validate,
        ).be.Function();

        return should(
          pluginsManager.strategies.someStrategy.methods.exists(foo),
        ).be.rejectedWith(PluginImplementationError);
      });

      it("should throw if strategies is not a non-empty object", () => {
        const message =
          /\[test-plugin\] the exposed "strategies" plugin property must be a non-empty object/;

        [{}, [], null, undefined, "foobar", 123, true].forEach((strategies) => {
          plugin.instance.strategies = strategies;
          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            { message },
          );
        });
      });

      it("should throw if the provided strategy is not an object", () => {
        [[], null, undefined, "foobar", 123, true].forEach((strategy) => {
          plugin.instance.strategies.someStrategy = strategy;
          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.invalid_description",
            },
          );
        });
      });

      it("should throw if methods is not an object", () => {
        [[], null, undefined, "foobar", 123, true].forEach((methods) => {
          plugin.instance.strategies.someStrategy.methods = methods;
          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            { id: "plugin.strategy.invalid_methods" },
          );
        });
      });

      it("should throw if config is not an object", () => {
        [[], null, undefined, "foobar", 123, true].forEach((config) => {
          const message = new RegExp(
            `\\[test-plugin\\] Strategy someStrategy: expected a "config" property of type "object", got: ${config}`,
          );
          plugin.instance.strategies.someStrategy.config = config;
          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            { message },
          );
        });
      });

      it("should throw if a required method is invalid", () => {
        [[], null, undefined, {}, 123, true].forEach((fn) => {
          plugin.instance.strategies.someStrategy.methods.exists = fn;
          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.invalid_method_type",
            },
          );
        });
      });

      it("should throw if a mandatory method is not exposed by the plugin object", () => {
        ["exists", "create", "update", "delete", "validate", "verify"].forEach(
          (methodName) => {
            const fnName = methodName + "Function";

            delete plugin.instance[fnName];

            should(() => pluginsManager._initStrategies(plugin)).throw(
              PluginImplementationError,
              {
                id: "plugin.strategy.missing_method_function",
              },
            );

            plugin.instance[fnName] = sinon.stub();
          },
        );
      });

      it("should throw if an optional method is specified but with an invalid value", () => {
        for (const methodName of ["getInfo", "getById", "afterRegister"]) {
          const clone = createPlugin(plugin.name);
          clone._instance = JSON.parse(JSON.stringify(plugin._instance));

          for (const value of [[], {}, 123, false]) {
            clone.instance.strategies.someStrategy.methods[methodName] = value;

            /* eslint-disable-next-line no-loop-func */
            should(() => pluginsManager._initStrategies(clone)).throw(
              PluginImplementationError,
              {
                id: "plugin.strategy.invalid_method_type",
              },
            );
          }
        }
      });

      it("should throw if an optional method is specified but does not point to a function", () => {
        ["getInfo", "getById", "afterRegister"].forEach((methodName) => {
          const fnName = methodName + "Function";

          delete plugin.instance[fnName];

          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.missing_method_function",
            },
          );

          plugin.instance[fnName] = sinon.stub();
        });
      });

      it("should throw if the strategy authenticator is invalid or missing", () => {
        [[], {}, 123, null, undefined, true].forEach((authenticator) => {
          plugin.instance.strategies.someStrategy.config.authenticator =
            authenticator;

          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.invalid_authenticator",
            },
          );
        });
      });

      it("should throw if the provided authenticator is not listed in this.authenticators", () => {
        plugin.instance.strategies.someStrategy.config.authenticator = "foobar";
        should(() => pluginsManager._initStrategies(plugin)).throw(
          PluginImplementationError,
          {
            id: "plugin.strategy.unknown_authenticator",
          },
        );
      });

      it('should throw if the "strategyOptions" config is invalid', () => {
        [[], "foobar", 123, false].forEach((opts) => {
          plugin.instance.strategies.someStrategy.config.strategyOptions = opts;

          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.invalid_option",
            },
          );
        });
      });

      it('should throw if the "authenticateOptions" config is invalid', () => {
        [[], "foobar", 123, false].forEach((opts) => {
          plugin.instance.strategies.someStrategy.config.authenticateOptions =
            opts;

          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.invalid_option",
            },
          );
        });
      });

      it('should throw if the "fields" config is invalid', () => {
        [{}, "foobar", 123, false].forEach((opts) => {
          plugin.instance.strategies.someStrategy.config.fields = opts;

          should(() => pluginsManager._initStrategies(plugin)).throw(
            PluginImplementationError,
            {
              id: "plugin.strategy.invalid_fields",
            },
          );
        });
      });

      it("should unregister a strategy first if already registered", () => {
        sinon.spy(pluginsManager, "unregisterStrategy");

        pluginsManager._initStrategies(plugin);

        should(pluginsManager.unregisterStrategy).not.be.called();

        pluginsManager._initStrategies(plugin);

        should(pluginsManager.unregisterStrategy)
          .calledOnce()
          .calledWith(plugin.name, "someStrategy");
      });
    });

    describe("#verifyAdapter", () => {
      let verifyAdapter;

      beforeEach(() => {
        pluginsManager.authenticators[plugin.name] = {
          SomeStrategy: plugin.instance.authenticators.SomeStrategy,
        };
        pluginsManager._plugins.get(plugin.name).initCalled = true;
        pluginsManager._initStrategies(plugin);
        verifyAdapter =
          plugin.instance.authenticators.SomeStrategy.firstCall.args[1];
      });

      it("should reject if the plugin returns a non-thenable value", (done) => {
        plugin.instance.verifyFunction.returns(null);
        verifyAdapter("foo", "bar", "baz", (err, res, msg) => {
          try {
            should(res).be.undefined();
            should(msg).be.undefined();
            should(err)
              .instanceOf(PluginImplementationError)
              .match({ id: "plugin.strategy.invalid_verify_return" });
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it("should reject if the plugin resolves to a non-false non-object value", (done) => {
        plugin.instance.verifyFunction.resolves(true);
        verifyAdapter("foo", "bar", (err, res, msg) => {
          try {
            should(res).be.undefined();
            should(msg).be.undefined();
            should(err)
              .instanceOf(PluginImplementationError)
              .match({
                message:
                  /\[test-plugin\] Strategy someStrategy: invalid authentication strategy result/,
              });
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it("should reject if the plugin resolves to a non-string kuid", (done) => {
        plugin.instance.verifyFunction.resolves({ kuid: 123 });
        verifyAdapter("foo", "bar", (err, res, msg) => {
          try {
            should(res).be.undefined();
            should(msg).be.undefined();
            should(err)
              .instanceOf(PluginImplementationError)
              .match({
                message:
                  /\[test-plugin\] Strategy someStrategy: invalid authentication kuid returned: expected a string, got a number/,
              });
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it('should resolve to "false" if the plugins refuse the provided credentials', (done) => {
        plugin.instance.verifyFunction.resolves(false);
        verifyAdapter((err, res, msg) => {
          try {
            should(res).be.false();
            should(msg).be.eql({ message: null });
            should(err).be.null();
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it("should provide a default message if the plugins rejects a login without one", (done) => {
        plugin.instance.verifyFunction.resolves({});
        verifyAdapter((err, res, msg) => {
          try {
            should(res).be.false();
            should(msg).be.eql({
              message: 'Unable to log in using the strategy "someStrategy"',
            });
            should(err).be.null();
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it("should relay the plugin  message if one is provided", (done) => {
        plugin.instance.verifyFunction.resolves({
          message: '"NONE SHALL PASS!" -The Black Knight',
        });
        verifyAdapter((err, res, msg) => {
          try {
            should(res).be.false();
            should(msg).be.eql({
              message: '"NONE SHALL PASS!" -The Black Knight',
            });
            should(err).be.null();
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it("should reject if the plugin returns an invalid kuid", (done) => {
        plugin.instance.verifyFunction.resolves({ kuid: "Waldo" });

        const error = new Error("foo");
        error.id = "security.user.not_found";

        kuzzle.ask.withArgs("core:security:user:get", "Waldo").rejects(error);

        verifyAdapter((err, res, msg) => {
          try {
            should(res).be.undefined();
            should(msg).be.undefined();
            should(err)
              .instanceOf(PluginImplementationError)
              .match({ id: "plugin.strategy.unknown_kuid" });
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });

    describe("#unregisterStrategy", () => {
      it("should remove a strategy using its provided name", () => {
        pluginsManager.unregisterStrategy(plugin.name, "someStrategy");
        should(pluginsManager.strategies).be.an.Object().and.be.empty();
        should(kuzzle.passport.unuse).calledWith("someStrategy");
      });

      it("should throw if the strategy does not exist", () => {
        should(() =>
          pluginsManager.unregisterStrategy(plugin.name, "foobar"),
        ).throw(NotFoundError, { id: "plugin.strategy.strategy_not_found" });
      });

      it("should throw if not the owner of the strategy", () => {
        should(() =>
          pluginsManager.unregisterStrategy(
            "Frank William Abagnale Jr.",
            "someStrategy",
          ),
        ).throw(PluginImplementationError, {
          id: "plugin.strategy.unauthorized_removal",
        });
      });
    });

    describe("#registerStrategy", () => {
      it("should add the strategy to strategies object if init method has not been called", () => {
        const strategy = {
          config: {
            authenticator: "SomeStrategy",
          },
          methods: {
            create: sinon.stub(),
            delete: sinon.stub(),
            exists: sinon.stub(),
            getById: sinon.stub(),
            getInfo: sinon.stub(),
            update: sinon.stub(),
            validate: sinon.stub(),
            verify: sinon.stub(),
          },
        };

        pluginsManager.registerStrategy(plugin.name, "foobar", strategy);

        should(plugin.instance.strategies.foobar).be.eql(strategy);
      });
    });
  });

  describe("#_initHooks", () => {
    let pluginMock;

    beforeEach(() => {
      pluginMock = sinon.mock(plugin.instance);
    });

    it("should attach event hook with method name", async () => {
      plugin.instance.hooks = {
        "foo:bar": "foo",
        "bar:foo": "bar",
      };

      plugin.instance.foo = () => {};
      plugin.instance.bar = () => {};

      pluginMock.expects("foo").once();
      pluginMock.expects("bar").never();

      await pluginsManager._initHooks(plugin);
      kuzzle.emit("foo:bar");
      pluginMock.verify();
    });

    it("should attach event hook with function", async () => {
      const bar = sinon.spy();
      const foo = sinon.spy();

      plugin.instance.hooks = {
        "foo:bar": bar,
        "bar:foo": foo,
      };

      await pluginsManager._initHooks(plugin);
      kuzzle.emit("foo:bar");

      should(bar).be.calledOnce();
      should(foo).not.be.called();
    });

    it("should attach multi-target hook with method name", async () => {
      plugin.instance.hooks = {
        "foo:bar": ["foo", "bar"],
        "bar:foo": ["baz"],
      };

      plugin.instance.foo = () => {};
      plugin.instance.bar = () => {};
      plugin.instance.baz = () => {};

      pluginMock.expects("foo").once();
      pluginMock.expects("bar").once();
      pluginMock.expects("baz").never();

      await pluginsManager._initHooks(plugin);

      kuzzle.emit("foo:bar");

      pluginMock.verify();
    });

    it("should attach multi-target hook with function", async () => {
      const bar = sinon.spy();
      const foo = sinon.spy();
      const baz = sinon.spy();

      plugin.instance.hooks = {
        "foo:bar": [foo, bar],
        "bar:foo": [baz],
      };

      await pluginsManager._initHooks(plugin);

      kuzzle.emit("foo:bar");

      should(bar).be.calledOnce();
      should(foo).be.calledOnce();
      should(baz).not.be.called();
    });

    it("should attach event hook with wildcard with method name", async () => {
      plugin.instance.hooks = {
        "foo:*": "foo",
        "bar:foo": "bar",
      };

      plugin.instance.foo = () => {};
      plugin.instance.bar = () => {};

      pluginMock.expects("foo").once();
      pluginMock.expects("bar").never();

      await pluginsManager._initHooks(plugin);

      kuzzle.emit("foo:bar");
      pluginMock.verify();
    });

    it("should throw if a hook target is not a function and not a method name", () => {
      plugin.instance.hooks = {
        "foo:bar": "fou",
      };

      plugin.instance.foo = () => {};

      global.NODE_ENV = "development";
      should(() => pluginsManager._initHooks(plugin)).throw({
        id: "plugin.assert.invalid_hook",
        message: /Did you mean "foo"/,
      });
    });
  });

  describe("#_initPipes", () => {
    let pluginMock;

    beforeEach(() => {
      pluginMock = sinon.mock(plugin.instance);
      kuzzle.pipe.restore();
      kuzzle.pluginsManager = pluginsManager;
    });

    it("should attach pipes bound to the plugin object using method names", async () => {
      plugin.instance.pipes = {
        "foo:bar": "foo",
        "bar:foo": "bar",
      };

      plugin.instance.foo = sinon.stub().callsFake(async function () {
        should(this).be.eql(plugin.instance);
      });
      plugin.instance.bar = sinon.stub();

      await pluginsManager._initPipes(plugin);
      await kuzzle.pipe("foo:bar");

      should(plugin.instance.foo).be.calledOnce();
      should(plugin.instance.bar).not.be.called();
    });

    it("should attach pipes event with a function", async () => {
      const bar = sinon.stub().resolves();
      const foo = sinon.stub().callsArgWith(1, null);

      plugin.instance.pipes = {
        "foo:bar": foo,
        "bar:foo": bar,
      };

      await pluginsManager._initPipes(plugin);
      await kuzzle.pipe("foo:bar");

      should(foo).be.calledOnce();
      should(bar).not.be.called();
    });

    it("should attach pipes event with wildcard with method name", async () => {
      plugin.instance.pipes = {
        "foo:*": "foo",
        "bar:foo": "bar",
      };

      plugin.instance.foo = sinon.stub().resolves();
      plugin.instance.bar = sinon.stub().callsArgWith(1, null);

      await pluginsManager._initPipes(plugin);
      await kuzzle.pipe("foo:bar");

      should(plugin.instance.foo).be.calledOnce();
      should(plugin.instance.bar).not.be.called();
    });

    it("should attach multi-target event to pipes with method name", async () => {
      plugin.instance.pipes = {
        "foo:bar": ["foo", "baz"],
        "bar:foo": ["bar"],
      };

      plugin.instance.foo = sinon.stub().callsFake(async function () {
        should(this).eql(plugin.instance);
      });
      plugin.instance.bar = sinon.stub().resolves();
      plugin.instance.baz = sinon.stub().callsFake(function (arg, cb) {
        should(this).eql(plugin.instance);
        cb(null);
      });

      await pluginsManager._initPipes(plugin);
      await kuzzle.pipe("foo:bar");

      should(plugin.instance.foo).be.calledOnce();
      should(plugin.instance.baz).be.calledOnce();
      should(plugin.instance.bar).not.be.called();
    });

    it("should attach multi-target event to pipes with function", async () => {
      const bar = sinon.stub().resolves();
      const foo = sinon.stub().resolves();
      const baz = sinon.stub().resolves();

      plugin.instance.pipes = {
        "foo:bar": [foo, baz],
        "bar:foo": [bar],
      };

      await pluginsManager._initPipes(plugin);
      await kuzzle.pipe("foo:bar");

      should(foo).be.calledOnce();
      should(baz).be.calledOnce();
      should(bar).not.be.called();
    });

    it("should throw if a pipe target is not a function and not a method name", () => {
      plugin.instance.pipes = {
        "foo:bar": "fou",
      };

      plugin.instance.foo = () => {};

      global.NODE_ENV = "development";
      should(() => pluginsManager._initPipes(plugin)).throw({
        id: "plugin.assert.invalid_pipe",
        message: /Did you mean "foo"/,
      });
    });

    it("should attach pipes event and reject if an attached function return an error", () => {
      plugin.instance.pipes = {
        "foo:bar": "foo",
      };

      plugin.instance.foo = sinon
        .stub()
        .callsArgWith(1, new KuzzleError("foobar"));

      pluginsManager._initPipes(plugin);

      return should(kuzzle.pipe("foo:bar")).be.rejectedWith(KuzzleError, {
        message: "foobar",
      });
    });

    it("should embed a non-KuzzleError error in a PluginImplementationError", async () => {
      plugin.instance.pipes = {
        "foo:bar": "foo",
      };

      plugin.instance.foo = () => {};

      pluginMock.expects("foo").once().callsArgWith(1, "foobar");
      pluginsManager._initPipes(plugin);

      return should(kuzzle.pipe("foo:bar")).be.rejectedWith(
        PluginImplementationError,
        { id: "plugin.runtime.unexpected_error" },
      );
    });

    it("should log a warning in case a pipe plugin exceeds the warning delay", async () => {
      const fooStub = sinon.stub().callsFake((ev, cb) => {
        setTimeout(() => cb(null), 15);
      });
      plugin.instance.pipes = {
        "foo:bar": fooStub,
      };

      plugin.config.pipeWarnTime = 10;

      await pluginsManager._initPipes(plugin);
      await kuzzle.pipe("foo:bar");

      should(fooStub).be.calledOnce();
      should(kuzzle.log.warn).calledWithMatch(
        /\[test-plugin\] pipe for event 'foo:bar' is slow \(\d+ms\)/,
      );
    });

    it("should accept promises for pipes", async () => {
      plugin.instance.pipes = {
        "foo:bar": "foo",
      };

      plugin.instance.foo = sinon.stub().resolves("foobar");

      await pluginsManager._initPipes(plugin);
      const response = await kuzzle.pipe("foo:bar");

      should(plugin.instance.foo).be.calledOnce();
      should(response).eql("foobar");
    });
  });

  describe("#loadPlugin", () => {
    it("", () => {});
  });
});
