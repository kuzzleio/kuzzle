import type { JSONObject } from "kuzzle-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BaseController } from "../../../lib/api/controllers/baseController";
import Plugin from "../../../lib/core/plugin/plugin";
import PluginsManager from "../../../lib/core/plugin/pluginsManager";
import type {
  CallbackPipeHandler,
  HookEventHandler,
  PipeEventHandler,
} from "../../../lib/types/EventHandler";
import type { PluginApiDefinition } from "../../../lib/types/Plugin";
import type { PluginInstance } from "../../../lib/types/PluginInstance";
import { InternalError as KuzzleInternalError } from "../../../lib/kerror/errors/internalError";
import { NotFoundError } from "../../../lib/kerror/errors/notFoundError";
import { PluginImplementationError } from "../../../lib/kerror/errors/pluginImplementationError";
import KuzzleEventEmitter from "../../../lib/kuzzle/event/KuzzleEventEmitter";
import { invalid } from "../../helpers/invalid";
import { settle } from "../../helpers/settle";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

const PLUGIN_NAME = "test-plugin";
const APPLICATION_NAME = "lambda-core";

/**
 * Reaches the subject's `private _plugins`.
 *
 * Named once, as [L1b2] settled: this spec asserts on internal state — and
 * *arranges* it, which is how every block below installs a plugin without
 * going through `loadPlugins` — because the suite it replaces did.
 */
const pluginsOf = (manager: PluginsManager) =>
  (manager as unknown as { _plugins: Map<string, Plugin> })._plugins;

/** A registered strategy's method, which the subject stores as `JSONObject`. */
const methodOf = (methods: JSONObject, name: string) =>
  methods[name] as (...args: unknown[]) => Promise<unknown>;

/**
 * A pipe in callback form, and where its callback actually is.
 *
 * `registerPipe`'s wrapper calls a payload-less pipe as `handler(null, cb)`,
 * so the callback is the **last** argument and never the first — which is why
 * the Mocha spec wrote `callsArgWith(1, null)` and why a handler declared as
 * `(callback) => callback()` calls `null`.
 */
const yields = (error: unknown = null, result?: unknown) =>
  vi.fn((...args: unknown[]) =>
    (args.at(-1) as (e: unknown, r?: unknown) => void)(error, result),
  );

/** The callback a pipe handler was invoked with. */
const callbackOf = (args: unknown[]) =>
  args.at(-1) as (error?: unknown, result?: unknown) => void;

/**
 * ⚠️ Two hook/pipe targets the subject accepts and the declared types do not —
 * [TD-78](../../../docs/adr-001/type-debt-register.md#td-78).
 *
 * `PluginHookDefinition` and `PluginPipeDefinition` admit handler *functions*
 * only, while `resolveEventHandler` also takes **the name of a plugin method**
 * (deprecated, warned about, and still the form half of this block tests), and
 * `registerPipe`'s wrapper hands the runner a **callback-form** pipe
 * (`CallbackPipeHandler`, which the emitter's own `RegisteredPipeHandler`
 * admits and the plugin-facing type does not). Named here twice rather than at
 * each of their ~20 uses.
 */
const byName = (name: string) =>
  name as unknown as HookEventHandler & PipeEventHandler;

const asPipe = (handler: CallbackPipeHandler) =>
  handler as unknown as PipeEventHandler;

/** Reads an action off a `BaseController`, whose keys are built at runtime. */
const actionOf = (controller: BaseController | undefined, name: string) =>
  Reflect.get(controller ?? {}, name) as (...args: unknown[]) => unknown;

function createPlugin(
  name: string,
  {
    application = false,
    instance = {},
  }: {
    application?: boolean;
    instance?: PluginInstance;
  } = {},
) {
  return new Plugin(
    { config: {}, init: vi.fn(async () => undefined), ...instance },
    { name, application },
  );
}

