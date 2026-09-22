import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import yaml from "yaml";

import {
  BaseController,
  NativeController,
} from "../../../lib/api/controllers/baseController";
import ServerController from "../../../lib/api/controllers/serverController";
import { KuzzleRequest } from "../../../lib/api/request";
import { ExternalServiceError } from "../../../lib/kerror/errors/externalServiceError";
import { restoreKuzzle, stubKuzzle } from "../../mocks/kuzzle";

describe("#api/controllers/ServerController", () => {
  const foo = { foo: "bar" };

  let controller: ServerController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let answers: Record<string, unknown>;
  let failing: Set<string>;
  let statistics: Record<string, ReturnType<typeof vi.fn>>;
  let pluginsManager: Record<string, unknown>;
  let funnelControllers: Map<string, BaseController>;

  beforeEach(() => {
    answers = {
      "core:api:openapi:app": { swagger: "2.0" },
      "core:api:openapi:kuzzle": { swagger: "2.0" },
      "core:cache:internal:info:get": {},
      "core:cache:public:info:get": {},
      "core:network:router:metrics": { connections: { http: 1, internal: 1 } },
      "core:realtime:hotelClerk:metrics": { rooms: 1, subscriptions: 1 },
      "core:security:user:admin:exist": true,
      "core:storage:private:info:get": {},
      "core:storage:public:info:get": { status: "green" },
      "kuzzle:api:funnel:metrics": {
        concurrentRequests: 2,
        pendingRequests: 42,
      },
    };
    failing = new Set();

    ask = vi.fn(async (event: string) => {
      if (failing.has(event)) {
        throw new Error(`${event} is down`);
      }

      return answers[event];
    });

    statistics = {
      getAllStats: vi.fn(async () => foo),
      getLastStats: vi.fn(async () => foo),
      getStats: vi.fn(async () => foo),
    };

    funnelControllers = new Map();
    pluginsManager = {
      application: { info: vi.fn(() => ({ commit: "42fea32fea42fea" })) },
      controllers: new Map(),
      getPluginsDescription: vi.fn(() => ({})),
      routes: [],
    };

    stubKuzzle({
      ask,
      config: { http: { routes: [] }, version: "2.56.0" },
      funnel: { controllers: funnelControllers },
      pipe: async () => undefined,
      pluginsManager,
      statistics,
    });

    controller = new ServerController();
    request = new KuzzleRequest({
      controller: "server",
      index: "%text",
      collection: "unit-test-serverController",
    });
  });

  afterEach(() => {
    restoreKuzzle();
  });

  it("should inherit the base constructor", () => {
    expect(controller).toBeInstanceOf(NativeController);
  });

  describe("#statistics", () => {
    it("should forward getStats to the statistics module", async () => {
      await expect(controller.getStats(request)).resolves.toMatchObject(foo);

      expect(statistics.getStats).toHaveBeenCalledOnce();
      expect(statistics.getStats).toHaveBeenCalledWith(request);
    });

    it("should forward getLastStats to the statistics module", async () => {
      /* No argument: `getLastStats`, `getAllStats` and `now` take none, and
       * the Mocha spec handed each of them the request — TS2554 x3. */
      await expect(controller.getLastStats()).resolves.toMatchObject(foo);

      expect(statistics.getLastStats).toHaveBeenCalledOnce();
    });

    it("should forward getAllStats to the statistics module", async () => {
      await expect(controller.getAllStats()).resolves.toMatchObject(foo);

      expect(statistics.getAllStats).toHaveBeenCalledOnce();
    });
  });

  describe("#adminExists", () => {
    it("should ask the security module", async () => {
      await expect(controller.adminExists()).resolves.toMatchObject({
        exists: true,
      });

      expect(ask).toHaveBeenCalledWith("core:security:user:admin:exist");
    });
  });

  describe("#now", () => {
    it("should resolve to a timestamp", async () => {
      const response = await controller.now();

      expect(response.now).toBeTypeOf("number");
    });
  });

  describe("#healthCheck", () => {
    it.each(["green", "yellow"])(
      'should answer "green" when the storage engine is %s and the caches are up',
      async (status) => {
        answers["core:storage:public:info:get"] = { status };

        const response = await controller.healthCheck(request);

        expect(request.response.error).toBeNull();
        expect(response.status).toBe("green");
        expect(response.services).toMatchObject({
          internalCache: "green",
          memoryStorage: "green",
          storageEngine: "green",
        });
      },
    );

    it("should check only the services it is asked for", async () => {
      request.input.args.services = "storageEngine";

      const response = await controller.healthCheck(request);

      expect(request.response.error).toBeNull();
      expect(response.status).toBe("green");
      expect(response.services.storageEngine).toBe("green");
      expect(response.services.internalCache).toBeUndefined();
      expect(response.services.memoryStorage).toBeUndefined();
    });

    it("should check several named services", async () => {
      request.input.args.services = "storageEngine,memoryStorage";

      const response = await controller.healthCheck(request);

      expect(response.status).toBe("green");
      expect(response.services.storageEngine).toBe("green");
      expect(response.services.memoryStorage).toBe("green");
      expect(response.services.internalCache).toBeUndefined();
    });

    it('should answer "red", with a 500, when the storage engine is red', async () => {
      answers["core:storage:public:info:get"] = { status: "red" };

      const response = await controller.healthCheck(request);

      expect(request.response.error).toBeInstanceOf(ExternalServiceError);
      expect(request.response.status).toBe(500);
      expect(response.status).toBe("red");
      expect(response.services).toMatchObject({
        internalCache: "green",
        memoryStorage: "green",
        storageEngine: "red",
      });
    });

    it.each([
      ["core:storage:public:info:get", "storageEngine"],
      ["core:cache:public:info:get", "memoryStorage"],
      ["core:cache:internal:info:get", "internalCache"],
    ])(
      'should answer "red", with a 500, when %s is down',
      async (event, service) => {
        failing.add(event);

        const response = await controller.healthCheck(request);

        expect(request.response.error).toBeInstanceOf(ExternalServiceError);
        expect(request.response.status).toBe(500);
        expect(response.status).toBe("red");
        expect(response.services[service]).toBe("red");
      },
    );
  });

  describe("#info", () => {
    it("should return a properly formatted server information object", async () => {
      const routes = {
        foo: {
          publicMethod: {
            controller: "foo",
            action: "publicMethod",
            http: [
              { path: "/u/r/l", url: "/u/r/l", verb: "FOO" },
              { path: "/u/:foobar", url: "/u/:foobar", verb: "FOO" },
            ],
          },
        },
      };
      const pluginRoutes = {
        foobar: {
          publicMethod: {
            action: "publicMethod",
            controller: "foobar",
            http: [{ path: "/foobar", url: "/foobar", verb: "BAR" }],
          },
          anotherMethod: { action: "anotherMethod", controller: "foobar" },
        },
      };

      const buildApiDefinition = vi
        .spyOn(controller, "_buildApiDefinition")
        .mockReturnValueOnce(routes)
        .mockReturnValueOnce(pluginRoutes);

      const response = await controller.info();

      expect(buildApiDefinition).toHaveBeenCalledTimes(2);
      expect(response.serverInfo.kuzzle.version).toBeTypeOf("string");
      expect(
        (response.serverInfo.kuzzle.application as { commit: string }).commit,
      ).toBeTypeOf("string");
      expect(response.serverInfo.kuzzle.api.routes).toMatchObject({
        ...routes,
        ...pluginRoutes,
      });
      expect(response.serverInfo.kuzzle.plugins).toBeTypeOf("object");
      expect(response.serverInfo.kuzzle.system).toBeTypeOf("object");
      expect(response.serverInfo.services).toBeTypeOf("object");
    });

    it("should reject if a service cannot be reached", async () => {
      failing.add("core:storage:public:info:get");

      await expect(controller.info()).rejects.toThrow(
        "core:storage:public:info:get is down",
      );
    });
  });

  describe("#publicApi", () => {
    it("should build the api definition from both controller maps", async () => {
      const buildApiDefinition = vi
        .spyOn(controller, "_buildApiDefinition")
        .mockReturnValue({});

      await controller.publicApi();

      expect(buildApiDefinition).toHaveBeenCalledTimes(2);
      expect(buildApiDefinition).toHaveBeenNthCalledWith(
        1,
        global.kuzzle.funnel.controllers,
        global.kuzzle.config.http.routes,
      );
      expect(buildApiDefinition).toHaveBeenNthCalledWith(
        2,
        global.kuzzle.pluginsManager.controllers,
        global.kuzzle.pluginsManager.routes,
      );
    });
  });

  describe("#openapi", () => {
    it("should answer the Kuzzle definition by default", async () => {
      await expect(controller.openapi(request)).resolves.toBeTypeOf("object");

      expect(ask).toHaveBeenCalledWith("core:api:openapi:kuzzle");
    });

    it("should answer the application definition when scoped to the app", async () => {
      request.input.args.scope = "app";

      await expect(controller.openapi(request)).resolves.toBeTypeOf("object");

      expect(ask).toHaveBeenCalledWith("core:api:openapi:app");
    });

    it("should answer YAML when asked for it", async () => {
      request.input.args.format = "yaml";

      const definition = yaml.parse(await controller.openapi(request));

      expect(definition.swagger).toBeTypeOf("string");
    });
  });

  describe("#metrics", () => {
    it("should gather the metrics of the three modules that report them", async () => {
      const response = await controller.metrics();

      expect(response.api).toMatchObject({
        concurrentRequests: 2,
        pendingRequests: 42,
      });
      expect(response.network).toMatchObject({
        connections: { http: 1, internal: 1 },
      });
      expect(response.realtime).toMatchObject({ rooms: 1, subscriptions: 1 });
    });
  });

  describe("#_buildApiDefinition", () => {
    it("should return the api definition of the controllers it is given", () => {
      const nativeController = new NativeController();
      nativeController._addAction("publicMethod", () => {});
      nativeController._addAction("baz", () => {});

      const pluginController = new BaseController();
      pluginController._addAction("publicMethod", () => {});
      pluginController._addAction("anotherMethod", () => {});

      const apiDefinition = controller._buildApiDefinition(
        new Map([["foo", nativeController]]),
        [
          {
            verb: "foo",
            action: "publicMethod",
            controller: "foo",
            path: "/u/r/l",
          },
          {
            verb: "foo",
            action: "publicMethod",
            controller: "foo",
            path: "/u/:foobar",
          },
        ],
      );

      /* Two arguments: the Mocha spec passed a third (`"/"`), which the
       * signature does not declare — TS2554. */
      const pluginApiDefinition = controller._buildApiDefinition(
        new Map([["foobar", pluginController]]),
        [
          {
            verb: "bar",
            action: "publicMethod",
            controller: "foobar",
            path: "/foobar",
          },
        ],
      );

      expect(apiDefinition).toMatchObject({
        foo: {
          publicMethod: {
            controller: "foo",
            action: "publicMethod",
            http: [
              { url: "/u/r/l", path: "/u/r/l", verb: "FOO" },
              { url: "/u/:foobar", path: "/u/:foobar", verb: "FOO" },
            ],
          },
        },
      });
      expect(pluginApiDefinition).toMatchObject({
        foobar: {
          publicMethod: {
            action: "publicMethod",
            controller: "foobar",
            http: [{ url: "/foobar", path: "/foobar", verb: "BAR" }],
          },
          anotherMethod: { action: "anotherMethod", controller: "foobar" },
        },
      });
    });
  });
});
