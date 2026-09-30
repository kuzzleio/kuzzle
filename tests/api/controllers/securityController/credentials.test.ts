import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SecurityController from "../../../../lib/api/controllers/securityController";
import { KuzzleRequest } from "../../../../lib/api/request";
import { loadConfig } from "../../../../lib/config";
import { BadRequestError } from "../../../../lib/kerror/errors/badRequestError";
import { PluginImplementationError } from "../../../../lib/kerror/errors/pluginImplementationError";
import type { PreconditionError } from "../../../../lib/kerror/errors/preconditionError";
import { SizeLimitError } from "../../../../lib/kerror/errors/sizeLimitError";
import { restoreKuzzle, stubKuzzle, stubLogger } from "../../../mocks/kuzzle";

describe("#api/controllers/securityController — credentials", () => {
  let controller: SecurityController;
  let request: KuzzleRequest;
  let ask: ReturnType<typeof vi.fn>;
  let failures: Map<string, Error>;
  let strategyMethods: Map<string, ReturnType<typeof vi.fn>>;
  let getStrategyMethod: ReturnType<typeof vi.fn>;
  let hasStrategyMethod: ReturnType<typeof vi.fn>;
  let getStrategyFields: ReturnType<typeof vi.fn>;
  let listStrategies: ReturnType<typeof vi.fn>;
  let config: ReturnType<typeof loadConfig>;
  let logger: ReturnType<typeof stubLogger>;

  /** Registers the method a strategy answers for one of its hooks. */
  const strategy = (
    name: string,
    hook: string,
    impl: (...args: never[]) => unknown = () => ({ foo: "bar" }),
  ) => {
    const stub = vi.fn(impl);

    strategyMethods.set(`${name}:${hook}`, stub);

    return stub;
  };

  beforeEach(() => {
    failures = new Map();

    ask = vi.fn(async (event: string) => {
      const failure = failures.get(event);

      if (failure) {
        throw failure;
      }

      return undefined;
    });

    strategyMethods = new Map();
    listStrategies = vi.fn(() => ["someStrategy"]);
    getStrategyMethod = vi.fn((name: string, hook: string) =>
      strategyMethods.get(`${name}:${hook}`),
    );
    hasStrategyMethod = vi.fn(() => false);
    getStrategyFields = vi.fn(() => ["aField", "anotherField"]);

    config = JSON.parse(JSON.stringify(loadConfig()));
    logger = stubLogger();

    stubKuzzle({
      ask,
      config,
      log: logger,
      pipe: async () => undefined,
      pluginsManager: {
        getStrategyFields,
        getStrategyMethod,
        hasStrategyMethod,
        listStrategies,
      },
    });

    controller = new SecurityController();
    request = new KuzzleRequest(
      {
        _id: "someUserId",
        body: { some: "credentials" },
        controller: "security",
        strategy: "someStrategy",
      },
      {},
    );
  });

  afterEach(() => {
    restoreKuzzle();
    vi.restoreAllMocks();
  });

  const rejects = async (
    promise: Promise<unknown>,
    match: Record<string, unknown>,
    error:
      | typeof BadRequestError
      | typeof PluginImplementationError
      | typeof PreconditionError
      | typeof SizeLimitError = BadRequestError,
  ) => {
    await expect(promise).rejects.toBeInstanceOf(error);
    await expect(promise).rejects.toMatchObject(match);
  };

  /**
   * Every action below goes through `assertIsStrategyRegistered` first, and no
   * Mocha test ever registered anything but the strategy it then asked for —
   * so the guard that stands between an API call and an unknown plugin was
   * asserted nowhere. One row per action that has it.
   */
  describe("an unregistered strategy", () => {
    const actions = [
      "createCredentials",
      "updateCredentials",
      "hasCredentials",
      "validateCredentials",
      "deleteCredentials",
      "getCredentials",
      "getCredentialsById",
      "getCredentialFields",
      "searchUsersByCredentials",
    ] as const;

    it.each(actions)("should be rejected by #%s", async (action) => {
      request.input.args.strategy = "unknownStrategy";
      request.input.body = { query: {} };

      await rejects(controller[action](request), {
        id: "security.credentials.unknown_strategy",
      });
    });
  });

  describe("#createCredentials", () => {
    it("should validate, then create, and answer the plugin's result", async () => {
      const validate = strategy("someStrategy", "validate");
      const create = strategy("someStrategy", "create");

      await expect(controller.createCredentials(request)).resolves.toEqual({
        foo: "bar",
      });

      /* ⚠️ The fifth argument is what tells a strategy's `validate` hook that
       * this is a creation and not an update. The Mocha spec asserted the
       * first four arguments of both calls, so the one thing that differs
       * between #createCredentials and #updateCredentials went unasserted in
       * both. */
      expect(validate).toHaveBeenCalledWith(
        request,
        { some: "credentials" },
        "someUserId",
        "someStrategy",
        false,
      );
      expect(create).toHaveBeenCalledWith(
        request,
        { some: "credentials" },
        "someUserId",
        "someStrategy",
      );
    });

    it("should reject if the user does not exist, before validating", async () => {
      const validate = strategy("someStrategy", "validate");
      const error = new Error("foo");

      failures.set("core:security:user:get", error);

      await expect(controller.createCredentials(request)).rejects.toBe(error);

      expect(ask).toHaveBeenCalledWith("core:security:user:get", "someUserId");
      expect(validate).not.toHaveBeenCalled();
    });

    it("should log the action", async () => {
      strategy("someStrategy", "validate");
      strategy("someStrategy", "create");

      await controller.createCredentials(request);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('on user "someUserId."'),
      );
    });
  });

  describe("#updateCredentials", () => {
    it("should validate as an update, then update", async () => {
      const validate = strategy("someStrategy", "validate");
      const update = strategy("someStrategy", "update");

      await expect(controller.updateCredentials(request)).resolves.toEqual({
        foo: "bar",
      });

      expect(validate).toHaveBeenCalledWith(
        request,
        { some: "credentials" },
        "someUserId",
        "someStrategy",
        true,
      );
      expect(update).toHaveBeenCalledWith(
        request,
        { some: "credentials" },
        "someUserId",
        "someStrategy",
      );
    });

    it("should reject if the user does not exist, before validating", async () => {
      const validate = strategy("someStrategy", "validate");
      const error = new Error("foo");

      failures.set("core:security:user:get", error);

      await expect(controller.updateCredentials(request)).rejects.toBe(error);

      expect(validate).not.toHaveBeenCalled();
    });
  });

  describe("#hasCredentials", () => {
    it("should answer the strategy's exists method", async () => {
      const exists = strategy("someStrategy", "exists");

      await expect(controller.hasCredentials(request)).resolves.toEqual({
        foo: "bar",
      });

      expect(exists).toHaveBeenCalledWith(
        request,
        "someUserId",
        "someStrategy",
      );
    });
  });

  describe("#validateCredentials", () => {
    it("should answer the strategy's validate method", async () => {
      const validate = strategy("someStrategy", "validate");

      await expect(controller.validateCredentials(request)).resolves.toEqual({
        foo: "bar",
      });

      expect(validate).toHaveBeenCalledWith(
        request,
        { some: "credentials" },
        "someUserId",
        "someStrategy",
        false,
      );
    });

    /* The only credentials action whose `_id` is optional: it validates a
     * payload, which a user who does not exist yet may do. */
    it("should validate credentials that belong to nobody yet", async () => {
      const validate = strategy("someStrategy", "validate");

      request.input.args._id = undefined;

      await expect(
        controller.validateCredentials(request),
      ).resolves.toBeDefined();

      expect(validate).toHaveBeenCalledWith(
        request,
        { some: "credentials" },
        null,
        "someStrategy",
        false,
      );
    });
  });

  describe("#deleteCredentials", () => {
    it("should acknowledge the strategy's delete method", async () => {
      const remove = strategy("someStrategy", "delete");

      await expect(controller.deleteCredentials(request)).resolves.toEqual({
        acknowledged: true,
      });

      expect(remove).toHaveBeenCalledWith(
        request,
        "someUserId",
        "someStrategy",
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('on user "someUserId."'),
      );
    });
  });

  describe("#searchUsersByCredentials", () => {
    const query = {
      bool: { must: [{ match: { credentials: "test@test.com" } }] },
    };
    const found = {
      hits: [{ credentials: "test@test.com", kuid: "kuid" }],
      total: 1,
    };
    let search: ReturnType<typeof vi.fn>;
    let translateKoncorde: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      search = strategy("someStrategy", "search", () => found);
      translateKoncorde = vi.fn(async () => ({ translated: true }));
      (
        controller as unknown as { translateKoncorde: unknown }
      ).translateKoncorde = translateKoncorde;

      request.input.body = { query };
    });

    it("should answer the strategy's search method", async () => {
      await expect(
        controller.searchUsersByCredentials(request),
      ).resolves.toEqual(found);

      expect(getStrategyMethod).toHaveBeenCalledWith("someStrategy", "search");
      expect(translateKoncorde).not.toHaveBeenCalled();
      /* The pagination the Mocha spec dropped: `searchMethod` takes a second
       * argument, and a plugin that ignores it returns the whole collection. */
      expect(search).toHaveBeenCalledWith({ query }, { from: 0, size: 10 });
    });

    it("should reject if the strategy has no optional search method", async () => {
      strategyMethods.delete("someStrategy:search");

      await rejects(
        controller.searchUsersByCredentials(request),
        { id: "plugin.strategy.missing_optional_method" },
        PluginImplementationError,
      );
    });

    it("should reject if the size argument exceeds the server limit", async () => {
      config.limits.documentsFetchCount = 1;
      request.input.args.size = 10;

      await rejects(
        controller.searchUsersByCredentials(request),
        { id: "services.storage.get_limit_exceeded" },
        SizeLimitError,
      );
    });

    it("should reject an unsupported query language", async () => {
      request.input.args.lang = "turkish";

      await rejects(controller.searchUsersByCredentials(request), {
        id: "api.assert.invalid_argument",
      });
    });

    it('should translate the query when "lang" is "koncorde"', async () => {
      request.input.body = {
        query: { equals: { credentials: "test@test.com" } },
      };
      request.input.args.lang = "koncorde";

      await controller.searchUsersByCredentials(request);

      expect(translateKoncorde).toHaveBeenCalledWith({
        equals: { credentials: "test@test.com" },
      });
      expect(search).toHaveBeenCalledWith(
        { query: { translated: true } },
        expect.anything(),
      );
    });
  });

  describe("#getCredentials", () => {
    it("should answer the strategy's getInfo method when it has one", async () => {
      const getInfo = strategy("someStrategy", "getInfo");

      hasStrategyMethod.mockReturnValue(true);

      await expect(controller.getCredentials(request)).resolves.toEqual({
        foo: "bar",
      });

      expect(hasStrategyMethod).toHaveBeenCalledWith("someStrategy", "getInfo");
      expect(getInfo).toHaveBeenCalledWith(
        request,
        "someUserId",
        "someStrategy",
      );
    });

    it("should answer an empty object when it has none", async () => {
      strategy("someStrategy", "getInfo");

      await expect(controller.getCredentials(request)).resolves.toEqual({});

      expect(getStrategyMethod).not.toHaveBeenCalled();
    });
  });

  describe("#getCredentialsById", () => {
    it("should answer the strategy's getById method when it has one", async () => {
      const getById = strategy("someStrategy", "getById");

      hasStrategyMethod.mockReturnValue(true);

      await expect(controller.getCredentialsById(request)).resolves.toEqual({
        foo: "bar",
      });

      expect(hasStrategyMethod).toHaveBeenCalledWith("someStrategy", "getById");
      expect(getById).toHaveBeenCalledWith(
        request,
        "someUserId",
        "someStrategy",
      );
    });

    it("should answer an empty object when it has none", async () => {
      strategy("someStrategy", "getById");

      await expect(controller.getCredentialsById(request)).resolves.toEqual({});

      expect(getStrategyMethod).not.toHaveBeenCalled();
    });
  });

  describe("#getCredentialFields", () => {
    it("should answer the strategy's fields", async () => {
      await expect(controller.getCredentialFields(request)).resolves.toEqual([
        "aField",
        "anotherField",
      ]);

      expect(getStrategyFields).toHaveBeenCalledWith("someStrategy");
    });
  });

  describe("#getAllCredentialFields", () => {
    it("should answer every strategy's fields, by strategy", async () => {
      listStrategies.mockReturnValue(["someStrategy", "someOtherStrategy"]);

      await expect(controller.getAllCredentialFields()).resolves.toEqual({
        someOtherStrategy: ["aField", "anotherField"],
        someStrategy: ["aField", "anotherField"],
      });

      expect(getStrategyFields).toHaveBeenCalledWith("someStrategy");
      expect(getStrategyFields).toHaveBeenCalledWith("someOtherStrategy");
    });
  });
});