describe("#core/plugin/pluginsManager", () => {
  let pluginsManager: PluginsManager;
  let plugin: Plugin;
  let application: Plugin;
  let emitter: KuzzleEventEmitter;
  let on: ReturnType<typeof vi.fn>;
  let passport: {
    unuse: ReturnType<typeof vi.fn>;
    use: ReturnType<typeof vi.fn>;
  };
  let users: Map<string, unknown>;
  let nodeEnv: string | undefined;

  beforeEach(() => {
    /*
     * ⚠️ `checkActionDefinition` reads `global.app.config.content` for every
     * controller it checks, plugin controllers included, and `global.app` is a
     * getter that THROWS when no application was built. This suite never
     * builds one: under Mocha it passed only because the `test/core/backend/*`
     * specs ran first in the same process and left one behind (ADR-0001 step
     * 13, L4a). Defined rather than assigned, because `backend.ts`'s setter
     * refuses a second write — the same shape `stubKuzzle` handles for
     * `global.kuzzle`.
     */
    Reflect.defineProperty(global, "app", {
      configurable: true,
      value: { config: { content: {} } },
      writable: true,
    });

    nodeEnv = global.NODE_ENV;

    /*
     * The real emitter, because every hook and pipe assertion below is about
     * what running the event does: `_initHooks` registers through
     * `registerPluginHook` and the test then emits, `_initPipes` registers
     * through `registerPluginPipe` and the test then pipes. The Mocha spec
     * reached the same emitter by un-stubbing two KuzzleMock methods
     * (`kuzzle.emit.restore()`, `kuzzle.pipe.restore()`) in the blocks that
     * needed them, which is the same fixture said twice and only where
     * someone remembered.
     */
    emitter = new KuzzleEventEmitter(10, 50);
    on = vi.fn((event: string, fn: (...args: unknown[]) => unknown) =>
      emitter.on(event, fn),
    );
    passport = { unuse: vi.fn(), use: vi.fn() };
    users = new Map();

    stubKuzzle({
      /*
       * Two events, and both are the subject's: `_initApi` refuses to override
       * a native controller, and a strategy's `verify` resolves a kuid to a
       * user. An unknown kuid rejects with the id `resolveKuid` duck-types,
       * so a spec arranges the *user*, not the rejection.
       */
      ask: vi.fn(async (event: string, ...args: unknown[]) => {
        if (event === "kuzzle:api:funnel:controller:isNative") {
          return args[0] === "document";
        }

        if (event === "core:security:user:get") {
          const kuid = args[0] as string;

          if (!users.has(kuid)) {
            throw Object.assign(new Error(`user "${kuid}" not found`), {
              id: "security.user.not_found",
            });
          }

          return users.get(kuid);
        }

        throw new Error(`unexpected ask("${event}")`);
      }),
      config: {
        limits: {},
        plugins: {
          common: {
            failsafeMode: false,
            initTimeout: 10000,
            pipeWarnTime: 500,
          },
        },
        repositories: { common: { cacheTTL: 1440000 } },
        services: { storageEngine: { client: {} } },
        version: "2.56.0",
      },
      emit: (event: string, ...args: unknown[]) => emitter.emit(event, ...args),
      on,
      passport,
      pipe: (event: string, ...payload: unknown[]) =>
        emitter.pipe(event, ...payload),
      registerPluginHook: (
        pluginName: string,
        event: string,
        fn: (...args: unknown[]) => unknown,
      ) => emitter.registerPluginHook(pluginName, event, fn),
      registerPluginPipe: (event: string, handler: never) =>
        emitter.registerPluginPipe(event, handler),
      rootPath: "/var/app",
      unregisterPluginPipe: (pipeId: string) =>
        emitter.unregisterPluginPipe(pipeId),
      /*
       * `Plugin.init` builds a `PluginContext`, which binds
       * `global.kuzzle.validation.addType` — so a suite about the *manager*
       * needs it the moment a plugin is initialized. KuzzleMock supplied a
       * whole validation module for it.
       */
      validation: { addType: vi.fn(), validate: vi.fn() },
    });

    pluginsManager = new PluginsManager();

    plugin = createPlugin(PLUGIN_NAME);
    application = createPlugin(APPLICATION_NAME, { application: true });
  });

  afterEach(() => {
    /*
     * `NODE_ENV` is what `didYouMean` checks before suggesting anything, so
     * the tests asserting on a suggestion have to set it. The Mocha spec set
     * it and never put it back — for the whole process, in a suite where the
     * next file's expectations depend on it.
     */
    global.NODE_ENV = nodeEnv;
    Reflect.deleteProperty(global, "app");
    restoreKuzzle();
  });

  describe("#set application", () => {
    it("registers the application among the plugins", () => {
      pluginsManager.application = application;

      expect(pluginsOf(pluginsManager).get(APPLICATION_NAME)).toBe(application);
      expect(pluginsManager.application).toBe(application);
    });

    it("refuses a second application", () => {
      pluginsManager.application = application;

      expect(() => {
        pluginsManager.application = application;
      }).toThrow(
        "The application plugin can only be set before every other plugins are loaded",
      );
    });

    it("refuses an application once a plugin is loaded", () => {
      pluginsOf(pluginsManager).set(plugin.name, plugin);

      expect(() => {
        pluginsManager.application = application;
      }).toThrow(
        /*
         * The same message as the test above, and that is the point: setting
         * the application adds it to `_plugins`, so "already an application"
         * reaches the setter as "already some plugins". There is one guard,
         * stated twice.
         */
        "The application plugin can only be set before every other plugins are loaded",
      );
    });

    it("refuses a plugin that is not declared as an application", () => {
      expect(() => {
        pluginsManager.application = plugin;
      }).toThrow(
        'The application plugin must have the "application" property equals to true',
      );
    });
  });

  describe("#get plugins", () => {
    /*
     * The Mocha test read `Array.from(pluginsManager.plugins.keys())` and
     * asserted its length — but `plugins` answers an **array**, and
     * `Array.prototype.keys()` answers its indices. It was asserting that one
     * plugin came back, through an accessor that would have answered the same
     * for any single element.
     */
    it("answers the plugins, without the application", () => {
      pluginsManager.application = application;
      pluginsOf(pluginsManager).set(plugin.name, plugin);

      expect(pluginsManager.plugins).toEqual([plugin]);
    });
  });

  describe("#getPluginsDescription", () => {
    it("answers each plugin's own description", () => {
      const otherPlugin = createPlugin("other-plugin");

      plugin.info = vi.fn(() => ({ name: PLUGIN_NAME }));
      otherPlugin.info = vi.fn(() => ({ name: "other-plugin" }));

      pluginsOf(pluginsManager).set(plugin.name, plugin);
      pluginsOf(pluginsManager).set(otherPlugin.name, otherPlugin);

      expect(pluginsManager.getPluginsDescription()).toEqual({
        "other-plugin": { name: "other-plugin" },
        [PLUGIN_NAME]: { name: PLUGIN_NAME },
      });
    });
  });

  describe("#init", () => {
    beforeEach(() => {
      pluginsManager._initControllers = vi.fn();
      pluginsManager._initApi = vi.fn(async () => undefined);
      pluginsManager._initAuthenticators = vi.fn();
      pluginsManager._initStrategies = vi.fn();
      pluginsManager._initHooks = vi.fn();
      pluginsManager._initPipes = vi.fn();
      pluginsManager.loadPlugins = vi.fn(() => new Map());
    });

    it("loads only the core plugins in failsafe mode", async () => {
      const localPlugin = createPlugin("kuzzle-plugin-auth-passport-local");

      pluginsManager.loadPlugins = vi.fn(
        () => new Map([[localPlugin.name, localPlugin]]),
      );
      pluginsOf(pluginsManager).set(plugin.name, plugin);
      pluginsManager.config.common.failsafeMode = true;

      await pluginsManager.init();

      expect(pluginsManager.loadedPlugins).toEqual([
        "kuzzle-plugin-auth-passport-local",
      ]);
    });

    it("keeps the plugins already registered and adds the loaded ones", async () => {
      const otherPlugin = createPlugin("other-plugin");

      pluginsManager.loadPlugins = vi.fn(
        () =>
          new Map([
            [otherPlugin.name, otherPlugin],
            [application.name, application],
          ]),
      );
      pluginsOf(pluginsManager).set(plugin.name, plugin);

      await pluginsManager.init({ "additional plugins": {} });

      expect(pluginsOf(pluginsManager).get(plugin.name)).toBe(plugin);
      expect(pluginsOf(pluginsManager).get(otherPlugin.name)).toBe(otherPlugin);
      /* The application is loaded, and deliberately not counted. */
      expect(pluginsManager.loadedPlugins).toEqual([
        "other-plugin",
        PLUGIN_NAME,
      ]);
    });

    it("registers the two hook-error handlers", async () => {
      await pluginsManager.init();

      expect(on.mock.calls.map(([event]) => event)).toEqual([
        "plugin:hook:loop-error",
        "hook:onError",
      ]);
    });

    it("initializes the application with its own name", async () => {
      const init = vi.fn();

      application.init = init;
      pluginsManager.application = application;

      await pluginsManager.init();

      expect(init).toHaveBeenCalledWith(APPLICATION_NAME);
    });

    it("calls every plugin instance's init, and records that it ran", async () => {
      pluginsManager.application = application;
      pluginsOf(pluginsManager).set(plugin.name, plugin);

      await pluginsManager.init();

      expect(plugin.instance.init).toHaveBeenCalledWith(
        plugin.config,
        plugin.context,
      );
      expect(application.instance.init).toHaveBeenCalledWith(
        application.config,
        application.context,
      );
      expect(plugin.initCalled).toBe(true);
      expect(application.initCalled).toBe(true);
    });

    it("registers each declared feature against the plugin that declares it", async () => {
      pluginsManager.config.common = { initTimeout: 100, pipeWarnTime: 42 };

      /*
       * Markers, not definitions: `init` dispatches on `isEmpty`, and each
       * `_init*` is stubbed above — what this test asserts is which plugin
       * each one is called with.
       */
      application.instance.api = invalid<PluginApiDefinition>({ some: "api" });
      application.instance.hooks = { "foo:bar": byName("hooks") };
      application.instance.pipes = { "foo:bar": byName("pipe") };
      plugin.instance.controllers = invalid({ foo: {} });
      plugin.instance.authenticators = { Some: "authenticator" };
      plugin.instance.strategies = { some: "strategy" };

      pluginsManager.application = application;
      pluginsOf(pluginsManager).set(plugin.name, plugin);

      await pluginsManager.init();

      expect(pluginsManager._initApi).toHaveBeenCalledWith(application);
      expect(pluginsManager._initHooks).toHaveBeenCalledWith(application);
      expect(pluginsManager._initPipes).toHaveBeenCalledWith(application);
      expect(pluginsManager._initControllers).toHaveBeenCalledWith(plugin);
      expect(pluginsManager._initAuthenticators).toHaveBeenCalledWith(plugin);
      expect(pluginsManager._initStrategies).toHaveBeenCalledWith(plugin);
    });

    it("rejects when a plugin's init takes too long", async () => {
      pluginsManager.config.common = { initTimeout: 10 };
      pluginsManager.application = application;
      application.instance.init = () =>
        new Promise((resolve) => setTimeout(resolve, 50));

      /*
       * `be.rejected()` said only that something went wrong. What the timeout
       * is for is the message telling an operator which knob to turn.
       */
      await expect(pluginsManager.init()).rejects.toThrow(
        /Initialization timed out after 10ms/,
      );
    });
  });

  describe("#_initApi", () => {
    let api: JSONObject;

    beforeEach(() => {
      /*
       * Declaration order is the contract: `_initApi` walks the actions as
       * they are written, so `send`'s generated route comes before
       * `receive`'s declared ones.
       */
      /* eslint-disable sort-keys */
      api = {
        email: {
          actions: {
            send: { handler: vi.fn(async () => undefined) },
            receive: {
              handler: vi.fn(async () => undefined),
              http: [
                { path: "/path-from-root", verb: "get" },
                { path: "path-with-leading-underscore", verb: "post" },
              ],
            },
          },
        },
      };
      /* eslint-enable sort-keys */

      plugin.instance.api = invalid<PluginApiDefinition>(api);
    });

    it("builds a controller and adds every declared action to it", async () => {
      await pluginsManager._initApi(plugin);

      const controller = pluginsManager.controllers.get("email");

      expect(controller).toBeInstanceOf(BaseController);
      expect(controller?._actions).toEqual(new Set(["send", "receive"]));
      expect(actionOf(controller, "send")).toBeTypeOf("function");
      expect(actionOf(controller, "receive")).toBeTypeOf("function");
    });

    it("keeps the declared HTTP routes and generates the missing one", async () => {
      await pluginsManager._initApi(plugin);

      expect(pluginsManager.routes).toEqual([
        {
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

    it("carries a route's openapi declaration through", async () => {
      const openapi = {
        description: "Example",
        responses: {
          200: {
            content: { "application/json": { schema: { type: "string" } } },
            description: "OK",
          },
        },
      };

      api.email.actions.receive.http[0].openapi = openapi;

      await pluginsManager._initApi(plugin);

      expect(pluginsManager.routes[1]).toEqual({
        action: "receive",
        controller: "email",
        openapi,
        path: "/path-from-root",
        verb: "get",
      });
    });

    /*
     * ⚠️ Four tests wrote `should(pluginsManager._initApi(plugin)).be
     * .rejectedWith(…)` and **returned nothing**, from a non-async function.
     * `should`'s promise assertions answer a promise; unreturned, Mocha ends
     * the test before it settles, and the rejection lands as an unhandled one.
     * All four passed whatever `_initApi` did — and for the two below, what it
     * does is nothing at all.
     */

    /*
     * A route's `openapi` member is carried into the route as declared:
     * `checkHttpRoute` polices property names, not this value. Two error codes
     * (`plugin.{assert,controller}.invalid_openapi_schema`) once advertised a
     * validation that was never written, and two dead Mocha tests "proved" it;
     * the codes were removed rather than the validation added, because adding
     * it would refuse at startup applications that start today
     * ([TD-77](../../../docs/adr-001/type-debt-register.md#td-77)). These two
     * tests state the contract as it is.
     */
    it("carries an openapi declaration that is not a valid specification, unchecked", async () => {
      api.email.actions.receive.http[0].openapi = { invalid: "specification" };

      await pluginsManager._initApi(plugin);

      expect(pluginsManager.routes[1].openapi).toEqual({
        invalid: "specification",
      });
    });

    it("carries an openapi declaration that is not even an object, unchecked", async () => {
      api.email.actions.receive.http[0].openapi = true;

      await pluginsManager._initApi(plugin);

      expect(pluginsManager.routes[1].openapi).toBe(true);
    });

    it("rejects an action with no handler", async () => {
      plugin.instance.api = invalid<PluginApiDefinition>({
        email: { actions: { handelr: vi.fn(async () => undefined) } },
      });

      await expect(pluginsManager._initApi(plugin)).rejects.toMatchObject({
        id: "plugin.assert.invalid_controller_definition",
      });
    });

    it("refuses to override a native controller", async () => {
      plugin.instance.api = invalid<PluginApiDefinition>({
        document: { actions: { handler: vi.fn(async () => undefined) } },
      });

      await expect(pluginsManager._initApi(plugin)).rejects.toMatchObject({
        id: "plugin.assert.invalid_controller_definition",
      });
    });
  });

  describe("#_initControllers", () => {
    it("binds an action named by a method name to the plugin instance", () => {
      const functionName = vi.fn(function answersItsReceiver(this: unknown) {
        return this;
      });

      plugin.instance.controllers = { foo: { actionName: "functionName" } };
      plugin.instance.functionName = functionName;

      pluginsManager._initControllers(plugin);

      const controller = pluginsManager.controllers.get("test-plugin/foo");

      expect(controller).toBeInstanceOf(BaseController);
      /*
       * The Mocha test compared the registered action with a *freshly* bound
       * `functionName` — two different function objects. What the binding is
       * for is the receiver, so that is what the port asserts.
       */
      expect(actionOf(controller, "actionName")()).toBe(plugin.instance);
      expect(functionName).toHaveBeenCalledTimes(1);
    });

    it("registers an action given as a function as-is", () => {
      const action = vi.fn();

      plugin.instance.controllers = { foo: { actionName: action } };

      pluginsManager._initControllers(plugin);

      const controller = pluginsManager.controllers.get("test-plugin/foo");

      expect(controller).toBeInstanceOf(BaseController);
      expect(actionOf(controller, "actionName")).toBe(action);
    });

    it("declares both the legacy and the current path of every route", () => {
      plugin.instance.controllers = { foo: { bar: "functionName" } };
      plugin.instance.functionName = () => {};
      plugin.instance.routes = [
        { action: "bar", controller: "foo", url: "/bar/:name", verb: "get" },
        { action: "bar", controller: "foo", url: "/bar/:name", verb: "head" },
        { action: "bar", controller: "foo", url: "/bar", verb: "post" },
        { action: "bar", controller: "foo", url: "/bar", verb: "put" },
        { action: "bar", controller: "foo", url: "/bar", verb: "delete" },
        { action: "bar", controller: "foo", url: "/bar", verb: "patch" },
      ];

      pluginsManager._initControllers(plugin);

      /*
       * Forty-eight assertions in the Mocha spec, one per field of one route.
       * As a table, what they add up to is legible: every declared route is
       * published twice, under the deprecated `/_plugin/<name>` prefix and
       * under `/_`, in the order they were declared.
       */
      expect(pluginsManager.routes).toEqual(
        [
          ["get", "/bar/:name"],
          ["head", "/bar/:name"],
          ["post", "/bar"],
          ["put", "/bar"],
          ["delete", "/bar"],
          ["patch", "/bar"],
        ].flatMap(([verb, path]) => [
          {
            action: "bar",
            controller: "test-plugin/foo",
            path: `/_plugin/test-plugin${path}`,
            verb,
          },
          {
            action: "bar",
            controller: "test-plugin/foo",
            path: `/_${path}`,
            verb,
          },
        ]),
      );
    });

    it("refuses a controller that is not an object", () => {
      plugin.instance.controllers = { foo: "bar" };

      expect(() => pluginsManager._initControllers(plugin)).toThrow(
        expect.objectContaining({
          id: "plugin.controller.invalid_description",
        }),
      );
    });

    it("refuses an action that is neither a function nor a method name", () => {
      plugin.instance.controllers = { foo: { actionName: [] } };

      expect(() => pluginsManager._initControllers(plugin)).toThrow(
        expect.objectContaining({ id: "plugin.controller.invalid_action" }),
      );
    });

    it("suggests a method name when an action points at nothing", () => {
      plugin.instance.controllers = {
        foo: { actionName: "functionName", anotherActionName: "fou" },
      };
      plugin.instance.functionName = () => {};
      plugin.instance.foo = () => {};

      global.NODE_ENV = "development";

      expect(() => pluginsManager._initControllers(plugin)).toThrow(
        expect.objectContaining({
          id: "plugin.controller.invalid_action",
          message: expect.stringContaining('Did you mean "foo"'),
        }),
      );
    });

    describe("an invalid route", () => {
      beforeEach(() => {
        plugin.instance.controllers = { foo: { bar: "functionName" } };
        plugin.instance.functionName = () => {};

        global.NODE_ENV = "development";
      });

      /*
       * ⚠️ The sixth case — the `controler` typo — was written as
       * `should(() => { pluginsManager._initControllers(plugin); });`. No
       * matcher, and `should(fn)` does not call `fn`: the subject never ran.
       * It is the case that proves the property-name check catches a typo in
       * the property *name*, and it had never been exercised.
       */
      it.each([
        [
          "an unknown property",
          { action: "bar", controller: "foo", url: "/bar/:name", vert: "get" },
          "plugin.controller.unexpected_route_property",
          'Did you mean "verb"',
        ],
        [
          "a property that is not a string",
          { action: "bar", controller: "foo", url: ["/bar"], verb: "post" },
          "plugin.controller.invalid_route_property",
          "",
        ],
        [
          "an unsupported verb",
          { action: "bar", controller: "foo", url: "/bar", verb: "posk" },
          "plugin.controller.unsupported_verb",
          'Did you mean "post"',
        ],
        [
          "an action the controller does not expose",
          { action: "baz", controller: "foo", url: "/bar/:name", verb: "get" },
          "plugin.controller.undefined_action",
          'Did you mean "bar"',
        ],
        [
          "a controller that does not exist",
          { action: "bar", controller: "fou", url: "/bar/:name", verb: "get" },
          "plugin.controller.undefined_controller",
          'Did you mean "foo"',
        ],
        [
          "a misspelled controller property",
          { action: "bar", controler: "foo", url: "/bar/:name", verb: "get" },
          "plugin.controller.unexpected_route_property",
          'Did you mean "controller"',
        ],
      ])("is refused: %s", (_case, route, id, suggestion) => {
        plugin.instance.routes = [route];

        expect(() => pluginsManager._initControllers(plugin)).toThrow(
          expect.objectContaining({
            id,
            message: expect.stringContaining(suggestion),
          }),
        );
      });
    });
  });

  describe("strategy management", () => {
    let instance: {
      afterRegisterFunction: ReturnType<typeof vi.fn>;
      authenticators: Record<string, unknown> & {
        SomeStrategy: ReturnType<typeof vi.fn>;
      };
      createFunction: ReturnType<typeof vi.fn>;
      deleteFunction: ReturnType<typeof vi.fn>;
      existsFunction: ReturnType<typeof vi.fn>;
      getByIdFunction: ReturnType<typeof vi.fn>;
      getInfoFunction: ReturnType<typeof vi.fn>;
      strategies: JSONObject;
      updateFunction: ReturnType<typeof vi.fn>;
      validateFunction: ReturnType<typeof vi.fn>;
      verifyFunction: ReturnType<typeof vi.fn>;
    };

    const someStrategy = () => ({
      config: {
        authenticateOptions: { someAuthenticate: "options" },
        authenticator: "SomeStrategy",
        fields: ["aField", "anotherField"],
        strategyOptions: { someStrategy: "options" },
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
    });

    beforeEach(() => {
      instance = {
        afterRegisterFunction: vi.fn(),
        authenticators: { SomeStrategy: vi.fn() },
        createFunction: vi.fn(),
        deleteFunction: vi.fn(),
        existsFunction: vi.fn(),
        getByIdFunction: vi.fn(),
        getInfoFunction: vi.fn(),
        strategies: { someStrategy: someStrategy() },
        updateFunction: vi.fn(),
        validateFunction: vi.fn(),
        verifyFunction: vi.fn(),
      };

      /*
       * Built and handed to the constructor, rather than assigned over
       * `plugin._instance` after the fact: the field is `private readonly`,
       * and what the Mocha spec wanted was a plugin whose instance exposes
       * the strategy methods — which is what a constructor argument says.
       */
      plugin = createPlugin(PLUGIN_NAME, { instance });

      pluginsManager.strategies.someStrategy = {
        methods: {
          afterRegister: instance.afterRegisterFunction,
          create: instance.createFunction,
          delete: instance.deleteFunction,
          exists: instance.existsFunction,
          getById: instance.getByIdFunction,
          getInfo: instance.getInfoFunction,
          update: instance.updateFunction,
          validate: instance.validateFunction,
        },
        owner: plugin.name,
        strategy: instance.strategies.someStrategy,
      };

      pluginsOf(pluginsManager).set(plugin.name, plugin);
    });

    describe("#getStrategyFields", () => {
      it("answers the fields the strategy's config declares", () => {
        expect(pluginsManager.getStrategyFields("someStrategy")).toEqual([
          "aField",
          "anotherField",
        ]);
      });
    });

    describe("#hasStrategyMethod", () => {
      it("answers true for a method the strategy registered", () => {
        expect(pluginsManager.hasStrategyMethod("someStrategy", "exists")).toBe(
          true,
        );
      });

      it("answers false for a method it did not", () => {
        expect(
          pluginsManager.hasStrategyMethod("someStrategy", "notExists"),
        ).toBe(false);
      });
    });

    describe("#getStrategyMethod", () => {
      it("answers the registered method", () => {
        expect(
          pluginsManager.getStrategyMethod("someStrategy", "exists"),
        ).toBeTypeOf("function");
      });
    });

    describe("#_initAuthenticators", () => {
      it.each([[[]], ["foobar"], [123], [true]])(
        "refuses an authenticators property that is not an object: %s",
        (authenticators) => {
          plugin.instance.authenticators = invalid(authenticators);

          expect(() => pluginsManager._initAuthenticators(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.authenticators.not_an_object",
            }),
          );
        },
      );

      it.each([[() => {}], ["foobar"], [true], [123]])(
        "refuses an authenticator that is not a constructor: %s",
        (ctor) => {
          instance.authenticators.foo = ctor;

          expect(() => pluginsManager._initAuthenticators(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.authenticators.invalid_authenticator",
            }),
          );
        },
      );

      it("copies the plugin's authenticators under its name", () => {
        pluginsManager._initAuthenticators(plugin);

        expect(pluginsManager.authenticators[PLUGIN_NAME]).toEqual({
          SomeStrategy: instance.authenticators.SomeStrategy,
        });
      });
    });

    describe("#_initStrategies", () => {
      beforeEach(() => {
        pluginsManager.strategies = {};
        pluginsManager.authenticators[plugin.name] = {
          SomeStrategy: instance.authenticators.SomeStrategy,
        };
        plugin.initCalled = true;
      });

      it("registers a well-formed strategy, its methods, and its authenticator", async () => {
        const answer = { foo: "bar" };

        instance.existsFunction.mockReturnValue(answer);
        instance.verifyFunction.mockResolvedValue({ kuid: "foo" });
        users.set("foo", { _id: "foo" });

        pluginsManager._initStrategies(plugin);

        const registered = pluginsManager.strategies.someStrategy;

        expect(registered.strategy).toEqual(instance.strategies.someStrategy);
        expect(Object.keys(registered.methods).sort()).toEqual([
          "afterRegister",
          "create",
          "delete",
          "exists",
          "getById",
          "getInfo",
          "update",
          "validate",
        ]);
        expect(instance.afterRegisterFunction).toHaveBeenCalledTimes(1);
        expect(instance.afterRegisterFunction.mock.calls[0][0]).toBeInstanceOf(
          instance.authenticators.SomeStrategy,
        );
        expect(instance.authenticators.SomeStrategy).toHaveBeenCalledTimes(1);
        expect(passport.use).toHaveBeenCalledWith(
          "someStrategy",
          expect.anything(),
          { someAuthenticate: "options" },
        );

        expect(await methodOf(registered.methods, "exists")(answer)).toEqual(
          answer,
        );
        expect(instance.existsFunction).toHaveBeenCalledTimes(1);

        /*
         * The verify adapter is what passport was handed, and the Mocha test
         * reached it the same way — off the authenticator's call. It ends the
         * test through its callback, so the assertion is the callback firing
         * without an error.
         */
        const verifyAdapter = instance.authenticators.SomeStrategy.mock
          .calls[0][1] as (...args: unknown[]) => void;

        await settle<void>((resolve, reject) => {
          verifyAdapter({}, (error: unknown) =>
            error ? reject(error) : resolve(),
          );
        });
      });

      it("registers a strategy of a plugin whose name carries upper case", () => {
        /*
         * Plugin names are stored lowercased, and `getPlugin` lowercases what
         * it is asked for — so a plugin renamed after registration is still
         * found.
         */
        plugin.name = plugin.name.toUpperCase();
        pluginsManager.authenticators = {
          [plugin.name]: { SomeStrategy: instance.authenticators.SomeStrategy },
        };

        pluginsManager._initStrategies(plugin);

        expect(pluginsManager.strategies.someStrategy.strategy).toEqual(
          instance.strategies.someStrategy,
        );
        expect(instance.afterRegisterFunction).toHaveBeenCalledTimes(1);
      });

      it("turns an error thrown by a strategy method into a plugin error", async () => {
        instance.existsFunction.mockImplementation(() => {
          throw new Error("some error");
        });

        pluginsManager._initStrategies(plugin);

        await expect(
          methodOf(
            pluginsManager.strategies.someStrategy.methods,
            "exists",
          )({
            foo: "bar",
          }),
        ).rejects.toBeInstanceOf(PluginImplementationError);
      });

      it.each([[{}], [[]], [null], [undefined], ["foobar"], [123], [true]])(
        "refuses a strategies property that is not a non-empty object: %s",
        (strategies) => {
          plugin.instance.strategies = invalid(strategies);

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              message: expect.stringContaining(
                '[test-plugin] the exposed "strategies" plugin property must be a non-empty object',
              ),
            }),
          );
        },
      );

      it.each([[[]], [null], [undefined], ["foobar"], [123], [true]])(
        "refuses a strategy that is not an object: %s",
        (strategy) => {
          instance.strategies.someStrategy = strategy;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.strategy.invalid_description",
            }),
          );
        },
      );

      it.each([[[]], [null], [undefined], ["foobar"], [123], [true]])(
        "refuses strategy methods that are not an object: %s",
        (methods) => {
          instance.strategies.someStrategy.methods = methods;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({ id: "plugin.strategy.invalid_methods" }),
          );
        },
      );

      it.each([[[]], [null], [undefined], ["foobar"], [123], [true]])(
        "refuses a strategy config that is not an object: %s",
        (config) => {
          instance.strategies.someStrategy.config = config;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              message: expect.stringContaining(
                `[test-plugin] Strategy someStrategy: expected a "config" property of type "object", got: ${config}`,
              ),
            }),
          );
        },
      );

      it.each([[[]], [null], [undefined], [{}], [123], [true]])(
        "refuses a required method that is not a method name: %s",
        (name) => {
          instance.strategies.someStrategy.methods.exists = name;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.strategy.invalid_method_type",
            }),
          );
        },
      );

      it.each(["exists", "create", "update", "delete", "validate", "verify"])(
        "refuses a required method the plugin does not expose: %s",
        (methodName) => {
          Reflect.deleteProperty(plugin.instance, `${methodName}Function`);

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.strategy.missing_method_function",
            }),
          );
        },
      );

      it.each(
        ["getInfo", "getById", "afterRegister"].flatMap((methodName) =>
          [[], {}, 123, false].map((value) => [methodName, value] as const),
        ),
      )(
        "refuses an optional method that is not a method name: %s = %s",
        (methodName, value) => {
          instance.strategies.someStrategy.methods[methodName] = value;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.strategy.invalid_method_type",
            }),
          );
        },
      );

      it.each(["getInfo", "getById", "afterRegister"])(
        "refuses an optional method the plugin does not expose: %s",
        (methodName) => {
          Reflect.deleteProperty(plugin.instance, `${methodName}Function`);

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.strategy.missing_method_function",
            }),
          );
        },
      );

      it.each([[[]], [{}], [123], [null], [undefined], [true]])(
        "refuses an authenticator that is not a name: %s",
        (authenticator) => {
          instance.strategies.someStrategy.config.authenticator = authenticator;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({
              id: "plugin.strategy.invalid_authenticator",
            }),
          );
        },
      );

      it("refuses an authenticator the plugin never registered", () => {
        instance.strategies.someStrategy.config.authenticator = "foobar";

        expect(() => pluginsManager._initStrategies(plugin)).toThrow(
          expect.objectContaining({
            id: "plugin.strategy.unknown_authenticator",
          }),
        );
      });

      it.each([[[]], ["foobar"], [123], [false]])(
        'refuses a "strategyOptions" that is not an object: %s',
        (options) => {
          instance.strategies.someStrategy.config.strategyOptions = options;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({ id: "plugin.strategy.invalid_option" }),
          );
        },
      );

      it.each([[[]], ["foobar"], [123], [false]])(
        'refuses an "authenticateOptions" that is not an object: %s',
        (options) => {
          instance.strategies.someStrategy.config.authenticateOptions = options;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({ id: "plugin.strategy.invalid_option" }),
          );
        },
      );

      it.each([[{}], ["foobar"], [123], [false]])(
        'refuses a "fields" config that is not an array: %s',
        (fields) => {
          instance.strategies.someStrategy.config.fields = fields;

          expect(() => pluginsManager._initStrategies(plugin)).toThrow(
            expect.objectContaining({ id: "plugin.strategy.invalid_fields" }),
          );
        },
      );

      it("unregisters a strategy before registering it a second time", () => {
        const unregister = vi.spyOn(pluginsManager, "unregisterStrategy");

        pluginsManager._initStrategies(plugin);

        expect(unregister).not.toHaveBeenCalled();

        pluginsManager._initStrategies(plugin);

        expect(unregister).toHaveBeenCalledTimes(1);
        expect(unregister).toHaveBeenCalledWith(plugin.name, "someStrategy");
      });
    });

    describe("#verifyAdapter", () => {
      let verifyAdapter: (...args: unknown[]) => void;

      beforeEach(() => {
        pluginsManager.strategies = {};
        pluginsManager.authenticators[plugin.name] = {
          SomeStrategy: instance.authenticators.SomeStrategy,
        };
        plugin.initCalled = true;

        pluginsManager._initStrategies(plugin);

        verifyAdapter = instance.authenticators.SomeStrategy.mock
          .calls[0][1] as (...args: unknown[]) => void;
      });

      /**
       * What the adapter answered, asserted from inside its callback — the
       * shape `settle` exists for. A callback that never fires is a timeout
       * rather than a pass, which is what Mocha's `done` gave and a bare
       * promise gives up.
       */
      const verified = (...args: unknown[]) =>
        settle<{ error: unknown; message: unknown; result: unknown }>(
          (resolve) => {
            verifyAdapter(
              ...args,
              (error: unknown, result: unknown, message: unknown) =>
                resolve({ error, message, result }),
            );
          },
        );

      it("refuses a verify that answers a non-thenable", async () => {
        instance.verifyFunction.mockReturnValue(null);

        const { error, message, result } = await verified("foo", "bar", "baz");

        expect(result).toBeUndefined();
        expect(message).toBeUndefined();
        expect(error).toBeInstanceOf(PluginImplementationError);
        expect(error).toMatchObject({
          id: "plugin.strategy.invalid_verify_return",
        });
      });

      it("refuses a verify that resolves to a value that is neither false nor an object", async () => {
        instance.verifyFunction.mockResolvedValue(true);

        const { error, message, result } = await verified("foo", "bar");

        expect(result).toBeUndefined();
        expect(message).toBeUndefined();
        expect(error).toBeInstanceOf(PluginImplementationError);
        expect(error).toMatchObject({
          message: expect.stringContaining(
            "[test-plugin] Strategy someStrategy: invalid authentication strategy result",
          ),
        });
      });

      it("refuses a kuid that is not a string", async () => {
        instance.verifyFunction.mockResolvedValue({ kuid: 123 });

        const { error, message, result } = await verified("foo", "bar");

        expect(result).toBeUndefined();
        expect(message).toBeUndefined();
        expect(error).toBeInstanceOf(PluginImplementationError);
        expect(error).toMatchObject({
          message: expect.stringContaining(
            "[test-plugin] Strategy someStrategy: invalid authentication kuid returned: expected a string, got a number",
          ),
        });
      });

      it("relays an explicit refusal", async () => {
        instance.verifyFunction.mockResolvedValue(false);

        expect(await verified()).toEqual({
          error: null,
          message: { message: null },
          result: false,
        });
      });

      it("supplies a default message for a refusal that carries none", async () => {
        instance.verifyFunction.mockResolvedValue({});

        expect(await verified()).toEqual({
          error: null,
          message: {
            message: 'Unable to log in using the strategy "someStrategy"',
          },
          result: false,
        });
      });

      it("relays the message a refusal carries", async () => {
        instance.verifyFunction.mockResolvedValue({
          message: '"NONE SHALL PASS!" -The Black Knight',
        });

        expect(await verified()).toEqual({
          error: null,
          message: { message: '"NONE SHALL PASS!" -The Black Knight' },
          result: false,
        });
      });

      it("answers the user a known kuid names", async () => {
        const user = { _id: "Waldo" };

        users.set("Waldo", user);
        instance.verifyFunction.mockResolvedValue({ kuid: "Waldo" });

        expect(await verified()).toMatchObject({ error: null, result: user });
      });

      it("refuses a kuid no user answers to", async () => {
        instance.verifyFunction.mockResolvedValue({ kuid: "Waldo" });

        const { error, message, result } = await verified();

        expect(result).toBeUndefined();
        expect(message).toBeUndefined();
        expect(error).toBeInstanceOf(PluginImplementationError);
        expect(error).toMatchObject({ id: "plugin.strategy.unknown_kuid" });
      });
    });

    describe("#unregisterStrategy", () => {
      it("removes the strategy, and tells passport about it", () => {
        pluginsManager.unregisterStrategy(plugin.name, "someStrategy");

        expect(pluginsManager.strategies).toEqual({});
        expect(passport.unuse).toHaveBeenCalledWith("someStrategy");
      });

      it("refuses a strategy that does not exist", () => {
        expect(() =>
          pluginsManager.unregisterStrategy(plugin.name, "foobar"),
        ).toThrow(NotFoundError);
        expect(() =>
          pluginsManager.unregisterStrategy(plugin.name, "foobar"),
        ).toThrow(
          expect.objectContaining({
            id: "plugin.strategy.strategy_not_found",
          }),
        );
      });

      it("refuses a removal asked by a plugin that does not own the strategy", () => {
        expect(() =>
          pluginsManager.unregisterStrategy(
            "Frank William Abagnale Jr.",
            "someStrategy",
          ),
        ).toThrow(
          expect.objectContaining({
            id: "plugin.strategy.unauthorized_removal",
          }),
        );
      });
    });

    describe("#registerStrategy", () => {
      it("defers the registration until the plugin's init has run", () => {
        const strategy = {
          config: { authenticator: "SomeStrategy" },
          methods: {
            create: vi.fn(),
            delete: vi.fn(),
            exists: vi.fn(),
            getById: vi.fn(),
            getInfo: vi.fn(),
            update: vi.fn(),
            validate: vi.fn(),
            verify: vi.fn(),
          },
        };

        pluginsManager.registerStrategy(plugin.name, "foobar", strategy);

        expect(instance.strategies.foobar).toBe(strategy);
        /* Deferred means deferred: nothing reached passport. */
        expect(passport.use).not.toHaveBeenCalled();
      });
    });
  });

  describe("#_initHooks", () => {
    it("attaches a hook declared by method name, and only to its own event", () => {
      const foo = vi.fn();
      const bar = vi.fn();

      plugin.instance.hooks = {
        "bar:foo": byName("bar"),
        "foo:bar": byName("foo"),
      };
      plugin.instance.foo = foo;
      plugin.instance.bar = bar;

      pluginsManager._initHooks(plugin);
      global.kuzzle.emit("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("attaches a hook declared as a function", () => {
      const foo = vi.fn();
      const bar = vi.fn();

      plugin.instance.hooks = { "bar:foo": foo, "foo:bar": bar };

      pluginsManager._initHooks(plugin);
      global.kuzzle.emit("foo:bar");

      expect(bar).toHaveBeenCalledTimes(1);
      expect(foo).not.toHaveBeenCalled();
    });

    it("attaches every target of a multi-target hook declared by method name", () => {
      const foo = vi.fn();
      const bar = vi.fn();
      const baz = vi.fn();

      plugin.instance.hooks = {
        "bar:foo": [byName("baz")],
        "foo:bar": [byName("foo"), byName("bar")],
      };
      plugin.instance.foo = foo;
      plugin.instance.bar = bar;
      plugin.instance.baz = baz;

      pluginsManager._initHooks(plugin);
      global.kuzzle.emit("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).toHaveBeenCalledTimes(1);
      expect(baz).not.toHaveBeenCalled();
    });

    it("attaches every target of a multi-target hook declared as functions", () => {
      const foo = vi.fn();
      const bar = vi.fn();
      const baz = vi.fn();

      plugin.instance.hooks = { "bar:foo": [baz], "foo:bar": [foo, bar] };

      pluginsManager._initHooks(plugin);
      global.kuzzle.emit("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).toHaveBeenCalledTimes(1);
      expect(baz).not.toHaveBeenCalled();
    });

    it("attaches a hook declared on a wildcarded event", () => {
      const foo = vi.fn();
      const bar = vi.fn();

      plugin.instance.hooks = {
        "bar:foo": byName("bar"),
        "foo:*": byName("foo"),
      };
      plugin.instance.foo = foo;
      plugin.instance.bar = bar;

      pluginsManager._initHooks(plugin);
      global.kuzzle.emit("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("refuses a hook target that names nothing callable", () => {
      plugin.instance.hooks = { "foo:bar": byName("fou") };
      plugin.instance.foo = () => {};

      global.NODE_ENV = "development";

      expect(() => pluginsManager._initHooks(plugin)).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_hook",
          message: expect.stringContaining('Did you mean "foo"'),
        }),
      );
    });
  });

  describe("#_initPipes", () => {
    it("attaches a pipe declared by method name, bound to the plugin instance", async () => {
      const foo = vi.fn(async function assertsItsReceiver(this: unknown) {
        expect(this).toBe(plugin.instance);
      });
      const bar = vi.fn();

      plugin.instance.pipes = {
        "bar:foo": byName("bar"),
        "foo:bar": byName("foo"),
      };
      plugin.instance.foo = foo;
      plugin.instance.bar = bar;

      pluginsManager._initPipes(plugin);
      await global.kuzzle.pipe("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("attaches a pipe declared as a function", async () => {
      const bar = vi.fn(async () => undefined);
      const foo = asPipe(yields());

      plugin.instance.pipes = { "bar:foo": bar, "foo:bar": foo };

      pluginsManager._initPipes(plugin);
      await global.kuzzle.pipe("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("attaches a pipe declared on a wildcarded event", async () => {
      const foo = vi.fn(async () => undefined);
      const bar = vi.fn();

      plugin.instance.pipes = {
        "bar:foo": byName("bar"),
        "foo:*": byName("foo"),
      };
      plugin.instance.foo = foo;
      plugin.instance.bar = bar;

      pluginsManager._initPipes(plugin);
      await global.kuzzle.pipe("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("attaches every target of a multi-target pipe declared by method name", async () => {
      const foo = vi.fn(async function assertsItsReceiver(this: unknown) {
        expect(this).toBe(plugin.instance);
      });
      const bar = vi.fn(async () => undefined);
      const baz = vi.fn(function alsoAssertsItsReceiver(
        this: unknown,
        ...args: unknown[]
      ) {
        expect(this).toBe(plugin.instance);
        callbackOf(args)();
      });

      plugin.instance.pipes = {
        "bar:foo": [byName("bar")],
        "foo:bar": [byName("foo"), byName("baz")],
      };
      plugin.instance.foo = foo;
      plugin.instance.bar = bar;
      plugin.instance.baz = baz;

      pluginsManager._initPipes(plugin);
      await global.kuzzle.pipe("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(baz).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("attaches every target of a multi-target pipe declared as functions", async () => {
      const foo = vi.fn(async () => undefined);
      const bar = vi.fn(async () => undefined);
      const baz = vi.fn(async () => undefined);

      plugin.instance.pipes = { "bar:foo": [bar], "foo:bar": [foo, baz] };

      pluginsManager._initPipes(plugin);
      await global.kuzzle.pipe("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(baz).toHaveBeenCalledTimes(1);
      expect(bar).not.toHaveBeenCalled();
    });

    it("refuses a pipe target that names nothing callable", () => {
      plugin.instance.pipes = { "foo:bar": byName("fou") };
      plugin.instance.foo = () => {};

      global.NODE_ENV = "development";

      expect(() => pluginsManager._initPipes(plugin)).toThrow(
        expect.objectContaining({
          id: "plugin.assert.invalid_pipe",
          message: expect.stringContaining('Did you mean "foo"'),
        }),
      );
    });

    it("relays a KuzzleError a pipe answers with", async () => {
      plugin.instance.pipes = { "foo:bar": byName("foo") };
      plugin.instance.foo = yields(new KuzzleInternalError("foobar"));

      pluginsManager._initPipes(plugin);

      await expect(global.kuzzle.pipe("foo:bar")).rejects.toMatchObject({
        message: "foobar",
      });
    });

    it("wraps anything else a pipe answers with in a plugin error", async () => {
      plugin.instance.pipes = { "foo:bar": byName("foo") };
      plugin.instance.foo = yields("foobar");

      pluginsManager._initPipes(plugin);

      await expect(global.kuzzle.pipe("foo:bar")).rejects.toMatchObject({
        id: "plugin.runtime.unexpected_error",
      });
    });

    it("warns when a pipe takes longer than the plugin's warning delay", async () => {
      const foo = asPipe(
        vi.fn((...args: unknown[]) => {
          setTimeout(callbackOf(args), 15);
        }),
      );

      plugin.instance.pipes = { "foo:bar": foo };
      plugin.config.pipeWarnTime = 10;

      pluginsManager._initPipes(plugin);
      await global.kuzzle.pipe("foo:bar");

      expect(foo).toHaveBeenCalledTimes(1);
      expect(pluginsManager.logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[test-plugin\] pipe for event 'foo:bar' is slow \(\d+ms\)/,
        ),
      );
    });

    it("accepts a pipe that answers a promise, and relays its result", async () => {
      plugin.instance.pipes = { "foo:bar": byName("foo") };
      plugin.instance.foo = vi.fn(async () => "foobar");

      pluginsManager._initPipes(plugin);

      expect(await global.kuzzle.pipe("foo:bar")).toBe("foobar");
    });

    it("stops calling a pipe once it is unregistered", async () => {
      const foo = vi.fn(async () => undefined);

      plugin.instance.pipes = { "foo:bar": foo };

      pluginsManager._initPipes(plugin);
      const pipeId = pluginsManager.registerPipe(plugin, "foo:baz", foo);

      pluginsManager.unregisterPipe(pipeId);
      await global.kuzzle.pipe("foo:baz");

      /*
       * Not covered by the Mocha spec at all: `unregisterPipe` is a public
       * method of the subject, and its only assertion was that
       * `kuzzle.unregisterPluginPipe` exists.
       */
      expect(foo).not.toHaveBeenCalled();
    });
  });

  describe("#exists", () => {
    /*
     * The Mocha suite ended on `describe("#loadPlugin", () => { it("", () => {}) })`
     * — an empty test with an empty name, which reported as a passing case
     * called "Plugin #loadPlugin ". `loadPlugins` reads the filesystem and
     * belongs to an integration test; what is unit-testable and was untested
     * is the registry question right next to it.
     */
    it("answers whether a plugin is registered under that name", () => {
      pluginsOf(pluginsManager).set(plugin.name, plugin);

      expect(pluginsManager.exists(PLUGIN_NAME)).toBe(true);
      expect(pluginsManager.exists("nope")).toBe(false);
    });
  });

  describe("#getActions", () => {
    it("answers an unregistered controller's actions as none", () => {
      expect(pluginsManager.isController("email")).toBe(false);
      expect(pluginsManager.getActions("email")).toEqual([]);
      expect(pluginsManager.isAction("email", "send")).toBe(false);
    });

    it("answers a registered controller's actions", async () => {
      plugin.instance.api = {
        email: { actions: { send: { handler: vi.fn(async () => undefined) } } },
      };

      await pluginsManager._initApi(plugin);

      expect(pluginsManager.getControllerNames()).toEqual(["email"]);
      expect(pluginsManager.getActions("email")).toEqual(["send"]);
      expect(pluginsManager.isAction("email", "send")).toBe(true);
    });
  });

  describe("#listStrategies", () => {
    it("answers the names of the registered strategies", () => {
      expect(pluginsManager.listStrategies()).toEqual([]);

      pluginsManager.strategies.someStrategy = invalid({});

      expect(pluginsManager.listStrategies()).toEqual(["someStrategy"]);
    });
  });
});
